"""
Testes de integração do DeviceRepository. Rodam contra um SQLite
in-memory criado a partir dos models reais (mesmo schema usado em
produção contra o Postgres) — validam que o SQL gerado pelo SQLAlchemy
funciona de verdade, não só que os mocks foram chamados certo.
"""
from datetime import datetime, timedelta, timezone

from app.db.models import DeviceMetric, User
from app.repositories.device_repository import DeviceRepository


async def _create_user(session, username="alice") -> User:
    user = User(username=username, email=f"{username}@example.com", password="hashed")
    session.add(user)
    await session.flush()
    return user


async def test_create_and_list_for_user(db_session):
    user = await _create_user(db_session)
    repo = DeviceRepository(db_session)

    await repo.create(user_id=user.id, device_id=111, name="Router", ip="10.0.0.1", location="Rack 1")
    await db_session.commit()

    devices = await repo.list_for_user(user.id)
    assert len(devices) == 1
    assert devices[0].name == "Router"
    assert devices[0].ip == "10.0.0.1"


async def test_list_for_user_does_not_leak_other_users_devices(db_session):
    alice = await _create_user(db_session, "alice")
    bob = await _create_user(db_session, "bob")
    repo = DeviceRepository(db_session)

    await repo.create(user_id=alice.id, device_id=1, name="Alice device", ip="10.0.0.1", location=None)
    await repo.create(user_id=bob.id, device_id=2, name="Bob device", ip="10.0.0.2", location=None)
    await db_session.commit()

    alice_devices = await repo.list_for_user(alice.id)
    assert [d.name for d in alice_devices] == ["Alice device"]


async def test_get_by_ip_returns_none_when_not_found(db_session):
    user = await _create_user(db_session)
    repo = DeviceRepository(db_session)

    assert await repo.get_by_ip(user.id, "10.0.0.99") is None


async def test_get_by_id_for_user_scopes_by_owner(db_session):
    alice = await _create_user(db_session, "alice")
    bob = await _create_user(db_session, "bob")
    repo = DeviceRepository(db_session)

    device = await repo.create(user_id=alice.id, device_id=1, name="Router", ip="10.0.0.1", location=None)
    await db_session.commit()

    assert await repo.get_by_id_for_user(device.id, alice.id) is not None
    assert await repo.get_by_id_for_user(device.id, bob.id) is None


async def test_delete_removes_device(db_session):
    user = await _create_user(db_session)
    repo = DeviceRepository(db_session)
    device = await repo.create(user_id=user.id, device_id=1, name="Router", ip="10.0.0.1", location=None)
    await db_session.commit()

    await repo.delete(device)
    await db_session.commit()

    assert await repo.get_by_id_for_user(device.id, user.id) is None


async def test_update_ping_result_sets_latency_and_last_check(db_session):
    user = await _create_user(db_session)
    repo = DeviceRepository(db_session)
    device = await repo.create(user_id=user.id, device_id=1, name="Router", ip="10.0.0.1", location=None)
    await db_session.commit()

    await repo.update_ping_result(device, latency=42)
    await db_session.commit()

    refreshed = await repo.get_by_id_for_user(device.id, user.id)
    assert refreshed.latency == 42
    assert refreshed.last_check is not None


async def test_metrics_since_filters_by_window_and_orders_ascending(db_session):
    user = await _create_user(db_session)
    repo = DeviceRepository(db_session)
    device = await repo.create(user_id=user.id, device_id=1, name="Router", ip="10.0.0.1", location=None)
    await db_session.commit()

    now = datetime.now(timezone.utc)
    old_metric = DeviceMetric(
        device_id=device.id, status="online", latency=10, recorded_at=now - timedelta(hours=48)
    )
    recent_metric_1 = DeviceMetric(
        device_id=device.id, status="online", latency=20, recorded_at=now - timedelta(hours=2)
    )
    recent_metric_2 = DeviceMetric(
        device_id=device.id, status="offline", latency=None, recorded_at=now - timedelta(hours=1)
    )
    db_session.add_all([old_metric, recent_metric_1, recent_metric_2])
    await db_session.commit()

    points = await repo.metrics_since(device.id, hours=24, limit=500)

    assert [p.latency for p in points] == [20, None]
    assert points[0].recorded_at < points[1].recorded_at


async def test_delete_sla_alert_removes_only_matching_row(db_session):
    from app.db.models import SlaAlert

    user = await _create_user(db_session)
    repo = DeviceRepository(db_session)
    db_session.add(SlaAlert(user_id=user.id, device_id=1, threshold=90))
    db_session.add(SlaAlert(user_id=user.id, device_id=2, threshold=95))
    await db_session.commit()

    await repo.delete_sla_alert(user.id, 1)
    await db_session.commit()

    from sqlalchemy import select

    remaining = (await db_session.execute(select(SlaAlert))).scalars().all()
    assert [a.device_id for a in remaining] == [2]
