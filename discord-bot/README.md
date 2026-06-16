# Velocity Discord Presence Bot

This bot tracks Discord user activities (Spotify, games, VS Code, etc.) and displays them on Velocity profiles — no external services like Lanyard required. Users just need to join **your Discord server**.

## How It Works

1. The bot listens to `presence` (activity) events for all members in your Discord server.
2. Every update is written to an in-memory cache.
3. The Velocity backend queries the bot's REST API for live presence data.
4. The frontend renders an activity card on the user's profile page.

## Setup

### 1. Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** → give it a name (e.g. "Velocity Presence")
3. Open the **Bot** tab and click **Reset Token**
4. Copy the token (it won't be shown again!)
5. Under **Privileged Gateway Intents**, enable:
   - `GUILD_MEMBERS`
   - `GUILD_PRESENCES`
6. Use **OAuth2 → URL Generator** to create an invite link:
   - Scopes: `bot`
   - Permissions: `View Channels`

### 2. Configure Environment Variables

Create a `.env` file inside `discord-bot/`:

```env
DISCORD_BOT_TOKEN=your_bot_token_here
BOT_API_PORT=4001
BOT_API_SECRET=your_shared_secret     # Must match the Velocity backend
GUILD_ID=your_server_id_here
```

Edit the `.env` file with your values.

> **Getting your Guild ID:** Enable Developer Mode in Discord (Settings → Advanced), then right-click your server name → "Copy Server ID".

### 3. Configure the Velocity Backend

Add the following to `backend/.env` or your environment:

```env
BOT_API_URL=http://localhost:4001
BOT_API_SECRET=your_shared_secret     # Same value as above!
```

### 4. Install Dependencies and Start

```bash
cd discord-bot
npm install
npm start
```

## User Flow

1. User clicks **"Connect Discord"** on their Velocity profile
2. Discord OAuth grants authorization; `discord_id` is saved to their account
3. The user must be a member of the Discord server the bot is in (that's where it reads presences from)
4. The Discord activity card appears automatically on their profile page

## API Reference

| Endpoint | Description |
|---|---|
| `GET /health` | Health check |
| `GET /presence/:userId` | User activity (requires secret header) |
| `GET /presence` | Full cache dump (admin) |

**Auth header required for protected routes:**
```
x-bot-secret: YOUR_BOT_API_SECRET
```

## Running in Production

Use a process manager like [PM2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2
pm2 start bot.js --name velocity-bot
pm2 save
```
