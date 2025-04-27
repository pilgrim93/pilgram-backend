// Updated server.js
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

// Your hardcoded credentials (replace with your actual credentials)
const ADMIN_USERNAME = 'admin';  // Replace with your username
const ADMIN_PASSWORD = 'password123';  // Replace with your password

// Setup for Google API credentials if using GOOGLE_SERVICE_ACCOUNT_KEY
if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  const keyPath = path.join(__dirname, 'service-account.json');
  fs.writeFileSync(keyPath, process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
}

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Login route
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // Check credentials
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.loggedIn = true;
    res.redirect('/dashboard.html');
  } else {
    res.redirect('/login.html?error=invalid');
  }
});

// Logout route
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      res.status(500).json({ success: false });
    } else {
      res.json({ success: true });
    }
  });
});

// Root route
app.get('/', (req, res) => {
  if (req.session && req.session.loggedIn) {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
  } else {
    res.redirect('/login.html');
  }
});

// Protected routes middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.loggedIn) {
    next();
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
}

// Apply auth to API endpoints
app.get('/api/sales-data', requireAuth, async (req, res) => {
  try {
    const response = await axios.get('https://shoppy.dev/api/orders', {
      headers: {
        Authorization: `Bearer ${process.env.SHOPPY_API_KEY}`
      }
    });

    const orders = response.data || [];

    const salesData = {};
    orders.forEach(order => {
      const date = new Date(order.created_at).toISOString().split('T')[0];
      salesData[date] = (salesData[date] || 0) + parseFloat(order.price || 0);
    });

    const labels = Object.keys(salesData).sort();
    const data = labels.map(date => salesData[date]);

    res.json({ labels, data });

  } catch (error) {
    console.error('Failed to fetch sales data:', error.response?.data || error.message);
    res.status(500).send('Failed to fetch sales data');
  }
});

app.get('/api/traffic', requireAuth, async (req, res) => {
  try {
    const response = await axios.get('https://shoppy.dev/api/orders', {
      headers: {
        Authorization: `Bearer ${process.env.SHOPPY_API_KEY}`
      }
    });

    const orders = response.data || [];

    const sources = [
      { source: 'Direct', sessions: Math.floor(orders.length * 0.5) },
      { source: 'Referral', sessions: Math.floor(orders.length * 0.3) },
      { source: 'Organic', sessions: Math.floor(orders.length * 0.2) },
    ];

    const sessionCounts = {};
    orders.forEach(order => {
      const date = new Date(order.created_at).toISOString().split('T')[0];
      sessionCounts[date] = (sessionCounts[date] || 0) + 1;
    });

    const sessions = Object.keys(sessionCounts).sort().map(date => ({
      date,
      count: sessionCounts[date]
    }));

    res.json({ sources, sessions });

  } catch (error) {
    console.error('Failed to fetch traffic data:', error.response?.data || error.message);
    res.status(500).send('Failed to fetch traffic data');
  }
});

app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    const response = await axios.get('https://shoppy.dev/api/orders', {
      headers: {
        Authorization: `Bearer ${process.env.SHOPPY_API_KEY}`
      }
    });
    
    const orders = response.data || [];
    
    const formattedOrders = orders.map(order => ({
      id: order.id,
      email: order.email || 'N/A',
      product: order.product?.title || 'Unknown Product',
      price: `$${(order.price || 0).toFixed(2)}`,
      currency: order.currency || 'USD',
      coupon_id: order.coupon_id || 'N/A',
      date: new Date(order.created_at).toISOString().split('T')[0],
      status: order.status || 'Unknown'
    }));
    
    res.json(formattedOrders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.json([]);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});