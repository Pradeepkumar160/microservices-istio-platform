require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use(cors());
app.use(morgan('combined'));

// ─── In-memory store ─────────────────────────────────────────────────────────
const users = [
  { id: 1, name: 'John Doe',      email: 'john@test.com',  role: 'admin', createdAt: '2024-01-01T00:00:00Z' },
  { id: 2, name: 'Alice Smith',   email: 'alice@test.com', role: 'user',  createdAt: '2024-01-02T00:00:00Z' },
  { id: 3, name: 'Bob Johnson',   email: 'bob@test.com',   role: 'user',  createdAt: '2024-01-03T00:00:00Z' },
  { id: 4, name: 'Carol Williams',email: 'carol@test.com', role: 'user',  createdAt: '2024-01-04T00:00:00Z' }
];

let nextId = 5;

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET all users
app.get('/users', (req, res) => {
  const { role, search } = req.query;
  let result = [...users];

  if (role) {
    result = result.filter(u => u.role === role);
  }
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(u =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }

  res.json({
    success: true,
    data: result,
    count: result.length,
    timestamp: new Date().toISOString()
  });
});

// GET single user
app.get('/users/:id', (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ success: true, data: user });
});

// POST create user
app.post('/users', (req, res) => {
  const { name, email, role = 'user' } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  const existing = users.find(u => u.email === email);
  if (existing) {
    return res.status(409).json({ error: 'Email already exists' });
  }
  const user = { id: nextId++, name, email, role, createdAt: new Date().toISOString() };
  users.push(user);
  res.status(201).json({ success: true, data: user });
});

// PUT update user
app.put('/users/:id', (req, res) => {
  const index = users.findIndex(u => u.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  const { name, email, role } = req.body;
  users[index] = { ...users[index], ...(name && { name }), ...(email && { email }), ...(role && { role }) };
  res.json({ success: true, data: users[index] });
});

// DELETE user
app.delete('/users/:id', (req, res) => {
  const index = users.findIndex(u => u.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  users.splice(index, 1);
  res.json({ success: true, message: 'User deleted' });
});

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'user-ok', timestamp: new Date().toISOString(), users: users.length });
});

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, _next) => {
  console.error('[User Service] Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[User Service] Running on port ${PORT}`);
});

module.exports = app;
