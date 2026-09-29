"""Cria o admin inicial a partir de variáveis de ambiente (não existe mais login demo)."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import Settings
from app.core.security import hash_password
from app.db.models import User

log = logging.getLogger(__name__)


async def ensure_admin(sessionmaker: async_sessionmaker, settings: Settings) -> None:
    if not settings.admin_password:
        log.info("ADMIN_PASSWORD não definido; nenhum admin criado")
        return
    async with sessionmaker() as session:
        exists = await session.scalar(select(User).where(User.username == settings.admin_username))
        if exists:
            return
        session.add(
            User(
                username=settings.admin_username,
                email=settings.admin_email.lower(),
                password_hash=hash_password(settings.admin_password),
                role="admin",
            )
        )
        await session.commit()
        log.info("Admin '%s' criado", settings.admin_username)
