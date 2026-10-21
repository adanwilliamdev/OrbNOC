package dev.orbnoc.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "notification_channels")
public class NotificationChannel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;

    private String kind;

    private boolean enabled = false;

    @Column(columnDefinition = "text")
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
