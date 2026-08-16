# MathSprint TC — Revamp Coordination Brief

This brief is for **all six parallel Jules sessions** working on this repo. Read it first.

## Repo

- Repo: `uvucon/maths-tc-maroc` (private)
- Branch base: `main` (HEAD = `f919652`)
- Stack: Vite + React + TypeScript + Express + `multer` (single root, no monorepo)
- Lines of code: ~650 across `src/`, `shared/`, `server-lib.mjs`, `server.mjs`
- Existing routes: `/`, `/programme`, `/revision`, `/profil`, `/admin`, `/cours/:id`
- Existing persistence: `localStorage` (`mathsprint-tc-exercises-v1`) and a single in-memory admin config

## Hard constraints (do not violate)

1. **Language**: every user-facing string in French. Code identifiers, comments, commits: English.
2. **No new heavy framework** (no Next.js, no Tailwind, no Chakra). Stay on Vite + React + the CSS already in `src/styles.css` (extend it; do not introduce Tailwind).
3. **No external paid services** (no Firebase, no Supabase). User accounts use a **local SQLite** file via `better-sqlite3` served by the existing Express backend, plus a JWT cookie. The admin password is `ADMIN_TOKEN` env var.
4. **Videos stay YouTube embeds** (`https://www.youtube.com/embed/<id>`). The `videoId` map in `src/data.ts` may be **rewritten** if you find better French-language videos that match each chapter.
5. **Exercises**: must be sourced from Moroccan Tronc Commun past exams / ccn / regionais. Each statement should be written out (re-typeset, not copy-pasted), with `source`, `year`, and `examiner` fields. No copyrighted verbatim reproduction of long passages — short, original restatements that cite the source are fine.
6. **Target audience**: 16-year-old Moroccan students. Joyful but professional, French language, RTL not required (the curriculum is in French).
7. **Commits**: author = "Peter" `<peter@uvundileconsulting.com>` (already set in this clone). No "Co-authored-by: Jules".
8. **Tests**: every workstream adds Node `--test` cases under `test/`. CI runs `npm run lint && npm run typecheck && npm test && npm run build` — all four must pass.
9. **Do not modify another workstream's owned files.** If you need a shared change, propose it in your PR description and let the integrator (Hermes) handle it.

## File-domain ownership map

Each session touches ONLY the files in its column. Cross-cutting changes (e.g. new shared types) go through a single small `src/types.ts` module — first session to need it adds the file and exports, the others import.

| # | Workstream                          | Owned files (add/rewrite freely)                                                                                          | Forbidden                                                                                |
|---|-------------------------------------|---------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------|
| 1 | Visual redesign                     | `src/styles.css`, `src/exercise-styles.css`, `index.html`, `src/main.tsx`, `src/App.tsx` (Shell + route components only)  | `server-lib.mjs`, `server.mjs`, `src/store.tsx`, `src/data.ts`, `shared/exercises.json`   |
| 2 | French video curation               | `src/data.ts` (only the `videos` map and `videoUrl`/`videoId` derivation)                                                  | any `.css`, `.tsx` outside `data.ts`                                                      |
| 3 | Moroccan-exam exercise bank         | `shared/exercises.json`, `src/exercises.tsx` (UI for the new bank; reuse existing `ExercisePanel` shape)                   | `src/App.tsx`, `src/data.ts`, `server-lib.mjs`, `server.mjs`, any `.css`                  |
| 4 | User accounts + progress            | `src/store.tsx` (rewrite to fetch from API; keep same hook API), new `server/auth.mjs`, new `server/db.mjs`, `server.mjs` (mount routes only) | `src/styles.css`, `src/App.tsx`, `src/data.ts`, `shared/exercises.json`                   |
| 5 | Calendar / study planner            | new `src/Calendar.tsx`, new `src/calendar.css`, append route `/calendrier` in `src/App.tsx` (one line), append nav entry  | `server-lib.mjs`, `server.mjs`, `src/store.tsx`, `src/data.ts`, `shared/exercises.json`   |
| 6 | Admin panel v2                      | `src/exercises.tsx` (rewrite `AdminPage` only), new `server/admin.mjs` (themes, user mgmt, analytics), `server.mjs` (mount) | `src/App.tsx` body, `src/store.tsx`, `src/data.ts`, `shared/exercises.json`, any `.css`   |

If two workstreams both need a tiny change in a file neither owns (e.g. a new nav button on the Shell), stop and write a **note in your PR body** — Hermes will merge that line on top.

## Shared types module (allowed, write-once)

Create `src/types.ts` if and only if you need a type the others should reuse. The first to do so wins. Recommended contents (workstream 4 owns):

```ts
export type UserRole = 'student' | 'admin'
export interface User { id: string; email: string; displayName: string; role: UserRole; createdAt: number }
export interface ProgressState {
  completed: string[]
  resumeId: string
  streak: number
  focusSessions: number
  lessonChecks: Record<string, number[]>
  quizScores: Record<string, number>
}
```

Workstream 5 (`Calendar`) may extend with:
```ts
export interface PlannedSession { id: string; userId: string; courseId: string; lessonId?: string; start: string /* ISO */; durationMin: number; color: 'blue'|'green'|'orange'|'pink'|'violet'; notes?: string }
```

Workstream 6 (`Admin`) may add:
```ts
export interface ThemePreset { id: string; label: string; vars: Record<string,string> }
```

## Build / verify (every workstream must run before opening PR)

```bash
cd /opt/data/workspace/maths-tc-maroc
npm run lint
npm run typecheck
npm test
npm run build
```

All four must succeed. The integrator (Hermes) will run this again on every PR before merging.

## PR conventions

- Branch name: `jules/<workstream>-<short>` (e.g. `jules/visual-redesign`, `jules/user-accounts`).
- PR title: `[<workstream>] <imperative summary>`.
- PR body MUST list: (a) the workstream name, (b) the issue number it closes, (c) the owned files changed, (d) the verification commands run with their last lines of output.
- Target branch: `main`.

## What the integrator (Hermes) does after each PR lands

1. Re-runs the four commands on `main` post-merge.
2. Spins up `node server.mjs` on a tunnel and smoke-tests the live UI.
3. Closes the matching issue.
4. Spawns a follow-up Jules session only if a workstream left known TODOs.

Do not try to integrate other workstreams' PRs yourself.
