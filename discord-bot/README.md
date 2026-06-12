# Velocity Discord Presence Bot

Bu bot, Discord kullanıcılarının aktivitelerini (Spotify, oyun, VS Code vb.) takip eder ve Velocity profillerinde gösterir. Kullanıcıların Lanyard gibi harici servislere üye olmasına gerek kalmaz — sadece **senin Discord sunucuna** katılmaları yeterlidir.

## Nasıl Çalışır?

1. Bot, Discord sunucundaki tüm üyelerin `presence` (aktivite) bilgilerini dinler.
2. Her güncellemeyi bellek cache'ine yazar.
3. Velocity backend'i `/presence/:userId` endpoint'ini sorgular.
4. Frontend, profil sayfasında aktivite kartını gösterir.

## Kurulum

### 1. Discord Bot Oluştur

1. [Discord Developer Portal](https://discord.com/developers/applications)'a git
2. **New Application** → bir isim ver (örn. "Velocity Presence")
3. **Bot** sekmesine git → **Add Bot**
4. Token'ı kopyala (bir daha gösterilmez!)
5. **Privileged Gateway Intents** altında şunları aktif et:
   - ✅ **Server Members Intent**
   - ✅ **Presence Intent**
6. **OAuth2 → URL Generator** ile bot davet linki oluştur:
   - Scope: `bot`
   - Bot Permissions: `Read Messages/View Channels`
7. Botu kendi sunucuna davet et

### 2. Ortam Değişkenlerini Ayarla

```bash
cp .env.example .env
```

`.env` dosyasını düzenle:

```env
DISCORD_BOT_TOKEN=your_bot_token_here
BOT_API_PORT=4001
BOT_API_SECRET=gizli_bir_anahtar_yaz   # Velocity backend ile aynı olmalı
GUILD_ID=sunucu_id_si                  # Discord sunucunun ID'si
```

**Guild ID almak:** Discord'da Geliştirici Modunu aç (Ayarlar → Gelişmiş), sunucu adına sağ tıkla → "ID Kopyala"

### 3. Velocity Backend'i Yapılandır

`backend/.env` veya ortam değişkenlerine ekle:

```env
BOT_API_URL=http://localhost:4001
BOT_API_SECRET=gizli_bir_anahtar_yaz   # Bot ile aynı değer!
```

### 4. Bağımlılıkları Kur ve Başlat

```bash
cd discord-bot
npm install
npm start
```

### 5. Test Et

```bash
curl "http://localhost:4001/health"
curl -H "x-bot-secret: gizli_bir_anahtar_yaz" "http://localhost:4001/presence/DISCORD_USER_ID"
```

## Kullanıcı Akışı

1. Kullanıcı Velocity profilinde **"Discord Bağla"** butonuna basar
2. Discord OAuth ile yetkilendirme yapılır, `discord_id` hesaba kaydedilir
3. Kullanıcının Discord sunucuna üye olması gerekir (bot oradaki aktiviteleri dinler)
4. Profil sayfasında Discord aktivite kartı otomatik olarak görünür

## API Referansı

| Endpoint | Açıklama |
|----------|----------|
| `GET /health` | Bot durumu |
| `GET /presence/:userId` | Kullanıcı aktivitesi (secret header gerekli) |
| `GET /presence` | Tüm cache (admin) |

### Header

```
x-bot-secret: BOT_API_SECRET_DEĞERI
```

## Üretimde Çalıştırma

PM2 ile:
```bash
npm install -g pm2
pm2 start bot.js --name velocity-bot
pm2 save
```

Systemd servisi olarak da kurabilirsin.
