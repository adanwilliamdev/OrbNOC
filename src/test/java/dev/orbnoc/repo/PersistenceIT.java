package dev.orbnoc.repo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.orbnoc.domain.Device;
import dev.orbnoc.domain.User;
import dev.orbnoc.service.DeviceService;
import dev.orbnoc.support.IntegrationTestBase;
import dev.orbnoc.web.api.ApiException;
import dev.orbnoc.web.api.Dto;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.support.TransactionTemplate;

/** Migrações Flyway, constraints, cascatas e queries customizadas, sempre no PostgreSQL real. */
class PersistenceIT extends IntegrationTestBase {

    @Autowired UserRepository userRepository;
    @Autowired DeviceRepository deviceRepository;
    @Autowired MetricRepository metricRepository;
    @Autowired EventRepository eventRepository;
    @Autowired DeviceService deviceService;
    @Autowired TransactionTemplate tx;

    private long contar(String sql, Object... args) {
        Long n = jdbc.queryForObject(sql, Long.class, args);
        return n == null ? 0 : n;
    }

    private Device dispositivo(User dono, String ip) {
        return deviceService.create(dono.getId(), new Dto.DeviceCreateIn("host " + ip, ip, null, "icmp", null, 30, 3, null));
    }

    private void inserirMetrica(long deviceId, Instant quando) {
        jdbc.update(
                "INSERT INTO metrics (device_id, recorded_at, ok, latency) VALUES (?, ?, true, 10.0)",
                deviceId, Timestamp.from(quando));
    }

    private void inserirEvento(long userId, Long deviceId, Instant quando) {
        jdbc.update(
                "INSERT INTO events (user_id, device_id, kind, severity, message, created_at) "
                        + "VALUES (?, ?, 'offline', 'error', 'teste', ?)",
                userId, deviceId, Timestamp.from(quando));
    }

    // ---- migrações e constraints -----------------------------------------------------------------

    @Test
    void migracoesDoFlywayForamAplicadasComSucesso() {
        assertEquals(0, contar("SELECT count(*) FROM flyway_schema_history WHERE success = false"));
        assertTrue(contar("SELECT count(*) FROM flyway_schema_history WHERE version = '1'") == 1);
    }

    @Test
    void usernameEEmailSaoUnicos() {
        createUser("ana", SENHA, "user");

        ApiException porUsuario =
                assertThrows(ApiException.class, () -> users.create("ana", "outro@example.com", SENHA, "user"));
        assertEquals("Usuário ou email já existe", porUsuario.getMessage());
        assertThrows(ApiException.class, () -> users.create("outra", "ana@example.com", SENHA, "user"));
        assertEquals(1, contar("SELECT count(*) FROM users"));
    }

    @Test
    @Disabled("Lacuna conhecida: uq_users_username diferencia maiúsculas ('Admin' e 'admin' coexistem). "
            + "Ao corrigir (índice único em lower(username)), remova esta anotação.")
    void usernameNaoDiferenciaMaiusculas() {
        createUser("admin", SENHA, "user");

        assertThrows(ApiException.class, () -> users.create("Admin", "outro@example.com", SENHA, "user"));
    }

    @Test
    void bancoRejeitaValoresForaDosDominios() {
        User ana = createUser("ana", SENHA, "user");

        assertThrows(
                DataIntegrityViolationException.class,
                () -> jdbc.update("INSERT INTO devices (user_id, name, ip, status) VALUES (?, 'x', '10.0.0.1', 'bogus')", ana.getId()));
        assertThrows(
                DataIntegrityViolationException.class,
                () -> jdbc.update("INSERT INTO devices (user_id, name, ip, check_type) VALUES (?, 'x', '10.0.0.1', 'http')", ana.getId()));
        assertThrows(
                DataIntegrityViolationException.class,
                () -> jdbc.update("UPDATE users SET role = 'root' WHERE id = ?", ana.getId()));
        assertThrows(
                DataIntegrityViolationException.class,
                () -> jdbc.update("INSERT INTO events (user_id, kind, severity, message) VALUES (?, 'k', 'fatal', 'm')", ana.getId()));
    }

    @Test
    void mesmoHostSoPodeRepetirEntreUsuariosDiferentes() {
        User ana = createUser("ana", SENHA, "user");
        User bruno = createUser("bruno", SENHA, "user");

        dispositivo(ana, "10.0.0.1");
        dispositivo(bruno, "10.0.0.1");

        assertEquals(2, contar("SELECT count(*) FROM devices WHERE ip = '10.0.0.1'"));
        assertThrows(ApiException.class, () -> dispositivo(ana, "10.0.0.1"));
    }

    // ---- cascatas -------------------------------------------------------------------------------------

    @Test
    void removerUsuarioApagaDadosDependentesEAnonimizaOLogDeAcesso() {
        User ana = createUser("ana", SENHA, "user");
        Device d = dispositivo(ana, "10.0.0.1");
        inserirMetrica(d.getId(), Instant.now());
        inserirEvento(ana.getId(), d.getId(), Instant.now());
        jdbc.update("INSERT INTO notification_channels (user_id, kind, enabled) VALUES (?, 'telegram', true)", ana.getId());
        jdbc.update("INSERT INTO access_logs (user_id, action) VALUES (?, 'login')", ana.getId());

        jdbc.update("DELETE FROM users WHERE id = ?", ana.getId());

        assertEquals(0, contar("SELECT count(*) FROM devices"));
        assertEquals(0, contar("SELECT count(*) FROM metrics"));
        assertEquals(0, contar("SELECT count(*) FROM events"));
        assertEquals(0, contar("SELECT count(*) FROM notification_channels"));
        assertEquals(1, contar("SELECT count(*) FROM access_logs"), "o log de auditoria é preservado");
        assertNull(jdbc.queryForObject("SELECT user_id FROM access_logs", Long.class));
    }

    // ---- queries dos repositórios ----------------------------------------------------------------

    @Test
    void findMonitorableIgnoraUsuariosDesativados() {
        User ativo = createUser("ativo", SENHA, "user");
        User inativo = createUser("inativo", SENHA, "user");
        Device doAtivo = dispositivo(ativo, "10.0.0.1");
        dispositivo(inativo, "10.0.0.2");
        jdbc.update("UPDATE users SET is_active = false WHERE id = ?", inativo.getId());

        List<Device> monitoraveis = deviceRepository.findMonitorable();

        assertEquals(List.of(doAtivo.getId()), monitoraveis.stream().map(Device::getId).toList());
    }

    @Test
    void contaApenasAdminsAtivos() {
        createUser("admin1", SENHA, "admin");
        createUser("admin2", SENHA, "admin");
        createUser("comum", SENHA, "user");
        jdbc.update("UPDATE users SET is_active = false WHERE username = 'admin2'");

        assertEquals(1, userRepository.countByRoleAndActiveTrue("admin"));
        assertEquals(1, userRepository.countByRoleAndActiveTrue("user"));
    }

    @Test
    void retencaoRemoveSoMetricasEEventosAntigos() {
        User ana = createUser("ana", SENHA, "user");
        Device d = dispositivo(ana, "10.0.0.1");
        Instant agora = Instant.now();
        inserirMetrica(d.getId(), agora.minus(Duration.ofDays(30)));
        inserirMetrica(d.getId(), agora.minus(Duration.ofDays(1)));
        inserirEvento(ana.getId(), d.getId(), agora.minus(Duration.ofDays(100)));
        inserirEvento(ana.getId(), d.getId(), agora.minus(Duration.ofDays(1)));
        Instant corte = agora.minus(Duration.ofDays(14));

        Integer metricasRemovidas = tx.execute(s -> metricRepository.deleteOlderThan(corte));
        Integer eventosRemovidos = tx.execute(s -> eventRepository.deleteOlderThan(corte));

        assertEquals(1, metricasRemovidas);
        assertEquals(1, eventosRemovidos);
        assertEquals(1, metricRepository.count());
        assertEquals(1, eventRepository.count());
    }

    @Test
    void reconhecerTudoAfetaSoOsEventosDoUsuarioEAindaNaoLidos() {
        User ana = createUser("ana", SENHA, "user");
        User bruno = createUser("bruno", SENHA, "user");
        inserirEvento(ana.getId(), null, Instant.now());
        inserirEvento(ana.getId(), null, Instant.now());
        inserirEvento(bruno.getId(), null, Instant.now());

        Integer reconhecidos = tx.execute(s -> eventRepository.acknowledgeAll(ana.getId(), Instant.now()));

        assertEquals(2, reconhecidos);
        assertEquals(0, eventRepository.countByUserIdAndAcknowledgedAtIsNull(ana.getId()));
        assertEquals(1, eventRepository.countByUserIdAndAcknowledgedAtIsNull(bruno.getId()));
        // Repetir não reconhece de novo o que já foi reconhecido.
        assertEquals(0, tx.execute(s -> eventRepository.acknowledgeAll(ana.getId(), Instant.now())));
    }
}
