"""
Autenticação baseada em cookies httpOnly:
 - access_token: JWT de vida curta, enviado em toda requisição autenticada.
 - refresh_token: token opaco de vida longa, usado só em /api/auth/refresh
   para obter um novo access_token sem exigir novo login. É rotacionado
   (revogado e substituído) a cada uso.

Nenhum dos dois tokens é devolvido no corpo JSON, apenas via Set-Cookie — isso
limita o impacto de um eventual XSS no frontend, já que JS não consegue ler
cookies httpOnly. Equivalente a auth/auth.controller.ts do backend original.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from .. import models, schemas, security
from ..config import get_settings
from ..database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


def _to_auth_response(user: models.User) -> schemas.AuthResponse:
    return schemas.AuthResponse(id=user.id, nome=user.nome, email=user.email, role=user.role)


def _emitir_cookies(user: models.User, db: Session, response: Response) -> None:
    access_token = security.generate_access_token(user.email)

    refresh_token_value = security.generate_refresh_token_value()
    expira_em = datetime.now(timezone.utc) + timedelta(seconds=security.refresh_token_expiration_seconds())
    refresh_token = models.RefreshToken(
        token=refresh_token_value,
        usuario_id=user.id,
        expira_em=expira_em,
        revogado=False,
    )
    db.add(refresh_token)
    db.commit()

    response.set_cookie(
        security.ACCESS_COOKIE,
        access_token,
        max_age=security.access_token_expiration_seconds(),
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        security.REFRESH_COOKIE,
        refresh_token_value,
        max_age=security.refresh_token_expiration_seconds(),
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def _limpar_cookies(response: Response) -> None:
    for cookie_name in (security.ACCESS_COOKIE, security.REFRESH_COOKIE):
        response.set_cookie(
            cookie_name,
            "",
            max_age=0,
            httponly=True,
            secure=settings.cookie_secure,
            samesite="lax",
            path="/",
        )


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(dto: schemas.RegisterRequest, response: Response, db: Session = Depends(get_db)):
    ja_existe = db.query(models.User).filter(models.User.email == dto.email).first()
    if ja_existe:
        response.status_code = status.HTTP_409_CONFLICT
        return {"message": "Já existe um usuário cadastrado com este e-mail"}

    user = models.User(
        nome=dto.nome,
        email=dto.email,
        senha=security.hash_password(dto.senha),
        role=models.Role.USER,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    _emitir_cookies(user, db, response)
    response.status_code = status.HTTP_201_CREATED
    return _to_auth_response(user)


@router.post("/login", status_code=status.HTTP_200_OK)
def login(dto: schemas.LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == dto.email).first()
    if not user or not security.verify_password(dto.senha, user.senha):
        response.status_code = status.HTTP_401_UNAUTHORIZED
        return {"message": "E-mail ou senha inválidos"}

    _emitir_cookies(user, db, response)
    return _to_auth_response(user)


@router.post("/refresh", status_code=status.HTTP_200_OK)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_token_value = request.cookies.get(security.REFRESH_COOKIE)
    if not refresh_token_value:
        response.status_code = status.HTTP_401_UNAUTHORIZED
        return {"message": "Sessão expirada, faça login novamente"}

    refresh_token = (
        db.query(models.RefreshToken).filter(models.RefreshToken.token == refresh_token_value).first()
    )
    expirado_ou_invalido = (
        refresh_token is None
        or refresh_token.revogado
        or refresh_token.expira_em.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc)
    )
    if expirado_ou_invalido:
        _limpar_cookies(response)
        response.status_code = status.HTTP_401_UNAUTHORIZED
        return {"message": "Sessão expirada, faça login novamente"}

    # Rotação: o refresh token usado é revogado e um novo par é emitido.
    refresh_token.revogado = True
    db.add(refresh_token)
    db.commit()

    user = db.query(models.User).filter(models.User.id == refresh_token.usuario_id).first()
    _emitir_cookies(user, db, response)
    return _to_auth_response(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_token_value = request.cookies.get(security.REFRESH_COOKIE)
    if refresh_token_value:
        db.query(models.RefreshToken).filter(models.RefreshToken.token == refresh_token_value).update(
            {"revogado": True}
        )
        db.commit()
    # Importante: não retornar um novo objeto Response aqui — isso descartaria os
    # cookies já definidos no objeto `response` injetado pelo FastAPI. Setar os
    # cookies nele e retornar None é o que faz o Set-Cookie realmente ser enviado.
    _limpar_cookies(response)
    return None
