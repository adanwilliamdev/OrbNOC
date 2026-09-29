"""Batimento do worker: permite ao /health/ready saber se o monitoramento está vivo."""

import json
from datetime import UTC, datetime

from app.core.redis import get_redis

KEY = "orbnoc:monitor:heartbeat"
LOCK_KEY = "orbnoc:monitor:lock"


async def write(info: dict) -> None:
    payload = {**info, "at": datetime.now(UTC).isoformat()}
    await get_redis().set(KEY, json.dumps(payload), ex=300)


async def read() -> dict | None:
    raw = await get_redis().get(KEY)
    return json.loads(raw) if raw else None
