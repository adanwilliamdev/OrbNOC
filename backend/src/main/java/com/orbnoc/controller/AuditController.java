package com.orbnoc.controller;

import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/audit")
@CrossOrigin(origins = "http://localhost:4200")
public class AuditController {
    @GetMapping
    public List<Map<String, Object>> list() {
        List<Map<String, Object>> logs = new ArrayList<>();
        logs.add(log("Sistema", "Monitoramento iniciado", "Servico de ping automatico iniciou", "INFO"));
        logs.add(log("admin", "Dispositivo cadastrado", "Novo ativo adicionado", "INFO"));
        logs.add(log("admin", "Incidente criado", "Incidente #1 registrado", "WARN"));
        logs.add(log("operador", "Diagnostico executado", "Ping em 8.8.8.8 (24ms)", "INFO"));
        return logs;
    }
    private Map<String, Object> log(String u, String a, String d, String l) {
        Map<String, Object> m = new HashMap<>();
        m.put("user", u); m.put("action", a); m.put("detail", d); m.put("level", l);
        m.put("timestamp", LocalDateTime.now().minusMinutes(new Random().nextInt(120)).toString());
        return m;
    }
}