from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
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
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role in ('admin','user')", name="role"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="user", server_default="user")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    devices: Mapped[list["Device"]] = relationship(back_populates="user", cascade="all, delete")


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (
        UniqueConstraint("user_id", "ip", name="uq_devices_user_ip"),
        CheckConstraint("check_type in ('icmp','tcp')", name="check_type"),
        CheckConstraint("status in ('unknown','online','offline')", name="status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    ip: Mapped[str] = mapped_column(
        String(255)
    )  # IP ou hostname (nome mantido: contrato do frontend)
    location: Mapped[str | None] = mapped_column(String(255))

    check_type: Mapped[str] = mapped_column(String(10), default="icmp", server_default="icmp")
    port: Mapped[int | None] = mapped_column(Integer)
    interval_seconds: Mapped[int] = mapped_column(Integer, default=10, server_default="10")
    failure_threshold: Mapped[int] = mapped_column(Integer, default=3, server_default="3")
    sla_threshold_ms: Mapped[int | None] = mapped_column(Integer)

    status: Mapped[str] = mapped_column(String(10), default="unknown", server_default="unknown")
    consecutive_failures: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    sla_breached: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    latency: Mapped[float | None] = mapped_column(Float)
    avg_latency: Mapped[float | None] = mapped_column(Float)
    min_latency: Mapped[float | None] = mapped_column(Float)
    max_latency: Mapped[float | None] = mapped_column(Float)
    jitter: Mapped[float | None] = mapped_column(Float)
    packet_loss: Mapped[float | None] = mapped_column(Float)
    last_error: Mapped[str | None] = mapped_column(String(255))
    last_check: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_status_change: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship(back_populates="devices")


class Metric(Base):
    __tablename__ = "metrics"
    __table_args__ = (
        Index("ix_metrics_device_recorded", "device_id", "recorded_at"),
        Index("ix_metrics_recorded_at", "recorded_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"))
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    ok: Mapped[bool] = mapped_column(Boolean)
    latency: Mapped[float | None] = mapped_column(Float)
    jitter: Mapped[float | None] = mapped_column(Float)
    packet_loss: Mapped[float | None] = mapped_column(Float)


class MetricHourly(Base):
    """Agregação por hora (uptime/latência). Fonte dos relatórios de SLA de 24h a 30d."""

    __tablename__ = "metrics_hourly"

    device_id: Mapped[int] = mapped_column(
        ForeignKey("devices.id", ondelete="CASCADE"), primary_key=True
    )
    hour: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    samples: Mapped[int] = mapped_column(Integer)
    ok_samples: Mapped[int] = mapped_column(Integer)
    avg_latency: Mapped[float | None] = mapped_column(Float)
    min_latency: Mapped[float | None] = mapped_column(Float)
    max_latency: Mapped[float | None] = mapped_column(Float)


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        Index("ix_events_user_created", "user_id", "created_at"),
        CheckConstraint("severity in ('success','warning','error','info')", name="severity"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    device_id: Mapped[int | None] = mapped_column(ForeignKey("devices.id", ondelete="SET NULL"))
    kind: Mapped[str] = mapped_column(
        String(30)
    )  # offline | recovered | sla_breach | sla_recovered
    severity: Mapped[str] = mapped_column(String(10))
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class NotificationChannel(Base):
    __tablename__ = "notification_channels"
    __table_args__ = (
        UniqueConstraint("user_id", "kind", name="uq_notification_channels_user_kind"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(20))  # telegram
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    secret_encrypted: Mapped[str | None] = mapped_column(Text)  # token do bot (Fernet)
    target: Mapped[str | None] = mapped_column(String(100))  # chat_id
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AccessLog(Base):
    __tablename__ = "access_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(50))
    ip_address: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
