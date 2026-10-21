package dev.orbnoc.web.ui;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

/** Funções de apresentação usadas nos templates como {@code ${@fmt.metodo(...)}}. */
@Component("fmt")
public class ViewHelper {

    private static final Locale PT = Locale.forLanguageTag("pt-BR");
    private static final DateTimeFormatter UTC_TEXT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(ZoneOffset.UTC);

    public String ms(Double v) {
        if (v == null) return "—";
        return v >= 100 ? String.format(PT, "%.0f ms", v) : String.format(PT, "%.1f ms", v);
    }

    public String num(Double v, int decimals) {
        return v == null ? "—" : String.format(PT, "%." + decimals + "f", v);
    }

    public String pct(Double v, int decimals) {
        return v == null ? "—" : String.format(PT, "%." + decimals + "f%%", v);
    }

    public String latencyClass(Double v) {
        if (v == null) return "idle";
        return v < 50 ? "ok" : v < 150 ? "warn" : "bad";
    }

    public String statusLabel(String s) {
        return switch (s == null ? "" : s) {
            case "online" -> "Online";
            case "offline" -> "Offline";
            default -> "Aguardando";
        };
    }

    public String statusClass(String s) {
        return switch (s == null ? "" : s) {
            case "online" -> "ok";
            case "offline" -> "bad";
            default -> "idle";
        };
    }

    public String roleLabel(String role) {
        return "admin".equals(role) ? "Administrador" : "Usuário";
    }

    public String ago(Instant t) {
        if (t == null) return "nunca";
        long s = Math.max(0, Duration.between(t, Instant.now()).getSeconds());
        if (s < 5) return "agora";
        if (s < 60) return "há " + s + " s";
        if (s < 3600) return "há " + s / 60 + " min";
        if (s < 86400) return "há " + s / 3600 + " h";
        return "há " + s / 86400 + " d";
    }

    /** Há quanto tempo o estado atual dura, como "3h 12min". */
    public String since(Instant t) {
        if (t == null) return "—";
        long m = Math.max(0, Duration.between(t, Instant.now()).toMinutes());
        if (m < 1) return "menos de 1 min";
        if (m < 60) return m + " min";
        if (m < 1440) return m / 60 + "h " + m % 60 + "min";
        return m / 1440 + "d " + (m % 1440) / 60 + "h";
    }

    public String iso(Instant t) {
        return t == null ? "" : t.toString();
    }

    /** Texto provisório em UTC; o navegador troca pelo horário local (data-localtime). */
    public String utc(Instant t) {
        return t == null ? "—" : UTC_TEXT.format(t);
    }

    public String kindLabel(String kind) {
        return switch (kind == null ? "" : kind) {
            case "offline" -> "Host offline";
            case "recovered" -> "Host recuperado";
            case "sla_breach" -> "Latência acima do limite";
            case "sla_recovered" -> "Latência normalizada";
            default -> "Aviso";
        };
    }

    public String severityClass(String sev) {
        return switch (sev == null ? "" : sev) {
            case "error" -> "bad";
            case "warning" -> "warn";
            case "success" -> "ok";
            default -> "info";
        };
    }

    public String severityLabel(String sev) {
        return switch (sev == null ? "" : sev) {
            case "error" -> "Crítico";
            case "warning" -> "Aviso";
            case "success" -> "Resolvido";
            default -> "Info";
        };
    }

    public String barClass(Double v) {
        return latencyClass(v);
    }

    // ---- links que preservam filtros e ordenação ----------------------------------------------------

    public String filterUrl(DeviceQuery.Params p, String status) {
        return build(p.q(), status, p.min(), p.max(), p.sort(), p.dir());
    }

    public String sortUrl(DeviceQuery.Params p, String field) {
        String dir = field.equals(p.sort()) && "asc".equals(p.dir()) ? "desc" : "asc";
        return build(p.q(), p.status(), p.min(), p.max(), field, dir);
    }

    public String sortMark(DeviceQuery.Params p, String field) {
        if (!field.equals(p.sort())) return "";
        return "asc".equals(p.dir()) ? "▲" : "▼";
    }

    private static String build(String q, String status, String min, String max, String sort, String dir) {
        UriComponentsBuilder b = UriComponentsBuilder.fromPath("/");
        if (!q.isEmpty()) b.queryParam("q", q);
        if (!"all".equals(status)) b.queryParam("status", status);
        if (!min.isEmpty()) b.queryParam("min", min);
        if (!max.isEmpty()) b.queryParam("max", max);
        if (!"name".equals(sort)) b.queryParam("sort", sort);
        if (!"asc".equals(dir)) b.queryParam("dir", dir);
        return b.build().encode().toUriString();
    }
}
