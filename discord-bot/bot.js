/**
 * Velocity Discord Presence Bot
 * ────────────────────────────────────────────────────────────
 * This bot caches Discord user activities (Spotify, games,
 * VS Code, etc.) in real time and exposes a REST API that the
 * Velocity backend can query for live presence data.
 *
 * SETUP:
 *   1. Create a bot in the Discord Developer Portal
 *   2. Grant the following intents: GUILD_MEMBERS, GUILD_PRESENCES
 *   3. Create a .env file (see example below)
 *   4. npm install && npm start
 *
 * .env example:
 *   DISCORD_BOT_TOKEN=your_bot_token_here
 *   BOT_API_PORT=4001
 *   BOT_API_SECRET=your_secret_key_here  (share with the Velocity backend)
 *   GUILD_ID=your_server_id_here
 */

import 'dotenv/config';
import { Client, GatewayIntentBits, ActivityType } from 'discord.js';
import express from 'express';
import cors from 'cors';

// ── Config ────────────────────────────────────────────────────
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const PORT = parseInt(process.env.BOT_API_PORT || '4001');
const API_SECRET = process.env.BOT_API_SECRET || 'velocity-bot-secret';
const GUILD_ID = process.env.GUILD_ID;

if (!BOT_TOKEN) {
  console.error('❌  DISCORD_BOT_TOKEN ortam değişkeni eksik!');
  console.error('    discord-bot/.env dosyası oluşturun ve token ekleyin.');
  process.exit(1);
}

// ── Presence cache ────────────────────────────────────────────
// userId → presence snapshot (refreshed on each PRESENCE_UPDATE event)
const presenceCache = new Map();

/**
 * Convert a Discord.js Presence object into a clean, Lanyard-compatible format
 * so the frontend can use the same rendering logic.
 */
function serializePresence(presence) {
  const status = presence.status || 'offline';
  const clientStatus = presence.clientStatus || {};
  const activities = presence.activities || [];

  const spotifyAct = activities.find(a => a.name === 'Spotify' && a.type === ActivityType.Listening);
  const otherActs = activities.filter(a => a.name !== 'Spotify');

  const spotify = spotifyAct ? {
    song: spotifyAct.details || '',
    artist: spotifyAct.state?.replace(/;/g, ',') || '',
    album: spotifyAct.assets?.largeText || '',
    album_art_url: spotifyAct.assets?.largeImageURL() || '',
    track_id: spotifyAct.syncId || null,
    timestamps: spotifyAct.timestamps ? {
      start: spotifyAct.timestamps.start?.getTime() || null,
      end: spotifyAct.timestamps.end?.getTime() || null,
    } : null,
  } : null;

  const serializedActivities = otherActs.map(a => ({
    id: a.id,
    name: a.name,
    type: a.type,
    details: a.details || null,
    state: a.state || null,
    application_id: a.applicationId || null,
    assets: a.assets ? {
      large_image: a.assets.largeImage || null,
      large_text: a.assets.largeText || null,
      small_image: a.assets.smallImage || null,
      small_text: a.assets.smallText || null,
    } : null,
    timestamps: a.timestamps ? {
      start: a.timestamps.start?.getTime() || null,
      end: a.timestamps.end?.getTime() || null,
    } : null,
  }));

  return {
    discord_status: status,
    discord_client_status: clientStatus,
    listening_to_spotify: !!spotifyAct,
    spotify,
    activities: serializedActivities,
    cached_at: Date.now(),
  };
}

// ── Discord client ────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
  ],
});

client.once('ready', () => {
  console.log(`✅  Bot hazır: ${client.user.tag}`);

  // Pre-populate cache with all current members' presences
  if (GUILD_ID) {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (guild) {
      guild.presences.cache.forEach((presence, userId) => {
        presenceCache.set(userId, serializePresence(presence));
      });
      console.log(`📦  ${presenceCache.size} user presences loaded into cache`);
    } else {
      console.warn(`⚠️  GUILD_ID (${GUILD_ID}) bulunamadı. Botun sunucuya eklendiğinden emin olun.`);
    }
  }
});

client.on('presenceUpdate', (_old, newPresence) => {
  if (!newPresence?.userId) return;
  presenceCache.set(newPresence.userId, serializePresence(newPresence));
});

// Clean up stale entries every 10 minutes (older than 30 min = offline)
setInterval(() => {
  const threshold = Date.now() - 30 * 60 * 1000;
  for (const [userId, data] of presenceCache.entries()) {
    if (data.cached_at < threshold) {
      // Keep entry but mark as offline
      presenceCache.set(userId, { ...data, discord_status: 'offline', activities: [], listening_to_spotify: false, spotify: null });
    }
  }
}, 10 * 60 * 1000);

client.login(BOT_TOKEN).catch(err => {
  console.error('❌  Bot giriş hatası:', err.message);
  process.exit(1);
});

// ── REST API ──────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// Simple API key middleware
function requireSecret(req, res, next) {
  const key = req.headers['x-bot-secret'] || req.query.secret;
  if (key !== API_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// GET /presence/:userId — fetch a user's presence
app.get('/presence/:userId', requireSecret, (req, res) => {
  const { userId } = req.params;
  const presence = presenceCache.get(userId);

  if (!presence) {
    // Try to fetch live from Discord if guild is available
    if (GUILD_ID) {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (guild) {
        const member = guild.members.cache.get(userId);
        if (member?.presence) {
          const live = serializePresence(member.presence);
          presenceCache.set(userId, live);
          return res.json({ presence: live });
        }
      }
    }
    return res.json({ presence: null });
  }

  res.json({ presence });
});

// GET /presence — list all cached presences (admin use)
app.get('/presence', requireSecret, (req, res) => {
  const entries = Object.fromEntries(presenceCache);
  res.json({ count: presenceCache.size, presences: entries });
});

// GET /health — bot health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    bot: client.isReady() ? 'connected' : 'connecting',
    cached_users: presenceCache.size,
    uptime: Math.floor(process.uptime()),
  });
});

app.listen(PORT, () => {
  console.log(`🌐  Bot API dinleniyor: http://localhost:${PORT}`);
  console.log(`🔑  API Secret: ${API_SECRET.slice(0, 4)}${'*'.repeat(Math.max(0, API_SECRET.length - 4))}`);
});
