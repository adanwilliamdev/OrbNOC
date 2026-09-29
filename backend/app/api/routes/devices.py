from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, literal_column, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.netguard import TargetError, validate_for_registration
from app.db.models import Device, Metric, User
from app.db.session import get_session
from app.schemas.devices import CheckOut, DeviceCreate, DeviceOut, DeviceUpdate
from app.services.checks import run_check
from app.services.sla import WINDOWS, compute_sla
from app.services.snapshots import push_snapshot

router = APIRouter(prefix="/devices", tags=["devices"])
MAX_DEVICES_PER_USER = 500


async def _get_owned(session: AsyncSession, user: User, device_id: int) -> Device:
    device = await session.scalar(select(Device).where(Device.id == device_id, Device.owner_id == user.id))
    if device is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dispositivo não encontrado")
    return device


async def _ensure_unique(
    session: AsyncSession,
    user: User,
    ip: str,
    check_type: str,
    port: int | None,
    ignore_id: int | None = None,
):
    query = select(Device.id).where(
        Device.owner_id == user.id,
        Device.ip == ip,
        Device.check_type == check_type,
        Device.port.is_(None) if port is None else Device.port == port,
    )
    if ignore_id is not None:
        query = query.where(Device.id != ignore_id)
    if await session.scalar(query) is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Já existe um dispositivo com esse host e essa verificação"
        )


async def _validate_target(ip: str) -> str:
    try:
        return await validate_for_registration(ip)
    except TargetError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.get("", response_model=list[DeviceOut])
async def list_devices(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    return list(
        await session.scalars(
            select(Device).where(Device.owner_id == user.id).order_by(Device.name, Device.id)
        )
    )


@router.post("", response_model=DeviceOut, status_code=status.HTTP_201_CREATED)
async def create_device(
    body: DeviceCreate, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
):
    count = await session.scalar(select(func.count()).select_from(Device).where(Device.owner_id == user.id))
    if (count or 0) >= MAX_DEVICES_PER_USER:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Limite de {MAX_DEVICES_PER_USER} dispositivos atingido"
        )
    host = await _validate_target(body.ip)
    await _ensure_unique(session, user, host, body.check_type, body.port)
    device = Device(owner_id=user.id, **{**body.model_dump(), "ip": host})
    session.add(device)
    await session.commit()
    await push_snapshot(session, user.id)
    return device


@router.get("/{device_id}", response_model=DeviceOut)
async def get_device(
    device_id: int, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
):
    return await _get_owned(session, user, device_id)


@router.patch("/{device_id}", response_model=DeviceOut)
async def update_device(
    device_id: int,
    body: DeviceUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    device = await _get_owned(session, user, device_id)
    changes = body.model_dump(exclude_unset=True)
    if "ip" in changes and changes["ip"] is not None:
        changes["ip"] = await _validate_target(changes["ip"])
    for field in ("name", "ip", "check_type"):  # não aceitam null
        if field in changes and changes[field] is None:
            del changes[field]
    check_type = changes.get("check_type", device.check_type)
    port = changes.get("port", device.port) if check_type != "icmp" else None
    if check_type == "tcp" and not port:
        raise HTTPException(422, "Informe a porta para verificações TCP")
    ip = changes.get("ip", device.ip)
    await _ensure_unique(session, user, ip, check_type, port, ignore_id=device.id)

    target_changed = (ip, check_type, port) != (device.ip, device.check_type, device.port)
    for key, value in changes.items():
        setattr(device, key, value)
    device.port = port
    if target_changed:  # alvo diferente = histórico de estado deixa de valer
        device.status, device.consecutive_failures = "unknown", 0
        device.sla_breach_count, device.sla_breached = 0, False
        device.latency = device.avg_latency = device.min_latency = device.max_latency = None
        device.jitter = device.packet_loss = device.last_check_at = device.status_changed_at = None
    await session.commit()
    await push_snapshot(session, user.id)
    return device


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(
    device_id: int, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
):
    device = await _get_owned(session, user, device_id)
    await session.delete(device)
    await session.commit()
    await push_snapshot(session, user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{device_id}/ping", response_model=CheckOut)
async def check_now(
    device_id: int, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
):
    """Verificação imediata, só informativa: o estado oficial é mantido pelo worker."""
    device = await _get_owned(session, user, device_id)
    result = await run_check(device.check_type, device.ip, device.port)
    return CheckOut(
        id=device.id,
        name=device.name,
        ip=device.ip,
        online=result.ok,
        latency_ms=result.latency_ms,
        method=result.method,
        error=result.error,
        checked_at=datetime.now(UTC),
    )


@router.get("/{device_id}/history")
async def history(
    device_id: int,
    hours: int = Query(24, ge=1, le=168),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Série para gráficos, agrupada em ~300 pontos no máximo."""
    await _get_owned(session, user, device_id)
    since = datetime.now(UTC) - timedelta(hours=hours)
    bucket_seconds = max(10, hours * 3600 // 300)
    bucket = func.date_bin(
        literal_column(f"interval '{bucket_seconds} seconds'"),
        Metric.recorded_at,
        literal_column("timestamptz '2000-01-01 00:00:00+00'"),
    ).label("bucket")
    rows = await session.execute(
        select(bucket, func.avg(Metric.latency_ms), func.count(), func.count().filter(Metric.ok.is_(False)))
        .where(Metric.device_id == device_id, Metric.recorded_at >= since)
        .group_by(bucket)
        .order_by(bucket)
    )
    points = [
        {
            "recorded_at": b,
            "latency_ms": round(avg, 2) if avg is not None else None,
            "samples": n,
            "packet_loss": round(100 * failed / n, 1),
        }
        for b, avg, n, failed in rows
    ]
    stats = (await compute_sla(session, [device_id], since))[device_id]
    return {"hours": hours, "points": points, "summary": stats.as_dict()}


@router.get("/{device_id}/sla")
async def sla(
    device_id: int, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
):
    await _get_owned(session, user, device_id)
    now = datetime.now(UTC)
    return {
        label: (await compute_sla(session, [device_id], now - delta, now))[device_id].as_dict()
        for label, delta in WINDOWS.items()
    }
