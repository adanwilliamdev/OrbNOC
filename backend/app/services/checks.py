"""Verificações de disponibilidade: ICMP (com fallback TCP), TCP e HTTP(S).

O ICMP tenta primeiro socket não privilegiado (não exige root), depois raw socket (exige
CAP_NET_RAW) e, se o ambiente bloquear ambos (comum em PaaS), cai para tentativas TCP.
Nesse fallback, "conexão recusada" conta como host VIVO (recebeu RST); o sistema antigo só
considerava vivo quem aceitava conexão, e marcava como offline equipamentos sem portas abertas.
"""

import asyncio
import contextlib
import logging
import time
from dataclasses import dataclass
from typing import Literal

import httpx
from icmplib import ICMPLibError, SocketPermissionError, async_ping

from app.core.config import get_settings
from app.core.netguard import TargetError, resolve_target

log = logging.getLogger(__name__)

FALLBACK_PORTS = (443, 80, 22, 53, 8080)
_ICMP_RETRY_SECONDS = 300

TcpState = Literal["open", "refused", "timeout", "error"]


@dataclass(frozen=True)
class CheckResult:
    ok: bool
    latency_ms: float | None = None
    error: str | None = None
    method: str = "icmp"


class _IcmpUnavailableError(Exception):
    pass


_icmp_unavailable_until = 0.0
_icmp_privileged_hint: bool | None = None


async def _icmp_probe(address: str, timeout: float, count: int = 1, interval: float = 0.2):
    """Retorna o objeto Host do icmplib. Levanta _IcmpUnavailableError se não há permissão."""
    global _icmp_unavailable_until, _icmp_privileged_hint
    if time.monotonic() < _icmp_unavailable_until:
        raise _IcmpUnavailableError
    modes = [_icmp_privileged_hint] if _icmp_privileged_hint is not None else [False, True]
    for privileged in modes:
        try:
            host = await async_ping(
                address, count=count, interval=interval, timeout=timeout, privileged=privileged
            )
            _icmp_privileged_hint = privileged
            return host
        except (SocketPermissionError, PermissionError, OSError) as exc:
            if isinstance(exc, ICMPLibError) and not isinstance(exc, SocketPermissionError):
                raise
            continue
    _icmp_unavailable_until = time.monotonic() + _ICMP_RETRY_SECONDS
    _icmp_privileged_hint = None
    log.warning("ICMP indisponível neste ambiente; usando verificação TCP por %ss", _ICMP_RETRY_SECONDS)
    raise _IcmpUnavailableError


async def tcp_probe(address: str, port: int, timeout: float) -> tuple[TcpState, float | None]:
    start = time.perf_counter()
    try:
        _, writer = await asyncio.wait_for(asyncio.open_connection(address, port), timeout)
    except ConnectionRefusedError:
        return "refused", (time.perf_counter() - start) * 1000
    except TimeoutError:
        return "timeout", None
    except OSError:
        return "error", None
    latency = (time.perf_counter() - start) * 1000
    writer.close()
    with contextlib.suppress(OSError):
        await writer.wait_closed()
    return "open", latency


async def _tcp_alive(address: str, timeout: float) -> CheckResult:
    """Fallback do ICMP: vivo se qualquer porta comum aceitar OU recusar a conexão."""
    results = await asyncio.gather(*(tcp_probe(address, p, timeout) for p in FALLBACK_PORTS))
    alive = [lat for state, lat in results if state in ("open", "refused") and lat is not None]
    if alive:
        return CheckResult(True, round(min(alive), 2), method="tcp-fallback")
    return CheckResult(
        False, error="sem resposta (ICMP indisponível; TCP sem retorno)", method="tcp-fallback"
    )


async def check_icmp(address: str, timeout: float) -> CheckResult:
    if get_settings().icmp_mode == "tcp":
        return await _tcp_alive(address, timeout)
    try:
        host = await _icmp_probe(address, timeout)
    except _IcmpUnavailableError:
        if get_settings().icmp_mode == "icmp":
            return CheckResult(False, error="ICMP indisponível (ICMP_MODE=icmp)", method="icmp")
        return await _tcp_alive(address, timeout)
    except ICMPLibError as exc:
        return CheckResult(False, error=str(exc), method="icmp")
    if host.is_alive:
        return CheckResult(True, round(host.avg_rtt, 2), method="icmp")
    return CheckResult(False, error="sem resposta ao ping", method="icmp")


async def check_tcp(address: str, port: int, timeout: float) -> CheckResult:
    state, latency = await tcp_probe(address, port, timeout)
    if state == "open":
        return CheckResult(True, round(latency or 0.0, 2), method="tcp")
    reason = {"refused": "porta fechada", "timeout": "tempo esgotado", "error": "erro de conexão"}[state]
    return CheckResult(False, error=f"{reason} ({port})", method="tcp")


_http_client: httpx.AsyncClient | None = None


def _client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(
            follow_redirects=False, verify=True, headers={"User-Agent": "OrbNOC/4"}
        )
    return _http_client


def http_url(host: str, port: int | None) -> str:
    scheme = "http" if port and port not in (443, 8443) else "https"
    netloc = f"[{host}]" if ":" in host else host
    return f"{scheme}://{netloc}" + (f":{port}" if port and port not in (80, 443) else "") + "/"


async def check_http(host: str, port: int | None, timeout: float) -> CheckResult:
    """OK = resposta 2xx/3xx. Certificado TLS inválido conta como falha."""
    start = time.perf_counter()
    try:
        response = await _client().get(http_url(host, port), timeout=timeout)
    except httpx.TimeoutException:
        return CheckResult(False, error="tempo esgotado", method="http")
    except httpx.HTTPError as exc:
        return CheckResult(False, error=f"{type(exc).__name__}", method="http")
    latency = round((time.perf_counter() - start) * 1000, 2)
    if response.status_code < 400:
        return CheckResult(True, latency, method="http")
    return CheckResult(False, latency, error=f"HTTP {response.status_code}", method="http")


async def run_check(check_type: str, host: str, port: int | None) -> CheckResult:
    """Ponto de entrada do worker. Nunca levanta exceção: falha vira CheckResult(ok=False)."""
    timeout = get_settings().monitor_timeout_seconds
    try:
        target = await resolve_target(host)
        if check_type == "tcp" and port:
            return await asyncio.wait_for(check_tcp(target.address, port, timeout), timeout + 2)
        if check_type == "http":
            # Conecta pelo nome (SNI/Host corretos); o destino já foi validado acima.
            return await asyncio.wait_for(check_http(target.host, port, timeout), timeout + 2)
        return await asyncio.wait_for(check_icmp(target.address, timeout), timeout + 2)
    except TargetError as exc:
        return CheckResult(False, error=str(exc), method=check_type)
    except TimeoutError:
        return CheckResult(False, error="tempo esgotado", method=check_type)
    except Exception as exc:
        log.exception("Erro inesperado verificando %s", host)
        return CheckResult(False, error=f"erro interno: {type(exc).__name__}", method=check_type)
