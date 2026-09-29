"""Senhas (Argon2), JWT e criptografia de segredos armazenados (token do Telegram)."""

import base64
import hashlib
from datetime import UTC, datetime, timedelta

import jwt
from cryptography.fernet import Fernet, InvalidToken
from pwdlib import PasswordHash

from app.core.config import get_settings

_hasher = PasswordHash.recommended()
# Hash descartável para igualar o tempo de resposta quando o usuário não existe.
_DUMMY_HASH = _hasher.hash("orbnoc-dummy-password")
_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    """Compara em tempo aproximadamente constante, mesmo sem hash real."""
    try:
        return _hasher.verify(password, password_hash or _DUMMY_HASH) and password_hash is not None
    except Exception:
        return False


def create_access_token(user_id: int) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {"sub": str(user_id), "iat": now, "exp": now + timedelta(minutes=settings.session_minutes)}
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM)


def decode_access_token(token: str) -> int | None:
    """Retorna o id do usuário ou None se o token for inválido/expirado."""
    try:
        data = jwt.decode(
            token,
            get_settings().jwt_secret,
            algorithms=[_ALGORITHM],
            options={"require": ["exp", "sub"]},
        )
        return int(data["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        return None


def _fernet() -> Fernet:
    settings = get_settings()
    material = settings.encryption_key or f"orbnoc-enc:{settings.jwt_secret}"
    key = base64.urlsafe_b64encode(hashlib.sha256(material.encode()).digest())
    return Fernet(key)


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt_secret(value: str) -> str | None:
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken:
        return None
