// config.js
// Loaded before app.js. Keeps the "no build step" property of this
// frontend intact — deploying just means editing this one value.
//
// Locally: leave as-is, points at your backend running on localhost:4000.
// In production: change API_BASE to your deployed backend's URL, e.g.
//   API_BASE: "https://stocked-backend.onrender.com/api"
window.STOCKED_CONFIG = {
  API_BASE: "http://localhost:4000/api",
};
