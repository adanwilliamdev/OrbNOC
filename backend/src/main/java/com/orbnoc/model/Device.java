package com.orbnoc.model;

import jakarta.persistence.*;

@Entity
@Table(name = "devices")
public class Device {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String hostname;
    private String ipAddress;
    private String deviceType;
    private String status;
    private String location;
    private Integer latency;
    
    // Novos campos
    private String tags; // Ex: "Rack 01, Datacenter A"
    private boolean maintenance; // Mute de alertas
    private String monitorUrl; // Para checagem HTTP (ex: https://google.com)

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getHostname() { return hostname; }
    public void setHostname(String hostname) { this.hostname = hostname; }
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
    public String getDeviceType() { return deviceType; }
    public void setDeviceType(String deviceType) { this.deviceType = deviceType; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public Integer getLatency() { return latency; }
    public void setLatency(Integer latency) { this.latency = latency; }
    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }
    public boolean isMaintenance() { return maintenance; }
    public void setMaintenance(boolean maintenance) { this.maintenance = maintenance; }
    public String getMonitorUrl() { return monitorUrl; }
    public void setMonitorUrl(String monitorUrl) { this.monitorUrl = monitorUrl; }
}