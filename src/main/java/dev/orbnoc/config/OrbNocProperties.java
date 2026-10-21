package dev.orbnoc.config;

import java.util.LinkedHashSet;
import java.util.Set;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuração via variáveis de ambiente (mapeadas em application.yml). */
@ConfigurationProperties(prefix = "orbnoc")
public record OrbNocProperties(
        String environment,
        String databaseUrl,
        String databaseUser,
        String databasePassword,
        boolean databaseSsl,
        String jwtSecret,
        String encryptionKey,
        int sessionTtlHours,
        String cookieName,
        String cookieSecure,
        String publicUrl,
        String extraOrigins,
        boolean registrationEnabled,
        String adminUsername,
        String adminEmail,
        String adminPassword,
        boolean adminForceReset,
        boolean allowPrivateNetworks,
        boolean workerEnabled,
        double workerTickSeconds,
        int monitorConcurrency,
        double probeTimeoutSeconds,
        int metricsRetentionDays,
        int hourlyRetentionDays,
        int eventsRetentionDays,
        int accessLogRetentionDays,
        int healthWorkerMaxAgeSeconds,
        int loginMaxAttempts,
        int loginWindowSeconds) {

    public static final String DEV_JWT_SECRET = "dev-only-insecure-secret-change-me-0123456789";

    public OrbNocProperties {
        boolean production = "production".equalsIgnoreCase(environment);
        if (jwtSecret == null || jwtSecret.isBlank()) {
            if (production) throw new IllegalStateException("JWT_SECRET é obrigatório em produção");
            jwtSecret = DEV_JWT_SECRET;
        }
        if (production && jwtSecret.length() < 32) {
            throw new IllegalStateException("JWT_SECRET precisa ter pelo menos 32 caracteres em produção");
        }
        if (production && DEV_JWT_SECRET.equals(jwtSecret)) {
            throw new IllegalStateException("JWT_SECRET de desenvolvimento não pode ser usado em produção");
        }
        if (workerTickSeconds <= 0) throw new IllegalStateException("WORKER_TICK_SECONDS deve ser maior que zero");
        if (monitorConcurrency < 1) throw new IllegalStateException("MONITOR_CONCURRENCY deve ser pelo menos 1");
    }

    public boolean isProduction() {
        return "production".equalsIgnoreCase(environment);
    }

    public boolean secureCookie() {
        if ("true".equalsIgnoreCase(cookieSecure)) return true;
        if ("false".equalsIgnoreCase(cookieSecure)) return false;
        return isProduction(); // "auto" ou vazio: seguro em produção
    }

    /** Origens aceitas em requisições que alteram estado. */
    public Set<String> allowedOrigins() {
        Set<String> origins = new LinkedHashSet<>();
        origins.add(stripSlash(publicUrl));
        if (extraOrigins != null) {
            for (String o : extraOrigins.split(",")) {
                if (!o.isBlank()) origins.add(stripSlash(o.strip()));
            }
        }
        return origins;
    }

    private static String stripSlash(String value) {
        String v = value == null ? "" : value;
        while (v.endsWith("/")) v = v.substring(0, v.length() - 1);
        return v;
    }
}
