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
}
