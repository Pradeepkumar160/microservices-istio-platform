require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret-change-in-production';

// Service URLs (use env vars in production)
const AUTH_SERVICE    = process.env.AUTH_SERVICE_URL    || 'http://auth-service:3001';
const USER_SERVICE    = process.env.USER_SERVICE_URL    || 'http://user-service:3002';
const PRODUCT_SERVICE = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3003';
const ORDER_SERVICE   = process.env.ORDER_SERVICE_URL   || 'http://order-service:3004';

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// ─── JWT Auth Middleware ──────────────────────────────────────────────────────
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── Helper: proxy request ───────────────────────────────────────────────────
async function proxyRequest(res, fn) {
  try {
    const response = await fn();
    return res.status(response.status).json(response.data);
  } catch (err) {
    const status = err.response?.status || 503;
    const message = err.response?.data || { error: err.message };
    return res.status(status).json(message);
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'gateway-ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      auth: AUTH_SERVICE,
      user: USER_SERVICE,
      product: PRODUCT_SERVICE,
      order: ORDER_SERVICE
    }
  });
});

// Auth routes (public)
app.post('/auth/login', (req, res) =>
  proxyRequest(res, () => axios.post(`${AUTH_SERVICE}/login`, req.body))
);

app.post('/auth/register', (req, res) =>
  proxyRequest(res, () => axios.post(`${AUTH_SERVICE}/register`, req.body))
);

// User routes (protected)
app.get('/users', authenticate, (req, res) =>
  proxyRequest(res, () => axios.get(`${USER_SERVICE}/users`))
);

app.get('/users/:id', authenticate, (req, res) =>
  proxyRequest(res, () => axios.get(`${USER_SERVICE}/users/${req.params.id}`))
);

// Product routes (public read, protected write)
app.get('/products', (req, res) =>
  proxyRequest(res, () => axios.get(`${PRODUCT_SERVICE}/products`))
);

app.get('/products/:id', (req, res) =>
  proxyRequest(res, () => axios.get(`${PRODUCT_SERVICE}/products/${req.params.id}`))
);

app.post('/products', authenticate, (req, res) =>
  proxyRequest(res, () => axios.post(`${PRODUCT_SERVICE}/products`, req.body))
);

// Order routes (protected)
app.post('/orders', authenticate, (req, res) =>
  proxyRequest(res, () =>
    axios.post(`${ORDER_SERVICE}/orders`, { ...req.body, requestUserId: req.user.id })
  )
);

app.get('/orders', authenticate, (req, res) =>
  proxyRequest(res, () => axios.get(`${ORDER_SERVICE}/orders`))
);

app.get('/orders/:id', authenticate, (req, res) =>
  proxyRequest(res, () => axios.get(`${ORDER_SERVICE}/orders/${req.params.id}`))
);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[API Gateway] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[API Gateway] Running on port ${PORT}`);
});

module.exports = app;
