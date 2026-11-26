package dev.orbnoc.core;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Criptografia autenticada (AES-256-GCM) para segredos guardados no banco (token do Telegram).
 *
 * <p>Formato novo: {@code v1.<kid>.<base64url(iv + cifrado)>}, em que {@code kid} identifica a
 * chave usada. Isso permite a rotação: com {@code ENCRYPTION_KEY_PREVIOUS} configurada, valores
 * cifrados com a chave anterior continuam legíveis ({@link #needsRotation} avisa para recifrar).
 * Valores no formato antigo (sem prefixo) ainda são lidos, com a chave atual e depois a anterior.
 */
public final class SecretBox {

    private static final String PREFIX = "v1.";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final SecureRandom RANDOM = new SecureRandom();

    private record Key(String kid, SecretKeySpec spec) {}

    private final Key current;
    private final Key previous;

    /** A chave é derivada (SHA-256) do segredo informado. */
    public SecretBox(String secret) {
        this(secret, null);
    }

    public SecretBox(String secret, String previousSecret) {
        this.current = derive(secret);
        this.previous = previousSecret == null || previousSecret.isBlank() ? null : derive(previousSecret);
    }

    private static Key derive(String secret) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(("orbnoc-secretbox:" + secret).getBytes(StandardCharsets.UTF_8));
            byte[] kidDigest = MessageDigest.getInstance("SHA-256").digest(digest);
            return new Key(HexFormat.of().formatHex(kidDigest, 0, 4), new SecretKeySpec(digest, "AES"));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    public String encrypt(String plain) {
        try {
            byte[] iv = new byte[IV_BYTES];
            RANDOM.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, current.spec(), new GCMParameterSpec(TAG_BITS, iv));
            byte[] encrypted = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            ByteBuffer out = ByteBuffer.allocate(iv.length + encrypted.length).put(iv).put(encrypted);
            return PREFIX + current.kid() + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(out.array());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Texto original, ou {@code null} se o valor foi adulterado ou veio de uma chave desconhecida. */
    public String decrypt(String value) {
        if (value == null) return null;
        if (value.startsWith(PREFIX)) {
            int dot = value.indexOf('.', PREFIX.length());
            if (dot < 0) return null;
            String kid = value.substring(PREFIX.length(), dot);
            Key key = current.kid().equals(kid) ? current : previous != null && previous.kid().equals(kid) ? previous : null;
            return key == null ? null : open(key, value.substring(dot + 1));
        }
        String plain = open(current, value); // formato antigo, sem prefixo
        if (plain == null && previous != null) plain = open(previous, value);
        return plain;
    }

    /** {@code true} se o valor não está no formato atual com a chave atual (vale recifrar e salvar). */
    public boolean needsRotation(String value) {
        return value != null && !value.startsWith(PREFIX + current.kid() + ".");
    }

    private static String open(Key key, String base64) {
        try {
            byte[] raw = Base64.getUrlDecoder().decode(base64);
            if (raw.length <= IV_BYTES) return null;
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key.spec(), new GCMParameterSpec(TAG_BITS, raw, 0, IV_BYTES));
            return new String(cipher.doFinal(raw, IV_BYTES, raw.length - IV_BYTES), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            return null;
        }
    }
}
