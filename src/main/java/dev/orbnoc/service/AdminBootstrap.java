package dev.orbnoc.service;

import dev.orbnoc.config.OrbNocProperties;
import dev.orbnoc.domain.User;
import dev.orbnoc.repo.UserRepository;
import dev.orbnoc.web.api.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Cria o admin inicial a partir de variáveis de ambiente (não existe login demo). Com
 * {@code ADMIN_FORCE_RESET=true}, redefine a senha do admin existente (recuperação de acesso).
 */
@Component
@Order(1)
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
        // Procura por usuário OU e-mail: se o ADMIN_USERNAME mudou mas o e-mail já existe no banco,
        // criar de novo violaria uq_users_email e derrubaria a aplicação a cada inicialização.
        User existing = users.findFirstByUsernameOrEmail(props.adminUsername(), props.adminEmail().strip().toLowerCase())
                .orElse(null);
        if (existing == null) {
            try {
                userService.create(props.adminUsername(), props.adminEmail(), password, "admin");
                log.info("Admin '{}' criado", props.adminUsername());
            } catch (ApiException e) {
                // Não derruba a aplicação por causa do admin inicial.
                log.error("Não foi possível criar o admin '{}': {}", props.adminUsername(), e.getMessage());
            }
        } else if (props.adminForceReset()) {
            existing.setPasswordHash(userService.hash(password));
            existing.setRole("admin");
            existing.setActive(true);
            users.save(existing);
            log.warn("Senha do admin '{}' redefinida (ADMIN_FORCE_RESET). Remova a variável após o uso.", existing.getUsername());
        } else if (!existing.getUsername().equals(props.adminUsername())) {
            log.warn("O e-mail '{}' já pertence ao usuário '{}' (ADMIN_USERNAME='{}'); nenhum admin criado. "
                    + "Entre com '{}' ou use ADMIN_FORCE_RESET=true para redefinir a senha dele.",
                    props.adminEmail(), existing.getUsername(), props.adminUsername(), existing.getUsername());
        }
    }
}
