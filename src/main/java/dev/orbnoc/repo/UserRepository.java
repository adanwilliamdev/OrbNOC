package dev.orbnoc.repo;

import dev.orbnoc.domain.User;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository {

    private static final String COLUMNS =
            "id, username, email, password_hash, role, is_active, created_at, last_login, "
                    + "token_version, totp_secret_encrypted, totp_enabled";

    private static final RowMapper<User> MAPPER = UserRepository::map;

    private final JdbcTemplate jdbc;

    public UserRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static User map(ResultSet rs, int row) throws SQLException {
        User u = new User();
        u.setId(rs.getLong("id"));
        u.setUsername(rs.getString("username"));
        u.setEmail(rs.getString("email"));
        u.setPasswordHash(rs.getString("password_hash"));
        u.setRole(rs.getString("role"));
        u.setActive(rs.getBoolean("is_active"));
        u.setCreatedAt(Rows.instant(rs, "created_at"));
        u.setLastLogin(Rows.instant(rs, "last_login"));
        u.setTokenVersion(rs.getInt("token_version"));
        u.setTotpSecretEncrypted(rs.getString("totp_secret_encrypted"));
        u.setTotpEnabled(rs.getBoolean("totp_enabled"));
        return u;
    }

    public Optional<User> findById(Long id) {
        return jdbc.query("SELECT " + COLUMNS + " FROM users WHERE id = ?", MAPPER, id).stream().findFirst();
    }

    public Optional<User> findFirstByUsernameOrEmail(String username, String email) {
        return jdbc.query(
                        "SELECT " + COLUMNS + " FROM users WHERE username = ? OR email = ? ORDER BY id LIMIT 1",
                        MAPPER, username, email)
                .stream()
                .findFirst();
    }

    public Optional<User> findByUsername(String username) {
        return jdbc.query("SELECT " + COLUMNS + " FROM users WHERE username = ?", MAPPER, username).stream().findFirst();
    }

    public boolean existsByUsername(String username) {
        return Boolean.TRUE.equals(
                jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM users WHERE username = ?)", Boolean.class, username));
    }

    public long countByRoleAndActiveTrue(String role) {
        Long n = jdbc.queryForObject("SELECT count(*) FROM users WHERE role = ? AND is_active", Long.class, role);
        return n == null ? 0 : n;
    }

    public List<User> findAllByOrderByIdAsc() {
        return jdbc.query("SELECT " + COLUMNS + " FROM users ORDER BY id", MAPPER);
    }

    /** Insere (id nulo) ou atualiza; devolve a própria entidade, com o id gerado. */
    public User save(User u) {
        if (u.getId() == null) {
            Long id = jdbc.queryForObject(
                    "INSERT INTO users (username, email, password_hash, role, is_active, created_at, last_login, "
                            + "token_version, totp_secret_encrypted, totp_enabled) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
                    Long.class,
                    u.getUsername(), u.getEmail(), u.getPasswordHash(), u.getRole(), u.isActive(),
                    Rows.ts(u.getCreatedAt()), Rows.ts(u.getLastLogin()), u.getTokenVersion(),
                    u.getTotpSecretEncrypted(), u.isTotpEnabled());
            u.setId(id);
        } else {
            jdbc.update(
                    "UPDATE users SET username = ?, email = ?, password_hash = ?, role = ?, is_active = ?, "
                            + "created_at = ?, last_login = ?, totp_secret_encrypted = ?, totp_enabled = ? WHERE id = ?",
                    // token_version fica de fora de propósito: só bumpTokenVersion() o altera (atômico)
                    u.getUsername(), u.getEmail(), u.getPasswordHash(), u.getRole(), u.isActive(),
                    Rows.ts(u.getCreatedAt()), Rows.ts(u.getLastLogin()),
                    u.getTotpSecretEncrypted(), u.isTotpEnabled(), u.getId());
        }
        return u;
    }

    /**
     * Incrementa a versão dos tokens de forma atômica (invalida as sessões) e devolve a nova versão.
     * Atômico no banco: duas trocas simultâneas de senha não perdem incremento.
     */
    public int bumpTokenVersion(Long userId) {
        Integer v = jdbc.queryForObject(
                "UPDATE users SET token_version = token_version + 1 WHERE id = ? RETURNING token_version",
                Integer.class, userId);
        return v == null ? 0 : v;
    }

    public User saveAndFlush(User u) {
        return save(u);
    }

    public void delete(User u) {
        jdbc.update("DELETE FROM users WHERE id = ?", u.getId());
    }

    public long count() {
        Long n = jdbc.queryForObject("SELECT count(*) FROM users", Long.class);
        return n == null ? 0 : n;
    }
}
