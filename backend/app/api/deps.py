from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import ratelimit
from app.core.config import Settings
from app.core.security import decode_session_token
from app.db.models import User
from app.services.probes import Prober


def get_settings_dep(request: Request) -> Settings:
    return request.app.state.settings


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    async with request.app.state.sessionmaker() as session:
        yield session


def get_redis(request: Request) -> Redis:
    return request.app.state.redis


def get_prober(request: Request) -> Prober:
    return request.app.state.prober


SettingsDep = Annotated[Settings, Depends(get_settings_dep)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]
RedisDep = Annotated[Redis, Depends(get_redis)]
ProberDep = Annotated[Prober, Depends(get_prober)]


async def user_from_token(
    session: AsyncSession, token: str | None, settings: Settings
) -> User | None:
    if not token:
        return None
    claims = decode_session_token(token, settings)
    if not claims:
        return None
    try:
        user_id = int(claims["sub"])
    except (KeyError, ValueError):
        return None
    user = await session.scalar(select(User).where(User.id == user_id))
    return user if user and user.is_active else None


async def current_user(request: Request, session: SessionDep, settings: SettingsDep) -> User:
    user = await user_from_token(session, request.cookies.get(settings.cookie_name), settings)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Não autenticado")
    return user


async def require_admin(user: Annotated[User, Depends(current_user)]) -> User:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Acesso restrito a administradores")
    return user


CurrentUser = Annotated[User, Depends(current_user)]
AdminUser = Annotated[User, Depends(require_admin)]


def limit_per_user(name: str, limit: int, window_seconds: int):
    """Dependência de rate limit por usuário (usada nas ferramentas de diagnóstico)."""

    async def dependency(user: CurrentUser, redis: RedisDep) -> None:
        count = await ratelimit.hit(redis, f"rl:{name}:{user.id}", window_seconds)
        if count > limit:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Muitas requisições; aguarde")

    return dependency
