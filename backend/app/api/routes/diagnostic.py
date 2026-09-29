from collections.abc import Awaitable

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.core import ratelimit
from app.core.config import get_settings
from app.core.netguard import TargetError, resolve_target
from app.db.models import User
from app.schemas.diagnostic import (
    DnsRequest,
    FullDiagnosticRequest,
    HostRequest,
    PingRequest,
    PortCheckRequest,
)
from app.services import diagnostics

router = APIRouter(prefix="/diagnostic", tags=["diagnostic"])


async def rate_limited(user: User = Depends(get_current_user)) -> User:
    limit = get_settings().diagnostic_rate_limit_per_minute
    if await ratelimit.incr(f"diag:{user.id}", 60) > limit:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Muitos diagnósticos em pouco tempo. Aguarde um minuto.",
            headers={"Retry-After": "60"},
        )
    return user


async def _run(coro: Awaitable[dict]) -> dict:
    try:
        return await coro
    except TargetError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.post("/ping", dependencies=[Depends(rate_limited)])
async def ping(body: PingRequest):
    async def go() -> dict:
        return await diagnostics.ping(await resolve_target(body.host), body.count)

    return await _run(go())


@router.post("/traceroute", dependencies=[Depends(rate_limited)])
async def traceroute(body: HostRequest):
    async def go() -> dict:
        return await diagnostics.traceroute(await resolve_target(body.host))

    return await _run(go())


@router.post("/port-check", dependencies=[Depends(rate_limited)])
async def port_check(body: PortCheckRequest):
    async def go() -> dict:
        return await diagnostics.port_check(await resolve_target(body.host), body.ports)

    return await _run(go())


@router.post("/dns", dependencies=[Depends(rate_limited)])
async def dns(body: DnsRequest):
    return await _run(diagnostics.dns_lookup(body.domain, body.record_type))


@router.post("/full", dependencies=[Depends(rate_limited)])
async def full(body: FullDiagnosticRequest):
    return await _run(diagnostics.full_diagnostic(body.host, body.ports))
