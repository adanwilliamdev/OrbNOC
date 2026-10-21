package dev.orbnoc.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.orbnoc.core.SecretBox;
import dev.orbnoc.domain.Device;
import dev.orbnoc.domain.Event;
import dev.orbnoc.domain.NotificationChannel;
import dev.orbnoc.repo.NotificationChannelRepository;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

/** Notificações por Telegram. O token do bot fica cifrado no banco e nunca é registrado em log. */
@Service
public class Notifier {

    public static final Pattern BOT_TOKEN = Pattern.compile("\\d{5,15}:[A-Za-z0-9_-]{20,80}");
    public static final Pattern CHAT_ID = Pattern.compile("-?\\d{1,20}|@[A-Za-z][A-Za-z0-9_]{4,63}");

    public record Target(String token, String chatId) {}

    public record SendResult(boolean ok, String error) {}

    private static final Logger log = LoggerFactory.getLogger(Notifier.class);

    private final NotificationChannelRepository channels;
    private final SecretBox secretBox;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    public Notifier(NotificationChannelRepository channels, SecretBox secretBox, ObjectMapper mapper) {
        this.channels = channels;
        this.secretBox = secretBox;
        this.mapper = mapper;
    }

    /** Destino do Telegram do usuário (ou {@code null} se ausente, ilegível ou — com onlyEnabled — desligado). */
    public Target loadTarget(Long userId, boolean onlyEnabled) {
        NotificationChannel ch = channels.findByUserIdAndKind(userId, "telegram").orElse(null);
        if (ch == null || (onlyEnabled && !ch.isEnabled())) return null;
        if (ch.getSecretEncrypted() == null || ch.getTarget() == null) return null;
        String token = secretBox.decrypt(ch.getSecretEncrypted());
        return token == null ? null : new Target(token, ch.getTarget());
    }

    public SendResult send(Target target, String html) {
        try {
            String body = mapper.writeValueAsString(Map.of(
                    "chat_id", target.chatId(),
                    "text", html,
                    "parse_mode", "HTML",
                    "disable_web_page_preview", true));
            HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.telegram.org/bot" + target.token() + "/sendMessage"))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode json = mapper.readTree(response.body());
            if (json.path("ok").asBoolean(false)) return new SendResult(true, null);
            String description = json.path("description").asText("erro do Telegram");
            return new SendResult(false, description.length() > 200 ? description.substring(0, 200) : description);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new SendResult(false, "envio interrompido");
        } catch (IOException | IllegalArgumentException e) {
            log.warn("Falha ao falar com o Telegram: {}", e.getClass().getSimpleName());
            return new SendResult(false, "não foi possível falar com o Telegram");
        }
    }

    public void sendAsync(Target target, String html) {
        executor.submit(() -> send(target, html));
    }

    public static String testMessage() {
        return "✅ <b>OrbNOC</b>: notificações do Telegram configuradas com sucesso.";
    }

    public static String format(Device device, Event event) {
        String title = switch (event.getKind()) {
            case "offline" -> "🔴 <b>OFFLINE</b>";
            case "recovered" -> "🟢 <b>RECUPERADO</b>";
            case "sla_breach" -> "🟡 <b>LATÊNCIA ALTA</b>";
            case "sla_recovered" -> "🔵 <b>LATÊNCIA NORMALIZADA</b>";
            default -> "ℹ️ <b>AVISO</b>";
        };
        StringBuilder sb = new StringBuilder(title)
                .append(" — ")
                .append(HtmlUtils.htmlEscape(device.getName()))
                .append("\nHost: <code>")
                .append(HtmlUtils.htmlEscape(device.getIp()))
                .append("</code>\n")
                .append(HtmlUtils.htmlEscape(event.getMessage()));
        if ("offline".equals(event.getKind()) && device.getLastError() != null) {
            sb.append("\nÚltimo erro: ").append(HtmlUtils.htmlEscape(device.getLastError()));
        }
        return sb.toString();
    }
}
