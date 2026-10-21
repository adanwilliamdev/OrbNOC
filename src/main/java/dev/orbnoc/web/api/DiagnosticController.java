package dev.orbnoc.web.api;

import dev.orbnoc.domain.User;
import dev.orbnoc.service.AuthService;
import dev.orbnoc.service.DiagnosticFacade;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/diagnostic")
public class DiagnosticController {

    private final AuthService auth;
    private final DiagnosticFacade facade;

    public DiagnosticController(AuthService auth, DiagnosticFacade facade) {
        this.auth = auth;
        this.facade = facade;
    }

    @PostMapping("/ping")
    Map<String, Object> ping(@RequestBody Dto.PingIn body, HttpServletRequest request) {
        User user = auth.requireUser(request);
        return facade.ping(user.getId(), body.host(), body.count());
    }

    @PostMapping("/traceroute")
    Map<String, Object> traceroute(@RequestBody Dto.TracerouteIn body, HttpServletRequest request) {
        User user = auth.requireUser(request);
        return facade.traceroute(user.getId(), body.host(), body.maxHops());
    }

    @PostMapping("/dns")
    Map<String, Object> dns(@RequestBody Dto.DnsIn body, HttpServletRequest request) {
        User user = auth.requireUser(request);
        return facade.dns(user.getId(), body.domain(), body.recordType());
    }

    @PostMapping("/ports")
    Map<String, Object> ports(@RequestBody Dto.PortsIn body, HttpServletRequest request) {
        User user = auth.requireUser(request);
        return facade.ports(user.getId(), body.host(), body.ports());
    }

    @PostMapping("/full")
    Map<String, Object> full(@RequestBody Dto.FullDiagnosticIn body, HttpServletRequest request) {
        User user = auth.requireUser(request);
        return facade.full(user.getId(), body.host(), body.ports());
    }
}
