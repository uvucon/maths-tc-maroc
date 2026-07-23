import test from 'node:test'
import assert from 'node:assert'
import { createDb } from '../server/db.mjs'
import { createAdminRouter } from '../server/admin.mjs'
import express from 'express'

async function withAdminServer(app, run) {
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const { port } = server.address()
  try { await run(`http://127.0.0.1:${port}`) } finally { await new Promise(resolve => server.close(resolve)) }
}

function setupApp(db) {
  const app = express();
  app.use(express.json());
  const requireAdmin = (req, res, next) => next();
  app.use('/api/admin', createAdminRouter({ db, requireAdmin }));
  return app;
}

test('admin router initialization', () => {
  const db = createDb()
  const router = createAdminRouter({ db, requireAdmin: (req, res, next) => next() })
  assert.ok(router)
})

test('GET /users returns users without deletedAt', async () => {
  const db = createDb();
  db.prepare('INSERT INTO users (id, email, role, createdAt) VALUES (?, ?, ?, ?)').run('u1', 'u1@t', 'admin', 100);
  db.prepare('INSERT INTO users (id, email, role, createdAt, deletedAt) VALUES (?, ?, ?, ?, ?)').run('u2', 'u2@t', 'user', 200, 300);

  const app = setupApp(db);
  await withAdminServer(app, async base => {
    const res = await fetch(`${base}/api/admin/users`);
    const users = await res.json();
    assert.equal(users.length, 1);
    assert.equal(users[0].id, 'u1');
  });
});

test('PUT /users/:id cannot demote last admin', async () => {
  const db = createDb();
  db.prepare('INSERT INTO users (id, email, role, createdAt) VALUES (?, ?, ?, ?)').run('admin1', 'a1@t', 'admin', 100);

  const app = setupApp(db);
  await withAdminServer(app, async base => {
    const res = await fetch(`${base}/api/admin/users/admin1`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'user' })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'Cannot demote last admin');

    // Add second admin and demotion should succeed
    db.prepare('INSERT INTO users (id, email, role, createdAt) VALUES (?, ?, ?, ?)').run('admin2', 'a2@t', 'admin', 100);
    const res2 = await fetch(`${base}/api/admin/users/admin1`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'user' })
    });
    assert.equal(res2.status, 200);
  });
});

test('DELETE /users/:id cascades and soft deletes', async () => {
  const db = createDb();
  db.prepare('INSERT INTO users (id, email, role, createdAt) VALUES (?, ?, ?, ?)').run('admin1', 'a1@t', 'admin', 100);
  db.prepare('INSERT INTO users (id, email, role, createdAt) VALUES (?, ?, ?, ?)').run('user1', 'u1@t', 'user', 100);
  db.prepare('INSERT INTO sessions (id, userId, startedAt) VALUES (?, ?, ?)').run('s1', 'user1', 200);

  const app = setupApp(db);
  await withAdminServer(app, async base => {
    const res = await fetch(`${base}/api/admin/users/user1`, { method: 'DELETE' });
    assert.equal(res.status, 200);

    const user = db.prepare('SELECT deletedAt FROM users WHERE id = ?').get('user1');
    assert.ok(user.deletedAt !== null);

    const sessionCount = db.prepare('SELECT count(*) as c FROM sessions WHERE userId = ?').get('user1').c;
    assert.equal(sessionCount, 0);
  });
});

test('GET /analytics returns correct stats structure', async () => {
  const db = createDb();
  db.prepare('INSERT INTO users (id, email, role, createdAt, lastSeenAt, streak) VALUES (?, ?, ?, ?, ?, ?)').run('u1', 'u1@t', 'user', Date.now(), Date.now(), 5);
  db.prepare('INSERT INTO sessions (id, userId, durationMin, startedAt, courseId) VALUES (?, ?, ?, ?, ?)').run('s1', 'u1', 10, Date.now(), 'math101');

  const app = setupApp(db);
  await withAdminServer(app, async base => {
    const res = await fetch(`${base}/api/admin/analytics`);
    const data = await res.json();
    assert.equal(data.totalUsers, 1);
    assert.equal(data.totalSessions, 1);
    assert.equal(data.avgSessionDurationMin, 10);
    assert.equal(data.topCourses[0], 'math101');
    assert.equal(data.streakHistogram['4-7'], 1);
    assert.equal(data.dailyActiveLast14d[13], 1); // today is last element
  });
});

test('GET /analytics degraded path on timeout', async () => {
  const db = createDb();
  const app = setupApp(db);

  // Override db.prepare to simulate a slow query that triggers timeout
  const originalPrepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    const stmt = originalPrepare(sql);
    const originalAll = stmt.all.bind(stmt);
    const originalGet = stmt.get.bind(stmt);

    // Simulate a blocking sleep to trigger the checkTimeout
    stmt.get = (...params) => {
      const end = Date.now() + 1050;
      while (Date.now() < end) {} // block thread
      return originalGet(...params);
    };
    stmt.all = (...params) => {
      const end = Date.now() + 1050;
      while (Date.now() < end) {} // block thread
      return originalAll(...params);
    };
    return stmt;
  };

  await withAdminServer(app, async base => {
    const res = await fetch(`${base}/api/admin/analytics`);
    const data = await res.json();
    assert.equal(data.degraded, true);
  });
});

test('GET /themes returns presets', async () => {
  const db = createDb();
  const app = setupApp(db);
  await withAdminServer(app, async base => {
    const res = await fetch(`${base}/api/admin/themes`);
    const data = await res.json();
    assert.equal(data.length, 3);
    assert.equal(data[0].id, 'saffron');
  });
});

test('PUT /themes updates settings and GET /settings retrieves them', async () => {
  const db = createDb();
  const app = setupApp(db);
  await withAdminServer(app, async base => {
    const putRes = await fetch(`${base}/api/admin/themes`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ themeId: 'cactus', vars: { '--primary': '#000' } })
    });
    assert.equal(putRes.status, 200);

    const getRes = await fetch(`${base}/api/admin/settings`);
    const data = await getRes.json();
    assert.equal(data.activeThemeId, 'cactus');
    assert.equal(data.themeVars['--primary'], '#000');
  });
});
