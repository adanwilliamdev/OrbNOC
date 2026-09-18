"""
Handlers de exceção globais, equivalentes a common/filters/global-exception.filter.ts:
- erros de validação (Pydantic) -> 400 com lista de mensagens em "erros"
- 404 -> {timestamp, status, message}
- 403 -> {timestamp, status, message} com mensagem genérica (não vaza detalhes)
- qualquer outro erro -> 500, mensagem genérica (detalhe completo só no log do servidor)
"""
from __future__ import annotations

import logging
import traceback
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("global_exception_filter")

GENERIC_FORBIDDEN_MESSAGE = "Você não tem permissão para executar esta ação"
GENERIC_SERVER_ERROR_MESSAGE = "Ocorreu um erro inesperado. Tente novamente mais tarde."


def _envelope(status_code: int, message: str) -> dict:
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": status_code,
        "message": message,
    }


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        erros = []
        for err in exc.errors():
            loc = [str(p) for p in err.get("loc", []) if p not in ("body", "query", "path")]
            campo = loc[-1] if loc else ""
            msg = err.get("msg", "Valor inválido")
            erros.append(f"{campo}: {msg}" if campo else msg)
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": status.HTTP_400_BAD_REQUEST,
                "erros": erros,
            },
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        if exc.status_code == status.HTTP_403_FORBIDDEN:
            return JSONResponse(status_code=exc.status_code, content=_envelope(exc.status_code, GENERIC_FORBIDDEN_MESSAGE))

        message = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        return JSONResponse(status_code=exc.status_code, content=_envelope(exc.status_code, message))

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        # Loga o detalhe completo (com stacktrace) apenas no servidor. O cliente
        # recebe uma mensagem genérica para não vazar informações internas.
        logger.error("Erro inesperado ao processar requisição:\n%s", traceback.format_exc())
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_envelope(status.HTTP_500_INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR_MESSAGE),
        )
