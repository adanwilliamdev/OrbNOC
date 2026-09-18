"""
Testes de integração do fluxo de autenticação contra um Postgres real.

`auth.py` ainda não foi migrado para SQLAlchemy (usa o pool asyncpg
legado em app/database.py) — esse teste não depende disso: ele sobe a
aplicação de verdade, aponta `DATABASE_URL` para o container e roda
`database.connect()` (o mesmo código que roda em produção no startup,
incluindo a criação de tabelas e o seed do usuário admin). Serve tanto
para cobrir o fluxo crítico de auth quanto como uma rede de segurança
para quando essas rotas forem migradas depois.

Requer Docker — pulado automaticamente sem ele (ver tests/conftest.py).
"""
from httpx import ASGITransport, AsyncClient

from app import config, database
from app.app import create_app


async def test_register_seed_admin_and_login_against_real_postgres(postgres_dsn, monkeypatch):
    monkeypatch.setattr(config, "DATABASE_URL", postgres_dsn)
    await database.connect()
    try:
        app = create_app()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Seed automático (feito por database.connect(), igual ao startup real)
            admin_login = await client.post(
                "/api/auth/login", json={"username": "admin", "password": "admin123"}
            )
            assert admin_login.status_code == 200
            assert "token" in admin_login.json()

            register_response = await client.post(
                "/api/auth/register",
                json={
                    "username": "novo_usuario",
                    "email": "novo@example.com",
                    "password": "senhaForte123",
                },
            )
            assert register_response.status_code in (200, 201)

            login_response = await client.post(
                "/api/auth/login",
                json={"username": "novo_usuario", "password": "senhaForte123"},
            )
            assert login_response.status_code == 200
            assert "token" in login_response.json()

            duplicate_register = await client.post(
                "/api/auth/register",
                json={
                    "username": "novo_usuario",
                    "email": "outro@example.com",
                    "password": "senhaForte123",
                },
            )
            assert duplicate_register.status_code == 400
    finally:
        await database.close()
