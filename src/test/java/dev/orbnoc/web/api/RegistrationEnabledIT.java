package dev.orbnoc.web.api;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.orbnoc.support.IntegrationTestBase;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.TestPropertySource;

/** Mesmo fluxo de {@link AuthApiIT}, mas com o autoatendimento de cadastro ligado. */
@TestPropertySource(properties = "orbnoc.registration-enabled=true")
class RegistrationEnabledIT extends IntegrationTestBase {

    private Map<String, String> cadastro(String usuario, String email, String senha) {
        return Map.of("username", usuario, "email", email, "password", senha);
    }

    @Test
    void cadastroCriaUsuarioComumEJaAbreSessao() throws Exception {
        getAs(null, "/api/auth/config").andExpect(jsonPath("$.registration_enabled").value(true));

        postAs(null, "/api/auth/register", cadastro("novo", "Novo@Example.com", SENHA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.username").value("novo"))
                .andExpect(jsonPath("$.user.email").value("novo@example.com"))
                .andExpect(jsonPath("$.user.role").value("user"))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("orbnoc_session=")));

        // A senha foi gravada como hash e permite login depois.
        loginAs("novo", SENHA);
        String hash = jdbc.queryForObject("SELECT password_hash FROM users WHERE username = 'novo'", String.class);
        org.junit.jupiter.api.Assertions.assertNotEquals(SENHA, hash);
    }

    @Test
    void cadastroDuplicadoRetornaConflito() throws Exception {
        postAs(null, "/api/auth/register", cadastro("novo", "novo@example.com", SENHA)).andExpect(status().isOk());

        postAs(null, "/api/auth/register", cadastro("novo", "outro@example.com", SENHA))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Usuário ou email já existe"));
        postAs(null, "/api/auth/register", cadastro("outro", "novo@example.com", SENHA))
                .andExpect(status().isConflict());
    }

    @Test
    void cadastroValidaUsuarioEmailESenha() throws Exception {
        postAs(null, "/api/auth/register", cadastro("a b", "x@example.com", SENHA))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("Usuário: 3 a 100 caracteres (letras, números, _ . -)"));
        postAs(null, "/api/auth/register", cadastro("novo", "sem-arroba", SENHA))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("Email inválido"));
        postAs(null, "/api/auth/register", cadastro("novo", "x@example.com", "curta1"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("A senha deve ter pelo menos 8 caracteres"));
        postAs(null, "/api/auth/register", cadastro("novo", "x@example.com", "somenteletras"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("A senha deve conter letras e números"));
    }
}
