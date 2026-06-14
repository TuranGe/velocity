import 'dotenv/config';
import express from 'express';
import cors    from 'cors';
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

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '8mb' }));

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/users',       authRoutes);   // /api/users/:username/profile lives in authRoutes
app.use('/api/sessions',    sessionRoutes);
app.use('/api/tasks',       taskRoutes);
app.use('/api/teams',       teamRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

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