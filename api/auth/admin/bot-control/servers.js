import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSession } from '../../../../lib/discord-auth.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function botToken() {
  if (process.env.META_DISCORD_BOT_TOKEN) return process.env.META_DISCORD_BOT_TOKEN;
  if (process.env.DISCORD_BOT_TOKEN) return process.env.DISCORD_BOT_TOKEN;
  try {
    const envFile = fs.readFileSync(path.join(projectRoot, 'discord-bot', '.env'), 'utf8');
    const line = envFile.split(/\r?\n/).find(row => /^(META_DISCORD_BOT_TOKEN|DISCORD_BOT_TOKEN)=/.test(row));
    if (!line) return '';
    return line.slice(line.indexOf('=') + 1).trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  } catch {
    return '';
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = readSession(req);
  if (!session?.id || !session?.access_token) {
    return res.status(401).json({ error: 'Reconnect Discord to continue.' });
  }

  const token = botToken();
  if (!token) {
    return res.status(503).json({ error: 'The Meta bot token is not configured on the server.' });
  }

  try {
    const [botResponse, userResponse] = await Promise.all([
      fetch('https://discord.com/api/v10/users/@me/guilds', {
        headers: { authorization: `Bot ${token}` },
      }),
      fetch('https://discord.com/api/v10/users/@me/guilds', {
        headers: { authorization: `Bearer ${session.access_token}` },
      }),
    ]);

    if (!botResponse.ok) {
      return res.status(502).json({ error: 'Discord could not return the Meta bot server list. Check the bot token and try again.' });
    }
    if (!userResponse.ok) {
      return res.status(401).json({ error: 'Your Discord connection needs to be refreshed. Reconnect Discord and approve server access.' });
    }

    const [botGuilds, userGuilds] = await Promise.all([botResponse.json(), userResponse.json()]);
    if (!Array.isArray(botGuilds) || !Array.isArray(userGuilds)) {
      return res.status(502).json({ error: 'Discord returned an unexpected server list.' });
    }

    const userGuildMap = new Map(userGuilds.map(guild => [String(guild.id), guild]));
    const servers = botGuilds.map(guild => {
      const userGuild = userGuildMap.get(String(guild.id));
      return {
        id: String(guild.id),
        name: String(guild.name || 'Unnamed server'),
        icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=96` : null,
        owner: Boolean(userGuild?.owner),
        botPresent: true,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ servers, source: 'bot-guilds', count: servers.length });
  } catch {
    return res.status(502).json({ error: 'Could not contact Discord to load the bot server list. Please try again.' });
  }
}
