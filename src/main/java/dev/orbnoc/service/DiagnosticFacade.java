package dev.orbnoc.service;

import dev.orbnoc.config.OrbNocProperties;
import dev.orbnoc.core.DiagnosticsService;
import dev.orbnoc.core.NetGuard;
import dev.orbnoc.core.RateLimiter;
import dev.orbnoc.web.api.ApiException;
import dev.orbnoc.web.api.Validate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** Orquestra as ferramentas de diagnóstico: valida alvo, aplica rate limit e executa. */
@Service
public class DiagnosticFacade {

    private static final int LIMIT_PER_MINUTE = 30;
    private static final List<Integer> DEFAULT_PORTS = List.of(22, 80, 443);

    private final DiagnosticsService diagnostics;
    private final RateLimiter limiter;
    private final OrbNocProperties props;

    public DiagnosticFacade(DiagnosticsService diagnostics, RateLimiter limiter, OrbNocProperties props) {
        this.diagnostics = diagnostics;
        this.limiter = limiter;
        this.props = props;
    }

    private void throttle(Long userId) {
        if (limiter.hit("diagnostic:" + userId, 60) > LIMIT_PER_MINUTE) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Muitas requisições de diagnóstico; aguarde um minuto");
        }
    }

    private String target(String host) {
        return NetGuard.resolveAndCheck(host, props.allowPrivateNetworks(), 5000).get(0);
    }

    public Map<String, Object> ping(Long userId, String host, Integer count) {
        throttle(userId);
        int n = count == null ? 4 : Validate.range(count, "Quantidade", 1, 10);
        String address = target(host);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("host", NetGuard.parseHost(host));
        out.put("address", address);
        out.putAll(diagnostics.runPing(address, n));
        return out;
    }

    public Map<String, Object> traceroute(Long userId, String host, Integer maxHops) {
        throttle(userId);
        int hops = maxHops == null ? 20 : Validate.range(maxHops, "Saltos", 1, 30);
        String address = target(host);
        try {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("host", NetGuard.parseHost(host));
            out.put("address", address);
            out.put("hops", diagnostics.runTraceroute(address, hops, 60));
            return out;
        } catch (IllegalStateException e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
        }
    }

    public Map<String, Object> dns(Long userId, String domain, String recordType) {
        throttle(userId);
        return diagnostics.lookupDns(domain, recordType == null ? "A" : recordType);
    }

    public Map<String, Object> ports(Long userId, String host, List<Integer> ports) {
        throttle(userId);
        List<Integer> list = validatePorts(ports, false);
        String address = target(host);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("host", NetGuard.parseHost(host));
        out.put("address", address);
        out.put("results", diagnostics.checkPorts(address, list, 2.0));
        return out;
    }

    public Map<String, Object> full(Long userId, String host, List<Integer> ports) {
        throttle(userId);
        List<Integer> list = validatePorts(ports, true);
        String parsed = NetGuard.parseHost(host);
        String address = target(host);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("host", parsed);
        out.put("address", address);
        out.put("ping", diagnostics.runPing(address, 3));
        out.put("ports", diagnostics.checkPorts(address, list, 2.0));
        out.put("dns", NetGuard.parseIpLiteral(parsed) == null ? diagnostics.lookupDns(parsed, "A") : null);
        return out;
    }

    private static List<Integer> validatePorts(List<Integer> ports, boolean allowEmpty) {
        if (ports == null || ports.isEmpty()) {
            Validate.require(allowEmpty, "Informe ao menos uma porta");
            return DEFAULT_PORTS;
        }
        Validate.require(ports.size() <= 20, "No máximo 20 portas por teste");
        for (Integer p : ports) Validate.range(p, "Porta", 1, 65535);
        return ports.stream().distinct().toList();
    }
}
