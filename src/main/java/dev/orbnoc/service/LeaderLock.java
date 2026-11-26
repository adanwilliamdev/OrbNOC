package dev.orbnoc.service;

import dev.orbnoc.config.OrbNocProperties;
import jakarta.annotation.PreDestroy;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Eleição de líder entre réplicas via {@code pg_try_advisory_lock}: só quem segura o lock executa
 * o monitor, então duas réplicas não duplicam sondas nem eventos. O lock é da sessão do banco: se
 * a réplica morrer, a conexão cai e outra assume na próxima tentativa.
 */
@Component
public class LeaderLock {

    private static final Logger log = LoggerFactory.getLogger(LeaderLock.class);
    /** "ORBNOC" em ASCII hexadecimal: chave estável do advisory lock. */
    private static final long LOCK_KEY = 0x4F52424E4F43L;

    private final DataSource dataSource;
    private final boolean enabled;
    private Connection connection;

    public LeaderLock(DataSource dataSource, OrbNocProperties props) {
        this.dataSource = dataSource;
        this.enabled = props.leaderLockEnabled();
    }

    /** {@code true} se esta instância é (ou acabou de se tornar) a líder. Chamada a cada tick. */
    public synchronized boolean isLeader() {
        if (!enabled) return true;
        try {
            if (connection != null && !connection.isClosed() && connection.isValid(2)) return true;
            closeQuietly();
            Connection c = dataSource.getConnection();
            try (PreparedStatement ps = c.prepareStatement("SELECT pg_try_advisory_lock(?)")) {
                ps.setLong(1, LOCK_KEY);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next() && rs.getBoolean(1)) {
                        connection = c;
                        log.info("Esta instância assumiu a liderança do monitor");
                        return true;
                    }
                }
            }
            c.close();
            return false;
        } catch (SQLException e) {
            log.warn("Falha ao obter o lock de liderança: {}", e.getMessage());
            closeQuietly();
            return false;
        }
    }

    @PreDestroy
    synchronized void release() {
        closeQuietly();
    }

    private void closeQuietly() {
        if (connection == null) return;
        try {
            // A conexão volta ao pool (a sessão continua viva), então o lock precisa ser solto de forma explícita.
            if (!connection.isClosed() && connection.isValid(1)) {
                try (PreparedStatement ps = connection.prepareStatement("SELECT pg_advisory_unlock(?)")) {
                    ps.setLong(1, LOCK_KEY);
                    ps.execute();
                }
            }
        } catch (SQLException ignored) {
            // sessão já caiu: o lock foi liberado junto
        }
        try {
            connection.close();
        } catch (SQLException ignored) {
            // já fechada
        }
        connection = null;
    }
}
