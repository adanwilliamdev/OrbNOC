"""Ferramentas de diagnóstico: ping, traceroute, DNS, portas.

Nada aqui usa shell. Processos externos recebem argumentos em lista e SEMPRE um IP já validado
(app.core.netguard), nunca texto digitado pelo usuário.
"""

import asyncio
import ipaddress
import re
import shutil
import time

import dns.asyncresolver
import dns.exception
import dns.reversename
from icmplib import ICMPLibError

from app.core.config import get_settings
from app.core.netguard import ResolvedTarget, TargetError, parse_host, resolve_target
from app.services.checks import FALLBACK_PORTS, _icmp_probe, _IcmpUnavailableError, tcp_probe
from app.services.stats import window_stats

DNS_TYPES = ("A", "AAAA", "MX", "TXT", "CNAME", "NS")
MAX_PING_COUNT = 10
MAX_PORTS = 20
TRACEROUTE_MAX_HOPS = 20
TRACEROUTE_TIMEOUT = 45

_HOP_RE = re.compile(r"^\s*(\d+)\s+(.*)$")
_IP_RE = re.compile(r"(\d{1,3}(?:\.\d{1,3}){3}|[0-9a-fA-F:]*:[0-9a-fA-F:]+)")
_MS_RE = re.compile(r"([\d.]+)\s*ms")


def _is_ip(value: str) -> bool:
    try:
        ipaddress.ip_address(value)
    except ValueError:
        return False
    return True


async def ping(target: ResolvedTarget, count: int = 5) -> dict:
    count = max(1, min(count, MAX_PING_COUNT))
    timeout = get_settings().monitor_timeout_seconds
    samples: list[float | None] = []
    method = "icmp"
    try:
        if get_settings().icmp_mode == "tcp":
            raise _IcmpUnavailableError
        host = await _icmp_probe(target.address, timeout, count=count, interval=0.3)
        rtts = list(host.rtts)
        samples = [*rtts, *([None] * (host.packets_sent - host.packets_received))]
    except _IcmpUnavailableError:
        method = "tcp-fallback"
        for _ in range(count):
            results = await asyncio.gather(*(tcp_probe(target.address, p, timeout) for p in FALLBACK_PORTS))
            alive = [lat for st, lat in results if st in ("open", "refused") and lat is not None]
            samples.append(min(alive) if alive else None)
            await asyncio.sleep(0.3)
    except ICMPLibError as exc:
        raise TargetError(str(exc)) from exc
    stats = window_stats(samples)
    received = sum(1 for s in samples if s is not None)
    return {
        "host": target.host,
        "address": target.address,
        "method": method,
        "status": "online" if received else "offline",
        "sent": len(samples),
        "received": received,
        "packet_loss": stats.packet_loss,
        "avg_latency": stats.avg,
        "min_latency": stats.min,
        "max_latency": stats.max,
        "jitter": stats.jitter,
    }


def parse_traceroute(output: str) -> list[dict]:
    hops: list[dict] = []
    for line in output.splitlines():
        m = _HOP_RE.match(line)
        if not m:
            continue
        rest = m.group(2)
        ip = _IP_RE.search(rest)
        ms = _MS_RE.findall(rest)
        hops.append(
            {
                "hop": int(m.group(1)),
                "ip": ip.group(1) if ip else None,
                "latency": round(sum(map(float, ms)) / len(ms), 2) if ms else None,
                "timeout": ip is None,
            }
        )
    return hops


async def traceroute(target: ResolvedTarget) -> dict:
    binary = shutil.which("traceroute")
    if not binary:
        raise TargetError("O comando 'traceroute' não está instalado neste servidor")
    args = [binary, "-n", "-q", "1", "-w", "2", "-m", str(TRACEROUTE_MAX_HOPS)]
    if ":" in target.address:
        args.append("-6")
    args.append(target.address)  # IP validado, nunca entrada do usuário
    proc = await asyncio.create_subprocess_exec(  # noqa: S603
        *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL
    )
    try:
        stdout, _ = await asyncio.wait_for(proc.communicate(), TRACEROUTE_TIMEOUT)
    except TimeoutError:
        proc.kill()
        await proc.wait()
        raise TargetError("Traceroute excedeu o tempo limite") from None
    hops = parse_traceroute(stdout.decode(errors="replace"))
    reached = bool(hops) and hops[-1]["ip"] == target.address
    return {"host": target.host, "address": target.address, "hops": hops, "reached": reached}


async def port_check(target: ResolvedTarget, ports: list[int]) -> dict:
    ports = sorted(set(ports))[:MAX_PORTS]
    if not ports or any(not 1 <= p <= 65535 for p in ports):
        raise TargetError("Informe portas entre 1 e 65535")
    timeout = get_settings().monitor_timeout_seconds
    results = await asyncio.gather(*(tcp_probe(target.address, p, timeout) for p in ports))
    return {
        "host": target.host,
        "address": target.address,
        "results": [
            {
                "port": p,
                "open": st == "open",
                "state": st,
                "latency": round(lat, 2) if st == "open" and lat else None,
            }
            for p, (st, lat) in zip(ports, results, strict=True)
        ],
    }


async def dns_lookup(domain: str, record_type: str = "A") -> dict:
    record_type = record_type.upper()
    if record_type not in DNS_TYPES:
        raise TargetError(f"Tipo de registro não suportado. Use: {', '.join(DNS_TYPES)}")
    name = parse_host(domain)
    resolver = dns.asyncresolver.Resolver()
    resolver.lifetime = 5
    started = time.perf_counter()
    try:
        answer = await resolver.resolve(name, record_type)
    except dns.resolver.NXDOMAIN:
        return {
            "domain": name,
            "record_type": record_type,
            "success": False,
            "records": [],
            "error": "Domínio não existe (NXDOMAIN)",
        }
    except dns.resolver.NoAnswer:
        return {
            "domain": name,
            "record_type": record_type,
            "success": False,
            "records": [],
            "error": f"Sem registros {record_type}",
        }
    except (dns.exception.DNSException, OSError) as exc:
        return {
            "domain": name,
            "record_type": record_type,
            "success": False,
            "records": [],
            "error": type(exc).__name__,
        }
    records = [{"value": r.to_text(), "ttl": answer.rrset.ttl} for r in answer]
    reverse = None
    if record_type == "A" and records:
        try:
            ptr = await resolver.resolve(dns.reversename.from_address(records[0]["value"]), "PTR")
            reverse = ptr[0].to_text().rstrip(".")
        except (dns.exception.DNSException, OSError):
            reverse = None
    return {
        "domain": name,
        "record_type": record_type,
        "success": True,
        "records": records,
        "reverse_lookup": reverse,
        "duration_ms": round((time.perf_counter() - started) * 1000, 1),
    }


async def full_diagnostic(host: str, ports: list[int]) -> dict:
    started = time.perf_counter()
    findings: list[dict] = []
    result: dict = {"host": host}

    target = await resolve_target(host)  # levanta TargetError se inválido/proibido
    result["address"] = target.address
    findings.append({"level": "ok", "message": f"Host resolve para {target.address}"})

    ping_res, port_res = await asyncio.gather(ping(target, 3), port_check(target, ports))
    result["ping"], result["ports"] = ping_res, port_res["results"]
    if ping_res["status"] == "offline":
        findings.append({"level": "error", "message": "Host não responde a testes de conectividade"})
    elif (ping_res["packet_loss"] or 0) > 0:
        findings.append({"level": "warning", "message": f"Perda de pacotes: {ping_res['packet_loss']}%"})
    else:
        findings.append({"level": "ok", "message": f"Host responde (média {ping_res['avg_latency']} ms)"})
    for r in port_res["results"]:
        findings.append(
            {
                "level": "ok" if r["open"] else "warning",
                "message": f"Porta {r['port']} {'aberta' if r['open'] else 'fechada'}",
            }
        )

    if not _is_ip(target.host):
        result["dns"] = await dns_lookup(target.host, "A")
    result["findings"] = findings
    result["duration_ms"] = round((time.perf_counter() - started) * 1000)
    return result
