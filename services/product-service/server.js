require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());
app.use(cors());
app.use(morgan('combined'));

// ─── In-memory store ─────────────────────────────────────────────────────────
const products = [
  { id: 1, name: 'Laptop Pro 16',       price: 1999.99, stock: 50,  category: 'Electronics', version: 'v1' },
  { id: 2, name: 'Smartphone Ultra X',  price: 899.99,  stock: 120, category: 'Electronics', version: 'v1' },
  { id: 3, name: 'Wireless Headphones', price: 249.99,  stock: 200, category: 'Audio',        version: 'v1' },
  { id: 4, name: 'USB-C Hub 7-in-1',    price: 49.99,   stock: 500, category: 'Accessories',  version: 'v1' },
  { id: 5, name: 'Mechanical Keyboard', price: 139.99,  stock: 80,  category: 'Peripherals',  version: 'v1' },
  { id: 6, name: '4K Monitor 27"',      price: 549.99,  stock: 35,  category: 'Displays',     version: 'v1' }
];

let nextId = 7;

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET all products
app.get('/products', (req, res) => {
  const { category, minPrice, maxPrice, search } = req.query;
  let result = [...products];

  if (category) result = result.filter(p => p.category === category);
  if (minPrice)  result = result.filter(p => p.price >= parseFloat(minPrice));
  if (maxPrice)  result = result.filter(p => p.price <= parseFloat(maxPrice));
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(p => p.name.toLowerCase().includes(q));
  }

  res.json({
    success: true,
    data: result,
    count: result.length,
    timestamp: new Date().toISOString()
  });
});

// GET single product
app.get('/products/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json({ success: true, data: product });
});

// POST create product
app.post('/products', (req, res) => {
  const { name, price, stock, category } = req.body;
  if (!name || price === undefined || stock === undefined || !category) {
    return res.status(400).json({ error: 'name, price, stock, and category are required' });
  }
  const product = {
    id: nextId++,
    name,
    price: parseFloat(price),
    stock: parseInt(stock),
    category,
    version: 'v1',
    createdAt: new Date().toISOString()
  };
  products.push(product);
  res.status(201).json({ success: true, data: product });
});

// PUT update product
app.put('/products/:id', (req, res) => {
  const index = products.findIndex(p => p.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }
  const { name, price, stock, category } = req.body;
  products[index] = {
    ...products[index],
    ...(name && { name }),
    ...(price !== undefined && { price: parseFloat(price) }),
    ...(stock !== undefined && { stock: parseInt(stock) }),
    ...(category && { category }),
    updatedAt: new Date().toISOString()
  };
  res.json({ success: true, data: products[index] });
});

// PATCH update stock
app.patch('/products/:id/stock', (req, res) => {
  const index = products.findIndex(p => p.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }
  const { quantity } = req.body;
  if (quantity === undefined) {
    return res.status(400).json({ error: 'quantity is required' });
  }
  const newStock = products[index].stock + parseInt(quantity);
  if (newStock < 0) {
    return res.status(400).json({ error: 'Insufficient stock' });
  }
  products[index].stock = newStock;
  res.json({ success: true, data: products[index] });
});

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'product-ok', timestamp: new Date().toISOString(), products: products.length });
});

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, _next) => {
  console.error('[Product Service] Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[Product Service] Running on port ${PORT}`);
});

module.exports = app;
