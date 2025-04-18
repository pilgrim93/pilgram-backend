const express = require("express");
const app = express(); // This MUST be above any use of `app`
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const sqlite3 = require("sqlite3").verbose(); // ✅ this should be here
const fetch = require("node-fetch");
const PORT = process.env.PORT || 3000;

require("dotenv").config();
app.use(express.static(path.join(__dirname, "public")));
// (unchanged) ... all the way until:
const db = new sqlite3.Database("./analytics.db");

app.get("/", (req, res) => {
  res.redirect("/dashboard");
});

app.get("/dashboard", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "views/dashboard.html"));
});

// ✅ Create necessary tables if they don't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS behavior (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scroll_depth INTEGER,
      clicks INTEGER,
      time_on_page INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_behavior (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT,
      type TEXT,
      value TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT,
      product_id TEXT,
      product_name TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
