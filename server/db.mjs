import { DatabaseSync } from 'node:sqlite'

export function createDb(filename = ':memory:') {
  const db = new DatabaseSync(filename)

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT,
      displayName TEXT,
      role TEXT,
      createdAt INTEGER,
      lastSeenAt INTEGER,
      streak INTEGER DEFAULT 0,
      deletedAt INTEGER
    );
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

  return db
}
