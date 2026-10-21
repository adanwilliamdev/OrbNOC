package dev.orbnoc.ws;

import dev.orbnoc.config.OrbNocProperties;
import dev.orbnoc.core.TokenService;
import dev.orbnoc.domain.User;
import dev.orbnoc.repo.UserRepository;
import java.util.Map;
import org.springframework.http.HttpCookie;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

/**
 * Autentica o WebSocket pelo cookie de sessão e confere a origem. Em caso de falha a conexão é
 * aceita e fechada com código 4401/4403, para o navegador distinguir de uma queda de rede.
 */
@Component
public class LiveHandshakeInterceptor implements HandshakeInterceptor {

    public static final String USER_ID = "orbnoc.userId";
    public static final String EXPIRES_AT = "orbnoc.expiresAt";
    public static final String CLOSE_CODE = "orbnoc.closeCode";

    private final OrbNocProperties props;
    private final TokenService tokens;
    private final UserRepository users;

    public LiveHandshakeInterceptor(OrbNocProperties props, TokenService tokens, UserRepository users) {
        this.props = props;
        this.tokens = tokens;
        this.users = users;
    }

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Map<String, Object> attributes) {
        String origin = request.getHeaders().getOrigin();
        if (origin != null && !props.allowedOrigins().contains(stripSlash(origin)) && !sameHost(origin, request)) {
            attributes.put(CLOSE_CODE, 4403);
            return true;
        }
        String token = null;
        for (String header : request.getHeaders().getOrEmpty("Cookie")) {
            for (String part : header.split(";")) {
                HttpCookie cookie = parse(part.strip());
                if (cookie != null && props.cookieName().equals(cookie.getName())) token = cookie.getValue();
            }
        }
        TokenService.Session session = tokens.parse(token);
        User user = session == null ? null : users.findById(session.userId()).filter(User::isActive).orElse(null);
        if (user == null) {
            attributes.put(CLOSE_CODE, 4401);
            return true;
        }
        attributes.put(USER_ID, user.getId());
        attributes.put(EXPIRES_AT, session.expiresAt());
        return true;
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Exception exception) {
        // nada a fazer
    }

    private static HttpCookie parse(String pair) {
        int eq = pair.indexOf('=');
        return eq <= 0 ? null : new HttpCookie(pair.substring(0, eq), pair.substring(eq + 1));
    }

    private static String stripSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    /** Acesso direto por IP/host (sem proxy): a origem coincide com o Host da requisição. */
    private static boolean sameHost(String origin, ServerHttpRequest request) {
        String host = request.getHeaders().getFirst("Host");
        return host != null && (origin.equals("http://" + host) || origin.equals("https://" + host));
    }
}
