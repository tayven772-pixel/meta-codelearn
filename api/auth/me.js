import { readSession } from '../../lib/discord-auth.js';
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = readSession(req);
  if (!user) return res.status(200).json({ authenticated: false });
  return res.status(200).json({ authenticated: true, user: { id: user.id, username: user.username, displayName: user.global_name, avatar: user.avatar } });
}