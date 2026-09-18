"""
Engine e sessionmaker assíncronos do SQLAlchemy.

Reaproveita a mesma DATABASE_URL usada pelo pool asyncpg legado
(app/database.py), apenas trocando o driver na URL para `asyncpg`
(driver exigido pelo SQLAlchemy para operar em modo assíncrono).
"""
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from .. import config

_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def _to_async_dsn(database_url: str) -> str:
    """Converte uma DSN `postgresql://...` para `postgresql+asyncpg://...`."""
    if database_url.startswith("postgresql+asyncpg://"):
        return database_url
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return database_url


def init_engine(database_url: str | None = None) -> AsyncEngine:
    """Cria (uma única vez) o engine assíncrono e o sessionmaker global."""
    global _engine, _sessionmaker
    dsn = _to_async_dsn(database_url or config.DATABASE_URL)
    connect_args = {"ssl": "require"} if config.DATABASE_SSL else {}
    _engine = create_async_engine(
        dsn,
        echo=False,
        pool_size=10,
        max_overflow=5,
        connect_args=connect_args,
    )
    _sessionmaker = async_sessionmaker(_engine, expire_on_commit=False)
    return _engine


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    if _sessionmaker is None:
        raise RuntimeError(
            "Engine do SQLAlchemy ainda não foi inicializado — chame init_engine() primeiro."
        )
    return _sessionmaker


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependência do FastAPI: `session: AsyncSession = Depends(get_session)`."""
    sessionmaker = get_sessionmaker()
    async with sessionmaker() as session:
        yield session


async def dispose_engine() -> None:
    global _engine, _sessionmaker
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _sessionmaker = None
