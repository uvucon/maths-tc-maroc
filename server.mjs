import 'dotenv/config'
import { createApp, lateMiddleware } from './server-lib.mjs'
import db from './server/db.mjs'
import { createAuthRouter } from './server/auth.mjs'
import { createCalendarRouter } from './server/calendar.mjs'
import crypto from 'node:crypto'

const port = Number.parseInt(process.env.PORT || '4173', 10)
const host = process.env.HOST || '127.0.0.1'
const app = createApp()

let jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) {
  jwtSecret = crypto.randomBytes(32).toString('hex')
  console.warn('⚠️  JWT_SECRET manquant. Utilisation d’un secret aléatoire (les sessions seront perdues au redémarrage).')
}

const authRouter = createAuthRouter({ db, jwtSecret })
const authMiddleware = authRouter.stack.find(layer => layer.route && layer.route.path === '/api/me')?.route.stack[0].handle

app.use(authRouter)
app.use('/api/calendar', createCalendarRouter({ db, authMiddleware }))

lateMiddleware(app)

app.listen(port, host, () => {
  console.log(`MathSprint TC disponible sur http://${host}:${port}`)
})
