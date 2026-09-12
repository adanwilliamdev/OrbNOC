"""
Models SQLAlchemy 2.0 que espelham, campo a campo, o schema hoje criado
manualmente em `app/database.py` (TABLE_DEFINITIONS). Nenhuma coluna foi
renomeada ou removida — este é um mapeamento 1:1, para servir de baseline
das migrations do Alembic sem quebrar dados existentes.

Passos seguintes (fora deste commit) vão migrar rotas para usar estes
models via repositórios, em vez de SQL cru com asyncpg.
"""
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="user", server_default="user")
    telegram_alerts_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    telegram_bot_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    telegram_chat_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    email_alerts_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    alert_email_target: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_login: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.current_timestamp())

    devices: Mapped[list["UserDevice"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class UserDevice(Base):
    __tablename__ = "user_devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    device_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    ip: Mapped[str] = mapped_column(String(45), nullable=False)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="offline", server_default="offline")
    latency: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avg_latency: Mapped[int | None] = mapped_column(Integer, nullable=True)
    min_latency: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_latency: Mapped[int | None] = mapped_column(Integer, nullable=True)
    jitter: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    packet_loss: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    last_check: Mapped[datetime | None] = mapped_column(nullable=True)
    last_ping_stats: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.current_timestamp())

    user: Mapped["User"] = relationship(back_populates="devices")
    metrics: Mapped[list["DeviceMetric"]] = relationship(back_populates="device", cascade="all, delete-orphan")


class AccessLog(Base):
    __tablename__ = "access_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    action: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.current_timestamp())


class SlaAlert(Base):
    __tablename__ = "sla_alerts"
    __table_args__ = (UniqueConstraint("user_id", "device_id", name="sla_alerts_user_id_device_id_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    device_id: Mapped[int] = mapped_column(Integer, nullable=False)
    threshold: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.current_timestamp())


class DeviceMetric(Base):
    """
    Série temporal das leituras de ping. Guarda o histórico de status/latência
    por dispositivo para permitir gráficos de uptime/latência ao longo do
    tempo (antes só se guardava o último valor em user_devices).
    """

    __tablename__ = "device_metrics"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("user_devices.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    latency: Mapped[int | None] = mapped_column(Integer, nullable=True)
    packet_loss: Mapped[int | None] = mapped_column(Integer, nullable=True)
    jitter: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(server_default=func.current_timestamp())

    device: Mapped["UserDevice"] = relationship(back_populates="metrics")
