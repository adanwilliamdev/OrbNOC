-- Schema inicial do OrbNOC. Intervalo de checagem padrão: 30 s.

CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    username      VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'user',
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_login    TIMESTAMPTZ,
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_role CHECK (role IN ('admin', 'user'))
);

CREATE TABLE access_logs (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT REFERENCES users (id) ON DELETE SET NULL,
    action     VARCHAR(50) NOT NULL,
    ip_address VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE devices (
    id                   BIGSERIAL PRIMARY KEY,
    user_id              BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name                 VARCHAR(255) NOT NULL,
    ip                   VARCHAR(255) NOT NULL,
    location             VARCHAR(255),
    check_type           VARCHAR(10)  NOT NULL DEFAULT 'icmp',
    port                 INTEGER,
    interval_seconds     INTEGER      NOT NULL DEFAULT 30,
    failure_threshold    INTEGER      NOT NULL DEFAULT 3,
    sla_threshold_ms     INTEGER,
    status               VARCHAR(10)  NOT NULL DEFAULT 'unknown',
    consecutive_failures INTEGER      NOT NULL DEFAULT 0,
    sla_breached         BOOLEAN      NOT NULL DEFAULT FALSE,
    latency              DOUBLE PRECISION,
    avg_latency          DOUBLE PRECISION,
    min_latency          DOUBLE PRECISION,
    max_latency          DOUBLE PRECISION,
    jitter               DOUBLE PRECISION,
    packet_loss          DOUBLE PRECISION,
    last_error           VARCHAR(255),
    last_check           TIMESTAMPTZ,
    last_status_change   TIMESTAMPTZ,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_devices_user_ip UNIQUE (user_id, ip),
    CONSTRAINT ck_devices_check_type CHECK (check_type IN ('icmp', 'tcp')),
    CONSTRAINT ck_devices_status CHECK (status IN ('unknown', 'online', 'offline'))
);
CREATE INDEX ix_devices_user_id ON devices (user_id);

CREATE TABLE notification_channels (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind             VARCHAR(20) NOT NULL,
    enabled          BOOLEAN     NOT NULL DEFAULT FALSE,
    secret_encrypted TEXT,
    target           VARCHAR(100),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_notification_channels_user_kind UNIQUE (user_id, kind)
);

CREATE TABLE events (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    device_id       BIGINT      REFERENCES devices (id) ON DELETE SET NULL,
    kind            VARCHAR(30) NOT NULL,
    severity        VARCHAR(10) NOT NULL,
    message         TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_at TIMESTAMPTZ,
    CONSTRAINT ck_events_severity CHECK (severity IN ('success', 'warning', 'error', 'info'))
);
CREATE INDEX ix_events_user_created ON events (user_id, created_at);

CREATE TABLE metrics (
    id          BIGSERIAL PRIMARY KEY,
    device_id   BIGINT      NOT NULL REFERENCES devices (id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ok          BOOLEAN     NOT NULL,
    latency     DOUBLE PRECISION,
    jitter      DOUBLE PRECISION,
    packet_loss DOUBLE PRECISION
);
CREATE INDEX ix_metrics_device_recorded ON metrics (device_id, recorded_at);
CREATE INDEX ix_metrics_recorded_at ON metrics (recorded_at);

CREATE TABLE metrics_hourly (
    device_id   BIGINT      NOT NULL REFERENCES devices (id) ON DELETE CASCADE,
    hour        TIMESTAMPTZ NOT NULL,
    samples     INTEGER     NOT NULL,
    ok_samples  INTEGER     NOT NULL,
    avg_latency DOUBLE PRECISION,
    min_latency DOUBLE PRECISION,
    max_latency DOUBLE PRECISION,
    PRIMARY KEY (device_id, hour)
);
