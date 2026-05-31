require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const ping = require('ping');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const net = require('net');
const db = require('./database');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'orbnoc_secret_key_2024_change_this_in_production';

// CORS corrigido
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// Log de todas as requisições
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// ==================== FUNÇÕES AUXILIARES ====================

function calculateJitter(latencies) {
  if (latencies.length < 2) return 0;
  let jitter = 0;
  for (let i = 1; i < latencies.length; i++) {
    jitter += Math.abs(latencies[i] - latencies[i-1]);
  }
  return Math.round(jitter / (latencies.length - 1));
}

// Função para enviar alerta via Telegram
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

// ==================== MIDDLEWARE ====================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// ==================== ROTAS DE AUTENTICAÇÃO ====================

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Usuário ou email já existe' });
          }
          return res.status(500).json({ error: 'Erro ao criar usuário' });
        }

        const token = jwt.sign({ id: this.lastID, username, role: 'user' }, JWT_SECRET, { expiresIn: '24h' });

        db.run('INSERT INTO access_logs (user_id, action, ip_address) VALUES (?, ?, ?)',
          [this.lastID, 'register', req.ip]);

        res.json({
          success: true,
          token,
          user: { id: this.lastID, username, email, role: 'user' }
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }

  db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username], async (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    db.run('INSERT INTO access_logs (user_id, action, ip_address) VALUES (?, ?, ?)',
      [user.id, 'login', req.ip]);

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    });
  });
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
  db.run('INSERT INTO access_logs (user_id, action, ip_address) VALUES (?, ?, ?)',
    [req.user.id, 'logout', req.ip]);
  res.json({ success: true });
});

// ==================== ROTAS DE DISPOSITIVOS ====================

app.get('/api/devices', authenticateToken, (req, res) => {
  db.all('SELECT * FROM user_devices WHERE user_id = ? ORDER BY id', [req.user.id], (err, devices) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar dispositivos' });
    }
    res.json(devices);
  });
});

app.post('/api/devices', authenticateToken, (req, res) => {
  const { name, ip, location } = req.body;

  db.run(
    'INSERT INTO user_devices (user_id, device_id, name, ip, location) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, Date.now(), name, ip, location],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Erro ao adicionar dispositivo' });
      }

      db.get('SELECT * FROM user_devices WHERE id = ?', [this.lastID], (err, device) => {
        res.json(device);
      });
    }
  );
});

app.delete('/api/devices/:id', authenticateToken, (req, res) => {
  db.run(
    'DELETE FROM user_devices WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Erro ao remover dispositivo' });
      }
      res.json({ success: true });
    }
  );
});

// ==================== ROTA DE PING MANUAL ====================

app.get('/api/devices/:id/ping', authenticateToken, async (req, res) => {
  try {
    db.get('SELECT * FROM user_devices WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id], async (err, device) => {
        if (err || !device) {
          return res.status(404).json({ error: 'Dispositivo não encontrado' });
        }

        const startTime = Date.now();
        const result = await ping.promise.probe(device.ip, {
          timeout: 2,
          extra: ['-n', '1']
        });
        const endTime = Date.now();

        const latency = result.alive ? endTime - startTime : null;

        db.run('UPDATE user_devices SET latency = ?, last_check = CURRENT_TIMESTAMP WHERE id = ?',
          [latency, device.id]);

        res.json({
          id: device.id,
          name: device.name,
          ip: device.ip,
          status: result.alive ? 'online' : 'offline',
          latency_ms: latency,
          timestamp: new Date().toISOString()
        });
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao realizar ping' });
  }
});

// ==================== MONITORAMENTO DE PORTAS TCP ====================

app.post('/api/devices/:id/check-port', authenticateToken, (req, res) => {
  const { port } = req.body;
  if (!port) return res.status(400).json({ error: 'Porta é obrigatória' });

  db.get('SELECT * FROM user_devices WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err, device) => {
    if (err || !device) return res.status(404).json({ error: 'Dispositivo não encontrado' });

    const socket = new net.Socket();
    let statusRespondido = false;

    socket.setTimeout(2500);

    socket.connect(parseInt(port), device.ip, () => {
      if (!statusRespondido) {
        statusRespondido = true;
        socket.destroy();
        res.json({ open: true, port, ip: device.ip });
      }
    });

    socket.on('error', () => {
      if (!statusRespondido) {
        statusRespondido = true;
        socket.destroy();
        res.json({ open: false, port, ip: device.ip });
      }
    });

    socket.on('timeout', () => {
      if (!statusRespondido) {
        statusRespondido = true;
        socket.destroy();
        res.json({ open: false, port, ip: device.ip, error: 'timeout' });
      }
    });
  });
});

// ==================== CONFIGURAÇÃO DE ALERTAS (SALVAR NO BANCO) ====================

// Salvar configuração de alerta por email
app.post('/api/alerts/email', authenticateToken, (req, res) => {
  const { enabled, email } = req.body;

  db.run(
    'UPDATE users SET email_alerts_enabled = ?, alert_email_target = ? WHERE id = ?',
    [enabled ? 1 : 0, email || null, req.user.id],
    function(err) {
      if (err) {
        console.error('Erro ao salvar config email:', err);
        return res.status(500).json({ error: 'Erro ao salvar configuração' });
      }
      console.log(`Configuração de email salva para usuário ${req.user.id}: enabled=${enabled}, email=${email}`);
      res.json({ success: true, enabled, email });
    }
  );
});

// Buscar configuração de alerta por email
app.get('/api/alerts/email', authenticateToken, (req, res) => {
  db.get('SELECT email_alerts_enabled, alert_email_target FROM users WHERE id = ?', [req.user.id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar configuração' });
    }
    res.json({
      enabled: result?.email_alerts_enabled === 1,
      email: result?.alert_email_target || ''
    });
  });
});

// Salvar configuração de alerta do Telegram
app.post('/api/alerts/telegram', authenticateToken, (req, res) => {
  const { enabled, botToken, chatId } = req.body;

  db.run(
    'UPDATE users SET telegram_alerts_enabled = ?, telegram_bot_token = ?, telegram_chat_id = ? WHERE id = ?',
    [enabled ? 1 : 0, botToken || null, chatId || null, req.user.id],
    function(err) {
      if (err) {
        console.error('Erro ao salvar config Telegram:', err);
        return res.status(500).json({ error: 'Erro ao salvar configuração' });
      }
      console.log(`Configuração do Telegram salva para usuário ${req.user.id}: enabled=${enabled}, botToken=${botToken ? '***' : 'null'}, chatId=${chatId}`);

      // Testar a conexão com o Telegram
      if (enabled && botToken && chatId) {
        sendTelegramAlert(botToken, chatId, '✅ OrbNOC: Configuração do Telegram ativada com sucesso!', 'success')
          .then(success => {
            if (!success) {
              console.warn('⚠️ Teste de conexão com Telegram falhou');
            }
          });
      }

      res.json({ success: true, enabled, botToken, chatId });
    }
  );
});

// Buscar configuração de alerta do Telegram
app.get('/api/alerts/telegram', authenticateToken, (req, res) => {
  db.get('SELECT telegram_alerts_enabled, telegram_bot_token, telegram_chat_id FROM users WHERE id = ?', [req.user.id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar configuração' });
    }
    res.json({
      enabled: result?.telegram_alerts_enabled === 1,
      botToken: result?.telegram_bot_token || '',
      chatId: result?.telegram_chat_id || ''
    });
  });
});

// Endpoint para disparar alertas (usado pelo sistema)
app.post('/api/alerts/notify', authenticateToken, async (req, res) => {
  const { message, type } = req.body;

  db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    console.log(`🚨 [ALERTA] Usuário: ${user.username} - ${message} (${type})`);

    let telegramSent = false;
    let emailSent = false;

    // Envio para o Telegram
    if (user.telegram_alerts_enabled && user.telegram_bot_token && user.telegram_chat_id) {
      telegramSent = await sendTelegramAlert(user.telegram_bot_token, user.telegram_chat_id, message, type);
      if (telegramSent) {
        console.log(`✅ Alerta enviado via Telegram para ${user.username}`);
      } else {
        console.error(`❌ Falha ao enviar alerta via Telegram para ${user.username}`);
      }
    } else {
      console.log(`ℹ️ Telegram não configurado para ${user.username}`);
    }

    // Envio para Email (placeholder)
    if (user.email_alerts_enabled && user.alert_email_target) {
      console.log(`📧 Email alerta para ${user.alert_email_target}: ${message}`);
      emailSent = true;
    }

    res.json({
      success: true,
      telegram_sent: telegramSent,
      email_sent: emailSent
    });
  });
});

// ==================== WEBSOCKET & MONITORAMENTO INTERNO ====================

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return next(new Error('Authentication error'));
    }
    socket.user = user;
    next();
  });
});

const latencyHistory = new Map();

async function checkUserDevices(userId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM user_devices WHERE user_id = ?', [userId], async (err, devices) => {
      if (err) {
        reject(err);
        return;
      }

      const updatedDevices = [];
      for (const device of devices) {
        try {
          if (!latencyHistory.has(device.id)) {
            latencyHistory.set(device.id, []);
          }
          let history = latencyHistory.get(device.id);

          const startTime = Date.now();
          const res = await ping.promise.probe(device.ip, {
            timeout: 2,
            extra: ['-n', '1']
          });
          const endTime = Date.now();

          const latency = res.alive ? endTime - startTime : null;

          if (latency) {
            history.push(latency);
            if (history.length > 10) history.shift();
          } else {
            history.push(null);
            if (history.length > 10) history.shift();
          }
          latencyHistory.set(device.id, history);

          const validLatencies = history.filter(l => l !== null);
          const avgLatency = validLatencies.length > 0
            ? validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length
            : null;
          const minLatency = validLatencies.length > 0 ? Math.min(...validLatencies) : null;
          const maxLatency = validLatencies.length > 0 ? Math.max(...validLatencies) : null;
          const jitter = calculateJitter(validLatencies);
          const packetLoss = history.length > 0
            ? ((history.filter(l => l === null).length / history.length) * 100)
            : 0;

          const previousStatus = device.status;
          device.status = res.alive ? 'online' : 'offline';
          device.last_check = new Date().toISOString();
          device.latency = latency;
          device.avg_latency = avgLatency ? Math.round(avgLatency) : null;
          device.min_latency = minLatency;
          device.max_latency = maxLatency;
          device.jitter = jitter;
          device.packet_loss = Math.round(packetLoss);

          db.run(`UPDATE user_devices SET
            status = ?,
            last_check = ?,
            latency = ?,
            avg_latency = ?,
            min_latency = ?,
            max_latency = ?,
            jitter = ?,
            packet_loss = ?,
            last_ping_stats = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [device.status, device.last_check, latency, avgLatency, minLatency, maxLatency, jitter, packetLoss, device.id]);

          // Disparar alerta se o status mudou
          if (previousStatus && previousStatus !== device.status) {
            const user = await new Promise((resolve) => {
              db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => resolve(user));
            });

            if (user && user.telegram_alerts_enabled && user.telegram_bot_token && user.telegram_chat_id) {
              const alertMessage = device.status === 'offline'
                ? `🔴 HOST OFFLINE: ${device.name} (${device.ip}) está fora do ar!`
                : `🟢 HOST ONLINE: ${device.name} (${device.ip}) está novamente online!`;

              await sendTelegramAlert(user.telegram_bot_token, user.telegram_chat_id, alertMessage, device.status === 'offline' ? 'error' : 'success');
            }
          }

          updatedDevices.push(device);
        } catch (error) {
          console.error(`Erro ao pingar ${device.ip}:`, error.message);
          device.status = 'offline';
          device.latency = null;
          db.run('UPDATE user_devices SET status = ?, last_check = CURRENT_TIMESTAMP, latency = ? WHERE id = ?',
            ['offline', null, device.id]);
          updatedDevices.push(device);
        }
      }
      resolve(updatedDevices);
    });
  });
}

async function monitorDevices() {
  db.all('SELECT DISTINCT user_id FROM user_devices', (err, users) => {
    if (err) return;

    users.forEach(async (user) => {
      const devices = await checkUserDevices(user.user_id);

      const userSockets = Array.from(io.sockets.sockets.values())
        .filter(socket => socket.user && socket.user.id === user.user_id);

      userSockets.forEach(socket => {
        socket.emit('devices_update', devices);
      });
    });
  });
}

io.on('connection', (socket) => {
  console.log(`🔌 Usuário conectado: ${socket.user.username} (ID: ${socket.user.id})`);

  db.all('SELECT * FROM user_devices WHERE user_id = ?', [socket.user.id], (err, devices) => {
    if (!err) {
      socket.emit('devices_update', devices);
    }
  });

  // Escutar eventos de alerta do frontend
  socket.on('send_alert', async (data) => {
    const { message, type } = data;

    db.get('SELECT * FROM users WHERE id = ?', [socket.user.id], async (err, user) => {
      if (err || !user) return;

      if (user.telegram_alerts_enabled && user.telegram_bot_token && user.telegram_chat_id) {
        await sendTelegramAlert(user.telegram_bot_token, user.telegram_chat_id, message, type);
      }
    });
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Usuário desconectado: ${socket.user.username}`);
  });
});

// Iniciar monitoramento (a cada 10 segundos)
setInterval(monitorDevices, 10000);
monitorDevices();

// ==================== INICIAR SERVIDOR ====================

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 Servidor backend rodando em http://localhost:${PORT}`);
  console.log(`📡 WebSocket disponível para conexões`);
  console.log(`📊 Monitoramento de latência e portas ativo`);
  console.log(`✅ CORS configurado para todas as origens`);
  console.log(`🤖 Telegram alerts ready\n`);
});