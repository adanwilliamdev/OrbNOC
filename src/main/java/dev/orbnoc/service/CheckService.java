package dev.orbnoc.service;

import dev.orbnoc.core.DeviceStateMachine;
import dev.orbnoc.core.ProbeResult;
import dev.orbnoc.domain.Device;
import dev.orbnoc.domain.Event;
import dev.orbnoc.domain.Metric;
import dev.orbnoc.repo.DeviceRepository;
import dev.orbnoc.repo.MetricRepository;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** Aplica o resultado de uma sonda: estado, métrica e eventos. Usado pelo monitor e pelo ping manual. */
@Service
public class CheckService {

    private final MetricRepository metrics;
    private final DeviceRepository devices;
    private final EventService events;
    private final MeterRegistry meters;

    public CheckService(MetricRepository metrics, DeviceRepository devices, EventService events, MeterRegistry meters) {
        this.metrics = metrics;
        this.devices = devices;
        this.events = events;
        this.meters = meters;
    }

    /** Deve rodar dentro de uma transação do chamador. Devolve os eventos criados. */
    public List<Event> apply(Device device, ProbeResult result, Instant now) {
        return applyAll(List.of(device), Map.of(device.getId(), result), now);
    }

    /**
     * Aplica vários resultados de uma vez (uma rodada do monitor): busca o histórico recente de
     * todos numa consulta e grava métricas e estados em lote. Deve rodar dentro de uma transação
     * do chamador. Devolve os eventos criados, na ordem dos dispositivos.
     */
    public List<Event> applyAll(List<Device> list, Map<Long, ProbeResult> results, Instant now) {
        if (list.isEmpty()) return List.of();
        Map<Long, List<Double>> history = metrics.recentSamples(
                list.stream().map(Device::getId).toList(), DeviceStateMachine.WINDOW - 1);

        List<Metric> newMetrics = new ArrayList<>(list.size());
        List<Event> created = new ArrayList<>();
        for (Device device : list) {
            ProbeResult result = results.getOrDefault(device.getId(), ProbeResult.fail("icmp", null, "sem resultado"));
            List<Double> recent = history.getOrDefault(device.getId(), List.of());
            List<DeviceStateMachine.Transition> transitions = DeviceStateMachine.apply(device, result, recent, now);

            Metric metric = new Metric();
            metric.setDeviceId(device.getId());
            metric.setRecordedAt(now);
            metric.setOk(result.ok());
            metric.setLatency(result.ok() ? result.latencyMs() : null);
            metric.setJitter(device.getJitter());
            metric.setPacketLoss(device.getPacketLoss());
            newMetrics.add(metric);

            meters.counter(
                            "orbnoc.probe.results",
                            "method", result.method() == null ? "unknown" : result.method(),
                            "outcome", result.ok() ? "ok" : "fail")
                    .increment();

            for (DeviceStateMachine.Transition t : transitions) {
                meters.counter("orbnoc.events", "kind", t.kind(), "severity", t.severity()).increment();
                created.add(events.record(device.getUserId(), device.getId(), t.kind(), t.severity(), t.message()));
            }
        }
        metrics.saveAll(newMetrics);
        devices.updateStateBatch(list);
        return created;
    }
}
