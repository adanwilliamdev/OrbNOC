"""
Dependência de autenticação para as rotas FastAPI.
Equivalente ao middleware authenticateToken de src/middleware/auth.js.
"""
from typing import Any

import jwt
from fastapi import Header, HTTPException

from . import security


class ApiError(HTTPException):
    """HTTPException cujo corpo de resposta é {"error": mensagem}, igual ao Express original."""

    def __init__(self, status_code: int, message: str):
        super().__init__(status_code=status_code, detail=message)


async def get_current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    token = None
    if authorization:
        parts = authorization.split(" ")
        if len(parts) > 1:
            token = parts[1]

    if not token:
        raise ApiError(401, "Token não fornecido")

    try:
        payload = security.decode_token(token)
    except jwt.PyJWTError:
        raise ApiError(403, "Token inválido")

    return payload
