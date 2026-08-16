import test from 'node:test'
import assert from 'node:assert'
import express from 'express'
import { createAuthRouter } from '../server/auth.mjs'
import Database from 'better-sqlite3'
import crypto from 'node:crypto'

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    passwordHash TEXT,
    displayName TEXT,
    role TEXT DEFAULT 'student',
    createdAt TEXT,
    lastSeenAt TEXT
  );

  CREATE TABLE progress (
    userId TEXT PRIMARY KEY,
    payload TEXT,
    updatedAt TEXT,
    FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
  );
`)

const app = express()
app.use(express.json())
const jwtSecret = crypto.randomBytes(32).toString('hex')
app.use(createAuthRouter({ db, jwtSecret }))

async function request(method, path, body = null, tokenCookie = null) {
  const server = app.listen(0)
  const port = server.address().port
  try {
    const headers = {}
    if (body) headers['Content-Type'] = 'application/json'
    if (tokenCookie) headers['Cookie'] = tokenCookie

    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    })

    const setCookie = res.headers.get('set-cookie')
    let data
    try { data = await res.json() } catch { data = null }
    return { status: res.status, data, setCookie }
  } finally {
    server.close()
  }
}

test('Auth Integration Flow', async (t) => {
  let tokenCookie

  await t.test('POST /api/auth/register', async () => {
    const res = await request('POST', '/api/auth/register', { email: 'test@example.com', password: 'password123', displayName: 'Test User' })
    assert.strictEqual(res.status, 200)
    assert.ok(res.data.user.id)
    assert.strictEqual(res.data.user.email, 'test@example.com')
    assert.strictEqual(res.data.user.displayName, 'Test User')
    assert.ok(res.setCookie.includes('token='))
    tokenCookie = res.setCookie.split(';')[0]
  })

  await t.test('POST /api/auth/register - email exists', async () => {
    const res = await request('POST', '/api/auth/register', { email: 'test@example.com', password: 'password123', displayName: 'Test User 2' })
    assert.strictEqual(res.status, 400)
    assert.strictEqual(res.data.error, 'Email already exists')
  })

  await t.test('POST /api/auth/login', async () => {
    const res = await request('POST', '/api/auth/login', { email: 'test@example.com', password: 'password123' })
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data.user.email, 'test@example.com')
    assert.ok(res.setCookie.includes('token='))
    tokenCookie = res.setCookie.split(';')[0]
  })

  await t.test('POST /api/auth/login - wrong password', async () => {
    const res = await request('POST', '/api/auth/login', { email: 'test@example.com', password: 'wrongpassword' })
    assert.strictEqual(res.status, 400)
    assert.strictEqual(res.data.error, 'Invalid credentials')
  })

  await t.test('GET /api/me', async () => {
    const res = await request('GET', '/api/me', null, tokenCookie)
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data.email, 'test@example.com')
  })

  await t.test('GET /api/me - unauthorized', async () => {
    const res = await request('GET', '/api/me')
    assert.strictEqual(res.status, 401)
  })

  await t.test('PUT /api/me/progress', async () => {
    const progress = { completed: ['c1'], resumeId: 'c2', streak: 5, focusSessions: 1, lessonChecks: { c1: [0, 1] }, quizScores: { c1: 100 } }
    const res = await request('PUT', '/api/me/progress', progress, tokenCookie)
    assert.strictEqual(res.status, 200)
    assert.deepStrictEqual(res.data, progress)
  })

  await t.test('GET /api/me/progress', async () => {
    const res = await request('GET', '/api/me/progress', null, tokenCookie)
    assert.strictEqual(res.status, 200)
    assert.deepStrictEqual(res.data.completed, ['c1'])
    assert.strictEqual(res.data.resumeId, 'c2')
    assert.strictEqual(res.data.streak, 5)
  })

  await t.test('POST /api/auth/logout', async () => {
    const res = await request('POST', '/api/auth/logout', null, tokenCookie)
    assert.strictEqual(res.status, 200)
    assert.ok(res.setCookie.includes('token=;'))
  })
})
