package dev.orbnoc.web.api;

import dev.orbnoc.domain.User;
import dev.orbnoc.service.AuthService;
import dev.orbnoc.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Administração de usuários (somente admin). */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final AuthService auth;
    private final UserService users;

    public UserController(AuthService auth, UserService users) {
        this.auth = auth;
        this.users = users;
    }

    @GetMapping
    List<Dto.UserAdminOut> list(HttpServletRequest request) {
        auth.requireAdmin(request);
        return users.list().stream().map(Dto.UserAdminOut::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    Dto.UserAdminOut create(@RequestBody Dto.UserCreateIn body, HttpServletRequest request) {
        auth.requireAdmin(request);
        String role = body.role() == null ? "user" : body.role();
        return Dto.UserAdminOut.from(users.create(body.username(), body.email(), body.password(), role));
    }

    @PatchMapping("/{id}")
    Dto.UserAdminOut patch(@PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        User admin = auth.requireAdmin(request);
        Boolean active = body.get("is_active") instanceof Boolean b ? b : null;
        String role = body.get("role") == null ? null : String.valueOf(body.get("role"));
        String password = body.get("password") == null ? null : String.valueOf(body.get("password"));
        return Dto.UserAdminOut.from(users.patch(admin.getId(), id, active, role, password));
    }

    @DeleteMapping("/{id}")
    Map<String, Object> delete(@PathVariable Long id, HttpServletRequest request) {
        User admin = auth.requireAdmin(request);
        users.delete(admin.getId(), id);
        return Map.of("success", true);
    }
}
