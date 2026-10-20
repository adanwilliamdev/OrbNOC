"""Worker → API via Redis pub/sub. Um canal por usuário."""

import json
import logging

from redis.asyncio import Redis
from redis.exceptions import RedisError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import DeviceOut, EventOut
from app.db.models import Device, Event

log = logging.getLogger(__name__)


def channel(user_id: int) -> str:
    return f"orbnoc:user:{user_id}"


async def devices_payload(session: AsyncSession, user_id: int) -> list[dict]:
    devices = (
        await session.scalars(select(Device).where(Device.user_id == user_id).order_by(Device.id))
    ).all()
    return [DeviceOut.model_validate(d).model_dump(mode="json") for d in devices]


async def publish(redis: Redis, user_id: int, message: dict) -> None:
    try:
        await redis.publish(channel(user_id), json.dumps(message))
    except RedisError:
        log.warning("Falha ao publicar no Redis (user %s)", user_id)


async def publish_devices(redis: Redis, session: AsyncSession, user_id: int) -> None:
    await publish(
        redis,
        user_id,
        {"type": "devices_update", "devices": await devices_payload(session, user_id)},
    )


async def publish_event(redis: Redis, event: Event) -> None:
    await publish(
        redis,
        event.user_id,
        {"type": "event", "event": EventOut.model_validate(event).model_dump(mode="json")},
    )
