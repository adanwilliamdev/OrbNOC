package dev.orbnoc.service;

import dev.orbnoc.config.OrbNocProperties;
import dev.orbnoc.domain.User;
import dev.orbnoc.repo.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Cria o admin inicial a partir de variáveis de ambiente (não existe login demo). Com
 * {@code ADMIN_FORCE_RESET=true}, redefine a senha do admin existente (recuperação de acesso).
 */
@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final OrbNocProperties props;
    private final UserRepository users;
    private final UserService userService;

    public AdminBootstrap(OrbNocProperties props, UserRepository users, UserService userService) {
        this.props = props;
        this.users = users;
        this.userService = userService;
    }

    @Override
    public void run(ApplicationArguments args) {
        String password = props.adminPassword();
        if (password == null || password.isBlank()) {
            log.info("ADMIN_PASSWORD não definido; nenhum admin criado");
            return;
        }
        User existing = users.findByUsername(props.adminUsername()).orElse(null);
        if (existing == null) {
            userService.create(props.adminUsername(), props.adminEmail(), password, "admin");
            log.info("Admin '{}' criado", props.adminUsername());
        } else if (props.adminForceReset()) {
            existing.setPasswordHash(userService.hash(password));
            existing.setRole("admin");
            existing.setActive(true);
            users.save(existing);
            log.warn("Senha do admin '{}' redefinida (ADMIN_FORCE_RESET). Remova a variável após o uso.", existing.getUsername());
        }
    }
}
