const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const fetch = require("node-fetch");
require("dotenv").config();

const { google } = require("googleapis");

const app = express();

// Google Analytics fetch function
async function fetchGAViews() {
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
            metrics: [{ expression: "ga:pageviews" }],
            dimensions: [{ name: "ga:date" }],
          },
        ],
      },
    });

    const rows = response.data.reports[0].data.rows || [];
    return rows.map((row) => ({
      date: row.dimensions[0],
      views: parseInt(row.metrics[0].values[0]),
    }));
  } catch (err) {
    console.error("Google Analytics fetch error:", err);
    return [];
  }
}

const db = new sqlite3.Database("./analytics.db");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("public"));

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

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

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
  req.session.destroy();
  res.redirect("/login");
});

app.get("/dashboard", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "views/dashboard.html"));
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

const { parse } = require("json2csv");

app.get("/export/orders", requireLogin, (req, res) => {
  db.all("SELECT * FROM orders", [], (err, rows) => {
    if (err) return res.status(500).send("Error exporting orders");

    const fields = ["email", "product_id", "product_name", "timestamp"];
    const opts = { fields };
    const csv = parse(rows, opts);

    res.header("Content-Type", "text/csv");
    res.attachment("orders.csv");
    res.send(csv);
  });
});

app.get("/api/data", requireLogin, async (req, res) => {
  const stats = {};
  db.all(
    "SELECT product, type, COUNT(*) as count FROM page_views GROUP BY product, type",
    [],
    (err, views) => {
      stats.views = views || [];
      db.all("SELECT * FROM orders ORDER BY timestamp DESC", [], async (err, orders) => {
        stats.orders = orders || [];
        stats.pageViews = await fetchGAViews();
        res.json(stats);
      });
    }
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
