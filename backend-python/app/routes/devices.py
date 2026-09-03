"""Rotas de dispositivos. Equivalente a src/routes/devices.routes.js."""
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from .. import database
from ..auth_dependency import ApiError, get_current_user
from ..services import ping_service
from ..services.telegram_service import send_telegram_alert

router = APIRouter(prefix="/api/devices", tags=["devices"])


class DeviceBody(BaseModel):
    name: str | None = None
    ip: str | None = None
    location: str | None = None


class CheckPortBody(BaseModel):
    port: int | None = None


def _serialize(row) -> dict:
    data = dict(row)
    for key, value in data.items():
        if isinstance(value, datetime):
            data[key] = value.isoformat()
    return data


@router.get("")
async def list_devices(current_user: dict = Depends(get_current_user)):
    pool = database.get_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM user_devices WHERE user_id = $1 ORDER BY id", current_user["id"]
            )
        return [_serialize(r) for r in rows]
    except Exception:  # noqa: BLE001
        raise ApiError(500, "Erro ao buscar dispositivos")


@router.post("")
async def add_device(body: DeviceBody, current_user: dict = Depends(get_current_user)):
    if not body.name or not body.ip:
        raise ApiError(400, "Nome e IP são obrigatórios")

    pool = database.get_pool()
    try:
        async with pool.acquire() as conn:
            existing = await conn.fetchrow(
                "SELECT * FROM user_devices WHERE user_id = $1 AND ip = $2",
                current_user["id"],
                body.ip,
            )
            if existing:
                raise ApiError(400, "Dispositivo com este IP já existe")

            row = await conn.fetchrow(
                "INSERT INTO user_devices (user_id, device_id, name, ip, location) "
                "VALUES ($1, $2, $3, $4, $5) RETURNING *",
                current_user["id"],
                int(time.time() * 1000),
                body.name,
                body.ip,
                body.location,
            )
            new_device = _serialize(row)

            user = await conn.fetchrow("SELECT * FROM users WHERE id = $1", current_user["id"])

        if user and user["telegram_alerts_enabled"] and user["telegram_bot_token"] and user["telegram_chat_id"]:
            await send_telegram_alert(
                user["telegram_bot_token"],
                user["telegram_chat_id"],
                "Dispositivo adicionado ao monitoramento.",
                "added",
                body.name,
                body.ip,
                f"📍 *Localização:* {body.location or 'Não informada'}",
            )

        return new_device
    except ApiError:
        raise
    except Exception:  # noqa: BLE001
        raise ApiError(500, "Erro ao adicionar dispositivo")


@router.delete("/{device_id}")
async def delete_device(device_id: int, current_user: dict = Depends(get_current_user)):
    pool = database.get_pool()
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "DELETE FROM user_devices WHERE id = $1 AND user_id = $2 RETURNING *",
                device_id,
                current_user["id"],
            )
            if not row:
                raise ApiError(404, "Dispositivo não encontrado")

            removed_device = dict(row)
            await conn.execute(
                "DELETE FROM sla_alerts WHERE user_id = $1 AND device_id = $2",
                current_user["id"],
                device_id,
            )
            user = await conn.fetchrow("SELECT * FROM users WHERE id = $1", current_user["id"])

        if user and user["telegram_alerts_enabled"] and user["telegram_bot_token"] and user["telegram_chat_id"]:
            await send_telegram_alert(
                user["telegram_bot_token"],
                user["telegram_chat_id"],
                "Dispositivo removido do monitoramento.",
                "removed",
                removed_device["name"],
                removed_device["ip"],
                None,
            )

        return {"success": True}
    except ApiError:
        raise
    except Exception:  # noqa: BLE001
        raise ApiError(500, "Erro ao remover dispositivo")


@router.get("/{device_id}/ping")
async def ping_device(device_id: int, current_user: dict = Depends(get_current_user)):
    pool = database.get_pool()
    try:
        async with pool.acquire() as conn:
            device = await conn.fetchrow(
                "SELECT * FROM user_devices WHERE id = $1 AND user_id = $2",
                device_id,
                current_user["id"],
            )
            if not device:
                raise ApiError(404, "Dispositivo não encontrado")

            ping_result = await ping_service.tcp_ping(device["ip"])

            await conn.execute(
                "UPDATE user_devices SET latency = $1, last_check = CURRENT_TIMESTAMP WHERE id = $2",
                ping_result["latency"],
                device["id"],
            )

        return {
            "id": device["id"],
            "name": device["name"],
            "ip": device["ip"],
            "status": "online" if ping_result["alive"] else "offline",
            "latency_ms": ping_result["latency"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
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
):
    """
    Série temporal de latência/status/packet_loss do dispositivo nas
    últimas `hours` horas — usada para montar gráficos de uptime/latência
    ao longo do tempo (antes o projeto só guardava o último valor lido).
    """
    pool = database.get_pool()
    try:
        async with pool.acquire() as conn:
            device = await conn.fetchrow(
                "SELECT id FROM user_devices WHERE id = $1 AND user_id = $2",
                device_id,
                current_user["id"],
            )
            if not device:
                raise ApiError(404, "Dispositivo não encontrado")

            rows = await conn.fetch(
                """
                SELECT status, latency, packet_loss, jitter, recorded_at
                FROM device_metrics
                WHERE device_id = $1 AND recorded_at > NOW() - ($2 || ' hours')::interval
                ORDER BY recorded_at ASC
                LIMIT $3
                """,
                device_id,
                str(hours),
                limit,
            )

        points = [_serialize(r) for r in rows]
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
    except ApiError:
        raise
    except Exception:  # noqa: BLE001
        raise ApiError(500, "Erro ao buscar histórico do dispositivo")


@router.post("/{device_id}/check-port")
async def check_device_port(
    device_id: int, body: CheckPortBody, current_user: dict = Depends(get_current_user)
):
    if not body.port:
        raise ApiError(400, "Porta é obrigatória")

    pool = database.get_pool()
    try:
        async with pool.acquire() as conn:
            device = await conn.fetchrow(
                "SELECT * FROM user_devices WHERE id = $1 AND user_id = $2",
                device_id,
                current_user["id"],
            )
        if not device:
            raise ApiError(404, "Dispositivo não encontrado")

        result = await ping_service.check_port(device["ip"], int(body.port), timeout_ms=2500)
        response = {"open": result["open"], "port": body.port, "ip": device["ip"]}
        if result["timed_out"]:
            response["error"] = "timeout"
        return response
    except ApiError:
        raise
    except Exception:  # noqa: BLE001
        raise ApiError(404, "Dispositivo não encontrado")
