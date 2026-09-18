from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])


def _to_profile_response(user: models.User) -> schemas.UserProfile:
    return schemas.UserProfile(id=user.id, nome=user.nome, email=user.email, role=user.role)


@router.get("/me")
def me(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == current_user.email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Usuário não encontrado: {current_user.email}")
    return _to_profile_response(user)


@router.put("/me")
def update_me(
    dto: schemas.UpdateProfileRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.email == current_user.email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Usuário não encontrado: {current_user.email}")
    user.nome = dto.nome
    db.add(user)
    db.commit()
    db.refresh(user)
    return _to_profile_response(user)
