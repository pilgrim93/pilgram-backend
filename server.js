// Updated server.js
const express = require('express');
const session = require('express-session'); // Add this import
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

// Setup for Google API credentials if using GOOGLE_SERVICE_ACCOUNT_KEY
if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  const keyPath = path.join(__dirname, 'service-account.json');
  fs.writeFileSync(keyPath, process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware should be before routes
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Middleware to check authentication
function authMiddleware(req, res, next) {
  // Allow access to login page and API endpoints without authentication
  if (req.path === '/login' || 
      req.path === '/login.html' || 
      req.path === '/api/login' || 
      req.path.startsWith('/static/') || 
      req.path.startsWith('/assets/')) {
    return next();
  }
  
  // Check if user is logged in
  if (req.session && req.session.loggedIn) {
    return next();
  }
  
  // Redirect to login page if not logged in
  res.redirect('/login.html');
}

// Apply authentication middleware BEFORE route definitions
app.use(authMiddleware);

// Serve login page
app.get('/', (req, res) => {
  if (req.session && req.session.loggedIn) {
    res.redirect('/dashboard.html');
  } else {
    res.redirect('/login.html');
  }
});

// Serve dashboard page
app.get('/dashboard', (req, res) => {
  if (req.session && req.session.loggedIn) {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
  } else {
    res.redirect('/login.html');
  }
});

// Login API endpoint
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  // Replace with your actual authentication logic
  if (email === 'admin@admin.com' && password === 'admin') {
    req.session.loggedIn = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Logout API endpoint
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

// Shoppy Sales Data for Sales Chart
app.get('/api/sales-data', async (req, res) => {
  // Check authentication
  if (!req.session || !req.session.loggedIn) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
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
      salesData[date] = (salesData[date] || 0) + parseFloat(order.price);
    });

    const labels = Object.keys(salesData).sort();
    const data = labels.map(date => salesData[date]);

    res.json({ labels, data });

  } catch (error) {
    console.error('Failed to fetch sales data:', error.response?.data || error.message);
    res.status(500).send('Failed to fetch sales data');
  }
});

// Shoppy Traffic Data (Simulated)
app.get('/api/traffic', async (req, res) => {
  // Check authentication
  if (!req.session || !req.session.loggedIn) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});