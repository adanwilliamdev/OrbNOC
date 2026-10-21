package dev.orbnoc.web.api;

import dev.orbnoc.config.OrbNocProperties;
import dev.orbnoc.core.HostRejectedException;
import dev.orbnoc.core.NetGuard;
import dev.orbnoc.core.ProbeResult;
import dev.orbnoc.core.Prober;
import dev.orbnoc.domain.Device;
import dev.orbnoc.domain.Event;
import dev.orbnoc.domain.User;
import dev.orbnoc.repo.DeviceRepository;
import dev.orbnoc.service.AuthService;
import dev.orbnoc.service.CheckService;
import dev.orbnoc.service.DeviceService;
import dev.orbnoc.service.Notifier;
import dev.orbnoc.service.RealtimeHub;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/devices")
public class DeviceController {

    private final AuthService auth;
    private final DeviceService service;
    private final DeviceRepository devices;
    private final CheckService checks;
    private final Prober prober;
    private final RealtimeHub hub;
    private final Notifier notifier;
    private final OrbNocProperties props;
    private final TransactionTemplate tx;

    public DeviceController(
            AuthService auth,
            DeviceService service,
            DeviceRepository devices,
            CheckService checks,
            Prober prober,
            RealtimeHub hub,
            Notifier notifier,
            OrbNocProperties props,
            TransactionTemplate tx) {
        this.auth = auth;
        this.service = service;
        this.devices = devices;
        this.checks = checks;
        this.prober = prober;
        this.hub = hub;
        this.notifier = notifier;
        this.props = props;
        this.tx = tx;
    }

    @GetMapping
    List<Dto.DeviceOut> list(HttpServletRequest request) {
        User user = auth.requireUser(request);
        return service.list(user.getId()).stream().map(Dto.DeviceOut::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    Dto.DeviceOut create(@RequestBody Dto.DeviceCreateIn body, HttpServletRequest request) {
        User user = auth.requireUser(request);
        Device created = service.create(user.getId(), body);
        hub.publishDevices(user.getId());
        return Dto.DeviceOut.from(created);
    }

    @GetMapping("/{id}")
    Dto.DeviceOut get(@PathVariable Long id, HttpServletRequest request) {
        User user = auth.requireUser(request);
        return Dto.DeviceOut.from(service.get(user.getId(), id));
    }

    @PatchMapping("/{id}")
    Dto.DeviceOut patch(@PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        User user = auth.requireUser(request);
        Device updated = service.patch(user.getId(), id, body);
        hub.publishDevices(user.getId());
        return Dto.DeviceOut.from(updated);
    }

    @DeleteMapping("/{id}")
    Map<String, Object> delete(@PathVariable Long id, HttpServletRequest request) {
        User user = auth.requireUser(request);
        service.delete(user.getId(), id);
        hub.publishDevices(user.getId());
        return Map.of("success", true);
    }

    @GetMapping("/{id}/history")
    Map<String, Object> history(
            @PathVariable Long id, @RequestParam(defaultValue = "24") int hours, HttpServletRequest request) {
        User user = auth.requireUser(request);
        return service.history(user.getId(), id, hours);
    }

    /** Checagem manual imediata; atualiza estado, métrica e eventos como o monitor. */
    @PostMapping("/{id}/ping")
    Dto.DevicePingOut ping(@PathVariable Long id, HttpServletRequest request) {
        User user = auth.requireUser(request);
        Device snapshot = service.get(user.getId(), id);
        ProbeResult result;
        try {
            String address = NetGuard.resolveAndCheck(snapshot.getIp(), props.allowPrivateNetworks(), 5000).get(0);
            result = prober.probe(address, snapshot.getCheckType(), snapshot.getPort());
        } catch (HostRejectedException e) {
            result = ProbeResult.fail(snapshot.getCheckType(), snapshot.getPort(), e.getMessage());
        }
        ProbeResult finalResult = result;
        Instant now = Instant.now();
        List<Event> created = new ArrayList<>();
        Device[] updated = new Device[1];
        tx.executeWithoutResult(status -> {
            Device d = devices.findByIdAndUserId(id, user.getId()).orElseThrow(() -> ApiException.notFound("Dispositivo não encontrado"));
            created.addAll(checks.apply(d, finalResult, now));
            updated[0] = d;
        });
        Device d = updated[0];
        hub.publishDevices(user.getId());
        Notifier.Target target = created.isEmpty() ? null : notifier.loadTarget(user.getId(), true);
        for (Event event : created) {
            hub.publishEvent(event);
            if (target != null) notifier.sendAsync(target, Notifier.format(d, event));
        }
        return new Dto.DevicePingOut(
                d.getId(), d.getName(), d.getIp(), d.getStatus(), finalResult.ok() ? finalResult.latencyMs() : null,
                finalResult.method(), finalResult.ok() ? null : finalResult.error(), now);
    }

    @PostMapping("/{id}/check-port")
    Map<String, Object> checkPort(@PathVariable Long id, @RequestBody Dto.PortCheckIn body, HttpServletRequest request) {
        User user = auth.requireUser(request);
        Device d = service.get(user.getId(), id);
        int port = Validate.range(body.port(), "Porta", 1, 65535);
        String address;
        try {
            address = NetGuard.resolveAndCheck(d.getIp(), props.allowPrivateNetworks(), 5000).get(0);
        } catch (HostRejectedException e) {
            throw ApiException.unprocessable(e.getMessage());
        }
        ProbeResult r = Prober.tcpProbe(address, port, props.probeTimeoutSeconds(), false);
        return Map.of("port", port, "open", r.ok(), "latency_ms", r.ok() ? r.latencyMs() : 0.0);
    }
}
