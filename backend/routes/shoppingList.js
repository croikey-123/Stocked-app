// routes/shoppingList.js
// GET    /api/shopping-list      -> list all (active + resolved)
// POST   /api/shopping-list      -> manually add an item
// PATCH  /api/shopping-list/:id  -> mark bought/unbought (restocks pantry when bought)
// DELETE /api/shopping-list/:id  -> remove an entry entirely

const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const items = await db.all(
      "SELECT * FROM ShoppingListItems ORDER BY resolved ASC, created_at DESC"
    );
    res.json(items);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { name } = req.body;
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "'name' is required." });
    }
    const { lastInsertRowid } = await db.run(
      `INSERT INTO ShoppingListItems (name, source, resolved) VALUES (?, 'manual', 0)`,
      [name.trim()]
    );
    const created = await db.get("SELECT * FROM ShoppingListItems WHERE id = ?", [lastInsertRowid]);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// Mark bought (resolved = 1) or unbought (resolved = 0).
// When marking bought, restock the matching pantry item (or create it fresh
// with a sensible default) so "bought milk" turns back into pantry inventory
// instead of just disappearing.
router.patch("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resolved } = req.body;
    const item = await db.get("SELECT * FROM ShoppingListItems WHERE id = ?", [id]);
    if (!item) return res.status(404).json({ error: "Item not found." });

    await db.run("UPDATE ShoppingListItems SET resolved = ? WHERE id = ?", [resolved ? 1 : 0, id]);

    if (resolved) {
      const pantryMatch = await db.get(
        "SELECT * FROM PantryItems WHERE lower(name) = lower(?)",
        [item.name]
      );

      if (pantryMatch) {
        const restockQty = Math.max(1, pantryMatch.low_stock_threshold);
        await db.run(
          "UPDATE PantryItems SET quantity = quantity + ? WHERE id = ?",
          [restockQty, pantryMatch.id]
        );
      } else {
        await db.run(
          `INSERT INTO PantryItems (name, category, quantity, unit, expiration_date, low_stock_threshold)
           VALUES (?, 'Other', 1, 'ct', NULL, 1)`,
          [item.name]
        );
      }
    }

    const updated = await db.get("SELECT * FROM ShoppingListItems WHERE id = ?", [id]);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await db.get("SELECT * FROM ShoppingListItems WHERE id = ?", [id]);
    if (!existing) return res.status(404).json({ error: "Item not found." });
    await db.run("DELETE FROM ShoppingListItems WHERE id = ?", [id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
