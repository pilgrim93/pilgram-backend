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
