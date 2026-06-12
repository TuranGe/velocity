import 'dotenv/config';
import express    from 'express';
import cors       from 'cors';
import bcrypt     from 'bcryptjs';
import jwt        from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { initDB, query, run } from './db.js';

const app    = express();
const PORT   = process.env.PORT || 3717;
const SECRET = process.env.JWT_SECRET || 'velocity-dev-secret-change-in-prod';
const BOT_API_URL    = process.env.BOT_API_URL    || 'http://localhost:4001';
const BOT_API_SECRET = process.env.BOT_API_SECRET || 'velocity-bot-secret';

const TEAM_CATEGORIES = ['general','productivity','study','work','gaming','social'];
const MAX_TEAMS_CREATED = 3;
const MAX_TEAMS_JOINED  = 10;

app.use(cors({ origin: '*' }));
app.use(express.json());

// ─── Helpers ────────────────────────────────────────────────

function signToken(user) {
  if (!user?.id) throw new Error('Cannot sign token: user not found');
  return jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: '30d' });
}

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(h.slice(7), SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

function optionalAuth(req, res, next) {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) {
    try { req.user = jwt.verify(h.slice(7), SECRET); } catch {}
  }
  next();
}

function teamRole(req, res, next) {
  const { teamId } = req.params;
  const userId = req.user.id;
  const member = query('SELECT role FROM team_members WHERE team_id=? AND user_id=?', [teamId, userId])[0];
  if (!member) return res.status(403).json({ error: 'Not a team member' });
  req.teamRole = member.role;
  next();
}

function cleanUsername(u) {
  return u?.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

// ─── Auth ────────────────────────────────────────────────────

// Register with email+password
app.post('/api/auth/register', async (req, res) => {
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
  res.json({ user, token: signToken(user) });
});

// Login with email+password
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const user = query('SELECT * FROM users WHERE email=?', [email.toLowerCase()])[0];
  if (!user || !user.password) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const safe = { id: user.id, username: user.username, email: user.email, profile_image: user.profile_image, bio: user.bio, provider: user.provider, discord_id: user.discord_id, created_at: user.created_at };
  res.json({ user: safe, token: signToken(safe) });
});

// OAuth callback (Google / Discord) — frontend sends provider token, we upsert user
// In a real deployment this would verify the OAuth token server-side.
// For now it acts as a trusted claim from the frontend OAuth flow.
app.post('/api/auth/oauth', async (req, res) => {
  const { provider, provider_id, email, username, profile_image } = req.body;
  if (!provider || !provider_id) return res.status(400).json({ error: 'provider and provider_id required' });

  let user = query('SELECT * FROM users WHERE provider=? AND provider_id=?', [provider, provider_id])[0];
  if (!user) {
    if (email) user = query('SELECT * FROM users WHERE email=?', [email.toLowerCase()])[0];
  }
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
    // Update profile_image on every login so it stays fresh
    if (profile_image) run('UPDATE users SET profile_image=? WHERE id=?', [profile_image, user.id]);
    if (!user.provider_id) {
      run('UPDATE users SET provider=?, provider_id=? WHERE id=?', [provider, provider_id, user.id]);
      if (provider === 'discord') run('UPDATE users SET discord_id=? WHERE id=?', [provider_id, user.id]);
    }
    user = query('SELECT * FROM users WHERE id=?', [user.id])[0];
  }

  const safe = { id: user.id, username: user.username, email: user.email, profile_image: user.profile_image, bio: user.bio, provider: user.provider, discord_id: user.discord_id || (provider === 'discord' ? provider_id : null), created_at: user.created_at };
  res.json({ user: safe, token: signToken(safe) });
});

// OAuth Google callback - exchange code for user info
app.post('/api/auth/oauth/google', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code required' });

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri  = process.env.GOOGLE_REDIRECT || 'http://localhost:5173/auth/google';

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Google OAuth not configured on server' });
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.error) {
      return res.status(400).json({ error: 'Failed to exchange Google code', details: tokenData.error_description });
    }

    // Fetch user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = await userRes.json();

    if (!googleUser.id) return res.status(400).json({ error: 'Failed to get Google user info' });

    const provider_id  = googleUser.id;
    const email        = googleUser.email;
    const username     = googleUser.name || googleUser.email?.split('@')[0] || `user_${provider_id.slice(0, 6)}`;
    const profile_image = googleUser.picture || null;

    res.json({ provider_id, email, username, profile_image });
  } catch (e) {
    res.status(500).json({ error: 'Google OAuth failed', details: e.message });
  }
});

// OAuth Discord callback - exchange code for user info
app.post('/api/auth/oauth/discord', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code required' });
  
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Discord OAuth not configured on server' });
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.DISCORD_REDIRECT || 'http://localhost:5173/auth/discord',
      })
    });

    if (!tokenRes.ok) {
      const error = await tokenRes.text();
      return res.status(400).json({ error: 'Failed to exchange Discord code', details: error });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Get user info
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!userRes.ok) {
      return res.status(400).json({ error: 'Failed to fetch Discord user info' });
    }

    const discordUser = await userRes.json();
    const provider_id = discordUser.id;
    const email = discordUser.email;
    const username = discordUser.global_name || discordUser.username;
    const profile_image = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null;

    res.json({ provider_id, email, username, profile_image });
  } catch (e) {
    res.status(500).json({ error: 'Discord OAuth failed', details: e.message });
  }
});

// Get current user
app.get('/api/auth/me', auth, (req, res) => {
  const user = query('SELECT id,username,email,profile_image,bio,provider,discord_id,created_at FROM users WHERE id=?', [req.user.id])[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// Update profile
app.patch('/api/auth/me', auth, async (req, res) => {
  const { username, profile_image, bio, password, currentPassword } = req.body;
  const userId = req.user.id;

  if (username) {
    const name = cleanUsername(username);
    if (name.length < 2) return res.status(400).json({ error: 'Username too short' });
    const conflict = query('SELECT id FROM users WHERE username=? AND id!=?', [name, userId])[0];
    if (conflict) return res.status(409).json({ error: 'Username already taken' });
    run('UPDATE users SET username=? WHERE id=?', [name, userId]);
  }
  if (profile_image !== undefined) run('UPDATE users SET profile_image=? WHERE id=?', [profile_image || null, userId]);
  if (bio !== undefined) run('UPDATE users SET bio=? WHERE id=?', [bio || '', userId]);
  if (password) {
    if (!currentPassword) return res.status(400).json({ error: 'currentPassword required to change password' });
    const u = query('SELECT password FROM users WHERE id=?', [userId])[0];
    if (u?.password) {
      const ok = await bcrypt.compare(currentPassword, u.password);
      if (!ok) return res.status(403).json({ error: 'Current password is incorrect' });
    }
    const hash = await bcrypt.hash(password, 10);
    run('UPDATE users SET password=? WHERE id=?', [hash, userId]);
  }

  const user = query('SELECT id,username,email,profile_image,bio,provider,discord_id,created_at FROM users WHERE id=?', [userId])[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user, token: signToken(user) });
});

// ─── Public Profile ──────────────────────────────────────────

// Link an OAuth provider to an existing account (for email-registered users)
app.post('/api/auth/link', auth, (req, res) => {
  const { provider, provider_id, discord_id } = req.body;
  if (!provider || !provider_id) return res.status(400).json({ error: 'provider and provider_id required' });
  const userId = req.user.id;
  // Ensure provider_id isn't already linked to another account
  const existing = query('SELECT id FROM users WHERE provider_id=? AND id!=?', [provider_id, userId])[0];
  if (existing) return res.status(409).json({ error: 'This account is already linked to another user' });
  run('UPDATE users SET provider_id=? WHERE id=?', [provider_id, userId]);
  if (provider === 'discord' || discord_id) {
    const did = discord_id || provider_id;
    run('UPDATE users SET discord_id=? WHERE id=?', [did, userId]);
  }
  const user = query('SELECT id,username,email,profile_image,bio,provider,discord_id,created_at FROM users WHERE id=?', [userId])[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user, token: signToken(user) });
});

app.get('/api/users/:username/profile', optionalAuth, (req, res) => {
  const user = query('SELECT id,username,profile_image,bio,provider,discord_id,created_at FROM users WHERE username=?', [req.params.username])[0];
  if (!user) return res.status(404).json({ error: 'User not found' });

  const stats = query(`SELECT COUNT(*) as total_sessions, COALESCE(SUM(duration),0) as total_seconds FROM sessions WHERE user_id=?`, [user.id])[0];
  const recentSessions = query('SELECT mode,duration,completed_at FROM sessions WHERE user_id=? ORDER BY completed_at DESC LIMIT 5', [user.id]);
  const teams = query(`SELECT t.id,t.name,t.color,t.category FROM teams t JOIN team_members tm ON tm.team_id=t.id WHERE tm.user_id=?`, [user.id]);

  res.json({ user, stats, recentSessions, teams });
});

// ─── Discord Presence Proxy ─────────────────────────────────

app.get('/api/discord/presence/:discordId', optionalAuth, async (req, res) => {
  const { discordId } = req.params;
  if (!discordId || !/^\d{15,20}$/.test(discordId)) {
    return res.status(400).json({ error: 'Invalid Discord ID' });
  }
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

// ─── Sessions ────────────────────────────────────────────────

app.post('/api/sessions', auth, (req, res) => {
  const { mode = 'focus', duration = 1500 } = req.body;
  const id = randomUUID();
  run('INSERT INTO sessions (id, user_id, mode, duration) VALUES (?,?,?,?)', [id, req.user.id, mode, duration]);
  res.json({ id, message: 'Session recorded' });
});

app.get('/api/sessions/me', auth, (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  const sessions = query('SELECT * FROM sessions WHERE user_id=? ORDER BY completed_at DESC LIMIT ? OFFSET ?',
    [req.user.id, +limit, +offset]);
  const stats = query(`SELECT COUNT(*) as total_sessions, COALESCE(SUM(duration),0) as total_seconds,
    COUNT(CASE WHEN mode='focus' THEN 1 END) as focus_sessions FROM sessions WHERE user_id=?`, [req.user.id])[0];

  // Daily breakdown — last 7 days
  const now = Math.floor(Date.now() / 1000);
  const daily = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = now - (i + 1) * 86400;
    const dayEnd   = now - i * 86400;
    const row = query(
      `SELECT COUNT(*) as sessions, COALESCE(SUM(duration),0) as total_seconds
       FROM sessions WHERE user_id=? AND completed_at >= ? AND completed_at < ?`,
      [req.user.id, dayStart, dayEnd]
    )[0];
    daily.push({ day: 6 - i, sessions: row.sessions, total_seconds: row.total_seconds });
  }

  // Current streak — consecutive days (including today) with at least one session
  let currentStreak = 0;
  for (let i = 0; ; i++) {
    const dayStart = now - (i + 1) * 86400;
    const dayEnd   = now - i * 86400;
    const row = query(
      `SELECT COUNT(*) as c FROM sessions WHERE user_id=? AND completed_at >= ? AND completed_at < ?`,
      [req.user.id, dayStart, dayEnd]
    )[0];
    if (row.c > 0) {
      currentStreak++;
    } else if (i === 0) {
      // No session today yet — don't break the streak, just don't count today
      continue;
    } else {
      break;
    }
    if (currentStreak > 365) break; // safety cap
  }

  res.json({ sessions, stats, daily, currentStreak });
});

// ─── Tasks ───────────────────────────────────────────────────

app.get('/api/tasks', auth, (req, res) => {
  const { type } = req.query; // 'personal' | 'team' | undefined (all)
  let sql = 'SELECT * FROM tasks WHERE user_id=?';
  const params = [req.user.id];
  if (type) { sql += ' AND type=?'; params.push(type); }
  sql += ' ORDER BY created_at DESC';
  res.json({ tasks: query(sql, params) });
});

app.post('/api/tasks', auth, (req, res) => {
  const { text, pomodoros = 1, team_id, type = 'personal' } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });
  if (team_id) {
    const member = query('SELECT role FROM team_members WHERE team_id=? AND user_id=?', [team_id, req.user.id])[0];
    if (!member) return res.status(403).json({ error: 'Not a team member' });
  }
  const id = randomUUID();
  run('INSERT INTO tasks (id, user_id, team_id, text, type, pomodoros) VALUES (?,?,?,?,?,?)',
    [id, req.user.id, team_id || null, text.trim(), type, pomodoros]);
  res.json({ task: query('SELECT * FROM tasks WHERE id=?', [id])[0] });
});

app.patch('/api/tasks/:id', auth, (req, res) => {
  const task = query('SELECT * FROM tasks WHERE id=?', [req.params.id])[0];
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  const { done, spent, text } = req.body;
  if (typeof done === 'boolean') run('UPDATE tasks SET done=?, done_at=? WHERE id=?', [done?1:0, done?Math.floor(Date.now()/1000):null, task.id]);
  if (typeof spent === 'number') run('UPDATE tasks SET spent=? WHERE id=?', [spent, task.id]);
  if (text) run('UPDATE tasks SET text=? WHERE id=?', [text.trim(), task.id]);
  res.json({ task: query('SELECT * FROM tasks WHERE id=?', [task.id])[0] });
});

app.delete('/api/tasks/:id', auth, (req, res) => {
  const task = query('SELECT * FROM tasks WHERE id=?', [req.params.id])[0];
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  run('DELETE FROM tasks WHERE id=?', [req.params.id]);
  res.json({ message: 'Deleted' });
});

// Team tasks (all members can see)
app.get('/api/teams/:teamId/tasks', auth, teamRole, (req, res) => {
  const tasks = query('SELECT t.*, u.username, u.profile_image FROM tasks t JOIN users u ON u.id=t.user_id WHERE t.team_id=? ORDER BY t.created_at DESC', [req.params.teamId]);
  res.json({ tasks });
});

// ─── Leaderboard ─────────────────────────────────────────────

app.get('/api/leaderboard', optionalAuth, (req, res) => {
  const { period = 'alltime', limit = 15, search, offset = 0 } = req.query;
  const now = Math.floor(Date.now() / 1000);
  let timeFilter = '';
  if (period === 'week')  timeFilter = `AND s.completed_at > ${now - 7*86400}`;
  if (period === 'month') timeFilter = `AND s.completed_at > ${now - 30*86400}`;

  // If searching, include ALL users (even 0 sessions)
  const havingFilter = search ? '' : 'HAVING sessions > 0';
  const searchWhere = search ? `WHERE u.username LIKE ?` : '';
  const params = search ? [`%${search}%`] : [];

  const rows = query(`
    SELECT u.id, u.username, u.profile_image,
      COUNT(s.id) as sessions,
      COALESCE(SUM(s.duration),0) as total_seconds
    FROM users u
    LEFT JOIN sessions s ON s.user_id=u.id ${timeFilter}
    ${searchWhere}
    GROUP BY u.id
    ${havingFilter}
    ORDER BY sessions DESC
    LIMIT ? OFFSET ?
  `, [...params, parseInt(limit), parseInt(offset)]);

  // If searching, build rank context from all users with sessions
  let contextRows = [];
  if (search && rows.length > 0) {
    const allRanked = query(`
      SELECT u.id, u.username, u.profile_image, COUNT(s.id) as sessions, COALESCE(SUM(s.duration),0) as total_seconds
      FROM users u LEFT JOIN sessions s ON s.user_id=u.id ${timeFilter}
      GROUP BY u.id HAVING sessions > 0 ORDER BY sessions DESC
    `);
    const idx = allRanked.findIndex(r => r.username?.toLowerCase().includes(search.toLowerCase()));
    if (idx >= 0) {
      const start = Math.max(0, idx - 2);
      const end   = Math.min(allRanked.length, idx + 3);
      contextRows = allRanked.slice(start, end).map((r, i) => ({ ...r, rank: start + i + 1, isMatch: start+i === idx }));
    }
  }

  // Add rank numbers (based on sessions > 0 rankings)
  const allForRank = query(`
    SELECT u.id, COUNT(s.id) as sessions FROM users u
    LEFT JOIN sessions s ON s.user_id=u.id ${timeFilter}
    GROUP BY u.id HAVING sessions > 0 ORDER BY sessions DESC
  `);
  const rankMap = Object.fromEntries(allForRank.map((r, i) => [r.id, i+1]));
  const ranked = rows.map(r => ({ ...r, rank: rankMap[r.id] || null }));

  res.json({ leaderboard: ranked, context: contextRows });
});

// ─── Teams ───────────────────────────────────────────────────

app.get('/api/teams', optionalAuth, (req, res) => {
  const { category, limit, top } = req.query;
  let filter = category ? `WHERE t.category='${category}'` : '';
  const teams = query(`
    SELECT t.*, COUNT(tm.user_id) as member_count, u.username as creator_name
    FROM teams t
    LEFT JOIN team_members tm ON tm.team_id=t.id
    LEFT JOIN users u ON u.id=t.created_by
    ${filter} GROUP BY t.id
    ORDER BY member_count DESC, t.created_at DESC
    ${limit ? `LIMIT ${parseInt(limit)}` : ''}
  `);

  const teamsWithMembers = teams.map(team => {
    const members = query(`
      SELECT u.id, u.username, u.profile_image, tm.role, COUNT(s.id) as sessions
      FROM team_members tm JOIN users u ON u.id=tm.user_id
      LEFT JOIN sessions s ON s.user_id=u.id
      WHERE tm.team_id=? GROUP BY u.id ORDER BY sessions DESC
    `, [team.id]);
    return { ...team, members };
  });

  res.json({ teams: teamsWithMembers });
});

app.get('/api/teams/:teamId', optionalAuth, (req, res) => {
  const team = query(`SELECT t.*, COUNT(tm.user_id) as member_count FROM teams t LEFT JOIN team_members tm ON tm.team_id=t.id WHERE t.id=? GROUP BY t.id`, [req.params.teamId])[0];
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const members = query(`
    SELECT u.id, u.username, u.profile_image, tm.role, COUNT(s.id) as sessions
    FROM team_members tm JOIN users u ON u.id=tm.user_id
    LEFT JOIN sessions s ON s.user_id=u.id
    WHERE tm.team_id=? GROUP BY u.id ORDER BY CASE tm.role WHEN 'leader' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END, sessions DESC
  `, [req.params.teamId]);
  res.json({ team: { ...team, members } });
});

app.post('/api/teams', auth, (req, res) => {
  const { name, color = '#f97316', category = 'general' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  if (!TEAM_CATEGORIES.includes(category)) return res.status(400).json({ error: `Invalid category. Use: ${TEAM_CATEGORIES.join(', ')}` });

  // Business constraints
  const created = query('SELECT COUNT(*) as c FROM teams WHERE created_by=?', [req.user.id])[0]?.c ?? 0;
  if (created >= MAX_TEAMS_CREATED) return res.status(403).json({ error: `You can only create up to ${MAX_TEAMS_CREATED} teams` });

  const joined = query('SELECT COUNT(*) as c FROM team_members WHERE user_id=?', [req.user.id])[0]?.c ?? 0;
  if (joined >= MAX_TEAMS_JOINED) return res.status(403).json({ error: `You can only join up to ${MAX_TEAMS_JOINED} teams` });

  if (query('SELECT id FROM teams WHERE name=?', [name.trim()]).length)
    return res.status(409).json({ error: 'Team name already taken' });

  const code = name.trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5) + Math.random().toString(36).slice(2,5).toUpperCase();
  const id = randomUUID();
  run('INSERT INTO teams (id, name, color, category, invite_code, created_by) VALUES (?,?,?,?,?,?)',
    [id, name.trim(), color, category, code, req.user.id]);
  run('INSERT INTO team_members (team_id, user_id, role) VALUES (?,?,?)', [id, req.user.id, 'leader']);

  res.json({ team: query('SELECT * FROM teams WHERE id=?', [id])[0], invite_code: code });
});

app.post('/api/teams/join', auth, (req, res) => {
  const { invite_code } = req.body;
  if (!invite_code) return res.status(400).json({ error: 'invite_code required' });

  const team = query('SELECT * FROM teams WHERE invite_code=?', [invite_code.toUpperCase()])[0];
  if (!team) return res.status(404).json({ error: 'Invalid invite code' });

  if (query('SELECT * FROM team_members WHERE team_id=? AND user_id=?', [team.id, req.user.id]).length)
    return res.status(409).json({ error: 'Already a member of this team' });

  const joined = query('SELECT COUNT(*) as c FROM team_members WHERE user_id=?', [req.user.id])[0]?.c ?? 0;
  if (joined >= MAX_TEAMS_JOINED) return res.status(403).json({ error: `You can only join up to ${MAX_TEAMS_JOINED} teams` });

  run('INSERT INTO team_members (team_id, user_id, role) VALUES (?,?,?)', [team.id, req.user.id, 'member']);
  res.json({ team, message: 'Joined team' });
});

// Leave team — leader must transfer first, or team gets deleted
app.delete('/api/teams/:teamId/leave', auth, teamRole, (req, res) => {
  const { teamId } = req.params;
  const userId = req.user.id;

  if (req.teamRole === 'leader') {
    const others = query('SELECT user_id FROM team_members WHERE team_id=? AND user_id!=?', [teamId, userId]);
    if (others.length === 0) {
      // Last member — delete team
      run('DELETE FROM tasks WHERE team_id=?', [teamId]);
      run('DELETE FROM team_members WHERE team_id=?', [teamId]);
      run('DELETE FROM teams WHERE id=?', [teamId]);
      return res.json({ message: 'Team deleted (you were the only member)' });
    }
    // Has members — must transfer first
    return res.status(400).json({ error: 'Transfer leadership before leaving the team', code: 'TRANSFER_REQUIRED' });
  }

  run('DELETE FROM team_members WHERE team_id=? AND user_id=?', [teamId, userId]);
  res.json({ message: 'Left team' });
});

// Transfer leadership
app.post('/api/teams/:teamId/transfer', auth, teamRole, (req, res) => {
  if (req.teamRole !== 'leader') return res.status(403).json({ error: 'Only the team leader can transfer leadership' });
  const { new_leader_id } = req.body;
  if (!new_leader_id) return res.status(400).json({ error: 'new_leader_id required' });
  const target = query('SELECT * FROM team_members WHERE team_id=? AND user_id=?', [req.params.teamId, new_leader_id])[0];
  if (!target) return res.status(404).json({ error: 'Target user is not a team member' });

  run('UPDATE team_members SET role=? WHERE team_id=? AND user_id=?', ['member', req.params.teamId, req.user.id]);
  run('UPDATE team_members SET role=? WHERE team_id=? AND user_id=?', ['leader', req.params.teamId, new_leader_id]);
  res.json({ message: 'Leadership transferred' });
});

// Delete team (leader only)
app.delete('/api/teams/:teamId', auth, teamRole, (req, res) => {
  if (req.teamRole !== 'leader') return res.status(403).json({ error: 'Only the team leader can delete the team' });
  run('DELETE FROM tasks WHERE team_id=?', [req.params.teamId]);
  run('DELETE FROM team_members WHERE team_id=?', [req.params.teamId]);
  run('DELETE FROM teams WHERE id=?', [req.params.teamId]);
  res.json({ message: 'Team deleted' });
});

// Update member role (leader → mod/member, moderator → member only)
app.patch('/api/teams/:teamId/members/:userId/role', auth, teamRole, (req, res) => {
  const { role } = req.body; // 'moderator' | 'member'
  if (!['moderator','member'].includes(role)) return res.status(400).json({ error: 'role must be moderator or member' });
  if (req.teamRole !== 'leader') return res.status(403).json({ error: 'Only the leader can change roles' });
  if (req.params.userId === req.user.id) return res.status(400).json({ error: 'Cannot change your own role' });

  const target = query('SELECT * FROM team_members WHERE team_id=? AND user_id=?', [req.params.teamId, req.params.userId])[0];
  if (!target) return res.status(404).json({ error: 'Member not found' });
  if (target.role === 'leader') return res.status(400).json({ error: 'Cannot demote another leader — transfer first' });

  run('UPDATE team_members SET role=? WHERE team_id=? AND user_id=?', [role, req.params.teamId, req.params.userId]);
  res.json({ message: `Role updated to ${role}` });
});

// Kick member (leader kicks anyone, moderator kicks members only)
app.delete('/api/teams/:teamId/members/:userId', auth, teamRole, (req, res) => {
  const targetId = req.params.userId;
  if (targetId === req.user.id) return res.status(400).json({ error: 'Use the leave endpoint to leave' });

  const target = query('SELECT * FROM team_members WHERE team_id=? AND user_id=?', [req.params.teamId, targetId])[0];
  if (!target) return res.status(404).json({ error: 'Member not found' });

  if (req.teamRole === 'moderator' && target.role !== 'member')
    return res.status(403).json({ error: 'Moderators can only kick regular members' });
  if (req.teamRole === 'member')
    return res.status(403).json({ error: 'Insufficient permissions' });

  run('DELETE FROM team_members WHERE team_id=? AND user_id=?', [req.params.teamId, targetId]);
  res.json({ message: 'Member removed' });
});

// ─── Health ──────────────────────────────────────────────────

app.get('/api/health', (_, res) => res.json({ ok: true, version: '2.0', time: new Date().toISOString() }));

// ─── Error handling ─────────────────────────────────────────
// Catches sync throws & rejected promises from route handlers above
// (e.g. signToken failing on a stale/invalid token) and always
// responds with JSON so the frontend never tries to parse an HTML
// error page.
app.use((err, req, res, _next) => {
  console.error('[API error]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
});

// 404 fallback — keep JSON shape consistent
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ─── Start ───────────────────────────────────────────────────

await initDB();
app.listen(PORT, () => console.log(`\n🚀 Velocity API v2.0 → http://localhost:${PORT}\n`));