import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSession, setCookie, clearCookie, STATE_COOKIE } from '../../lib/discord-auth.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function cookieValue(req, name) {
  const item = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : '';
}

function botConfig(name) {
  if (process.env[name]) return process.env[name];
  // The existing bot .env is server-only; never send its contents to the browser or logs.
  try {
    const file = fs.readFileSync(path.join(projectRoot, 'discord-bot', '.env'), 'utf8');
    const line = file.split(/\r?\n/).find(row => row.startsWith(name + '='));
    if (!line) return '';
    return line.slice(name.length + 1).trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  } catch {
    return '';
  }
}

function withStatus(pathname, status) {
  const target = new URL(pathname, 'https://meta-code.invalid');
  target.searchParams.set('discord', status);
  return target.pathname + target.search;
}

async function joinConfiguredGuild(userId, accessToken) {
  const botToken = botConfig('META_DISCORD_BOT_TOKEN') || botConfig('DISCORD_BOT_TOKEN');
  const guildId = botConfig('META_DISCORD_GUILD_ID') || botConfig('DISCORD_GUILD_ID');
  if (!botToken || !/^\d{17,20}$/.test(guildId)) {
    return { joined: false, reason: 'not_configured' };
  }

  const endpoint = `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`;
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      authorization: `Bot ${botToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ access_token: accessToken }),
  });

  if (response.ok) return { joined: true };
  if (response.status === 204) return { joined: true };
  const details = await response.json().catch(() => ({}));
  // Do not log secrets or full tokens; caller only uses a safe status code.
  return { joined: false, reason: 'discord_rejected', status: response.status, code: details.code };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  const { code, state, error } = req.query || {};
  const expected = cookieValue(req, STATE_COOKIE);
  clearCookie(res, STATE_COOKIE);
  if (error) return res.redirect(302, '/account?discord=cancelled');
  if (!code || !state || !expected || state !== expected) return res.status(400).send('Discord sign-in state check failed. Please try again.');
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${process.env.APP_URL || 'https://' + req.headers.host}/api/auth/callback`;
  if (!clientId || !clientSecret) return res.status(503).send('Discord sign-in is not configured on the server.');
  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code: String(code), redirect_uri: redirectUri })
    });
    if (!tokenResponse.ok) return res.status(401).send('Discord could not verify sign-in. Please try again.');
    const tokenData = await tokenResponse.json();
    const profileResponse = await fetch('https://discord.com/api/users/@me', { headers: { authorization: `Bearer ${tokenData.access_token}` } });
    if (!profileResponse.ok) return res.status(401).send('Could not retrieve your Discord profile.');
    const user = await profileResponse.json();
    if (!user.id || !user.email || user.verified !== true) {
      return res.status(403).send('Discord did not provide a verified email. Please check your Discord account settings and try again.');
    }

    const returnCookie = cookieValue(req, 'meta_discord_return');
    clearCookie(res, 'meta_discord_return');
    let returnTo = '/account?discord=connected';
    try {
      const requested = decodeURIComponent(returnCookie || '');
      if (requested.startsWith('/') && !requested.startsWith('//')) returnTo = requested;
    } catch {}

    let joinResult;
    try {
      joinResult = await joinConfiguredGuild(user.id, tokenData.access_token);
    } catch {
      joinResult = { joined: false, reason: 'request_failed' };
    }
    setCookie(res, 'meta_discord_session', createSession({ ...user, email: user.email, verified: user.verified }), 7 * 24 * 60 * 60);
    const status = joinResult.joined ? 'joined' : joinResult.reason === 'not_configured' ? 'join_setup_needed' : 'join_failed';
    return res.redirect(302, withStatus(returnTo, status));
  } catch (error) {
    console.error('Discord OAuth callback failed:', error);
    return res.status(502).send('Discord sign-in is temporarily unavailable.');
  }
}
