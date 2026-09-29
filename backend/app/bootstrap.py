"""Criação do administrador inicial a partir de variáveis de ambiente (sem usuário/senha padrão)."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.models import User

log = logging.getLogger(__name__)


async def ensure_admin(session: AsyncSession) -> bool:
    """Cria o admin se ADMIN_PASSWORD estiver definido e o usuário ainda não existir. Nunca sobrescreve."""
    s = get_settings()
    if not s.admin_password:
        return False
    username = s.admin_username.strip().lower()
    if await session.scalar(select(User.id).where(User.username == username)):
        return False
    session.add(
        User(
            username=username,
            email=s.admin_email.strip().lower(),
            password_hash=hash_password(s.admin_password),
            role="admin",
        )
    )
    await session.commit()
    log.info("Administrador '%s' criado", username)
    return True
