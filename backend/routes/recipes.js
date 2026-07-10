// routes/recipes.js
// GET /api/recipes/suggestions
// Compares the hardcoded recipe list against whatever's currently in the
// pantry (quantity > 0) and returns recipes ranked by how complete a match
// they are, with each ingredient flagged as have/missing.

const express = require("express");
const db = require("../db");
const RECIPES = require("../recipes");

const router = express.Router();

router.get("/suggestions", async (req, res, next) => {
  try {
    const rows = await db.all("SELECT name FROM PantryItems WHERE quantity > 0");
    const pantryNames = rows.map((r) => r.name.toLowerCase());

    const results = RECIPES.map((recipe) => {
      const ingredients = recipe.ingredients.map((ing) => ({
        name: ing,
        have: pantryNames.includes(ing.toLowerCase()),
      }));
      const haveCount = ingredients.filter((i) => i.have).length;
      return {
        name: recipe.name,
        ingredients,
        haveCount,
        total: ingredients.length,
        fullMatch: haveCount === ingredients.length,
      };
    }).sort((a, b) => (b.haveCount / b.total) - (a.haveCount / a.total));

    res.json(results);
  } catch (err) {
    next(err);
  }
});

// POST /api/recipes/cook  { name: "Garlic Butter Spaghetti" }
// "Cooks" the recipe: for each ingredient you have in stock, decrements
// pantry quantity by 1 (which will surface it on the shopping list via
// PantryItems' own low-stock check if that drops it to/below threshold).
// For anything you don't have, adds it straight to the shopping list.
router.post("/cook", async (req, res, next) => {
  try {
    const { name } = req.body;
    const recipe = RECIPES.find((r) => r.name === name);
    if (!recipe) return res.status(404).json({ error: "Recipe not found." });

    const decremented = [];
    const addedToShoppingList = [];

    for (const ing of recipe.ingredients) {
      const pantryItem = await db.get(
        "SELECT * FROM PantryItems WHERE lower(name) = lower(?)",
        [ing]
      );

      if (pantryItem && pantryItem.quantity > 0) {
        const newQty = pantryItem.quantity - 1;
        await db.run("UPDATE PantryItems SET quantity = ? WHERE id = ?", [newQty, pantryItem.id]);
        if (newQty <= pantryItem.low_stock_threshold) {
          await db.ensureOnShoppingList(pantryItem.name);
        }
        decremented.push({ name: pantryItem.name, newQuantity: newQty });
      } else {
        await db.ensureOnShoppingList(ing);
        addedToShoppingList.push(ing);
      }
    }

    res.json({ recipe: recipe.name, decremented, addedToShoppingList });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
