export type User = {
  id: string
  email: string
  displayName: string
  role: 'student' | 'admin'
  createdAt: string
  lastSeenAt: string
}

export type ProgressState = {
  completed: string[]
  resumeId: string
  streak: number
  focusSessions: number
  lessonChecks: Record<string, number[]>
  quizScores: Record<string, number>
}
