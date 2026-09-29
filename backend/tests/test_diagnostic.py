import asyncio

import pytest

from app.services.diagnostics import parse_traceroute


async def test_ping_localhost(alice, client):
    r = await client.post("/api/diagnostic/ping", json={"host": "127.0.0.1", "count": 3})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "online" and body["received"] >= 1 and body["packet_loss"] == 0.0


@pytest.mark.parametrize(
    "host",
    [
        "169.254.169.254",
        "0.0.0.0",
        "127.0.0.1; id",
        "$(whoami)",
        "`id`",
        "-oProxyCommand=x",
        "a b",
        "x|y",
        "../etc/passwd",
        "1234",
    ],
)
@pytest.mark.parametrize("endpoint", ["ping", "traceroute", "port-check"])
async def test_hosts_perigosos_sao_rejeitados(alice, client, endpoint, host):
    body = {"host": host, **({"ports": [80]} if endpoint == "port-check" else {})}
    r = await client.post(f"/api/diagnostic/{endpoint}", json=body)
    assert r.status_code == 422, (endpoint, host)


async def test_loopback_bloqueado_quando_configurado(alice, client, settings, monkeypatch):
    monkeypatch.setattr(settings, "allow_loopback_targets", False)
    r = await client.post("/api/diagnostic/port-check", json={"host": "127.0.0.1", "ports": [22]})
    assert r.status_code == 422 and "loopback" in r.json()["error"]


async def test_port_check(alice, client):
    server = await asyncio.start_server(lambda r, w: w.close(), "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    async with server:
        r = await client.post(
            "/api/diagnostic/port-check", json={"host": "127.0.0.1", "ports": [port, 1, port]}
        )
    results = {x["port"]: x for x in r.json()["results"]}
    assert len(results) == 2 and results[port]["open"] is True and results[1]["open"] is False


async def test_limites_de_entrada(alice, client):
    assert (
        await client.post("/api/diagnostic/ping", json={"host": "127.0.0.1", "count": 500})
    ).status_code == 422
    assert (
        await client.post(
            "/api/diagnostic/port-check", json={"host": "127.0.0.1", "ports": list(range(1, 200))}
        )
    ).status_code == 422
    assert (
        await client.post("/api/diagnostic/port-check", json={"host": "127.0.0.1", "ports": [0]})
    ).status_code == 422


async def test_traceroute_real_ate_localhost(alice, client):
    r = await client.post("/api/diagnostic/traceroute", json={"host": "127.0.0.1"})
    if r.status_code == 422 and "não está instalado" in r.json()["error"]:
        pytest.skip("traceroute ausente neste ambiente")
    assert r.status_code == 200 and r.json()["reached"] is True and r.json()["hops"][0]["ip"] == "127.0.0.1"


async def test_dns_tipo_invalido_e_dominio_invalido(alice, client):
    assert (
        await client.post("/api/diagnostic/dns", json={"domain": "example.com", "record_type": "AXFR"})
    ).status_code == 422
    assert (await client.post("/api/diagnostic/dns", json={"domain": "exa mple;.com"})).status_code == 422


async def test_rate_limit_por_usuario(alice, client, settings, monkeypatch):
    monkeypatch.setattr(settings, "diagnostic_rate_limit_per_minute", 3)
    for _ in range(3):
        assert (
            await client.post("/api/diagnostic/port-check", json={"host": "127.0.0.1", "ports": [1]})
        ).status_code == 200
    r = await client.post("/api/diagnostic/port-check", json={"host": "127.0.0.1", "ports": [1]})
    assert r.status_code == 429 and r.headers["retry-after"] == "60"


async def test_diagnostico_completo(alice, client):
    r = await client.post("/api/diagnostic/full", json={"host": "127.0.0.1", "ports": [1]})
    assert r.status_code == 200
    body = r.json()
    assert (
        body["ping"]["status"] == "online" and body["findings"] and "dns" not in body
    )  # IP literal não consulta DNS


def test_parse_traceroute():
    hops = parse_traceroute(
        "traceroute to 8.8.8.8, 20 hops max\n 1  192.168.0.1  1.2 ms\n 2  *\n 3  8.8.8.8  9.0 ms\n"
    )
    assert [h["hop"] for h in hops] == [1, 2, 3] and hops[1]["timeout"] and hops[2]["latency"] == 9.0
