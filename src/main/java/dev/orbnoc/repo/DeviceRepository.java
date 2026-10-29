package dev.orbnoc.repo;

import dev.orbnoc.domain.Device;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class DeviceRepository {

    private static final String COLUMNS = "d.id, d.user_id, d.name, d.ip, d.location, d.check_type, d.port, "
            + "d.interval_seconds, d.failure_threshold, d.sla_threshold_ms, d.status, d.consecutive_failures, "
            + "d.sla_breached, d.latency, d.avg_latency, d.min_latency, d.max_latency, d.jitter, d.packet_loss, "
            + "d.last_error, d.last_check, d.last_status_change, d.created_at";

    private static final RowMapper<Device> MAPPER = DeviceRepository::map;

    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate named;

    public DeviceRepository(JdbcTemplate jdbc, NamedParameterJdbcTemplate named) {
        this.jdbc = jdbc;
        this.named = named;
    }

    private static Device map(ResultSet rs, int row) throws SQLException {
        Device d = new Device();
        d.setId(rs.getLong("id"));
        d.setUserId(rs.getLong("user_id"));
        d.setName(rs.getString("name"));
        d.setIp(rs.getString("ip"));
        d.setLocation(rs.getString("location"));
        d.setCheckType(rs.getString("check_type"));
        d.setPort(Rows.intOrNull(rs, "port"));
        d.setIntervalSeconds(rs.getInt("interval_seconds"));
        d.setFailureThreshold(rs.getInt("failure_threshold"));
        d.setSlaThresholdMs(Rows.intOrNull(rs, "sla_threshold_ms"));
        d.setStatus(rs.getString("status"));
        d.setConsecutiveFailures(rs.getInt("consecutive_failures"));
        d.setSlaBreached(rs.getBoolean("sla_breached"));
        d.setLatency(Rows.doubleOrNull(rs, "latency"));
        d.setAvgLatency(Rows.doubleOrNull(rs, "avg_latency"));
        d.setMinLatency(Rows.doubleOrNull(rs, "min_latency"));
        d.setMaxLatency(Rows.doubleOrNull(rs, "max_latency"));
        d.setJitter(Rows.doubleOrNull(rs, "jitter"));
        d.setPacketLoss(Rows.doubleOrNull(rs, "packet_loss"));
        d.setLastError(rs.getString("last_error"));
        d.setLastCheck(Rows.instant(rs, "last_check"));
        d.setLastStatusChange(Rows.instant(rs, "last_status_change"));
        d.setCreatedAt(Rows.instant(rs, "created_at"));
        return d;
    }

    public Optional<Device> findById(Long id) {
        return jdbc.query("SELECT " + COLUMNS + " FROM devices d WHERE d.id = ?", MAPPER, id).stream().findFirst();
    }

    public List<Device> findByUserIdOrderByIdAsc(Long userId) {
        return jdbc.query("SELECT " + COLUMNS + " FROM devices d WHERE d.user_id = ? ORDER BY d.id", MAPPER, userId);
    }

    public Optional<Device> findByIdAndUserId(Long id, Long userId) {
        return jdbc.query("SELECT " + COLUMNS + " FROM devices d WHERE d.id = ? AND d.user_id = ?", MAPPER, id, userId)
                .stream()
                .findFirst();
    }

    public List<Device> findByIdInOrderByIdAsc(Collection<Long> ids) {
        if (ids.isEmpty()) return List.of();
        return named.query(
                "SELECT " + COLUMNS + " FROM devices d WHERE d.id IN (:ids) ORDER BY d.id",
                new MapSqlParameterSource("ids", ids), MAPPER);
    }

    /** Dispositivos de usuários ativos (os de usuários desativados deixam de ser monitorados). */
    public List<Device> findMonitorable() {
        return jdbc.query(
                "SELECT " + COLUMNS + " FROM devices d JOIN users u ON u.id = d.user_id WHERE u.is_active ORDER BY d.id",
                MAPPER);
    }

    /** Insere (id nulo) ou atualiza todas as colunas; devolve a própria entidade, com o id gerado. */
    public Device save(Device d) {
        if (d.getId() == null) {
            Long id = jdbc.queryForObject(
                    "INSERT INTO devices (user_id, name, ip, location, check_type, port, interval_seconds, "
                            + "failure_threshold, sla_threshold_ms, status, consecutive_failures, sla_breached, "
                            + "latency, avg_latency, min_latency, max_latency, jitter, packet_loss, last_error, "
                            + "last_check, last_status_change, created_at) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
                    Long.class,
                    d.getUserId(), d.getName(), d.getIp(), d.getLocation(), d.getCheckType(), d.getPort(),
                    d.getIntervalSeconds(), d.getFailureThreshold(), d.getSlaThresholdMs(), d.getStatus(),
                    d.getConsecutiveFailures(), d.isSlaBreached(), d.getLatency(), d.getAvgLatency(),
                    d.getMinLatency(), d.getMaxLatency(), d.getJitter(), d.getPacketLoss(), d.getLastError(),
                    Rows.ts(d.getLastCheck()), Rows.ts(d.getLastStatusChange()), Rows.ts(d.getCreatedAt()));
            d.setId(id);
        } else {
            jdbc.update(
                    "UPDATE devices SET name = ?, ip = ?, location = ?, check_type = ?, port = ?, "
                            + "interval_seconds = ?, failure_threshold = ?, sla_threshold_ms = ?, status = ?, "
                            + "consecutive_failures = ?, sla_breached = ?, latency = ?, avg_latency = ?, "
                            + "min_latency = ?, max_latency = ?, jitter = ?, packet_loss = ?, last_error = ?, "
                            + "last_check = ?, last_status_change = ? WHERE id = ?",
                    d.getName(), d.getIp(), d.getLocation(), d.getCheckType(), d.getPort(), d.getIntervalSeconds(),
                    d.getFailureThreshold(), d.getSlaThresholdMs(), d.getStatus(), d.getConsecutiveFailures(),
                    d.isSlaBreached(), d.getLatency(), d.getAvgLatency(), d.getMinLatency(), d.getMaxLatency(),
                    d.getJitter(), d.getPacketLoss(), d.getLastError(), Rows.ts(d.getLastCheck()),
                    Rows.ts(d.getLastStatusChange()), d.getId());
        }
        return d;
    }

    public Device saveAndFlush(Device d) {
        return save(d);
    }

    /** Métricas saem em cascata; eventos ficam sem vínculo (ON DELETE SET NULL). */
    public void delete(Device d) {
        jdbc.update("DELETE FROM devices WHERE id = ?", d.getId());
    }

    public boolean existsByUserIdAndIp(Long userId, String ip) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM devices WHERE user_id = ? AND ip = ?)", Boolean.class, userId, ip));
    }

    public long count() {
        Long n = jdbc.queryForObject("SELECT count(*) FROM devices", Long.class);
        return n == null ? 0 : n;
    }
}
