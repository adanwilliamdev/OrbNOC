"""Máquina de estados de um dispositivo: decide status e eventos a partir de UMA verificação.

Função pura (sem I/O), para ser testada exaustivamente. Regras:
- OFFLINE só depois de `failure_threshold` falhas SEGUIDAS (uma perda isolada não alerta).
- Recuperação só gera evento se o dispositivo estava OFFLINE (de "desconhecido" para online é silencioso).
- Violação de SLA de latência só alerta após `sla_consecutive` amostras seguidas acima do limite,
  e uma única vez por episódio (o sistema antigo notificava a cada verificação).
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class DeviceState:
    status: str = "unknown"  # unknown | online | offline
    consecutive_failures: int = 0
    sla_breach_count: int = 0
    sla_breached: bool = False


@dataclass(frozen=True)
class EventSpec:
    kind: str  # down | recovered | sla_breach
    severity: str  # error | success | warning


@dataclass(frozen=True)
class Transition:
    state: DeviceState
    events: list[EventSpec] = field(default_factory=list)

    @property
    def status_changed(self) -> bool:
        return bool(self.events) and self.events[0].kind in {"down", "recovered"}


def evaluate(
    state: DeviceState,
    *,
    ok: bool,
    latency_ms: float | None,
    sla_threshold_ms: int | None,
    failure_threshold: int,
    sla_consecutive: int,
) -> Transition:
    events: list[EventSpec] = []

    if ok:
        status = state.status
        if state.status == "offline":
            events.append(EventSpec("recovered", "success"))
        status = "online"

        breach_count, breached = state.sla_breach_count, state.sla_breached
        if sla_threshold_ms and latency_ms is not None and latency_ms > sla_threshold_ms:
            breach_count += 1
            if breach_count >= sla_consecutive and not breached:
                breached = True
                events.append(EventSpec("sla_breach", "warning"))
        else:
            breach_count, breached = 0, False
        return Transition(DeviceState(status, 0, breach_count, breached), events)

    failures = state.consecutive_failures + 1
    status = state.status
    if failures >= failure_threshold and state.status != "offline":
        status = "offline"
        events.append(EventSpec("down", "error"))
    # Enquanto está caído o episódio de SLA termina; se voltar lento, pode alertar de novo.
    return Transition(DeviceState(status, failures, 0, False), events)
