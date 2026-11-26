package dev.orbnoc.core;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** TOTP (RFC 6238, HMAC-SHA1, 6 dígitos, passo de 30 s), compatível com Google Authenticator e similares. */
public final class Totp {

    private static final String ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final int STEP_SECONDS = 30;
    private static final int DIGITS = 6;
    private static final SecureRandom RANDOM = new SecureRandom();

    private Totp() {}

    /** Segredo novo de 160 bits em Base32. */
    public static String newSecret() {
        byte[] bytes = new byte[20];
        RANDOM.nextBytes(bytes);
        return base32(bytes);
    }

    /** URI {@code otpauth://} para QR code / cadastro manual no aplicativo autenticador. */
    public static String uri(String issuer, String account, String secret) {
        return "otpauth://totp/" + enc(issuer) + ":" + enc(account) + "?secret=" + secret + "&issuer=" + enc(issuer)
                + "&algorithm=SHA1&digits=" + DIGITS + "&period=" + STEP_SECONDS;
    }

    /** Código do instante {@code at}. */
    public static String code(String secret, Instant at) {
        return codeForCounter(decode(secret), at.getEpochSecond() / STEP_SECONDS);
    }

    /** Confere o código aceitando 1 passo de tolerância para cada lado (relógios levemente fora). */
    public static boolean verify(String secret, String code, Instant now) {
        if (secret == null || code == null) return false;
        String clean = code.replace(" ", "");
        if (clean.length() != DIGITS) return false;
        byte[] key = decode(secret);
        if (key == null) return false;
        long counter = now.getEpochSecond() / STEP_SECONDS;
        boolean match = false;
        for (long c = counter - 1; c <= counter + 1; c++) {
            // sem curto-circuito: tempo de resposta não depende de qual janela acertou
            match |= MessageDigest.isEqual(
                    codeForCounter(key, c).getBytes(StandardCharsets.US_ASCII), clean.getBytes(StandardCharsets.US_ASCII));
        }
        return match;
    }

    private static String codeForCounter(byte[] key, long counter) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(key, "HmacSHA1"));
            byte[] hash = mac.doFinal(ByteBuffer.allocate(8).putLong(counter).array());
            int offset = hash[hash.length - 1] & 0x0f;
            int binary = ((hash[offset] & 0x7f) << 24)
                    | ((hash[offset + 1] & 0xff) << 16)
                    | ((hash[offset + 2] & 0xff) << 8)
                    | (hash[offset + 3] & 0xff);
            int otp = binary % 1_000_000;
            return String.format("%06d", otp);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    static String base32(byte[] data) {
        StringBuilder sb = new StringBuilder();
        int buffer = 0;
        int bits = 0;
        for (byte b : data) {
            buffer = (buffer << 8) | (b & 0xff);
            bits += 8;
            while (bits >= 5) {
                sb.append(ALPHABET.charAt((buffer >> (bits - 5)) & 31));
                bits -= 5;
            }
        }
        if (bits > 0) sb.append(ALPHABET.charAt((buffer << (5 - bits)) & 31));
        return sb.toString();
    }

    static byte[] decode(String text) {
        String clean = text.replace(" ", "").replace("=", "").toUpperCase(java.util.Locale.ROOT);
        ByteBuffer out = ByteBuffer.allocate(clean.length() * 5 / 8 + 1);
        int buffer = 0;
        int bits = 0;
        for (int i = 0; i < clean.length(); i++) {
            int v = ALPHABET.indexOf(clean.charAt(i));
            if (v < 0) return null;
            buffer = (buffer << 5) | v;
            bits += 5;
            if (bits >= 8) {
                out.put((byte) ((buffer >> (bits - 8)) & 0xff));
                bits -= 8;
            }
        }
        byte[] result = new byte[out.position()];
        out.flip();
        out.get(result);
        return result;
    }

    private static String enc(String value) {
        return java.net.URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
