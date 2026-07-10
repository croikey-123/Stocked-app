// db/postgres.js
// Production database: Postgres via `pg`, activated automatically when
// DATABASE_URL is set (e.g. Render/Railway/Supabase connection string).
// Exposes the exact same async interface as db/sqlite.js so routes never
// need to know which one is running underneath. See db/index.js.

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Most managed Postgres hosts (Render, Railway, Supabase) terminate SSL
  // with a self-signed cert chain, so we accept it without full verification.
  ssl: { rejectUnauthorized: false },
});

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS PantryItems (
    id              SERIAL PRIMARY KEY,
    name            TEXT    NOT NULL,
    category        TEXT    NOT NULL DEFAULT 'Other',
    quantity        INTEGER NOT NULL DEFAULT 1,
    unit            TEXT    NOT NULL DEFAULT 'ct',
    expiration_date TEXT,
    low_stock_threshold INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (NOW()::TEXT)
  );

  CREATE TABLE IF NOT EXISTS ShoppingListItems (
    id          SERIAL PRIMARY KEY,
    name        TEXT    NOT NULL,
    source      TEXT    NOT NULL DEFAULT 'manual',
    resolved    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (NOW()::TEXT)
  );
`;
// Note: table/column names are left unquoted on purpose. Postgres folds
// unquoted identifiers to lowercase consistently everywhere they appear
// (schema, routes, this file), so PantryItems / pantryitems always match.

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Every query in routes/ is written with SQLite-style `?` placeholders.
// Postgres needs $1, $2, ... instead, so translate positionally before
// each call rather than rewriting every query twice.
function toPgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function all(sql, params = []) {
  const res = await pool.query(toPgSql(sql), params);
  return res.rows;
}
async function get(sql, params = []) {
  const res = await pool.query(toPgSql(sql), params);
  return res.rows[0];
}
async function run(sql, params = []) {
  // INSERTs need the new row's id back (SQLite gives this for free via
  // lastInsertRowid); Postgres needs an explicit RETURNING id.
  const isInsert = /^\s*INSERT/i.test(sql);
  const finalSql = isInsert && !/RETURNING/i.test(sql) ? `${sql} RETURNING id` : sql;
  const res = await pool.query(toPgSql(finalSql), params);
  return {
    lastInsertRowid: isInsert ? res.rows[0]?.id : undefined,
    changes: res.rowCount,
  };
}

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

async function init() {
  await pool.query(SCHEMA);
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM PantryItems`);
  if (rows[0].count === 0) {
    const seed = [
      ["Whole milk", "Dairy", 1, "carton", daysFromNow(2), 1],
      ["Eggs", "Dairy", 6, "ct", daysFromNow(12), 3],
      ["Spaghetti", "Grains", 1, "box", daysFromNow(180), 1],
    ];
    for (const row of seed) {
      await run(
        `INSERT INTO PantryItems (name, category, quantity, unit, expiration_date, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?)`,
        row
      );
    }
  }
}

module.exports = { init, all, get, run, ensureOnShoppingList, kind: "postgres" };
