package com.orbnoc.controller;

import com.orbnoc.model.Device;
import com.orbnoc.repository.DeviceRepository;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/topology")
@CrossOrigin(origins = "http://localhost:4200")
public class TopologyController {
    private final DeviceRepository repository;
    public TopologyController(DeviceRepository repository) { this.repository = repository; }

    @GetMapping
    public Map<String, Object> getTopology() {
        List<Device> devices = repository.findAll();
        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> links = new ArrayList<>();

        Map<String, Object> core = new HashMap<>();
        core.put("id", "core"); core.put("label", "Core"); core.put("type", "CORE");
        core.put("status", "UP"); core.put("x", 400); core.put("y", 60);
        nodes.add(core);

        int step = devices.isEmpty() ? 0 : 360 / Math.max(devices.size(), 1);
        int radius = 220, cx = 400, cy = 320;

        for (int i = 0; i < devices.size(); i++) {
            Device d = devices.get(i);
            double angle = Math.toRadians(i * step - 90);
            int x = cx + (int)(radius * Math.cos(angle));
            int y = cy + (int)(radius * Math.sin(angle));

            Map<String, Object> node = new HashMap<>();
            node.put("id", d.getId()); node.put("label", d.getHostname());
            node.put("type", d.getDeviceType()); node.put("status", d.getStatus());
            node.put("ip", d.getIpAddress()); node.put("latency", d.getLatency());
            node.put("x", x); node.put("y", y);
            nodes.add(node);

            Map<String, Object> link = new HashMap<>();
            link.put("source", "core"); link.put("target", d.getId());
            links.add(link);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("nodes", nodes); result.put("links", links);
        return result;
    }
}