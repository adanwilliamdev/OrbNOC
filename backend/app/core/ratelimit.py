"""Contadores com janela fixa. Usa Redis (vale para várias instâncias) e cai para memória se o Redis falhar."""

import logging
import time

from app.core.redis import get_redis

log = logging.getLogger(__name__)
_local: dict[str, tuple[int, float]] = {}


def _local_incr(key: str, window: int) -> int:
    now = time.monotonic()
    count, expires = _local.get(key, (0, 0.0))
    if expires <= now:
        count, expires = 0, now + window
    count += 1
    _local[key] = (count, expires)
    return count


async def incr(key: str, window: int) -> int:
    """Incrementa e devolve o contador atual da janela."""
    try:
        redis = get_redis()
        redis_key = f"orbnoc:rl:{key}"
        await redis.set(redis_key, 0, ex=window, nx=True)
        return int(await redis.incr(redis_key))
    except Exception:
        log.warning("Redis indisponível no rate limit; usando contador local")
        return _local_incr(key, window)


async def get(key: str) -> int:
    try:
        value = await get_redis().get(f"orbnoc:rl:{key}")
        return int(value or 0)
    except Exception:
        count, expires = _local.get(key, (0, 0.0))
        return count if expires > time.monotonic() else 0


async def clear(key: str) -> None:
    _local.pop(key, None)
    try:
        await get_redis().delete(f"orbnoc:rl:{key}")
    except Exception:
        log.warning("Redis indisponível ao limpar rate limit")
