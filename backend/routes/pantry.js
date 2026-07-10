// routes/pantry.js
// CRUD endpoints for PantryItems, matching the Week 1 spec:
//   GET    /api/pantry      -> fetch all items
//   POST   /api/pantry      -> add an item
//   DELETE /api/pantry/:id  -> remove an item
//
// PATCH /api/pantry/:id is included as a small addition beyond the literal
// Week 1 spec, because a usable inventory needs a way to adjust quantity
// (e.g. "-1" when you use an egg) without deleting and re-adding the row.
// It's what Week 2's low-stock logic will hook into.

const express = require("express");
const db = require("../db");

const router = express.Router();

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

// GET /api/pantry - list everything, soonest-to-expire first
router.get("/", (req, res) => {
  const items = db
    .prepare("SELECT * FROM PantryItems ORDER BY expiration_date ASC")
    .all();
  res.json(items);
});

// POST /api/pantry - add a new item
router.post("/", (req, res) => {
  const { name, category, quantity, unit, expiration_date, low_stock_threshold } = req.body;

  if (!isNonEmptyString(name)) {
    return res.status(400).json({ error: "'name' is required." });
  }

  const stmt = db.prepare(`
    INSERT INTO PantryItems (name, category, quantity, unit, expiration_date, low_stock_threshold)
    VALUES (@name, @category, @quantity, @unit, @expiration_date, @low_stock_threshold)
  `);

  const payload = {
    name: name.trim(),
    category: isNonEmptyString(category) ? category : "Other",
    quantity: Number.isFinite(quantity) ? quantity : 1,
    unit: isNonEmptyString(unit) ? unit : "ct",
    expiration_date: isNonEmptyString(expiration_date) ? expiration_date : null,
    low_stock_threshold: Number.isFinite(low_stock_threshold) ? low_stock_threshold : 1,
  };

  const info = stmt.run(payload);
  const created = db.prepare("SELECT * FROM PantryItems WHERE id = ?").get(info.lastInsertRowid);

  if (created.quantity <= created.low_stock_threshold) {
    db.ensureOnShoppingList(created.name);
  }

  res.status(201).json(created);
});

// PATCH /api/pantry/:id - update quantity (or other fields) on an existing item
router.patch("/:id", (req, res) => {
  const { id } = req.params;
  const existing = db.prepare("SELECT * FROM PantryItems WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Item not found." });

  const fields = ["name", "category", "quantity", "unit", "expiration_date", "low_stock_threshold"];
  const updates = {};
  fields.forEach((f) => {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  });

  const merged = { ...existing, ...updates };
  db.prepare(`
    UPDATE PantryItems
    SET name = @name, category = @category, quantity = @quantity,
        unit = @unit, expiration_date = @expiration_date,
        low_stock_threshold = @low_stock_threshold
    WHERE id = @id
  `).run(merged);

  const updated = db.prepare("SELECT * FROM PantryItems WHERE id = ?").get(id);

  // Week 2: if this update dropped quantity to/below the threshold,
  // make sure it's on the shopping list.
  if (updated.quantity <= updated.low_stock_threshold) {
    db.ensureOnShoppingList(updated.name);
  }

  res.json(updated);
});

// DELETE /api/pantry/:id - remove an item
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const existing = db.prepare("SELECT * FROM PantryItems WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Item not found." });

  db.prepare("DELETE FROM PantryItems WHERE id = ?").run(id);
  db.ensureOnShoppingList(existing.name); // fully out = definitely needs restocking
  res.status(204).send();
});

module.exports = router;
