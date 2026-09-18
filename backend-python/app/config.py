"""
Configuração central da aplicação, lida a partir de variáveis de ambiente.
Equivalente a src/config/env.js da versão Node.js original.
"""
import logging
import os
import secrets
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

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


def _normalize_database_url(url: str) -> tuple[str, bool]:
    """
    Prepara a DATABASE_URL para asyncpg/SQLAlchemy e indica se SSL é exigido.

    - `postgres://` (Heroku, Render antigo) vira `postgresql://`.
    - Parâmetros de libpq como `sslmode` e `channel_binding` (comuns em URLs do
      Neon/Supabase) não existem no asyncpg: o SQLAlchemy os repassa como
      argumentos do `connect()` e quebra com "unexpected keyword argument", e o
      asyncpg os enviaria ao servidor como configuração inválida. Removemos
      esses parâmetros e convertemos `sslmode=require` em ssl ligado.
    """
    if not url:
        return url, False
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    parts = urlsplit(url)
    query = parse_qsl(parts.query, keep_blank_values=True)
    needs_ssl = any(
        k == "sslmode" and v in ("require", "verify-ca", "verify-full") for k, v in query
    )
    kept = [(k, v) for k, v in query if k not in ("sslmode", "channel_binding")]
    cleaned = urlunsplit(parts._replace(query=urlencode(kept)))
    return cleaned, needs_ssl


DATABASE_URL, _URL_REQUIRES_SSL = _normalize_database_url(os.getenv("DATABASE_URL", ""))
DATABASE_SSL: bool = _URL_REQUIRES_SSL or os.getenv("DATABASE_SSL", "false").lower() == "true"

FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
# Lista de origens extras liberadas no CORS, separadas por vírgula
# (útil quando o frontend roda em mais de um domínio/porta).
_extra_origins = os.getenv("EXTRA_CORS_ORIGINS", "")
ALLOWED_ORIGINS: list[str] = [FRONTEND_URL] + [
    o.strip() for o in _extra_origins.split(",") if o.strip()
]

# Regex opcional para liberar vários domínios de uma vez (útil na Vercel, onde
# cada branch/deploy ganha uma URL própria, ex.: projeto-git-main-usuario.vercel.app).
# Exemplo: ^https://(meu-app|meu-app-[a-z0-9-]+-meuusuario)\.vercel\.app$
CORS_ORIGIN_REGEX: str = os.getenv("CORS_ORIGIN_REGEX", "").strip()

MONITOR_INTERVAL_MS: int = int(os.getenv("MONITOR_INTERVAL_MS", "10000"))
MONITOR_INTERVAL_SECONDS: float = MONITOR_INTERVAL_MS / 1000

# Rate limiting (login/registro) — string no formato esperado pelo slowapi,
# ex: "5/minute".
LOGIN_RATE_LIMIT: str = os.getenv("LOGIN_RATE_LIMIT", "5/minute")
REGISTER_RATE_LIMIT: str = os.getenv("REGISTER_RATE_LIMIT", "3/minute")

# Usuário admin criado automaticamente na primeira subida.
# - Em desenvolvimento: se ADMIN_PASSWORD não for definida, usa o demo
#   admin / admin123 (comportamento anterior, usado pelos testes).
# - Em produção: só cria o admin se ADMIN_PASSWORD for definida — nunca
#   subimos um usuário com senha pública e conhecida em um servidor exposto.
ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@orbnoc.local")
ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "")
