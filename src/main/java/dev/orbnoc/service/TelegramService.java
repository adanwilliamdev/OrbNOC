package dev.orbnoc.service;

import dev.orbnoc.core.SecretBox;
import dev.orbnoc.domain.NotificationChannel;
import dev.orbnoc.repo.NotificationChannelRepository;
import dev.orbnoc.web.api.Dto;
import dev.orbnoc.web.api.Validate;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/** Configuração do canal Telegram do usuário. */
@Service
public class TelegramService {

    private final NotificationChannelRepository channels;
    private final SecretBox secretBox;
    private final Notifier notifier;
    private final TransactionTemplate tx;

    public TelegramService(
            NotificationChannelRepository channels, SecretBox secretBox, Notifier notifier, TransactionTemplate tx) {
        this.channels = channels;
        this.secretBox = secretBox;
        this.notifier = notifier;
        this.tx = tx;
    }

    public Dto.TelegramOut get(Long userId) {
        NotificationChannel ch = channels.findByUserIdAndKind(userId, "telegram").orElse(null);
        return view(ch, null, null);
    }

    public Dto.TelegramOut save(Long userId, Dto.TelegramIn in) {
        Validate.require(in.enabled() != null, "Informe se as notificações estão ativas");
        String token = blankToNull(in.botToken());
        String chatId = blankToNull(in.chatId());
        if (token != null) Validate.require(Notifier.BOT_TOKEN.matcher(token).matches(), "Token do bot em formato inválido");
        if (chatId != null) Validate.require(Notifier.CHAT_ID.matcher(chatId).matches(), "Chat ID inválido");

        NotificationChannel ch = tx.execute(status -> {
            NotificationChannel c = channels.findByUserIdAndKind(userId, "telegram").orElseGet(() -> {
                NotificationChannel n = new NotificationChannel();
                n.setUserId(userId);
                n.setKind("telegram");
                return n;
            });
            if (token != null) c.setSecretEncrypted(secretBox.encrypt(token));
            if (chatId != null) c.setTarget(chatId);
            Validate.require(
                    !in.enabled() || (c.getSecretEncrypted() != null && c.getTarget() != null),
                    "Informe o token do bot e o Chat ID para ativar");
            c.setEnabled(in.enabled());
            c.setUpdatedAt(Instant.now());
            return channels.save(c);
        });

        if (!ch.isEnabled()) return view(ch, null, null);
        Notifier.Target target = notifier.loadTarget(userId, true);
        if (target == null) return view(ch, false, "não foi possível ler a configuração salva");
        Notifier.SendResult result = notifier.send(target, Notifier.testMessage());
        return view(ch, result.ok(), result.error());
    }

    public void delete(Long userId) {
        tx.executeWithoutResult(status -> channels.findByUserIdAndKind(userId, "telegram").ifPresent(channels::delete));
    }

    private static Dto.TelegramOut view(NotificationChannel ch, Boolean testSent, String testError) {
        if (ch == null) return new Dto.TelegramOut(false, null, false, testSent, testError);
        return new Dto.TelegramOut(ch.isEnabled(), ch.getTarget(), ch.getSecretEncrypted() != null, testSent, testError);
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.strip();
    }
}
