from sqlalchemy import select

from app.db.models import Device
from app.services.probes import ProbeResult


async def add(client, **kw):
    body = {"name": "Roteador", "ip": "10.0.0.1", **kw}
    return await client.post("/api/devices", json=body)


async def test_requires_auth(client):
    for method, url in [
        ("get", "/api/devices"),
        ("post", "/api/devices"),
        ("delete", "/api/devices/1"),
    ]:
        assert (await getattr(client, method)(url)).status_code == 401


async def test_create_list_and_defaults(alice):
    r = await add(alice, location="Sala 1")
    assert r.status_code == 201
    d = r.json()
    assert d["status"] == "unknown" and d["check_type"] == "icmp" and d["failure_threshold"] == 3
    assert d["latency"] is None and d["sla_threshold_ms"] is None
    assert [x["ip"] for x in (await alice.get("/api/devices")).json()] == ["10.0.0.1"]


async def test_duplicate_ip_conflict(alice):
    await add(alice)
    assert (await add(alice, name="outro")).status_code == 409


async def test_validation(alice):
    assert (await add(alice, name="")).status_code == 422
    assert (await add(alice, ip="bad host!")).status_code == 422
    assert (await add(alice, ip="-oProxyCommand=x")).status_code == 422
    assert (await add(alice, check_type="tcp")).status_code == 422  # tcp exige porta
    assert (await add(alice, check_type="tcp", port=443)).status_code == 201
    assert (await add(alice, ip="10.0.0.2", interval_seconds=1)).status_code == 422


async def test_blocks_loopback_and_cloud_metadata(alice):
    for host in ("127.0.0.1", "localhost", "169.254.169.254", "::1", "0.0.0.0"):
        r = await add(alice, ip=host)
        assert r.status_code == 422, host


async def test_private_networks_can_be_disabled(alice, settings):
    settings.allow_private_networks = False
    try:
        assert (await add(alice, ip="192.168.0.10")).status_code == 422
    finally:
        settings.allow_private_networks = True


async def test_data_is_per_user(alice, bob_client):
    d = (await add(alice)).json()
    assert (await bob_client.get("/api/devices")).json() == []
    assert (await bob_client.delete(f"/api/devices/{d['id']}")).status_code == 404
    assert (await bob_client.get(f"/api/devices/{d['id']}/ping")).status_code == 404
    assert (await bob_client.get(f"/api/devices/{d['id']}/history")).status_code == 404
    assert (
        await bob_client.patch(f"/api/devices/{d['id']}", json={"name": "x"})
    ).status_code == 404
    assert len((await alice.get("/api/devices")).json()) == 1
    # o mesmo IP pode existir em contas diferentes
    assert (await add(bob_client)).status_code == 201


async def test_patch_and_sla_config(alice, sessionmaker):
    d = (await add(alice)).json()
    r = await alice.patch(f"/api/devices/{d['id']}", json={"name": "Core", "sla_threshold_ms": 80})
    assert r.json()["name"] == "Core" and r.json()["sla_threshold_ms"] == 80
    r = await alice.post(
        "/api/alerts/sla/configure", json={"device_id": d["id"], "threshold_ms": 120}
    )
    assert r.status_code == 200
    async with sessionmaker() as s:
        assert (await s.scalar(select(Device))).sla_threshold_ms == 120
    r = await alice.post(
        "/api/alerts/sla/configure", json={"device_id": d["id"], "threshold_ms": None}
    )
    assert r.status_code == 200
    r = await alice.patch(f"/api/devices/{d['id']}", json={"sla_threshold_ms": None})
    assert r.json()["sla_threshold_ms"] is None


async def test_delete(alice):
    d = (await add(alice)).json()
    assert (await alice.delete(f"/api/devices/{d['id']}")).json() == {"success": True}
    assert (await alice.get("/api/devices")).json() == []


async def test_manual_ping_uses_prober_and_reports_zero_latency(alice, prober):
    d = (await add(alice)).json()
    prober.results["10.0.0.1"] = ProbeResult(True, 0.0, "icmp")
    body = (await alice.get(f"/api/devices/{d['id']}/ping")).json()
    assert body["status"] == "online" and body["latency_ms"] == 0.0 and body["method"] == "icmp"
    prober.results["10.0.0.1"] = ProbeResult(False, None, "icmp", None, "sem resposta")
    body = (await alice.get(f"/api/devices/{d['id']}/ping")).json()
    assert body["status"] == "offline" and body["latency_ms"] is None


async def test_history_and_sla_empty(alice):
    d = (await add(alice)).json()
    h = (await alice.get(f"/api/devices/{d['id']}/history?hours=24")).json()
    assert h["points"] == [] and h["summary"]["sample_count"] == 0
    s = (await alice.get(f"/api/devices/{d['id']}/sla")).json()
    assert set(s["windows"]) == {"24h", "7d", "30d"}
    assert (await alice.get(f"/api/devices/{d['id']}/history?hours=99999")).status_code == 422


async def test_check_port_validates_input(alice):
    d = (await add(alice)).json()
    assert (
        await alice.post(f"/api/devices/{d['id']}/check-port", json={"port": 70000})
    ).status_code == 422
    assert (await alice.post(f"/api/devices/{d['id']}/check-port", json={})).status_code == 422
