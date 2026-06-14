import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { query, run } from '../db.js';
import { signToken, signRefreshToken, auth, optionalAuth, cleanUsername } from '../middleware.js';
import jwt from 'jsonwebtoken';

const router = Router();

const SECRET = process.env.JWT_SECRET;

// Register with email+password
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'username, email and password are required' });

  const name = cleanUsername(username);
  if (name.length < 2) return res.status(400).json({ error: 'Username too short (min 2 chars)' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  if (query('SELECT id FROM users WHERE username=?', [name]).length)
    return res.status(409).json({ error: 'Username already taken' });
  if (query('SELECT id FROM users WHERE email=?', [email.toLowerCase()]).length)
    return res.status(409).json({ error: 'Email already registered' });

  const hash = await bcrypt.hash(password, 10);
  const id = randomUUID();
  run('INSERT INTO users (id, username, email, password, provider) VALUES (?,?,?,?,?)',
    [id, name, email.toLowerCase(), hash, 'local']);

  const user = query('SELECT id,username,email,profile_image,bio,provider,discord_id,created_at FROM users WHERE id=?', [id])[0];
  res.json({ user, token: signToken(user), refreshToken: signRefreshToken(user) });
});

// Login with email+password
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const user = query('SELECT * FROM users WHERE email=?', [email.toLowerCase()])[0];
  if (!user || !user.password) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const safe = { id: user.id, username: user.username, email: user.email, profile_image: user.profile_image, bio: user.bio, provider: user.provider, discord_id: user.discord_id, created_at: user.created_at };
  res.json({ user: safe, token: signToken(safe), refreshToken: signRefreshToken(safe) });
});

// Refresh access token using a valid refresh token
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });
  try {
    const payload = jwt.verify(refreshToken, SECRET);
    if (payload.type !== 'refresh') return res.status(401).json({ error: 'Invalid token type' });
    const user = query('SELECT id,username,email,profile_image,bio,provider,discord_id,created_at FROM users WHERE id=?', [payload.id])[0];
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json({ token: signToken(user), refreshToken: signRefreshToken(user) });
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// OAuth callback (Discord) — frontend sends provider token, we upsert user
router.post('/oauth', async (req, res) => {
  const { provider, provider_id, email, username, profile_image } = req.body;
  if (!provider || !provider_id) return res.status(400).json({ error: 'provider and provider_id required' });

  let user = query('SELECT * FROM users WHERE provider=? AND provider_id=?', [provider, provider_id])[0];
  if (!user && email) user = query('SELECT * FROM users WHERE email=?', [email.toLowerCase()])[0];
  if (!user) {
    const name = cleanUsername(username || `user_${provider_id.slice(0,6)}`);
    const safeName = query('SELECT id FROM users WHERE username=?', [name]).length
      ? name + '_' + Math.random().toString(36).slice(2,5) : name;
    const id = randomUUID();
    const discordId = provider === 'discord' ? provider_id : null;
    run('INSERT INTO users (id, username, email, profile_image, provider, provider_id, discord_id) VALUES (?,?,?,?,?,?,?)',
      [id, safeName, email?.toLowerCase() || null, profile_image || null, provider, provider_id, discordId]);
    user = query('SELECT * FROM users WHERE id=?', [id])[0];
  } else {
    if (profile_image) run('UPDATE users SET profile_image=? WHERE id=?', [profile_image, user.id]);
    if (!user.provider_id) {
      run('UPDATE users SET provider=?, provider_id=? WHERE id=?', [provider, provider_id, user.id]);
      if (provider === 'discord') run('UPDATE users SET discord_id=? WHERE id=?', [provider_id, user.id]);
    }
    user = query('SELECT * FROM users WHERE id=?', [user.id])[0];
  }

  const safe = { id: user.id, username: user.username, email: user.email, profile_image: user.profile_image, bio: user.bio, provider: user.provider, discord_id: user.discord_id || (provider === 'discord' ? provider_id : null), created_at: user.created_at };
  res.json({ user: safe, token: signToken(safe), refreshToken: signRefreshToken(safe) });
});

// Discord OAuth code exchange
router.post('/oauth/discord', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code required' });

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    return res.status(500).json({ error: 'Discord OAuth not configured on server' });

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.DISCORD_REDIRECT || 'http://localhost:5173/auth/discord',
      }),
    });
    if (!tokenRes.ok) return res.status(400).json({ error: 'Failed to exchange Discord code', details: await tokenRes.text() });

    const { access_token } = await tokenRes.json();
    const userRes = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${access_token}` } });
    if (!userRes.ok) return res.status(400).json({ error: 'Failed to fetch Discord user info' });

    const d = await userRes.json();
    res.json({
      provider_id: d.id,
      email: d.email,
      username: d.global_name || d.username,
      profile_image: d.avatar ? `https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}.png` : null,
    });
  } catch (e) {
    res.status(500).json({ error: 'Discord OAuth failed', details: e.message });
  }
});

// Get current user
router.get('/me', auth, (req, res) => {
  const user = query('SELECT id,username,email,profile_image,bio,provider,discord_id,created_at FROM users WHERE id=?', [req.user.id])[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// Update profile
router.patch('/me', auth, async (req, res) => {
  const { username, profile_image, bio, password, currentPassword } = req.body;
  const userId = req.user.id;

  if (username) {
    const name = cleanUsername(username);
    if (name.length < 2) return res.status(400).json({ error: 'Username too short' });
    if (query('SELECT id FROM users WHERE username=? AND id!=?', [name, userId])[0])
      return res.status(409).json({ error: 'Username already taken' });
    run('UPDATE users SET username=? WHERE id=?', [name, userId]);
  }
  if (profile_image !== undefined) run('UPDATE users SET profile_image=? WHERE id=?', [profile_image || null, userId]);
  if (bio !== undefined) run('UPDATE users SET bio=? WHERE id=?', [bio || '', userId]);
  if (password) {
    if (!currentPassword) return res.status(400).json({ error: 'currentPassword required to change password' });
    const u = query('SELECT password FROM users WHERE id=?', [userId])[0];
    if (u?.password && !await bcrypt.compare(currentPassword, u.password))
      return res.status(403).json({ error: 'Current password is incorrect' });
    run('UPDATE users SET password=? WHERE id=?', [await bcrypt.hash(password, 10), userId]);
  }

  const user = query('SELECT id,username,email,profile_image,bio,provider,discord_id,created_at FROM users WHERE id=?', [userId])[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user, token: signToken(user) });
});

// Link OAuth provider
router.post('/link', auth, (req, res) => {
  const { provider, provider_id, discord_id } = req.body;
  if (!provider || !provider_id) return res.status(400).json({ error: 'provider and provider_id required' });
  const userId = req.user.id;
  if (query('SELECT id FROM users WHERE provider_id=? AND id!=?', [provider_id, userId])[0])
    return res.status(409).json({ error: 'This account is already linked to another user' });
  run('UPDATE users SET provider_id=? WHERE id=?', [provider_id, userId]);
  if (provider === 'discord' || discord_id)
    run('UPDATE users SET discord_id=? WHERE id=?', [discord_id || provider_id, userId]);
  const user = query('SELECT id,username,email,profile_image,bio,provider,discord_id,created_at FROM users WHERE id=?', [userId])[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user, token: signToken(user) });
});

// Public profile
router.get('/users/:username/profile', optionalAuth, (req, res) => {
  const user = query('SELECT id,username,profile_image,bio,provider,discord_id,created_at FROM users WHERE username=?', [req.params.username])[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  const stats = query('SELECT COUNT(*) as total_sessions, COALESCE(SUM(duration),0) as total_seconds FROM sessions WHERE user_id=?', [user.id])[0];
  const recentSessions = query('SELECT mode,duration,completed_at FROM sessions WHERE user_id=? ORDER BY completed_at DESC LIMIT 5', [user.id]);
  const teams = query('SELECT t.id,t.name,t.color,t.category FROM teams t JOIN team_members tm ON tm.team_id=t.id WHERE tm.user_id=?', [user.id]);
  res.json({ user, stats, recentSessions, teams });
});

export default router;