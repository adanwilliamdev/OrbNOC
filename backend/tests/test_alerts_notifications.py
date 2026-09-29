from datetime import UTC, datetime

from sqlalchemy import select

from app.db.models import Event, NotificationChannel
from app.services import notifier

from .conftest import add_device

TOKEN = "123456789:AAH-abcdefghijklmnopqrstuvwxyz_0123456"


async def add_event(db, owner_id, device, kind="down", ack=False):
    e = Event(owner_id=owner_id, device_id=device.id, device_name=device.name, device_ip=device.ip, kind=kind,
              severity="error", message="x", acknowledged_at=datetime.now(UTC) if ack else None)  # fmt: skip
    db.add(e)
    await db.commit()
    return e


async def test_listar_ack_e_limpar(db, alice, client):
    d = await add_device(db, alice.id)
    e1, _e2 = await add_event(db, alice.id, d), await add_event(db, alice.id, d)
    assert [e["id"] for e in (await client.get("/api/alerts")).json()][0] > e1.id  # mais recente primeiro
    assert len((await client.get("/api/alerts?unacknowledged=true")).json()) == 2
    assert (await client.post(f"/api/alerts/{e1.id}/ack")).json()["acknowledged_at"] is not None
    assert len((await client.get("/api/alerts?unacknowledged=true")).json()) == 1
    assert (await client.post("/api/alerts/ack-all")).json()["acknowledged"] == 1
    assert (await client.delete("/api/alerts")).json()["deleted"] == 2
    assert (await client.get("/api/alerts")).json() == []


async def test_alertas_isolados_por_usuario(db, alice, client, bob_client):
    d = await add_device(db, alice.id)
    e = await add_event(db, alice.id, d)
    assert (await bob_client.get("/api/alerts")).json() == []
    assert (await bob_client.post(f"/api/alerts/{e.id}/ack")).status_code == 404
    assert (await bob_client.delete("/api/alerts")).json()["deleted"] == 0
    assert len((await client.get("/api/alerts")).json()) == 1


async def test_evento_sobrevive_a_remocao_do_dispositivo(db, alice, client):
    d = await add_device(db, alice.id, "Roteador", "10.0.0.1")
    await add_event(db, alice.id, d)
    await client.delete(f"/api/devices/{d.id}")
    ev = (await client.get("/api/alerts")).json()[0]
    assert ev["device_id"] is None and ev["device_name"] == "Roteador"


async def test_telegram_nunca_devolve_o_token_e_grava_criptografado(db, alice, client):
    r = await client.put(
        "/api/notifications/telegram", json={"enabled": True, "chat_id": "-100123456", "bot_token": TOKEN}
    )
    assert r.status_code == 200
    body = r.json()
    assert body == {"enabled": True, "chat_id": "-100123456", "token_set": True, "token_hint": "…3456"}
    assert TOKEN not in (await client.get("/api/notifications/telegram")).text
    stored = await db.scalar(select(NotificationChannel.secret_encrypted))
    assert stored and TOKEN not in stored and "AAH" not in stored


async def test_telegram_manter_token_ao_omitir(alice, client):
    await client.put(
        "/api/notifications/telegram", json={"enabled": True, "chat_id": "12345", "bot_token": TOKEN}
    )
    r = await client.put("/api/notifications/telegram", json={"enabled": False, "chat_id": "67890"})
    assert r.json()["token_set"] is True and r.json()["chat_id"] == "67890" and r.json()["enabled"] is False


async def test_telegram_validacoes(alice, client):
    assert (
        await client.put("/api/notifications/telegram", json={"enabled": True, "chat_id": "1"})
    ).status_code == 422
    assert (
        await client.put("/api/notifications/telegram", json={"enabled": False, "bot_token": "invalido"})
    ).status_code == 422
    assert (
        await client.put("/api/notifications/telegram", json={"enabled": False, "chat_id": "abc def"})
    ).status_code == 422
    assert (await client.post("/api/notifications/telegram/test")).status_code == 422  # nada configurado


async def test_telegram_teste_usa_o_token_salvo(alice, client, monkeypatch):
    sent = []

    async def fake(token, chat, text):
        sent.append((token, chat, text))
        return True, None

    monkeypatch.setattr("app.api.routes.notifications.send_telegram", fake)
    await client.put(
        "/api/notifications/telegram", json={"enabled": True, "chat_id": "12345", "bot_token": TOKEN}
    )
    assert (await client.post("/api/notifications/telegram/test")).status_code == 200
    assert sent[0][0] == TOKEN and sent[0][1] == "12345"


async def test_telegram_recusado_vira_502(alice, client, monkeypatch):
    async def fake(*_):
        return False, "chat not found"

    monkeypatch.setattr("app.api.routes.notifications.send_telegram", fake)
    await client.put(
        "/api/notifications/telegram", json={"enabled": True, "chat_id": "12345", "bot_token": TOKEN}
    )
    r = await client.post("/api/notifications/telegram/test")
    assert r.status_code == 502 and "chat not found" in r.json()["error"]


def test_mensagem_escapa_html():
    text = notifier.telegram_text("down", "<b>Switch_1</b> & *co*")
    assert "&lt;b&gt;Switch_1&lt;/b&gt; &amp; *co*" in text and text.count("<b>") == 2


def test_mensagens_descrevem_o_evento():
    ctx = notifier.EventContext("sla_breach", "GW", "10.0.0.1", latency_ms=182.4, threshold_ms=100)
    assert "182 ms" in notifier.describe(ctx) and "100 ms" in notifier.describe(ctx)
    assert "voltou a responder" in notifier.describe(
        notifier.EventContext("recovered", "GW", "10.0.0.1", latency_ms=0.0)
    )
