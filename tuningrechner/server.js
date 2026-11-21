'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('./src/config');
const h = require('./src/http');
const { openDb, seedCatalog, ensureAdmin } = require('./src/db');
const { createApi, UPLOAD_DIR } = require('./src/api');

const UPLOAD_FILE_RE = /^[a-f0-9]{32}\.(png|jpg|webp|gif)$/;

async function main() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const db = openDb(path.join(config.dataDir, 'tuning.db'));
  if (seedCatalog(db)) console.log('Beispielkatalog wurde angelegt.');
  await ensureAdmin(db);
  const api = createApi(db);

  async function handle(req, res) {
    h.applySecurityHeaders(res);
    const url = new URL(req.url, 'http://localhost');
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return h.sendText(res, 400, 'Bad request');
    }

    if (pathname === '/healthz') return h.sendText(res, 200, 'ok');
    if (pathname.startsWith('/api/')) return api.handle(req, res, url, pathname);

    if (req.method !== 'GET' && req.method !== 'HEAD') return h.sendText(res, 405, 'Method not allowed');

    // Hochgeladene Bilder
    if (pathname.startsWith('/uploads/')) {
      const file = pathname.slice('/uploads/'.length);
      if (UPLOAD_FILE_RE.test(file) && (await h.sendFile(req, res, path.join(UPLOAD_DIR, file), 'public, max-age=31536000, immutable'))) return;
      return h.sendText(res, 404, 'Not found');
    }

    // Adminbereich: HTML und Skript werden ausschließlich an angemeldete Administratoren ausgeliefert.
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      const user = api.getUser(req);
      const isAdmin = user && user.role === 'admin' && !user.mustChange;
      if (pathname === '/admin' || pathname === '/admin/') {
        if (!isAdmin) return h.redirect(res, '/');
        if (await h.sendFile(req, res, path.join(config.adminDir, 'admin.html'), 'no-store')) return;
      } else if (pathname === '/admin/admin.js' && isAdmin) {
        if (await h.sendFile(req, res, path.join(config.adminDir, 'admin.js'), 'no-store')) return;
      }
      return h.sendText(res, 404, 'Not found');
    }

    // Öffentliche statische Dateien (Login-Oberfläche, Rechner, Bilder)
    const rel = pathname === '/' ? '/index.html' : pathname;
    const full = h.safeJoin(config.publicDir, rel);
    if (full) {
      const cache = /\.(svg|png|jpg|webp|gif|ico)$/.test(full) ? 'public, max-age=3600' : 'no-cache';
      if (await h.sendFile(req, res, full, cache)) return;
    }
    return h.sendText(res, 404, 'Not found');
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error('Unbehandelter Fehler:', err);
      if (!res.headersSent) h.sendText(res, 500, 'Interner Serverfehler');
      else res.end();
    });
  });
  server.requestTimeout = 60_000;
  server.headersTimeout = 20_000;

  server.listen(config.port, () => {
    console.log(`Tuningrechner läuft auf Port ${config.port} (Daten: ${config.dataDir})`);
  });

  const shutdown = () => {
    server.close(() => {
      try {
        db.close();
      } catch {
        /* ignorieren */
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Start fehlgeschlagen:', err.message);
  process.exit(1);
});
