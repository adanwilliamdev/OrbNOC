require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const net = require('net');
const { Pool } = require('pg');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'orbnoc_secret_key_2024_change_this_in_production';

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
async function tcpPing(ip, timeout = 3000) {
  const ports = [80, 443];
  for (const port of ports) {
    try {
      const latency = await new Promise((resolve) => {
        const startTime = Date.now();
        const socket = new net.Socket();
        socket.setTimeout(timeout);
        socket.connect(port, ip, () => {
          const latency = Date.now() - startTime;
          socket.destroy();
          resolve(latency);
        });
        socket.on('error', () => {
          socket.destroy();
          resolve(null);
        });
        socket.on('timeout', () => {
          socket.destroy();
          resolve(null);
        });
      });
      if (latency !== null) {
        return { alive: true, latency, port };
      }
    } catch (err) {
      continue;
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

// ==================== FUNÇÃO TELEGRAM ====================
async function sendTelegramAlert(botToken, chatId, message, type) {
  if (!botToken || !chatId) return false;

  const emoji = type === 'error' ? '🔴' : type === 'warning' ? '⚠️' : '🟢';
  const text = `${emoji} *OrbNOC Alert*\n\n${message}\n\n🕐 ${new Date().toLocaleString('pt-BR')}`;

  try {
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
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

app.post('/api/devices', authenticateToken, async (req, res) => {
  const { name, ip, location } = req.body;
  try {
    const result = await pool.query('INSERT INTO user_devices (user_id, device_id, name, ip, location) VALUES ($1, $2, $3, $4, $5) RETURNING *', [req.user.id, Date.now(), name, ip, location || null]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao adicionar dispositivo:', error);
    res.status(500).json({ error: 'Erro ao adicionar dispositivo' });
  }
});

app.delete('/api/devices/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM user_devices WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover dispositivo:', error);
    res.status(500).json({ error: 'Erro ao remover dispositivo' });
  }
});

// ==================== ROTA DE PING MANUAL ====================
app.get('/api/devices/:id/ping', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM user_devices WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    const device = result.rows[0];
    if (!device) return res.status(404).json({ error: 'Dispositivo não encontrado' });
    const pingResult = await tcpPing(device.ip);
    await pool.query('UPDATE user_devices SET latency = $1, last_check = CURRENT_TIMESTAMP WHERE id = $2', [pingResult.latency, device.id]);
    res.json({ id: device.id, name: device.name, ip: device.ip, status: pingResult.alive ? 'online' : 'offline', latency_ms: pingResult.latency, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Erro ao realizar ping:', error);
    res.status(500).json({ error: 'Erro ao realizar ping' });
  }
});

// ==================== MONITORAMENTO DE PORTAS ====================
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
      await sendTelegramAlert(botToken, chatId, '✅ OrbNOC: Configuração do Telegram ativada com sucesso!', 'success');
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

// ==================== ROTAS DE TESTE ====================
app.post('/api/alerts/test-telegram', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user || !user.telegram_bot_token || !user.telegram_chat_id) {
      return res.status(400).json({ error: 'Telegram não configurado para este usuário' });
    }
    const testMessage = '🧪 *Teste OrbNOC*\n\nSe você recebeu esta mensagem, o Telegram está funcionando perfeitamente!';
    const sent = await sendTelegramAlert(user.telegram_bot_token, user.telegram_chat_id, testMessage, 'success');
    if (sent) {
      res.json({ success: true, message: 'Mensagem de teste enviada com sucesso!' });
    } else {
      res.status(500).json({ error: 'Falha ao enviar mensagem' });
    }
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
    let alertMessage, alertType;
    if (status === 'online') {
      alertMessage = `🟢 *HOST ONLINE* 🟢\n\n• Nome: ${deviceName}\n• IP: ${deviceIp}\n• Latência: ${latency}ms\n\n🕐 ${new Date().toLocaleString('pt-BR')}`;
      alertType = 'success';
    } else {
      alertMessage = `🔴 *HOST OFFLINE* 🔴\n\n• Nome: ${deviceName}\n• IP: ${deviceIp}\n\n🕐 ${new Date().toLocaleString('pt-BR')}`;
      alertType = 'error';
    }
    const sent = await sendTelegramAlert(user.telegram_bot_token, user.telegram_chat_id, alertMessage, alertType);
    res.json({ success: sent, message: sent ? 'Alerta enviado!' : 'Falha no envio' });
  } catch (error) {
    console.error('Erro no teste de host:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
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
    const result = await pool.query('SELECT * FROM user_devices WHERE user_id = $1', [userId]);
    const devices = result.rows;
    const updatedDevices = [];
    for (const device of devices) {
      try {
        if (!latencyHistory.has(device.id)) latencyHistory.set(device.id, []);
        let history = latencyHistory.get(device.id);
        const pingResult = await tcpPing(device.ip);
        const latency = pingResult.latency;
        if (latency) { history.push(latency); if (history.length > 10) history.shift(); }
        else { history.push(null); if (history.length > 10) history.shift(); }
        latencyHistory.set(device.id, history);
        const validLatencies = history.filter(l => l !== null);
        const avgLatency = validLatencies.length > 0 ? validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length : null;
        const jitter = calculateJitter(validLatencies);
        const packetLoss = history.length > 0 ? ((history.filter(l => l === null).length / history.length) * 100) : 0;
        const previousStatus = device.status;
        const newStatus = pingResult.alive ? 'online' : 'offline';
        await pool.query(`UPDATE user_devices SET status = $1, last_check = CURRENT_TIMESTAMP, latency = $2, avg_latency = $3, jitter = $4, packet_loss = $5 WHERE id = $6`, [newStatus, latency, avgLatency ? Math.round(avgLatency) : null, jitter, Math.round(packetLoss), device.id]);
        device.status = newStatus;
        device.latency = latency;
        device.avg_latency = avgLatency;
        device.jitter = jitter;
        device.packet_loss = Math.round(packetLoss);
        device.last_check = new Date().toISOString();
        if (previousStatus && previousStatus !== newStatus && newStatus === 'offline') {
          const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
          const user = userResult.rows[0];
          if (user && user.telegram_alerts_enabled && user.telegram_bot_token && user.telegram_chat_id) {
            await sendTelegramAlert(user.telegram_bot_token, user.telegram_chat_id, `🔴 HOST OFFLINE: ${device.name} (${device.ip}) está fora do ar!`, 'error');
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

// ==================== ROTA DE DIAGNÓSTICO ====================
app.use('/api/diagnostic', require('./routes/diagnostic'));

// ==================== INICIAR SERVIDOR ====================
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 Servidor backend rodando em http://localhost:${PORT}`);
  console.log(`📡 WebSocket disponível para conexões`);
  console.log(`📊 Monitoramento via TCP Connect (portas 80/443) ativo`);
  console.log(`✅ CORS configurado para o frontend`);
  console.log(`🤖 Telegram alerts ready\n`);
});

setInterval(monitorDevices, 10000);
monitorDevices();