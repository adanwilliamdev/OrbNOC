"""
Regra de negócio de dispositivos, extraída de `app/routes/devices.py`.

A rota (routes/devices.py) fica responsável só por: receber a requisição,
validar o corpo com Pydantic e chamar um método daqui. Erros de negócio
(dispositivo não encontrado, IP duplicado, etc.) são sinalizados levantando
`ApiError`, exatamente como a rota fazia antes — o comportamento HTTP não
muda, só a organização do código.
"""
import time
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from ..auth_dependency import ApiError
from ..repositories.device_repository import DeviceRepository
from ..repositories.user_repository import UserRepository
from . import ping_service
from .telegram_service import send_telegram_alert


def _serialize(model) -> dict:
    data = {c.name: getattr(model, c.name) for c in model.__table__.columns}
    for key, value in data.items():
        if isinstance(value, datetime):
            data[key] = value.isoformat()
    return data


class DeviceService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.devices = DeviceRepository(session)
        self.users = UserRepository(session)

    async def list_devices(self, user_id: int) -> list[dict]:
        devices = await self.devices.list_for_user(user_id)
        return [_serialize(d) for d in devices]

    async def add_device(
        self, *, user_id: int, name: str | None, ip: str | None, location: str | None
    ) -> dict:
        if not name or not ip:
            raise ApiError(400, "Nome e IP são obrigatórios")

        existing = await self.devices.get_by_ip(user_id, ip)
        if existing:
            raise ApiError(400, "Dispositivo com este IP já existe")

        device = await self.devices.create(
            user_id=user_id,
            device_id=int(time.time() * 1000),
            name=name,
            ip=ip,
            location=location,
        )
        new_device = _serialize(device)

        await self.session.commit()

        user = await self.users.get_by_id(user_id)
        if user and user.telegram_alerts_enabled and user.telegram_bot_token and user.telegram_chat_id:
            await send_telegram_alert(
                user.telegram_bot_token,
                user.telegram_chat_id,
                "Dispositivo adicionado ao monitoramento.",
                "added",
                name,
                ip,
                f"📍 *Localização:* {location or 'Não informada'}",
            )

        return new_device

    async def delete_device(self, *, user_id: int, device_id: int) -> None:
        device = await self.devices.get_by_id_for_user(device_id, user_id)
        if not device:
            raise ApiError(404, "Dispositivo não encontrado")

        removed_name, removed_ip = device.name, device.ip

        await self.devices.delete(device)
        await self.devices.delete_sla_alert(user_id, device_id)
        await self.session.commit()

        user = await self.users.get_by_id(user_id)
        if user and user.telegram_alerts_enabled and user.telegram_bot_token and user.telegram_chat_id:
            await send_telegram_alert(
                user.telegram_bot_token,
                user.telegram_chat_id,
                "Dispositivo removido do monitoramento.",
                "removed",
                removed_name,
                removed_ip,
                None,
            )

    async def ping_device(self, *, user_id: int, device_id: int) -> dict:
        device = await self.devices.get_by_id_for_user(device_id, user_id)
        if not device:
            raise ApiError(404, "Dispositivo não encontrado")

        ping_result = await ping_service.tcp_ping(device.ip)
        await self.devices.update_ping_result(device, ping_result["latency"])
        await self.session.commit()

        return {
            "id": device.id,
            "name": device.name,
            "ip": device.ip,
            "status": "online" if ping_result["alive"] else "offline",
            "latency_ms": ping_result["latency"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    async def get_history(
        self, *, user_id: int, device_id: int, hours: int, limit: int
    ) -> dict:
        device = await self.devices.get_by_id_for_user(device_id, user_id)
        if not device:
            raise ApiError(404, "Dispositivo não encontrado")

        metrics = await self.devices.metrics_since(device_id, hours, limit)
        points = [_serialize(m) for m in metrics]

        online_points = [p for p in points if p["status"] == "online"]
        uptime_pct = round((len(online_points) / len(points)) * 100, 2) if points else None
        latencies = [p["latency"] for p in points if p["latency"] is not None]
        avg_latency = round(sum(latencies) / len(latencies), 1) if latencies else None

        return {
            "device_id": device_id,
            "hours": hours,
            "points": points,
            "summary": {
                "uptime_pct": uptime_pct,
                "avg_latency": avg_latency,
                "sample_count": len(points),
            },
        }

    async def check_port(self, *, user_id: int, device_id: int, port: int | None) -> dict:
        if not port:
            raise ApiError(400, "Porta é obrigatória")

        device = await self.devices.get_by_id_for_user(device_id, user_id)
        if not device:
            raise ApiError(404, "Dispositivo não encontrado")

        result = await ping_service.check_port(device.ip, int(port), timeout_ms=2500)
        response = {"open": result["open"], "port": port, "ip": device.ip}
        if result["timed_out"]:
            response["error"] = "timeout"
        return response
