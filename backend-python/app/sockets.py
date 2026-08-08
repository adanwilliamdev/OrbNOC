"""
Servidor Socket.IO (protocolo compatível com socket.io-client usado no
frontend) com autenticação via JWT. Equivalente a src/sockets/index.js.
"""
import logging

import jwt
import socketio

from . import database, security
from .services.telegram_service import send_telegram_alert
from .services.monitor_service import register_user_sessions_getter

logger = logging.getLogger("orbnoc.sockets")

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    ping_interval=25,
    ping_timeout=60,
)

# sid -> user_id, usado para saber para quais sockets emitir devices_update.
_sessions: dict[str, int] = {}
# sid -> dados completos do usuário autenticado (id, username, role)
_users: dict[str, dict] = {}

register_user_sessions_getter(lambda: dict(_sessions))


@sio.event
async def connect(sid, environ, auth):
    token = (auth or {}).get("token")
    if not token:
        raise socketio.exceptions.ConnectionRefusedError("Authentication error")

    try:
        payload = security.decode_token(token)
    except jwt.PyJWTError:
        raise socketio.exceptions.ConnectionRefusedError("Authentication error")

    _sessions[sid] = payload["id"]
    _users[sid] = payload

    logger.info("🔌 Usuário conectado: %s (ID: %s)", payload.get("username"), payload.get("id"))

    pool = database.get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM user_devices WHERE user_id = $1", payload["id"])
    devices = [_row_to_json(row) for row in rows]
    await sio.emit("devices_update", devices, to=sid)


@sio.event
async def send_alert(sid, data):
    user_id = _sessions.get(sid)
    if user_id is None:
        return
    try:
        pool = database.get_pool()
        async with pool.acquire() as conn:
            user = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
        if user and user["telegram_alerts_enabled"] and user["telegram_bot_token"] and user["telegram_chat_id"]:
            await send_telegram_alert(
                user["telegram_bot_token"],
                user["telegram_chat_id"],
                (data or {}).get("message"),
                (data or {}).get("type"),
            )
    except Exception as exc:  # noqa: BLE001
        logger.error("Erro ao enviar alerta: %s", exc)


@sio.event
async def disconnect(sid):
    user = _users.pop(sid, None)
    _sessions.pop(sid, None)
    if user:
        logger.info("🔌 Usuário desconectado: %s", user.get("username"))


def _row_to_json(row) -> dict:
    data = dict(row)
    for key, value in data.items():
        if hasattr(value, "isoformat"):
            data[key] = value.isoformat()
    return data
