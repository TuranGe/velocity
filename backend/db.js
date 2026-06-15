import { createRequire } from 'module';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DB_PATH = join(__dirname, 'velocity.db.json');

const initSqlJs = require('sql.js/dist/sql-asm.js');
let db;

export async function initDB() {
  const SQL = await initSqlJs();
  if (existsSync(DB_PATH)) {
    try {
      const saved = JSON.parse(readFileSync(DB_PATH, 'utf8'));
      db = new SQL.Database(new Uint8Array(saved.data));
      console.log('[DB] Loaded existing database');
    } catch {
      db = new SQL.Database();
      console.log('[DB] Fresh database');
    }
  } else {
    db = new SQL.Database();
    console.log('[DB] Created new database');
  }
  createSchema();
  persistDB();
  return db;
}

function createSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      username    TEXT UNIQUE NOT NULL,
      email       TEXT UNIQUE,
      password    TEXT,
      profile_image TEXT,
      provider    TEXT DEFAULT 'local',
      provider_id TEXT,
      bio         TEXT DEFAULT '',
      created_at  INTEGER DEFAULT (strftime('%s','now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL,
      mode         TEXT NOT NULL DEFAULT 'focus',
      duration     INTEGER NOT NULL DEFAULT 1500,
      completed_at INTEGER DEFAULT (strftime('%s','now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      team_id    TEXT,
      text       TEXT NOT NULL,
      type       TEXT NOT NULL DEFAULT 'personal',
      done       INTEGER DEFAULT 0,
      pomodoros  INTEGER DEFAULT 1,
      spent      INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      done_at    INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS teams (
      id          TEXT PRIMARY KEY,
      name        TEXT UNIQUE NOT NULL,
      color       TEXT DEFAULT '#f97316',
      category    TEXT DEFAULT 'general',
      invite_code TEXT UNIQUE NOT NULL,
      created_by  TEXT NOT NULL,
      created_at  INTEGER DEFAULT (strftime('%s','now')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS team_members (
      team_id   TEXT NOT NULL,
      user_id   TEXT NOT NULL,
      role      TEXT NOT NULL DEFAULT 'member',
      joined_at INTEGER DEFAULT (strftime('%s','now')),
      PRIMARY KEY (team_id, user_id),
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Performance indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id      ON sessions(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_completed_at ON sessions(completed_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_user_time    ON sessions(user_id, completed_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_user_id         ON tasks(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_team_members_user_id  ON team_members(user_id)`);

  // Migrate: add columns if they don't exist yet (safe on re-run)
  try { db.run(`ALTER TABLE teams ADD COLUMN category TEXT DEFAULT 'general'`); } catch { }
  try { db.run(`ALTER TABLE team_members ADD COLUMN role TEXT DEFAULT 'member'`); } catch { }
  try { db.run(`ALTER TABLE tasks ADD COLUMN team_id TEXT`); } catch { }
  try { db.run(`ALTER TABLE tasks ADD COLUMN type TEXT DEFAULT 'personal'`); } catch { }
  try { db.run(`ALTER TABLE users ADD COLUMN email TEXT`); } catch { }
  try { db.run(`ALTER TABLE users ADD COLUMN password TEXT`); } catch { }
  try { db.run(`ALTER TABLE users ADD COLUMN provider TEXT DEFAULT 'local'`); } catch { }
  try { db.run(`ALTER TABLE users ADD COLUMN provider_id TEXT`); } catch { }
  try { db.run(`ALTER TABLE users ADD COLUMN discord_id TEXT`); } catch { }
  try { db.run(`ALTER TABLE users ADD COLUMN profile_image TEXT`); } catch { }
  try { db.run(`ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''`); } catch { }

  if (process.env.SEED_DEMO_DATA !== 'false') seedDemoData();
}

function seedDemoData() {
  const demoUsers = [
    { id: 'demo-1', username: 'nova_dev' },
    { id: 'demo-2', username: 'px_coder' },
    { id: 'demo-3', username: 'zoe.makes' },
    { id: 'demo-4', username: 'rustacean' },
    { id: 'demo-5', username: 'byte_witch' },
    { id: 'demo-6', username: 'alex_w' },
    { id: 'demo-7', username: 'kaito.dev' },
    { id: 'demo-8', username: 'noctua' },
    { id: 'demo-9', username: 'v3ctr' },
  ];
  for (const u of demoUsers) {
    if (!query('SELECT id FROM users WHERE id = ?', [u.id]).length) {
      const profileImage = `https://api.dicebear.com/7.x/identicon/png?seed=${encodeURIComponent(u.username)}`;
      db.run('INSERT INTO users (id, username, profile_image, provider) VALUES (?, ?, ?, ?)', [u.id, u.username, profileImage, 'demo']);
    }
  }

  const sessionCounts = { 'demo-1': 142, 'demo-2': 118, 'demo-3': 97, 'demo-4': 84, 'demo-5': 71, 'demo-6': 56, 'demo-7': 49, 'demo-8': 78, 'demo-9': 65 };
  for (const [uid, count] of Object.entries(sessionCounts)) {
    const existing = query('SELECT COUNT(*) as c FROM sessions WHERE user_id = ?', [uid])[0]?.c ?? 0;
    if (existing === 0) {
      for (let i = 0; i < count; i++) {
        const ts = Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 30 * 86400);
        db.run('INSERT INTO sessions (id, user_id, mode, duration, completed_at) VALUES (?, ?, ?, ?, ?)',
          [`seed-${uid}-${i}`, uid, 'focus', 1500, ts]);
      }
    }
  }

  const demoTeams = [
    { id: 'team-1', name: 'Morning Grind', color: '#f97316', category: 'productivity', code: 'MGRIND', by: 'demo-1' },
    { id: 'team-2', name: 'Night Owls', color: '#8b5cf6', category: 'study', code: 'NOWLS', by: 'demo-8' },
    { id: 'team-3', name: 'Code & Coffee', color: '#06b6d4', category: 'work', code: 'CNCOFF', by: 'demo-2' },
    { id: 'team-4', name: 'Deep Learners', color: '#10b981', category: 'study', code: 'DPLEARN', by: 'demo-3' },
    { id: 'team-5', name: 'Game Builders', color: '#ef4444', category: 'gaming', code: 'GAMEBLD', by: 'demo-4' },
    { id: 'team-6', name: 'Focus Gang', color: '#eab308', category: 'general', code: 'FOCGANG', by: 'demo-5' },
  ];
  for (const t of demoTeams) {
    if (!query('SELECT id FROM teams WHERE id = ?', [t.id]).length)
      db.run('INSERT INTO teams (id, name, color, category, invite_code, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [t.id, t.name, t.color, t.category, t.code, t.by]);
  }

  const memberships = [
    ['team-1', 'demo-1', 'leader'], ['team-1', 'demo-6', 'member'], ['team-1', 'demo-7', 'member'], ['team-1', 'demo-2', 'member'], ['team-1', 'demo-3', 'moderator'],
    ['team-2', 'demo-8', 'leader'], ['team-2', 'demo-9', 'member'], ['team-2', 'demo-5', 'member'],
    ['team-3', 'demo-2', 'leader'], ['team-3', 'demo-4', 'member'], ['team-3', 'demo-6', 'member'], ['team-3', 'demo-1', 'member'],
    ['team-4', 'demo-3', 'leader'], ['team-4', 'demo-7', 'member'], ['team-4', 'demo-9', 'member'],
    ['team-5', 'demo-4', 'leader'], ['team-5', 'demo-5', 'member'],
    ['team-6', 'demo-5', 'leader'], ['team-6', 'demo-8', 'member'], ['team-6', 'demo-1', 'member'],
  ];
  for (const [tid, uid, role] of memberships) {
    if (!query('SELECT * FROM team_members WHERE team_id=? AND user_id=?', [tid, uid]).length)
      db.run('INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)', [tid, uid, role]);
  }

  persistDB();
}

export function persistDB() {
  if (!db) return;
  writeFileSync(DB_PATH, JSON.stringify({ data: Array.from(db.export()) }));
}

let _persistTimer = null;
function schedulePersist() {
  clearTimeout(_persistTimer);
  _persistTimer = setTimeout(persistDB, 500);
}

export function query(sql, params = []) {
  const result = db.exec(sql, params);
  if (!result[0]) return [];
  const { columns, values } = result[0];
  return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

export function run(sql, params = []) {
  db.run(sql, params);
  schedulePersist();
}

export { db };