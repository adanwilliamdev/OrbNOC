"""
Ponto de entrada do backend OrbNOC em Python.
Equivalente a server.js: sobe o servidor HTTP, o WebSocket (Socket.IO) e o
loop periódico de monitoramento dos dispositivos.
"""
import asyncio
import logging

import socketio
import uvicorn

from app import config, database
from app.app import create_app
from app.services.monitor_service import monitor_all_users
from app.sockets import sio

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("orbnoc.server")

fastapi_app = create_app()

# Monta o servidor Socket.IO por cima da aplicação FastAPI, expondo o
# protocolo em /socket.io — o mesmo path esperado pelo socket.io-client
# usado no frontend.
asgi_app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path="socket.io")

_monitor_task: asyncio.Task | None = None


async def _monitor_loop() -> None:
    interval = config.MONITOR_INTERVAL_SECONDS
    while True:
        try:
            await monitor_all_users(sio)
        except Exception as exc:  # noqa: BLE001
            logger.error("Erro no loop de monitoramento: %s", exc)
        await asyncio.sleep(interval)


@fastapi_app.on_event("startup")
async def on_startup() -> None:
    global _monitor_task
    await database.connect()

    logger.info("\n🚀 Servidor backend rodando em http://localhost:%s", config.PORT)
    logger.info("📡 WebSocket disponível para conexões")
    logger.info("📊 Monitoramento via TCP/ICMP ativo")
    logger.info("✅ CORS configurado para o frontend")
    logger.info("🤖 Telegram alerts ready")
    logger.info("🔧 Diagnostic routes available")
    logger.info("\n📋 Endpoints públicos:")
    logger.info("   GET  /          - Informações da API")
    logger.info("   GET  /health    - Health check")
    logger.info("   GET  /api/status - Status rápido")
    logger.info("   GET  /api       - Lista de endpoints\n")

    # _monitor_loop já executa uma varredura imediata antes do primeiro sleep,
    # e repete a cada MONITOR_INTERVAL_MS a partir daí.
    _monitor_task = asyncio.create_task(_monitor_loop())


@fastapi_app.on_event("shutdown")
async def on_shutdown() -> None:
    if _monitor_task:
        _monitor_task.cancel()
    await database.close()


if __name__ == "__main__":
    uvicorn.run("server:asgi_app", host="0.0.0.0", port=config.PORT, reload=False)
