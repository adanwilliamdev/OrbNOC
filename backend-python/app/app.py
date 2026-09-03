"""
Criação e configuração da aplicação FastAPI.
Equivalente a src/app.js (CORS, logger de requests, montagem das rotas).
"""
import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from . import config
from .auth_dependency import ApiError
from .rate_limit import limiter
from .routes import admin, alerts, auth, devices, diagnostic, public

logger = logging.getLogger("orbnoc.request")


def create_app() -> FastAPI:
    app = FastAPI(title="OrbNOC API", version="1.0.0")

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # CORS restrito à(s) origem(ns) configurada(s) em FRONTEND_URL /
    # EXTRA_CORS_ORIGINS. Antes o projeto refletia QUALQUER origem
    # (allow_origin_regex=".*") junto com allow_credentials=True, o que
    # permite que qualquer site de terceiros faça requisições autenticadas
    # em nome do usuário logado (CSRF-like via CORS mal configurado).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.ALLOWED_ORIGINS,
        allow_methods=["GET", "POST", "DELETE", "PUT", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
        allow_credentials=True,
    )

    @app.middleware("http")
    async def request_logger(request: Request, call_next):
        request_id = str(uuid.uuid4())[:8]
        start = time.monotonic()
        response = await call_next(request)
        duration_ms = round((time.monotonic() - start) * 1000)
        logger.info(
            "[%s] %s %s -> %s (%sms)",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        response.headers["X-Request-ID"] = request_id
        return response

    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError):
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})

    app.include_router(public.router)
    app.include_router(auth.router)
    app.include_router(devices.router)
    app.include_router(alerts.router)
    app.include_router(diagnostic.router)
    app.include_router(admin.router)

    return app
