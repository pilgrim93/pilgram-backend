
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const axios = require("axios");
const basicAuth = require("express-basic-auth");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.post("/logout", (req, res) => {
  res.set('WWW-Authenticate', 'Basic realm="Login"');
  return res.status(401).send('Logged out');
});


app.use("/public", express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "public")));
app.use("/styles", express.static(path.join(__dirname, "styles")));
app.use("/views", express.static(path.join(__dirname, "views")));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use("/dashboard", basicAuth({
  users: { "admin": "playyb0yy01" },
  challenge: true,
  unauthorizedResponse: "Access denied"
}));

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "dashboard.html"));
});

// Telegram notification function
async function sendTelegramNotification(order) {
  const message = `🛒 *New Order Received!*

📦 *Product:* ${order.product_title}
💵 *Amount:* $${order.amount}
📧 *Email:* ${order.email}`;
  try {
    await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "Markdown"
    });
    console.log("✅ Telegram message sent.");
  } catch (err) {
    console.error("❌ Failed to send Telegram message:", err.message);
  }
}

// === Shoppy Polling ===
let shoppyOrders = [];

async function fetchShoppyOrders() {
  try {
    const response = await axios.get("https://shoppy.gg/api/v1/orders", {
      headers: {
        Authorization: process.env.SHOPPY_API_KEY
      }
    });

    const newOrders = response.data.filter(o => !shoppyOrders.find(p => p.id === o.id));
    if (newOrders.length) {
      console.log(`🆕 ${newOrders.length} new Shoppy orders detected.`);
    }

    for (const order of newOrders) {
      await sendTelegramNotification(order);
    }

    shoppyOrders = response.data;
  } catch (err) {
    console.error("Error fetching Shoppy orders:", err.message);
  }
}

// Poll every 2 minutes
setInterval(fetchShoppyOrders, 2 * 60 * 1000);
fetchShoppyOrders();

app.get("/api/orders", (req, res) => {
  res.json(shoppyOrders);
});

// Redirect root to dashboard
app.get("/", (req, res) => {
  res.redirect("/dashboard");
});

// === Shoppy Webhook ===
app.post("/webhook/shoppy", async (req, res) => {
  const order = req.body;
  if (req.headers["x-verification-key"] !== process.env.SHOPPY_WEBHOOK_SECRET) {
    return res.status(403).send("Invalid key");
  }

  await sendTelegramNotification(order);
  res.sendStatus(200);
});

// === GA4 Analytics Endpoint ===
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const analyticsDataClient = new BetaAnalyticsDataClient();

app.get("/api/traffic-stats", async (req, res) => {
  try {
    const propertyId = "486157365";

    // 🆕 Get query params or fallback
    const startDate = req.query.start || "7daysAgo";
    const endDate = req.query.end || "today";

    const runReport = async (dimension) => {
      const [response] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dimensions: [{ name: dimension }],
        metrics: [{ name: "sessions" }],
        dateRanges: [{ startDate, endDate }],
        limit: 5
      });

      return (response.rows || []).map(row => ({
        label: row.dimensionValues[0].value,
        value: parseInt(row.metricValues[0].value)
      }));
    };

    const [topCountries, topDevices, topReferrers] = await Promise.all([
      runReport("country"),
      runReport("deviceCategory"),
      runReport("sessionSource")
    ]);

    res.json({ topCountries, topDevices, topReferrers });
  } catch (err) {
    console.error("GA4 API error:", err);
    res.status(500).json({ error: "Failed to fetch traffic stats" });
  }
});


app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
