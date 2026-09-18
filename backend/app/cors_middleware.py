from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from .config import get_settings
from .cors import compile_patterns, origem_permitida

_ALLOWED_METHODS = "GET, POST, PUT, DELETE, PATCH, OPTIONS"


class WildcardCorsMiddleware(BaseHTTPMiddleware):
    """
    Equivalente ao app.enableCors(...) do main.ts original: permite origens que
    batem com um conjunto de padrões com wildcard (ex: "http://localhost:*"),
    ou requisições sem header Origin (curl, apps mobile).
    """

    def __init__(self, app):
        super().__init__(app)
        settings = get_settings()
        self.patterns = compile_patterns(settings.cors_allowed_origins)

    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin")
        permitido = not origin or origem_permitida(self.patterns, origin)

        if request.method == "OPTIONS":
            response = Response(status_code=204)
        else:
            response = await call_next(request)

        if origin and permitido:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Methods"] = _ALLOWED_METHODS
            requested_headers = request.headers.get("access-control-request-headers")
            response.headers["Access-Control-Allow-Headers"] = requested_headers or "*"

        return response
