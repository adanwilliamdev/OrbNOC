"""Agregação por hora e retenção. Roda no worker, uma vez por hora."""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.models import Event, Metric, MetricHourly
from app.services.sla import ROLLUP_KEY, floor_hour, get_rollup_until

log = logging.getLogger(__name__)

_UPSERT = text(
    """
    INSERT INTO metrics_hourly (device_id, hour, samples, ok_samples, latency_sum, latency_count, latency_min, latency_max)
    SELECT device_id, date_trunc('hour', recorded_at), count(*), count(*) FILTER (WHERE ok),
           coalesce(sum(latency_ms), 0), count(latency_ms), min(latency_ms), max(latency_ms)
    FROM metrics WHERE recorded_at >= :start AND recorded_at < :end
    GROUP BY device_id, date_trunc('hour', recorded_at)
    ON CONFLICT (device_id, hour) DO UPDATE SET
        samples = EXCLUDED.samples, ok_samples = EXCLUDED.ok_samples,
        latency_sum = EXCLUDED.latency_sum, latency_count = EXCLUDED.latency_count,
        latency_min = EXCLUDED.latency_min, latency_max = EXCLUDED.latency_max
    """
)


async def _set_rollup_until(session: AsyncSession, value: datetime) -> None:
    await session.execute(
        text(
            "INSERT INTO system_state (key, value) VALUES (:k, :v) "
            "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
        ),
        {"k": ROLLUP_KEY, "v": value.isoformat()},
    )


async def run_rollup(session: AsyncSession, now: datetime | None = None) -> dict[str, int]:
    """Agrega as horas completas ainda não agregadas e aplica a retenção."""
    settings = get_settings()
    now = now or datetime.now(UTC)
    end = floor_hour(now)
    start = await get_rollup_until(session)
    if start is None:
        first = await session.scalar(select(func.min(Metric.recorded_at)))
        start = floor_hour(first) if first else end
    if start < end:
        await session.execute(_UPSERT, {"start": start, "end": end})
        await _set_rollup_until(session, end)
    elif await get_rollup_until(session) is None:
        await _set_rollup_until(session, end)
    rolled = await get_rollup_until(session) or end

    # Nunca apaga amostra que ainda não virou agregado.
    raw_cutoff = min(now - timedelta(days=settings.raw_metrics_retention_days), rolled)
    deleted_raw = (await session.execute(delete(Metric).where(Metric.recorded_at < raw_cutoff))).rowcount
    deleted_hourly = (
        await session.execute(
            delete(MetricHourly).where(
                MetricHourly.hour < now - timedelta(days=settings.hourly_metrics_retention_days)
            )
        )
    ).rowcount
    deleted_events = (
        await session.execute(
            delete(Event).where(Event.created_at < now - timedelta(days=settings.events_retention_days))
        )
    ).rowcount
    await session.commit()
    log.info("Rollup concluído: %s amostras cruas e %s eventos removidos", deleted_raw, deleted_events)
    return {
        "raw_deleted": deleted_raw or 0,
        "hourly_deleted": deleted_hourly or 0,
        "events_deleted": deleted_events or 0,
    }
