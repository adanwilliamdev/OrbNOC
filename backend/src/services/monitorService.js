const { pool } = require('../config/database');
const { tcpPing, icmpPing, calculateJitter } = require('./pingService');
const { sendTelegramAlert } = require('./telegramService');

// Histórico de latências recentes por dispositivo (em memória), usado para
// calcular jitter e packet loss numa janela deslizante das últimas 10 leituras.
const latencyHistory = new Map();

async function notifyStatusChange(user, device, previousStatus, newStatus, latency) {
  if (!previousStatus || previousStatus === newStatus) return;
  if (!(user && user.telegram_alerts_enabled && user.telegram_bot_token && user.telegram_chat_id)) return;

  const alertType = newStatus === 'offline' ? 'error' : 'success';
  const extraInfo = newStatus === 'offline'
    ? `📊 *Status:* OFFLINE`
    : `📊 *Status:* ONLINE\n⚡ *Latência:* ${latency || 'N/A'}ms`;

  await sendTelegramAlert(
    user.telegram_bot_token,
    user.telegram_chat_id,
    newStatus === 'offline' ? `Host não está respondendo aos testes.` : `Host voltou a responder normalmente.`,
    alertType,
    device.name,
    device.ip,
    extraInfo
  );
}

async function notifySlaBreach(user, device, threshold, latency) {
  if (!threshold || !latency || latency <= threshold) return;
  if (!(user && user.telegram_alerts_enabled && user.telegram_bot_token && user.telegram_chat_id)) return;

  await sendTelegramAlert(
    user.telegram_bot_token,
    user.telegram_chat_id,
    `Limite de latência excedido!`,
    'warning',
    device.name,
    device.ip,
    `🎯 *Limite:* ${threshold}ms\n📈 *Atual:* ${latency}ms\n⚠️ *Excedente:* ${latency - threshold}ms`
  );
}

/** Faz ping em todos os dispositivos de um usuário, atualiza o banco e dispara alertas. */
async function checkUserDevices(userId) {
  try {
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
        const history = latencyHistory.get(device.id);

        // ICMP é mais confiável para detectar dispositivos que não expõem
        // portas TCP (celulares, IoT, etc). Se o ICMP falhar (ex: firewall
        // bloqueando ping mas liberando alguma porta), tenta TCP como fallback.
        let pingResult = await icmpPing(device.ip);
        if (!pingResult.alive) {
          const tcpResult = await tcpPing(device.ip);
          if (tcpResult.alive) pingResult = tcpResult;
        }
        const latency = pingResult.latency;

        history.push(latency ?? null);
        if (history.length > 10) history.shift();
        latencyHistory.set(device.id, history);

        const validLatencies = history.filter((l) => l !== null);
        const avgLatency = validLatencies.length > 0
          ? validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length
          : null;
        const jitter = calculateJitter(validLatencies);
        const packetLoss = history.length > 0
          ? (history.filter((l) => l === null).length / history.length) * 100
          : 0;

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

        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        const user = userResult.rows[0];

        await notifyStatusChange(user, device, previousStatus, newStatus, latency);
        await notifySlaBreach(user, device, slaAlerts[device.id], latency);

        updatedDevices.push(device);
      } catch (error) {
        console.error(`Erro ao verificar ${device.ip}:`, error.message);
        await pool.query(
          'UPDATE user_devices SET status = $1, last_check = CURRENT_TIMESTAMP, latency = $2 WHERE id = $3',
          ['offline', null, device.id]
        );
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

/** Percorre todos os usuários com dispositivos cadastrados e emite atualizações via socket. */
async function monitorAllUsers(io) {
  try {
    const result = await pool.query('SELECT DISTINCT user_id FROM user_devices');
    const users = result.rows;
    for (const user of users) {
      const devices = await checkUserDevices(user.user_id);
      const userSockets = Array.from(io.sockets.sockets.values())
        .filter((socket) => socket.user && socket.user.id === user.user_id);
      userSockets.forEach((socket) => socket.emit('devices_update', devices));
    }
  } catch (error) {
    console.error('Erro no monitoramento:', error);
  }
}

module.exports = { checkUserDevices, monitorAllUsers };
