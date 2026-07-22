import 'dotenv/config'
import { createApp } from './server-lib.mjs'

const port = Number.parseInt(process.env.PORT || '4173', 10)
const host = process.env.HOST || '127.0.0.1'
const app = createApp()

app.listen(port, host, () => {
  console.log(`MathSprint TC disponible sur http://${host}:${port}`)
})
