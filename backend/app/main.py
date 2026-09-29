import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.routes import alerts, auth, devices, diagnostic, health, notifications, reports, users, ws
from app.bootstrap import ensure_admin
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.redis import close_redis
from app.db.session import dispose_engine, get_sessionmaker
from app.services.realtime import manager

log = logging.getLogger("orbnoc")
_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    settings = get_settings()
    if settings.environment == "development" and "dev-only" in settings.jwt_secret:
        log.warning("JWT_SECRET de desenvolvimento em uso. NÃO use isto em produção.")
    async with get_sessionmaker()() as session:
        await ensure_admin(session)
    listener = asyncio.create_task(manager.listen(), name="realtime-listener")
    try:
        yield
    finally:
        listener.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await listener
        await close_redis()
        await dispose_engine()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="OrbNOC API",
        version="4.0.0",
        lifespan=lifespan,
        docs_url="/api/docs" if settings.docs_enabled else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if settings.docs_enabled else None,
    )

    if settings.allowed_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.allowed_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
            allow_headers=["Content-Type", "Authorization"],
        )

    @app.middleware("http")
    async def origin_check(request: Request, call_next):
        """Defesa contra CSRF: requisição que altera dados e traz Origin deve vir de uma origem conhecida."""
        origin = request.headers.get("origin")
        if request.method not in _SAFE_METHODS and origin:
            host = request.headers.get("host", "")
            allowed = origin.rstrip("/") in settings.allowed_origins or origin.split("://", 1)[-1] == host
            if not allowed:
                return JSONResponse({"error": "Origem não permitida"}, status_code=403)
        return await call_next(request)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException):
        return JSONResponse(
            {"error": exc.detail}, status_code=exc.status_code, headers=getattr(exc, "headers", None)
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        first = exc.errors()[0] if exc.errors() else {}
        message = str(first.get("msg", "Dados inválidos")).removeprefix("Value error, ")
        field = ".".join(str(p) for p in first.get("loc", ()) if p not in ("body", "query"))
        return JSONResponse({"error": f"{field}: {message}" if field else message}, status_code=422)

    @app.exception_handler(Exception)
    async def unexpected(_: Request, exc: Exception):
        log.exception("Erro não tratado", exc_info=exc)
        return JSONResponse({"error": "Erro interno do servidor"}, status_code=500)

    app.include_router(health.router)
    api = "/api"
    for module in (auth, users, devices, alerts, notifications, diagnostic, reports):
        app.include_router(module.router, prefix=api)
    app.include_router(ws.router)
    return app


app = create_app()
