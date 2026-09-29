from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Device
from app.schemas.devices import DeviceOut
from app.services import realtime


def serialize_devices(devices: list[Device]) -> list[dict]:
    return [DeviceOut.model_validate(d).model_dump(mode="json") for d in devices]


async def owner_snapshot(session: AsyncSession, owner_id: int) -> list[dict]:
    result = await session.scalars(
        select(Device).where(Device.owner_id == owner_id).order_by(Device.name, Device.id)
    )
    return serialize_devices(list(result))


async def push_snapshot(session: AsyncSession, owner_id: int) -> None:
    """Empurra a lista atual aos WebSockets do dono (após criar/editar/remover um dispositivo)."""
    await realtime.publish("devices", owner_id, await owner_snapshot(session, owner_id))
