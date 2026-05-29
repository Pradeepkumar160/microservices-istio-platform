require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());
app.use(cors());
app.use(morgan('combined'));

// ─── In-memory notification log ───────────────────────────────────────────────
const notifications = [];
let nextId = 1;

// Notification types
const NOTIFICATION_TYPES = [
  'ORDER_CREATED',
  'ORDER_STATUS_CHANGED',
  'USER_REGISTERED',
  'SYSTEM_ALERT',
  'GENERAL'
];

// ─── Routes ──────────────────────────────────────────────────────────────────

// POST send notification
app.post('/notify', (req, res) => {
  const { type = 'GENERAL', message, orderId, userId, ...extra } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const notification = {
    id: nextId++,
    type: NOTIFICATION_TYPES.includes(type) ? type : 'GENERAL',
    message,
    orderId: orderId || null,
    userId: userId || null,
    extra,
    status: 'sent',
    timestamp: new Date().toISOString()
  };

  notifications.push(notification);

  // Simulate channel dispatch
  console.log(`[Notification Service] [${notification.type}] ${message}`);
  if (userId)  console.log(`  → User: ${userId}`);
  if (orderId) console.log(`  → Order: ${orderId}`);

  res.status(201).json({ success: true, notificationId: notification.id });
});

// POST bulk notifications
app.post('/notify/bulk', (req, res) => {
  const { notifications: items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'notifications array is required' });
  }

  const results = items.map(item => {
    const n = {
      id: nextId++,
      type: item.type || 'GENERAL',
      message: item.message || 'No message',
      orderId: item.orderId || null,
      userId: item.userId || null,
      status: 'sent',
      timestamp: new Date().toISOString()
    };
    notifications.push(n);
    console.log(`[Notification Service] [BULK] [${n.type}] ${n.message}`);
    return { id: n.id, status: 'sent' };
  });

  res.status(201).json({ success: true, results });
});

// GET all notifications
app.get('/notifications', (req, res) => {
  const { userId, type, limit = 50 } = req.query;
  let result = [...notifications];

  if (userId) result = result.filter(n => n.userId == userId);
  if (type)   result = result.filter(n => n.type === type);

  // Most recent first
  result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  result = result.slice(0, parseInt(limit));

  res.json({
    success: true,
    data: result,
    count: result.length,
    timestamp: new Date().toISOString()
  });
});

// GET single notification
app.get('/notifications/:id', (req, res) => {
  const n = notifications.find(n => n.id === parseInt(req.params.id));
  if (!n) return res.status(404).json({ error: 'Notification not found' });
  res.json({ success: true, data: n });
});

// GET supported types
app.get('/types', (req, res) => {
  res.json({ success: true, data: NOTIFICATION_TYPES });
});

// Health
app.get('/health', (req, res) => {
  res.json({
    status: 'notification-ok',
    timestamp: new Date().toISOString(),
    totalNotifications: notifications.length
  });
});

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, _next) => {
  console.error('[Notification Service] Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[Notification Service] Running on port ${PORT}`);
});

module.exports = app;
