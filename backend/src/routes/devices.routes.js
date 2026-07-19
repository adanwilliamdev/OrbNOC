const express = require('express');

const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { tcpPing, checkPort } = require('../services/pingService');
const { sendTelegramAlert } = require('../services/telegramService');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM user_devices WHERE user_id = $1 ORDER BY id', [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar dispositivos:', error);
    res.status(500).json({ error: 'Erro ao buscar dispositivos' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
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

    try {
      const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
      const user = userResult.rows[0];

      if (user && user.telegram_alerts_enabled && user.telegram_bot_token && user.telegram_chat_id) {
        await sendTelegramAlert(
          user.telegram_bot_token,
          user.telegram_chat_id,
          `Dispositivo adicionado ao monitoramento.`,
          'added',
          name,
          ip,
          `📍 *Localização:* ${location || 'Não informada'}`
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

router.delete('/:id', authenticateToken, async (req, res) => {
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
          `Dispositivo removido do monitoramento.`,
          'removed',
          removedDevice.name,
          removedDevice.ip,
          null
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

router.get('/:id/ping', authenticateToken, async (req, res) => {
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
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao realizar ping:', error);
    res.status(500).json({ error: 'Erro ao realizar ping' });
  }
});

router.post('/:id/check-port', authenticateToken, async (req, res) => {
  const { port } = req.body;
  if (!port) return res.status(400).json({ error: 'Porta é obrigatória' });

  try {
    const result = await pool.query('SELECT * FROM user_devices WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Dispositivo não encontrado' });
    const device = result.rows[0];

    const portResult = await checkPort(device.ip, parseInt(port, 10), 2500);
    res.json({
      open: portResult.open,
      port,
      ip: device.ip,
      ...(portResult.timedOut ? { error: 'timeout' } : {}),
    });
  } catch (error) {
    res.status(404).json({ error: 'Dispositivo não encontrado' });
  }
});

module.exports = router;
