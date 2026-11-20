const express = require("express");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");

app.use(express.json({ limit: "6mb" }));
app.use(express.static(path.join(__dirname, "public")));

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const sessions = new Map();

function hashPassword(password) {
  return crypto.scryptSync(String(password), SESSION_SECRET, 64).toString("hex");
}

function verifyPassword(password, expectedHash) {
  const actualHash = hashPassword(password);
  const a = Buffer.from(actualHash, "hex");
  const b = Buffer.from(expectedHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const DEFAULT_STATE = {
  discountConfig: {
    enabled: true,
    maxDiscountPercent: 25,
    defaultDiscountPercent: 0
  },
  users: [
    {
      id: "u-admin",
      username: process.env.ADMIN_USER || "admin",
      role: "admin",
      label: "Werkstattleitung (Admin)",
      canDiscount: true,
      maxDiscount: 50,
      passwordHash: hashPassword(process.env.ADMIN_PASS || "admin123")
    },
    {
      id: "u-Mitarbeiter",
      username: "Mitarbeiter",
      role: "staff",
      label: "Mechaniker / Mitarbeiter",
      canDiscount: true,
      maxDiscount: 20,
      passwordHash: hashPassword("Mitarbeiter123")
    }
  ],
  items: [
    // Leistungsteile -> Motorstufen (1-4)
    { id: "motor-1", name: "Motorstufe 1", group: "Leistungsteile", subCategory: "Motorstufen", sellPrice: 8000, buyPrice: 4000, iconKey: "leistungsteile", badge: "STAGE 1" },
    { id: "motor-2", name: "Motorstufe 2", group: "Leistungsteile", subCategory: "Motorstufen", sellPrice: 14000, buyPrice: 4000, iconKey: "leistungsteile", badge: "STAGE 2" },
    { id: "motor-3", name: "Motorstufe 3", group: "Leistungsteile", subCategory: "Motorstufen", sellPrice: 22000, buyPrice: 4000, iconKey: "leistungsteile", badge: "STAGE 3" },
    { id: "motor-4", name: "Motorstufe 4", group: "Leistungsteile", subCategory: "Motorstufen", sellPrice: 32000, buyPrice: 4000, iconKey: "leistungsteile", badge: "STAGE 4" },

    // Leistungsteile -> Getriebestufen (1-3)
    { id: "getriebe-1", name: "Getriebe Stufe 1", group: "Leistungsteile", subCategory: "Getriebestufen", sellPrice: 6000, buyPrice: 4000, iconKey: "leistungsteile", badge: "GEAR 1" },
    { id: "getriebe-2", name: "Getriebe Stufe 2", group: "Leistungsteile", subCategory: "Getriebestufen", sellPrice: 10000, buyPrice: 4000, iconKey: "leistungsteile", badge: "GEAR 2" },
    { id: "getriebe-3", name: "Getriebe Stufe 3", group: "Leistungsteile", subCategory: "Getriebestufen", sellPrice: 15000, buyPrice: 4000, iconKey: "leistungsteile", badge: "GEAR 3" },

    // Leistungsteile -> Fahrwerksstufen (1-3)
    { id: "fahrwerk-1", name: "Fahrwerk Stufe 1", group: "Leistungsteile", subCategory: "Fahrwerksstufen", sellPrice: 4000, buyPrice: 4000, iconKey: "fahrwerksteile", badge: "SUSP 1" },
    { id: "fahrwerk-2", name: "Fahrwerk Stufe 2", group: "Leistungsteile", subCategory: "Fahrwerksstufen", sellPrice: 7000, buyPrice: 4000, iconKey: "fahrwerksteile", badge: "SUSP 2" },
    { id: "fahrwerk-3", name: "Fahrwerk Stufe 3", group: "Leistungsteile", subCategory: "Fahrwerksstufen", sellPrice: 11000, buyPrice: 4000, iconKey: "fahrwerksteile", badge: "SUSP 3" },

    // Leistungsteile -> Bremsenstufen (1-3)
    { id: "bremsen-1", name: "Bremsen Stufe 1", group: "Leistungsteile", subCategory: "Bremsenstufen", sellPrice: 4000, buyPrice: 4000, iconKey: "ersatzbremsbelaege", badge: "BRAKE 1" },
    { id: "bremsen-2", name: "Bremsen Stufe 2", group: "Leistungsteile", subCategory: "Bremsenstufen", sellPrice: 7000, buyPrice: 4000, iconKey: "ersatzbremsbelaege", badge: "BRAKE 2" },
    { id: "bremsen-3", name: "Bremsen Stufe 3", group: "Leistungsteile", subCategory: "Bremsenstufen", sellPrice: 11000, buyPrice: 4000, iconKey: "ersatzbremsbelaege", badge: "BRAKE 3" },

    // Leistungsteile -> Turbolader
    { id: "turbolader", name: "Turbolader", group: "Leistungsteile", subCategory: "Turbolader", sellPrice: 18000, buyPrice: 4000, iconKey: "turbolader", badge: "TURBO" },

    // Tuning Verkauf (Optik & Räder)
    { id: "optisches-tuningteil", name: "Optisches Tuningteil", group: "Tuning Verkauf", subCategory: "Karosserie & Optik", sellPrice: 2500, buyPrice: 1000, iconKey: "optische_anbauteile", badge: "AERO" },
    { id: "lackierset", name: "Lackierset", group: "Tuning Verkauf", subCategory: "Karosserie & Optik", sellPrice: 2000, buyPrice: 1000, iconKey: "lackierset", badge: "PAINT" },
    { id: "fahrzeugraedersatz", name: "Fahrzeugrädersatz", group: "Tuning Verkauf", subCategory: "Räder & Rauch", sellPrice: 4000, buyPrice: 2000, iconKey: "fahrzeugraedersatz", badge: "WHEELS" },
    { id: "reifenrauch-set", name: "Reifenrauch-Set", group: "Tuning Verkauf", subCategory: "Räder & Rauch", sellPrice: 2000, buyPrice: 1000, iconKey: "reifenrauch_set", badge: "SMOKE" },
    { id: "fahrzeugextras-set", name: "Fahrzeugextras-Set", group: "Tuning Verkauf", subCategory: "Karosserie & Optik", sellPrice: 2000, buyPrice: 1000, iconKey: "fahrzeugextras_set", badge: "EXTRAS" },

    // Wartung Verkauf
    { id: "fahrwerksteile-wartung", name: "Fahrwerksteile", group: "Wartung Verkauf", subCategory: "Fahrwerk & Antrieb", sellPrice: 1000, buyPrice: 500, iconKey: "fahrwerksteile", badge: "SERVICE" },
    { id: "motoroel", name: "Motoröl", group: "Wartung Verkauf", subCategory: "Flüssigkeiten & Filter", sellPrice: 1000, buyPrice: 500, iconKey: "motoroel", badge: "5W-30" },
    { id: "ersatzreifen", name: "Ersatzreifen", group: "Wartung Verkauf", subCategory: "Fahrwerk & Antrieb", sellPrice: 1000, buyPrice: 500, iconKey: "ersatzreifen", badge: "TIRE" },
    { id: "luftfilter", name: "Luftfilter", group: "Wartung Verkauf", subCategory: "Flüssigkeiten & Filter", sellPrice: 1000, buyPrice: 500, iconKey: "luftfilter", badge: "INTAKE" },
    { id: "elektromotor", name: "Elektromotor", group: "Wartung Verkauf", subCategory: "Elektro & Zündung", sellPrice: 3000, buyPrice: 1500, iconKey: "elektromotor", badge: "EV DRIVE" },
    { id: "ersatzkupplung", name: "Ersatzkupplung", group: "Wartung Verkauf", subCategory: "Fahrwerk & Antrieb", sellPrice: 1000, buyPrice: 500, iconKey: "ersatzkupplung", badge: "CLUTCH" },
    { id: "ev-batterie", name: "Elektrofahrzeug-Batterie", group: "Wartung Verkauf", subCategory: "Elektro & Zündung", sellPrice: 1000, buyPrice: 500, iconKey: "ev_batterie", badge: "EV CELL" },
    { id: "zuendkerze", name: "Zündkerze", group: "Wartung Verkauf", subCategory: "Elektro & Zündung", sellPrice: 1000, buyPrice: 500, iconKey: "zuendkerze", badge: "SPARK" },
    { id: "ersatzbremsbelaege", name: "Ersatzbremsbeläge", group: "Wartung Verkauf", subCategory: "Fahrwerk & Antrieb", sellPrice: 1000, buyPrice: 500, iconKey: "ersatzbremsbelaege", badge: "PADS" },
    { id: "ev-kuehlmittel", name: "Elektrofahrzeug-Kühlmittel", group: "Wartung Verkauf", subCategory: "Flüssigkeiten & Filter", sellPrice: 1000, buyPrice: 500, iconKey: "ev_kuehlmittel", badge: "COOLANT" },

    // Zusatztuning Verkauf
    { id: "keramikbremsen", name: "Keramikbremsen", group: "Zusatztuning Verkauf", subCategory: "Spezial-Upgrades", sellPrice: 20000, buyPrice: 10000, iconKey: "keramikbremsen", badge: "CERAMIC" },
    { id: "motorswap", name: "Motorswap", group: "Zusatztuning Verkauf", subCategory: "Spezial-Upgrades", sellPrice: 60000, buyPrice: 30000, iconKey: "motorswap", badge: "SWAP V8" },

    // Sonstiges Verkauf
    { id: "reinigungsset", name: "Reinigungsset", group: "Sonstiges Verkauf", subCategory: "Werkzeug & Pflege", sellPrice: 500, buyPrice: 250, iconKey: "reinigungsset", badge: "CLEAN" },
    { id: "reparaturset", name: "Reparaturset", group: "Sonstiges Verkauf", subCategory: "Werkzeug & Pflege", sellPrice: 5000, buyPrice: 2500, iconKey: "reparaturset", badge: "REPAIR" },
    { id: "gewebeklebeband", name: "Gewebeklebeband", group: "Sonstiges Verkauf", subCategory: "Werkzeug & Pflege", sellPrice: 5000, buyPrice: 2500, iconKey: "gewebeklebeband", badge: "TAPE" }
  ]
};

function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      return {
        discountConfig: { ...DEFAULT_STATE.discountConfig, ...(raw.discountConfig || {}) },
        users: Array.isArray(raw.users) && raw.users.length ? raw.users : DEFAULT_STATE.users,
        items: Array.isArray(raw.items) && raw.items.length ? raw.items : DEFAULT_STATE.items
      };
    }
  } catch (err) {
    console.error("Fehler beim Laden von data.json:", err);
  }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

let state = loadState();

function saveState() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    console.error("Fehler beim Speichern von data.json:", err);
  }
}

function getSessionUser(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return state.users.find((u) => u.id === session.userId) || null;
}

function requireAdmin(req, res, next) {
  const user = getSessionUser(req);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Zugriff verweigert: Administratorrechte erforderlich." });
  }
  req.user = user;
  next();
}

function sanitizePublicItem(item) {
  return {
    id: item.id,
    name: item.name,
    group: item.group,
    subCategory: item.subCategory,
    iconKey: item.iconKey,
    customImage: item.customImage || null,
    badge: item.badge || ""
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "White Performance Tuner" });
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Benutzername und Passwort sind erforderlich." });
  }
  const user = state.users.find(
    (u) => u.username.toLowerCase() === String(username).trim().toLowerCase()
  );
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Ungültige Zugangsdaten." });
  }
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    userId: user.id,
    expiresAt: Date.now() + 1000 * 60 * 60 * 12
  });
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      label: user.label,
      canDiscount: Boolean(user.canDiscount),
      maxDiscount: Number(user.maxDiscount || 0)
    }
  });
});

app.post("/api/auth/logout", (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (token) sessions.delete(token);
  res.json({ ok: true });
});

app.get("/api/session", (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.json({
      authenticated: false,
      user: {
        id: "guest",
        username: "gast",
        role: "staff",
        label: "Mitarbeiter (Standard)",
        canDiscount: false,
        maxDiscount: 0
      }
    });
  }
  res.json({
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      label: user.label,
      canDiscount: Boolean(user.canDiscount),
      maxDiscount: Number(user.maxDiscount || 0)
    }
  });
});

// Öffentlicher Katalog: ENTHÄLT NIEMALS Einzelpreise (VK/EK)
app.get("/api/catalog", (_req, res) => {
  const groupsOrder = [
    "Leistungsteile",
    "Tuning Verkauf",
    "Wartung Verkauf",
    "Zusatztuning Verkauf",
    "Sonstiges Verkauf"
  ];
  const dynamicGroups = Array.from(new Set(state.items.map((i) => i.group)));
  const categories = [...groupsOrder.filter((g) => dynamicGroups.includes(g)), ...dynamicGroups.filter((g) => !groupsOrder.includes(g))];

  res.json({
    categories,
    items: state.items.map(sanitizePublicItem),
    discountConfig: {
      enabled: Boolean(state.discountConfig.enabled),
      maxDiscountPercent: Number(state.discountConfig.maxDiscountPercent || 0)
    }
  });
});

// Serverseitige Preisberechnung ohne Ausgabe von Einzelpreisen
app.post("/api/calculate", (req, res) => {
  const { selections, discountPercent } = req.body || {};
  const user = getSessionUser(req);

  const qtyMap = new Map();
  if (Array.isArray(selections)) {
    for (const entry of selections) {
      if (!entry || typeof entry.id !== "string") continue;
      const qty = Math.max(0, Math.min(999, Math.floor(Number(entry.qty) || 0)));
      if (qty > 0) {
        qtyMap.set(entry.id, (qtyMap.get(entry.id) || 0) + qty);
      }
    }
  }

  let subtotal = 0;
  let totalCount = 0;
  const lineItems = [];

  for (const [id, qty] of qtyMap.entries()) {
    const item = state.items.find((i) => i.id === id);
    if (!item) continue;
    subtotal += Number(item.sellPrice) * qty;
    totalCount += qty;
    lineItems.push({
      id: item.id,
      name: item.name,
      group: item.group,
      subCategory: item.subCategory,
      qty
    });
  }

  let appliedDiscountPercent = 0;
  const requestedDiscount = Math.max(0, Number(discountPercent) || 0);

  if (state.discountConfig.enabled && requestedDiscount > 0) {
    if (user && user.role === "admin") {
      appliedDiscountPercent = Math.min(requestedDiscount, Number(state.discountConfig.maxDiscountPercent || 100));
    } else if (user && user.canDiscount) {
      const cap = Math.min(Number(user.maxDiscount || 0), Number(state.discountConfig.maxDiscountPercent || 0));
      appliedDiscountPercent = Math.min(requestedDiscount, cap);
    } else {
      appliedDiscountPercent = 0;
    }
  }

  const discountAmount = Math.round((subtotal * appliedDiscountPercent) / 100);
  const total = Math.max(0, subtotal - discountAmount);

  res.json({
    lineItems,
    totalCount,
    subtotal,
    discountPercent: appliedDiscountPercent,
    discountAmount,
    total
  });
});

// Geschützte Admin-Endpunkte
app.get("/api/admin/overview", requireAdmin, (_req, res) => {
  const totalSellCatalog = state.items.reduce((acc, i) => acc + Number(i.sellPrice || 0), 0);
  const totalBuyCatalog = state.items.reduce((acc, i) => acc + Number(i.buyPrice || 0), 0);
  res.json({
    items: state.items,
    discountConfig: state.discountConfig,
    users: state.users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      label: u.label,
      canDiscount: Boolean(u.canDiscount),
      maxDiscount: Number(u.maxDiscount || 0)
    })),
    metrics: {
      itemCount: state.items.length,
      totalSellCatalog,
      totalBuyCatalog,
      totalMarginCatalog: totalSellCatalog - totalBuyCatalog
    }
  });
});

app.post("/api/admin/items", requireAdmin, (req, res) => {
  const { name, group, subCategory, sellPrice, buyPrice, iconKey, customImage, badge } = req.body || {};
  if (!name || !group) {
    return res.status(400).json({ error: "Bezeichnung und Kategorie sind erforderlich." });
  }
  const newItem = {
    id: `item-${crypto.randomBytes(4).toString("hex")}`,
    name: String(name).trim(),
    group: String(group).trim(),
    subCategory: String(subCategory || "Allgemein").trim(),
    sellPrice: Math.max(0, Number(sellPrice) || 0),
    buyPrice: Math.max(0, Number(buyPrice) || 0),
    iconKey: String(iconKey || "leistungsteile").trim(),
    customImage: customImage ? String(customImage) : null,
    badge: String(badge || "CUSTOM").trim().slice(0, 12)
  };
  state.items.push(newItem);
  saveState();
  res.status(201).json({ item: newItem });
});

app.put("/api/admin/items/:id", requireAdmin, (req, res) => {
  const idx = state.items.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Tuningteil nicht gefunden." });
  const existing = state.items[idx];
  const body = req.body || {};

  state.items[idx] = {
    ...existing,
    name: body.name !== undefined ? String(body.name).trim() : existing.name,
    group: body.group !== undefined ? String(body.group).trim() : existing.group,
    subCategory: body.subCategory !== undefined ? String(body.subCategory).trim() : existing.subCategory,
    sellPrice: body.sellPrice !== undefined ? Math.max(0, Number(body.sellPrice) || 0) : existing.sellPrice,
    buyPrice: body.buyPrice !== undefined ? Math.max(0, Number(body.buyPrice) || 0) : existing.buyPrice,
    iconKey: body.iconKey !== undefined ? String(body.iconKey).trim() : existing.iconKey,
    customImage: body.customImage !== undefined ? (body.customImage || null) : existing.customImage,
    badge: body.badge !== undefined ? String(body.badge).trim().slice(0, 12) : existing.badge
  };
  saveState();
  res.json({ item: state.items[idx] });
});

app.delete("/api/admin/items/:id", requireAdmin, (req, res) => {
  const before = state.items.length;
  state.items = state.items.filter((i) => i.id !== req.params.id);
  if (state.items.length === before) {
    return res.status(404).json({ error: "Tuningteil nicht gefunden." });
  }
  saveState();
  res.json({ ok: true });
});

app.put("/api/admin/discount-config", requireAdmin, (req, res) => {
  const { enabled, maxDiscountPercent } = req.body || {};
  state.discountConfig = {
    ...state.discountConfig,
    enabled: enabled !== undefined ? Boolean(enabled) : state.discountConfig.enabled,
    maxDiscountPercent:
      maxDiscountPercent !== undefined
        ? Math.max(0, Math.min(100, Number(maxDiscountPercent) || 0))
        : state.discountConfig.maxDiscountPercent
  };
  saveState();
  res.json({ discountConfig: state.discountConfig });
});

app.put("/api/admin/users/:id/permissions", requireAdmin, (req, res) => {
  const target = state.users.find((u) => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: "Benutzer nicht gefunden." });
  const { canDiscount, maxDiscount, role } = req.body || {};
  if (canDiscount !== undefined) target.canDiscount = Boolean(canDiscount);
  if (maxDiscount !== undefined) {
    target.maxDiscount = Math.max(0, Math.min(Number(state.discountConfig.maxDiscountPercent || 100), Number(maxDiscount) || 0));
  }
  if (role && ["admin", "meister", "staff"].includes(role)) {
    target.role = role;
  }
  saveState();
  res.json({
    user: {
      id: target.id,
      username: target.username,
      role: target.role,
      label: target.label,
      canDiscount: target.canDiscount,
      maxDiscount: target.maxDiscount
    }
  });
});

app.post("/api/admin/users", requireAdmin, (req, res) => {
  const { username, password, role, label, canDiscount, maxDiscount } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Benutzername und Passwort sind erforderlich." });
  }
  const cleanUsername = String(username).trim().toLowerCase();
  if (state.users.some((u) => u.username.toLowerCase() === cleanUsername)) {
    return res.status(409).json({ error: "Benutzername existiert bereits." });
  }
  const validRole = ["admin", "meister", "staff"].includes(role) ? role : "staff";
  const newUser = {
    id: `u-${crypto.randomBytes(4).toString("hex")}`,
    username: cleanUsername,
    role: validRole,
    label: String(label || cleanUsername).trim(),
    canDiscount: Boolean(canDiscount),
    maxDiscount: Math.max(0, Math.min(100, Number(maxDiscount) || 0)),
    passwordHash: hashPassword(password)
  };
  state.users.push(newUser);
  saveState();
  res.status(201).json({
    user: {
      id: newUser.id,
      username: newUser.username,
      role: newUser.role,
      label: newUser.label,
      canDiscount: newUser.canDiscount,
      maxDiscount: newUser.maxDiscount
    }
  });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`White Performance Tuner läuft auf Port ${PORT}`);
});
