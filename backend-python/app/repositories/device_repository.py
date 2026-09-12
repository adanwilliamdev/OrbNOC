"""
Repositório de dispositivos. Concentra todo o SQL relacionado a
`user_devices` e `device_metrics` que antes estava espalhado em
`app/routes/devices.py` usando asyncpg cru.

Nenhum método aqui decide regra de negócio (isso é papel do service) —
cada método faz uma operação de dados e retorna o model ou `None`.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import DeviceMetric, SlaAlert, UserDevice


class DeviceRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_for_user(self, user_id: int) -> list[UserDevice]:
        result = await self.session.execute(
            select(UserDevice).where(UserDevice.user_id == user_id).order_by(UserDevice.id)
        )
        return list(result.scalars().all())

    async def get_by_ip(self, user_id: int, ip: str) -> UserDevice | None:
        result = await self.session.execute(
            select(UserDevice).where(UserDevice.user_id == user_id, UserDevice.ip == ip)
        )
        return result.scalar_one_or_none()

    async def get_by_id_for_user(self, device_id: int, user_id: int) -> UserDevice | None:
        result = await self.session.execute(
            select(UserDevice).where(UserDevice.id == device_id, UserDevice.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def create(
        self, *, user_id: int, device_id: int, name: str, ip: str, location: str | None
    ) -> UserDevice:
        device = UserDevice(
            user_id=user_id, device_id=device_id, name=name, ip=ip, location=location
        )
        self.session.add(device)
        await self.session.flush()
        await self.session.refresh(device)
        return device

    async def delete(self, device: UserDevice) -> None:
        # device_metrics é removido automaticamente pelo ON DELETE CASCADE
        # da própria coluna (definido na migration), igual ao comportamento
        # original — nenhuma limpeza manual é necessária aqui.
        await self.session.delete(device)
        await self.session.flush()

    async def delete_sla_alert(self, user_id: int, device_id: int) -> None:
        """Espelha o `DELETE FROM sla_alerts WHERE user_id = $1 AND device_id = $2`
        que rodava junto da remoção do dispositivo em devices.py."""
        await self.session.execute(
            delete(SlaAlert).where(SlaAlert.user_id == user_id, SlaAlert.device_id == device_id)
        )

    async def update_ping_result(self, device: UserDevice, latency: int | None) -> None:
        device.latency = latency
        device.last_check = datetime.now(timezone.utc)
        await self.session.flush()

    async def metrics_since(
        self, device_id: int, hours: int, limit: int
    ) -> list[DeviceMetric]:
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        result = await self.session.execute(
            select(DeviceMetric)
            .where(DeviceMetric.device_id == device_id, DeviceMetric.recorded_at > since)
            .order_by(DeviceMetric.recorded_at.asc())
            .limit(limit)
        )
        return list(result.scalars().all())
