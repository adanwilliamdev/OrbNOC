package com.orbnoc.controller;

import com.orbnoc.model.Incident;
import com.orbnoc.repository.IncidentRepository;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/alerts")
@CrossOrigin(origins = "http://localhost:4200")
public class AlertsController {
    private final IncidentRepository repository;
    public AlertsController(IncidentRepository repository) { this.repository = repository; }

    @GetMapping
    public List<Map<String, Object>> list() {
        List<Map<String, Object>> alerts = new ArrayList<>();
        for (Incident i : repository.findAll()) {
            Map<String, Object> a = new HashMap<>();
            a.put("id", i.getId()); a.put("title", i.getTitle());
            a.put("description", i.getDescription()); a.put("severity", i.getSeverity());
            a.put("level", mapLevel(i.getSeverity())); a.put("status", i.getStatus());
            a.put("createdAt", i.getCreatedAt());
            alerts.add(a);
        }
        return alerts;
    }
    private String mapLevel(String s) {
        if ("CRITICAL".equals(s) || "HIGH".equals(s)) return "CRITICAL";
        if ("MEDIUM".equals(s)) return "WARN";
        return "INFO";
    }
}