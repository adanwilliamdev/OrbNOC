package dev.orbnoc.support;

import static org.junit.jupiter.api.Assertions.fail;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.JsonPath;
import dev.orbnoc.config.OrbNocProperties;
import dev.orbnoc.core.ProbeResult;
import dev.orbnoc.core.Prober;
import dev.orbnoc.domain.User;
import dev.orbnoc.service.UserService;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Base dos testes de integração: sobe a aplicação inteira contra um PostgreSQL real (Testcontainers).
 *
 * <ul>
 *   <li>Um único contêiner por execução da suíte (padrão singleton), compartilhado por todas as
 *       classes; o contexto do Spring também é reaproveitado entre elas.
 *   <li>O banco é esvaziado antes de cada teste ({@code TRUNCATE}), então os testes não dependem
 *       da ordem de execução.
 *   <li>O {@link Prober} é simulado: sondas reais iriam à rede, e o {@code NetGuard} bloqueia
 *       loopback de propósito.
 *   <li>Sem Docker, os testes são ignorados localmente; no CI (variável {@code CI}) falham, para
 *       não passar em silêncio sem testar nada.
 * </ul>
 */
@SpringBootTest(
        webEnvironment = WebEnvironment.RANDOM_PORT,
        properties = {
            "orbnoc.environment=development",
            "orbnoc.jwt-secret=integration-tests-jwt-secret-0123456789abcdef",
            "orbnoc.worker-enabled=false",
            "orbnoc.public-url=http://localhost:8080",
            "orbnoc.allow-private-networks=true"
        })
@AutoConfigureMockMvc
public abstract class IntegrationTestBase {

    protected static final String SENHA = "Senha1234";

    /** Contêiner único da suíte, iniciado sob demanda (só depois de confirmar que há Docker). */
    private static final class Postgres {
        static final PostgreSQLContainer<?> CONTAINER = new PostgreSQLContainer<>("postgres:16-alpine");

        static {
            CONTAINER.start();
        }
    }

    @DynamicPropertySource
    static void bancoDeDados(DynamicPropertyRegistry registry) {
        registry.add("orbnoc.database-url", () -> Postgres.CONTAINER.getJdbcUrl());
        registry.add("orbnoc.database-user", () -> Postgres.CONTAINER.getUsername());
        registry.add("orbnoc.database-password", () -> Postgres.CONTAINER.getPassword());
    }

    @BeforeAll
    static void exigirDocker() {
        boolean disponivel = DockerClientFactory.instance().isDockerAvailable();
        if (!disponivel && System.getenv("CI") != null) {
            fail("Docker é obrigatório para os testes de integração no CI");
        }
        assumeTrue(disponivel, "Docker indisponível: testes de integração ignorados");
    }

    @Autowired protected MockMvc mvc;
    @Autowired protected ObjectMapper json;
    @Autowired protected JdbcTemplate jdbc;
    @Autowired protected UserService users;
    @Autowired protected OrbNocProperties props;

    @MockitoBean protected Prober prober;

    @BeforeEach
    void limparBanco() {
        jdbc.execute("TRUNCATE TABLE metrics_hourly, metrics, events, notification_channels, devices, "
                + "access_logs, users RESTART IDENTITY CASCADE");
    }

    // ---- dados ----------------------------------------------------------------------------------

    protected User createUser(String username, String password, String role) {
        return users.create(username, username + "@example.com", password, role);
    }

    /** Faz login pela API e devolve o cookie de sessão emitido. */
    protected Cookie loginAs(String username, String password) throws Exception {
        String setCookie = mvc.perform(MockMvcRequestBuilders.post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("username", username, "password", password))))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getHeader(HttpHeaders.SET_COOKIE);
        String par = setCookie.split(";", 2)[0];
        int igual = par.indexOf('=');
        return new Cookie(par.substring(0, igual), par.substring(igual + 1));
    }

    /** Cria um dispositivo ICMP pela API e devolve o id. */
    protected long createDevice(Cookie cookie, String name, String ip, int failureThreshold) throws Exception {
        String body = postAs(cookie, "/api/devices", Map.of(
                        "name", name,
                        "ip", ip,
                        "check_type", "icmp",
                        "interval_seconds", 30,
                        "failure_threshold", failureThreshold))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    // ---- sondas simuladas ------------------------------------------------------------------------

    protected void probeReturns(ProbeResult first, ProbeResult... rest) {
        when(prober.probe(anyString(), anyString(), any())).thenReturn(first, rest);
    }

    protected static ProbeResult up(double latencyMs) {
        return new ProbeResult(true, latencyMs, "icmp", null, null);
    }

    protected static ProbeResult down() {
        return ProbeResult.fail("icmp", null, "timeout");
    }

    // ---- requisições -------------------------------------------------------------------------------

    protected String toJson(Object value) throws Exception {
        return json.writeValueAsString(value);
    }

    protected ResultActions getAs(Cookie cookie, String url) throws Exception {
        return send(MockMvcRequestBuilders.get(url), cookie, null);
    }

    protected ResultActions postAs(Cookie cookie, String url, Object body) throws Exception {
        return send(MockMvcRequestBuilders.post(url), cookie, body);
    }

    protected ResultActions patchAs(Cookie cookie, String url, Object body) throws Exception {
        return send(MockMvcRequestBuilders.patch(url), cookie, body);
    }

    protected ResultActions putAs(Cookie cookie, String url, Object body) throws Exception {
        return send(MockMvcRequestBuilders.put(url), cookie, body);
    }

    protected ResultActions deleteAs(Cookie cookie, String url) throws Exception {
        return send(MockMvcRequestBuilders.delete(url), cookie, null);
    }

    private ResultActions send(MockHttpServletRequestBuilder request, Cookie cookie, Object body) throws Exception {
        if (cookie != null) request.cookie(cookie);
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(toJson(body));
        return mvc.perform(request);
    }
}
