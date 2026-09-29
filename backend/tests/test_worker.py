from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select

from app.core.security import encrypt_secret
from app.db.models import Device, Event, Metric, MetricHourly, NotificationChannel
from app.services import notifier
from app.services.probes import ProbeResult
from app.services.sla import rollup_hourly, sla_by_device
from app.worker.loop import is_due, run_maintenance, run_round

from .conftest import create_user

FAIL = ProbeResult(False, None, "icmp", None, "sem resposta")
T0 = datetime(2026, 3, 1, 12, 30, tzinfo=UTC)


async def seed(sessionmaker, settings, telegram=False, **device_kw):
    uid = await create_user(sessionmaker)
    async with sessionmaker() as s:
        d = Device(user_id=uid, name="Core", ip="10.0.0.1", interval_seconds=5, **device_kw)
        s.add(d)
        if telegram:
            s.add(
                NotificationChannel(
                    user_id=uid,
                    kind="telegram",
                    enabled=True,
                    secret_encrypted=encrypt_secret("1:tok", settings),
                    target="99",
                )
            )
        await s.commit()
        return uid, d.id


class Recorder:
    def __init__(self):
        self.texts = []

    async def __call__(self, target, text, client=None):
        self.texts.append(text)
        return True, None


async def rounds(sessionmaker, redis, settings, prober, n, start=T0):
    for i in range(n):
        await run_round(
            sessionmaker, redis, settings, prober, now=start + timedelta(seconds=10 * i)
        )


async def test_round_records_metric_and_state(sessionmaker, redis, settings, prober):
    _, did = await seed(sessionmaker, settings)
    stats = await run_round(sessionmaker, redis, settings, prober, now=T0)
    assert stats.checked == 1
    async with sessionmaker() as s:
        d = await s.get(Device, did)
        assert d.status == "online" and d.latency == 12.5 and d.last_check == T0
        assert await s.scalar(select(func.count()).select_from(Metric)) == 1
        assert (
            await s.scalar(select(func.count()).select_from(Event)) == 0
        )  # unknown→online: sem alerta


async def test_offline_only_after_three_failures_and_notifies_once(
    sessionmaker, redis, settings, prober, monkeypatch
):
    rec = Recorder()
    monkeypatch.setattr(notifier, "send_telegram", rec)
    _, did = await seed(sessionmaker, settings, telegram=True, status="online")
    prober.results["10.0.0.1"] = FAIL
    await rounds(sessionmaker, redis, settings, prober, 2)
    async with sessionmaker() as s:
        assert (await s.get(Device, did)).status == "online"  # 2 falhas: ainda online
    assert rec.texts == []
    await rounds(sessionmaker, redis, settings, prober, 6, start=T0 + timedelta(minutes=5))
    async with sessionmaker() as s:
        d = await s.get(Device, did)
        events = (await s.scalars(select(Event))).all()
    assert d.status == "offline"
    assert [e.kind for e in events] == ["offline"]
    assert len(rec.texts) == 1 and "HOST OFFLINE" in rec.texts[0]
    # recuperação
    prober.results["10.0.0.1"] = ProbeResult(True, 8.0, "icmp")
    await run_round(sessionmaker, redis, settings, prober, now=T0 + timedelta(minutes=30))
    assert len(rec.texts) == 2 and "RECUPERAÇÃO" in rec.texts[1]


async def test_sla_breach_alerts_once(sessionmaker, redis, settings, prober, monkeypatch):
    rec = Recorder()
    monkeypatch.setattr(notifier, "send_telegram", rec)
    await seed(sessionmaker, settings, telegram=True, status="online", sla_threshold_ms=50)
    prober.results["10.0.0.1"] = ProbeResult(True, 200.0, "icmp")
    await rounds(sessionmaker, redis, settings, prober, 4)
    assert len(rec.texts) == 1 and "DESEMPENHO" in rec.texts[0]


async def test_no_telegram_no_send_but_event_kept(
    sessionmaker, redis, settings, prober, monkeypatch
):
    rec = Recorder()
    monkeypatch.setattr(notifier, "send_telegram", rec)
    await seed(sessionmaker, settings, status="online", failure_threshold=1)
    prober.results["10.0.0.1"] = FAIL
    await run_round(sessionmaker, redis, settings, prober, now=T0)
    assert rec.texts == []
    async with sessionmaker() as s:
        assert await s.scalar(select(func.count()).select_from(Event)) == 1


async def test_only_due_devices_are_checked(sessionmaker, redis, settings, prober):
    await seed(sessionmaker, settings)
    await run_round(sessionmaker, redis, settings, prober, now=T0)
    await run_round(sessionmaker, redis, settings, prober, now=T0 + timedelta(seconds=1))
    assert len(prober.calls) == 1
    await run_round(sessionmaker, redis, settings, prober, now=T0 + timedelta(seconds=6))
    assert len(prober.calls) == 2


def test_is_due():
    d = Device(interval_seconds=10, last_check=None)
    assert is_due(d, T0, 2.0)
    d.last_check = T0
    assert not is_due(d, T0 + timedelta(seconds=8), 2.0)
    assert is_due(d, T0 + timedelta(seconds=9), 2.0)


async def test_blocked_host_at_check_time_counts_as_failure(sessionmaker, redis, settings, prober):
    uid = await create_user(sessionmaker)
    async with sessionmaker() as s:
        s.add(
            Device(
                user_id=uid, name="evil", ip="169.254.169.254", status="online", failure_threshold=1
            )
        )
        await s.commit()
    await run_round(sessionmaker, redis, settings, prober, now=T0)
    assert prober.calls == []  # nem chegou a sondar
    async with sessionmaker() as s:
        d = await s.scalar(select(Device))
        assert d.status == "offline" and "bloqueado" in d.last_error


async def test_publishes_devices_update_to_redis(sessionmaker, redis, settings, prober):
    uid, _ = await seed(sessionmaker, settings)
    pubsub = redis.pubsub()
    await pubsub.subscribe(f"orbnoc:user:{uid}")
    await pubsub.get_message(timeout=1)  # confirmação da assinatura
    await run_round(sessionmaker, redis, settings, prober, now=T0)
    msg = None
    for _ in range(10):
        msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1)
        if msg:
            break
    await pubsub.aclose()
    assert msg and '"devices_update"' in msg["data"] and '"latency": 12.5' in msg["data"]


async def test_hourly_rollup_and_sla_windows(sessionmaker, settings):
    uid, did = await seed(sessionmaker, settings)
    async with sessionmaker() as s:
        for i in range(10):  # 10 amostras na hora 12h: 8 ok, 2 falhas
            s.add(
                Metric(
                    device_id=did,
                    recorded_at=T0 + timedelta(minutes=i),
                    ok=i >= 2,
                    latency=10.0 + i if i >= 2 else None,
                )
            )
        for i in range(4):  # 4 amostras 3 dias antes, todas ok
            s.add(
                Metric(
                    device_id=did,
                    recorded_at=T0 - timedelta(days=3) + timedelta(minutes=i),
                    ok=True,
                    latency=50.0,
                )
            )
        await s.commit()
        await rollup_hourly(s, T0, hours=100)
        await rollup_hourly(s, T0 - timedelta(days=3), hours=2)
        await s.commit()
        now = T0 + timedelta(hours=1)
        w24 = (await sla_by_device(s, [did], "24h", now))[did]
        w7 = (await sla_by_device(s, [did], "7d", now))[did]
    assert (w24.sample_count, w24.uptime_pct) == (10, 80.0)
    assert w24.avg_latency == 15.5  # média de 12..19
    assert (w7.sample_count, round(w7.uptime_pct, 3)) == (14, round(12 / 14 * 100, 3))


async def test_rollup_is_idempotent(sessionmaker, settings):
    _, did = await seed(sessionmaker, settings)
    async with sessionmaker() as s:
        s.add(Metric(device_id=did, recorded_at=T0, ok=True, latency=5.0))
        await s.commit()
        for _ in range(3):
            await rollup_hourly(s, T0)
            await s.commit()
        row = await s.scalar(select(MetricHourly))
    assert row.samples == 1


async def test_retention_removes_old_rows(sessionmaker, settings):
    uid, did = await seed(sessionmaker, settings)
    now = datetime.now(UTC)
    async with sessionmaker() as s:
        s.add_all(
            [
                Metric(device_id=did, recorded_at=now - timedelta(days=30), ok=True, latency=1.0),
                Metric(device_id=did, recorded_at=now - timedelta(days=1), ok=True, latency=1.0),
                Event(
                    user_id=uid,
                    kind="offline",
                    severity="error",
                    message="velho",
                    created_at=now - timedelta(days=200),
                ),
                Event(
                    user_id=uid, kind="offline", severity="error", message="novo", created_at=now
                ),
            ]
        )
        await s.commit()
    await run_maintenance(sessionmaker, settings, now)
    async with sessionmaker() as s:
        assert await s.scalar(select(func.count()).select_from(Metric)) == 1
        assert [e.message for e in (await s.scalars(select(Event))).all()] == ["novo"]
