import os
import subprocess
import sys

TEST_DB = os.environ.get(
    "TEST_DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/orbnoc_test"
)
TEST_REDIS = os.environ.get("TEST_REDIS_URL", "redis://localhost:6379/15")
os.environ.update(
    {
        "ENVIRONMENT": "test",
        "DATABASE_URL": TEST_DB,
        "REDIS_URL": TEST_REDIS,
        "JWT_SECRET": "test-secret-test-secret-test-secret-0123456789",
        "ADMIN_USERNAME": "admin",
        "ADMIN_EMAIL": "admin@example.com",
        "ADMIN_PASSWORD": "Admin12345",
        "ALLOW_PRIVATE_NETWORKS": "true",
    }
)

import httpx  # noqa: E402
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
import redis.asyncio as aioredis  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.models import User  # noqa: E402
from app.db.session import create_engine, create_sessionmaker  # noqa: E402
from app.main import create_app  # noqa: E402
from app.services.probes import Prober, ProbeResult  # noqa: E402

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TABLES = "users, devices, metrics, metrics_hourly, events, notification_channels, access_logs"


@pytest.fixture(scope="session", autouse=True)
def migrated_database():
    """Aplica as migrations do zero (valida o Alembic de verdade)."""
    env = {**os.environ}
    for args in (["downgrade", "base"], ["upgrade", "head"]):
        subprocess.run(
            [sys.executable, "-m", "alembic", *args],
            cwd=BACKEND_DIR,
            env=env,
            check=True,
            capture_output=True,
        )


class FakeProber(Prober):
    """Sonda controlada pelos testes: `results[endereço]` define a resposta."""

    def __init__(self) -> None:
        super().__init__()
        self.icmp_mode = "privileged"
        self.results: dict[str, ProbeResult] = {}
        self.calls: list[str] = []

    async def probe(self, address, check_type, port):
        self.calls.append(address)
        return self.results.get(address, ProbeResult(True, 12.5, "icmp"))


@pytest.fixture(scope="session")
def settings():
    get_settings.cache_clear()
    return get_settings()


@pytest_asyncio.fixture(scope="session")
async def engine(settings):
    engine = create_engine(settings)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="session")
async def sessionmaker(engine):
    return create_sessionmaker(engine)


@pytest_asyncio.fixture(scope="session")
async def redis(settings):
    client = aioredis.from_url(settings.redis_url, decode_responses=True)
    yield client
    await client.aclose()


@pytest_asyncio.fixture(autouse=True)
async def clean_state(engine, redis):
    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {TABLES} RESTART IDENTITY CASCADE"))
    await redis.flushdb()


@pytest.fixture
def prober():
    return FakeProber()


@pytest.fixture
def app(settings, engine, sessionmaker, redis, prober):
    application = create_app(settings)
    application.state.engine = engine
    application.state.sessionmaker = sessionmaker
    application.state.redis = redis
    application.state.prober = prober
    return application


@pytest_asyncio.fixture
async def client(app):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def create_user(sessionmaker, username="alice", password="Senha1234", role="user"):
    async with sessionmaker() as session:
        user = User(
            username=username,
            email=f"{username}@example.com",
            password_hash=hash_password(password),
            role=role,
        )
        session.add(user)
        await session.commit()
        return user.id


async def login(client, username="alice", password="Senha1234"):
    resp = await client.post("/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, resp.text
    return resp


@pytest_asyncio.fixture
async def alice(client, sessionmaker):
    """Cliente autenticado como usuário comum."""
    await create_user(sessionmaker, "alice")
    await login(client, "alice")
    return client


@pytest_asyncio.fixture
async def bob_client(app, sessionmaker):
    await create_user(sessionmaker, "bob")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        await login(c, "bob")
        yield c
