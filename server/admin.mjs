import express from 'express';

const THEME_PRESETS = [
  { id: 'saffron', name: 'Saffron', vars: { '--primary': '#f4a261', '--bg': '#fff' } },
  { id: 'cactus', name: 'Cactus', vars: { '--primary': '#2a9d8f', '--bg': '#fff' } },
  { id: 'mediterranee', name: 'Méditerranée', vars: { '--primary': '#023e8a', '--bg': '#fff' } }
];

export function createAdminRouter({ db, requireAdmin }) {
  const router = express.Router();

  router.use(requireAdmin);

  router.get('/users', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const stmt = db.prepare('SELECT id, email, displayName, role, createdAt, lastSeenAt, deletedAt FROM users WHERE deletedAt IS NULL ORDER BY createdAt DESC LIMIT ? OFFSET ?');
    const users = stmt.all(limit, offset);
    res.json(users);
  });

  router.put('/users/:id', (req, res) => {
    const { role, displayName } = req.body;
    const { id } = req.params;

    if (role === 'user') {
      const stmt = db.prepare('SELECT count(*) as count FROM users WHERE role = ? AND deletedAt IS NULL');
      const { count } = stmt.get('admin');
      const targetStmt = db.prepare('SELECT role FROM users WHERE id = ?');
      const target = targetStmt.get(id);
      if (target && target.role === 'admin' && count <= 1) {
        return res.status(400).json({ error: 'Cannot demote last admin' });
      }
    }

    const updates = [];
    const params = [];
    if (role) { updates.push('role = ?'); params.push(role); }
    if (displayName) { updates.push('displayName = ?'); params.push(displayName); }
    if (updates.length > 0) {
      params.push(id);
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    res.json({ success: true });
  });

  router.delete('/users/:id', (req, res) => {
    const { id } = req.params;

    const stmt = db.prepare('SELECT count(*) as count FROM users WHERE role = ? AND deletedAt IS NULL');
    const { count } = stmt.get('admin');
    const targetStmt = db.prepare('SELECT role FROM users WHERE id = ?');
    const target = targetStmt.get(id);
    if (target && target.role === 'admin' && count <= 1) {
      return res.status(400).json({ error: 'Cannot delete last admin' });
    }

    db.prepare('UPDATE users SET deletedAt = ? WHERE id = ?').run(Date.now(), id);
    db.prepare('DELETE FROM sessions WHERE userId = ?').run(id);

    res.json({ success: true });
  });

  router.get('/analytics', (req, res) => {
    const startTime = Date.now();
    try {
      const checkTimeout = () => {
        if (Date.now() - startTime >= 1000) throw new Error('timeout');
      };

      const query = (sql, ...params) => {
         const result = db.prepare(sql).all(...params);
         checkTimeout();
         return result;
      };

      const getOne = (sql, ...params) => {
         const result = db.prepare(sql).get(...params);
         checkTimeout();
         return result;
      };

      const totalUsers = getOne('SELECT count(*) as c FROM users WHERE deletedAt IS NULL').c;

      const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
      const newUsersLast7d = getOne('SELECT count(*) as c FROM users WHERE createdAt >= ? AND deletedAt IS NULL', sevenDaysAgo).c;

      const activeUsersLast7d = getOne('SELECT count(*) as c FROM users WHERE lastSeenAt >= ? AND deletedAt IS NULL', sevenDaysAgo).c;

      const totalSessions = getOne('SELECT count(*) as c FROM sessions').c;

      const usersWithSessions = getOne('SELECT count(DISTINCT userId) as c FROM sessions').c;
      const avgSessionsPerUser = usersWithSessions > 0 ? totalSessions / usersWithSessions : 0;

      const avgSessionDurationMin = getOne('SELECT avg(durationMin) as a FROM sessions').a || 0;

      const topCourses = query('SELECT courseId, count(*) as c FROM sessions GROUP BY courseId ORDER BY c DESC LIMIT 5').map(r => r.courseId);

      const streaks = query('SELECT streak, count(*) as c FROM users WHERE deletedAt IS NULL GROUP BY streak');
      const streakHistogram = { '0': 0, '1': 0, '2-3': 0, '4-7': 0, '8-14': 0, '15+': 0 };
      for (const row of streaks) {
        if (row.streak === 0) streakHistogram['0'] += row.c;
        else if (row.streak === 1) streakHistogram['1'] += row.c;
        else if (row.streak <= 3) streakHistogram['2-3'] += row.c;
        else if (row.streak <= 7) streakHistogram['4-7'] += row.c;
        else if (row.streak <= 14) streakHistogram['8-14'] += row.c;
        else streakHistogram['15+'] += row.c;
      }

      const dailyActiveLast14d = Array(14).fill(0);
      const fourteenDaysAgo = Date.now() - 14 * 24 * 3600 * 1000;
      const sessions14d = query('SELECT startedAt, userId FROM sessions WHERE startedAt >= ?', fourteenDaysAgo);
      const dayBuckets = {};
      const msPerDay = 24 * 3600 * 1000;
      for (const s of sessions14d) {
        const dayIdx = 13 - Math.floor((Date.now() - s.startedAt) / msPerDay);
        if (dayIdx >= 0 && dayIdx < 14) {
          if (!dayBuckets[dayIdx]) dayBuckets[dayIdx] = new Set();
          dayBuckets[dayIdx].add(s.userId);
        }
      }
      for (let i = 0; i < 14; i++) {
        if (dayBuckets[i]) dailyActiveLast14d[i] = dayBuckets[i].size;
      }

      res.json({
        totalUsers, newUsersLast7d, activeUsersLast7d, totalSessions,
        avgSessionsPerUser, avgSessionDurationMin, topCourses,
        streakHistogram, dailyActiveLast14d
      });
    } catch (e) {
      res.json({ degraded: true });
    }
  });

  router.get('/themes', (req, res) => {
    res.json(THEME_PRESETS);
  });

  router.put('/themes', (req, res) => {
    const { themeId, vars } = req.body;
    db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run('activeThemeId', themeId);
    if (vars) {
      db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run('themeVars', JSON.stringify(vars));
    }
    res.json({ success: true });
  });

  router.get('/settings', (req, res) => {
    const themeIdRow = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('activeThemeId');
    const varsRow = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('themeVars');
    res.json({
      activeThemeId: themeIdRow ? themeIdRow.value : 'saffron',
      themeVars: varsRow ? JSON.parse(varsRow.value) : null
    });
  });

  return router;
}
