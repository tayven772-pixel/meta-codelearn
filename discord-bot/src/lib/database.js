import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);

const dataDir = path.join(projectDir, 'data');
fs.mkdirSync(dataDir, { recursive: true, mode: 0o2770 });

const db = new Database(path.join(dataDir, 'meta-codelearn.sqlite'));
fs.chmodSync(path.join(dataDir, 'meta-codelearn.sqlite'), 0o660);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    guild_id TEXT NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, setting_key)
  );

  CREATE TABLE IF NOT EXISTS bot_guild_presence (
    guild_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    status TEXT NOT NULL DEFAULT 'open'
      CHECK (status IN ('open', 'closed')),
    claimed_by TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS tickets_guild_status
    ON tickets (guild_id, status);

  CREATE INDEX IF NOT EXISTS tickets_user_status
    ON tickets (guild_id, user_id, status);

  CREATE TABLE IF NOT EXISTS application_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    question TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    UNIQUE (guild_id, position)
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'approved', 'rejected')),
    answers_json TEXT NOT NULL,
    reviewer_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS applications_guild_status
    ON applications (guild_id, status);
`);

const getSettingStatement = db.prepare(
  'SELECT setting_value FROM settings WHERE guild_id = ? AND setting_key = ?'
);

const setSettingStatement = db.prepare(`
  INSERT INTO settings (guild_id, setting_key, setting_value, updated_at)
  VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT (guild_id, setting_key)
  DO UPDATE SET
    setting_value = excluded.setting_value,
    updated_at = CURRENT_TIMESTAMP
`);

export function getSetting(guildId, key) {
  // Prefer global bot settings; retain guild-specific values only as a fallback
  // for settings that existed before the bot control panel became global.
  const globalRow = getSettingStatement.get('global', key);
  if (globalRow) return globalRow.setting_value;
  const row = getSettingStatement.get(guildId, key);
  return row ? row.setting_value : null;
}

export function setSetting(guildId, key, value) {
  setSettingStatement.run(guildId, key, String(value));
}

export function getSettings(guildId) {
  return db.prepare(
    'SELECT setting_key, setting_value, updated_at FROM settings WHERE guild_id = ? ORDER BY setting_key'
  ).all(guildId);
}

export function addQuestion(guildId, question) {
  const next = db.prepare(
    'SELECT COALESCE(MAX(position), 0) + 1 AS position FROM application_questions WHERE guild_id = ?'
  ).get(guildId).position;

  return db.prepare(
    'INSERT INTO application_questions (guild_id, position, question) VALUES (?, ?, ?)'
  ).run(guildId, next, question).lastInsertRowid;
}

export function getQuestions(guildId) {
  return db.prepare(
    'SELECT id, position, question, enabled FROM application_questions WHERE guild_id = ? ORDER BY position'
  ).all(guildId);
}

export function closeDatabase() {
  db.close();
}

export { db };
