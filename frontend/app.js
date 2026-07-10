// app.js
// Talks to the Stocked API (backend/) over HTTP. No local/in-memory state
// for pantry data anymore — the server + SQLite file are the source of truth.

const API_BASE = "http://localhost:4000/api";
const CATS = ["Dairy","Produce","Meat & Fish","Grains","Canned & Jarred","Frozen","Condiments","Other"];

let pantry = []; // cached copy of what the server returned, refreshed after every change

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
async function loadAndRender(){
  try{
    pantry = await apiGetPantry();
    clearError();
  } catch(err){
    showError(`${err.message} Is the backend running at ${API_BASE}? (cd backend && npm start)`);
    pantry = [];
  }
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

  CATS.forEach(cat => {
    const items = pantry.filter(i => i.category === cat)
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
          <button class="dec">−</button>
          <button class="inc">+</button>
        </div>
        <button class="remove-x" title="Remove">✕</button>
      </div>
    </div>
  `;
  jar.querySelector(".dec").addEventListener("click", async () => {
    const newQty = Math.max(0, item.quantity - 1);
    try{
      if(newQty === 0){
        await apiDeleteItem(item.id);
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
  jar.querySelector(".remove-x").addEventListener("click", async () => {
    try{
      await apiDeleteItem(item.id);
      await loadAndRender();
    } catch(err){ showError(err.message); }
  });
  return jar;
}

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
      low_stock_threshold: 1,
    });
    nameInp.value = "";
    document.getElementById("in-qty").value = 1;
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
      card.querySelector(".cook-btn").addEventListener("click", async () => {
        try{
          await apiCookRecipe(r.name);
          await loadAndRenderRecipes();
          await loadAndRender(); // refresh pantry stats/shelves since quantities changed
        } catch(err){ showError(err.message); }
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
          await apiSetShoppingResolved(item.id, item.resolved ? 0 : 1);
          await loadAndRenderShoppingList();
          await loadAndRender(); // bought items restock the pantry
        } catch(err){ showError(err.message); }
      });
      row.querySelector(".del").addEventListener("click", async () => {
        try{
          await apiDeleteShoppingItem(item.id);
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
    await loadAndRenderShoppingList();
    inp.focus();
  } catch(err){ showError(err.message); }
});
document.getElementById("in-list-item").addEventListener("keydown", e => {
  if(e.key === "Enter") document.getElementById("add-list-btn").click();
});

// ---- init ----
loadAndRender();
