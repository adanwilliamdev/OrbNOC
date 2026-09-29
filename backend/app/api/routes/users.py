from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.core.security import hash_password
from app.db.models import User
from app.db.session import get_session
from app.schemas.auth import AdminCreateUser, UserOut

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[UserOut])
async def list_users(session: AsyncSession = Depends(get_session)):
    return list(await session.scalars(select(User).order_by(User.id)))


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(body: AdminCreateUser, session: AsyncSession = Depends(get_session)):
    user = User(
        username=body.username, email=body.email, password_hash=hash_password(body.password), role=body.role
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Usuário ou e-mail já cadastrado") from None
    return user
