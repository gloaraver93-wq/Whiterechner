'use strict';
const crypto = require('crypto');

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, SCRYPT, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

async function verifyPassword(password, stored) {
  const [alg, saltB64, keyB64] = String(stored).split('$');
  if (alg !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// Wird für unbekannte Benutzer verwendet, damit die Antwortzeit nichts verrät.
let dummyHash = null;
async function getDummyHash() {
  if (!dummyHash) dummyHash = await hashPassword(crypto.randomBytes(16).toString('hex'));
  return dummyHash;
}

function newToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

class Limiter {
  constructor({ max, windowMs, lockMs }) {
    this.max = max;
    this.windowMs = windowMs;
    this.lockMs = lockMs;
    this.map = new Map();
    const t = setInterval(() => this.sweep(), 5 * 60 * 1000);
    t.unref();
  }
  /** Sekunden bis zur nächsten erlaubten Anfrage, 0 = erlaubt */
  check(key) {
    const e = this.map.get(key);
    if (!e) return 0;
    const now = Date.now();
    if (e.lockedUntil > now) return Math.ceil((e.lockedUntil - now) / 1000);
    return 0;
  }
  fail(key) {
    const now = Date.now();
    let e = this.map.get(key);
    if (!e || now - e.first > this.windowMs) {
      e = { count: 0, first: now, lockedUntil: 0 };
      this.map.set(key, e);
    }
    e.count++;
    if (e.count >= this.max) {
      e.lockedUntil = now + this.lockMs;
      e.count = 0;
      e.first = now;
    }
  }
  reset(key) {
    this.map.delete(key);
  }
  sweep() {
    const now = Date.now();
    for (const [k, e] of this.map) {
      if (e.lockedUntil < now && now - e.first > this.windowMs) this.map.delete(k);
    }
  }
}

module.exports = { hashPassword, verifyPassword, getDummyHash, newToken, hashToken, Limiter };
