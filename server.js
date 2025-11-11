const express = require('express');
const { WebSocketServer } = require('ws');

const app = express();

//  Dynamic port for Railway
const PORT = process.env.PORT || 8080;

app.use(express.static('public'));

const server = app.listen(PORT, () => {
  console.log(` HTTP Server running on port ${PORT}`);
});

//  WebSocket server
const wss = new WebSocketServer({ server });

// Track dashboard clients
const dashboards = new Set();

// Optional heartbeat to keep connections alive
setInterval(() => {
  dashboards.forEach(ws => {
    if (ws.readyState === 1) ws.ping();
  });
}, 30000); // every 30 seconds

wss.on('connection', (ws, req) => {
  const clientIP =
    req.headers['x-forwarded-for'] ||
    req.socket.remoteAddress ||
    'unknown';

  console.log(` Client connected from ${clientIP}`);

  let isDashboard = false;

  ws.on('message', (message) => {
    const msgStr = message.toString();

    // Dashboard announces itself
    if (msgStr === 'DASHBOARD_READY') {
      isDashboard = true;
      dashboards.add(ws);
      console.log("📊 Dashboard registered");
      console.log(`📊 Total dashboards: ${dashboards.size}`);
      return;
    }

    // ESP32 data
    console.log("📥 Data from ESP32:", msgStr.substring(0, 100) + "...");

    try {
      const data = JSON.parse(msgStr);

      // Send ONLY to dashboards
      let sent = 0;
      dashboards.forEach((dashboard) => {
        if (dashboard.readyState === 1) {
          dashboard.send(JSON.stringify(data));
          sent++;
        }
      });

      if (sent > 0) {
        console.log(`📤 Sent to ${sent} dashboard(s)`);
      } else {
        console.log(" No dashboards connected");
      }
    } catch (err) {
      console.error(" Invalid JSON from ESP32:", err.message);
    }
  });

  ws.on('close', () => {
    if (isDashboard) {
      dashboards.delete(ws);
      console.log(` Dashboard disconnected → remaining: ${dashboards.size}`);
    } else {
      console.log(" ESP32 disconnected");
    }
  });

  ws.on('error', (err) => {
    console.error(" WebSocket Error:", err.message);
  });
});

console.log("🔌 WebSocket Server ready");
console.log("📁 Serving /public folder");

