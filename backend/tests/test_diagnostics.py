import asyncio

import pytest

from app.services import diagnostics
from app.services.probes import ProbeResult, tcp_probe, tcp_probe_any

TRACE = """traceroute to 10.9.9.9 (10.9.9.9), 20 hops max, 60 byte packets
 1  192.168.1.1  1.234 ms
 2  * 
 3  10.20.30.1  12.5 ms
 4  10.9.9.9  20.1 ms
"""


def test_parse_traceroute():
    hops = diagnostics.parse_traceroute(TRACE)
    assert hops == [
        {"hop": 1, "ip": "192.168.1.1", "latency": 1.234},
        {"hop": 2, "ip": None, "latency": None},
        {"hop": 3, "ip": "10.20.30.1", "latency": 12.5},
        {"hop": 4, "ip": "10.9.9.9", "latency": 20.1},
    ]


async def test_traceroute_never_uses_a_shell_and_passes_args_as_list(monkeypatch):
    captured = {}

    class Proc:
        async def communicate(self):
            return TRACE.encode(), b""

    async def fake_exec(*args, **kwargs):
        captured["args"], captured["kwargs"] = args, kwargs
        return Proc()

    monkeypatch.setattr(diagnostics.shutil, "which", lambda name: "/usr/bin/traceroute")
    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_exec)
    hops = await diagnostics.run_traceroute("10.9.9.9", 15)
    assert len(hops) == 4
    assert captured["args"][0] == "/usr/bin/traceroute" and "--" in captured["args"]
    assert (
        captured["args"][-1] == "10.9.9.9"
        and captured["args"][captured["args"].index("-m") + 1] == "15"
    )
    assert "shell" not in captured["kwargs"]


async def test_traceroute_missing_binary(monkeypatch):
    monkeypatch.setattr(diagnostics.shutil, "which", lambda name: None)
    with pytest.raises(RuntimeError):
        await diagnostics.run_traceroute("10.9.9.9")


async def test_diagnostic_requires_auth(client):
    r = await client.post("/api/diagnostic/ping", json={"host": "10.0.0.1"})
    assert r.status_code == 401


@pytest.mark.parametrize(
    "path,body",
    [
        ("ping", {"host": "127.0.0.1"}),
        ("traceroute", {"host": "169.254.169.254"}),
        ("port-check", {"host": "localhost", "ports": [22]}),
        ("full-diagnostic", {"host": "::1"}),
    ],
)
async def test_diagnostic_blocks_dangerous_targets(alice, path, body):
    r = await alice.post(f"/api/diagnostic/{path}", json=body)
    assert r.status_code == 422, r.text


@pytest.mark.parametrize(
    "host", ["1.1.1.1; cat /etc/passwd", "$(whoami)", "a b", "-x", "`id`", "x|y"]
)
async def test_command_injection_payloads_rejected(alice, host):
    for path in ("ping", "traceroute"):
        r = await alice.post(f"/api/diagnostic/{path}", json={"host": host})
        assert r.status_code == 422


async def test_ping_route(alice, prober):
    prober.results["10.0.0.7"] = ProbeResult(True, 4.0, "icmp")
    body = (await alice.post("/api/diagnostic/ping", json={"host": "10.0.0.7", "count": 2})).json()
    assert body["status"] == "online" and body["packet_loss"] == 0 and body["avg_latency"] == 4.0
    assert body["success_count"] == 2 and body["method"] == "icmp"
    assert (
        await alice.post("/api/diagnostic/ping", json={"host": "10.0.0.7", "count": 99})
    ).status_code == 422


async def test_traceroute_route(alice, monkeypatch):
    async def fake(address, max_hops=20, timeout=60):
        return diagnostics.parse_traceroute(TRACE)

    monkeypatch.setattr(diagnostics, "run_traceroute", fake)
    body = (await alice.post("/api/diagnostic/traceroute", json={"host": "10.9.9.9"})).json()
    assert body["target"] == "10.9.9.9" and len(body["hops"]) == 4

    async def missing(address, max_hops=20, timeout=60):
        raise RuntimeError("traceroute não está instalado neste servidor")

    monkeypatch.setattr(diagnostics, "run_traceroute", missing)
    assert (
        await alice.post("/api/diagnostic/traceroute", json={"host": "10.9.9.9"})
    ).status_code == 503


async def test_dns_validation(alice):
    r = await alice.post(
        "/api/diagnostic/dns-lookup", json={"domain": "example.com", "record_type": "AXFR"}
    )
    assert r.status_code == 422
    r = await alice.post(
        "/api/diagnostic/dns-lookup", json={"domain": "bad domain;", "record_type": "A"}
    )
    assert r.status_code == 422


async def test_port_validation(alice):
    for ports in ([0], [70000], []):
        r = await alice.post(
            "/api/diagnostic/port-check", json={"host": "10.0.0.1", "ports": ports}
        )
        assert r.status_code == 422


async def test_diagnostic_rate_limit(alice, prober):
    for _ in range(30):
        assert (
            await alice.post("/api/diagnostic/ping", json={"host": "10.0.0.7", "count": 1})
        ).status_code == 200
    assert (
        await alice.post("/api/diagnostic/ping", json={"host": "10.0.0.7", "count": 1})
    ).status_code == 429


async def test_full_diagnostic(alice, prober, monkeypatch):
    async def fake_ports(address, ports, timeout=3.0):
        return [{"port": p, "open": p == 443, "latency": 1.0, "duration_ms": 1.0} for p in ports]

    monkeypatch.setattr(diagnostics, "check_ports", fake_ports)
    body = (await alice.post("/api/diagnostic/full-diagnostic", json={"host": "10.0.0.7"})).json()
    assert body["results"]["ping"]["status"] == "online" and body["results"]["dns"] is None
    assert "✅ Porta 443 aberta" in body["diagnosis"] and "❌ Porta 22 fechada" in body["diagnosis"]


# ---- sondas de baixo nível (abaixo do guard: aqui o loopback é o alvo de teste) ----------------
async def _server():
    server = await asyncio.start_server(lambda r, w: w.close(), "127.0.0.1", 0)
    return server, server.sockets[0].getsockname()[1]


async def test_tcp_probe_open_and_closed():
    server, port = await _server()
    async with server:
        ok = await tcp_probe("127.0.0.1", port, 1.0)
        assert ok.ok and ok.latency_ms is not None and ok.method == "tcp" and ok.port == port
    closed = await tcp_probe("127.0.0.1", port, 1.0)
    assert not closed.ok and closed.error == "conexão recusada"
    alive = await tcp_probe("127.0.0.1", port, 1.0, refused_is_alive=True)
    assert alive.ok  # RST prova que o host responde (fallback do ICMP)


async def test_check_ports():
    server, port = await _server()
    async with server:
        res = await diagnostics.check_ports("127.0.0.1", [port, 1], timeout=1.0)
    assert res[0]["open"] is True and res[1]["open"] is False


async def test_tcp_fallback_treats_refused_as_alive_and_silence_as_down(monkeypatch):
    server, port = await _server()
    async with server:
        res = await tcp_probe_any("127.0.0.1", 1.0, ports=(port, 9))
    assert res.ok and res.port in (port, 9)  # RST na 9 também prova que o host responde

    from app.services import probes

    async def silent(address, port, timeout, refused_is_alive=False):
        return ProbeResult(False, None, "tcp", port, "timeout")

    monkeypatch.setattr(probes, "tcp_probe", silent)
    down = await probes.tcp_probe_any("10.255.255.1", 1.0)
    assert down.ok is False and down.error == "sem resposta"


async def test_prober_uses_tcp_when_icmp_unavailable():
    from app.services.probes import Prober

    p = Prober(timeout=1.0)
    p.icmp_mode = None
    server, port = await _server()
    async with server:
        res = await p.probe("127.0.0.1", "tcp", port)
        assert res.ok and res.method == "tcp"
    down = await p.probe("127.0.0.1", "icmp", None)  # sem ICMP → fallback TCP, nada escutando
    assert down.method == "tcp"


async def test_detect_does_not_crash():
    from app.services.probes import Prober

    p = Prober()
    assert await p.detect() in {"privileged", "unprivileged", None}
