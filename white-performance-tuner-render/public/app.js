'use strict';
// Rechner: zeigt Leistungen ohne Preise, die gesamte Berechnung kommt vom Server (/api/calc).
(function () {
  const CK = 'tr_cart_v3', DK = 'tr_disc_v3', GMAX = 200000;
  const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ME = null, DISC = { can: false, max: 0 }, SET = { title: 'Tuningrechner', guestAccess: true };
  let CAT = [], ITEMS = new Map(), cart = {}, disc = 0, active = 'all', query = '', CALC = null, calcT = null, seq = 0, lastShown = { cTot: 0, bTot: 0, gTot: 0 };
  try { cart = JSON.parse(localStorage.getItem(CK)) || {}; disc = Number(localStorage.getItem(DK)) || 0; } catch (e) { cart = {}; }
  const save = () => { try { localStorage.setItem(CK, JSON.stringify(cart)); localStorage.setItem(DK, String(disc)); } catch (e) {} };
  const lines = () => Object.keys(cart).filter(id => ITEMS.has(+id) && cart[id] > 0).map(id => ({ id: +id, qty: cart[id] }));

  /* ---------- Effekte ---------- */
  function tween(el, key, to, fmtFn) {
    const from = lastShown[key] || 0; lastShown[key] = to;
    if (REDUCE || from === to) { el.textContent = fmtFn(to); return; }
    const t0 = performance.now(), dur = 650;
    (function step(t) { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = fmtFn(from + (to - from) * e); if (p < 1) requestAnimationFrame(step); else el.textContent = fmtFn(to); })(t0);
  }
  const fx = $('fx'), ctx = fx.getContext('2d'); let parts = [], raf = 0;
  function sizeFx() { fx.width = innerWidth * devicePixelRatio; fx.height = innerHeight * devicePixelRatio; }
  sizeFx(); addEventListener('resize', sizeFx);
  function burst(x, y) {
    if (REDUCE) return; const dp = devicePixelRatio;
    for (let i = 0; i < 18; i++) { const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 5; parts.push({ x: x * dp, y: y * dp, vx: Math.cos(a) * s * dp, vy: (Math.sin(a) * s - 2) * dp, l: 1, c: Math.random() > .5 ? '255,122,26' : '255,59,46', r: (1.5 + Math.random() * 2.5) * dp }); }
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function loop() {
    ctx.clearRect(0, 0, fx.width, fx.height);
    parts = parts.filter(p => p.l > 0);
    for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vy += .22 * devicePixelRatio; p.l -= .025; ctx.fillStyle = 'rgba(' + p.c + ',' + Math.max(0, p.l) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.3); ctx.fill(); }
    raf = parts.length ? requestAnimationFrame(loop) : 0; if (!raf) ctx.clearRect(0, 0, fx.width, fx.height);
  }
  function fly(card, evt) {
    const img = card.querySelector('img'); const tgt = $('bTot').getBoundingClientRect();
    burst(evt.clientX || card.getBoundingClientRect().left + 60, evt.clientY || card.getBoundingClientRect().top + 60);
    if (!img || REDUCE) return; const r = img.getBoundingClientRect(), c = img.cloneNode(); c.className = 'fly'; c.style.cssText = 'left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px';
    document.body.appendChild(c);
    c.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: 'translate(' + (tgt.left - r.left) + 'px,' + (tgt.top - r.top) + 'px) scale(.2)', opacity: .2 }], { duration: 650, easing: 'cubic-bezier(.5,0,.8,.4)' }).onfinish = () => c.remove();
  }
  addEventListener('pointermove', e => { document.body.style.setProperty('--cx', e.clientX + 'px'); document.body.style.setProperty('--cy', e.clientY + 'px'); }, { passive: true });
  addEventListener('scroll', () => $('top').classList.toggle('sc', scrollY > 30), { passive: true });
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .08 }) : null;
  const reveal = el => { if (io && !REDUCE) io.observe(el); else el.classList.add('in'); };
  (function ticks() { let h = ''; for (let i = 0; i <= 24; i++) { const a = (150 + i * 10) * Math.PI / 180, big = i % 4 === 0, r1 = big ? 100 : 106, r2 = 115; h += '<line class="g-tick' + (big ? ' m' : '') + '" x1="' + (150 + r1 * Math.cos(a)).toFixed(1) + '" y1="' + (150 + r1 * Math.sin(a)).toFixed(1) + '" x2="' + (150 + r2 * Math.cos(a)).toFixed(1) + '" y2="' + (150 + r2 * Math.sin(a)).toFixed(1) + '"/>'; } $('ticks').innerHTML = h; })();
  const LEVELS = ['Serie', 'Street', 'Sport', 'Race', 'Hyper'];
  function gauge(total) {
    const f = Math.max(0, Math.min(1, total / GMAX));
    $('gProg').style.strokeDasharray = (502.65 * f).toFixed(1) + ' 753.98'; $('gNeedle').style.transform = 'rotate(' + (-120 + 240 * f).toFixed(1) + 'deg)';
    $('gLvl').textContent = LEVELS[Math.min(4, Math.floor(f * 5))];
  }

  /* ---------- Anzeige ---------- */
  function renderWho() {
    const w = $('who');
    if (ME) w.innerHTML = '<span>Angemeldet: <b>' + esc(ME.username) + '</b> <span class="tag' + (ME.role === 'admin' ? ' a' : '') + '">' + (ME.role === 'admin' ? 'Admin' : 'Mitarbeiter') + '</span></span>' + (ME.role === 'admin' ? '<a class="btn sm" href="/admin">Adminbereich</a>' : '') + '<button class="btn sm" id="bOut" type="button">Abmelden</button>';
    else w.innerHTML = '<button class="btn sm p" id="bIn" type="button">Anmelden</button>';
    const o = $('bOut'); if (o) o.onclick = async () => { try { await api('POST', '/api/logout', {}); } catch (e) {} location.reload(); };
    const i = $('bIn'); if (i) i.onclick = () => showLogin(true);
  }
  function showLogin(optional) {
    $('mainView').hidden = true; $('bar').hidden = true; $('loginView').hidden = false;
    loginForm($('loginView'), () => location.reload(), SET.title);
    if (optional) { const b = document.createElement('button'); b.className = 'btn'; b.style.cssText = 'display:block;margin:-8px auto 0'; b.textContent = 'Zurück zum Rechner'; b.onclick = () => { $('loginView').hidden = true; $('mainView').hidden = false; $('bar').hidden = false; }; $('loginView').appendChild(b); }
  }
  function renderPills() {
    const p = $('pills'); p.innerHTML = '';
    [{ id: 'all', name: 'Alle' }].concat(CAT).forEach(c => { const b = document.createElement('button'); b.type = 'button'; b.className = 'pill' + (String(c.id) === String(active) ? ' on' : ''); b.textContent = c.name; b.onclick = () => { active = c.id; renderPills(); renderList(); }; p.appendChild(b); });
  }
  function cardHtml(it, i) {
    const n = cart[it.id] || 0;
    return '<button type="button" class="card' + (n ? ' sel' : '') + '" data-id="' + it.id + '" style="animation-delay:' + Math.min(i * 30, 400) + 'ms"><span class="shine"></span><div class="img">' + (it.image ? '<img src="' + esc(it.image) + '" alt="" loading="lazy" draggable="false">' : '<div class="noimg">⚙</div>') + '</div><div class="nm">' + esc(it.name) + '</div>' + (n ? '<span class="badge">' + n + '×</span>' : '') + '</button>';
  }
  function renderList() {
    const L = $('list'); L.innerHTML = ''; let any = false; const q = query.trim().toLowerCase();
    CAT.forEach(c => {
      if (active !== 'all' && String(active) !== String(c.id)) return;
      const its = c.items.filter(i => !q || i.name.toLowerCase().includes(q) || (i.subgroup || '').toLowerCase().includes(q)); if (!its.length) return; any = true;
      const sec = document.createElement('section'); sec.className = 'sec rev'; let h = '<h2>' + esc(c.name) + '</h2>', idx = 0;
      const groups = []; its.forEach(i => { let g = groups.find(x => x.n === (i.subgroup || '')); if (!g) groups.push(g = { n: i.subgroup || '', a: [] }); g.a.push(i); });
      groups.forEach(g => { h += (g.n ? '<h3>' + esc(g.n) + '</h3>' : '') + '<div class="grid">' + g.a.map(i => cardHtml(i, idx++)).join('') + '</div>'; });
      sec.innerHTML = h; L.appendChild(sec); reveal(sec);
    });
    if (!any) L.innerHTML = '<div class="empty">Keine Leistung gefunden.</div>';
  }
  function refreshBadges() {
    document.querySelectorAll('#list .card').forEach(c => { const n = cart[c.dataset.id] || 0; c.classList.toggle('sel', n > 0); let b = c.querySelector('.badge'); if (n) { if (!b) { b = document.createElement('span'); b.className = 'badge'; c.appendChild(b); } b.textContent = n + '×'; } else if (b) b.remove(); });
  }
  function renderLines() {
    const L = $('lines'), ls = lines(); if (!ls.length) { L.innerHTML = '<div class="empty">Noch nichts ausgewählt.<br>Tippe eine Leistung an.</div>'; return; }
    const groups = new Map(); ls.forEach(l => { const it = ITEMS.get(l.id), c = it.cat; if (!groups.has(c)) groups.set(c, []); groups.get(c).push({ it, qty: l.qty }); });
    let h = ''; groups.forEach((arr, c) => { h += '<div class="cg"><h4>' + esc(c) + '</h4>' + arr.map(x => '<div class="lr"><div class="n">' + esc(x.it.name) + '</div><div class="qt"><button class="q" type="button" data-a="m" data-id="' + x.it.id + '" aria-label="weniger">−</button><input type="number" min="1" max="999" data-id="' + x.it.id + '" value="' + x.qty + '" aria-label="Anzahl"><button class="q" type="button" data-a="p" data-id="' + x.it.id + '" aria-label="mehr">+</button></div><button class="q" type="button" data-a="d" data-id="' + x.it.id + '" aria-label="entfernen">✕</button></div>').join('') + '</div>'; });
    L.innerHTML = h;
  }
  function renderDisc() {
    const d = $('disc'); d.hidden = !DISC.can; if (!DISC.can) return;
    $('dRange').max = $('dNum').max = DISC.max; if (disc > DISC.max) disc = DISC.max; $('dRange').value = $('dNum').value = disc;
    $('dHint').textContent = 'Du darfst bis zu ' + DISC.max + ' % Rabatt gewähren.';
  }
  function showSummary() {
    const c = CALC || { count: 0, subtotal: 0, percent: 0, saved: 0, total: 0 };
    $('sCnt').textContent = c.count; $('sSub').textContent = fmt(c.subtotal);
    $('rPct').style.display = c.percent > 0 ? '' : 'none'; $('rSave').style.display = c.percent > 0 ? '' : 'none';
    $('sPct').textContent = String(c.percent).replace('.', ',') + ' %'; $('sSave').textContent = '−' + fmt(c.saved);
    tween($('cTot'), 'cTot', c.total, fmt); tween($('bTot'), 'bTot', c.total, fmt); tween($('gTot'), 'gTot', c.total, fmt); gauge(c.total);
    $('bCnt').textContent = c.count + (c.count === 1 ? ' Leistung' : ' Leistungen');
  }
  function schedule(now) { clearTimeout(calcT); calcT = setTimeout(doCalc, now ? 0 : 140); }
  async function doCalc(retry) {
    const ls = lines(), my = ++seq;
    if (!ls.length) { CALC = { count: 0, subtotal: 0, percent: 0, saved: 0, total: 0 }; showSummary(); return; }
    try {
      const r = await api('POST', '/api/calc', { lines: ls, discount: disc }); if (my !== seq) return; CALC = r;
      if (r.clamped && DISC.can) { disc = r.percent; save(); renderDisc(); toast('Maximal ' + r.maxDiscount + ' % Rabatt erlaubt.', 'err'); }
      showSummary();
    } catch (e) {
      if (e.status === 401) { showLogin(); return; }
      if (e.status === 400 && !retry) { await loadCatalog(); return doCalc(true); }
      toast(e.error || 'Berechnung fehlgeschlagen.', 'err');
    }
  }
  function add(id, card, evt) { cart[id] = Math.min(999, (cart[id] || 0) + 1); save(); refreshBadges(); renderLines(); schedule(); if (card) { fly(card, evt); card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop'); } }
  /* ---------- Rechnung ---------- */
  function invoiceHtml() {
    const c = CALC || { count: 0, subtotal: 0, percent: 0, saved: 0, total: 0 }, ls = lines().map(l => ({ it: ITEMS.get(l.id), qty: l.qty })).sort((a, b) => a.it.cat.localeCompare(b.it.cat));
    const d = new Date().toLocaleDateString('de-DE');
    return '<div class="inv-h"><div><h2>' + esc(SET.title) + '</h2><div class="hint">Kundenrechnung</div></div><div class="hint" style="text-align:right">Datum: ' + d + '</div></div><table><thead><tr><th>Kategorie</th><th>Leistung</th><th class="r">Anzahl</th></tr></thead><tbody>' +
      (ls.map(x => '<tr><td>' + esc(x.it.cat) + '</td><td>' + esc(x.it.name) + '</td><td class="r">' + x.qty + '×</td></tr>').join('') || '<tr><td colspan="3">Keine Leistungen ausgewählt.</td></tr>') + '</tbody></table>' +
      '<table><tbody><tr><td>Anzahl Leistungen</td><td class="r">' + c.count + '</td></tr><tr><td>Zwischensumme</td><td class="r">' + fmt(c.subtotal) + '</td></tr>' +
      (c.percent > 0 ? '<tr><td>Gewährter Rabatt (' + String(c.percent).replace('.', ',') + ' %)</td><td class="r">−' + fmt(c.saved) + '</td></tr><tr class="sv"><td>Ersparnis</td><td class="r">' + fmt(c.saved) + '</td></tr>' : '') +
      '<tr class="tot"><td>Gesamtsumme</td><td class="r">' + fmt(c.total) + '</td></tr></tbody></table><div class="hint">Vielen Dank für Ihren Auftrag!</div>';
  }
  function openInv() { const h = invoiceHtml(); $('invPrev').innerHTML = h; $('invoice').innerHTML = h; $('mInv').classList.add('on'); }
  function copyText() {
    const c = CALC || { count: 0, subtotal: 0, percent: 0, saved: 0, total: 0 }; let x = SET.title + '\n\n';
    lines().forEach(l => { const it = ITEMS.get(l.id); x += l.qty + '× ' + it.name + ' (' + it.cat + ')\n'; });
    x += '\nZwischensumme: ' + fmt(c.subtotal) + (c.percent > 0 ? '\nRabatt ' + String(c.percent).replace('.', ',') + ' %: −' + fmt(c.saved) : '') + '\nGesamtsumme: ' + fmt(c.total);
    const ok = () => toast('Kopiert.', 'ok'), fb = () => { const a = document.createElement('textarea'); a.value = x; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); ok(); } catch (e) { toast('Kopieren nicht möglich.', 'err'); } a.remove(); };
    try { navigator.clipboard.writeText(x).then(ok, fb); } catch (e) { fb(); }
  }
  /* ---------- Ereignisse ---------- */
  $('list').addEventListener('click', e => { const c = e.target.closest('.card'); if (c) add(+c.dataset.id, c, e); });
  $('list').addEventListener('pointermove', e => { const c = e.target.closest('.card'); if (!c || REDUCE || e.pointerType === 'touch') return; const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; c.style.setProperty('--mx', (x * 100) + '%'); c.style.setProperty('--my', (y * 100) + '%'); c.style.transform = 'perspective(700px) rotateX(' + ((.5 - y) * 10).toFixed(1) + 'deg) rotateY(' + ((x - .5) * 12).toFixed(1) + 'deg) translateY(-4px)'; });
  $('list').addEventListener('pointerout', e => { const c = e.target.closest('.card'); if (c) c.style.transform = ''; });
  $('lines').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; const id = b.dataset.id, a = b.dataset.a; if (a === 'p') cart[id] = Math.min(999, (cart[id] || 0) + 1); if (a === 'm') { cart[id] = (cart[id] || 0) - 1; if (cart[id] < 1) delete cart[id]; } if (a === 'd') delete cart[id]; save(); refreshBadges(); renderLines(); schedule(); });
  $('lines').addEventListener('change', e => { const t = e.target; if (t.dataset.a || !t.dataset.id) return; const n = Math.floor(Number(t.value)); if (n >= 1) cart[t.dataset.id] = Math.min(999, n); else delete cart[t.dataset.id]; save(); refreshBadges(); renderLines(); schedule(); });
  const setDisc = v => { v = Math.max(0, Math.min(DISC.max, Number(v) || 0)); disc = v; $('dRange').value = $('dNum').value = v; save(); schedule(); };
  $('dRange').oninput = () => setDisc($('dRange').value); $('dNum').oninput = () => setDisc($('dNum').value);
  $('q').oninput = () => { query = $('q').value; renderList(); };
  $('bClear').onclick = function () { const b = this; if (!lines().length) return; clearTimeout(b._t); if (b.dataset.arm !== '1') { b.dataset.arm = '1'; b.textContent = 'Sicher?'; b._t = setTimeout(() => { b.dataset.arm = ''; b.textContent = 'Leeren'; }, 3000); return; } b.dataset.arm = ''; b.textContent = 'Leeren'; cart = {}; save(); refreshBadges(); renderLines(); schedule(true); };
  $('bCopy').onclick = copyText; $('bInv').onclick = openInv; $('heroInv').onclick = openInv;
  $('invClose').onclick = () => $('mInv').classList.remove('on'); $('mInv').onclick = e => { if (e.target === $('mInv')) $('mInv').classList.remove('on'); };
  $('invPrint').onclick = () => { $('invoice').innerHTML = invoiceHtml(); window.print(); };
  $('bGo').onclick = e => { if (innerWidth > 1000) { e.preventDefault(); $('cart').scrollIntoView({ behavior: 'smooth', block: 'center' }); } };
  /* ---------- Start ---------- */
  async function loadCatalog() {
    const r = await api('GET', '/api/catalog'); CAT = r.categories; ITEMS = new Map();
    CAT.forEach(c => c.items.forEach(i => ITEMS.set(i.id, Object.assign({ cat: c.name }, i))));
    Object.keys(cart).forEach(id => { if (!ITEMS.has(+id)) delete cart[id]; }); save();
    if (active !== 'all' && !CAT.some(c => String(c.id) === String(active))) active = 'all';
    let n = 0, s = 0; CAT.forEach(c => c.items.forEach(i => { n++; if (i.subgroup) s++; }));
    tween($('sA'), 'sA', n, v => Math.round(v)); tween($('sB'), 'sB', CAT.length, v => Math.round(v)); tween($('sC'), 'sC', s, v => Math.round(v));
    renderPills(); renderList(); renderLines(); renderDisc();
  }
  async function init() {
    try { const m = await api('GET', '/api/me'); ME = m.user; DISC = m.discount; SET = m.settings; } catch (e) { toast(e.error, 'err'); }
    $('brand').textContent = SET.title; document.title = SET.title; renderWho();
    setTimeout(() => $('splash').classList.add('off'), REDUCE ? 0 : 750);
    if (!ME && !SET.guestAccess) { showLogin(); return; }
    try { await loadCatalog(); } catch (e) { if (e.status === 401) { showLogin(); return; } toast(e.error, 'err'); }
    $('mainView').hidden = false; $('bar').hidden = false; $('cart').classList.add('in'); await doCalc();
  }
  init();
})();
