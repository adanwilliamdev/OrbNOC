"""intervalo de checagem padrão de 30 s

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("devices", "interval_seconds", server_default=sa.text("30"))


def downgrade() -> None:
    op.alter_column("devices", "interval_seconds", server_default=sa.text("10"))
