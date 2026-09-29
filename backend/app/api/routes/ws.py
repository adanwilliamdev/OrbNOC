from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.api.deps import extract_token, user_from_token
from app.core.config import get_settings
from app.db.session import get_sessionmaker
from app.services.realtime import manager
from app.services.snapshots import owner_snapshot

router = APIRouter()


def origin_allowed(origin: str | None, host: str | None) -> bool:
    """Sem Origin (clientes não-browser) passa; com Origin, precisa ser a própria origem ou uma permitida."""
    if not origin:
        return True
    origin = origin.rstrip("/")
    if origin in get_settings().allowed_origins:
        return True
    return bool(host) and origin.split("://", 1)[-1] == host


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    if not origin_allowed(ws.headers.get("origin"), ws.headers.get("host")):
        await ws.close(code=1008)
        return
    async with get_sessionmaker()() as session:
        user = await user_from_token(session, extract_token(dict(ws.headers), dict(ws.cookies)))
        snapshot = await owner_snapshot(session, user.id) if user else None
    if user is None:
        await ws.close(code=1008)
        return

    await ws.accept()
    manager.connect(user.id, ws)
    try:
        await ws.send_json({"type": "devices", "data": snapshot})
        while True:
            message = await ws.receive_text()
            if message == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user.id, ws)
