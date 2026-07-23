import 'dotenv/config'
import { createApp } from './server-lib.mjs'
import { createDb } from './server/db.mjs'
import { createAdminRouter } from './server/admin.mjs'
import { createHmac, randomBytes } from 'node:crypto'

const port = Number.parseInt(process.env.PORT || '4173', 10)
const host = process.env.HOST || '127.0.0.1'

const db = createDb()

function base64url(str) {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  const parts = token.split('.');
  if (parts.length !== 3) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
     return res.status(500).json({ error: 'Server misconfiguration' });
  }

  const signature = createHmac('sha256', secret).update(parts[0] + '.' + parts[1]).digest('base64url');
  if (signature !== parts[2]) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (payload.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  req.user = payload;
  next();
};

const app = createApp()

app.use('/api/admin', createAdminRouter({ db, requireAdmin }));

if (process.env.ADMIN_EMAIL) {
  const stmt = db.prepare('SELECT count(*) as count FROM users WHERE role = ? AND deletedAt IS NULL');
  const { count } = stmt.get('admin');

  if (count === 0) {
    const email = process.env.ADMIN_EMAIL;
    const password = randomBytes(16).toString('hex');

    db.prepare(`
      INSERT INTO users (id, email, password, displayName, role, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('bootstrap-admin', email, password, 'Admin', 'admin', Date.now());

    console.log(`BOOTSTRAP-ADMIN: ${email} / ${password}`);
  }
}

app.listen(port, host, () => {
  console.log(`MathSprint TC disponible sur http://${host}:${port}`)
})
