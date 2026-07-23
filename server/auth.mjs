import express from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'

function base64url(str) {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function createToken(payload, secret) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const data = base64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }))
  const signature = base64url(crypto.createHmac('sha256', secret).update(`${header}.${data}`).digest())
  return `${header}.${data}.${signature}`
}

function verifyToken(token, secret) {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, data, signature] = parts
  const expectedSignature = base64url(crypto.createHmac('sha256', secret).update(`${header}.${data}`).digest())
  if (signature !== expectedSignature) return null
  try {
    return JSON.parse(Buffer.from(data, 'base64').toString())
  } catch {
    return null
  }
}

function createLimiter({ max = 20, windowMs = 15 * 60 * 1000 } = {}) {
  const clients = new Map()
  return (req, res, next) => {
    const now = Date.now()
    const key = req.ip || req.socket.remoteAddress || 'unknown'
    let entry = clients.get(key)
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs }
      clients.set(key, entry)
    }
    entry.count += 1
    if (entry.count > max) {
      return res.status(429).json({ error: 'Too many requests' })
    }
    next()
  }
}

function cookieExtractor(req) {
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split('=')
    acc[name] = value
    return acc
  }, {})
  return cookies.token
}

export function createAuthRouter({ db, jwtSecret }) {
  const router = express.Router()

  const limiter = createLimiter()

  const authMiddleware = (req, res, next) => {
    const token = cookieExtractor(req)
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    const payload = verifyToken(token, jwtSecret)
    if (!payload || !payload.id) return res.status(401).json({ error: 'Unauthorized' })
    req.userId = payload.id
    next()
  }

  router.post('/api/auth/register', limiter, (req, res) => {
    const { email, password, displayName } = req.body
    if (!email || !password || !displayName) return res.status(400).json({ error: 'Missing fields' })

    try {
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
      if (existingUser) return res.status(400).json({ error: 'Email already exists' })

      const id = crypto.randomUUID()
      const passwordHash = bcrypt.hashSync(password, 10)
      const now = new Date().toISOString()

      db.prepare('INSERT INTO users (id, email, passwordHash, displayName, role, createdAt, lastSeenAt) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, email, passwordHash, displayName, 'student', now, now)

      const user = db.prepare('SELECT id, email, displayName, role, createdAt, lastSeenAt FROM users WHERE id = ?').get(id)
      const token = createToken({ id }, jwtSecret)

      res.cookie('token', token, { httpOnly: true, sameSite: 'lax' })
      res.json({ user, token })
    } catch (e) {
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  router.post('/api/auth/login', limiter, (req, res) => {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' })

    const userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
    if (!userRow) return res.status(400).json({ error: 'Invalid credentials' })

    const isValid = bcrypt.compareSync(password, userRow.passwordHash)
    if (!isValid) return res.status(400).json({ error: 'Invalid credentials' })

    const now = new Date().toISOString()
    db.prepare('UPDATE users SET lastSeenAt = ? WHERE id = ?').run(now, userRow.id)

    const user = { id: userRow.id, email: userRow.email, displayName: userRow.displayName, role: userRow.role, createdAt: userRow.createdAt, lastSeenAt: now }
    const token = createToken({ id: user.id }, jwtSecret)

    res.cookie('token', token, { httpOnly: true, sameSite: 'lax' })
    res.json({ user, token })
  })

  router.post('/api/auth/logout', limiter, (req, res) => {
    res.clearCookie('token', { httpOnly: true, sameSite: 'lax' })
    res.json({ success: true })
  })

  router.get('/api/me', authMiddleware, (req, res) => {
    const user = db.prepare('SELECT id, email, displayName, role, createdAt, lastSeenAt FROM users WHERE id = ?').get(req.userId)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })
    res.json(user)
  })

  router.put('/api/me', authMiddleware, (req, res) => {
    const { displayName, password } = req.body

    if (displayName) {
      db.prepare('UPDATE users SET displayName = ? WHERE id = ?').run(displayName, req.userId)
    }
    if (password) {
      const passwordHash = bcrypt.hashSync(password, 10)
      db.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').run(passwordHash, req.userId)
    }

    const user = db.prepare('SELECT id, email, displayName, role, createdAt, lastSeenAt FROM users WHERE id = ?').get(req.userId)
    res.json(user)
  })

  router.get('/api/me/progress', authMiddleware, (req, res) => {
    const progressRow = db.prepare('SELECT payload FROM progress WHERE userId = ?').get(req.userId)
    if (!progressRow) {
      return res.json({ completed: [], resumeId: 'ensembles-nombres', streak: 0, focusSessions: 0, lessonChecks: {}, quizScores: {} })
    }
    try {
      res.json(JSON.parse(progressRow.payload))
    } catch {
      res.json({ completed: [], resumeId: 'ensembles-nombres', streak: 0, focusSessions: 0, lessonChecks: {}, quizScores: {} })
    }
  })

  router.put('/api/me/progress', authMiddleware, (req, res) => {
    const payloadStr = JSON.stringify(req.body)
    const now = new Date().toISOString()

    db.prepare('INSERT INTO progress (userId, payload, updatedAt) VALUES (?, ?, ?) ON CONFLICT(userId) DO UPDATE SET payload=excluded.payload, updatedAt=excluded.updatedAt').run(req.userId, payloadStr, now)

    res.json(req.body)
  })

  return router
}
