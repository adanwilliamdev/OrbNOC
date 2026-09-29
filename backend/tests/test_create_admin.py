import pytest
from sqlalchemy import select

from app.core.security import verify_password
from app.create_admin import run
from app.db.models import User

from .conftest import create_user


async def test_creates_admin(sessionmaker):
    msg = await run("ana", "ana@example.com", "Senha1234", reset=False)
    assert "criado" in msg
    async with sessionmaker() as s:
        u = await s.scalar(select(User).where(User.username == "ana"))
    assert u.role == "admin" and verify_password(u.password_hash, "Senha1234")


async def test_existing_user_needs_reset_flag(sessionmaker):
    await create_user(sessionmaker, "bia")
    with pytest.raises(SystemExit):
        await run("bia", "bia@example.com", "Senha1234", reset=False)


async def test_reset_changes_password_reactivates_and_promotes(sessionmaker):
    uid = await create_user(sessionmaker, "caio")
    async with sessionmaker() as s:
        (await s.get(User, uid)).is_active = False
        await s.commit()
    msg = await run("caio", "caio@example.com", "OutraSenha1", reset=True)
    assert "redefinida" in msg
    async with sessionmaker() as s:
        u = await s.get(User, uid)
    assert u.is_active and u.role == "admin" and verify_password(u.password_hash, "OutraSenha1")
