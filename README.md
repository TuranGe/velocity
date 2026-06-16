<div align="center">

# ⚡ Velocity

**A minimal, distraction-free focus timer built for developers and students.**

[![SvelteKit](https://img.shields.io/badge/SvelteKit-FF3E00?style=flat&logo=svelte&logoColor=white)](https://kit.svelte.dev)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![GSAP](https://img.shields.io/badge/GSAP-88CE02?style=flat&logo=greensock&logoColor=white)](https://gsap.com)

[Live Demo](#) · [Report Bug](https://github.com/TuranGe/velocity/issues) · [Request Feature](https://github.com/TuranGe/velocity/issues)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎯 **Pomodoro Timer** | Structured 25-minute focus sessions with short and long break modes |
| 📋 **Task Tracking** | Link tasks to sessions — they auto-complete as focus time accumulates |
| 📊 **Stats Dashboard** | All-time session counts, minutes focused, and task completion rates |
| 🏆 **Global Leaderboard** | Weekly, monthly, and all-time rankings across all users |
| 🤝 **Teams** | Create or join teams with invite codes, compete together |
| 🌐 **i18n** | Full English / Turkish support — switch language in one click |
| 🎵 **Ambient Audio** | Built-in lo-fi and nature sounds that auto-adjust to break modes |
| 🎨 **Adaptive Theme** | Dark and light modes with smooth GSAP-powered transitions |
| 🔔 **Notifications** | Browser notifications when a session finishes (tab in background) |
| 💬 **Discord Integration** | Link your Discord account to show live activity on your profile |

---

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/TuranGe/velocity.git
cd velocity

# 2. Install all dependencies (run once)
npm run install:all

# 3. Start everything with a single command
npm run dev
```

That's it. Two servers start automatically:

- **Frontend** → http://localhost:5173
- **Backend API** → http://localhost:3717

---

## 🛠 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start backend (watch mode) and frontend (hot reload) concurrently |
| `npm run start` | Production mode — backend + frontend preview |
| `npm run build` | Build the frontend for production |
| `npm run install:all` | Install dependencies for root, backend, and frontend |

---

## 🗂 Project Structure

```
velocity/
├── package.json              ← Root config — runs both services with concurrently
│
├── backend/                  ← Node.js + Express REST API
│   ├── server.js             ← Entry point (port 3717)
│   ├── db.js                 ← SQLite database layer (via sql.js, runs in-memory)
│   ├── middleware.js          ← Auth middleware (JWT)
│   ├── routes/               ← Route handlers (auth, sessions, tasks, teams, etc.)
│   └── velocity.db.json      ← Persisted database snapshot (auto-saved on write)
│
└── frontend/                 ← SvelteKit app
    └── src/
        ├── lib/
        │   ├── components/   ← UI components (Timer, TaskPanel, Navbar, …)
        │   ├── stores/       ← Svelte stores: timer, tasks, i18n, api, theme, audio
        │   └── utils/        ← Helpers: GSAP, notifications, audio engine, stats
        └── routes/           ← Pages: home, /stats, /leaderboard, /teams, /profile
```

---

## 🔌 API Reference

All endpoints are prefixed with `/api`.

### Auth

```
POST   /api/auth                    Register or log in (returns JWT)
```

### Sessions

```
POST   /api/sessions                Record a completed focus session
GET    /api/sessions/user/:id       Get stats + recent sessions for a user
```

### Tasks

```
GET    /api/tasks/:userId           List all tasks for a user
POST   /api/tasks                   Create a new task
PATCH  /api/tasks/:id               Update a task (done, text, pomodoros, …)
DELETE /api/tasks/:id               Delete a task
```

### Leaderboard

```
GET    /api/leaderboard             Global rankings (supports ?period=week|month|alltime)
```

### Teams

```
GET    /api/teams                   List all teams (supports ?search, ?category)
POST   /api/teams                   Create a team (returns invite code)
POST   /api/teams/join              Join a team with an invite code
DELETE /api/teams/:id/leave         Leave a team
```

### Discord

```
GET    /api/discord/presence/:id    Fetch live Discord presence for a user
```

---

## ⚙️ Environment Variables

Create a `.env` file in `backend/` and `frontend/` for optional integrations.

**backend/.env**
```env
JWT_SECRET=your_secret_here
DISCORD_BOT_TOKEN=your_bot_token       # Optional — enables Discord presence
```

**frontend/.env**
```env
VITE_DISCORD_CLIENT_ID=your_client_id  # Optional — enables Discord OAuth login
VITE_DISCORD_REDIRECT=http://localhost:5173/auth/discord
VITE_API_URL=http://localhost:3717
```

See [`OAUTH_SETUP.md`](./OAUTH_SETUP.md) for a full Discord OAuth walkthrough.

---

## 🧩 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | [SvelteKit](https://kit.svelte.dev) |
| Animations | [GSAP](https://gsap.com) |
| Backend | [Node.js](https://nodejs.org) + [Express](https://expressjs.com) |
| Database | [SQLite](https://www.sqlite.org) via [sql.js](https://sql.js.org) |
| Auth | JWT (JSON Web Tokens) |
| Discord | [Lanyard API](https://github.com/Phineas/lanyard) + Discord OAuth2 |

---

## 📄 License

MIT © [TuranGe](https://github.com/TuranGe)
