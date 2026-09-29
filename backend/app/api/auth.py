from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, RedisDep, SessionDep, SettingsDep
from app.api.schemas import AuthConfigOut, AuthOut, LoginIn, RegisterIn, UserOut
from app.core import ratelimit
from app.core.config import Settings
from app.core.security import (
    DUMMY_HASH,
    create_session_token,
    hash_password,
    verify_password,
)
from app.db.models import AccessLog, User

router = APIRouter(prefix="/api/auth", tags=["auth"])


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def set_session_cookie(response: Response, user: User, settings: Settings) -> None:
    response.set_cookie(
        settings.cookie_name,
        create_session_token(user.id, settings),
        max_age=settings.session_ttl_hours * 3600,
        httponly=True,
        secure=settings.secure_cookie,
        samesite="lax",
        path="/",
    )


@router.get("/config", response_model=AuthConfigOut)
async def auth_config(settings: SettingsDep) -> AuthConfigOut:
    return AuthConfigOut(registration_enabled=settings.registration_enabled)


@router.post("/login", response_model=AuthOut)
async def login(
    body: LoginIn,
    request: Request,
    response: Response,
    session: SessionDep,
    redis: RedisDep,
    settings: SettingsDep,
) -> AuthOut:
    ip = client_ip(request) or "unknown"
    key = f"rl:login:{ip}:{body.username.lower()}"
    if await ratelimit.is_blocked(redis, key, settings.login_max_attempts):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Muitas tentativas; tente mais tarde"
        )

    user = await session.scalar(
        select(User).where(or_(User.username == body.username, User.email == body.username.lower()))
    )
    # Verifica sempre um hash, para não revelar (pelo tempo) se o usuário existe.
    valid = verify_password(user.password_hash if user else DUMMY_HASH, body.password)
    if not user or not valid or not user.is_active:
        await ratelimit.hit(redis, key, settings.login_window_seconds)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenciais inválidas")

    await ratelimit.clear(redis, key)
    user.last_login = datetime.now(UTC)
    session.add(AccessLog(user_id=user.id, action="login", ip_address=ip))
    await session.commit()
    set_session_cookie(response, user, settings)
    return AuthOut(user=UserOut.model_validate(user))


@router.post("/register", response_model=AuthOut, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterIn,
    request: Request,
    response: Response,
    session: SessionDep,
    settings: SettingsDep,
) -> AuthOut:
    if not settings.registration_enabled:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Registro desativado; peça a um administrador"
        )
    user = User(
        username=body.username, email=body.email.lower(), password_hash=hash_password(body.password)
    )
    session.add(user)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Usuário ou email já existe") from None
    session.add(AccessLog(user_id=user.id, action="register", ip_address=client_ip(request)))
    await session.commit()
    set_session_cookie(response, user, settings)
    return AuthOut(user=UserOut.model_validate(user))


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    session: SessionDep,
    settings: SettingsDep,
    user: CurrentUser,
) -> dict:
    session.add(AccessLog(user_id=user.id, action="logout", ip_address=client_ip(request)))
    await session.commit()
    response.delete_cookie(settings.cookie_name, path="/")
    return {"success": True}


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> User:
    return user
