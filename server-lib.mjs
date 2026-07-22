import express from 'express'
import multer from 'multer'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { timingSafeEqual } from 'node:crypto'

const here = dirname(fileURLToPath(import.meta.url))
const catalog = JSON.parse(readFileSync(join(here, 'shared/exercises.json'), 'utf8'))
const exercises = new Map(catalog.map(exercise => [`${exercise.courseId}:${exercise.id}`, exercise]))
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_ANSWER_LENGTH = 20_000

function cleanString(value, label, { max = 500, required = true } = {}) {
  if (typeof value !== 'string') throw new Error(`${label} invalide.`)
  const clean = value.trim()
  if (required && !clean) throw new Error(`${label} requis.`)
  if (clean.length > max) throw new Error(`${label} trop long.`)
  return clean
}

function cleanBaseUrl(value) {
  const baseUrl = cleanString(value, 'URL de base', { max: 2_000 }).replace(/\/+$/, '')
  let parsed
  try { parsed = new URL(baseUrl) } catch { throw new Error('URL de base invalide.') }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Une URL HTTP ou HTTPS est requise.')
  if (parsed.username || parsed.password) throw new Error('Les identifiants sont interdits dans l’URL de base.')
  return baseUrl
}

export function validateConfigPatch(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Configuration invalide.')
  const allowed = new Set(['baseUrl', 'model', 'apiKey'])
  if (Object.keys(body).some(key => !allowed.has(key))) throw new Error('Champ de configuration inconnu.')
  const patch = {
    baseUrl: cleanBaseUrl(body.baseUrl),
    model: cleanString(body.model, 'Le modèle', { max: 200 }),
  }
  if (body.apiKey !== undefined && body.apiKey !== '') patch.apiKey = cleanString(body.apiKey, 'La clé API', { max: 4_000 })
  return patch
}

export function createRuntimeConfig(env = process.env) {
  let baseUrl
  try { baseUrl = cleanBaseUrl(env.LLM_BASE_URL || 'https://api.openai.com/v1') } catch { baseUrl = 'https://api.openai.com/v1' }
  return {
    baseUrl,
    model: typeof env.LLM_MODEL === 'string' ? env.LLM_MODEL.trim() : '',
    apiKey: typeof env.LLM_API_KEY === 'string' ? env.LLM_API_KEY.trim() : '',
    adminToken: typeof env.ADMIN_TOKEN === 'string' ? env.ADMIN_TOKEN : '',
  }
}

function statusFor(config) {
  const keyConfigured = Boolean(config.apiKey)
  return { enabled: keyConfigured && Boolean(config.model), baseUrl: config.baseUrl, model: config.model, keyConfigured }
}

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || !left || !right) return false
  const a = Buffer.from(left); const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function adminAuth(config) {
  return (req, res, next) => {
    if (!config.adminToken) return res.status(503).json({ error: 'Administration non configurée sur le serveur.' })
    const header = req.get('authorization') || ''
    const supplied = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!safeEqual(supplied, config.adminToken)) return res.status(401).json({ error: 'Jeton administrateur invalide.' })
    next()
  }
}

function createLimiter({ max = 10, windowMs = 15 * 60 * 1000 } = {}) {
  const clients = new Map()
  return (req, res, next) => {
    const now = Date.now(); const key = req.ip || req.socket.remoteAddress || 'unknown'
    let entry = clients.get(key)
    if (!entry || now >= entry.resetAt) { entry = { count: 0, resetAt: now + windowMs }; clients.set(key, entry) }
    entry.count += 1
    res.set('RateLimit-Limit', String(max)); res.set('RateLimit-Remaining', String(Math.max(0, max - entry.count))); res.set('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))
    if (entry.count > max) return res.status(429).json({ error: 'Trop de demandes. Réessaie dans quelques minutes.' })
    next()
  }
}

function validateCorrection(body, file) {
  const courseId = cleanString(body?.courseId, 'Chapitre', { max: 100 })
  const exerciseId = cleanString(body?.exerciseId, 'Exercice', { max: 120 })
  const answerText = cleanString(body?.answerText, 'La réponse', { max: MAX_ANSWER_LENGTH })
  const exercise = exercises.get(`${courseId}:${exerciseId}`)
  if (!exercise) throw new Error('Chapitre ou exercice inconnu.')
  let attachment = null
  if (file) {
    if (!allowedTypes.has(file.mimetype)) throw new Error('Format de pièce jointe refusé. Utilise JPG, PNG, WebP ou PDF.')
    if (file.size > MAX_FILE_SIZE) throw new Error('La pièce jointe dépasse 5 Mo.')
    attachment = { name: basename(file.originalname).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 200) || 'fichier', mimetype: file.mimetype, size: file.size }
  }
  return { courseId, exercise, answerText, attachment }
}

function parseFeedback(raw) {
  const text = typeof raw === 'string' ? raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '') : ''
  let value
  try { value = JSON.parse(text) } catch { throw new Error('Réponse du service de correction illisible.') }
  const score = Number(value?.score)
  const strengths = Array.isArray(value?.strengths) ? value.strengths.filter(item => typeof item === 'string' && item.trim()).slice(0, 5).map(item => item.trim().slice(0, 500)) : []
  const corrections = Array.isArray(value?.corrections) ? value.corrections.filter(item => typeof item === 'string' && item.trim()).slice(0, 6).map(item => item.trim().slice(0, 700)) : []
  const nextStep = typeof value?.nextStep === 'string' ? value.nextStep.trim().slice(0, 700) : ''
  if (!Number.isFinite(score) || score < 0 || score > 20 || !strengths.length || !corrections.length || !nextStep) throw new Error('Réponse du service de correction incomplète.')
  return { score: Math.round(score * 10) / 10, strengths, corrections, nextStep }
}

export function createOpenAIClient(fetchImpl = fetch) {
  return {
    async correct({ config, exercise, answerText, attachment }) {
      const attachmentNote = attachment
        ? `Pièce jointe (métadonnées uniquement, contenu non analysé) : ${JSON.stringify(attachment)}.`
        : 'Aucune pièce jointe.'
      const prompt = `Tu es un correcteur bienveillant de mathématiques pour le Tronc Commun Sciences marocain. Corrige en français de façon pédagogique. N’affiche jamais de chaîne de pensée ni de raisonnement interne : donne seulement une justification concise et vérifiable.\nExercice : ${exercise.prompt}\nType attendu : ${exercise.responseType}\nBarème : ${exercise.rubric}\nRéponse de l’élève :\n${answerText}\n${attachmentNote}\nRetourne uniquement un objet JSON : {"score": nombre de 0 à 20, "strengths": [chaînes], "corrections": [chaînes], "nextStep": chaîne}.`
      const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: config.model, temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Réponds en français, en JSON strict, sans chaîne de pensée.' }, { role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(45_000),
      })
      if (!response.ok) throw new Error(`Service de correction indisponible (${response.status}).`)
      const payload = await response.json()
      return parseFeedback(payload?.choices?.[0]?.message?.content)
    },
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 3, fieldSize: MAX_ANSWER_LENGTH * 2, parts: 5 },
  fileFilter: (_req, file, callback) => allowedTypes.has(file.mimetype) ? callback(null, true) : callback(new Error('INVALID_FILE_TYPE')),
})

export function createApp({ config = createRuntimeConfig(), llmClient = createOpenAIClient(), rateLimit } = {}) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '100kb', type: ['application/json', 'application/*+json'] }))

  const parseCorrection = (req, res, next) => {
    if (req.is('multipart/form-data')) {
      upload.single('attachment')(req, res, error => {
        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'La pièce jointe dépasse 5 Mo.' })
        if (error) return res.status(400).json({ error: 'Formulaire ou pièce jointe invalide.' })
        next()
      })
    } else if (req.is('application/json')) next()
    else res.status(415).json({ error: 'Utilise JSON ou un formulaire multipart.' })
  }

  app.post('/api/correct', createLimiter(rateLimit), parseCorrection, async (req, res) => {
    let input
    try { input = validateCorrection(req.body, req.file) } catch (error) { return res.status(400).json({ error: error.message }) }
    if (!config.apiKey || !config.model) return res.status(503).json({ error: 'La correction automatique n’est pas configurée.' })
    try {
      const feedback = await llmClient.correct({ config, ...input })
      return res.json({ feedback })
    } catch (error) {
      const message = error instanceof Error && /service de correction/i.test(error.message) ? error.message : 'Le service de correction n’a pas répondu correctement.'
      return res.status(502).json({ error: message })
    }
  })

  const requireAdmin = adminAuth(config)
  app.get('/api/admin/status', requireAdmin, (_req, res) => res.json(statusFor(config)))
  app.post('/api/admin/config', requireAdmin, (req, res) => {
    let patch
    try { patch = validateConfigPatch(req.body) } catch (error) { return res.status(400).json({ error: error.message }) }
    config.baseUrl = patch.baseUrl; config.model = patch.model
    if (patch.apiKey !== undefined) config.apiKey = patch.apiKey
    return res.json(statusFor(config))
  })

  const dist = join(here, 'dist')
  if (existsSync(dist)) {
    app.use(express.static(dist, { index: false, fallthrough: true }))
    app.use((req, res, next) => req.method === 'GET' && !req.path.startsWith('/api/') ? res.sendFile(join(dist, 'index.html')) : next())
  }
  app.use((req, res) => res.status(404).json({ error: 'Route inconnue.' }))
  app.use((error, _req, res, _next) => {
    if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Requête trop volumineuse.' })
    if (error instanceof SyntaxError) return res.status(400).json({ error: 'JSON invalide.' })
    return res.status(500).json({ error: 'Erreur interne.' })
  })
  return app
}
