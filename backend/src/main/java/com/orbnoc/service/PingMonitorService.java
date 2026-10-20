package com.orbnoc.service;

import com.orbnoc.model.Device;
import com.orbnoc.repository.DeviceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

@Service
public class PingMonitorService {
    private static final Logger log = LoggerFactory.getLogger(PingMonitorService.class);
    private final DeviceRepository repository;
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();

    public PingMonitorService(DeviceRepository repository) {
        this.repository = repository;
    }

    @Scheduled(fixedRate = 30000)
    public void monitorarDispositivos() {
        List<Device> devices = repository.findAll();
        for (Device d : devices) {
            if (d.isMaintenance()) {
                log.info("[MUTE] {} em manutencao. Ignorando.", d.getHostname());
                continue;
            }

            try {
                long inicio = System.currentTimeMillis();
                boolean sucesso = false;

                // Se tem URL, testa HTTP, senao testa ICMP
                if (d.getMonitorUrl() != null && !d.getMonitorUrl().isEmpty()) {
                    HttpRequest req = HttpRequest.newBuilder().uri(URI.create(d.getMonitorUrl())).GET().build();
                    HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
                    sucesso = (res.statusCode() >= 200 && res.statusCode() < 400);
                } else {
                    sucesso = InetAddress.getByName(d.getIpAddress()).isReachable(2000);
                }

                long latencia = System.currentTimeMillis() - inicio;

                if (sucesso) {
                    d.setStatus("UP");
                    d.setLatency((int) latencia);
                } else {
                    if (!"DOWN".equals(d.getStatus())) {
                        log.warn("[NOC] Dispositivo {} caiu! Disparando alertas.", d.getHostname());
                        // Aqui entraria a chamada do TelegramService
                    }
                    d.setStatus("DOWN");
                    d.setLatency(null);
                }
                repository.save(d);
            } catch (Exception e) {
                d.setStatus("DOWN");
                repository.save(d);
            }
        }
    }
}