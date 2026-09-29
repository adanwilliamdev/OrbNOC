"""Máquina de estados de um dispositivo (sem I/O — fácil de testar).

Estados: unknown, online, offline. Só vira offline após `failure_threshold` falhas seguidas
(elimina o falso alarme de uma perda isolada). Cada mudança gera uma transição; alertas só
saem quando algo muda, nunca a cada rodada.
"""

from dataclasses import dataclass
from datetime import datetime

from app.db.models import Device
from app.services.probes import ProbeResult
from app.services.stats import window_stats

WINDOW = 10  # amostras usadas em média/jitter/perda


@dataclass(slots=True)
class Transition:
    kind: str  # offline | recovered | sla_breach | sla_recovered
    severity: str  # error | success | warning | info
    message: str


def apply_result(
    device: Device, result: ProbeResult, recent: list[float | None], now: datetime
) -> list[Transition]:
    """Atualiza `device` in-place. `recent` = amostras anteriores (cronológicas), sem esta."""
    transitions: list[Transition] = []
    previous = device.status
    samples = [*recent, result.latency_ms if result.ok else None][-WINDOW:]
    stats = window_stats(samples)

    device.last_check = now
    device.latency = result.latency_ms if result.ok else None
    device.avg_latency = stats.avg_latency
    device.min_latency = stats.min_latency
    device.max_latency = stats.max_latency
    device.jitter = stats.jitter
    device.packet_loss = stats.packet_loss
    device.last_error = None if result.ok else (result.error or "sem resposta")[:255]

    if result.ok:
        device.consecutive_failures = 0
        if previous != "online":
            device.status = "online"
            device.last_status_change = now
            if previous == "offline":
                transitions.append(
                    Transition("recovered", "success", "Host voltou a responder normalmente.")
                )
    else:
        device.consecutive_failures += 1
        if device.consecutive_failures >= device.failure_threshold and previous != "offline":
            device.status = "offline"
            device.last_status_change = now
            device.sla_breached = False
            transitions.append(
                Transition(
                    "offline",
                    "error",
                    f"Host não está respondendo (após {device.consecutive_failures} "
                    f"{'falha' if device.consecutive_failures == 1 else 'falhas seguidas'}).",
                )
            )

    threshold = device.sla_threshold_ms
    latency = device.latency
    if threshold and result.ok and latency is not None:
        if latency > threshold and not device.sla_breached:
            device.sla_breached = True
            transitions.append(
                Transition(
                    "sla_breach",
                    "warning",
                    f"Limite de latência excedido: {latency:.0f} ms (limite {threshold} ms, "
                    f"excedente {latency - threshold:.0f} ms).",
                )
            )
        elif latency <= threshold and device.sla_breached:
            device.sla_breached = False
            transitions.append(
                Transition(
                    "sla_recovered",
                    "info",
                    f"Latência de volta ao limite: {latency:.0f} ms (limite {threshold} ms).",
                )
            )
    elif not threshold:
        device.sla_breached = False
    return transitions
