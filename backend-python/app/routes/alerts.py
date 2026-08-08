"""Rotas de alertas. Equivalente a src/routes/alerts.routes.js."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from .. import database
from ..auth_dependency import ApiError, get_current_user
from ..services.telegram_service import send_telegram_alert

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


class EmailConfigBody(BaseModel):
    enabled: bool | None = False
    email: str | None = None


class TelegramConfigBody(BaseModel):
    enabled: bool | None = False
    bot_token: str | None = Field(default=None, alias="botToken")
    chat_id: str | None = Field(default=None, alias="chatId")

    model_config = {"populate_by_name": True}


class NotifyBody(BaseModel):
    message: str | None = None
    type: str | None = None


class SlaConfigureBody(BaseModel):
    device_id: int | None = Field(default=None, alias="deviceId")
    threshold: int | None = None

    model_config = {"populate_by_name": True}


class TestHostBody(BaseModel):
    device_name: str | None = Field(default=None, alias="deviceName")
    device_ip: str | None = Field(default=None, alias="deviceIp")
    status: str | None = None
    latency: int | None = None

    model_config = {"populate_by_name": True}


@router.post("/email")
async def set_email_config(body: EmailConfigBody, current_user: dict = Depends(get_current_user)):
    pool = database.get_pool()
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE users SET email_alerts_enabled = $1, alert_email_target = $2 WHERE id = $3",
                bool(body.enabled),
                body.email,
                current_user["id"],
            )
        return {"success": True, "enabled": body.enabled, "email": body.email}
    except Exception:  # noqa: BLE001
        raise ApiError(500, "Erro ao salvar configuração")


@router.get("/email")
async def get_email_config(current_user: dict = Depends(get_current_user)):
    pool = database.get_pool()
    try:
        async with pool.acquire() as conn:
            user = await conn.fetchrow(
                "SELECT email_alerts_enabled, alert_email_target FROM users WHERE id = $1",
                current_user["id"],
            )
        return {
            "enabled": (user and user["email_alerts_enabled"]) or False,
            "email": (user and user["alert_email_target"]) or "",
        }
    except Exception:  # noqa: BLE001
        raise ApiError(500, "Erro ao buscar configuração")


@router.post("/telegram")
async def set_telegram_config(
    body: TelegramConfigBody, current_user: dict = Depends(get_current_user)
):
    pool = database.get_pool()
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE users SET telegram_alerts_enabled = $1, telegram_bot_token = $2, "
                "telegram_chat_id = $3 WHERE id = $4",
                bool(body.enabled),
                body.bot_token,
                body.chat_id,
                current_user["id"],
            )

        if body.enabled and body.bot_token and body.chat_id:
            await send_telegram_alert(
                body.bot_token,
                body.chat_id,
                "Sistema de notificações configurado com sucesso.",
                "info",
                None,
                None,
                None,
            )

        return {
            "success": True,
            "enabled": body.enabled,
            "botToken": body.bot_token,
            "chatId": body.chat_id,
        }
    except Exception:  # noqa: BLE001
        raise ApiError(500, "Erro ao salvar configuração")


@router.get("/telegram")
async def get_telegram_config(current_user: dict = Depends(get_current_user)):
    pool = database.get_pool()
    try:
        async with pool.acquire() as conn:
            user = await conn.fetchrow(
                "SELECT telegram_alerts_enabled, telegram_bot_token, telegram_chat_id "
                "FROM users WHERE id = $1",
                current_user["id"],
            )
        return {
            "enabled": (user and user["telegram_alerts_enabled"]) or False,
            "botToken": (user and user["telegram_bot_token"]) or "",
            "chatId": (user and user["telegram_chat_id"]) or "",
        }
    except Exception:  # noqa: BLE001
        raise ApiError(500, "Erro ao buscar configuração")


@router.post("/notify")
async def notify(body: NotifyBody, current_user: dict = Depends(get_current_user)):
    pool = database.get_pool()
    try:
        async with pool.acquire() as conn:
            user = await conn.fetchrow("SELECT * FROM users WHERE id = $1", current_user["id"])
        if not user:
            raise ApiError(404, "Usuário não encontrado")

        telegram_sent = False
        if user["telegram_alerts_enabled"] and user["telegram_bot_token"] and user["telegram_chat_id"]:
            telegram_sent = await send_telegram_alert(
                user["telegram_bot_token"], user["telegram_chat_id"], body.message, body.type
            )

        return {"success": True, "telegram_sent": telegram_sent, "email_sent": False}
    except ApiError:
        raise
    except Exception:  # noqa: BLE001
        raise ApiError(500, "Erro interno")


@router.post("/sla/configure")
async def configure_sla(body: SlaConfigureBody, current_user: dict = Depends(get_current_user)):
    if not body.device_id or not body.threshold:
        raise ApiError(400, "Device ID e threshold são obrigatórios")

    pool = database.get_pool()
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO sla_alerts (user_id, device_id, threshold, created_at)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, device_id)
                DO UPDATE SET threshold = $3, updated_at = CURRENT_TIMESTAMP
                """,
                current_user["id"],
                body.device_id,
                body.threshold,
            )

            device = await conn.fetchrow(
                "SELECT * FROM user_devices WHERE id = $1 AND user_id = $2",
                body.device_id,
                current_user["id"],
            )
            user = await conn.fetchrow("SELECT * FROM users WHERE id = $1", current_user["id"])

        if user and user["telegram_alerts_enabled"] and user["telegram_bot_token"] and user["telegram_chat_id"]:
            await send_telegram_alert(
                user["telegram_bot_token"],
                user["telegram_chat_id"],
                "Alerta SLA configurado com sucesso.",
                "info",
                device["name"] if device else "N/A",
                device["ip"] if device else "N/A",
                f"🎯 *Limite:* {body.threshold}ms",
            )

        return {"success": True, "message": f"Alerta SLA configurado: {body.threshold}ms"}
    except Exception:  # noqa: BLE001
        raise ApiError(500, "Erro ao configurar alerta")


@router.post("/test-telegram")
async def test_telegram(current_user: dict = Depends(get_current_user)):
    pool = database.get_pool()
    try:
        async with pool.acquire() as conn:
            user = await conn.fetchrow("SELECT * FROM users WHERE id = $1", current_user["id"])
        if not user or not user["telegram_bot_token"] or not user["telegram_chat_id"]:
            raise ApiError(400, "Telegram não configurado para este usuário")

        await send_telegram_alert(
            user["telegram_bot_token"],
            user["telegram_chat_id"],
            "Teste de conectividade realizado com sucesso.",
            "info",
            None,
            None,
            None,
        )
        return {"success": True, "message": "Mensagem de teste enviada com sucesso!"}
    except ApiError:
        raise
    except Exception:  # noqa: BLE001
        raise ApiError(500, "Erro interno ao testar")


@router.post("/test-host")
async def test_host(body: TestHostBody, current_user: dict = Depends(get_current_user)):
    pool = database.get_pool()
    try:
        async with pool.acquire() as conn:
            user = await conn.fetchrow("SELECT * FROM users WHERE id = $1", current_user["id"])
        if not user or not user["telegram_bot_token"] or not user["telegram_chat_id"]:
            raise ApiError(400, "Telegram não configurado")

        await send_telegram_alert(
            user["telegram_bot_token"],
            user["telegram_chat_id"],
            "Teste de alerta executado com sucesso.",
            "success" if body.status == "online" else "error",
            body.device_name,
            body.device_ip,
            f"⚡ *Latência:* {body.latency if body.latency is not None else 'N/A'}ms",
        )
        return {"success": True, "message": "Alerta enviado!"}
    except ApiError:
        raise
    except Exception:  # noqa: BLE001
        raise ApiError(500, "Erro interno")
