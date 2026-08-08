"""
Hashing de senha (bcrypt) e emissão/validação de JWT.
Equivalente ao uso de bcryptjs + jsonwebtoken no backend original.
"""
import time
from typing import Any

import bcrypt
import jwt

from . import config


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(10)).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def issue_token(user: dict[str, Any]) -> str:
    payload = {
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "iat": int(time.time()),
        "exp": int(time.time()) + config.JWT_EXPIRES_HOURS * 3600,
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])


def to_public_user(user) -> dict[str, Any]:
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "role": user["role"],
    }
