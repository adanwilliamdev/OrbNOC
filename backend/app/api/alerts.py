from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.api.deps import CurrentUser, RedisDep, SessionDep, SettingsDep
from app.api.devices import get_owned
from app.api.schemas import EventOut, SlaConfigIn, TelegramIn, TelegramOut
from app.core.security import encrypt_secret
from app.db.models import Event, NotificationChannel
from app.services import events as events_service
from app.services import notifier, realtime

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


async def _channel(session, user_id: int) -> NotificationChannel | None:
    return await session.scalar(
        select(NotificationChannel).where(
            NotificationChannel.user_id == user_id, NotificationChannel.kind == "telegram"
        )
    )


def _out(channel: NotificationChannel | None, **extra) -> TelegramOut:
    return TelegramOut(
        enabled=bool(channel and channel.enabled),
        chat_id=(channel.target or "") if channel else "",
        bot_token_set=bool(channel and channel.secret_encrypted),
        **extra,
    )


# ---- histórico de alertas (persistido no servidor) ----------------------------------------
@router.get("", response_model=list[EventOut])
async def list_events(
    user: CurrentUser,
    session: SessionDep,
    limit: int = Query(100, ge=1, le=500),
    unread_only: bool = False,
) -> list[Event]:
    query = select(Event).where(Event.user_id == user.id)
    if unread_only:
        query = query.where(Event.acknowledged_at.is_(None))
    return list(
        (
            await session.scalars(
                query.order_by(Event.created_at.desc(), Event.id.desc()).limit(limit)
            )
        ).all()
    )


@router.post("/ack-all")
async def ack_all(user: CurrentUser, session: SessionDep) -> dict:
    count = await events_service.acknowledge_all(session, user.id)
    await session.commit()
    return {"success": True, "acknowledged": count}


@router.post("/{event_id}/ack")
async def ack(event_id: int, user: CurrentUser, session: SessionDep) -> dict:
    if not await events_service.acknowledge(session, user.id, event_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alerta não encontrado")
    await session.commit()
    return {"success": True}


# ---- Telegram --------------------------------------------------------------------------------
@router.get("/telegram", response_model=TelegramOut)
async def get_telegram(user: CurrentUser, session: SessionDep) -> TelegramOut:
    return _out(await _channel(session, user.id))


@router.post("/telegram", response_model=TelegramOut)
async def save_telegram(
    body: TelegramIn, user: CurrentUser, session: SessionDep, settings: SettingsDep
) -> TelegramOut:
    channel = await _channel(session, user.id)
    if channel is None:
        channel = NotificationChannel(user_id=user.id, kind="telegram")
        session.add(channel)
    # Token vazio = manter o que já está salvo (a API nunca devolve o token).
    if body.bot_token:
        channel.secret_encrypted = encrypt_secret(body.bot_token, settings)
    if body.chat_id is not None:
        channel.target = body.chat_id
    if body.enabled and not (channel.secret_encrypted and channel.target):
        raise HTTPException(422, "Informe o token do bot e o chat ID para ativar")
    channel.enabled = body.enabled
    await session.commit()

    if not body.enabled:
        return _out(channel)
    target = await notifier.load_target(session, user.id, settings)
    assert target is not None
    ok, error = await notifier.send_telegram(
        target, notifier.build_message("test", "Sistema de notificações configurado com sucesso.")
    )
    return _out(channel, test_sent=ok, test_error=error)


@router.delete("/telegram", response_model=TelegramOut)
async def delete_telegram(user: CurrentUser, session: SessionDep) -> TelegramOut:
    channel = await _channel(session, user.id)
    if channel is not None:
        await session.delete(channel)
        await session.commit()
    return _out(None)


@router.post("/test-telegram")
async def test_telegram(user: CurrentUser, session: SessionDep, settings: SettingsDep) -> dict:
    target = await notifier.load_target(session, user.id, settings, only_enabled=False)
    if target is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Telegram não configurado")
    ok, error = await notifier.send_telegram(
        target, notifier.build_message("test", "Teste de conectividade realizado com sucesso.")
    )
    if not ok:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Telegram recusou: {error}")
    return {"success": True, "message": "Mensagem de teste enviada com sucesso!"}


@router.post("/test-host")
async def test_host(
    body: SlaConfigIn, user: CurrentUser, session: SessionDep, settings: SettingsDep
) -> dict:
    """Envia um alerta de exemplo com os dados atuais do dispositivo."""
    device = await get_owned(session, user.id, body.device_id)
    target = await notifier.load_target(session, user.id, settings, only_enabled=False)
    if target is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Telegram não configurado")
    kind = "recovered" if device.status == "online" else "offline"
    ok, error = await notifier.send_telegram(
        target,
        notifier.build_message(
            kind,
            "Teste de alerta executado com sucesso.",
            device.name,
            device.ip,
            notifier.device_extra(device),
        ),
    )
    if not ok:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Telegram recusou: {error}")
    return {"success": True, "message": "Alerta enviado!"}


# ---- limite de SLA (latência) ---------------------------------------------------------------
@router.post("/sla/configure")
async def configure_sla(
    body: SlaConfigIn, user: CurrentUser, session: SessionDep, redis: RedisDep
) -> dict:
    device = await get_owned(session, user.id, body.device_id)
    device.sla_threshold_ms = body.threshold_ms
    if body.threshold_ms is None:
        device.sla_breached = False
    await session.commit()
    await realtime.publish_devices(redis, session, user.id)
    msg = (
        f"Alerta SLA configurado: {body.threshold_ms} ms"
        if body.threshold_ms
        else "Alerta SLA removido"
    )
    return {"success": True, "message": msg}
