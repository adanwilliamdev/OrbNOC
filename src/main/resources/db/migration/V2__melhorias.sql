-- Melhorias de segurança, alertas e desempenho.

-- Sessões revogáveis: o token JWT carrega esta versão; trocar a senha ou encerrar as sessões a incrementa.
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;

-- Segundo fator (TOTP). O segredo fica cifrado (SecretBox) e só vale com totp_enabled = TRUE.
ALTER TABLE users ADD COLUMN totp_secret_encrypted TEXT;
ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Trilha de auditoria: ações de administração registram o alvo e o detalhe.
ALTER TABLE access_logs ADD COLUMN detail VARCHAR(255);
CREATE INDEX ix_access_logs_created_at ON access_logs (created_at);

-- Alertas: manutenção silenciada e supressão por dependência (topologia pai -> filhos).
ALTER TABLE devices ADD COLUMN maintenance_until TIMESTAMPTZ;
ALTER TABLE devices ADD COLUMN parent_id BIGINT REFERENCES devices (id) ON DELETE SET NULL;
CREATE INDEX ix_devices_parent_id ON devices (parent_id);

-- Apagar um dispositivo (FK com SET NULL) não varre mais a tabela de eventos.
CREATE INDEX ix_events_device_id ON events (device_id);
-- Retenção de agregados horários filtra só por hora.
CREATE INDEX ix_metrics_hourly_hour ON metrics_hourly (hour);
-- Retenção de eventos filtra só por data.
CREATE INDEX ix_events_created_at ON events (created_at);
