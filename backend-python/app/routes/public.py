"""Rotas públicas sem autenticação. Equivalente a src/routes/public.routes.js."""
import time
from datetime import datetime, timezone

import psutil  # type: ignore
from fastapi import APIRouter

router = APIRouter(tags=["public"])

_start_time = time.monotonic()


def _uptime_seconds() -> float:
    return time.monotonic() - _start_time


@router.get("/")
async def root():
    return {
        "name": "🚀 OrbNOC API",
        "version": "1.0.0",
        "status": "operational",
        "description": "Enterprise Network Operations Center Platform",
        "endpoints": {
            "health": "/health",
            "api": "/api",
            "auth": "/api/auth",
            "devices": "/api/devices",
            "alerts": "/api/alerts",
            "diagnostic": "/api/diagnostic",
        },
        "documentation": "https://github.com/adanwilliamdev/OrbNOC",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime": _uptime_seconds(),
    }


@router.get("/health")
async def health():
    try:
        process = psutil.Process()
        mem = process.memory_info()
        memory = {
            "rss": f"{round(mem.rss / 1024 / 1024)} MB",
            "heapTotal": f"{round(mem.vms / 1024 / 1024)} MB",
            "heapUsed": f"{round(mem.rss / 1024 / 1024)} MB",
        }
    except Exception:  # noqa: BLE001
        memory = {"rss": "n/a", "heapTotal": "n/a", "heapUsed": "n/a"}

    return {
        "status": "healthy",
        "uptime": _uptime_seconds(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "memory": memory,
        "environment": "production",
        "database": "connected",
        "websocket": "active",
    }


@router.get("/api/status")
async def api_status():
    return {
        "status": "ok",
        "service": "OrbNOC Backend",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/api")
async def api_index():
    return {
        "message": "OrbNOC API v1.0.0",
        "endpoints": {
            "auth": {
                "register": "POST /api/auth/register",
                "login": "POST /api/auth/login",
                "logout": "POST /api/auth/logout",
            },
            "devices": {
                "list": "GET /api/devices",
                "add": "POST /api/devices",
                "remove": "DELETE /api/devices/:id",
                "ping": "GET /api/devices/:id/ping",
                "checkPort": "POST /api/devices/:id/check-port",
            },
            "alerts": {
                "email": "GET/POST /api/alerts/email",
                "telegram": "GET/POST /api/alerts/telegram",
                "notify": "POST /api/alerts/notify",
                "sla": "POST /api/alerts/sla/configure",
                "testTelegram": "POST /api/alerts/test-telegram",
                "testHost": "POST /api/alerts/test-host",
            },
            "diagnostic": {
                "ping": "POST /api/diagnostic/ping",
                "traceroute": "POST /api/diagnostic/traceroute",
                "portCheck": "POST /api/diagnostic/port-check",
                "dnsLookup": "POST /api/diagnostic/dns-lookup",
                "fullDiagnostic": "POST /api/diagnostic/full-diagnostic",
            },
            "public": {
                "health": "GET /health",
                "status": "GET /api/status",
                "root": "GET /",
            },
        },
    }
