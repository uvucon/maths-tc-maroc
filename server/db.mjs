import Database from 'better-sqlite3'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, mkdirSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '../data')

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

const db = new Database(join(dataDir, 'database.db'))

db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    passwordHash TEXT,
    displayName TEXT,
    role TEXT DEFAULT 'student',
    createdAt TEXT,
    lastSeenAt TEXT
  );

  CREATE TABLE IF NOT EXISTS progress (
    userId TEXT PRIMARY KEY,
    payload TEXT,
    updatedAt TEXT,
    FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS planned_sessions (
    id TEXT PRIMARY KEY,
    userId TEXT,
    courseId TEXT,
    lessonId TEXT,
    start TEXT,
    durationMin INTEGER,
    color TEXT,
    notes TEXT,
    createdAt INTEGER
  );
  CREATE INDEX IF NOT EXISTS planned_sessions_user_start ON planned_sessions(userId, start);

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    userId TEXT,
    durationMin REAL,
    startedAt INTEGER,
    courseId TEXT
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`)

try {
  db.exec('ALTER TABLE users ADD COLUMN streak INTEGER DEFAULT 0')
} catch (e) {
  // Ignore if column already exists
}

try {
  db.exec('ALTER TABLE users ADD COLUMN deletedAt INTEGER')
} catch (e) {
  // Ignore if column already exists
}

export default db
