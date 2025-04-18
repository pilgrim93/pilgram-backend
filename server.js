const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const axios = require("axios");
const basicAuth = require("express-basic-auth");
const fs = require("fs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, "public")));
app.use("/styles", express.static(path.join(__dirname, "styles")));
app.use("/views", express.static(path.join(__dirname, "views")));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// ✅ Basic auth middleware
app.use("/dashboard", basicAuth({
  users: { "admin": "playyb0yy01" },
  challenge: true,
  unauthorizedResponse: "Access denied"
}));

// ✅ Serve the dashboard
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "dashboard.html"));
});

// ✅ Shoppy polling
let shoppyOrders = [];

async function fetchShoppyOrders() {
  try {
    const response = await axios.get("https://shoppy.gg/api/v1/orders", {
      headers: {
        Authorization: process.env.SHOPPY_API_KEY
      }
    });
    shoppyOrders = response.data;
  } catch (err) {
    console.error("Error fetching Shoppy orders:", err.message);
  }
}

// ✅ Poll every 2 minutes
setInterval(fetchShoppyOrders, 2 * 60 * 1000);
fetchShoppyOrders(); // Fetch once at startup

// ✅ API endpoint to access orders
app.get("/api/orders", (req, res) => {
  res.json(shoppyOrders);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

app.post("/webhook/shoppy", async (req, res) => {
  const order = req.body;

  // Optional: validate token if sent
  if (req.headers["x-verification-key"] !== process.env.SHOPPY_WEBHOOK_SECRET) {
    return res.status(403).send("Invalid key");
  }

  // Send to Telegram
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const message = `🛒 New Order\nProduct: ${order.product_title}\nAmount: $${order.amount}\nEmail: ${order.email}`;

  await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message })
  });

  res.sendStatus(200);
});

// === Google Analytics 4 Traffic Stats Endpoint ===
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const analyticsDataClient = new BetaAnalyticsDataClient();

app.get("/api/traffic-stats", async (req, res) => {
  try {
    const propertyId = "486157365"; // Your GA4 property ID

    const [countryRes] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dimensions: [{ name: "country" }],
      metrics: [{ name: "sessions" }],
      dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
      limit: 5
    });

    const [deviceRes] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "sessions" }],
      dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
      limit: 5
    });

    const [referrerRes] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dimensions: [{ name: "sessionSource" }],
      metrics: [{ name: "sessions" }],
      dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
      limit: 5
    });

    const parseRows = (rows) =>
      rows.map(row => ({ label: row.dimensionValues[0].value, value: parseInt(row.metricValues[0].value) }));

    res.json({
      topCountries: parseRows(countryRes.rows || []),
      topDevices: parseRows(deviceRes.rows || []),
      topReferrers: parseRows(referrerRes.rows || [])
    });

  } catch (err) {
    console.error("GA4 API error:", err);
    res.status(500).json({ error: "Failed to fetch traffic stats" });
  }
});