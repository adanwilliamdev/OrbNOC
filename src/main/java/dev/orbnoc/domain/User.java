package dev.orbnoc.domain;

import java.time.Instant;

public class User {

    private Long id;

    private String username;

    private String email;

    private String passwordHash;

    private String role = "user";

    private boolean active = true;

    private Instant createdAt = Instant.now();

    private Instant lastLogin;

    /** Versão dos tokens de sessão; incrementar invalida todos os tokens emitidos antes. */
    private int tokenVersion;

    private String totpSecretEncrypted;

    private boolean totpEnabled;

    public User() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getLastLogin() { return lastLogin; }
    public void setLastLogin(Instant lastLogin) { this.lastLogin = lastLogin; }

    public int getTokenVersion() { return tokenVersion; }
    public void setTokenVersion(int tokenVersion) { this.tokenVersion = tokenVersion; }

    public String getTotpSecretEncrypted() { return totpSecretEncrypted; }
    public void setTotpSecretEncrypted(String totpSecretEncrypted) { this.totpSecretEncrypted = totpSecretEncrypted; }

    public boolean isTotpEnabled() { return totpEnabled; }
    public void setTotpEnabled(boolean totpEnabled) { this.totpEnabled = totpEnabled; }

}
