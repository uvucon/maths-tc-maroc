import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { courses, getCourse, themes, type Course } from './data'
import { useProgress } from './store'
import { AdminPage, ExercisePanel } from './exercises'

const Icon = ({children}:{children:ReactNode}) => <span aria-hidden="true">{children}</span>

function useRoute() {
  const [path, setPath] = useState(location.pathname)
  useEffect(() => { const pop = () => setPath(location.pathname); addEventListener('popstate', pop); return () => removeEventListener('popstate', pop) }, [])
  const go = (to:string) => { history.pushState({}, '', to); setPath(to); scrollTo({top:0,behavior:'smooth'}) }
  return {path, go}
}

function Logo({go}:{go:(to:string)=>void}) {
  return <button className="logo" onClick={()=>go('/')} aria-label="MathSprint TC — accueil"><span className="logo-mark">M</span><span>MathSprint <b>TC</b></span></button>
}

function Shell({children,path,go}:{children:ReactNode,path:string,go:(to:string)=>void}) {
  const {xp, progress} = useProgress()
  const links = [['/','Accueil','⌂'],['/programme','Programme','▦'],['/revision','Révision','↻'],['/profil','Profil','○'],['/admin','Admin','⚙']]
  return <div className="app-shell">
    <header><Logo go={go}/><nav>{links.map(([to,label])=><button key={to} className={path===to?'active':''} onClick={()=>go(to)}>{label}</button>)}</nav><div className="header-stats"><span className="streak">{progress.streak} jours</span><span className="xp">{xp} XP</span></div></header>
    <main>{children}</main>
    <nav className="mobile-nav" aria-label="Navigation principale">{links.map(([to,label,icon])=><button key={to} className={path===to?'active':''} onClick={()=>go(to)}><Icon>{icon}</Icon>{label}</button>)}</nav>
  </div>
}

function ProgressRing({value,label}:{value:number,label:string}) {
  const safe = Math.min(100,Math.max(0,value))
  return <div className="ring" style={{'--progress':`${safe * 3.6}deg`} as React.CSSProperties}><div><strong>{safe}%</strong><span>{label}</span></div></div>
}

function Timer() {
  const {addFocus} = useProgress(); const [seconds,setSeconds]=useState(900); const [running,setRunning]=useState(false); const [done,setDone]=useState(false)
  useEffect(()=>{if(!running)return;const timer=setInterval(()=>setSeconds(s=>{if(s<=1){clearInterval(timer);setRunning(false);setDone(true);addFocus();return 0}return s-1}),1000);return()=>clearInterval(timer)},[running,addFocus])
  const reset=()=>{setRunning(false);setSeconds(900);setDone(false)}
  return <section className="timer-card"><div><span className="eyebrow">Sprint concentré</span><h3>{done?'Bravo, sprint terminé !':'15 minutes. Une idée à la fois.'}</h3><p>Pose ton téléphone, ouvre ton cahier et avance sans pression.</p></div><div className="timer-action"><strong>{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</strong><button className="button orange" onClick={()=>done?reset():setRunning(v=>!v)}>{done?'Recommencer':running?'Pause':'Démarrer'}</button>{seconds<900&&!done&&<button className="text-button" onClick={reset}>Réinitialiser</button>}</div></section>
}

function CourseBadge({course}:{course:Course}) { return <div className="course-number">{String(course.order).padStart(2,'0')}</div> }

function Dashboard({go}:{go:(to:string)=>void}) {
  const {progress,xp,level} = useProgress(); const complete=progress.completed.length; const percent=Math.round(complete/courses.length*100); const resume=getCourse(progress.resumeId)
  const weekly=Math.min(5,progress.focusSessions%6)
  return <>
    <section className="hero dashboard-hero"><div><span className="eyebrow">Bonjour {progress.learner} — on s’y remet ?</span><h1>Les maths,<br/><em>petit sprint</em> par petit sprint.</h1><p>Le parcours complet du Tronc Commun Sciences, découpé pour progresser quinze minutes à la fois.</p><button className="button primary" onClick={()=>go(`/cours/${resume.id}`)}>Continuer · {resume.title} <span>→</span></button></div><div className="hero-visual"><div className="orbit one">x²</div><div className="orbit two">π</div><div className="paper"><span>SPRINT DU JOUR</span><b>{resume.order}. {resume.title}</b><small>{resume.lessons.length} étapes · {resume.duration} min</small><div className="scribble">y = ax + b</div></div></div></section>
    <section className="stats-row"><div><span>Progression</span><strong>{complete}<small>/15 chapitres</small></strong></div><div><span>Énergie gagnée</span><strong>{xp}<small> XP · niveau {level}</small></strong></div><div><span>Série actuelle</span><strong>{progress.streak}<small> jours</small></strong></div></section>
    <div className="dashboard-grid"><section className="card progress-card"><div><span className="eyebrow">Vue d’ensemble</span><h2>Ton chemin cette année</h2><p>Chaque chapitre complété fait avancer le trait. Pas besoin d’aller vite : il faut revenir.</p><button className="text-link" onClick={()=>go('/programme')}>Voir tout le programme →</button></div><ProgressRing value={percent} label="du parcours"/></section>
      <section className="card weekly"><span className="eyebrow">Objectif de la semaine</span><div className="week-head"><h2>{weekly} sur 5 sprints</h2><b>{weekly>=5?'Objectif atteint':'Encore '+(5-weekly)}</b></div><div className="week-dots">{[1,2,3,4,5].map(d=><span className={d<=weekly?'done':''} key={d}>{d<=weekly?'✓':d}</span>)}</div><p>5 × 15 minutes : assez court pour commencer, assez régulier pour retenir.</p></section>
    </div>
    <Timer/>
    <section className="section-block"><div className="section-heading"><div><span className="eyebrow">À suivre</span><h2>Prochains chapitres</h2></div><button className="text-link" onClick={()=>go('/programme')}>Le parcours complet →</button></div><div className="course-strip">{courses.filter(c=>!progress.completed.includes(c.id)).slice(0,3).map(c=><CourseCard course={c} go={go} key={c.id}/>)}</div></section>
  </>
}

function CourseCard({course,go}:{course:Course,go:(to:string)=>void}) {
  const {progress}=useProgress(); const done=progress.completed.includes(course.id); const lessonCount=progress.lessonChecks[course.id]?.length??0
  return <article className={`course-card ${done?'completed':''}`} onClick={()=>go(`/cours/${course.id}`)}><div className="course-top"><CourseBadge course={course}/><span className="semester">S{course.semester}</span></div><h3>{course.title}</h3><p>{course.short}</p><div className="mini-progress"><span style={{width:`${done?100:lessonCount/course.lessons.length*100}%`}}/></div><footer><span>{done?'Terminé':`${course.duration} min`}</span><button aria-label={`Ouvrir ${course.title}`}>→</button></footer></article>
}

function Curriculum({go}:{go:(to:string)=>void}) {
  const {progress}=useProgress(); const [filter,setFilter]=useState<'all'|1|2>('all'); const shown=filter==='all'?courses:courses.filter(c=>c.semester===filter)
  return <>
    <section className="page-intro"><span className="eyebrow">15 chapitres · Tronc Commun Sciences</span><h1>Un programme organisé<br/><em>par compétences.</em></h1><p>Commence par les fondations, passe à la résolution, puis relie géométrie, fonctions et données. Chaque module est accompagné d’une vidéo YouTube sélectionnée pour le sujet.</p></section>
    <div className="filter-bar"><div>{([['all','Tout'],[1,'Semestre 1'],[2,'Semestre 2']] as const).map(([v,l])=><button className={filter===v?'active':''} onClick={()=>setFilter(v)} key={v}>{l}</button>)}</div><span>{progress.completed.length} / 15 terminés</span></div>
    <section className="learning-path" aria-label="Progression recommandée"><span className="eyebrow">Parcours conseillé</span><div>{themes.map((theme,index)=><span key={theme}><b>{index+1}</b>{theme}</span>)}</div></section>
    <div className="theme-sections">{themes.map(theme=>{const group=shown.filter(c=>c.theme===theme);return group.length?<section className="theme-section" key={theme}><div className="theme-heading"><div><span className="eyebrow">Bloc d’apprentissage</span><h2>{theme}</h2></div><span>{group.length} chapitre{group.length>1?'s':''}</span></div><div className="curriculum-grid">{group.map(c=><CourseCard course={c} go={go} key={c.id}/>)}</div></section>:null})}</div><SourceNote/>
  </>
}

const quizFor = (course:Course) => [
  {q:`Quel est le cœur du chapitre « ${course.title} » ?`,answers:[course.concepts[0],course.prerequisite,'La rédaction statistique'],correct:0},
  {q:'Quelle méthode favorise une vraie progression ?',answers:['Regarder sans pratiquer','Faire un sprint puis vérifier ses erreurs','Tout apprendre la veille'],correct:1},
  {q:`Après ce chapitre, tu dois pouvoir…`,answers:[course.objective,'Éviter tout calcul','Passer directement au chapitre 15'],correct:0}
]

function CoursePlayer({id,go}:{id:string,go:(to:string)=>void}) {
  const course=getCourse(id); const {progress,toggleLesson,setResume,complete,setQuiz}=useProgress(); const checked=progress.lessonChecks[id]??[]
  const [tab,setTab]=useState<'cours'|'exercices'|'quiz'>('cours'); const [answers,setAnswers]=useState<number[]>([]); const [submitted,setSubmitted]=useState(false)
  useEffect(()=>setResume(id),[id,setResume]); const questions=quizFor(course); const score=answers.reduce((sum,a,i)=>sum+(a===questions[i].correct?1:0),0)
  const submit=()=>{if(answers.length<questions.length)return;setSubmitted(true);setQuiz(id,Math.round(score/questions.length*100));if(score>=2)complete(id)}
  const next=courses[course.order]
  return <><button className="back" onClick={()=>go('/programme')}>← Retour au programme</button><section className="course-head"><div><span className="eyebrow">Chapitre {String(course.order).padStart(2,'0')} · Semestre {course.semester}</span><h1>{course.title}</h1><p>{course.objective}</p><div className="course-meta"><span>{course.duration} min</span><span>{course.lessons.length} étapes</span><span>Prérequis : {course.prerequisite}</span></div></div><div className="chapter-stamp">{course.order}<small>/15</small></div></section>
    <div className="tabs"><button className={tab==='cours'?'active':''} onClick={()=>setTab('cours')}>Cours</button><button className={tab==='exercices'?'active':''} onClick={()=>setTab('exercices')}>Exercices</button><button className={tab==='quiz'?'active':''} onClick={()=>setTab('quiz')}>Quiz</button></div>
    {tab==='cours'&&<div className="player-grid"><section className="lesson-card"><span className="eyebrow">Plan du sprint</span><h2>À ton rythme, coche chaque étape</h2><div className="lesson-list">{course.lessons.map((lesson,i)=><label key={lesson}><input type="checkbox" checked={checked.includes(i)} onChange={()=>toggleLesson(id,i)}/><span><b>{i+1}</b><span>{lesson}<small>{i===0?'Comprendre':i===course.lessons.length-1?'Vérifier':'Pratiquer'}</small></span></span></label>)}</div>{checked.length===course.lessons.length&&<button className="button primary wide" onClick={()=>setTab('exercices')}>Passer aux exercices →</button>}</section><aside><section className="concept-card"><span className="eyebrow">Repères essentiels</span><h3>À retenir</h3><ul>{course.concepts.map(c=><li key={c}>{c}</li>)}</ul></section><section className="video-player"><div className="video-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${course.videoId}`} title={`${course.title} — ${course.videoTitle}`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div><div className="video-caption"><span className="eyebrow">Vidéo sélectionnée</span><b>{course.videoTitle}</b><a href={course.videoUrl} target="_blank" rel="noreferrer">Ouvrir sur YouTube ↗</a></div></section></aside></div>}
    {tab==='exercices'&&<ExercisePanel key={course.id} courseId={course.id}/>}
    {tab==='quiz'&&<section className="quiz-card"><span className="eyebrow">Validation du chapitre</span><h2>3 questions pour faire le point</h2><p>Deux bonnes réponses suffisent. Tu peux recommencer sans perdre de points.</p>{questions.map((q,i)=><fieldset key={q.q} disabled={submitted}><legend><span>{i+1}</span>{q.q}</legend>{q.answers.map((a,j)=><label className={submitted?(j===q.correct?'correct':answers[i]===j?'wrong':''):''} key={a}><input type="radio" name={`q${i}`} checked={answers[i]===j} onChange={()=>setAnswers(old=>{const n=[...old];n[i]=j;return n})}/>{a}</label>)}</fieldset>)}{submitted?<div className={`result ${score>=2?'success':'retry'}`}><strong>{score}/3 — {score>=2?'Chapitre validé !':'Encore un petit effort.'}</strong><p>{score>=2?'+ XP ajouté. La régularité paie.':'Relis les repères essentiels puis réessaie.'}</p>{score>=2&&next&&<button className="button primary" onClick={()=>go(`/cours/${next.id}`)}>Chapitre suivant →</button>}<button className="text-button" onClick={()=>{setSubmitted(false);setAnswers([])}}>Recommencer</button></div>:<button className="button primary" disabled={answers.length<3} onClick={submit}>Valider mes réponses</button>}</section>}
  </>
}

function Review({go}:{go:(to:string)=>void}) {
 const {progress}=useProgress(); const review=useMemo(()=>courses.filter(c=>progress.completed.includes(c.id)||progress.lessonChecks[c.id]?.length).sort((a,b)=>(progress.quizScores[a.id]??0)-(progress.quizScores[b.id]??0)).slice(0,4),[progress]);
 return <><section className="page-intro compact"><span className="eyebrow">Mémoire active</span><h1>Reviens juste<br/><em>avant d’oublier.</em></h1><p>Les chapitres les moins solides remontent ici. Une courte révision vaut mieux qu’une longue relecture.</p></section><section className="review-panel"><div className="review-copy"><span className="eyebrow">File de révision</span><h2>{review.length?`${review.length} chapitre${review.length>1?'s':''} à consolider`:'Commence un premier chapitre'}</h2><p>Refais le quiz, explique une notion à voix haute, puis note l’erreur qui t’a ralenti.</p></div><div className="review-list">{review.length?review.map((c,i)=><button key={c.id} onClick={()=>go(`/cours/${c.id}`)}><span>{i+1}</span><div><b>{c.title}</b><small>{progress.quizScores[c.id]!==undefined?`Meilleur score : ${progress.quizScores[c.id]}%`:'Cours en cours'}</small></div><i>Réviser →</i></button>):<button onClick={()=>go('/programme')}><span>1</span><div><b>Choisir mon point de départ</b><small>Le programme t’attend</small></div><i>Explorer →</i></button>}</div></section><Timer/></>
}

function Profile() {
 const {progress,xp,level,reset}=useProgress(); const [confirm,setConfirm]=useState(false); const badges=[['Premier pas','Terminer 1 chapitre',progress.completed.length>=1],['En série','Atteindre 3 jours',progress.streak>=3],['Sprinteur','Finir 3 focus',progress.focusSessions>=3],['Mi-parcours','Valider 8 chapitres',progress.completed.length>=8],['TC maîtrisé','Terminer les 15',progress.completed.length===15]]
 return <><section className="page-intro compact"><span className="eyebrow">Mon espace</span><h1>Des efforts visibles,<br/><em>pas de comparaison.</em></h1></section><div className="profile-grid"><section className="profile-card"><div className="avatar">Y</div><div><h2>{progress.learner}</h2><p>Élève · Tronc Commun Sciences</p></div><div className="level-pill">Niveau {level}<small>{xp} XP</small></div></section><section className="badges-card"><span className="eyebrow">Badges</span><h2>Petites victoires</h2><div className="badges">{badges.map(([name,desc,earned],i)=><div className={earned?'earned':''} key={String(name)}><span>{['✦','↗','◷','½','✓'][i]}</span><b>{name}</b><small>{desc}</small></div>)}</div></section><section className="settings-card"><span className="eyebrow">Données locales</span><h2>Ton progrès reste sur cet appareil</h2><p>Le parcours, les brouillons et les corrections reçues sont sauvegardés dans le navigateur. Seules les demandes de correction sont envoyées au serveur configuré.</p>{confirm?<div className="confirm"><b>Effacer toute la progression ?</b><button onClick={()=>{reset();setConfirm(false)}}>Oui, tout effacer</button><button onClick={()=>setConfirm(false)}>Annuler</button></div>:<button className="danger-button" onClick={()=>setConfirm(true)}>Réinitialiser ma progression</button>}</section></div><SourceNote/></>
}

function SourceNote(){return <p className="source-note">Programme structuré à partir du référentiel public de <a href="https://lemathemagicien.ma/lycee/mathematiques-tronc-commun/" target="_blank" rel="noreferrer">Le Mathémagicien — Mathématiques Tronc Commun ↗</a>. <strong>Référence de séquençage pour cette maquette, à valider par l’enseignant.</strong> MathSprint TC est un outil indépendant.</p>}

export default function App(){const {path,go}=useRoute();let page:ReactNode;if(path==='/programme')page=<Curriculum go={go}/>;else if(path==='/revision')page=<Review go={go}/>;else if(path==='/profil')page=<Profile/>;else if(path==='/admin')page=<AdminPage/>;else if(path.startsWith('/cours/'))page=<CoursePlayer id={decodeURIComponent(path.slice(7))} go={go}/>;else page=<Dashboard go={go}/>;return <Shell path={path} go={go}>{page}</Shell>}
