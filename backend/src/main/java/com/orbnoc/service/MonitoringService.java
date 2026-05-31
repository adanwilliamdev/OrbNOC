package com.orbnoc.service;

import com.orbnoc.domain.Device;
import com.orbnoc.domain.DeviceStatus;
import com.orbnoc.repository.DeviceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class MonitoringService {

    private final DeviceRepository deviceRepository;
    private final PingService pingService;
    private final SimpMessagingTemplate messagingTemplate;

    @Scheduled(fixedDelayString = "${monitoring.ping.interval}")
    public void monitorDevices() {
        List<Device> devices = deviceRepository.findByActiveTrue();
        List<Map<String, Object>> updates = new ArrayList<>();

        log.info("🔍 Monitorando {} dispositivos...", devices.size());

        for (Device device : devices) {
            PingService.PingResult result = pingService.ping(device.getIpAddress(), 3000);

            DeviceStatus newStatus = result.reachable() ? DeviceStatus.ONLINE : DeviceStatus.OFFLINE;
            boolean changed = device.getStatus() != newStatus;

            if (changed) {
                log.info("📡 {}: {} -> {}", device.getName(), device.getStatus(), newStatus);
                device.setStatus(newStatus);
                device.setLastCheck(LocalDateTime.now());
                deviceRepository.save(device);
            }

            Map<String, Object> update = new HashMap<>();
            update.put("id", device.getId());
            update.put("name", device.getName());
            update.put("ipAddress", device.getIpAddress());
            update.put("status", newStatus.toString());
            update.put("latency", result.latency());
            update.put("changed", changed);
            update.put("lastCheck", LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss")));
            updates.add(update);
        }

        // Envia atualização via WebSocket
        try {
            messagingTemplate.convertAndSend("/topic/monitoring", updates);
            log.info("📤 Dados enviados via WebSocket: {} atualizações", updates.size());
        } catch (Exception e) {
            log.error("❌ Erro ao enviar WebSocket: {}", e.getMessage());
        }
    }
}