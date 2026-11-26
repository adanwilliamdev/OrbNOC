package dev.orbnoc.web.api;

import static org.junit.jupiter.api.Assertions.assertEquals;

import dev.orbnoc.support.IntegrationTestBase;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.web.server.LocalServerPort;

/**
 * Atrás do Caddy o IP real chega no {@code X-Forwarded-For}. Aqui o servidor sobe de verdade (porta
 * aleatória) e a requisição vem do loopback, que é um proxy interno confiável: o IP registrado no
 * login precisa ser o do cliente, não o do proxy. (MockMvc não passa pela válvula do Tomcat.)
 */
class ForwardedIpIT extends IntegrationTestBase {

    @LocalServerPort int porta;

    private int login(String xForwardedFor) throws Exception {
        HttpRequest.Builder req = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + porta + "/api/auth/login"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{\"username\":\"ana\",\"password\":\"" + SENHA + "\"}"));
        if (xForwardedFor != null) req.header("X-Forwarded-For", xForwardedFor);
        return HttpClient.newHttpClient().send(req.build(), HttpResponse.BodyHandlers.ofString()).statusCode();
    }

    @Test
    void ipDoClienteVemDoXForwardedForDeProxyConfiavel() throws Exception {
        createUser("ana", SENHA, "user");

        assertEquals(200, login("203.0.113.9"));

        assertEquals(
                "203.0.113.9",
                jdbc.queryForObject("SELECT ip_address FROM access_logs WHERE action = 'login'", String.class));
    }

    @Test
    void semCabecalhoUsaOEnderecoDaConexao() throws Exception {
        createUser("ana", SENHA, "user");

        assertEquals(200, login(null));

        assertEquals(
                "127.0.0.1",
                jdbc.queryForObject("SELECT ip_address FROM access_logs WHERE action = 'login'", String.class));
    }
}
