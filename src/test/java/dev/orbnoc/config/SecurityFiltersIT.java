package dev.orbnoc.config;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.orbnoc.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

/** Proteção CSRF por origem e cabeçalhos de segurança, exercitados pela pilha HTTP completa. */
class SecurityFiltersIT extends IntegrationTestBase {

    private static final String LOGOUT = "/api/auth/logout";

    @Test
    void bloqueiaEscritaDeOutraOrigem() throws Exception {
        mvc.perform(MockMvcRequestBuilders.post(LOGOUT).header("Origin", "https://evil.example"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("Origem não permitida"));
    }

    @Test
    void bloqueiaEscritaQuandoSoORefererEOutroSite() throws Exception {
        mvc.perform(MockMvcRequestBuilders.post(LOGOUT).header("Referer", "https://evil.example/pagina"))
                .andExpect(status().isForbidden());
    }

    @Test
    void aceitaEscritaDaOrigemPublicaConfigurada() throws Exception {
        mvc.perform(MockMvcRequestBuilders.post(LOGOUT).header("Origin", "http://localhost:8080"))
                .andExpect(status().isOk());
        mvc.perform(MockMvcRequestBuilders.post(LOGOUT).header("Referer", "http://localhost:8080/painel"))
                .andExpect(status().isOk());
    }

    @Test
    void aceitaEscritaQuandoAOrigemEOProprioHost() throws Exception {
        mvc.perform(MockMvcRequestBuilders.post(LOGOUT)
                        .header("Host", "painel.exemplo.test")
                        .header("Origin", "http://painel.exemplo.test"))
                .andExpect(status().isOk());
    }

    @Test
    void clientesSemNavegadorPassam() throws Exception {
        mvc.perform(MockMvcRequestBuilders.post(LOGOUT)).andExpect(status().isOk());
    }

    @Test
    void leituraNaoEVerificadaPorOrigem() throws Exception {
        mvc.perform(MockMvcRequestBuilders.get("/api/auth/config").header("Origin", "https://evil.example"))
                .andExpect(status().isOk());
    }

    @Test
    void aplicaCabecalhosDeSeguranca() throws Exception {
        mvc.perform(MockMvcRequestBuilders.get("/health/live"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Referrer-Policy", "strict-origin-when-cross-origin"))
                .andExpect(header().string("Content-Security-Policy", containsString("frame-ancestors 'none'")))
                .andExpect(header().string("Content-Security-Policy", containsString("default-src 'self'")))
                // HSTS só em produção; em desenvolvimento (HTTP) não deve ser enviado.
                .andExpect(header().doesNotExist("Strict-Transport-Security"));
    }
}
