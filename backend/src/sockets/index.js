const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

const { pool } = require('../config/database');
const { JWT_SECRET, FRONTEND_URL } = require('../config/env');
const { sendTelegramAlert } = require('../services/telegramService');

function createSocketServer(httpServer) {
  const io = socketIo(httpServer, {
    cors: {
      origin: FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) return next(new Error('Authentication error'));
      socket.user = user;
      next();
    });
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Usuário conectado: ${socket.user.username} (ID: ${socket.user.id})`);

    pool.query('SELECT * FROM user_devices WHERE user_id = $1', [socket.user.id])
      .then((result) => socket.emit('devices_update', result.rows));

    socket.on('send_alert', async (data) => {
      try {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [socket.user.id]);
        const user = result.rows[0];
        if (user && user.telegram_alerts_enabled && user.telegram_bot_token && user.telegram_chat_id) {
          await sendTelegramAlert(user.telegram_bot_token, user.telegram_chat_id, data.message, data.type);
        }
      } catch (error) {
        console.error('Erro ao enviar alerta:', error);
      }
    });

    socket.on('disconnect', () => console.log(`🔌 Usuário desconectado: ${socket.user.username}`));
  });

  return io;
}

module.exports = { createSocketServer };
