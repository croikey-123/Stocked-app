// server.js
// Entry point. Boots an Express API on http://localhost:4000 locally, or
// on process.env.PORT wherever it's deployed.

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const db = require("./db");
const pantryRoutes = require("./routes/pantry");
const recipeRoutes = require("./routes/recipes");
const shoppingListRoutes = require("./routes/shoppingList");

const app = express();
const PORT = process.env.PORT || 4000;

// Locally, ALLOWED_ORIGIN is unset and CORS is wide open, matching the old
// behavior. In production, set it to your deployed frontend's URL (e.g.
// https://stocked.vercel.app) so only that origin can call the API.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;
app.use(cors(ALLOWED_ORIGIN ? { origin: ALLOWED_ORIGIN } : {}));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true, db: db.kind }));
app.use("/api/pantry", pantryRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/shopping-list", shoppingListRoutes);

// Centralized error handler: any route that calls next(err) (e.g. a DB
// query that throws) ends up here instead of hanging or crashing the process.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Stocked API running at http://localhost:${PORT} (db: ${db.kind})`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize the database:", err);
    process.exit(1);
  });
