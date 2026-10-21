package dev.orbnoc.ws;

import dev.orbnoc.service.RealtimeHub;
import java.io.IOException;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/** Endpoint {@code /ws}: autenticação já resolvida pelo {@link LiveHandshakeInterceptor}. */
@Component
public class LiveSocketHandler extends TextWebSocketHandler {

    private final RealtimeHub hub;

    public LiveSocketHandler(RealtimeHub hub) {
        this.hub = hub;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws IOException {
        Object closeCode = session.getAttributes().get(LiveHandshakeInterceptor.CLOSE_CODE);
        if (closeCode instanceof Integer code) {
            session.close(new CloseStatus(code)); // 4401 = não autenticado, 4403 = origem proibida
            return;
        }
        long userId = (Long) session.getAttributes().get(LiveHandshakeInterceptor.USER_ID);
        long expiresAt = (Long) session.getAttributes().get(LiveHandshakeInterceptor.EXPIRES_AT);
        hub.register(session, userId, expiresAt);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        // O canal é apenas servidor → cliente; mensagens recebidas (ping do navegador) são ignoradas.
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        hub.unregister(session.getId());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        hub.unregister(session.getId());
    }
}
