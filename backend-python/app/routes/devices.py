"""
Rotas de dispositivos. Equivalente a src/routes/devices.routes.js.

A partir deste passo, a rota só valida a requisição e delega para
`DeviceService` — nenhuma query SQL fica aqui (ver
app/repositories/device_repository.py e app/services/device_service.py).
"""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth_dependency import ApiError, get_current_user
from ..db import get_session
from ..services.device_service import DeviceService

router = APIRouter(prefix="/api/devices", tags=["devices"])


class DeviceBody(BaseModel):
    name: str | None = None
    ip: str | None = None
    location: str | None = None


class CheckPortBody(BaseModel):
    port: int | None = None


@router.get("")
async def list_devices(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    try:
        return await DeviceService(session).list_devices(current_user["id"])
    except ApiError:
        raise
    except Exception:  # noqa: BLE001
        raise ApiError(500, "Erro ao buscar dispositivos")


@router.post("")
async def add_device(
    body: DeviceBody,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    try:
        return await DeviceService(session).add_device(
            user_id=current_user["id"], name=body.name, ip=body.ip, location=body.location
        )
    except ApiError:
        raise
    except Exception:  # noqa: BLE001
        raise ApiError(500, "Erro ao adicionar dispositivo")


@router.delete("/{device_id}")
async def delete_device(
    device_id: int,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    try:
        await DeviceService(session).delete_device(user_id=current_user["id"], device_id=device_id)
        return {"success": True}
    except ApiError:
        raise
    except Exception:  # noqa: BLE001
        raise ApiError(500, "Erro ao remover dispositivo")


@router.get("/{device_id}/ping")
async def ping_device(
    device_id: int,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    try:
        return await DeviceService(session).ping_device(
            user_id=current_user["id"], device_id=device_id
        )
    except ApiError:
        raise
    except Exception:  # noqa: BLE001
        raise ApiError(500, "Erro ao realizar ping")


@router.get("/{device_id}/history")
async def device_history(
    device_id: int,
    hours: int = Query(default=24, ge=1, le=720),
    limit: int = Query(default=500, ge=1, le=2000),
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Série temporal de latência/status/packet_loss do dispositivo nas
    últimas `hours` horas — usada para montar gráficos de uptime/latência
    ao longo do tempo (antes o projeto só guardava o último valor lido).
    """
    try:
        return await DeviceService(session).get_history(
            user_id=current_user["id"], device_id=device_id, hours=hours, limit=limit
        )
    except ApiError:
        raise
    except Exception:  # noqa: BLE001
        raise ApiError(500, "Erro ao buscar histórico do dispositivo")


@router.post("/{device_id}/check-port")
async def check_device_port(
    device_id: int,
    body: CheckPortBody,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    try:
        return await DeviceService(session).check_port(
            user_id=current_user["id"], device_id=device_id, port=body.port
        )
    except ApiError:
        raise
    except Exception:  # noqa: BLE001
        raise ApiError(500, "Erro ao verificar porta")
