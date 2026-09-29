import os

# Precisa vir ANTES de qualquer import de app.*: as configurações são lidas uma única vez.
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:5432/orbnoc_test")
os.environ["ENVIRONMENT"] = "test"
os.environ["ALLOW_LOOPBACK_TARGETS"] = "true"
os.environ["ALLOW_REGISTRATION"] = "false"
os.environ["ADMIN_PASSWORD"] = ""
os.environ["MONITOR_INTERVAL_MS"] = "10000"

import fakeredis  # noqa: E402
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core import ratelimit  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.core.redis import set_redis  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db import models  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_engine, get_sessionmaker  # noqa: E402
from app.main import app  # noqa: E402

PASSWORD = "Senha1234"

# Argon2 com parâmetros mínimos SÓ nos testes (produção usa o padrão recomendado do pwdlib).
from pwdlib import PasswordHash  # noqa: E402
from pwdlib.hashers.argon2 import Argon2Hasher  # noqa: E402

from app.core import security  # noqa: E402

security._hasher = PasswordHash((Argon2Hasher(time_cost=1, memory_cost=8, parallelism=1),))
security._DUMMY_HASH = security._hasher.hash("dummy")


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _schema():
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def _clean(_schema):
    async with get_engine().begin() as conn:
        tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
        await conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    ratelimit._local.clear()
    redis = fakeredis.FakeAsyncRedis(decode_responses=True)
    set_redis(redis)
    yield redis
    await redis.aclose()
    set_redis(None)


@pytest.fixture
def redis(_clean):
    return _clean


@pytest.fixture
def settings():
    return get_settings()


@pytest_asyncio.fixture
async def db():
    async with get_sessionmaker()() as session:
        yield session


async def make_user(db, username="alice", role="user", active=True) -> models.User:
    user = models.User(
        username=username,
        email=f"{username}@example.com",
        password_hash=hash_password(PASSWORD),
        role=role,
        is_active=active,
    )
    db.add(user)
    await db.commit()
    return user


def new_client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def login(client: AsyncClient, username: str = "alice", password: str = PASSWORD):
    return await client.post("/api/auth/login", json={"username": username, "password": password})


@pytest_asyncio.fixture
async def client():
    async with new_client() as c:
        yield c


@pytest_asyncio.fixture
async def alice(db, client):
    user = await make_user(db, "alice")
    assert (await login(client, "alice")).status_code == 200
    return user


@pytest_asyncio.fixture
async def bob_client(db):
    await make_user(db, "bob")
    async with new_client() as c:
        assert (await login(c, "bob")).status_code == 200
        yield c


async def add_device(db, owner_id, name="Router", ip="127.0.0.1", **kw) -> models.Device:
    device = models.Device(owner_id=owner_id, name=name, ip=ip, **kw)
    db.add(device)
    await db.commit()
    return device
