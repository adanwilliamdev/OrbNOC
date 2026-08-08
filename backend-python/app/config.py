"""
Configuração central da aplicação, lida a partir de variáveis de ambiente.
Equivalente a src/config/env.js da versão Node.js original.
"""
import os

from dotenv import load_dotenv

load_dotenv()

PORT: int = int(os.getenv("PORT", "3001"))
ENVIRONMENT: str = os.getenv("NODE_ENV", os.getenv("ENVIRONMENT", "development"))
JWT_SECRET: str = os.getenv("JWT_SECRET", "orbnoc_secret_key_2024_change_this_in_production")
JWT_ALGORITHM: str = "HS256"
JWT_EXPIRES_HOURS: int = 24

DATABASE_URL: str = os.getenv("DATABASE_URL", "")
DATABASE_SSL: bool = os.getenv("DATABASE_SSL", "false").lower() == "true"

FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")

MONITOR_INTERVAL_MS: int = int(os.getenv("MONITOR_INTERVAL_MS", "10000"))
MONITOR_INTERVAL_SECONDS: float = MONITOR_INTERVAL_MS / 1000
