package dev.orbnoc.web.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.orbnoc.core.Totp;
import dev.orbnoc.domain.User;
import dev.orbnoc.support.IntegrationTestBase;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

/** Sessões revogáveis (token_version), troca de senha, 2FA e limites de login. */
class SessionRevocationIT extends IntegrationTestBase {

    private static Cookie cookieDe(String setCookie) {
        String par = setCookie.split(";", 2)[0];
        int igual = par.indexOf('=');
        return new Cookie(par.substring(0, igual), par.substring(igual + 1));
    }

    @Test
    void logoutRevogaOTokenMesmoQuemTenhaUmaCopiaDoCookie() throws Exception {
        createUser("ana", SENHA, "user");
        Cookie sessao = loginAs("ana", SENHA);
        getAs(sessao, "/api/auth/me").andExpect(status().isOk());

        postAs(sessao, "/api/auth/logout", null).andExpect(status().isOk());

        getAs(sessao, "/api/auth/me").andExpect(status().isUnauthorized());
    }

    @Test
    void trocarASenhaDerrubaAsOutrasSessoesEMantemEsta() throws Exception {
        createUser("ana", SENHA, "user");
        Cookie outroDispositivo = loginAs("ana", SENHA);
        Cookie atual = loginAs("ana", SENHA);

        String setCookie = postAs(atual, "/api/auth/password", Map.of("current_password", SENHA, "new_password", "NovaSenha99"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getHeader(HttpHeaders.SET_COOKIE);

        getAs(outroDispositivo, "/api/auth/me").andExpect(status().isUnauthorized());
        getAs(atual, "/api/auth/me").andExpect(status().isUnauthorized());
        getAs(cookieDe(setCookie), "/api/auth/me").andExpect(status().isOk());
        postAs(null, "/api/auth/login", Map.of("username", "ana", "password", SENHA)).andExpect(status().isUnauthorized());
        loginAs("ana", "NovaSenha99");
    }

    @Test
    void trocaDeSenhaExigeASenhaAtual() throws Exception {
        createUser("ana", SENHA, "user");
        Cookie sessao = loginAs("ana", SENHA);

        postAs(sessao, "/api/auth/password", Map.of("current_password", "errada123", "new_password", "NovaSenha99"))
                .andExpect(status().isUnauthorized());
        postAs(sessao, "/api/auth/password", Map.of("current_password", SENHA, "new_password", "curta"))
                .andExpect(status().isUnprocessableEntity());
        getAs(sessao, "/api/auth/me").andExpect(status().isOk());
    }

    @Test
    void adminRedefinirSenhaOuDesativarDerrubaASessaoDoUsuario() throws Exception {
        createUser("admin", SENHA, "admin");
        User ana = createUser("ana", SENHA, "user");
        Cookie admin = loginAs("admin", SENHA);
        Cookie sessaoAna = loginAs("ana", SENHA);
        getAs(sessaoAna, "/api/auth/me").andExpect(status().isOk());

        patchAs(admin, "/api/users/" + ana.getId(), Map.of("password", "OutraSenha77")).andExpect(status().isOk());

        getAs(sessaoAna, "/api/auth/me").andExpect(status().isUnauthorized());
        assertEquals(1, jdbc.queryForObject(
                "SELECT count(*) FROM access_logs WHERE action = 'admin.user_update'", Long.class));
    }

    @Test
    void doisFatoresExigemOCodigoNoLogin() throws Exception {
        createUser("ana", SENHA, "user");
        Cookie sessao = loginAs("ana", SENHA);

        String setup = postAs(sessao, "/api/auth/2fa/setup", Map.of()).andExpect(status().isOk()).andReturn()
                .getResponse().getContentAsString();
        String segredo = com.jayway.jsonpath.JsonPath.read(setup, "$.secret");

        postAs(sessao, "/api/auth/2fa/enable", Map.of("code", "000000")).andExpect(status().isUnprocessableEntity());
        String setCookie = postAs(sessao, "/api/auth/2fa/enable", Map.of("code", Totp.code(segredo, Instant.now())))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getHeader(HttpHeaders.SET_COOKIE);
        getAs(sessao, "/api/auth/me").andExpect(status().isUnauthorized()); // sessão anterior ao 2FA caiu
        getAs(cookieDe(setCookie), "/api/auth/me").andExpect(status().isOk());

        postAs(null, "/api/auth/login", Map.of("username", "ana", "password", SENHA))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Informe o código de verificação em duas etapas"));
        postAs(null, "/api/auth/login", Map.of("username", "ana", "password", SENHA, "totp_code", "000000"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Código de verificação inválido"));
        postAs(null, "/api/auth/login",
                        Map.of("username", "ana", "password", SENHA, "totp_code", Totp.code(segredo, Instant.now())))
                .andExpect(status().isOk());
    }

    @Test
    void variarOIpContraOMesmoUsuarioTambemEBarrado() throws Exception {
        createUser("ana", SENHA, "user");
        int limitePorUsuario = props.loginMaxAttempts() * 3;
        for (int i = 0; i < limitePorUsuario; i++) {
            String ip = "198.51.100." + (i + 1);
            mvc.perform(MockMvcRequestBuilders.post("/api/auth/login")
                            .with(r -> {
                                r.setRemoteAddr(ip);
                                return r;
                            })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(toJson(Map.of("username", "ana", "password", "errada123"))))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(MockMvcRequestBuilders.post("/api/auth/login")
                        .with(r -> {
                            r.setRemoteAddr("203.0.113.77");
                            return r;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("username", "ana", "password", "errada123"))))
                .andExpect(status().isTooManyRequests());
    }
}
