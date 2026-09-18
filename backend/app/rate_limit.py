"""
Rate limiting simples, em memória, para os endpoints de autenticação (login e
registro), para dificultar ataques de força bruta / enumeração de e-mails.

Implementação por IP com janela deslizante. É uma proteção de baixo custo para
uma aplicação single-instance; não substitui uma solução distribuída (ex: Redis)
caso a aplicação venha a rodar em múltiplas instâncias atrás de um load balancer.

Equivalente a common/middleware/auth-rate-limit.middleware.ts do backend original.
"""
from __future__ import annotations

import time
from typing import Dict, List

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from .config import get_settings

# Limite defensivo de memória: numa aplicação pequena, isso nunca deveria ser
# atingido organicamente; serve só para não deixar o mapa crescer sem controle
# em caso de um ataque distribuído (muitos IPs diferentes).
_MAX_IPS_RASTREADOS = 10_000

_SENSITIVE_PATHS = ("/api/auth/login", "/api/auth/register")


class AuthRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        settings = get_settings()
        self.janela_ms = settings.rate_limit_window_ms
        self.max_tentativas = settings.rate_limit_max_attempts
        self.tentativas_por_ip: Dict[str, List[float]] = {}

    async def dispatch(self, request: Request, call_next):
        if not self._is_endpoint_sensivel(request):
            return await call_next(request)

        ip = self._extrair_ip(request)
        agora = time.time() * 1000

        if len(self.tentativas_por_ip) > _MAX_IPS_RASTREADOS:
            self.tentativas_por_ip.clear()

        tentativas = self.tentativas_por_ip.get(ip, [])
        dentro_da_janela = [t for t in tentativas if agora - t <= self.janela_ms]

        if len(dentro_da_janela) >= self.max_tentativas:
            self.tentativas_por_ip[ip] = dentro_da_janela
            return JSONResponse(
                status_code=429,
                content={"message": "Muitas tentativas. Aguarde um instante e tente novamente."},
            )

        dentro_da_janela.append(agora)
        self.tentativas_por_ip[ip] = dentro_da_janela
        return await call_next(request)

    @staticmethod
    def _is_endpoint_sensivel(request: Request) -> bool:
        return request.method == "POST" and request.url.path in _SENSITIVE_PATHS

    @staticmethod
    def _extrair_ip(request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"
