package dev.orbnoc.service;

import dev.orbnoc.config.OrbNocProperties;
import dev.orbnoc.core.HostRejectedException;
import dev.orbnoc.core.NetGuard;
import dev.orbnoc.domain.Device;
import dev.orbnoc.domain.MetricHourly;
import dev.orbnoc.repo.DeviceRepository;
import dev.orbnoc.repo.MetricHourlyRepository;
import dev.orbnoc.repo.MetricRepository;
import dev.orbnoc.web.api.ApiException;
import dev.orbnoc.web.api.Dto;
import dev.orbnoc.web.api.Validate;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DeviceService {

    private final DeviceRepository devices;
    private final MetricRepository metrics;
    private final MetricHourlyRepository hourly;
    private final OrbNocProperties props;
    private final TargetPolicy policy;

    public DeviceService(
            DeviceRepository devices,
            MetricRepository metrics,
            MetricHourlyRepository hourly,
            OrbNocProperties props,
            TargetPolicy policy) {
        this.devices = devices;
        this.metrics = metrics;
        this.hourly = hourly;
        this.props = props;
        this.policy = policy;
    }

    public List<Device> list(Long userId) {
        return devices.findByUserIdOrderByIdAsc(userId);
    }

    public Device get(Long userId, Long id) {
        return devices.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("Dispositivo não encontrado"));
    }

    /** Valida a sintaxe e o endereço-alvo conforme o papel do usuário; devolve o host normalizado. */
    public String checkTarget(Long userId, String host) {
        String parsed = NetGuard.parseHost(host);
        try {
            policy.resolveForUser(parsed, userId);
        } catch (HostRejectedException e) {
            throw ApiException.unprocessable(e.getMessage());
        }
        return parsed;
    }

    public Device create(Long userId, Dto.DeviceCreateIn in) {
        String name = Validate.text(in.name(), "Nome", 1, 255);
        if (devices.countByUserId(userId) >= props.maxDevicesPerUser()) {
            throw ApiException.unprocessable("Limite de " + props.maxDevicesPerUser() + " dispositivos por usuário atingido");
        }
        String ip = checkTarget(userId, in.ip());
        String location = Validate.optionalText(in.location(), "Local", 255);
        String checkType = in.checkType() == null ? "icmp" : in.checkType();
        Validate.require("icmp".equals(checkType) || "tcp".equals(checkType), "Tipo de checagem inválido");
        Integer port = in.port();
        if ("tcp".equals(checkType)) {
            Validate.require(port != null, "Informe a porta para checagem TCP");
        }
        if (port != null) Validate.range(port, "Porta", 1, 65535);
        int interval = in.intervalSeconds() == null ? 30 : Validate.range(in.intervalSeconds(), "Intervalo", props.minIntervalSeconds(), 3600);
        int threshold = in.failureThreshold() == null ? 3 : Validate.range(in.failureThreshold(), "Limite de falhas", 1, 20);
        Integer sla = in.slaThresholdMs();
        if (sla != null) Validate.range(sla, "Limite de latência", 1, 60000);

        Device d = new Device();
        d.setUserId(userId);
        d.setName(name);
        d.setIp(ip);
        d.setLocation(location);
        d.setCheckType(checkType);
        d.setPort("tcp".equals(checkType) ? port : null);
        d.setIntervalSeconds(interval);
        d.setFailureThreshold(threshold);
        d.setSlaThresholdMs(sla);
        try {
            return devices.saveAndFlush(d);
        } catch (DataIntegrityViolationException e) {
            throw ApiException.conflict("Já existe um dispositivo com este host");
        }
    }

    /** Atualização parcial: só campos presentes no corpo ({@code body}). */
    @Transactional
    public Device patch(Long userId, Long id, Map<String, Object> body) {
        Device d = get(userId, id);
        if (body.containsKey("name")) d.setName(Validate.text(str(body.get("name")), "Nome", 1, 255));
        if (body.containsKey("location")) d.setLocation(Validate.optionalText(str(body.get("location")), "Local", 255));
        if (body.containsKey("ip")) d.setIp(checkTarget(userId, str(body.get("ip"))));
        if (body.containsKey("check_type")) {
            String type = str(body.get("check_type"));
            Validate.require("icmp".equals(type) || "tcp".equals(type), "Tipo de checagem inválido");
            d.setCheckType(type);
        }
        if (body.containsKey("port")) {
            Integer port = integer(body.get("port"));
            if (port != null) Validate.range(port, "Porta", 1, 65535);
            d.setPort(port);
        }
        if (body.containsKey("interval_seconds")) {
            d.setIntervalSeconds(Validate.range(integer(body.get("interval_seconds")), "Intervalo", props.minIntervalSeconds(), 3600));
        }
        if (body.containsKey("failure_threshold")) {
            d.setFailureThreshold(Validate.range(integer(body.get("failure_threshold")), "Limite de falhas", 1, 20));
        }
        if (body.containsKey("sla_threshold_ms")) {
            Integer sla = integer(body.get("sla_threshold_ms"));
            if (sla != null) Validate.range(sla, "Limite de latência", 1, 60000);
            d.setSlaThresholdMs(sla);
            if (sla == null) d.setSlaBreached(false);
        }
        if (body.containsKey("parent_id")) {
            Long parent = body.get("parent_id") == null ? null : longValue(body.get("parent_id"));
            if (parent != null) {
                get(userId, parent); // o pai precisa ser do mesmo usuário
                Validate.require(!devices.createsCycle(d.getId(), parent), "A dependência criaria um ciclo na topologia");
            }
            d.setParentId(parent);
        }
        if (body.containsKey("maintenance_until")) {
            d.setMaintenanceUntil(maintenance(body.get("maintenance_until")));
        }
        if ("tcp".equals(d.getCheckType())) {
            Validate.require(d.getPort() != null, "Informe a porta para checagem TCP");
        } else {
            d.setPort(null);
        }
        try {
            return devices.saveAndFlush(d);
        } catch (DataIntegrityViolationException e) {
            throw ApiException.conflict("Já existe um dispositivo com este host");
        }
    }

    @Transactional
    public Device delete(Long userId, Long id) {
        Device d = get(userId, id);
        devices.delete(d); // métricas em cascata; eventos ficam sem vínculo (SET NULL)
        return d;
    }

    @Transactional
    public Device configureSla(Long userId, Long id, Integer thresholdMs) {
        Device d = get(userId, id);
        if (thresholdMs != null) Validate.range(thresholdMs, "Limite de latência", 1, 60000);
        d.setSlaThresholdMs(thresholdMs);
        if (thresholdMs == null) d.setSlaBreached(false);
        return devices.save(d);
    }

    /** Histórico: até 24 h usa amostras brutas; acima disso, agregados por hora. */
    public Map<String, Object> history(Long userId, Long id, int hours) {
        get(userId, id);
        Validate.require(hours >= 1 && hours <= 720, "Período: de 1 a 720 horas");
        Instant since = Instant.now().minus(Duration.ofHours(hours));
        if (hours <= 24) {
            List<Dto.MetricOut> points = metrics
                    .findByDeviceIdAndRecordedAtGreaterThanEqualOrderByRecordedAtAsc(id, since, 5000)
                    .stream()
                    .map(Dto.MetricOut::from)
                    .toList();
            return Map.of("granularity", "raw", "points", points);
        }
        List<Map<String, Object>> points = hourly.findByDeviceIdAndHourStartGreaterThanEqualOrderByHourStartAsc(id, since).stream()
                .map(DeviceService::hourlyPoint)
                .toList();
        return Map.of("granularity", "hourly", "points", points);
    }

    private static Map<String, Object> hourlyPoint(MetricHourly h) {
        Map<String, Object> p = new java.util.LinkedHashMap<>();
        p.put("hour", h.getHourStart());
        p.put("samples", h.getSamples());
        p.put("ok_samples", h.getOkSamples());
        p.put("avg_latency", h.getAvgLatency());
        p.put("min_latency", h.getMinLatency());
        p.put("max_latency", h.getMaxLatency());
        return p;
    }

    /** {@code null} encerra a manutenção; senão um instante ISO-8601 no futuro, de até 30 dias. */
    private static Instant maintenance(Object value) {
        if (value == null) return null;
        Instant until;
        try {
            until = Instant.parse(String.valueOf(value));
        } catch (java.time.format.DateTimeParseException e) {
            throw ApiException.unprocessable("Manutenção: use data/hora ISO-8601, ex.: 2026-12-01T03:00:00Z");
        }
        Instant now = Instant.now();
        Validate.require(until.isAfter(now), "Manutenção: o fim deve estar no futuro");
        Validate.require(until.isBefore(now.plus(Duration.ofDays(30))), "Manutenção: no máximo 30 dias");
        return until;
    }

    private static Long longValue(Object value) {
        if (value instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException e) {
            throw ApiException.unprocessable("Valor numérico inválido");
        }
    }

    private static String str(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static Integer integer(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException e) {
            throw ApiException.unprocessable("Valor numérico inválido");
        }
    }
}
