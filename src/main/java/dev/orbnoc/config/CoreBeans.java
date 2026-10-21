package dev.orbnoc.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import dev.orbnoc.core.DatabaseConnection;
import dev.orbnoc.core.DiagnosticsService;
import dev.orbnoc.core.Prober;
import dev.orbnoc.core.RateLimiter;
import dev.orbnoc.core.SecretBox;
import dev.orbnoc.core.TokenService;
import javax.sql.DataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/** Liga as classes de núcleo (Java puro) ao contêiner do Spring. */
@Configuration
public class CoreBeans {

    @Bean
    DataSource dataSource(OrbNocProperties props) {
        DatabaseConnection db = DatabaseConnection.parse(
                props.databaseUrl(), props.databaseUser(), props.databasePassword(), props.databaseSsl());
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(db.jdbcUrl());
        if (db.username() != null) config.setUsername(db.username());
        if (db.password() != null) config.setPassword(db.password());
        config.setMaximumPoolSize(10);
        config.setPoolName("orbnoc");
        config.addDataSourceProperty("options", "-c timezone=UTC");
        return new HikariDataSource(config);
    }

    @Bean
    Prober prober(OrbNocProperties props) {
        return new Prober(props.probeTimeoutSeconds());
    }

    @Bean
    DiagnosticsService diagnosticsService(Prober prober) {
        return new DiagnosticsService(prober);
    }

    @Bean
    TokenService tokenService(OrbNocProperties props) {
        return new TokenService(props.jwtSecret(), props.sessionTtlHours() * 3600L);
    }

    @Bean
    SecretBox secretBox(OrbNocProperties props) {
        String secret = props.encryptionKey() == null || props.encryptionKey().isBlank()
                ? props.jwtSecret()
                : props.encryptionKey();
        return new SecretBox(secret);
    }

    @Bean
    RateLimiter rateLimiter() {
        return new RateLimiter();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
    }
}
