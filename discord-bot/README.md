# Meta CodeLearn Discord bot

This companion bot provides learning links, staff utilities, and community tools for Meta Code.

## Community commands

- `/help` — quick command guide
- `/serverinfo` — server owner, member/channel counts, creation date and boosts
- `/userinfo` — account age, server join date, roles and user ID
- `/poll` — create a reaction poll with 2–5 options
- `/suggest` — post an idea with 👍/👎 feedback
- `/coinflip` — flip heads or tails
- `/roll` — choose a random integer within a range
- `/choose` — randomly select from a comma-separated list
- `/8ball` — get a playful answer to a question
- `/announce` — publish an official embed announcement (administrators only)
- `/meta`, `/lessons`, `/ping` — learning links and bot status
- `/ticket` and server/staff setup commands — additional tools, depending on configuration and permissions

Polls and suggestions are posted in the channel where the command is used. Staff setup commands should only be used by trusted moderators or administrators.

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


## Private owner dashboard

The website has a private bot-owner page at `/bot-control`. It is protected by the server-side `META_BOT_OWNER_EMAIL` environment variable and a signed-in Meta email/password session; knowing the URL alone does not grant access. Set `META_BOT_OWNER_EMAIL` to the exact verified email address for the owner's Meta account on the auth service, then restart that service. The page is an owner-only command/reference dashboard; it does not itself restart or remotely control the VPS process.
