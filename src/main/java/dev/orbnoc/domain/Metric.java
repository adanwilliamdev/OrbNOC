package dev.orbnoc.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "metrics")
public class Metric {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long deviceId;

    private Instant recordedAt = Instant.now();

    private boolean ok;

    private Double latency;

    private Double jitter;

    private Double packetLoss;

    public Metric() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getDeviceId() { return deviceId; }
    public void setDeviceId(Long deviceId) { this.deviceId = deviceId; }

    public Instant getRecordedAt() { return recordedAt; }
    public void setRecordedAt(Instant recordedAt) { this.recordedAt = recordedAt; }

    public boolean isOk() { return ok; }
    public void setOk(boolean ok) { this.ok = ok; }

    public Double getLatency() { return latency; }
    public void setLatency(Double latency) { this.latency = latency; }

    public Double getJitter() { return jitter; }
    public void setJitter(Double jitter) { this.jitter = jitter; }

    public Double getPacketLoss() { return packetLoss; }
    public void setPacketLoss(Double packetLoss) { this.packetLoss = packetLoss; }

}
