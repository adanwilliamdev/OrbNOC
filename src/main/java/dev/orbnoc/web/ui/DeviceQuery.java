package dev.orbnoc.web.ui;

import dev.orbnoc.web.api.Dto;
import java.text.Collator;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/** Filtro, ordenação e estatísticas da lista de dispositivos (aplicados no servidor). */
public final class DeviceQuery {

    public record Params(String q, String status, String min, String max, String sort, String dir) {
        public static Params of(String q, String status, String min, String max, String sort, String dir) {
            String st = List.of("online", "offline", "unknown").contains(status) ? status : "all";
            String s = List.of("name", "ip", "status", "latency", "checked").contains(sort) ? sort : "name";
            return new Params(q == null ? "" : q.strip(), st, min == null ? "" : min.strip(), max == null ? "" : max.strip(),
                    s, "desc".equals(dir) ? "desc" : "asc");
        }

        public boolean hasAdvancedFilters() {
            return !min.isEmpty() || !max.isEmpty();
        }

        public boolean active() {
            return !q.isEmpty() || !"all".equals(status) || hasAdvancedFilters();
        }
    }

    public record Stats(int total, int online, int offline, int unknown, int availability, Double avgLatency) {}

    private DeviceQuery() {}

    public static Stats stats(List<Dto.DeviceOut> devices) {
        int online = 0;
        int offline = 0;
        int unknown = 0;
        double sum = 0;
        int withLatency = 0;
        for (Dto.DeviceOut d : devices) {
            switch (d.status()) {
                case "online" -> {
                    online++;
                    if (d.latency() != null) {
                        sum += d.latency();
                        withLatency++;
                    }
                }
                case "offline" -> offline++;
                default -> unknown++;
            }
        }
        int known = online + offline;
        int availability = known == 0 ? 0 : (int) Math.round((double) online / known * 100);
        return new Stats(devices.size(), online, offline, unknown, availability, withLatency == 0 ? null : sum / withLatency);
    }

    public static List<Dto.DeviceOut> apply(List<Dto.DeviceOut> devices, Params p) {
        String needle = p.q().toLowerCase(Locale.ROOT);
        Double min = parse(p.min());
        Double max = parse(p.max());
        List<Dto.DeviceOut> filtered = devices.stream()
                .filter(d -> needle.isEmpty()
                        || d.name().toLowerCase(Locale.ROOT).contains(needle)
                        || d.ip().toLowerCase(Locale.ROOT).contains(needle)
                        || (d.location() != null && d.location().toLowerCase(Locale.ROOT).contains(needle)))
                .filter(d -> "all".equals(p.status()) || p.status().equals(d.status()))
                .filter(d -> min == null || (d.latency() != null && d.latency() >= min))
                .filter(d -> max == null || (d.latency() != null && d.latency() <= max))
                .toList();
        Collator collator = Collator.getInstance(Locale.forLanguageTag("pt-BR"));
        collator.setStrength(Collator.PRIMARY);
        boolean desc = "desc".equals(p.dir());
        Comparator<Dto.DeviceOut> cmp = switch (p.sort()) {
            case "ip" -> (a, b) -> naturalCompare(a.ip(), b.ip());
            case "status" -> Comparator.comparingInt(d -> statusRank(d.status()));
            case "latency" -> Comparator.comparing(Dto.DeviceOut::latency, Comparator.nullsLast(Comparator.naturalOrder()));
            case "checked" -> Comparator.comparing(Dto.DeviceOut::lastCheck, Comparator.nullsLast(Comparator.naturalOrder()));
            default -> (a, b) -> collator.compare(a.name(), b.name());
        };
        boolean nullable = "latency".equals(p.sort()) || "checked".equals(p.sort());
        if (desc && !nullable) cmp = cmp.reversed();
        else if (desc) cmp = nullsLastDesc(p.sort());
        return filtered.stream().sorted(cmp).toList();
    }

    /** Em ordem decrescente os vazios continuam no fim. */
    private static Comparator<Dto.DeviceOut> nullsLastDesc(String sort) {
        if ("latency".equals(sort)) {
            return Comparator.comparing(Dto.DeviceOut::latency, Comparator.nullsLast(Comparator.<Double>reverseOrder()));
        }
        return Comparator.comparing(Dto.DeviceOut::lastCheck, Comparator.nullsLast(Comparator.<java.time.Instant>reverseOrder()));
    }

    private static int statusRank(String status) {
        return switch (status) {
            case "offline" -> 0;
            case "unknown" -> 1;
            default -> 2;
        };
    }

    private static Double parse(String text) {
        if (text == null || text.isBlank()) return null;
        try {
            return Double.parseDouble(text.replace(',', '.'));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Comparação "natural": 10.0.0.2 vem antes de 10.0.0.10. */
    public static int naturalCompare(String a, String b) {
        int i = 0;
        int j = 0;
        while (i < a.length() && j < b.length()) {
            char ca = a.charAt(i);
            char cb = b.charAt(j);
            if (Character.isDigit(ca) && Character.isDigit(cb)) {
                int si = i;
                int sj = j;
                while (i < a.length() && Character.isDigit(a.charAt(i))) i++;
                while (j < b.length() && Character.isDigit(b.charAt(j))) j++;
                String na = a.substring(si, i).replaceFirst("^0+(?=.)", "");
                String nb = b.substring(sj, j).replaceFirst("^0+(?=.)", "");
                int c = na.length() != nb.length() ? Integer.compare(na.length(), nb.length()) : na.compareTo(nb);
                if (c != 0) return c;
            } else {
                int c = Character.compare(Character.toLowerCase(ca), Character.toLowerCase(cb));
                if (c != 0) return c;
                i++;
                j++;
            }
        }
        return Integer.compare(a.length() - i, b.length() - j);
    }
}
