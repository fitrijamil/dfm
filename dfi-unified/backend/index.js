// DFI System - Backend Server
// Node.js 18 + Express

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const execRoutes = require('./routes/exec');
const officerRoutes = require('./routes/officer');
const seniorRoutes = require('./routes/senior');
const branchRoutes = require('./routes/branch');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ IMPORTANT: Trust proxy for Render / reverse proxy (fixes X-Forwarded-For + rate-limit error)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// ✅ CORS configuration (trim trailing slash to avoid mismatch)
const allowedOrigin = (process.env.FRONTEND_ORIGIN || 'https://dfm-ncd.pages.dev').replace(/\/$/, '');

const corsOptions = {
  origin: allowedOrigin,
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Body parsing (do this before routes)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Rate limiting (global)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Auth rate limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/auth', authLimiter, authRoutes);
app.use('/admin', adminRoutes);
app.use('/exec', execRoutes);
app.use('/officer', officerRoutes);
app.use('/senior', seniorRoutes);
app.use('/branches', branchRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`DFI System Backend running on port ${PORT}`);
});

module.exports = app;
