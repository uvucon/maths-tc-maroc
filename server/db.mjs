import { DatabaseSync } from 'node:sqlite'

let dbInstance = null

export function createDb() {
  if (dbInstance) return dbInstance
  const db = new DatabaseSync('mathsprint.db')

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT
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
  `)

  dbInstance = db
  return db
}
