"""
Monitoramento periódico de dispositivos: ping, atualização no banco e
disparo de alertas (status change / SLA breach) + emissão via WebSocket.
Equivalente a src/services/monitorService.js.
"""
import logging
from datetime import datetime, timezone
from typing import Any

from .. import database
from . import ping_service
from .telegram_service import send_telegram_alert

logger = logging.getLogger("orbnoc.monitor")

# Histórico de latências recentes por dispositivo (em memória), usado para
# calcular jitter e packet loss numa janela deslizante das últimas 10 leituras.
_latency_history: dict[int, list[float | None]] = {}


async def _notify_status_change(user, device: dict, previous_status, new_status, latency):
    if not previous_status or previous_status == new_status:
        return
    if not (user and user["telegram_alerts_enabled"] and user["telegram_bot_token"] and user["telegram_chat_id"]):
        return

    alert_type = "error" if new_status == "offline" else "success"
    extra_info = (
        "📊 *Status:* OFFLINE"
        if new_status == "offline"
        else f"📊 *Status:* ONLINE\n⚡ *Latência:* {latency if latency is not None else 'N/A'}ms"
    )

    await send_telegram_alert(
        user["telegram_bot_token"],
        user["telegram_chat_id"],
        "Host não está respondendo aos testes." if new_status == "offline" else "Host voltou a responder normalmente.",
        alert_type,
        device["name"],
        device["ip"],
        extra_info,
    )


async def _notify_sla_breach(user, device: dict, threshold, latency):
    if not threshold or not latency or latency <= threshold:
        return
    if not (user and user["telegram_alerts_enabled"] and user["telegram_bot_token"] and user["telegram_chat_id"]):
        return

    await send_telegram_alert(
        user["telegram_bot_token"],
        user["telegram_chat_id"],
        "Limite de latência excedido!",
        "warning",
        device["name"],
        device["ip"],
        f"🎯 *Limite:* {threshold}ms\n📈 *Atual:* {latency}ms\n⚠️ *Excedente:* {latency - threshold}ms",
    )


async def check_user_devices(user_id: int) -> list[dict[str, Any]]:
    """Faz ping em todos os dispositivos de um usuário, atualiza o banco e dispara alertas."""
    pool = database.get_pool()
    try:
        async with pool.acquire() as conn:
            sla_rows = await conn.fetch(
                "SELECT device_id, threshold FROM sla_alerts WHERE user_id = $1", user_id
            )
            sla_alerts = {row["device_id"]: row["threshold"] for row in sla_rows}

            device_rows = await conn.fetch(
                "SELECT * FROM user_devices WHERE user_id = $1", user_id
            )
            devices = [dict(row) for row in device_rows]

            user_row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)

        updated_devices = []

        for device in devices:
            try:
                history = _latency_history.setdefault(device["id"], [])

                # ICMP é mais confiável para detectar dispositivos que não expõem
                # portas TCP (celulares, IoT, etc). Se o ICMP falhar (ex: firewall
                # bloqueando ping mas liberando alguma porta), tenta TCP como fallback.
                ping_result = await ping_service.icmp_ping(device["ip"])
                if not ping_result["alive"]:
                    tcp_result = await ping_service.tcp_ping(device["ip"])
                    if tcp_result["alive"]:
                        ping_result = tcp_result

                latency = ping_result["latency"]

                history.append(latency)
                if len(history) > 10:
                    history.pop(0)

                valid_latencies = [l for l in history if l is not None]
                avg_latency = (
                    sum(valid_latencies) / len(valid_latencies) if valid_latencies else None
                )
                jitter = ping_service.calculate_jitter(valid_latencies)
                packet_loss = (
                    (len([l for l in history if l is None]) / len(history)) * 100
                    if history
                    else 0
                )

                previous_status = device["status"]
                new_status = "online" if ping_result["alive"] else "offline"

                async with pool.acquire() as conn:
                    await conn.execute(
                        """
                        UPDATE user_devices SET status = $1, last_check = CURRENT_TIMESTAMP,
                            latency = $2, avg_latency = $3, jitter = $4, packet_loss = $5
                        WHERE id = $6
                        """,
                        new_status,
                        latency,
                        round(avg_latency) if avg_latency is not None else None,
                        jitter,
                        round(packet_loss),
                        device["id"],
                    )

                device["status"] = new_status
                device["latency"] = latency
                device["avg_latency"] = avg_latency
                device["jitter"] = jitter
                device["packet_loss"] = round(packet_loss)
                device["last_check"] = datetime.now(timezone.utc).isoformat()

                await _notify_status_change(user_row, device, previous_status, new_status, latency)
                await _notify_sla_breach(user_row, device, sla_alerts.get(device["id"]), latency)

                updated_devices.append(device)
            except Exception as exc:  # noqa: BLE001
                logger.error("Erro ao verificar %s: %s", device["ip"], exc)
                async with pool.acquire() as conn:
                    await conn.execute(
                        "UPDATE user_devices SET status = $1, last_check = CURRENT_TIMESTAMP, latency = $2 WHERE id = $3",
                        "offline",
                        None,
                        device["id"],
                    )
                device["status"] = "offline"
                device["latency"] = None
                updated_devices.append(device)

        return updated_devices
    except Exception as exc:  # noqa: BLE001
        logger.error("Erro ao verificar dispositivos: %s", exc)
        return []


async def monitor_all_users(sio) -> None:
    """Percorre todos os usuários com dispositivos cadastrados e emite atualizações via socket."""
    pool = database.get_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT DISTINCT user_id FROM user_devices")

        for row in rows:
            user_id = row["user_id"]
            devices = await check_user_devices(user_id)
            devices_json = [_serialize_device(d) for d in devices]

            # Emite apenas para os sockets autenticados como esse usuário.
            for sid, session_user_id in list(sio_user_sessions().items()):
                if session_user_id == user_id:
                    await sio.emit("devices_update", devices_json, to=sid)
    except Exception as exc:  # noqa: BLE001
        logger.error("Erro no monitoramento: %s", exc)


def _serialize_device(device: dict[str, Any]) -> dict[str, Any]:
    serialized = dict(device)
    for key, value in serialized.items():
        if isinstance(value, datetime):
            serialized[key] = value.isoformat()
    return serialized


# Referência preenchida por app.sockets para evitar import circular.
_user_sessions_getter = None


def register_user_sessions_getter(getter) -> None:
    global _user_sessions_getter
    _user_sessions_getter = getter


def sio_user_sessions() -> dict[str, int]:
    if _user_sessions_getter is None:
        return {}
    return _user_sessions_getter()
