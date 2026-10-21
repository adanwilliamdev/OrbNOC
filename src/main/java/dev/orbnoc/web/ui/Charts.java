package dev.orbnoc.web.ui;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.function.DoubleFunction;

/** Geometria de gráficos SVG calculada no servidor (sem biblioteca de gráficos no navegador). */
public final class Charts {

    private Charts() {}

    /** Marcação de eixo. {@code pos} é a coordenada no SVG; {@code text} o rótulo; {@code iso} (eixo x) a data. */
    public record Tick(double pos, String text, String iso) {}

    public record Line(
            double width,
            double height,
            double left,
            double right,
            double top,
            double bottom,
            String path,
            String area,
            List<Tick> yTicks,
            List<Tick> xTicks,
            boolean empty) {}

    public record Segment(String label, int count, String color, String dash, String offset) {}

    public record Donut(List<Segment> segments, int total, double circumference) {}

    private static String f(double v) {
        return String.format(Locale.ROOT, "%.1f", v);
    }

    /**
     * Linha com eixos. {@code values} em ordem cronológica (null = sem dado, quebra a linha);
     * {@code isoLabels} (mesmo tamanho) alimentam o eixo x.
     */
    public static Line line(
            List<String> isoLabels, List<Double> values, double min, double max, DoubleFunction<String> yFormat, boolean withTicks) {
        double w = 640;
        double h = 220;
        double l = withTicks ? 48 : 2;
        double r = withTicks ? 14 : 2;
        double t = withTicks ? 12 : 3;
        double b = withTicks ? 28 : 3;
        double plotW = w - l - r;
        double plotH = h - t - b;
        int n = values.size();
        boolean any = values.stream().anyMatch(v -> v != null);
        if (n == 0 || !any) return new Line(w, h, l, r, t, b, "", "", List.of(), List.of(), true);
        double span = max - min <= 0 ? 1 : max - min;

        StringBuilder path = new StringBuilder();
        StringBuilder area = new StringBuilder();
        double baseline = t + plotH;
        int segStart = -1;
        for (int i = 0; i <= n; i++) {
            Double v = i < n ? values.get(i) : null;
            if (v != null) {
                double x = n == 1 ? l + plotW / 2 : l + plotW * i / (n - 1);
                double y = t + (1 - Math.min(1, Math.max(0, (v - min) / span))) * plotH;
                if (segStart < 0) {
                    segStart = i;
                    path.append("M").append(f(x)).append(' ').append(f(y));
                    area.append("M").append(f(x)).append(' ').append(f(baseline)).append(" L").append(f(x)).append(' ').append(f(y));
                } else {
                    path.append(" L").append(f(x)).append(' ').append(f(y));
                    area.append(" L").append(f(x)).append(' ').append(f(y));
                }
            } else if (segStart >= 0) {
                int last = i - 1;
                double lx = n == 1 ? l + plotW / 2 : l + plotW * last / (n - 1);
                area.append(" L").append(f(lx)).append(' ').append(f(baseline)).append(" Z ");
                if (segStart == last) path.append(" l0.01 0"); // ponto isolado fica visível
                segStart = -1;
            }
        }

        List<Tick> yTicks = new ArrayList<>();
        List<Tick> xTicks = new ArrayList<>();
        if (withTicks) {
            for (int k = 0; k <= 4; k++) {
                double value = min + (max - min) * k / 4;
                double y = t + (1 - (double) k / 4) * plotH;
                yTicks.add(new Tick(y, yFormat.apply(value), null));
            }
            int ticks = Math.min(6, n);
            for (int k = 0; k < ticks; k++) {
                int idx = ticks == 1 ? 0 : (int) Math.round((double) k * (n - 1) / (ticks - 1));
                double x = n == 1 ? l + plotW / 2 : l + plotW * idx / (n - 1);
                xTicks.add(new Tick(x, "", isoLabels.get(idx)));
            }
        }
        return new Line(w, h, l, r, t, b, path.toString(), area.toString().trim(), yTicks, xTicks, false);
    }

    /** Anel (donut) com segmentos proporcionais; usa stroke-dasharray num círculo de raio 51. */
    public static Donut donut(List<Segment> inputs) {
        double radius = 51;
        double c = 2 * Math.PI * radius;
        int total = inputs.stream().mapToInt(Segment::count).sum();
        List<Segment> out = new ArrayList<>();
        if (total == 0) return new Donut(out, 0, c);
        long visible = inputs.stream().filter(s -> s.count() > 0).count();
        double gap = visible > 1 ? c * 3 / 360 : 0;
        double acc = 0;
        for (Segment s : inputs) {
            if (s.count() == 0) continue;
            double len = (double) s.count() / total * c;
            double dash = Math.max(0.5, len - gap);
            out.add(new Segment(s.label(), s.count(), s.color(), f(dash) + " " + f(c), f(-(acc + gap / 2))));
            acc += len;
        }
        return new Donut(out, total, c);
    }
}
