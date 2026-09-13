"""
Fixtures compartilhadas de teste.

`db_session` sobe um SQLite in-memory com o schema real (criado a partir
dos models SQLAlchemy — os mesmos usados em produção contra o Postgres) e
devolve uma sessão limpa para cada teste. Isso permite testar repositórios
e services de verdade (SQL sendo executado) sem precisar de um Postgres
rodando.

`postgres_dsn` / `pg_session` sobem um Postgres real via testcontainers e
rodam as migrations do Alembic de verdade — usados pelos testes em
tests/integration/, que validam o que o SQLite não consegue (tipos, sintaxe
e comportamento específicos do dialeto Postgres). Esses testes exigem
Docker; se não houver um daemon Docker disponível (como neste ambiente de
sandbox), a fixture pula os testes automaticamente em vez de falhar.

`reset_rate_limiter` zera o storage do slowapi antes de cada teste, para
que testes que batem repetidamente em endpoints com rate limit (ex.:
/api/auth/register) não "vazem" contagem de requisições de um teste para
o outro.
"""
import pathlib
import subprocess
import sys

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db import models  # noqa: F401 — registra os models na Base
from app.db.base import Base

BACKEND_ROOT = pathlib.Path(__file__).resolve().parents[1]


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    from app.rate_limit import limiter

    limiter.reset()
    yield


@pytest.fixture
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)
    async with sessionmaker() as session:
        yield session

    await engine.dispose()


@pytest.fixture(scope="session")
def postgres_dsn():
    """
    Sobe um Postgres real (testcontainers) e aplica `alembic upgrade head`
    de verdade contra ele — não é o schema recriado à mão, é a migration
    real rodando contra um Postgres real.

    Pulado automaticamente se não houver Docker disponível.
    """
    try:
        from testcontainers.community.postgres import PostgresContainer
    except ImportError:
        try:
            from testcontainers.postgres import PostgresContainer
        except ImportError:
            pytest.skip("testcontainers não instalado — pulando testes de integração com Postgres")
            return

    try:
        container = PostgresContainer("postgres:15-alpine")
        container.start()
    except Exception as exc:  # noqa: BLE001 — qualquer falha em subir o container = pular
        pytest.skip(f"Docker indisponível para subir Postgres de teste: {exc}")
        return

    try:
        dsn = container.get_connection_url().replace("postgresql+psycopg2://", "postgresql://")
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=BACKEND_ROOT,
            env={"DATABASE_URL": dsn, "JWT_SECRET": "test-secret", "PATH": "/usr/bin:/bin"},
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            pytest.fail(f"alembic upgrade head falhou:\n{result.stdout}\n{result.stderr}")
        yield dsn
    finally:
        container.stop()


@pytest.fixture
async def pg_session(postgres_dsn):
    dsn_async = postgres_dsn.replace("postgresql://", "postgresql+asyncpg://", 1)
    engine = create_async_engine(dsn_async)
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)

    async with sessionmaker() as session:
        yield session
        # Cada teste limpa o que criou, para não vazar estado entre testes
        # que reaproveitam o mesmo container (fixture de escopo de sessão).
        await session.rollback()
        for table in reversed(Base.metadata.sorted_tables):
            await session.execute(table.delete())
        await session.commit()

    await engine.dispose()
