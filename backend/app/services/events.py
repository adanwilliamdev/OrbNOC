from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Event


async def record_event(
    session: AsyncSession,
    user_id: int,
    device_id: int | None,
    kind: str,
    severity: str,
    message: str,
) -> Event:
    event = Event(
        user_id=user_id, device_id=device_id, kind=kind, severity=severity, message=message
    )
    session.add(event)
    await session.flush()
    return event


async def acknowledge(session: AsyncSession, user_id: int, event_id: int) -> bool:
    event = await session.scalar(
        select(Event).where(Event.id == event_id, Event.user_id == user_id)
    )
    if event is None:
        return False
    if event.acknowledged_at is None:
        event.acknowledged_at = datetime.now(UTC)
    return True


async def acknowledge_all(session: AsyncSession, user_id: int) -> int:
    result = await session.execute(
        update(Event)
        .where(Event.user_id == user_id, Event.acknowledged_at.is_(None))
        .values(acknowledged_at=datetime.now(UTC))
    )
    return result.rowcount or 0
