from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import decode_access_token
from app.db.models import User
from app.db.session import get_session


def extract_token(headers: dict[str, str], cookies: dict[str, str]) -> str | None:
    auth = headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip() or None
    return cookies.get(get_settings().cookie_name)


async def user_from_token(session: AsyncSession, token: str | None) -> User | None:
    if not token:
        return None
    user_id = decode_access_token(token)
    if user_id is None:
        return None
    user = await session.get(User, user_id)
    return user if user and user.is_active else None


async def get_current_user(request: Request, session: AsyncSession = Depends(get_session)) -> User:
    token = extract_token(dict(request.headers), dict(request.cookies))
    user = await user_from_token(session, token)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Não autenticado")
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Acesso restrito a administradores")
    return user


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"
