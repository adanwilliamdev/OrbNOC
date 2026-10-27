package dev.orbnoc.web.api;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.orbnoc.support.IntegrationTestBase;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class DeviceApiIT extends IntegrationTestBase {

    private Cookie ana;
    private Cookie bruno;

    @BeforeEach
    void usuarios() throws Exception {
        createUser("ana", SENHA, "user");
        createUser("bruno", SENHA, "user");
        ana = loginAs("ana", SENHA);
        bruno = loginAs("bruno", SENHA);
    }

    private long contar(String sql, Object... args) {
        Long n = jdbc.queryForObject(sql, Long.class, args);
        return n == null ? 0 : n;
    }

    private void criacaoInvalida(Map<String, Object> corpo, String detalhe) throws Exception {
        postAs(ana, "/api/devices", corpo)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value(detalhe));
    }

    // ---- criação e validação -----------------------------------------------------------------

    @Test
    void exigeAutenticacao() throws Exception {
        getAs(null, "/api/devices")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Não autenticado"));
        postAs(null, "/api/devices", Map.of("name", "x", "ip", "10.0.0.1")).andExpect(status().isUnauthorized());
    }

    @Test
    void criaDispositivoIcmpComPadroes() throws Exception {
        postAs(ana, "/api/devices", Map.of("name", "Roteador", "ip", "10.0.0.1", "location", "Rack 1"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.name").value("Roteador"))
                .andExpect(jsonPath("$.ip").value("10.0.0.1"))
                .andExpect(jsonPath("$.location").value("Rack 1"))
                .andExpect(jsonPath("$.check_type").value("icmp"))
                .andExpect(jsonPath("$.interval_seconds").value(30))
                .andExpect(jsonPath("$.failure_threshold").value(3))
                .andExpect(jsonPath("$.status").value("unknown"));

        assertEquals(1, contar("SELECT count(*) FROM devices WHERE user_id = 1"));
    }

    @Test
    void criaDispositivoTcpComPorta() throws Exception {
        postAs(ana, "/api/devices", Map.of("name", "HTTPS", "ip", "10.0.0.2", "check_type", "tcp", "port", 443))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.check_type").value("tcp"))
                .andExpect(jsonPath("$.port").value(443));
    }

    @Test
    void rejeitaDadosInvalidos() throws Exception {
        criacaoInvalida(Map.of("name", "x", "ip", "10.0.0.3", "check_type", "tcp"), "Informe a porta para checagem TCP");
        criacaoInvalida(Map.of("name", "x", "ip", "10.0.0.3", "check_type", "http"), "Tipo de checagem inválido");
        criacaoInvalida(Map.of("name", "x", "ip", "10.0.0.3", "interval_seconds", 1), "Intervalo: deve estar entre 5 e 3600");
        criacaoInvalida(
                Map.of("name", "x", "ip", "10.0.0.3", "failure_threshold", 21), "Limite de falhas: deve estar entre 1 e 20");
        criacaoInvalida(
                Map.of("name", "x", "ip", "10.0.0.3", "sla_threshold_ms", 0),
                "Limite de latência: deve estar entre 1 e 60000");
        criacaoInvalida(Map.of("name", "", "ip", "10.0.0.3"), "Nome: campo obrigatório");

        assertEquals(0, contar("SELECT count(*) FROM devices"));
    }

    @Test
    void rejeitaAlvosQueApontamParaOProprioServidor() throws Exception {
        postAs(ana, "/api/devices", Map.of("name", "loop", "ip", "127.0.0.1"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").isNotEmpty());

        assertEquals(0, contar("SELECT count(*) FROM devices"));
    }

    @Test
    void hostRepetidoDoMesmoUsuarioEConflitoMasOutroUsuarioPode() throws Exception {
        createDevice(ana, "A", "10.0.0.5", 3);

        postAs(ana, "/api/devices", Map.of("name", "B", "ip", "10.0.0.5"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Já existe um dispositivo com este host"));

        postAs(bruno, "/api/devices", Map.of("name", "B", "ip", "10.0.0.5")).andExpect(status().isCreated());
    }

    // ---- isolamento entre usuários ------------------------------------------------------------

    @Test
    void usuarioNaoEnxergaNemAlteraDispositivosDeOutro() throws Exception {
        long id = createDevice(ana, "Privado", "10.0.0.6", 3);
        String url = "/api/devices/" + id;

        getAs(bruno, "/api/devices").andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(0)));
        getAs(bruno, url).andExpect(status().isNotFound()).andExpect(jsonPath("$.detail").value("Dispositivo não encontrado"));
        patchAs(bruno, url, Map.of("name", "Invadido")).andExpect(status().isNotFound());
        deleteAs(bruno, url).andExpect(status().isNotFound());
        postAs(bruno, url + "/ping", null).andExpect(status().isNotFound());
        getAs(bruno, url + "/history").andExpect(status().isNotFound());

        getAs(ana, url).andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Privado"));
    }

    // ---- atualização e remoção ----------------------------------------------------------------

    @Test
    void atualizaApenasOsCamposEnviados() throws Exception {
        long id = createDevice(ana, "Antigo", "10.0.0.7", 3);

        patchAs(ana, "/api/devices/" + id, Map.of("name", "Novo", "interval_seconds", 60))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Novo"))
                .andExpect(jsonPath("$.interval_seconds").value(60))
                .andExpect(jsonPath("$.ip").value("10.0.0.7"))
                .andExpect(jsonPath("$.failure_threshold").value(3));
    }

    @Test
    void atualizacaoInvalidaNaoAlteraODispositivo() throws Exception {
        long id = createDevice(ana, "Estavel", "10.0.0.8", 3);
        String url = "/api/devices/" + id;

        patchAs(ana, url, Map.of("check_type", "tcp"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("Informe a porta para checagem TCP"));
        patchAs(ana, url, Map.of("interval_seconds", 2)).andExpect(status().isUnprocessableEntity());

        getAs(ana, url)
                .andExpect(jsonPath("$.check_type").value("icmp"))
                .andExpect(jsonPath("$.interval_seconds").value(30));
    }

    @Test
    void remocaoApagaMetricasEMantemOAlertaSemVinculo() throws Exception {
        probeReturns(down());
        long id = createDevice(ana, "Efemero", "10.0.0.9", 1);
        postAs(ana, "/api/devices/" + id + "/ping", null).andExpect(status().isOk());
        assertEquals(1, contar("SELECT count(*) FROM metrics WHERE device_id = ?", id));
        assertEquals(1, contar("SELECT count(*) FROM events WHERE device_id = ?", id));

        deleteAs(ana, "/api/devices/" + id).andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true));
        getAs(ana, "/api/devices/" + id).andExpect(status().isNotFound());

        assertEquals(0, contar("SELECT count(*) FROM metrics"));
        // events.device_id é ON DELETE SET NULL: o histórico de alertas sobrevive.
        assertEquals(1, contar("SELECT count(*) FROM events WHERE device_id IS NULL"));
    }

    // ---- checagem manual (ping) ---------------------------------------------------------------

    @Test
    void pingOnlineAtualizaEstadoEGravaMetrica() throws Exception {
        probeReturns(up(12.5));
        long id = createDevice(ana, "Gateway", "10.0.0.10", 3);

        postAs(ana, "/api/devices/" + id + "/ping", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.status").value("online"))
                .andExpect(jsonPath("$.latency_ms").value(12.5))
                .andExpect(jsonPath("$.method").value("icmp"));

        getAs(ana, "/api/devices/" + id)
                .andExpect(jsonPath("$.status").value("online"))
                .andExpect(jsonPath("$.latency").value(12.5))
                .andExpect(jsonPath("$.last_check").isNotEmpty());
        assertEquals(1, contar("SELECT count(*) FROM metrics WHERE device_id = ? AND ok = true", id));

        getAs(ana, "/api/devices/" + id + "/history?hours=1")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.granularity").value("raw"))
                .andExpect(jsonPath("$.points", hasSize(1)));

        getAs(ana, "/api/alerts").andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void pingSemRespostaDerrubaOHostGeraAlertaUmaSoVez() throws Exception {
        probeReturns(down());
        long id = createDevice(ana, "Switch", "10.0.0.11", 1);
        String ping = "/api/devices/" + id + "/ping";

        postAs(ana, ping, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("offline"))
                .andExpect(jsonPath("$.error").value("timeout"));

        getAs(ana, "/api/alerts")
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].kind").value("offline"))
                .andExpect(jsonPath("$[0].severity").value("error"))
                .andExpect(jsonPath("$[0].device_id").value(id));

        // Continuar offline não repete o alerta.
        postAs(ana, ping, null).andExpect(jsonPath("$.status").value("offline"));
        getAs(ana, "/api/alerts").andExpect(jsonPath("$", hasSize(1)));
    }

    // ---- histórico e portas ---------------------------------------------------------------------

    @Test
    void historicoValidaOPeriodoEUsaAgregadoHorarioAcimaDe24h() throws Exception {
        long id = createDevice(ana, "Hist", "10.0.0.12", 3);
        String url = "/api/devices/" + id + "/history";

        getAs(ana, url + "?hours=0")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("Período: de 1 a 720 horas"));
        getAs(ana, url + "?hours=721").andExpect(status().isUnprocessableEntity());

        getAs(ana, url + "?hours=48")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.granularity").value("hourly"))
                .andExpect(jsonPath("$.points", hasSize(0)));
    }

    @Test
    void checagemDePortaValidaOIntervalo() throws Exception {
        long id = createDevice(ana, "Portas", "10.0.0.13", 3);

        postAs(ana, "/api/devices/" + id + "/check-port", Map.of("port", 70000))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("Porta: deve estar entre 1 e 65535"));
    }
}
