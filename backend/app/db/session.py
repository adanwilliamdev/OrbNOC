from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import Settings, normalize_database_url


def create_engine(settings: Settings) -> AsyncEngine:
    url, connect_args = normalize_database_url(settings.database_url, settings.database_ssl)
    return create_async_engine(url, connect_args=connect_args, pool_pre_ping=True, pool_size=10)


def create_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)
