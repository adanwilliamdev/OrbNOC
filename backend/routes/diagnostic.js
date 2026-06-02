const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const net = require('net');
const dns = require('dns');
const util = require('util');
const ping = require('ping');

const dnsLookup = util.promisify(dns.lookup);
const dnsResolve = util.promisify(dns.resolve);

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
};

// ==================== 1. PING AVANÇADO ====================
router.post('/ping', authenticateToken, async (req, res) => {
  const { host, count = 5 } = req.body;

  if (!host) {
    return res.status(400).json({ error: 'Host é obrigatório' });
  }

  const latencies = [];
  let packetLoss = 0;
  let successCount = 0;

  for (let i = 0; i < count; i++) {
    try {
      const startTime = Date.now();
      const result = await ping.promise.probe(host, { timeout: 2 });
      const endTime = Date.now();

      if (result.alive) {
        const latency = endTime - startTime;
        latencies.push(latency);
        successCount++;
      }
    } catch (err) {
      console.error('Erro no ping:', err);
    }
    // Aguarda 1 segundo entre pings
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  packetLoss = ((count - successCount) / count) * 100;

  const avgLatency = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : null;
  const minLatency = latencies.length > 0 ? Math.min(...latencies) : null;
  const maxLatency = latencies.length > 0 ? Math.max(...latencies) : null;

  res.json({
    host,
    status: successCount > 0 ? 'online' : 'offline',
    packet_loss: packetLoss,
    avg_latency: avgLatency,
    min_latency: minLatency,
    max_latency: maxLatency,
    success_count: successCount,
    total_count: count
  });
});

// ==================== 2. TRACEROUTE ====================
router.post('/traceroute', authenticateToken, async (req, res) => {
  const { host } = req.body;

  if (!host) {
    return res.status(400).json({ error: 'Host é obrigatório' });
  }

  // Usando comando nativo (Linux/Mac)
  exec(`traceroute -n -m 30 ${host}`, { timeout: 30000 }, (error, stdout, stderr) => {
    if (error && error.code !== 1) {
      // Tentativa alternativa com tcptraceroute ou fallback
      exec(`tracert -d -h 30 ${host}`, { timeout: 30000 }, (err2, stdout2) => {
        if (err2) {
          return res.status(500).json({ error: 'Erro ao executar traceroute' });
        }
        const hops = parseTraceroute(stdout2);
        res.json({ hops, raw: stdout2 });
      });
    } else {
      const hops = parseTraceroute(stdout);
      res.json({ hops, raw: stdout });
    }
  });
});

function parseTraceroute(output) {
  const lines = output.split('\n');
  const hops = [];

  for (const line of lines) {
    const match = line.match(/^\s*(\d+)\s+(\d+\.\d+\.\d+\.\d+|\*+)\s+([\d.]+|\*+)/);
    if (match) {
      hops.push({
        hop: parseInt(match[1]),
        ip: match[2],
        latency: match[3] !== '*' ? parseFloat(match[3]) : null
      });
    }
  }
  return hops;
}

// ==================== 3. TESTE DE PORTA ====================
router.post('/port-check', authenticateToken, async (req, res) => {
  const { host, port, timeout = 3000 } = req.body;

  if (!host || !port) {
    return res.status(400).json({ error: 'Host e porta são obrigatórios' });
  }

  const results = [];

  const checkPort = (p) => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const startTime = Date.now();

      socket.setTimeout(timeout);
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

  // Suporta array de portas ou porta única
  const ports = Array.isArray(port) ? port : [port];

  for (const p of ports) {
    const result = await checkPort(parseInt(p));
    results.push(result);
  }

  res.json({ host, results });
});

// ==================== 4. DNS LOOKUP ====================
router.post('/dns-lookup', authenticateToken, async (req, res) => {
  const { domain, recordType = 'A' } = req.body;

  if (!domain) {
    return res.status(400).json({ error: 'Domínio é obrigatório' });
  }

  try {
    // Resolve A records
    const addresses = await dnsResolve(domain, recordType);

    // Tenta resolver reversamente (PTR)
    let reverseLookup = null;
    if (addresses && addresses[0]) {
      try {
        reverseLookup = await dnsLookup(addresses[0]);
      } catch (err) {
        // Ignora erro de reverse lookup
      }
    }

    res.json({
      domain,
      record_type: recordType,
      records: addresses.map(addr => ({ value: addr })),
      reverse_lookup: reverseLookup?.hostname || null,
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

// ==================== 5. PATHPING (Diagnóstico combinado) ====================
router.post('/pathping', authenticateToken, async (req, res) => {
  const { host } = req.body;

  if (!host) {
    return res.status(400).json({ error: 'Host é obrigatório' });
  }

  // Executa ping e traceroute combinados
  const [pingResult, tracerouteResult] = await Promise.all([
    new Promise((resolve) => {
      exec(`ping -c 10 ${host}`, (error, stdout) => {
        resolve(parsePingDetailed(stdout));
      });
    }),
    new Promise((resolve) => {
      exec(`traceroute -n -m 20 ${host}`, (error, stdout) => {
        resolve(parseTracerouteDetailed(stdout));
      });
    })
  ]);

  // Identifica onde ocorre perda de pacotes
  const problemHop = findProblemHop(tracerouteResult);

  res.json({
    host,
    ping: pingResult,
    traceroute: tracerouteResult,
    problem_hop: problemHop,
    diagnosis: generateDiagnosis(pingResult, tracerouteResult, problemHop)
  });
});

function parsePingDetailed(output) {
  const lines = output.split('\n');
  let packetLoss = 0;
  let avgLatency = null;

  for (const line of lines) {
    const lossMatch = line.match(/(\d+)% packet loss/);
    if (lossMatch) packetLoss = parseInt(lossMatch[1]);

    const avgMatch = line.match(/avg\s+[\d.]+\/([\d.]+)\//);
    if (avgMatch) avgLatency = parseFloat(avgMatch[1]);
  }

  return { packet_loss: packetLoss, avg_latency: avgLatency, raw: output };
}

function parseTracerouteDetailed(output) {
  const lines = output.split('\n');
  const hops = [];

  for (const line of lines) {
    const match = line.match(/^\s*(\d+)\s+(\d+\.\d+\.\d+\.\d+|\*+)\s+([\d.]+|\*+)/);
    if (match) {
      hops.push({
        hop: parseInt(match[1]),
        ip: match[2],
        latency: match[3] !== '*' ? parseFloat(match[3]) : null
      });
    }
  }
  return hops;
}

function findProblemHop(hops) {
  for (let i = 0; i < hops.length; i++) {
    if (hops[i].latency === null) {
      return hops[i];
    }
  }
  return null;
}

function generateDiagnosis(ping, traceroute, problemHop) {
  const issues = [];

  if (ping.packet_loss > 20) {
    issues.push(`⚠️ Perda de pacotes elevada: ${ping.packet_loss}%`);
  }

  if (problemHop) {
    issues.push(`⚠️ Problema detectado no hop ${problemHop.hop} (${problemHop.ip})`);
  }

  if (ping.avg_latency && ping.avg_latency > 200) {
    issues.push(`⚠️ Latência alta: ${ping.avg_latency}ms`);
  }

  if (issues.length === 0) {
    return { status: 'ok', message: '✅ Caminho saudável, sem problemas detectados' };
  }

  return { status: 'warning', message: issues.join(' | ') };
}

// ==================== 6. DIAGNÓSTICO COMPLETO ====================
router.post('/full-diagnostic', authenticateToken, async (req, res) => {
  const { host, ports = [80, 443] } = req.body;

  if (!host) {
    return res.status(400).json({ error: 'Host é obrigatório' });
  }

  const startTime = Date.now();
  const results = {};

  // 1. Ping
  try {
    const pingResult = await new Promise((resolve) => {
      exec(`ping -c 4 ${host}`, (error, stdout) => {
        resolve(parsePingDetailed(stdout));
      });
    });
    results.ping = pingResult;
  } catch (err) {
    results.ping = { error: err.message };
  }

  // 2. DNS Lookup
  try {
    const addresses = await dnsResolve(host, 'A');
    results.dns = { success: true, records: addresses };
  } catch (err) {
    results.dns = { success: false, error: err.message };
  }

  // 3. Portas
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

  // 4. Traceroute (simplificado)
  try {
    const tracerouteResult = await new Promise((resolve) => {
      exec(`traceroute -n -m 15 ${host}`, (error, stdout) => {
        resolve(parseTracerouteDetailed(stdout));
      });
    });
    results.traceroute = tracerouteResult.slice(0, 10);
  } catch (err) {
    results.traceroute = [];
  }

  const duration = Date.now() - startTime;

  // Diagnóstico inteligente
  const diagnosis = [];

  if (results.dns?.success) {
    diagnosis.push('✅ DNS resolve corretamente');
  } else {
    diagnosis.push('❌ Falha na resolução DNS');
  }

  if (results.ping?.packet_loss < 20 && results.ping?.packet_loss !== undefined) {
    diagnosis.push('✅ Host responde ao ping');
  } else if (results.ping?.packet_loss >= 20) {
    diagnosis.push(`⚠️ Perda de pacotes: ${results.ping.packet_loss}%`);
  } else {
    diagnosis.push('❌ Host não responde ao ping');
  }

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

module.exports = router;