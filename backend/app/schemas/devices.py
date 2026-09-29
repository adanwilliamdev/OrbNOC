from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.netguard import TargetError, parse_host

CheckType = Literal["icmp", "tcp", "http"]
DeviceStatus = Literal["unknown", "online", "offline"]


class DeviceBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    ip: str = Field(min_length=1, max_length=255, description="IP ou hostname")
    location: str | None = Field(default=None, max_length=255)
    check_type: CheckType = "icmp"
    port: int | None = Field(default=None, ge=1, le=65535)
    sla_threshold_ms: int | None = Field(default=None, ge=1, le=60_000)
    enabled: bool = True

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Nome não pode ser vazio")
        return v

    @field_validator("ip")
    @classmethod
    def _ip(cls, v: str) -> str:
        try:
            return parse_host(v)
        except TargetError as exc:
            raise ValueError(str(exc)) from exc

    @field_validator("location")
    @classmethod
    def _location(cls, v: str | None) -> str | None:
        return (v or "").strip() or None


class DeviceCreate(DeviceBase):
    @model_validator(mode="after")
    def _port_required(self) -> "DeviceCreate":
        if self.check_type == "tcp" and not self.port:
            raise ValueError("Informe a porta para verificações TCP")
        if self.check_type == "icmp":
            self.port = None
        return self


class DeviceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    ip: str | None = Field(default=None, min_length=1, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    check_type: CheckType | None = None
    port: int | None = Field(default=None, ge=1, le=65535)
    sla_threshold_ms: int | None = Field(default=None, ge=1, le=60_000)
    enabled: bool | None = None

    @field_validator("ip")
    @classmethod
    def _ip(cls, v: str | None) -> str | None:
        if v is None:
            return None
        try:
            return parse_host(v)
        except TargetError as exc:
            raise ValueError(str(exc)) from exc


class DeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    ip: str
    location: str | None
    check_type: CheckType
    port: int | None
    sla_threshold_ms: int | None
    enabled: bool
    status: DeviceStatus
    latency: float | None
    avg_latency: float | None
    min_latency: float | None
    max_latency: float | None
    jitter: float | None
    packet_loss: float | None
    consecutive_failures: int
    sla_breached: bool
    status_changed_at: datetime | None
    last_check_at: datetime | None
    created_at: datetime


class CheckOut(BaseModel):
    id: int
    name: str
    ip: str
    online: bool
    latency_ms: float | None
    method: str
    error: str | None
    checked_at: datetime
