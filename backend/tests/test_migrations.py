import os
import subprocess
import sys
import uuid
from pathlib import Path

import asyncpg
from sqlalchemy.engine import make_url

BACKEND = Path(__file__).resolve().parent.parent


async def test_migrations_sobem_batem_com_os_modelos_e_descem():
    """Banco vazio -> `alembic upgrade head` -> `alembic check` (sem diferenças) -> `downgrade base`."""
    base = make_url(os.environ["DATABASE_URL"])
    name = f"orbnoc_mig_{uuid.uuid4().hex[:8]}"
    admin = await asyncpg.connect(
        user=base.username,
        password=base.password,
        host=base.host,
        port=base.port or 5432,
        database="postgres",
    )
    await admin.execute(f'CREATE DATABASE "{name}"')
    env = {**os.environ, "DATABASE_URL": base.set(database=name).render_as_string(hide_password=False)}

    def alembic(*args):
        return subprocess.run(
            [sys.executable, "-m", "alembic", *args],
            cwd=BACKEND,
            env=env,
            capture_output=True,
            text=True,
            timeout=120,
        )  # noqa: S603

    try:
        up = alembic("upgrade", "head")
        assert up.returncode == 0, up.stderr
        check = alembic("check")
        assert check.returncode == 0, check.stdout + check.stderr
        down = alembic("downgrade", "base")
        assert down.returncode == 0, down.stderr
    finally:
        await admin.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
        await admin.close()
