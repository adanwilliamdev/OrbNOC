package com.orbnoc.controller;

import org.springframework.web.bind.annotation.*;
import java.net.InetAddress;
import java.net.Socket;
import java.util.*;

@RestController
@RequestMapping("/api/tools")
@CrossOrigin(origins = "http://localhost:4200")
public class ToolsController {

    @GetMapping("/dns/{host}")
    public Map<String, Object> dns(@PathVariable String host) {
        Map<String, Object> res = new HashMap<>();
        try {
            InetAddress[] addrs = InetAddress.getAllByName(host);
            List<String> ips = new ArrayList<>();
            for (InetAddress a : addrs) ips.add(a.getHostAddress());
            res.put("message", "Resolucao OK: " + String.join(", ", ips));
        } catch (Exception e) { res.put("message", "Erro DNS."); }
        return res;
    }

    @GetMapping("/portscan/{ip}")
    public Map<String, Object> portscan(@PathVariable String ip) {
        Map<String, Object> res = new HashMap<>();
        StringBuilder sb = new StringBuilder("Escaneando portas em " + ip + "...\n\n");
        int[] portas = {21, 22, 23, 25, 53, 80, 443, 3306, 3389, 8080};
        for (int p : portas) {
            try (Socket socket = new Socket()) {
                socket.connect(new java.net.InetSocketAddress(ip, p), 500);
                sb.append("  [ABERTA] Porta ").append(p).append("\n");
            } catch (Exception e) {
                sb.append("  [FECHADA] Porta ").append(p).append("\n");
            }
        }
        res.put("message", sb.toString());
        return res;
    }

    @GetMapping("/networkscan/{subnet}")
    public Map<String, Object> networkscan(@PathVariable String subnet) {
        Map<String, Object> res = new HashMap<>();
        StringBuilder sb = new StringBuilder("Escaneando sub-rede " + subnet + ".0/24 (pode demorar)...\n\n");
        for (int i = 1; i <= 254; i++) {
            String ip = subnet + "." + i;
            try {
                if (InetAddress.getByName(ip).isReachable(100)) {
                    sb.append("  [ATIVO] ").append(ip).append("\n");
                }
            } catch (Exception ignored) {}
        }
        res.put("message", sb.toString());
        return res;
    }
}