"""
Envio de alertas formatados para o Telegram via bot.
Equivalente a src/services/telegramService.js.
"""
import logging
from typing import Optional

import httpx

logger = logging.getLogger("orbnoc.telegram")

ALERT_TITLES = {
    "error": "❌ HOST OFFLINE ❌",
    "success": "✅ RECUPERAÇÃO DE SERVIÇO ✅",
    "warning": "⚠️ ALERTA DE DESEMPENHO ⚠️",
    "added": "📌 NOVO DISPOSITIVO",
    "removed": "🗑️ DISPOSITIVO REMOVIDO",
}


def _build_message(
    type_: Optional[str],
    message: str,
    device_name: Optional[str],
    device_ip: Optional[str],
    extra_info: Optional[str],
) -> str:
    title = ALERT_TITLES.get(type_, "ℹ️ NOTIFICAÇÃO")

    text = "*ORBNOC | Network Operations Center*\n\n"
    text += f"**{title}**\n\n"
    text += "---\n"

    if device_name and device_ip:
        text += f"📡 *Dispositivo:* {device_name}\n"
        text += f"🌐 *IP:* {device_ip}\n"

    if extra_info:
        text += f"{extra_info}\n"

    text += "---\n\n"
    text += f"{message}\n\n"
    text += "_📡 OrbNOC • Monitoramento 24/7_"

    return text


async def send_telegram_alert(
    bot_token: Optional[str],
    chat_id: Optional[str],
    message: str,
    type_: Optional[str] = None,
    device_name: Optional[str] = None,
    device_ip: Optional[str] = None,
    extra_info: Optional[str] = None,
) -> bool:
    """
    Envia um alerta formatado para um chat do Telegram via bot.
    Retorna False silenciosamente se as credenciais estiverem ausentes
    ou se o envio falhar (mesmo comportamento do sistema original).
    """
    if not bot_token or not chat_id:
        return False

    text = _build_message(type_, message, device_name, device_ip, extra_info)
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                url,
                json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "Markdown",
                    "disable_web_page_preview": True,
                },
            )
            result = response.json()
            if result.get("ok"):
                logger.info("✅ Telegram alerta enviado para %s", chat_id)
                return True
            logger.error("❌ Erro Telegram: %s", result.get("description"))
            return False
    except Exception as exc:  # noqa: BLE001
        logger.error("❌ Erro ao enviar Telegram: %s", exc)
        return False
