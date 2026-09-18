"""
Pool de conexões PostgreSQL (asyncpg), criação de tabelas e seed do usuário
demo. Equivalente a src/config/database.js da versão Node.js original.
"""
import asyncio
import logging

import asyncpg
import bcrypt

from . import config

logger = logging.getLogger("orbnoc.database")

TABLE_DEFINITIONS = [
    """
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        telegram_alerts_enabled BOOLEAN DEFAULT FALSE,
        telegram_bot_token TEXT,
        telegram_chat_id VARCHAR(100),
        email_alerts_enabled BOOLEAN DEFAULT FALSE,
        alert_email_target VARCHAR(255),
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS user_devices (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        device_id BIGINT NOT NULL,
        name VARCHAR(255) NOT NULL,
        ip VARCHAR(45) NOT NULL,
        location VARCHAR(255),
        status VARCHAR(20) DEFAULT 'offline',
        latency INTEGER,
        avg_latency INTEGER,
        min_latency INTEGER,
        max_latency INTEGER,
        jitter INTEGER DEFAULT 0,
        packet_loss INTEGER DEFAULT 0,
        last_check TIMESTAMP,
        last_ping_stats TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS access_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(50),
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS sla_alerts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        device_id INTEGER NOT NULL,
        threshold INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, device_id)
    )
    """,
    """
    -- Série temporal das leituras de ping. Antes o projeto só guardava o
    -- último valor em user_devices, então não dava pra montar um gráfico
    -- de uptime/latência histórico — apenas o estado "agora".
    CREATE TABLE IF NOT EXISTS device_metrics (
        id BIGSERIAL PRIMARY KEY,
        device_id INTEGER NOT NULL REFERENCES user_devices(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL,
        latency INTEGER,
        packet_loss INTEGER,
        jitter INTEGER,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_device_metrics_device_time
        ON device_metrics (device_id, recorded_at DESC)
    """,
]

pool: asyncpg.Pool | None = None


async def create_tables(conn_pool: asyncpg.Pool) -> None:
    async with conn_pool.acquire() as conn:
        for statement in TABLE_DEFINITIONS:
            try:
                await conn.execute(statement)
                logger.info("✅ Tabela verificada/criada com sucesso")
            except Exception as exc:  # noqa: BLE001
                logger.error("❌ Erro ao criar tabela: %s", exc)
        await seed_demo_admin(conn)


async def seed_demo_admin(conn: asyncpg.Connection) -> None:
    try:
        existing = await conn.fetchrow("SELECT id FROM users WHERE username = $1", "admin")
        if existing:
            return
        hashed = bcrypt.hashpw(b"admin123", bcrypt.gensalt(10)).decode()
        await conn.execute(
            "INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)",
            "admin",
            "admin@orbnoc.local",
            hashed,
            "admin",
        )
        logger.info("✅ Usuário demo criado: admin / admin123")
    except Exception as exc:  # noqa: BLE001
        logger.error("❌ Erro ao criar usuário demo: %s", exc)


async def connect(retries: int = 10, delay_seconds: float = 3.0) -> asyncpg.Pool:
    """Conecta ao PostgreSQL com retentativas, cria tabelas e faz o seed do admin."""
    global pool
    attempt = retries
    while True:
        try:
            ssl_option = "require" if config.DATABASE_SSL else None
            pool = await asyncpg.create_pool(
                dsn=config.DATABASE_URL,
                ssl=ssl_option,
                min_size=1,
                max_size=10,
            )
            logger.info("✅ Conectado ao PostgreSQL com sucesso!")
            await create_tables(pool)
            return pool
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "❌ Erro ao conectar ao PostgreSQL (tentativas restantes: %s): %s",
                attempt,
                exc,
            )
            if attempt <= 0:
                logger.error("❌ Não foi possível conectar ao PostgreSQL após várias tentativas.")
                raise
            attempt -= 1
            await asyncio.sleep(delay_seconds)


def get_pool() -> asyncpg.Pool:
    if pool is None:
        raise RuntimeError("Pool de conexões ainda não foi inicializado")
    return pool


async def close() -> None:
    global pool
    if pool is not None:
        await pool.close()
        pool = None
