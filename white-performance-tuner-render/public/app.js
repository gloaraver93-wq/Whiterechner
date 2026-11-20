let catalog = { categories: [], items: [], discountConfig: { enabled: true, maxDiscountPercent: 25 } };
let currentUser = { id: "guest", username: "gast", role: "staff", label: "Mitarbeiter", canDiscount: false, maxDiscount: 0 };
let authToken = localStorage.getItem("wp_token") || null;
let selectedMap = new Map();
let activeCategory = "alle";
let activePerfTab = "alle";
let adminOverview = null;

function formatMoney(val) {
  return "$" + Number(val || 0).toLocaleString("de-DE");
}

async function initApp() {
  await checkSession();
  await loadCatalog();
  renderFilterPills();
  renderCatalog();
  await recalculateQuote();
}

async function checkSession() {
  try {
    const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    const res = await fetch("/api/session", { headers });
    const data = await res.json();
    currentUser = data.user || currentUser;
    updateRoleUI();
  } catch {
    updateRoleUI();
  }
}

function updateRoleUI() {
  const badge = document.getElementById("role-badge");
  const discountInput = document.getElementById("discount-input");
  const hint = document.getElementById("discount-permission-hint");
  const capLabel = document.getElementById("discount-cap-label");

  if (badge) {
    badge.textContent = currentUser.role === "admin"
      ? `Admin: ${currentUser.username}`
      : `${currentUser.label} (${currentUser.username})`;
  }

  const allowed = Boolean(catalog.discountConfig?.enabled) && (currentUser.role === "admin" || Boolean(currentUser.canDiscount));
  const cap = currentUser.role === "admin"
    ? Number(catalog.discountConfig?.maxDiscountPercent || 0)
    : Math.min(Number(currentUser.maxDiscount || 0), Number(catalog.discountConfig?.maxDiscountPercent || 0));

  if (discountInput) {
    discountInput.disabled = !allowed;
    discountInput.max = String(cap);
    if (!allowed) {
      discountInput.value = "0";
    } else if (Number(discountInput.value) > cap) {
      discountInput.value = String(cap);
    }
  }
  if (hint) {
    hint.textContent = allowed ? "Rabatt freigegeben" : "Keine Rabattberechtigung";
    hint.className = allowed ? "text-[11px] text-emerald-400 font-semibold" : "text-[11px] text-zinc-500";
  }
  if (capLabel) {
    capLabel.textContent = `Max: ${cap}%`;
  }
}

async function loadCatalog() {
  const res = await fetch("/api/catalog");
  catalog = await res.json();
  updateRoleUI();
}

function toggleFilterBar() {
  document.getElementById("filter-bar").classList.toggle("hidden");
}

function renderFilterPills() {
  const container = document.getElementById("category-pills");
  const allCats = ["alle", ...(catalog.categories || [])];
  container.innerHTML = allCats
    .map((cat) => {
      const active = activeCategory === cat;
      const label = cat === "alle" ? "Alle Kategorien" : cat;
      return `<button onclick="selectCategory('${cat.replace(/'/g, "\'")}')" class="px-3 py-1 rounded text-xs font-bold uppercase ${
        active ? "bg-white text-zinc-950" : "bg-[#1e1f24] text-zinc-300 border border-[#2d3039]"
      }">${label}</button>`;
    })
    .join("");
}

function selectCategory(cat) {
  activeCategory = cat;
  renderFilterPills();
  renderCatalog();
}

function setPerfTab(tab) {
  activePerfTab = tab;
  document.querySelectorAll(".perf-tab").forEach((btn) => {
    const isActive = btn.dataset.perf === tab;
    btn.className = `perf-tab px-3 py-1.5 rounded text-xs font-bold uppercase ${
      isActive ? "bg-white text-zinc-950" : "bg-[#1e1f24] text-zinc-300 border border-[#2d3039]"
    }`;
  });
  renderPerfGrid();
}

function renderTileHtml(item) {
  const qty = selectedMap.get(item.id) || 0;
  const selectedClass = qty > 0 ? "is-selected" : "";
  return `
    <div onclick="toggleItem('${item.id}')" class="shop-tile ${selectedClass} cursor-pointer p-3.5 flex flex-col items-center justify-between min-h-[84px] relative">
      <div class="w-full flex items-center justify-between">
        <span class="infinity-mark">∞</span>
        ${qty > 0 ? `<span class="px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black">${qty}x</span>` : `<span></span>`}
      </div>
      <div class="text-center w-full">
        <div class="text-xs sm:text-[13px] font-bold text-zinc-100 leading-tight truncate" title="${item.name}">${item.name}</div>
        <div class="text-[10px] text-zinc-500 mt-0.5 truncate">${item.subCategory || item.group}</div>
      </div>
    </div>
  `;
}

function getFilteredItems() {
  const query = (document.getElementById("search-input")?.value || "").trim().toLowerCase();
  return (catalog.items || []).filter((item) => {
    const matchCat = activeCategory === "alle" || item.group === activeCategory;
    const matchQuery =
      !query ||
      item.name.toLowerCase().includes(query) ||
      (item.subCategory || "").toLowerCase().includes(query) ||
      item.group.toLowerCase().includes(query);
    return matchCat && matchQuery;
  });
}

function renderPerfGrid() {
  const perfGrid = document.getElementById("perf-grid");
  const filtered = getFilteredItems().filter((i) => i.group === "Leistungsteile");
  const visible = activePerfTab === "alle" ? filtered : filtered.filter((i) => i.subCategory === activePerfTab);
  perfGrid.innerHTML = visible.length
    ? visible.map(renderTileHtml).join("")
    : `<div class="col-span-full text-xs text-zinc-500 py-4 text-center">Keine Leistungsteile im aktuellen Filter.</div>`;
}

function renderCatalog() {
  renderPerfGrid();
  const container = document.getElementById("other-categories-container");
  const filtered = getFilteredItems().filter((i) => i.group !== "Leistungsteile");
  const groups = Array.from(new Set(filtered.map((i) => i.group)));

  container.innerHTML = groups
    .map((group) => {
      const items = filtered.filter((i) => i.group === group);
      return `
        <div class="bg-[#191a1f] border border-[#26282f] rounded-lg p-4 sm:p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base sm:text-lg font-extrabold tracking-wide uppercase text-white">${group}</h2>
            <span class="text-xs text-zinc-500">${items.length} Artikel</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            ${items.map(renderTileHtml).join("")}
          </div>
        </div>
      `;
    })
    .join("");
}

function toggleItem(id) {
  const current = selectedMap.get(id) || 0;
  selectedMap.set(id, current + 1);
  renderCatalog();
  recalculateQuote();
}

function changeQty(id, delta) {
  const next = (selectedMap.get(id) || 0) + delta;
  if (next <= 0) {
    selectedMap.delete(id);
  } else {
    selectedMap.set(id, next);
  }
  renderCatalog();
  recalculateQuote();
}

function resetSelection() {
  selectedMap.clear();
  const discountInput = document.getElementById("discount-input");
  if (discountInput) discountInput.value = "0";
  renderCatalog();
  recalculateQuote();
}

async function recalculateQuote() {
  const selections = Array.from(selectedMap.entries()).map(([id, qty]) => ({ id, qty }));
  const discountPercent = Number(document.getElementById("discount-input")?.value || 0);

  const headers = { "Content-Type": "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch("/api/calculate", {
    method: "POST",
    headers,
    body: JSON.stringify({ selections, discountPercent })
  });
  const quote = await res.json();

  document.getElementById("selected-count-badge").textContent = `${quote.totalCount || 0} Teile`;
  document.getElementById("summary-subtotal").textContent = formatMoney(quote.subtotal);
  document.getElementById("summary-discount-pct").textContent = String(quote.discountPercent || 0);
  document.getElementById("summary-discount-amt").textContent = `-${formatMoney(quote.discountAmount)}`;
  document.getElementById("summary-total").textContent = formatMoney(quote.total);

  const listEl = document.getElementById("selected-items-list");
  if (!quote.lineItems || !quote.lineItems.length) {
    listEl.innerHTML = `<div class="text-sm text-zinc-500 py-8 text-center border border-dashed border-[#26282f] rounded">Noch keine Tuningteile oder Stufen ausgewählt.</div>`;
    return;
  }

  listEl.innerHTML = quote.lineItems
    .map(
      (li) => `
      <div class="flex items-center justify-between gap-2 bg-[#141518] border border-[#26282f] rounded px-3 py-2 text-xs">
        <div class="min-w-0">
          <div class="font-bold text-zinc-100 truncate">${li.name}</div>
          <div class="text-[10px] text-zinc-500">${li.subCategory || li.group}</div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button onclick="changeQty('${li.id}', -1)" class="w-6 h-6 rounded bg-[#1e1f24] border border-[#2d3039] font-bold">-</button>
          <span class="w-6 text-center font-bold text-white">${li.qty}</span>
          <button onclick="changeQty('${li.id}', 1)" class="w-6 h-6 rounded bg-[#1e1f24] border border-[#2d3039] font-bold">+</button>
        </div>
      </div>
    `
    )
    .join("");
}

function copyCustomerReceipt() {
  const lines = ["WHITE PERFORMANCE SHOP — KUNDENRECHNUNG"];
  document.querySelectorAll("#selected-items-list > div").forEach((row) => {
    const title = row.querySelector(".font-bold")?.textContent?.trim();
    const qty = row.querySelector("span.w-6")?.textContent?.trim();
    if (title && qty) lines.push(`• ${qty}x ${title}`);
  });
  lines.push(`Zwischensumme: ${document.getElementById("summary-subtotal").textContent}`);
  lines.push(`Rabatt (${document.getElementById("summary-discount-pct").textContent}%): ${document.getElementById("summary-discount-amt").textContent}`);
  lines.push(`GESAMTPREIS: ${document.getElementById("summary-total").textContent}`);

  navigator.clipboard?.writeText(lines.join("\n"));
  const fb = document.getElementById("copy-feedback");
  fb.classList.remove("hidden");
  setTimeout(() => fb.classList.add("hidden"), 2500);
}

// Admin Modal Funktionen
function openAdminModal() {
  document.getElementById("admin-modal").classList.remove("hidden");
  if (currentUser.role === "admin" && authToken) {
    loadAdminOverview();
  } else {
    document.getElementById("admin-login-panel").classList.remove("hidden");
    document.getElementById("admin-dashboard-panel").classList.add("hidden");
  }
}

function closeAdminModal() {
  document.getElementById("admin-modal").classList.add("hidden");
}

async function loginUser() {
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;
  const errEl = document.getElementById("login-error");
  errEl.classList.add("hidden");

  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (!res.ok) {
    errEl.textContent = data.error || "Login fehlgeschlagen.";
    errEl.classList.remove("hidden");
    return;
  }

  authToken = data.token;
  localStorage.setItem("wp_token", authToken);
  currentUser = data.user;
  updateRoleUI();
  await recalculateQuote();

  if (currentUser.role === "admin") {
    await loadAdminOverview();
  } else {
    closeAdminModal();
  }
}

async function logoutUser() {
  if (authToken) {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` }
    });
  }
  authToken = null;
  localStorage.removeItem("wp_token");
  currentUser = { id: "guest", username: "gast", role: "staff", label: "Mitarbeiter", canDiscount: false, maxDiscount: 0 };
  updateRoleUI();
  await recalculateQuote();
  document.getElementById("admin-login-panel").classList.remove("hidden");
  document.getElementById("admin-dashboard-panel").classList.add("hidden");
}

async function loadAdminOverview() {
  const res = await fetch("/api/admin/overview", {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  if (!res.ok) return;
  adminOverview = await res.json();

  document.getElementById("admin-login-panel").classList.add("hidden");
  document.getElementById("admin-dashboard-panel").classList.remove("hidden");

  document.getElementById("kpi-items").textContent = String(adminOverview.metrics.itemCount);
  document.getElementById("kpi-vk").textContent = formatMoney(adminOverview.metrics.totalSellCatalog);
  document.getElementById("kpi-ek").textContent = formatMoney(adminOverview.metrics.totalBuyCatalog);
  document.getElementById("kpi-margin").textContent = formatMoney(adminOverview.metrics.totalMarginCatalog);

  document.getElementById("cfg-discount-enabled").checked = Boolean(adminOverview.discountConfig.enabled);
  document.getElementById("cfg-discount-max").value = String(adminOverview.discountConfig.maxDiscountPercent);

  const usersContainer = document.getElementById("admin-users-list");
  usersContainer.innerHTML = adminOverview.users
    .map(
      (u) => `
      <div class="flex flex-wrap items-center justify-between gap-2 bg-[#1e1f24] border border-[#2d3039] rounded p-2.5">
        <div>
          <strong class="text-white">${u.username}</strong> <span class="text-zinc-400">(${u.role})</span>
        </div>
        <div class="flex items-center gap-2">
          <label class="flex items-center gap-1">
            <input type="checkbox" ${u.canDiscount ? "checked" : ""} onchange="updateUserPerm('${u.id}', this.checked, null)" />
            Rabatt
          </label>
          <input type="number" min="0" max="100" value="${u.maxDiscount}" onchange="updateUserPerm('${u.id}', null, this.value)"
            class="w-16 px-2 py-1 rounded bg-[#141518] border border-[#2d3039] text-white" />
          <span>%</span>
        </div>
      </div>
    `
    )
    .join("");

  const tbody = document.getElementById("admin-items-tbody");
  tbody.innerHTML = adminOverview.items
    .map((item) => {
      const margin = Number(item.sellPrice) - Number(item.buyPrice);
      return `
        <tr>
          <td class="p-2.5 font-semibold text-white">${item.name}</td>
          <td class="p-2.5 text-zinc-400">${item.group} / ${item.subCategory || ""}</td>
          <td class="p-2.5">
            <input type="number" value="${item.sellPrice}" id="vk-${item.id}" class="w-24 px-2 py-1 rounded bg-[#1e1f24] border border-[#2d3039] text-white" />
          </td>
          <td class="p-2.5">
            <input type="number" value="${item.buyPrice}" id="ek-${item.id}" class="w-24 px-2 py-1 rounded bg-[#1e1f24] border border-[#2d3039] text-white" />
          </td>
          <td class="p-2.5 font-bold ${margin >= 0 ? "text-emerald-400" : "text-red-400"}">${formatMoney(margin)}</td>
          <td class="p-2.5 space-x-1.5">
            <button onclick="saveAdminItemPrice('${item.id}')" class="px-2.5 py-1 rounded bg-white text-zinc-950 font-bold">Speichern</button>
            <button onclick="deleteAdminItem('${item.id}')" class="px-2.5 py-1 rounded bg-red-500/20 text-red-300 border border-red-500/40 font-bold">Löschen</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function saveDiscountConfig() {
  const enabled = document.getElementById("cfg-discount-enabled").checked;
  const maxDiscountPercent = Number(document.getElementById("cfg-discount-max").value || 0);
  await fetch("/api/admin/discount-config", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ enabled, maxDiscountPercent })
  });
  await loadCatalog();
  await loadAdminOverview();
}

async function updateUserPerm(userId, canDiscount, maxDiscount) {
  const payload = {};
  if (canDiscount !== null) payload.canDiscount = canDiscount;
  if (maxDiscount !== null) payload.maxDiscount = Number(maxDiscount);
  await fetch(`/api/admin/users/${userId}/permissions`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    body: JSON.stringify(payload)
  });
  await checkSession();
  await loadAdminOverview();
}

async function createAdminItem() {
  const payload = {
    name: document.getElementById("new-item-name").value,
    group: document.getElementById("new-item-group").value,
    subCategory: document.getElementById("new-item-sub").value,
    sellPrice: Number(document.getElementById("new-item-sell").value || 0),
    buyPrice: Number(document.getElementById("new-item-buy").value || 0)
  };
  const res = await fetch("/api/admin/items", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    body: JSON.stringify(payload)
  });
  if (res.ok) {
    document.getElementById("new-item-name").value = "";
    await loadCatalog();
    await loadAdminOverview();
    renderFilterPills();
    renderCatalog();
  }
}

async function saveAdminItemPrice(id) {
  const sellPrice = Number(document.getElementById(`vk-${id}`).value || 0);
  const buyPrice = Number(document.getElementById(`ek-${id}`).value || 0);
  await fetch(`/api/admin/items/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ sellPrice, buyPrice })
  });
  await loadAdminOverview();
  await recalculateQuote();
}

async function deleteAdminItem(id) {
  await fetch(`/api/admin/items/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${authToken}` }
  });
  selectedMap.delete(id);
  await loadCatalog();
  await loadAdminOverview();
  renderCatalog();
  await recalculateQuote();
}

initApp();
