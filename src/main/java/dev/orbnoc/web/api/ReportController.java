package dev.orbnoc.web.api;

import dev.orbnoc.domain.Device;
import dev.orbnoc.domain.User;
import dev.orbnoc.service.AuthService;
import dev.orbnoc.service.DeviceService;
import dev.orbnoc.service.ReportExporter;
import dev.orbnoc.service.SlaService;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ReportController {

    private static final MediaType XLSX = MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final AuthService auth;
    private final DeviceService devices;
    private final SlaService sla;

    public ReportController(AuthService auth, DeviceService devices, SlaService sla) {
        this.auth = auth;
        this.devices = devices;
        this.sla = sla;
    }

    static String window(String value) {
        Validate.require(SlaService.WINDOWS.containsKey(value), "Janela inválida (use 24h, 7d ou 30d)");
        return value;
    }

    @GetMapping("/api/sla")
    List<SlaService.SlaRow> sla(@RequestParam(defaultValue = "24h") String window, HttpServletRequest request) {
        User user = auth.requireUser(request);
        return sla.report(devices.list(user.getId()), window(window));
    }

    @GetMapping("/api/uptime-series")
    List<Map<String, Object>> uptimeSeries(@RequestParam(defaultValue = "24") int hours, HttpServletRequest request) {
        User user = auth.requireUser(request);
        Validate.require(hours >= 1 && hours <= 720, "Período: de 1 a 720 horas");
        return sla.uptimeSeries(user.getId(), hours);
    }

    @GetMapping("/api/reports/summary")
    Map<String, Object> summary(@RequestParam(defaultValue = "24h") String window, HttpServletRequest request) {
        User user = auth.requireUser(request);
        List<Device> list = devices.list(user.getId());
        List<SlaService.SlaRow> rows = sla.report(list, window(window));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("window", window);
        out.put("generated_at", Instant.now());
        out.put("totals", totals(list, rows));
        out.put("rows", rows);
        return out;
    }

    public static Map<String, Object> totals(List<Device> list, List<SlaService.SlaRow> rows) {
        long online = list.stream().filter(d -> "online".equals(d.getStatus())).count();
        long offline = list.stream().filter(d -> "offline".equals(d.getStatus())).count();
        double uptime = rows.stream().filter(r -> r.uptimePct() != null).mapToDouble(SlaService.SlaRow::uptimePct).average().orElse(Double.NaN);
        double latency = rows.stream().filter(r -> r.avgLatency() != null).mapToDouble(SlaService.SlaRow::avgLatency).average().orElse(Double.NaN);
        Map<String, Object> t = new LinkedHashMap<>();
        t.put("devices", list.size());
        t.put("online", online);
        t.put("offline", offline);
        t.put("unknown", list.size() - online - offline);
        t.put("avg_uptime", Double.isNaN(uptime) ? null : uptime);
        t.put("avg_latency", Double.isNaN(latency) ? null : latency);
        t.put("sla_breached", list.stream().filter(Device::isSlaBreached).count());
        return t;
    }

    @GetMapping("/api/reports/export")
    ResponseEntity<byte[]> export(
            @RequestParam(defaultValue = "24h") String window,
            @RequestParam(defaultValue = "csv") String format,
            HttpServletRequest request)
            throws IOException {
        User user = auth.requireUser(request);
        window(window);
        Validate.require("csv".equals(format) || "xlsx".equals(format), "Formato inválido (use csv ou xlsx)");
        List<SlaService.SlaRow> rows = sla.report(devices.list(user.getId()), window);
        boolean csv = "csv".equals(format);
        byte[] body = csv ? ReportExporter.csv(rows) : ReportExporter.xlsx(rows, window);
        String stamp = DateTimeFormatter.ofPattern("yyyyMMdd-HHmm").withZone(ZoneOffset.UTC).format(Instant.now());
        String filename = "orbnoc-sla-" + window + "-" + stamp + "." + format;
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString())
                .contentType(csv ? new MediaType("text", "csv", java.nio.charset.StandardCharsets.UTF_8) : XLSX)
                .body(body);
    }
}
