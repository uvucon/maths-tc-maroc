import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import exerciseCatalog from '../shared/exercises.json'

export type Exercise = {
  courseId: string
  id: string
  title: string
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
  const fileRef = useRef<HTMLInputElement>(null)
  const selected = available.find(item => item.id === selectedId) || available[0]

  const chooseExercise = (id: string) => {
    const saved = readWork()[id]
    setSelectedId(id)
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
        <span className="eyebrow">Énoncé</span><h3>{selected.title}</h3><p className="exercise-prompt">{selected.prompt}</p>
        <div className="rubric"><b>Barème de correction</b><span>{selected.rubric}</span></div>
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

import { ThemePreset } from './types'

type AdminStatus = { enabled: boolean; baseUrl: string; model: string; keyConfigured: boolean }

export function LLMConfigPage() {
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

export function useAuth() {
  const jwt = localStorage.getItem('jwt');
  if (!jwt) return null;
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    return { token: jwt, user: payload };
  } catch {
    return null;
  }
}

function ThemePanel({ auth }: { auth: NonNullable<ReturnType<typeof useAuth>> }) {
  const [themes, setThemes] = useState<ThemePreset[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const fetchThemes = async () => {
      try {
        const [themesRes, settingsRes] = await Promise.all([
          fetch('/api/admin/themes', { headers: { authorization: `Bearer ${auth.token}` } }),
          fetch('/api/admin/settings', { headers: { authorization: `Bearer ${auth.token}` } })
        ]);
        if (themesRes.ok && settingsRes.ok) {
          setThemes(await themesRes.json());
          const settings = await settingsRes.json();
          setSelectedThemeId(settings.activeThemeId);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchThemes();
  }, [auth.token]);

  const applyTheme = async () => {
    const theme = themes.find(t => t.id === selectedThemeId);
    if (!theme) return;

    setApplying(true);
    try {
      await fetch('/api/admin/themes', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${auth.token}`
        },
        body: JSON.stringify({ themeId: theme.id, vars: theme.vars })
      });

      // Apply CSS vars for instant preview
      for (const [key, value] of Object.entries(theme.vars)) {
        document.documentElement.style.setProperty(key, value);
      }
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <div>Chargement des thèmes...</div>;

  return (
    <section className="admin-panel theme-panel">
      <h2>Thème</h2>
      <div className="theme-options">
        {themes.map(t => (
          <label key={t.id} className="theme-card">
            <input
              type="radio"
              name="theme"
              value={t.id}
              checked={selectedThemeId === t.id}
              onChange={() => setSelectedThemeId(t.id)}
            />
            <span>{t.name}</span>
          </label>
        ))}
      </div>
      <button className="button primary" onClick={applyTheme} disabled={applying}>
        {applying ? 'Application...' : 'Appliquer'}
      </button>
    </section>
  );
}

type User = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: number;
  lastSeenAt: number;
};

function UsersPanel({ auth }: { auth: NonNullable<ReturnType<typeof useAuth>> }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/users', { headers: { authorization: `Bearer ${auth.token}` } })
      .then(res => res.json())
      .then(setUsers)
      .finally(() => setLoading(false));
  }, [auth.token]);

  const updateRole = async (id: string, role: string) => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${auth.token}`
      },
      body: JSON.stringify({ role })
    });
    if (res.ok) {
      setUsers(users.map(u => u.id === id ? { ...u, role } : u));
    } else {
      const err = await res.json();
      alert(`Erreur: ${err.error}`);
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Voulez-vous vraiment désactiver cet utilisateur ?')) return;
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${auth.token}` }
    });
    if (res.ok) {
      setUsers(users.filter(u => u.id !== id));
    } else {
      const err = await res.json();
      alert(`Erreur: ${err.error}`);
    }
  };

  if (loading) return <div>Chargement des utilisateurs...</div>;

  return (
    <section className="admin-panel users-panel">
      <h2>Utilisateurs</h2>
      <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Email</th>
            <th>Nom</th>
            <th>Rôle</th>
            <th>Créé le</th>
            <th>Dernière vue</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{u.displayName}</td>
              <td>
                <select value={u.role} onChange={(e) => updateRole(u.id, e.target.value)}>
                  <option value="user">Utilisateur</option>
                  <option value="admin">Administrateur</option>
                </select>
              </td>
              <td>{new Date(u.createdAt).toLocaleDateString('fr-FR')}</td>
              <td>{u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleDateString('fr-FR') : 'Jamais'}</td>
              <td>
                <button className="text-button" style={{ color: 'red' }} onClick={() => deleteUser(u.id)}>Désactiver</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const min = 0;
  const range = max - min;
  const width = 100;
  const height = 30;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
      <polyline points={points} fill="none" stroke="var(--primary, #0070f3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type AnalyticsData = {
  degraded?: boolean;
  totalUsers: number;
  newUsersLast7d: number;
  activeUsersLast7d: number;
  totalSessions: number;
  avgSessionsPerUser: number;
  avgSessionDurationMin: number;
  topCourses: string[];
  streakHistogram: Record<string, number>;
  dailyActiveLast14d: number[];
};

function AnalyticsPanel({ auth }: { auth: NonNullable<ReturnType<typeof useAuth>> }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/analytics', { headers: { authorization: `Bearer ${auth.token}` } })
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [auth.token]);

  if (loading) return <div>Chargement de l'analytique...</div>;
  if (!data) return <div>Erreur de chargement.</div>;

  const format = (n: number, decimals = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimals }).format(n);

  return (
    <section className="admin-panel analytics-panel">
      <h2>Analytique {data.degraded && <span style={{ color: 'orange', fontSize: '0.8em' }}>(Dégradé)</span>}</h2>

      {!data.degraded && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="stat-card" style={{ padding: '1rem', border: '1px solid #eee', borderRadius: '8px' }}>
            <h3>Utilisateurs</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{format(data.totalUsers)}</p>
            <small>+{format(data.newUsersLast7d)} les 7 derniers jours</small>
          </div>

          <div className="stat-card" style={{ padding: '1rem', border: '1px solid #eee', borderRadius: '8px' }}>
            <h3>Actifs (7j)</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{format(data.activeUsersLast7d)}</p>
          </div>

          <div className="stat-card" style={{ padding: '1rem', border: '1px solid #eee', borderRadius: '8px' }}>
            <h3>Sessions</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{format(data.totalSessions)}</p>
            <small>{format(data.avgSessionsPerUser, 1)} / utilisateur</small>
          </div>

          <div className="stat-card" style={{ padding: '1rem', border: '1px solid #eee', borderRadius: '8px' }}>
            <h3>Durée moyenne</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{format(data.avgSessionDurationMin, 1)} min</p>
          </div>
        </div>
      )}

      {!data.degraded && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div>
            <h3>Activité (14 derniers jours)</h3>
            <div style={{ padding: '1rem', background: '#fafafa', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <Sparkline data={data.dailyActiveLast14d} />
            </div>
          </div>
          <div>
             <h3>Top Cours</h3>
             <ul>
               {data.topCourses.map((c, i) => <li key={c}>{i + 1}. {c}</li>)}
             </ul>
          </div>
        </div>
      )}
    </section>
  );
}

export function AdminPage() {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState<'theme' | 'users' | 'analytics' | 'llm'>('theme');

  if (!auth || auth.user.role !== 'admin') {
    return <p>Accès refusé.</p>;
  }

  return (
    <div className="admin-console" style={{ display: 'flex', gap: '2rem' }}>
      <aside className="admin-sidebar" style={{ minWidth: '200px' }}>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button className={activeTab === 'theme' ? 'active' : ''} onClick={() => setActiveTab('theme')}>Thème</button>
          <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>Utilisateurs</button>
          <button className={activeTab === 'analytics' ? 'active' : ''} onClick={() => setActiveTab('analytics')}>Analytique</button>
          <button className={activeTab === 'llm' ? 'active' : ''} onClick={() => setActiveTab('llm')}>LLM Config</button>
        </nav>
      </aside>

      <main className="admin-main" style={{ flex: 1 }}>
        {activeTab === 'theme' && <ThemePanel auth={auth} />}
        {activeTab === 'users' && <UsersPanel auth={auth} />}
        {activeTab === 'analytics' && <AnalyticsPanel auth={auth} />}
        {activeTab === 'llm' && <LLMConfigPage />}
      </main>
    </div>
  );
}
