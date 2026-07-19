const http = require('http');

const { PORT, MONITOR_INTERVAL_MS } = require('./src/config/env');
const { connect } = require('./src/config/database');
const { createApp } = require('./src/app');
const { createSocketServer } = require('./src/sockets');
const { monitorAllUsers } = require('./src/services/monitorService');

connect();

const app = createApp();
const server = http.createServer(app);
const io = createSocketServer(server);

server.listen(PORT, () => {
  console.log(`\n🚀 Servidor backend rodando em http://localhost:${PORT}`);
  console.log(`📡 WebSocket disponível para conexões`);
  console.log(`📊 Monitoramento via TCP Connect ativo`);
  console.log(`✅ CORS configurado para o frontend`);
  console.log(`🤖 Telegram alerts ready`);
  console.log(`🔧 Diagnostic routes available`);
  console.log(`\n📋 Endpoints públicos:`);
  console.log(`   GET  /          - Informações da API`);
  console.log(`   GET  /health    - Health check`);
  console.log(`   GET  /api/status - Status rápido`);
  console.log(`   GET  /api       - Lista de endpoints\n`);
});

setInterval(() => monitorAllUsers(io), MONITOR_INTERVAL_MS);
monitorAllUsers(io);
