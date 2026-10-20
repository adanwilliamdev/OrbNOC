from datetime import UTC, datetime, timedelta

import pytest
import redis as sync_redis
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.api.health import HEARTBEAT_KEY
from app.main import create_app


async def test_health_unhealthy_without_worker(client):
    r = await client.get("/health")
    assert r.status_code == 503
    body = r.json()
    assert body["checks"]["database"]["ok"] and body["checks"]["redis"]["ok"]
    assert body["checks"]["monitor"]["ok"] is False


async def test_health_ok_with_fresh_heartbeat(client, redis):
    await redis.set(HEARTBEAT_KEY, datetime.now(UTC).isoformat())
    r = await client.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "healthy"
    assert (await client.get("/api/health")).status_code == 200


async def test_health_stale_heartbeat(client, redis):
    await redis.set(HEARTBEAT_KEY, (datetime.now(UTC) - timedelta(minutes=5)).isoformat())
    r = await client.get("/health")
    assert r.status_code == 503 and r.json()["checks"]["monitor"]["ok"] is False


async def test_health_reports_database_down(client, app, redis, monkeypatch):
    await redis.set(HEARTBEAT_KEY, datetime.now(UTC).isoformat())

    class Broken:
        def __call__(self):
            raise ConnectionError("db down")

    monkeypatch.setattr(app.state, "sessionmaker", Broken())
    r = await client.get("/health")
    assert r.status_code == 503 and r.json()["checks"]["database"]["ok"] is False


async def test_liveness_always_ok(client):
    assert (await client.get("/health/live")).status_code == 200


async def test_docs_disabled_by_default(client):
    assert (await client.get("/api/docs")).status_code == 404
    assert (await client.get("/api/openapi.json")).status_code == 404


# ---- WebSocket (TestClient roda o lifespan de verdade: admin criado pelo ambiente) ------------
@pytest.fixture
def live_app(settings):
    return create_app(settings)


def _login(c):
    r = c.post("/api/auth/login", json={"username": "admin", "password": "Admin12345"})
    assert r.status_code == 200, r.text


def test_ws_rejects_unauthenticated(live_app):
    with TestClient(live_app) as c:
        with pytest.raises(WebSocketDisconnect):
            with c.websocket_connect("/ws"):
                pass


def test_ws_snapshot_and_pubsub(live_app, settings):
    with TestClient(live_app) as c:
        _login(c)
        r = c.post("/api/devices", json={"name": "Sw1", "ip": "10.0.0.50"})
        assert r.status_code == 201
        with c.websocket_connect("/ws") as ws:
            snap = ws.receive_json()
            assert snap["type"] == "devices_update" and snap["devices"][0]["name"] == "Sw1"
            # alteração pela API chega no WebSocket via Redis pub/sub
            c.post("/api/devices", json={"name": "Sw2", "ip": "10.0.0.51"})
            update = ws.receive_json()
            assert update["type"] == "devices_update" and len(update["devices"]) == 2
            # mensagem publicada pelo worker (Redis) chega ao usuário certo
            uid = c.get("/api/auth/me").json()["id"]
            sync_redis.from_url(settings.redis_url).publish(
                f"orbnoc:user:{uid}", '{"type": "event", "event": {"id": 1}}'
            )
            assert ws.receive_json() == {"type": "event", "event": {"id": 1}}


def test_ws_rejects_foreign_origin(live_app):
    with TestClient(live_app) as c:
        _login(c)
        with pytest.raises(WebSocketDisconnect):
            with c.websocket_connect("/ws", headers={"origin": "https://evil.example"}):
                pass
