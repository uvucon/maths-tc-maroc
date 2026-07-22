import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { readFileSync } from 'node:fs'

import { createApp, createOpenAIClient, createRuntimeConfig, validateConfigPatch } from '../server-lib.mjs'

const exerciseId = 'ensembles-nombres-1'

async function withServer(app, run) {
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address()
  try { await run(`http://127.0.0.1:${port}`) } finally { await new Promise(resolve => server.close(resolve)) }
}

const correction = { score: 14, strengths: ['Bonne méthode'], corrections: ['Justifier l’inclusion'], nextStep: 'Refaire avec un intervalle ouvert.' }

test('catalog contains exactly three complete exercises for each of 15 courses', () => {
  const catalog = JSON.parse(readFileSync(new URL('../shared/exercises.json', import.meta.url), 'utf8'))
  const groups = Map.groupBy(catalog, exercise => exercise.courseId)
  const courseIds = ['ensembles-nombres', 'arithmetique-n', 'calcul-vectoriel', 'projection-plan', 'ordre-r', 'droite-plan', 'polynomes', 'equations-systemes', 'trigonometrie-calcul', 'trigonometrie-equations', 'fonctions', 'transformations-plan', 'produit-scalaire', 'geometrie-espace', 'statistiques']
  assert.equal(catalog.length, 45)
  assert.deepEqual([...groups.keys()], courseIds)
  for (const group of groups.values()) {
    assert.equal(group.length, 3)
    for (const exercise of group) {
      assert.ok(exercise.id && exercise.prompt && exercise.responseType && exercise.rubric)
      assert.equal(exercise.id.startsWith(`${exercise.courseId}-`), true)
    }
  }
})

function configured(overrides = {}) {
  return createRuntimeConfig({ LLM_BASE_URL: 'https://llm.example/v1', LLM_MODEL: 'math-model', LLM_API_KEY: 'secret', ADMIN_TOKEN: 'admin-secret', ...overrides })
}

test('config patch validates URL, model and write-only optional key', () => {
  assert.deepEqual(validateConfigPatch({ baseUrl: 'https://host.test/v1/', model: ' modèle ', apiKey: ' replacement ' }), {
    baseUrl: 'https://host.test/v1', model: 'modèle', apiKey: 'replacement'
  })
  assert.throws(() => validateConfigPatch({ baseUrl: 'file:///tmp/api', model: 'x' }), /URL HTTP/)
  assert.throws(() => validateConfigPatch({ baseUrl: 'https://ok.test', model: '' }), /modèle/)
})

test('correction rejects unknown IDs and empty answers before calling the LLM', async () => {
  let calls = 0
  const app = createApp({ config: configured(), llmClient: { correct: async () => { calls += 1; return correction } } })
  await withServer(app, async base => {
    const unknown = await fetch(`${base}/api/correct`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ courseId: 'fake', exerciseId: 'fake-1', answerText: 'Une réponse.' }) })
    assert.equal(unknown.status, 400)
    const empty = await fetch(`${base}/api/correct`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ courseId: 'ensembles-nombres', exerciseId, answerText: '   ' }) })
    assert.equal(empty.status, 400)
  })
  assert.equal(calls, 0)
})

test('correction accepts a catalog exercise and uses the injected LLM client', async () => {
  let received
  const app = createApp({ config: configured(), llmClient: { correct: async input => { received = input; return correction } } })
  await withServer(app, async base => {
    const response = await fetch(`${base}/api/correct`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ courseId: 'ensembles-nombres', exerciseId, answerText: 'Je classe −3 dans Z et Q.' }) })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { feedback: correction })
  })
  assert.equal(received.exercise.id, exerciseId)
  assert.match(received.answerText, /classe/)
})

test('correction is unavailable rather than fabricating feedback without LLM config', async () => {
  const app = createApp({ config: configured({ LLM_API_KEY: '' }), llmClient: { correct: async () => correction } })
  await withServer(app, async base => {
    const response = await fetch(`${base}/api/correct`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ courseId: 'ensembles-nombres', exerciseId, answerText: 'Ma solution rédigée.' }) })
    assert.equal(response.status, 503)
    assert.match((await response.json()).error, /configurée/)
  })
})

test('correction limiter allows 10 requests per IP then returns 429', async () => {
  const app = createApp({ config: configured(), llmClient: { correct: async () => correction }, rateLimit: { max: 10, windowMs: 60_000 } })
  await withServer(app, async base => {
    for (let index = 0; index < 10; index += 1) {
      const response = await fetch(`${base}/api/correct`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ courseId: 'ensembles-nombres', exerciseId, answerText: `Solution suffisamment détaillée ${index}` }) })
      assert.equal(response.status, 200)
    }
    const blocked = await fetch(`${base}/api/correct`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ courseId: 'ensembles-nombres', exerciseId, answerText: 'Encore une solution.' }) })
    assert.equal(blocked.status, 429)
  })
})

test('multipart rejects invalid attachment type and oversized attachment', async () => {
  const app = createApp({ config: configured(), llmClient: { correct: async () => correction } })
  await withServer(app, async base => {
    const invalid = new FormData()
    invalid.set('courseId', 'ensembles-nombres'); invalid.set('exerciseId', exerciseId); invalid.set('answerText', 'Solution écrite')
    invalid.set('attachment', new Blob(['bad'], { type: 'text/plain' }), 'notes.txt')
    assert.equal((await fetch(`${base}/api/correct`, { method: 'POST', body: invalid })).status, 400)

    const oversized = new FormData()
    oversized.set('courseId', 'ensembles-nombres'); oversized.set('exerciseId', exerciseId); oversized.set('answerText', 'Solution écrite')
    oversized.set('attachment', new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/png' }), 'work.png')
    assert.equal((await fetch(`${base}/api/correct`, { method: 'POST', body: oversized })).status, 413)
  })
})

test('multipart passes an image data URL to the LLM client without storing the file', async () => {
  let received
  const app = createApp({ config: configured(), llmClient: { correct: async input => { received = input; return correction } } })
  await withServer(app, async base => {
    const form = new FormData()
    form.set('courseId', 'ensembles-nombres'); form.set('exerciseId', exerciseId); form.set('answerText', 'Une solution avec pièce jointe.')
    form.set('attachment', new Blob(['image-bytes'], { type: 'image/png' }), 'copie.png')
    assert.equal((await fetch(`${base}/api/correct`, { method: 'POST', body: form })).status, 200)
  })
  assert.equal(received.attachment.name, 'copie.png')
  assert.equal(received.attachment.mimetype, 'image/png')
  assert.equal(received.attachment.size, 11)
  assert.equal(received.attachment.imageDataUrl, 'data:image/png;base64,aW1hZ2UtYnl0ZXM=')
})

test('OpenAI-compatible client sends a photo as an image_url content part', async () => {
  let request
  const client = createOpenAIClient(async (_url, options) => {
    request = JSON.parse(options.body)
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(correction) } }] }), { status: 200 })
  })
  const catalog = JSON.parse(readFileSync(new URL('../shared/exercises.json', import.meta.url), 'utf8'))
  const feedback = await client.correct({ config: configured(), exercise: catalog[0], answerText: '', attachment: { name: 'copie.png', mimetype: 'image/png', size: 11, imageDataUrl: 'data:image/png;base64,aW1hZ2UtYnl0ZXM=' } })
  assert.deepEqual(feedback, correction)
  const content = request.messages[1].content
  assert.equal(Array.isArray(content), true)
  assert.deepEqual(content[1], { type: 'image_url', image_url: { url: 'data:image/png;base64,aW1hZ2UtYnl0ZXM=', detail: 'high' } })
})

test('admin status is protected and never returns the API key', async () => {
  const app = createApp({ config: configured(), llmClient: { correct: async () => correction } })
  await withServer(app, async base => {
    assert.equal((await fetch(`${base}/api/admin/status`)).status, 401)
    const response = await fetch(`${base}/api/admin/status`, { headers: { authorization: 'Bearer admin-secret' } })
    assert.equal(response.status, 200)
    const status = await response.json()
    assert.deepEqual(status, { enabled: true, baseUrl: 'https://llm.example/v1', model: 'math-model', keyConfigured: true })
    assert.equal(JSON.stringify(status).includes('secret'), false)
  })
})

test('admin configuration updates runtime state and retains an omitted key', async () => {
  const config = configured()
  const app = createApp({ config, llmClient: { correct: async () => correction } })
  await withServer(app, async base => {
    const response = await fetch(`${base}/api/admin/config`, { method: 'POST', headers: { authorization: 'Bearer admin-secret', 'content-type': 'application/json' }, body: JSON.stringify({ baseUrl: 'https://new.example/v2/', model: 'new-model' }) })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { enabled: true, baseUrl: 'https://new.example/v2', model: 'new-model', keyConfigured: true })
  })
  assert.equal(config.apiKey, 'secret')
})
