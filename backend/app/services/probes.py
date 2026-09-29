"""Sondas de disponibilidade: ICMP (icmplib) com fallback automático para conexão TCP."""

import asyncio
import logging
import time
from dataclasses import dataclass

from icmplib import ICMPLibError, async_ping

log = logging.getLogger(__name__)

FALLBACK_PORTS = (443, 80, 22, 53, 8080, 8443)


@dataclass(slots=True)
class ProbeResult:
    ok: bool
    latency_ms: float | None = None
    method: str = "icmp"  # icmp | tcp
    port: int | None = None
    error: str | None = None


async def tcp_probe(
    address: str, port: int, timeout: float, refused_is_alive: bool = False
) -> ProbeResult:
    """Conecta em `address:port`. `refused_is_alive`: um RST prova que o host existe (fallback)."""
    start = time.perf_counter()
    try:
        _, writer = await asyncio.wait_for(asyncio.open_connection(address, port), timeout)
    except ConnectionRefusedError:
        latency = round((time.perf_counter() - start) * 1000, 2)
        if refused_is_alive:
            return ProbeResult(True, latency, "tcp", port)
        return ProbeResult(False, None, "tcp", port, "conexão recusada")
    except TimeoutError:
        return ProbeResult(False, None, "tcp", port, "timeout")
    except OSError as exc:
        return ProbeResult(False, None, "tcp", port, exc.strerror or "erro de rede")
    latency = round((time.perf_counter() - start) * 1000, 2)
    writer.close()
    try:
        await writer.wait_closed()
    except OSError:
        pass
    return ProbeResult(True, latency, "tcp", port)


async def tcp_probe_any(
    address: str, timeout: float, ports: tuple[int, ...] = FALLBACK_PORTS
) -> ProbeResult:
    """Fallback do ICMP: tenta portas comuns em paralelo e devolve a resposta mais rápida."""
    results = await asyncio.gather(
        *(tcp_probe(address, p, timeout, refused_is_alive=True) for p in ports)
    )
    alive = [r for r in results if r.ok]
    if alive:
        return min(alive, key=lambda r: r.latency_ms or 0)
    return ProbeResult(False, None, "tcp", None, "sem resposta")


class Prober:
    """Escolhe ICMP (raw, depois não privilegiado) ou TCP, conforme o ambiente permitir."""

    def __init__(self, timeout: float = 2.0) -> None:
        self.timeout = timeout
        self.icmp_mode: str | None = None  # "privileged" | "unprivileged" | None (= só TCP)

    async def detect(self) -> str | None:
        """Testa ICMP contra o loopback. Sem resposta = ambiente bloqueia ICMP."""
        for mode, privileged in (("privileged", True), ("unprivileged", False)):
            try:
                host = await async_ping("127.0.0.1", count=1, timeout=1, privileged=privileged)
            except (ICMPLibError, OSError):
                continue
            if host.is_alive:
                self.icmp_mode = mode
                log.info("ICMP disponível (modo %s)", mode)
                return mode
        self.icmp_mode = None
        log.warning("ICMP indisponível neste ambiente; usando conexão TCP como fallback")
        return None

    async def icmp(self, address: str) -> ProbeResult:
        assert self.icmp_mode is not None
        try:
            host = await async_ping(
                address,
                count=1,
                timeout=self.timeout,
                privileged=self.icmp_mode == "privileged",
            )
        except (ICMPLibError, OSError) as exc:
            return ProbeResult(False, None, "icmp", None, str(exc)[:200])
        if host.is_alive:
            return ProbeResult(True, round(host.avg_rtt, 2), "icmp")
        return ProbeResult(False, None, "icmp", None, "sem resposta")

    async def probe(self, address: str, check_type: str, port: int | None) -> ProbeResult:
        if check_type == "tcp" and port:
            return await tcp_probe(address, port, self.timeout)
        if self.icmp_mode is None:
            return await tcp_probe_any(address, self.timeout)
        return await self.icmp(address)

    async def ping_series(
        self, address: str, count: int, interval: float = 0.5
    ) -> list[ProbeResult]:
        """Série de pings para o diagnóstico (mesma lógica de escolha ICMP/TCP)."""
        results: list[ProbeResult] = []
        for i in range(count):
            results.append(await self.probe(address, "icmp", None))
            if i < count - 1:
                await asyncio.sleep(interval)
        return results
