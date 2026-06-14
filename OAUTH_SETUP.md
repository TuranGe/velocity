# Velocity - OAuth Setup Guide

This guide explains how to set up Google and Discord authentication for Velocity.

## Prerequisites

- Google Cloud Console account
- Discord Developer Portal account
- Backend server running at `http://localhost:3717` (or your configured URL)
- Frontend running at `http://localhost:5173` (or your configured URL)


## Discord OAuth Setup

### 1. Create Discord OAuth Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Go to "OAuth2" → "General"
4. Copy your **Client ID**
5. Go to "OAuth2" → "General" and reveal your **Client Secret**
6. Add redirect URL under "Redirects":
   - `http://localhost:5173/auth/discord` (for development)
   - Your production URL

### 2. Configure Backend & Frontend

Add to your backend `.env`:
```
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
DISCORD_REDIRECT=http://localhost:5173/auth/discord
```

Add to your frontend `.env.local`:
```
VITE_DISCORD_CLIENT_ID=your_client_id_here
VITE_DISCORD_REDIRECT=http://localhost:5173/auth/discord
```

### 3. Verify Discord Bot Permissions

1. Go to "OAuth2" → "URL Generator"
2. Select scopes: `identify`, `email`
3. Copy the generated URL for manual testing if needed

## Testing

1. Start your backend: `cd backend && npm run dev`
2. Start your frontend: `cd frontend && npm run dev`
3. Go to `http://localhost:5173`
4. Click "Sign In" in the navbar
5. Click "Google" or "Discord" buttons
6. Follow the OAuth flow

## Troubleshooting

### "OAuth requires server configuration"
- Make sure all environment variables are set in `.env`
- Restart your backend server after adding environment variables
- Check that the API endpoints match your URLs

### "Redirect URI mismatch"
- Verify the redirect URI matches exactly in both:
  - Your OAuth provider settings (Google/Discord)
  - Your environment variables
  - Your frontend code

### "No authorization code received"
- Check browser console for errors
- Verify redirect URIs are configured in OAuth provider settings
- Make sure cookies are enabled in your browser

## Security Notes

- **Never** commit `.env` files to git
- Use `.env.example` as a template for contributors
- Keep `DISCORD_CLIENT_SECRET` and `GOOGLE_CLIENT_SECRET` secret
- In production, use HTTPS for all OAuth redirects
- Validate and sanitize all user data from OAuth providers

## Production Deployment

1. Update all redirect URIs to use HTTPS
2. Set environment variables on your production server
3. Use a secrets management system for sensitive data
4. Test the entire OAuth flow before deploying
5. Monitor for authentication failures in logs
