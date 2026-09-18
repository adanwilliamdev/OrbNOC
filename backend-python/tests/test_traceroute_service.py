"""Testes de app/services/traceroute_service.py."""
import pytest

from app.services import traceroute_service as t


@pytest.mark.parametrize("host", ["8.8.8.8", "example.com", "sub.example.com", "::1", "192.168.0.1"])
def test_validate_host_accepts_valid_hosts(host):
    assert t.validate_host(host) == host


@pytest.mark.parametrize(
    "host",
    ["", "   ", "--help", "; rm -rf /", "$(whoami)", "host with spaces", "-oProxyCommand=evil"],
)
def test_validate_host_rejects_invalid_hosts(host):
    with pytest.raises(t.InvalidHostError):
        t.validate_host(host)


def test_parse_hop_line_with_ip_and_times():
    line = " 1  192.168.1.1 (192.168.1.1)  1.234 ms  1.100 ms  1.050 ms"
    parsed = t._parse_hop_line(line)

    assert parsed["hop"] == 1
    assert parsed["ip"] == "192.168.1.1"
    assert parsed["timeout"] is False
    assert parsed["latency"] == 1.1


def test_parse_hop_line_timeout():
    line = " 2  * * *"
    parsed = t._parse_hop_line(line)

    assert parsed["hop"] == 2
    assert parsed["ip"] is None
    assert parsed["timeout"] is True


def test_parse_hop_line_ignores_non_hop_lines():
    assert t._parse_hop_line("traceroute to 8.8.8.8, 30 hops max") is None


async def test_run_traceroute_rejects_invalid_host():
    with pytest.raises(t.InvalidHostError):
        await t.run_traceroute("--help")
