package dev.orbnoc.web.ui;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.orbnoc.support.IntegrationTestBase;
import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

/**
 * Matriz completa de papéis (anônimo, usuário, admin) nas rotas web: páginas redirecionam para
 * /login, fragmentos respondem 401 e a administração é exclusiva de admin.
 */
class WebRoutesAccessIT extends IntegrationTestBase {

    private enum Papel { ANONIMO, USUARIO, ADMIN }

    /** Resultado esperado: página aberta, redirecionamento ao login, redirecionamento ao painel ou 401. */
    private enum Esperado { OK, PARA_LOGIN, PARA_PAINEL, NAO_AUTENTICADO }

    private record Rota(String metodo, String caminho, Esperado anonimo, Esperado usuario, Esperado admin) {
        Esperado para(Papel papel) {
            return switch (papel) {
                case ANONIMO -> anonimo;
                case USUARIO -> usuario;
                case ADMIN -> admin;
            };
        }
    }

    private static Rota pagina(String caminho) {
        return new Rota("GET", caminho, Esperado.PARA_LOGIN, Esperado.OK, Esperado.OK);
    }

    private static Rota fragmento(String caminho) {
        return new Rota("GET", caminho, Esperado.NAO_AUTENTICADO, Esperado.OK, Esperado.OK);
    }

    private static final List<Rota> ROTAS = List.of(
            pagina("/"),
            pagina("/alerts"),
            pagina("/network-map"),
            pagina("/reports"),
            pagina("/reports/print"),
            pagina("/diagnostic"),
            pagina("/wallboard"),
            // administração: só admin; usuário comum volta ao painel
            new Rota("GET", "/users", Esperado.PARA_LOGIN, Esperado.PARA_PAINEL, Esperado.OK),
            // tela de login: anônimo vê; quem já tem sessão vai ao painel
            new Rota("GET", "/login", Esperado.OK, Esperado.PARA_PAINEL, Esperado.PARA_PAINEL),
            fragmento("/ui/fragments/dashboard-top"),
            fragmento("/ui/fragments/dashboard-table"),
            fragmento("/ui/fragments/alert-badge"),
            fragmento("/ui/fragments/alerts"),
            fragmento("/ui/fragments/network-map"),
            fragmento("/ui/fragments/wallboard"));

    static Stream<Arguments> matriz() {
        return ROTAS.stream()
                .flatMap(r -> Stream.of(Papel.values()).map(p -> Arguments.of(p, r)));
    }

    private Map<Papel, Cookie> sessoes;

    @BeforeEach
    void sessoes() throws Exception {
        createUser("admin", SENHA, "admin");
        createUser("comum", SENHA, "user");
        sessoes = Map.of(Papel.USUARIO, loginAs("comum", SENHA), Papel.ADMIN, loginAs("admin", SENHA));
    }

    @ParameterizedTest(name = "{0} em {1}")
    @MethodSource("matriz")
    void respeitaOPapel(Papel papel, Rota rota) throws Exception {
        var requisicao = MockMvcRequestBuilders.get(rota.caminho());
        Cookie cookie = sessoes.get(papel);
        if (cookie != null) requisicao.cookie(cookie);

        confere(mvc.perform(requisicao), rota.para(papel));
    }

    @ParameterizedTest
    @MethodSource("papeis")
    void execucaoDeDiagnosticoExigeSessao(Papel papel) throws Exception {
        var requisicao = MockMvcRequestBuilders.post("/ui/diagnostic/run").param("tool", "ping").param("host", "127.0.0.1");
        Cookie cookie = sessoes.get(papel);
        if (cookie != null) requisicao.cookie(cookie);

        ResultActions resultado = mvc.perform(requisicao);
        if (papel == Papel.ANONIMO) resultado.andExpect(status().isUnauthorized());
        else resultado.andExpect(status().isOk());
    }

    static Stream<Papel> papeis() {
        return Stream.of(Papel.values());
    }

    @Test
    void sessaoDeUsuarioDesativadoViraAnonimoNasPaginas() throws Exception {
        Cookie cookie = sessoes.get(Papel.USUARIO);
        jdbc.update("UPDATE users SET is_active = FALSE WHERE username = 'comum'");

        confere(mvc.perform(MockMvcRequestBuilders.get("/").cookie(cookie)), Esperado.PARA_LOGIN);
        confere(mvc.perform(MockMvcRequestBuilders.get("/ui/fragments/alerts").cookie(cookie)), Esperado.NAO_AUTENTICADO);
    }

    private static void confere(ResultActions resultado, Esperado esperado) throws Exception {
        switch (esperado) {
            case OK -> resultado.andExpect(status().isOk());
            case PARA_LOGIN -> resultado.andExpect(status().is3xxRedirection()).andExpect(header().string("Location", "/login"));
            case PARA_PAINEL -> resultado.andExpect(status().is3xxRedirection()).andExpect(header().string("Location", "/"));
            case NAO_AUTENTICADO -> resultado.andExpect(status().isUnauthorized());
        }
    }
}
