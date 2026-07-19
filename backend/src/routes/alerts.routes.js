const express = require('express');

const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { sendTelegramAlert } = require('../services/telegramService');

const router = express.Router();

router.post('/email', authenticateToken, async (req, res) => {
  const { enabled, email } = req.body;
  try {
    await pool.query('UPDATE users SET email_alerts_enabled = $1, alert_email_target = $2 WHERE id = $3', [enabled ? true : false, email || null, req.user.id]);
    res.json({ success: true, enabled, email });
  } catch (error) {
    console.error('Erro ao salvar config email:', error);
    res.status(500).json({ error: 'Erro ao salvar configuração' });
  }
});

router.get('/email', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT email_alerts_enabled, alert_email_target FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    res.json({ enabled: user?.email_alerts_enabled || false, email: user?.alert_email_target || '' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar configuração' });
  }
});

router.post('/telegram', authenticateToken, async (req, res) => {
  const { enabled, botToken, chatId } = req.body;
  try {
    await pool.query('UPDATE users SET telegram_alerts_enabled = $1, telegram_bot_token = $2, telegram_chat_id = $3 WHERE id = $4', [enabled ? true : false, botToken || null, chatId || null, req.user.id]);
    if (enabled && botToken && chatId) {
      await sendTelegramAlert(botToken, chatId, `Sistema de notificações configurado com sucesso.`, 'info', null, null, null);
    }
    res.json({ success: true, enabled, botToken, chatId });
  } catch (error) {
    console.error('Erro ao salvar config Telegram:', error);
    res.status(500).json({ error: 'Erro ao salvar configuração' });
  }
});

router.get('/telegram', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT telegram_alerts_enabled, telegram_bot_token, telegram_chat_id FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    res.json({ enabled: user?.telegram_alerts_enabled || false, botToken: user?.telegram_bot_token || '', chatId: user?.telegram_chat_id || '' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar configuração' });
  }
});

router.post('/notify', authenticateToken, async (req, res) => {
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

router.post('/sla/configure', authenticateToken, async (req, res) => {
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
        `Alerta SLA configurado com sucesso.`,
        'info',
        device?.name || 'N/A',
        device?.ip || 'N/A',
        `🎯 *Limite:* ${threshold}ms`
      );
    }

    res.json({ success: true, message: `Alerta SLA configurado: ${threshold}ms` });
  } catch (error) {
    console.error('Erro ao configurar alerta SLA:', error);
    res.status(500).json({ error: 'Erro ao configurar alerta' });
  }
});

router.post('/test-telegram', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user || !user.telegram_bot_token || !user.telegram_chat_id) {
      return res.status(400).json({ error: 'Telegram não configurado para este usuário' });
    }
    await sendTelegramAlert(user.telegram_bot_token, user.telegram_chat_id, `Teste de conectividade realizado com sucesso.`, 'info', null, null, null);
    res.json({ success: true, message: 'Mensagem de teste enviada com sucesso!' });
  } catch (error) {
    console.error('Erro no teste:', error);
    res.status(500).json({ error: 'Erro interno ao testar' });
  }
});

router.post('/test-host', authenticateToken, async (req, res) => {
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
      `Teste de alerta executado com sucesso.`,
      status === 'online' ? 'success' : 'error',
      deviceName,
      deviceIp,
      `⚡ *Latência:* ${latency || 'N/A'}ms`
    );
    res.json({ success: true, message: 'Alerta enviado!' });
  } catch (error) {
    console.error('Erro no teste de host:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
