'use strict';
/**
 * End-to-End-Test: startet den Server mit einer temporären Datenbank und prüft
 * Berechnung, Rabatt-Regeln und vor allem die serverseitige Trennung Mitarbeiter/Admin.
 * Aufruf: npm test
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const PORT = 3900 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tuning-test-'));
const ADMIN_PW = 'AdminPasswort123';

let passed = 0;
const results = [];
async function test(name, fn) {
  try {
    await fn();
    passed++;
    results.push(`  ✓ ${name}`);
  } catch (e) {
    results.push(`  ✗ ${name}\n      ${e.message}`);
    process.exitCode = 1;
  }
}

class Client {
  constructor() { this.cookie = ''; }
  async req(method, url, body, extraHeaders = {}) {
    const headers = { 'X-Requested-With': 'tuningrechner', ...extraHeaders };
    let payload;
    if (body instanceof Buffer) payload = body;
    else if (body !== undefined) { headers['Content-Type'] = headers['Content-Type'] || 'application/json'; payload = JSON.stringify(body); }
    if (this.cookie) headers.Cookie = this.cookie;
    const res = await fetch(BASE + url, { method, headers, body: payload, redirect: 'manual' });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* kein JSON */ }
    return { status: res.status, json, text, headers: res.headers };
  }
  login(u, p) { return this.req('POST', '/api/login', { username: u, password: p }); }
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE + '/healthz')).ok) return; } catch { /* noch nicht bereit */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Server startet nicht');
}

(async () => {
  const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, ADMIN_PASSWORD: ADMIN_PW, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => (log += d));
  server.stderr.on('data', (d) => (log += d));

  try {
    await waitForServer();
    const admin = new Client();
    const staff = new Client();
    const staff2 = new Client();
    const anon = new Client();
    let adminOverview;

    await test('Login mit falschem Passwort wird abgelehnt', async () => {
      const r = await anon.login('admin', 'falsch-falsch');
      assert.strictEqual(r.status, 401);
    });
    await test('Admin kann sich anmelden', async () => {
      const r = await admin.login('admin', ADMIN_PW);
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.user.role, 'admin');
    });
    await test('Session-Cookie ist HttpOnly + SameSite=Strict', async () => {
      const c = new Client();
      const r = await c.login('admin', ADMIN_PW);
      const set = r.headers.get('set-cookie');
      assert.ok(/HttpOnly/i.test(set) && /SameSite=Strict/i.test(set), set);
    });

    await test('Admin legt Mitarbeiter (mit/ohne Rabatt-Recht) an', async () => {
      adminOverview = (await admin.req('GET', '/api/admin/overview')).json;
      assert.ok(adminOverview.parts.length > 30);
      let r = await admin.req('POST', '/api/admin/users', { username: 'max', password: 'startpasswort1', role: 'employee', canDiscount: false });
      assert.strictEqual(r.status, 200, r.text);
      r = await admin.req('POST', '/api/admin/users', { username: 'lisa', password: 'startpasswort2', role: 'employee', canDiscount: true });
      assert.strictEqual(r.status, 200, r.text);
    });
    await test('Neuer Mitarbeiter muss zuerst das Passwort ändern', async () => {
      const r = await staff.login('max', 'startpasswort1');
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.user.mustChange, true);
      const blocked = await staff.req('GET', '/api/catalog');
      assert.strictEqual(blocked.status, 403);
      assert.strictEqual(blocked.json.code, 'password_change_required');
      const ch = await staff.req('POST', '/api/password', { current: 'startpasswort1', next: 'MaxNeuesPasswort1' });
      assert.strictEqual(ch.status, 200, ch.text);
      assert.strictEqual((await staff.req('GET', '/api/catalog')).status, 200);
    });
    await test('Mitarbeiter 2 (Rabatt-Recht) einsatzbereit', async () => {
      await staff2.login('lisa', 'startpasswort2');
      const ch = await staff2.req('POST', '/api/password', { current: 'startpasswort2', next: 'LisaNeuesPasswort2' });
      assert.strictEqual(ch.status, 200);
    });

    await test('Katalog enthält KEINE Preise (Mitarbeiter)', async () => {
      const r = await staff.req('GET', '/api/catalog');
      assert.ok(!/price|preis|cents/i.test(r.text), 'Preis-Feld im Katalog gefunden');
      const names = JSON.stringify(r.json);
      assert.ok(names.includes('Leistungsteile') && names.includes('Motorstufe 4') && names.includes('Bremsenstufe 3'));
    });
    await test('Admin-API ist für Mitarbeiter gesperrt (403)', async () => {
      for (const [m, u, b] of [
        ['GET', '/api/admin/overview'], ['GET', '/api/admin/invoices'], ['GET', '/api/admin/invoices/1'],
        ['POST', '/api/admin/parts', { categoryId: 1, name: 'x', price: 1 }], ['PUT', '/api/admin/parts/1', { categoryId: 1, name: 'x', price: 1 }],
        ['DELETE', '/api/admin/parts/1'], ['POST', '/api/admin/categories', { name: 'x' }], ['PUT', '/api/admin/settings', { discountPercent: 99 }],
        ['POST', '/api/admin/users', { username: 'evil', password: 'password123' }], ['PUT', '/api/admin/users/2', { role: 'admin' }],
      ]) {
        const r = await staff.req(m, u, b);
        assert.strictEqual(r.status, 403, `${m} ${u} -> ${r.status}`);
        assert.ok(!/priceCents/.test(r.text));
      }
    });
    await test('Admin-API ohne Login gesperrt (401)', async () => {
      assert.strictEqual((await anon.req('GET', '/api/admin/overview')).status, 401);
      assert.strictEqual((await anon.req('GET', '/api/catalog')).status, 401);
      assert.strictEqual((await anon.req('POST', '/api/calculate', { items: [1] })).status, 401);
    });
    await test('Adminbereich (HTML + JS) nur für Admins', async () => {
      assert.strictEqual((await anon.req('GET', '/admin/')).status, 302);
      assert.strictEqual((await staff.req('GET', '/admin/')).status, 302);
      assert.strictEqual((await staff.req('GET', '/admin/admin.js')).status, 404);
      assert.strictEqual((await anon.req('GET', '/admin/admin.js')).status, 404);
      const ok = await admin.req('GET', '/admin/');
      assert.strictEqual(ok.status, 200);
      assert.ok((await admin.req('GET', '/admin/admin.js')).text.includes('Administration'));
    });
    await test('Preise stehen in keiner öffentlich ausgelieferten Datei', async () => {
      for (const f of ['/', '/app.js', '/common.js', '/styles.css']) {
        const r = await anon.req('GET', f);
        assert.strictEqual(r.status, 200, f);
        assert.ok(!/priceCents|price_cents/.test(r.text) || f === '/app.js' && !/priceCents/.test(r.text), f);
      }
    });

    const partIds = (names) => names.map((n) => adminOverview.parts.find((p) => p.name === n).id);
    const priceOf = (name) => adminOverview.parts.find((p) => p.name === name).priceCents;

    await test('Serverseitige Berechnung stimmt (ohne Rabatt)', async () => {
      const names = ['Motorstufe 3', 'Getriebestufe 2', 'Sportfelgen'];
      const r = await staff.req('POST', '/api/calculate', { items: partIds(names) });
      assert.strictEqual(r.status, 200, r.text);
      const sum = names.reduce((s, n) => s + priceOf(n), 0);
      assert.strictEqual(r.json.subtotalCents, sum);
      assert.strictEqual(r.json.totalCents, sum);
      assert.strictEqual(r.json.count, 3);
      assert.ok(!/priceCents/.test(r.text) && r.json.items.every((i) => !('price' in i) && !('priceCents' in i)));
    });
    await test('Mitarbeiter ohne Rabatt-Recht: Rabatt wird ignoriert', async () => {
      const r = await staff.req('POST', '/api/calculate', { items: partIds(['Motorstufe 1']), applyDiscount: true, discountPercent: 90 });
      assert.strictEqual(r.json.discountPercent, 0);
      assert.strictEqual(r.json.totalCents, priceOf('Motorstufe 1'));
      const cat = (await staff.req('GET', '/api/catalog')).json;
      assert.strictEqual(cat.discount.available, false);
    });
    await test('Mitarbeiter mit Rabatt-Recht: fester Satz, Prozent nicht manipulierbar', async () => {
      const names = ['Motorstufe 2', 'Turbo', 'Chrom-Lackierung'];
      const r = await staff2.req('POST', '/api/calculate', { items: partIds(names), applyDiscount: true, discountPercent: 90 });
      const sum = names.reduce((s, n) => s + priceOf(n), 0);
      assert.strictEqual(r.json.discountPercent, 10);
      assert.strictEqual(r.json.discountCents, Math.round(sum * 0.1));
      assert.strictEqual(r.json.totalCents, sum - Math.round(sum * 0.1));
      const off = await staff2.req('POST', '/api/calculate', { items: partIds(names), applyDiscount: false });
      assert.strictEqual(off.json.discountCents, 0);
    });
    await test('Admin darf Prozentsatz pro Rechnung ändern', async () => {
      const r = await admin.req('POST', '/api/calculate', { items: partIds(['Turbo']), applyDiscount: true, discountPercent: 25 });
      assert.strictEqual(r.json.discountPercent, 25);
      assert.strictEqual(r.json.totalCents, priceOf('Turbo') * 0.75);
      assert.strictEqual((await admin.req('POST', '/api/calculate', { items: partIds(['Turbo']), applyDiscount: true, discountPercent: 150 })).status, 400);
    });
    await test('Stufen sind exklusiv (nur eine Motorstufe)', async () => {
      const r = await staff.req('POST', '/api/calculate', { items: partIds(['Motorstufe 1', 'Motorstufe 2']) });
      assert.strictEqual(r.status, 400);
    });
    await test('Manipulierte Eingaben werden abgelehnt', async () => {
      for (const items of ['abc', [-1], [0], [99999], [1.5], ['1; DROP TABLE parts'], Array(400).fill(1)]) {
        const r = await staff.req('POST', '/api/calculate', { items });
        assert.strictEqual(r.status, 400, JSON.stringify(items).slice(0, 40));
      }
      const r = await staff.req('POST', '/api/calculate', { items: [1], price: 1, totalCents: 1 });
      assert.notStrictEqual(r.json.totalCents, 1);
    });
    await test('CSRF: Anfragen ohne X-Requested-With / fremde Origin werden abgelehnt', async () => {
      const bad = await fetch(BASE + '/api/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: staff.cookie }, body: '{"items":[]}' });
      assert.strictEqual(bad.status, 403);
      const cross = await staff.req('POST', '/api/calculate', { items: [] }, { Origin: 'https://evil.example' });
      assert.strictEqual(cross.status, 403);
    });
    await test('Rechnung erstellen: Antwort ohne Einzelpreise, Admin sieht sie intern', async () => {
      const r = await staff2.req('POST', '/api/invoices', { items: partIds(['Motorstufe 4', 'Sportlenkrad']), applyDiscount: true, customer: 'Max Muster', plate: 'B-XY 123' });
      assert.strictEqual(r.status, 200, r.text);
      assert.ok(/^R-\d{4}-00001$/.test(r.json.invoice.number));
      assert.ok(!/priceCents|"price"/.test(r.text));
      const list = (await admin.req('GET', '/api/admin/invoices')).json.invoices;
      assert.strictEqual(list.length, 1);
      const detail = (await admin.req('GET', `/api/admin/invoices/${list[0].id}`)).json.invoice;
      assert.ok(detail.items.every((i) => typeof i.priceCents === 'number'));
    });

    await test('Admin: Teil anlegen/ändern, Preis wirkt sofort in der Berechnung, Löschen', async () => {
      const cat = adminOverview.categories.find((c) => c.name === 'Extras').id;
      const c = await admin.req('POST', '/api/admin/parts', { categoryId: cat, name: 'Testteil', description: 'x', price: 1234.5, active: true, sortOrder: 1 });
      assert.strictEqual(c.status, 200, c.text);
      let calc = await staff.req('POST', '/api/calculate', { items: [c.json.id] });
      assert.strictEqual(calc.json.totalCents, 123450);
      const u = await admin.req('PUT', `/api/admin/parts/${c.json.id}`, { categoryId: cat, name: 'Testteil', description: 'x', price: 2000, active: true, sortOrder: 1 });
      assert.strictEqual(u.status, 200);
      calc = await staff.req('POST', '/api/calculate', { items: [c.json.id] });
      assert.strictEqual(calc.json.totalCents, 200000);
      await admin.req('PUT', `/api/admin/parts/${c.json.id}`, { categoryId: cat, name: 'Testteil', description: 'x', price: 2000, active: false, sortOrder: 1 });
      assert.strictEqual((await staff.req('POST', '/api/calculate', { items: [c.json.id] })).status, 400);
      assert.strictEqual((await admin.req('DELETE', `/api/admin/parts/${c.json.id}`)).status, 200);
    });
    await test('Bild-Upload: nur echte Bilder; Pfade werden validiert', async () => {
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
      const ok = await admin.req('POST', '/api/admin/upload', png, { 'Content-Type': 'image/png' });
      assert.strictEqual(ok.status, 200, ok.text);
      const img = await anon.req('GET', ok.json.path);
      assert.strictEqual(img.status, 200);
      const fake = await admin.req('POST', '/api/admin/upload', Buffer.from('<svg onload=alert(1)>'), { 'Content-Type': 'image/png' });
      assert.strictEqual(fake.status, 400);
      const svg = await admin.req('POST', '/api/admin/upload', Buffer.from('<svg/>'), { 'Content-Type': 'image/svg+xml' });
      assert.strictEqual(svg.status, 415);
      const cat = adminOverview.categories[0].id;
      const bad = await admin.req('POST', '/api/admin/parts', { categoryId: cat, name: 'x', price: 1, image: 'javascript:alert(1)' });
      assert.strictEqual(bad.status, 400);
      const trav = await anon.req('GET', '/uploads/../../etc/passwd');
      assert.strictEqual(trav.status, 404);
      const trav2 = await anon.req('GET', '/..%2f..%2fserver.js');
      assert.strictEqual(trav2.status, 404);
    });
    await test('Rabatt aus-/einschalten und Prozent ändern wirkt auf Mitarbeiter', async () => {
      let r = await admin.req('PUT', '/api/admin/settings', { companyName: 'Test Garage', currency: '$', discountEnabled: false, discountPercent: 15 });
      assert.strictEqual(r.status, 200, r.text);
      assert.strictEqual((await staff2.req('GET', '/api/catalog')).json.discount.available, false);
      r = await staff2.req('POST', '/api/calculate', { items: partIds(['Turbo']), applyDiscount: true });
      assert.strictEqual(r.json.discountCents, 0);
      await admin.req('PUT', '/api/admin/settings', { companyName: 'Test Garage', currency: '$', discountEnabled: true, discountPercent: 15 });
      r = await staff2.req('POST', '/api/calculate', { items: partIds(['Turbo']), applyDiscount: true });
      assert.strictEqual(r.json.discountPercent, 15);
      adminOverview = (await admin.req('GET', '/api/admin/overview')).json;
      await admin.req('PUT', '/api/admin/users/' + adminOverview.users.find((u) => u.username === 'lisa').id, { canDiscount: false });
      r = await staff2.req('POST', '/api/calculate', { items: partIds(['Turbo']), applyDiscount: true });
      assert.strictEqual(r.json.discountCents, 0, 'Rabatt-Recht entziehen muss sofort wirken');
    });
    await test('Benutzerverwaltung: Selbstschutz und Sperren beenden Sessions', async () => {
      const me = adminOverview.users.find((u) => u.username === 'admin');
      assert.strictEqual((await admin.req('PUT', `/api/admin/users/${me.id}`, { role: 'employee' })).status, 400);
      assert.strictEqual((await admin.req('DELETE', `/api/admin/users/${me.id}`)).status, 400);
      const max = adminOverview.users.find((u) => u.username === 'max');
      assert.strictEqual((await admin.req('PUT', `/api/admin/users/${max.id}`, { active: false })).status, 200);
      assert.strictEqual((await staff.req('GET', '/api/catalog')).status, 401);
      assert.strictEqual((await new Client().login('max', 'MaxNeuesPasswort1')).status, 401);
    });
    await test('Brute-Force-Schutz sperrt nach mehreren Fehlversuchen (429)', async () => {
      const c = new Client();
      let last;
      for (let i = 0; i < 8; i++) last = await c.login('lisa', 'falsch' + i);
      assert.strictEqual(last.status, 429);
      assert.strictEqual((await c.login('lisa', 'LisaNeuesPasswort2')).status, 429);
    });
    await test('Logout beendet die Session', async () => {
      const c = new Client();
      await c.login('admin', ADMIN_PW);
      assert.strictEqual((await c.req('GET', '/api/admin/overview')).status, 200);
      const old = c.cookie;
      await c.req('POST', '/api/logout', {});
      const again = new Client();
      again.cookie = old;
      assert.strictEqual((await again.req('GET', '/api/admin/overview')).status, 401);
    });
    await test('Sicherheits-Header gesetzt', async () => {
      const r = await anon.req('GET', '/');
      assert.ok(r.headers.get('content-security-policy').includes("script-src 'self'"));
      assert.strictEqual(r.headers.get('x-content-type-options'), 'nosniff');
      assert.strictEqual(r.headers.get('x-frame-options'), 'DENY');
    });
  } finally {
    server.kill('SIGTERM');
    console.log('\n' + results.join('\n'));
    console.log(`\n${passed}/${results.length} Tests bestanden`);
    if (process.exitCode) console.log('\n--- Serverlog ---\n' + log);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})();
