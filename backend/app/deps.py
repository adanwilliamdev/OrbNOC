from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from . import models
from .database import get_db
from .security import ACCESS_COOKIE, decode_access_token


def _extract_jwt_from_request(request: Request) -> str | None:
    """
    Lê o JWT preferencialmente do cookie httpOnly "access_token" (usado pelo
    frontend web). Mantém compatibilidade com o header "Authorization: Bearer"
    para clientes de API (Swagger, integrações externas, testes).
    """
    token = request.cookies.get(ACCESS_COOKIE)
    if token:
        return token
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[len("Bearer "):]
    return None


def get_current_user(request: Request, db: Session = Depends(get_db)) -> models.User:
    token = _extract_jwt_from_request(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    email = decode_access_token(token)
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    return user


def require_admin(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != models.Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem permissão para executar esta ação",
        )
    return user
