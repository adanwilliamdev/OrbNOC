"""
Configurações da aplicação, lidas de variáveis de ambiente.
Equivalente a config/configuration.ts do backend original em NestJS.
"""
from __future__ import annotations

import os
from functools import lru_cache
from typing import List


def _get_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _get_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() == "true"


class Settings:
    def __init__(self) -> None:
        self.port: int = _get_int("PORT", 8080)

        # DATABASE_URL no formato do SQLAlchemy, ex:
        # postgresql+psycopg2://usuario:senha@host:5432/banco
        # Aceita também o formato "postgresql://..." (usado pelo Prisma/psycopg2),
        # convertendo automaticamente para o driver psycopg2 do SQLAlchemy.
        raw_db_url = os.getenv("DATABASE_URL", "sqlite:///./biblioteca.db")
        if raw_db_url.startswith("postgresql://"):
            raw_db_url = raw_db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
        elif raw_db_url.startswith("postgres://"):
            raw_db_url = raw_db_url.replace("postgres://", "postgresql+psycopg2://", 1)
        self.database_url: str = raw_db_url

        # O valor abaixo é usado apenas se JWT_SECRET não estiver definida (ex: rodando
        # local sem .env). Gere uma chave própria com: openssl rand -base64 64
        # NUNCA use este valor padrão em produção — defina sempre JWT_SECRET no ambiente.
        self.jwt_secret_b64: str = os.getenv(
            "JWT_SECRET",
            "d29ybGRzLW1vc3Qtc2VjcmV0LWtleS1jaGFuZ2UtaW4tcHJvZHVjdGlvbi1wbGVhc2U=",
        )
        # Access token: vida curta (15 min por padrão), enviado em toda requisição.
        self.jwt_expiration_ms: int = _get_int("JWT_EXPIRATION_MS", 900_000)
        # Refresh token: vida longa (7 dias por padrão), usado só para renovar o access token.
        self.jwt_refresh_expiration_ms: int = _get_int("JWT_REFRESH_EXPIRATION_MS", 604_800_000)

        origins_raw = os.getenv("APP_CORS_ALLOWED_ORIGINS", "http://localhost:*,http://127.0.0.1:*")
        self.cors_allowed_origins: List[str] = [o.strip() for o in origins_raw.split(",") if o.strip()]

        # Marca os cookies de autenticação como Secure (só enviados via HTTPS).
        # Defina APP_COOKIE_SECURE=true em produção (atrás de HTTPS).
        self.cookie_secure: bool = _get_bool("APP_COOKIE_SECURE", False)

        self.rate_limit_window_ms: int = _get_int("APP_RATE_LIMIT_WINDOW_MS", 60_000)
        self.rate_limit_max_attempts: int = _get_int("APP_RATE_LIMIT_MAX_ATTEMPTS", 10)

        self.tmdb_api_key: str = os.getenv("TMDB_API_KEY", "")
        self.tmdb_base_url: str = "https://api.themoviedb.org/3"
        self.tmdb_image_base_url: str = "https://image.tmdb.org/t/p/w500"


@lru_cache
def get_settings() -> Settings:
    return Settings()
