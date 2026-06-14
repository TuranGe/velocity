import jwt from 'jsonwebtoken';
import { query } from './db.js';

// Fail hard if no secret is configured — no silent fallback to a
// well-known dev value, which would let anyone forge tokens in prod.
const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error('\n[FATAL] JWT_SECRET environment variable is not set.');
  console.error('Set it in your .env file before starting the server.\n');
  process.exit(1);
}

// Access token: short-lived (7 days). Refresh token: long-lived (30 days),
// stored only in the response so the client can persist it.
export function signToken(user) {
  if (!user?.id) throw new Error('Cannot sign token: user not found');
  return jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: '7d' });
}

export function signRefreshToken(user) {
  if (!user?.id) throw new Error('Cannot sign refresh token: user not found');
  return jwt.sign({ id: user.id, type: 'refresh' }, SECRET, { expiresIn: '30d' });
}

export function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(h.slice(7), SECRET);
    // Reject refresh tokens used as access tokens
    if (payload.type === 'refresh') return res.status(401).json({ error: 'Invalid token type' });
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function optionalAuth(req, res, next) {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(h.slice(7), SECRET);
      if (payload.type !== 'refresh') req.user = payload;
    } catch {}
  }
  next();
}

export function teamRole(req, res, next) {
  const { teamId } = req.params;
  const member = query('SELECT role FROM team_members WHERE team_id=? AND user_id=?', [teamId, req.user.id])[0];
  if (!member) return res.status(403).json({ error: 'Not a team member' });
  req.teamRole = member.role;
  next();
}

export function cleanUsername(u) {
  return u?.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
}