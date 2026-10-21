package dev.orbnoc.core;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Converte a {@code DATABASE_URL} para JDBC. Aceita {@code jdbc:postgresql://...} (com usuário e
 * senha à parte) e o formato {@code postgresql://usuario:senha@host:5432/banco?sslmode=require}
 * usado por provedores como Neon, Supabase e Render.
 */
public record DatabaseConnection(String jdbcUrl, String username, String password) {

    public static DatabaseConnection parse(String url, String username, String password, boolean forceSsl) {
        String raw = url == null ? "" : url.strip();
        if (raw.startsWith("jdbc:")) return new DatabaseConnection(raw, blankToNull(username), blankToNull(password));

        URI uri = URI.create(raw);
        String scheme = uri.getScheme();
        if (!"postgresql".equals(scheme) && !"postgres".equals(scheme)) {
            throw new IllegalArgumentException("DATABASE_URL deve começar com postgresql:// ou jdbc:postgresql://");
        }
        String user = blankToNull(username);
        String pass = blankToNull(password);
        String info = uri.getRawUserInfo();
        if (info != null) {
            int colon = info.indexOf(':');
            String u = colon < 0 ? info : info.substring(0, colon);
            String p = colon < 0 ? null : info.substring(colon + 1);
            if (user == null) user = decode(u);
            if (pass == null && p != null) pass = decode(p);
        }
        int port = uri.getPort() > 0 ? uri.getPort() : 5432;
        String path = uri.getPath() == null || uri.getPath().isEmpty() ? "/postgres" : uri.getPath();

        List<String> params = new ArrayList<>();
        boolean ssl = forceSsl;
        if (uri.getRawQuery() != null) {
            for (String pair : uri.getRawQuery().split("&")) {
                if (pair.isEmpty()) continue;
                String key = pair.contains("=") ? pair.substring(0, pair.indexOf('=')) : pair;
                String value = pair.contains("=") ? pair.substring(pair.indexOf('=') + 1) : "";
                if (key.equals("sslmode")) {
                    if (value.equals("require") || value.equals("verify-ca") || value.equals("verify-full")) ssl = true;
                } else if (!key.equals("channel_binding")) {
                    params.add(pair);
                }
            }
        }
        if (ssl) params.add("sslmode=require");
        String query = params.isEmpty() ? "" : "?" + String.join("&", params);
        return new DatabaseConnection("jdbc:postgresql://" + uri.getHost() + ":" + port + path + query, user, pass);
    }

    private static String decode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
