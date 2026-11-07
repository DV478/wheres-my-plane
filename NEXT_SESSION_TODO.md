# Next session — start here

Paused 2026-11-07 after user reviewed quality-recovery plan and logged off.
Full plan: [QUALITY_RECOVERY_PLAN.md](./QUALITY_RECOVERY_PLAN.md). This is the
one-page start-here version.

## What's decided

- All seven fixes approved.
- Background direction locked: **Option A — subtle gradient + faint texture** (CSS only, no photos for now).
- Guardrails revised so user doesn't write per-task acceptance criteria.
- Phases 4/5/6/7 (Voice, Photo, Price, PWA) stay deferred.

## Already done 2026-11-07 (before log-off)

**Fix 7 — Guardrails** landed first (reordered from position 3 after user push-back that boring plumbing shouldn't be deferred). Three files exist at repo root: `QUALITY_BAR.md`, `OPEN_DECISIONS.md`, `CLAUDE.md`. Every subsequent fix lands under the new discipline. Not committed yet.

## Do these in order

Each fix is self-contained. Do them one at a time, show user the result before moving to the next. All work by Claude (Opus plans, Sonnet executes).

### 1. Stop the lying (1–2 h) — W1 in the plan

- Delete "Phase 3" text everywhere in signed-in app.
- Flight detail page: replace "Aircraft not yet assigned — airlines publish late" with one of three honest reasons (too early / airline not published / we failed to fetch), plus a Refresh button.
- Landing page: split feature tiles into "Available today" and "Coming later" rows.
- Fix the OTP badge so it never renders raw strings like "pending", "unavailable", or "EUROCONTROL" without a human label.

**User will see:** no more placeholder text, honest empty states, clearly-labelled upcoming features.

### 2. Dashboard onboarding (1–2 h) — W4 in the plan

- Primary action at top: "Add your first flight" (if none) or flight list (if any).
- Scheduler panel becomes secondary with a plain-English explanation of what Start does.
- Top nav: replace raw email with an initial-in-a-circle menu.
- Remove the "What's next" phase roadmap block.

**User will see:** a dashboard that tells them what to do first.

### 3. Flight detail depth (3–4 h) — W2 in the plan

- Big coloured status chip at the top (green/amber/red/sky/slate).
- Live countdown: "Departs in 2h 14m" updating every minute.
- Fix the aircraft lookup properly: wire the AeroDataBox cooldown (so we actually move to the next API when blocked), fix the QR→QTR airline code lookup so QR4-class flights resolve.
- Add a Refresh button that re-runs the lookup on demand.

**User will see:** flight detail page becomes the emotional payoff — status at a glance, time left, accurate aircraft info or a real reason why not.

### 4. Map popup enrichment (3–5 h) — W3 in the plan

- Click a plane → popup shows airline, route (LHR → DOH), callsign, flight number, a Planespotters photo at the top, technical data below.
- Toggle buttons get On/Off labels + `aria-pressed`.
- "Look up in my flights" link only renders when the aircraft is actually one of the user's saved flights.

**User will see:** a Flightradar24-grade popup that's genuinely useful.

### 5. Airport disruption tracker (4–6 h) — W5 in the plan

- New page `/app/airports`.
- User can add any airport by IATA code (LHR, JFK, etc.).
- Each watched airport shows: delay status + reason if delayed.
- US airports use FAA NAS live feed (free, no quota).
- Non-US airports say "Monitoring — no public delay feed available" (honest, not fake data).
- Dashboard shows a 3-row summary card linking to the full page.
- Needs migration `0005_recovery_airport_watch.sql` for the `user_airport_watches` table.

**User will see:** the airport-monitor feature that was lost finally built, with honest gaps named.

### 6. Visual polish (2–3 h) — W6 in the plan

Direction already chosen: **A — subtle gradient + faint texture.**

- Radial gradient wash on body.
- SVG grain pattern at ~1.5% opacity on app shell.
- Define `--color-sky-glow` and `--color-amber-warn` for accents.
- Apply identically across all signed-in pages via layout wrapper.

**User will see:** backgrounds that look chosen, not scaffolded. Zero licensing drama.

## What to show user at each step

After each fix lands, give a short "I built X, here's what you'll see on page Y" note. User tests visually. Don't hand them DevTools checklists (per [[feedback-no-browser-qa-checklists]]).

## Deploy cadence

Deploy after each fix lands + user confirms it works. Three paths:
1. Deploy per fix (safest, slow)
2. Deploy per cluster (fixes 1+2+3 together, then 4, then 5, then 6, then 7)
3. Deploy at the end only (fastest, riskiest)

**Recommend 2.** Fixes 1–3 are small enough to batch; 4–7 are chunky enough to deploy individually.

## Deferred (don't touch)

- Voice Q&A (Phase 4)
- Photo spotter (Phase 5)
- Price monitoring (Phase 6)
- PWA + push (Phase 7)
- Three ingest workflows (EUROCONTROL/BTS/CAA) — user agreed to keep punctuality honest-blank rather than build these now.
- NL "parsed as:" preview, IANA timezone dropdown, airline logos, flight-detail track map — all explicitly punted.

## Open decisions

None. User has signed off on everything needed to start.
