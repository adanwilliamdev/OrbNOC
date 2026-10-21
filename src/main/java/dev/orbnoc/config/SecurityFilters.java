package dev.orbnoc.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.util.Set;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Cabeçalhos de segurança e proteção CSRF por verificação de origem: requisições que alteram
 * estado só passam se o Origin (ou Referer) for uma origem conhecida ou o próprio Host.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class SecurityFilters extends OncePerRequestFilter {

    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");

    private final OrbNocProperties props;

    public SecurityFilters(OrbNocProperties props) {
        this.props = props;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
        response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
        response.setHeader(
                "Content-Security-Policy",
                "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
                        + "connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
        if (props.isProduction()) {
            response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        }
        if (!SAFE_METHODS.contains(request.getMethod()) && !originAllowed(request)) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"detail\":\"Origem não permitida\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean originAllowed(HttpServletRequest request) {
        String origin = request.getHeader("Origin");
        if (origin == null || origin.isBlank()) {
            String referer = request.getHeader("Referer");
            if (referer == null || referer.isBlank()) return true; // clientes sem navegador (curl, scripts)
            try {
                URI uri = URI.create(referer);
                origin = uri.getScheme() + "://" + uri.getRawAuthority();
            } catch (IllegalArgumentException e) {
                return false;
            }
        }
        while (origin.endsWith("/")) origin = origin.substring(0, origin.length() - 1);
        if (props.allowedOrigins().contains(origin)) return true;
        String host = request.getHeader("Host");
        return host != null && (origin.equals("http://" + host) || origin.equals("https://" + host));
    }
}
