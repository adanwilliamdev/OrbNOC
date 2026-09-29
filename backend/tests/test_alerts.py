from sqlalchemy import select

from app.db.models import Event, NotificationChannel
from app.services import notifier

TOKEN = "123456789:AAExampleTokenExampleTokenExample_123"


class Sent:
    def __init__(self):
        self.calls = []

    async def __call__(self, target, text, client=None):
        self.calls.append((target, text))
        return True, None


async def test_telegram_token_is_never_returned_and_is_encrypted(alice, sessionmaker, monkeypatch):
    sent = Sent()
    monkeypatch.setattr(notifier, "send_telegram", sent)
    r = await alice.post(
        "/api/alerts/telegram", json={"enabled": True, "bot_token": TOKEN, "chat_id": "-100123"}
    )
    assert r.status_code == 200
    body = r.json()
    assert body == {
        "enabled": True,
        "chat_id": "-100123",
        "bot_token_set": True,
        "test_sent": True,
        "test_error": None,
    }
    assert TOKEN not in r.text
    got = await alice.get("/api/alerts/telegram")
    assert TOKEN not in got.text and got.json()["bot_token_set"] is True
    async with sessionmaker() as s:
        ch = await s.scalar(select(NotificationChannel))
    assert ch.secret_encrypted and TOKEN not in ch.secret_encrypted
    assert sent.calls[0][0].token == TOKEN  # o servidor consegue decifrar para usar


async def test_blank_token_keeps_saved_one(alice, monkeypatch):
    sent = Sent()
    monkeypatch.setattr(notifier, "send_telegram", sent)
    await alice.post(
        "/api/alerts/telegram", json={"enabled": True, "bot_token": TOKEN, "chat_id": "42"}
    )
    r = await alice.post(
        "/api/alerts/telegram", json={"enabled": True, "bot_token": "", "chat_id": "43"}
    )
    assert r.json()["chat_id"] == "43" and r.json()["bot_token_set"] is True
    assert sent.calls[-1][0].token == TOKEN and sent.calls[-1][0].chat_id == "43"


async def test_telegram_validation(alice):
    bad_token = await alice.post(
        "/api/alerts/telegram", json={"enabled": True, "bot_token": "x/../y", "chat_id": "1"}
    )
    assert bad_token.status_code == 422
    bad_chat = await alice.post(
        "/api/alerts/telegram", json={"enabled": True, "bot_token": TOKEN, "chat_id": "a b"}
    )
    assert bad_chat.status_code == 422
    incomplete = await alice.post("/api/alerts/telegram", json={"enabled": True})
    assert incomplete.status_code == 422


async def test_disable_and_delete(alice, monkeypatch):
    monkeypatch.setattr(notifier, "send_telegram", Sent())
    await alice.post(
        "/api/alerts/telegram", json={"enabled": True, "bot_token": TOKEN, "chat_id": "42"}
    )
    off = await alice.post("/api/alerts/telegram", json={"enabled": False})
    assert off.json()["enabled"] is False and off.json()["bot_token_set"] is True
    gone = await alice.delete("/api/alerts/telegram")
    assert gone.json() == {
        "enabled": False,
        "chat_id": "",
        "bot_token_set": False,
        "test_sent": None,
        "test_error": None,
    }


async def test_telegram_is_per_user(alice, bob_client, monkeypatch):
    monkeypatch.setattr(notifier, "send_telegram", Sent())
    await alice.post(
        "/api/alerts/telegram", json={"enabled": True, "bot_token": TOKEN, "chat_id": "42"}
    )
    assert (await bob_client.get("/api/alerts/telegram")).json()["bot_token_set"] is False


async def test_test_telegram_endpoint(alice, monkeypatch):
    r = await alice.post("/api/alerts/test-telegram")
    assert r.status_code == 400  # sem configuração
    sent = Sent()
    monkeypatch.setattr(notifier, "send_telegram", sent)
    await alice.post(
        "/api/alerts/telegram", json={"enabled": True, "bot_token": TOKEN, "chat_id": "42"}
    )
    assert (await alice.post("/api/alerts/test-telegram")).json()["success"] is True

    async def refuse(target, text, client=None):
        return False, "chat not found"

    monkeypatch.setattr(notifier, "send_telegram", refuse)
    r = await alice.post("/api/alerts/test-telegram")
    assert r.status_code == 502 and "chat not found" in r.json()["detail"]


async def test_events_ack_flow_and_isolation(alice, bob_client, sessionmaker):
    async with sessionmaker() as s:
        from app.db.models import User

        uid = (await s.scalar(select(User).where(User.username == "alice"))).id
        for i in range(3):
            s.add(Event(user_id=uid, kind="offline", severity="error", message=f"m{i}"))
        await s.commit()
    events = (await alice.get("/api/alerts")).json()
    assert [e["message"] for e in events] == ["m2", "m1", "m0"]  # mais recente primeiro
    assert all(e["acknowledged_at"] is None for e in events)
    assert (await bob_client.get("/api/alerts")).json() == []
    assert (await bob_client.post(f"/api/alerts/{events[0]['id']}/ack")).status_code == 404
    assert (await alice.post(f"/api/alerts/{events[0]['id']}/ack")).status_code == 200
    assert len((await alice.get("/api/alerts?unread_only=true")).json()) == 2
    assert (await alice.post("/api/alerts/ack-all")).json()["acknowledged"] == 2
    assert (await alice.get("/api/alerts?unread_only=true")).json() == []


def test_message_escapes_html_and_hides_nothing_sensitive():
    text = notifier.build_message("offline", "<b>x</b>", "<script>", "10.0.0.1")
    assert "<script>" not in text and "&lt;script&gt;" in text and "&lt;b&gt;x" in text
