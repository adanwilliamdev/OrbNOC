import asyncio
import logging

import dns.resolver
import httpx
import pytest
from sqlalchemy import select

from app import bootstrap, cli, worker
from app.core import ratelimit
from app.core.logging import configure_logging
from app.db.models import User
from app.main import app, lifespan
from app.services import checks, diagnostics, heartbeat, notifier
from app.services.checks import CheckResult, http_url, run_check


@pytest.fixture
def tcp_only(monkeypatch):
    """Simula um ambiente (PaaS) sem permissão de ICMP."""

    async def unavailable(*a, **k):
        raise checks._IcmpUnavailableError

    monkeypatch.setattr(checks, "_icmp_probe", unavailable)
    monkeypatch.setattr(diagnostics, "_icmp_probe", unavailable)


async def http_server(status_line: bytes):
    async def handle(reader, writer):
        await reader.read(1024)
        writer.write(status_line + b"\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
        await writer.drain()
        writer.close()

    server = await asyncio.start_server(handle, "127.0.0.1", 0)
    return server, server.sockets[0].getsockname()[1]


async def test_http_ok_redirect_e_erro():
    for line, expected_ok, err in [
        (b"HTTP/1.1 200 OK", True, None),
        (b"HTTP/1.1 302 Found", True, None),
        (b"HTTP/1.1 503 Service Unavailable", False, "HTTP 503"),
    ]:
        server, port = await http_server(line)
        async with server:
            r = await run_check("http", "127.0.0.1", port)
        assert r.ok is expected_ok and r.error == err and r.method == "http"
    assert (await run_check("http", "127.0.0.1", 1)).ok is False  # conexão recusada


def test_url_http():
    assert http_url("router.lan", None) == "https://router.lan/"
    assert http_url("router.lan", 8080) == "http://router.lan:8080/"
    assert http_url("router.lan", 80) == "http://router.lan/"
    assert http_url("::1", 443) == "https://[::1]/"


async def test_fallback_tcp_conexao_recusada_conta_como_vivo(tcp_only):
    """Host sem portas abertas responde RST: está vivo. O sistema antigo marcava offline."""
    r = await run_check("icmp", "127.0.0.1", None)
    assert r.ok is True and r.method == "tcp-fallback" and r.latency_ms is not None


async def test_fallback_tcp_sem_resposta_e_offline(tcp_only, monkeypatch):
    async def timeout_probe(address, port, timeout):
        return "timeout", None

    monkeypatch.setattr(checks, "tcp_probe", timeout_probe)
    r = await run_check("icmp", "127.0.0.1", None)
    assert r.ok is False and r.method == "tcp-fallback"


async def test_icmp_mode_icmp_nao_cai_para_tcp(tcp_only, settings, monkeypatch):
    monkeypatch.setattr(settings, "icmp_mode", "icmp")
    r = await run_check("icmp", "127.0.0.1", None)
    assert r.ok is False and "ICMP indisponível" in r.error


async def test_icmp_mode_tcp_ignora_icmp(settings, monkeypatch):
    monkeypatch.setattr(settings, "icmp_mode", "tcp")
    assert (await run_check("icmp", "127.0.0.1", None)).method == "tcp-fallback"


async def test_ping_diagnostico_usa_fallback(tcp_only):
    from app.core.netguard import resolve_target

    res = await diagnostics.ping(await resolve_target("127.0.0.1"), 2)
    assert res["method"] == "tcp-fallback" and res["status"] == "online" and res["received"] == 2


async def test_run_check_nunca_levanta(monkeypatch):
    async def boom(*a, **k):
        raise RuntimeError("bug")

    monkeypatch.setattr(checks, "check_icmp", boom)
    r = await run_check("icmp", "127.0.0.1", None)
    assert r == CheckResult(False, error="erro interno: RuntimeError", method="icmp")


class _Answer(list):
    class rrset:  # noqa: N801
        ttl = 300


async def test_dns_sucesso_nxdomain_e_sem_registro(monkeypatch):
    class Rdata:
        def __init__(self, v):
            self.v = v

        def to_text(self):
            return self.v

    async def ok(self, name, rtype, *a, **k):
        return _Answer([Rdata("93.184.216.34" if rtype == "A" else "host.example.")])

    monkeypatch.setattr("dns.asyncresolver.Resolver.resolve", ok)
    res = await diagnostics.dns_lookup("Example.COM", "a")
    assert (
        res["success"]
        and res["records"] == [{"value": "93.184.216.34", "ttl": 300}]
        and res["reverse_lookup"] == "host.example"
    )

    async def nx(self, *a, **k):
        raise dns.resolver.NXDOMAIN

    monkeypatch.setattr("dns.asyncresolver.Resolver.resolve", nx)
    assert "NXDOMAIN" in (await diagnostics.dns_lookup("nao-existe.example"))["error"]

    async def noans(self, *a, **k):
        raise dns.resolver.NoAnswer

    monkeypatch.setattr("dns.asyncresolver.Resolver.resolve", noans)
    assert "Sem registros" in (await diagnostics.dns_lookup("example.com", "MX"))["error"]


# ---------- Telegram ----------
def _mock_telegram(monkeypatch, handler):
    real = httpx.AsyncClient
    monkeypatch.setattr(
        notifier.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(handler), **kw)
    )


TOKEN = "123456789:AAH-secret-token-abcdefghijklmnopqrstuv"


async def test_telegram_envio_ok(monkeypatch):
    seen = {}

    def handler(request):
        seen["url"], seen["body"] = str(request.url), request.content.decode()
        return httpx.Response(200, json={"ok": True})

    _mock_telegram(monkeypatch, handler)
    assert await notifier.send_telegram(TOKEN, "42", notifier.telegram_text("down", "x")) == (True, None)
    assert (
        seen["url"].startswith(f"https://api.telegram.org/bot{TOKEN}/sendMessage")
        and '"parse_mode":"HTML"' in seen["body"]
    )


async def test_telegram_recusa_devolve_descricao(monkeypatch):
    _mock_telegram(
        monkeypatch, lambda r: httpx.Response(400, json={"ok": False, "description": "chat not found"})
    )
    assert await notifier.send_telegram(TOKEN, "42", "x") == (False, "chat not found")


async def test_telegram_erro_de_rede_nao_vaza_token_no_log(monkeypatch, caplog):
    def handler(request):
        raise httpx.ConnectError(f"falha em {request.url}")  # a mensagem da exceção contém a URL com o token

    _mock_telegram(monkeypatch, handler)
    with caplog.at_level(logging.DEBUG):
        ok, err = await notifier.send_telegram(TOKEN, "42", "x")
    assert (
        ok is False
        and TOKEN not in (err or "")
        and TOKEN not in caplog.text
        and "secret-token" not in caplog.text
    )


def test_httpx_nao_loga_urls_em_info():
    configure_logging()
    assert logging.getLogger("httpx").level == logging.WARNING  # a URL do Telegram contém o token


# ---------- admin, rate limit, trava do worker, lifespan ----------
async def test_bootstrap_admin(db, settings, monkeypatch):
    monkeypatch.setattr(settings, "admin_password", None)
    assert await bootstrap.ensure_admin(db) is False and await db.scalar(select(User.id)) is None
    monkeypatch.setattr(settings, "admin_password", "SenhaForte123")
    monkeypatch.setattr(settings, "admin_username", "Root")
    assert await bootstrap.ensure_admin(db) is True
    admin = await db.scalar(select(User))
    assert admin.username == "root" and admin.role == "admin" and admin.password_hash != "SenhaForte123"
    monkeypatch.setattr(settings, "admin_password", "OutraSenha999")
    assert await bootstrap.ensure_admin(db) is False  # nunca sobrescreve a senha existente


async def test_cli_create_admin(db, monkeypatch):
    monkeypatch.setattr(cli.getpass, "getpass", lambda _: "Senha1234")
    await cli.create_admin("Chefe", "Chefe@X.com")
    u = await db.scalar(select(User).where(User.username == "chefe"))
    assert u.role == "admin" and u.email == "chefe@x.com"
    with pytest.raises(SystemExit):
        await cli.create_admin("chefe", "outro@x.com")


class _DeadRedis:
    def __getattr__(self, _):
        raise ConnectionError("redis down")


async def test_ratelimit_cai_para_memoria_sem_redis(monkeypatch):
    monkeypatch.setattr(ratelimit, "get_redis", lambda: _DeadRedis())
    assert [await ratelimit.incr("k", 60) for _ in range(3)] == [1, 2, 3]
    assert await ratelimit.get("k") == 3
    await ratelimit.clear("k")
    assert await ratelimit.get("k") == 0


async def test_trava_do_worker(redis, monkeypatch):
    assert await worker._hold_lock("A") is True  # adquire
    assert await worker._hold_lock("A") is True  # renova
    assert await worker._hold_lock("B") is False  # outra instância não assume
    await worker._release_lock("B")  # quem não é dono não libera
    assert await redis.get(heartbeat.LOCK_KEY) == "A"
    await worker._release_lock("A")
    assert await worker._hold_lock("B") is True
    monkeypatch.setattr(worker, "get_redis", lambda: _DeadRedis())
    assert await worker._hold_lock("C") is True  # sem Redis, segue funcionando


async def test_lifespan_cria_admin_e_encerra_limpo(db, settings, monkeypatch):
    monkeypatch.setattr(settings, "admin_password", "SenhaForte123")
    async with lifespan(app):
        assert await db.scalar(select(User.username)) == "admin"
