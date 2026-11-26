package dev.orbnoc.service;

import dev.orbnoc.config.OrbNocProperties;
import dev.orbnoc.core.RateLimiter;
import dev.orbnoc.core.SecretBox;
import dev.orbnoc.core.Totp;
import dev.orbnoc.domain.AccessLog;
import dev.orbnoc.domain.User;
import dev.orbnoc.repo.AccessLogRepository;
import dev.orbnoc.repo.UserRepository;
import dev.orbnoc.web.api.ApiException;
import dev.orbnoc.web.api.Validate;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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
    private final SecretBox secretBox;
    /** Hash de mentira usado para gastar o mesmo tempo quando o usuário não existe. */
    private final String dummyHash;

    public UserService(
            UserRepository users,
            AccessLogRepository accessLogs,
            PasswordEncoder encoder,
            RateLimiter limiter,
            OrbNocProperties props,
            SecretBox secretBox) {
        this.users = users;
        this.accessLogs = accessLogs;
        this.encoder = encoder;
        this.limiter = limiter;
        this.props = props;
        this.secretBox = secretBox;
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
        return login(username, password, null, ip);
    }

    /**
     * Três limites independentes: IP + usuário (o clássico), só usuário (atacante que varia o IP) e
     * só IP (um IP testando muitos usuários). Os dois últimos são mais folgados, para um atacante
     * não conseguir trancar de fora o dono legítimo com poucas tentativas.
     */
    public User login(String username, String password, String totpCode, String ip) {
        Validate.require(username != null && !username.isEmpty() && username.length() <= 255, "Informe o usuário");
        Validate.require(password != null && !password.isEmpty() && password.length() <= 256, "Informe a senha");
        String lower = username.toLowerCase(Locale.ROOT);
        String pairKey = "login:" + ip + ":" + lower;
        String userKey = "login-user:" + lower;
        String ipKey = "login-ip:" + ip;
        int max = props.loginMaxAttempts();
        if (limiter.isBlocked(pairKey, max) || limiter.isBlocked(userKey, max * 3) || limiter.isBlocked(ipKey, max * 5)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Muitas tentativas; tente mais tarde");
        }
        User user = users.findFirstByUsernameOrEmail(username, lower).orElse(null);
        // Verifica sempre um hash, para não revelar (pelo tempo) se o usuário existe.
        boolean valid = verify(user != null ? user.getPasswordHash() : dummyHash, password);
        if (user == null || !valid || !user.isActive()) {
            registerLoginFailure(pairKey, userKey, ipKey);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Credenciais inválidas");
        }
        if (user.isTotpEnabled()) {
            if (totpCode == null || totpCode.isBlank()) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "Informe o código de verificação em duas etapas");
            }
            String secret = user.getTotpSecretEncrypted() == null ? null : secretBox.decrypt(user.getTotpSecretEncrypted());
            if (!Totp.verify(secret, totpCode, Instant.now())) {
                registerLoginFailure(pairKey, userKey, ipKey);
                throw new ApiException(HttpStatus.UNAUTHORIZED, "Código de verificação inválido");
            }
        }
        limiter.clear(pairKey);
        user.setLastLogin(Instant.now());
        users.save(user);
        log(user.getId(), "login", ip);
        return user;
    }

    private void registerLoginFailure(String pairKey, String userKey, String ipKey) {
        int window = props.loginWindowSeconds();
        limiter.hit(pairKey, window);
        limiter.hit(userKey, window);
        limiter.hit(ipKey, window);
    }

    // ---- senha própria e segundo fator -----------------------------------------------------------

    /** Troca a própria senha e invalida todas as outras sessões; devolve o usuário atualizado (nova versão de token). */
    public User changePassword(User user, String currentPassword, String newPassword, String ip) {
        Validate.require(currentPassword != null && !currentPassword.isEmpty(), "Informe a senha atual");
        String key = "pwchange:" + user.getId();
        if (limiter.isBlocked(key, props.loginMaxAttempts())) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Muitas tentativas; tente mais tarde");
        }
        if (!verify(user.getPasswordHash(), currentPassword)) {
            limiter.hit(key, props.loginWindowSeconds());
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Senha atual incorreta");
        }
        Validate.password(newPassword);
        Validate.require(!newPassword.equals(currentPassword), "A nova senha deve ser diferente da atual");
        limiter.clear(key);
        user.setPasswordHash(hash(newPassword));
        users.save(user);
        users.bumpTokenVersion(user.getId());
        audit(user.getId(), "password_change", null, ip);
        return users.findById(user.getId()).orElse(user);
    }

    /** Gera um segredo TOTP novo (ainda inativo) e devolve o segredo e a URI para o aplicativo autenticador. */
    public Map<String, Object> startTotpSetup(User user, String ip) {
        Validate.require(!user.isTotpEnabled(), "A verificação em duas etapas já está ativa");
        String secret = Totp.newSecret();
        user.setTotpSecretEncrypted(secretBox.encrypt(secret));
        users.save(user);
        audit(user.getId(), "totp_setup", null, ip);
        return Map.of("secret", secret, "otpauth_uri", Totp.uri("OrbNOC", user.getUsername(), secret));
    }

    public void enableTotp(User user, String code, String ip) {
        Validate.require(user.getTotpSecretEncrypted() != null, "Inicie a configuração antes de ativar");
        Validate.require(totpMatches(user, code), "Código de verificação inválido");
        user.setTotpEnabled(true);
        users.save(user);
        users.bumpTokenVersion(user.getId()); // sessões abertas antes do 2FA deixam de valer
        audit(user.getId(), "totp_enable", null, ip);
    }

    public void disableTotp(User user, String password, String code, String ip) {
        Validate.require(user.isTotpEnabled(), "A verificação em duas etapas não está ativa");
        if (!verify(user.getPasswordHash(), password == null ? "" : password) || !totpMatches(user, code)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Senha ou código de verificação inválidos");
        }
        user.setTotpEnabled(false);
        user.setTotpSecretEncrypted(null);
        users.save(user);
        users.bumpTokenVersion(user.getId());
        audit(user.getId(), "totp_disable", null, ip);
    }

    private boolean totpMatches(User user, String code) {
        String secret = user.getTotpSecretEncrypted() == null ? null : secretBox.decrypt(user.getTotpSecretEncrypted());
        return Totp.verify(secret, code, Instant.now());
    }

    /** Cadastros por IP por hora (o registro só existe com REGISTRATION_ENABLED=true). */
    private static final int REGISTER_PER_IP_PER_HOUR = 10;

    public User register(String username, String email, String password, String ip) {
        if (!props.registrationEnabled()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Registro desativado; peça a um administrador");
        }
        if (limiter.hit("register:" + ip, 3600) > REGISTER_PER_IP_PER_HOUR) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Muitos cadastros deste endereço; tente mais tarde");
        }
        User user = create(username, email, password, "user");
        log(user.getId(), "register", ip);
        return user;
    }

    /** Sai e revoga o token: incrementa a versão, então a sessão (inclusive uma cópia do cookie) deixa de valer. */
    public void logout(User user, String ip) {
        users.bumpTokenVersion(user.getId());
        log(user.getId(), "logout", ip);
    }

    private void log(Long userId, String action, String ip) {
        audit(userId, action, null, ip);
    }

    /** Trilha de auditoria (tabela access_logs): quem fez, o quê, sobre o quê e de onde. */
    public void audit(Long userId, String action, String detail, String ip) {
        AccessLog entry = new AccessLog();
        entry.setUserId(userId);
        entry.setAction(action);
        entry.setDetail(detail == null ? null : (detail.length() > 255 ? detail.substring(0, 255) : detail));
        entry.setIpAddress(ip == null ? null : (ip.length() > 64 ? ip.substring(0, 64) : ip));
        accessLogs.save(entry);
    }

    // ---- administração ----------------------------------------------------------------------------

    /** Usuário atual do banco (por exemplo, para reemitir o cookie com a nova versão de token). */
    public User reload(Long id) {
        return users.findById(id).orElseThrow(() -> ApiException.notFound("Usuário não encontrado"));
    }

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
        String previousRole = user.getRole();
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
        User saved = users.save(user);
        // Senha nova, desativação ou mudança de perfil derrubam as sessões já emitidas.
        if (password != null || deactivating || (role != null && !role.equals(previousRole))) {
            users.bumpTokenVersion(user.getId());
        }
        return saved;
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
