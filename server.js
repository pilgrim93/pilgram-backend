// Updated server.js
const express = require('express');
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

// Serve dashboard.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true
}));

app.use(express.static('public')); // Assuming your html/css/js are in /public

// Middleware to check authentication
function authMiddleware(req, res, next) {
  if (req.session && req.session.loggedIn) {
    next();
  } else {
    if (req.path === '/login.html' || req.path.startsWith('/api/')) {
      // Allow access to login page and API endpoints
      next();
    } else {
      res.redirect('/login.html');
    }
  }
}

app.use(authMiddleware);


// Example logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});

// Listen
app.listen(3000, () => console.log('Server running'));

// Shoppy Sales Data for Sales Chart
app.get('/api/sales-data', async (req, res) => {
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
