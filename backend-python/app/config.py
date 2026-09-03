"""
Configuração central da aplicação, lida a partir de variáveis de ambiente.
Equivalente a src/config/env.js da versão Node.js original.
"""
import logging
import os
import secrets

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("orbnoc.config")

_DEFAULT_JWT_SECRET = "orbnoc_secret_key_2024_change_this_in_production"

PORT: int = int(os.getenv("PORT", "3001"))
ENVIRONMENT: str = os.getenv("NODE_ENV", os.getenv("ENVIRONMENT", "development"))
IS_PRODUCTION: bool = ENVIRONMENT.lower() in ("production", "prod")

JWT_SECRET: str = os.getenv("JWT_SECRET", _DEFAULT_JWT_SECRET)
JWT_ALGORITHM: str = "HS256"
JWT_EXPIRES_HOURS: int = 24

if JWT_SECRET == _DEFAULT_JWT_SECRET:
    if IS_PRODUCTION:
        # Nunca deixamos o segredo padrão (que está público no repositório)
        # ser usado em produção — isso permitiria forjar tokens JWT válidos.
        raise RuntimeError(
            "JWT_SECRET não foi definido (ou está usando o valor padrão de "
            "desenvolvimento) com ENVIRONMENT=production. Defina uma variável "
            "de ambiente JWT_SECRET própria e secreta antes de subir em produção. "
            f"Sugestão gerada agora: {secrets.token_urlsafe(48)}"
        )
    logger.warning(
        "⚠️  JWT_SECRET não definido — usando valor padrão de desenvolvimento. "
        "NÃO use isso em produção."
    )

DATABASE_URL: str = os.getenv("DATABASE_URL", "")
DATABASE_SSL: bool = os.getenv("DATABASE_SSL", "false").lower() == "true"

FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
# Lista de origens extras liberadas no CORS, separadas por vírgula
# (útil quando o frontend roda em mais de um domínio/porta).
_extra_origins = os.getenv("EXTRA_CORS_ORIGINS", "")
ALLOWED_ORIGINS: list[str] = [FRONTEND_URL] + [
    o.strip() for o in _extra_origins.split(",") if o.strip()
]

MONITOR_INTERVAL_MS: int = int(os.getenv("MONITOR_INTERVAL_MS", "10000"))
MONITOR_INTERVAL_SECONDS: float = MONITOR_INTERVAL_MS / 1000

# Rate limiting (login/registro) — string no formato esperado pelo slowapi,
# ex: "5/minute".
LOGIN_RATE_LIMIT: str = os.getenv("LOGIN_RATE_LIMIT", "5/minute")
REGISTER_RATE_LIMIT: str = os.getenv("REGISTER_RATE_LIMIT", "3/minute")
