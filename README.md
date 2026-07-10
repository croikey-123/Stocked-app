# Stocked — Week 1 + Week 2 Build

**Week 1** (Foundation & Inventory): a working local app with a real
database, a CRUD API, and a frontend that's actually wired to it.

**Week 2** (The Brains): the "What Can I Make?" recipe engine and the smart
shopping list, both live in the Cook Tonight and List tabs.

## What's here

```
stocked-app/
├── backend/
│   ├── db.js                    # SQLite schema (PantryItems + ShoppingListItems) + seed data
│   ├── recipes.js               # Hardcoded recipe database (Option A from the plan)
│   ├── server.js                # Express app entry point
│   ├── routes/pantry.js         # GET / POST / PATCH / DELETE for inventory
│   ├── routes/recipes.js        # GET /suggestions, POST /cook
│   ├── routes/shoppingList.js   # GET / POST / PATCH / DELETE for the shopping list
│   └── package.json
└── frontend/
    ├── index.html         # Pantry dashboard + Cook Tonight + Shopping List tabs
    ├── app.js             # Fetches from the API, renders all three tabs
    └── style.css
```

## Database schema

One table, as scoped for Week 1 (Users table skipped for MVP):

```
PantryItems
├── id                    INTEGER PRIMARY KEY
├── name                  TEXT
├── category              TEXT
├── quantity              INTEGER
├── unit                  TEXT
├── expiration_date       TEXT (ISO date, e.g. "2026-07-10")
├── low_stock_threshold   INTEGER   -- used starting Week 2
└── created_at            TEXT
```

It's SQLite, stored as a single file (`backend/stocked.db`) that gets created
automatically the first time you run the server. Nothing to install or
configure separately.

A second table, added in Week 2:

```
ShoppingListItems
├── id           INTEGER PRIMARY KEY
├── name         TEXT
├── source       TEXT     -- 'auto' (system-added, low stock) | 'manual' (you typed it)
├── resolved     INTEGER  -- 0 = still needed, 1 = bought
└── created_at   TEXT
```

## API endpoints

| Method | Route                     | Does |
|--------|---------------------------|------|
| GET    | `/api/pantry`             | List all pantry items |
| POST   | `/api/pantry`             | Add an item |
| PATCH  | `/api/pantry/:id`         | Update an item (e.g. change quantity) |
| DELETE | `/api/pantry/:id`         | Remove an item |
| GET    | `/api/recipes/suggestions`| Rank recipes by pantry match |
| POST   | `/api/recipes/cook`       | `{ name }` — decrement stock for a recipe, queue missing bits |
| GET    | `/api/shopping-list`      | List all shopping list items (active + resolved) |
| POST   | `/api/shopping-list`      | `{ name }` — add a manual item |
| PATCH  | `/api/shopping-list/:id`  | `{ resolved }` — mark bought/unbought; bought restocks the pantry |
| DELETE | `/api/shopping-list/:id`  | Remove an entry entirely |

### How the pieces connect

- Whenever a pantry item's quantity is created/updated/deleted and lands at
  or below its `low_stock_threshold`, the backend calls `db.ensureOnShoppingList()`,
  which adds a `source: 'auto'` row if one doesn't already exist (no duplicates).
- "Cook this" on a recipe decrements pantry quantity by 1 for every
  ingredient you have, and calls `ensureOnShoppingList()` directly for
  anything you don't — so cooking a recipe you're missing ingredients for
  still gets those onto your list.
- Checking a shopping list item as bought restocks the matching pantry item
  (or creates a new one if it doesn't exist), so "bought milk" turns back
  into real inventory instead of just vanishing.

## Running it locally

You'll need [Node.js](https://nodejs.org) 18+ installed. Two terminals:

**Terminal 1 — backend**
```bash
cd backend
npm install
npm start
```
You should see `Stocked API running at http://localhost:4000`.

**Terminal 2 — frontend**

The frontend is plain HTML/CSS/JS with no build step, but open it through a
local server rather than double-clicking the file, so `fetch()` calls behave
correctly:
```bash
cd frontend
npx serve .
```
Then open the URL it prints (usually `http://localhost:3000`).

## Quick sanity check

**Milestone 1 (inventory):**
1. Open the frontend — 3 seeded items should already be on the shelves.
2. Add "Bananas," refresh the page — it should still be there (real DB, not
   browser memory).
3. Remove an item — it should stay gone after refresh.
4. Stop the backend and refresh — you should get a friendly error message,
   not a blank page.

**Milestone 2 (recipes + shopping list):**
1. Click **Cook Tonight** — you should see recipes ranked by how many
   ingredients you already have, with missing ones in red.
2. Click "Cook this" on a full-match recipe (e.g. Cheesy Scrambled Eggs, if
   you still have eggs/cheese/butter) — go back to **Pantry** and confirm
   those quantities dropped by 1.
3. Click "Cook & add missing to list" on a recipe you're missing something
   for — switch to **List** and confirm the missing ingredient shows up
   there with an "low stock" tag.
4. On the **List** tab, type something manually and add it — it should show
   an "added" tag instead of "low stock."
5. Check an item off the list — switch to **Pantry** and confirm it came
   back into stock.

If all of that checks out, Week 2 is done and Week 3 (polish, mobile
responsiveness, deployment) is next.

## Notes on what's intentionally deferred

- **Recipe matching** is exact-name string matching against a 12-recipe
  hardcoded list (Option A from the plan). It doesn't understand quantities
  needed per recipe (e.g. "2 eggs" vs "6 eggs") or substitutions — swapping
  in a real API (Option B, e.g. Spoonacular) later means only touching
  `backend/recipes.js` and `routes/recipes.js`; the frontend doesn't care
  where the data comes from.
- **Auth/Users** table was skipped per the brief; every request currently
  operates on one shared pantry and one shared shopping list.
- **Deployment** (Days 19-20) isn't done yet — this README covers local dev
  only. The natural path once Week 3 polish is in: push this repo to GitHub,
  deploy `frontend/` to Vercel or Netlify, deploy `backend/` to Render or
  Railway (swapping SQLite for their Postgres add-on, since most free hosts
  don't persist a local file between deploys), and point the frontend's
  `API_BASE` at the live backend URL.
