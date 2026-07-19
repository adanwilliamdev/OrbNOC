const net = require('net');
const { execFile } = require('child_process');

const DEFAULT_PROBE_PORTS = [80, 443, 53, 8080, 8443];

/**
 * Ping ICMP real via o comando `ping` do sistema operacional. Mais confiável
 * que TCP connect para detectar dispositivos que não expõem nenhuma porta
 * (ex: celulares, IoT, roteadores sem admin web). Usa execFile (sem shell)
 * para evitar injeção de comando via o host informado pelo usuário.
 */
function icmpPing(host, count = 1, timeoutSec = 2) {
  return new Promise((resolve) => {
    execFile(
      'ping',
      ['-c', String(count), '-W', String(timeoutSec), host],
      { timeout: (timeoutSec * count + 2) * 1000 },
      (_error, stdout) => {
        const output = stdout || '';
        const lossMatch = output.match(/(\d+)% packet loss/);
        const packetLoss = lossMatch ? parseInt(lossMatch[1], 10) : 100;
        const alive = packetLoss < 100;
        const rttMatch = output.match(/=\s*[\d.]+\/([\d.]+)\/[\d.]+/);
        const latency = rttMatch ? Math.round(parseFloat(rttMatch[1])) : null;
        resolve({ alive, latency, packetLoss });
      }
    );
  });
}

/**
 * Tenta conectar via TCP em uma sequência de portas comuns para estimar
 * se um host está no ar e qual sua latência. Retorna assim que a primeira
 * porta responder.
 */
async function tcpPing(ip, timeout = 5000, ports = DEFAULT_PROBE_PORTS) {
  for (const port of ports) {
    try {
      const latency = await new Promise((resolve) => {
        const startTime = Date.now();
        const socket = new net.Socket();

        socket.setTimeout(timeout);

        socket.once('connect', () => {
          const elapsed = Date.now() - startTime;
          socket.destroy();
          resolve(elapsed);
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
      // Continua para a próxima porta
    }
  }

  return { alive: false, latency: null, port: null };
}

/**
 * Verifica se uma porta específica está aberta em um host, com latência.
 * `timedOut` distingue estouro de tempo de outros erros de conexão (ex.
 * conexão recusada), pois algumas rotas expõem esse detalhe ao cliente.
 */
async function checkPort(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const startTime = Date.now();
    socket.setTimeout(timeout);
    socket.connect(port, host, () => {
      const latency = Date.now() - startTime;
      socket.destroy();
      resolve({ port, open: true, latency, timedOut: false });
    });
    socket.on('error', () => {
      socket.destroy();
      resolve({ port, open: false, latency: null, timedOut: false });
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ port, open: false, latency: null, timedOut: true });
    });
  });
}

function calculateJitter(latencies) {
  if (latencies.length < 2) return 0;
  let jitter = 0;
  for (let i = 1; i < latencies.length; i++) {
    jitter += Math.abs(latencies[i] - latencies[i - 1]);
  }
  return Math.round(jitter / (latencies.length - 1));
}

module.exports = { tcpPing, icmpPing, checkPort, calculateJitter, DEFAULT_PROBE_PORTS };
