// server.js - Produktions-Backend für FiveM Tuningrechner (Express + SQLite + JWT)
const express = require('express');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-render-env';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// SQLite Datenbank (Persistentes Volume auf Render unter /var/data/tuning.db)
const db = new Database(process.env.DB_PATH || './tuning.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    can_discount INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT
  );
  CREATE TABLE IF NOT EXISTS parts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category_id TEXT NOT NULL,
    image TEXT,
    price INTEGER NOT NULL DEFAULT 0,
    cost_price INTEGER NOT NULL DEFAULT 0,
    allow_qty INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS performance_stages (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    group_name TEXT NOT NULL,
    level INTEGER NOT NULL,
    name TEXT NOT NULL,
    image TEXT,
    price INTEGER NOT NULL DEFAULT 0,
    cost_price INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS performance_stages (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    group_name TEXT NOT NULL,
// ÖFFENTLICHER ENDPUNKT: Gibt NIEMALS Einzelpreise (weder VK noch EK) zurück!
app.get('/api/catalog', authenticateToken, (req, res) => {
  const categories = db.prepare('SELECT id, name, description FROM categories').all();
  const parts = db.prepare('SELECT id, name, category_id AS categoryId, image, allow_qty AS allowQty FROM parts').all();
  const stages = db.prepare('SELECT id, group_id, group_name, level, name, image FROM performance_stages ORDER BY level ASC').all();
  res.json({ categories, parts, stages });
});

// SERVERSEITIGE PREISBERECHNUNG: Berechnet Gesamtsumme aus VK im Backend
app.post('/api/calculate', authenticateToken, (req, res) => {
  const { stageIds = [], partQuantities = {}, discountPercent = 0 } = req.body;
  let subtotal = 0;

  const getStage = db.prepare('SELECT price FROM performance_stages WHERE id = ? AND level > 0');
  for (const id of stageIds) {
    const row = getStage.get(id);
    if (row) subtotal += row.price;
  }

  const getPart = db.prepare('SELECT price, allow_qty FROM parts WHERE id = ?');
  for (const [id, qty] of Object.entries(partQuantities)) {
    const row = getPart.get(id);
    if (row && qty > 0) {
      subtotal += row.price * (row.allow_qty ? Math.floor(qty) : 1);
    }
  }
  next();
}

// ÖFFENTLICHER ENDPUNKT: Gibt NIEMALS Einzelpreise zurück!
app.get('/api/catalog', authenticateToken, (req, res) => {
  const categories = db.prepare('SELECT id, name, description FROM categories').all();
  const parts = db.prepare('SELECT id, name, category_id AS categoryId, image FROM parts').all();
  const stages = db.prepare('SELECT id, group_id, group_name, level, name, image FROM performance_stages ORDER BY level ASC').all();
  res.json({ categories, parts, stages });
});

// SERVERSEITIGE PREISBERECHNUNG: Berechnet Gesamtsumme im Backend
app.post('/api/calculate', authenticateToken, (req, res) => {
  const { stageIds = [], partIds = [], discountPercent = 0 } = req.body;
  let subtotal = 0;

  const getStage = db.prepare('SELECT price FROM performance_stages WHERE id = ? AND level > 0');
  for (const id of stageIds) {
    const row = getStage.get(id);
    if (row) subtotal += row.price;
  }

  const getPart = db.prepare('SELECT price FROM parts WHERE id = ?');
  for (const id of partIds) {
    const row = getPart.get(id);
    if (row) subtotal += row.price;
  }

  const canDiscount = req.user && (req.user.role === 'admin' || req.user.can_discount);
  const appliedDiscount = canDiscount ? Math.max(0, Math.min(50, Number(discountPercent) || 0)) : 0;
  const discountAmount = Math.round(subtotal * (appliedDiscount / 100));

  res.json({
    subtotal,
    appliedDiscountPercent: appliedDiscount,
    discountAmount,
    finalTotal: Math.max(0, subtotal - discountAmount)
  });
});

// GESCHÜTZTER ADMIN-ENDPUNKT: Enthält alle Einzelpreise
app.get('/api/admin/parts', authenticateToken, requireAdmin, (req, res) => {
  const parts = db.prepare('SELECT * FROM parts').all();
  const stages = db.prepare('SELECT * FROM performance_stages').all();
  res.json({ parts, stages });
});

app.listen(PORT, () => console.log(`Apex Customs Server läuft auf Port ${PORT}`));