package dev.orbnoc.repo;

import dev.orbnoc.domain.Metric;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
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

    /** Insere várias amostras em lote (um round-trip por lote em vez de um por amostra). */
    public void saveAll(List<Metric> list) {
        if (list.isEmpty()) return;
        jdbc.batchUpdate(
                "INSERT INTO metrics (device_id, recorded_at, ok, latency, jitter, packet_loss) VALUES (?, ?, ?, ?, ?, ?)",
                new org.springframework.jdbc.core.BatchPreparedStatementSetter() {
                    @Override
                    public void setValues(java.sql.PreparedStatement ps, int i) throws SQLException {
                        Metric m = list.get(i);
                        ps.setLong(1, m.getDeviceId());
                        ps.setObject(2, Rows.ts(m.getRecordedAt()));
                        ps.setBoolean(3, m.isOk());
                        put(ps, 4, m.getLatency());
                        put(ps, 5, m.getJitter());
                        put(ps, 6, m.getPacketLoss());
                    }

                    @Override
                    public int getBatchSize() {
                        return list.size();
                    }
                });
    }

    private static void put(java.sql.PreparedStatement ps, int index, Object value) throws SQLException {
        org.springframework.jdbc.core.StatementCreatorUtils.setParameterValue(
                ps, index, org.springframework.jdbc.core.SqlTypeValue.TYPE_UNKNOWN, value);
    }

    /**
     * Últimas {@code limit} amostras de cada dispositivo numa única consulta (LATERAL usa o índice
     * (device_id, recorded_at)). Latência por amostra, em ordem cronológica; {@code null} = falha.
     */
    public Map<Long, List<Double>> recentSamples(Collection<Long> deviceIds, int limit) {
        Map<Long, List<Double>> out = new HashMap<>();
        if (deviceIds.isEmpty()) return out;
        Long[] ids = deviceIds.toArray(new Long[0]);
        jdbc.query(
                (org.springframework.jdbc.core.PreparedStatementCreator) con -> {
                    java.sql.PreparedStatement ps = con.prepareStatement(
                            "SELECT t.id AS device_id, m.ok, m.latency FROM unnest(?) AS t(id) "
                                    + "CROSS JOIN LATERAL (SELECT ok, latency FROM metrics WHERE device_id = t.id "
                                    + "ORDER BY recorded_at DESC, id DESC LIMIT ?) m");
                    ps.setArray(1, con.createArrayOf("bigint", ids));
                    ps.setInt(2, limit);
                    return ps;
                },
                (RowCallbackHandler) rs -> {
                    Double latency = Rows.doubleOrNull(rs, "latency");
                    out.computeIfAbsent(rs.getLong("device_id"), k -> new ArrayList<>())
                            .add(rs.getBoolean("ok") && latency != null ? latency : null);
                });
        // As linhas vêm da mais recente para a mais antiga; o chamador quer ordem cronológica.
        out.values().forEach(Collections::reverse);
        return out;
    }

    public long count() {
        Long n = jdbc.queryForObject("SELECT count(*) FROM metrics", Long.class);
        return n == null ? 0 : n;
    }

    /** Remove em lotes de {@link Rows#RETENTION_BATCH} linhas, para não segurar locks nem inflar o WAL. */
    public int deleteOlderThan(Instant cutoff) {
        return Rows.deleteInBatches(
                jdbc,
                "DELETE FROM metrics WHERE id IN (SELECT id FROM metrics WHERE recorded_at < ? ORDER BY id LIMIT ?)",
                Rows.ts(cutoff));
    }
}
