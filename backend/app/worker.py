"""Worker de monitoramento: `python -m app.worker`.

Processo separado da API. A cada ciclo: verifica todos os dispositivos ativos em paralelo,
grava as amostras, atualiza o estado (com histerese), cria eventos, avisa no Telegram e
empurra o estado novo aos dashboards abertos. Uma vez por hora agrega métricas e aplica retenção.
"""

import asyncio
import contextlib
import logging
import signal
import time
import uuid
from collections import defaultdict
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.redis import close_redis, get_redis
from app.core.security import decrypt_secret
from app.db.models import Device, Event, Metric, NotificationChannel
from app.db.session import dispose_engine, get_sessionmaker
from app.schemas.events import EventOut
from app.services import heartbeat, realtime
from app.services.checks import CheckResult, run_check
from app.services.notifier import EventContext, describe, send_telegram, telegram_text
from app.services.rollup import run_rollup
from app.services.snapshots import serialize_devices
from app.services.state import DeviceState, evaluate
from app.services.stats import WINDOW_SIZE, window_stats

log = logging.getLogger("orbnoc.worker")


@dataclass(frozen=True)
class Snap:
    """Cópia imutável do dispositivo; a sessão do banco não fica aberta durante a rede."""

    id: int
    owner_id: int
    name: str
    ip: str
    check_type: str
    port: int | None
    sla_threshold_ms: int | None
    state: DeviceState
    status_changed_at: datetime | None


Checker = Callable[[Snap], Awaitable[CheckResult]]
Sender = Callable[[str, str, str], Awaitable[tuple[bool, str | None]]]


async def default_checker(snap: Snap) -> CheckResult:
    return await run_check(snap.check_type, snap.ip, snap.port)


async def _load_snaps() -> list[Snap]:
    async with get_sessionmaker()() as session:
        devices = (await session.scalars(select(Device).where(Device.enabled.is_(True)))).all()
    return [
        Snap(
            d.id, d.owner_id, d.name, d.ip, d.check_type, d.port, d.sla_threshold_ms,
            DeviceState(d.status, d.consecutive_failures, d.sla_breach_count, d.sla_breached),
            d.status_changed_at,
        )
        for d in devices
    ]  # fmt: skip


async def _run_checks(snaps: list[Snap], checker: Checker) -> list[CheckResult]:
    semaphore = asyncio.Semaphore(get_settings().monitor_concurrency)

    async def one(snap: Snap) -> CheckResult:
        async with semaphore:
            try:
                return await checker(snap)
            except Exception:
                log.exception("Falha ao verificar %s", snap.ip)
                return CheckResult(False, error="erro interno")

    return list(await asyncio.gather(*(one(s) for s in snaps)))


async def _persist(
    snaps: list[Snap], results: list[CheckResult], at: datetime
) -> tuple[list[Event], dict[str, int]]:
    settings = get_settings()
    for attempt in (1, 2):
        try:
            async with get_sessionmaker()() as session:
                # Dispositivo apagado durante o ciclo: descarta o resultado em vez de violar a FK.
                alive = set(
                    await session.scalars(select(Device.id).where(Device.id.in_([s.id for s in snaps])))
                )
                pairs = [(s, r) for s, r in zip(snaps, results, strict=True) if s.id in alive]
                if not pairs:
                    return [], {}
                session.add_all(
                    Metric(device_id=s.id, recorded_at=at, ok=r.ok, latency_ms=r.latency_ms) for s, r in pairs
                )
                await session.flush()

                # Últimas amostras de cada dispositivo (janela limitada no tempo para usar o índice).
                lookback = at - timedelta(seconds=settings.monitor_interval_seconds * WINDOW_SIZE * 3)
                ranked = (
                    select(
                        Metric.device_id, Metric.latency_ms, Metric.ok, Metric.recorded_at,
                        func.row_number().over(partition_by=Metric.device_id, order_by=Metric.recorded_at.desc()).label("rn"),
                    )
                    .where(Metric.device_id.in_([s.id for s, _ in pairs]), Metric.recorded_at >= lookback)
                    .subquery()
                )  # fmt: skip
                rows = await session.execute(
                    select(ranked)
                    .where(ranked.c.rn <= WINDOW_SIZE)
                    .order_by(ranked.c.device_id, ranked.c.recorded_at)
                )
                windows: dict[int, list[float | None]] = defaultdict(list)
                for row in rows:
                    windows[row.device_id].append(row.latency_ms if row.ok else None)

                updates, events = [], []
                counts: dict[str, int] = defaultdict(int)
                for snap, result in pairs:
                    t = evaluate(
                        snap.state, ok=result.ok, latency_ms=result.latency_ms, sla_threshold_ms=snap.sla_threshold_ms,
                        failure_threshold=settings.failure_threshold, sla_consecutive=settings.sla_breach_consecutive,
                    )  # fmt: skip
                    stats = window_stats(windows[snap.id])
                    counts[t.state.status] += 1
                    updates.append(
                        {
                            "id": snap.id, "status": t.state.status, "consecutive_failures": t.state.consecutive_failures,
                            "sla_breach_count": t.state.sla_breach_count, "sla_breached": t.state.sla_breached,
                            "status_changed_at": at if t.state.status != snap.state.status else snap.status_changed_at,
                            "last_check_at": at, "latency": result.latency_ms, "avg_latency": stats.avg,
                            "min_latency": stats.min, "max_latency": stats.max, "jitter": stats.jitter,
                            "packet_loss": stats.packet_loss,
                        }
                    )  # fmt: skip
                    for spec in t.events:
                        ctx = EventContext(
                            spec.kind,
                            snap.name,
                            snap.ip,
                            result.latency_ms,
                            snap.sla_threshold_ms,
                            result.error,
                        )
                        events.append(
                            Event(
                                owner_id=snap.owner_id, device_id=snap.id, device_name=snap.name, device_ip=snap.ip,
                                kind=spec.kind, severity=spec.severity, message=describe(ctx), created_at=at,
                            )
                        )  # fmt: skip
                await session.execute(update(Device), updates)
                session.add_all(events)
                await session.flush()
                await session.commit()
                return events, dict(counts)
        except IntegrityError:
            if attempt == 2:
                raise
            log.warning("Conflito ao gravar o ciclo (dispositivo removido?); tentando novamente")
    return [], {}


async def _publish(owner_ids: set[int], events: list[Event]) -> None:
    async with get_sessionmaker()() as session:
        devices = (
            await session.scalars(
                select(Device).where(Device.owner_id.in_(owner_ids)).order_by(Device.name, Device.id)
            )
        ).all()
    by_owner: dict[int, list[Device]] = defaultdict(list)
    for d in devices:
        by_owner[d.owner_id].append(d)
    for owner_id in owner_ids:
        await realtime.publish("devices", owner_id, serialize_devices(by_owner[owner_id]))
    for event in events:
        await realtime.publish(
            "event", event.owner_id, EventOut.model_validate(event).model_dump(mode="json")
        )


async def _notify(events: list[Event], send: Sender) -> None:
    if not events:
        return
    owners = {e.owner_id for e in events}
    async with get_sessionmaker()() as session:
        channels = {
            c.owner_id: c
            for c in await session.scalars(
                select(NotificationChannel).where(
                    NotificationChannel.owner_id.in_(owners),
                    NotificationChannel.kind == "telegram",
                    NotificationChannel.enabled.is_(True),
                )
            )
        }
    tasks = []
    for event in events:
        channel = channels.get(event.owner_id)
        token = decrypt_secret(channel.secret_encrypted) if channel and channel.secret_encrypted else None
        if channel and channel.chat_id and token:
            tasks.append(send(token, channel.chat_id, telegram_text(event.kind, event.message)))
    for outcome in await asyncio.gather(*tasks, return_exceptions=True):
        if isinstance(outcome, Exception) or (isinstance(outcome, tuple) and not outcome[0]):
            log.warning("Notificação não entregue")


async def run_cycle(
    *, checker: Checker = default_checker, send: Sender = send_telegram, now: datetime | None = None
) -> dict:
    started = time.monotonic()
    snaps = await _load_snaps()
    summary: dict = {"devices": len(snaps), "online": 0, "offline": 0, "events": 0}
    if snaps:
        results = await _run_checks(snaps, checker)
        events, counts = await _persist(snaps, results, now or datetime.now(UTC))
        owners = {s.owner_id for s in snaps}
        await _publish(owners, events)
        await _notify(events, send)
        summary.update(online=counts.get("online", 0), offline=counts.get("offline", 0), events=len(events))
    summary["duration_ms"] = round((time.monotonic() - started) * 1000)
    return summary


async def _hold_lock(worker_id: str) -> bool:
    """Trava simples: evita que duas instâncias notifiquem em duplicidade. Sem Redis, segue sem trava."""
    ttl = int(get_settings().monitor_interval_seconds * 3 + 30)
    try:
        redis = get_redis()
        if await redis.set(heartbeat.LOCK_KEY, worker_id, nx=True, ex=ttl):
            return True
        if await redis.get(heartbeat.LOCK_KEY) == worker_id:
            await redis.expire(heartbeat.LOCK_KEY, ttl)
            return True
        return False
    except Exception:
        log.warning("Redis indisponível; worker segue sem trava de instância única")
        return True


async def _release_lock(worker_id: str) -> None:
    with contextlib.suppress(Exception):
        redis = get_redis()
        if await redis.get(heartbeat.LOCK_KEY) == worker_id:
            await redis.delete(heartbeat.LOCK_KEY)


async def main() -> None:
    configure_logging()
    settings = get_settings()
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)

    worker_id = uuid.uuid4().hex
    last_rollup = float("-inf")
    log.info(
        "Worker iniciado (intervalo %.0fs, concorrência %d)",
        settings.monitor_interval_seconds,
        settings.monitor_concurrency,
    )
    while not stop.is_set():
        started = time.monotonic()
        if await _hold_lock(worker_id):
            try:
                summary = await run_cycle()
                with contextlib.suppress(Exception):
                    await heartbeat.write(summary)
            except Exception:
                log.exception("Ciclo de monitoramento falhou")
            if started - last_rollup >= 3600:
                try:
                    async with get_sessionmaker()() as session:
                        await run_rollup(session)
                    last_rollup = started
                except Exception:
                    log.exception("Rollup falhou")
        else:
            log.info("Outra instância do worker está ativa; aguardando")
        delay = max(0.5, settings.monitor_interval_seconds - (time.monotonic() - started))
        with contextlib.suppress(TimeoutError):
            await asyncio.wait_for(stop.wait(), delay)

    await _release_lock(worker_id)
    await close_redis()
    await dispose_engine()
    log.info("Worker encerrado")


if __name__ == "__main__":
    asyncio.run(main())
