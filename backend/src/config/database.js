const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { DATABASE_URL } = require('./env');

// SSL só é necessário para bancos remotos (ex: Supabase em produção).
// Para Postgres local (docker-compose ou instalação local), SSL fica desligado.
const useSSL = process.env.DATABASE_SSL === 'true';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false, require: true } : false,
  family: 4,
});

const TABLE_DEFINITIONS = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    telegram_alerts_enabled BOOLEAN DEFAULT FALSE,
    telegram_bot_token TEXT,
    telegram_chat_id VARCHAR(100),
    email_alerts_enabled BOOLEAN DEFAULT FALSE,
    alert_email_target VARCHAR(255),
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS user_devices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    device_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    ip VARCHAR(45) NOT NULL,
    location VARCHAR(255),
    status VARCHAR(20) DEFAULT 'offline',
    latency INTEGER,
    avg_latency INTEGER,
    min_latency INTEGER,
    max_latency INTEGER,
    jitter INTEGER DEFAULT 0,
    packet_loss INTEGER DEFAULT 0,
    last_check TIMESTAMP,
    last_ping_stats TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS access_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50),
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS sla_alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    device_id INTEGER NOT NULL,
    threshold INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, device_id)
  )`,
];

async function createTables() {
  for (const query of TABLE_DEFINITIONS) {
    try {
      await pool.query(query);
      console.log('✅ Tabela verificada/criada com sucesso');
    } catch (err) {
      console.error('❌ Erro ao criar tabela:', err.message);
    }
  }
  await seedDemoAdmin();
}

async function seedDemoAdmin() {
  try {
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);
    if (existing.rows.length > 0) return;

    const hashedPassword = await bcrypt.hash('admin123', 10);
    await pool.query(
      'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)',
      ['admin', 'admin@orbnoc.local', hashedPassword, 'admin']
    );
    console.log('✅ Usuário demo criado: admin / admin123');
  } catch (err) {
    console.error('❌ Erro ao criar usuário demo:', err.message);
  }
}

function connect(retries = 10, delayMs = 3000) {
  pool.connect((err, client, release) => {
    if (err) {
      console.error(`❌ Erro ao conectar ao PostgreSQL (tentativas restantes: ${retries}):`, err.message);
      if (retries > 0) {
        setTimeout(() => connect(retries - 1, delayMs), delayMs);
      } else {
        console.error('❌ Não foi possível conectar ao PostgreSQL após várias tentativas.');
      }
      return;
    }
    console.log('✅ Conectado ao PostgreSQL com sucesso!');
    release();
    createTables();
  });
}

module.exports = { pool, connect, createTables };
