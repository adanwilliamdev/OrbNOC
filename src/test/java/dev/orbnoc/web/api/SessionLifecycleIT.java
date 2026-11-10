package dev.orbnoc.web.api;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.orbnoc.core.TokenService;
import dev.orbnoc.domain.User;
import dev.orbnoc.support.IntegrationTestBase;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

/**
 * Sessões inconsistentes com o estado real do banco: expirada, assinada com outra chave, de usuário
 * removido ou cujo perfil mudou depois do login. O token só diz quem é; o perfil vem sempre do banco.
 */
class SessionLifecycleIT extends IntegrationTestBase {

    private Cookie cookieComToken(String token) {
        return new Cookie(props.cookieName(), token);
    }

    @Test
    void sessaoExpiradaNaoAutentica() throws Exception {
        User ana = createUser("ana", SENHA, "user");
        String expirado = new TokenService(props.jwtSecret(), -60).create(ana.getId());

        getAs(cookieComToken(expirado), "/api/auth/me").andExpect(status().isUnauthorized());
        mvc.perform(MockMvcRequestBuilders.get("/").cookie(cookieComToken(expirado)))
                .andExpect(status().is3xxRedirection())
                .andExpect(header().string("Location", "/login"));
    }

    @Test
    void tokenAssinadoComOutraChaveNaoAutentica() throws Exception {
        User ana = createUser("ana", SENHA, "user");
        String forjado = new TokenService("outra-chave-qualquer-0123456789abcdef", 3600).create(ana.getId());

        getAs(cookieComToken(forjado), "/api/devices").andExpect(status().isUnauthorized());
    }

    @Test
    void tokenValidoDeUsuarioRemovidoNaoAutentica() throws Exception {
        User ana = createUser("ana", SENHA, "user");
        Cookie sessao = loginAs("ana", SENHA);
        jdbc.update("DELETE FROM users WHERE id = ?", ana.getId());

        getAs(sessao, "/api/auth/me").andExpect(status().isUnauthorized());
    }

    @Test
    void rebaixarOAdminValeNaProximaRequisicaoSemNovoLogin() throws Exception {
        createUser("chefe", SENHA, "admin");
        createUser("outro", SENHA, "admin");
        Cookie sessao = loginAs("chefe", SENHA);
        getAs(sessao, "/api/users").andExpect(status().isOk());

        jdbc.update("UPDATE users SET role = 'user' WHERE username = 'chefe'");

        getAs(sessao, "/api/users").andExpect(status().isForbidden());
        mvc.perform(MockMvcRequestBuilders.get("/users").cookie(sessao))
                .andExpect(status().is3xxRedirection())
                .andExpect(header().string("Location", "/"));
    }

    @Test
    void usuarioNaoVerificaPortaDeDispositivoDeOutro() throws Exception {
        createUser("ana", SENHA, "user");
        createUser("bruno", SENHA, "user");
        Cookie ana = loginAs("ana", SENHA);
        Cookie bruno = loginAs("bruno", SENHA);
        long id = createDevice(ana, "Servidor", "10.0.0.9", 3);

        postAs(bruno, "/api/devices/" + id + "/check-port", Map.of("port", 22))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Dispositivo não encontrado"));
    }
}
