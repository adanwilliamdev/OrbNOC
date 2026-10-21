package dev.orbnoc.web.ui;

import dev.orbnoc.web.api.Dto;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Posiciona o núcleo e os dispositivos do mapa de rede (hierárquico, radial ou grade). */
public final class NetworkLayout {

    public static final double NODE_W = 168;
    public static final double NODE_H = 76;

    public record Node(String id, String title, String subtitle, String status, double x, double y, boolean core,
                       String statusText, String latency, String checked, String meta) {
        public String transform() {
            return String.format(Locale.ROOT, "translate(%.1f %.1f)", x, y);
        }
    }

    public record Edge(String path, String status) {}

    public record Layout(List<Node> nodes, List<Edge> edges, double minX, double minY, double width, double height) {
        public String viewBox() {
            return String.format(Locale.ROOT, "%.0f %.0f %.0f %.0f", minX, minY, width, height);
        }
    }

    private NetworkLayout() {}

    public static String normalizeMode(String mode) {
        return "radial".equals(mode) || "grid".equals(mode) ? mode : "hierarchical";
    }

    public static Layout build(
            List<Dto.DeviceOut> devices, String mode, String coreTitle, String coreSubtitle, ViewHelper fmt) {
        int n = devices.size();
        List<Node> nodes = new ArrayList<>();
        double coreX;
        double coreY;
        double[][] pos = new double[n][2];
        switch (normalizeMode(mode)) {
            case "radial" -> {
                double radius = Math.max(240, n * 30.0);
                coreX = 0;
                coreY = 0;
                for (int i = 0; i < n; i++) {
                    double angle = 2 * Math.PI * i / Math.max(1, n) - Math.PI / 2;
                    pos[i][0] = coreX + radius * Math.cos(angle);
                    pos[i][1] = coreY + radius * Math.sin(angle) * 0.8;
                }
            }
            case "grid" -> {
                int cols = 4;
                coreX = 0;
                coreY = 0;
                for (int i = 0; i < n; i++) {
                    int idx = i + 1; // a célula 0 é o núcleo
                    pos[i][0] = (idx % cols) * (NODE_W + 36);
                    pos[i][1] = (idx / cols) * (NODE_H + 44);
                }
            }
            default -> {
                int cols = Math.max(1, Math.min(6, n));
                coreX = (cols - 1) * (NODE_W + 28) / 2;
                coreY = 0;
                for (int i = 0; i < n; i++) {
                    pos[i][0] = (i % cols) * (NODE_W + 28);
                    pos[i][1] = 170 + (i / cols) * (NODE_H + 52);
                }
            }
        }
        nodes.add(new Node("core", coreTitle, coreSubtitle, "core", coreX, coreY, true, "Núcleo", "", "", "Monitor"));
        List<Edge> edges = new ArrayList<>();
        boolean vertical = "hierarchical".equals(normalizeMode(mode));
        for (int i = 0; i < n; i++) {
            Dto.DeviceOut d = devices.get(i);
            nodes.add(new Node(
                    "d" + d.id(), d.name(), d.ip() + (d.location() == null ? "" : " · " + d.location()), d.status(),
                    pos[i][0], pos[i][1], false, fmt.statusLabel(d.status()), fmt.ms(d.latency()), fmt.ago(d.lastCheck()),
                    fmt.ms(d.latency())));
            edges.add(new Edge(edge(coreX, coreY, pos[i][0], pos[i][1], vertical), d.status()));
        }
        double minX = Double.MAX_VALUE;
        double minY = Double.MAX_VALUE;
        double maxX = -Double.MAX_VALUE;
        double maxY = -Double.MAX_VALUE;
        for (Node node : nodes) {
            minX = Math.min(minX, node.x());
            minY = Math.min(minY, node.y());
            maxX = Math.max(maxX, node.x() + NODE_W);
            maxY = Math.max(maxY, node.y() + NODE_H);
        }
        double pad = 40;
        return new Layout(nodes, edges, minX - pad, minY - pad, maxX - minX + 2 * pad, maxY - minY + 2 * pad);
    }

    private static String edge(double cx, double cy, double x, double y, boolean vertical) {
        double sx = cx + NODE_W / 2;
        double tx = x + NODE_W / 2;
        if (vertical) {
            double sy = cy + NODE_H;
            double mid = sy + (y - sy) / 2;
            return String.format(Locale.ROOT, "M%.1f %.1f C%.1f %.1f %.1f %.1f %.1f %.1f", sx, sy, sx, mid, tx, mid, tx, y);
        }
        double sy = cy + NODE_H / 2;
        double ty = y + NODE_H / 2;
        double mx = (sx + tx) / 2;
        return String.format(Locale.ROOT, "M%.1f %.1f C%.1f %.1f %.1f %.1f %.1f %.1f", sx, sy, mx, sy, mx, ty, tx, ty);
    }
}
