from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select

from app.db.models import Event, Metric, MetricHourly
from app.services.rollup import run_rollup
from app.services.sla import ceil_hour, compute_sla, floor_hour

from .conftest import add_device

NOW = datetime(2026, 3, 10, 12, 30, tzinfo=UTC)


async def seed(db, device_id, hours=72, per_hour=6, fail_every=6, end=NOW):
    """`per_hour` amostras por hora; a cada `fail_every`-ésima falha. Latência = 10 ms nas OK."""
    rows, i = [], 0
    t = end - timedelta(hours=hours)
    while t < end:
        for k in range(per_hour):
            ok = (i % fail_every) != fail_every - 1
            rows.append(Metric(device_id=device_id, recorded_at=t + timedelta(minutes=k * (60 // per_hour), seconds=7),
                               ok=ok, latency_ms=10.0 if ok else None))  # fmt: skip
            i += 1
        t += timedelta(hours=1)
    db.add_all(rows)
    await db.commit()
    return len(rows)


def test_helpers_de_hora():
    assert floor_hour(datetime(2026, 1, 1, 10, 45, tzinfo=UTC)) == datetime(2026, 1, 1, 10, tzinfo=UTC)
    assert ceil_hour(datetime(2026, 1, 1, 10, 45, tzinfo=UTC)) == datetime(2026, 1, 1, 11, tzinfo=UTC)
    assert ceil_hour(datetime(2026, 1, 1, 10, 0, tzinfo=UTC)) == datetime(2026, 1, 1, 10, tzinfo=UTC)


async def test_uptime_a_partir_de_amostras_cruas(db, alice):
    d = await add_device(db, alice.id)
    total = await seed(db, d.id, hours=24)
    s = (await compute_sla(db, [d.id], NOW - timedelta(hours=24), NOW))[d.id]
    assert s.samples == total and s.uptime_pct == round(100 * 5 / 6, 3) and s.avg_latency == 10.0


async def test_sem_dados_nao_inventa_100_por_cento(db, alice):
    d = await add_device(db, alice.id)
    s = (await compute_sla(db, [d.id], NOW - timedelta(hours=24), NOW))[d.id]
    assert s.uptime_pct is None and s.avg_latency is None and s.samples == 0


async def test_rollup_nao_duplica_nem_perde_amostras(db, alice):
    """Resultado ANTES e DEPOIS da agregação precisa ser idêntico, em janelas alinhadas ou não com a hora."""
    d = await add_device(db, alice.id)
    await seed(db, d.id, hours=72)
    windows = [
        (NOW - timedelta(hours=24)),
        (NOW - timedelta(hours=7, minutes=13)),
        (NOW - timedelta(days=3)),
        (NOW - timedelta(minutes=20)),
    ]
    before = [(await compute_sla(db, [d.id], w, NOW))[d.id] for w in windows]

    await run_rollup(db, NOW)
    assert await db.scalar(select(func.count()).select_from(MetricHourly)) == 72
    after = [(await compute_sla(db, [d.id], w, NOW))[d.id] for w in windows]
    for b, a, w in zip(before, after, windows, strict=True):
        assert (a.samples, a.ok_samples, a.latency_count) == (b.samples, b.ok_samples, b.latency_count), w


async def test_rollup_idempotente_e_incremental(db, alice):
    d = await add_device(db, alice.id)
    await seed(db, d.id, hours=10)
    await run_rollup(db, NOW)
    first = await db.scalar(select(func.sum(MetricHourly.samples)))
    await run_rollup(db, NOW)
    assert await db.scalar(select(func.sum(MetricHourly.samples))) == first
    # novas horas depois
    later = NOW + timedelta(hours=3)
    await seed(db, d.id, hours=3, end=later)
    await run_rollup(db, later)
    assert await db.scalar(select(func.count()).select_from(MetricHourly)) == 13


async def test_retencao_apaga_cru_antigo_mas_mantem_o_agregado(db, alice):
    d = await add_device(db, alice.id)
    total = await seed(db, d.id, hours=24 * 10)  # 10 dias
    await run_rollup(db, NOW)
    remaining = await db.scalar(select(func.count()).select_from(Metric))
    assert 0 < remaining < total  # o mais antigo que 7 dias foi removido
    assert await db.scalar(select(func.min(Metric.recorded_at))) >= NOW - timedelta(days=7)
    s = (await compute_sla(db, [d.id], NOW - timedelta(days=10), NOW))[d.id]
    assert s.samples >= total - 6  # histórico completo preservado via agregado (exceto borda parcial)
    assert s.uptime_pct == round(100 * 5 / 6, 1) or abs(s.uptime_pct - 83.333) < 0.1


async def test_retencao_nunca_apaga_amostra_ainda_nao_agregada(db, alice):
    d = await add_device(db, alice.id)
    await seed(db, d.id, hours=24 * 9)
    await run_rollup(db, NOW)
    ru = await db.scalar(select(func.max(MetricHourly.hour)))
    assert await db.scalar(select(func.count()).select_from(Metric).where(Metric.recorded_at >= ru)) > 0


async def test_retencao_de_eventos(db, alice):
    d = await add_device(db, alice.id)
    old = Event(
        owner_id=alice.id,
        device_id=d.id,
        device_name="x",
        device_ip="1",
        kind="down",
        severity="error",
        message="velho",
        created_at=NOW - timedelta(days=400),
    )
    new = Event(
        owner_id=alice.id,
        device_id=d.id,
        device_name="x",
        device_ip="1",
        kind="down",
        severity="error",
        message="novo",
        created_at=NOW - timedelta(days=1),
    )
    db.add_all([old, new])
    await db.commit()
    result = await run_rollup(db, NOW)
    assert result["events_deleted"] == 1 and [e.message for e in await db.scalars(select(Event))] == ["novo"]


async def test_sla_de_varios_dispositivos_de_uma_vez(db, alice):
    a, b = await add_device(db, alice.id, "A", "10.0.0.1"), await add_device(db, alice.id, "B", "10.0.0.2")
    await seed(db, a.id, hours=5)
    await seed(db, b.id, hours=5, fail_every=2)
    res = await compute_sla(db, [a.id, b.id], NOW - timedelta(hours=5), NOW)
    assert res[a.id].uptime_pct > 80 and res[b.id].uptime_pct == 50.0
