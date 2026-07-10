// recipes.js
// Option A from the Week 2 plan: a hardcoded mock recipe database.
// Swappable later for the Spoonacular API (Option B) — the matching logic
// in routes/recipes.js only cares about { name, ingredients[] }, so a real
// API response can be mapped into this same shape.

module.exports = [
  { name: "Garlic Butter Spaghetti", ingredients: ["Spaghetti", "Garlic", "Butter", "Olive oil"] },
  { name: "Simple Tomato Pasta", ingredients: ["Spaghetti", "Canned tomatoes", "Garlic", "Olive oil"] },
  { name: "Baked Chicken & Rice", ingredients: ["Chicken breast", "Rice", "Yellow onion", "Olive oil"] },
  { name: "Cheesy Scrambled Eggs", ingredients: ["Eggs", "Cheddar cheese", "Butter"] },
  { name: "Sautéed Spinach & Garlic", ingredients: ["Spinach", "Garlic", "Olive oil"] },
  { name: "Chicken & Spinach Skillet", ingredients: ["Chicken breast", "Spinach", "Garlic", "Olive oil"] },
  { name: "Classic Grilled Cheese", ingredients: ["Cheddar cheese", "Butter", "Bread"] },
  { name: "Onion & Tomato Rice", ingredients: ["Rice", "Yellow onion", "Canned tomatoes"] },
  { name: "Veggie Fried Rice", ingredients: ["Rice", "Eggs", "Yellow onion", "Olive oil"] },
  { name: "Tomato Garlic Chicken", ingredients: ["Chicken breast", "Canned tomatoes", "Garlic", "Olive oil"] },
  { name: "Egg Fried Noodles", ingredients: ["Spaghetti", "Eggs", "Garlic", "Olive oil"] },
  { name: "Buttered Rice Pilaf", ingredients: ["Rice", "Butter", "Yellow onion"] },
];
