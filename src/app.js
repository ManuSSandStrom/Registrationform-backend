import express from 'express';
// import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import './db.js';
import { ensureAdmin } from './seedAdmin.js';
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/students.js';
import adminRoutes from './routes/admin.js';
import { auth } from './middleware/auth.js';

const app = express();

// Behind proxies (Render, Vercel)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS
const cors = require("cors");

// If you want to allow all origins:
app.use(cors({
  origin: true,   // Reflect request origin (works like "*", but supports credentials)
  credentials: true
}));


// Body parsing + logging
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// Custom in-place sanitizer for Express 5 (avoid assigning req.query)
function deepSanitize(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const k of Object.keys(obj)) {
    if (k.startsWith('$') || k.includes('.')) {
      delete obj[k];
      continue;
    }
    const v = obj[k];
    if (v && typeof v === 'object') deepSanitize(v);
  }
}
app.use((req, _res, next) => {
  try { deepSanitize(req.body); } catch {}
  try { deepSanitize(req.params); } catch {}
  try { deepSanitize(req.query); } catch {}
  next();
});

// Compression
app.use(compression());

// Static for uploaded files
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(path.resolve(uploadDir)));

// Health/root
app.get('/', (_req, res) => res.json({ ok: true }));
ensureAdmin().catch(console.error);

// Rate limits
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const MAX_REQ = Number(process.env.RATE_LIMIT_MAX || 300);
const globalLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: MAX_REQ,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000),
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX || 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, _res) => {
    try {
      const ip = req.ip || '';
      const email = (req.body?.email || '').toString().toLowerCase().trim();
      return ip + ':' + email;
    } catch {
      return req.ip || 'unknown';
    }
  },
  message: { error: 'Too many login attempts. Please try again later.' },
});

// Provide /api/me for frontend boot
app.get('/api/me', auth, async (req, res) => {
  const { default: getProfile } = await import('./routes/_getMe.js');
  return getProfile(req, res);
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/admin', adminRoutes);

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

export default app;
