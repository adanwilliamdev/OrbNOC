"""Configuração via variáveis de ambiente (pydantic-settings)."""

from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_JWT_SECRET = "dev-only-insecure-secret-change-me-0123456789"  # noqa: S105


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    database_url: str = "postgresql://postgres:postgres@localhost:5432/orbnoc"
    database_ssl: bool = False
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str = ""
    encryption_key: str = ""  # chave Fernet; se vazia, é derivada de JWT_SECRET
    session_ttl_hours: int = 24
    cookie_name: str = "orbnoc_session"
    cookie_secure: bool | None = None  # padrão: True em produção

    # Origem pública (Caddy). Requisições com outro Origin são rejeitadas.
    public_url: str = "http://localhost"
    extra_origins: str = ""

    registration_enabled: bool = False
    admin_username: str = "admin"
    admin_email: str = "admin@example.com"
    admin_password: str = ""

    allow_private_networks: bool = True

    worker_tick_seconds: float = Field(default=2.0, gt=0)
    monitor_concurrency: int = Field(default=20, ge=1)
    default_failure_threshold: int = 3
    probe_timeout_seconds: float = 2.0

    metrics_retention_days: int = 14
    hourly_retention_days: int = 400
    events_retention_days: int = 90
    access_log_retention_days: int = 180

    health_worker_max_age_seconds: int = 30
    login_max_attempts: int = 8
    login_window_seconds: int = 900
    enable_docs: bool = False

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def secure_cookie(self) -> bool:
        return self.is_production if self.cookie_secure is None else self.cookie_secure

    @property
    def allowed_origins(self) -> set[str]:
        origins = {self.public_url.rstrip("/")}
        origins.update(o.strip().rstrip("/") for o in self.extra_origins.split(",") if o.strip())
        return origins

    @model_validator(mode="after")
    def _check_secrets(self) -> "Settings":
        if not self.jwt_secret:
            if self.is_production:
                raise ValueError("JWT_SECRET é obrigatório em produção")
            self.jwt_secret = DEV_JWT_SECRET
        if self.is_production and len(self.jwt_secret) < 32:
            raise ValueError("JWT_SECRET precisa ter pelo menos 32 caracteres em produção")
        if self.is_production and self.jwt_secret == DEV_JWT_SECRET:
            raise ValueError("JWT_SECRET de desenvolvimento não pode ser usado em produção")
        return self


def normalize_database_url(url: str, force_ssl: bool = False) -> tuple[str, dict]:
    """Converte para o driver asyncpg e traduz sslmode/channel_binding (Neon, Supabase, Render)."""
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    sslmode = query.pop("sslmode", None)
    query.pop("channel_binding", None)
    connect_args: dict = {"server_settings": {"timezone": "UTC"}}
    if force_ssl or sslmode in {"require", "verify-ca", "verify-full"}:
        connect_args["ssl"] = "require"
    clean = parts._replace(scheme="postgresql+asyncpg", query=urlencode(query))
    return urlunsplit(clean), connect_args


@lru_cache
def get_settings() -> Settings:
    return Settings()
