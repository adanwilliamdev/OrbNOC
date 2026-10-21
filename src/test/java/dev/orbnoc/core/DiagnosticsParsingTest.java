package dev.orbnoc.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class DiagnosticsParsingTest {

    @Test
    void interpretaSaidaDoTraceroute() {
        String out = """
                traceroute to 8.8.8.8 (8.8.8.8), 20 hops max, 60 byte packets
                 1  192.168.0.1  0.512 ms
                 2  *
                 3  10.20.30.40  12.3 ms
                """;
        List<Map<String, Object>> hops = DiagnosticsService.parseTraceroute(out);
        assertEquals(3, hops.size());
        assertEquals("192.168.0.1", hops.get(0).get("ip"));
        assertEquals(0.512, hops.get(0).get("latency"));
        assertNull(hops.get(1).get("ip"));
        assertNull(hops.get(1).get("latency"));
        assertEquals(12.3, hops.get(2).get("latency"));
    }

    @Test
    void extraiLatenciaDoPing() {
        assertEquals(0.05, Prober.parseRtt("64 bytes from 127.0.0.1: icmp_seq=1 ttl=64 time=0.045 ms"));
        assertEquals(12.0, Prober.parseRtt("Resposta de 1.1.1.1: bytes=32 tempo=12ms TTL=57"));
        assertEquals(0.5, Prober.parseRtt("Reply from 10.0.0.1: bytes=32 time<1ms TTL=64"));
        assertNull(Prober.parseRtt("Request timed out."));
    }

    @Test
    void formataRegistrosDns() {
        assertEquals("mail.example.com (priority 10)", DiagnosticsService.dnsValue("MX", "10 mail.example.com."));
        assertEquals("v=spf1 -all", DiagnosticsService.dnsValue("TXT", "\"v=spf1 -all\""));
        assertEquals("ns1.example.com", DiagnosticsService.dnsValue("NS", "ns1.example.com."));
    }

    @Test
    void convertePostgresUrlParaJdbc() {
        DatabaseConnection c = DatabaseConnection.parse(
                "postgresql://ana:p%40ss@db.exemplo.com/orbnoc?sslmode=require&channel_binding=require", "", "", false);
        assertEquals("jdbc:postgresql://db.exemplo.com:5432/orbnoc?sslmode=require", c.jdbcUrl());
        assertEquals("ana", c.username());
        assertEquals("p@ss", c.password());
        DatabaseConnection j = DatabaseConnection.parse("jdbc:postgresql://h:5432/x", "u", "p", false);
        assertEquals("jdbc:postgresql://h:5432/x", j.jdbcUrl());
        assertEquals("u", j.username());
    }
}
