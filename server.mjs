import 'dotenv/config'
import { createApp } from './server-lib.mjs'
import db from './server/db.mjs'
import { createAuthRouter } from './server/auth.mjs'
import crypto from 'node:crypto'

const port = Number.parseInt(process.env.PORT || '4173', 10)
const host = process.env.HOST || '127.0.0.1'
const app = createApp()

let jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) {
  jwtSecret = crypto.randomBytes(32).toString('hex')
  console.warn('⚠️  JWT_SECRET manquant. Utilisation d’un secret aléatoire (les sessions seront perdues au redémarrage).')
}

app.use(createAuthRouter({ db, jwtSecret }))

app.listen(port, host, () => {
  console.log(`MathSprint TC disponible sur http://${host}:${port}`)
})
