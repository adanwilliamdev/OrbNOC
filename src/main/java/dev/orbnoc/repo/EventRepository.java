package dev.orbnoc.repo;

import dev.orbnoc.domain.Event;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class EventRepository {

    private static final String COLUMNS =
            "id, user_id, device_id, kind, severity, message, created_at, acknowledged_at";

    private static final RowMapper<Event> MAPPER = EventRepository::map;

    private final JdbcTemplate jdbc;

    public EventRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static Event map(ResultSet rs, int row) throws SQLException {
        Event e = new Event();
        e.setId(rs.getLong("id"));
        e.setUserId(rs.getLong("user_id"));
        e.setDeviceId(Rows.longOrNull(rs, "device_id"));
        e.setKind(rs.getString("kind"));
        e.setSeverity(rs.getString("severity"));
        e.setMessage(rs.getString("message"));
        e.setCreatedAt(Rows.instant(rs, "created_at"));
        e.setAcknowledgedAt(Rows.instant(rs, "acknowledged_at"));
        return e;
    }

    public List<Event> findByUserIdOrderByCreatedAtDescIdDesc(Long userId, int limit) {
        return jdbc.query(
                "SELECT " + COLUMNS + " FROM events WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
                MAPPER, userId, limit);
    }

    public List<Event> findByUserIdAndAcknowledgedAtIsNullOrderByCreatedAtDescIdDesc(Long userId, int limit) {
        return jdbc.query(
                "SELECT " + COLUMNS + " FROM events WHERE user_id = ? AND acknowledged_at IS NULL "
                        + "ORDER BY created_at DESC, id DESC LIMIT ?",
                MAPPER, userId, limit);
    }

    public Optional<Event> findByIdAndUserId(Long id, Long userId) {
        return jdbc.query("SELECT " + COLUMNS + " FROM events WHERE id = ? AND user_id = ?", MAPPER, id, userId)
                .stream()
                .findFirst();
    }

    public long countByUserIdAndAcknowledgedAtIsNull(Long userId) {
        Long n = jdbc.queryForObject(
                "SELECT count(*) FROM events WHERE user_id = ? AND acknowledged_at IS NULL", Long.class, userId);
        return n == null ? 0 : n;
    }

    public long count() {
        Long n = jdbc.queryForObject("SELECT count(*) FROM events", Long.class);
        return n == null ? 0 : n;
    }

    public Event save(Event e) {
        if (e.getId() == null) {
            Long id = jdbc.queryForObject(
                    "INSERT INTO events (user_id, device_id, kind, severity, message, created_at, acknowledged_at) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id",
                    Long.class, e.getUserId(), e.getDeviceId(), e.getKind(), e.getSeverity(), e.getMessage(),
                    Rows.ts(e.getCreatedAt()), Rows.ts(e.getAcknowledgedAt()));
            e.setId(id);
        } else {
            jdbc.update(
                    "UPDATE events SET device_id = ?, kind = ?, severity = ?, message = ?, acknowledged_at = ? "
                            + "WHERE id = ?",
                    e.getDeviceId(), e.getKind(), e.getSeverity(), e.getMessage(), Rows.ts(e.getAcknowledgedAt()),
                    e.getId());
        }
        return e;
    }

    public int acknowledgeAll(Long userId, Instant now) {
        return jdbc.update(
                "UPDATE events SET acknowledged_at = ? WHERE user_id = ? AND acknowledged_at IS NULL",
                Rows.ts(now), userId);
    }

    public int deleteOlderThan(Instant cutoff) {
        return jdbc.update("DELETE FROM events WHERE created_at < ?", Rows.ts(cutoff));
    }
}
