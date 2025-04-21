const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const axios = require("axios");
require("dotenv").config();
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

// 🔐 Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || "pilgram_secret",
  resave: false,
  saveUninitialized: true
}));

// 📦 Middleware
app.use("/public", express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "public")));
app.use("/styles", express.static(path.join(__dirname, "styles")));
app.use("/views", express.static(path.join(__dirname, "views")));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// 🛡️ Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  res.redirect("/login");
}

// 🧠 Routes
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'dre') {
    req.session.authenticated = true;
    return res.redirect("/dashboard");
  }
  res.redirect("/login");
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
   res.clearCookie('connect.sid');
   res.sendStatus(200);
  });
});

app.get("/dashboard", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "dashboard.html"));
});

app.get("/reset-login", (req, res) => {
  res.send(`
    <html>
      <head><title>Reset Login</title></head>
      <body style="font-family:sans-serif; text-align:center; padding:50px;">
        <h1>Reset Credentials</h1>
        <p>Default username: <b>admin</b></p>
        <p>Default password: <b>dre</b></p>
        <p>You can change these in <code>server.js</code>.</p>
        <a href="/login" style="color:#00bcd4;">Back to Login</a>
      </body>
    </html>
  `);
});


// 📬 Telegram alert
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


app.post("/webhook/shoppy", async (req, res) => {
  const order = req.body;
  if (req.headers["x-verification-key"] !== process.env.SHOPPY_WEBHOOK_SECRET) {
    return res.status(403).send("Invalid key");
  }
  await sendTelegramNotification(order);
  res.sendStatus(200);
});

// 📊 Google Analytics
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const analyticsDataClient = new BetaAnalyticsDataClient();

app.get("/api/traffic-stats", async (req, res) => {
  try {
    const propertyId = "486157365";
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


app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// --- Dummy Orders ---
app.get('/api/orders', (req, res) => {
  res.json([
    {
      id: 'ORD-001',
      email: 'user1@example.com',
      product: 'CPAP Machine',
      price: '$250.00',
      date: '2025-04-17',
      status: 'Shipped'
    },
    {
      id: 'ORD-002',
      email: 'user2@example.com',
      product: 'Mask Headgear',
      price: '$45.99',
      date: '2025-04-18',
      status: 'Processing'
    }
  ]);
});

// --- Dummy User Activity ---
app.get('/api/user-activity', (req, res) => {
  res.json({
    avgScrollDepth: 62,
    avgTimeOnPage: 95,
    clicksPerSession: 22
  });
});

// --- Dummy Traffic Insights ---
app.get('/api/traffic', (req, res) => {
  res.json({
    geo: { US: 200, CA: 50, UK: 30 },
    device: { Mobile: 180, Desktop: 100, Tablet: 20 },
    referrals: { Google: 120, Facebook: 60, Direct: 30 },
    campaigns: { SpringLaunch: 70, Retargeting: 25 },
    keywords: { 'cpap mask': 80, 'sleep aid': 45 }
  });
});

// --- Dummy Sales Data for Charts ---
app.get('/api/sales-data', (req, res) => {
  res.json({
    labels: ['2025-04-15', '2025-04-16', '2025-04-17', '2025-04-18'],
    data: [10, 22, 17, 25]
  });
});

// 🚀 Launch
app.listen(process.env.PORT || 10000, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://localhost:${process.env.PORT || 10000}`);
});


// 🧠 Behavior tracking endpoint
let userActivityLog = [];

app.post("/api/track-behavior", (req, res) => {
  const { type, value, path } = req.body;
  if (!type || !value || !path) return res.status(400).send("Missing data");

  userActivityLog.push({
    userId: Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
    email: `user${Math.floor(Math.random() * 100)}@example.com`,
    action: type === "click" ? "Clicked" : type === "scroll" ? "Scrolled" : "Time on Page",
    page: path,
    timestamp: new Date().toISOString()
  });

  res.status(200).send("Tracked");
});

// 📊 Endpoint to get user activity log
app.get("/api/user-activity", (req, res) => {
  res.json(userActivityLog.slice(-50)); // Limit to last 50 entries
});

