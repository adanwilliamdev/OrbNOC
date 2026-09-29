import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

_USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,50}$")


def validate_password_strength(value: str) -> str:
    if len(value) < 8 or len(value) > 128:
        raise ValueError("A senha deve ter entre 8 e 128 caracteres")
    if not (re.search(r"[A-Za-z]", value) and re.search(r"\d", value)):
        raise ValueError("A senha deve conter letras e números")
    return value


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=255)  # usuário ou e-mail
    password: str = Field(min_length=1, max_length=128)


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str

    @field_validator("username")
    @classmethod
    def _username(cls, v: str) -> str:
        v = v.strip()
        if not _USERNAME_RE.match(v):
            raise ValueError("Usuário deve ter 3 a 50 caracteres (letras, números, . _ -)")
        return v.lower()

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return v.lower()

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        return validate_password_strength(v)


class AdminCreateUser(RegisterRequest):
    role: Literal["admin", "user"] = "user"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: str
    role: str


class AuthResponse(BaseModel):
    success: bool = True
    user: UserOut
