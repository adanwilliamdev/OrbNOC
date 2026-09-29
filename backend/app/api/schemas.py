"""Schemas Pydantic. Nomes de campo em snake_case — contrato com o frontend."""

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.services.netguard import HostRejected, parse_host
from app.services.notifier import CHAT_ID_RE, TOKEN_RE

DeviceStatus = Literal["unknown", "online", "offline"]
Severity = Literal["success", "warning", "error", "info"]


def validate_password(password: str) -> str:
    if len(password) < 8:
        raise ValueError("A senha deve ter pelo menos 8 caracteres")
    if len(password) > 128:
        raise ValueError("A senha é longa demais")
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise ValueError("A senha deve conter letras e números")
    return password


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: str
    role: str
    is_active: bool = True


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=256)


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=100, pattern=r"^[A-Za-z0-9_.-]+$")
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def _pw(cls, v: str) -> str:
        return validate_password(v)


class AuthOut(BaseModel):
    success: bool = True
    user: UserOut


class AuthConfigOut(BaseModel):
    registration_enabled: bool


class UserCreate(RegisterIn):
    role: Literal["admin", "user"] = "user"


class UserPatch(BaseModel):
    is_active: bool | None = None
    role: Literal["admin", "user"] | None = None
    password: str | None = None

    @field_validator("password")
    @classmethod
    def _pw(cls, v: str | None) -> str | None:
        return validate_password(v) if v is not None else v


class DeviceBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    check_type: Literal["icmp", "tcp"] = "icmp"
    port: int | None = Field(default=None, ge=1, le=65535)
    interval_seconds: int = Field(default=10, ge=5, le=3600)
    failure_threshold: int = Field(default=3, ge=1, le=10)
    sla_threshold_ms: int | None = Field(default=None, ge=1, le=60000)


class DeviceCreate(DeviceBase):
    ip: str = Field(min_length=1, max_length=255)

    @field_validator("ip")
    @classmethod
    def _ip(cls, v: str) -> str:
        try:
            return parse_host(v)
        except HostRejected as exc:
            raise ValueError(str(exc)) from exc

    @model_validator(mode="after")
    def _port_for_tcp(self) -> "DeviceCreate":
        if self.check_type == "tcp" and self.port is None:
            raise ValueError("Informe a porta para checagem TCP")
        return self


class DevicePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    check_type: Literal["icmp", "tcp"] | None = None
    port: int | None = Field(default=None, ge=1, le=65535)
    interval_seconds: int | None = Field(default=None, ge=5, le=3600)
    failure_threshold: int | None = Field(default=None, ge=1, le=10)
    sla_threshold_ms: int | None = Field(default=None, ge=1, le=60000)


class DeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    ip: str
    location: str | None
    check_type: str
    port: int | None
    interval_seconds: int
    failure_threshold: int
    sla_threshold_ms: int | None
    sla_breached: bool
    status: DeviceStatus
    latency: float | None
    avg_latency: float | None
    min_latency: float | None
    max_latency: float | None
    jitter: float | None
    packet_loss: float | None
    last_error: str | None
    last_check: datetime | None
    last_status_change: datetime | None
    created_at: datetime


class DevicePingOut(BaseModel):
    id: int
    name: str
    ip: str
    status: Literal["online", "offline"]
    latency_ms: float | None
    method: str
    error: str | None = None
    timestamp: datetime


class PortCheckIn(BaseModel):
    port: int = Field(ge=1, le=65535)


class MetricOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    device_id: int
    ok: bool
    latency: float | None
    jitter: float | None
    packet_loss: float | None
    recorded_at: datetime


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    device_id: int | None
    kind: str
    severity: Severity
    message: str
    created_at: datetime
    acknowledged_at: datetime | None


class TelegramIn(BaseModel):
    enabled: bool
    bot_token: str | None = Field(default=None, max_length=200)
    chat_id: str | None = Field(default=None, max_length=100)

    @field_validator("bot_token")
    @classmethod
    def _token(cls, v: str | None) -> str | None:
        v = (v or "").strip()
        if not v:
            return None
        if not TOKEN_RE.match(v):
            raise ValueError("Token do bot em formato inválido")
        return v

    @field_validator("chat_id")
    @classmethod
    def _chat(cls, v: str | None) -> str | None:
        v = (v or "").strip()
        if not v:
            return None
        if not CHAT_ID_RE.match(v):
            raise ValueError("Chat ID inválido")
        return v


class TelegramOut(BaseModel):
    """O token nunca volta pela API; só informamos se existe um salvo."""

    enabled: bool
    chat_id: str
    bot_token_set: bool
    test_sent: bool | None = None
    test_error: str | None = None


class SlaConfigIn(BaseModel):
    device_id: int
    threshold_ms: int | None = Field(ge=1, le=60000)


class HostIn(BaseModel):
    host: str = Field(min_length=1, max_length=255)


class PingIn(HostIn):
    count: int = Field(default=5, ge=1, le=10)


class TracerouteIn(HostIn):
    max_hops: int = Field(default=20, ge=1, le=30)


class DnsIn(BaseModel):
    domain: str = Field(min_length=1, max_length=255)
    record_type: str = Field(default="A", max_length=10)


def _check_ports(ports: list[int]) -> list[int]:
    if any(p < 1 or p > 65535 for p in ports):
        raise ValueError("Porta fora do intervalo 1-65535")
    return list(dict.fromkeys(ports))


class PortsIn(HostIn):
    ports: list[int] = Field(min_length=1, max_length=20)

    @field_validator("ports")
    @classmethod
    def _ports(cls, v: list[int]) -> list[int]:
        return _check_ports(v)


class FullDiagnosticIn(HostIn):
    ports: list[int] = Field(default_factory=lambda: [80, 443, 22], min_length=1, max_length=20)

    @field_validator("ports")
    @classmethod
    def _ports(cls, v: list[int]) -> list[int]:
        return _check_ports(v)
