import crypto from 'node:crypto';
import { setCookie, STATE_COOKIE } from '../../lib/discord-auth.js';

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.DISCORD_CLIENT_ID) return res.status(503).send('Discord sign-in is not configured yet. Add the Discord OAuth environment variables in your deployment settings.');
  const state = crypto.randomBytes(24).toString('hex');
  setCookie(res, STATE_COOKIE, state, 600);
  const requestedReturn = String(req.query?.returnTo || '');
  const returnTo = requestedReturn.startsWith('/') && !requestedReturn.startsWith('//') ? requestedReturn : '/account';
  setCookie(res, 'meta_discord_return', encodeURIComponent(returnTo), 600);
  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${process.env.APP_URL || 'https://' + req.headers.host}/api/auth/callback`;
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', process.env.DISCORD_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'identify email guilds.join');
  url.searchParams.set('state', state);
  return res.redirect(302, url.toString());
}