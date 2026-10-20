from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, ProberDep, RedisDep, SessionDep, SettingsDep
from app.api.schemas import (
    DeviceCreate,
    DeviceOut,
    DevicePatch,
    DevicePingOut,
    MetricOut,
    PortCheckIn,
)
from app.db.models import Device, Metric, MetricHourly
from app.services import notifier, realtime
from app.services.netguard import HostRejected, resolve_and_check
from app.services.probes import tcp_probe
from app.services.sla import WINDOWS, sla_by_device

router = APIRouter(prefix="/api/devices", tags=["devices"])


async def get_owned(session, user_id: int, device_id: int) -> Device:
    device = await session.scalar(
        select(Device).where(Device.id == device_id, Device.user_id == user_id)
    )
    if device is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dispositivo não encontrado")
    return device


@router.get("", response_model=list[DeviceOut])
async def list_devices(user: CurrentUser, session: SessionDep) -> list[Device]:
    return list(
        (
            await session.scalars(
                select(Device).where(Device.user_id == user.id).order_by(Device.id)
            )
        ).all()
    )


@router.post("", response_model=DeviceOut, status_code=status.HTTP_201_CREATED)
async def create_device(
    body: DeviceCreate,
    user: CurrentUser,
    session: SessionDep,
    redis: RedisDep,
    settings: SettingsDep,
    background: BackgroundTasks,
) -> Device:
    try:
        await resolve_and_check(body.ip, settings.allow_private_networks)
    except HostRejected as exc:
        raise HTTPException(422, str(exc)) from exc
    device = Device(user_id=user.id, **body.model_dump())
    session.add(device)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Dispositivo com este IP já existe") from None
    await realtime.publish_devices(redis, session, user.id)
    target = await notifier.load_target(session, user.id, settings)
    if target:
        text = notifier.build_message(
            "added",
            "Dispositivo adicionado ao monitoramento.",
            device.name,
            device.ip,
            f"📍 Localização: {device.location or 'Não informada'}",
        )
        background.add_task(notifier.send_telegram, target, text)
    return device


@router.patch("/{device_id}", response_model=DeviceOut)
async def patch_device(
    device_id: int, body: DevicePatch, user: CurrentUser, session: SessionDep, redis: RedisDep
) -> Device:
    device = await get_owned(session, user.id, device_id)
    for field in body.model_fields_set:
        setattr(device, field, getattr(body, field))
    if device.check_type == "tcp" and device.port is None:
        raise HTTPException(422, "Informe a porta para checagem TCP")
    if device.sla_threshold_ms is None:
        device.sla_breached = False
    await session.commit()
    await realtime.publish_devices(redis, session, user.id)
    return device


@router.delete("/{device_id}")
async def delete_device(
    device_id: int,
    user: CurrentUser,
    session: SessionDep,
    redis: RedisDep,
    settings: SettingsDep,
    background: BackgroundTasks,
) -> dict:
    device = await get_owned(session, user.id, device_id)
    name, host = device.name, device.ip
    await session.delete(device)
    await session.commit()
    await realtime.publish_devices(redis, session, user.id)
    target = await notifier.load_target(session, user.id, settings)
    if target:
        text = notifier.build_message(
            "removed", "Dispositivo removido do monitoramento.", name, host
        )
        background.add_task(notifier.send_telegram, target, text)
    return {"success": True}


@router.get("/{device_id}/ping", response_model=DevicePingOut)
async def manual_ping(
    device_id: int, user: CurrentUser, session: SessionDep, settings: SettingsDep, prober: ProberDep
) -> DevicePingOut:
    device = await get_owned(session, user.id, device_id)
    try:
        address = (await resolve_and_check(device.ip, settings.allow_private_networks))[0]
    except HostRejected as exc:
        raise HTTPException(422, str(exc)) from exc
    result = await prober.probe(address, device.check_type, device.port)
    return DevicePingOut(
        id=device.id,
        name=device.name,
        ip=device.ip,
        status="online" if result.ok else "offline",
        latency_ms=result.latency_ms,
        method=result.method,
        error=result.error,
        timestamp=datetime.now(UTC),
    )


@router.post("/{device_id}/check-port")
async def check_port(
    device_id: int,
    body: PortCheckIn,
    user: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
    prober: ProberDep,
) -> dict:
    device = await get_owned(session, user.id, device_id)
    try:
        address = (await resolve_and_check(device.ip, settings.allow_private_networks))[0]
    except HostRejected as exc:
        raise HTTPException(422, str(exc)) from exc
    result = await tcp_probe(address, body.port, 3.0)
    return {
        "open": result.ok,
        "port": body.port,
        "ip": device.ip,
        "latency": result.latency_ms,
        "error": result.error,
    }


@router.get("/{device_id}/history")
async def history(
    device_id: int, user: CurrentUser, session: SessionDep, hours: int = Query(24, ge=1, le=720)
) -> dict:
    device = await get_owned(session, user.id, device_id)
    since = datetime.now(UTC) - timedelta(hours=hours)
    if hours <= 24:
        rows = (
            await session.scalars(
                select(Metric)
                .where(Metric.device_id == device.id, Metric.recorded_at >= since)
                .order_by(Metric.recorded_at)
                .limit(5000)
            )
        ).all()
        points = [MetricOut.model_validate(r).model_dump(mode="json") for r in rows]
    else:  # janelas longas: pontos por hora (agregado)
        hourly = (
            await session.scalars(
                select(MetricHourly)
                .where(MetricHourly.device_id == device.id, MetricHourly.hour >= since)
                .order_by(MetricHourly.hour)
            )
        ).all()
        points = [
            {
                "id": i,
                "device_id": device.id,
                "ok": h.ok_samples > 0,
                "latency": h.avg_latency,
                "jitter": None,
                "packet_loss": round((1 - h.ok_samples / h.samples) * 100, 1)
                if h.samples
                else None,
                "recorded_at": h.hour.isoformat(),
            }
            for i, h in enumerate(hourly)
        ]
    windows = await sla_by_device(session, [device.id], "24h")
    summary = windows[device.id]
    return {
        "device_id": device.id,
        "hours": hours,
        "points": points,
        "summary": {
            "uptime_pct": summary.uptime_pct,
            "avg_latency": summary.avg_latency,
            "sample_count": summary.sample_count,
        },
    }


@router.get("/{device_id}/sla")
async def device_sla(device_id: int, user: CurrentUser, session: SessionDep) -> dict:
    device = await get_owned(session, user.id, device_id)
    out = {}
    for window in WINDOWS:
        w = (await sla_by_device(session, [device.id], window))[device.id]
        out[window] = {
            "uptime_pct": w.uptime_pct,
            "avg_latency": w.avg_latency,
            "sample_count": w.sample_count,
        }
    return {"device_id": device.id, "sla_threshold_ms": device.sla_threshold_ms, "windows": out}
