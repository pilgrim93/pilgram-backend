const express = require("express");
const app = express(); // ✅ App declared at the top
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const fetch = require("node-fetch");
const PORT = process.env.PORT || 3000;

require("dotenv").config();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "pilgramsecretkey",
    resave: false,
    saveUninitialized: true,
  })
);

// ✅ Middleware to protect routes
function requireLogin(req, res, next) {
  if (req.session.loggedIn) return next();
  res.redirect("/login");
}

// ✅ Redirect root to /dashboard
app.get("/", (req, res) => {
  res.redirect("/dashboard");
});

// ✅ Protected route
app.get("/dashboard", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "views/dashboard.html"));
});

// ✅ Create necessary tables if they don't exist
const db = new sqlite3.Database("./analytics.db");

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
