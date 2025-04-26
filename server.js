import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import axios from "axios";
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import fs from 'fs';

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

// Serve dashboard.html directly - with detailed error reporting
app.get("/", (req, res) => {
  const viewsPath = path.join(__dirname, "public", "views", "dashboard.html");
  const publicPath = path.join(__dirname, "public", "dashboard.html");
  
  console.log(`Attempting to serve dashboard from: ${viewsPath}`);
  
  if (fs.existsSync(viewsPath)) {
    res.sendFile(viewsPath);
  } else if (fs.existsSync(publicPath)) {
    res.sendFile(publicPath);
  } else {
    // Enhanced error message
    const publicDir = path.join(__dirname, "public");
    const viewsDir = path.join(__dirname, "public", "views");
    
    let fileList = "Available files:<br>";
    
    // List files in public directory
    if (fs.existsSync(publicDir)) {
      fileList += "<br>In public directory:<br>";
      fs.readdirSync(publicDir).forEach(file => {
        fileList += `- ${file}<br>`;
      });
    } else {
      fileList += "<br>Public directory not found!<br>";
    }
    
    // List files in views directory
    if (fs.existsSync(viewsDir)) {
      fileList += "<br>In public/views directory:<br>";
      fs.readdirSync(viewsDir).forEach(file => {
        fileList += `- ${file}<br>`;
      });
    } else {
      fileList += "<br>Views directory not found!<br>";
    }
    
    res.status(404).send(`
      <h1>Dashboard Not Found</h1>
      <p>Looking for: ${viewsPath}</p>
      <p>Current directory: ${__dirname}</p>
      <br>
      ${fileList}
      <br>
      <p><a href="/debug/files">Click here to see full file structure</a></p>
    `);
  }
});

// Debug route to check file structure (matches your existing code)
app.get('/debug/files', (req, res) => {
  const fs = require('fs');
  const publicDir = path.join(__dirname, 'public');
  
  try {
    let fileStructure = `<h2>Public Directory Structure:</h2>`;
    fileStructure += `<p>Current directory: ${__dirname}</p>`;
    fileStructure += `<p>Public directory: ${publicDir}</p>`;
    
    if (fs.existsSync(publicDir)) {
      const files = fs.readdirSync(publicDir);
      fileStructure += `<h3>Files in public directory:</h3>`;
      fileStructure += `<pre>${JSON.stringify(files, null, 2)}</pre>`;
      
      if (fs.existsSync(path.join(publicDir, 'views'))) {
        const viewsFiles = fs.readdirSync(path.join(publicDir, 'views'));
        fileStructure += `<h3>Files in views directory:</h3>`;
        fileStructure += `<pre>${JSON.stringify(viewsFiles, null, 2)}</pre>`;
      } else {
        fileStructure += `<p style="color: red;">Views directory not found!</p>`;
      }
    } else {
      fileStructure += `<p style="color: red;">Public directory not found!</p>`;
    }
    
    res.send(fileStructure);
  } catch (err) {
    res.send(`Error reading directory structure: ${err.message}`);
  }
});

// Copy all your other routes here...
// (Keep all your existing API routes as they were)

// 404 handler for debugging
app.use((req, res) => {
  res.status(404).send(`
    <h1>404 - Not Found</h1>
    <p>The requested URL was not found: ${req.url}</p>
    <p>Try visiting:</p>
    <ul>
      <li><a href="/">/</a> - Dashboard</li>
      <li><a href="/debug/files">/debug/files</a> - Check file structure</li>
    </ul>
  `);
});

// 🚀 Launch
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`Current directory: ${__dirname}`);
});