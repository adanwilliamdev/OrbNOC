package dev.orbnoc.service;

import dev.orbnoc.core.DeviceStateMachine;
import dev.orbnoc.core.ProbeResult;
import dev.orbnoc.domain.Device;
import dev.orbnoc.domain.Event;
import dev.orbnoc.domain.Metric;
import dev.orbnoc.repo.DeviceRepository;
import dev.orbnoc.repo.MetricRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

/** Aplica o resultado de uma sonda: estado, métrica e eventos. Usado pelo monitor e pelo ping manual. */
@Service
public class CheckService {

    private final MetricRepository metrics;
    private final DeviceRepository devices;
    private final EventService events;

    public CheckService(MetricRepository metrics, DeviceRepository devices, EventService events) {
        this.metrics = metrics;
        this.devices = devices;
        this.events = events;
    }

    /** Deve rodar dentro de uma transação do chamador. Devolve os eventos criados. */
    public List<Event> apply(Device device, ProbeResult result, Instant now) {
        List<Double> recent = recentSamples(device.getId());
        List<DeviceStateMachine.Transition> transitions = DeviceStateMachine.apply(device, result, recent, now);

        Metric metric = new Metric();
        metric.setDeviceId(device.getId());
        metric.setRecordedAt(now);
        metric.setOk(result.ok());
        metric.setLatency(result.ok() ? result.latencyMs() : null);
        metric.setJitter(device.getJitter());
        metric.setPacketLoss(device.getPacketLoss());
        metrics.save(metric);
        devices.save(device);

        List<Event> created = new ArrayList<>();
        for (DeviceStateMachine.Transition t : transitions) {
            created.add(events.record(device.getUserId(), device.getId(), t.kind(), t.severity(), t.message()));
        }
        return created;
    }

    private List<Double> recentSamples(Long deviceId) {
        List<Double> samples = new ArrayList<>();
        for (Metric m : metrics.findByDeviceIdOrderByRecordedAtDesc(deviceId, PageRequest.of(0, DeviceStateMachine.WINDOW - 1))) {
            samples.add(m.isOk() && m.getLatency() != null ? m.getLatency() : null);
        }
        Collections.reverse(samples);
        return samples;
    }
}
