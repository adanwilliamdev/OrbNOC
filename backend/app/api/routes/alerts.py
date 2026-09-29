from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models import Event, User
from app.db.session import get_session
from app.schemas.events import EventOut

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[EventOut])
async def list_alerts(
    limit: int = Query(50, ge=1, le=200),
    unacknowledged: bool = False,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    query = select(Event).where(Event.owner_id == user.id)
    if unacknowledged:
        query = query.where(Event.acknowledged_at.is_(None))
    return list(await session.scalars(query.order_by(Event.created_at.desc(), Event.id.desc()).limit(limit)))


@router.post("/ack-all")
async def acknowledge_all(
    user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
):
    result = await session.execute(
        update(Event)
        .where(Event.owner_id == user.id, Event.acknowledged_at.is_(None))
        .values(acknowledged_at=datetime.now(UTC))
    )
    await session.commit()
    return {"success": True, "acknowledged": result.rowcount}


@router.post("/{event_id}/ack", response_model=EventOut)
async def acknowledge(
    event_id: int, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
):
    event = await session.scalar(select(Event).where(Event.id == event_id, Event.owner_id == user.id))
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alerta não encontrado")
    if event.acknowledged_at is None:
        event.acknowledged_at = datetime.now(UTC)
        await session.commit()
    return event


@router.delete("")
async def clear_alerts(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    result = await session.execute(delete(Event).where(Event.owner_id == user.id))
    await session.commit()
    return {"success": True, "deleted": result.rowcount}
