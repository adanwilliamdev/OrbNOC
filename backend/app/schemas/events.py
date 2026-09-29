from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: int | None
    device_name: str
    device_ip: str
    kind: str
    severity: str
    message: str
    created_at: datetime
    acknowledged_at: datetime | None


class TelegramConfigOut(BaseModel):
    enabled: bool
    chat_id: str | None
    token_set: bool
    token_hint: str | None = None  # só os 4 últimos caracteres; o token completo nunca sai do servidor


class TelegramConfigIn(BaseModel):
    enabled: bool
    chat_id: str | None = Field(default=None, max_length=100)
    bot_token: str | None = Field(
        default=None, max_length=200, description="Omitir para manter o token atual"
    )
