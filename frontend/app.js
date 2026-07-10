// app.js
// Talks to the Stocked API (backend/) over HTTP. No local/in-memory state
// for pantry data anymore — the server + SQLite/Postgres are the source of
// truth. API_BASE comes from config.js so deploying doesn't require
// touching this file.

const API_BASE = (window.STOCKED_CONFIG && window.STOCKED_CONFIG.API_BASE) || "http://localhost:4000/api";
const CATS = ["Dairy","Produce","Meat & Fish","Grains","Canned & Jarred","Frozen","Condiments","Other"];
const UNITS = ["ct","carton","lb","oz","bag","jar","bottle","box"];

let pantry = []; // cached copy of what the server returned, refreshed after every change
let hasLoadedOnce = false;
let searchTerm = "";

function daysFromNow(n){
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0,10);
}
function daysUntil(dateStr){
  if(!dateStr) return 9999;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.round((d - today) / 86400000);
}
function freshState(dateStr){
  const d = daysUntil(dateStr);
  if(d < 0) return "expired";
  if(d <= 3) return "soon";
  return "fresh";
}
function expiryLabel(dateStr){
  if(!dateStr) return "no date set";
  const d = daysUntil(dateStr);
  if(d < 0) return "expired";
  if(d === 0) return "today";
  if(d === 1) return "1 day left";
  return d + " days left";
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function showError(msg){
  document.getElementById("error-box").innerHTML =
    `<div class="error-note">${escapeHtml(msg)}</div>`;
}
function clearError(){
  document.getElementById("error-box").innerHTML = "";
}

// ---- toasts ----
function showToast(msg, type = "success"){
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 250);
  }, 2600);
}

// ---- API calls ----
async function apiGetPantry(){
  const res = await fetch(`${API_BASE}/pantry`);
  if(!res.ok) throw new Error("Couldn't load pantry from the server.");
  return res.json();
}
async function apiAddItem(item){
  const res = await fetch(`${API_BASE}/pantry`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(item),
  });
  if(!res.ok) throw new Error("Couldn't add that item.");
  return res.json();
}
async function apiUpdateItem(id, fields){
  const res = await fetch(`${API_BASE}/pantry/${id}`, {
    method: "PATCH",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(fields),
  });
  if(!res.ok) throw new Error("Couldn't update that item.");
  return res.json();
}
async function apiDeleteItem(id){
  const res = await fetch(`${API_BASE}/pantry/${id}`, { method: "DELETE" });
  if(!res.ok && res.status !== 204) throw new Error("Couldn't remove that item.");
}

// ---- load + render ----
function skeletonHtml(){
  return `<div class="shelf-group"><div class="shelf">${
    Array(6).fill('<div class="jar skeleton"></div>').join("")
  }</div></div>`;
}

async function loadAndRender(){
  if(!hasLoadedOnce){
    document.getElementById("shelves").innerHTML = skeletonHtml();
  }
  try{
    pantry = await apiGetPantry();
    clearError();
  } catch(err){
    showError(`${err.message} Is the backend running at ${API_BASE}? (cd backend && npm start)`);
    pantry = [];
  }
  hasLoadedOnce = true;
  renderPantry();
}

function renderPantry(){
  const total = pantry.reduce((s,i)=>s+i.quantity,0);
  const soon = pantry.filter(i => ["soon","expired"].includes(freshState(i.expiration_date))).length;
  const low = pantry.filter(i => i.quantity <= i.low_stock_threshold).length;
  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-soon").textContent = soon;
  document.getElementById("stat-low").textContent = low;
  document.getElementById("shelf-count").textContent = pantry.length;

  const wrap = document.getElementById("shelves");
  wrap.innerHTML = "";

  if(pantry.length === 0){
    wrap.innerHTML = '<div class="empty-note">Your pantry is empty, add items below!</div>';
    return;
  }

  const visible = searchTerm
    ? pantry.filter(i => i.name.toLowerCase().includes(searchTerm))
    : pantry;

  if(visible.length === 0){
    wrap.innerHTML = `<div class="empty-note">Nothing matches "${escapeHtml(searchTerm)}".</div>`;
    return;
  }

  CATS.forEach(cat => {
    const items = visible.filter(i => i.category === cat)
      .sort((a,b)=> daysUntil(a.expiration_date) - daysUntil(b.expiration_date));
    if(items.length === 0) return;
    const group = document.createElement("div");
    group.className = "shelf-group";
    group.innerHTML = `<div class="shelf-label">${escapeHtml(cat)}</div>`;
    const shelf = document.createElement("div");
    shelf.className = "shelf";
    items.forEach(item => shelf.appendChild(jarCard(item)));
    group.appendChild(shelf);
    wrap.appendChild(group);
  });
}

function jarCard(item){
  const state = freshState(item.expiration_date);
  const jar = document.createElement("div");
  jar.className = "jar";
  jar.innerHTML = `
    <div class="band ${state}"></div>
    <div class="jar-body">
      <div class="jar-name">${escapeHtml(item.name)}</div>
      <div class="jar-qty">${item.quantity} ${escapeHtml(item.unit)}</div>
      <span class="jar-expiry ${state}">${expiryLabel(item.expiration_date)}</span>
      <div class="jar-controls">
        <div class="steps">
          <button class="dec" title="Decrease">−</button>
          <button class="inc" title="Increase">+</button>
        </div>
        <div class="jar-actions">
          <button class="edit-btn" title="Edit">✎</button>
          <button class="remove-x" title="Remove">✕</button>
        </div>
      </div>
    </div>
  `;
  jar.querySelector(".dec").addEventListener("click", async () => {
    const newQty = Math.max(0, item.quantity - 1);
    try{
      if(newQty === 0){
        await apiDeleteItem(item.id);
        showToast(`${item.name} is out — removed from pantry.`);
      } else {
        await apiUpdateItem(item.id, { quantity: newQty });
      }
      await loadAndRender();
    } catch(err){ showError(err.message); }
  });
  jar.querySelector(".inc").addEventListener("click", async () => {
    try{
      await apiUpdateItem(item.id, { quantity: item.quantity + 1 });
      await loadAndRender();
    } catch(err){ showError(err.message); }
  });
  jar.querySelector(".edit-btn").addEventListener("click", () => openEditModal(item));
  jar.querySelector(".remove-x").addEventListener("click", async () => {
    if(!window.confirm(`Remove ${item.name} from your pantry?`)) return;
    try{
      await apiDeleteItem(item.id);
      showToast(`Removed ${item.name}.`);
      await loadAndRender();
    } catch(err){ showError(err.message); }
  });
  return jar;
}

// ---- pantry search ----
document.getElementById("pantry-search").addEventListener("input", (e) => {
  searchTerm = e.target.value.trim().toLowerCase();
  renderPantry();
});

// ---- quick add form ----
let selectedDays = 30;
document.getElementById("expiry-chips").addEventListener("click", e => {
  if(e.target.classList.contains("chip")){
    document.querySelectorAll(".chip").forEach(c => c.classList.remove("selected"));
    e.target.classList.add("selected");
    selectedDays = parseInt(e.target.dataset.days, 10);
  }
});
document.getElementById("qty-up").addEventListener("click", () => {
  const inp = document.getElementById("in-qty");
  inp.value = Math.max(0, parseInt(inp.value || 0, 10) + 1);
});
document.getElementById("qty-down").addEventListener("click", () => {
  const inp = document.getElementById("in-qty");
  inp.value = Math.max(0, parseInt(inp.value || 0, 10) - 1);
});

const addBtn = document.getElementById("add-item-btn");
addBtn.addEventListener("click", async () => {
  const nameInp = document.getElementById("in-name");
  const name = nameInp.value.trim();
  if(!name){ nameInp.focus(); return; }

  addBtn.disabled = true;
  try{
    await apiAddItem({
      name,
      category: document.getElementById("in-cat").value,
      quantity: Math.max(0, parseInt(document.getElementById("in-qty").value || "1", 10)),
      unit: document.getElementById("in-unit").value,
      expiration_date: daysFromNow(selectedDays),
      low_stock_threshold: Math.max(0, parseInt(document.getElementById("in-threshold").value || "1", 10)),
    });
    nameInp.value = "";
    document.getElementById("in-qty").value = 1;
    document.getElementById("in-threshold").value = 1;
    showToast(`Added ${name} to your pantry.`);
    await loadAndRender();
    nameInp.focus();
  } catch(err){
    showError(err.message);
  } finally {
    addBtn.disabled = false;
  }
});
document.getElementById("in-name").addEventListener("keydown", e => {
  if(e.key === "Enter") addBtn.click();
});

// ---- edit modal ----
function populateSelect(id, options){
  document.getElementById(id).innerHTML = options
    .map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`)
    .join("");
}
populateSelect("edit-cat", CATS);
populateSelect("edit-unit", UNITS);

let editingId = null;
function openEditModal(item){
  editingId = item.id;
  document.getElementById("edit-name").value = item.name;
  document.getElementById("edit-cat").value = item.category;
  document.getElementById("edit-qty").value = item.quantity;
  document.getElementById("edit-unit").value = item.unit;
  document.getElementById("edit-threshold").value = item.low_stock_threshold;
  document.getElementById("edit-expiry").value = item.expiration_date || "";
  document.getElementById("edit-modal").style.display = "flex";
  document.getElementById("edit-name").focus();
}
function closeEditModal(){
  document.getElementById("edit-modal").style.display = "none";
  editingId = null;
}
document.getElementById("edit-cancel").addEventListener("click", closeEditModal);
document.getElementById("edit-modal").addEventListener("click", (e) => {
  if(e.target.id === "edit-modal") closeEditModal();
});
document.addEventListener("keydown", (e) => {
  if(e.key === "Escape" && document.getElementById("edit-modal").style.display !== "none"){
    closeEditModal();
  }
});
document.getElementById("edit-qty-up").addEventListener("click", () => {
  const inp = document.getElementById("edit-qty");
  inp.value = Math.max(0, parseInt(inp.value || 0, 10) + 1);
});
document.getElementById("edit-qty-down").addEventListener("click", () => {
  const inp = document.getElementById("edit-qty");
  inp.value = Math.max(0, parseInt(inp.value || 0, 10) - 1);
});
document.getElementById("edit-save").addEventListener("click", async () => {
  const name = document.getElementById("edit-name").value.trim();
  if(!name){ document.getElementById("edit-name").focus(); return; }

  const saveBtn = document.getElementById("edit-save");
  saveBtn.disabled = true;
  try{
    await apiUpdateItem(editingId, {
      name,
      category: document.getElementById("edit-cat").value,
      quantity: Math.max(0, parseInt(document.getElementById("edit-qty").value || "0", 10)),
      unit: document.getElementById("edit-unit").value,
      low_stock_threshold: Math.max(0, parseInt(document.getElementById("edit-threshold").value || "0", 10)),
      expiration_date: document.getElementById("edit-expiry").value || null,
    });
    closeEditModal();
    showToast(`Updated ${name}.`);
    await loadAndRender();
  } catch(err){
    showError(err.message);
  } finally {
    saveBtn.disabled = false;
  }
});

// ---- tabs ----
const TAB_IDS = ["pantry", "cook", "list"];
document.querySelectorAll("nav.tabs button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("nav.tabs button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    TAB_IDS.forEach(t => {
      document.getElementById(`${t}-tab`).style.display = t === tab ? "" : "none";
    });
    if(tab === "cook") loadAndRenderRecipes();
    if(tab === "list") loadAndRenderShoppingList();
  });
});

// ---- Cook Tonight ----
async function apiGetRecipeSuggestions(){
  const res = await fetch(`${API_BASE}/recipes/suggestions`);
  if(!res.ok) throw new Error("Couldn't load recipe suggestions.");
  return res.json();
}
async function apiCookRecipe(name){
  const res = await fetch(`${API_BASE}/recipes/cook`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ name }),
  });
  if(!res.ok) throw new Error("Couldn't cook that recipe.");
  return res.json();
}

async function loadAndRenderRecipes(){
  const wrap = document.getElementById("recipes");
  try{
    const recipes = await apiGetRecipeSuggestions();
    clearError();
    wrap.innerHTML = "";
    recipes.forEach(r => {
      const full = r.haveCount === r.total;
      const card = document.createElement("div");
      card.className = "recipe";
      const ingHtml = r.ingredients
        .map(ing => `<span class="ing ${ing.have ? "have":"missing"}">${ing.have ? "✓" : "+"} ${escapeHtml(ing.name)}</span>`)
        .join("");
      card.innerHTML = `
        <div class="recipe-top">
          <div class="recipe-name">${escapeHtml(r.name)}</div>
          <div class="match-badge ${full ? "full":"partial"}">${r.haveCount}/${r.total} on hand</div>
        </div>
        <div class="ing-list">${ingHtml}</div>
        <div class="recipe-actions">
          <button class="cook-btn">${full ? "Cook this" : "Cook & add missing to list"}</button>
        </div>
      `;
      const cookBtn = card.querySelector(".cook-btn");
      cookBtn.addEventListener("click", async () => {
        cookBtn.disabled = true;
        try{
          const result = await apiCookRecipe(r.name);
          const missing = result.addedToShoppingList.length;
          showToast(
            missing > 0
              ? `Cooked ${r.name} — ${missing} item${missing === 1 ? "" : "s"} added to your list.`
              : `Cooked ${r.name}.`
          );
          await loadAndRenderRecipes();
          await loadAndRender(); // refresh pantry stats/shelves since quantities changed
        } catch(err){ showError(err.message); }
        finally { cookBtn.disabled = false; }
      });
      wrap.appendChild(card);
    });
  } catch(err){
    showError(`${err.message} Is the backend running at ${API_BASE}?`);
  }
}

// ---- Shopping List ----
async function apiGetShoppingList(){
  const res = await fetch(`${API_BASE}/shopping-list`);
  if(!res.ok) throw new Error("Couldn't load the shopping list.");
  return res.json();
}
async function apiAddShoppingItem(name){
  const res = await fetch(`${API_BASE}/shopping-list`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ name }),
  });
  if(!res.ok) throw new Error("Couldn't add that item.");
  return res.json();
}
async function apiSetShoppingResolved(id, resolved){
  const res = await fetch(`${API_BASE}/shopping-list/${id}`, {
    method: "PATCH",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ resolved }),
  });
  if(!res.ok) throw new Error("Couldn't update that item.");
  return res.json();
}
async function apiDeleteShoppingItem(id){
  const res = await fetch(`${API_BASE}/shopping-list/${id}`, { method: "DELETE" });
  if(!res.ok && res.status !== 204) throw new Error("Couldn't remove that item.");
}

async function loadAndRenderShoppingList(){
  const wrap = document.getElementById("list-items");
  try{
    const items = await apiGetShoppingList();
    clearError();
    const active = items.filter(i => !i.resolved);
    document.getElementById("list-count").textContent = active.length;

    wrap.innerHTML = "";
    if(items.length === 0){
      wrap.innerHTML = '<div class="empty-note">Nothing on your list. Items land here automatically when your pantry runs low.</div>';
      return;
    }
    const sorted = [...items].sort((a,b) => a.resolved - b.resolved);
    sorted.forEach(item => {
      const row = document.createElement("div");
      row.className = "list-row" + (item.source === "auto" ? " auto" : "");
      row.innerHTML = `
        <div class="check ${item.resolved ? "checked":""}">${item.resolved ? "✓":""}</div>
        <div class="txt" style="${item.resolved ? "text-decoration:line-through;opacity:0.5;":""}">${escapeHtml(item.name)}</div>
        <span class="src">${item.source === "auto" ? "low stock":"added"}</span>
        <button class="del">✕</button>
      `;
      row.querySelector(".check").addEventListener("click", async () => {
        try{
          const nowResolved = item.resolved ? 0 : 1;
          await apiSetShoppingResolved(item.id, nowResolved);
          showToast(nowResolved ? `Bought ${item.name} — back in your pantry.` : `Moved ${item.name} back to your list.`);
          await loadAndRenderShoppingList();
          await loadAndRender(); // bought items restock the pantry
        } catch(err){ showError(err.message); }
      });
      row.querySelector(".del").addEventListener("click", async () => {
        try{
          await apiDeleteShoppingItem(item.id);
          showToast(`Removed ${item.name} from your list.`);
          await loadAndRenderShoppingList();
        } catch(err){ showError(err.message); }
      });
      wrap.appendChild(row);
    });
  } catch(err){
    showError(`${err.message} Is the backend running at ${API_BASE}?`);
  }
}

document.getElementById("add-list-btn").addEventListener("click", async () => {
  const inp = document.getElementById("in-list-item");
  const val = inp.value.trim();
  if(!val){ inp.focus(); return; }
  try{
    await apiAddShoppingItem(val);
    inp.value = "";
    showToast(`Added ${val} to your list.`);
    await loadAndRenderShoppingList();
    inp.focus();
  } catch(err){ showError(err.message); }
});
document.getElementById("in-list-item").addEventListener("keydown", e => {
  if(e.key === "Enter") document.getElementById("add-list-btn").click();
});

// ---- init ----
loadAndRender();
