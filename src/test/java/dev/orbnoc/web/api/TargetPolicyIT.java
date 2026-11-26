package dev.orbnoc.web.api;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.orbnoc.support.IntegrationTestBase;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

/** Usuários comuns só alcançam redes privadas da allowlist; admins não; e o limite de dispositivos vale. */
@TestPropertySource(properties = {"orbnoc.user-allowed-cidrs=10.1.0.0/16", "orbnoc.max-devices-per-user=2"})
class TargetPolicyIT extends IntegrationTestBase {

    @Test
    void usuarioComumSoCriaMonitorDentroDaAllowlist() throws Exception {
        createUser("ana", SENHA, "user");
        Cookie ana = loginAs("ana", SENHA);

        postAs(ana, "/api/devices", Map.of("name", "fora", "ip", "10.2.0.1")).andExpect(status().isUnprocessableEntity());
        postAs(ana, "/api/devices", Map.of("name", "dentro", "ip", "10.1.0.5")).andExpect(status().isCreated());
        postAs(ana, "/api/devices", Map.of("name", "publico", "ip", "8.8.8.8")).andExpect(status().isCreated());
    }

    @Test
    void adminNaoEhLimitadoPelaAllowlist() throws Exception {
        createUser("chefe", SENHA, "admin");
        Cookie chefe = loginAs("chefe", SENHA);

        postAs(chefe, "/api/devices", Map.of("name", "fora", "ip", "10.2.0.1")).andExpect(status().isCreated());
    }

    @Test
    void diagnosticoDeUsuarioComumTambemRespeitaAAllowlist() throws Exception {
        createUser("ana", SENHA, "user");
        Cookie ana = loginAs("ana", SENHA);

        postAs(ana, "/api/diagnostic/ports", Map.of("host", "10.2.0.1", "ports", java.util.List.of(22)))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void limiteDeDispositivosPorUsuario() throws Exception {
        createUser("ana", SENHA, "user");
        Cookie ana = loginAs("ana", SENHA);

        postAs(ana, "/api/devices", Map.of("name", "a", "ip", "10.1.0.1")).andExpect(status().isCreated());
        postAs(ana, "/api/devices", Map.of("name", "b", "ip", "10.1.0.2")).andExpect(status().isCreated());
        postAs(ana, "/api/devices", Map.of("name", "c", "ip", "10.1.0.3")).andExpect(status().isUnprocessableEntity());
    }
}
