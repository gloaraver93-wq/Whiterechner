/* Tuningrechner – Mitarbeiteransicht. Es werden nie Einzelpreise geladen; alle Summen kommen vom Server. */
(function () {
  'use strict';
  const { h, icon, api, money, percent, fmtDate, toast, modal, passwordForm } = window.TC;
  const root = document.getElementById('app');

  const S = {
    user: null,
    brand: '',
    currency: '$',
    tree: [],
    parts: new Map(), // id -> { part, cat, label }
    selected: new Set(),
    active: 'all',
    search: '',
    calc: null,
    seq: 0,
    timer: null,
    discount: { available: false, percent: 0, canEditPercent: false },
    applyDiscount: false,
    customPercent: '',
    customer: '',
    plate: '',
    ui: {},
    cards: new Map(),
  };

  /* ====================== Start ====================== */
  async function init() {
    try {
      const me = await api('GET', '/api/me', undefined, { noRedirect: true });
      S.brand = me.brand.companyName;
      document.title = `${S.brand} · Tuningrechner`;
      if (!me.user) return renderLogin();
      S.user = me.user;
      if (me.user.mustChange) return renderForcedPassword();
      await loadCatalog();
      renderApp();
    } catch (e) {
      root.replaceChildren(h('div', { class: 'boot' }, h('p', null, e.message), h('button', { class: 'btn primary', onclick: () => location.reload() }, 'Erneut versuchen')));
    }
  }

  /* ====================== Login ====================== */
  function brandMark() {
    return h('div', { class: 'brand-mark' }, icon('bolt'));
  }

  function renderLogin() {
    const user = h('input', { type: 'text', name: 'username', autocomplete: 'username', required: true, autocapitalize: 'none', spellcheck: 'false' });
    const pass = h('input', { type: 'password', name: 'password', autocomplete: 'current-password', required: true });
    const err = h('div', { class: 'form-error', role: 'alert', hidden: true });
    const btn = h('button', { class: 'btn primary block', type: 'submit' }, 'Anmelden');
    const form = h(
      'form',
      {
        class: 'form',
        onsubmit: async (e) => {
          e.preventDefault();
          err.hidden = true;
          btn.disabled = true;
          try {
            await api('POST', '/api/login', { username: user.value, password: pass.value }, { noRedirect: true });
            location.reload();
          } catch (ex) {
            err.textContent = ex.message;
            err.hidden = false;
            btn.disabled = false;
            pass.select();
          }
        },
      },
      h('label', { class: 'field' }, h('span', null, 'Benutzername'), user),
      h('label', { class: 'field' }, h('span', null, 'Passwort'), pass),
      err,
      btn
    );
    root.replaceChildren(
      h(
        'div',
        { class: 'auth-screen' },
        h('div', { class: 'auth-stripes', 'aria-hidden': 'true' }),
        h(
          'div',
          { class: 'auth-card' },
          brandMark(),
          h('h1', null, S.brand || 'Tuningrechner'),
          h('p', { class: 'muted' }, 'Tuningrechner · Bitte anmelden'),
          form
        )
      )
    );
    user.focus();
  }

  function renderForcedPassword() {
    root.replaceChildren(
      h(
        'div',
        { class: 'auth-screen' },
        h('div', { class: 'auth-stripes', 'aria-hidden': 'true' }),
        h(
          'div',
          { class: 'auth-card' },
          brandMark(),
          h('h1', null, 'Neues Passwort festlegen'),
          h('p', { class: 'muted' }, 'Aus Sicherheitsgründen muss das Startpasswort jetzt geändert werden.'),
          passwordForm({ onDone: () => location.reload() }),
          h('button', { class: 'btn ghost block', type: 'button', onclick: logout }, 'Abmelden')
        )
      )
    );
  }

  async function logout() {
    try {
      await api('POST', '/api/logout', {}, { noRedirect: true });
    } finally {
      location.href = '/';
    }
  }

  /* ====================== Katalog ====================== */
  async function loadCatalog() {
    const data = await api('GET', '/api/catalog');
    S.tree = data.categories;
    S.brand = data.brand.companyName;
    S.currency = data.currency;
    S.discount = data.discount;
    S.parts.clear();
    for (const top of S.tree) {
      for (const p of top.parts) S.parts.set(p.id, { part: p, cat: top, label: top.name });
      for (const ch of top.children) for (const p of ch.parts) S.parts.set(p.id, { part: p, cat: ch, label: `${top.name} › ${ch.name}` });
    }
  }

  function sectionsFor(top) {
    const list = [];
    if (top.parts.length) list.push({ cat: top, title: top.name, label: top.name, parts: top.parts, top });
    for (const ch of top.children) list.push({ cat: ch, title: ch.name, label: `${top.name} › ${ch.name}`, parts: ch.parts, top });
    return list;
  }

  function matches(entry, q) {
    if (!q) return true;
    const text = `${entry.part.name} ${entry.part.description} ${entry.label}`.toLowerCase();
    return q
      .toLowerCase()
      .split(/\s+/)
      .every((w) => text.includes(w));
  }

  function selectedInTop(top) {
    let n = 0;
    for (const id of S.selected) {
      const e = S.parts.get(id);
      if (e && (e.cat.id === top.id || top.children.some((c) => c.id === e.cat.id))) n++;
    }
    return n;
  }

  /* ====================== Hauptansicht ====================== */
  function renderApp() {
    S.ui = {};
    const isAdmin = S.user.role === 'admin';

    const search = h('input', {
      type: 'search',
      placeholder: 'Teil suchen …',
      'aria-label': 'Teile suchen',
      oninput: (e) => {
        S.search = e.target.value.trim();
        buildGrid(true);
      },
    });

    S.ui.tabs = h('nav', { class: 'tabs', 'aria-label': 'Kategorien' });
    S.ui.grid = h('div', { class: 'catalog-grid' });
    S.ui.summary = buildSummary();

    const header = h(
      'header',
      { class: 'topbar' },
      h('div', { class: 'topbar-inner' },
        h('div', { class: 'brand' }, brandMark(), h('div', null, h('strong', null, S.brand), h('small', null, 'Tuningrechner'))),
        h('label', { class: 'search' }, icon('search'), search),
        h('div', { class: 'topbar-actions' },
          h('span', { class: `chip ${isAdmin ? 'chip-admin' : ''}`, title: 'Angemeldet als' }, S.user.username, h('em', null, isAdmin ? 'Admin' : 'Mitarbeiter')),
          isAdmin ? h('a', { class: 'btn ghost small', href: '/admin/' }, icon('shield'), h('span', null, 'Administration')) : null,
          h('button', { class: 'btn ghost small', type: 'button', onclick: openPasswordDialog, title: 'Passwort ändern' }, icon('key'), h('span', null, 'Passwort')),
          h('button', { class: 'btn ghost small', type: 'button', onclick: logout, title: 'Abmelden' }, icon('logout'), h('span', null, 'Abmelden'))
        )
      ),
      h('div', { class: 'hazard', 'aria-hidden': 'true' })
    );

    root.replaceChildren(
      header,
      h('main', { class: 'layout' }, h('section', { class: 'catalog' }, S.ui.tabs, S.ui.grid), S.ui.summary)
    );
    buildTabs();
    buildGrid(true);
    renderSelection();
    renderTotals();
  }

  function buildTabs() {
    const tabs = [{ id: 'all', name: 'Alle', top: null }, ...S.tree.map((t) => ({ id: String(t.id), name: t.name, top: t }))];
    S.ui.tabs.replaceChildren(
      ...tabs.map((t) => {
        const n = t.top ? selectedInTop(t.top) : S.selected.size;
        return h(
          'button',
          {
            type: 'button',
            class: `tab ${S.active === t.id ? 'active' : ''}`,
            onclick: () => {
              S.active = t.id;
              buildTabs();
              buildGrid(true);
            },
          },
          t.name,
          n ? h('b', { class: 'tab-count' }, n) : null
        );
      })
    );
  }

  function buildGrid(animate) {
    S.cards.clear();
    const frag = document.createDocumentFragment();
    let index = 0;
    const tops = S.tree.filter((t) => S.active === 'all' || String(t.id) === S.active);
    for (const top of tops) {
      const blocks = sectionsFor(top)
        .map((sec) => ({ ...sec, parts: sec.parts.filter((p) => matches({ part: p, label: sec.label }, S.search)) }))
        .filter((sec) => sec.parts.length);
      if (!blocks.length) continue;
      const group = h('section', { class: 'cat-group' }, h('h2', { class: 'cat-title' }, h('span', null, top.name)));
      for (const sec of blocks) {
        const showSub = sec.cat.id !== top.id;
        const block = h('div', { class: 'section' });
        if (showSub || sec.cat.exclusive) {
          block.append(
            h('h3', { class: 'section-title' }, showSub ? sec.title : '', sec.cat.exclusive ? h('span', { class: 'pill' }, 'Eine Stufe wählbar') : null)
          );
        }
        const grid = h('div', { class: 'cards' });
        for (const p of sec.parts) grid.append(buildCard(p, sec, animate ? index++ : -1));
        block.append(grid);
        group.append(block);
      }
      frag.append(group);
    }
    if (!frag.childNodes.length) {
      frag.append(h('div', { class: 'empty' }, h('strong', null, 'Keine Teile gefunden'), h('p', null, S.search ? 'Bitte einen anderen Suchbegriff versuchen.' : 'In dieser Kategorie sind noch keine Teile hinterlegt.')));
    }
    S.ui.grid.replaceChildren(frag);
    refreshCards();
  }

  function buildCard(part, sec, i) {
    const img = h('img', { src: part.image || '/img/placeholder.svg', alt: part.name, loading: 'lazy', draggable: 'false' });
    img.addEventListener('error', () => { if (!img.src.endsWith('/img/placeholder.svg')) img.src = '/img/placeholder.svg'; }, { once: true });
    const toggleFn = () => toggle(part.id);
    const card = h(
      'article',
      {
        class: `card ${i >= 0 ? 'enter' : ''}`,
        tabindex: '0',
        role: 'button',
        'aria-pressed': 'false',
        'aria-label': `${part.name} auswählen`,
        onclick: toggleFn,
        onkeydown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleFn();
          }
        },
      },
      h('div', { class: 'card-img' }, img, h('span', { class: 'check' }, icon('check'))),
      h(
        'div',
        { class: 'card-body' },
        h('div', { class: 'card-cat' }, sec.label),
        h('h4', null, part.name),
        h('p', null, part.description),
        h('div', { class: 'card-foot' }, h('span', { class: 'pick pick-add' }, icon('plus'), 'Hinzufügen'), h('span', { class: 'pick pick-on' }, icon('check'), 'Ausgewählt'))
      )
    );
    if (i >= 0) card.style.setProperty('--i', String(Math.min(i, 14)));
    S.cards.set(part.id, card);
    return card;
  }

  function refreshCards() {
    for (const [id, el] of S.cards) {
      const on = S.selected.has(id);
      el.classList.toggle('selected', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  /* ====================== Auswahl ====================== */
  function toggle(id) {
    const entry = S.parts.get(id);
    if (!entry) return;
    if (S.selected.has(id)) {
      S.selected.delete(id);
    } else {
      if (entry.cat.exclusive) {
        for (const other of [...S.selected]) {
          const o = S.parts.get(other);
          if (o && o.cat.id === entry.cat.id) S.selected.delete(other);
        }
      }
      S.selected.add(id);
    }
    selectionChanged();
  }

  function selectionChanged() {
    refreshCards();
    buildTabs();
    renderSelection();
    scheduleCalc();
  }

  function orderedSelection() {
    // gleiche Reihenfolge wie im Katalog
    const out = [];
    for (const top of S.tree) {
      for (const sec of sectionsFor(top)) for (const p of sec.parts) if (S.selected.has(p.id)) out.push(S.parts.get(p.id));
    }
    return out;
  }

  /* ====================== Zusammenfassung ====================== */
  function buildSummary() {
    const ui = S.ui;
    ui.count = h('span', { class: 'count-pill' }, '0');
    ui.list = h('div', { class: 'sel-list' });
    ui.barCount = h('span', null, '0 Teile');
    ui.barTotal = h('strong', { class: 'js-total' }, money(0, S.currency));
    ui.clear = h('button', { class: 'link-btn', type: 'button', onclick: () => { S.selected.clear(); selectionChanged(); } }, 'Leeren');

    const customer = h('input', { type: 'text', placeholder: 'Kunde (optional)', maxlength: '80', 'aria-label': 'Kunde', oninput: (e) => (S.customer = e.target.value) });
    const plate = h('input', { type: 'text', placeholder: 'Kennzeichen (optional)', maxlength: '20', 'aria-label': 'Kennzeichen', oninput: (e) => (S.plate = e.target.value) });

    ui.sub = h('span', null, '–');
    ui.pct = h('span', null, '–');
    ui.save = h('span', null, '–');
    ui.total = h('strong', { class: 'js-total' }, money(0, S.currency));
    ui.rowPct = h('div', { class: 'trow', hidden: true }, h('span', null, 'Gewährter Rabatt'), ui.pct);
    ui.rowSave = h('div', { class: 'trow save', hidden: true }, h('span', null, 'Ersparnis durch Rabatt'), ui.save);

    let discountBox = null;
    if (S.discount.available) {
      const sw = h('input', {
        type: 'checkbox',
        role: 'switch',
        onchange: (e) => {
          S.applyDiscount = e.target.checked;
          if (ui.pctInput) ui.pctInput.disabled = !S.applyDiscount;
          scheduleCalc();
        },
      });
      discountBox = h('div', { class: 'discount-box' },
        h('label', { class: 'switch' }, sw, h('span', { class: 'slider' }), h('span', { class: 'switch-label' }, 'Rabatt gewähren', h('small', null, `Standard: ${percent(S.discount.percent)}`)))
      );
      if (S.discount.canEditPercent) {
        ui.pctInput = h('input', {
          type: 'number', min: '0', max: '100', step: '0.5', inputmode: 'decimal', disabled: true,
          placeholder: String(S.discount.percent), 'aria-label': 'Rabatt in Prozent',
          oninput: (e) => { S.customPercent = e.target.value; scheduleCalc(); },
        });
        discountBox.append(h('label', { class: 'pct-edit' }, h('span', null, 'Abweichend (%)'), ui.pctInput));
      }
    }

    ui.invoiceBtn = h('button', { class: 'btn primary block big', type: 'button', disabled: true, onclick: createInvoice }, icon('print'), 'Rechnung erstellen');

    const body = h(
      'div',
      { class: 'summary-body' },
      h('div', { class: 'summary-head' }, h('h2', null, icon('cart'), 'Auswahl', ui.count), ui.clear),
      ui.list,
      h('div', { class: 'summary-foot' },
        h('div', { class: 'meta-inputs' }, customer, plate),
        discountBox,
        h('div', { class: 'totals' },
          h('div', { class: 'trow' }, h('span', null, 'Zwischensumme'), ui.sub),
          ui.rowPct,
          ui.rowSave,
          h('div', { class: 'trow grand' }, h('span', null, 'Gesamtsumme'), ui.total)
        ),
        ui.invoiceBtn
      )
    );

    const el = h('aside', { class: 'summary', 'aria-label': 'Auswahl und Gesamtsumme' },
      h('button', { class: 'summary-bar', type: 'button', 'aria-expanded': 'false', onclick: () => {
        const open = el.classList.toggle('open');
        el.querySelector('.summary-bar').setAttribute('aria-expanded', String(open));
      } }, h('span', { class: 'bar-left' }, icon('cart'), ui.barCount), h('span', { class: 'bar-right' }, ui.barTotal, icon('chevron'))),
      body
    );
    return el;
  }

  function renderSelection() {
    const ui = S.ui;
    const items = orderedSelection();
    ui.count.textContent = String(items.length);
    ui.barCount.textContent = `${items.length} ${items.length === 1 ? 'Teil' : 'Teile'}`;
    ui.clear.hidden = !items.length;
    ui.invoiceBtn.disabled = !items.length;
    if (!items.length) {
      ui.list.replaceChildren(h('div', { class: 'empty small' }, 'Noch nichts ausgewählt. Teile antippen, um sie zur Rechnung hinzuzufügen.'));
      return;
    }
    const groups = new Map();
    for (const e of items) {
      if (!groups.has(e.label)) groups.set(e.label, []);
      groups.get(e.label).push(e);
    }
    const nodes = [];
    for (const [label, list] of groups) {
      nodes.push(h('div', { class: 'sel-group' }, label));
      for (const e of list) {
        nodes.push(
          h('div', { class: 'sel-item' },
            h('img', { src: e.part.image || '/img/placeholder.svg', alt: '' }),
            h('span', { class: 'sel-name' }, e.part.name),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': `${e.part.name} entfernen`, onclick: () => toggle(e.part.id) }, icon('x'))
          )
        );
      }
    }
    ui.list.replaceChildren(...nodes);
  }

  function scheduleCalc() {
    clearTimeout(S.timer);
    S.ui.summary.classList.add('busy');
    S.timer = setTimeout(runCalc, 120);
  }

  function requestBody() {
    const body = { items: [...S.selected], applyDiscount: S.applyDiscount && S.discount.available };
    if (S.discount.canEditPercent && S.customPercent !== '') body.discountPercent = S.customPercent;
    return body;
  }

  async function runCalc() {
    const seq = ++S.seq;
    if (!S.selected.size) {
      S.calc = null;
      S.ui.summary.classList.remove('busy');
      return renderTotals();
    }
    try {
      const res = await api('POST', '/api/calculate', requestBody());
      if (seq !== S.seq) return;
      S.calc = res;
      S.ui.summary.classList.remove('busy');
      renderTotals();
    } catch (e) {
      if (seq !== S.seq) return;
      S.ui.summary.classList.remove('busy');
      toast(e.message, 'error');
      if (e.status === 400) {
        await loadCatalog();
        for (const id of [...S.selected]) if (!S.parts.has(id)) S.selected.delete(id);
        buildTabs(); buildGrid(false); renderSelection();
      }
    }
  }

  function renderTotals() {
    const ui = S.ui;
    const c = S.calc;
    const cur = S.currency;
    ui.sub.textContent = money(c ? c.subtotalCents : 0, cur);
    ui.total.textContent = money(c ? c.totalCents : 0, cur);
    ui.barTotal.textContent = money(c ? c.totalCents : 0, cur);
    const applied = Boolean(c && c.discountPercent > 0);
    ui.rowPct.hidden = !applied;
    ui.rowSave.hidden = !applied;
    if (applied) {
      ui.pct.textContent = percent(c.discountPercent);
      ui.save.textContent = `− ${money(c.discountCents, cur)}`;
    }
  }

  /* ====================== Rechnung ====================== */
  async function createInvoice() {
    S.ui.invoiceBtn.disabled = true;
    try {
      const { invoice } = await api('POST', '/api/invoices', { ...requestBody(), customer: S.customer, plate: S.plate });
      showInvoice(invoice);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      S.ui.invoiceBtn.disabled = !S.selected.size;
    }
  }

  function showInvoice(inv) {
    const cur = inv.currency;
    const applied = inv.discountPercent > 0;
    const sheet = h(
      'div',
      { class: 'invoice-sheet' },
      h('div', { class: 'inv-head' },
        h('div', null, h('div', { class: 'inv-company' }, inv.company), h('div', { class: 'inv-sub' }, 'Tuning & Fahrzeugveredelung')),
        h('div', { class: 'inv-meta' }, h('strong', null, 'RECHNUNG'), h('div', null, inv.number), h('div', null, fmtDate(inv.createdAt)))
      ),
      h('dl', { class: 'inv-info' },
        h('div', null, h('dt', null, 'Kunde'), h('dd', null, inv.customer || '–')),
        h('div', null, h('dt', null, 'Kennzeichen'), h('dd', null, inv.plate || '–')),
        h('div', null, h('dt', null, 'Bearbeiter'), h('dd', null, inv.employee))
      ),
      h('table', { class: 'inv-table' },
        h('thead', null, h('tr', null, h('th', null, 'Pos.'), h('th', null, 'Leistung'), h('th', null, 'Kategorie'))),
        h('tbody', null, ...inv.items.map((it, i) => h('tr', null, h('td', null, i + 1), h('td', null, it.name), h('td', null, it.category))))
      ),
      h('div', { class: 'inv-totals' },
        h('div', null, h('span', null, 'Anzahl der Leistungen'), h('span', null, inv.count)),
        h('div', null, h('span', null, 'Zwischensumme'), h('span', null, money(inv.subtotalCents, cur))),
        applied ? h('div', null, h('span', null, 'Gewährter Rabatt'), h('span', null, percent(inv.discountPercent))) : null,
        applied ? h('div', null, h('span', null, 'Ersparnis'), h('span', null, `− ${money(inv.discountCents, cur)}`)) : null,
        h('div', { class: 'grand' }, h('span', null, 'Gesamtsumme'), h('span', null, money(inv.totalCents, cur)))
      ),
      h('p', { class: 'inv-thanks' }, 'Vielen Dank für Ihr Vertrauen!')
    );
    const m = modal({
      title: `Rechnung ${inv.number}`,
      wide: true,
      className: 'invoice-modal',
      content: sheet,
      actions: [
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, 'Schließen'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => window.print() }, icon('print'), 'Drucken'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => {
          m.close();
          S.selected.clear();
          S.customer = S.plate = '';
          for (const el of S.ui.summary.querySelectorAll('.meta-inputs input')) el.value = '';
          selectionChanged();
          toast('Neue Berechnung gestartet', 'ok');
        } }, 'Neue Berechnung'),
      ],
    });
  }

  function openPasswordDialog() {
    const m = modal({
      title: 'Passwort ändern',
      content: passwordForm({ onDone: () => m.close(), onCancel: () => m.close() }),
    });
  }

  init();
})();
