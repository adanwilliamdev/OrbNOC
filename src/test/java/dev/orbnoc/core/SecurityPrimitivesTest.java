package dev.orbnoc.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;

class SecurityPrimitivesTest {

    @Test
    void tokenValidoViajaIdaEVolta() {
        TokenService tokens = new TokenService("segredo-de-teste-com-mais-de-32-caracteres", 3600);
        TokenService.Session s = tokens.parse(tokens.create(42));
        assertNotNull(s);
        assertEquals(42, s.userId());
    }

    @Test
    void tokenAdulteradoOuDeOutraChaveEhRejeitado() {
        TokenService a = new TokenService("segredo-a-com-mais-de-32-caracteres-xx", 3600);
        TokenService b = new TokenService("segredo-b-com-mais-de-32-caracteres-xx", 3600);
        String token = a.create(1);
        assertNull(b.parse(token));
        String[] parts = token.split("\\.");
        assertNull(a.parse(parts[0] + "." + parts[1] + "x." + parts[2]));
        assertNull(a.parse(parts[0] + "." + parts[1] + "."));
        assertNull(a.parse("lixo"));
        assertNull(a.parse(null));
    }

    @Test
    void tokenExpiradoEhRejeitado() {
        TokenService tokens = new TokenService("segredo-de-teste-com-mais-de-32-caracteres", 60);
        String old = tokens.create(7, Instant.now().getEpochSecond() - 3600);
        assertNull(tokens.parse(old));
    }

    @Test
    void secretBoxCifraEDecifra() {
        SecretBox box = new SecretBox("chave");
        String encrypted = box.encrypt("123456:ABC-token");
        assertNotEquals("123456:ABC-token", encrypted);
        assertEquals("123456:ABC-token", box.decrypt(encrypted));
        assertNotEquals(encrypted, box.encrypt("123456:ABC-token")); // IV aleatório
    }

    @Test
    void secretBoxRejeitaOutraChaveELixo() {
        String encrypted = new SecretBox("chave-1").encrypt("segredo");
        assertNull(new SecretBox("chave-2").decrypt(encrypted));
        assertNull(new SecretBox("chave-1").decrypt("nao-e-base64-valido!!"));
        assertNull(new SecretBox("chave-1").decrypt(""));
    }

    @Test
    void rateLimiterBloqueiaNaJanelaELiberaDepois() {
        AtomicLong now = new AtomicLong(1_000);
        RateLimiter limiter = new RateLimiter(now::get);
        assertFalse(limiter.isBlocked("k", 3));
        for (int i = 0; i < 3; i++) limiter.hit("k", 10);
        assertTrue(limiter.isBlocked("k", 3));
        now.addAndGet(11_000);
        assertFalse(limiter.isBlocked("k", 3));
        assertEquals(1, limiter.hit("k", 10));
        limiter.clear("k");
        assertFalse(limiter.isBlocked("k", 1));
    }
}
