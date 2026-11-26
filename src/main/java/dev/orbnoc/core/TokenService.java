package dev.orbnoc.core;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Token de sessão: JWT HS256 mínimo (sub, iat, exp, tv), sem dependências externas.
 *
 * <ul>
 *   <li>{@code tv} é a versão do token do usuário ({@code users.token_version}); trocar a senha ou
 *       encerrar as sessões incrementa a coluna e invalida todos os tokens já emitidos.
 *   <li>O cabeçalho leva um {@code kid} (impressão digital da chave): na rotação, o segredo
 *       anterior continua válido só para <em>verificar</em> tokens; novos tokens saem sempre com a
 *       chave atual.
 * </ul>
 */
public final class TokenService {

    /** Sessão decodificada; {@code tokenVersion} é 0 em tokens antigos, emitidos sem o claim. */
    public record Session(long userId, long expiresAt, int tokenVersion) {}

    private static final Pattern SUB = Pattern.compile("\"sub\"\\s*:\\s*\"(\\d{1,18})\"");
    private static final Pattern EXP = Pattern.compile("\"exp\"\\s*:\\s*(\\d{1,18})");
    private static final Pattern TV = Pattern.compile("\"tv\"\\s*:\\s*(\\d{1,9})");
    private static final Pattern KID = Pattern.compile("\"kid\"\\s*:\\s*\"([0-9a-f]{8})\"");
    private static final Base64.Encoder ENC = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DEC = Base64.getUrlDecoder();

    private record Key(String kid, byte[] secret) {}

    private final Key current;
    private final Key previous;
    private final long ttlSeconds;
    private final String headerPart;

    public TokenService(String secret, long ttlSeconds) {
        this(secret, null, ttlSeconds);
    }

    /** {@code previousSecret} (opcional) ainda é aceito na verificação durante a rotação. */
    public TokenService(String secret, String previousSecret, long ttlSeconds) {
        this.current = key(secret);
        this.previous = previousSecret == null || previousSecret.isBlank() ? null : key(previousSecret);
        this.ttlSeconds = ttlSeconds;
        this.headerPart = header(current.kid());
    }

    private static Key key(String secret) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(("orbnoc-kid:" + secret).getBytes(StandardCharsets.UTF_8));
            return new Key(HexFormat.of().formatHex(digest, 0, 4), bytes);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String header(String kid) {
        String json = "{\"alg\":\"HS256\",\"typ\":\"JWT\",\"kid\":\"" + kid + "\"}";
        return ENC.encodeToString(json.getBytes(StandardCharsets.UTF_8));
    }

    public long ttlSeconds() {
        return ttlSeconds;
    }

    public String create(long userId) {
        return create(userId, 0);
    }

    public String create(long userId, int tokenVersion) {
        return create(userId, tokenVersion, Instant.now().getEpochSecond());
    }

    String create(long userId, long issuedAt) {
        return create(userId, 0, issuedAt);
    }

    String create(long userId, int tokenVersion, long issuedAt) {
        String claims = "{\"sub\":\"" + userId + "\",\"iat\":" + issuedAt + ",\"exp\":" + (issuedAt + ttlSeconds)
                + ",\"tv\":" + tokenVersion + "}";
        String signingInput = headerPart + "." + ENC.encodeToString(claims.getBytes(StandardCharsets.UTF_8));
        return signingInput + "." + ENC.encodeToString(hmac(current, signingInput));
    }

    /** Sessão válida (assinatura e prazo) ou {@code null}. A versão do token é conferida por quem chama. */
    public Session parse(String token) {
        if (token == null || token.isEmpty() || token.length() > 2048) return null;
        String[] parts = token.split("\\.", -1);
        if (parts.length != 3) return null;
        try {
            Key key = keyFor(new String(DEC.decode(parts[0]), StandardCharsets.UTF_8));
            if (key == null || !parts[0].equals(header(key.kid()))) return null;
            byte[] expected = hmac(key, parts[0] + "." + parts[1]);
            if (!MessageDigest.isEqual(expected, DEC.decode(parts[2]))) return null;
            String claims = new String(DEC.decode(parts[1]), StandardCharsets.UTF_8);
            Matcher sub = SUB.matcher(claims);
            Matcher exp = EXP.matcher(claims);
            if (!sub.find() || !exp.find()) return null;
            long expiresAt = Long.parseLong(exp.group(1));
            if (expiresAt <= Instant.now().getEpochSecond()) return null;
            Matcher tv = TV.matcher(claims);
            int version = tv.find() ? Integer.parseInt(tv.group(1)) : 0;
            return new Session(Long.parseLong(sub.group(1)), expiresAt, version);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** Chave indicada pelo {@code kid} do cabeçalho; sem kid (tokens antigos), a atual. */
    private Key keyFor(String headerJson) {
        Matcher m = KID.matcher(headerJson);
        if (!m.find()) return null;
        String kid = m.group(1);
        if (current.kid().equals(kid)) return current;
        if (previous != null && previous.kid().equals(kid)) return previous;
        return null;
    }

    private static byte[] hmac(Key key, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key.secret(), "HmacSHA256"));
            return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
