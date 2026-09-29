from datetime import UTC, datetime

from fastapi import APIRouter, Response, status
from sqlalchemy import text

from app.core.config import get_settings
from app.core.redis import get_redis
from app.db.session import get_engine
from app.services import heartbeat

router = APIRouter(tags=["health"])


@router.get("/health")
async def liveness():
    """O processo está de pé (usado pelo healthcheck do container)."""
    return {"status": "ok"}


@router.get("/health/ready")
async def readiness(response: Response):
    """Verifica de verdade as dependências. 503 só se o banco falhar."""
    checks: dict[str, dict] = {}
    try:
        async with get_engine().connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = {"status": "ok"}
    except Exception:
        checks["database"] = {"status": "error"}

    try:
        await get_redis().ping()
        checks["redis"] = {"status": "ok"}
    except Exception:
        checks["redis"] = {"status": "error"}

    monitor: dict = {"status": "unknown"}
    if checks["redis"]["status"] == "ok":
        beat = await heartbeat.read()
        if beat:
            age = (datetime.now(UTC) - datetime.fromisoformat(beat["at"])).total_seconds()
            stale = age > max(30.0, get_settings().monitor_interval_seconds * 4)
            monitor = {
                "status": "stale" if stale else "ok",
                "last_cycle_seconds_ago": round(age, 1),
                **{k: beat[k] for k in ("devices", "online", "offline") if k in beat},
            }
        else:
            monitor = {"status": "no_heartbeat"}
    checks["monitor"] = monitor

    if checks["database"]["status"] != "ok":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        overall = "error"
    else:
        overall = "ok" if all(c["status"] == "ok" for c in checks.values()) else "degraded"
    return {"status": overall, "checks": checks}
