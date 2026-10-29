package dev.orbnoc.repo;

import dev.orbnoc.domain.Metric;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class MetricRepository {

    private static final String COLUMNS = "id, device_id, recorded_at, ok, latency, jitter, packet_loss";

    private static final RowMapper<Metric> MAPPER = MetricRepository::map;

    private final JdbcTemplate jdbc;

    public MetricRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static Metric map(ResultSet rs, int row) throws SQLException {
        Metric m = new Metric();
        m.setId(rs.getLong("id"));
        m.setDeviceId(rs.getLong("device_id"));
        m.setRecordedAt(Rows.instant(rs, "recorded_at"));
        m.setOk(rs.getBoolean("ok"));
        m.setLatency(Rows.doubleOrNull(rs, "latency"));
        m.setJitter(Rows.doubleOrNull(rs, "jitter"));
        m.setPacketLoss(Rows.doubleOrNull(rs, "packet_loss"));
        return m;
    }

    /** Amostras mais recentes primeiro, no máximo {@code limit}. */
    public List<Metric> findByDeviceIdOrderByRecordedAtDesc(Long deviceId, int limit) {
        return jdbc.query(
                "SELECT " + COLUMNS + " FROM metrics WHERE device_id = ? ORDER BY recorded_at DESC, id DESC LIMIT ?",
                MAPPER, deviceId, limit);
    }

    public List<Metric> findByDeviceIdAndRecordedAtGreaterThanEqualOrderByRecordedAtAsc(
            Long deviceId, Instant since, int limit) {
        return jdbc.query(
                "SELECT " + COLUMNS + " FROM metrics WHERE device_id = ? AND recorded_at >= ? "
                        + "ORDER BY recorded_at ASC, id ASC LIMIT ?",
                MAPPER, deviceId, Rows.ts(since), limit);
    }

    public Metric save(Metric m) {
        Long id = jdbc.queryForObject(
                "INSERT INTO metrics (device_id, recorded_at, ok, latency, jitter, packet_loss) "
                        + "VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
                Long.class, m.getDeviceId(), Rows.ts(m.getRecordedAt()), m.isOk(), m.getLatency(), m.getJitter(),
                m.getPacketLoss());
        m.setId(id);
        return m;
    }

    public long count() {
        Long n = jdbc.queryForObject("SELECT count(*) FROM metrics", Long.class);
        return n == null ? 0 : n;
    }

    public int deleteOlderThan(Instant cutoff) {
        return jdbc.update("DELETE FROM metrics WHERE recorded_at < ?", Rows.ts(cutoff));
    }
}
