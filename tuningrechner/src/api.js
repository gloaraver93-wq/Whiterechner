'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const { HttpError } = require('./errors');
const sec = require('./security');
const pricing = require('./pricing');
const http = require('./http');
const { tx, getSettings, saveSettings } = require('./db');

const UPLOAD_DIR = path.join(config.dataDir, 'uploads');
const IMAGE_PATH_RE = /^\/(uploads\/[a-f0-9]{32}\.(png|jpg|webp|gif)|img\/[a-z0-9_\-/]+\.svg)$/;
const SESSION_COOKIE = 'sid';

/* ---------- Eingabe-Validierung ---------- */
const str = (v, { min = 0, max = 200, name = 'Feld' } = {}) => {
  v = v == null ? '' : String(v).trim();
  if (v.length < min) throw new HttpError(400, `${name} fehlt`);
  if (v.length > max) throw new HttpError(400, `${name} ist zu lang (max. ${max} Zeichen)`);
  return v;
};
const int = (v, { min = -1000000, max = 1000000, def = 0, name = 'Wert' } = {}) => {
  if (v == null || v === '') return def;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `${name} ist ungültig`);
  return n;
};
const bool = (v) => v === true || v === 1 || v === '1' || v === 'true';
const cents = (v, name = 'Preis') => {
  const n = Number(typeof v === 'string' ? v.replace(',', '.') : v);
  if (v == null || v === '' || !Number.isFinite(n) || n < 0 || n > 100000000) throw new HttpError(400, `${name} ist ungültig`);
  return Math.round(n * 100);
};
const isoUtc = (s) => (s ? String(s).replace(' ', 'T') + 'Z' : s);

function createApi(db) {
  const routes = [];
  const loginLimiter = new sec.Limiter({ max: 6, windowMs: 15 * 60 * 1000, lockMs: 10 * 60 * 1000 });
  const ipLimiter = new sec.Limiter({ max: 40, windowMs: 15 * 60 * 1000, lockMs: 10 * 60 * 1000 });

  const stmt = {
    session: db.prepare(
      `SELECT u.id, u.username, u.role, u.can_discount, u.must_change, s.token_hash
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`
    ),
  };

  function route(method, pattern, auth, handler, opts = {}) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
    routes.push({ method, re, keys, auth, handler, allowMustChange: Boolean(opts.allowMustChange) });
  }

  /* ---------- Sessions ---------- */
  function getUser(req) {
    const token = http.parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!token || token.length > 100) return null;
    const row = stmt.session.get(sec.hashToken(token), Date.now());
    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      role: row.role,
      canDiscount: Boolean(row.can_discount),
      mustChange: Boolean(row.must_change),
      tokenHash: row.token_hash,
    };
  }

  function cookie(value, maxAgeSec) {
    const parts = [`${SESSION_COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSec}`];
    if (config.production) parts.push('Secure');
    return parts.join('; ');
  }

  function publicUser(u) {
    return { id: u.id, username: u.username, role: u.role, canDiscount: u.canDiscount, mustChange: u.mustChange };
  }

  setInterval(() => {
    try {
      db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
    } catch {
      /* ignorieren */
    }
  }, 10 * 60 * 1000).unref();

  /* ---------- Schutz vor Cross-Site-Anfragen ---------- */
  function csrfCheck(req) {
    if (req.headers['x-requested-with'] !== 'tuningrechner') throw new HttpError(403, 'Ungültige Anfrage');
    const site = req.headers['sec-fetch-site'];
    if (site && site !== 'same-origin' && site !== 'none') throw new HttpError(403, 'Ungültige Anfrage');
    const origin = req.headers.origin;
    if (origin) {
      let host;
      try {
        host = new URL(origin).host;
      } catch {
        throw new HttpError(403, 'Ungültige Anfrage');
      }
      if (host !== req.headers.host) throw new HttpError(403, 'Ungültige Anfrage');
    }
  }

  /* =====================================================================
   * Öffentlich
   * ===================================================================== */
  route('GET', '/api/me', 'public', (c) => {
    const s = getSettings(db);
    return { user: c.user ? publicUser(c.user) : null, brand: { companyName: s.companyName } };
  });

  route('POST', '/api/login', 'public', async (c) => {
    const body = await http.readJson(c.req);
    const username = str(body.username, { max: 64 });
    const password = typeof body.password === 'string' ? body.password : '';
    if (!username || !password || password.length > 200) throw new HttpError(400, 'Benutzername und Passwort eingeben');

    const ip = http.clientIp(c.req);
    const key = `${ip}|${username.toLowerCase()}`;
    const wait = Math.max(loginLimiter.check(key), ipLimiter.check(ip));
    if (wait) throw new HttpError(429, `Zu viele Fehlversuche. Bitte in ${Math.ceil(wait / 60)} Minute(n) erneut versuchen.`, { retryAfter: wait });

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    const ok = await sec.verifyPassword(password, user ? user.password_hash : await sec.getDummyHash());
    if (!user || !ok || !user.active) {
      loginLimiter.fail(key);
      ipLimiter.fail(ip);
      throw new HttpError(401, 'Benutzername oder Passwort falsch');
    }
    loginLimiter.reset(key);

    const token = sec.newToken();
    const maxAge = config.sessionHours * 3600;
    db.prepare('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
      sec.hashToken(token),
      user.id,
      Date.now() + maxAge * 1000
    );
    c.res.setHeader('Set-Cookie', cookie(token, maxAge));
    return {
      user: publicUser({
        id: user.id,
        username: user.username,
        role: user.role,
        canDiscount: Boolean(user.can_discount),
        mustChange: Boolean(user.must_change),
      }),
    };
  });

  route('POST', '/api/logout', 'public', (c) => {
    if (c.user) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(c.user.tokenHash);
    c.res.setHeader('Set-Cookie', cookie('', 0));
    return { ok: true };
  });

  /* =====================================================================
   * Angemeldete Benutzer
   * ===================================================================== */
  route(
    'POST',
    '/api/password',
    'user',
    async (c) => {
      const body = await http.readJson(c.req);
      const current = typeof body.current === 'string' ? body.current : '';
      const next = typeof body.next === 'string' ? body.next : '';
      if (next.length < 8) throw new HttpError(400, 'Das neue Passwort muss mindestens 8 Zeichen lang sein');
      if (next.length > 200) throw new HttpError(400, 'Das neue Passwort ist zu lang');
      if (next === current) throw new HttpError(400, 'Das neue Passwort muss sich vom alten unterscheiden');
      const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(c.user.id);
      if (!(await sec.verifyPassword(current, row.password_hash))) throw new HttpError(400, 'Das aktuelle Passwort ist falsch');
      const hash = await sec.hashPassword(next);
      tx(db, () => {
        db.prepare('UPDATE users SET password_hash = ?, must_change = 0 WHERE id = ?').run(hash, c.user.id);
        db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').run(c.user.id, c.user.tokenHash);
      });
      return { ok: true };
    },
    { allowMustChange: true }
  );

  // Katalog: enthält bewusst KEINE Preise (die Spalte price_cents wird nie selektiert).
  route('GET', '/api/catalog', 'user', (c) => {
    const settings = getSettings(db);
    const cats = db.prepare('SELECT id, name, parent_id, exclusive FROM categories ORDER BY sort_order, id').all();
    const parts = db
      .prepare('SELECT id, category_id, name, description, image FROM parts WHERE active = 1 ORDER BY sort_order, id')
      .all();
    const byCat = new Map();
    for (const p of parts) {
      if (!byCat.has(p.category_id)) byCat.set(p.category_id, []);
      byCat.get(p.category_id).push({ id: p.id, name: p.name, description: p.description, image: p.image });
    }
    const node = (cat) => ({ id: cat.id, name: cat.name, exclusive: Boolean(cat.exclusive), parts: byCat.get(cat.id) || [], children: [] });
    const nodes = new Map(cats.map((cat) => [cat.id, node(cat)]));
    const tree = [];
    for (const cat of cats) {
      if (cat.parent_id == null) tree.push(nodes.get(cat.id));
      else if (nodes.has(cat.parent_id)) nodes.get(cat.parent_id).children.push(nodes.get(cat.id));
    }
    const visible = tree
      .map((t) => ({ ...t, children: t.children.filter((ch) => ch.parts.length) }))
      .filter((t) => t.parts.length || t.children.length);
    const allowed = pricing.discountAllowed(c.user, settings);
    return {
      categories: visible,
      brand: { companyName: settings.companyName },
      currency: settings.currency,
      discount: {
        available: allowed,
        percent: allowed ? settings.discountPercent : 0,
        canEditPercent: allowed && c.user.role === 'admin',
      },
    };
  });

  route('POST', '/api/calculate', 'user', async (c) => {
    const body = await http.readJson(c.req);
    const result = pricing.calculate(db, c.user, body.items, body, getSettings(db));
    return pricing.publicView(result);
  });

  route('POST', '/api/invoices', 'user', async (c) => {
    const body = await http.readJson(c.req);
    const settings = getSettings(db);
    const r = pricing.calculate(db, c.user, body.items, body, settings);
    if (!r.count) throw new HttpError(400, 'Es wurden keine Teile ausgewählt');
    const customer = str(body.customer, { max: 80 });
    const plate = str(body.plate, { max: 20 });
    const itemsJson = JSON.stringify(r.lines.map((l) => ({ id: l.id, name: l.name, category: l.category, priceCents: l.priceCents })));
    const created = tx(db, () => {
      const next = db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS n FROM invoices').get().n;
      const number = `R-${new Date().getFullYear()}-${String(next).padStart(5, '0')}`;
      db.prepare(
        `INSERT INTO invoices(id, number, user_id, username, customer, plate, items_json, subtotal_cents, discount_percent, discount_cents, total_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(next, number, c.user.id, c.user.username, customer, plate, itemsJson, r.subtotalCents, r.discountPercent, r.discountCents, r.totalCents);
      return db.prepare('SELECT number, created_at FROM invoices WHERE id = ?').get(next);
    });
    const view = pricing.publicView(r);
    return {
      invoice: {
        number: created.number,
        createdAt: isoUtc(created.created_at),
        company: settings.companyName,
        currency: settings.currency,
        employee: c.user.username,
        customer,
        plate,
        ...view,
      },
    };
  });

  /* =====================================================================
   * Administration (serverseitig nur für Rolle "admin")
   * ===================================================================== */
  const adminRoute = (method, pattern, handler) => route(method, pattern, 'admin', handler);

  adminRoute('GET', '/api/admin/overview', () => {
    const categories = db
      .prepare('SELECT id, name, parent_id AS parentId, exclusive, sort_order AS sortOrder FROM categories ORDER BY sort_order, id')
      .all()
      .map((x) => ({ ...x, exclusive: Boolean(x.exclusive) }));
    const parts = db
      .prepare(
        'SELECT id, category_id AS categoryId, name, description, image, price_cents AS priceCents, active, sort_order AS sortOrder FROM parts ORDER BY sort_order, id'
      )
      .all()
      .map((x) => ({ ...x, active: Boolean(x.active) }));
    const users = db
      .prepare('SELECT id, username, role, can_discount AS canDiscount, active, must_change AS mustChange, created_at AS createdAt FROM users ORDER BY username')
      .all()
      .map((x) => ({ ...x, canDiscount: Boolean(x.canDiscount), active: Boolean(x.active), mustChange: Boolean(x.mustChange), createdAt: isoUtc(x.createdAt) }));
    const inv = db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(total_cents), 0) AS revenue, COALESCE(SUM(discount_cents), 0) AS discounts FROM invoices').get();
    return {
      categories,
      parts,
      users,
      settings: getSettings(db),
      stats: { invoices: inv.n, revenueCents: inv.revenue, discountCents: inv.discounts },
    };
  });

  /* ----- Kategorien ----- */
  function categoryInput(body, selfId) {
    const name = str(body.name, { min: 1, max: 60, name: 'Name' });
    let parentId = body.parentId == null || body.parentId === '' ? null : int(body.parentId, { min: 1, name: 'Oberkategorie' });
    if (parentId != null) {
      const parent = db.prepare('SELECT id, parent_id FROM categories WHERE id = ?').get(parentId);
      if (!parent) throw new HttpError(400, 'Oberkategorie existiert nicht');
      if (parent.parent_id != null) throw new HttpError(400, 'Es sind nur zwei Ebenen erlaubt');
      if (selfId != null) {
        if (parentId === selfId) throw new HttpError(400, 'Eine Kategorie kann nicht ihre eigene Oberkategorie sein');
        const kids = db.prepare('SELECT COUNT(*) AS n FROM categories WHERE parent_id = ?').get(selfId).n;
        if (kids > 0) throw new HttpError(400, 'Kategorien mit Unterkategorien können nicht verschachtelt werden');
      }
    }
    return { name, parentId, exclusive: bool(body.exclusive) ? 1 : 0, sortOrder: int(body.sortOrder, { min: -9999, max: 9999, name: 'Sortierung' }) };
  }

  adminRoute('POST', '/api/admin/categories', async (c) => {
    const v = categoryInput(await http.readJson(c.req), null);
    const r = db.prepare('INSERT INTO categories(name, parent_id, exclusive, sort_order) VALUES (?, ?, ?, ?)').run(v.name, v.parentId, v.exclusive, v.sortOrder);
    return { id: Number(r.lastInsertRowid) };
  });

  adminRoute('PUT', '/api/admin/categories/:id', async (c) => {
    const id = int(c.params.id, { min: 1 });
    if (!db.prepare('SELECT 1 FROM categories WHERE id = ?').get(id)) throw new HttpError(404, 'Kategorie nicht gefunden');
    const v = categoryInput(await http.readJson(c.req), id);
    db.prepare('UPDATE categories SET name = ?, parent_id = ?, exclusive = ?, sort_order = ? WHERE id = ?').run(v.name, v.parentId, v.exclusive, v.sortOrder, id);
    return { ok: true };
  });

  adminRoute('DELETE', '/api/admin/categories/:id', (c) => {
    const id = int(c.params.id, { min: 1 });
    if (!db.prepare('SELECT 1 FROM categories WHERE id = ?').get(id)) throw new HttpError(404, 'Kategorie nicht gefunden');
    const images = db
      .prepare('SELECT image FROM parts WHERE category_id = ? OR category_id IN (SELECT id FROM categories WHERE parent_id = ?)')
      .all(id, id)
      .map((r) => r.image);
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    images.forEach(cleanupImage);
    return { ok: true };
  });

  /* ----- Teile ----- */
  function partInput(body) {
    const categoryId = int(body.categoryId, { min: 1, name: 'Kategorie' });
    if (!db.prepare('SELECT 1 FROM categories WHERE id = ?').get(categoryId)) throw new HttpError(400, 'Kategorie existiert nicht');
    let image = body.image == null ? '' : String(body.image).trim();
    if (image && !IMAGE_PATH_RE.test(image)) throw new HttpError(400, 'Ungültiger Bildpfad');
    if (image.startsWith('/uploads/') && !fs.existsSync(path.join(UPLOAD_DIR, path.basename(image)))) {
      throw new HttpError(400, 'Das hochgeladene Bild wurde nicht gefunden');
    }
    return {
      categoryId,
      name: str(body.name, { min: 1, max: 80, name: 'Name' }),
      description: str(body.description, { max: 300, name: 'Beschreibung' }),
      image: image || null,
      priceCents: cents(body.price),
      active: bool(body.active) ? 1 : 0,
      sortOrder: int(body.sortOrder, { min: -9999, max: 9999, name: 'Sortierung' }),
    };
  }

  adminRoute('POST', '/api/admin/parts', async (c) => {
    const v = partInput(await http.readJson(c.req));
    const r = db
      .prepare('INSERT INTO parts(category_id, name, description, image, price_cents, active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(v.categoryId, v.name, v.description, v.image, v.priceCents, v.active, v.sortOrder);
    return { id: Number(r.lastInsertRowid) };
  });

  adminRoute('PUT', '/api/admin/parts/:id', async (c) => {
    const id = int(c.params.id, { min: 1 });
    const old = db.prepare('SELECT image FROM parts WHERE id = ?').get(id);
    if (!old) throw new HttpError(404, 'Teil nicht gefunden');
    const v = partInput(await http.readJson(c.req));
    db.prepare('UPDATE parts SET category_id = ?, name = ?, description = ?, image = ?, price_cents = ?, active = ?, sort_order = ? WHERE id = ?').run(
      v.categoryId, v.name, v.description, v.image, v.priceCents, v.active, v.sortOrder, id
    );
    if (old.image !== v.image) cleanupImage(old.image);
    return { ok: true };
  });

  adminRoute('DELETE', '/api/admin/parts/:id', (c) => {
    const id = int(c.params.id, { min: 1 });
    const old = db.prepare('SELECT image FROM parts WHERE id = ?').get(id);
    if (!old) throw new HttpError(404, 'Teil nicht gefunden');
    db.prepare('DELETE FROM parts WHERE id = ?').run(id);
    cleanupImage(old.image);
    return { ok: true };
  });

  /* ----- Bild-Upload ----- */
  function detectImage(buf) {
    if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
    if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
    if (buf.length > 6 && ['GIF87a', 'GIF89a'].includes(buf.subarray(0, 6).toString('latin1'))) return 'gif';
    if (buf.length > 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
    return null;
  }

  function cleanupImage(image) {
    if (!image || !image.startsWith('/uploads/')) return;
    const used = db.prepare('SELECT COUNT(*) AS n FROM parts WHERE image = ?').get(image).n;
    if (used === 0) fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(image))).catch(() => {});
  }

  adminRoute('POST', '/api/admin/upload', async (c) => {
    const type = String(c.req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(type)) {
      throw new HttpError(415, 'Erlaubt sind PNG, JPG, WEBP und GIF');
    }
    const buf = await http.readBody(c.req, config.maxUploadBytes);
    const ext = detectImage(buf);
    if (!ext) throw new HttpError(400, 'Die Datei ist kein gültiges Bild');
    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
    const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
    await fs.promises.writeFile(path.join(UPLOAD_DIR, name), buf, { mode: 0o640 });
    return { path: `/uploads/${name}` };
  });

  /* ----- Einstellungen / Rabatt ----- */
  adminRoute('PUT', '/api/admin/settings', async (c) => {
    const b = await http.readJson(c.req);
    const percent = Number(typeof b.discountPercent === 'string' ? b.discountPercent.replace(',', '.') : b.discountPercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new HttpError(400, 'Rabatt muss zwischen 0 und 100 % liegen');
    saveSettings(db, {
      companyName: str(b.companyName, { min: 1, max: 60, name: 'Firmenname' }),
      currency: str(b.currency, { min: 1, max: 5, name: 'Währung' }),
      discountEnabled: bool(b.discountEnabled),
      discountPercent: Math.round(percent * 100) / 100,
    });
    return { settings: getSettings(db) };
  });

  /* ----- Benutzer ----- */
  const USERNAME_RE = /^[A-Za-z0-9_.-]{3,32}$/;
  const activeAdminCount = () => db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1").get().n;
  const dropSessions = (userId) => db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);

  function role(v) {
    if (v !== 'admin' && v !== 'employee') throw new HttpError(400, 'Ungültige Rolle');
    return v;
  }

  adminRoute('POST', '/api/admin/users', async (c) => {
    const b = await http.readJson(c.req);
    const username = str(b.username, { min: 3, max: 32, name: 'Benutzername' });
    if (!USERNAME_RE.test(username)) throw new HttpError(400, 'Benutzername: 3-32 Zeichen (Buchstaben, Zahlen, _ . -)');
    const password = typeof b.password === 'string' ? b.password : '';
    if (password.length < 8) throw new HttpError(400, 'Das Passwort muss mindestens 8 Zeichen lang sein');
    if (password.length > 200) throw new HttpError(400, 'Das Passwort ist zu lang');
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) throw new HttpError(409, 'Benutzername ist bereits vergeben');
    const r = db
      .prepare('INSERT INTO users(username, password_hash, role, can_discount, active, must_change) VALUES (?, ?, ?, ?, 1, 1)')
      .run(username, await sec.hashPassword(password), role(b.role || 'employee'), bool(b.canDiscount) ? 1 : 0);
    return { id: Number(r.lastInsertRowid) };
  });

  adminRoute('PUT', '/api/admin/users/:id', async (c) => {
    const id = int(c.params.id, { min: 1 });
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!target) throw new HttpError(404, 'Benutzer nicht gefunden');
    const b = await http.readJson(c.req);

    const next = {
      role: b.role !== undefined ? role(b.role) : target.role,
      canDiscount: b.canDiscount !== undefined ? (bool(b.canDiscount) ? 1 : 0) : target.can_discount,
      active: b.active !== undefined ? (bool(b.active) ? 1 : 0) : target.active,
    };
    if (id === c.user.id && (next.role !== 'admin' || !next.active)) {
      throw new HttpError(400, 'Du kannst dir selbst weder die Admin-Rolle entziehen noch dich deaktivieren');
    }
    let hash = null;
    if (b.password !== undefined && b.password !== '') {
      if (typeof b.password !== 'string' || b.password.length < 8) throw new HttpError(400, 'Das Passwort muss mindestens 8 Zeichen lang sein');
      if (b.password.length > 200) throw new HttpError(400, 'Das Passwort ist zu lang');
      hash = await sec.hashPassword(b.password);
    }
    tx(db, () => {
      db.prepare('UPDATE users SET role = ?, can_discount = ?, active = ? WHERE id = ?').run(next.role, next.canDiscount, next.active, id);
      if (hash) {
        db.prepare('UPDATE users SET password_hash = ?, must_change = 1 WHERE id = ?').run(hash, id);
      }
      if (activeAdminCount() < 1) throw new HttpError(400, 'Es muss mindestens ein aktiver Administrator vorhanden sein');
      if (hash || !next.active || next.role !== target.role) dropSessions(id);
    });
    return { ok: true };
  });

  adminRoute('DELETE', '/api/admin/users/:id', (c) => {
    const id = int(c.params.id, { min: 1 });
    if (id === c.user.id) throw new HttpError(400, 'Du kannst dich nicht selbst löschen');
    if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(id)) throw new HttpError(404, 'Benutzer nicht gefunden');
    tx(db, () => {
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      if (activeAdminCount() < 1) throw new HttpError(400, 'Es muss mindestens ein aktiver Administrator vorhanden sein');
    });
    return { ok: true };
  });

  /* ----- Rechnungen (mit internen Einzelpreisen) ----- */
  adminRoute('GET', '/api/admin/invoices', () => {
    const rows = db
      .prepare(
        `SELECT id, number, username, customer, plate, subtotal_cents AS subtotalCents, discount_percent AS discountPercent,
                discount_cents AS discountCents, total_cents AS totalCents, created_at AS createdAt
           FROM invoices ORDER BY id DESC LIMIT 300`
      )
      .all();
    return { invoices: rows.map((r) => ({ ...r, createdAt: isoUtc(r.createdAt) })) };
  });

  adminRoute('GET', '/api/admin/invoices/:id', (c) => {
    const id = int(c.params.id, { min: 1 });
    const r = db
      .prepare(
        `SELECT id, number, username, customer, plate, items_json, subtotal_cents AS subtotalCents, discount_percent AS discountPercent,
                discount_cents AS discountCents, total_cents AS totalCents, created_at AS createdAt
           FROM invoices WHERE id = ?`
      )
      .get(id);
    if (!r) throw new HttpError(404, 'Rechnung nicht gefunden');
    const { items_json: itemsJson, ...rest } = r;
    return { invoice: { ...rest, createdAt: isoUtc(r.createdAt), items: JSON.parse(itemsJson) } };
  });

  /* =====================================================================
   * Dispatcher
   * ===================================================================== */
  async function handle(req, res, url, pathname) {
    try {
      let matched = null;
      let pathMatched = false;
      for (const r of routes) {
        const m = r.re.exec(pathname);
        if (!m) continue;
        pathMatched = true;
        if (r.method !== req.method) continue;
        matched = { r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
        break;
      }
      if (!matched) throw new HttpError(pathMatched ? 405 : 404, pathMatched ? 'Methode nicht erlaubt' : 'Nicht gefunden');

      if (req.method !== 'GET' && req.method !== 'HEAD') csrfCheck(req);

      const user = getUser(req);
      const { r } = matched;
      if (r.auth !== 'public' && !user) throw new HttpError(401, 'Bitte anmelden');
      if (r.auth === 'admin' && user.role !== 'admin') throw new HttpError(403, 'Keine Berechtigung');
      if (user && user.mustChange && r.auth !== 'public' && !r.allowMustChange) {
        throw new HttpError(403, 'Bitte zuerst das Passwort ändern', { code: 'password_change_required' });
      }

      const out = await r.handler({ req, res, url, params: matched.params, user, db });
      http.sendJson(res, 200, out === undefined ? { ok: true } : out);
    } catch (err) {
      http.sendError(res, err);
    }
  }

  return { handle, getUser };
}

module.exports = { createApi, UPLOAD_DIR };
