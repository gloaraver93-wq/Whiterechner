'use strict';
const path = require('path');
const env = process.env;

module.exports = {
  port: parseInt(env.PORT || '3000', 10),
  dataDir: path.resolve(env.DATA_DIR || path.join(__dirname, '..', 'data')),
  publicDir: path.join(__dirname, '..', 'public'),
  adminDir: path.join(__dirname, '..', 'private', 'admin'),
  production: env.NODE_ENV === 'production',
  // Hinter einem Proxy (Render) kommt die Client-IP aus X-Forwarded-For
  trustProxy: env.TRUST_PROXY === '1' || env.RENDER === 'true',
  sessionHours: Number(env.SESSION_HOURS) > 0 ? Number(env.SESSION_HOURS) : 12,
  adminUsername: (env.ADMIN_USERNAME || 'admin').trim(),
  adminPassword: env.ADMIN_PASSWORD || '',
  maxJsonBytes: 100 * 1024,
  maxUploadBytes: 4 * 1024 * 1024,
};
