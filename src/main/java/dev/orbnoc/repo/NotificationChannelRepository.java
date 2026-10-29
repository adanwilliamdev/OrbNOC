package dev.orbnoc.repo;

import dev.orbnoc.domain.NotificationChannel;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class NotificationChannelRepository {

    private static final RowMapper<NotificationChannel> MAPPER = NotificationChannelRepository::map;

    private final JdbcTemplate jdbc;

    public NotificationChannelRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static NotificationChannel map(ResultSet rs, int row) throws SQLException {
        NotificationChannel c = new NotificationChannel();
        c.setId(rs.getLong("id"));
        c.setUserId(rs.getLong("user_id"));
        c.setKind(rs.getString("kind"));
        c.setEnabled(rs.getBoolean("enabled"));
        c.setSecretEncrypted(rs.getString("secret_encrypted"));
        c.setTarget(rs.getString("target"));
        c.setUpdatedAt(Rows.instant(rs, "updated_at"));
        return c;
    }

    public Optional<NotificationChannel> findByUserIdAndKind(Long userId, String kind) {
        return jdbc.query(
                        "SELECT id, user_id, kind, enabled, secret_encrypted, target, updated_at "
                                + "FROM notification_channels WHERE user_id = ? AND kind = ?",
                        MAPPER, userId, kind)
                .stream()
                .findFirst();
    }

    public NotificationChannel save(NotificationChannel c) {
        if (c.getId() == null) {
            Long id = jdbc.queryForObject(
                    "INSERT INTO notification_channels (user_id, kind, enabled, secret_encrypted, target, updated_at) "
                            + "VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
                    Long.class, c.getUserId(), c.getKind(), c.isEnabled(), c.getSecretEncrypted(), c.getTarget(),
                    Rows.ts(c.getUpdatedAt()));
            c.setId(id);
        } else {
            jdbc.update(
                    "UPDATE notification_channels SET enabled = ?, secret_encrypted = ?, target = ?, updated_at = ? "
                            + "WHERE id = ?",
                    c.isEnabled(), c.getSecretEncrypted(), c.getTarget(), Rows.ts(c.getUpdatedAt()), c.getId());
        }
        return c;
    }

    public void delete(NotificationChannel c) {
        jdbc.update("DELETE FROM notification_channels WHERE id = ?", c.getId());
    }
}
