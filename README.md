# Stocked — Week 1 + Week 2 + Week 3 + Week 4 Build

**Week 1** (Foundation & Inventory): a working local app with a real
database, a CRUD API, and a frontend that's actually wired to it.

**Week 2** (The Brains): the "What Can I Make?" recipe engine and the smart
shopping list, both live in the Cook Tonight and List tabs.

**Week 3** (Polish, Mobile, Deployment): an edit modal, toasts, a loading
skeleton, and pantry search; a thorough mobile responsiveness pass; and the
app is now deployable, including the SQLite → Postgres swap for production.

**Week 4** (Real recipe API): Cook Tonight can now run on live Spoonacular
data instead of the hardcoded 12-recipe list — recipe images included —
while still working with zero config if you don't set up a key.

## What's here

```
stocked-app/
├── backend/
│   ├── db/
│   │   ├── index.js              # Picks sqlite.js or postgres.js based on DATABASE_URL
│   │   ├── sqlite.js              # Local dev database (better-sqlite3)
│   │   └── postgres.js           # Production database (pg), same interface as sqlite.js
│   ├── recipes/
│   │   ├── index.js              # Picks hardcoded.js or spoonacular.js based on SPOONACULAR_API_KEY
│   │   ├── hardcoded.js           # Option A: the Week 2 12-recipe list (zero config)
│   │   ├── spoonacular.js        # Option B: live Spoonacular API (Week 4)
│   │   └── data.js               # The hardcoded recipe list itself
│   ├── server.js                 # Express app entry point
│   ├── routes/pantry.js          # GET / POST / PATCH / DELETE for inventory
│   ├── routes/recipes.js         # GET /suggestions, POST /cook
│   ├── routes/shoppingList.js    # GET / POST / PATCH / DELETE for the shopping list
│   ├── .env.example              # Copy to .env; PORT / DATABASE_URL / ALLOWED_ORIGIN / SPOONACULAR_API_KEY
│   ├── render.yaml                # One-click Render blueprint
│   ├── Procfile                  # For Railway/Heroku-style hosts
│   └── package.json
└── frontend/
    ├── index.html         # Pantry dashboard + Cook Tonight + Shopping List tabs, edit modal
    ├── app.js             # Fetches from the API, renders all three tabs, toasts, search
    ├── config.js          # API_BASE — the only thing you edit to point at a deployed backend
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
You should see `Stocked API running at http://localhost:4000 (db: sqlite)`.
No `.env` file is needed for local dev — leaving `DATABASE_URL` unset is what
tells it to use SQLite. See `.env.example` if you want to set a custom
`PORT`, or [Deploying it](#deploying-it) below for production config.

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

**Milestone 3 (polish + mobile):**
1. Click the pencil icon on any jar — the edit modal should open pre-filled;
   change a value and save, and the jar should update immediately.
2. Add, edit, cook, or check off an item — a small toast should confirm the
   action instead of just silently refreshing.
3. Type into the pantry search box — the shelves should filter live by name.
4. Reload the page on a fresh load — you should briefly see pulsing
   placeholder jars before the real data appears.
5. Open the app on a phone (or shrink your browser to ~375px wide) — the
   quick-add form should stack into a single column, buttons should be easy
   to tap, and nothing should scroll horizontally.

If all of that checks out, Week 3 is done.

## Deploying it

The app is split into two independently deployable pieces:

**Backend → Render (or Railway)**
1. Push this repo to GitHub if you haven't already.
2. On Render: **New → Blueprint**, point it at the repo — it'll read
   `backend/render.yaml` and provision the service automatically. (Railway
   users can skip the blueprint and just set the root directory to
   `backend`; it reads `Procfile`.)
3. Add a Postgres database (Render: **New → PostgreSQL**, free tier is
   fine) and copy its connection string into the `DATABASE_URL` env var on
   the backend service. This is what switches the app from SQLite to
   Postgres — `backend/db/index.js` picks the right adapter automatically,
   no code changes needed.
4. Once deployed, note the backend's public URL
   (e.g. `https://stocked-backend.onrender.com`).

**Frontend → Vercel or Netlify**
1. Deploy the `frontend/` folder as a static site (no build command needed).
2. Edit `frontend/config.js` and set `API_BASE` to your backend's URL from
   above, with `/api` on the end — e.g.
   `"https://stocked-backend.onrender.com/api"`. Commit and redeploy.
3. Back on the backend, set `ALLOWED_ORIGIN` to your frontend's URL (e.g.
   `https://stocked.vercel.app`) so CORS only allows that origin in
   production.

Local dev is unaffected by any of this — with `DATABASE_URL` and
`ALLOWED_ORIGIN` unset, the backend defaults straight back to SQLite and
open CORS.

## Using the real recipe API (Week 4)

Cook Tonight runs on the hardcoded 12-recipe list by default — nothing to
configure. To switch it over to live Spoonacular data:

1. Get a free API key at [spoonacular.com/food-api](https://spoonacular.com/food-api).
2. Add it to `backend/.env`:
   ```
   SPOONACULAR_API_KEY=your-key-here
   ```
3. Restart the backend. The startup log will say
   `(db: sqlite, recipes: spoonacular)` instead of `recipes: hardcoded`.

`backend/recipes/index.js` is what switches between them, and it's the only
thing that has to — `routes/recipes.js` and the frontend don't know or care
which source is active. Both return the same shape:
`{ name, image, ingredients: [{name, have}], haveCount, total, fullMatch }`.

A few things worth knowing about the Spoonacular path:
- It uses the `findByIngredients` endpoint, which is built for exactly this
  "what can I make with what I have" use case — it returns
  `usedIngredients`/`missedIngredients` per recipe already computed, so no
  extra per-recipe lookups are needed.
- Suggestions are cached in memory for 2 minutes per unique pantry
  contents, so flipping between tabs doesn't burn through your daily quota.
  Free-tier quotas are modest — check
  [spoonacular.com/food-api/pricing](https://spoonacular.com/food-api/pricing)
  for current numbers before relying on it for a real household.
- Cooking a Spoonacular recipe sends the ingredient breakdown the frontend
  already has back to the server, instead of re-fetching it — one API call
  per recipe view, not two.

**Sanity check:** with a key set, open **Cook Tonight** — recipes should now
show a thumbnail image and come from Spoonacular's much larger database
instead of the fixed 12. Cooking one should still decrement your pantry and
queue missing ingredients exactly like before.

## Notes on what's intentionally deferred

- **Recipe matching** on both sources is still exact-name string matching
  against your pantry item names, and doesn't understand quantities needed
  per recipe (e.g. "2 eggs" vs "6 eggs") or ingredient substitutions.
- **Auth/Users** table was skipped per the brief; every request currently
  operates on one shared pantry and one shared shopping list. This is the
  main thing that'd need to change before this could support more than one
  household — every table would need a `user_id`, and the frontend would
  need a login step.
- **Recipe search/filtering** on the Cook Tonight tab wasn't added — with a
  10-result Spoonacular page there's less need than there might eventually
  be, but it's a natural follow-up.
