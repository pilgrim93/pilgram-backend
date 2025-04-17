const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const fetch = require("node-fetch");
require("dotenv").config();
const app = express();


app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/login.html'));
});

const db = new sqlite3.Database("./analytics.db");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("public"));

app.use(session({
  secret: process.env.SESSION_SECRET || "pilgramsecretkey",
  resave: false,
  saveUninitialized: true,
}));

function requireLogin(req, res, next) {
  if (req.session.loggedIn) return next();
  res.redirect("/login");
}

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views/login.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "pilgram123") {
    req.session.loggedIn = true;
    res.redirect("/dashboard");
  } else {
    res.send("Login failed. <a href='/login'>Try again</a>");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

app.get("/dashboard", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "views/dashboard.html"));
});

app.get("/api/data", requireLogin, (req, res) => {
  const stats = {};
  db.all("SELECT product, type, COUNT(*) as count FROM page_views GROUP BY product, type", [], (err, views) => {
    stats.views = views || [];
    db.all("SELECT * FROM orders ORDER BY timestamp DESC", [], (err, orders) => {
      stats.orders = orders || [];
      res.json(stats);
    });
  });
});

app.get("/api/shoppy/orders", requireLogin, async (req, res) => {
  try {
    const response = await fetch("https://shoppy.gg/api/v1/orders", {
      headers: {
        Authorization: `Bearer ${process.env.SHOPPY_API_KEY}`,
      },
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Failed to fetch from Shoppy:", err);
    res.status(500).send("Error fetching Shoppy orders");
  }
});

app.post("/shoppy-webhook", (req, res) => {
  const secret = req.headers["x-shoppy-secret"];
  if (secret !== process.env.SHOPPY_WEBHOOK_SECRET) {
    return res.status(403).send("Invalid secret");
  }
  const data = req.body;
  db.run(
    "INSERT INTO orders (email, product_id, product_name) VALUES (?, ?, ?)",
    [data.email, data.product_id || "unknown", data.product_title || "unknown"]
  );
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

