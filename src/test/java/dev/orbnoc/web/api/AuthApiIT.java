package dev.orbnoc.web.api;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.orbnoc.domain.User;
import dev.orbnoc.support.IntegrationTestBase;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;

class AuthApiIT extends IntegrationTestBase {

    private long contar(String acao) {
        Long n = jdbc.queryForObject("SELECT count(*) FROM access_logs WHERE action = ?", Long.class, acao);
        return n == null ? 0 : n;
    }

    @Test
    void loginValidoEmiteCookieDeSessaoHttpOnly() throws Exception {
        createUser("ana", SENHA, "user");

        postAs(null, "/api/auth/login", Map.of("username", "ana", "password", SENHA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.user.username").value("ana"))
                .andExpect(jsonPath("$.user.role").value("user"))
                .andExpect(jsonPath("$.user.is_active").value(true))
                .andExpect(jsonPath("$.user.password_hash").doesNotExist())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("orbnoc_session=")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("HttpOnly")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("SameSite=Lax")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Path=/")));

        assertEquals(1, contar("login"));
    }

    @Test
    void loginAceitaEmailNoLugarDoUsuario() throws Exception {
        createUser("ana", SENHA, "user");

        postAs(null, "/api/auth/login", Map.of("username", "ana@example.com", "password", SENHA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.username").value("ana"));
    }

    @Test
    void senhaErradaEUsuarioInexistenteRespondemIgual() throws Exception {
        createUser("ana", SENHA, "user");

        postAs(null, "/api/auth/login", Map.of("username", "ana", "password", "Errada123"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Credenciais inválidas"))
                .andExpect(header().doesNotExist(HttpHeaders.SET_COOKIE));

        // Mesma resposta para quem não existe: não revela quais usuários estão cadastrados.
        postAs(null, "/api/auth/login", Map.of("username", "fantasma", "password", SENHA))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Credenciais inválidas"));
    }

    @Test
    void usuarioDesativadoNaoConsegueEntrar() throws Exception {
        createUser("ana", SENHA, "user");
        jdbc.update("UPDATE users SET is_active = false WHERE username = 'ana'");

        postAs(null, "/api/auth/login", Map.of("username", "ana", "password", SENHA))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Credenciais inválidas"));
    }

    @Test
    void bloqueiaAposMuitasTentativasMesmoComSenhaCorreta() throws Exception {
        createUser("alvo", SENHA, "user");

        for (int i = 0; i < props.loginMaxAttempts(); i++) {
            postAs(null, "/api/auth/login", Map.of("username", "alvo", "password", "Errada123"))
                    .andExpect(status().isUnauthorized());
        }

        postAs(null, "/api/auth/login", Map.of("username", "alvo", "password", SENHA))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.detail").value("Muitas tentativas; tente mais tarde"));
    }

    @Test
    void camposObrigatoriosNoLogin() throws Exception {
        postAs(null, "/api/auth/login", Map.of("username", "", "password", SENHA))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("Informe o usuário"));
        postAs(null, "/api/auth/login", Map.of("username", "ana", "password", ""))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("Informe a senha"));
    }

    @Test
    void meExigeSessaoValida() throws Exception {
        getAs(null, "/api/auth/me")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Não autenticado"));

        getAs(new Cookie("orbnoc_session", "token.invalido.qualquer"), "/api/auth/me")
                .andExpect(status().isUnauthorized());

        createUser("ana", SENHA, "user");
        Cookie sessao = loginAs("ana", SENHA);

        getAs(sessao, "/api/auth/me")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("ana"))
                .andExpect(jsonPath("$.email").value("ana@example.com"));
    }

    @Test
    void sessaoDeUsuarioDesativadoDeixaDeValer() throws Exception {
        User ana = createUser("ana", SENHA, "user");
        Cookie sessao = loginAs("ana", SENHA);
        getAs(sessao, "/api/auth/me").andExpect(status().isOk());

        jdbc.update("UPDATE users SET is_active = false WHERE id = ?", ana.getId());

        getAs(sessao, "/api/auth/me").andExpect(status().isUnauthorized());
    }

    @Test
    void logoutLimpaOCookieERegistraOAcesso() throws Exception {
        createUser("ana", SENHA, "user");
        Cookie sessao = loginAs("ana", SENHA);

        postAs(sessao, "/api/auth/logout", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Max-Age=0")));

        assertEquals(1, contar("logout"));
    }

    @Test
    void registroVemDesativadoPorPadrao() throws Exception {
        getAs(null, "/api/auth/config")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.registration_enabled").value(false));

        postAs(null, "/api/auth/register", Map.of("username", "novo", "email", "novo@example.com", "password", SENHA))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("Registro desativado; peça a um administrador"));
    }
}
