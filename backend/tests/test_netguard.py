import ipaddress

import pytest

from app.services.netguard import HostRejected, check_address, parse_host, resolve_and_check


@pytest.mark.parametrize("value", ["8.8.8.8", "example.com", "my-host_1.lan", "[2001:db8::1]"])
def test_parse_host_accepts(value):
    assert parse_host(value)


@pytest.mark.parametrize(
    "value",
    [
        "",
        "  ",
        "-oProxyCommand=x",
        "a b",
        "host;rm -rf /",
        "$(id).com",
        "a..b",
        "x" * 300,
        "http://evil.com",
        "host\nname",
    ],
)
def test_parse_host_rejects(value):
    with pytest.raises(HostRejected):
        parse_host(value)


def test_parse_host_normalizes():
    assert parse_host("  ExAmple.COM. ") == "example.com"
    assert parse_host("[::1]") == "::1"


@pytest.mark.parametrize(
    "addr",
    [
        "127.0.0.1",
        "127.5.5.5",
        "::1",
        "169.254.169.254",
        "169.254.1.1",
        "fe80::1",
        "0.0.0.0",
        "224.0.0.1",
        "fd00:ec2::254",
        "100.100.100.200",
        "::ffff:127.0.0.1",
        "::ffff:169.254.169.254",
    ],
)
def test_always_blocked(addr):
    for allow_private in (True, False):
        with pytest.raises(HostRejected):
            check_address(ipaddress.ip_address(addr), allow_private)


@pytest.mark.parametrize("addr", ["10.0.0.5", "192.168.1.1", "172.16.4.4", "100.64.0.9"])
def test_private_allowed_only_when_enabled(addr):
    check_address(ipaddress.ip_address(addr), allow_private=True)
    with pytest.raises(HostRejected):
        check_address(ipaddress.ip_address(addr), allow_private=False)


def test_public_always_allowed():
    check_address(ipaddress.ip_address("8.8.8.8"), allow_private=False)


async def test_resolve_ip_literal():
    assert await resolve_and_check("10.1.2.3", True) == ["10.1.2.3"]
    with pytest.raises(HostRejected):
        await resolve_and_check("127.0.0.1", True)


async def test_resolve_localhost_blocked():
    with pytest.raises(HostRejected):
        await resolve_and_check("localhost", True)
