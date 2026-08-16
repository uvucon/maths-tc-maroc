# MathSprint TC — Revamp Integration Spec (post-#8)

This file complements `BRIEF.md`. It is the **single source of truth for the
post-#8 integration** (calendar + admin + server wiring fix). Jules sessions
that rebase W5/W6 onto the merged W4 (user accounts) must read this first.

## State after PR #8 merge

- `main` HEAD = `0a9ba92` (MathSprint TC revamp — USER ACCOUNTS + PROGRESS, #8)
- PR #8 brought in:
  - `server/auth.mjs` — cookie-based JWT auth (uses `better-sqlite3`)
  - `server/db.mjs` — better-sqlite3 connection, schema: `users(id, email,
    passwordHash, displayName, role, createdAt, lastSeenAt)` and
    `progress(userId, payload, updatedAt)`
  - `src/store.tsx` rewritten to fetch from API
  - `server.mjs` mounts `createAuthRouter({ db, jwtSecret })`
- PR #15 (videos) and PR #16 (exercise bank re-typeset) also merged.

## CRITICAL: server wiring bug — JOB 1 (must land first)

`server-lib.mjs:createApp()` registers the 404 catch-all AND the SPA fallback
INSIDE `createApp()`, BEFORE the user has a chance to call
`app.use(myRouter)`. That means the 404 catch-all registered at line 193 runs
AFTER express.static but **before** `app.use(authRouter)` /
`app.use('/api/calendar', ...)` from `server.mjs`. Result: every request that
doesn't match a built-in route returns `{"error":"Route inconnue."}` 404, so
**the entire auth router and calendar router are unreachable**.

Reproduction (run after `npm ci`):
```
JWT_SECRET=dev-secret ADMIN_TOKEN=dev node server.mjs &
curl -i http://127.0.0.1:4173/api/me
# -> HTTP/1.1 404 Not Found (should be 401)
curl -i -X POST http://127.0.0.1:4173/api/auth/register -H 'Content-Type: application/json' -d '{"email":"a@b.com","password":"hunter22","displayName":"A"}'
# -> HTTP/1.1 404 Not Found (should be 201 or 409)
```

**Fix shape (JOB 1 of this session):**

1. Remove the 404 catch-all + JSON error handler from the bottom of
   `createApp()` in `server-lib.mjs`.
2. Export a new function `lateMiddleware(app)` from `server-lib.mjs` that
   registers: (a) `express.static(dist)` fallback (only if `dist` exists),
   (b) the SPA index fallback for non-API GETs, (c) the JSON 404 catch-all,
   (d) the JSON error handler. Order: static, SPA fallback, 404, error.
3. In `server.mjs`, call `lateMiddleware(app)` **AFTER** mounting every user
   router (`authRouter`, calendar router, admin router). This is the only
   way the user-mounted routers ever run.

**Acceptance test for JOB 1:**

Add a new test case `test/server-wiring.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../server-lib.mjs'
import db from '../server/db.mjs'
import { createAuthRouter } from '../server/auth.mjs'
import crypto from 'node:crypto'

test('app.use(router) in caller reaches mounted routes after lateMiddleware', async () => {
  const app = createApp()
  const authRouter = createAuthRouter({ db, jwtSecret: 'test-secret' })
  app.use(authRouter)
  // import lateMiddleware and apply
  const { lateMiddleware } = await import('../server-lib.mjs')
  lateMiddleware(app)
  const server = app.listen(0, '127.0.0.1')
  await new Promise(r => server.once('listening', r))
  const port = server.address().port
  try {
    const me = await fetch(`http://127.0.0.1:${port}/api/me`)
    assert.equal(me.status, 401) // NOT 404
  } finally { server.close() }
})
```

`npm test` must pass with this test included.

## JOB 2 — Admin W6 rebase

Branch base: `origin/jules/admin-panel-v2-1674162244437982259` (commit
`9e07619`). It was authored before #8 merged and uses incompatible
primitives. Rebase it onto current `main` AFTER JOB 1 lands.

### Conflicts to resolve

| Original (PR #11) | Current main | Resolution |
|---|---|---|
| `server/db.mjs` with `node:sqlite` `DatabaseSync`, `password` col, `sessions` table, `streak` col, `deletedAt` col | `server/db.mjs` with `better-sqlite3`, `passwordHash`, `progress` table (payload JSON), no `streak` col, no `deletedAt` | **Drop the file from PR #11** (main already has `server/db.mjs`). Extend main's `server/db.mjs` additively with `app_settings(key, value)` table for theme presets. Don't add `sessions`/`streak`/`deletedAt`. Use `users.lastSeenAt` for "active users" analytics. |
| Standalone `requireAdmin` middleware using `Bearer <JWT>` and parsing HMAC manually | Main uses cookie auth via `createAuthRouter` → `authMiddleware` extracts from cookie | **Reuse main's `authMiddleware`** which sets `req.userId`. Add a `requireAdminRole` middleware that runs after `authMiddleware` and checks `req.userRole === 'admin'` (or query the DB). Use the same `authMiddleware`-extraction trick as PR #17 server.mjs. |
| `useAuth()` reads from `localStorage.getItem('jwt')` | Main uses cookie auth | **Rewrite `useAuth()`** to either fetch `/api/me` once (best) or parse the JWT from `document.cookie`. Either way must reflect the W4 auth model. |
| Bootstrap admin via `ADMIN_EMAIL` env + random hex password logged to stdout | Main has `ADMIN_TOKEN` for legacy `/api/admin/*` | **Keep both.** Add an `ADMIN_EMAIL`+`ADMIN_PASSWORD` bootstrap that, if set, seeds an admin user in `users` with `role='admin'` and `passwordHash=bcrypt(ADMIN_PASSWORD)`. Don't randomize if `ADMIN_PASSWORD` is set explicitly. Log once at startup. |
| Analytics SQL uses `sessions.startedAt`, `users.streak`, `sessions.durationMin` | Main has `progress.payload` JSON (with `focusSessions`, `streak`, `lastUpdatedAt`) | **Rewrite analytics** to query `progress` JSON via SQLite JSON functions (`json_extract`). Drop the `sessions` table reference. Sample analytics shape (still return `{totalUsers, newUsersLast7d, activeUsersLast7d, totalSessions, avgSessionsPerUser, avgSessionDurationMin, topCourses, streakHistogram, dailyActiveLast14d}` with sensible fallbacks if data is missing — empty arrays/zeros, never throw). |

### File ownership for JOB 2

Owned (add/rewrite freely):

- `src/exercises.tsx` (only the `AdminPage`, `LLMConfigPage`, `ThemePanel`,
  `UsersPanel`, `AnalyticsPanel`, `useAuth`, `Sparkline` exports — keep the
  existing `ExercisePanel` as-is)
- new `server/admin.mjs`
- `server/db.mjs` (extend additively only — do NOT drop existing schema)
- `server.mjs` (mount the admin router and call `lateMiddleware(app)` LAST)
- `src/types.ts` (keep the existing `ThemePreset` export; do not remove
  anything PR #17 or PR #8 added)
- `test/admin.test.mjs` (rewrite to use main's `better-sqlite3` db and cookie
  auth, NOT the old `createDb()` factory)

Forbidden:

- `shared/exercises.json`, `src/data.ts`, `src/styles.css`,
  `src/exercise-styles.css`, `src/calendar.css`, `src/Calendar.tsx`,
  `src/App.tsx` (do not re-touch — PR #17 already wired the route)
- `server/auth.mjs` (do not rewrite — only IMPORT from it)
- `src/store.tsx` (do not touch — owned by PR #8)

### Admin endpoints shape (final)

```
GET    /api/admin/themes            (auth + admin role)
PUT    /api/admin/themes            (auth + admin role)
GET    /api/admin/settings          (auth + admin role)
GET    /api/admin/users             (auth + admin role)
PUT    /api/admin/users/:id         (auth + admin role)
DELETE /api/admin/users/:id         (auth + admin role)
GET    /api/admin/analytics         (auth + admin role)
```

All require a logged-in user with `role='admin'`. 401 if no cookie, 403 if
logged in but not admin.

### `useAuth()` shape

```ts
export function useAuth(): { token: string; user: User } | null {
  // Use the existing /api/me endpoint to fetch the current user.
  // Fall back to reading the JWT from the cookie synchronously to avoid a
  // flash. Return null while loading.
}
```

`User` is `{ id, email, displayName, role }`. If `useAuth()` is async, render
a loading state in `AdminPage` until it resolves.

## Hard rules

1. Branch off current `origin/main` (after JOB 1 is on main).
2. Commits authored `Peter <peter@uvundileconsulting.com>` on every commit.
   No "Co-authored-by: Jules".
3. No new dependencies except `better-sqlite3` (already in deps) and
   `bcryptjs` (already in deps for PR #8).
4. `npm run lint && npm run typecheck && npm test && npm run build` MUST pass.
5. Smoke-test: `JWT_SECRET=dev-secret ADMIN_TOKEN=dev ADMIN_EMAIL=admin@x.test
   ADMIN_PASSWORD=hunter22 node server.mjs &`, then:
   - `curl -i http://127.0.0.1:4173/api/me` → 401 (NOT 404)
   - register, login, `curl --cookie /tmp/c -i http://127.0.0.1:4173/api/me` → 200
   - bootstrap admin login, `curl --cookie /tmp/c2 -i http://127.0.0.1:4173/api/admin/users` → 200 (NOT 403)
   - `curl -i http://127.0.0.1:4173/api/calendar/sessions --cookie /tmp/c` → 200
6. Add Node `--test` cases under `test/` covering both JOB 1 and JOB 2.
7. AUTO_CREATE_PR opens the PR; PR body lists owned files + last lines of
   the four-gate output.