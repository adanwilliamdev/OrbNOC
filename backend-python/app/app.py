"""
Criação e configuração da aplicação FastAPI.
Equivalente a src/app.js (CORS, logger de requests, montagem das rotas).
"""
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .auth_dependency import ApiError
from .routes import alerts, auth, devices, diagnostic, public

logger = logging.getLogger("orbnoc.request")


def create_app() -> FastAPI:
    app = FastAPI(title="OrbNOC API", version="1.0.0")

    # origin: true no Express reflete qualquer origem enviada pelo browser.
    # allow_origin_regex reproduz esse comportamento mantendo credentials=True.
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_methods=["GET", "POST", "DELETE", "PUT", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
        allow_credentials=True,
    )

    @app.middleware("http")
    async def request_logger(request: Request, call_next):
        logger.info("%s %s", request.method, request.url.path)
        return await call_next(request)

    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError):
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})

    app.include_router(public.router)
    app.include_router(auth.router)
    app.include_router(devices.router)
    app.include_router(alerts.router)
    app.include_router(diagnostic.router)

    return app
