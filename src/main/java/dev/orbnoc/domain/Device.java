package dev.orbnoc.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "devices")
public class Device {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;

    private String name;

    private String ip;

    private String location;

    private String checkType = "icmp";

    private Integer port;

    private int intervalSeconds = 30;

    private int failureThreshold = 3;

    private Integer slaThresholdMs;

    private String status = "unknown";

    private int consecutiveFailures = 0;

    private boolean slaBreached = false;

    private Double latency;

    private Double avgLatency;

    private Double minLatency;

    private Double maxLatency;

    private Double jitter;

    private Double packetLoss;

    private String lastError;

    private Instant lastCheck;

    private Instant lastStatusChange;

    private Instant createdAt = Instant.now();

    public Device() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getIp() { return ip; }
    public void setIp(String ip) { this.ip = ip; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getCheckType() { return checkType; }
    public void setCheckType(String checkType) { this.checkType = checkType; }

    public Integer getPort() { return port; }
    public void setPort(Integer port) { this.port = port; }

    public int getIntervalSeconds() { return intervalSeconds; }
    public void setIntervalSeconds(int intervalSeconds) { this.intervalSeconds = intervalSeconds; }

    public int getFailureThreshold() { return failureThreshold; }
    public void setFailureThreshold(int failureThreshold) { this.failureThreshold = failureThreshold; }

    public Integer getSlaThresholdMs() { return slaThresholdMs; }
    public void setSlaThresholdMs(Integer slaThresholdMs) { this.slaThresholdMs = slaThresholdMs; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public int getConsecutiveFailures() { return consecutiveFailures; }
    public void setConsecutiveFailures(int consecutiveFailures) { this.consecutiveFailures = consecutiveFailures; }

    public boolean isSlaBreached() { return slaBreached; }
    public void setSlaBreached(boolean slaBreached) { this.slaBreached = slaBreached; }

    public Double getLatency() { return latency; }
    public void setLatency(Double latency) { this.latency = latency; }

    public Double getAvgLatency() { return avgLatency; }
    public void setAvgLatency(Double avgLatency) { this.avgLatency = avgLatency; }

    public Double getMinLatency() { return minLatency; }
    public void setMinLatency(Double minLatency) { this.minLatency = minLatency; }

    public Double getMaxLatency() { return maxLatency; }
    public void setMaxLatency(Double maxLatency) { this.maxLatency = maxLatency; }

    public Double getJitter() { return jitter; }
    public void setJitter(Double jitter) { this.jitter = jitter; }

    public Double getPacketLoss() { return packetLoss; }
    public void setPacketLoss(Double packetLoss) { this.packetLoss = packetLoss; }

    public String getLastError() { return lastError; }
    public void setLastError(String lastError) { this.lastError = lastError; }

    public Instant getLastCheck() { return lastCheck; }
    public void setLastCheck(Instant lastCheck) { this.lastCheck = lastCheck; }

    public Instant getLastStatusChange() { return lastStatusChange; }
    public void setLastStatusChange(Instant lastStatusChange) { this.lastStatusChange = lastStatusChange; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

}
