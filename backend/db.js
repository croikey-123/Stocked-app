// db.js
// Sets up a local SQLite database file (stocked.db) and makes sure the
// PantryItems table exists. Runs once when the server boots.

const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "stocked.db");
const db = new Database(dbPath);

// Reasonable defaults for a small local app
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// --- Schema ---
// PantryItems: the single core table for Week 1.
// (Users table intentionally skipped for MVP, per the brief.)
db.exec(`
  CREATE TABLE IF NOT EXISTS PantryItems (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    category        TEXT    NOT NULL DEFAULT 'Other',
    quantity        INTEGER NOT NULL DEFAULT 1,
    unit            TEXT    NOT NULL DEFAULT 'ct',
    expiration_date TEXT,                 -- ISO date string, e.g. 2026-07-10
    low_stock_threshold INTEGER NOT NULL DEFAULT 1,  -- used from Week 2 onward
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// ShoppingListItems: added in Week 2.
// 'source' distinguishes items the system added automatically (low stock)
// from ones the user typed in manually.
db.exec(`
  CREATE TABLE IF NOT EXISTS ShoppingListItems (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    source      TEXT    NOT NULL DEFAULT 'manual',  -- 'manual' | 'auto'
    resolved    INTEGER NOT NULL DEFAULT 0,          -- 0 = still needed, 1 = bought
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// Seed a couple of example rows the very first time the DB is created,
// so GET /api/pantry returns something on first run instead of an empty array.
const { count } = db.prepare("SELECT COUNT(*) AS count FROM PantryItems").get();
if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO PantryItems (name, category, quantity, unit, expiration_date, low_stock_threshold)
    VALUES (@name, @category, @quantity, @unit, @expiration_date, @low_stock_threshold)
  `);
  const seed = [
    { name: "Whole milk", category: "Dairy", quantity: 1, unit: "carton", expiration_date: daysFromNow(2), low_stock_threshold: 1 },
    { name: "Eggs", category: "Dairy", quantity: 6, unit: "ct", expiration_date: daysFromNow(12), low_stock_threshold: 3 },
    { name: "Spaghetti", category: "Grains", quantity: 1, unit: "box", expiration_date: daysFromNow(180), low_stock_threshold: 1 },
  ];
  const insertMany = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
  insertMany(seed);
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Called whenever a pantry item's quantity changes. If it's at or below its
// low_stock_threshold, make sure there's an active 'auto' entry for it on
// the shopping list (and don't create duplicates).
function ensureOnShoppingList(name) {
  const existing = db.prepare(`
    SELECT id FROM ShoppingListItems
    WHERE lower(name) = lower(?) AND resolved = 0
  `).get(name);
  if (!existing) {
    db.prepare(`
      INSERT INTO ShoppingListItems (name, source, resolved)
      VALUES (?, 'auto', 0)
    `).run(name);
  }
}

module.exports = db;
module.exports.ensureOnShoppingList = ensureOnShoppingList;
