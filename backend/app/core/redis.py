"""Cliente Redis compartilhado (pub/sub em tempo real, rate limit, heartbeat do monitor)."""

from redis.asyncio import Redis

from app.core.config import get_settings

_client: Redis | None = None


def get_redis() -> Redis:
    global _client
    if _client is None:
        _client = Redis.from_url(
            get_settings().redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=5,
            health_check_interval=30,
        )
    return _client


def set_redis(client: Redis | None) -> None:
    """Usado nos testes para injetar um Redis falso."""
    global _client
    _client = client


async def close_redis() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
