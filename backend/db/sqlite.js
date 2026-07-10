// db/sqlite.js
// Local development database: a single SQLite file via better-sqlite3.
// All methods are async (even though better-sqlite3 itself is synchronous)
// so routes can call db.all/db.get/db.run the same way regardless of
// whether sqlite.js or postgres.js is active. See db/index.js.

const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "..", "stocked.db");
const raw = new Database(dbPath);

raw.pragma("journal_mode = WAL");
raw.pragma("foreign_keys = ON");

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS PantryItems (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    category        TEXT    NOT NULL DEFAULT 'Other',
    quantity        INTEGER NOT NULL DEFAULT 1,
    unit            TEXT    NOT NULL DEFAULT 'ct',
    expiration_date TEXT,
    low_stock_threshold INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ShoppingListItems (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    source      TEXT    NOT NULL DEFAULT 'manual',
    resolved    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`;

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function init() {
  raw.exec(SCHEMA);

  const { count } = raw.prepare("SELECT COUNT(*) AS count FROM PantryItems").get();
  if (count === 0) {
    const insert = raw.prepare(`
      INSERT INTO PantryItems (name, category, quantity, unit, expiration_date, low_stock_threshold)
      VALUES (@name, @category, @quantity, @unit, @expiration_date, @low_stock_threshold)
    `);
    const seed = [
      { name: "Whole milk", category: "Dairy", quantity: 1, unit: "carton", expiration_date: daysFromNow(2), low_stock_threshold: 1 },
      { name: "Eggs", category: "Dairy", quantity: 6, unit: "ct", expiration_date: daysFromNow(12), low_stock_threshold: 3 },
      { name: "Spaghetti", category: "Grains", quantity: 1, unit: "box", expiration_date: daysFromNow(180), low_stock_threshold: 1 },
    ];
    const insertMany = raw.transaction((rows) => rows.forEach((r) => insert.run(r)));
    insertMany(seed);
  }
}

// SQLite's native placeholder is `?`, which is also what every query in
// routes/ is written with, so no translation is needed here.
async function all(sql, params = []) {
  return raw.prepare(sql).all(...params);
}
async function get(sql, params = []) {
  return raw.prepare(sql).get(...params);
}
async function run(sql, params = []) {
  const info = raw.prepare(sql).run(...params);
  return { lastInsertRowid: info.lastInsertRowid, changes: info.changes };
}

// Called whenever a pantry item's quantity changes. If it's at or below its
// low_stock_threshold, make sure there's an active 'auto' entry for it on
// the shopping list (and don't create duplicates).
async function ensureOnShoppingList(name) {
  const existing = await get(
    `SELECT id FROM ShoppingListItems WHERE lower(name) = lower(?) AND resolved = 0`,
    [name]
  );
  if (!existing) {
    await run(
      `INSERT INTO ShoppingListItems (name, source, resolved) VALUES (?, 'auto', 0)`,
      [name]
    );
  }
}

module.exports = { init, all, get, run, ensureOnShoppingList, kind: "sqlite" };
