from datetime import UTC, datetime, timedelta

from app.db.models import Device
from app.services.monitor import apply_result
from app.services.probes import ProbeResult
from app.services.stats import jitter_ms, window_stats

OK = ProbeResult(True, 20.0, "icmp")
FAIL = ProbeResult(False, None, "icmp", None, "timeout")
NOW = datetime(2026, 1, 1, tzinfo=UTC)


def device(**kw) -> Device:
    base = dict(
        name="d",
        ip="10.0.0.1",
        status="unknown",
        consecutive_failures=0,
        failure_threshold=3,
        sla_breached=False,
        sla_threshold_ms=None,
    )
    return Device(**{**base, **kw})


def test_unknown_to_online_has_no_alert():
    d = device()
    assert apply_result(d, OK, [], NOW) == []
    assert d.status == "online" and d.latency == 20.0 and d.last_status_change == NOW


def test_single_loss_does_not_flip_offline():
    d = device(status="online")
    assert apply_result(d, FAIL, [20.0], NOW) == []
    assert d.status == "online" and d.consecutive_failures == 1
    assert d.latency is None and d.last_error == "timeout"


def test_offline_after_three_consecutive_failures_only_once():
    d = device(status="online")
    out = []
    for _ in range(5):
        out += apply_result(d, FAIL, [], NOW)
    assert [t.kind for t in out] == ["offline"]
    assert d.status == "offline"


def test_failure_counter_resets_on_success():
    d = device(status="online")
    apply_result(d, FAIL, [], NOW)
    apply_result(d, FAIL, [], NOW)
    apply_result(d, OK, [], NOW)
    assert d.consecutive_failures == 0
    apply_result(d, FAIL, [], NOW)
    assert d.status == "online"


def test_recovery_transition():
    d = device(status="offline", consecutive_failures=7)
    out = apply_result(d, OK, [None, None], NOW)
    assert [t.kind for t in out] == ["recovered"]
    assert d.status == "online" and d.consecutive_failures == 0


def test_configurable_threshold():
    d = device(status="online", failure_threshold=1)
    assert [t.kind for t in apply_result(d, FAIL, [], NOW)] == ["offline"]


def test_sla_breach_notifies_once_then_recovers():
    d = device(status="online", sla_threshold_ms=50)
    slow, fast = ProbeResult(True, 120.0, "icmp"), ProbeResult(True, 30.0, "icmp")
    assert [t.kind for t in apply_result(d, slow, [], NOW)] == ["sla_breach"]
    assert apply_result(d, slow, [], NOW) == []  # sem repetir a cada rodada
    assert [t.kind for t in apply_result(d, fast, [], NOW)] == ["sla_recovered"]
    assert d.sla_breached is False


def test_zero_latency_is_valid_sample():
    d = device(status="online", sla_threshold_ms=50)
    apply_result(d, ProbeResult(True, 0.0, "icmp"), [], NOW)
    assert d.latency == 0.0 and d.avg_latency == 0.0


def test_window_stats():
    s = window_stats([10.0, None, 30.0, 20.0])
    assert s.packet_loss == 25.0
    assert (s.min_latency, s.max_latency, s.avg_latency) == (10.0, 30.0, 20.0)
    assert s.jitter == 15.0  # |30-10|=20 e |20-30|=10 -> 15
    assert window_stats([]).avg_latency is None
    assert window_stats([None, None]).packet_loss == 100.0
    assert jitter_ms([5.0]) == 0.0


def test_window_is_limited_to_ten():
    d = device(status="online")
    apply_result(d, OK, [1.0] * 30, NOW + timedelta(seconds=1))
    assert d.avg_latency is not None and d.avg_latency > 1.0  # só as últimas 10 entram
