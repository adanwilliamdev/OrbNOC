package dev.orbnoc.web.api;

import com.fasterxml.jackson.annotation.JsonProperty;
import dev.orbnoc.domain.Device;
import dev.orbnoc.domain.Event;
import dev.orbnoc.domain.Metric;
import dev.orbnoc.domain.User;
import java.time.Instant;
import java.util.List;

/** Contratos JSON da API (campos em snake_case via configuração global do Jackson). */
public final class Dto {

    private Dto() {}

    // ---- saída -------------------------------------------------------------------------------

    public record UserOut(Long id, String username, String email, String role, @JsonProperty("is_active") boolean active) {
        public static UserOut from(User u) {
            return new UserOut(u.getId(), u.getUsername(), u.getEmail(), u.getRole(), u.isActive());
        }
    }

    public record UserAdminOut(
            Long id,
            String username,
            String email,
            String role,
            @JsonProperty("is_active") boolean active,
            Instant createdAt,
            Instant lastLogin) {
        public static UserAdminOut from(User u) {
            return new UserAdminOut(
                    u.getId(), u.getUsername(), u.getEmail(), u.getRole(), u.isActive(), u.getCreatedAt(), u.getLastLogin());
        }
    }

    public record AuthOut(boolean success, UserOut user) {
        public static AuthOut of(User u) {
            return new AuthOut(true, UserOut.from(u));
        }
    }

    public record DeviceOut(
            Long id,
            String name,
            String ip,
            String location,
            String checkType,
            Integer port,
            int intervalSeconds,
            int failureThreshold,
            Integer slaThresholdMs,
            boolean slaBreached,
            String status,
            Double latency,
            Double avgLatency,
            Double minLatency,
            Double maxLatency,
            Double jitter,
            Double packetLoss,
            String lastError,
            Instant lastCheck,
            Instant lastStatusChange,
            Instant createdAt) {
        public static DeviceOut from(Device d) {
            return new DeviceOut(
                    d.getId(), d.getName(), d.getIp(), d.getLocation(), d.getCheckType(), d.getPort(),
                    d.getIntervalSeconds(), d.getFailureThreshold(), d.getSlaThresholdMs(), d.isSlaBreached(),
                    d.getStatus(), d.getLatency(), d.getAvgLatency(), d.getMinLatency(), d.getMaxLatency(),
                    d.getJitter(), d.getPacketLoss(), d.getLastError(), d.getLastCheck(), d.getLastStatusChange(),
                    d.getCreatedAt());
        }
    }

    public record DevicePingOut(
            Long id, String name, String ip, String status, Double latencyMs, String method, String error, Instant timestamp) {}

    public record MetricOut(
            Long id, Long deviceId, boolean ok, Double latency, Double jitter, Double packetLoss, Instant recordedAt) {
        public static MetricOut from(Metric m) {
            return new MetricOut(
                    m.getId(), m.getDeviceId(), m.isOk(), m.getLatency(), m.getJitter(), m.getPacketLoss(), m.getRecordedAt());
        }
    }

    public record EventOut(
            Long id, Long deviceId, String kind, String severity, String message, Instant createdAt, Instant acknowledgedAt) {
        public static EventOut from(Event e) {
            return new EventOut(
                    e.getId(), e.getDeviceId(), e.getKind(), e.getSeverity(), e.getMessage(), e.getCreatedAt(), e.getAcknowledgedAt());
        }
    }

    public record TelegramOut(boolean enabled, String chatId, boolean botTokenSet, Boolean testSent, String testError) {}

    // ---- entrada -----------------------------------------------------------------------------

    public record LoginIn(String username, String password) {}

    public record RegisterIn(String username, String email, String password) {}

    public record UserCreateIn(String username, String email, String password, String role) {}

    public record DeviceCreateIn(
            String name,
            String ip,
            String location,
            String checkType,
            Integer port,
            Integer intervalSeconds,
            Integer failureThreshold,
            Integer slaThresholdMs) {}

    public record PortCheckIn(Integer port) {}

    public record TelegramIn(Boolean enabled, String botToken, String chatId) {}

    public record SlaConfigIn(Long deviceId, Integer thresholdMs) {}

    public record PingIn(String host, Integer count) {}

    public record TracerouteIn(String host, Integer maxHops) {}

    public record PortsIn(String host, List<Integer> ports) {}

    public record DnsIn(String domain, String recordType) {}

    public record FullDiagnosticIn(String host, List<Integer> ports) {}
}
