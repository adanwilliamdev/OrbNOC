"""baseline schema

Migration baseline que espelha exatamente o schema hoje criado "na mão" em
app/database.py (TABLE_DEFINITIONS). Não muda nenhuma coluna, tipo, default
ou índice existente — apenas passa a versionar o schema pelo Alembic.

Em um banco que já existe (produção/homolog rodando com o app/database.py
antigo), aplique com:

    alembic stamp head

Isso marca o banco como "já na baseline" sem tentar recriar as tabelas.
Em um banco novo (ex.: CI, ambiente local do zero), use:

    alembic upgrade head

que efetivamente cria as tabelas.

Revision ID: 19001c56d42e
Revises:
Create Date: 2026-09-12
"""
import sqlalchemy as sa
from alembic import op

revision = "19001c56d42e"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(length=100), nullable=False, unique=True),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("password", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=50), server_default="user"),
        sa.Column("telegram_alerts_enabled", sa.Boolean(), server_default=sa.false()),
        sa.Column("telegram_bot_token", sa.Text(), nullable=True),
        sa.Column("telegram_chat_id", sa.String(length=100), nullable=True),
        sa.Column("email_alerts_enabled", sa.Boolean(), server_default=sa.false()),
        sa.Column("alert_email_target", sa.String(length=255), nullable=True),
        sa.Column("last_login", sa.TIMESTAMP(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.func.current_timestamp()),
    )

    op.create_table(
        "user_devices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("device_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("ip", sa.String(length=45), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="offline"),
        sa.Column("latency", sa.Integer(), nullable=True),
        sa.Column("avg_latency", sa.Integer(), nullable=True),
        sa.Column("min_latency", sa.Integer(), nullable=True),
        sa.Column("max_latency", sa.Integer(), nullable=True),
        sa.Column("jitter", sa.Integer(), server_default="0"),
        sa.Column("packet_loss", sa.Integer(), server_default="0"),
        sa.Column("last_check", sa.TIMESTAMP(), nullable=True),
        sa.Column("last_ping_stats", sa.TIMESTAMP(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.func.current_timestamp()),
    )

    op.create_table(
        "access_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("action", sa.String(length=50), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.func.current_timestamp()),
    )

    op.create_table(
        "sla_alerts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("device_id", sa.Integer(), nullable=False),
        sa.Column("threshold", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.func.current_timestamp()),
        sa.Column("updated_at", sa.TIMESTAMP(), server_default=sa.func.current_timestamp()),
        sa.UniqueConstraint("user_id", "device_id", name="sla_alerts_user_id_device_id_key"),
    )

    op.create_table(
        "device_metrics",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("device_id", sa.Integer(), sa.ForeignKey("user_devices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("latency", sa.Integer(), nullable=True),
        sa.Column("packet_loss", sa.Integer(), nullable=True),
        sa.Column("jitter", sa.Integer(), nullable=True),
        sa.Column("recorded_at", sa.TIMESTAMP(), server_default=sa.func.current_timestamp()),
    )
    op.create_index(
        "idx_device_metrics_device_time",
        "device_metrics",
        ["device_id", "recorded_at"],
        postgresql_ops={"recorded_at": "DESC"},
    )


def downgrade() -> None:
    op.drop_index("idx_device_metrics_device_time", table_name="device_metrics")
    op.drop_table("device_metrics")
    op.drop_table("sla_alerts")
    op.drop_table("access_logs")
    op.drop_table("user_devices")
    op.drop_table("users")
