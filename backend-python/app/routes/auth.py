"""Rotas de autenticação. Equivalente a src/routes/auth.routes.js."""
import re
from typing import Any

import asyncpg
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from .. import database, security
from ..auth_dependency import ApiError, get_current_user
from ..config import LOGIN_RATE_LIMIT, REGISTER_RATE_LIMIT
from ..rate_limit import limiter

router = APIRouter(prefix="/api/auth", tags=["auth"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterBody(BaseModel):
    username: str | None = None
    email: str | None = None
    password: str | None = None


class LoginBody(BaseModel):
    username: str | None = None
    password: str | None = None


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else ""


def _validate_password_strength(password: str) -> str | None:
    """Retorna uma mensagem de erro se a senha for fraca, ou None se ok."""
    if len(password) < 8:
        return "A senha deve ter pelo menos 8 caracteres"
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        return "A senha deve conter letras e números"
    return None


@router.post("/register")
@limiter.limit(REGISTER_RATE_LIMIT)
async def register(request: Request, body: RegisterBody):
    if not body.username or not body.email or not body.password:
        raise ApiError(400, "Todos os campos são obrigatórios")

    if not _EMAIL_RE.match(body.email):
        raise ApiError(400, "E-mail inválido")

    password_error = _validate_password_strength(body.password)
    if password_error:
        raise ApiError(400, password_error)

    pool = database.get_pool()
    hashed = security.hash_password(body.password)

    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "INSERT INTO users (username, email, password) VALUES ($1, $2, $3) "
                "RETURNING id, username, email, role",
                body.username,
                body.email,
                hashed,
            )
            user: dict[str, Any] = dict(row)
            token = security.issue_token(user)
            await conn.execute(
                "INSERT INTO access_logs (user_id, action, ip_address) VALUES ($1, $2, $3)",
                user["id"],
                "register",
                _client_ip(request),
            )
    except asyncpg.UniqueViolationError:
        raise ApiError(400, "Usuário ou email já existe")
    except Exception:  # noqa: BLE001
        raise ApiError(500, "Erro interno ao criar usuário")

    return {"success": True, "token": token, "user": security.to_public_user(user)}


@router.post("/login")
@limiter.limit(LOGIN_RATE_LIMIT)
async def login(request: Request, body: LoginBody):
    if not body.username or not body.password:
        raise ApiError(400, "Usuário e senha são obrigatórios")

    pool = database.get_pool()
    try:
        async with pool.acquire() as conn:
            user = await conn.fetchrow(
                "SELECT * FROM users WHERE username = $1 OR email = $1", body.username
            )
            if not user or not security.verify_password(body.password, user["password"]):
                raise ApiError(401, "Credenciais inválidas")

            await conn.execute(
                "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1", user["id"]
            )
            await conn.execute(
                "INSERT INTO access_logs (user_id, action, ip_address) VALUES ($1, $2, $3)",
                user["id"],
                "login",
                _client_ip(request),
            )
    except ApiError:
        raise
    except Exception:  # noqa: BLE001
        raise ApiError(500, "Erro interno")

    token = security.issue_token(dict(user))
    return {"success": True, "token": token, "user": security.to_public_user(user)}


@router.post("/logout")
async def logout(request: Request, current_user: dict = Depends(get_current_user)):
    pool = database.get_pool()
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO access_logs (user_id, action, ip_address) VALUES ($1, $2, $3)",
                current_user["id"],
                "logout",
                _client_ip(request),
            )
    except Exception:  # noqa: BLE001
        pass
    return {"success": True}
