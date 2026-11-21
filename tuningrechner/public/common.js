/* Gemeinsame Helfer für Rechner und Adminbereich (kein innerHTML mit Daten → XSS-sicher) */
(function () {
  'use strict';

  const ICONS = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    logout: '<path d="M10 5H5v14h5M15 8l4 4-4 4M19 12H9"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l3 3M14 9l2 2"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V6z"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    print: '<path d="M7 9V4h10v5M7 17H5v-6h14v6h-2M7 14h10v6H7z"/>',
    chevron: '<path d="M6 15l6-6 6 6"/>',
    upload: '<path d="M12 16V5M7 10l5-5 5 5M5 19h14"/>',
    cart: '<path d="M3 4h3l2.4 11h9.2L20 8H7"/><circle cx="9.5" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
    bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
  };

  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = ICONS[name] || ''; // nur feste, interne Strings
    return svg;
  }

  function append(el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    }
  }

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    const late = {};
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (['value', 'checked', 'selected', 'disabled', 'hidden'].includes(k)) late[k] = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    append(el, kids);
    for (const k of Object.keys(late)) el[k] = late[k];
    return el;
  }

  async function api(method, url, body, opts = {}) {
    const headers = { 'X-Requested-With': 'tuningrechner' };
    let payload;
    if (opts.raw) {
      headers['Content-Type'] = opts.contentType;
      payload = body;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(url, { method, headers, body: payload, credentials: 'same-origin' });
    } catch {
      throw Object.assign(new Error('Server nicht erreichbar'), { status: 0 });
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* leere Antwort */
    }
    if (!res.ok) {
      if (!opts.noRedirect && (res.status === 401 || (data && data.code === 'password_change_required'))) {
        location.reload();
      }
      const err = new Error((data && data.error) || `Fehler ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  const nf0 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function money(cents, currency) {
    const n = Number(cents) || 0;
    return `${n % 100 === 0 ? nf0.format(n / 100) : nf2.format(n / 100)} ${currency || '$'}`;
  }
  function percent(p) {
    return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(p)} %`;
  }
  function fmtDate(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function toast(message, type = 'info') {
    let box = document.getElementById('toasts');
    if (!box) {
      box = h('div', { id: 'toasts', role: 'status', 'aria-live': 'polite' });
      document.body.append(box);
    }
    const el = h('div', { class: `toast ${type}` }, message);
    box.append(el);
    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 300);
    }, type === 'error' ? 5000 : 3000);
  }

  function modal({ title, content, actions, wide = false, persistent = false, className = '' }) {
    const previous = document.activeElement;
    const closeBtn = persistent ? null : h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Schließen', onclick: () => close() }, icon('x'));
    const box = h(
      'div',
      { class: `modal ${wide ? 'wide' : ''} ${className}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog' },
      title ? h('div', { class: 'modal-head' }, h('h3', null, title), closeBtn) : null,
      h('div', { class: 'modal-body' }, content),
      actions ? h('div', { class: 'modal-actions no-print' }, actions) : null
    );
    const backdrop = h('div', { class: 'modal-backdrop' }, box);
    function onKey(e) {
      if (e.key === 'Escape' && !persistent) close();
    }
    function close() {
      document.removeEventListener('keydown', onKey);
      backdrop.classList.add('leaving');
      document.body.classList.remove('modal-open');
      setTimeout(() => backdrop.remove(), 180);
      if (previous && previous.focus) previous.focus();
    }
    if (!persistent) {
      backdrop.addEventListener('mousedown', (e) => {
        if (e.target === backdrop) close();
      });
    }
    document.addEventListener('keydown', onKey);
    document.body.append(backdrop);
    document.body.classList.add('modal-open');
    const first = box.querySelector('input:not([type=hidden]), select, textarea');
    if (first) first.focus();
    return { close, el: box };
  }

  function confirmDialog(message, { okText = 'Bestätigen', danger = false, title = 'Bitte bestätigen' } = {}) {
    return new Promise((resolve) => {
      const m = modal({
        title,
        content: h('p', { class: 'confirm-text' }, message),
        actions: [
          h('button', { class: 'btn ghost', type: 'button', onclick: () => (m.close(), resolve(false)) }, 'Abbrechen'),
          h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, type: 'button', onclick: () => (m.close(), resolve(true)) }, okText),
        ],
      });
    });
  }

  /** Passwort-ändern-Formular (auch für den erzwungenen Wechsel nach dem ersten Login) */
  function passwordForm({ onDone, onCancel }) {
    const cur = h('input', { type: 'password', autocomplete: 'current-password', required: true });
    const nw = h('input', { type: 'password', autocomplete: 'new-password', required: true, minlength: '8' });
    const rep = h('input', { type: 'password', autocomplete: 'new-password', required: true, minlength: '8' });
    const err = h('div', { class: 'form-error', role: 'alert', hidden: true });
    const submit = h('button', { class: 'btn primary', type: 'submit' }, 'Passwort speichern');
    const form = h(
      'form',
      {
        class: 'form',
        onsubmit: async (e) => {
          e.preventDefault();
          err.hidden = true;
          if (nw.value !== rep.value) {
            err.textContent = 'Die neuen Passwörter stimmen nicht überein.';
            err.hidden = false;
            return;
          }
          submit.disabled = true;
          try {
            await api('POST', '/api/password', { current: cur.value, next: nw.value }, { noRedirect: true });
            toast('Passwort wurde geändert', 'ok');
            onDone();
          } catch (ex) {
            err.textContent = ex.message;
            err.hidden = false;
            submit.disabled = false;
          }
        },
      },
      h('label', { class: 'field' }, h('span', null, 'Aktuelles Passwort'), cur),
      h('label', { class: 'field' }, h('span', null, 'Neues Passwort (mind. 8 Zeichen)'), nw),
      h('label', { class: 'field' }, h('span', null, 'Neues Passwort wiederholen'), rep),
      err,
      h('div', { class: 'form-actions' }, onCancel ? h('button', { class: 'btn ghost', type: 'button', onclick: onCancel }, 'Abbrechen') : null, submit)
    );
    return form;
  }

  window.TC = { h, icon, api, money, percent, fmtDate, toast, modal, confirmDialog, passwordForm };
})();
