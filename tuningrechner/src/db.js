'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');
const { hashPassword } = require('./security');
const seed = require('./catalog-seed');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','employee')),
  can_discount INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  must_change INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  exclusive INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS parts (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_parts_category ON parts(category_id);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username TEXT NOT NULL,
  customer TEXT NOT NULL DEFAULT '',
  plate TEXT NOT NULL DEFAULT '',
  items_json TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  discount_percent REAL NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

const DEFAULT_SETTINGS = {
  company_name: 'Tuning Werkstatt',
  currency: '$',
  discount_enabled: '1',
  discount_percent: '10',
};

function openDb(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  const ins = db.prepare('INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) ins.run(k, v);
  return db;
}

function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function getSettings(db) {
  const map = {};
  for (const row of db.prepare('SELECT key, value FROM settings').all()) map[row.key] = row.value;
  const percent = Number(map.discount_percent);
  return {
    companyName: map.company_name || DEFAULT_SETTINGS.company_name,
    currency: map.currency || DEFAULT_SETTINGS.currency,
    discountEnabled: map.discount_enabled === '1',
    discountPercent: Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0,
  };
}

function saveSettings(db, s) {
  const up = db.prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  tx(db, () => {
    up.run('company_name', s.companyName);
    up.run('currency', s.currency);
    up.run('discount_enabled', s.discountEnabled ? '1' : '0');
    up.run('discount_percent', String(s.discountPercent));
  });
}

function seedCatalog(db) {
  if (db.prepare('SELECT COUNT(*) AS c FROM categories').get().c > 0) return false;
  const insCat = db.prepare('INSERT INTO categories(name, parent_id, exclusive, sort_order) VALUES (?, ?, ?, ?)');
  const insPart = db.prepare(
    'INSERT INTO parts(category_id, name, description, image, price_cents, active, sort_order) VALUES (?, ?, ?, ?, ?, 1, ?)'
  );
  const addParts = (catId, parts) => {
    parts.forEach((p, i) => {
      insPart.run(catId, p.name, p.description, `/img/parts/${p.slug}.svg`, Math.round(p.price * 100), i);
    });
  };
  tx(db, () => {
    seed.forEach((top, ti) => {
      const topId = Number(insCat.run(top.name, null, 0, ti).lastInsertRowid);
      if (top.parts) addParts(topId, top.parts);
      (top.children || []).forEach((child, ci) => {
        const childId = Number(insCat.run(child.name, topId, child.exclusive ? 1 : 0, ci).lastInsertRowid);
        addParts(childId, child.parts);
      });
    });
  });
  return true;
}

async function ensureAdmin(db) {
  if (db.prepare('SELECT COUNT(*) AS c FROM users').get().c > 0) return;
  const username = config.adminUsername;
  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username)) {
    throw new Error('ADMIN_USERNAME ist ungültig (3-32 Zeichen: Buchstaben, Zahlen, _ . -)');
  }
  let password = config.adminPassword;
  let generated = false;
  if (!password) {
    password = crypto.randomBytes(12).toString('base64url');
    generated = true;
  } else if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD muss mindestens 8 Zeichen lang sein');
  }
  const hash = await hashPassword(password);
  db.prepare("INSERT INTO users(username, password_hash, role, can_discount, must_change) VALUES (?, ?, 'admin', 1, ?)").run(
    username,
    hash,
    generated ? 1 : 0
  );
  if (generated) {
    console.log('\n==============================================================');
    console.log(' Erster Start: Admin-Zugang wurde angelegt');
    console.log(`   Benutzername: ${username}`);
    console.log(`   Passwort:     ${password}`);
    console.log(' Das Passwort muss beim ersten Login geändert werden.');
    console.log('==============================================================\n');
  } else {
    console.log(`Admin-Benutzer "${username}" wurde aus ADMIN_PASSWORD angelegt.`);
  }
}

module.exports = { openDb, tx, getSettings, saveSettings, seedCatalog, ensureAdmin };
