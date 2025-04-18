const express = require("express");
const app = express(); // ✅ App declared at the top
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const fetch = require("node-fetch");
const PORT = process.env.PORT || 3000;
// /routes/sales.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

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

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views/login.html"));
});


// ✅ Protected route
app.get("/dashboard", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "views/dashboard.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  // You can replace this with actual user verification logic
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

app.get("/", (req, res) => {
  res.redirect("/login");
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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


router.get('/shoppy-sales', async (req, res) => {
  try {
    const response = await axios.get('https://shoppy.gg/api/v1/orders', {
      headers: {
        Authorization: `Bearer ${process.env.qeSyJMncwCRyR7CR62uL0gub9oc1DQ2sYm31E0WpSf5LELJW2H}`,
      },
    });

    // Filter or format as needed
    const sales = response.data.map((order) => ({
      email: order.email,
      price: parseFloat(order.total),
      product: order.product_title,
      createdAt: order.created_at,
    }));

    res.json({ sales });
  } catch (error) {
    console.error('Shoppy API Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch Shoppy sales' });
  }
});

module.exports = router;

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


