const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({
    name: '🚀 OrbNOC API',
    version: '1.0.0',
    status: 'operational',
    description: 'Enterprise Network Operations Center Platform',
    endpoints: {
      health: '/health',
      api: '/api',
      auth: '/api/auth',
      devices: '/api/devices',
      alerts: '/api/alerts',
      diagnostic: '/api/diagnostic',
    },
    documentation: 'https://github.com/adanwilliamdev/OrbNOC',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
    },
    environment: process.env.NODE_ENV || 'development',
    database: 'connected',
    websocket: 'active',
  });
});

router.get('/api/status', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'OrbNOC Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

router.get('/api', (req, res) => {
  res.status(200).json({
    message: 'OrbNOC API v1.0.0',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
      },
      devices: {
        list: 'GET /api/devices',
        add: 'POST /api/devices',
        remove: 'DELETE /api/devices/:id',
        ping: 'GET /api/devices/:id/ping',
        checkPort: 'POST /api/devices/:id/check-port',
      },
      alerts: {
        email: 'GET/POST /api/alerts/email',
        telegram: 'GET/POST /api/alerts/telegram',
        notify: 'POST /api/alerts/notify',
        sla: 'POST /api/alerts/sla/configure',
        testTelegram: 'POST /api/alerts/test-telegram',
        testHost: 'POST /api/alerts/test-host',
      },
      diagnostic: {
        ping: 'POST /api/diagnostic/ping',
        traceroute: 'POST /api/diagnostic/traceroute',
        portCheck: 'POST /api/diagnostic/port-check',
        dnsLookup: 'POST /api/diagnostic/dns-lookup',
        fullDiagnostic: 'POST /api/diagnostic/full-diagnostic',
      },
      public: {
        health: 'GET /health',
        status: 'GET /api/status',
        root: 'GET /',
      },
    },
  });
});

module.exports = router;
