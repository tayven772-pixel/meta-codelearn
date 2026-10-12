import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.AUTH_PORT || 3001);
const appOrigin = (process.env.APP_ORIGIN || 'https://metasupportcom.dbm.shared-servers.com').replace(/\/$/, '');
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

const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_APP_PASSWORD },
});
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '12kb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }));

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('base64url');
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
const publicUser = (user) => ({ id: user.id, email: user.email, verified: Boolean(user.verified_at) });

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
  if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) return res.status(409).json({ error: 'An account with that email already exists. Try signing in instead.' });

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

app.get('/api/auth/verify', (req, res) => {
  const token = String(req.query.token || '');
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return res.status(400).json({ error: 'This verification link is invalid or expired.' });
  const row = db.prepare('SELECT user_id,expires_at FROM email_tokens WHERE token_hash=?').get(hash(token));
  if (!row || row.expires_at < Date.now()) {
    if (row) db.prepare('DELETE FROM email_tokens WHERE token_hash=?').run(hash(token));
    return res.status(400).json({ error: 'This verification link is invalid or expired. Please register again.' });
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
app.post('/api/auth/logout', (req, res) => {
  const token = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('meta_session='))?.slice('meta_session='.length);
  if (token) {
    try { db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(decodeURIComponent(token))); } catch { /* ignore malformed cookie */ }
  }
  res.clearCookie('meta_session', { httpOnly: true, secure: appOrigin.startsWith('https://'), sameSite: 'lax', path: '/' });
  res.json({ ok: true });
});

app.listen(port, '127.0.0.1', () => console.log(`Meta CodeLearn auth API listening on 127.0.0.1:${port}`));
