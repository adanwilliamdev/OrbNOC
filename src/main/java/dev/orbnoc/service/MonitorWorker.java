package dev.orbnoc.service;

import dev.orbnoc.config.OrbNocProperties;
import dev.orbnoc.core.HostRejectedException;
import dev.orbnoc.core.NetGuard;
import dev.orbnoc.core.ProbeResult;
import dev.orbnoc.core.Prober;
import dev.orbnoc.domain.Device;
import dev.orbnoc.domain.Event;
import dev.orbnoc.repo.AccessLogRepository;
import dev.orbnoc.repo.DeviceRepository;
import dev.orbnoc.repo.EventRepository;
import dev.orbnoc.repo.MetricHourlyRepository;
import dev.orbnoc.repo.MetricRepository;
import jakarta.annotation.PreDestroy;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Monitor em segundo plano (dentro do mesmo processo). A cada tick escolhe os dispositivos
 * vencidos, sonda em paralelo (limitado por MONITOR_CONCURRENCY), grava o resultado e publica
 * as mudanças em tempo real. Também consolida métricas por hora e aplica a retenção.
 */
@Component
public class MonitorWorker {

    private static final Logger log = LoggerFactory.getLogger(MonitorWorker.class);

    private record Target(Long id, String ip, String checkType, Integer port) {}

    private record Round(int checked, long durationMillis) {}

    private final OrbNocProperties props;
    private final DeviceRepository devices;
    private final MetricRepository metrics;
    private final MetricHourlyRepository hourly;
    private final EventRepository events;
    private final AccessLogRepository accessLogs;
    private final CheckService checks;
    private final SlaService sla;
    private final Prober prober;
    private final RealtimeHub hub;
    private final Notifier notifier;
    private final TransactionTemplate tx;

    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "orbnoc-monitor");
        t.setDaemon(true);
        return t;
    });
    private volatile Instant lastBeat;
    private volatile Round lastRound = new Round(0, 0);
    private volatile Instant lastRollup = Instant.EPOCH;
    private volatile Instant lastRetention = Instant.EPOCH;
    private volatile Instant lastDetect = Instant.now();

    public MonitorWorker(
            OrbNocProperties props,
            DeviceRepository devices,
            MetricRepository metrics,
            MetricHourlyRepository hourly,
            EventRepository events,
            AccessLogRepository accessLogs,
            CheckService checks,
            SlaService sla,
            Prober prober,
            RealtimeHub hub,
            Notifier notifier,
            TransactionTemplate tx) {
        this.props = props;
        this.devices = devices;
        this.metrics = metrics;
        this.hourly = hourly;
        this.events = events;
        this.accessLogs = accessLogs;
        this.checks = checks;
        this.sla = sla;
        this.prober = prober;
        this.hub = hub;
        this.notifier = notifier;
        this.tx = tx;
    }

    @EventListener(ApplicationReadyEvent.class)
    void start() {
        prober.detect();
        if (!props.workerEnabled()) {
            log.info("Monitor desativado (WORKER_ENABLED=false)");
            return;
        }
        long tickMillis = Math.max(100, (long) (props.workerTickSeconds() * 1000));
        scheduler.scheduleWithFixedDelay(this::tick, 1000, tickMillis, TimeUnit.MILLISECONDS);
        log.info("Monitor iniciado (tick de {} ms, concorrência {})", tickMillis, props.monitorConcurrency());
    }

    @PreDestroy
    void stop() {
        scheduler.shutdownNow();
    }

    public boolean enabled() {
        return props.workerEnabled();
    }

    /** Idade do último ciclo concluído, em segundos; {@code null} se ainda não houve. */
    public Long heartbeatAgeSeconds() {
        Instant beat = lastBeat;
        return beat == null ? null : Duration.between(beat, Instant.now()).getSeconds();
    }

    public int lastCheckedCount() {
        return lastRound.checked();
    }

    // ---- ciclo -------------------------------------------------------------------------------------

    private void tick() {
        try {
            Instant now = Instant.now();
            lastRound = runRound(now);
            if (Duration.between(lastRollup, now).getSeconds() >= 60) {
                sla.rollupRecent(now);
                lastRollup = now;
            }
            if (Duration.between(lastRetention, now).toHours() >= 1) {
                applyRetention(now);
                lastRetention = now;
            }
            if (prober.icmpMode() == null && Duration.between(lastDetect, now).toHours() >= 1) {
                prober.detect(); // o ambiente pode ter passado a permitir ICMP
                lastDetect = now;
            }
            lastBeat = Instant.now();
        } catch (Exception e) {
            log.error("Falha no ciclo do monitor", e);
        }
    }

    Round runRound(Instant now) {
        long started = System.nanoTime();
        double tick = props.workerTickSeconds();
        List<Target> due = tx.execute(status -> devices.findMonitorable().stream()
                .filter(d -> isDue(d, now, tick))
                .map(d -> new Target(d.getId(), d.getIp(), d.getCheckType(), d.getPort()))
                .toList());
        if (due == null || due.isEmpty()) return new Round(0, 0);

        Semaphore limit = new Semaphore(props.monitorConcurrency());
        Map<Long, ProbeResult> results = new ConcurrentHashMap<>();
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            for (Target target : due) {
                executor.submit(() -> {
                    limit.acquireUninterruptibly();
                    try {
                        results.put(target.id(), probe(target));
                    } finally {
                        limit.release();
                    }
                });
            }
        }

        List<Event> created = new ArrayList<>();
        Map<Long, Device> touched = new HashMap<>();
        tx.executeWithoutResult(status -> {
            List<Long> ids = due.stream().map(Target::id).toList();
            for (Device device : devices.findByIdInOrderByIdAsc(ids)) {
                ProbeResult result = results.getOrDefault(device.getId(), ProbeResult.fail("icmp", null, "sem resultado"));
                created.addAll(checks.apply(device, result, now));
                touched.put(device.getId(), device);
            }
        });

        Set<Long> users = new LinkedHashSet<>();
        for (Device d : touched.values()) users.add(d.getUserId());
        for (Long userId : users) hub.publishDevices(userId);
        for (Event event : created) {
            hub.publishEvent(event);
            Device device = touched.get(event.getDeviceId());
            Notifier.Target target = device == null ? null : notifier.loadTarget(event.getUserId(), true);
            if (target != null) notifier.sendAsync(target, Notifier.format(device, event));
        }
        long millis = (System.nanoTime() - started) / 1_000_000;
        log.debug("Rodada: {} dispositivos em {} ms, {} evento(s)", due.size(), millis, created.size());
        return new Round(due.size(), millis);
    }

    private ProbeResult probe(Target target) {
        try {
            String address = NetGuard.resolveAndCheck(target.ip(), props.allowPrivateNetworks(), 5000).get(0);
            return prober.probe(address, target.checkType(), target.port());
        } catch (HostRejectedException e) {
            return ProbeResult.fail(target.checkType(), target.port(), e.getMessage());
        } catch (RuntimeException e) {
            log.warn("Erro ao sondar dispositivo {}: {}", target.id(), e.getClass().getSimpleName());
            return ProbeResult.fail(target.checkType(), target.port(), "erro interno na checagem");
        }
    }

    private static boolean isDue(Device device, Instant now, double tickSeconds) {
        if (device.getLastCheck() == null) return true;
        double elapsed = Duration.between(device.getLastCheck(), now).toMillis() / 1000.0;
        return elapsed >= device.getIntervalSeconds() - tickSeconds / 2;
    }

    private void applyRetention(Instant now) {
        tx.executeWithoutResult(status -> {
            int m = metrics.deleteOlderThan(now.minus(Duration.ofDays(props.metricsRetentionDays())));
            int h = hourly.deleteOlderThan(now.minus(Duration.ofDays(props.hourlyRetentionDays())));
            int e = events.deleteOlderThan(now.minus(Duration.ofDays(props.eventsRetentionDays())));
            int a = accessLogs.deleteOlderThan(now.minus(Duration.ofDays(props.accessLogRetentionDays())));
            if (m + h + e + a > 0) log.info("Retenção: {} métricas, {} horárias, {} eventos, {} acessos removidos", m, h, e, a);
        });
    }
}
