"""
Camada de acesso a dados baseada em SQLAlchemy 2.0 (async) + Alembic.

Esta pasta convive, por enquanto, com `app/database.py` (pool asyncpg cru).
A migração das rotas para usar SQLAlchemy é feita incrementalmente
(ver ROADMAP no README de arquitetura) — nenhuma rota foi alterada neste
passo, apenas a infraestrutura de ORM/migrations foi introduzida.
"""
from .base import Base
from .engine import dispose_engine, get_session, get_sessionmaker, init_engine

__all__ = [
    "Base",
    "get_session",
    "get_sessionmaker",
    "init_engine",
    "dispose_engine",
]
