"""Testes de app/services/ping_service.py."""
import pytest

from app.services import ping_service


@pytest.mark.parametrize(
    "latencies, expected",
    [
        ([], 0),
        ([10], 0),
        ([10, 10, 10], 0),
        ([10, 20], 10),
        ([10, 20, 15], 8),  # |20-10| + |15-20| = 15, /2 = 7.5 -> round = 8
    ],
)
def test_calculate_jitter(latencies, expected):
    assert ping_service.calculate_jitter(latencies) == expected


async def test_check_port_closed_times_out_quickly():
    # Porta improvável de estar aberta em localhost; usamos timeout curto
    # para o teste não ficar lento.
    result = await ping_service.check_port("127.0.0.1", 1, timeout_ms=200)
    assert result["port"] == 1
    assert result["open"] is False


async def test_tcp_ping_no_open_port_returns_not_alive():
    result = await ping_service.tcp_ping("127.0.0.1", timeout_seconds=0.2, ports=[1])
    assert result["alive"] is False
    assert result["latency"] is None
