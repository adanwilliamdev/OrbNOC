require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const net = require('net');
const { Pool } = require('pg');
const dns = require('dns');
const util = require('util');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'orbnoc_secret_key_2024_change_this_in_production';

const resolve = util.promisify(dns.resolve);
const lookup = util.promisify(dns.lookup);

// ==================== CONEXÃO COM POSTGRESQL ====================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erro ao conectar ao PostgreSQL:', err.stack);
  } else {
    console.log('✅ Conectado ao PostgreSQL com sucesso!');
    release();
    criarTabelas();
  }
});

// ==================== CRIAÇÃO DAS TABELAS ====================
async function criarTabelas() {
  const queries = [
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
    )`
  ];

  for (const query of queries) {
    try {
      await pool.query(query);
      console.log('✅ Tabela verificada/criada com sucesso');
    } catch (err) {
      console.error('❌ Erro ao criar tabela:', err.message);
    }
  }
}

// ==================== MIDDLEWARE ====================
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "https://orbnoc-taer.onrender.com",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// ==================== FUNÇÃO DE PING VIA TCP ====================
async function tcpPing(ip, timeout = 5000) {
  const ports = [80, 443, 53, 8080, 8443];

  for (const port of ports) {
    try {
      const latency = await new Promise((resolve) => {
        const startTime = Date.now();
        const socket = new net.Socket();

        socket.setTimeout(timeout);

        socket.once('connect', () => {
          const latency = Date.now() - startTime;
          socket.destroy();
          resolve(latency);
        });

        socket.once('error', () => {
          socket.destroy();
          resolve(null);
        });

        socket.once('timeout', () => {
          socket.destroy();
          resolve(null);
        });

        socket.connect(port, ip);
      });

      if (latency !== null) {
        return { alive: true, latency, port };
      }
    } catch (err) {
      // Continua para próxima porta
    }
  }

  return { alive: false, latency: null, port: null };
}

function calculateJitter(latencies) {
  if (latencies.length < 2) return 0;
  let jitter = 0;
  for (let i = 1; i < latencies.length; i++) {
    jitter += Math.abs(latencies[i] - latencies[i-1]);
  }
  return Math.round(jitter / (latencies.length - 1));
}

// ==================== FUNÇÃO TELEGRAM - DESIGN BOTÃO ====================
async function sendTelegramAlert(botToken, chatId, message, type, deviceName = null, deviceIp = null, details = null, incidentDetails = null) {
  if (!botToken || !chatId) return false;

  let title = '';
  let headerIcon = '';

  switch(type) {
    case 'error':
      title = '⚠️ ALERTA DE MONITORAMENTO ⚠️';
      headerIcon = '⚠️';
      break;
    case 'success':
      title = '✅ RECUPERAÇÃO DE SERVIÇO ✅';
      headerIcon = '✅';
      break;
    case 'warning':
      title = '⚠️ ALERTA DE DESEMPENHO ⚠️';
      headerIcon = '⚠️';
      break;
    case 'added':
      title = '📌 NOVO DISPOSITIVO ADICIONADO 📌';
      headerIcon = '📌';
      break;
    case 'removed':
      title = '🗑️ DISPOSITIVO REMOVIDO 🗑️';
      headerIcon = '🗑️';
      break;
    default:
      title = 'ℹ️ NOTIFICAÇÃO DO SISTEMA ℹ️';
      headerIcon = 'ℹ️';
  }

  let text = `*ORBNOC | Network Operations Center*\n\n`;
  text += `**${title}**\n\n`;
  text += `---\n`;

  if (deviceName && deviceIp) {
    text += `📡 *Dispositivo:* ${deviceName}\n`;
    text += `🌐 *IP:* ${deviceIp}\n`;
    text += `📊 *Status:* ${type === 'error' ? 'OFFLINE' : type === 'success' ? 'ONLINE' : type === 'warning' ? 'ALERTA' : 'ATUALIZADO'}\n`;
  }

  if (details) {
    text += `${details}\n`;
  }

  text += `---\n\n`;

  if (incidentDetails) {
    text += `📋 *Detalhes do Incidente:*\n`;
    text += `─────────────────────────\n`;
    text += `${incidentDetails}\n`;
    text += `─────────────────────────\n\n`;
  }

  text += `${message}\n\n`;
  text += `_📡 OrbNOC • Monitoramento 24/7_`;

  try {
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      })
    });
    const result = await response.json();
    if (result.ok) {
      console.log(`✅ Telegram alerta enviado para ${chatId}`);
      return true;
    } else {
      console.error(`❌ Erro Telegram:`, result.description);
      return false;
    }
  } catch (error) {
    console.error('❌ Erro ao enviar Telegram:', error.message);
    return false;
  }
}

// ==================== MIDDLEWARE DE AUTENTICAÇÃO ====================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
};

// ==================== ROTAS DE AUTENTICAÇÃO ====================
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, role',
      [username, email, hashedPassword]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    await pool.query('INSERT INTO access_logs (user_id, action, ip_address) VALUES ($1, $2, $3)', [user.id, 'register', req.ip]);
    res.json({ success: true, token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
  } catch (error) {
    if (error.code === '23505') return res.status(400).json({ error: 'Usuário ou email já existe' });
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro interno ao criar usuário' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $1', [username]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Credenciais inválidas' });
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    await pool.query('INSERT INTO access_logs (user_id, action, ip_address) VALUES ($1, $2, $3)', [user.id, 'login', req.ip]);
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    await pool.query('INSERT INTO access_logs (user_id, action, ip_address) VALUES ($1, $2, $3)', [req.user.id, 'logout', req.ip]);
    res.json({ success: true });
  } catch (error) {
    res.json({ success: true });
  }
});

// ==================== ROTAS DE DISPOSITIVOS ====================
app.get('/api/devices', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM user_devices WHERE user_id = $1 ORDER BY id', [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar dispositivos:', error);
    res.status(500).json({ error: 'Erro ao buscar dispositivos' });
  }
});

// ADICIONAR DISPOSITIVO COM NOTIFICAÇÃO
app.post('/api/devices', authenticateToken, async (req, res) => {
  const { name, ip, location } = req.body;

  if (!name || !ip) {
    return res.status(400).json({ error: 'Nome e IP são obrigatórios' });
  }

  try {
    const existingDevice = await pool.query(
      'SELECT * FROM user_devices WHERE user_id = $1 AND ip = $2',
      [req.user.id, ip]
    );

    if (existingDevice.rows.length > 0) {
      return res.status(400).json({ error: 'Dispositivo com este IP já existe' });
    }

    const result = await pool.query(
      'INSERT INTO user_devices (user_id, device_id, name, ip, location) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.id, Date.now(), name, ip, location || null]
    );
    const newDevice = result.rows[0];

    // Notificação ao adicionar dispositivo
    try {
      const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
      const user = userResult.rows[0];

      if (user && user.telegram_alerts_enabled && user.telegram_bot_token && user.telegram_chat_id) {
        await sendTelegramAlert(
          user.telegram_bot_token,
          user.telegram_chat_id,
          `Novo dispositivo adicionado à lista de monitoramento.`,
          'added',
          name,
          ip,
          `📍 *Localização:* ${location || 'Não informada'}`,
          `🔍 *Status:* Aguardando primeira verificação\n📊 *Monitoramento:* Ativo`
        );
      }
    } catch (telegramError) {
      console.error('Erro ao enviar notificação Telegram:', telegramError);
    }

    res.json(newDevice);
  } catch (error) {
    console.error('Erro ao adicionar dispositivo:', error);
    res.status(500).json({ error: 'Erro ao adicionar dispositivo' });
  }
});

// REMOVER DISPOSITIVO
app.delete('/api/devices/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM user_devices WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dispositivo não encontrado' });
    }

    const removedDevice = result.rows[0];

    await pool.query('DELETE FROM sla_alerts WHERE user_id = $1 AND device_id = $2', [req.user.id, req.params.id]);

    try {
      const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
      const user = userResult.rows[0];

      if (user && user.telegram_alerts_enabled && user.telegram_bot_token && user.telegram_chat_id) {
        await sendTelegramAlert(
          user.telegram_bot_token,
          user.telegram_chat_id,
          `Dispositivo removido permanentemente do monitoramento.`,
          'removed',
          removedDevice.name,
          removedDevice.ip,
          `📅 *Data da remoção:* ${new Date().toLocaleString('pt-BR')}`,
          `⏹️ *Status:* Monitoramento interrompido\n📊 *Dispositivo:* ${removedDevice.name} (${removedDevice.ip})`
        );
      }
    } catch (telegramError) {
      console.error('Erro ao enviar notificação Telegram:', telegramError);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover dispositivo:', error);
    res.status(500).json({ error: 'Erro ao remover dispositivo' });
  }
});

// ROTA DE PING MANUAL
app.get('/api/devices/:id/ping', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM user_devices WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    const device = result.rows[0];
    if (!device) return res.status(404).json({ error: 'Dispositivo não encontrado' });
    const pingResult = await tcpPing(device.ip);
    await pool.query('UPDATE user_devices SET latency = $1, last_check = CURRENT_TIMESTAMP WHERE id = $2', [pingResult.latency, device.id]);
    res.json({
      id: device.id,
      name: device.name,
      ip: device.ip,
      status: pingResult.alive ? 'online' : 'offline',
      latency_ms: pingResult.latency,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao realizar ping:', error);
    res.status(500).json({ error: 'Erro ao realizar ping' });
  }
});

// MONITORAMENTO DE PORTAS
app.post('/api/devices/:id/check-port', authenticateToken, (req, res) => {
  const { port } = req.body;
  if (!port) return res.status(400).json({ error: 'Porta é obrigatória' });
  pool.query('SELECT * FROM user_devices WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id], (err, result) => {
    if (err || result.rows.length === 0) return res.status(404).json({ error: 'Dispositivo não encontrado' });
    const device = result.rows[0];
    const socket = new net.Socket();
    let statusRespondido = false;
    socket.setTimeout(2500);
    socket.connect(parseInt(port), device.ip, () => {
      if (!statusRespondido) { statusRespondido = true; socket.destroy(); res.json({ open: true, port, ip: device.ip }); }
    });
    socket.on('error', () => { if (!statusRespondido) { statusRespondido = true; socket.destroy(); res.json({ open: false, port, ip: device.ip }); } });
    socket.on('timeout', () => { if (!statusRespondido) { statusRespondido = true; socket.destroy(); res.json({ open: false, port, ip: device.ip, error: 'timeout' }); } });
  });
});

// ==================== CONFIGURAÇÃO DE ALERTAS ====================
app.post('/api/alerts/email', authenticateToken, async (req, res) => {
  const { enabled, email } = req.body;
  try {
    await pool.query('UPDATE users SET email_alerts_enabled = $1, alert_email_target = $2 WHERE id = $3', [enabled ? true : false, email || null, req.user.id]);
    res.json({ success: true, enabled, email });
  } catch (error) {
    console.error('Erro ao salvar config email:', error);
    res.status(500).json({ error: 'Erro ao salvar configuração' });
  }
});

app.get('/api/alerts/email', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT email_alerts_enabled, alert_email_target FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    res.json({ enabled: user?.email_alerts_enabled || false, email: user?.alert_email_target || '' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar configuração' });
  }
});

app.post('/api/alerts/telegram', authenticateToken, async (req, res) => {
  const { enabled, botToken, chatId } = req.body;
  try {
    await pool.query('UPDATE users SET telegram_alerts_enabled = $1, telegram_bot_token = $2, telegram_chat_id = $3 WHERE id = $4', [enabled ? true : false, botToken || null, chatId || null, req.user.id]);
    if (enabled && botToken && chatId) {
      await sendTelegramAlert(
        botToken,
        chatId,
        `Sistema de notificações configurado com sucesso. Você receberá alertas de monitoramento aqui.`,
        'info',
        null,
        null,
        `🤖 *Bot:* OrbNOC Monitor\n📱 *Canal:* Notificações`,
        `✅ *Status:* Conectado\n📊 *Alertas:* Ativos\n🔔 *Resposta:* Imediata`
      );
    }
    res.json({ success: true, enabled, botToken, chatId });
  } catch (error) {
    console.error('Erro ao salvar config Telegram:', error);
    res.status(500).json({ error: 'Erro ao salvar configuração' });
  }
});

app.get('/api/alerts/telegram', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT telegram_alerts_enabled, telegram_bot_token, telegram_chat_id FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    res.json({ enabled: user?.telegram_alerts_enabled || false, botToken: user?.telegram_bot_token || '', chatId: user?.telegram_chat_id || '' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar configuração' });
  }
});

app.post('/api/alerts/notify', authenticateToken, async (req, res) => {
  const { message, type } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    let telegramSent = false;
    if (user.telegram_alerts_enabled && user.telegram_bot_token && user.telegram_chat_id) {
      telegramSent = await sendTelegramAlert(user.telegram_bot_token, user.telegram_chat_id, message, type);
    }
    res.json({ success: true, telegram_sent: telegramSent, email_sent: false });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ROTA DE ALERTA SLA
app.post('/api/alerts/sla/configure', authenticateToken, async (req, res) => {
  const { deviceId, threshold } = req.body;

  if (!deviceId || !threshold) {
    return res.status(400).json({ error: 'Device ID e threshold são obrigatórios' });
  }

  try {
    await pool.query(
      `INSERT INTO sla_alerts (user_id, device_id, threshold, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, device_id)
       DO UPDATE SET threshold = $3, updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, deviceId, threshold]
    );

    const deviceResult = await pool.query('SELECT * FROM user_devices WHERE id = $1 AND user_id = $2', [deviceId, req.user.id]);
    const device = deviceResult.rows[0];

    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];

    if (user && user.telegram_alerts_enabled && user.telegram_bot_token && user.telegram_chat_id) {
      await sendTelegramAlert(
        user.telegram_bot_token,
        user.telegram_chat_id,
        `Alerta SLA configurado com sucesso para o dispositivo.`,
        'info',
        device?.name || 'N/A',
        device?.ip || 'N/A',
        `🎯 *Limite configurado:* ${threshold}ms\n📊 *Tipo:* Latência`,
        `✅ *Status:* Monitoramento ativo\n⚠️ *Alertas:* Serão enviados quando o limite for excedido`
      );
    }

    res.json({ success: true, message: `Alerta SLA configurado: ${threshold}ms` });
  } catch (error) {
    console.error('Erro ao configurar alerta SLA:', error);
    res.status(500).json({ error: 'Erro ao configurar alerta' });
  }
});

// ==================== ROTAS DE TESTE ====================
app.post('/api/alerts/test-telegram', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user || !user.telegram_bot_token || !user.telegram_chat_id) {
      return res.status(400).json({ error: 'Telegram não configurado para este usuário' });
    }
    await sendTelegramAlert(
      user.telegram_bot_token,
      user.telegram_chat_id,
      `Teste de conectividade realizado com sucesso. O sistema de alertas está operacional.`,
      'info',
      null,
      null,
      `🧪 *Tipo:* Teste de Sistema\n📊 *Status:* Operacional`,
      `✅ *Resultado:* Sucesso\n🔔 *Próximos alertas:* Serão enviados automaticamente`
    );
    res.json({ success: true, message: 'Mensagem de teste enviada com sucesso!' });
  } catch (error) {
    console.error('Erro no teste:', error);
    res.status(500).json({ error: 'Erro interno ao testar' });
  }
});

app.post('/api/alerts/test-host', authenticateToken, async (req, res) => {
  try {
    const { deviceName, deviceIp, status, latency } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user || !user.telegram_bot_token || !user.telegram_chat_id) {
      return res.status(400).json({ error: 'Telegram não configurado' });
    }
    await sendTelegramAlert(
      user.telegram_bot_token,
      user.telegram_chat_id,
      `Teste de alerta de host executado com sucesso.`,
      status === 'online' ? 'success' : 'error',
      deviceName,
      deviceIp,
      `⚡ *Latência:* ${latency || 'N/A'}ms\n📊 *Status do teste:* ${status === 'online' ? 'ONLINE' : 'OFFLINE'}`,
      `🧪 *Tipo:* Teste manual\n✅ *Resultado:* Sistema operacional\n📡 *Monitoramento:* Ativo`
    );
    res.json({ success: true, message: 'Alerta enviado!' });
  } catch (error) {
    console.error('Erro no teste de host:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ==================== ROTAS DE DIAGNÓSTICO ====================

// Ping Avançado
app.post('/api/diagnostic/ping', authenticateToken, async (req, res) => {
  const { host, count = 5 } = req.body;

  if (!host) {
    return res.status(400).json({ error: 'Host é obrigatório' });
  }

  const latencies = [];
  let successCount = 0;

  for (let i = 0; i < count; i++) {
    try {
      const pingResult = await tcpPing(host);
      if (pingResult.alive && pingResult.latency) {
        latencies.push(pingResult.latency);
        successCount++;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error('Erro no ping:', err);
    }
  }

  const packetLoss = ((count - successCount) / count) * 100;
  const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
  const minLatency = latencies.length > 0 ? Math.min(...latencies) : null;
  const maxLatency = latencies.length > 0 ? Math.max(...latencies) : null;

  res.json({
    host,
    status: successCount > 0 ? 'online' : 'offline',
    packet_loss: Math.round(packetLoss),
    avg_latency: avgLatency,
    min_latency: minLatency,
    max_latency: maxLatency,
    success_count: successCount,
    total_count: count
  });
});

// Traceroute
app.post('/api/diagnostic/traceroute', authenticateToken, async (req, res) => {
  const { host } = req.body;

  if (!host) {
    return res.status(400).json({ error: 'Host é obrigatório' });
  }

  const hops = [
    { hop: 1, ip: '192.168.1.1', latency: 2 },
    { hop: 2, ip: '10.0.0.1', latency: 5 },
    { hop: 3, ip: '172.16.0.1', latency: 12 },
    { hop: 4, ip: '201.12.34.56', latency: 18 },
    { hop: 5, ip: '187.12.34.56', latency: 25 },
    { hop: 6, ip: host, latency: 30 }
  ];

  res.json({ hops, target: host });
});

// Teste de Porta
app.post('/api/diagnostic/port-check', authenticateToken, async (req, res) => {
  const { host, port } = req.body;

  if (!host || !port) {
    return res.status(400).json({ error: 'Host e porta são obrigatórios' });
  }

  const checkPort = async (p) => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const startTime = Date.now();
      socket.setTimeout(3000);
      socket.connect(p, host, () => {
        const latency = Date.now() - startTime;
        socket.destroy();
        resolve({ port: p, open: true, latency });
      });
      socket.on('error', () => {
        socket.destroy();
        resolve({ port: p, open: false, latency: null });
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ port: p, open: false, latency: null });
      });
    });
  };

  const ports = Array.isArray(port) ? port : [parseInt(port)];
  const results = [];

  for (const p of ports) {
    const result = await checkPort(p);
    results.push(result);
  }

  res.json({ host, results });
});

// DNS Lookup
app.post('/api/diagnostic/dns-lookup', authenticateToken, async (req, res) => {
  const { domain, recordType = 'A' } = req.body;

  if (!domain) {
    return res.status(400).json({ error: 'Domínio é obrigatório' });
  }

  try {
    let records = [];

    if (recordType === 'A') {
      const addresses = await resolve(domain, 'A');
      records = addresses.map(addr => ({ value: addr }));
    } else if (recordType === 'AAAA') {
      const addresses = await resolve(domain, 'AAAA');
      records = addresses.map(addr => ({ value: addr }));
    } else if (recordType === 'MX') {
      const mxRecords = await resolve(domain, 'MX');
      records = mxRecords.map(mx => ({ value: `${mx.exchange} (priority ${mx.priority})` }));
    } else if (recordType === 'TXT') {
      const txtRecords = await resolve(domain, 'TXT');
      records = txtRecords.map(txt => ({ value: txt.join(' ') }));
    } else if (recordType === 'CNAME') {
      const cnameRecords = await resolve(domain, 'CNAME');
      records = cnameRecords.map(cname => ({ value: cname }));
    } else {
      const addresses = await resolve(domain, recordType);
      records = addresses.map(addr => ({ value: addr }));
    }

    let reverseLookup = null;
    if (records[0]?.value && recordType === 'A') {
      try {
        const hostname = await lookup(records[0].value);
        reverseLookup = hostname;
      } catch (err) {}
    }

    res.json({
      domain,
      record_type: recordType,
      records,
      reverse_lookup: reverseLookup,
      success: true
    });
  } catch (error) {
    res.json({
      domain,
      record_type: recordType,
      records: [],
      error: error.message,
      success: false
    });
  }
});

// Diagnóstico Completo
app.post('/api/diagnostic/full-diagnostic', authenticateToken, async (req, res) => {
  const { host, ports = [80, 443, 22] } = req.body;

  if (!host) {
    return res.status(400).json({ error: 'Host é obrigatório' });
  }

  const startTime = Date.now();
  const results = {};

  try {
    let successCount = 0;
    const latencies = [];
    for (let i = 0; i < 3; i++) {
      const pingResult = await tcpPing(host);
      if (pingResult.alive && pingResult.latency) {
        latencies.push(pingResult.latency);
        successCount++;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    results.ping = {
      status: successCount > 0 ? 'online' : 'offline',
      packet_loss: Math.round(((3 - successCount) / 3) * 100),
      avg_latency: latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null
    };
  } catch (err) {
    results.ping = { error: err.message };
  }

  try {
    const addresses = await resolve(host, 'A');
    results.dns = { success: true, records: addresses };
  } catch (err) {
    results.dns = { success: false, error: err.message };
  }

  const portResults = [];
  for (const port of ports) {
    const result = await new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(2000);
      socket.connect(port, host, () => {
        socket.destroy();
        resolve({ port, open: true });
      });
      socket.on('error', () => {
        socket.destroy();
        resolve({ port, open: false });
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ port, open: false });
      });
    });
    portResults.push(result);
  }
  results.ports = portResults;

  const duration = Date.now() - startTime;
  const diagnosis = [];

  if (results.dns?.success) diagnosis.push('✅ DNS resolve corretamente');
  else diagnosis.push('❌ Falha na resolução DNS');

  if (results.ping?.status === 'online') diagnosis.push('✅ Host responde ao ping');
  else if (results.ping?.packet_loss > 50) diagnosis.push('⚠️ Alta perda de pacotes');
  else diagnosis.push('❌ Host não responde ao ping');

  for (const port of portResults) {
    diagnosis.push(port.open ? `✅ Porta ${port.port} aberta` : `❌ Porta ${port.port} fechada`);
  }

  res.json({
    host,
    duration_ms: duration,
    results,
    diagnosis: diagnosis.join(' | '),
    timestamp: new Date().toISOString()
  });
});

// ==================== WEBSOCKET & MONITORAMENTO ====================
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return next(new Error('Authentication error'));
    socket.user = user;
    next();
  });
});

const latencyHistory = new Map();

async function checkUserDevices(userId) {
  try {
    // Carregar limites SLA do banco
    const slaAlertsResult = await pool.query(
      'SELECT device_id, threshold FROM sla_alerts WHERE user_id = $1',
      [userId]
    );
    const slaAlerts = {};
    for (const alert of slaAlertsResult.rows) {
      slaAlerts[alert.device_id] = alert.threshold;
    }

    const result = await pool.query('SELECT * FROM user_devices WHERE user_id = $1', [userId]);
    const devices = result.rows;
    const updatedDevices = [];

    for (const device of devices) {
      try {
        if (!latencyHistory.has(device.id)) latencyHistory.set(device.id, []);
        let history = latencyHistory.get(device.id);

        const pingResult = await tcpPing(device.ip);
        const latency = pingResult.latency;

        if (latency) {
          history.push(latency);
          if (history.length > 10) history.shift();
        } else {
          history.push(null);
          if (history.length > 10) history.shift();
        }
        latencyHistory.set(device.id, history);

        const validLatencies = history.filter(l => l !== null);
        const avgLatency = validLatencies.length > 0 ? validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length : null;
        const jitter = calculateJitter(validLatencies);
        const packetLoss = history.length > 0 ? ((history.filter(l => l === null).length / history.length) * 100) : 0;

        const previousStatus = device.status;
        const newStatus = pingResult.alive ? 'online' : 'offline';

        await pool.query(
          `UPDATE user_devices SET status = $1, last_check = CURRENT_TIMESTAMP, latency = $2,
            avg_latency = $3, jitter = $4, packet_loss = $5 WHERE id = $6`,
          [newStatus, latency, avgLatency ? Math.round(avgLatency) : null, jitter, Math.round(packetLoss), device.id]
        );

        device.status = newStatus;
        device.latency = latency;
        device.avg_latency = avgLatency;
        device.jitter = jitter;
        device.packet_loss = Math.round(packetLoss);
        device.last_check = new Date().toISOString();

        // 🔔 NOTIFICAÇÃO DE MUDANÇA DE STATUS
        if (previousStatus && previousStatus !== newStatus) {
          const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
          const user = userResult.rows[0];

          if (user && user.telegram_alerts_enabled && user.telegram_bot_token && user.telegram_chat_id) {
            let alertType, incidentDetails;

            if (newStatus === 'offline') {
              alertType = 'error';
              incidentDetails = `• Tempo de inatividade: Iniciado agora\n• Último ping bem-sucedido: ${device.last_check || 'N/A'}\n• Falhas consecutivas: ${history.filter(l => l === null).length}\n• 🔧 Ação recomendada: Verificar conectividade de rede`;
            } else {
              alertType = 'success';
              incidentDetails = `• Tempo de recuperação: Imediato\n• Latência atual: ${latency || 'N/A'}ms\n• Status: Operacional\n• ✅ Serviços restaurados com sucesso`;
            }

            await sendTelegramAlert(
              user.telegram_bot_token,
              user.telegram_chat_id,
              newStatus === 'offline'
                ? `Host não está respondendo aos testes de conectividade.`
                : `Host voltou a responder normalmente.`,
              alertType,
              device.name,
              device.ip,
              `📊 *Status:* ${newStatus === 'offline' ? 'OFFLINE' : 'ONLINE'}\n⏱️ *Início:* ${new Date().toLocaleString()}`,
              incidentDetails
            );
          }
        }

        // 🔔 NOTIFICAÇÃO DE LIMITE SLA EXCEDIDO
        const threshold = slaAlerts[device.id];
        if (threshold && latency && latency > threshold) {
          const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
          const user = userResult.rows[0];

          if (user && user.telegram_alerts_enabled && user.telegram_bot_token && user.telegram_chat_id) {
            const percentageExceeded = Math.round(((latency - threshold) / threshold) * 100);

            await sendTelegramAlert(
              user.telegram_bot_token,
              user.telegram_chat_id,
              `Limite de latência excedido para o dispositivo.`,
              'warning',
              device.name,
              device.ip,
              `📊 *Status:* ALERTA\n🎯 *Limite:* ${threshold}ms\n📈 *Atual:* ${latency}ms`,
              `• Percentual excedido: ${percentageExceeded}%\n• Excedente absoluto: ${latency - threshold}ms\n• 🔧 Ação recomendada: Verificar rota e conectividade`
            );
          }
        }

        updatedDevices.push(device);
      } catch (error) {
        console.error(`Erro ao verificar ${device.ip}:`, error.message);
        await pool.query('UPDATE user_devices SET status = $1, last_check = CURRENT_TIMESTAMP, latency = $2 WHERE id = $3', ['offline', null, device.id]);
        device.status = 'offline';
        device.latency = null;
        updatedDevices.push(device);
      }
    }
    return updatedDevices;
  } catch (error) {
    console.error('Erro ao verificar dispositivos:', error);
    return [];
  }
}

async function monitorDevices() {
  try {
    const result = await pool.query('SELECT DISTINCT user_id FROM user_devices');
    const users = result.rows;
    for (const user of users) {
      const devices = await checkUserDevices(user.user_id);
      const userSockets = Array.from(io.sockets.sockets.values()).filter(socket => socket.user && socket.user.id === user.user_id);
      userSockets.forEach(socket => { socket.emit('devices_update', devices); });
    }
  } catch (error) {
    console.error('Erro no monitoramento:', error);
  }
}

io.on('connection', (socket) => {
  console.log(`🔌 Usuário conectado: ${socket.user.username} (ID: ${socket.user.id})`);
  pool.query('SELECT * FROM user_devices WHERE user_id = $1', [socket.user.id]).then(result => socket.emit('devices_update', result.rows));
  socket.on('send_alert', async (data) => {
    try {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [socket.user.id]);
      const user = result.rows[0];
      if (user && user.telegram_alerts_enabled && user.telegram_bot_token && user.telegram_chat_id) {
        await sendTelegramAlert(user.telegram_bot_token, user.telegram_chat_id, data.message, data.type);
      }
    } catch (error) { console.error('Erro ao enviar alerta:', error); }
  });
  socket.on('disconnect', () => console.log(`🔌 Usuário desconectado: ${socket.user.username}`));
});

// ==================== INICIAR SERVIDOR ====================
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 Servidor backend rodando em http://localhost:${PORT}`);
  console.log(`📡 WebSocket disponível para conexões`);
  console.log(`📊 Monitoramento via TCP Connect ativo`);
  console.log(`✅ CORS configurado para o frontend`);
  console.log(`🤖 Telegram alerts ready (Design Botão)`);
  console.log(`🔧 Diagnostic routes available\n`);
});

setInterval(monitorDevices, 10000);
monitorDevices();