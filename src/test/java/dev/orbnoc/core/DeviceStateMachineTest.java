package dev.orbnoc.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.orbnoc.core.DeviceStateMachine.Transition;
import dev.orbnoc.domain.Device;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;

class DeviceStateMachineTest {

    private static final ProbeResult OK = new ProbeResult(true, 20.0, "icmp", null, null);
    private static final ProbeResult FAIL = ProbeResult.fail("icmp", null, "timeout");
    private static final Instant NOW = Instant.parse("2026-01-01T00:00:00Z");

    private static Device device(String status) {
        Device d = new Device();
        d.setName("d");
        d.setIp("10.0.0.1");
        d.setStatus(status);
        return d;
    }

    private static List<String> kinds(List<Transition> transitions) {
        return transitions.stream().map(Transition::kind).toList();
    }

    @Test
    void desconhecidoParaOnlineNaoAlerta() {
        Device d = device("unknown");
        assertTrue(DeviceStateMachine.apply(d, OK, List.of(), NOW).isEmpty());
        assertEquals("online", d.getStatus());
        assertEquals(20.0, d.getLatency());
        assertEquals(NOW, d.getLastStatusChange());
    }

    @Test
    void perdaIsoladaNaoDerrubaOHost() {
        Device d = device("online");
        assertTrue(DeviceStateMachine.apply(d, FAIL, List.of(20.0), NOW).isEmpty());
        assertEquals("online", d.getStatus());
        assertEquals(1, d.getConsecutiveFailures());
        assertNull(d.getLatency());
        assertEquals("timeout", d.getLastError());
    }

    @Test
    void ficaOfflineAposTresFalhasSeguidasUmaSoVez() {
        Device d = device("online");
        List<Transition> all = new ArrayList<>();
        for (int i = 0; i < 5; i++) all.addAll(DeviceStateMachine.apply(d, FAIL, List.of(), NOW));
        assertEquals(List.of("offline"), kinds(all));
        assertEquals("offline", d.getStatus());
    }

    @Test
    void contadorZeraNoSucesso() {
        Device d = device("online");
        DeviceStateMachine.apply(d, FAIL, List.of(), NOW);
        DeviceStateMachine.apply(d, FAIL, List.of(), NOW);
        DeviceStateMachine.apply(d, OK, List.of(), NOW);
        assertEquals(0, d.getConsecutiveFailures());
        DeviceStateMachine.apply(d, FAIL, List.of(), NOW);
        assertEquals("online", d.getStatus());
    }

    @Test
    void recuperacao() {
        Device d = device("offline");
        d.setConsecutiveFailures(7);
        List<Double> recent = new ArrayList<>();
        recent.add(null);
        recent.add(null);
        List<Transition> out = DeviceStateMachine.apply(d, OK, recent, NOW);
        assertEquals(List.of("recovered"), kinds(out));
        assertEquals("online", d.getStatus());
        assertEquals(0, d.getConsecutiveFailures());
    }

    @Test
    void limiteConfiguravel() {
        Device d = device("online");
        d.setFailureThreshold(1);
        assertEquals(List.of("offline"), kinds(DeviceStateMachine.apply(d, FAIL, List.of(), NOW)));
    }

    @Test
    void violacaoDeSlaAvisaUmaVezEDepoisNormaliza() {
        Device d = device("online");
        d.setSlaThresholdMs(50);
        ProbeResult slow = new ProbeResult(true, 120.0, "icmp", null, null);
        ProbeResult fast = new ProbeResult(true, 30.0, "icmp", null, null);
        assertEquals(List.of("sla_breach"), kinds(DeviceStateMachine.apply(d, slow, List.of(), NOW)));
        assertTrue(DeviceStateMachine.apply(d, slow, List.of(), NOW).isEmpty());
        assertEquals(List.of("sla_recovered"), kinds(DeviceStateMachine.apply(d, fast, List.of(), NOW)));
        assertFalse(d.isSlaBreached());
    }

    @Test
    void latenciaZeroEAmostraValida() {
        Device d = device("online");
        d.setSlaThresholdMs(50);
        DeviceStateMachine.apply(d, new ProbeResult(true, 0.0, "icmp", null, null), List.of(), NOW);
        assertEquals(0.0, d.getLatency());
        assertEquals(0.0, d.getAvgLatency());
    }

    @Test
    void estatisticasDeJanela() {
        List<Double> samples = new ArrayList<>(List.of(10.0));
        samples.add(null);
        samples.add(30.0);
        samples.add(20.0);
        Stats.WindowStats s = Stats.windowStats(samples);
        assertEquals(25.0, s.packetLoss());
        assertEquals(10.0, s.minLatency());
        assertEquals(30.0, s.maxLatency());
        assertEquals(20.0, s.avgLatency());
        assertEquals(15.0, s.jitter()); // |30-10|=20 e |20-30|=10 -> 15
        assertNull(Stats.windowStats(List.of()).avgLatency());
        assertEquals(100.0, Stats.windowStats(Collections.nCopies(2, null)).packetLoss());
        assertEquals(0.0, Stats.jitterMs(List.of(5.0)));
    }

    @Test
    void janelaLimitadaADez() {
        Device d = device("online");
        List<Double> recent = new ArrayList<>(Collections.nCopies(30, 1.0));
        DeviceStateMachine.apply(d, OK, recent, NOW.plusSeconds(1));
        assertNotNull(d.getAvgLatency());
        assertTrue(d.getAvgLatency() > 1.0); // só as últimas 10 entram
    }
}
