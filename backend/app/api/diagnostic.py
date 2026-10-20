import ipaddress
import time
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import ProberDep, SettingsDep, limit_per_user
from app.api.schemas import DnsIn, FullDiagnosticIn, PingIn, PortsIn, TracerouteIn
from app.services import diagnostics
from app.services.netguard import HostRejected, resolve_and_check

router = APIRouter(
    prefix="/api/diagnostic",
    tags=["diagnostic"],
    dependencies=[Depends(limit_per_user("diagnostic", 30, 60))],
)


async def _target(host: str, settings) -> str:
    try:
        return (await resolve_and_check(host, settings.allow_private_networks))[0]
    except HostRejected as exc:
        raise HTTPException(422, str(exc)) from exc


@router.post("/ping")
async def ping(body: PingIn, settings: SettingsDep, prober: ProberDep) -> dict:
    address = await _target(body.host, settings)
    return {
        "host": body.host,
        "address": address,
        **await diagnostics.run_ping(prober, address, body.count),
    }


@router.post("/traceroute")
async def traceroute(body: TracerouteIn, settings: SettingsDep) -> dict:
    address = await _target(body.host, settings)
    try:
        hops = await diagnostics.run_traceroute(address, body.max_hops)
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    return {"target": body.host, "address": address, "hops": hops}


@router.post("/port-check")
async def port_check(body: PortsIn, settings: SettingsDep) -> dict:
    address = await _target(body.host, settings)
    return {"host": body.host, "results": await diagnostics.check_ports(address, body.ports)}


@router.post("/dns-lookup")
async def dns_lookup(body: DnsIn) -> dict:
    try:
        return await diagnostics.lookup_dns(body.domain, body.record_type)
    except HostRejected as exc:
        raise HTTPException(422, str(exc)) from exc


@router.post("/full-diagnostic")
async def full_diagnostic(body: FullDiagnosticIn, settings: SettingsDep, prober: ProberDep) -> dict:
    started = time.perf_counter()
    address = await _target(body.host, settings)
    ping = await diagnostics.run_ping(prober, address, 3)
    ports = await diagnostics.check_ports(address, body.ports, timeout=2.0)
    dns = await diagnostics.lookup_dns(body.host, "A") if not _is_ip(body.host) else None
    checks = []
    if dns is not None:
        checks.append(
            "✅ DNS resolve corretamente" if dns["success"] else "❌ Falha na resolução DNS"
        )
    if ping["status"] == "online":
        checks.append("✅ Host responde ao ping")
    elif ping["packet_loss"] > 50:
        checks.append("⚠️ Alta perda de pacotes")
    for p in ports:
        checks.append(
            f"✅ Porta {p['port']} aberta" if p["open"] else f"❌ Porta {p['port']} fechada"
        )
    return {
        "host": body.host,
        "address": address,
        "duration_ms": round((time.perf_counter() - started) * 1000),
        "results": {"ping": ping, "dns": dns, "ports": ports},
        "diagnosis": checks,
        "timestamp": datetime.now(UTC).isoformat(),
    }


def _is_ip(value: str) -> bool:
    try:
        ipaddress.ip_address(value.strip("[]"))
    except ValueError:
        return False
    return True
