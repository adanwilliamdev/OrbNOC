package com.orbnoc.controller;

import org.springframework.web.bind.annotation.*;
import java.net.InetAddress;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/tools")
@CrossOrigin(origins = "http://localhost:4200")
public class ToolsController {

    @GetMapping("/dns/{host}")
    public Map<String, Object> dns(@PathVariable String host) {
        Map<String, Object> res = new HashMap<>();
        res.put("query", host);
        res.put("timestamp", LocalDateTime.now().toString());
        try {
            InetAddress[] addrs = InetAddress.getAllByName(host);
            List<String> ips = new ArrayList<>();
            for (InetAddress a : addrs) ips.add(a.getHostAddress());
            res.put("status", "SUCCESS");
            res.put("addresses", ips);
            res.put("message", "Resolucao OK para " + host + " -> " + String.join(", ", ips));
        } catch (Exception e) {
            res.put("status", "ERROR");
            res.put("message", "Falha ao resolver DNS: " + e.getMessage());
        }
        return res;
    }

    @GetMapping("/whois/{host}")
    public Map<String, Object> whois(@PathVariable String host) {
        Map<String, Object> res = new HashMap<>();
        res.put("status", "SUCCESS");
        res.put("message", "WHOIS simulado para " + host + "\nRegistrar: NIC.br\nCriado: 2001-09-03\nExpira: 2027-09-03");
        return res;
    }
}