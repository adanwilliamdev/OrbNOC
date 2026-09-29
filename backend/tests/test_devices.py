import asyncio

import pytest

from .conftest import add_device


async def test_crud_completo(alice, client):
    r = await client.post(
        "/api/devices",
        json={"name": " Core Switch ", "ip": "10.0.0.1", "location": "DC-1", "sla_threshold_ms": 50},
    )
    assert r.status_code == 201
    d = r.json()
    assert (
        d["name"] == "Core Switch"
        and d["status"] == "unknown"
        and d["check_type"] == "icmp"
        and d["latency"] is None
    )
    assert [x["id"] for x in (await client.get("/api/devices")).json()] == [d["id"]]

    r = await client.patch(f"/api/devices/{d['id']}", json={"name": "Core SW", "sla_threshold_ms": 80})
    assert r.status_code == 200 and r.json()["name"] == "Core SW" and r.json()["sla_threshold_ms"] == 80
    assert (await client.delete(f"/api/devices/{d['id']}")).status_code == 204
    assert (await client.get(f"/api/devices/{d['id']}")).status_code == 404


@pytest.mark.parametrize(
    ("payload", "trecho"),
    [
        ({"name": "x", "ip": "169.254.169.254"}, "bloqueado"),
        ({"name": "x", "ip": "0.0.0.0"}, "válido"),
        ({"name": "x", "ip": "a b; rm -rf /"}, "inválido"),
        ({"name": "x", "ip": "10.0.0.1", "check_type": "tcp"}, "porta"),
        ({"name": "   ", "ip": "10.0.0.1"}, "vazio"),
        ({"name": "x", "ip": "10.0.0.1", "check_type": "ftp"}, ""),
        ({"name": "x", "ip": "10.0.0.1", "port": 70000, "check_type": "tcp"}, ""),
        ({"name": "x", "ip": "10.0.0.1", "sla_threshold_ms": 0}, ""),
        ({"name": "x", "ip": "10.0.0.1", "sla_threshold_ms": 999999}, ""),
    ],
)
async def test_validacao_na_criacao(alice, client, payload, trecho):
    r = await client.post("/api/devices", json=payload)
    assert r.status_code == 422 and trecho in r.json()["error"]


async def test_duplicado_409_mas_portas_diferentes_ok(alice, client):
    base = {"name": "Web", "ip": "10.0.0.5", "check_type": "tcp"}
    assert (await client.post("/api/devices", json={**base, "port": 80})).status_code == 201
    assert (await client.post("/api/devices", json={**base, "port": 80})).status_code == 409
    assert (await client.post("/api/devices", json={**base, "port": 443})).status_code == 201
    assert (await client.post("/api/devices", json={"name": "ping", "ip": "10.0.0.5"})).status_code == 201


async def test_hostname_que_nao_resolve_e_aceito(alice, client):
    """Equipamento pode estar fora do ar no cadastro."""
    r = await client.post("/api/devices", json={"name": "Fora", "ip": "equipamento-inexistente.invalid"})
    assert r.status_code == 201


async def test_isolamento_entre_usuarios(db, alice, client, bob_client):
    mine = await add_device(db, alice.id, "Meu", "10.0.0.9")
    assert (await bob_client.get("/api/devices")).json() == []
    for method, url in [
        ("get", ""),
        ("patch", ""),
        ("delete", ""),
        ("post", "/ping"),
        ("get", "/history"),
        ("get", "/sla"),
    ]:
        kw = {"json": {"name": "hack"}} if method == "patch" else {}
        r = await getattr(bob_client, method)(f"/api/devices/{mine.id}{url}", **kw)
        assert r.status_code == 404, (method, url)
    assert (await client.get(f"/api/devices/{mine.id}")).status_code == 200


async def test_alterar_alvo_reseta_estado(db, alice, client):
    d = await add_device(db, alice.id, ip="10.0.0.1", status="offline", consecutive_failures=7, latency=12.0)
    r = await client.patch(f"/api/devices/{d.id}", json={"location": "novo local"})
    assert r.json()["status"] == "offline"  # só metadado: estado preservado
    r = await client.patch(f"/api/devices/{d.id}", json={"ip": "10.0.0.2"})
    assert (
        r.json()["status"] == "unknown"
        and r.json()["consecutive_failures"] == 0
        and r.json()["latency"] is None
    )


async def test_patch_para_tcp_exige_porta(db, alice, client):
    d = await add_device(db, alice.id, ip="10.0.0.1")
    assert (await client.patch(f"/api/devices/{d.id}", json={"check_type": "tcp"})).status_code == 422
    assert (
        await client.patch(f"/api/devices/{d.id}", json={"check_type": "tcp", "port": 22})
    ).status_code == 200


async def test_verificacao_manual_tcp_aberto_e_fechado(db, alice, client):
    server = await asyncio.start_server(lambda r, w: w.close(), "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    async with server:
        open_dev = await add_device(db, alice.id, "aberto", "127.0.0.1", check_type="tcp", port=port)
        closed_dev = await add_device(db, alice.id, "fechado", "127.0.0.1", check_type="tcp", port=1)
        ok = (await client.post(f"/api/devices/{open_dev.id}/ping")).json()
        bad = (await client.post(f"/api/devices/{closed_dev.id}/ping")).json()
    assert ok["online"] is True and ok["latency_ms"] is not None and ok["method"] == "tcp"
    assert bad["online"] is False and "fechada" in bad["error"]


async def test_verificacao_manual_icmp_localhost(db, alice, client):
    d = await add_device(db, alice.id, ip="127.0.0.1")
    r = (await client.post(f"/api/devices/{d.id}/ping")).json()
    assert r["online"] is True  # ICMP real, ou fallback TCP (RST conta como vivo)


async def test_verificacao_manual_bloqueia_alvo_proibido(db, alice, client):
    d = await add_device(db, alice.id, ip="169.254.169.254")  # inserido direto, contornando o cadastro
    r = (await client.post(f"/api/devices/{d.id}/ping")).json()
    assert r["online"] is False and "bloqueado" in r["error"]


async def test_historico_e_sla_vazios(db, alice, client):
    d = await add_device(db, alice.id)
    h = (await client.get(f"/api/devices/{d.id}/history?hours=24")).json()
    assert h["points"] == [] and h["summary"]["uptime_pct"] is None
    assert (await client.get(f"/api/devices/{d.id}/history?hours=999")).status_code == 422
    sla = (await client.get(f"/api/devices/{d.id}/sla")).json()
    assert set(sla) == {"24h", "7d", "30d"}
