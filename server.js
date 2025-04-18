const express = require("express");
const app = express();
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const fetch = require("node-fetch");
const axios = require("axios");
const { parse } = require("json2csv");
const fs = require("fs");
const { google } = require("googleapis");

require("dotenv").config();

const PORT = process.env.PORT || 3000;

// Middleware
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

function requireLogin(req, res, next) {
  if (req.session.loggedIn) return next();
  res.redirect("/login");
}

// Routes
app.get("/", (req, res) => {
  res.redirect("/login");
});

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
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

app.get("/dashboard", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "views/dashboard.html"));
});

// SQLite DB setup
const db = new sqlite3.Database("./analytics.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS behavior (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scroll_depth INTEGER,
      clicks INTEGER,
      time_on_page INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  db.run(`
    CREATE TABLE IF NOT EXISTS user_behavior (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT,
      type TEXT,
      value TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT,
      product_id TEXT,
      product_name TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Google Analytics API for traffic data
app.get("/api/traffic", requireLogin, async (req, res) => {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, "pilgrims-pages-1d3f856f222d.json"),
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });

    const analytics = google.analyticsreporting({
      version: "v4",
      auth: await auth.getClient(),
    });

    const response = await analytics.reports.batchGet({
      requestBody: {
        reportRequests: [
          {
            viewId: process.env.GA_VIEW_ID || "486157365",
            dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
            metrics: [{ expression: "ga:sessions" }],
            dimensions: [
              { name: "ga:country" },
              { name: "ga:deviceCategory" },
              { name: "ga:source" }
            ]
          }
        ]
      }
    });

    const geo = {};
    const devices = {};
    const referrals = {};
    const rows = response.data.reports[0].data.rows || [];

    rows.forEach(row => {
      const [country, device, source] = row.dimensions;
      const count = parseInt(row.metrics[0].values[0]);

      geo[country] = (geo[country] || 0) + count;
      devices[device] = (devices[device] || 0) + count;
      referrals[source] = (referrals[source] || 0) + count;
    });

    res.json({ geo, devices, referrals });
  } catch (err) {
    console.error("Failed to fetch traffic data:", err);
    res.status(500).send("Error fetching traffic data");
  }
});

// Shoppy API orders (secured via env var)
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

// Export JSON
app.get("/export/orders/json", requireLogin, (req, res) => {
  db.all("SELECT email, product_id, product_name, timestamp FROM orders", [], (err, rows) => {
    if (err) return res.status(500).send("Error exporting JSON orders");
    res.json(rows);
  });
});

// Export CSV
app.get("/export/orders/csv", requireLogin, (req, res) => {
  db.all("SELECT email, product_id, product_name, timestamp FROM orders", [], (err, rows) => {
    if (err) return res.status(500).send("Error exporting CSV");
    try {
      const csv = parse(rows);
      res.header("Content-Type", "text/csv");
      res.attachment("orders.csv");
      res.send(csv);
    } catch (err) {
      res.status(500).send("Failed to generate CSV");
    }
  });
});

// Telegram Notifications
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function sendTelegramNotification(text) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    return console.warn("Telegram token or chat ID not set.");
  }
  return axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    chat_id: TELEGRAM_CHAT_ID,
    text,
  }).catch(err => {
    console.error("Failed to send Telegram message:", err.message);
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
