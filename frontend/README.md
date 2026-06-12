# Velocity Timer — Frontend

SvelteKit frontend for the Velocity Timer app.

## Setup

```bash
# 1. Start the backend first (port 3717)
cd ../velocity-backend && npm start

# 2. Then start the frontend
cd velocity-timer-js
npm install
npm run dev
```

## Features

- ⏱️ Pomodoro timer (Focus / Short Break / Long Break)
- ✅ Task panel with pomodoro tracking, synced to backend when logged in
- 🌍 EN/TR language toggle
- 🎨 Animated theme switching (wipe transition)
- 🎵 Ambient focus music (Web Audio API)
- 👥 Real team creation, joining via invite codes
- 🏆 Live leaderboard from backend API
- 📊 Stats page with session history
