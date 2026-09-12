"""
Testes do DeviceService: regra de negócio (IP duplicado, dispositivo não
encontrado, etc.) rodando contra o banco de teste real (SQLite in-memory).
`ping_service` e `telegram_service` são mockados — não fazem sentido de
integração aqui (rede real) e já têm testes próprios.
"""
import pytest

from app.auth_dependency import ApiError
from app.db.models import User
from app.services.device_service import DeviceService


async def _create_user(session, **overrides) -> User:
    defaults = dict(username="alice", email="alice@example.com", password="hashed")
    defaults.update(overrides)
    user = User(**defaults)
    session.add(user)
    await session.flush()
    await session.commit()
    return user


async def test_add_device_success(db_session, monkeypatch):
    sent_alerts = []
    monkeypatch.setattr(
        "app.services.device_service.send_telegram_alert",
        lambda *a, **k: sent_alerts.append((a, k)),
    )
    user = await _create_user(db_session)
    service = DeviceService(db_session)

    result = await service.add_device(user_id=user.id, name="Router", ip="10.0.0.1", location="Rack 1")

    assert result["name"] == "Router"
    assert result["ip"] == "10.0.0.1"
    # Telegram desabilitado por padrão para o usuário -> nenhum alerta enviado
    assert sent_alerts == []


async def test_add_device_sends_telegram_alert_when_enabled(db_session, monkeypatch):
    sent_alerts = []

    async def fake_send(*args, **kwargs):
        sent_alerts.append(args)

    monkeypatch.setattr("app.services.device_service.send_telegram_alert", fake_send)
    user = await _create_user(
        db_session,
        telegram_alerts_enabled=True,
        telegram_bot_token="token123",
        telegram_chat_id="chat123",
    )
    service = DeviceService(db_session)

    await service.add_device(user_id=user.id, name="Router", ip="10.0.0.1", location=None)

    assert len(sent_alerts) == 1
    assert sent_alerts[0][0] == "token123"


async def test_add_device_missing_name_or_ip_raises_400(db_session):
    user = await _create_user(db_session)
    service = DeviceService(db_session)

    with pytest.raises(ApiError) as exc_info:
        await service.add_device(user_id=user.id, name=None, ip="10.0.0.1", location=None)
    assert exc_info.value.status_code == 400


async def test_add_device_duplicate_ip_raises_400(db_session, monkeypatch):
    monkeypatch.setattr("app.services.device_service.send_telegram_alert", lambda *a, **k: None)
    user = await _create_user(db_session)
    service = DeviceService(db_session)
    await service.add_device(user_id=user.id, name="Router", ip="10.0.0.1", location=None)

    with pytest.raises(ApiError) as exc_info:
        await service.add_device(user_id=user.id, name="Router 2", ip="10.0.0.1", location=None)
    assert exc_info.value.status_code == 400


async def test_delete_device_not_found_raises_404(db_session):
    user = await _create_user(db_session)
    service = DeviceService(db_session)

    with pytest.raises(ApiError) as exc_info:
        await service.delete_device(user_id=user.id, device_id=999)
    assert exc_info.value.status_code == 404


async def test_delete_device_success(db_session, monkeypatch):
    monkeypatch.setattr("app.services.device_service.send_telegram_alert", lambda *a, **k: None)
    user = await _create_user(db_session)
    service = DeviceService(db_session)
    created = await service.add_device(user_id=user.id, name="Router", ip="10.0.0.1", location=None)

    await service.delete_device(user_id=user.id, device_id=created["id"])

    assert await service.list_devices(user.id) == []


async def test_ping_device_updates_latency(db_session, monkeypatch):
    monkeypatch.setattr("app.services.device_service.send_telegram_alert", lambda *a, **k: None)

    async def fake_tcp_ping(ip):
        return {"alive": True, "latency": 15}

    monkeypatch.setattr("app.services.device_service.ping_service.tcp_ping", fake_tcp_ping)

    user = await _create_user(db_session)
    service = DeviceService(db_session)
    created = await service.add_device(user_id=user.id, name="Router", ip="10.0.0.1", location=None)

    result = await service.ping_device(user_id=user.id, device_id=created["id"])

    assert result["status"] == "online"
    assert result["latency_ms"] == 15


async def test_ping_device_not_found_raises_404(db_session):
    user = await _create_user(db_session)
    service = DeviceService(db_session)

    with pytest.raises(ApiError) as exc_info:
        await service.ping_device(user_id=user.id, device_id=999)
    assert exc_info.value.status_code == 404


async def test_check_port_requires_port(db_session, monkeypatch):
    monkeypatch.setattr("app.services.device_service.send_telegram_alert", lambda *a, **k: None)
    user = await _create_user(db_session)
    service = DeviceService(db_session)
    created = await service.add_device(user_id=user.id, name="Router", ip="10.0.0.1", location=None)

    with pytest.raises(ApiError) as exc_info:
        await service.check_port(user_id=user.id, device_id=created["id"], port=None)
    assert exc_info.value.status_code == 400


async def test_get_history_not_found_raises_404(db_session):
    user = await _create_user(db_session)
    service = DeviceService(db_session)

    with pytest.raises(ApiError) as exc_info:
        await service.get_history(user_id=user.id, device_id=999, hours=24, limit=100)
    assert exc_info.value.status_code == 404
