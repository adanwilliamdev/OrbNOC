"""Rotas de diagnóstico. Equivalente a src/routes/diagnostic.routes.js."""
import asyncio
from datetime import datetime, timezone
from typing import Union

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..auth_dependency import ApiError, get_current_user
from ..services import dns_service, ping_service

router = APIRouter(prefix="/api/diagnostic", tags=["diagnostic"])


class PingBody(BaseModel):
    host: str | None = None
    count: int = 5


class TracerouteBody(BaseModel):
    host: str | None = None


class PortCheckBody(BaseModel):
    host: str | None = None
    port: Union[int, list[int], None] = None


class DnsLookupBody(BaseModel):
    domain: str | None = None
    record_type: str = Field(default="A", alias="recordType")

    model_config = {"populate_by_name": True}


class FullDiagnosticBody(BaseModel):
    host: str | None = None
    ports: list[int] = [80, 443, 22]


async def _probe_alive(host: str) -> dict:
    """Tenta ICMP primeiro, com fallback para TCP connect — mesma lógica do original."""
    result = await ping_service.icmp_ping(host)
    if not result["alive"]:
        tcp_result = await ping_service.tcp_ping(host)
        if tcp_result["alive"]:
            result = tcp_result
    return result


@router.post("/ping")
async def diagnostic_ping(body: PingBody, current_user: dict = Depends(get_current_user)):
    if not body.host:
        raise ApiError(400, "Host é obrigatório")

    count = body.count or 5
    latencies: list[float] = []
    success_count = 0

    for _ in range(count):
        try:
            result = await _probe_alive(body.host)
            if result["alive"] and result["latency"]:
                latencies.append(result["latency"])
                success_count += 1
        except Exception:  # noqa: BLE001
            pass
        await asyncio.sleep(1)

    packet_loss = ((count - success_count) / count) * 100 if count else 0
    avg_latency = round(sum(latencies) / len(latencies)) if latencies else None
    min_latency = min(latencies) if latencies else None
    max_latency = max(latencies) if latencies else None

    return {
        "host": body.host,
        "status": "online" if success_count > 0 else "offline",
        "packet_loss": round(packet_loss),
        "avg_latency": avg_latency,
        "min_latency": min_latency,
        "max_latency": max_latency,
        "success_count": success_count,
        "total_count": count,
    }


@router.post("/traceroute")
async def traceroute(body: TracerouteBody, current_user: dict = Depends(get_current_user)):
    if not body.host:
        raise ApiError(400, "Host é obrigatório")

    # Mantido como no original: hops ilustrativos (não é um traceroute real).
    hops = [
        {"hop": 1, "ip": "192.168.1.1", "latency": 2},
        {"hop": 2, "ip": "10.0.0.1", "latency": 5},
        {"hop": 3, "ip": "172.16.0.1", "latency": 12},
        {"hop": 4, "ip": "201.12.34.56", "latency": 18},
        {"hop": 5, "ip": "187.12.34.56", "latency": 25},
        {"hop": 6, "ip": body.host, "latency": 30},
    ]

    return {"hops": hops, "target": body.host}


@router.post("/port-check")
async def port_check(body: PortCheckBody, current_user: dict = Depends(get_current_user)):
    if not body.host or body.port is None:
        raise ApiError(400, "Host e porta são obrigatórios")

    ports = body.port if isinstance(body.port, list) else [int(body.port)]
    results = []
    for p in ports:
        result = await ping_service.check_port(body.host, p, timeout_ms=3000)
        results.append({"port": result["port"], "open": result["open"], "latency": result["latency"]})

    return {"host": body.host, "results": results}


@router.post("/dns-lookup")
async def dns_lookup(body: DnsLookupBody, current_user: dict = Depends(get_current_user)):
    if not body.domain:
        raise ApiError(400, "Domínio é obrigatório")

    record_type = body.record_type or "A"
    try:
        records = await dns_service.resolve_domain(body.domain, record_type)

        reverse = None
        if records and record_type == "A":
            try:
                reverse = await dns_service.reverse_lookup(records[0]["value"])
            except Exception:  # noqa: BLE001
                # Sem reverse DNS disponível; segue sem interromper a resposta.
                pass

        return {
            "domain": body.domain,
            "record_type": record_type,
            "records": records,
            "reverse_lookup": reverse,
            "success": True,
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "domain": body.domain,
            "record_type": record_type,
            "records": [],
            "error": str(exc),
            "success": False,
        }


@router.post("/full-diagnostic")
async def full_diagnostic(body: FullDiagnosticBody, current_user: dict = Depends(get_current_user)):
    if not body.host:
        raise ApiError(400, "Host é obrigatório")

    start = asyncio.get_event_loop().time()
    results: dict = {}

    try:
        success_count = 0
        latencies: list[float] = []
        for _ in range(3):
            result = await _probe_alive(body.host)
            if result["alive"] and result["latency"]:
                latencies.append(result["latency"])
                success_count += 1
            await asyncio.sleep(0.5)
        results["ping"] = {
            "status": "online" if success_count > 0 else "offline",
            "packet_loss": round(((3 - success_count) / 3) * 100),
            "avg_latency": round(sum(latencies) / len(latencies)) if latencies else None,
        }
    except Exception as exc:  # noqa: BLE001
        results["ping"] = {"error": str(exc)}

    try:
        records = await dns_service.resolve_domain(body.host, "A")
        results["dns"] = {"success": True, "records": [r["value"] for r in records]}
    except Exception as exc:  # noqa: BLE001
        results["dns"] = {"success": False, "error": str(exc)}

    port_results = []
    for port in body.ports:
        result = await ping_service.check_port(body.host, port, timeout_ms=2000)
        port_results.append({"port": port, "open": result["open"]})
    results["ports"] = port_results

    duration_ms = round((asyncio.get_event_loop().time() - start) * 1000)

    diagnosis = []
    dns_result = results.get("dns", {})
    diagnosis.append("✅ DNS resolve corretamente" if dns_result.get("success") else "❌ Falha na resolução DNS")

    ping_result = results.get("ping", {})
    if ping_result.get("status") == "online":
        diagnosis.append("✅ Host responde ao ping")
    elif (ping_result.get("packet_loss") or 0) > 50:
        diagnosis.append("⚠️ Alta perda de pacotes")
    else:
        diagnosis.append("❌ Host não responde ao ping")

    for pr in port_results:
        diagnosis.append(f"✅ Porta {pr['port']} aberta" if pr["open"] else f"❌ Porta {pr['port']} fechada")

    return {
        "host": body.host,
        "duration_ms": duration_ms,
        "results": results,
        "diagnosis": " | ".join(diagnosis),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
