"""SLA por janela de tempo (24h / 7d / 30d), combinando amostras cruas e agregados por hora."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import Float, and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Metric, MetricHourly, SystemState

ROLLUP_KEY = "rollup_until"
WINDOWS = {"24h": timedelta(hours=24), "7d": timedelta(days=7), "30d": timedelta(days=30)}


@dataclass
class SlaStats:
    samples: int = 0
    ok_samples: int = 0
    latency_sum: float = 0.0
    latency_count: int = 0

    @property
    def uptime_pct(self) -> float | None:
        return round(100 * self.ok_samples / self.samples, 3) if self.samples else None

    @property
    def avg_latency(self) -> float | None:
        return round(self.latency_sum / self.latency_count, 2) if self.latency_count else None

    def as_dict(self) -> dict:
        return {"uptime_pct": self.uptime_pct, "avg_latency_ms": self.avg_latency, "samples": self.samples}


def floor_hour(dt: datetime) -> datetime:
    return dt.astimezone(UTC).replace(minute=0, second=0, microsecond=0)


def ceil_hour(dt: datetime) -> datetime:
    f = floor_hour(dt)
    return f if f == dt.astimezone(UTC) else f + timedelta(hours=1)


async def get_rollup_until(session: AsyncSession) -> datetime | None:
    value = await session.scalar(select(SystemState.value).where(SystemState.key == ROLLUP_KEY))
    return datetime.fromisoformat(value) if value else None


async def _add_raw(
    session: AsyncSession, acc: dict[int, SlaStats], ids: list[int], start: datetime, end: datetime
) -> None:
    rows = await session.execute(
        select(
            Metric.device_id,
            func.count(),
            func.count().filter(Metric.ok),
            func.coalesce(func.sum(Metric.latency_ms), 0.0).cast(Float),
            func.count(Metric.latency_ms),
        )
        .where(and_(Metric.device_id.in_(ids), Metric.recorded_at >= start, Metric.recorded_at < end))
        .group_by(Metric.device_id)
    )
    for device_id, n, ok, lat_sum, lat_n in rows:
        s = acc[device_id]
        s.samples += n
        s.ok_samples += ok
        s.latency_sum += lat_sum
        s.latency_count += lat_n


async def _add_hourly(
    session: AsyncSession, acc: dict[int, SlaStats], ids: list[int], start: datetime, end: datetime
) -> None:
    rows = await session.execute(
        select(
            MetricHourly.device_id,
            func.sum(MetricHourly.samples),
            func.sum(MetricHourly.ok_samples),
            func.sum(MetricHourly.latency_sum),
            func.sum(MetricHourly.latency_count),
        )
        .where(and_(MetricHourly.device_id.in_(ids), MetricHourly.hour >= start, MetricHourly.hour < end))
        .group_by(MetricHourly.device_id)
    )
    for device_id, n, ok, lat_sum, lat_n in rows:
        s = acc[device_id]
        s.samples += int(n)
        s.ok_samples += int(ok)
        s.latency_sum += float(lat_sum)
        s.latency_count += int(lat_n)


async def compute_sla(
    session: AsyncSession, device_ids: list[int], since: datetime, now: datetime | None = None
) -> dict[int, SlaStats]:
    """Uptime e latência média no intervalo [since, now).

    Horas já agregadas (< rollup_until) vêm de metrics_hourly; o restante, das amostras cruas.
    """
    now = now or datetime.now(UTC)
    acc = {i: SlaStats() for i in device_ids}
    if not device_ids:
        return acc
    rolled = await get_rollup_until(session)
    first_full = ceil_hour(since)
    if rolled is None or rolled <= since or first_full >= rolled:
        await _add_raw(session, acc, device_ids, since, now)
        return acc
    await _add_hourly(session, acc, device_ids, first_full, rolled)
    if since < first_full:
        await _add_raw(session, acc, device_ids, since, first_full)
    await _add_raw(session, acc, device_ids, rolled, now)
    return acc
