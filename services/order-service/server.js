require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3004;
const PRODUCT_SERVICE = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3003';
const NOTIFICATION_SERVICE = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3005';

app.use(express.json());
app.use(cors());
app.use(morgan('combined'));

// ─── In-memory store ─────────────────────────────────────────────────────────
const orders = [];
let nextOrderId = 1;

// ─── Status flow ─────────────────────────────────────────────────────────────
const ORDER_STATUSES = ['created', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

// ─── Routes ──────────────────────────────────────────────────────────────────

// POST create order
app.post('/orders', async (req, res) => {
  const { userId, productId, quantity = 1 } = req.body;

  if (!userId || !productId) {
    return res.status(400).json({ error: 'userId and productId are required' });
  }

  if (quantity < 1) {
    return res.status(400).json({ error: 'Quantity must be at least 1' });
  }

  // Verify product exists and has stock
  let product = null;
  try {
    const productRes = await axios.get(`${PRODUCT_SERVICE}/products/${productId}`, { timeout: 5000 });
    product = productRes.data.data;
    if (product.stock < quantity) {
      return res.status(400).json({ error: `Insufficient stock. Available: ${product.stock}` });
    }
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(404).json({ error: 'Product not found' });
    }
    // If product service is down, proceed (graceful degradation)
    console.warn('[Order Service] Could not verify product, proceeding without stock check');
  }

  const order = {
    id: nextOrderId++,
    userId,
    productId,
    quantity: parseInt(quantity),
    productName: product?.name || `Product #${productId}`,
    unitPrice: product?.price || null,
    totalPrice: product ? product.price * quantity : null,
    status: 'created',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  orders.push(order);

  // Deduct stock (fire-and-forget; don't fail the order if this fails)
  if (product) {
    axios
      .patch(`${PRODUCT_SERVICE}/products/${productId}/stock`, { quantity: -quantity }, { timeout: 5000 })
      .catch(e => console.warn('[Order Service] Stock update failed:', e.message));
  }

  // Send notification (fire-and-forget)
  axios
    .post(`${NOTIFICATION_SERVICE}/notify`, {
      type: 'ORDER_CREATED',
      message: `Order #${order.id} created for user ${userId}`,
      orderId: order.id,
      userId,
      productId,
      quantity
    }, { timeout: 5000 })
    .catch(e => console.warn('[Order Service] Notification failed:', e.message));

  res.status(201).json({ success: true, data: order });
});

// GET all orders
app.get('/orders', (req, res) => {
  const { userId, status } = req.query;
  let result = [...orders];

  if (userId) result = result.filter(o => o.userId == userId);
  if (status) result = result.filter(o => o.status === status);

  res.json({
    success: true,
    data: result,
    count: result.length,
    timestamp: new Date().toISOString()
  });
});

// GET single order
app.get('/orders/:id', (req, res) => {
  const order = orders.find(o => o.id === parseInt(req.params.id));
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json({ success: true, data: order });
});

// PATCH update order status
app.patch('/orders/:id/status', (req, res) => {
  const index = orders.findIndex(o => o.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }
  const { status } = req.body;
  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${ORDER_STATUSES.join(', ')}` });
  }
  orders[index].status = status;
  orders[index].updatedAt = new Date().toISOString();

  // Notify on status change
  axios
    .post(`${NOTIFICATION_SERVICE}/notify`, {
      type: 'ORDER_STATUS_CHANGED',
      message: `Order #${orders[index].id} status changed to ${status}`,
      orderId: orders[index].id,
      userId: orders[index].userId,
      status
    }, { timeout: 5000 })
    .catch(e => console.warn('[Order Service] Notification failed:', e.message));

  res.json({ success: true, data: orders[index] });
});

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'order-ok', timestamp: new Date().toISOString(), orders: orders.length });
});

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, _next) => {
  console.error('[Order Service] Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[Order Service] Running on port ${PORT}`);
});

module.exports = app;
