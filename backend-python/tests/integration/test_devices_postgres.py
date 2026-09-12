"""
Testes de integração contra um Postgres real (testcontainers), não contra
o SQLite dos testes unitários. O objetivo aqui não é repetir a cobertura
de tests/test_device_repository.py — é pegar o que só aparece com o
dialeto Postgres de verdade: a migration do Alembic rodando (SERIAL,
BIGSERIAL, FOREIGN KEY ... ON DELETE CASCADE, o índice DESC) e o driver
asyncpg.

Requer Docker. Sem Docker disponível, a fixture `postgres_dsn` pula estes
testes automaticamente (ver tests/conftest.py).
"""
from app.db.models import User
from app.repositories.device_repository import DeviceRepository
from app.services.device_service import DeviceService


async def _create_user(session, username="alice") -> User:
    user = User(username=username, email=f"{username}@example.com", password="hashed")
    session.add(user)
    await session.flush()
    await session.commit()
    return user


async def test_device_crud_against_real_postgres(pg_session):
    user = await _create_user(pg_session)
    repo = DeviceRepository(pg_session)

    device = await repo.create(
        user_id=user.id, device_id=123, name="Router", ip="10.0.0.1", location="Rack 1"
    )
    await pg_session.commit()

    fetched = await repo.get_by_id_for_user(device.id, user.id)
    assert fetched is not None
    assert fetched.name == "Router"
    # created_at usa CURRENT_TIMESTAMP do Postgres (server_default) — só
    # existe de verdade quando a INSERT roda contra o Postgres real.
    assert fetched.created_at is not None


async def test_on_delete_cascade_removes_metrics_in_real_postgres(pg_session):
    """
    Valida a FK `device_metrics.device_id ... ON DELETE CASCADE` de
    verdade — esse comportamento é do banco, não do SQLAlchemy, então só
    um Postgres real confirma que a migration criou a constraint certa.
    """
    from sqlalchemy import select

    from app.db.models import DeviceMetric

    user = await _create_user(pg_session)
    repo = DeviceRepository(pg_session)
    device = await repo.create(user_id=user.id, device_id=1, name="Router", ip="10.0.0.1", location=None)
    await pg_session.commit()

    pg_session.add(DeviceMetric(device_id=device.id, status="online", latency=10))
    await pg_session.commit()

    await repo.delete(device)
    await pg_session.commit()

    remaining = (await pg_session.execute(select(DeviceMetric))).scalars().all()
    assert remaining == []


async def test_device_service_full_lifecycle_against_real_postgres(pg_session, monkeypatch):
    monkeypatch.setattr("app.services.device_service.send_telegram_alert", lambda *a, **k: None)
    user = await _create_user(pg_session)
    service = DeviceService(pg_session)

    created = await service.add_device(user_id=user.id, name="Switch", ip="10.0.0.5", location=None)
    assert created["ip"] == "10.0.0.5"

    devices = await service.list_devices(user.id)
    assert len(devices) == 1

    await service.delete_device(user_id=user.id, device_id=created["id"])
    assert await service.list_devices(user.id) == []
