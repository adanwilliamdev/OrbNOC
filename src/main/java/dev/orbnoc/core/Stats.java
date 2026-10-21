package dev.orbnoc.core;

import java.util.ArrayList;
import java.util.List;

/** Estatísticas de janela deslizante (últimas N amostras). */
public final class Stats {

    public record WindowStats(Double avgLatency, Double minLatency, Double maxLatency, Double jitter, double packetLoss) {}

    private Stats() {}

    public static double round(double value, int decimals) {
        double factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
    }

    /** Média da diferença absoluta entre amostras consecutivas. */
    public static Double jitterMs(List<Double> latencies) {
        if (latencies.size() < 2) return latencies.isEmpty() ? null : 0.0;
        double sum = 0;
        for (int i = 1; i < latencies.size(); i++) sum += Math.abs(latencies.get(i) - latencies.get(i - 1));
        return round(sum / (latencies.size() - 1), 2);
    }

    /** {@code samples} em ordem cronológica; {@code null} = falha de checagem. */
    public static WindowStats windowStats(List<Double> samples) {
        if (samples.isEmpty()) return new WindowStats(null, null, null, null, 0.0);
        List<Double> valid = new ArrayList<>();
        for (Double s : samples) if (s != null) valid.add(s);
        double loss = round((double) (samples.size() - valid.size()) / samples.size() * 100, 1);
        if (valid.isEmpty()) return new WindowStats(null, null, null, null, loss);
        double sum = 0;
        double min = Double.MAX_VALUE;
        double max = -Double.MAX_VALUE;
        for (double v : valid) {
            sum += v;
            min = Math.min(min, v);
            max = Math.max(max, v);
        }
        return new WindowStats(round(sum / valid.size(), 2), min, max, jitterMs(valid), loss);
    }
}
