"""Rate limit em Redis. Se o Redis cair, deixa passar (disponibilidade > bloqueio)."""

import logging

from redis.asyncio import Redis
from redis.exceptions import RedisError

log = logging.getLogger(__name__)


async def is_blocked(redis: Redis, key: str, limit: int) -> bool:
    try:
        value = await redis.get(key)
    except RedisError:
        log.warning("Redis indisponível no rate limit; liberando")
        return False
    return value is not None and int(value) >= limit


async def hit(redis: Redis, key: str, window_seconds: int) -> int:
    """Conta uma ocorrência na janela fixa e devolve o total."""
    try:
        async with redis.pipeline(transaction=True) as pipe:
            pipe.incr(key)
            pipe.expire(key, window_seconds, nx=True)
            count, _ = await pipe.execute()
        return int(count)
    except RedisError:
        log.warning("Redis indisponível no rate limit; liberando")
        return 0


async def clear(redis: Redis, key: str) -> None:
    try:
        await redis.delete(key)
    except RedisError:
        pass
