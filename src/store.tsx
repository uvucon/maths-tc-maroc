import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { courses } from './data'

export type Progress = {
  learner: string; completed: string[]; lessonChecks: Record<string, number[]>; quizScores: Record<string, number>;
  diagnosticScore: number | null; resumeId: string; focusSessions: number; lastActive: string; streak: number;
}

const today = () => new Date().toISOString().slice(0,10)
const initial: Progress = { learner:'Yasmine', completed:[], lessonChecks:{}, quizScores:{}, diagnosticScore:null, resumeId:'ensembles-nombres', focusSessions:0, lastActive:today(), streak:3 }
const KEY = 'mathsprint-tc-progress-v1'

type Store = {
  progress: Progress; xp:number; level:number; complete:(id:string)=>void; setQuiz:(id:string,score:number)=>void;
  toggleLesson:(id:string,index:number)=>void; setResume:(id:string)=>void; setDiagnostic:(score:number)=>void;
  addFocus:()=>void; reset:()=>void;
}
const ProgressContext = createContext<Store | null>(null)

function load(): Progress {
  try { const saved = localStorage.getItem(KEY); return saved ? { ...initial, ...JSON.parse(saved) } : initial } catch { return initial }
}

export function ProgressProvider({children}:{children:ReactNode}) {
  const [progress,setProgress] = useState<Progress>(load)
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(progress)) }, [progress])
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
      addFocus:()=>patch(p=>({...p,focusSessions:p.focusSessions+1})), reset:()=>{localStorage.removeItem(KEY);setProgress({...initial,lastActive:today()})}
    }
  },[progress])
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}
export function useProgress(){const context=useContext(ProgressContext);if(!context)throw new Error('ProgressProvider requis');return context}
