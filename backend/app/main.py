import logging
from contextlib import asynccontextmanager
from urllib.parse import urlsplit

import redis.asyncio as aioredis
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api import alerts, auth, devices, diagnostic, health, reports, users, ws
from app.bootstrap import ensure_admin
from app.core.config import Settings, get_settings
from app.db.session import create_engine, create_sessionmaker
from app.services.probes import Prober

UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        engine = create_engine(settings)
        app.state.engine = engine
        app.state.sessionmaker = create_sessionmaker(engine)
        app.state.redis = aioredis.from_url(settings.redis_url, decode_responses=True)
        app.state.prober = Prober(settings.probe_timeout_seconds)
        await app.state.prober.detect()
        await ensure_admin(app.state.sessionmaker, settings)
        yield
        await app.state.redis.aclose()
        await engine.dispose()

    docs = settings.enable_docs
    app = FastAPI(
        title="OrbNOC API",
        version="4.0.0",
        lifespan=lifespan,
        docs_url="/api/docs" if docs else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if docs else None,
    )
    app.state.settings = settings

    @app.middleware("http")
    async def same_origin_only(request: Request, call_next):
        """CSRF: métodos que alteram estado só aceitam Origin da própria aplicação."""
        if request.method in UNSAFE:
            origin = request.headers.get("origin")
            if origin and origin.rstrip("/") not in settings.allowed_origins:
                if urlsplit(origin).netloc != request.headers.get("host"):
                    return JSONResponse({"detail": "Origem não permitida"}, status_code=403)
        return await call_next(request)

    for module in (auth, users, devices, alerts, diagnostic, reports, health, ws):
        app.include_router(module.router)
    return app


def get_app() -> FastAPI:  # uvicorn --factory app.main:get_app
    return create_app()
