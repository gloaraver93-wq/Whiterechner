'use strict';
const { HttpError } = require('./errors');

/** Darf dieser Benutzer aktuell einen Rabatt gewähren? */
function discountAllowed(user, settings) {
  return Boolean(settings.discountEnabled && settings.discountPercent > 0 && (user.role === 'admin' || user.canDiscount));
}

/**
 * Serverseitige Preisberechnung. Der Client schickt ausschließlich Teile-IDs;
 * alle Preise stammen aus der Datenbank. Rückgabe enthält interne Einzelpreise
 * (priceCents) und darf nur über publicView() an Nicht-Admins gelangen.
 */
function calculate(db, user, rawItems, opts, settings) {
  if (!Array.isArray(rawItems) || rawItems.length > 300) throw new HttpError(400, 'Ungültige Auswahl');
  const ids = [...new Set(rawItems.map(Number))];
  if (ids.some((n) => !Number.isInteger(n) || n <= 0)) {
    throw new HttpError(400, 'Ungültige Auswahl');
  }

  let rows = [];
  if (ids.length) {
    rows = db
      .prepare(
        `SELECT p.id, p.name, p.image, p.price_cents, p.sort_order AS psort,
                c.id AS cat_id, c.name AS cat_name, c.exclusive, c.sort_order AS csort,
                pc.name AS parent_name, pc.sort_order AS parent_sort
           FROM parts p
           JOIN categories c ON c.id = p.category_id
           LEFT JOIN categories pc ON pc.id = c.parent_id
          WHERE p.active = 1 AND p.id IN (${ids.map(() => '?').join(',')})`
      )
      .all(...ids);
  }
  if (rows.length !== ids.length) {
    throw new HttpError(400, 'Mindestens ein Teil ist nicht (mehr) verfügbar. Bitte die Seite neu laden.');
  }

  // Stufen-Kategorien erlauben nur eine Auswahl
  const perCat = new Map();
  for (const r of rows) {
    if (!r.exclusive) continue;
    if (perCat.has(r.cat_id)) {
      throw new HttpError(400, `In „${r.cat_name}“ kann nur eine Stufe gewählt werden.`);
    }
    perCat.set(r.cat_id, true);
  }

  rows.sort(
    (a, b) =>
      (a.parent_name ? a.parent_sort : a.csort) - (b.parent_name ? b.parent_sort : b.csort) ||
      a.csort - b.csort ||
      a.psort - b.psort ||
      a.id - b.id
  );

  const lines = rows.map((r) => ({
    id: r.id,
    name: r.name,
    image: r.image,
    category: r.parent_name ? `${r.parent_name} › ${r.cat_name}` : r.cat_name,
    priceCents: r.price_cents,
  }));

  const subtotalCents = lines.reduce((sum, l) => sum + l.priceCents, 0);

  let percent = 0;
  if (opts && opts.applyDiscount === true && discountAllowed(user, settings)) {
    percent = settings.discountPercent;
    // Nur Administratoren dürfen den Prozentsatz für eine einzelne Rechnung abweichend festlegen
    if (user.role === 'admin' && opts.discountPercent != null && opts.discountPercent !== '') {
      const custom = Number(opts.discountPercent);
      if (!Number.isFinite(custom) || custom < 0 || custom > 100) throw new HttpError(400, 'Rabatt muss zwischen 0 und 100 % liegen');
      percent = Math.round(custom * 100) / 100;
    }
  }
  const discountCents = Math.round((subtotalCents * percent) / 100);
  return {
    lines,
    count: lines.length,
    subtotalCents,
    discountPercent: percent,
    discountCents,
    totalCents: subtotalCents - discountCents,
  };
}

/** Variante ohne Einzelpreise – für Mitarbeiter und Kunden. */
function publicView(r) {
  return {
    items: r.lines.map(({ id, name, image, category }) => ({ id, name, image, category })),
    count: r.count,
    subtotalCents: r.subtotalCents,
    discountPercent: r.discountPercent,
    discountCents: r.discountCents,
    totalCents: r.totalCents,
  };
}

module.exports = { calculate, publicView, discountAllowed };
