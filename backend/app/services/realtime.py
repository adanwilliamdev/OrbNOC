"""Tempo real: o worker publica no Redis; cada instância da API repassa aos WebSockets dos donos."""

import asyncio
import contextlib
import json
import logging
from collections import defaultdict

from fastapi import WebSocket

from app.core.redis import get_redis

log = logging.getLogger(__name__)
CHANNEL = "orbnoc:updates"


async def publish(kind: str, owner_id: int, payload: object) -> None:
    """Best effort: sem Redis o dashboard continua funcionando por polling."""
    try:
        await get_redis().publish(CHANNEL, json.dumps({"type": kind, "owner_id": owner_id, "data": payload}))
    except Exception:
        log.warning("Não foi possível publicar atualização em tempo real (Redis indisponível?)")


class ConnectionManager:
    def __init__(self) -> None:
        self._sockets: dict[int, set[WebSocket]] = defaultdict(set)

    def connect(self, user_id: int, ws: WebSocket) -> None:
        self._sockets[user_id].add(ws)

    def disconnect(self, user_id: int, ws: WebSocket) -> None:
        self._sockets[user_id].discard(ws)
        if not self._sockets[user_id]:
            self._sockets.pop(user_id, None)

    @property
    def connection_count(self) -> int:
        return sum(len(s) for s in self._sockets.values())

    async def send_to_user(self, user_id: int, message: dict) -> None:
        for ws in list(self._sockets.get(user_id, ())):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(user_id, ws)

    async def listen(self) -> None:
        """Laço de fundo da API: reconecta com backoff se o Redis cair."""
        delay = 1.0
        while True:
            try:
                pubsub = get_redis().pubsub()
                await pubsub.subscribe(CHANNEL)
                delay = 1.0
                async for item in pubsub.listen():
                    if item.get("type") != "message":
                        continue
                    try:
                        msg = json.loads(item["data"])
                        await self.send_to_user(
                            int(msg["owner_id"]), {"type": msg["type"], "data": msg["data"]}
                        )
                    except (ValueError, KeyError, TypeError):
                        log.warning("Mensagem inválida no canal de tempo real")
            except asyncio.CancelledError:
                with contextlib.suppress(Exception):
                    await pubsub.aclose()
                raise
            except Exception:
                log.warning("Canal de tempo real desconectado; nova tentativa em %.0fs", delay)
                await asyncio.sleep(delay)
                delay = min(delay * 2, 30)


manager = ConnectionManager()
