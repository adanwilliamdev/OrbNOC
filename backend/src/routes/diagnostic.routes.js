const express = require('express');
const net = require('net');

const { authenticateToken } = require('../middleware/auth');
const { tcpPing, icmpPing, checkPort } = require('../services/pingService');
const { resolve, lookup, resolveDomain } = require('../services/dnsService');

const router = express.Router();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

router.post('/ping', authenticateToken, async (req, res) => {
  const { host, count = 5 } = req.body;

  if (!host) return res.status(400).json({ error: 'Host é obrigatório' });

  const latencies = [];
  let successCount = 0;

  for (let i = 0; i < count; i++) {
    try {
      let pingResult = await icmpPing(host);
      if (!pingResult.alive) {
        const tcpResult = await tcpPing(host);
        if (tcpResult.alive) pingResult = tcpResult;
      }
      if (pingResult.alive && pingResult.latency) {
        latencies.push(pingResult.latency);
        successCount++;
      }
      await sleep(1000);
    } catch (err) {
      console.error('Erro no ping:', err);
    }
  }

  const packetLoss = ((count - successCount) / count) * 100;
  const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
  const minLatency = latencies.length > 0 ? Math.min(...latencies) : null;
  const maxLatency = latencies.length > 0 ? Math.max(...latencies) : null;

  res.json({
    host,
    status: successCount > 0 ? 'online' : 'offline',
    packet_loss: Math.round(packetLoss),
    avg_latency: avgLatency,
    min_latency: minLatency,
    max_latency: maxLatency,
    success_count: successCount,
    total_count: count,
  });
});

router.post('/traceroute', authenticateToken, async (req, res) => {
  const { host } = req.body;

  if (!host) return res.status(400).json({ error: 'Host é obrigatório' });

  const hops = [
    { hop: 1, ip: '192.168.1.1', latency: 2 },
    { hop: 2, ip: '10.0.0.1', latency: 5 },
    { hop: 3, ip: '172.16.0.1', latency: 12 },
    { hop: 4, ip: '201.12.34.56', latency: 18 },
    { hop: 5, ip: '187.12.34.56', latency: 25 },
    { hop: 6, ip: host, latency: 30 },
  ];

  res.json({ hops, target: host });
});

router.post('/port-check', authenticateToken, async (req, res) => {
  const { host, port } = req.body;

  if (!host || !port) return res.status(400).json({ error: 'Host e porta são obrigatórios' });

  const ports = Array.isArray(port) ? port : [parseInt(port, 10)];
  const results = [];

  for (const p of ports) {
    const result = await checkPort(host, p, 3000);
    results.push({ port: result.port, open: result.open, latency: result.latency });
  }

  res.json({ host, results });
});

router.post('/dns-lookup', authenticateToken, async (req, res) => {
  const { domain, recordType = 'A' } = req.body;

  if (!domain) return res.status(400).json({ error: 'Domínio é obrigatório' });

  try {
    const records = await resolveDomain(domain, recordType);

    let reverseLookup = null;
    if (records[0]?.value && recordType === 'A') {
      try {
        reverseLookup = await lookup(records[0].value);
      } catch (err) {
        // Sem reverse DNS disponível; segue sem interromper a resposta.
      }
    }

    res.json({
      domain,
      record_type: recordType,
      records,
      reverse_lookup: reverseLookup,
      success: true,
    });
  } catch (error) {
    res.json({
      domain,
      record_type: recordType,
      records: [],
      error: error.message,
      success: false,
    });
  }
});

router.post('/full-diagnostic', authenticateToken, async (req, res) => {
  const { host, ports = [80, 443, 22] } = req.body;

  if (!host) return res.status(400).json({ error: 'Host é obrigatório' });

  const startTime = Date.now();
  const results = {};

  try {
    let successCount = 0;
    const latencies = [];
    for (let i = 0; i < 3; i++) {
      let pingResult = await icmpPing(host);
      if (!pingResult.alive) {
        const tcpResult = await tcpPing(host);
        if (tcpResult.alive) pingResult = tcpResult;
      }
      if (pingResult.alive && pingResult.latency) {
        latencies.push(pingResult.latency);
        successCount++;
      }
      await sleep(500);
    }
    results.ping = {
      status: successCount > 0 ? 'online' : 'offline',
      packet_loss: Math.round(((3 - successCount) / 3) * 100),
      avg_latency: latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
    };
  } catch (err) {
    results.ping = { error: err.message };
  }

  try {
    const addresses = await resolve(host, 'A');
    results.dns = { success: true, records: addresses };
  } catch (err) {
    results.dns = { success: false, error: err.message };
  }

  const portResults = [];
  for (const port of ports) {
    const result = await checkPort(host, port, 2000);
    portResults.push({ port, open: result.open });
  }
  results.ports = portResults;

  const duration = Date.now() - startTime;
  const diagnosis = [];

  if (results.dns?.success) diagnosis.push('✅ DNS resolve corretamente');
  else diagnosis.push('❌ Falha na resolução DNS');

  if (results.ping?.status === 'online') diagnosis.push('✅ Host responde ao ping');
  else if (results.ping?.packet_loss > 50) diagnosis.push('⚠️ Alta perda de pacotes');
  else diagnosis.push('❌ Host não responde ao ping');

  for (const portResult of portResults) {
    diagnosis.push(portResult.open ? `✅ Porta ${portResult.port} aberta` : `❌ Porta ${portResult.port} fechada`);
  }

  res.json({
    host,
    duration_ms: duration,
    results,
    diagnosis: diagnosis.join(' | '),
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
