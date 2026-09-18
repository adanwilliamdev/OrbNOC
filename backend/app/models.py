"""
Modelos SQLAlchemy, equivalentes a prisma/schema.prisma do backend original.
Os nomes de tabela (@@map) e colunas (@map) foram mantidos para compatibilidade
com um banco de dados já existente criado pela versão Node.js/Prisma.
"""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Role(str, enum.Enum):
    USER = "USER"
    ADMIN = "ADMIN"


class ContentType(str, enum.Enum):
    FILME = "FILME"
    SERIE = "SERIE"


class ProgressStatus(str, enum.Enum):
    ASSISTIDO = "ASSISTIDO"
    PENDENTE = "PENDENTE"


class User(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    nome: Mapped[str] = mapped_column(String, nullable=False)
    senha: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[Role] = mapped_column(Enum(Role, native_enum=False), default=Role.USER, nullable=False)
    criado_em: Mapped[datetime] = mapped_column("criadoEm", DateTime, server_default=func.now())

    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="usuario")
    progressos: Mapped[list["UserProgress"]] = relationship(back_populates="usuario")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    token: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    usuario_id: Mapped[int] = mapped_column("usuario_id", ForeignKey("usuarios.id"), nullable=False)
    expira_em: Mapped[datetime] = mapped_column("expiraEm", DateTime, nullable=False)
    revogado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    criado_em: Mapped[datetime] = mapped_column("criadoEm", DateTime, server_default=func.now())

    usuario: Mapped["User"] = relationship(back_populates="refresh_tokens")


class Content(Base):
    __tablename__ = "conteudos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    titulo: Mapped[str] = mapped_column(String, nullable=False)
    sinopse: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    genero: Mapped[str | None] = mapped_column(String, nullable=True)
    ano: Mapped[int | None] = mapped_column(Integer, nullable=True)
    imagem_url: Mapped[str | None] = mapped_column("imagemUrl", String, nullable=True)
    tipo: Mapped[ContentType] = mapped_column(Enum(ContentType, native_enum=False), nullable=False)
    assistido: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    criado_em: Mapped[datetime] = mapped_column("criadoEm", DateTime, server_default=func.now())

    temporadas: Mapped[list["Season"]] = relationship(
        back_populates="conteudo", cascade="all, delete-orphan", order_by="Season.numero"
    )
    progressos: Mapped[list["UserProgress"]] = relationship(back_populates="conteudo")


class Season(Base):
    __tablename__ = "temporadas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    numero: Mapped[int] = mapped_column(Integer, nullable=False)
    titulo: Mapped[str | None] = mapped_column(String, nullable=True)
    conteudo_id: Mapped[int] = mapped_column("conteudo_id", ForeignKey("conteudos.id", ondelete="CASCADE"))

    conteudo: Mapped["Content"] = relationship(back_populates="temporadas")
    episodios: Mapped[list["Episode"]] = relationship(
        back_populates="temporada", cascade="all, delete-orphan", order_by="Episode.numero"
    )


class Episode(Base):
    __tablename__ = "episodios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    numero: Mapped[int] = mapped_column(Integer, nullable=False)
    titulo: Mapped[str | None] = mapped_column(String, nullable=True)
    duracao_minutos: Mapped[int | None] = mapped_column("duracaoMinutos", Integer, nullable=True)
    temporada_id: Mapped[int] = mapped_column("temporada_id", ForeignKey("temporadas.id", ondelete="CASCADE"))

    temporada: Mapped["Season"] = relationship(back_populates="episodios")
    progressos: Mapped[list["UserProgress"]] = relationship(back_populates="episodio")


class UserProgress(Base):
    __tablename__ = "progresso_usuario"
    __table_args__ = (UniqueConstraint("usuario_id", "episodio_id", name="uq_usuario_episodio"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    usuario_id: Mapped[int] = mapped_column("usuario_id", ForeignKey("usuarios.id"), nullable=False)
    conteudo_id: Mapped[int | None] = mapped_column(
        "conteudo_id", ForeignKey("conteudos.id", ondelete="CASCADE"), nullable=True
    )
    episodio_id: Mapped[int | None] = mapped_column(
        "episodio_id", ForeignKey("episodios.id", ondelete="CASCADE"), nullable=True
    )
    status: Mapped[ProgressStatus] = mapped_column(Enum(ProgressStatus, native_enum=False), nullable=False)
    atualizado_em: Mapped[datetime | None] = mapped_column("atualizado_em", DateTime, nullable=True)

    usuario: Mapped["User"] = relationship(back_populates="progressos")
    conteudo: Mapped["Content | None"] = relationship(back_populates="progressos")
    episodio: Mapped["Episode | None"] = relationship(back_populates="progressos")
