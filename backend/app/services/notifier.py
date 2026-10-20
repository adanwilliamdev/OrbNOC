"""Notificações no Telegram. O token nunca é logado nem devolvido pela API."""

import html
import logging
import re
from dataclasses import dataclass

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.security import decrypt_secret
from app.db.models import Device, NotificationChannel

log = logging.getLogger(__name__)

TOKEN_RE = re.compile(r"^\d{5,15}:[A-Za-z0-9_-]{20,80}$")
CHAT_ID_RE = re.compile(r"^(-?\d{1,20}|@[A-Za-z][A-Za-z0-9_]{4,63})$")

TITLES = {
    "offline": "❌ HOST OFFLINE",
    "recovered": "✅ RECUPERAÇÃO DE SERVIÇO",
    "sla_breach": "⚠️ ALERTA DE DESEMPENHO",
    "sla_recovered": "ℹ️ LATÊNCIA NORMALIZADA",
    "added": "📌 NOVO DISPOSITIVO",
    "removed": "🗑️ DISPOSITIVO REMOVIDO",
    "test": "🔔 TESTE DE NOTIFICAÇÃO",
    "info": "ℹ️ NOTIFICAÇÃO",
}


@dataclass(slots=True)
class TelegramTarget:
    token: str
    chat_id: str


def build_message(
    kind: str,
    message: str,
    device_name: str | None = None,
    device_host: str | None = None,
    extra: str | None = None,
) -> str:
    esc = html.escape
    lines = [
        "<b>ORBNOC | Network Operations Center</b>",
        "",
        f"<b>{TITLES.get(kind, TITLES['info'])}</b>",
        "",
    ]
    if device_name and device_host:
        lines.append(f"📡 <b>Dispositivo:</b> {esc(device_name)}")
        lines.append(f"🌐 <b>Host:</b> {esc(device_host)}")
    if extra:
        lines.append(esc(extra))
    lines += ["", esc(message), "", "<i>OrbNOC • Monitoramento 24/7</i>"]
    return "\n".join(lines)


async def send_telegram(
    target: TelegramTarget, text: str, client: httpx.AsyncClient | None = None
) -> tuple[bool, str | None]:
    """Envia a mensagem. Devolve (ok, descrição_do_erro). Nunca levanta exceção."""
    own = client is None
    client = client or httpx.AsyncClient(timeout=10)
    try:
        resp = await client.post(
            f"https://api.telegram.org/bot{target.token}/sendMessage",
            json={
                "chat_id": target.chat_id,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            },
        )
        data = resp.json()
        if data.get("ok"):
            return True, None
        return False, str(data.get("description", "erro desconhecido"))[:200]
    except (httpx.HTTPError, ValueError) as exc:
        # Não logar `exc`: pode conter a URL (e portanto o token).
        log.warning("Falha ao enviar Telegram: %s", type(exc).__name__)
        return False, "não foi possível falar com o Telegram"
    finally:
        if own:
            await client.aclose()


async def load_target(
    session: AsyncSession, user_id: int, settings: Settings, only_enabled: bool = True
) -> TelegramTarget | None:
    channel = await session.scalar(
        select(NotificationChannel).where(
            NotificationChannel.user_id == user_id, NotificationChannel.kind == "telegram"
        )
    )
    if channel is None or not channel.secret_encrypted or not channel.target:
        return None
    if only_enabled and not channel.enabled:
        return None
    token = decrypt_secret(channel.secret_encrypted, settings)
    return TelegramTarget(token, channel.target) if token else None


def device_extra(device: Device) -> str:
    parts = []
    if device.latency is not None:
        parts.append(f"⚡ Latência: {device.latency:.0f} ms")
    if device.sla_threshold_ms:
        parts.append(f"🎯 Limite: {device.sla_threshold_ms} ms")
    return "\n".join(parts)
