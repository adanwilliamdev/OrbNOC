package dev.orbnoc.domain;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

/** Chave composta de {@link MetricHourly}: dispositivo + hora. */
public class MetricHourlyId implements Serializable {

    private Long deviceId;
    private Instant hourStart;

    public MetricHourlyId() {}

    public MetricHourlyId(Long deviceId, Instant hourStart) {
        this.deviceId = deviceId;
        this.hourStart = hourStart;
    }

    public Long getDeviceId() { return deviceId; }
    public Instant getHourStart() { return hourStart; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof MetricHourlyId other)) return false;
        return Objects.equals(deviceId, other.deviceId) && Objects.equals(hourStart, other.hourStart);
    }

    @Override
    public int hashCode() { return Objects.hash(deviceId, hourStart); }
}
