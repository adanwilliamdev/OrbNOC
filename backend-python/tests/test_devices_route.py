"""
Teste HTTP fim-a-fim de /api/devices: sobe a app FastAPI de verdade
(ASGITransport, sem servidor real) e substitui só a dependência de sessão
do banco (get_session) pela sessão de teste em SQLite — exercitando rota
-> service -> repositório -> SQL de ponta a ponta.
"""
import pytest
from httpx import ASGITransport, AsyncClient

from app import security
from app.app import create_app
from app.db import get_session
from app.db.models import User


@pytest.fixture
async def client(db_session, monkeypatch):
    monkeypatch.setattr("app.services.device_service.send_telegram_alert", lambda *a, **k: None)

    app = create_app()
    app.dependency_overrides[get_session] = lambda: db_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def _auth_headers(db_session) -> dict:
    user = User(username="alice", email="alice@example.com", password="hashed", role="user")
    db_session.add(user)
    await db_session.commit()
    token = security.issue_token({"id": user.id, "username": user.username, "role": user.role})
    return {"Authorization": f"Bearer {token}"}


async def test_full_device_lifecycle(client, db_session):
    headers = await _auth_headers(db_session)

    list_response = await client.get("/api/devices", headers=headers)
    assert list_response.status_code == 200
    assert list_response.json() == []

    create_response = await client.post(
        "/api/devices",
        json={"name": "Router", "ip": "10.0.0.1", "location": "Rack 1"},
        headers=headers,
    )
    assert create_response.status_code == 200
    device = create_response.json()
    assert device["name"] == "Router"

    duplicate_response = await client.post(
        "/api/devices",
        json={"name": "Router 2", "ip": "10.0.0.1", "location": None},
        headers=headers,
    )
    assert duplicate_response.status_code == 400

    delete_response = await client.delete(f"/api/devices/{device['id']}", headers=headers)
    assert delete_response.status_code == 200
    assert delete_response.json() == {"success": True}

    final_list = await client.get("/api/devices", headers=headers)
    assert final_list.json() == []


async def test_device_history_not_found_returns_404(client, db_session):
    headers = await _auth_headers(db_session)
    response = await client.get("/api/devices/999/history", headers=headers)
    assert response.status_code == 404
