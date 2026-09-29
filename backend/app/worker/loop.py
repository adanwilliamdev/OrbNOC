"""Processo do monitor (`python -m app.worker`). Um único worker: sem eleição de líder.

Cada rodada: seleciona os dispositivos vencidos, checa com concorrência limitada, grava a
métrica, atualiza o estado, gera evento e notifica só quando algo muda. Uma rodada nunca
começa antes da anterior terminar (loop sequencial).
"""

import asyncio
import contextlib
import json
import logging
import signal
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import redis.asyncio as aioredis
from redis.exceptions import RedisError
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.api.health import HEARTBEAT_KEY, LAST_ROUND_KEY
from app.core.config import Settings, get_settings
from app.db.models import AccessLog, Device, Event, Metric, MetricHourly, User
from app.db.session import create_engine, create_sessionmaker
from app.services import notifier, realtime
from app.services.events import record_event
from app.services.monitor import WINDOW, Transition, apply_result
from app.services.netguard import HostRejected, resolve_and_check
from app.services.probes import Prober, ProbeResult
from app.services.sla import rollup_hourly

log = logging.getLogger("orbnoc.worker")

ROLLUP_EVERY = 60  # s
RETENTION_EVERY = 3600  # s
ICMP_RECHECK_EVERY = 600  # s


@dataclass(slots=True)
class RoundStats:
    checked: int = 0
    transitions: int = 0
    duration_ms: int = 0


def is_due(device: Device, now: datetime, tick: float) -> bool:
    if device.last_check is None:
        return True
    return (now - device.last_check).total_seconds() >= device.interval_seconds - tick / 2


async def check_device(device: Device, prober: Prober, settings: Settings) -> ProbeResult:
    """Resolve + valida o host a cada checagem (defesa contra DNS rebinding) e sonda."""
    try:
        address = (await resolve_and_check(device.ip, settings.allow_private_networks))[0]
    except HostRejected as exc:
        return ProbeResult(False, None, "icmp", None, str(exc))
    return await prober.probe(address, device.check_type, device.port)


async def recent_samples(session: AsyncSession, device_id: int) -> list[float | None]:
    rows = (
        await session.execute(
            select(Metric.ok, Metric.latency)
            .where(Metric.device_id == device_id)
            .order_by(Metric.recorded_at.desc())
            .limit(WINDOW - 1)
        )
    ).all()
    return [lat if ok else None for ok, lat in reversed(rows)]


async def run_round(
    sessionmaker: async_sessionmaker[AsyncSession],
    redis: aioredis.Redis,
    settings: Settings,
    prober: Prober,
    now: datetime | None = None,
) -> RoundStats:
    started = time.perf_counter()
    now = now or datetime.now(UTC)
    stats = RoundStats()

    async with sessionmaker() as session:
        devices = [
            d
            for d in (
                await session.scalars(
                    select(Device)
                    .join(User, User.id == Device.user_id)
                    .where(User.is_active)
                    .order_by(Device.id)
                )
            ).all()
            if is_due(d, now, settings.worker_tick_seconds)
        ]
        if not devices:
            return stats

        semaphore = asyncio.Semaphore(settings.monitor_concurrency)

        async def bounded(device: Device) -> ProbeResult:
            async with semaphore:
                return await check_device(device, prober, settings)

        results = await asyncio.gather(*(bounded(d) for d in devices))

        pending: list[tuple[Device, Transition, Event]] = []
        touched_users: set[int] = set()
        for device, result in zip(devices, results, strict=True):
            recent = await recent_samples(session, device.id)
            transitions = apply_result(device, result, recent, now)
            session.add(
                Metric(
                    device_id=device.id,
                    recorded_at=now,
                    ok=result.ok,
                    latency=result.latency_ms if result.ok else None,
                    jitter=device.jitter,
                    packet_loss=device.packet_loss,
                )
            )
            touched_users.add(device.user_id)
            for tr in transitions:
                event = await record_event(
                    session, device.user_id, device.id, tr.kind, tr.severity, tr.message
                )
                pending.append((device, tr, event))
        await session.commit()
        stats.checked = len(devices)
        stats.transitions = len(pending)

        for user_id in touched_users:
            await realtime.publish_devices(redis, session, user_id)
        for _, _, event in pending:
            await realtime.publish_event(redis, event)
        await notify_transitions(session, settings, pending)

    stats.duration_ms = round((time.perf_counter() - started) * 1000)
    return stats


async def notify_transitions(
    session: AsyncSession, settings: Settings, pending: list[tuple[Device, Transition, Event]]
) -> None:
    by_user: dict[int, list[tuple[Device, Transition, Event]]] = defaultdict(list)
    for item in pending:
        by_user[item[0].user_id].append(item)
    sends = []
    for user_id, items in by_user.items():
        target = await notifier.load_target(session, user_id, settings)
        if target is None:
            continue
        for device, tr, _ in items:
            text = notifier.build_message(
                tr.kind, tr.message, device.name, device.ip, notifier.device_extra(device)
            )
            sends.append(notifier.send_telegram(target, text))
    if sends:
        await asyncio.gather(*sends, return_exceptions=True)


async def run_maintenance(
    sessionmaker: async_sessionmaker[AsyncSession], settings: Settings, now: datetime | None = None
) -> None:
    """Retenção: métricas cruas, agregados por hora, eventos e logs de acesso antigos."""
    now = now or datetime.now(UTC)
    async with sessionmaker() as session:
        await session.execute(
            delete(Metric).where(
                Metric.recorded_at < now - timedelta(days=settings.metrics_retention_days)
            )
        )
        await session.execute(
            delete(MetricHourly).where(
                MetricHourly.hour < now - timedelta(days=settings.hourly_retention_days)
            )
        )
        await session.execute(
            delete(Event).where(
                Event.created_at < now - timedelta(days=settings.events_retention_days)
            )
        )
        await session.execute(
            delete(AccessLog).where(
                AccessLog.created_at < now - timedelta(days=settings.access_log_retention_days)
            )
        )
        await session.commit()


async def heartbeat(redis: aioredis.Redis, stats: RoundStats | None, prober: Prober) -> None:
    try:
        await redis.set(HEARTBEAT_KEY, datetime.now(UTC).isoformat(), ex=300)
        if stats is not None and stats.checked:
            await redis.set(
                LAST_ROUND_KEY,
                json.dumps(
                    {
                        "finished_at": datetime.now(UTC).isoformat(),
                        "checked": stats.checked,
                        "duration_ms": stats.duration_ms,
                        "icmp_mode": prober.icmp_mode,
                    }
                ),
                ex=3600,
            )
    except RedisError:
        log.warning("Redis indisponível; heartbeat não gravado")


async def main() -> None:
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )
    settings = get_settings()
    engine = create_engine(settings)
    sessionmaker = create_sessionmaker(engine)
    redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    prober = Prober(settings.probe_timeout_seconds)
    await prober.detect()

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)

    log.info(
        "Worker iniciado (tick %.1fs, concorrência %d)",
        settings.worker_tick_seconds,
        settings.monitor_concurrency,
    )
    last_rollup = last_retention = last_icmp = 0.0
    while not stop.is_set():
        tick_start = loop.time()
        stats = None
        try:
            stats = await run_round(sessionmaker, redis, settings, prober)
            if tick_start - last_rollup >= ROLLUP_EVERY:
                async with sessionmaker() as session:
                    await rollup_hourly(session)
                    await session.commit()
                last_rollup = tick_start
            if tick_start - last_retention >= RETENTION_EVERY:
                await run_maintenance(sessionmaker, settings)
                last_retention = tick_start
            if prober.icmp_mode is None and tick_start - last_icmp >= ICMP_RECHECK_EVERY:
                await prober.detect()
                last_icmp = tick_start
        except Exception:  # noqa: BLE001 - o loop nunca pode morrer por uma rodada ruim
            log.exception("Erro na rodada do monitor")
        await heartbeat(redis, stats, prober)
        remaining = settings.worker_tick_seconds - (loop.time() - tick_start)
        with contextlib.suppress(TimeoutError):
            await asyncio.wait_for(stop.wait(), timeout=max(0.0, remaining))

    log.info("Encerrando worker")
    await redis.aclose()
    await engine.dispose()
