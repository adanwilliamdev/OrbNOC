"""Hash de senha (Argon2), JWT de sessão e criptografia de segredos (Fernet)."""

import base64
import hashlib
import time
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import Settings

_hasher = PasswordHasher()
# Hash de mentira usado para gastar o mesmo tempo quando o usuário não existe.
DUMMY_HASH = _hasher.hash("orbnoc-dummy-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(hashed: str, password: str) -> bool:
    try:
        return _hasher.verify(hashed, password)
    except (VerificationError, InvalidHashError):
        return False


def create_session_token(user_id: int, settings: Settings) -> str:
    now = int(time.time())
    claims = {"sub": str(user_id), "iat": now, "exp": now + settings.session_ttl_hours * 3600}
    return jwt.encode(claims, settings.jwt_secret, algorithm="HS256")


def decode_session_token(token: str, settings: Settings) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def _fernet(settings: Settings) -> Fernet:
    if settings.encryption_key:
        return Fernet(settings.encryption_key.encode())
    digest = hashlib.sha256(f"orbnoc-fernet:{settings.jwt_secret}".encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(value: str, settings: Settings) -> str:
    return _fernet(settings).encrypt(value.encode()).decode()


def decrypt_secret(value: str, settings: Settings) -> str | None:
    try:
        return _fernet(settings).decrypt(value.encode()).decode()
    except InvalidToken:
        return None
