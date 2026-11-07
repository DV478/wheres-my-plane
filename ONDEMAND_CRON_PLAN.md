# On-Demand Cron Switch — Implementation Plan

Switch Where's My Plane from a continuous (and broken) every-minute GitHub Actions cron
to an on-demand "run only while I'm actively using the app" model. Keep all always-on
scaffolding intact for a trivial flip-back when real users arrive.

---

## 1. Decision summary

### Q1. Where does the "Start" button live?

**Decision:** `/app` (authenticated dashboard home).

**Rationale:** The endpoint it calls now drives real paid API quota. Hiding it behind
the existing magic-link invite gate is free defence-in-depth. The public landing
(`/`) stays a pure pitch page — matches the showcase story. The user is the only
user anyway, so "post-login" costs nothing in UX.

**Rejected:** Public landing page button. Would require either an unauthenticated
kick endpoint (quota-exposed) or inline sign-in (worse UX than the current
"Sign in" CTA that already exists).

### Q2. How does Start keep ticks firing?

**Decision:** Browser-driven `setInterval` on `/app` POSTing `/api/scheduler/kick`
every 60s while active. Component-scoped; dies with the tab.

**Rationale:** Zero server state. No D1 flag rows, no timer drift, no "did I
remember to clear it?" bugs. Naturally bounded by tab lifetime — the exact
semantic you want. Visibility API lets us suppress ticks while the tab is
backgrounded so idle desktop tabs don't quietly burn quota.

**Rejected A — Session-flagged D1 row:** Keeps the GitHub cron as the heartbeat
engine. The GitHub cron is the thing we're trying to escape (it only fires
~3x in 8h and is unreliable). Also adds a new table and a cleanup problem.

**Rejected B — Hybrid heartbeat + separate ticker:** Overbuilt for one user.

### Q3. How does work stop?

**Decision:** Three layers, all passive except one:

1. **Tab close / navigation away** — `setInterval` is on a Svelte `$effect`;
   cleanup runs automatically.
2. **Tab hidden** (`document.visibilityState === 'hidden'`) — skip the tick but
   keep the interval scheduled; resume when visible again. Prevents forgotten
   background tabs from burning quota on a laptop.
3. **Explicit "Stop" button** — flips a local `active` store to false, which
   tears down the interval. Lets the user park the tab open without ticking.

**Rejected `navigator.sendBeacon` on unload:** Only useful if we had server-side
state to clean up. We don't.

**Rejected idle timeout:** Browser already dies with the tab; adding a 10-min
auto-stop is cute but one more thing to misbehave. Skip.

### Q4. What stays for always-on flip-back?

- **`src/lib/server/scheduler.ts`** — zero changes. The tick logic doesn't care
  who calls it.
- **`src/routes/api/cron/tick/+server.ts`** — zero changes. Still accepts the
  `x-wmp-cron-secret` header, still callable by GitHub Actions.
- **`.github/workflows/cron.yml`** — comment out just the `schedule:` block;
  keep `workflow_dispatch:` so manual fires from the Actions UI still work.
  A README-style comment at the top explains how to flip back.

**Flip-back procedure (documented in the workflow file):**

```yaml
on:
  schedule:
    - cron: '* * * * *'      # <- uncomment this and the line above
  workflow_dispatch:
```

Plus optionally remove the Start button component mount from `/app` (or leave it
— harmless when the cron is also running, since the KV `cron:lock` makes
overlapping runs idempotent).

### Q5. One-off manual tick (CLI)

**Decision:** Add `npm run tick` → `node scripts/tick.mjs`. Script reads
`WMP_CRON_SECRET` from `.dev.vars`, POSTs
`http://localhost:5173/api/cron/tick` with the header. Stays independent of the
browser flow — it's the dev escape hatch.

**Rationale:** The existing secret-gated endpoint already handles this exact
case correctly; we're just wrapping curl in a Node script that reads
`.dev.vars` so Windows users don't have to construct a curl incantation.
Cross-platform via Node's `fetch` (Node 18+).

### Q6. Auth on the client-callable endpoint

**Decision:** New endpoint `/api/scheduler/kick` gated by the **session cookie**
(`event.locals.user != null`). No secret header. The existing
`/api/cron/tick` secret-gated endpoint is untouched.

**Rationale:** Secrets in browser JS are not secrets. Session cookies are
already httpOnly and present on `/app`. The new endpoint is a thin wrapper
that:

1. Checks `locals.user` — throw 401 if null.
2. Calls `tickOnce(env)` with the same arg shape as `/api/cron/tick`.
3. Returns JSON.

Having two endpoints (cron-secret and session-cookie) means flip-back is zero
backend changes — just re-enable the GitHub cron.

**Rate-limiting:** In-memory per-session rate limit is awkward on Cloudflare
(no shared memory across workers). Pragmatic approach: the KV `cron:lock`
(60s TTL) in `tickOnce` already prevents overlap. For a one-user app that's
sufficient. If you later want hard per-session caps, a D1 `kick_log` row with
a `COUNT(*) WHERE created_at > now - 60` gate is a 10-line addition — not
needed yet.

---

## 2. File-by-file changes

### Modify

**`.github/workflows/cron.yml`**
- Comment out the `schedule:` block (both `schedule:` and the `- cron: '* * * * *'`
  line). Keep `workflow_dispatch:`.
- Replace the top-of-file comment with text explaining the current on-demand mode
  and the two-line uncomment-to-restore procedure.

**`src/routes/app/+page.svelte`**
- Add a small client-side Scheduler panel at the top: Start / Stop button,
  status text ("Idle" / "Active — last tick 3s ago" / "Paused — tab hidden"),
  and a tick counter.
- Component owns a `$state` boolean `active`, a tick counter, a last-tick
  timestamp, and a `visibilityState` watcher.
- `$effect`: when `active`, set up `setInterval(kick, 120_000)` (2 min). On
  visibility change, skip ticks while hidden. Cleanup tears down the interval.
- `kick()` does `fetch('/api/scheduler/kick', { method: 'POST' })`, parses the
  `{ processed, alerts_sent, errors }` response, updates UI, logs errors to
  the status line (don't throw — keep the interval alive).

**`package.json`**
- Add `"tick": "node scripts/tick.mjs"` to `scripts`.

### Create

**`src/routes/api/scheduler/kick/+server.ts`** (new)
- `export const POST: RequestHandler = async ({ locals, platform }) => { ... }`
- Reject if `!locals.user` with 401.
- Reject if `!platform?.env?.DB || !platform.env.CACHE` with 500.
- Call `tickOnce({ DB, CACHE, SESSION_SECRET, AERODATABOX_RAPIDAPI_KEY,
  AIRLABS_KEY, AVIATIONSTACK_KEY, TELEGRAM_BOT_TOKEN })` — same env shape as
  `/api/cron/tick`.
- Return `json({ ok: true, ...result })`.
- Mirror the error-handling pattern from `/api/cron/tick/+server.ts` (log.warn,
  throw 500).

**`scripts/tick.mjs`** (new)
- Read `.dev.vars` from CWD, parse `WMP_CRON_SECRET=...` line.
- Default target `http://localhost:5173/api/cron/tick`; override via
  `WMP_TICK_URL` env.
- `fetch(url, { method: 'POST', headers: { 'x-wmp-cron-secret': secret,
  'content-length': '0' } })`.
- Print status + body. Exit 1 on non-200.
- Node 18+ `fetch` is global; no dependencies.

### Delete

- None.

---

## 3. Execution order (for the Sonnet execution agent)

Each step small enough to verify independently. Run `npm run check` after each
code step; it catches both TS and Svelte errors.

1. **Disable the GitHub cron schedule.**
   Edit `.github/workflows/cron.yml`: comment out the two `schedule:` lines,
   leave `workflow_dispatch:`. Update the top-of-file comment block to
   explain on-demand mode and show the flip-back snippet.
   Verify: file still parses as YAML; `workflow_dispatch:` remains. Nothing
   deployed yet.

2. **Add the `npm run tick` script.**
   a. Create `scripts/tick.mjs` per the spec in §2.
   b. Add the `tick` entry to `package.json` scripts.
   Verify: with `npm run dev` in another shell and `.dev.vars` populated,
   `npm run tick` prints `status: 200` and the JSON tick result.

3. **Create the session-gated kick endpoint.**
   Create `src/routes/api/scheduler/kick/+server.ts`. Copy the shape of
   `src/routes/api/cron/tick/+server.ts`; swap the secret check for a
   `locals.user` check.
   Verify: `npm run check` passes. Manual curl with no cookie returns 401.

4. **Add the Start/Stop UI to `/app`.**
   Edit `src/routes/app/+page.svelte` per §2. Keep the existing "Your flights"
   / "Live map" buttons and "What's next" list below.
   Key implementation notes for the Sonnet agent:
   - Use Svelte 5 runes (`$state`, `$effect`, `$derived`) — matches the rest
     of the codebase (see the `let { data } = $props();` pattern already there).
   - Interval cadence: 120_000 ms (2 minutes). Slower than the previous 60s
     GitHub cron to stretch free-tier API quota; scheduler cadence math
     (`CADENCE_T_MINUS_2H = 5 * 60`) is unaffected because it gates on
     elapsed time, not on being called every minute.
   - Fire one immediate kick on Start before scheduling the interval, so the
     first tick doesn't wait 2 min.
   - Wrap the `fetch` in try/catch; on error, update a `lastError` state line
     but leave the interval alive.
   - On `document.visibilityState === 'hidden'`, skip that tick cycle;
     resume when `visible`. Show "Paused — tab hidden" in the status line.
   Verify: load `/app` in a browser, click Start, watch Network tab show one
   POST every 2 minutes. Click Stop — requests stop. Switch to another tab
   for 2 min — requests stop. Return to the tab — they resume.

5. **Smoke test end-to-end locally.**
   a. `npm run dev`
   b. Sign in (magic link) → land on `/app`
   c. Click Start → confirm one immediate POST + further POSTs every 2 min
   d. Verify D1 `flight_checks.last_check_at` advances for any due row
      (`npm run db:console:local -- "SELECT flight_id, last_check_at FROM
      flight_checks ORDER BY last_check_at DESC LIMIT 5"`)
   e. Click Stop → confirm no more POSTs.

6. **Deploy.**
   `npm run deploy`. No new secrets to set — session cookie is already live.
   `WMP_CRON_SECRET` stays set so `/api/cron/tick` keeps working for manual
   fires from the GitHub Actions UI (`workflow_dispatch`).

7. **Manual sanity check in prod.**
   Hit `https://wheres-my-plane.pages.dev/app`, log in, click Start, watch
   DevTools Network panel, click Stop.

---

## 4. Flip-back procedure (for future always-on mode)

When real users arrive and continuous background work is justified:

1. In `.github/workflows/cron.yml`, uncomment:
   ```yaml
   schedule:
     - cron: '* * * * *'
   ```
2. (Optional) Remove the Start/Stop panel from `src/routes/app/+page.svelte`,
   or leave it — the KV `cron:lock` makes overlapping runs idempotent, and
   a user clicking Start while the GitHub cron is already running is a no-op.

That's it. `scheduler.ts`, `api/cron/tick`, auth, migrations, and the
`npm run tick` escape hatch all remain exactly as they are.

---

## 5. Risks and edge cases

- **Rows that genuinely need periodic attention when nobody's watching.** Today
  `tickOnce` only processes `flight_checks` where `next_check_at <= now`. Those
  rows don't expire or decay — they just stay due until the next kick. The
  moment the user clicks Start, everything due gets processed in the first
  batch (BATCH_SIZE = 50) and the next minute processes the next 50, etc.
  Safe. **But** if a future phase adds, say, a `cleanup_jobs` table or
  session-expiry sweeps, they will stop running too. Add a note in
  `scheduler.ts` reminding future work that on-demand mode exists.

- **Telegram alerts batch up.** If a flight went from `scheduled` → `boarding`
  → `departed` while the user was away, the next tick after Start will
  process whatever the aviation API currently says, then diff against
  `last_status`. So the user gets **one** alert ("status: departed")
  rather than two. That's a feature for showcase-mode, worth calling out.

- **First-tick jitter.** The browser interval timing can drift under tab
  throttling. Not a correctness issue (cadence is 120s±, scheduler handles
  that), just know the user will sometimes see 121s or 125s between ticks in
  Network tab.

- **KV lock already prevents overlap.** Two tabs open on `/app` both clicking
  Start is safe — the second tab's kick will see `cron:lock` held and return
  `{ processed: 0 }`. No duplicate API spend. (Note: the existing KV lock has
  a 60s TTL, which is tighter than the 120s cadence — still safe; it just
  means the lock will usually be released well before the next tick fires.)

- **Session expiry mid-ticking.** Session cookie is 30d; unlikely to expire
  mid-session. If it does, kicks return 401 and the panel's `lastError`
  surfaces it. Add a UI hint: "Session expired — reload to sign in again."

- **Rate limits.** Even at one user, aviation APIs are per-day — if the user
  opens `/app` and leaves it on all day with Start active, you'll still rack
  up ~720 ticks (24h × 30 ticks/h at the 2-min cadence). The browser
  `visibilitychange` suppression helps for background tabs but not for a
  left-foreground tab. If budget pressure returns, add a "max ticks per
  session" cap in the panel (e.g. auto-Stop after 30 ticks = 1h continuous
  use). Not needed in v1.
