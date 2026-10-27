package dev.orbnoc.web.api;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.orbnoc.domain.User;
import dev.orbnoc.support.IntegrationTestBase;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class UserAdminApiIT extends IntegrationTestBase {

    private User admin;
    private User comum;
    private Cookie adminSessao;
    private Cookie comumSessao;

    @BeforeEach
    void usuarios() throws Exception {
        admin = createUser("admin", SENHA, "admin");
        comum = createUser("comum", SENHA, "user");
        adminSessao = loginAs("admin", SENHA);
        comumSessao = loginAs("comum", SENHA);
    }

    private Map<String, Object> novo(String usuario, String perfil) {
        return Map.of("username", usuario, "email", usuario + "@example.com", "password", SENHA, "role", perfil);
    }

    @Test
    void somenteAdminAcessaAAdministracao() throws Exception {
        getAs(null, "/api/users").andExpect(status().isUnauthorized());
        getAs(comumSessao, "/api/users")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("Acesso restrito a administradores"));
        postAs(comumSessao, "/api/users", novo("x", "admin")).andExpect(status().isForbidden());
        patchAs(comumSessao, "/api/users/" + admin.getId(), Map.of("role", "user")).andExpect(status().isForbidden());
        deleteAs(comumSessao, "/api/users/" + admin.getId()).andExpect(status().isForbidden());
    }

    @Test
    void listaUsuariosSemExporSenha() throws Exception {
        getAs(adminSessao, "/api/users")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].username").value("admin"))
                .andExpect(jsonPath("$[0].role").value("admin"))
                .andExpect(jsonPath("$[0].password_hash").doesNotExist())
                .andExpect(jsonPath("$[1].username").value("comum"));
    }

    @Test
    void criaUsuarioComPerfilPadraoEValidaEntrada() throws Exception {
        postAs(adminSessao, "/api/users", Map.of("username", "novo", "email", "novo@example.com", "password", SENHA))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("user"))
                .andExpect(jsonPath("$.is_active").value(true));

        postAs(adminSessao, "/api/users", novo("novo", "user"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Usuário ou email já existe"));
        postAs(adminSessao, "/api/users", novo("outro", "root"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("Perfil inválido"));
        postAs(adminSessao, "/api/users", Map.of("username", "fraco", "email", "f@example.com", "password", "123"))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void desativarUsuarioImpedeNovoLogin() throws Exception {
        patchAs(adminSessao, "/api/users/" + comum.getId(), Map.of("is_active", false))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.is_active").value(false));

        postAs(null, "/api/auth/login", Map.of("username", "comum", "password", SENHA))
                .andExpect(status().isUnauthorized());
        getAs(comumSessao, "/api/auth/me").andExpect(status().isUnauthorized());
    }

    @Test
    void adminRedefineASenhaDeOutroUsuario() throws Exception {
        patchAs(adminSessao, "/api/users/" + comum.getId(), Map.of("password", "NovaSenha99"))
                .andExpect(status().isOk());

        loginAs("comum", "NovaSenha99");
        postAs(null, "/api/auth/login", Map.of("username", "comum", "password", SENHA))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void naoPermiteRemoverOUltimoAdmin() throws Exception {
        patchAs(adminSessao, "/api/users/" + admin.getId(), Map.of("role", "user"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Não é possível remover o último admin"));
        patchAs(adminSessao, "/api/users/" + admin.getId(), Map.of("is_active", false))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Não é possível remover o último admin"));
        deleteAs(adminSessao, "/api/users/" + admin.getId())
                .andExpect(status().isConflict());
    }

    @Test
    void comDoisAdminsAindaNaoPodeDesativarAPropriaConta() throws Exception {
        createUser("admin2", SENHA, "admin");

        patchAs(adminSessao, "/api/users/" + admin.getId(), Map.of("is_active", false))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Você não pode desativar ou rebaixar a própria conta"));
        deleteAs(adminSessao, "/api/users/" + admin.getId())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Você não pode remover a própria conta"));
    }

    @Test
    void usuarioInexistenteRetorna404() throws Exception {
        patchAs(adminSessao, "/api/users/9999", Map.of("role", "user"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Usuário não encontrado"));
        deleteAs(adminSessao, "/api/users/9999").andExpect(status().isNotFound());
    }

    @Test
    void removerUsuarioApagaEmCascataSeusDados() throws Exception {
        probeReturns(down());
        long deviceId = createDevice(comumSessao, "Do comum", "10.0.0.30", 1);
        postAs(comumSessao, "/api/devices/" + deviceId + "/ping", null).andExpect(status().isOk());

        deleteAs(adminSessao, "/api/users/" + comum.getId())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM devices", Long.class));
        assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM metrics", Long.class));
        assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM events", Long.class));
        getAs(adminSessao, "/api/users").andExpect(jsonPath("$", hasSize(1)));
    }
}
