package com.orbnoc.service;

import com.orbnoc.model.Device;
import com.orbnoc.repository.DeviceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.net.InetAddress;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class PingMonitorService {

    private static final Logger log = LoggerFactory.getLogger(PingMonitorService.class);
    private final DeviceRepository repository;

    public PingMonitorService(DeviceRepository repository) {
        this.repository = repository;
    }

    // Roda a cada 30 segundos (fixedRate em milissegundos)
    @Scheduled(fixedRate = 30000)
    public void monitorarDispositivos() {
        List<Device> devices = repository.findAll();
        if (devices.isEmpty()) return;

        log.info("[NOC] Iniciando ciclo de ping em {} dispositivo(s) - {}", devices.size(), LocalDateTime.now());

        for (Device d : devices) {
            try {
                long inicio = System.currentTimeMillis();
                // timeout de 2 segundos por host
                boolean alcancavel = InetAddress.getByName(d.getIpAddress()).isReachable(2000);
                long latencia = System.currentTimeMillis() - inicio;

                if (alcancavel) {
                    d.setStatus("UP");
                    d.setLatency((int) latencia);
                    log.info("  UP   {} ({}) - {} ms", d.getHostname(), d.getIpAddress(), latencia);
                } else {
                    d.setStatus("DOWN");
                    d.setLatency(null);
                    log.warn("  DOWN {} ({})", d.getHostname(), d.getIpAddress());
                }
                repository.save(d);
            } catch (Exception e) {
                d.setStatus("DOWN");
                d.setLatency(null);
                repository.save(d);
                log.error("  ERRO {} ({}): {}", d.getHostname(), d.getIpAddress(), e.getMessage());
            }
        }
    }
}