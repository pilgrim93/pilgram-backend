import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import axios from "axios";
import { BetaAnalyticsDataClient } from '@google-analytics/data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Shoppy API Configuration
const SHOPPY_API_KEY = process.env.SHOPPY_API_KEY;
const SHOPPY_API_URL = "https://shoppy.gg/api/v1";

// Google Analytics setup
const analyticsDataClient = new BetaAnalyticsDataClient();

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: "keyboardcat",
    resave: false,
    saveUninitialized: true,
  })
);

// Serve dashboard.html directly
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views/dashboard.html"));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(path.dirname(fileURLToPath(import.meta.url)), 'views', 'dashboard.html'));
});

// Helper function for Shoppy API calls
async function callShoppyAPI(endpoint, method = 'GET', data = null) {
  try {
    const response = await axios({
      method,
      url: `${SHOPPY_API_URL}${endpoint}`,
      headers: {
        'Authorization': SHOPPY_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      data: data
    });
    return response.data;
  } catch (error) {
    console.error(`Shoppy API Error (${endpoint}):`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

// Real orders API endpoint
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await callShoppyAPI('/orders');
    
    if (!orders || orders.length === 0) {
      return res.json([]);
    }
    
    // Transform to match your table structure
    const formattedOrders = orders.map(order => ({
      id: order.id,
      email: order.email,
      product: order.product?.title || 'Unknown Product',
      price: `$${order.price?.toFixed(2) || '0.00'}`,
      currency: order.currency || 'USD',
      coupon_id: order.coupon_id || 'N/A',
      date: new Date(order.created_at).toISOString().split('T')[0],
      status: order.status
    }));
    
    res.json(formattedOrders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.json([]);
  }
});

// User activity log
let userActivityLog = [];

// Track user behavior
app.post("/api/track-behavior", (req, res) => {
  const { type, value, path } = req.body;
  if (!type || !value || !path) return res.status(400).send("Missing data");

  userActivityLog.push({
    userId: req.session?.userId || Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
    email: req.session?.email || `user${Math.floor(Math.random() * 100)}@example.com`,
    action: type === "click" ? "Clicked" : type === "scroll" ? "Scrolled" : "Time on Page",
    page: path,
    timestamp: new Date().toISOString()
  });

  res.status(200).send("Tracked");
});

// Get user activity log
app.get("/api/user-activity", (req, res) => {
  res.json(userActivityLog.slice(-50)); // Limit to last 50 entries
});

// Traffic data - combining Google Analytics with Shoppy data
app.get('/api/traffic', async (req, res) => {
  try {
    const propertyId = "486157365";
    const startDate = req.query.start || "7daysAgo";
    const endDate = req.query.end || "today";

    // Get Google Analytics data
    const runReport = async (dimension) => {
      try {
        const [response] = await analyticsDataClient.runReport({
          property: `properties/${propertyId}`,
          dimensions: [{ name: dimension }],
          metrics: [{ name: "sessions" }],
          dateRanges: [{ startDate, endDate }],
          limit: 10
        });
        
        // Convert to key-value format
        const result = {};
        (response.rows || []).forEach(row => {
          result[row.dimensionValues[0].value] = parseInt(row.metricValues[0].value);
        });
        return result;
      } catch (err) {
        console.error(`GA4 API error for ${dimension}:`, err);
        return {};
      }
    };

    // Get Shoppy traffic data if available
    let shoppyTraffic = {};
    try {
      shoppyTraffic = await callShoppyAPI('/analytics/traffic');
    } catch (err) {
      console.log('No Shoppy traffic data available, using GA only');
    }

    // Get data from Google Analytics
    const [geoData, deviceData, referralData] = await Promise.all([
      runReport("country"),
      runReport("deviceCategory"),
      runReport("sessionSource")
    ]);

    // Combine data, prioritizing Shoppy data if available
    const responseData = {
      geo: shoppyTraffic.geo || geoData,
      device: shoppyTraffic.device || deviceData,
      referrals: shoppyTraffic.referrals || referralData,
      campaigns: shoppyTraffic.campaigns || {},
      keywords: shoppyTraffic.keywords || {}
    };

    res.json(responseData);
  } catch (error) {
    console.error('Error fetching traffic data:', error);
    res.json({ geo: {}, device: {}, referrals: {}, campaigns: {}, keywords: {} });
  }
});

// Sales chart data
app.get('/api/sales-data', async (req, res) => {
  try {
    // Try to get data from Shoppy
    const salesData = await callShoppyAPI('/analytics/sales');
    
    if (salesData && salesData.daily) {
      // Format for chart.js
      const labels = Object.keys(salesData.daily);
      const data = labels.map(date => salesData.daily[date].total);
      return res.json({ labels, data });
    }
    
    // Fallback to empty arrays if no data
    res.json({ labels: [], data: [] });
  } catch (error) {
    console.error('Error fetching sales data:', error);
    res.json({ labels: [], data: [] });
  }
});

app.post('/logout', (req, res) => {
  req.session?.destroy(() => {
    res.redirect('/login');
  });
});

// Telegram notification for new orders
async function sendTelegramNotification(order) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.log("Telegram notification skipped - missing configuration");
    return;
  }

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

// Shoppy webhook endpoint
app.post("/webhook/shoppy", async (req, res) => {
  const order = req.body;
  if (req.headers["x-verification-key"] !== process.env.SHOPPY_WEBHOOK_SECRET) {
    return res.status(403).send("Invalid key");
  }
  await sendTelegramNotification(order);
  res.sendStatus(200);
});

// 🚀 Launch
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});