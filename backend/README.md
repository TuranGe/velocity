# Velocity Timer — Backend API

Node.js + Express + SQLite backend for the Velocity Timer app.

## Setup

```bash
cd velocity-backend
npm install
npm start
# Runs at http://localhost:3717
```

## API Endpoints

### Auth
- `POST /api/auth` — Register or login `{ username, avatar }`

### Sessions
- `POST /api/sessions` — Record a completed session `{ user_id, mode, duration }`
- `GET /api/sessions/user/:userId` — Get user sessions + stats

### Tasks
- `GET /api/tasks/:userId` — Get all tasks for user
- `POST /api/tasks` — Create task `{ user_id, text, pomodoros }`
- `PATCH /api/tasks/:id` — Update task `{ done?, spent? }`
- `DELETE /api/tasks/:id` — Delete task

### Leaderboard
- `GET /api/leaderboard?period=week|month|alltime&limit=10`

### Teams
- `GET /api/teams` — All teams with members + session counts
- `POST /api/teams` — Create team `{ name, color, created_by }`
- `POST /api/teams/join` — Join with invite code `{ invite_code, user_id }`
- `DELETE /api/teams/:teamId/leave` — Leave team `{ user_id }`
- `GET /api/teams/:teamId/stats` — Team stats

## Database

SQLite via sql.js, persisted to `velocity.db.json`. Auto-seeded with demo users and teams on first run.
