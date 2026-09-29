from pydantic import BaseModel


class Message(BaseModel):
    success: bool = True
    message: str | None = None
