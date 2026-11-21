/* Tuningrechner – Adminbereich. Wird vom Server nur an angemeldete Administratoren ausgeliefert;
   jede Aktion wird zusätzlich serverseitig per Rollenprüfung abgesichert. */
(function () {
  'use strict';
  const { h, icon, api, money, percent, fmtDate, toast, modal, confirmDialog } = window.TC;
  const root = document.getElementById('app');

  const TABS = [
    ['parts', 'Teile & Preise'],
    ['categories', 'Kategorien'],
    ['discount', 'Rabatt & Einstellungen'],
    ['users', 'Benutzer'],
    ['invoices', 'Rechnungen'],
  ];

  const S = { me: null, data: null, tab: 'parts', filterCat: '', search: '', invoices: null };

  async function init() {
    try {
      const me = await api('GET', '/api/me', undefined, { noRedirect: true });
      if (!me.user || me.user.role !== 'admin') return void (location.href = '/');
      S.me = me.user;
      await reload();
      render();
    } catch (e) {
      root.replaceChildren(h('div', { class: 'boot' }, h('p', null, e.message), h('a', { class: 'btn primary', href: '/' }, 'Zurück')));
    }
  }

  async function reload() {
    S.data = await api('GET', '/api/admin/overview');
    document.title = `${S.data.settings.companyName} · Administration`;
  }

  async function refresh() {
    await reload();
    render();
  }

  /* ---------- Hilfen ---------- */
  const cur = () => S.data.settings.currency;
  const catById = (id) => S.data.categories.find((c) => c.id === id);
  function catLabel(id) {
    const c = catById(id);
    if (!c) return '–';
    const p = c.parentId ? catById(c.parentId) : null;
    return p ? `${p.name} › ${c.name}` : c.name;
  }
  function catOptions() {
    const out = [];
    for (const top of S.data.categories.filter((c) => !c.parentId)) {
      out.push({ id: top.id, label: top.name });
      for (const ch of S.data.categories.filter((c) => c.parentId === top.id)) out.push({ id: ch.id, label: `${top.name} › ${ch.name}` });
    }
    return out;
  }
  async function run(action, okMsg) {
    try {
      await action();
      if (okMsg) toast(okMsg, 'ok');
      await refresh();
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    }
  }
  const field = (label, control, hint) => h('label', { class: 'field' }, h('span', null, label), control, hint ? h('small', { class: 'muted' }, hint) : null);
  const check = (label, input, hint) => h('label', { class: 'check-row' }, input, h('span', null, label, hint ? h('small', null, hint) : null));
  const thumb = (src) => h('img', { class: 'thumb', src: src || '/img/placeholder.svg', alt: '', loading: 'lazy' });

  /* ---------- Rahmen ---------- */
  function render() {
    const content = h('div', { class: 'admin-content' });
    root.replaceChildren(
      h('header', { class: 'topbar' },
        h('div', { class: 'topbar-inner' },
          h('div', { class: 'brand' }, h('div', { class: 'brand-mark' }, icon('shield')), h('div', null, h('strong', null, S.data.settings.companyName), h('small', null, 'Administration'))),
          h('div', { class: 'topbar-actions' },
            h('span', { class: 'chip chip-admin' }, S.me.username, h('em', null, 'Admin')),
            h('a', { class: 'btn ghost small', href: '/' }, icon('back'), h('span', null, 'Zum Rechner')),
            h('button', { class: 'btn ghost small', type: 'button', onclick: async () => { try { await api('POST', '/api/logout', {}, { noRedirect: true }); } finally { location.href = '/'; } } }, icon('logout'), h('span', null, 'Abmelden'))
          )
        ),
        h('div', { class: 'hazard', 'aria-hidden': 'true' })
      ),
      h('main', { class: 'admin-main' },
        h('nav', { class: 'tabs' }, ...TABS.map(([id, name]) => h('button', { type: 'button', class: `tab ${S.tab === id ? 'active' : ''}`, onclick: () => { S.tab = id; render(); } }, name))),
        content
      )
    );
    ({ parts: renderParts, categories: renderCategories, discount: renderDiscount, users: renderUsers, invoices: renderInvoices })[S.tab](content);
  }

  /* ====================== Teile ====================== */
  function renderParts(el) {
    const st = S.data.stats;
    const q = S.search.toLowerCase();
    const parts = S.data.parts.filter((p) => {
      if (S.filterCat) {
        const c = catById(p.categoryId);
        if (String(p.categoryId) !== S.filterCat && String(c && c.parentId) !== S.filterCat) return false;
      }
      return !q || `${p.name} ${p.description} ${catLabel(p.categoryId)}`.toLowerCase().includes(q);
    });
    const rows = parts.map((p) =>
      h('tr', { class: p.active ? '' : 'inactive' },
        h('td', null, thumb(p.image)),
        h('td', null, h('strong', null, p.name), h('div', { class: 'muted small-text' }, p.description)),
        h('td', null, catLabel(p.categoryId)),
        h('td', { class: 'num' }, h('strong', null, money(p.priceCents, cur()))),
        h('td', null, h('label', { class: 'switch compact', title: p.active ? 'Sichtbar im Rechner' : 'Ausgeblendet' },
          h('input', { type: 'checkbox', role: 'switch', checked: p.active, onchange: (e) => run(() => api('PUT', `/api/admin/parts/${p.id}`, partBody({ ...p, active: e.target.checked }))) }),
          h('span', { class: 'slider' }))),
        h('td', { class: 'actions' },
          h('button', { class: 'icon-btn', type: 'button', title: 'Bearbeiten', onclick: () => partDialog(p) }, icon('edit')),
          h('button', { class: 'icon-btn danger', type: 'button', title: 'Löschen', onclick: async () => {
            if (await confirmDialog(`„${p.name}“ endgültig löschen?`, { okText: 'Löschen', danger: true })) run(() => api('DELETE', `/api/admin/parts/${p.id}`), 'Teil gelöscht');
          } }, icon('trash'))
        )
      )
    );
    el.replaceChildren(
      h('div', { class: 'stats' },
        stat('Teile', S.data.parts.length),
        stat('Davon aktiv', S.data.parts.filter((p) => p.active).length),
        stat('Rechnungen', st.invoices),
        stat('Umsatz gesamt', money(st.revenueCents, cur()))
      ),
      h('div', { class: 'toolbar' },
        h('label', { class: 'search' }, icon('search'), h('input', { type: 'search', placeholder: 'Teile durchsuchen …', value: S.search, oninput: (e) => { S.search = e.target.value; renderParts(el); const i = el.querySelector('.search input'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } })),
        h('select', { 'aria-label': 'Kategorie filtern', onchange: (e) => { S.filterCat = e.target.value; renderParts(el); } },
          h('option', { value: '' }, 'Alle Kategorien'),
          ...catOptions().map((o) => h('option', { value: o.id, selected: String(o.id) === S.filterCat }, o.label))),
        h('button', { class: 'btn primary', type: 'button', onclick: () => partDialog(null) }, icon('plus'), 'Neues Teil')
      ),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'data' },
          h('thead', null, h('tr', null, ...['Bild', 'Teil', 'Kategorie', 'Einzelpreis', 'Aktiv', ''].map((t) => h('th', null, t)))),
          h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: '6', class: 'empty-cell' }, 'Keine Teile gefunden.')))
        )
      )
    );
  }

  function stat(label, value) {
    return h('div', { class: 'stat' }, h('span', null, label), h('strong', null, value));
  }

  function partBody(p) {
    return { categoryId: p.categoryId, name: p.name, description: p.description, image: p.image || '', price: p.priceCents / 100, active: p.active, sortOrder: p.sortOrder };
  }

  function partDialog(part) {
    const isNew = !part;
    const state = { image: part ? part.image || '' : '' };
    const cats = catOptions();
    const name = h('input', { type: 'text', required: true, maxlength: '80', value: part ? part.name : '' });
    const category = h('select', { required: true }, ...cats.map((o) => h('option', { value: o.id, selected: part ? o.id === part.categoryId : o.id === (Number(S.filterCat) || cats[0]?.id) }, o.label)));
    const desc = h('textarea', { rows: '3', maxlength: '300' }, part ? part.description : '');
    desc.value = part ? part.description : '';
    const price = h('input', { type: 'number', min: '0', step: '0.01', inputmode: 'decimal', required: true, value: part ? String(part.priceCents / 100) : '' });
    const sort = h('input', { type: 'number', step: '1', value: String(part ? part.sortOrder : 99) });
    const active = h('input', { type: 'checkbox', checked: part ? part.active : true });
    const preview = h('img', { class: 'preview', alt: 'Vorschau', src: state.image || '/img/placeholder.svg' });
    const status = h('div', { class: 'muted small-text' }, state.image ? 'Aktuelles Bild' : 'Standard-Platzhalter wird verwendet');
    const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', hidden: true, onchange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 4 * 1024 * 1024) return toast('Das Bild darf höchstens 4 MB groß sein', 'error');
      status.textContent = 'Wird hochgeladen …';
      try {
        const res = await api('POST', '/api/admin/upload', f, { raw: true, contentType: f.type });
        state.image = res.path;
        preview.src = res.path;
        status.textContent = 'Neues Bild hochgeladen (wird mit „Speichern“ übernommen)';
      } catch (ex) {
        status.textContent = ex.message;
        toast(ex.message, 'error');
      }
      file.value = '';
    } });
    const err = h('div', { class: 'form-error', role: 'alert', hidden: true });

    const form = h('form', { class: 'form', onsubmit: async (e) => {
      e.preventDefault();
      err.hidden = true;
      const body = { categoryId: Number(category.value), name: name.value, description: desc.value, image: state.image, price: price.value, active: active.checked, sortOrder: Number(sort.value) || 0 };
      try {
        await api(isNew ? 'POST' : 'PUT', isNew ? '/api/admin/parts' : `/api/admin/parts/${part.id}`, body);
        m.close();
        toast(isNew ? 'Teil angelegt' : 'Änderungen gespeichert', 'ok');
        await refresh();
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      }
    } },
      h('div', { class: 'image-edit' }, preview,
        h('div', null,
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn ghost small', type: 'button', onclick: () => file.click() }, icon('upload'), 'Bild hochladen'),
            h('button', { class: 'btn ghost small', type: 'button', onclick: () => { state.image = ''; preview.src = '/img/placeholder.svg'; status.textContent = 'Platzhalter wird verwendet'; } }, 'Entfernen')),
          status, file)),
      field('Bezeichnung', name),
      field('Kategorie', category),
      field('Beschreibung', desc),
      h('div', { class: 'two-col' }, field(`Einzelpreis (${cur()})`, price, 'Nur für Administratoren sichtbar'), field('Sortierung', sort, 'Kleinere Zahl = weiter vorne')),
      check('Im Rechner sichtbar', active),
      err,
      h('div', { class: 'form-actions' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, 'Abbrechen'), h('button', { class: 'btn primary', type: 'submit' }, 'Speichern'))
    );
    const m = modal({ title: isNew ? 'Neues Teil' : 'Teil bearbeiten', content: form, wide: true });
  }

  /* ====================== Kategorien ====================== */
  function renderCategories(el) {
    const tops = S.data.categories.filter((c) => !c.parentId);
    const countParts = (id) => S.data.parts.filter((p) => p.categoryId === id).length;
    const row = (c, isChild) =>
      h('div', { class: `cat-row ${isChild ? 'child' : ''}` },
        h('div', { class: 'cat-info' },
          h('strong', null, c.name),
          c.exclusive ? h('span', { class: 'pill' }, 'Eine Stufe wählbar') : null,
          h('span', { class: 'muted small-text' }, `${countParts(c.id)} Teile · Sortierung ${c.sortOrder}`)),
        h('div', { class: 'actions' },
          !isChild ? h('button', { class: 'btn ghost small', type: 'button', onclick: () => categoryDialog(null, c.id) }, icon('plus'), 'Unterkategorie') : null,
          h('button', { class: 'icon-btn', type: 'button', title: 'Bearbeiten', onclick: () => categoryDialog(c) }, icon('edit')),
          h('button', { class: 'icon-btn danger', type: 'button', title: 'Löschen', onclick: async () => {
            const n = S.data.parts.filter((p) => p.categoryId === c.id || (catById(p.categoryId) || {}).parentId === c.id).length;
            const msg = `Kategorie „${c.name}“ löschen?` + (n ? ` Dabei werden auch ${n} zugehörige Teile (und Unterkategorien) gelöscht.` : '');
            if (await confirmDialog(msg, { okText: 'Löschen', danger: true })) run(() => api('DELETE', `/api/admin/categories/${c.id}`), 'Kategorie gelöscht');
          } }, icon('trash')))
      );
    el.replaceChildren(
      h('div', { class: 'toolbar' }, h('p', { class: 'muted' }, 'Hauptkategorien erscheinen als Reiter im Rechner, Unterkategorien (z. B. Motorstufen unter „Leistungsteile“) als Abschnitte.'), h('button', { class: 'btn primary', type: 'button', onclick: () => categoryDialog(null, null) }, icon('plus'), 'Neue Kategorie')),
      ...tops.map((t) => h('div', { class: 'panel' }, row(t, false), ...S.data.categories.filter((c) => c.parentId === t.id).map((c) => row(c, true))))
    );
  }

  function categoryDialog(cat, presetParent) {
    const isNew = !cat;
    const hasChildren = cat && S.data.categories.some((c) => c.parentId === cat.id);
    const name = h('input', { type: 'text', required: true, maxlength: '60', value: cat ? cat.name : '' });
    const parent = h('select', { disabled: hasChildren },
      h('option', { value: '' }, '– Hauptkategorie –'),
      ...S.data.categories.filter((c) => !c.parentId && (!cat || c.id !== cat.id)).map((c) => h('option', { value: c.id, selected: cat ? cat.parentId === c.id : presetParent === c.id }, c.name)));
    const exclusive = h('input', { type: 'checkbox', checked: cat ? cat.exclusive : false });
    const sort = h('input', { type: 'number', step: '1', value: String(cat ? cat.sortOrder : 99) });
    const err = h('div', { class: 'form-error', role: 'alert', hidden: true });
    const form = h('form', { class: 'form', onsubmit: async (e) => {
      e.preventDefault();
      err.hidden = true;
      const body = { name: name.value, parentId: parent.value || null, exclusive: exclusive.checked, sortOrder: Number(sort.value) || 0 };
      try {
        await api(isNew ? 'POST' : 'PUT', isNew ? '/api/admin/categories' : `/api/admin/categories/${cat.id}`, body);
        m.close();
        toast('Gespeichert', 'ok');
        await refresh();
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      }
    } },
      field('Name', name),
      field('Oberkategorie', parent, hasChildren ? 'Kategorien mit Unterkategorien bleiben Hauptkategorien.' : null),
      check('Nur ein Teil pro Rechnung wählbar', exclusive, 'Für Stufen (z. B. Motorstufe 1–4): eine höhere Stufe ersetzt die niedrigere.'),
      field('Sortierung', sort, 'Kleinere Zahl = weiter vorne'),
      err,
      h('div', { class: 'form-actions' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, 'Abbrechen'), h('button', { class: 'btn primary', type: 'submit' }, 'Speichern'))
    );
    const m = modal({ title: isNew ? 'Neue Kategorie' : 'Kategorie bearbeiten', content: form });
  }

  /* ====================== Rabatt & Einstellungen ====================== */
  function renderDiscount(el) {
    const s = S.data.settings;
    const enabled = h('input', { type: 'checkbox', role: 'switch', checked: s.discountEnabled });
    const pct = h('input', { type: 'number', min: '0', max: '100', step: '0.5', required: true, value: String(s.discountPercent) });
    const company = h('input', { type: 'text', maxlength: '60', required: true, value: s.companyName });
    const currency = h('input', { type: 'text', maxlength: '5', required: true, value: s.currency });
    const allowed = S.data.users.filter((u) => u.active && (u.role === 'admin' || u.canDiscount));
    el.replaceChildren(
      h('div', { class: 'panel narrow' },
        h('h2', null, 'Rabatt'),
        h('p', { class: 'muted' }, 'Der Rabatt wird auf die Gesamtsumme angewendet. Mitarbeiter können ihn nur ein- oder ausschalten, aber nicht verändern – und nur, wenn sie hier berechtigt sind (Reiter „Benutzer“).'),
        h('form', { class: 'form', onsubmit: (e) => {
          e.preventDefault();
          run(() => api('PUT', '/api/admin/settings', { companyName: company.value, currency: currency.value, discountEnabled: enabled.checked, discountPercent: pct.value }), 'Einstellungen gespeichert');
        } },
          h('label', { class: 'switch' }, enabled, h('span', { class: 'slider' }), h('span', { class: 'switch-label' }, 'Rabattfunktion aktiv', h('small', null, 'Ausgeschaltet kann niemand einen Rabatt gewähren.'))),
          field('Rabatt in Prozent', pct, 'Gilt für berechtigte Mitarbeiter. Administratoren können pro Rechnung abweichen.'),
          h('hr'),
          h('h2', null, 'Allgemein'),
          field('Firmenname', company, 'Erscheint in der Kopfzeile und auf der Rechnung'),
          field('Währungssymbol', currency),
          h('div', { class: 'form-actions' }, h('button', { class: 'btn primary', type: 'submit' }, 'Speichern'))
        ),
        h('hr'),
        h('p', { class: 'muted small-text' }, `Aktuell berechtigt (${allowed.length}): `, allowed.map((u) => u.username).join(', ') || '–')
      )
    );
  }

  /* ====================== Benutzer ====================== */
  function renderUsers(el) {
    const rows = S.data.users.map((u) => {
      const self = u.id === S.me.id;
      return h('tr', { class: u.active ? '' : 'inactive' },
        h('td', null, h('strong', null, u.username), self ? h('span', { class: 'pill' }, 'Du') : null, u.mustChange ? h('span', { class: 'pill warn' }, 'Passwortwechsel offen') : null),
        h('td', null, h('span', { class: `chip ${u.role === 'admin' ? 'chip-admin' : ''}` }, u.role === 'admin' ? 'Administrator' : 'Mitarbeiter')),
        h('td', null, u.role === 'admin' ? h('span', { class: 'muted' }, 'immer') : h('label', { class: 'switch compact', title: 'Darf Rabatt gewähren' },
          h('input', { type: 'checkbox', role: 'switch', checked: u.canDiscount, onchange: (e) => run(() => api('PUT', `/api/admin/users/${u.id}`, { canDiscount: e.target.checked })) }), h('span', { class: 'slider' }))),
        h('td', null, u.active ? 'Aktiv' : 'Gesperrt'),
        h('td', { class: 'actions' },
          h('button', { class: 'icon-btn', type: 'button', title: 'Bearbeiten', onclick: () => userDialog(u) }, icon('edit')),
          h('button', { class: 'icon-btn danger', type: 'button', title: 'Löschen', disabled: self, onclick: async () => {
            if (await confirmDialog(`Benutzer „${u.username}“ löschen?`, { okText: 'Löschen', danger: true })) run(() => api('DELETE', `/api/admin/users/${u.id}`), 'Benutzer gelöscht');
          } }, icon('trash')))
      );
    });
    el.replaceChildren(
      h('div', { class: 'toolbar' }, h('p', { class: 'muted' }, 'Neue Benutzer müssen ihr Startpasswort beim ersten Login ändern.'), h('button', { class: 'btn primary', type: 'button', onclick: () => userDialog(null) }, icon('plus'), 'Neuer Benutzer')),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, ...['Benutzer', 'Rolle', 'Rabatt erlaubt', 'Status', ''].map((t) => h('th', null, t)))),
        h('tbody', null, rows)))
    );
  }

  function userDialog(user) {
    const isNew = !user;
    const self = user && user.id === S.me.id;
    const name = h('input', { type: 'text', required: isNew, disabled: !isNew, maxlength: '32', autocomplete: 'off', value: user ? user.username : '' });
    const pw = h('input', { type: 'password', required: isNew, minlength: '8', autocomplete: 'new-password', placeholder: isNew ? '' : 'Leer lassen = unverändert' });
    const role = h('select', { disabled: self }, h('option', { value: 'employee', selected: !user || user.role === 'employee' }, 'Mitarbeiter'), h('option', { value: 'admin', selected: user && user.role === 'admin' }, 'Administrator'));
    const discount = h('input', { type: 'checkbox', checked: user ? user.canDiscount : false });
    const active = h('input', { type: 'checkbox', checked: user ? user.active : true, disabled: self });
    const err = h('div', { class: 'form-error', role: 'alert', hidden: true });
    const form = h('form', { class: 'form', onsubmit: async (e) => {
      e.preventDefault();
      err.hidden = true;
      try {
        if (isNew) await api('POST', '/api/admin/users', { username: name.value, password: pw.value, role: role.value, canDiscount: discount.checked });
        else await api('PUT', `/api/admin/users/${user.id}`, { role: role.value, canDiscount: discount.checked, active: active.checked, password: pw.value });
        m.close();
        toast('Gespeichert', 'ok');
        await refresh();
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      }
    } },
      field('Benutzername', name),
      field(isNew ? 'Startpasswort (mind. 8 Zeichen)' : 'Neues Passwort setzen', pw, isNew ? null : 'Der Benutzer muss es beim nächsten Login ändern und wird überall abgemeldet.'),
      field('Rolle', role),
      check('Darf Rabatt gewähren', discount, 'Gilt für Mitarbeiter; Administratoren dürfen immer.'),
      check('Konto aktiv', active),
      err,
      h('div', { class: 'form-actions' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, 'Abbrechen'), h('button', { class: 'btn primary', type: 'submit' }, 'Speichern'))
    );
    const m = modal({ title: isNew ? 'Neuer Benutzer' : `Benutzer ${user.username}`, content: form });
  }

  /* ====================== Rechnungen ====================== */
  async function renderInvoices(el) {
    el.replaceChildren(h('div', { class: 'boot small' }, h('span', { class: 'spinner' })));
    try {
      const { invoices } = await api('GET', '/api/admin/invoices');
      if (S.tab !== 'invoices') return;
      el.replaceChildren(
        h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
          h('thead', null, h('tr', null, ...['Nr.', 'Datum', 'Bearbeiter', 'Kunde', 'Zwischensumme', 'Rabatt', 'Gesamt', ''].map((t) => h('th', null, t)))),
          h('tbody', null, invoices.length ? invoices.map((i) =>
            h('tr', { class: 'clickable', onclick: () => invoiceDialog(i.id) },
              h('td', null, h('strong', null, i.number)), h('td', null, fmtDate(i.createdAt)), h('td', null, i.username), h('td', null, [i.customer, i.plate].filter(Boolean).join(' · ') || '–'),
              h('td', { class: 'num' }, money(i.subtotalCents, cur())), h('td', { class: 'num' }, i.discountPercent ? `${percent(i.discountPercent)} (− ${money(i.discountCents, cur())})` : '–'),
              h('td', { class: 'num' }, h('strong', null, money(i.totalCents, cur()))), h('td', null, h('span', { class: 'muted' }, 'Details'))))
            : h('tr', null, h('td', { colspan: '8', class: 'empty-cell' }, 'Noch keine Rechnungen erstellt.')))))
      );
    } catch (e) {
      el.replaceChildren(h('div', { class: 'form-error' }, e.message));
    }
  }

  async function invoiceDialog(id) {
    try {
      const { invoice: i } = await api('GET', `/api/admin/invoices/${id}`);
      modal({
        title: `Rechnung ${i.number}`,
        wide: true,
        content: h('div', null,
          h('p', { class: 'muted' }, `${fmtDate(i.createdAt)} · Bearbeiter: ${i.username}`, i.customer ? ` · Kunde: ${i.customer}` : '', i.plate ? ` · ${i.plate}` : ''),
          h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
            h('thead', null, h('tr', null, h('th', null, 'Teil'), h('th', null, 'Kategorie'), h('th', null, 'Einzelpreis (intern)'))),
            h('tbody', null, ...i.items.map((it) => h('tr', null, h('td', null, it.name), h('td', null, it.category), h('td', { class: 'num' }, money(it.priceCents, cur()))))))),
          h('div', { class: 'inv-totals admin' },
            h('div', null, h('span', null, 'Zwischensumme'), h('span', null, money(i.subtotalCents, cur()))),
            i.discountPercent ? h('div', null, h('span', null, `Rabatt ${percent(i.discountPercent)}`), h('span', null, `− ${money(i.discountCents, cur())}`)) : null,
            h('div', { class: 'grand' }, h('span', null, 'Gesamt'), h('span', null, money(i.totalCents, cur())))))
      });
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  init();
})();
