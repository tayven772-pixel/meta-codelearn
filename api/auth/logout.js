import { clearCookie } from '../../lib/discord-auth.js';
export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  clearCookie(res, 'meta_discord_session');
  return res.status(200).json({ ok: true });
}