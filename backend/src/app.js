const express = require('express');
const cors = require('cors');

const { requestLogger } = require('./middleware/requestLogger');
const publicRoutes = require('./routes/public.routes');
const authRoutes = require('./routes/auth.routes');
const devicesRoutes = require('./routes/devices.routes');
const alertsRoutes = require('./routes/alerts.routes');
const diagnosticRoutes = require('./routes/diagnostic.routes');

function createApp() {
  const app = express();

  app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  app.use(express.json());
  app.use(requestLogger);

  app.use('/', publicRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/devices', devicesRoutes);
  app.use('/api/alerts', alertsRoutes);
  app.use('/api/diagnostic', diagnosticRoutes);

  return app;
}

module.exports = { createApp };
