# Velocity Timer

Minimal focus timer for developers, students — monorepo with Node.js backend and SvelteKit frontend.

## Quick Start

```bash
# 1. Install all dependencies (first time only)
npm run install:all

# 2. Start everything with one command
npm run dev
```

That's it. Opens:
- **Frontend** → http://localhost:5173
- **Backend API** → http://localhost:3717

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start both backend (watch mode) and frontend (hot reload) |
| `npm run start` | Production mode — backend + frontend preview |
| `npm run build` | Build the frontend for production |
| `npm run install:all` | Install root + backend + frontend dependencies |

## Project Structure

```
velocity/
├── package.json          ← root (runs both with concurrently)
├── backend/              ← Node.js + Express + SQLite
│   ├── server.js         ← API server (port 3717)
│   ├── db.js             ← SQLite via sql.js
│   └── velocity.db.json  ← persisted database
└── frontend/             ← SvelteKit + GSAP
    └── src/
        ├── lib/
        │   ├── components/
        │   └── stores/   ← timer, tasks, i18n, api, theme
        └── routes/       ← pages
```

## API Endpoints

```
POST   /api/auth                  Register / login
GET    /api/leaderboard           Global rankings
POST   /api/sessions              Record a focus session
GET    /api/sessions/user/:id     User stats
GET    /api/tasks/:userId         List tasks
POST   /api/tasks                 Create task
PATCH  /api/tasks/:id             Update task
DELETE /api/tasks/:id             Delete task
GET    /api/teams                 All teams
POST   /api/teams                 Create team (returns invite code)
POST   /api/teams/join            Join with invite code
DELETE /api/teams/:id/leave       Leave team
```
