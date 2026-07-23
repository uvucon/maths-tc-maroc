import express from 'express'
import { randomUUID } from 'node:crypto'

export function createCalendarRouter({ db, requireAuth }) {
  const router = express.Router()

  router.use(requireAuth)

  router.get('/sessions', (req, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM planned_sessions WHERE userId = ? ORDER BY start ASC')
      const rows = stmt.all(req.user.userId || req.user.id || 'default_user_id')
      res.json(rows)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Database error' })
    }
  })

  router.post('/sessions', (req, res) => {
    const { courseId, lessonId, start, durationMin, color, notes } = req.body

    // Validate durationMin
    if (![15, 30, 45, 60, 90].includes(durationMin)) {
      return res.status(400).json({ error: 'Invalid durationMin' })
    }

    // Validate color
    if (!['blue', 'green', 'orange', 'pink', 'violet'].includes(color)) {
      return res.status(400).json({ error: 'Invalid color' })
    }

    // Validate start
    if (isNaN(Date.parse(start))) {
      return res.status(400).json({ error: 'Invalid start date' })
    }

    const id = randomUUID()
    const createdAt = Date.now()
    const userId = req.user.userId || req.user.id || 'default_user_id'

    try {
      const stmt = db.prepare('INSERT INTO planned_sessions (id, userId, courseId, lessonId, start, durationMin, color, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      stmt.run(id, userId, courseId, lessonId || null, start, durationMin, color, notes || '', createdAt)
      res.status(201).json({ id, courseId, lessonId, start, durationMin, color, notes, createdAt })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Database error' })
    }
  })

  router.put('/sessions/:id', (req, res) => {
    const { id } = req.params
    const { courseId, lessonId, start, durationMin, color, notes } = req.body

    // Validate durationMin
    if (durationMin !== undefined && ![15, 30, 45, 60, 90].includes(durationMin)) {
      return res.status(400).json({ error: 'Invalid durationMin' })
    }

    // Validate color
    if (color !== undefined && !['blue', 'green', 'orange', 'pink', 'violet'].includes(color)) {
      return res.status(400).json({ error: 'Invalid color' })
    }

    // Validate start
    if (start !== undefined && isNaN(Date.parse(start))) {
      return res.status(400).json({ error: 'Invalid start date' })
    }

    const userId = req.user.userId || req.user.id || 'default_user_id'

    try {
      const checkStmt = db.prepare('SELECT id FROM planned_sessions WHERE id = ? AND userId = ?')
      const existing = checkStmt.get(id, userId)
      if (!existing) return res.status(404).json({ error: 'Session not found' })

      const stmt = db.prepare('UPDATE planned_sessions SET courseId = COALESCE(?, courseId), lessonId = COALESCE(?, lessonId), start = COALESCE(?, start), durationMin = COALESCE(?, durationMin), color = COALESCE(?, color), notes = COALESCE(?, notes) WHERE id = ? AND userId = ?')
      stmt.run(courseId || null, lessonId || null, start || null, durationMin || null, color || null, notes || null, id, userId)

      const getStmt = db.prepare('SELECT * FROM planned_sessions WHERE id = ?')
      res.json(getStmt.get(id))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Database error' })
    }
  })

  router.delete('/sessions/:id', (req, res) => {
    const { id } = req.params
    const userId = req.user.userId || req.user.id || 'default_user_id'

    try {
      const checkStmt = db.prepare('SELECT id FROM planned_sessions WHERE id = ? AND userId = ?')
      const existing = checkStmt.get(id, userId)
      if (!existing) return res.status(404).json({ error: 'Session not found' })

      const stmt = db.prepare('DELETE FROM planned_sessions WHERE id = ? AND userId = ?')
      stmt.run(id, userId)
      res.json({ success: true })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Database error' })
    }
  })

  return router
}
