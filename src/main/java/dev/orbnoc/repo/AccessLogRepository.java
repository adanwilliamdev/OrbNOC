package dev.orbnoc.repo;

import dev.orbnoc.domain.AccessLog;
import java.time.Instant;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AccessLogRepository {

    private final JdbcTemplate jdbc;

    public AccessLogRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public AccessLog save(AccessLog a) {
        Long id = jdbc.queryForObject(
                "INSERT INTO access_logs (user_id, action, ip_address, detail, created_at) VALUES (?, ?, ?, ?, ?) "
                        + "RETURNING id",
                Long.class, a.getUserId(), a.getAction(), a.getIpAddress(), a.getDetail(), Rows.ts(a.getCreatedAt()));
        a.setId(id);
        return a;
    }

    public int deleteOlderThan(Instant cutoff) {
        return Rows.deleteInBatches(
                jdbc,
                "DELETE FROM access_logs WHERE id IN (SELECT id FROM access_logs WHERE created_at < ? ORDER BY id LIMIT ?)",
                Rows.ts(cutoff));
    }
}
