"""
Rotas restritas a administradores (role='admin').

Antes o campo `role` existia no schema mas nenhuma rota o utilizava de
fato — qualquer usuário autenticado tinha o mesmo nível de acesso.
Este módulo aplica `require_admin` para dar uso real ao RBAC.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, Query

from .. import database
from ..auth_dependency import ApiError, require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _serialize(row) -> dict:
    data = dict(row)
    for key, value in data.items():
        if isinstance(value, datetime):
            data[key] = value.isoformat()
    return data


@router.get("/users")
async def list_users(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(require_admin),
):
    """Lista todos os usuários da plataforma (sem o hash de senha)."""
    pool = database.get_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT id, username, email, role, telegram_alerts_enabled, "
                "email_alerts_enabled, last_login, created_at FROM users "
                "ORDER BY id LIMIT $1 OFFSET $2",
                limit,
                offset,
            )
            total = await conn.fetchval("SELECT COUNT(*) FROM users")
        return {
            "items": [_serialize(r) for r in rows],
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    except Exception:  # noqa: BLE001
        raise ApiError(500, "Erro ao buscar usuários")


@router.get("/access-logs")
async def list_access_logs(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(require_admin),
):
    """Lista o histórico de login/logout/registro de todos os usuários."""
    pool = database.get_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT access_logs.id, access_logs.action, access_logs.ip_address, "
                "access_logs.created_at, users.username FROM access_logs "
                "JOIN users ON users.id = access_logs.user_id "
                "ORDER BY access_logs.id DESC LIMIT $1 OFFSET $2",
                limit,
                offset,
            )
            total = await conn.fetchval("SELECT COUNT(*) FROM access_logs")
        return {
            "items": [_serialize(r) for r in rows],
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    except Exception:  # noqa: BLE001
        raise ApiError(500, "Erro ao buscar logs de acesso")


@router.delete("/users/{user_id}")
async def delete_user(user_id: int, current_user: dict = Depends(require_admin)):
    """Remove um usuário (e seus devices/alertas, via ON DELETE CASCADE)."""
    if user_id == current_user["id"]:
        raise ApiError(400, "Não é possível remover o próprio usuário logado")

    pool = database.get_pool()
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "DELETE FROM users WHERE id = $1 RETURNING id, username", user_id
            )
        if not row:
            raise ApiError(404, "Usuário não encontrado")
        return {"success": True}
    except ApiError:
        raise
    except Exception:  # noqa: BLE001
        raise ApiError(500, "Erro ao remover usuário")
