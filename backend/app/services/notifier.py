"""Mensagens de alerta e envio ao Telegram."""

import html
import logging
from dataclasses import dataclass

import httpx

log = logging.getLogger(__name__)

_TITLES = {
    "down": "🔴 HOST OFFLINE",
    "recovered": "✅ SERVIÇO RECUPERADO",
    "sla_breach": "⚠️ LIMITE DE LATÊNCIA EXCEDIDO",
    "test": "ℹ️ TESTE DE NOTIFICAÇÃO",
}


@dataclass(frozen=True)
class EventContext:
    kind: str
    device_name: str
    device_ip: str
    latency_ms: float | None = None
    threshold_ms: int | None = None
    error: str | None = None


def describe(ctx: EventContext) -> str:
    """Texto curto guardado no evento e exibido no dashboard."""
    if ctx.kind == "down":
        detail = f" ({ctx.error})" if ctx.error else ""
        return f"{ctx.device_name} ({ctx.device_ip}) não está respondendo{detail}"
    if ctx.kind == "recovered":
        lat = f" — latência {ctx.latency_ms:.0f} ms" if ctx.latency_ms is not None else ""
        return f"{ctx.device_name} ({ctx.device_ip}) voltou a responder{lat}"
    if ctx.kind == "sla_breach":
        return (
            f"{ctx.device_name} ({ctx.device_ip}): latência {ctx.latency_ms:.0f} ms acima do limite de {ctx.threshold_ms} ms"
            if ctx.latency_ms is not None and ctx.threshold_ms
            else f"{ctx.device_name} ({ctx.device_ip}): limite de latência excedido"
        )
    return f"{ctx.device_name} ({ctx.device_ip})"


def telegram_text(kind: str, message: str) -> str:
    """HTML do Telegram: todo texto dinâmico é escapado (o Markdown antigo quebrava com '_' e '*' nos nomes)."""
    title = _TITLES.get(kind, "ℹ️ NOTIFICAÇÃO")
    return f"<b>OrbNOC</b>\n<b>{title}</b>\n\n{html.escape(message)}"


async def send_telegram(bot_token: str, chat_id: str, text: str) -> tuple[bool, str | None]:
    """Retorna (ok, erro). Nunca levanta e nunca registra o token."""
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                url,
                json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                },
            )
        data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        log.warning(
            "Falha ao enviar Telegram: %s", type(exc).__name__
        )  # sem str(exc): pode conter a URL/token
        return False, "Não foi possível contatar o Telegram"
    if data.get("ok"):
        return True, None
    return False, str(data.get("description") or "Erro desconhecido do Telegram")
