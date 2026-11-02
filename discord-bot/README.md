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
- `/challenge today`, `/challenge answer`, `/challenge hint`, `/challenge stats` — daily coding prompt, private answer checking, hints, and progress
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


## Expanded non-AI community features

The bot also includes:
- Daily coding challenges selected by UTC date. Use `/challenge today` to post the prompt, `/challenge answer` to submit privately, `/challenge hint` for a hint, and `/challenge stats` to view solved days and streaks. A correct answer awards 25 XP once per UTC day; challenge completions also count toward `/level` and `/leaderboard`.
- Welcome messages with `{user}`, `{server}`, and `{membercount}` placeholders (`/welcome-config`).
- Automatic join roles (`/autorole`).
- Server event logging for joins, departures, message deletions, and channel creation/deletion (`/logging`).
- Message activity XP, member profiles, and a leaderboard (`/level`, `/leaderboard`).
- Scheduled giveaways with multiple winners (`/giveaway`, `/giveaway-end`).
- Self-service role menus (`/role-menu`).
- Server statistics (`/serverstats`).
- Redacted settings export (`/config-export`).

### Required Discord intent

The bot requests the **Server Members Intent** to support welcome messages and autoroles. Enable **Server Members Intent** under Discord Developer Portal → Application → Bot → Privileged Gateway Intents. The bot also requests the non-privileged Guild Messages intent for activity XP and message deletion logs. Message Content Intent is not required for these features.

Give the bot only the permissions it needs: View Channels, Send Messages, Embed Links, Read Message History, Add Reactions, Manage Roles (for autoroles and self-service roles), and Manage Channels only if you use channel-management tools. Keep its role below roles it must not assign.

## Staff applications

Configure a private text channel for application reviews, then run `/setup-applications` (or pass `staff_channel:#private-channel`). The panel opens a Discord modal with questions about the requested role, availability, experience, motivation, and a moderation scenario. Applications are stored in SQLite and sent to the configured review channel. Server managers/administrators, or the configured reviewer role, can accept or reject an application. Applicants receive a best-effort DM with the result. Keep the review channel private: the setup command refuses a channel visible to @everyone.

The owner dashboard can configure the review channel ID, optional reviewer role ID, panel title/description, and whether new applications are accepted. JSON can also configure these values by role/channel name.

## Automatic partner verification

Members can submit a Discord invite using `/partner-add`. Meta checks the invite's **approximate server member count** with Discord before accepting it; this is not an online-player count. The minimum defaults to 100 and can be changed with `/autopartner-setup` or the owner dashboard. Qualifying submissions are posted without staff approval when the partner channel is configured. Meta checks the invite count again before scheduled or manual posts, so stale/expired invites or servers below the threshold are skipped. Submissions are rate-limited to three qualifying entries per user per 24 hours.

## Welcome embeds

Join messages are sent as an embed with the new member's avatar, welcome text, server name, member number, and timestamp. The owner dashboard and JSON template can toggle the avatar.

## Publishing a complete server setup from JSON

The owner-only `/bot-control` editor accepts a template with `roles`, `categories`, and optional `controlPanel` and `settings` objects. Example:

```json
{
  "roles": [
    { "name": "Founder", "color": 16042333 },
    { "name": "Moderator", "color": 7391137 }
  ],
  "categories": [
    {
      "name": "GET STARTED",
      "channels": [["text", "welcome"], ["text", "rules"]]
    },
    {
      "name": "STAFF HQ",
      "private": true,
      "channels": [["text", "staff-applications"]]
    }
  ],
  "controlPanel": {
    "title": "Meta Code bot control",
    "description": "Owner dashboard configured from JSON.",
    "sections": ["setup", "commands", "responses", "applications"]
  },
  "settings": {
    "welcome": {
      "enabled": true,
      "channel": "welcome",
      "message": "Welcome {user} to {server}!",
      "showAvatar": true
    },
    "applications": {
      "enabled": true,
      "staffChannel": "staff-applications",
      "staffRole": "Moderator",
      "panelTitle": "Meta Code | Staff Applications"
    }
  }
}
```

Publish first produces a live preview; it does not change Discord. The preview lists planned creations, updates, channel moves/permission syncs, deletions, and protected objects. Confirming the preview applies the template and removes unlisted deletable roles, categories, and channels. Existing channel message history is permanently lost when a channel is deleted. Discord-managed roles, @everyone, administrator roles, roles at or above the bot's highest role, essential system channels, and channels/categories the bot cannot manage are protected. A server change after preview invalidates the confirmation and requires a fresh preview.

`controlPanel.sections` controls which dashboard sections are shown; `title` and `description` update the dashboard heading. Supported sections: `setup`, `commands`, `responses`, `tickets`, `messages`, `community`, `autopartner`, and `applications`. The JSON settings blocks support `welcome`, `autopartner`, `applications`, and `tickets`. Names referenced by a setting must be present in the same template.

The legacy `/setup-server` command remains non-destructive: it applies the saved template without deleting unlisted resources. Use the owner dashboard preview/confirm flow when you intend the server to match the JSON exactly.

## Run bot tests

From this folder, run `npm test` to verify daily challenge rotation, answer matching, streak calculation, and the existing bot test suite.
