import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import exerciseCatalog from '../shared/exercises.json'

export type Exercise = {
  courseId: string
  id: string
  title: string
  context: string
  source: string
  year: number
  examiner: string
  type: string
  durationMin: number
  points: number
  statement: string
  hints: string[]
  expectedSkills: string[]
  difficulty: number

  prompt: string
  responseType: string
  rubric: string
}

type Feedback = {
  score: number
  strengths: string[]
  corrections: string[]
  nextStep: string
}

type SavedWork = {
  answerText: string
  feedback?: Feedback
  submittedAt?: string
  attachment?: { name: string; mimetype: string; size: number }
}

const exercises = exerciseCatalog as Exercise[]
const STORAGE_KEY = 'mathsprint-tc-exercises-v1'
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024

function readWork(): Record<string, SavedWork> {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch { return {} }
}

function saveWork(id: string, work: SavedWork) {
  const all = readWork(); all[id] = work
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

function exercisesFor(courseId: string) {
  return exercises.filter(exercise => exercise.courseId === courseId)
}

export function ExercisePanel({ courseId }: { courseId: string }) {
  const available = useMemo(() => exercisesFor(courseId), [courseId])
  const initialWork = readWork()[available[0]?.id]
  const [selectedId, setSelectedId] = useState(available[0]?.id || '')
  const [answerText, setAnswerText] = useState(initialWork?.answerText || '')
  const [feedback, setFeedback] = useState<Feedback | undefined>(initialWork?.feedback)
  const [submittedAt, setSubmittedAt] = useState<string | undefined>(initialWork?.submittedAt)
  const [savedAttachment, setSavedAttachment] = useState<SavedWork['attachment']>(initialWork?.attachment)
  const [file, setFile] = useState<File | null>(null)
  const [state, setState] = useState<'idle' | 'pending' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [hintIndex, setHintIndex] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const selected = available.find(item => item.id === selectedId) || available[0]

  const chooseExercise = (id: string) => {
    const saved = readWork()[id]
    setSelectedId(id)
    setHintIndex(0)
    setAnswerText(saved?.answerText || '')
    setFeedback(saved?.feedback)
    setSubmittedAt(saved?.submittedAt)
    setSavedAttachment(saved?.attachment)
    setFile(null); setState('idle'); setMessage('')
    if (fileRef.current) fileRef.current.value = ''
  }

  useEffect(() => {
    if (!selected || state === 'pending') return
    const previous = readWork()[selected.id]
    saveWork(selected.id, { ...previous, answerText })
  }, [answerText, selected, state])

  if (!selected) return <p>Aucun exercice disponible.</p>

  const chooseFile = (chosen?: File) => {
    setMessage(''); setState('idle')
    if (!chosen) { setFile(null); return }
    if (!ACCEPTED_TYPES.includes(chosen.type)) { setFile(null); setState('error'); setMessage('Format refusé : choisis une photo JPG, PNG ou WebP.'); return }
    if (chosen.size > MAX_FILE_SIZE) { setFile(null); setState('error'); setMessage('Ce fichier dépasse la limite de 5 Mo.'); return }
    setFile(chosen)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!answerText.trim() && !file) { setState('error'); setMessage('Écris une démarche ou ajoute une photo de ta réponse.'); return }
    setState('pending'); setMessage('')
    const form = new FormData()
    form.set('courseId', courseId); form.set('exerciseId', selected.id); form.set('answerText', answerText.trim())
    if (file) form.set('attachment', file)
    try {
      const response = await fetch('/api/correct', { method: 'POST', body: form })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'La correction est indisponible pour le moment.')
      if (!payload.feedback) throw new Error('Le serveur n’a pas renvoyé de correction valide.')
      const attachment = file ? { name: file.name, mimetype: file.type, size: file.size } : undefined
      const when = new Date().toISOString()
      setFeedback(payload.feedback); setSubmittedAt(when); setSavedAttachment(attachment); setState('idle')
      saveWork(selected.id, { answerText, feedback: payload.feedback, submittedAt: when, attachment })
    } catch (error) {
      setState('error'); setMessage(error instanceof Error ? error.message : 'La correction est indisponible pour le moment.')
    }
  }

  return <section className="exercise-workspace">
    <div className="exercise-intro"><div><span className="eyebrow">Mise en pratique</span><h2>Choisis, rédige, puis améliore.</h2><p>Trois exercices ciblés. Envoie ta démarche écrite, une photo nette de ta copie, ou les deux : le correcteur compare avec le barème.</p></div><span className="exercise-count">3 exercices</span></div>
    <div className="exercise-layout">
      <aside className="exercise-picker" aria-label="Choisir un exercice">{available.map((exercise, index) => <button key={exercise.id} className={selected.id === exercise.id ? 'active' : ''} onClick={() => chooseExercise(exercise.id)}><span>{index + 1}</span><div><b>{exercise.title}</b><small>{exercise.responseType}</small></div></button>)}</aside>
      <form className="exercise-sheet" onSubmit={submit}>
        <span className="eyebrow">{selected.source} · {selected.examiner} ({selected.year})</span>
        <h3>{selected.title} <span className="difficulty-badge" style={{ color: '#f59e0b' }}>{'★'.repeat(selected.difficulty)}{'☆'.repeat(5 - selected.difficulty)}</span></h3>
        <p className="exercise-prompt">{selected.context}</p>
        <p className="exercise-statement">{selected.statement}</p>
        {selected.hints && selected.hints.length > 0 && (
          <div className="hints-section" style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem' }}>
            <button type="button" onClick={() => setHintIndex(i => Math.min(i + 1, selected.hints.length))} className="button secondary" style={{ marginBottom: hintIndex > 0 ? '0.5rem' : 0 }}>
              {hintIndex < selected.hints.length ? 'Voir un indice' : 'Tous les indices sont affichés'}
            </button>
            {hintIndex > 0 && (
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {selected.hints.slice(0, hintIndex).map((hint, i) => (
                  <li key={i} style={{ marginBottom: '0.25rem' }}>{hint}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="rubric"><b>Barème de correction</b><span>{selected.points} points · {selected.durationMin} min</span></div>
        <div className="rubric"><b>Compétences attendues</b><span>{selected.expectedSkills?.join(', ')}</span></div>
        <label className="answer-label" htmlFor={`answer-${selected.id}`}><b>Ta démarche <small>facultative si ta photo est lisible</small></b><span>Ajoute les étapes utiles pour aider la correction.</span></label>
        <textarea id={`answer-${selected.id}`} value={answerText} onChange={event => setAnswerText(event.target.value)} maxLength={20000} rows={9} placeholder="Rédige ta démarche, ou ajoute une photo de ta copie ci-dessous…" disabled={state === 'pending'} />
        <div className="draft-line"><span>{answerText.length.toLocaleString('fr-FR')} / 20 000</span><span>✓ Brouillon enregistré sur cet appareil</span></div>
        <label className="file-drop"><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => chooseFile(event.target.files?.[0])} disabled={state === 'pending'} /><span><b>{file ? file.name : 'Ajouter une photo de ta copie'}</b><small>{file ? formatBytes(file.size) : 'JPG, PNG ou WebP · 5 Mo maximum'}</small></span></label>
        <p className="privacy-note"><strong>Transparence :</strong> une photo jointe est envoyée au modèle choisi par l’administrateur pour être lue, puis n’est pas conservée par MathSprint. N’ajoute aucune donnée personnelle.</p>
        {state === 'error' && <div className="submit-state error" role="alert"><b>Correction non reçue</b><span>{message}</span><small>Ton brouillon reste enregistré. Aucune correction n’est inventée.</small></div>}
        {state === 'pending' && <div className="submit-state pending" role="status"><span className="loader"/><div><b>Correction en cours…</b><small>Ta réponse est envoyée au service configuré par l’administrateur.</small></div></div>}
        <button className="button primary submit-answer" type="submit" disabled={state === 'pending' || (!answerText.trim() && !file)}>{state === 'pending' ? 'Analyse en cours…' : feedback ? 'Demander une nouvelle correction' : 'Envoyer pour correction'}</button>
      </form>
    </div>
    {feedback && <article className="feedback-card" aria-live="polite"><header><div><span className="eyebrow">Correction reçue</span><h2>Une base claire pour progresser</h2>{submittedAt && <small>{new Date(submittedAt).toLocaleString('fr-FR')}</small>}</div><div className="score"><strong>{feedback.score}</strong><span>/20</span></div></header><div className="feedback-grid"><section><h3>Ce qui est réussi</h3><ul>{feedback.strengths.map((item, index) => <li key={index}>{item}</li>)}</ul></section><section><h3>À corriger</h3><ul>{feedback.corrections.map((item, index) => <li key={index}>{item}</li>)}</ul></section></div><footer><span>Prochaine étape</span><b>{feedback.nextStep}</b>{savedAttachment && <small>Pièce jointe enregistrée comme métadonnées : {savedAttachment.name} · {formatBytes(savedAttachment.size)}</small>}</footer></article>}
  </section>
}

type AdminStatus = { enabled: boolean; baseUrl: string; model: string; keyConfigured: boolean }

export function AdminPage() {
  const [token, setToken] = useState('')
  const [status, setStatus] = useState<AdminStatus | null>(null)
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const request = async (method: 'GET' | 'POST', body?: object) => {
    if (!token) throw new Error('Saisis le jeton administrateur.')
    const response = await fetch(method === 'GET' ? '/api/admin/status' : '/api/admin/config', { method, headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Impossible de joindre le serveur.')
    return payload as AdminStatus
  }

  const load = async () => {
    setBusy(true); setMessage('')
    try { const next = await request('GET'); setStatus(next); setBaseUrl(next.baseUrl); setModel(next.model); setMessage('Statut chargé. Le jeton reste uniquement dans cette page.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Erreur.') } finally { setBusy(false) }
  }

  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const next = await request('POST', { baseUrl, model, ...(apiKey ? { apiKey } : {}) })
      setStatus(next); setApiKey(''); setMessage('Configuration appliquée en mémoire au serveur.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Erreur.') } finally { setBusy(false) }
  }

  return <><section className="page-intro compact admin-intro"><span className="eyebrow">Configuration privée</span><h1>Brancher la correction,<br/><em>sans exposer la clé.</em></h1><p>Une configuration minimale, volontairement temporaire. Rien n’est écrit dans le navigateur ni dans un fichier serveur.</p></section><section className="admin-panel"><div className="admin-warning"><b>Configuration volatile</b><p>Tout changement est perdu au redémarrage. Le jeton administrateur reste en mémoire React jusqu’à la fermeture ou au rechargement de cette page. La clé LLM est en écriture seule et ne sera jamais réaffichée.</p></div><label><span>Jeton administrateur</span><input type="password" autoComplete="off" value={token} onChange={event => setToken(event.target.value)} placeholder="ADMIN_TOKEN" /></label><button className="button secondary" onClick={load} disabled={busy || !token}>Vérifier le statut</button>{status && <div className={`admin-status ${status.enabled ? 'ready' : ''}`}><span>{status.enabled ? 'Correction active' : 'Correction inactive'}</span><dl><div><dt>URL API</dt><dd>{status.baseUrl}</dd></div><div><dt>Modèle</dt><dd>{status.model || 'Non défini'}</dd></div><div><dt>Clé</dt><dd>{status.keyConfigured ? 'Configurée (masquée)' : 'Non configurée'}</dd></div></dl></div>}<form onSubmit={save}><label><span>URL de base OpenAI-compatible</span><input type="url" required value={baseUrl} onChange={event => setBaseUrl(event.target.value)} /></label><label><span>Modèle</span><input required value={model} onChange={event => setModel(event.target.value)} placeholder="gpt-4.1-mini" /></label><label><span>Nouvelle clé API <small>facultatif si déjà configurée</small></span><input type="password" autoComplete="new-password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="Écriture seule" /></label><button className="button primary" type="submit" disabled={busy || !token}>{busy ? 'Connexion…' : 'Appliquer au serveur'}</button></form>{message && <p className="admin-message" role="status">{message}</p>}</section></>
}
