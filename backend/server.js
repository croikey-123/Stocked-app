// server.js
// Entry point. Boots an Express API on http://localhost:4000

const express = require("express");
const cors = require("cors");
const pantryRoutes = require("./routes/pantry");
const recipeRoutes = require("./routes/recipes");
const shoppingListRoutes = require("./routes/shoppingList");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());            // allow the frontend (different origin/port) to call this API
app.use(express.json());    // parse JSON request bodies

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/pantry", pantryRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/shopping-list", shoppingListRoutes);

app.listen(PORT, () => {
  console.log(`Stocked API running at http://localhost:${PORT}`);
});
