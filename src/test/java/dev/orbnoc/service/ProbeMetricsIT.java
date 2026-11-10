package dev.orbnoc.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.orbnoc.support.IntegrationTestBase;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.search.Search;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Os contadores de sonda e de evento sobem quando um ping manual passa pelo CheckService. */
class ProbeMetricsIT extends IntegrationTestBase {

    @Autowired MeterRegistry meters;

    private Cookie sessao;

    @BeforeEach
    void usuario() throws Exception {
        createUser("ana", SENHA, "user");
        sessao = loginAs("ana", SENHA);
    }

    /** Soma de um contador por nome e tag; o registro é compartilhado entre testes, então medimos a diferença. */
    private double total(String nome, String tag, String valor) {
        Search busca = meters.find(nome);
        if (tag != null) busca = busca.tag(tag, valor);
        return busca.counters().stream().mapToDouble(c -> c.count()).sum();
    }

    @Test
    void pingBemSucedidoContaSondaOk() throws Exception {
        long id = createDevice(sessao, "Roteador", "10.0.0.1", 1);
        double antes = total("orbnoc.probe.results", "outcome", "ok");
        probeReturns(up(5.0));

        postAs(sessao, "/api/devices/" + id + "/ping", null).andExpect(status().isOk());

        assertEquals(1, total("orbnoc.probe.results", "outcome", "ok") - antes);
    }

    @Test
    void quedaContaSondaFalhaEEventoDeTransicao() throws Exception {
        long id = createDevice(sessao, "Switch", "10.0.0.2", 1);
        double sondasAntes = total("orbnoc.probe.results", "outcome", "fail");
        double eventosAntes = total("orbnoc.events", null, null);
        probeReturns(down());

        postAs(sessao, "/api/devices/" + id + "/ping", null).andExpect(status().isOk());

        assertEquals(1, total("orbnoc.probe.results", "outcome", "fail") - sondasAntes);
        assertEquals(1, total("orbnoc.events", null, null) - eventosAntes);
    }
}
