import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';
import { OAuth2Client } from 'google-auth-library';
import Database from 'better-sqlite3';
import discordStart from '../api/auth/discord.js';
import discordCallback from '../api/auth/callback.js';
import { readSession, clearCookie, COOKIE_NAME } from '../lib/discord-auth.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.AUTH_PORT || 3001);
const appOrigin = (process.env.APP_ORIGIN || 'https://metasupportcom.dbm.shared-servers.com').replace(/\/$/, '');
const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
const googleOAuth = googleClientId && googleClientSecret
  ? new OAuth2Client(
      googleClientId,
      googleClientSecret,
      `${appOrigin}/api/auth/google/callback`
    )
  : null;

const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
const databasePath = process.env.AUTH_DB_PATH || path.join(__dirname, 'data', 'auth.sqlite');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  console.error('AUTH_SECRET must be set to a random secret of at least 32 characters.');
  process.exit(1);
}
if (!process.env.SMTP_USER || !process.env.SMTP_APP_PASSWORD || !fromEmail) {
  console.error('Set SMTP_USER, SMTP_APP_PASSWORD, and SMTP_FROM in the server environment.');
  process.exit(1);
}

const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    verified_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS email_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS site_content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    content_type TEXT NOT NULL CHECK(content_type IN ('announcement','lesson')),
    summary TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    published_at TEXT
  );
`);
const userColumns = new Set(
  db.prepare('PRAGMA table_info(users)').all().map(column => column.name)
);
if (!userColumns.has('display_name')) {
  db.exec('ALTER TABLE users ADD COLUMN display_name TEXT');
}
if (!userColumns.has('username')) {
  db.exec('ALTER TABLE users ADD COLUMN username TEXT COLLATE NOCASE');
}
if (!userColumns.has('avatar_png')) {
  db.exec('ALTER TABLE users ADD COLUMN avatar_png BLOB');
}
if (!userColumns.has('google_sub')) {
  db.exec('ALTER TABLE users ADD COLUMN google_sub TEXT');
}
if (!userColumns.has('google_picture')) {
  db.exec('ALTER TABLE users ADD COLUMN google_picture TEXT');
}
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique
  ON users(username)
  WHERE username IS NOT NULL AND username <> '';
`);
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_unique
  ON users(google_sub)
  WHERE google_sub IS NOT NULL AND google_sub <> '';
`);

const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_APP_PASSWORD },
});
app.disable('x-powered-by');
// Trust only the local reverse proxy so rate limits use the real client IP.
app.set('trust proxy', 'loopback');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }));

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('base64url');
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  verified: Boolean(user.verified_at),
  displayName: user.display_name || null,
  profilePicture: user.google_picture || (user.avatar_png ? `data:image/png;base64,${Buffer.from(user.avatar_png).toString('base64')}` : null),
});

async function sendVerification(email, token) {
  const link = `${appOrigin}/verify-email?token=${encodeURIComponent(token)}`;
  await mailer.sendMail({
    from: `Meta CodeLearn <${fromEmail}>`,
    to: email,
    subject: 'Verify your Meta CodeLearn email',
    text: `Welcome to Meta CodeLearn! Verify your email by opening this link within 30 minutes:\n\n${link}\n\nIf you did not create this account, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f2937"><h1>Verify your email</h1><p>Welcome to Meta CodeLearn. Confirm your email address to finish creating your account.</p><p><a href="${link}" style="display:inline-block;background:#244bc4;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Verify email address</a></p><p>This link expires in 30 minutes. If you did not create this account, you can ignore this message.</p></div>`,
  });
}

async function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = await new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (err, key) => err ? reject(err) : resolve(key)));
  return `scrypt:${salt}:${derived.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [kind, salt, keyHex] = String(stored).split(':');
  if (kind !== 'scrypt' || !salt || !keyHex) return false;
  const actual = await new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (err, key) => err ? reject(err) : resolve(key)));
  const expected = Buffer.from(keyHex, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
function setSession(res, userId) {
  const token = randomToken();
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hash(token), userId, expiresAt);
  res.cookie('meta_session', token, {
    httpOnly: true,
    secure: appOrigin.startsWith('https://'),
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}
function sessionUser(req) {
  const token = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('meta_session='))?.slice('meta_session='.length);
  if (!token) return null;
  const row = db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?').get(hash(decodeURIComponent(token)), Date.now());
  return row || null;
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.post('/api/auth/register', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 10 || password.length > 128) return res.status(400).json({ error: 'Use a password between 10 and 128 characters.' });
  if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) return res.status(409).json({ error: 'An account with that email already exists. If you have not verified it yet, sign in and choose “Resend verification email”.' });

  const encoded = await passwordHash(password);
  let userId;
  try {
    const result = db.prepare('INSERT INTO users(email,password_hash,created_at) VALUES(?,?,?)').run(email, encoded, new Date().toISOString());
    userId = Number(result.lastInsertRowid);
  } catch {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const token = randomToken();
  db.prepare('INSERT INTO email_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hash(token), userId, Date.now() + 30 * 60 * 1000);
  try {
    await sendVerification(email, token);
  } catch (error) {
    console.error('Verification email failed:', error?.message || 'unknown error');
    db.prepare('DELETE FROM email_tokens WHERE user_id=?').run(userId);
    db.prepare('DELETE FROM users WHERE id=?').run(userId);
    return res.status(503).json({ error: 'We could not send the verification email. Check the mail server configuration and try again.' });
  }
  return res.status(201).json({ message: 'Account created. Check your email for a verification link that expires in 30 minutes.' });
});

app.post('/api/auth/resend-verification', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  if (!validEmail(email) || !password || password.length > 128) {
    return res.status(400).json({ error: 'Enter the email address and password used to create your account.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!user || user.verified_at || !(await verifyPassword(password, user.password_hash))) {
    return res.status(400).json({ error: 'We could not find an unverified account with that email and password. Check your details or create a new account with another email.' });
  }

  db.prepare('DELETE FROM email_tokens WHERE user_id=?').run(user.id);
  const token = randomToken();
  db.prepare('INSERT INTO email_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)')
    .run(hash(token), user.id, Date.now() + 30 * 60 * 1000);

  try {
    await sendVerification(email, token);
  } catch (error) {
    console.error('Verification resend failed:', error?.message || 'unknown error');
    db.prepare('DELETE FROM email_tokens WHERE user_id=?').run(user.id);
    return res.status(503).json({ error: 'We could not send the verification email right now. Please try again in a little while.' });
  }

  return res.json({ message: 'A new verification email has been sent. The previous link will no longer work, and this link expires in 30 minutes.' });
});

app.get('/api/auth/verify', (req, res) => {
  const token = String(req.query.token || '');
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return res.status(400).json({ error: 'This verification link is invalid or expired.' });
  const row = db.prepare('SELECT user_id,expires_at FROM email_tokens WHERE token_hash=?').get(hash(token));
  if (!row || row.expires_at < Date.now()) {
    if (row) db.prepare('DELETE FROM email_tokens WHERE token_hash=?').run(hash(token));
    return res.status(400).json({ error: 'This verification link is invalid or expired. Return to sign in and request a new verification email.' });
  }
  db.prepare('UPDATE users SET verified_at=? WHERE id=?').run(new Date().toISOString(), row.user_id);
  db.prepare('DELETE FROM email_tokens WHERE user_id=?').run(row.user_id);
  return res.json({ message: 'Email verified. You can now sign in.' });
});

app.post('/api/auth/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!user || !(await verifyPassword(password, user.password_hash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
  if (!user.verified_at) return res.status(403).json({ error: 'Please verify your email before signing in.' });
  db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
  setSession(res, user.id);
  return res.json({ user: publicUser(user) });
});

app.get('/api/auth/me', (req, res) => {
  const user = sessionUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  res.json({ user: publicUser(user) });
});

// Private Discord bot owner dashboard. URL secrecy is not used as authorization.
app.get('/api/auth/admin/bot-control', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const user = sessionUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in with the owner Meta account to continue.' });
  const ownerEmail = normalizeEmail(process.env.META_BOT_OWNER_EMAIL || '');
  if (!ownerEmail || normalizeEmail(user.email) !== ownerEmail) {
    return res.status(403).json({ error: 'This account is not authorized to access the private bot dashboard.' });
  }
  return res.json({
    owner: user.email,
    dashboard: 'Meta Code bot owner console',
    commands: ['/help', '/meta', '/lessons', '/ping', '/serverinfo', '/userinfo', '/poll', '/suggest', '/coinflip', '/roll', '/choose', '/8ball', '/announce', '/ticket', '/ticket-panel', '/setup-server', '/setup-applications']
  });
});

// Content publishing API. Administrator privileges are granted only by server environment,
// never by a client-supplied email or role field.
const adminEmails = new Set(
  String(process.env.META_ADMIN_EMAILS || '')
    .split(',')
    .map(value => normalizeEmail(value))
    .filter(Boolean)
);
function requireAdmin(req, res) {
  const user = sessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Please sign in to manage site content.' });
    return null;
  }
  if (!adminEmails.has(normalizeEmail(user.email))) {
    res.status(403).json({ error: 'This account is not authorized to publish site content.' });
    return null;
  }
  return user;
}
function contentDto(row) {
  return {
    id: row.id, title: row.title, slug: row.slug, content_type: row.content_type,
    summary: row.summary, body: row.body, status: row.status,
    created_at: row.created_at, updated_at: row.updated_at, published_at: row.published_at
  };
}
app.get('/api/auth/content', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const items = db.prepare(
    "SELECT id,title,slug,content_type,summary,body,status,created_at,updated_at,published_at FROM site_content WHERE status='published' ORDER BY published_at DESC, id DESC LIMIT 30"
  ).all();
  res.json({ items: items.map(contentDto) });
});
app.get('/api/auth/admin/content', (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  const items = db.prepare(
    'SELECT id,title,slug,content_type,summary,body,status,created_at,updated_at,published_at FROM site_content ORDER BY updated_at DESC, id DESC'
  ).all();
  res.json({ items: items.map(contentDto) });
});
function validateContent(body) {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const slug = typeof body?.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  const contentType = body?.content_type;
  const summary = typeof body?.summary === 'string' ? body.summary.trim() : '';
  const content = typeof body?.body === 'string' ? body.body.trim() : '';
  const status = body?.status;
  if (!title || title.length > 120) return { error: 'Title is required and must be at most 120 characters.' };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) return { error: 'Use a URL slug with lowercase letters, numbers, and single hyphens.' };
  if (!['announcement', 'lesson'].includes(contentType)) return { error: 'Choose an allowed content type.' };
  if (summary.length > 280) return { error: 'Summary must be 280 characters or fewer.' };
  if (!content || content.length > 12000) return { error: 'Body is required and must be at most 12,000 characters.' };
  if (!['draft', 'published'].includes(status)) return { error: 'Choose draft or published status.' };
  return { value: { title, slug, content_type: contentType, summary, body: content, status } };
}
function saveContent(req, res, existingId = null) {
  if (!requireAdmin(req, res)) return;
  const checked = validateContent(req.body);
  if (checked.error) return res.status(400).json({ error: checked.error });
  const item = checked.value;
  const now = new Date().toISOString();
  const publishedAt = item.status === 'published' ? now : null;
  try {
    let id = existingId;
    if (existingId !== null) {
      const previous = db.prepare('SELECT id,published_at FROM site_content WHERE id=?').get(existingId);
      if (!previous) return res.status(404).json({ error: 'Content item not found.' });
      const finalPublishedAt = item.status === 'published' ? (previous.published_at || now) : null;
      db.prepare('UPDATE site_content SET title=?,slug=?,content_type=?,summary=?,body=?,status=?,updated_at=?,published_at=? WHERE id=?')
        .run(item.title, item.slug, item.content_type, item.summary, item.body, item.status, now, finalPublishedAt, existingId);
    } else {
      const result = db.prepare('INSERT INTO site_content(title,slug,content_type,summary,body,status,created_at,updated_at,published_at) VALUES(?,?,?,?,?,?,?,?,?)')
        .run(item.title, item.slug, item.content_type, item.summary, item.body, item.status, now, now, publishedAt);
      id = Number(result.lastInsertRowid);
    }
    const row = db.prepare('SELECT id,title,slug,content_type,summary,body,status,created_at,updated_at,published_at FROM site_content WHERE id=?').get(id);
    return res.status(existingId === null ? 201 : 200).json({ item: contentDto(row) });
  } catch (error) {
    if (String(error?.code || '').startsWith('SQLITE_CONSTRAINT')) return res.status(409).json({ error: 'That URL slug is already in use.' });
    console.error('Content save failed:', error?.message || 'unknown error');
    return res.status(500).json({ error: 'Could not save site content.' });
  }
}
app.post('/api/auth/admin/content', (req, res) => saveContent(req, res));
app.put('/api/auth/admin/content', (req, res) => {
  const id = Number(req.body?.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'A valid content ID is required for updates.' });
  return saveContent(req, res, id);
});

app.post('/api/auth/logout', (req, res) => {
  const token = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('meta_session='))?.slice('meta_session='.length);
  if (token) {
    try { db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(decodeURIComponent(token))); } catch { /* ignore malformed cookie */ }
  }
  res.clearCookie('meta_session', { httpOnly: true, secure: appOrigin.startsWith('https://'), sameSite: 'lax', path: '/' });
  res.json({ ok: true });
});

app.post('/api/auth/delete-account', (req, res) => {
  const user = sessionUser(req);
  const discordUser = readSession(req);

  if (!user && !discordUser) {
    return res.status(401).json({ error: 'Please sign in before deleting your Meta account.' });
  }

  if (user) {
    db.prepare('DELETE FROM users WHERE id=?').run(user.id);
  }

  res.clearCookie('meta_session', {
    httpOnly: true,
    secure: appOrigin.startsWith('https://'),
    sameSite: 'lax',
    path: '/',
  });
  clearCookie(res, COOKIE_NAME);
  return res.json({
    ok: true,
    deletedMetaAccount: Boolean(user),
    clearedDiscordSession: Boolean(discordUser),
  });
});



// Profile API: only the account owning the active email session can edit it.
app.get('/api/auth/profile', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const user = sessionUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to view your profile.' });
  const avatar = user.avatar_png;
  return res.json({
    profile: {
      email: user.email,
      displayName: user.display_name || '',
      username: user.username || '',
      avatarPng: avatar ? `data:image/png;base64,${Buffer.from(avatar).toString('base64')}` : null,
      googlePicture: user.google_picture || null
    }
  });
});

app.patch('/api/auth/profile', (req, res) => {
  const user = sessionUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to edit your profile.' });

  const body = req.body || {};
  const current = db.prepare('SELECT display_name, username, avatar_png FROM users WHERE id=?').get(user.id);
  let displayName = current.display_name || '';
  let username = current.username || '';
  let avatarPng = current.avatar_png || null;

  if (Object.hasOwn(body, 'displayName')) {
    if (typeof body.displayName !== 'string') return res.status(400).json({ error: 'Display name must be text.' });
    displayName = body.displayName.trim();
    if (displayName.length < 1 || displayName.length > 40) {
      return res.status(400).json({ error: 'Display name must be between 1 and 40 characters.' });
    }
  }

  if (Object.hasOwn(body, 'username')) {
    if (typeof body.username !== 'string') return res.status(400).json({ error: 'Username must be text.' });
    username = body.username.trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ error: 'Username must be 3–20 characters using letters, numbers, or underscores.' });
    }
    const taken = db.prepare('SELECT id FROM users WHERE username=? COLLATE NOCASE AND id<>?').get(username, user.id);
    if (taken) return res.status(409).json({ error: 'That username is already taken.' });
  }

  if (Object.hasOwn(body, 'avatarPng')) {
    if (body.avatarPng === null) {
      avatarPng = null;
    } else {
      if (typeof body.avatarPng !== 'string') return res.status(400).json({ error: 'Upload a PNG image.' });
      const match = body.avatarPng.match(/^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/);
      if (!match) return res.status(400).json({ error: 'Profile picture must be a PNG image.' });
      const image = Buffer.from(match[1], 'base64');
      const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      if (image.length < 8 || image.length > 1024 * 1024 || !image.subarray(0, 8).equals(pngSignature)) {
        return res.status(400).json({ error: 'PNG files must be valid PNGs no larger than 1 MB.' });
      }
      avatarPng = image;
    }
  }

  try {
    db.prepare('UPDATE users SET display_name=?, username=?, avatar_png=? WHERE id=?')
      .run(displayName || null, username || null, avatarPng, user.id);
  } catch (error) {
    if (String(error?.code || '').startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ error: 'That username is already taken.' });
    }
    console.error('Profile save failed:', error?.message || 'unknown error');
    return res.status(500).json({ error: 'Could not save profile changes.' });
  }

  return res.json({
    profile: {
      email: user.email,
      displayName,
      username,
      avatarPng: avatarPng ? `data:image/png;base64,${Buffer.from(avatarPng).toString('base64')}` : null,
      googlePicture: user.google_picture || null
    }
  });
});

app.get('/api/auth/google', (req, res) => {
  if (!googleOAuth) {
    return res.status(503).send('Google sign-in is not configured.');
  }

  const state = randomToken();
  res.cookie('meta_google_oauth_state', state, {
    httpOnly: true,
    secure: appOrigin.startsWith('https://'),
    sameSite: 'lax',
    path: '/api/auth/google',
    maxAge: 10 * 60 * 1000,
  });

  res.setHeader('Cache-Control', 'no-store');
  const url = googleOAuth.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'select_account',
  });

  return res.redirect(url);
});

app.get('/api/auth/google/callback', async (req, res) => {
  const stateCookie = String(req.headers.cookie || '')
    .split(';')
    .map(value => value.trim())
    .find(value => value.startsWith('meta_google_oauth_state='))
    ?.slice('meta_google_oauth_state='.length);

  const clearStateCookie = () => res.clearCookie(
    'meta_google_oauth_state',
    {
      httpOnly: true,
      secure: appOrigin.startsWith('https://'),
      sameSite: 'lax',
      path: '/api/auth/google',
    }
  );

  const receivedState = String(req.query.state || '');
  if (
    !stateCookie ||
    !receivedState ||
    stateCookie.length !== receivedState.length ||
    !crypto.timingSafeEqual(Buffer.from(stateCookie), Buffer.from(receivedState))
  ) {
    clearStateCookie();
    return res.status(400).send('Google sign-in could not be verified. Please try again.');
  }

  clearStateCookie();

  if (req.query.error || !req.query.code || !googleOAuth) {
    return res.redirect(`${appOrigin}/sign-in?google=error`);
  }

  try {
    const { tokens } = await googleOAuth.getToken(String(req.query.code));
    if (!tokens.id_token) {
      return res.redirect(`${appOrigin}/sign-in?google=error`);
    }

    const ticket = await googleOAuth.verifyIdToken({
      idToken: tokens.id_token,
      audience: googleClientId,
    });
    const profile = ticket.getPayload();

    const googleSub = String(profile?.sub || '');
    const email = normalizeEmail(profile?.email);
    const emailVerified = profile?.email_verified === true;
    const googlePicture = typeof profile?.picture === 'string' && profile.picture.startsWith('https://')
      ? profile.picture.slice(0, 2048)
      : null;

    if (!googleSub || !validEmail(email) || !emailVerified) {
      return res.redirect(`${appOrigin}/sign-in?google=error`);
    }

    let user = db.prepare('SELECT * FROM users WHERE google_sub=?').get(googleSub);
    if (user) {
      db.prepare('UPDATE users SET google_picture=? WHERE id=?').run(googlePicture, user.id);
      user = db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
    }

    if (!user) {
      user = db.prepare('SELECT * FROM users WHERE email=? COLLATE NOCASE').get(email);

      if (user && user.google_sub && user.google_sub !== googleSub) {
        return res.redirect(`${appOrigin}/sign-in?google=error`);
      }

      if (user) {
        db.prepare(
          'UPDATE users SET google_sub=?, google_picture=?, verified_at=COALESCE(verified_at, ?) WHERE id=?'
        ).run(googleSub, googlePicture, new Date().toISOString(), user.id);
        user = db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
      } else {
        const encodedPassword = await passwordHash(randomToken());
        const displayName = String(profile?.name || '').trim().slice(0, 40) || null;
        const result = db.prepare(`
          INSERT INTO users(email, password_hash, verified_at, created_at, display_name, google_sub, google_picture)
          VALUES(?, ?, ?, ?, ?, ?, ?)
        `).run(
          email,
          encodedPassword,
          new Date().toISOString(),
          new Date().toISOString(),
          displayName,
          googleSub,
          googlePicture
        );
        user = db.prepare('SELECT * FROM users WHERE id=?').get(Number(result.lastInsertRowid));
      }
    }

    setSession(res, user.id);
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(`${appOrigin}/user-portal`);
  } catch (error) {
    console.error('Google sign-in failed:', error?.message || 'unknown error');
    return res.redirect(`${appOrigin}/sign-in?google=error`);
  }
});
// Discord OAuth routes; existing email authentication remains unchanged.
app.get('/api/auth/discord', (req, res) => discordStart(req, res));
app.get('/api/auth/callback', async (req, res) => discordCallback(req, res));

app.get('/api/auth/discord/me', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const user = readSession(req);
  if (!user) return res.json({ authenticated: false, user: null });
  return res.json({
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.global_name,
      avatar: user.avatar,
      avatarUrl: user.avatar ? `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.id)}/${encodeURIComponent(user.avatar)}.png?size=128` : null
    }
  });
});

app.post('/api/auth/discord/logout', (_req, res) => {
  clearCookie(res, COOKIE_NAME);
  return res.json({ ok: true });
});

app.listen(port, '127.0.0.1', () => console.log(`Meta CodeLearn auth API listening on 127.0.0.1:${port}`));
