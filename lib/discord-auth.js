import crypto from 'node:crypto';

const COOKIE_NAME = 'meta_discord_session';
const STATE_COOKIE = 'meta_discord_oauth_state';

function secret() {
  const value = process.env.DISCORD_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('DISCORD_SESSION_SECRET must be set to a random value of at least 32 characters.');
  return value;
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

function encryptToken(value) {
  const key = crypto.createHash('sha256').update(secret()).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.');
}

function decryptToken(value) {
  try {
    const [ivText, tagText, encryptedText] = String(value).split('.');
    if (!ivText || !tagText || !encryptedText) return null;
    const key = crypto.createHash('sha256').update(secret()).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function setCookie(res, name, value, maxAge) {
  const cookie = `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
  const current = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', current ? [...(Array.isArray(current) ? current : [current]), cookie] : [cookie]);
}

export function clearCookie(res, name) {
  setCookie(res, name, '', 0);
}

export function createSession(user) {
  const payload = Buffer.from(JSON.stringify({
    session_version: 2,
    id: user.id,
    username: user.username,
    global_name: user.global_name || user.username,
    avatar: user.avatar || null,
    access_token: user.access_token ? encryptToken(user.access_token) : null,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readSession(req) {
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(part => {
    const index = part.indexOf('=');
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }).filter(([key]) => key));
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  try {
    const user = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    // Version bump invalidates old Discord sessions so everyone reconnects with guild-list access.
    if (user.session_version !== 2 || !user.exp || user.exp < Date.now() || !user.id) return null;
    if (user.access_token) {
      user.access_token = decryptToken(user.access_token);
      if (!user.access_token) return null;
    }
    return user;
  } catch {
    return null;
  }
}

export { COOKIE_NAME, STATE_COOKIE };
