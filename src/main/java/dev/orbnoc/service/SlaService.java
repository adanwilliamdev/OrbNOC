package dev.orbnoc.service;

import dev.orbnoc.core.Stats;
import dev.orbnoc.domain.Device;
import dev.orbnoc.repo.MetricHourlyRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** SLA: consolida amostras em hora e calcula disponibilidade/latência por janela. */
@Service
public class SlaService {

    public static final Map<String, Duration> WINDOWS =
            Map.of("24h", Duration.ofHours(24), "7d", Duration.ofDays(7), "30d", Duration.ofDays(30));

    public record SlaWindow(String window, Double uptimePct, Double avgLatency, long sampleCount) {}

    public record SlaRow(
            Long deviceId,
            String name,
            String ip,
            String location,
            String status,
            String window,
            Double uptimePct,
            Double avgLatency,
            long sampleCount,
            Integer slaThresholdMs) {}

    private static final String ROLLUP_SQL = """
            INSERT INTO metrics_hourly (device_id, hour, samples, ok_samples, avg_latency, min_latency, max_latency)
            SELECT device_id,
                   date_trunc('hour', recorded_at) AS hour,
                   count(*),
                   count(*) FILTER (WHERE ok),
                   avg(latency) FILTER (WHERE ok),
                   min(latency) FILTER (WHERE ok),
                   max(latency) FILTER (WHERE ok)
            FROM metrics
            WHERE recorded_at >= ?
            GROUP BY device_id, date_trunc('hour', recorded_at)
            ON CONFLICT (device_id, hour) DO UPDATE SET
                samples = EXCLUDED.samples,
                ok_samples = EXCLUDED.ok_samples,
                avg_latency = EXCLUDED.avg_latency,
                min_latency = EXCLUDED.min_latency,
                max_latency = EXCLUDED.max_latency
            """;

    private final MetricHourlyRepository hourly;
    private final JdbcTemplate jdbc;

    public SlaService(MetricHourlyRepository hourly, JdbcTemplate jdbc) {
        this.hourly = hourly;
        this.jdbc = jdbc;
    }

    /** Consolida as amostras recentes em agregados por hora (idempotente). */
    public void rollupRecent(Instant now) {
        Instant since = now.minus(Duration.ofHours(2)).truncatedTo(ChronoUnit.HOURS);
        jdbc.update(ROLLUP_SQL, since.atOffset(java.time.ZoneOffset.UTC));
    }

    public Map<Long, SlaWindow> byDevice(List<Long> ids, String window) {
        Map<Long, SlaWindow> out = new HashMap<>();
        if (ids.isEmpty()) return out;
        Instant since = Instant.now().minus(WINDOWS.get(window)).truncatedTo(ChronoUnit.HOURS);
        for (Object[] r : hourly.aggregateByDevice(ids, since)) {
            Long id = ((Number) r[0]).longValue();
            long samples = ((Number) r[1]).longValue();
            long ok = ((Number) r[2]).longValue();
            Double weighted = r[3] == null ? null : ((Number) r[3]).doubleValue();
            Double uptime = samples > 0 ? Stats.round((double) ok / samples * 100, 3) : null;
            Double avg = ok > 0 && weighted != null ? Stats.round(weighted / ok, 2) : null;
            out.put(id, new SlaWindow(window, uptime, avg, samples));
        }
        return out;
    }

    public List<SlaRow> report(List<Device> devices, String window) {
        Map<Long, SlaWindow> data = byDevice(devices.stream().map(Device::getId).toList(), window);
        return devices.stream().map(d -> {
            SlaWindow w = data.get(d.getId());
            return new SlaRow(
                    d.getId(), d.getName(), d.getIp(), d.getLocation(), d.getStatus(), window,
                    w == null ? null : w.uptimePct(),
                    w == null ? null : w.avgLatency(),
                    w == null ? 0 : w.sampleCount(),
                    d.getSlaThresholdMs());
        }).toList();
    }

    /** Série horária agregada da frota: hora, online, offline, uptime %, latência média. */
    public List<Map<String, Object>> uptimeSeries(Long userId, int hours) {
        Instant since = Instant.now().minus(Duration.ofHours(hours)).truncatedTo(ChronoUnit.HOURS);
        List<Map<String, Object>> series = new java.util.ArrayList<>();
        for (Object[] r : hourly.uptimeSeries(userId, since)) {
            long samples = ((Number) r[3]).longValue();
            long ok = ((Number) r[4]).longValue();
            Double weighted = r[5] == null ? null : ((Number) r[5]).doubleValue();
            Map<String, Object> p = new java.util.LinkedHashMap<>();
            p.put("hour", r[0]);
            p.put("online", ((Number) r[1]).longValue());
            p.put("offline", ((Number) r[2]).longValue());
            p.put("uptime", samples > 0 ? Stats.round((double) ok / samples * 100, 2) : null);
            p.put("avgLatency", ok > 0 && weighted != null ? Stats.round(weighted / ok, 2) : null);
            series.add(p);
        }
        return series;
    }
}
