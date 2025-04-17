
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const basicAuth = require("basic-auth");
const path = require("path");
const fs = require("fs");

const app = express();
const dbFile = "./analytics.db";
const db = new sqlite3.Database(dbFile);

// Middleware
app.use(bodyParser.json());
app.use(express.static("public"));

// Basic auth credentials
const USERNAME = "admin";
const PASSWORD = "pilgram123";

// Create tables if not exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product TEXT,
    type TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    product_id TEXT,
    product_name TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Track analytics event
app.post("/analytics", (req, res) => {
  const { product, type } = req.body;
  db.run("INSERT INTO page_views (product, type) VALUES (?, ?)", [product, type]);
  res.sendStatus(200);
});

// Shoppy webhook
app.post("/webhook", (req, res) => {
  const { email, product_id, product_name } = req.body;
  db.run(
    "INSERT INTO orders (email, product_id, product_name) VALUES (?, ?, ?)",
    [email, product_id, product_name]
  );
  res.sendStatus(200);
});

// Admin auth middleware
function auth(req, res, next) {
  const user = basicAuth(req);
  if (user && user.name === USERNAME && user.pass === PASSWORD) {
    return next();
  } else {
    res.set("WWW-Authenticate", 'Basic realm="Dashboard"');
    return res.status(401).send("Authentication required.");
  }
}

// Admin dashboard
app.get("/dashboard", auth, (req, res) => {
  res.sendFile(path.join(__dirname, "public/dashboard.html"));
});

// Get data for dashboard
app.get("/api/data", auth, (req, res) => {
  const stats = {};
  db.all("SELECT product, type, COUNT(*) as count FROM page_views GROUP BY product, type", [], (err, views) => {
    stats.views = views || [];
    db.all("SELECT * FROM orders ORDER BY timestamp DESC", [], (err, orders) => {
      stats.orders = orders || [];
      res.json(stats);
    });
  });
});

const crypto = require('crypto');

app.post('/shoppy-webhook', express.json(), (req, res) => {
  const secret = process.env.SHOPPY_WEBHOOK_SECRET; // Add this in .env
  const signature = req.headers['x-shoppy-signature'];

  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha512', secret)
    .update(payload)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.log('Invalid webhook signature');
    return res.status(401).send('Unauthorized');
  }

  console.log('✅ Valid Shoppy webhook received:', req.body);

  // Save or process the order (example: log to file)
  const logLine = `[${new Date().toISOString()}] ${req.body.product_title} purchased by ${req.body.email} for $${req.body.price}\n`;

  fs.appendFile('sales_log.txt', logLine, err => {
    if (err) console.error('Failed to log webhook:', err);
  });

  res.status(200).send('OK');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
