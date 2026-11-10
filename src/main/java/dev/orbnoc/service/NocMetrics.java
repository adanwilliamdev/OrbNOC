package dev.orbnoc.service;

import dev.orbnoc.repo.DeviceRepository;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.binder.MeterBinder;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Métricas de NOC expostas em {@code /actuator/prometheus} (porta de gestão):
 *
 * <ul>
 *   <li>{@code orbnoc_devices{status}}: dispositivos por status (consulta em cache por alguns segundos);
 *   <li>{@code orbnoc_monitor_heartbeat_age_seconds}: idade do último ciclo do monitor (NaN até o primeiro);
 *   <li>{@code orbnoc_monitor_last_round_devices}: dispositivos checados na última rodada.
 * </ul>
 *
 * Os contadores {@code orbnoc_probe_results_total} e {@code orbnoc_events_total} ficam no {@link CheckService}.
 */
@Component
public class NocMetrics implements MeterBinder {

    static final List<String> STATUSES = List.of("online", "offline", "unknown");
    private static final long CACHE_MILLIS = 10_000;

    private final Supplier<Map<String, Long>> deviceCounts;
    private final Supplier<Long> heartbeatAgeSeconds;
    private final Supplier<Integer> lastRoundDevices;

    private Map<String, Long> cached = Map.of();
    private long cachedAt;

    @Autowired
    public NocMetrics(DeviceRepository devices, MonitorWorker worker) {
        this(devices::countByStatus, worker::heartbeatAgeSeconds, worker::lastCheckedCount);
    }

    NocMetrics(
            Supplier<Map<String, Long>> deviceCounts,
            Supplier<Long> heartbeatAgeSeconds,
            Supplier<Integer> lastRoundDevices) {
        this.deviceCounts = deviceCounts;
        this.heartbeatAgeSeconds = heartbeatAgeSeconds;
        this.lastRoundDevices = lastRoundDevices;
    }

    @Override
    public void bindTo(MeterRegistry registry) {
        for (String status : STATUSES) {
            Gauge.builder("orbnoc.devices", this, m -> m.devicesWithStatus(status))
                    .description("Dispositivos monitorados por status")
                    .tag("status", status)
                    .register(registry);
        }
        Gauge.builder("orbnoc.monitor.heartbeat.age", this, NocMetrics::heartbeatAge)
                .description("Idade do último ciclo concluído do monitor")
                .baseUnit("seconds")
                .register(registry);
        Gauge.builder("orbnoc.monitor.last.round.devices", this, m -> m.lastRoundDevices.get())
                .description("Dispositivos checados na última rodada do monitor")
                .register(registry);
    }

    private double heartbeatAge() {
        Long age = heartbeatAgeSeconds.get();
        return age == null ? Double.NaN : age;
    }

    /** Uma consulta por janela de cache, não uma por série; em falha do banco mantém o último valor. */
    private synchronized double devicesWithStatus(String status) {
        long now = System.currentTimeMillis();
        if (now - cachedAt > CACHE_MILLIS) {
            try {
                cached = deviceCounts.get();
            } catch (RuntimeException e) {
                // banco indisponível: o /health já sinaliza; aqui só não derrubamos a coleta
            }
            cachedAt = now;
        }
        return cached.getOrDefault(status, 0L);
    }
}
