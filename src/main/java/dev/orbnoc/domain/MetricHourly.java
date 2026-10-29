package dev.orbnoc.domain;

import java.time.Instant;

public class MetricHourly {

    private Long deviceId;

    private Instant hourStart;

    private int samples;

    private int okSamples;

    private Double avgLatency;

    private Double minLatency;

    private Double maxLatency;

    public MetricHourly() {}

    public Long getDeviceId() { return deviceId; }
    public void setDeviceId(Long deviceId) { this.deviceId = deviceId; }

    public Instant getHourStart() { return hourStart; }
    public void setHourStart(Instant hourStart) { this.hourStart = hourStart; }

    public int getSamples() { return samples; }
    public void setSamples(int samples) { this.samples = samples; }

    public int getOkSamples() { return okSamples; }
    public void setOkSamples(int okSamples) { this.okSamples = okSamples; }

    public Double getAvgLatency() { return avgLatency; }
    public void setAvgLatency(Double avgLatency) { this.avgLatency = avgLatency; }

    public Double getMinLatency() { return minLatency; }
    public void setMinLatency(Double minLatency) { this.minLatency = minLatency; }

    public Double getMaxLatency() { return maxLatency; }
    public void setMaxLatency(Double maxLatency) { this.maxLatency = maxLatency; }

}
