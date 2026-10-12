import { createSession, setCookie, clearCookie, STATE_COOKIE } from '../../lib/discord-auth.js';

function cookieValue(req, name) {
  const item = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : '';
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
    setCookie(res, 'meta_discord_session', createSession(user), 7 * 24 * 60 * 60);
    return res.redirect(302, '/account?discord=connected');
  } catch (error) {
    console.error('Discord OAuth callback failed:', error);
    return res.status(502).send('Discord sign-in is temporarily unavailable.');
  }
}