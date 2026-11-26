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

    @Test
    void tokenCarregaAVersaoDoUsuario() {
        TokenService tokens = new TokenService("segredo-de-teste-com-mais-de-32-caracteres", 3600);
        assertEquals(7, tokens.parse(tokens.create(1, 7)).tokenVersion());
        assertEquals(0, tokens.parse(tokens.create(1)).tokenVersion());
    }

    @Test
    void rotacaoDeSegredoDoTokenAceitaAChaveAnteriorSoParaVerificar() {
        TokenService velho = new TokenService("segredo-velho-com-mais-de-32-caracteres-x", 3600);
        TokenService novo = new TokenService(
                "segredo-novo-com-mais-de-32-caracteres-xx", "segredo-velho-com-mais-de-32-caracteres-x", 3600);
        TokenService.Session s = novo.parse(velho.create(5, 3));
        assertNotNull(s);
        assertEquals(5, s.userId());
        assertNull(velho.parse(novo.create(5, 3)), "tokens novos só saem com a chave atual");
        assertNull(new TokenService("terceiro-segredo-com-mais-de-32-caracteres", 3600).parse(novo.create(5)));
    }

    @Test
    void secretBoxRotacionaChaves() {
        String antigo = new SecretBox("chave-velha").encrypt("token");
        SecretBox novo = new SecretBox("chave-nova", "chave-velha");
        assertEquals("token", novo.decrypt(antigo));
        assertTrue(novo.needsRotation(antigo));
        String recifrado = novo.encrypt("token");
        assertFalse(novo.needsRotation(recifrado));
        assertEquals("token", novo.decrypt(recifrado));
        assertNull(new SecretBox("chave-nova").decrypt(antigo), "sem a chave anterior não há como ler");
        assertTrue(recifrado.startsWith("v1."));
    }

    @Test
    void secretBoxAindaLeFormatoAntigoSemPrefixo() throws Exception {
        // valor gerado pelo formato antigo: base64url(iv + cifrado), sem "v1.<kid>."
        SecretBox box = new SecretBox("chave");
        String atual = box.encrypt("segredo");
        String semPrefixo = atual.substring(atual.indexOf('.', 3) + 1);
        assertEquals("segredo", box.decrypt(semPrefixo));
    }

    @Test
    void totpBateComOsVetoresDaRfc6238() {
        String segredo = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // "12345678901234567890"
        assertEquals("287082", Totp.code(segredo, Instant.ofEpochSecond(59)));
        assertEquals("081804", Totp.code(segredo, Instant.ofEpochSecond(1111111109L)));
        assertTrue(Totp.verify(segredo, "287082", Instant.ofEpochSecond(70)), "tolera um passo de relógio");
        assertFalse(Totp.verify(segredo, "287082", Instant.ofEpochSecond(200)));
        assertFalse(Totp.verify(segredo, "abc", Instant.ofEpochSecond(59)));
        assertFalse(Totp.verify(null, "287082", Instant.ofEpochSecond(59)));
        String novo = Totp.newSecret();
        assertTrue(Totp.verify(novo, Totp.code(novo, Instant.now()), Instant.now()));
    }
}
