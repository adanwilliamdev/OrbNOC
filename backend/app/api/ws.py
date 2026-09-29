import asyncio
import contextlib
import logging
import time
from urllib.parse import urlsplit

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from redis.exceptions import RedisError

from app.api.deps import user_from_token
from app.core.security import decode_session_token
from app.services import realtime

log = logging.getLogger(__name__)
router = APIRouter()

PING_INTERVAL = 25


def origin_allowed(ws: WebSocket) -> bool:
    origin = ws.headers.get("origin")
    if not origin:
        return True  # cliente não-navegador
    settings = ws.app.state.settings
    if origin.rstrip("/") in settings.allowed_origins:
        return True
    return urlsplit(origin).netloc == ws.headers.get("host")


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    settings = ws.app.state.settings
    if not origin_allowed(ws):
        await ws.close(code=4403)
        return
    token = ws.cookies.get(settings.cookie_name)
    async with ws.app.state.sessionmaker() as session:
        user = await user_from_token(session, token, settings)
        if user is None:
            await ws.close(code=4401)
            return
        snapshot = await realtime.devices_payload(session, user.id)
    expires_at = (decode_session_token(token, settings) or {}).get("exp", time.time())

    pubsub = ws.app.state.redis.pubsub()
    try:
        await pubsub.subscribe(realtime.channel(user.id))
    except RedisError:
        await ws.close(code=1011)
        return
    await ws.accept()
    await ws.send_json({"type": "devices_update", "devices": snapshot})

    async def forward() -> None:
        async for message in pubsub.listen():
            if message["type"] == "message":
                await ws.send_text(message["data"])

    async def keepalive() -> None:
        while True:
            await asyncio.sleep(PING_INTERVAL)
            await ws.send_json({"type": "ping"})

    async def receive() -> None:
        while True:
            await ws.receive_text()  # ignora conteúdo; detecta desconexão

    tasks = [asyncio.create_task(c()) for c in (forward, keepalive, receive)]
    try:
        await asyncio.wait(
            tasks, timeout=max(1, expires_at - time.time()), return_when=asyncio.FIRST_COMPLETED
        )
    except WebSocketDisconnect:
        pass
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        with contextlib.suppress(Exception):
            await pubsub.unsubscribe()
            await pubsub.aclose()
        with contextlib.suppress(Exception):
            await ws.close(code=4401)
