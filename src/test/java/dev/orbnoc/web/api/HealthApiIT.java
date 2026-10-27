package dev.orbnoc.web.api;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.orbnoc.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;

class HealthApiIT extends IntegrationTestBase {

    @Test
    void livenessNaoExigeAutenticacao() throws Exception {
        getAs(null, "/health/live").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    void healthConsultaOBancoRealEInformaOMonitor() throws Exception {
        getAs(null, "/health")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.checks.database.ok").value(true))
                // O monitor está desligado nos testes e o Prober simulado não detecta ICMP.
                .andExpect(jsonPath("$.checks.monitor.ok").value(true))
                .andExpect(jsonPath("$.checks.monitor.disabled").value(true))
                .andExpect(jsonPath("$.checks.monitor.icmp_mode").value("tcp-fallback"));

        getAs(null, "/api/health").andExpect(status().isOk());
    }
}
