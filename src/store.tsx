import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { courses } from './data'
import type { User, ProgressState } from './types'

export type Progress = ProgressState & {
  learner: string;
  diagnosticScore: number | null;
  lastActive: string;
}

const today = () => new Date().toISOString().slice(0,10)
const initial: Progress = { learner:'Yasmine', completed:[], lessonChecks:{}, quizScores:{}, diagnosticScore:null, resumeId:'ensembles-nombres', focusSessions:0, lastActive:today(), streak:3 }
const KEY = 'mathsprint-tc-progress-v1'

type Store = {
  progress: Progress; xp:number; level:number; complete:(id:string)=>void; setQuiz:(id:string,score:number)=>void;
  toggleLesson:(id:string,index:number)=>void; setResume:(id:string)=>void; setDiagnostic:(score:number)=>void;
  addFocus:()=>void; reset:()=>void;
  user: User | null; setUser: (user: User | null) => void;
}
const ProgressContext = createContext<Store | null>(null)

function load(): Progress {
  try { const saved = localStorage.getItem(KEY); return saved ? { ...initial, ...JSON.parse(saved) } : initial } catch { return initial }
}

export function ProgressProvider({children}:{children:ReactNode}) {
  const [progress,setProgress] = useState<Progress>(load)
  const [user, setUser] = useState<User | null>(null)
  const [initialLoad, setInitialLoad] = useState(false)

  useEffect(() => {
    fetch('/api/me').then(r => r.ok ? r.json() : null).then(u => {
      setUser(u)
      if (u) {
        fetch('/api/me/progress').then(r => r.ok ? r.json() : null).then(p => {
          if (p) setProgress(old => ({ ...old, ...p, learner: u.displayName }))
          setInitialLoad(true)
        })
      } else {
        setInitialLoad(true)
      }
    })
  }, [])

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(progress))
    if (user && initialLoad) {
      const payload: ProgressState = {
        completed: progress.completed,
        resumeId: progress.resumeId,
        streak: progress.streak,
        focusSessions: progress.focusSessions,
        lessonChecks: progress.lessonChecks,
        quizScores: progress.quizScores
      }
      fetch('/api/me/progress', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    }
  }, [progress, user, initialLoad])

  const touch = (p:Progress):Progress => {
    if (p.lastActive === today()) return p
    const difference = Math.floor((Date.now() - new Date(p.lastActive).getTime()) / 86400000)
    return {...p,lastActive:today(),streak:difference <= 1 ? p.streak + 1 : 1}
  }
  const patch = (fn:(p:Progress)=>Progress) => setProgress(p => touch(fn(p)))
  const value = useMemo<Store>(() => {
    const xp = progress.completed.length * 120 + Object.values(progress.quizScores).reduce((a,b)=>a+b,0) * 2 + progress.focusSessions * 25 + (progress.diagnosticScore ?? 0) * 3
    return {
      progress, xp, level:Math.floor(xp/400)+1,
      complete:(id) => patch(p=>({...p,completed:p.completed.includes(id)?p.completed:[...p.completed,id],resumeId:courses[Math.min(courses.findIndex(c=>c.id===id)+1,courses.length-1)].id})),
      setQuiz:(id,score)=>patch(p=>({...p,quizScores:{...p.quizScores,[id]:Math.max(score,p.quizScores[id]??0)}})),
      toggleLesson:(id,index)=>patch(p=>{const current=p.lessonChecks[id]??[]; return {...p,resumeId:id,lessonChecks:{...p.lessonChecks,[id]:current.includes(index)?current.filter(i=>i!==index):[...current,index]}}}),
      setResume:(id)=>patch(p=>p.resumeId===id?p:{...p,resumeId:id}), setDiagnostic:(score)=>patch(p=>({...p,diagnosticScore:score})),
      addFocus:()=>patch(p=>({...p,focusSessions:p.focusSessions+1})), reset:()=>{localStorage.removeItem(KEY);setProgress({...initial,lastActive:today()})},
      user, setUser
    }
  },[progress, user])
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}
export function useProgress(){const context=useContext(ProgressContext);if(!context)throw new Error('ProgressProvider requis');return context}
