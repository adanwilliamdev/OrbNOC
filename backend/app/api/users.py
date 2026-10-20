from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import AdminUser, SessionDep
from app.api.schemas import UserAdminOut, UserCreate, UserPatch
from app.core.security import hash_password
from app.db.models import User

router = APIRouter(prefix="/api/users", tags=["users"])


async def _active_admins(session) -> int:
    return (
        await session.scalar(
            select(func.count()).select_from(User).where(User.role == "admin", User.is_active)
        )
    ) or 0


@router.get("", response_model=list[UserAdminOut])
async def list_users(_: AdminUser, session: SessionDep) -> list[User]:
    return list((await session.scalars(select(User).order_by(User.id))).all())


@router.post("", response_model=UserAdminOut, status_code=status.HTTP_201_CREATED)
async def create_user(body: UserCreate, _: AdminUser, session: SessionDep) -> User:
    user = User(
        username=body.username,
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        role=body.role,
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Usuário ou email já existe") from None
    return user


@router.patch("/{user_id}", response_model=UserAdminOut)
async def patch_user(user_id: int, body: UserPatch, admin: AdminUser, session: SessionDep) -> User:
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuário não encontrado")
    demoting = body.role == "user" and user.role == "admin"
    deactivating = body.is_active is False and user.is_active
    if (demoting or deactivating) and user.role == "admin" and await _active_admins(session) <= 1:
        raise HTTPException(status.HTTP_409_CONFLICT, "Não é possível remover o último admin")
    if user.id == admin.id and (demoting or deactivating):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Você não pode desativar ou rebaixar a própria conta"
        )
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.role is not None:
        user.role = body.role
    if body.password is not None:
        user.password_hash = hash_password(body.password)
    await session.commit()
    return user


@router.delete("/{user_id}")
async def delete_user(user_id: int, admin: AdminUser, session: SessionDep) -> dict:
    """Remove o usuário e, em cascata, dispositivos, alertas e configurações dele."""
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuário não encontrado")
    if user.id == admin.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "Você não pode remover a própria conta")
    if user.role == "admin" and user.is_active and await _active_admins(session) <= 1:
        raise HTTPException(status.HTTP_409_CONFLICT, "Não é possível remover o último admin")
    await session.delete(user)
    await session.commit()
    return {"success": True}
