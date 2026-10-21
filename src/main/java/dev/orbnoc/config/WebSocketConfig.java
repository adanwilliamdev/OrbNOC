package dev.orbnoc.config;

import dev.orbnoc.ws.LiveHandshakeInterceptor;
import dev.orbnoc.ws.LiveSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final LiveSocketHandler handler;
    private final LiveHandshakeInterceptor interceptor;

    public WebSocketConfig(LiveSocketHandler handler, LiveHandshakeInterceptor interceptor) {
        this.handler = handler;
        this.interceptor = interceptor;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // A origem é validada no interceptor (aceita PUBLIC_URL, EXTRA_ORIGINS e o próprio Host).
        registry.addHandler(handler, "/ws").addInterceptors(interceptor).setAllowedOriginPatterns("*");
    }
}
