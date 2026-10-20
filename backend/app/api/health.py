from datetime import UTC, datetime

from fastapi import APIRouter, Request, Response, status
from redis.exceptions import RedisError
from sqlalchemy import text

router = APIRouter(tags=["health"])

HEARTBEAT_KEY = "orbnoc:worker:heartbeat"
LAST_ROUND_KEY = "orbnoc:worker:last_round"


@router.get("/health/live")
async def live() -> dict:
    return {"status": "alive"}


@router.get("/health")
@router.get("/api/health")
async def health(request: Request, response: Response) -> dict:
    """Verifica de verdade: banco, Redis e a última rodada do monitor."""
    app = request.app
    settings = app.state.settings
    checks: dict[str, dict] = {}

    try:
        async with app.state.sessionmaker() as session:
            await session.execute(text("SELECT 1"))
        checks["database"] = {"ok": True}
    except Exception as exc:  # noqa: BLE001 - qualquer falha de banco = não saudável
        checks["database"] = {"ok": False, "error": type(exc).__name__}

    worker: dict = {"ok": False, "error": "sem heartbeat"}
    try:
        await app.state.redis.ping()
        checks["redis"] = {"ok": True}
        beat = await app.state.redis.get(HEARTBEAT_KEY)
        if beat:
            age = (datetime.now(UTC) - datetime.fromisoformat(beat)).total_seconds()
            worker = {
                "ok": age <= settings.health_worker_max_age_seconds,
                "age_seconds": round(age, 1),
            }
            last = await app.state.redis.get(LAST_ROUND_KEY)
            if last:
                worker["last_round"] = last
    except RedisError as exc:
        checks["redis"] = {"ok": False, "error": type(exc).__name__}
    checks["monitor"] = worker

    healthy = all(c["ok"] for c in checks.values())
    if not healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {
        "status": "healthy" if healthy else "unhealthy",
        "environment": settings.environment,
        "icmp_mode": app.state.prober.icmp_mode,
        "checks": checks,
        "timestamp": datetime.now(UTC).isoformat(),
    }
