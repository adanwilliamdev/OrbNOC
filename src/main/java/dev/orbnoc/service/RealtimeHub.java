package dev.orbnoc.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.orbnoc.domain.Event;
import dev.orbnoc.repo.DeviceRepository;
import dev.orbnoc.web.api.Dto;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

/** Conexões WebSocket por usuário: envia atualizações de dispositivos e eventos em tempo real. */
@Component
public class RealtimeHub {

    private static final Logger log = LoggerFactory.getLogger(RealtimeHub.class);

    private record Client(long userId, long expiresAt, WebSocketSession session) {}

    private final Map<String, Client> clients = new ConcurrentHashMap<>();
    private final DeviceRepository devices;
    private final ObjectMapper mapper;
    private final ScheduledExecutorService keepalive = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "orbnoc-ws-keepalive");
        t.setDaemon(true);
        return t;
    });

    public RealtimeHub(DeviceRepository devices, ObjectMapper mapper) {
        this.devices = devices;
        this.mapper = mapper;
    }

    @PostConstruct
    void start() {
        keepalive.scheduleWithFixedDelay(this::heartbeat, 25, 25, TimeUnit.SECONDS);
    }

    @PreDestroy
    void stop() {
        keepalive.shutdownNow();
    }

    public void register(WebSocketSession raw, long userId, long expiresAtEpochSeconds) {
        WebSocketSession safe = new ConcurrentWebSocketSessionDecorator(raw, 5000, 256 * 1024);
        Client client = new Client(userId, expiresAtEpochSeconds, safe);
        clients.put(raw.getId(), client);
        send(client, devicesPayload(userId)); // estado inicial
    }

    public void unregister(String sessionId) {
        clients.remove(sessionId);
    }

    public void publishDevices(Long userId) {
        if (!hasClients(userId)) return;
        broadcast(userId, devicesPayload(userId));
    }

    public void publishEvent(Event event) {
        if (!hasClients(event.getUserId())) return;
        try {
            broadcast(event.getUserId(), mapper.writeValueAsString(Map.of("type", "event", "event", Dto.EventOut.from(event))));
        } catch (JsonProcessingException e) {
            log.warn("Falha ao serializar evento: {}", e.getMessage());
        }
    }

    private boolean hasClients(Long userId) {
        for (Client c : clients.values()) if (c.userId() == userId) return true;
        return false;
    }

    private String devicesPayload(long userId) {
        List<Dto.DeviceOut> list = devices.findByUserIdOrderByIdAsc(userId).stream().map(Dto.DeviceOut::from).toList();
        try {
            return mapper.writeValueAsString(Map.of("type", "devices_update", "devices", list));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private void broadcast(long userId, String json) {
        for (Client c : clients.values()) if (c.userId() == userId) send(c, json);
    }

    private void send(Client client, String json) {
        try {
            client.session().sendMessage(new TextMessage(json));
        } catch (IOException | RuntimeException e) {
            clients.remove(client.session().getId());
            try {
                client.session().close(CloseStatus.SESSION_NOT_RELIABLE);
            } catch (IOException ignored) {
                // conexão já caiu
            }
        }
    }

    /** Ping periódico e encerramento de sessões cujo token expirou (código 4401). */
    private void heartbeat() {
        long now = Instant.now().getEpochSecond();
        for (Client c : clients.values()) {
            if (c.expiresAt() <= now) {
                clients.remove(c.session().getId());
                try {
                    c.session().close(new CloseStatus(4401, "sessão expirada"));
                } catch (IOException ignored) {
                    // já fechada
                }
            } else {
                send(c, "{\"type\":\"ping\"}");
            }
        }
    }
}
