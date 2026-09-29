from app.services.state import DeviceState, evaluate
from app.services.stats import window_stats

KW = {"sla_threshold_ms": None, "failure_threshold": 3, "sla_consecutive": 3}


def step(state, ok=True, latency=10.0, **over):
    return evaluate(state, ok=ok, latency_ms=latency if ok else None, **{**KW, **over})


def test_falha_isolada_nao_derruba():
    t = step(DeviceState("online"), ok=False)
    assert t.state.status == "online" and t.state.consecutive_failures == 1 and t.events == []


def test_offline_apenas_apos_n_falhas_seguidas_e_uma_unica_vez():
    s = DeviceState("online")
    kinds = []
    for _ in range(6):
        t = step(s, ok=False)
        s = t.state
        kinds += [e.kind for e in t.events]
    assert s.status == "offline" and kinds == ["down"]  # sem repetir alerta a cada falha


def test_sucesso_zera_contagem_de_falhas():
    s = step(DeviceState("online"), ok=False).state
    s = step(s, ok=False).state
    assert step(s, ok=True).state.consecutive_failures == 0


def test_recuperacao_gera_evento_somente_vindo_de_offline():
    t = step(DeviceState("offline", 5))
    assert t.state.status == "online" and [e.kind for e in t.events] == ["recovered"]
    assert step(DeviceState("unknown")).events == []  # primeira leitura é silenciosa


def test_desconhecido_vira_offline_apos_limite():
    s = DeviceState("unknown")
    for _ in range(3):
        t = step(s, ok=False)
        s = t.state
    assert s.status == "offline" and [e.kind for e in t.events] == ["down"]


def test_sla_alerta_uma_vez_apos_n_violacoes_seguidas():
    s, kinds = DeviceState("online"), []
    for _ in range(8):
        t = step(s, latency=200, sla_threshold_ms=100)
        s = t.state
        kinds += [e.kind for e in t.events]
    assert kinds == ["sla_breach"] and s.sla_breached


def test_sla_normalizar_permite_novo_alerta():
    s = DeviceState("online")
    for _ in range(3):
        s = step(s, latency=200, sla_threshold_ms=100).state
    s = step(s, latency=50, sla_threshold_ms=100).state
    assert not s.sla_breached and s.sla_breach_count == 0
    kinds = []
    for _ in range(3):
        t = step(s, latency=200, sla_threshold_ms=100)
        s = t.state
        kinds += [e.kind for e in t.events]
    assert kinds == ["sla_breach"]


def test_sla_pico_isolado_nao_alerta():
    s = step(DeviceState("online"), latency=500, sla_threshold_ms=100).state
    assert step(s, latency=20, sla_threshold_ms=100).events == []


def test_sem_limite_nao_ha_sla():
    s = DeviceState("online")
    for _ in range(5):
        t = step(s, latency=9999)
        s = t.state
        assert t.events == []


def test_queda_encerra_episodio_de_sla():
    s = DeviceState("online", 0, 3, True)
    assert step(s, ok=False).state.sla_breached is False


def test_zero_ms_e_latencia_valida():
    assert step(DeviceState("online"), latency=0.0, sla_threshold_ms=100).events == []


def test_window_stats():
    st = window_stats([10.0, 20.0, None, 40.0])
    assert st.packet_loss == 25.0 and st.avg == 23.33 and st.min == 10.0 and st.max == 40.0
    assert st.jitter == 15.0  # (|20-10| + |40-20|) / 2
    assert window_stats([]).avg is None
    assert window_stats([None, None]).packet_loss == 100.0
    assert window_stats([0.0]).avg == 0.0  # 0 ms não é "sem dado"
