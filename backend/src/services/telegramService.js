const ALERT_TITLES = {
  error: '❌ HOST OFFLINE ❌',
  success: '✅ RECUPERAÇÃO DE SERVIÇO ✅',
  warning: '⚠️ ALERTA DE DESEMPENHO ⚠️',
  added: '📌 NOVO DISPOSITIVO',
  removed: '🗑️ DISPOSITIVO REMOVIDO',
};

function buildMessage({ type, message, deviceName, deviceIp, extraInfo }) {
  const title = ALERT_TITLES[type] || 'ℹ️ NOTIFICAÇÃO';

  let text = `*ORBNOC | Network Operations Center*\n\n`;
  text += `**${title}**\n\n`;
  text += `---\n`;

  if (deviceName && deviceIp) {
    text += `📡 *Dispositivo:* ${deviceName}\n`;
    text += `🌐 *IP:* ${deviceIp}\n`;
  }

  if (extraInfo) {
    text += `${extraInfo}\n`;
  }

  text += `---\n\n`;
  text += `${message}\n\n`;
  text += `_📡 OrbNOC • Monitoramento 24/7_`;

  return text;
}

/**
 * Envia um alerta formatado para um chat do Telegram via bot.
 * Retorna `false` silenciosamente se as credenciais estiverem ausentes
 * ou se o envio falhar (mesmo comportamento do sistema original).
 */
async function sendTelegramAlert(botToken, chatId, message, type, deviceName = null, deviceIp = null, extraInfo = null) {
  if (!botToken || !chatId) return false;

  const text = buildMessage({ type, message, deviceName, deviceIp, extraInfo });

  try {
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });
    const result = await response.json();
    if (result.ok) {
      console.log(`✅ Telegram alerta enviado para ${chatId}`);
      return true;
    }
    console.error(`❌ Erro Telegram:`, result.description);
    return false;
  } catch (error) {
    console.error('❌ Erro ao enviar Telegram:', error.message);
    return false;
  }
}

module.exports = { sendTelegramAlert };
