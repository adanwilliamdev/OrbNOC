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
        User admin = auth.requireAdmin(request);
        String role = body.role() == null ? "user" : body.role();
        User created = users.create(body.username(), body.email(), body.password(), role);
        users.audit(admin.getId(), "admin.user_create", "usuário " + created.getId() + " (" + role + ")", AuthService.clientIp(request));
        return Dto.UserAdminOut.from(created);
    }

    @PatchMapping("/{id}")
    Dto.UserAdminOut patch(@PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        User admin = auth.requireAdmin(request);
        Boolean active = body.get("is_active") instanceof Boolean b ? b : null;
        String role = body.get("role") == null ? null : String.valueOf(body.get("role"));
        String password = body.get("password") == null ? null : String.valueOf(body.get("password"));
        User patched = users.patch(admin.getId(), id, active, role, password);
        // Registra o que mudou, nunca a senha em si.
        String detail = "usuário " + id
                + (active != null ? " ativo=" + active : "")
                + (role != null ? " perfil=" + role : "")
                + (password != null ? " senha redefinida" : "");
        users.audit(admin.getId(), "admin.user_update", detail, AuthService.clientIp(request));
        return Dto.UserAdminOut.from(patched);
    }

    @DeleteMapping("/{id}")
    Map<String, Object> delete(@PathVariable Long id, HttpServletRequest request) {
        User admin = auth.requireAdmin(request);
        users.delete(admin.getId(), id);
        users.audit(admin.getId(), "admin.user_delete", "usuário " + id, AuthService.clientIp(request));
        return Map.of("success", true);
    }
}
