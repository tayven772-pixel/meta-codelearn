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


## Expanded non-AI community features

The bot also includes:
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

The owner-only `/bot-control` editor uses the existing **Publish JSON → preview → confirm** workflow. It accepts a normal template object or the complete backup exported by Bot Control:

- Normal template: `{ "roles": [], "categories": [], ... }`
- Complete backup: `{ "schemaVersion": 1, "server": { ... }, "botSettings": { ... } }`

The `server` object supports `branding`, `roles`, `categories`, `channelPermissions`, `controlPanel`, `settings`, and `automod`. Paste the complete exported backup directly into the existing JSON editor; it does not need to be manually extracted. Example server template:

```json
{
  "branding": {
    "server_name": "Meta Code",
    "description": "A friendly place to learn and build.",
    "verificationLevel": "medium",
    "explicitContentFilter": "allMembers",
    "defaultMessageNotifications": "onlyMentions",
    "afkTimeout": 300,
    "afkChannel": "AFK"
  },
  "roles": [
    {
      "name": "Moderator",
      "color": "#70C7A1",
      "hoist": true,
      "mentionable": false,
      "permissions": ["ViewChannel", "ManageMessages", "ModerateMembers"]
    },
    {
      "name": "Community Member",
      "color": "#D7DCE4",
      "permissions": ["ViewChannel", "SendMessages", "ReadMessageHistory"]
    }
  ],
  "categories": [
    {
      "name": "GET STARTED",
      "channels": [["text", "welcome", { "topic": "Start here" }]]
    },
    {
      "name": "COMMUNITY",
      "channels": [
        ["text", "general-chat", { "topic": "General discussion", "slowmode": 3 }],
        ["text", "announcements", { "topic": "Official updates", "slowmode": 0 }]
      ]
    },
    {
      "name": "STAFF HQ",
      "private": true,
      "staffRole": "Moderator",
      "channels": [
        ["text", "staff-chat"],
        ["text", "staff-applications"],
        ["text", "ticket-logs"],
        ["text", "moderation-logs"]
      ]
    },
    {
      "name": "TICKETS",
      "channels": [["text", "ticket-archive"]]
    },
    {
      "name": "VOICE",
      "channels": [
        ["voice", "Community Lounge", { "bitrate": 64000, "userLimit": 25 }],
        ["voice", "AFK", { "userLimit": 0 }]
      ]
    }
  ],
  "channelPermissions": [
    {
      "channel": "announcements",
      "role": "Community Member",
      "deny": ["SendMessages"]
    },
    {
      "channel": "general-chat",
      "role": "Moderator",
      "allow": ["ManageMessages", "ManageThreads"]
    }
  ],
  "automod": {
    "enabled": true,
    "syncUnlisted": false,
    "rules": [
      {
        "name": "Block fake prize links",
        "trigger": "keyword",
        "keywords": ["fake prize link"],
        "actions": [
          { "type": "blockMessage", "message": "Please do not post suspicious giveaway links." },
          { "type": "sendAlert", "channel": "moderation-logs" }
        ],
        "exemptRoles": ["Moderator"],
        "exemptChannels": ["staff-chat"]
      },
      {
        "name": "Discord spam detection",
        "trigger": "spam",
        "actions": [
          { "type": "blockMessage" },
          { "type": "sendAlert", "channel": "moderation-logs" }
        ],
        "exemptRoles": ["Moderator"],
        "exemptChannels": ["staff-chat"]
      },
      {
        "name": "Mention flood protection",
        "trigger": "mentionSpam",
        "mentionTotalLimit": 5,
        "mentionRaidProtectionEnabled": true,
        "actions": [
          { "type": "blockMessage" },
          { "type": "sendAlert", "channel": "moderation-logs" }
        ]
      }
    ]
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
      "panelTitle": "Meta Code | Staff Applications",
      "questions": [
        { "question": "Which role are you applying for?", "minimumWords": 3 }
      ]
    },
    "tickets": {
      "category": "TICKETS",
      "staffRole": "Moderator",
      "logChannel": "ticket-logs",
      "closeDelaySeconds": 5,
      "panelStyle": "dropdown",
      "categories": ["General Support", "Bug Report", "Website Help"],
      "formQuestions": ["Briefly describe what you need help with."]
    },
    "commands": {
      "purge": true,
      "timeout": true,
    },
    "responses": {
      "meta": "Learn the idea, then the code.",
      "help": "Use /meta to get started."
    },
    "security": {
      "linkProtectionEnabled": true,
      "linkProtectionOwnerId": "123456789012345678",
      "serverProfileGuardEnabled": false
    },
    "community": {
      "xpEnabled": true,
      "autorole": "Community Member",
      "logChannel": "moderation-logs"
    }
  },
  "controlPanel": {
    "title": "Meta Code bot control",
    "description": "Owner dashboard configured from JSON.",
    "sections": ["setup", "commands", "responses", "tickets", "messages", "security", "automod", "community", "autopartner", "applications"]
  }
}
```

Channel entries may use the short form `["text", "channel-name"]` or `["text", "channel-name", { ...options }]`. Supported text options are `topic`, `nsfw`, and `slowmode`; supported voice options are `bitrate` and `userLimit`. Roles can set `color`, `permissions`, `hoist`, and `mentionable`. `channelPermissions` applies explicit `allow`/`deny` permission arrays to roles for channels. Permission names must be valid Discord permission names.

AutoMod uses Discord's native rule engine. Supported triggers are `keyword`, `spam`, `keywordPreset`, `mentionSpam`, and `memberProfile`. Actions are `blockMessage`, `sendAlert`, `timeout` (keyword rules only), and `blockMemberInteraction` (member-profile rules only). Keyword presets are `profanity`, `sexualContent`, and `slurs`. Rules support role/channel exemptions. Discord limits the number of rules per trigger type; invalid combinations are rejected before sync. Regex patterns must use Rust-compatible syntax.

Set `automod.enabled: false` to disable the rules named in the configuration. By default, rules not listed in JSON are left alone. Set `automod.syncUnlisted: true` only when you also intend the sync to delete AutoMod rules that are not listed. The preview displays those removals before confirmation.

The structured `settings` blocks also support `welcome`, `autopartner`, `applications`, `tickets`, `commands`, `responses`, `security`, `community`, and `moderation`. The exported `botSettings` object restores saved Bot Control key/value settings and command toggles. Names referenced by structured settings, AutoMod exemptions, or category/channel permission rules must be included in the template. Include any existing role or channel you want to keep; the confirmed sync removes unlisted deletable roles and channels.

Publishing produces a live preview; it does not change Discord. Review role/channel/category changes, server settings, permission changes, AutoMod changes, and any listed removals. Confirming applies the reviewed setup and removes unlisted deletable roles, categories, and channels. Existing channel message history is permanently lost when a channel is deleted. Discord-managed roles, @everyone, administrator roles, roles at or above the bot's highest role, essential system channels, and channels/categories the bot cannot manage are protected. A server change after preview invalidates the confirmation and requires a fresh preview.

The bot needs **Manage Channels** and **Manage Roles** for layout changes, **Manage Server** for native AutoMod, and **Moderate Members** when AutoMod timeout actions are requested. Discord still enforces role hierarchy and server feature eligibility; this JSON cannot bypass those limits. Server icon/banner, owner, member accounts, integrations, and other Discord-managed items outside the bot's API permissions are not changed by this importer.

The legacy `/setup-server` command remains non-destructive: it applies the saved template without deleting unlisted resources. Use the owner dashboard preview/confirm flow when you intend the server to match the JSON exactly.
