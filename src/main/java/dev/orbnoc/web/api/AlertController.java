package dev.orbnoc.web.api;

import dev.orbnoc.domain.Device;
import dev.orbnoc.domain.User;
import dev.orbnoc.service.AuthService;
import dev.orbnoc.service.DeviceService;
import dev.orbnoc.service.EventService;
import dev.orbnoc.service.RealtimeHub;
import dev.orbnoc.service.TelegramService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/alerts")
public class AlertController {

    private final AuthService auth;
    private final EventService events;
    private final TelegramService telegram;
    private final DeviceService devices;
    private final RealtimeHub hub;

    public AlertController(
            AuthService auth, EventService events, TelegramService telegram, DeviceService devices, RealtimeHub hub) {
        this.auth = auth;
        this.events = events;
        this.telegram = telegram;
        this.devices = devices;
        this.hub = hub;
    }

    @GetMapping
    List<Dto.EventOut> list(
            @RequestParam(name = "unread_only", defaultValue = "false") boolean unreadOnly,
            @RequestParam(defaultValue = "50") int limit,
            HttpServletRequest request) {
        User user = auth.requireUser(request);
        Validate.require(limit >= 1 && limit <= 200, "Limite: de 1 a 200");
        return events.list(user.getId(), unreadOnly, limit).stream().map(Dto.EventOut::from).toList();
    }

    @GetMapping("/unread-count")
    Map<String, Object> unreadCount(HttpServletRequest request) {
        User user = auth.requireUser(request);
        return Map.of("count", events.unreadCount(user.getId()));
    }

    @PostMapping("/{id}/ack")
    Map<String, Object> ack(@PathVariable Long id, HttpServletRequest request) {
        User user = auth.requireUser(request);
        if (!events.acknowledge(user.getId(), id)) throw ApiException.notFound("Alerta não encontrado");
        return Map.of("success", true);
    }

    @PostMapping("/ack-all")
    Map<String, Object> ackAll(HttpServletRequest request) {
        User user = auth.requireUser(request);
        return Map.of("success", true, "acknowledged", events.acknowledgeAll(user.getId()));
    }

    // ---- limite de latência (SLA) --------------------------------------------------------------

    @PostMapping("/sla/configure")
    Map<String, Object> configureSla(@RequestBody Dto.SlaConfigIn body, HttpServletRequest request) {
        User user = auth.requireUser(request);
        Validate.require(body.deviceId() != null, "Informe o dispositivo");
        Device d = devices.configureSla(user.getId(), body.deviceId(), body.thresholdMs());
        hub.publishDevices(user.getId());
        return Map.of("success", true, "device_id", d.getId());
    }

    // ---- Telegram ----------------------------------------------------------------------------------

    @GetMapping("/telegram")
    Dto.TelegramOut getTelegram(HttpServletRequest request) {
        return telegram.get(auth.requireUser(request).getId());
    }

    @PutMapping("/telegram")
    Dto.TelegramOut saveTelegram(@RequestBody Dto.TelegramIn body, HttpServletRequest request) {
        return telegram.save(auth.requireUser(request).getId(), body);
    }

    @DeleteMapping("/telegram")
    Map<String, Object> deleteTelegram(HttpServletRequest request) {
        telegram.delete(auth.requireUser(request).getId());
        return Map.of("success", true);
    }
}
