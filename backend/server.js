import 'dotenv/config';
import express from 'express';
import cors    from 'cors';
import helmet  from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { initDB } from './db.js';
import { optionalAuth } from './middleware.js';
import { query } from './db.js';

import authRoutes        from './routes/auth.js';
import sessionRoutes     from './routes/sessions.js';
import taskRoutes        from './routes/tasks.js';
import teamRoutes        from './routes/teams.js';
import leaderboardRoutes from './routes/leaderboard.js';

const app  = express();
const PORT = process.env.PORT || 3717;

const BOT_API_URL    = process.env.BOT_API_URL    || 'http://localhost:4001';
const BOT_API_SECRET = process.env.BOT_API_SECRET || 'velocity-bot-secret';

// ─── Security headers ─────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow avatar images
}));

// ─── CORS ─────────────────────────────────────────────────────
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:4173'];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, mobile apps, server-to-server)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '8mb' }));

// ─── Rate limiting ────────────────────────────────────────────
// Global: 200 req / 15 min per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Auth endpoints: 20 req / 15 min per IP (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later.' },
});

// Leaderboard: 60 req / min per IP (tab switching can be fast)
const leaderboardLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many leaderboard requests, slow down.' },
});

app.use(globalLimiter);

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth',        authLimiter, authRoutes);
app.use('/api/users',       authRoutes);   // /api/users/:username/profile lives in authRoutes
app.use('/api/sessions',    sessionRoutes);
app.use('/api/tasks',       taskRoutes);
app.use('/api/teams',       teamRoutes);
app.use('/api/leaderboard', leaderboardLimiter, leaderboardRoutes);

// ─── Discord Presence Proxy ──────────────────────────────────
app.get('/api/discord/presence/:discordId', optionalAuth, async (req, res) => {
  const { discordId } = req.params;
  if (!discordId || !/^\d{15,20}$/.test(discordId))
    return res.status(400).json({ error: 'Invalid Discord ID' });
  try {
    const botRes = await fetch(`${BOT_API_URL}/presence/${discordId}`, {
      headers: { 'x-bot-secret': BOT_API_SECRET },
      signal: AbortSignal.timeout(3000),
    });
    if (!botRes.ok) return res.json({ presence: null });
    const data = await botRes.json();
    res.json({ presence: data.presence || null });
  } catch {
    res.json({ presence: null });
  }
});

// ─── Health ──────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ ok: true, version: '2.0', time: new Date().toISOString() }));

// ─── Error handling ──────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[API error]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ─── Start ───────────────────────────────────────────────────
await initDB();
app.listen(PORT, () => console.log(`\n🚀 Velocity API v2.0 → http://localhost:${PORT}\n`));