package dev.orbnoc.core;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** Token de sessão: JWT HS256 mínimo (sub, iat, exp), sem dependências externas. */
public final class TokenService {

    public record Session(long userId, long expiresAt) {}

    private static final String HEADER_JSON = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}";
    private static final Pattern SUB = Pattern.compile("\"sub\"\\s*:\\s*\"(\\d{1,18})\"");
    private static final Pattern EXP = Pattern.compile("\"exp\"\\s*:\\s*(\\d{1,18})");
    private static final Base64.Encoder ENC = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DEC = Base64.getUrlDecoder();

    private final byte[] secret;
    private final long ttlSeconds;
    private final String headerPart = ENC.encodeToString(HEADER_JSON.getBytes(StandardCharsets.UTF_8));

    public TokenService(String secret, long ttlSeconds) {
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.ttlSeconds = ttlSeconds;
    }

    public long ttlSeconds() {
        return ttlSeconds;
    }

    public String create(long userId) {
        return create(userId, Instant.now().getEpochSecond());
    }

    String create(long userId, long issuedAt) {
        String claims = "{\"sub\":\"" + userId + "\",\"iat\":" + issuedAt + ",\"exp\":" + (issuedAt + ttlSeconds) + "}";
        String signingInput = headerPart + "." + ENC.encodeToString(claims.getBytes(StandardCharsets.UTF_8));
        return signingInput + "." + ENC.encodeToString(hmac(signingInput));
    }

    /** Sessão válida (assinatura e prazo) ou {@code null}. */
    public Session parse(String token) {
        if (token == null || token.isEmpty() || token.length() > 2048) return null;
        String[] parts = token.split("\\.", -1);
        if (parts.length != 3 || !parts[0].equals(headerPart)) return null;
        try {
            byte[] expected = hmac(parts[0] + "." + parts[1]);
            if (!MessageDigest.isEqual(expected, DEC.decode(parts[2]))) return null;
            String claims = new String(DEC.decode(parts[1]), StandardCharsets.UTF_8);
            Matcher sub = SUB.matcher(claims);
            Matcher exp = EXP.matcher(claims);
            if (!sub.find() || !exp.find()) return null;
            long expiresAt = Long.parseLong(exp.group(1));
            if (expiresAt <= Instant.now().getEpochSecond()) return null;
            return new Session(Long.parseLong(sub.group(1)), expiresAt);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private byte[] hmac(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
