"""
Testes de integração leve das rotas HTTP, usando httpx.ASGITransport
(sem subir um servidor de verdade). Testes que dependem do Postgres são
evitados aqui — o foco é comportamento de roteamento, validação e RBAC,
que não precisam de banco real.
"""
import pytest
from httpx import ASGITransport, AsyncClient

from app import security
from app.app import create_app

app = create_app()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def test_root_endpoint(client):
    response = await client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "operational"


async def test_api_status_endpoint(client):
    response = await client.get("/api/status")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_devices_requires_auth(client):
    response = await client.get("/api/devices")
    assert response.status_code == 401


async def test_admin_route_rejects_non_admin_user(client):
    token = security.issue_token({"id": 1, "username": "regular_user", "role": "user"})
    response = await client.get(
        "/api/admin/users", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403


async def test_admin_route_rejects_missing_token(client):
    response = await client.get("/api/admin/users")
    assert response.status_code == 401


async def test_login_missing_fields_returns_400(client):
    response = await client.post("/api/auth/login", json={})
    assert response.status_code == 400


async def test_register_weak_password_rejected(client):
    response = await client.post(
        "/api/auth/register",
        json={"username": "newuser", "email": "new@example.com", "password": "123"},
    )
    assert response.status_code == 400


async def test_register_invalid_email_rejected(client):
    response = await client.post(
        "/api/auth/register",
        json={"username": "newuser", "email": "not-an-email", "password": "goodpass123"},
    )
    assert response.status_code == 400
