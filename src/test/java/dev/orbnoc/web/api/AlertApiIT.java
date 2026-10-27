package dev.orbnoc.web.api;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import dev.orbnoc.domain.Event;
import dev.orbnoc.domain.User;
import dev.orbnoc.service.EventService;
import dev.orbnoc.support.IntegrationTestBase;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class AlertApiIT extends IntegrationTestBase {

    @Autowired EventService events;

    private User ana;
    private User bruno;
    private Cookie anaSessao;
    private Cookie brunoSessao;

    @BeforeEach
    void usuarios() throws Exception {
        ana = createUser("ana", SENHA, "user");
        bruno = createUser("bruno", SENHA, "user");
        anaSessao = loginAs("ana", SENHA);
        brunoSessao = loginAs("bruno", SENHA);
    }

    private Event registrar(User dono, String mensagem) {
        return events.record(dono.getId(), null, "offline", "error", mensagem);
    }

    @Test
    void listaOMaisRecentePrimeiroERespeitaOLimite() throws Exception {
        registrar(ana, "primeiro");
        registrar(ana, "segundo");
        registrar(ana, "terceiro");

        getAs(anaSessao, "/api/alerts?limit=2")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].message").value("terceiro"))
                .andExpect(jsonPath("$[1].message").value("segundo"));
    }

    @Test
    void naoListaAlertasDeOutroUsuario() throws Exception {
        registrar(ana, "da ana");

        getAs(brunoSessao, "/api/alerts").andExpect(jsonPath("$", hasSize(0)));
        getAs(brunoSessao, "/api/alerts/unread-count").andExpect(jsonPath("$.count").value(0));
        getAs(anaSessao, "/api/alerts/unread-count").andExpect(jsonPath("$.count").value(1));
    }

    @Test
    void reconhecerUmAlertaoTiraDosNaoLidos() throws Exception {
        Event primeiro = registrar(ana, "primeiro");
        registrar(ana, "segundo");

        postAs(anaSessao, "/api/alerts/" + primeiro.getId() + "/ack", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        getAs(anaSessao, "/api/alerts/unread-count").andExpect(jsonPath("$.count").value(1));
        getAs(anaSessao, "/api/alerts?unread_only=true")
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].message").value("segundo"));
        getAs(anaSessao, "/api/alerts").andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    void naoReconheceAlertaDeOutroUsuario() throws Exception {
        Event daAna = registrar(ana, "da ana");

        postAs(brunoSessao, "/api/alerts/" + daAna.getId() + "/ack", null)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Alerta não encontrado"));

        getAs(anaSessao, "/api/alerts/unread-count").andExpect(jsonPath("$.count").value(1));
    }

    @Test
    void reconhecerTudoAfetaSoOUsuarioLogado() throws Exception {
        registrar(ana, "a1");
        registrar(ana, "a2");
        registrar(bruno, "b1");

        postAs(anaSessao, "/api/alerts/ack-all", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.acknowledged").value(2));

        getAs(anaSessao, "/api/alerts/unread-count").andExpect(jsonPath("$.count").value(0));
        getAs(brunoSessao, "/api/alerts/unread-count").andExpect(jsonPath("$.count").value(1));
    }

    @Test
    void limiteDeListagemEValidado() throws Exception {
        getAs(anaSessao, "/api/alerts?limit=0")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("Limite: de 1 a 200"));
        getAs(anaSessao, "/api/alerts?limit=201").andExpect(status().isUnprocessableEntity());
    }

    @Test
    void exigeAutenticacao() throws Exception {
        getAs(null, "/api/alerts").andExpect(status().isUnauthorized());
        postAs(null, "/api/alerts/ack-all", null).andExpect(status().isUnauthorized());
    }

    // ---- limite de latência (SLA) -------------------------------------------------------------

    @Test
    void configuraELimpaOLimiteDeLatencia() throws Exception {
        long id = createDevice(anaSessao, "Link", "10.0.0.20", 3);
        String url = "/api/devices/" + id;

        postAs(anaSessao, "/api/alerts/sla/configure", Map.of("device_id", id, "threshold_ms", 150))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.device_id").value(id));
        getAs(anaSessao, url).andExpect(jsonPath("$.sla_threshold_ms").value(150));

        // threshold_ms ausente desliga o limite.
        postAs(anaSessao, "/api/alerts/sla/configure", Map.of("device_id", id)).andExpect(status().isOk());
        String corpo = getAs(anaSessao, url).andReturn().getResponse().getContentAsString();
        org.junit.jupiter.api.Assertions.assertNull(JsonPath.read(corpo, "$.sla_threshold_ms"));
    }

    @Test
    void validaConfiguracaoDeLimiteDeLatencia() throws Exception {
        long id = createDevice(anaSessao, "Link", "10.0.0.21", 3);

        postAs(anaSessao, "/api/alerts/sla/configure", Map.of("threshold_ms", 100))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("Informe o dispositivo"));
        postAs(anaSessao, "/api/alerts/sla/configure", Map.of("device_id", id, "threshold_ms", 0))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("Limite de latência: deve estar entre 1 e 60000"));
        postAs(brunoSessao, "/api/alerts/sla/configure", Map.of("device_id", id, "threshold_ms", 100))
                .andExpect(status().isNotFound());
    }

    // ---- Telegram (somente o que não depende de rede) -------------------------------------------

    @Test
    void telegramComecaDesativadoESemToken() throws Exception {
        getAs(anaSessao, "/api/alerts/telegram")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.bot_token_set").value(false));
    }

    @Test
    void telegramValidaOFormatoAntesDeQualquerChamadaExterna() throws Exception {
        putAs(anaSessao, "/api/alerts/telegram", Map.of("enabled", true, "bot_token", "invalido"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("Token do bot em formato inválido"));
        putAs(anaSessao, "/api/alerts/telegram", Map.of("bot_token", "x"))
                .andExpect(status().isUnprocessableEntity());
        putAs(anaSessao, "/api/alerts/telegram", Map.of())
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("Informe se as notificações estão ativas"));
    }
}
