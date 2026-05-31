const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database(path.join(__dirname, 'orbnoc.db'));

// Ativar suporte a Chaves Estrangeiras (Foreign Keys) no SQLite
db.get("PRAGMA foreign_keys = ON");

// Criar tabelas
db.serialize(() => {
  // Tabela de usuários (Atualizada com campos de notificação)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,

      -- Novos campos para Alertas por Email e Telegram
      email_alerts_enabled INTEGER DEFAULT 0,
      alert_email_target TEXT,
      telegram_alerts_enabled INTEGER DEFAULT 0,
      telegram_bot_token TEXT,
      telegram_chat_id TEXT
    )
  `);

  // Tabela de dispositivos por usuário (Atualizada com métricas avançadas e stats estendidas)
  db.run(`
    CREATE TABLE IF NOT EXISTS user_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      device_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      ip TEXT NOT NULL,
      location TEXT,
      status TEXT DEFAULT 'unknown',
      latency INTEGER,
      last_check DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      -- Novas colunas para Métricas Estendidas e Jitter
      avg_latency INTEGER,
      min_latency INTEGER,
      max_latency INTEGER,
      jitter INTEGER,
      packet_loss INTEGER,
      last_ping_stats DATETIME,

      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tabela de sessões
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tabela de logs de acesso
  db.run(`
    CREATE TABLE IF NOT EXISTS access_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT,
      ip_address TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Criar usuário admin padrão
  const adminPassword = bcrypt.hashSync('admin123', 10);
  db.run(`
    INSERT OR IGNORE INTO users (username, email, password, role)
    VALUES ('admin', 'admin@orbnoc.com', ?, 'admin')
  `, [adminPassword]);
});

module.exports = db;