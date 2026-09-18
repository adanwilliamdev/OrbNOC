"""
Ping ICMP real (via comando `ping` do SO), fallback TCP connect e checagem
de portas. Equivalente a src/services/pingService.js.
"""
import asyncio
import re
import time
from typing import Optional

DEFAULT_PROBE_PORTS = [80, 443, 53, 8080, 8443]

_LOSS_RE = re.compile(r"(\d+)%\s*packet loss")
_RTT_RE = re.compile(r"=\s*[\d.]+/([\d.]+)/[\d.]+")


async def icmp_ping(host: str, count: int = 1, timeout_sec: int = 2) -> dict:
    """
    Ping ICMP real via subprocess (sem shell, evita injeção de comando).
    Mais confiável que TCP connect para dispositivos que não expõem
    nenhuma porta (celulares, IoT, roteadores sem admin web).
    """
    try:
        proc = await asyncio.create_subprocess_exec(
            "ping",
            "-c",
            str(count),
            "-W",
            str(timeout_sec),
            host,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError:
        # Comando `ping` indisponível no sistema (ex: imagem sem iputils-ping)
        return {"alive": False, "latency": None, "packet_loss": 100}

    try:
        stdout, _ = await asyncio.wait_for(
            proc.communicate(), timeout=timeout_sec * count + 2
        )
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        return {"alive": False, "latency": None, "packet_loss": 100}

    output = stdout.decode(errors="ignore") if stdout else ""
    loss_match = _LOSS_RE.search(output)
    packet_loss = int(loss_match.group(1)) if loss_match else 100
    alive = packet_loss < 100

    rtt_match = _RTT_RE.search(output)
    latency = round(float(rtt_match.group(1))) if rtt_match else None

    return {"alive": alive, "latency": latency, "packet_loss": packet_loss}


async def tcp_ping(
    ip: str, timeout_seconds: float = 5.0, ports: Optional[list[int]] = None
) -> dict:
    """Tenta conectar via TCP em uma sequência de portas comuns. Retorna na primeira que responder."""
    for port in ports or DEFAULT_PROBE_PORTS:
        start = time.monotonic()
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(ip, port), timeout=timeout_seconds
            )
        except Exception:  # noqa: BLE001 - qualquer falha de conexão tenta a próxima porta
            continue

        latency = round((time.monotonic() - start) * 1000)
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:  # noqa: BLE001
            pass
        return {"alive": True, "latency": latency, "port": port}

    return {"alive": False, "latency": None, "port": None}


async def check_port(host: str, port: int, timeout_ms: int = 3000) -> dict:
    """Verifica se uma porta específica está aberta em um host, com latência."""
    timeout_seconds = timeout_ms / 1000
    start = time.monotonic()
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=timeout_seconds
        )
    except asyncio.TimeoutError:
        return {"port": port, "open": False, "latency": None, "timed_out": True}
    except Exception:  # noqa: BLE001
        return {"port": port, "open": False, "latency": None, "timed_out": False}

    latency = round((time.monotonic() - start) * 1000)
    writer.close()
    try:
        await writer.wait_closed()
    except Exception:  # noqa: BLE001
        pass
    return {"port": port, "open": True, "latency": latency, "timed_out": False}


def calculate_jitter(latencies: list[float]) -> int:
    if len(latencies) < 2:
        return 0
    total = sum(abs(latencies[i] - latencies[i - 1]) for i in range(1, len(latencies)))
    return round(total / (len(latencies) - 1))
