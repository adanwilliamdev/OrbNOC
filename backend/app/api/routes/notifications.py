import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.security import decrypt_secret, encrypt_secret
from app.db.models import NotificationChannel, User
from app.db.session import get_session
from app.schemas.common import Message
from app.schemas.events import TelegramConfigIn, TelegramConfigOut
from app.services.notifier import send_telegram, telegram_text

router = APIRouter(prefix="/notifications", tags=["notifications"])

_TOKEN_RE = re.compile(r"^\d{6,}:[A-Za-z0-9_-]{30,}$")
_CHAT_RE = re.compile(r"^(-?\d{5,20}|@[A-Za-z0-9_]{5,64})$")


async def _channel(session: AsyncSession, user: User) -> NotificationChannel | None:
    return await session.scalar(
        select(NotificationChannel).where(
            NotificationChannel.owner_id == user.id, NotificationChannel.kind == "telegram"
        )
    )


def _out(channel: NotificationChannel | None) -> TelegramConfigOut:
    if channel is None:
        return TelegramConfigOut(enabled=False, chat_id=None, token_set=False)
    token = decrypt_secret(channel.secret_encrypted) if channel.secret_encrypted else None
    return TelegramConfigOut(
        enabled=channel.enabled,
        chat_id=channel.chat_id,
        token_set=token is not None,
        token_hint=f"…{token[-4:]}" if token else None,
    )


@router.get("/telegram", response_model=TelegramConfigOut)
async def get_telegram(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    return _out(await _channel(session, user))


@router.put("/telegram", response_model=TelegramConfigOut)
async def put_telegram(
    body: TelegramConfigIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    channel = await _channel(session, user) or NotificationChannel(owner_id=user.id, kind="telegram")
    if body.bot_token:
        if not _TOKEN_RE.match(body.bot_token.strip()):
            raise HTTPException(422, "Token do bot em formato inválido")
        channel.secret_encrypted = encrypt_secret(body.bot_token.strip())
    chat_id = (body.chat_id or "").strip() or None
    if chat_id and not _CHAT_RE.match(chat_id):
        raise HTTPException(422, "Chat ID inválido (número ou @canal)")
    channel.chat_id = chat_id
    if body.enabled and not (channel.secret_encrypted and channel.chat_id):
        raise HTTPException(422, "Para ativar, informe o token do bot e o Chat ID")
    channel.enabled = body.enabled
    session.add(channel)
    await session.commit()
    return _out(channel)


@router.post("/telegram/test", response_model=Message)
async def test_telegram(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    channel = await _channel(session, user)
    token = decrypt_secret(channel.secret_encrypted) if channel and channel.secret_encrypted else None
    if not (channel and channel.chat_id and token):
        raise HTTPException(422, "Configure o token do bot e o Chat ID primeiro")
    ok, error = await send_telegram(
        token, channel.chat_id, telegram_text("test", "Notificações do OrbNOC configuradas com sucesso.")
    )
    if not ok:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Telegram recusou a mensagem: {error}")
    return Message(message="Mensagem de teste enviada")
