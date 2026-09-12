"""
Fixtures compartilhadas de teste.

`db_session` sobe um SQLite in-memory com o schema real (criado a partir
dos models SQLAlchemy — os mesmos usados em produção contra o Postgres) e
devolve uma sessão limpa para cada teste. Isso permite testar repositórios
e services de verdade (SQL sendo executado) sem precisar de um Postgres
rodando. Testes que dependam de comportamento específico do dialeto
Postgres devem usar testcontainers à parte — não é o caso dos repositórios
atuais, que só usam SQL portável.
"""
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db import models  # noqa: F401 — registra os models na Base
from app.db.base import Base


@pytest.fixture
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)
    async with sessionmaker() as session:
        yield session

    await engine.dispose()
