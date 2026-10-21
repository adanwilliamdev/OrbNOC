package dev.orbnoc.service;

import dev.orbnoc.config.OrbNocProperties;
import dev.orbnoc.core.TokenService;
import dev.orbnoc.domain.User;
import dev.orbnoc.repo.UserRepository;
import dev.orbnoc.web.api.ApiException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

/** Sessão por cookie httpOnly com JWT: leitura do usuário atual e emissão/limpeza do cookie. */
@Service
public class AuthService {

    private static final String USER_ATTR = "orbnoc.user";

    private final TokenService tokens;
    private final UserRepository users;
    private final OrbNocProperties props;

    public AuthService(TokenService tokens, UserRepository users, OrbNocProperties props) {
        this.tokens = tokens;
        this.users = users;
        this.props = props;
    }

    /** Usuário logado e ativo, ou {@code null}. O resultado fica em cache na requisição. */
    public User currentUserOrNull(HttpServletRequest request) {
        Object cached = request.getAttribute(USER_ATTR);
        if (cached instanceof User user) return user;
        User user = userFromToken(tokenFrom(request));
        if (user != null) request.setAttribute(USER_ATTR, user);
        return user;
    }

    public User userFromToken(String token) {
        TokenService.Session session = tokens.parse(token);
        if (session == null) return null;
        return users.findById(session.userId()).filter(User::isActive).orElse(null);
    }

    public User requireUser(HttpServletRequest request) {
        User user = currentUserOrNull(request);
        if (user == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "Não autenticado");
        return user;
    }

    public User requireAdmin(HttpServletRequest request) {
        User user = requireUser(request);
        if (!"admin".equals(user.getRole())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Acesso restrito a administradores");
        }
        return user;
    }

    public String tokenFrom(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) if (props.cookieName().equals(c.getName())) return c.getValue();
        return null;
    }

    public void setSessionCookie(HttpServletResponse response, User user) {
        ResponseCookie cookie = ResponseCookie.from(props.cookieName(), tokens.create(user.getId()))
                .maxAge(Duration.ofSeconds(tokens.ttlSeconds()))
                .httpOnly(true)
                .secure(props.secureCookie())
                .sameSite("Lax")
                .path("/")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    public void clearSessionCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(props.cookieName(), "")
                .maxAge(Duration.ZERO)
                .httpOnly(true)
                .secure(props.secureCookie())
                .sameSite("Lax")
                .path("/")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    public static String clientIp(HttpServletRequest request) {
        String ip = request.getRemoteAddr();
        return ip == null ? "unknown" : ip;
    }
}
