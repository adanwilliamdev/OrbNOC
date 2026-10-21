package dev.orbnoc.web.api;

import dev.orbnoc.config.OrbNocProperties;
import dev.orbnoc.domain.User;
import dev.orbnoc.service.AuthService;
import dev.orbnoc.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;
    private final UserService users;
    private final OrbNocProperties props;

    public AuthController(AuthService auth, UserService users, OrbNocProperties props) {
        this.auth = auth;
        this.users = users;
        this.props = props;
    }

    @GetMapping("/config")
    Map<String, Object> config() {
        return Map.of("registration_enabled", props.registrationEnabled());
    }

    @PostMapping("/login")
    Dto.AuthOut login(@RequestBody Dto.LoginIn body, HttpServletRequest request, HttpServletResponse response) {
        User user = users.login(body.username(), body.password(), AuthService.clientIp(request));
        auth.setSessionCookie(response, user);
        return Dto.AuthOut.of(user);
    }

    @PostMapping("/register")
    Dto.AuthOut register(@RequestBody Dto.RegisterIn body, HttpServletRequest request, HttpServletResponse response) {
        User user = users.register(body.username(), body.email(), body.password(), AuthService.clientIp(request));
        auth.setSessionCookie(response, user);
        return Dto.AuthOut.of(user);
    }

    @PostMapping("/logout")
    Map<String, Object> logout(HttpServletRequest request, HttpServletResponse response) {
        User user = auth.currentUserOrNull(request);
        if (user != null) users.logout(user, AuthService.clientIp(request));
        auth.clearSessionCookie(response);
        return Map.of("success", true);
    }

    @GetMapping("/me")
    Dto.UserOut me(HttpServletRequest request) {
        return Dto.UserOut.from(auth.requireUser(request));
    }
}
