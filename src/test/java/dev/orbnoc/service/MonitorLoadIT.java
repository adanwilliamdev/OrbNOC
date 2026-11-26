package dev.orbnoc.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.orbnoc.domain.User;
import dev.orbnoc.repo.MetricRepository;
import dev.orbnoc.support.IntegrationTestBase;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Teste de carga do monitor com dispositivos simulados (o {@code Prober} é mock). Fica desligado
 * no build normal; rode com: {@code mvn verify -Dit.test=MonitorLoadIT -Dorbnoc.load=true
 * [-Dorbnoc.load.devices=5000]}. Ele mede a rodada completa (consulta de vencidos, sondas, lote de
 * métricas/estados) e falha se passar do orçamento de tempo.
 */
@EnabledIfSystemProperty(named = "orbnoc.load", matches = "true")
class MonitorLoadIT extends IntegrationTestBase {

    private static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");

    @Autowired MonitorWorker worker;
    @Autowired MetricRepository metrics;

    @Test
    void rodadaComMilharesDeDispositivosCabeNoOrcamento() {
        int total = Integer.getInteger("orbnoc.load.devices", 2000);
        long orcamentoMs = Long.getLong("orbnoc.load.budget.ms", 30_000);
        User dono = createUser("carga", SENHA, "user");
        jdbc.update(
                "INSERT INTO devices (user_id, name, ip) SELECT ?, 'h' || g, "
                        + "'10.' || ((g / 65536) % 256) || '.' || ((g / 256) % 256) || '.' || (g % 256) "
                        + "FROM generate_series(1, ?) g",
                dono.getId(), total);
        probeReturns(up(5.0));

        var primeira = worker.runRound(T0);
        var segunda = worker.runRound(T0.plusSeconds(31));

        System.out.printf("Carga: %d dispositivos; rodada 1 = %d ms, rodada 2 = %d ms%n",
                total, primeira.durationMillis(), segunda.durationMillis());
        assertEquals(total, primeira.checked());
        assertEquals(total, segunda.checked());
        assertEquals(2L * total, metrics.count());
        assertTrue(primeira.durationMillis() < orcamentoMs, "primeira rodada acima do orçamento");
        assertTrue(segunda.durationMillis() < orcamentoMs, "segunda rodada acima do orçamento");
    }
}
