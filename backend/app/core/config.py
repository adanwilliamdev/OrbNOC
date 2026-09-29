"""Configuração da aplicação (variáveis de ambiente / .env)."""

from functools import lru_cache
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Segredos que nunca podem ser usados em produção (valores de exemplo de versões anteriores).
_INSECURE_SECRETS = {
    "",
    "secret",
    "change_this_in_production",
    "troque_por_um_segredo_forte_e_unico",
    "orbnoc_secret_key_2024_change_this_in_production",
}
_DEV_SECRET = "dev-only-insecure-secret-change-me-before-production"  # noqa: S105


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Literal["development", "production", "test"] = "development"

    # Infra
    database_url: str = "postgresql://postgres:postgres@localhost:5432/orbnoc"
    database_ssl: bool = False
    redis_url: str = "redis://localhost:6379/0"

    # Segurança
    jwt_secret: str = _DEV_SECRET
    encryption_key: str | None = None  # se vazio, derivada do JWT_SECRET
    session_minutes: int = 720
    cookie_name: str = "orbnoc_session"
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    cookie_secure: bool | None = None  # padrão: True em produção
    allow_registration: bool = False
    admin_username: str = "admin"
    admin_email: str = "admin@orbnoc.local"
    admin_password: str | None = None
    login_max_attempts: int = 5
    login_window_seconds: int = 900
    diagnostic_rate_limit_per_minute: int = 20

    # Rede / CORS (só necessário se o frontend NÃO estiver na mesma origem da API)
    frontend_url: str = "http://localhost:3000"
    extra_cors_origins: str = ""
    enable_docs: bool | None = None  # padrão: desligado em produção

    # Monitoramento
    monitor_interval_ms: int = 10_000
    monitor_concurrency: int = 20
    monitor_timeout_seconds: float = 3.0
    failure_threshold: int = 3  # falhas seguidas para marcar OFFLINE
    sla_breach_consecutive: int = 3  # violações seguidas de latência para alertar
    icmp_mode: Literal["auto", "icmp", "tcp"] = "auto"

    # Política de alvos (proteção contra SSRF / varredura interna)
    allow_loopback_targets: bool = False
    allow_private_targets: bool = True

    # Retenção
    raw_metrics_retention_days: int = 7
    hourly_metrics_retention_days: int = 400
    events_retention_days: int = 365

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def secure_cookies(self) -> bool:
        if self.cookie_secure is not None:
            return self.cookie_secure
        return self.is_production

    @property
    def docs_enabled(self) -> bool:
        return self.enable_docs if self.enable_docs is not None else not self.is_production

    @property
    def allowed_origins(self) -> list[str]:
        raw = [self.frontend_url, *self.extra_cors_origins.split(",")]
        return sorted({o.strip().rstrip("/") for o in raw if o.strip()})

    @property
    def monitor_interval_seconds(self) -> float:
        return max(1.0, self.monitor_interval_ms / 1000)

    @field_validator("admin_password", "encryption_key", "cookie_secure", "enable_docs", mode="before")
    @classmethod
    def _empty_is_unset(cls, v):
        """Variável presente mas vazia (ex.: `${VAR:-}` no compose) equivale a não definida."""
        return None if isinstance(v, str) and not v.strip() else v

    @model_validator(mode="after")
    def _validate_production(self) -> "Settings":
        if self.cookie_samesite == "none" and not self.secure_cookies:
            raise ValueError("COOKIE_SAMESITE=none exige cookies seguros (COOKIE_SECURE=true).")
        if self.is_production:
            if (
                self.jwt_secret in _INSECURE_SECRETS
                or self.jwt_secret == _DEV_SECRET
                or len(self.jwt_secret) < 32
            ):
                raise ValueError(
                    "Em produção, defina JWT_SECRET com pelo menos 32 caracteres (valor único e aleatório)."
                )
            if self.admin_password is not None and len(self.admin_password) < 10:
                raise ValueError("ADMIN_PASSWORD deve ter pelo menos 10 caracteres em produção.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
