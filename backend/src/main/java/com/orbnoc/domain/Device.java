package com.orbnoc.domain;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "devices")
@Data
@NoArgsConstructor
public class Device {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String ipAddress;

    private String location;

    @Enumerated(EnumType.STRING)
    private DeviceStatus status = DeviceStatus.UNKNOWN;

    private LocalDateTime lastCheck;

    private Boolean active = true;

    @PrePersist
    protected void onCreate() {
        lastCheck = LocalDateTime.now();
    }
}