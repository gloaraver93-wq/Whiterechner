'use strict';
/**
 * Notfall-Werkzeug: setzt das Passwort eines Benutzers (oder legt einen Admin an), falls niemand mehr Zugang hat.
 * Aufruf:  node scripts/reset-admin.js <benutzername> <neues-passwort>
 * Auf Render: im "Shell"-Tab des Dienstes ausführen.
 */
const path = require('path');
const config = require('../src/config');
const { openDb } = require('../src/db');
const { hashPassword } = require('../src/security');

(async () => {
  const [username, password] = process.argv.slice(2);
  if (!username || !password || password.length < 8) {
    console.error('Aufruf: node scripts/reset-admin.js <benutzername> <passwort mit mind. 8 Zeichen>');
    process.exit(1);
  }
  const db = openDb(path.join(config.dataDir, 'tuning.db'));
  const hash = await hashPassword(password);
  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (user) {
    db.prepare("UPDATE users SET password_hash = ?, role = 'admin', active = 1, must_change = 1 WHERE id = ?").run(hash, user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    console.log(`Passwort von "${username}" zurückgesetzt (Administrator, Passwortwechsel beim nächsten Login).`);
  } else {
    db.prepare("INSERT INTO users(username, password_hash, role, can_discount, must_change) VALUES (?, ?, 'admin', 1, 1)").run(username, hash);
    console.log(`Administrator "${username}" angelegt.`);
  }
  db.close();
})();
