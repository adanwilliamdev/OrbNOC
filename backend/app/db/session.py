from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None

_SSL_MODES = {
    "require": "require",
    "prefer": "require",
    "verify-ca": "verify-ca",
    "verify-full": "verify-full",
}


def normalize_database_url(raw: str, ssl_flag: bool = False) -> tuple[str, dict[str, Any]]:
    """Aceita postgres://, postgresql:// e postgresql+asyncpg://; trata sslmode/channel_binding (Neon, Supabase)."""
    url = make_url(raw).set(drivername="postgresql+asyncpg")
    query = dict(url.query)
    sslmode = str(query.pop("sslmode", "") or "")
    query.pop("channel_binding", None)
    query.pop("ssl", None)
    url = url.set(query=query)
    # UTC fixo: date_trunc('hour', ...) nos agregados por hora depende do fuso da sessão.
    connect_args: dict[str, Any] = {"server_settings": {"timezone": "UTC"}}
    if sslmode in _SSL_MODES:
        connect_args["ssl"] = _SSL_MODES[sslmode]
    elif ssl_flag:
        connect_args["ssl"] = "require"
    return url.render_as_string(hide_password=False), connect_args


def get_engine() -> AsyncEngine:
    global _engine, _sessionmaker
    if _engine is None:
        settings = get_settings()
        url, connect_args = normalize_database_url(settings.database_url, settings.database_ssl)
        kwargs: dict[str, Any] = {"connect_args": connect_args}
        if settings.environment == "test":
            kwargs["poolclass"] = NullPool  # testes usam vários event loops
        else:
            kwargs.update(pool_size=10, max_overflow=10, pool_pre_ping=True, pool_recycle=1800)
        _engine = create_async_engine(url, **kwargs)
        _sessionmaker = async_sessionmaker(_engine, expire_on_commit=False)
    return _engine


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    get_engine()
    assert _sessionmaker is not None
    return _sessionmaker


async def get_session() -> AsyncIterator[AsyncSession]:
    async with get_sessionmaker()() as session:
        yield session


async def dispose_engine() -> None:
    global _engine, _sessionmaker
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _sessionmaker = None
