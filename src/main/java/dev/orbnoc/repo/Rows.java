package dev.orbnoc.repo;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/** Conversões JDBC compartilhadas pelos repositórios (colunas anuláveis e TIMESTAMPTZ ↔ Instant). */
final class Rows {

    private Rows() {}

    static Instant instant(ResultSet rs, String column) throws SQLException {
        OffsetDateTime value = rs.getObject(column, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }

    static OffsetDateTime ts(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }

    static Long longOrNull(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, Long.class);
    }

    static Integer intOrNull(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, Integer.class);
    }

    static Double doubleOrNull(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, Double.class);
    }

    /** Tamanho do lote nas remoções de retenção. */
    static final int RETENTION_BATCH = 5_000;

    /**
     * Executa um DELETE com {@code LIMIT ?} (o último parâmetro) repetidamente, até um lote sair
     * incompleto. Devolve o total removido.
     */
    static int deleteInBatches(org.springframework.jdbc.core.JdbcTemplate jdbc, String sql, Object cutoff) {
        int total = 0;
        int removed;
        do {
            removed = jdbc.update(sql, cutoff, RETENTION_BATCH);
            total += removed;
        } while (removed >= RETENTION_BATCH);
        return total;
    }
}
