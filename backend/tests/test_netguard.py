import pytest

from app.core.netguard import TargetError, parse_host, resolve_target


@pytest.mark.parametrize("host", ["8.8.8.8", "10.1.2.3", "192.168.0.1", "2606:4700:4700::1111"])
async def test_alvos_validos(host):
    assert (await resolve_target(host)).address == host


@pytest.mark.parametrize(
    "host",
    ["169.254.169.254", "0.0.0.0", "224.0.0.1", "fe80::1", "fd00:ec2::254", "::ffff:169.254.169.254"],
)
async def test_sempre_bloqueados(host):
    with pytest.raises(TargetError):
        await resolve_target(host)


@pytest.mark.parametrize(
    "host",
    [
        "",
        "a b",
        "x;rm -rf /",
        "-oProxyCommand=id",
        "$(id)",
        "a/b",
        "http://x.com",
        "1234",
        "127.1",
        "a" * 300,
        "`id`",
        "foo|bar",
    ],
)
def test_sintaxe_invalida(host):
    with pytest.raises(TargetError):
        parse_host(host)


def test_normaliza():
    assert parse_host("  ROUTER-01.Lan. ") == "router-01.lan"
    assert parse_host("[::1]") == "::1"


async def test_loopback_configuravel(settings, monkeypatch):
    monkeypatch.setattr(settings, "allow_loopback_targets", False)
    for h in ("127.0.0.1", "::1", "::ffff:127.0.0.1"):
        with pytest.raises(TargetError):
            await resolve_target(h)
    monkeypatch.setattr(settings, "allow_loopback_targets", True)
    assert (await resolve_target("127.0.0.1")).address == "127.0.0.1"
    assert (await resolve_target("::1")).address == "::1"


async def test_rede_privada_configuravel(settings, monkeypatch):
    monkeypatch.setattr(settings, "allow_private_targets", False)
    with pytest.raises(TargetError):
        await resolve_target("192.168.1.1")
    assert (await resolve_target("8.8.8.8")).address == "8.8.8.8"


async def test_hostname_que_resolve_para_ip_proibido(monkeypatch):
    """Anti DNS-rebinding: valida o IP resolvido, não só o nome."""
    import socket

    async def fake_getaddrinfo(self, host, *a, **k):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("169.254.169.254", 0))]

    monkeypatch.setattr("asyncio.BaseEventLoop.getaddrinfo", fake_getaddrinfo)
    with pytest.raises(TargetError, match="bloqueado"):
        await resolve_target("evil.example.com")
