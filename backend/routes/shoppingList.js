// routes/shoppingList.js
// GET    /api/shopping-list      -> list all (active + resolved)
// POST   /api/shopping-list      -> manually add an item
// PATCH  /api/shopping-list/:id  -> mark bought/unbought (restocks pantry when bought)
// DELETE /api/shopping-list/:id  -> remove an entry entirely

const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", (req, res) => {
  const items = db
    .prepare("SELECT * FROM ShoppingListItems ORDER BY resolved ASC, created_at DESC")
    .all();
  res.json(items);
});

router.post("/", (req, res) => {
  const { name } = req.body;
  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "'name' is required." });
  }
  const info = db.prepare(`
    INSERT INTO ShoppingListItems (name, source, resolved)
    VALUES (?, 'manual', 0)
  `).run(name.trim());
  const created = db.prepare("SELECT * FROM ShoppingListItems WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(created);
});

// Mark bought (resolved = 1) or unbought (resolved = 0).
// When marking bought, restock the matching pantry item (or create it fresh
// with a sensible default) so "bought milk" turns back into pantry inventory
// instead of just disappearing.
router.patch("/:id", (req, res) => {
  const { id } = req.params;
  const { resolved } = req.body;
  const item = db.prepare("SELECT * FROM ShoppingListItems WHERE id = ?").get(id);
  if (!item) return res.status(404).json({ error: "Item not found." });

  db.prepare("UPDATE ShoppingListItems SET resolved = ? WHERE id = ?").run(resolved ? 1 : 0, id);

  if (resolved) {
    const pantryMatch = db.prepare(
      "SELECT * FROM PantryItems WHERE lower(name) = lower(?)"
    ).get(item.name);

    if (pantryMatch) {
      const restockQty = Math.max(1, pantryMatch.low_stock_threshold);
      db.prepare("UPDATE PantryItems SET quantity = quantity + ? WHERE id = ?")
        .run(restockQty, pantryMatch.id);
    } else {
      db.prepare(`
        INSERT INTO PantryItems (name, category, quantity, unit, expiration_date, low_stock_threshold)
        VALUES (?, 'Other', 1, 'ct', NULL, 1)
      `).run(item.name);
    }
  }

  const updated = db.prepare("SELECT * FROM ShoppingListItems WHERE id = ?").get(id);
  res.json(updated);
});

router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const existing = db.prepare("SELECT * FROM ShoppingListItems WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Item not found." });
  db.prepare("DELETE FROM ShoppingListItems WHERE id = ?").run(id);
  res.status(204).send();
});

module.exports = router;
