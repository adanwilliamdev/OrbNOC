require('dotenv').config();

// Força resolução IPv4 primeiro (necessário para Supabase em alguns ambientes)
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

module.exports = {
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'orbnoc_secret_key_2024_change_this_in_production',
  DATABASE_URL: process.env.DATABASE_URL,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  MONITOR_INTERVAL_MS: Number(process.env.MONITOR_INTERVAL_MS) || 10000,
};
