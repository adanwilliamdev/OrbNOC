from __future__ import annotations

import base64
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from .config import get_settings

settings = get_settings()

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"

# O segredo é armazenado em base64 no .env (compatível com o valor gerado por
# `openssl rand -base64 64` recomendado no README), então é decodificado aqui
# antes de ser usado para assinar/verificar os tokens.
_JWT_SECRET_BYTES = base64.b64decode(settings.jwt_secret_b64)
_JWT_ALGORITHM = "HS256"


def hash_password(senha: str) -> str:
    return bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode("utf-8")


def verify_password(senha: str, senha_hash: str) -> bool:
    try:
        return bcrypt.checkpw(senha.encode("utf-8"), senha_hash.encode("utf-8"))
    except ValueError:
        return False


def generate_access_token(email: str) -> str:
    """'sub' é o e-mail do usuário, igual ao JwtUtil.generateToken original."""
    now = datetime.now(timezone.utc)
    expira_em = now + timedelta(milliseconds=settings.jwt_expiration_ms)
    payload = {"sub": email, "iat": int(now.timestamp()), "exp": expira_em}
    return jwt.encode(payload, _JWT_SECRET_BYTES, algorithm=_JWT_ALGORITHM)


def decode_access_token(token: str) -> str | None:
    """Retorna o e-mail (subject) do token, ou None se ele for inválido/expirado."""
    try:
        payload = jwt.decode(token, _JWT_SECRET_BYTES, algorithms=[_JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
    return payload.get("sub")


def access_token_expiration_seconds() -> int:
    return settings.jwt_expiration_ms // 1000


def refresh_token_expiration_seconds() -> int:
    return settings.jwt_refresh_expiration_ms // 1000


def generate_refresh_token_value() -> str:
    return uuid.uuid4().hex + uuid.uuid4().hex
