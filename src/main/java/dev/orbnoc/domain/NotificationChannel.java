package dev.orbnoc.domain;

import java.time.Instant;

public class NotificationChannel {

    private Long id;

    private Long userId;

    private String kind;

    private boolean enabled = false;

    private String secretEncrypted;

    private String target;

    private Instant updatedAt = Instant.now();

    public NotificationChannel() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public String getSecretEncrypted() { return secretEncrypted; }
    public void setSecretEncrypted(String secretEncrypted) { this.secretEncrypted = secretEncrypted; }

    public String getTarget() { return target; }
    public void setTarget(String target) { this.target = target; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

}
