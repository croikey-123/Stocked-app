// routes/pantry.js
// CRUD endpoints for PantryItems, matching the Week 1 spec:
//   GET    /api/pantry      -> fetch all items
//   POST   /api/pantry      -> add an item
//   DELETE /api/pantry/:id  -> remove an item
//
// PATCH /api/pantry/:id is included as a small addition beyond the literal
// Week 1 spec, because a usable inventory needs a way to adjust quantity
// (e.g. "-1" when you use an egg) without deleting and re-adding the row.
// It's what Week 2's low-stock logic hooks into, and what the Week 3 edit
// modal on the frontend uses to update every field at once.

const express = require("express");
const db = require("../db");

const router = express.Router();

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

// GET /api/pantry - list everything, soonest-to-expire first
router.get("/", async (req, res, next) => {
  try {
    const items = await db.all("SELECT * FROM PantryItems ORDER BY expiration_date ASC");
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// POST /api/pantry - add a new item
router.post("/", async (req, res, next) => {
  try {
    const { name, category, quantity, unit, expiration_date, low_stock_threshold } = req.body;

    if (!isNonEmptyString(name)) {
      return res.status(400).json({ error: "'name' is required." });
    }

    const params = [
      name.trim(),
      isNonEmptyString(category) ? category : "Other",
      Number.isFinite(quantity) ? quantity : 1,
      isNonEmptyString(unit) ? unit : "ct",
      isNonEmptyString(expiration_date) ? expiration_date : null,
      Number.isFinite(low_stock_threshold) ? low_stock_threshold : 1,
    ];

    const { lastInsertRowid } = await db.run(
      `INSERT INTO PantryItems (name, category, quantity, unit, expiration_date, low_stock_threshold)
       VALUES (?, ?, ?, ?, ?, ?)`,
      params
    );
    const created = await db.get("SELECT * FROM PantryItems WHERE id = ?", [lastInsertRowid]);

    if (created.quantity <= created.low_stock_threshold) {
      await db.ensureOnShoppingList(created.name);
    }

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/pantry/:id - update quantity (or other fields) on an existing item
router.patch("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await db.get("SELECT * FROM PantryItems WHERE id = ?", [id]);
    if (!existing) return res.status(404).json({ error: "Item not found." });

    const fields = ["name", "category", "quantity", "unit", "expiration_date", "low_stock_threshold"];
    const merged = { ...existing };
    fields.forEach((f) => {
      if (req.body[f] !== undefined) merged[f] = req.body[f];
    });

    await db.run(
      `UPDATE PantryItems
       SET name = ?, category = ?, quantity = ?, unit = ?, expiration_date = ?, low_stock_threshold = ?
       WHERE id = ?`,
      [merged.name, merged.category, merged.quantity, merged.unit, merged.expiration_date, merged.low_stock_threshold, id]
    );

    const updated = await db.get("SELECT * FROM PantryItems WHERE id = ?", [id]);

    // Week 2: if this update dropped quantity to/below the threshold,
    // make sure it's on the shopping list.
    if (updated.quantity <= updated.low_stock_threshold) {
      await db.ensureOnShoppingList(updated.name);
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/pantry/:id - remove an item
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await db.get("SELECT * FROM PantryItems WHERE id = ?", [id]);
    if (!existing) return res.status(404).json({ error: "Item not found." });

    await db.run("DELETE FROM PantryItems WHERE id = ?", [id]);
    await db.ensureOnShoppingList(existing.name); // fully out = definitely needs restocking
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
