package dev.orbnoc.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;

class NocMetricsTest {

    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();

    private double devices(String status) {
        return registry.get("orbnoc.devices").tag("status", status).gauge().value();
    }

    @Test
    void publicaDispositivosPorStatusComZeroParaOsAusentes() {
        new NocMetrics(() -> Map.of("online", 7L, "offline", 2L), () -> 5L, () -> 3).bindTo(registry);

        assertEquals(7, devices("online"));
        assertEquals(2, devices("offline"));
        assertEquals(0, devices("unknown"));
    }

    @Test
    void heartbeatEUltimaRodadaVemDoMonitor() {
        new NocMetrics(Map::of, () -> 12L, () -> 9).bindTo(registry);

        assertEquals(12, registry.get("orbnoc.monitor.heartbeat.age").gauge().value());
        assertEquals(9, registry.get("orbnoc.monitor.last.round.devices").gauge().value());
    }

    @Test
    void heartbeatAindaNaoExistenteViraNaN() {
        new NocMetrics(Map::of, () -> null, () -> 0).bindTo(registry);

        assertTrue(Double.isNaN(registry.get("orbnoc.monitor.heartbeat.age").gauge().value()));
    }

    @Test
    void umaConsultaServeTodosOsStatusDentroDaJanelaDeCache() {
        AtomicInteger consultas = new AtomicInteger();
        Supplier<Map<String, Long>> banco = () -> {
            consultas.incrementAndGet();
            return Map.of("online", 1L);
        };
        new NocMetrics(banco, () -> 1L, () -> 0).bindTo(registry);

        devices("online");
        devices("offline");
        devices("unknown");

        assertEquals(1, consultas.get());
    }

    @Test
    void falhaDoBancoNaoDerrubaAColeta() {
        new NocMetrics(
                        () -> {
                            throw new IllegalStateException("banco fora");
                        },
                        () -> 1L,
                        () -> 0)
                .bindTo(registry);

        assertEquals(0, devices("online"));
    }
}
