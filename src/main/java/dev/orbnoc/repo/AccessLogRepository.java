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
                "INSERT INTO access_logs (user_id, action, ip_address, created_at) VALUES (?, ?, ?, ?) RETURNING id",
                Long.class, a.getUserId(), a.getAction(), a.getIpAddress(), Rows.ts(a.getCreatedAt()));
        a.setId(id);
        return a;
    }

    public int deleteOlderThan(Instant cutoff) {
        return jdbc.update("DELETE FROM access_logs WHERE created_at < ?", Rows.ts(cutoff));
    }
}
