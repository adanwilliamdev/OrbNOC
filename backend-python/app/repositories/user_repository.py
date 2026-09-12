"""
Repositório de usuários. Por enquanto expõe só o que `device_service`
precisa (checar config de alerta do Telegram). As rotas de auth/admin
continuam usando o pool asyncpg legado — serão migradas em um passo à parte.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import User


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, user_id: int) -> User | None:
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
