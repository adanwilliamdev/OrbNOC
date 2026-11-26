package dev.orbnoc.service;

import dev.orbnoc.config.OrbNocProperties;
import dev.orbnoc.core.HostRejectedException;
import dev.orbnoc.core.ProbeResult;
import dev.orbnoc.core.Prober;
import dev.orbnoc.domain.Device;
import dev.orbnoc.domain.Event;
import dev.orbnoc.repo.AccessLogRepository;
import dev.orbnoc.repo.DeviceRepository;
import dev.orbnoc.repo.DeviceRepository.DueTarget;
import dev.orbnoc.repo.EventRepository;
import dev.orbnoc.repo.MetricHourlyRepository;
import dev.orbnoc.repo.MetricRepository;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
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
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Monitor em segundo plano (dentro do mesmo processo). A cada tick escolhe os dispositivos
 * vencidos (filtro no SQL), sonda em paralelo (limitado por MONITOR_CONCURRENCY), grava o
 * resultado em lote e publica as mudanças em tempo real. Também consolida métricas por hora e
 * aplica a retenção (em lotes).
 *
 * <p>A rodada roda em outra thread: se ela demorar mais que o tick (muitos hosts offline), o tick
 * seguinte é pulado (e contado em {@code orbnoc_monitor_ticks_skipped}), mas o heartbeat continua
 * andando. Com várias réplicas, só a líder ({@link LeaderLock}) executa o monitor.
 */
@Component
public class MonitorWorker {

    private static final Logger log = LoggerFactory.getLogger(MonitorWorker.class);

    record Round(int checked, long durationMillis) {}

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
    private final TargetPolicy policy;
    private final LeaderLock leader;
    private final TransactionTemplate tx;
    private final Timer roundTimer;
    private final Counter skippedTicks;
    private final Counter suppressedNotifications;

    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "orbnoc-monitor");
        t.setDaemon(true);
        return t;
    });
    private final ExecutorService roundExecutor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "orbnoc-monitor-round");
        t.setDaemon(true);
        return t;
    });
    private final AtomicBoolean roundRunning = new AtomicBoolean(false);
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
            TargetPolicy policy,
            LeaderLock leader,
            MeterRegistry meters,
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
        this.policy = policy;
        this.leader = leader;
        this.tx = tx;
        this.roundTimer = Timer.builder("orbnoc.monitor.round.duration")
                .description("Duração de cada rodada de checagens")
                .publishPercentileHistogram()
                .register(meters);
        this.skippedTicks = Counter.builder("orbnoc.monitor.ticks.skipped")
                .description("Ticks pulados porque a rodada anterior ainda estava em andamento")
                .register(meters);
        this.suppressedNotifications = Counter.builder("orbnoc.notifications")
                .tag("outcome", "suppressed")
                .description("Notificações")
                .register(meters);
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
        roundExecutor.shutdownNow();
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
            if (leader.isLeader()) {
                startRoundIfIdle();
                if (Duration.between(lastRollup, now).getSeconds() >= 60) {
                    sla.rollupRecent(now);
                    lastRollup = now;
                }
                if (Duration.between(lastRetention, now).toHours() >= 1) {
                    applyRetention(now);
                    lastRetention = now;
                }
            }
            if (prober.icmpMode() == null && Duration.between(lastDetect, now).toHours() >= 1) {
                prober.detect(); // o ambiente pode ter passado a permitir ICMP
                lastDetect = now;
            }
            lastBeat = Instant.now(); // o laço está vivo, mesmo com uma rodada longa em andamento
        } catch (Exception e) {
            log.error("Falha no ciclo do monitor", e);
        }
    }

    private void startRoundIfIdle() {
        if (!roundRunning.compareAndSet(false, true)) {
            skippedTicks.increment();
            return;
        }
        try {
            roundExecutor.execute(() -> {
                try {
                    lastRound = runRound(Instant.now());
                } catch (Exception e) {
                    log.error("Falha na rodada do monitor", e);
                } finally {
                    roundRunning.set(false);
                }
            });
        } catch (RuntimeException e) { // executor encerrado
            roundRunning.set(false);
        }
    }

    Round runRound(Instant now) {
        long started = System.nanoTime();
        List<DueTarget> due = devices.findDue(now, props.workerTickSeconds());
        if (due.isEmpty()) return new Round(0, 0);

        Semaphore limit = new Semaphore(props.monitorConcurrency());
        Map<Long, ProbeResult> results = new ConcurrentHashMap<>();
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            for (DueTarget target : due) {
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
            List<Long> ids = due.stream().map(DueTarget::id).toList();
            List<Device> loaded = devices.findByIdInOrderByIdAsc(ids);
            created.addAll(checks.applyAll(loaded, results, now));
            for (Device device : loaded) touched.put(device.getId(), device);
        });

        Set<Long> users = new LinkedHashSet<>();
        for (Device d : touched.values()) users.add(d.getUserId());
        for (Long userId : users) hub.publishDevices(userId);
        for (Event event : created) {
            hub.publishEvent(event);
            Device device = touched.get(event.getDeviceId());
            if (device == null) continue;
            if (suppressed(device, event, now)) {
                suppressedNotifications.increment();
                continue;
            }
            Notifier.Target target = notifier.loadTarget(event.getUserId(), true);
            if (target != null) notifier.sendAsync(target, Notifier.format(device, event));
        }
        long elapsed = System.nanoTime() - started;
        roundTimer.record(elapsed, TimeUnit.NANOSECONDS);
        long millis = elapsed / 1_000_000;
        log.debug("Rodada: {} dispositivos em {} ms, {} evento(s)", due.size(), millis, created.size());
        return new Round(due.size(), millis);
    }

    /**
     * Silencia a notificação (o evento continua registrado): dispositivo em manutenção, ou queda e
     * latência de um dispositivo cujo "pai" na topologia já está offline (o alerta do pai basta).
     */
    private boolean suppressed(Device device, Event event, Instant now) {
        if (device.inMaintenance(now)) return true;
        boolean alertKind = "offline".equals(event.getKind()) || "sla_breach".equals(event.getKind());
        return alertKind && device.getParentId() != null && devices.hasOfflineAncestor(device.getId());
    }

    private ProbeResult probe(DueTarget target) {
        try {
            String address = policy.resolve(target.ip(), target.ownerAdmin()).get(0);
            return prober.probe(address, target.checkType(), target.port());
        } catch (HostRejectedException e) {
            return ProbeResult.fail(target.checkType(), target.port(), e.getMessage());
        } catch (RuntimeException e) {
            log.warn("Erro ao sondar dispositivo {}: {}", target.id(), e.getClass().getSimpleName());
            return ProbeResult.fail(target.checkType(), target.port(), "erro interno na checagem");
        }
    }

    /** Cada tabela é limpa em lotes, fora de uma transação única, para não segurar locks por muito tempo. */
    private void applyRetention(Instant now) {
        int m = metrics.deleteOlderThan(now.minus(Duration.ofDays(props.metricsRetentionDays())));
        int h = hourly.deleteOlderThan(now.minus(Duration.ofDays(props.hourlyRetentionDays())));
        int e = events.deleteOlderThan(now.minus(Duration.ofDays(props.eventsRetentionDays())));
        int a = accessLogs.deleteOlderThan(now.minus(Duration.ofDays(props.accessLogRetentionDays())));
        if (m + h + e + a > 0) log.info("Retenção: {} métricas, {} horárias, {} eventos, {} acessos removidos", m, h, e, a);
    }
}
