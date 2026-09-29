"""Estatísticas de janela deslizante (últimas N amostras) e resumo de ping."""

from dataclasses import dataclass


@dataclass(slots=True)
class WindowStats:
    avg_latency: float | None
    min_latency: float | None
    max_latency: float | None
    jitter: float | None
    packet_loss: float


def jitter_ms(latencies: list[float]) -> float | None:
    """Média da diferença absoluta entre amostras consecutivas."""
    if len(latencies) < 2:
        return 0.0 if latencies else None
    diffs = [abs(b - a) for a, b in zip(latencies, latencies[1:], strict=False)]
    return round(sum(diffs) / len(diffs), 2)


def window_stats(samples: list[float | None]) -> WindowStats:
    """`samples` em ordem cronológica; None = falha de checagem."""
    if not samples:
        return WindowStats(None, None, None, None, 0.0)
    valid = [s for s in samples if s is not None]
    loss = round((len(samples) - len(valid)) / len(samples) * 100, 1)
    if not valid:
        return WindowStats(None, None, None, None, loss)
    return WindowStats(
        avg_latency=round(sum(valid) / len(valid), 2),
        min_latency=min(valid),
        max_latency=max(valid),
        jitter=jitter_ms(valid),
        packet_loss=loss,
    )
