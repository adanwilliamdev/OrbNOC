package dev.orbnoc.core;

import dev.orbnoc.domain.Device;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Máquina de estados de um dispositivo (sem I/O — fácil de testar).
 *
 * <p>Estados: unknown, online, offline. Só vira offline após {@code failureThreshold} falhas
 * seguidas (elimina o falso alarme de uma perda isolada). Cada mudança gera uma transição;
 * alertas só saem quando algo muda, nunca a cada rodada.
 */
public final class DeviceStateMachine {

    /** Amostras usadas em média/jitter/perda. */
    public static final int WINDOW = 10;

    /** kind: offline | recovered | sla_breach | sla_recovered; severity: error | success | warning | info. */
    public record Transition(String kind, String severity, String message) {}

    private DeviceStateMachine() {}

    /** Atualiza {@code device} in-place. {@code recent} = amostras anteriores (cronológicas), sem esta. */
    public static List<Transition> apply(Device device, ProbeResult result, List<Double> recent, Instant now) {
        List<Transition> transitions = new ArrayList<>();
        String previous = device.getStatus();

        List<Double> samples = new ArrayList<>(recent);
        samples.add(result.ok() ? result.latencyMs() : null);
        if (samples.size() > WINDOW) samples = new ArrayList<>(samples.subList(samples.size() - WINDOW, samples.size()));
        Stats.WindowStats stats = Stats.windowStats(samples);

        device.setLastCheck(now);
        device.setLatency(result.ok() ? result.latencyMs() : null);
        device.setAvgLatency(stats.avgLatency());
        device.setMinLatency(stats.minLatency());
        device.setMaxLatency(stats.maxLatency());
        device.setJitter(stats.jitter());
        device.setPacketLoss(stats.packetLoss());
        if (result.ok()) {
            device.setLastError(null);
        } else {
            String error = result.error() == null || result.error().isEmpty() ? "sem resposta" : result.error();
            device.setLastError(error.length() > 255 ? error.substring(0, 255) : error);
        }

        if (result.ok()) {
            device.setConsecutiveFailures(0);
            if (!"online".equals(previous)) {
                device.setStatus("online");
                device.setLastStatusChange(now);
                if ("offline".equals(previous)) {
                    transitions.add(new Transition("recovered", "success", "Host voltou a responder normalmente."));
                }
            }
        } else {
            device.setConsecutiveFailures(device.getConsecutiveFailures() + 1);
            if (device.getConsecutiveFailures() >= device.getFailureThreshold() && !"offline".equals(previous)) {
                device.setStatus("offline");
                device.setLastStatusChange(now);
                device.setSlaBreached(false);
                int n = device.getConsecutiveFailures();
                transitions.add(new Transition(
                        "offline",
                        "error",
                        "Host não está respondendo (após " + n + " " + (n == 1 ? "falha" : "falhas seguidas") + ")."));
            }
        }

        Integer threshold = device.getSlaThresholdMs();
        Double latency = device.getLatency();
        if (threshold != null && threshold > 0 && result.ok() && latency != null) {
            if (latency > threshold && !device.isSlaBreached()) {
                device.setSlaBreached(true);
                transitions.add(new Transition(
                        "sla_breach",
                        "warning",
                        String.format(
                                Locale.ROOT,
                                "Limite de latência excedido: %.0f ms (limite %d ms, excedente %.0f ms).",
                                latency, threshold, latency - threshold)));
            } else if (latency <= threshold && device.isSlaBreached()) {
                device.setSlaBreached(false);
                transitions.add(new Transition(
                        "sla_recovered",
                        "info",
                        String.format(Locale.ROOT, "Latência de volta ao limite: %.0f ms (limite %d ms).", latency, threshold)));
            }
        } else if (threshold == null || threshold <= 0) {
            device.setSlaBreached(false);
        }
        return transitions;
    }
}
