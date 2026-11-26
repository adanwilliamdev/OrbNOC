package dev.orbnoc.repo;

import dev.orbnoc.domain.Device;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class DeviceRepository {

    private static final String COLUMNS = "d.id, d.user_id, d.name, d.ip, d.location, d.check_type, d.port, "
            + "d.interval_seconds, d.failure_threshold, d.sla_threshold_ms, d.status, d.consecutive_failures, "
            + "d.sla_breached, d.latency, d.avg_latency, d.min_latency, d.max_latency, d.jitter, d.packet_loss, "
            + "d.last_error, d.last_check, d.last_status_change, d.created_at, d.parent_id, d.maintenance_until";

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
        d.setParentId(Rows.longOrNull(rs, "parent_id"));
        d.setMaintenanceUntil(Rows.instant(rs, "maintenance_until"));
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

    /** Dados mínimos para sondar um dispositivo; {@code ownerAdmin} define a política de alvos. */
    public record DueTarget(Long id, String ip, String checkType, Integer port, boolean ownerAdmin) {}

    /**
     * Dispositivos vencidos de usuários ativos (os de usuários desativados deixam de ser monitorados).
     * O filtro de vencimento roda no SQL: vence quando passou {@code intervalo - tick/2} desde a
     * última checagem (ou nunca foi checado). Só as colunas necessárias para sondar são lidas.
     */
    public List<DueTarget> findDue(Instant now, double tickSeconds) {
        return jdbc.query(
                "SELECT d.id, d.ip, d.check_type, d.port, (u.role = 'admin') AS owner_admin "
                        + "FROM devices d JOIN users u ON u.id = d.user_id "
                        + "WHERE u.is_active AND (d.last_check IS NULL "
                        + "OR d.last_check <= ?::timestamptz - make_interval(secs => d.interval_seconds - ?)) "
                        + "ORDER BY d.id",
                (rs, i) -> new DueTarget(
                        rs.getLong("id"), rs.getString("ip"), rs.getString("check_type"),
                        Rows.intOrNull(rs, "port"), rs.getBoolean("owner_admin")),
                Rows.ts(now), tickSeconds / 2);
    }

    /** Atualiza o estado de vários dispositivos de uma vez (um único round-trip em lote). */
    public void updateStateBatch(List<Device> list) {
        if (list.isEmpty()) return;
        jdbc.batchUpdate(
                "UPDATE devices SET status = ?, consecutive_failures = ?, sla_breached = ?, latency = ?, "
                        + "avg_latency = ?, min_latency = ?, max_latency = ?, jitter = ?, packet_loss = ?, "
                        + "last_error = ?, last_check = ?, last_status_change = ? WHERE id = ?",
                new org.springframework.jdbc.core.BatchPreparedStatementSetter() {
                    @Override
                    public void setValues(java.sql.PreparedStatement ps, int i) throws SQLException {
                        Device d = list.get(i);
                        ps.setString(1, d.getStatus());
                        ps.setInt(2, d.getConsecutiveFailures());
                        ps.setBoolean(3, d.isSlaBreached());
                        put(ps, 4, d.getLatency());
                        put(ps, 5, d.getAvgLatency());
                        put(ps, 6, d.getMinLatency());
                        put(ps, 7, d.getMaxLatency());
                        put(ps, 8, d.getJitter());
                        put(ps, 9, d.getPacketLoss());
                        ps.setString(10, d.getLastError());
                        put(ps, 11, Rows.ts(d.getLastCheck()));
                        put(ps, 12, Rows.ts(d.getLastStatusChange()));
                        ps.setLong(13, d.getId());
                    }

                    @Override
                    public int getBatchSize() {
                        return list.size();
                    }
                });
    }

    /** Define um parâmetro que pode ser nulo (o tipo SQL é deduzido do valor). */
    private static void put(java.sql.PreparedStatement ps, int index, Object value) throws SQLException {
        org.springframework.jdbc.core.StatementCreatorUtils.setParameterValue(
                ps, index, org.springframework.jdbc.core.SqlTypeValue.TYPE_UNKNOWN, value);
    }

    public long countByUserId(Long userId) {
        Long n = jdbc.queryForObject("SELECT count(*) FROM devices WHERE user_id = ?", Long.class, userId);
        return n == null ? 0 : n;
    }

    /** O dispositivo ou algum ancestral (via parent_id, até 16 níveis) está offline? Exclui o próprio id. */
    public boolean hasOfflineAncestor(Long deviceId) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "WITH RECURSIVE chain(id, parent_id, depth) AS ("
                        + " SELECT p.id, p.parent_id, 1 FROM devices c JOIN devices p ON p.id = c.parent_id WHERE c.id = ?"
                        + " UNION ALL"
                        + " SELECT p.id, p.parent_id, chain.depth + 1 FROM chain JOIN devices p ON p.id = chain.parent_id"
                        + " WHERE chain.depth < 16)"
                        + " SELECT EXISTS (SELECT 1 FROM chain JOIN devices a ON a.id = chain.id WHERE a.status = 'offline')",
                Boolean.class, deviceId));
    }

    /** {@code candidateParent} é o próprio dispositivo ou um descendente dele? (evita ciclos na topologia) */
    public boolean createsCycle(Long deviceId, Long candidateParent) {
        if (candidateParent == null) return false;
        if (candidateParent.equals(deviceId)) return true;
        // Sobe a árvore a partir do pai candidato: se passar pelo próprio dispositivo, haveria ciclo.
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "WITH RECURSIVE chain(id, depth) AS ("
                        + " SELECT CAST(? AS BIGINT), 1"
                        + " UNION ALL"
                        + " SELECT d.parent_id, chain.depth + 1 FROM chain JOIN devices d ON d.id = chain.id"
                        + " WHERE d.parent_id IS NOT NULL AND chain.depth < 64)"
                        + " SELECT EXISTS (SELECT 1 FROM chain WHERE id = ?)",
                Boolean.class, candidateParent, deviceId));
    }

    /** Insere (id nulo) ou atualiza todas as colunas; devolve a própria entidade, com o id gerado. */
    public Device save(Device d) {
        if (d.getId() == null) {
            Long id = jdbc.queryForObject(
                    "INSERT INTO devices (user_id, name, ip, location, check_type, port, interval_seconds, "
                            + "failure_threshold, sla_threshold_ms, status, consecutive_failures, sla_breached, "
                            + "latency, avg_latency, min_latency, max_latency, jitter, packet_loss, last_error, "
                            + "last_check, last_status_change, created_at, parent_id, maintenance_until) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
                    Long.class,
                    d.getUserId(), d.getName(), d.getIp(), d.getLocation(), d.getCheckType(), d.getPort(),
                    d.getIntervalSeconds(), d.getFailureThreshold(), d.getSlaThresholdMs(), d.getStatus(),
                    d.getConsecutiveFailures(), d.isSlaBreached(), d.getLatency(), d.getAvgLatency(),
                    d.getMinLatency(), d.getMaxLatency(), d.getJitter(), d.getPacketLoss(), d.getLastError(),
                    Rows.ts(d.getLastCheck()), Rows.ts(d.getLastStatusChange()), Rows.ts(d.getCreatedAt()),
                    d.getParentId(), Rows.ts(d.getMaintenanceUntil()));
            d.setId(id);
        } else {
            jdbc.update(
                    "UPDATE devices SET name = ?, ip = ?, location = ?, check_type = ?, port = ?, "
                            + "interval_seconds = ?, failure_threshold = ?, sla_threshold_ms = ?, status = ?, "
                            + "consecutive_failures = ?, sla_breached = ?, latency = ?, avg_latency = ?, "
                            + "min_latency = ?, max_latency = ?, jitter = ?, packet_loss = ?, last_error = ?, "
                            + "last_check = ?, last_status_change = ?, parent_id = ?, maintenance_until = ? WHERE id = ?",
                    d.getName(), d.getIp(), d.getLocation(), d.getCheckType(), d.getPort(), d.getIntervalSeconds(),
                    d.getFailureThreshold(), d.getSlaThresholdMs(), d.getStatus(), d.getConsecutiveFailures(),
                    d.isSlaBreached(), d.getLatency(), d.getAvgLatency(), d.getMinLatency(), d.getMaxLatency(),
                    d.getJitter(), d.getPacketLoss(), d.getLastError(), Rows.ts(d.getLastCheck()),
                    Rows.ts(d.getLastStatusChange()), d.getParentId(), Rows.ts(d.getMaintenanceUntil()), d.getId());
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

    /** Quantidade de dispositivos por status (online, offline, unknown); usado nas métricas. */
    public Map<String, Long> countByStatus() {
        Map<String, Long> counts = new LinkedHashMap<>();
        jdbc.query(
                "SELECT status, count(*) AS total FROM devices GROUP BY status",
                (RowCallbackHandler) rs -> counts.put(rs.getString("status"), rs.getLong("total")));
        return counts;
    }

    public long count() {
        Long n = jdbc.queryForObject("SELECT count(*) FROM devices", Long.class);
        return n == null ? 0 : n;
    }
}
