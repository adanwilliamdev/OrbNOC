"""Agregação por hora e SLA por janela de tempo (24 h, 7 d, 30 d)."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Device, MetricHourly

WINDOWS = {"24h": timedelta(hours=24), "7d": timedelta(days=7), "30d": timedelta(days=30)}

ROLLUP_SQL = text(
    """
    INSERT INTO metrics_hourly
        (device_id, hour, samples, ok_samples, avg_latency, min_latency, max_latency)
    SELECT device_id,
           date_trunc('hour', recorded_at) AS hour,
           count(*),
           count(*) FILTER (WHERE ok),
           avg(latency) FILTER (WHERE ok),
           min(latency) FILTER (WHERE ok),
           max(latency) FILTER (WHERE ok)
    FROM metrics
    WHERE recorded_at >= :since
    GROUP BY device_id, date_trunc('hour', recorded_at)
    ON CONFLICT (device_id, hour) DO UPDATE SET
        samples = EXCLUDED.samples,
        ok_samples = EXCLUDED.ok_samples,
        avg_latency = EXCLUDED.avg_latency,
        min_latency = EXCLUDED.min_latency,
        max_latency = EXCLUDED.max_latency
    """
)


def hour_floor(moment: datetime) -> datetime:
    return moment.astimezone(UTC).replace(minute=0, second=0, microsecond=0)


async def rollup_hourly(session: AsyncSession, now: datetime | None = None, hours: int = 2) -> None:
    """Recalcula a hora atual e as anteriores a partir das métricas cruas."""
    now = now or datetime.now(UTC)
    await session.execute(ROLLUP_SQL, {"since": hour_floor(now) - timedelta(hours=hours - 1)})


@dataclass(slots=True)
class SlaWindow:
    window: str
    uptime_pct: float | None
    avg_latency: float | None
    sample_count: int


async def sla_by_device(
    session: AsyncSession, device_ids: list[int], window: str, now: datetime | None = None
) -> dict[int, SlaWindow]:
    now = now or datetime.now(UTC)
    since = hour_floor(now - WINDOWS[window])
    rows = await session.execute(
        select(
            MetricHourly.device_id,
            func.sum(MetricHourly.samples),
            func.sum(MetricHourly.ok_samples),
            func.sum(MetricHourly.avg_latency * MetricHourly.ok_samples),
        )
        .where(MetricHourly.device_id.in_(device_ids), MetricHourly.hour >= since)
        .group_by(MetricHourly.device_id)
    )
    out: dict[int, SlaWindow] = {}
    for device_id, samples, ok, weighted in rows:
        samples, ok = int(samples or 0), int(ok or 0)
        out[device_id] = SlaWindow(
            window,
            round(ok / samples * 100, 3) if samples else None,
            round(float(weighted) / ok, 2) if ok and weighted is not None else None,
            samples,
        )
    for device_id in device_ids:
        out.setdefault(device_id, SlaWindow(window, None, None, 0))
    return out


async def sla_report(session: AsyncSession, user_id: int, window: str) -> list[dict]:
    devices = (
        await session.scalars(select(Device).where(Device.user_id == user_id).order_by(Device.id))
    ).all()
    sla = await sla_by_device(session, [d.id for d in devices], window)
    return [
        {
            "device_id": d.id,
            "name": d.name,
            "ip": d.ip,
            "location": d.location,
            "status": d.status,
            "window": window,
            "uptime_pct": sla[d.id].uptime_pct,
            "avg_latency": sla[d.id].avg_latency,
            "sample_count": sla[d.id].sample_count,
            "sla_threshold_ms": d.sla_threshold_ms,
        }
        for d in devices
    ]
