"""Estatísticas sobre a janela das últimas N amostras de um dispositivo."""

from dataclasses import dataclass

WINDOW_SIZE = 10


@dataclass(frozen=True)
class WindowStats:
    avg: float | None
    min: float | None
    max: float | None
    jitter: float | None
    packet_loss: float | None


def window_stats(samples: list[float | None]) -> WindowStats:
    """`samples`: latências em ms, mais antigas primeiro; None = verificação que falhou."""
    if not samples:
        return WindowStats(None, None, None, None, None)
    ok = [s for s in samples if s is not None]
    loss = round(100 * (len(samples) - len(ok)) / len(samples), 1)
    if not ok:
        return WindowStats(None, None, None, None, loss)
    jitter = 0.0
    if len(ok) > 1:
        jitter = sum(abs(b - a) for a, b in zip(ok, ok[1:], strict=False)) / (len(ok) - 1)
    return WindowStats(
        avg=round(sum(ok) / len(ok), 2),
        min=round(min(ok), 2),
        max=round(max(ok), 2),
        jitter=round(jitter, 2),
        packet_loss=loss,
    )
