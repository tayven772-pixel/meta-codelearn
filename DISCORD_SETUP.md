# Meta CodeLearn Discord integration

This feature branch is prepared for a Discord OAuth sign-in flow and a companion bot.

## Website environment variables
Configure these in your deployment provider, not in browser code or Git:
- DISCORD_CLIENT_ID
- DISCORD_CLIENT_SECRET
- DISCORD_SESSION_SECRET (random, at least 32 characters)
- APP_URL (canonical HTTPS site URL)
- DISCORD_REDIRECT_URI (exact callback URL)

In Discord Developer Portal, add the exact callback URL under OAuth2 Redirects. The first version should request only the `identify` scope. Keep bot tokens and client secrets private.

## Bot
A companion bot can provide `/meta`, `/lessons`, and `/ping` commands. Run the persistent Discord gateway process on a VPS or another always-on process host, not as a Vercel serverless function.

## Current status
The account page currently says authentication is being rebuilt. After implementing the API routes and account UI, configure the environment variables and deploy before expecting sign-in to work. This integration does not automatically sync learning progress across devices without persistent account storage.
