const express = require('express');
const errorCapture = require('./middleware/errorCapture');   // Phase 2: structured error logging
const errorHandler = require('./middleware/errorHandler');  // Bug B5: 3-param, not recognized
const usersRouter = require('./routes/users');
const productsRouter = require('./routes/products');
const repairsRouter = require('./routes/repairs');
const githubRouter = require('./routes/github');
const settingsRouter = require('./routes/settings');

const app = express();

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── CORS for local frontend ───────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Request logging (stdout — captured by Phase 2) ───────────
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ── Routes ───────────────────────────────────────────────────
app.use('/api/users', usersRouter);
app.use('/api/products', productsRouter);
app.use('/api/repairs', repairsRouter);
app.use('/api/github', githubRouter);
app.use('/api/settings', settingsRouter);

// ── Health check ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.originalUrl} not found` });
});

// ── Phase 2: Error capture (proper 4-param — IS triggered by Express) ──────
// Logs structured JSON then calls next(err) to pass to errorHandler below.
app.use(errorCapture);

// ── Bug B5: broken error handler (3-param — NOT recognized by Express) ──────
app.use(errorHandler);

module.exports = app;
