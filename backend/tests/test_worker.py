import asyncio
import json
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select

from app.core.security import encrypt_secret
from app.db.models import Device, Event, Metric, NotificationChannel
from app.services import realtime
from app.services.checks import CheckResult
from app.worker import Snap, run_cycle

from .conftest import add_device, make_user

T0 = datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)


class FakeNet:
    """Simula a rede: o teste decide, por IP, o resultado de cada ciclo."""

    def __init__(self):
        self.results: dict[str, CheckResult] = {}
        self.sent: list[tuple[str, str, str]] = []

    async def check(self, snap: Snap) -> CheckResult:
        return self.results.get(snap.ip, CheckResult(True, 5.0))

    async def send(self, token, chat, text):
        self.sent.append((token, chat, text))
        return True, None

    async def cycle(self, n=1, start=T0):
        out = None
        for _ in range(n):
            out = await run_cycle(
                checker=self.check,
                send=self.send,
                now=start + timedelta(seconds=10 * self.__dict__.setdefault("_i", 0)),
            )
            self._i += 1
        return out


DOWN = CheckResult(False, error="sem resposta ao ping")


async def test_ciclo_atualiza_estado_e_metricas(db, alice):
    d = await add_device(db, alice.id, ip="10.0.0.1")
    net = FakeNet()
    net.results["10.0.0.1"] = CheckResult(True, 12.5)
    summary = await net.cycle()
    assert summary["devices"] == 1 and summary["online"] == 1 and summary["events"] == 0
    await db.refresh(d)
    assert d.status == "online" and d.latency == 12.5 and d.avg_latency == 12.5 and d.packet_loss == 0.0
    assert await db.scalar(select(func.count()).select_from(Metric)) == 1


async def test_queda_so_apos_tres_falhas_com_evento_e_telegram_uma_vez(db, alice):
    d = await add_device(db, alice.id, "Firewall", "10.0.0.1")
    db.add(
        NotificationChannel(
            owner_id=alice.id,
            kind="telegram",
            enabled=True,
            chat_id="999",
            secret_encrypted=encrypt_secret("TOKEN123"),
        )
    )
    await db.commit()
    net = FakeNet()
    await net.cycle()  # online
    net.results["10.0.0.1"] = DOWN
    await net.cycle(2)
    await db.refresh(d)
    assert d.status == "online" and net.sent == []  # 2 falhas: ainda não alerta
    await net.cycle(4)  # 3ª falha derruba; as seguintes não repetem
    await db.refresh(d)
    events = list(await db.scalars(select(Event)))
    assert d.status == "offline" and d.status_changed_at is not None
    assert (
        [e.kind for e in events] == ["down"]
        and "Firewall" in events[0].message
        and "10.0.0.1" in events[0].message
    )
    assert len(net.sent) == 1 and net.sent[0][:2] == ("TOKEN123", "999") and "OFFLINE" in net.sent[0][2]


async def test_recuperacao(db, alice):
    d = await add_device(db, alice.id, ip="10.0.0.1", status="offline", consecutive_failures=9)
    net = FakeNet()
    await net.cycle()
    await db.refresh(d)
    assert d.status == "online" and d.consecutive_failures == 0
    assert [e.kind for e in await db.scalars(select(Event))] == ["recovered"]


async def test_sla_um_alerta_por_episodio(db, alice):
    await add_device(db, alice.id, ip="10.0.0.1", sla_threshold_ms=100)
    net = FakeNet()
    net.results["10.0.0.1"] = CheckResult(True, 250.0)
    await net.cycle(8)
    events = list(await db.scalars(select(Event)))
    assert (
        [e.kind for e in events] == ["sla_breach"]
        and "250" in events[0].message
        and events[0].severity == "warning"
    )


async def test_notifica_apenas_canal_ativo_do_dono(db, alice):
    bob = await make_user(db, "bob")
    await add_device(db, alice.id, "A", "10.0.0.1")
    await add_device(db, bob.id, "B", "10.0.0.2")
    db.add(
        NotificationChannel(
            owner_id=alice.id,
            kind="telegram",
            enabled=False,
            chat_id="1",
            secret_encrypted=encrypt_secret("tok-a"),
        )
    )
    db.add(
        NotificationChannel(
            owner_id=bob.id,
            kind="telegram",
            enabled=True,
            chat_id="2",
            secret_encrypted=encrypt_secret("tok-b"),
        )
    )
    await db.commit()
    net = FakeNet()
    net.results.update({"10.0.0.1": DOWN, "10.0.0.2": DOWN})
    await net.cycle(3)
    assert [(t, c) for t, c, _ in net.sent] == [("tok-b", "2")]  # Alice desativou; nada vaza entre donos
    assert {e.owner_id for e in await db.scalars(select(Event))} == {alice.id, bob.id}


async def test_falha_do_telegram_nao_derruba_o_ciclo(db, alice):
    await add_device(db, alice.id, ip="10.0.0.1")
    db.add(
        NotificationChannel(
            owner_id=alice.id,
            kind="telegram",
            enabled=True,
            chat_id="1",
            secret_encrypted=encrypt_secret("tok"),
        )
    )
    await db.commit()

    async def broken(*_):
        raise RuntimeError("boom")

    net = FakeNet()
    net.results["10.0.0.1"] = DOWN
    for i in range(3):
        await run_cycle(checker=net.check, send=broken, now=T0 + timedelta(seconds=10 * i))
    assert [e.kind for e in await db.scalars(select(Event))] == ["down"]  # evento gravado mesmo assim


async def test_excecao_no_checker_vira_falha_nao_crash(db, alice):
    await add_device(db, alice.id, ip="10.0.0.1")

    async def explode(_):
        raise RuntimeError("bug")

    for i in range(3):
        await run_cycle(checker=explode, now=T0 + timedelta(seconds=i))
    assert (await db.scalar(select(Device.status))) == "offline"


async def test_dispositivos_desativados_sao_ignorados(db, alice):
    d = await add_device(db, alice.id, ip="10.0.0.1", enabled=False)
    assert (await FakeNet().cycle())["devices"] == 0
    await db.refresh(d)
    assert d.status == "unknown" and d.last_check_at is None


async def test_dispositivo_removido_durante_o_ciclo(db, alice):
    d = await add_device(db, alice.id, ip="10.0.0.1")

    async def check_and_delete(snap):
        async with db.bind.connect() as conn:  # remove enquanto o "ping" está em andamento
            await conn.execute(Device.__table__.delete().where(Device.id == d.id))
            await conn.commit()
        return CheckResult(True, 1.0)

    summary = await run_cycle(checker=check_and_delete, now=T0)
    assert summary["devices"] == 1 and await db.scalar(select(func.count()).select_from(Metric)) == 0


async def test_janela_calcula_jitter_e_perda(db, alice):
    d = await add_device(db, alice.id, ip="10.0.0.1")
    net = FakeNet()
    for lat in (10.0, 30.0, None, 20.0):
        net.results["10.0.0.1"] = CheckResult(True, lat) if lat is not None else DOWN
        await net.cycle()
    await db.refresh(d)
    assert d.packet_loss == 25.0 and d.min_latency == 10.0 and d.max_latency == 30.0 and d.jitter == 15.0


async def test_ciclo_publica_no_redis_para_o_dono(db, alice, redis):
    await add_device(db, alice.id, "Core", "10.0.0.1")
    pubsub = redis.pubsub()
    await pubsub.subscribe(realtime.CHANNEL)
    await pubsub.get_message(timeout=1)  # confirmação de assinatura
    net = FakeNet()
    net.results["10.0.0.1"] = DOWN
    await net.cycle(3)
    msgs = []
    while (m := await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.3)) is not None:
        msgs.append(json.loads(m["data"]))
    kinds = [m["type"] for m in msgs]
    assert kinds.count("devices") == 3 and kinds.count("event") == 1
    assert all(m["owner_id"] == alice.id for m in msgs)
    assert msgs[-1]["data"] is not None


async def test_ciclos_paralelos_sao_limitados(db, alice, settings, monkeypatch):
    monkeypatch.setattr(settings, "monitor_concurrency", 3)
    for i in range(10):
        await add_device(db, alice.id, f"d{i}", f"10.0.1.{i}")
    running = peak = 0

    async def slow(_):
        nonlocal running, peak
        running += 1
        peak = max(peak, running)
        await asyncio.sleep(0.02)
        running -= 1
        return CheckResult(True, 1.0)

    await run_cycle(checker=slow, now=T0)
    assert peak <= 3
