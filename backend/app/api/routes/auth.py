from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import client_ip, get_current_user
from app.core import ratelimit
from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import AccessLog, User
from app.db.session import get_session
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserOut
from app.schemas.common import Message

router = APIRouter(prefix="/auth", tags=["auth"])


def set_session_cookie(response: Response, user_id: int) -> None:
    s = get_settings()
    response.set_cookie(
        s.cookie_name,
        create_access_token(user_id),
        max_age=s.session_minutes * 60,
        httponly=True,
        secure=s.secure_cookies,
        samesite=s.cookie_samesite,
        path="/",
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    body: LoginRequest, request: Request, response: Response, session: AsyncSession = Depends(get_session)
):
    s = get_settings()
    ident, ip = body.username.strip().lower(), client_ip(request)
    key_user, key_ip = f"login:{ip}:{ident}", f"login-ip:{ip}"
    if (
        await ratelimit.get(key_user) >= s.login_max_attempts
        or await ratelimit.get(key_ip) >= s.login_max_attempts * 4
    ):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.",
            headers={"Retry-After": str(s.login_window_seconds)},
        )

    user = await session.scalar(select(User).where(or_(User.username == ident, User.email == ident)))
    password_ok = verify_password(body.password, user.password_hash if user else None)
    if not (user and password_ok and user.is_active):
        await ratelimit.incr(key_user, s.login_window_seconds)
        await ratelimit.incr(key_ip, s.login_window_seconds)
        session.add(AccessLog(user_id=user.id if user else None, action="login_failed", ip_address=ip))
        await session.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuário ou senha inválidos")

    await ratelimit.clear(key_user)
    user.last_login_at = datetime.now(UTC)
    session.add(AccessLog(user_id=user.id, action="login", ip_address=ip))
    await session.commit()
    set_session_cookie(response, user.id)
    return AuthResponse(user=UserOut.model_validate(user))


@router.post("/logout", response_model=Message)
async def logout(response: Response):
    s = get_settings()
    response.delete_cookie(
        s.cookie_name, path="/", secure=s.secure_cookies, samesite=s.cookie_samesite, httponly=True
    )
    return Message()


@router.get("/me", response_model=AuthResponse)
async def me(user: User = Depends(get_current_user)):
    return AuthResponse(user=UserOut.model_validate(user))


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest, request: Request, response: Response, session: AsyncSession = Depends(get_session)
):
    if not get_settings().allow_registration:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "O cadastro de novos usuários está desativado. Peça a um administrador.",
        )
    user = User(
        username=body.username, email=body.email, password_hash=hash_password(body.password), role="user"
    )
    session.add(user)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Usuário ou e-mail já cadastrado") from None
    session.add(AccessLog(user_id=user.id, action="register", ip_address=client_ip(request)))
    await session.commit()
    set_session_cookie(response, user.id)
    return AuthResponse(user=UserOut.model_validate(user))
