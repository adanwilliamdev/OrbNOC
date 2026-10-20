package com.orbnoc.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;

@RestController
@RequestMapping("/api/diagnostics")
@CrossOrigin(origins = "http://localhost:4200")
public class DiagnosticController {

    private final Random random = new Random();

    @GetMapping("/ping/{ip}")
    public ResponseEntity<Map<String, Object>> ping(@PathVariable String ip) {
        Map<String, Object> result = new HashMap<>();
        result.put("ip", ip);
        result.put("timestamp", LocalDateTime.now().toString());

        // Simula falha 10% das vezes
        boolean sucesso = random.nextInt(100) > 10;

        if (sucesso) {
            int latencia = random.nextInt(50) + 5;
            result.put("status", "SUCCESS");
            result.put("latency", latencia);
            result.put("message", "Resposta de " + ip + ": tempo=" + latencia + "ms TTL=64");
        } else {
            result.put("status", "TIMEOUT");
            result.put("latency", 0);
            result.put("message", "Esgotado o tempo limite do pedido para " + ip);
        }

        return ResponseEntity.ok(result);
    }

    @GetMapping("/traceroute/{ip}")
    public ResponseEntity<Map<String, Object>> traceroute(@PathVariable String ip) {
        Map<String, Object> result = new HashMap<>();
        result.put("ip", ip);
        result.put("timestamp", LocalDateTime.now().toString());

        StringBuilder log = new StringBuilder();
        log.append("Rastreando rota para ").append(ip).append(":\n");
        int hops = random.nextInt(4) + 3; // 3 a 6 saltos
        for (int i = 1; i <= hops; i++) {
            int ms1 = random.nextInt(30) + 5;
            int ms2 = random.nextInt(30) + 5;
            log.append(i).append("  10.0.").append(i).append(".1  ")
               .append(ms1).append(" ms  ").append(ms2).append(" ms\n");
        }
        log.append("Rastreamento completo.");

        result.put("status", "SUCCESS");
        result.put("log", log.toString());
        return ResponseEntity.ok(result);
    }
}