'use strict';
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { HttpError } = require('./errors');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function applySecurityHeaders(res) {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (config.production) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on('data', (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > limit) {
        failed = true;
        chunks.length = 0;
        reject(new HttpError(413, 'Anfrage ist zu groß'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!failed) resolve(Buffer.concat(chunks));
    });
    req.on('error', (err) => {
      if (!failed) reject(err);
    });
  });
}

async function readJson(req) {
  const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') throw new HttpError(415, 'Content-Type muss application/json sein');
  const buf = await readBody(req, config.maxJsonBytes);
  if (!buf.length) return {};
  let value;
  try {
    value = JSON.parse(buf.toString('utf8'));
  } catch {
    throw new HttpError(400, 'Ungültiges JSON');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Ungültiges JSON');
  return value;
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendError(res, err) {
  if (res.headersSent) {
    res.end();
    return;
  }
  if (err instanceof HttpError) {
    if (err.status === 429 && err.extra.retryAfter) res.setHeader('Retry-After', String(err.extra.retryAfter));
    if (err.status === 413) res.setHeader('Connection', 'close');
    sendJson(res, err.status, { error: err.message, ...err.extra });
    return;
  }
  console.error('Unerwarteter Fehler:', err);
  sendJson(res, 500, { error: 'Interner Serverfehler' });
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(text);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  res.end();
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function clientIp(req) {
  if (config.trustProxy) {
    const xff = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
    // letzter Eintrag = vom vorgeschalteten Proxy gesetzt
    if (xff.length) return xff[xff.length - 1];
  }
  return req.socket.remoteAddress || 'unknown';
}

/** Sendet eine Datei. cache: Cache-Control-Wert */
async function sendFile(req, res, filePath, cache) {
  let st;
  try {
    st = await fs.promises.stat(filePath);
  } catch {
    return false;
  }
  if (!st.isFile()) return false;
  const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': cache });
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
  return true;
}

/** Löst einen URL-Pfad sicher innerhalb von root auf (kein Path-Traversal, keine Dotfiles). */
function safeJoin(root, urlPath) {
  if (urlPath.includes('\0')) return null;
  const rel = path.posix.normalize('/' + urlPath).slice(1);
  if (rel.split('/').some((seg) => seg.startsWith('.'))) return null;
  const full = path.join(root, rel);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

module.exports = {
  applySecurityHeaders,
  readBody,
  readJson,
  sendJson,
  sendError,
  sendText,
  redirect,
  parseCookies,
  clientIp,
  sendFile,
  safeJoin,
};
