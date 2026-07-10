// db/index.js
// Local dev: no DATABASE_URL set -> SQLite file, zero config.
// Production: DATABASE_URL set (Render/Railway/Supabase Postgres) -> pg.
// Everything else in the app (routes/*.js) just calls db.all/get/run/
// ensureOnShoppingList and doesn't care which one is active.

module.exports = process.env.DATABASE_URL
  ? require("./postgres")
  : require("./sqlite");
