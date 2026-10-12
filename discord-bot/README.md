# Meta CodeLearn Discord bot

This companion bot provides the slash commands `/meta`, `/lessons`, and `/ping`.

## Create the Discord app

1. Open https://discord.com/developers/applications and create an application.
2. In **Bot**, create a bot and copy its token. Keep it private.
3. Copy the Application ID from General Information.
4. Under **OAuth2 → Redirects**, add the exact URL `https://YOUR_DOMAIN/api/auth/callback`.
5. Invite the bot using OAuth2 URL Generator with `bot` and `applications.commands`. Do not grant Administrator.

## Configure website login

Add these variables in your Vercel project settings (never in frontend code or Git):
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_SESSION_SECRET` — random value at least 32 characters
- `APP_URL` — canonical HTTPS URL, for example `https://metasupport.com`
- `DISCORD_REDIRECT_URI` — exact callback URL, for example `https://metasupport.com/api/auth/callback`

The redirect URL in Discord and `DISCORD_REDIRECT_URI` must match exactly. Redeploy after setting environment variables.

## Run the bot

From this folder:

```bash
cp .env.example .env
# Edit .env with your Discord bot token and application ID
npm install
npm start
```

The bot registers its slash commands when it connects. Keep it running on a VPS or another persistent process host; serverless functions are not suitable for a Discord gateway connection.

## Current limitations

Website OAuth verifies a Discord identity and creates a signed, HttpOnly session cookie. Learning progress is still local to the browser; cross-device sync and a persistent account database are not part of this first version.
