package dev.orbnoc.web.api;

import dev.orbnoc.config.OrbNocProperties;
import dev.orbnoc.core.Prober;
import dev.orbnoc.service.MonitorWorker;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Saúde do serviço: {@code /health/live} (processo) e {@code /health} (banco + monitor). */
@RestController
public class HealthController {

    private final JdbcTemplate jdbc;
    private final MonitorWorker worker;
    private final Prober prober;
    private final OrbNocProperties props;

    public HealthController(JdbcTemplate jdbc, MonitorWorker worker, Prober prober, OrbNocProperties props) {
        this.jdbc = jdbc;
        this.worker = worker;
        this.prober = prober;
        this.props = props;
    }

    @GetMapping("/health/live")
    Map<String, Object> live() {
        return Map.of("status", "ok");
    }

    @GetMapping({"/health", "/api/health"})
    ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> checks = new LinkedHashMap<>();
        boolean healthy = true;

        boolean db;
        try {
            db = Integer.valueOf(1).equals(jdbc.queryForObject("SELECT 1", Integer.class));
        } catch (RuntimeException e) {
            db = false;
        }
        checks.put("database", Map.of("ok", db));
        healthy &= db;

        Map<String, Object> monitor = new LinkedHashMap<>();
        if (!worker.enabled()) {
            monitor.put("ok", true);
            monitor.put("disabled", true);
        } else {
            Long age = worker.heartbeatAgeSeconds();
            boolean ok = age != null && age <= props.healthWorkerMaxAgeSeconds();
            monitor.put("ok", ok);
            monitor.put("age_seconds", age);
            healthy &= ok;
        }
        monitor.put("icmp_mode", prober.icmpMode() == null ? "tcp-fallback" : prober.icmpMode());
        checks.put("monitor", monitor);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", healthy ? "ok" : "degraded");
        body.put("checks", checks);
        return ResponseEntity.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).body(body);
    }
}
