from pydantic import BaseModel, Field


class HostRequest(BaseModel):
    host: str = Field(min_length=1, max_length=255)


class PingRequest(HostRequest):
    count: int = Field(default=5, ge=1, le=10)


class PortCheckRequest(HostRequest):
    ports: list[int] = Field(min_length=1, max_length=20)


class DnsRequest(BaseModel):
    domain: str = Field(min_length=1, max_length=255)
    record_type: str = Field(default="A", max_length=10)


class FullDiagnosticRequest(HostRequest):
    ports: list[int] = Field(default_factory=lambda: [80, 443], max_length=20)
