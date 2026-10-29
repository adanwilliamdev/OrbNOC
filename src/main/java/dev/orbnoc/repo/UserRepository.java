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
            "id, username, email, password_hash, role, is_active, created_at, last_login";

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
                    "INSERT INTO users (username, email, password_hash, role, is_active, created_at, last_login) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id",
                    Long.class,
                    u.getUsername(), u.getEmail(), u.getPasswordHash(), u.getRole(), u.isActive(),
                    Rows.ts(u.getCreatedAt()), Rows.ts(u.getLastLogin()));
            u.setId(id);
        } else {
            jdbc.update(
                    "UPDATE users SET username = ?, email = ?, password_hash = ?, role = ?, is_active = ?, "
                            + "created_at = ?, last_login = ? WHERE id = ?",
                    u.getUsername(), u.getEmail(), u.getPasswordHash(), u.getRole(), u.isActive(),
                    Rows.ts(u.getCreatedAt()), Rows.ts(u.getLastLogin()), u.getId());
        }
        return u;
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
