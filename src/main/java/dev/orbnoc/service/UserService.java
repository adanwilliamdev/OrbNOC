package dev.orbnoc.service;

import dev.orbnoc.config.OrbNocProperties;
import dev.orbnoc.core.RateLimiter;
import dev.orbnoc.domain.AccessLog;
import dev.orbnoc.domain.User;
import dev.orbnoc.repo.AccessLogRepository;
import dev.orbnoc.repo.UserRepository;
import dev.orbnoc.web.api.ApiException;
import dev.orbnoc.web.api.Validate;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Login, registro e administração de usuários. */
@Service
public class UserService {

    private final UserRepository users;
    private final AccessLogRepository accessLogs;
    private final PasswordEncoder encoder;
    private final RateLimiter limiter;
    private final OrbNocProperties props;
    /** Hash de mentira usado para gastar o mesmo tempo quando o usuário não existe. */
    private final String dummyHash;

    public UserService(
            UserRepository users,
            AccessLogRepository accessLogs,
            PasswordEncoder encoder,
            RateLimiter limiter,
            OrbNocProperties props) {
        this.users = users;
        this.accessLogs = accessLogs;
        this.encoder = encoder;
        this.limiter = limiter;
        this.props = props;
        this.dummyHash = encoder.encode("orbnoc-dummy-password");
    }

    public String hash(String password) {
        return encoder.encode(password);
    }

    private boolean verify(String hash, String password) {
        try {
            return encoder.matches(password, hash);
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    // ---- login / registro ----------------------------------------------------------------------

    public User login(String username, String password, String ip) {
        Validate.require(username != null && !username.isEmpty() && username.length() <= 255, "Informe o usuário");
        Validate.require(password != null && !password.isEmpty() && password.length() <= 256, "Informe a senha");
        String key = "login:" + ip + ":" + username.toLowerCase(Locale.ROOT);
        if (limiter.isBlocked(key, props.loginMaxAttempts())) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Muitas tentativas; tente mais tarde");
        }
        User user = users.findFirstByUsernameOrEmail(username, username.toLowerCase(Locale.ROOT)).orElse(null);
        // Verifica sempre um hash, para não revelar (pelo tempo) se o usuário existe.
        boolean valid = verify(user != null ? user.getPasswordHash() : dummyHash, password);
        if (user == null || !valid || !user.isActive()) {
            limiter.hit(key, props.loginWindowSeconds());
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Credenciais inválidas");
        }
        limiter.clear(key);
        user.setLastLogin(Instant.now());
        users.save(user);
        log(user.getId(), "login", ip);
        return user;
    }

    public User register(String username, String email, String password, String ip) {
        if (!props.registrationEnabled()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Registro desativado; peça a um administrador");
        }
        User user = create(username, email, password, "user");
        log(user.getId(), "register", ip);
        return user;
    }

    public void logout(User user, String ip) {
        log(user.getId(), "logout", ip);
    }

    private void log(Long userId, String action, String ip) {
        AccessLog entry = new AccessLog();
        entry.setUserId(userId);
        entry.setAction(action);
        entry.setIpAddress(ip == null ? null : (ip.length() > 64 ? ip.substring(0, 64) : ip));
        accessLogs.save(entry);
    }

    // ---- administração ----------------------------------------------------------------------------

    public List<User> list() {
        return users.findAllByOrderByIdAsc();
    }

    public User create(String username, String email, String password, String role) {
        Validate.username(username);
        String mail = Validate.email(email);
        Validate.password(password);
        Validate.require("admin".equals(role) || "user".equals(role), "Perfil inválido");
        User user = new User();
        user.setUsername(username);
        user.setEmail(mail);
        user.setPasswordHash(hash(password));
        user.setRole(role);
        try {
            return users.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            throw ApiException.conflict("Usuário ou email já existe");
        }
    }

    @Transactional
    public User patch(Long adminId, Long userId, Boolean active, String role, String password) {
        User user = users.findById(userId).orElseThrow(() -> ApiException.notFound("Usuário não encontrado"));
        if (role != null) Validate.require("admin".equals(role) || "user".equals(role), "Perfil inválido");
        if (password != null) Validate.password(password);
        boolean demoting = "user".equals(role) && "admin".equals(user.getRole());
        boolean deactivating = Boolean.FALSE.equals(active) && user.isActive();
        if ((demoting || deactivating) && "admin".equals(user.getRole()) && users.countByRoleAndActiveTrue("admin") <= 1) {
            throw ApiException.conflict("Não é possível remover o último admin");
        }
        if (user.getId().equals(adminId) && (demoting || deactivating)) {
            throw ApiException.conflict("Você não pode desativar ou rebaixar a própria conta");
        }
        if (active != null) user.setActive(active);
        if (role != null) user.setRole(role);
        if (password != null) user.setPasswordHash(hash(password));
        return users.save(user);
    }

    /** Remove o usuário e, em cascata (banco), dispositivos, alertas e configurações dele. */
    @Transactional
    public void delete(Long adminId, Long userId) {
        User user = users.findById(userId).orElseThrow(() -> ApiException.notFound("Usuário não encontrado"));
        if (user.getId().equals(adminId)) throw ApiException.conflict("Você não pode remover a própria conta");
        if ("admin".equals(user.getRole()) && user.isActive() && users.countByRoleAndActiveTrue("admin") <= 1) {
            throw ApiException.conflict("Não é possível remover o último admin");
        }
        users.delete(user);
    }
}
