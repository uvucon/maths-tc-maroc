import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createDb } from '../server/db.mjs'
import { createCalendarRouter } from '../server/calendar.mjs'

function requireAuth(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || auth !== 'Bearer valid') return res.status(401).json({ error: 'Unauthorized' })
  req.user = { id: 'test-user' }
  next()
}

test('calendar endpoints', async (t) => {
  const db = createDb()
  const app = express()
  app.use(express.json())
  app.use('/api/calendar', createCalendarRouter({ db, requireAuth }))

  const server = app.listen(0)
  const port = server.address().port
  const base = `http://127.0.0.1:${port}`

  try {
    // Unauth test
    const unauthRes = await fetch(`${base}/api/calendar/sessions`)
    assert.equal(unauthRes.status, 401)

    // Create
    const createRes = await fetch(`${base}/api/calendar/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
      body: JSON.stringify({
        courseId: 'ensembles-nombres',
        start: new Date().toISOString(),
        durationMin: 30,
        color: 'blue'
      })
    })
    assert.equal(createRes.status, 201)
    const created = await createRes.json()
    assert.equal(created.durationMin, 30)

    // List
    const listRes = await fetch(`${base}/api/calendar/sessions`, {
      headers: { Authorization: 'Bearer valid' }
    })
    const list = await listRes.json()
    assert.equal(list.length, 1)
    assert.equal(list[0].id, created.id)

    // Update
    const updateRes = await fetch(`${base}/api/calendar/sessions/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
      body: JSON.stringify({ durationMin: 60 })
    })
    assert.equal(updateRes.status, 200)
    const updated = await updateRes.json()
    assert.equal(updated.durationMin, 60)

    // Delete
    const delRes = await fetch(`${base}/api/calendar/sessions/${created.id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid' }
    })
    assert.equal(delRes.status, 200)

    // List empty
    const listEmpty = await fetch(`${base}/api/calendar/sessions`, {
      headers: { Authorization: 'Bearer valid' }
    })
    const empty = await listEmpty.json()
    assert.equal(empty.length, 0)

  } finally {
    server.close()
  }
})
