package dev.orbnoc.repo;

import dev.orbnoc.domain.MetricHourly;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class MetricHourlyRepository {

    private static final RowMapper<MetricHourly> MAPPER = MetricHourlyRepository::map;

    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate named;

    public MetricHourlyRepository(JdbcTemplate jdbc, NamedParameterJdbcTemplate named) {
        this.jdbc = jdbc;
        this.named = named;
    }

    private static MetricHourly map(ResultSet rs, int row) throws SQLException {
        MetricHourly h = new MetricHourly();
        h.setDeviceId(rs.getLong("device_id"));
        h.setHourStart(Rows.instant(rs, "hour"));
        h.setSamples(rs.getInt("samples"));
        h.setOkSamples(rs.getInt("ok_samples"));
        h.setAvgLatency(Rows.doubleOrNull(rs, "avg_latency"));
        h.setMinLatency(Rows.doubleOrNull(rs, "min_latency"));
        h.setMaxLatency(Rows.doubleOrNull(rs, "max_latency"));
        return h;
    }

    public List<MetricHourly> findByDeviceIdAndHourStartGreaterThanEqualOrderByHourStartAsc(Long deviceId, Instant since) {
        return jdbc.query(
                "SELECT device_id, hour, samples, ok_samples, avg_latency, min_latency, max_latency "
                        + "FROM metrics_hourly WHERE device_id = ? AND hour >= ? ORDER BY hour ASC",
                MAPPER, deviceId, Rows.ts(since));
    }

    /** Linhas: deviceId, soma de amostras, soma de amostras ok, soma de (latência média × ok). */
    public List<Object[]> aggregateByDevice(Collection<Long> ids, Instant since) {
        if (ids.isEmpty()) return List.of();
        return named.query(
                "SELECT device_id, sum(samples), sum(ok_samples), sum(avg_latency * ok_samples) "
                        + "FROM metrics_hourly WHERE device_id IN (:ids) AND hour >= :since GROUP BY device_id",
                new MapSqlParameterSource("ids", ids).addValue("since", Rows.ts(since)),
                (rs, i) -> new Object[] {rs.getLong(1), rs.getLong(2), rs.getLong(3), rs.getObject(4, Double.class)});
    }

    /** Linhas: hora, online, offline, amostras, amostras ok, soma de (latência média × ok). */
    public List<Object[]> uptimeSeries(Long userId, Instant since) {
        return jdbc.query(
                "SELECT m.hour, "
                        + "sum(CASE WHEN m.ok_samples > 0 THEN 1 ELSE 0 END), "
                        + "sum(CASE WHEN m.ok_samples = 0 THEN 1 ELSE 0 END), "
                        + "sum(m.samples), sum(m.ok_samples), sum(m.avg_latency * m.ok_samples) "
                        + "FROM metrics_hourly m JOIN devices d ON d.id = m.device_id "
                        + "WHERE d.user_id = ? AND m.hour >= ? GROUP BY m.hour ORDER BY m.hour",
                (rs, i) -> new Object[] {
                    Rows.instant(rs, "hour"),
                    rs.getLong(2), rs.getLong(3), rs.getLong(4), rs.getLong(5), rs.getObject(6, Double.class)
                },
                userId, Rows.ts(since));
    }

    public int deleteOlderThan(Instant cutoff) {
        return jdbc.update("DELETE FROM metrics_hourly WHERE hour < ?", Rows.ts(cutoff));
    }
}
