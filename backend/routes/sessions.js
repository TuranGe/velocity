import { Router } from 'express';
import { randomUUID } from 'crypto';
import { query, run } from '../db.js';
import { auth } from '../middleware.js';

const router = Router();

const VALID_MODES = ['focus', 'short-break', 'long-break', 'custom'];
const MIN_DURATION = 10;    // seconds — ignore accidental sub-10s saves
const MAX_DURATION = 7200;  // 2 hours — hard cap to prevent inflation

router.post('/', auth, (req, res) => {
  const { mode = 'focus', duration } = req.body;

  // Validate mode
  const safeMode = VALID_MODES.includes(mode) ? mode : 'focus';

  // Validate duration — reject inflated/missing values outright
  const dur = Number(duration);
  if (!Number.isFinite(dur) || dur < MIN_DURATION || dur > MAX_DURATION)
    return res.status(400).json({
      error: `duration must be between ${MIN_DURATION} and ${MAX_DURATION} seconds`,
    });

  const id = randomUUID();
  run('INSERT INTO sessions (id, user_id, mode, duration) VALUES (?,?,?,?)', [id, req.user.id, safeMode, Math.floor(dur)]);
  res.json({ id, message: 'Session recorded' });
});

router.get('/me', auth, (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  const sessions = query(
    'SELECT * FROM sessions WHERE user_id=? ORDER BY completed_at DESC LIMIT ? OFFSET ?',
    [req.user.id, +limit, +offset]
  );
  const stats = query(
    `SELECT COUNT(*) as total_sessions, COALESCE(SUM(duration),0) as total_seconds,
     COUNT(CASE WHEN mode='focus' THEN 1 END) as focus_sessions
     FROM sessions WHERE user_id=?`,
    [req.user.id]
  )[0];

  // Daily breakdown — last 7 days (rolling window, oldest first)
  const now = Math.floor(Date.now() / 1000);
  const daily = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = now - (i + 1) * 86400;
    const dayEnd = now - i * 86400;
    const row = query(
      `SELECT COUNT(*) as sessions, COALESCE(SUM(duration),0) as total_seconds
       FROM sessions WHERE user_id=? AND completed_at > ? AND completed_at <= ?`,
      [req.user.id, dayStart, dayEnd]
    )[0];
    daily.push({ day: 6 - i, sessions: row.sessions, total_seconds: row.total_seconds });
  }

  // Current streak (consecutive days with ≥1 session, counting backwards from today)
  let currentStreak = 0;
  for (let i = 0; i <= 365; i++) {
    const dayStart = now - (i + 1) * 86400;
    const dayEnd = now - i * 86400;
    const row = query(
      'SELECT COUNT(*) as c FROM sessions WHERE user_id=? AND completed_at > ? AND completed_at <= ?',
      [req.user.id, dayStart, dayEnd]
    )[0];
    if (row.c > 0) currentStreak++;
    else break;
  }

  res.json({ sessions, stats, daily, currentStreak });
});

// Previous calendar week (Mon-Sun) — used by Monday recap modal/card
router.get('/last-week', auth, (req, res) => {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday));
  const lastMonday = new Date(thisMonday); lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);

  const weekStart = Math.floor(lastMonday.getTime() / 1000);
  const weekEnd = Math.floor(thisMonday.getTime() / 1000);

  const stats = query(
    `SELECT COUNT(*) as total_sessions, COALESCE(SUM(duration),0) as total_seconds
     FROM sessions WHERE user_id=? AND completed_at >= ? AND completed_at < ?`,
    [req.user.id, weekStart, weekEnd]
  )[0];

  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const daily = [];
  for (let i = 0; i < 7; i++) {
    const dayStart = weekStart + i * 86400;
    const row = query(
      `SELECT COUNT(*) as sessions, COALESCE(SUM(duration),0) as total_seconds
       FROM sessions WHERE user_id=? AND completed_at >= ? AND completed_at < ?`,
      [req.user.id, dayStart, dayStart + 86400]
    )[0];
    daily.push({ label: DAY_LABELS[i], sessions: row.sessions, total_seconds: row.total_seconds });
  }

  const tasksCompleted = query(
    'SELECT COUNT(*) as c FROM tasks WHERE user_id=? AND done=1 AND done_at >= ? AND done_at < ?',
    [req.user.id, weekStart, weekEnd]
  )[0].c;

  let streak = 0;
  for (let i = 6; i >= 0; i--) {
    if (daily[i].sessions > 0) streak++;
    else break;
  }

  res.json({ weekStart, weekEnd, stats, daily, tasksCompleted, streak });
});

export default router;