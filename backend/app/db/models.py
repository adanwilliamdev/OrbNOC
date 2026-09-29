from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

TZ = DateTime(timezone=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True)  # sempre minúsculo
    email: Mapped[str] = mapped_column(String(255), unique=True)  # sempre minúsculo
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="user", server_default="user")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(TZ, server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(TZ)


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (Index("ix_devices_owner_id", "owner_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(120))
    ip: Mapped[str] = mapped_column(String(255))  # IP ou hostname
    location: Mapped[str | None] = mapped_column(String(255))
    check_type: Mapped[str] = mapped_column(String(10), default="icmp", server_default="icmp")
    port: Mapped[int | None] = mapped_column(Integer)
    sla_threshold_ms: Mapped[int | None] = mapped_column(Integer)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    # Estado atual (mantido pelo worker)
    status: Mapped[str] = mapped_column(String(10), default="unknown", server_default="unknown")
    consecutive_failures: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    sla_breach_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    sla_breached: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    status_changed_at: Mapped[datetime | None] = mapped_column(TZ)
    last_check_at: Mapped[datetime | None] = mapped_column(TZ)
    latency: Mapped[float | None] = mapped_column(Float)
    avg_latency: Mapped[float | None] = mapped_column(Float)
    min_latency: Mapped[float | None] = mapped_column(Float)
    max_latency: Mapped[float | None] = mapped_column(Float)
    jitter: Mapped[float | None] = mapped_column(Float)
    packet_loss: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(TZ, server_default=func.now())


class Metric(Base):
    """Uma amostra por verificação. Mantida por RAW_METRICS_RETENTION_DAYS; depois só o agregado por hora."""

    __tablename__ = "metrics"
    __table_args__ = (Index("ix_metrics_device_time", "device_id", "recorded_at"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"))
    recorded_at: Mapped[datetime] = mapped_column(TZ, server_default=func.now())
    ok: Mapped[bool] = mapped_column(Boolean)
    latency_ms: Mapped[float | None] = mapped_column(Float)


class MetricHourly(Base):
    __tablename__ = "metrics_hourly"

    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"), primary_key=True)
    hour: Mapped[datetime] = mapped_column(TZ, primary_key=True)
    samples: Mapped[int] = mapped_column(Integer)
    ok_samples: Mapped[int] = mapped_column(Integer)
    latency_sum: Mapped[float] = mapped_column(Float, default=0.0)
    latency_count: Mapped[int] = mapped_column(Integer, default=0)
    latency_min: Mapped[float | None] = mapped_column(Float)
    latency_max: Mapped[float | None] = mapped_column(Float)


class Event(Base):
    """Alertas/incidentes (fica no servidor, ao contrário da versão antiga que usava localStorage)."""

    __tablename__ = "events"
    __table_args__ = (Index("ix_events_owner_created", "owner_id", "created_at"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    device_id: Mapped[int | None] = mapped_column(ForeignKey("devices.id", ondelete="SET NULL"))
    device_name: Mapped[str] = mapped_column(String(120))
    device_ip: Mapped[str] = mapped_column(String(255))
    kind: Mapped[str] = mapped_column(String(20))  # down | recovered | sla_breach
    severity: Mapped[str] = mapped_column(String(10))  # error | success | warning | info
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TZ, server_default=func.now())
    acknowledged_at: Mapped[datetime | None] = mapped_column(TZ)


class NotificationChannel(Base):
    __tablename__ = "notification_channels"
    __table_args__ = (UniqueConstraint("owner_id", "kind"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(20), default="telegram")
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    chat_id: Mapped[str | None] = mapped_column(String(100))
    secret_encrypted: Mapped[str | None] = mapped_column(Text)  # token do bot, criptografado (Fernet)
    updated_at: Mapped[datetime] = mapped_column(TZ, server_default=func.now(), onupdate=func.now())


class AccessLog(Base):
    __tablename__ = "access_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(30))
    ip_address: Mapped[str | None] = mapped_column(String(45))
    created_at: Mapped[datetime] = mapped_column(TZ, server_default=func.now())


class SystemState(Base):
    """Pares chave/valor internos (ex.: até que hora o agregado por hora já foi calculado)."""

    __tablename__ = "system_state"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
