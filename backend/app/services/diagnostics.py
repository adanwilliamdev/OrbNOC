"""Ferramentas de diagnóstico: ping, traceroute real, DNS e teste de porta. Sem shell."""

import asyncio
import re
import shutil
import time

import dns.asyncresolver
import dns.exception
import dns.resolver

from app.services.netguard import HostRejected, parse_host
from app.services.probes import Prober, tcp_probe

RECORD_TYPES = {"A", "AAAA", "MX", "TXT", "CNAME", "NS", "SOA", "PTR"}
_HOP_RE = re.compile(r"^\s*(\d+)\s+(.*)$")
_IP_RE = re.compile(r"(\d{1,3}(?:\.\d{1,3}){3}|[0-9a-fA-F:]{3,39})")
_RTT_RE = re.compile(r"([\d.]+)\s*ms")


async def run_ping(prober: Prober, address: str, count: int) -> dict:
    results = await prober.ping_series(address, count)
    latencies = [r.latency_ms for r in results if r.ok and r.latency_ms is not None]
    ok = len(latencies)
    return {
        "status": "online" if ok else "offline",
        "method": results[0].method,
        "packet_loss": round((count - ok) / count * 100),
        "avg_latency": round(sum(latencies) / ok, 2) if ok else None,
        "min_latency": min(latencies) if ok else None,
        "max_latency": max(latencies) if ok else None,
        "success_count": ok,
        "total_count": count,
    }


def parse_traceroute(output: str) -> list[dict]:
    """Interpreta a saída de `traceroute -n -q 1`. Salto sem resposta vira ip=None."""
    hops = []
    for line in output.splitlines():
        m = _HOP_RE.match(line)
        if not m:
            continue
        hop, rest = int(m.group(1)), m.group(2)
        ip = _IP_RE.search(rest)
        rtt = _RTT_RE.search(rest)
        silent = rest.strip().startswith("*")
        hops.append(
            {
                "hop": hop,
                "ip": ip.group(1) if ip and not silent else None,
                "latency": float(rtt.group(1)) if rtt and not silent else None,
            }
        )
    return hops


async def run_traceroute(address: str, max_hops: int = 20, timeout: int = 60) -> list[dict]:
    """Traceroute real via binário do sistema, com argumentos em lista (sem shell)."""
    binary = shutil.which("traceroute")
    if binary is None:
        raise RuntimeError("traceroute não está instalado neste servidor")
    proc = await asyncio.create_subprocess_exec(
        binary,
        "-n",
        "-q",
        "1",
        "-w",
        "2",
        "-m",
        str(max_hops),
        "--",
        address,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    try:
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except TimeoutError:
        proc.kill()
        await proc.wait()
        raise RuntimeError("traceroute excedeu o tempo limite") from None
    return parse_traceroute(stdout.decode(errors="replace"))


async def lookup_dns(domain: str, record_type: str) -> dict:
    domain = parse_host(domain)
    rtype = record_type.upper()
    if rtype not in RECORD_TYPES:
        raise HostRejected("Tipo de registro não suportado")
    resolver = dns.asyncresolver.Resolver()
    resolver.lifetime = 5
    try:
        answer = await resolver.resolve(domain, rtype)
    except (dns.exception.DNSException, OSError) as exc:
        return {
            "domain": domain,
            "record_type": rtype,
            "records": [],
            "success": False,
            "error": type(exc).__name__.replace("_", " "),
        }
    records = []
    for rdata in answer:
        if rtype == "MX":
            value = f"{rdata.exchange.to_text().rstrip('.')} (priority {rdata.preference})"
        elif rtype == "TXT":
            value = b" ".join(rdata.strings).decode(errors="replace")
        else:
            value = rdata.to_text().rstrip(".") if rtype != "SOA" else rdata.to_text()
        records.append({"value": value})
    return {"domain": domain, "record_type": rtype, "records": records, "success": True}


async def check_ports(address: str, ports: list[int], timeout: float = 3.0) -> list[dict]:
    async def one(port: int) -> dict:
        started = time.perf_counter()
        result = await tcp_probe(address, port, timeout)
        return {
            "port": port,
            "open": result.ok,
            "latency": result.latency_ms,
            "duration_ms": round((time.perf_counter() - started) * 1000, 1),
        }

    return list(await asyncio.gather(*(one(p) for p in ports)))
