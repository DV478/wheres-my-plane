# Quality Recovery Plan — Where's My Plane

Written 2026-11-07 after the first real user test flopped. Inputs:
`FEEDBACK_2026_11_07.md` (user's raw observations), `REFLECTION_2026_11_07.md`
(systemic root-cause analysis), `UX_INSPECTION_2026_11_07.md` (15 ranked UX
issues). Phases 4 (Voice), 5 (Photo), 6 (Price), 7 (PWA) stay deferred.

---

## §1. Quality bar (testable statements)

The recovery is done when all of these are simultaneously true on https://wheres-my-plane.pages.dev:

1. No string containing the word "Phase" is rendered anywhere in the signed-in app except on an explicit internal `/debug` route.
2. The flight detail page for a flight within its departure window shows a prominent status chip whose colour matches status semantics (green on-time/landed, amber delayed, red cancelled, sky airborne, slate scheduled/unknown).
3. The flight detail page shows a live countdown ("Departs in 2h 14m") when `sched_dep_utc` is in the future and within 48h.
4. When `aircraft` is null on the detail page, the copy names the cause (we tried and failed / not yet broadcast by airline / we don't poll outside the 72h window) rather than guessing.
5. Aircraft lookups succeed on day-of-travel at least 80% of the time for QR4-class flights in manual retest; cause: cooldown wiring + ICAO/IATA retry + manual refresh button.
6. The map popup for any clicked aircraft shows, at minimum: operator (airline), callsign-derived flight-number when available, route (from `adsbdb` callsign lookup), plus the existing transponder block.
7. The map popup shows a Planespotters photo when one exists for the hex or reg, lazy-loaded, within 500ms of click.
8. The dashboard (`/app`) opens with a clear first action ("Add your first flight" or "View your N flights") above the scheduler panel, and the scheduler panel carries a single-sentence plain-English explanation.
9. The "What's next" phase list is removed from the dashboard.
10. The `/app/airports` route exists; a user can add an airport (e.g. LHR) to a watchlist and see current disruption indicators for it (NAS feed for US airports, EUROCONTROL table + ADS-B-derived volume for others).
11. The app shell has a visible, deliberate background treatment that is not a flat solid colour. The treatment is identical across all signed-in pages.
12. The nav header no longer renders the raw user email as plain text.
13. The OtpBadge never renders the raw string "pending", "unavailable", or a bare source code like "EUROCONTROL" without a human sentence next to it.
14. Every commit landed under this recovery has an "Acceptance criteria" line in its message referencing which §4 criterion it satisfies.
15. `npm run check` is clean; existing Vitest suite stays green and gains tests for the new status util, the OTP label map, and the airport disruption aggregator.

---

## §2. Workstreams

### W1 — Stop lying
**Intent:** remove every string that is confidently wrong or references internal phase names. One PR, pure copy and minor logic.
**Covers:** UX 2.1, 2.2, 2.6, 2.7, 2.8; reflection pattern 2 (plan language leaking into product copy).
**Scope boundary:** no new features, no data pipeline work. Still lies silently if `resolve` returns null; that's W2.
**Risk/unknowns:** low. Only unknown is whether removing the "pending" fallback breaks the OtpBadge empty render — handle by having the badge return null (don't render).

### W2 — Flight detail depth
**Intent:** make the flight detail page the emotional payoff of adding a flight: status chip + countdown + honest aircraft state + refresh button + route graphic.
**Covers:** UX 2.2, 2.5, 2.9; FEEDBACK observation 4; reflection sections 1 & 2 (wiring gap between the detail page and the resolve chain).
**Scope boundary:** no airline logos (licensing uncertain). No mini-map inside this PR — defer to W3 unification. No voice. No OTP data ingest — that's a tradeoff in §5.
**Risk/unknowns:** main risk is "fix AeroDataBox cooldown wiring" causing unintended fallback behaviour; mitigated by keeping the 24h cooldown KV write additive and feature-flagged behind a `KV_COOLDOWN_ENABLED` constant that we can flip without redeploying provider code.

### W3 — Map popup enrichment
**Intent:** join the map's raw ADS-B contacts to the data we already have (`adsbdb` callsign lookup → route, `aircraft` table → operator, Planespotters → photo) on click; no new provider contracts.
**Covers:** UX 2.4, 2.13, 2.15; FEEDBACK observation 2; reflection section 3.
**Scope boundary:** no new map layers (delays/weather/coverage stay deferred — those are Phase 2-v2). No live scheduled-arc overlay. "Look up in my flights" link is either fixed or removed; it does not become a new page.
**Risk/unknowns:** `adsbdb` callsign endpoint latency on click — mitigated by lazy load with skeleton state and KV TTL 1h. Quota concern: `adsbdb` is unmetered per their docs.

### W4 — Dashboard onboarding
**Intent:** reshape `/app` so a new user's eye lands on a next-action, not an admin console. Scheduler becomes a secondary panel with explanation copy.
**Covers:** UX 2.3, 2.6, 2.11; FEEDBACK observation 1; reflection section 4.
**Scope boundary:** no new routes. No complete nav redesign. Email removal from nav is included because it's the same layout file.
**Risk/unknowns:** low. The "primary CTA" depends on whether the user has 0, 1, or many flights — keep logic in `+page.server.ts`.

### W5 — Airport disruption monitor (the missing feature)
**Intent:** build the feature that was asked for and lost. `/app/airports` lists the user's watched airports with a single-line disruption state for each; click opens a detail panel.
**Covers:** FEEDBACK observation 5; reflection section 5.
**Scope boundary:** v1 is **US-only live data** (FAA NAS is already stubbed and real-time). Non-US airports show a "monitoring" row with last-known delay from any `airport_otp` data we have (which may be zero — surfaced honestly). No EUROCONTROL ingest workflow in this recovery (see §5 tradeoff). No push alerts for airport state; they are flagged as "coming" copy only.
**Risk/unknowns:** FAA NAS endpoint's JSON shape wobbliness is already handled in `faa_nas.ts` with try/catch returning `[]`. Main unknown: what the user considers "a disruption" — we pick the FAA `delayed` boolean + reason text as the v1 primary signal.

### W6 — Visual identity
**Intent:** one deliberate aesthetic pass on the app shell so the product reads as chosen, not scaffolded.
**Covers:** UX 2.10; FEEDBACK observation 3; reflection section 6.
**Scope boundary:** no custom fonts beyond Inter (already present). No illustrations commissioned. No per-page bespoke backgrounds. Does not include dark/light theme toggle.
**Risk/unknowns:** the decision in §5 about which direction (hero photo / texture / accent-only) must happen before execution. Risk: bandwidth. Mitigated by the chosen option.

### W7 — Guardrails (the pattern-level fixes)
**Intent:** stop the five reflection patterns from recurring. This is a lightweight set of process artefacts, not code.
**Covers:** reflection patterns 1–5.
**Scope boundary:** no CI-breaking gates. No new linting rule. Nothing that blocks solo dev velocity.
**Risk/unknowns:** none substantive — it's a markdown file and a commit-message convention.

---

## §3. Workstream ordering

Ordering by user-visible impact per hour and dependency safety:

1. **W1 — Stop lying** (≈1–2 h). Smallest diff, biggest trust uplift.
2. **W4 — Dashboard onboarding** (≈1–2 h). Fixes "what am I supposed to do here?" on first load.
3. **W7 — Guardrails** (≈0.5 h). Drop in before W2/W3/W5 so new work gets written under the new convention.
4. **W2 — Flight detail depth** (≈3–4 h). The emotional payoff page; biggest per-flight uplift.
5. **W3 — Map popup enrichment** (≈3–5 h). Highest wow-factor; medium effort because the data joins are already in-tree.
6. **W5 — Airport disruption monitor** (≈4–6 h). New route and surface; a lost ask gets a real home.
7. **W6 — Visual identity** (≈2–3 h after design decision). Last because the design decision is the long pole and because visual polish on broken copy compounds badly.

**Disagreement with UX inspector's ordering:** the UX doc's list is a sensible pure-string-fix sprint, but dashboard onboarding goes before status-chip work because the dashboard is the first signed-in impression and currently the most embarrassing. The UX doc also treats W5 (airport disruption) as item 11-ish; promoted here because it's a known lost feature the user flagged by name.

---

## §4. Per-workstream mini-plans

Each workstream's acceptance criteria will be copy-pasted into the final commit message under an `Acceptance:` block (W7's guardrail).

### W1 — Stop lying

**Files to touch:**
- `src/lib/server/flights/otp.ts` (fallback copy)
- `src/lib/components/OtpBadge.svelte` (source label map + null-render)
- `src/routes/app/+page.svelte` (remove "What's next" block)
- `src/routes/+page.svelte` (landing: move Voice/Photo tiles to a "Coming next" row)
- `src/routes/app/flights/[id]/+page.svelte` (reword the aircraft fallback — real fix in W2, honest wording here)

**Design decisions to make first:** none. All copy choices are mechanical.

**Concrete steps:**
1. In `otp.ts`, keep `OtpSource` member `'pending'` but return `label: 'No historical punctuality data for this route yet.'`
2. Add a `SOURCE_LABEL: Record<OtpSource, string>` map in `OtpBadge.svelte`: `EUROCONTROL → 'EUROCONTROL punctuality'`, `BTS → 'US BTS punctuality'`, `CAA → 'UK CAA punctuality'`, `provider → 'Provider stats'`, `pending → 'Punctuality'`, `unavailable → 'Punctuality'`. Replace the `{line.source}` render with `SOURCE_LABEL[line.source]`.
3. If `line.source === 'pending' || 'unavailable'` and `line.otp15 === null`, render a muted single-line "Punctuality data not available for this route." (no colour variant, no badge weight).
4. Delete the "What's next" phase block in `src/routes/app/+page.svelte`.
5. On `src/routes/+page.svelte`, split tiles into two `<ul>`s: "Available today" and "Coming next" with a subtle dimmed treatment.
6. Change the flight-detail aircraft fallback to: "Aircraft not confirmed yet. We'll try again automatically; you can also refresh now." with a `<button>` that POSTs to `/api/flights/{id}/refresh` (new endpoint in W2).

**Acceptance criteria:**
- `grep -r "Phase " src/routes` returns no matches outside `/debug`.
- OtpBadge on a route with no data shows "Punctuality data not available for this route." and nothing else.
- Landing page separates shipped from upcoming features into two visibly-distinct rows.

**Rollback:** `git revert` the W1 commit; copy-only changes, no data risk.

---

### W2 — Flight detail depth

**Files to touch:**
- `src/routes/app/flights/[id]/+page.svelte`
- `src/routes/app/flights/[id]/+page.server.ts`
- `src/routes/api/flights/[id]/refresh/+server.ts` (**new**)
- `src/lib/status.ts` (**new**, shared status→label+colour util)
- `src/lib/components/FlightRow.svelte` (adopt shared util)
- `src/lib/components/StatusChip.svelte` (**new**)
- `src/lib/components/Countdown.svelte` (**new**)
- `src/lib/server/providers/aerodatabox.ts` (wire cooldown)
- `src/lib/server/providers/airlabs.ts` (fallback: try ICAO 3-letter form when IATA 2-letter form returns empty)

**Design decisions first:**
- Countdown precision: minutes-only vs seconds. **Pick: minutes.** Seconds-tick costs re-renders and gives no user value.
- Refresh button rate limit: once per minute per flight per user, enforced via existing KV `rl:*` prefix.
- "Why no aircraft?" classification: three buckets — `too_early` (flight > 48h out), `provider_failed` (resolve threw or returned null), `airline_not_assigned` (resolve returned flight but with null tail and `sched_dep_utc - now < 48h`). Each bucket has distinct copy.

**Concrete steps:**
1. Create `src/lib/status.ts` exporting `statusMeta(status): { label, color, bg }` with all known statuses (`scheduled|boarding|airborne|landed|cancelled|diverted|unknown`).
2. Create `StatusChip.svelte` — pill-shaped, uses `statusMeta`, sits full-width at top of the detail page above the `<dl>` grid.
3. Create `Countdown.svelte` — accepts `targetUtcSec`, uses `$state` + `setInterval(…,60_000)` cleaned in `onDestroy`, renders "Departs in 2h 14m" / "Departed 3m ago" / nothing if > 48h away.
4. In `+page.server.ts`, add `aircraftFailureReason: 'too_early'|'provider_failed'|'airline_not_assigned'|null` to the returned payload. Compute from `aircraft === null`, `sched_dep_utc`, and whether the resolve record exists in D1.
5. In `+page.svelte`, replace the current aircraft fallback block with a switch on `aircraftFailureReason` with three distinct messages; include a Refresh button that POSTs to `/api/flights/{id}/refresh` and re-runs resolve.
6. Create `src/routes/api/flights/[id]/refresh/+server.ts` — rate-limited POST, calls `resolveFlight` + updates `flights` row + optionally fetches `getAircraftCard`, returns JSON for client re-render.
7. In `aerodatabox.ts`, before calling `httpJson`, check `cooldownActive(env.CACHE, 'cooldown:aerodatabox')`; if true return null. After a 429 response from the wrapper, call `markCooldown(env.CACHE, 'cooldown:aerodatabox', 86400)`.
8. In `airlabs.ts`, if `flight_iata` returns `response: null`, retry with `flight_icao=` using the ICAO 3-letter prefix derived from the IATA 2-letter via the `airlines` table (or a static map in `src/lib/data/airline_codes.ts` — build a seed of top 50 for v1, log on miss so we can grow it).
9. Add Vitest covering `statusMeta`, countdown formatting, and airline IATA→ICAO mapping.

**Acceptance criteria:**
- Detail page for an in-window flight shows a coloured `StatusChip` above the grid.
- Detail page for a flight 2h from departure shows "Departs in 2h N m" that decrements once a minute.
- The aircraft-missing copy is one of the three honest reasons, not the current blanket "airlines publish late" string.
- Refresh button exists; clicking it re-runs the resolve chain on the server; a successful refresh updates the page.
- AeroDataBox cooldown KV key exists after a forced 429.
- `npm run check` clean.

**Rollback:** safe. Reverting re-exposes the old string but costs no data.

---

### W3 — Map popup enrichment

**Files to touch:**
- `src/routes/app/map/+page.svelte` (popup template)
- `src/lib/map.svelte.ts` (add `selectedEnrichment: EnrichedAircraft | null` and fetch call)
- `src/routes/api/aircraft/[hex]/popup/+server.ts` (**new**, joins adsbdb + aircraft table + planespotters)
- `src/lib/server/flights/callsign.ts` (**new**, parses callsign like "QTR4E" or "BAW456" → `{airline_icao, flight_number}`)
- `src/routes/app/flights/+page.server.ts` (accept `?hex=` param and filter if present — closes UX 2.15 without requiring a new page)

**Design decisions first:**
- Call `/api/aircraft/{hex}/popup` eagerly on click (one request per click) or lazily after a 300ms delay. **Pick: eager** — click intent is clear.
- Show photo as background hero of the popup, or as a side thumbnail. **Pick: hero top block with caption**, matches the FR24 reference.
- Toggle button a11y fix: `aria-pressed` + visible outline on pressed state (UX 2.13) included here because it's the same file.

**Concrete steps:**
1. Create `src/lib/server/flights/callsign.ts` with `parseCallsign(cs)` returning `{ airline_icao: string|null, flight_number: string|null }` using regex `^([A-Z]{3})(\d+[A-Z]?)$`.
2. Create `src/routes/api/aircraft/[hex]/popup/+server.ts` returning `{ hex, reg, type, callsign, flight_no, origin_iata, dest_iata, operator, photo }`. Order: (a) read `aircraft` row from D1 for operator/type, (b) call `adsbdb.getAircraftByHex` only if D1 missed, (c) if `callsign` supplied in query, call `adsbdb` callsign route for origin/dest, (d) fetch Planespotters photo by hex then reg. Cache the merged result under `popup:{hex}:{15m-bucket}` TTL 900.
3. In `map.svelte.ts`, add `selectedEnrichment`, add `selectAircraft` logic so it both sets `selected` immediately and fires `fetch('/api/aircraft/{hex}/popup?cs=...')`, setting enrichment when response arrives.
4. In `map/+page.svelte` popup aside, restructure:
   - Top: photo hero (if `enrichment?.photo`) with photographer credit.
   - Title line: `enrichment?.flight_no ?? callsign ?? reg ?? hex`.
   - Subtitle: `enrichment?.operator ?? type`.
   - Route row: `enrichment.origin_iata → enrichment.dest_iata` when both present.
   - Transponder row (alt/spd/hdg) kept below, de-emphasised.
   - "Look up in my flights" link only renders if we matched a saved flight (query adds `?hex=` filter to flights page).
5. Fix toggle buttons: add `aria-pressed`, swap `✓/·` for "On / Off" text and distinct bg colour; wrap the two buttons in a `<div role="group" aria-label="Map layers">`.
6. In `src/routes/app/flights/+page.server.ts`, if `url.searchParams.get('hex')` is set, filter flights where `assigned_hex = ?`. Keep unfiltered list as default.

**Acceptance criteria:**
- Clicking an aircraft with a known callsign shows the operator and origin→dest in the popup within 1.5s.
- Clicking an aircraft with a Planespotters-known reg shows a photo at the top of the popup.
- Clicking "Look up in my flights" from a popup whose hex matches a saved flight filters to that flight.
- Toggle buttons have `aria-pressed` reported correctly in the DOM.
- `npm run check` clean; new unit test for `parseCallsign`.

**Rollback:** safe. Popup degrades to current state if the new endpoint fails.

**Budget:** Planespotters is unmetered. `adsbdb` is unmetered. 15-min KV bucket bounds spam risk.

---

### W4 — Dashboard onboarding

**Files to touch:**
- `src/routes/app/+page.svelte`
- `src/routes/app/+page.server.ts` (add `upcomingCount`)
- `src/routes/+layout.svelte` (email → avatar)
- `src/lib/components/UserMenu.svelte` (**new**)

**Design decisions first:**
- Primary CTA logic: 0 flights → "Add your first flight" (sky-700 bg, full width card). 1+ flights → list top 3 inline with "+ Add another" secondary.
- Scheduler panel: keep on this page but secondary under the primary CTA, with an explanation sentence.
- Avatar: first letter of email, in a circle, click reveals a small menu with email + sign out. No new routes.

**Concrete steps:**
1. In `+page.server.ts`, load `const upcomingCount = ...` and the top 3 `FlightRow` rows.
2. Restructure `+page.svelte` to render, in order: welcome line (first name derivable from email prefix), primary flights card (CTA or list), scheduler panel with new header "Live updates" + one-sentence explanation "Keeps your flights up to date while this tab is open. Starts a 2-minute refresh cycle; stops when you hit Stop or close the tab.", map link.
3. Delete the "What's next" phase block (also covered in W1 but confirm here).
4. Create `UserMenu.svelte`: avatar button, popover with email + sign-out form.
5. In `+layout.svelte`, replace the raw `{data.user.email}` span with `<UserMenu user={data.user} />`.

**Acceptance criteria:**
- Dashboard with 0 flights shows "Add your first flight" as the primary CTA above the fold.
- Dashboard with >0 flights shows the flight list first, scheduler second.
- Email no longer appears in the top nav as plain text; avatar initial shown instead.
- `npm run check` clean.

**Rollback:** safe.

---

### W5 — Airport disruption monitor

**Files to touch:**
- `db/migrations/0005_recovery_airport_watch.sql` (**new**)
- `src/routes/app/airports/+page.svelte` (**new**)
- `src/routes/app/airports/+page.server.ts` (**new**, with `addWatch` / `removeWatch` actions)
- `src/routes/api/delays/+server.ts` (extend to accept `?iatas=LHR,JFK,...`)
- `src/lib/server/airports/disruption.ts` (**new**, aggregator)
- `src/lib/components/AirportDisruptionRow.svelte` (**new**)
- `src/routes/+layout.svelte` (nav link "Airports")
- `src/routes/app/+page.svelte` (small "Watched airports" card)

**Design decisions first:**
- Dedicated page vs widget vs integrated into map — see §5 tradeoff. **Pick: dedicated page `/app/airports` + a 3-row "Watched airports" card on dashboard.**
- v1 data signal per airport: FAA NAS `delayed` + `reason` for US; `airport_otp` latest row for others; a plain "Monitoring — no official feed" for airports with no backing data. Explicit honesty about gaps, not confident silence.
- No push alerts in this recovery; visible "coming soon" chip at bottom of the page.

**Concrete steps:**
1. Write migration 0005: `CREATE TABLE user_airport_watches (user_id TEXT, iata TEXT, created_at INTEGER, PRIMARY KEY (user_id, iata))`. Also uncomment `airport_otp` from schema and migrate it (empty table).
2. Build `src/lib/server/airports/disruption.ts` with `getAirportDisruption(env, iatas): AirportDisruption[]` where each row is `{ iata, name, country, delay_signal: 'red'|'amber'|'green'|'none', summary: string, source: 'FAA_NAS'|'airport_otp'|'none' }`. Reuses `getUsAirportDelays` for `country='US'` airports.
3. Build the route pages: list of watched airports + "+ Add airport" IATA input, each row shows summary. Empty state with a suggestion to add their home airport (pull from `users.home_tz` → best-guess IATA via a small lookup).
4. Add "Airports" link in the signed-in nav (`+layout.svelte`).
5. Add 3-row card on dashboard showing watched-airport state; "See all" link to `/app/airports`.
6. Unit test: `getAirportDisruption` with mocked FAA response returns correct mapping.

**Acceptance criteria:**
- `/app/airports` loads for a signed-in user.
- Adding `LHR` writes a row to `user_airport_watches` and the airport appears in the list on reload.
- Adding `JFK` shows a NAS-derived summary when FAA reports delays there.
- Non-US airport with no `airport_otp` row shows "Monitoring — no public delay feed." (honest).
- Dashboard shows the watched-airports card when the user has ≥1 watch.
- Nav includes Airports link when signed in.
- Migration 0005 applied locally and remote.

**Rollback:** safe. Revert the commits; the migration leaves an empty table that does no harm. FAA NAS is unmetered.

---

### W6 — Visual identity

**Files to touch:**
- `src/app.css`
- `src/routes/+layout.svelte` (add background wrapper div)
- Possibly `src/routes/+page.svelte` (landing hero if we go that route)

**Direction locked (2026-11-07): Option A — subtle gradient + faint texture.** CSS only. No licensing. User may ask for hero photos on landing later; defer until requested.

**Concrete steps:**
1. Add a radial gradient wash on `<body>`: `background: radial-gradient(ellipse at top, #11193a 0%, #0b1020 55%)`.
2. Add a faint SVG grain/hatch pattern as a `::before` on the app shell at ~1.5–2% opacity. Fixed position, pointer-events none.
3. Refine the accent palette: define `--color-sky-glow` and `--color-amber-warn` CSS vars; use for status chip + CTA accents.
4. Apply identically across all signed-in pages via the layout wrapper, not per-route.

**Acceptance criteria:**
- Background on `/app` is visibly different from pure `#0b1020`.
- No layout shift; headers and cards still render correctly.
- Bundle size delta < 20 KB on initial app route.

**Rollback:** CSS-only; revert the file.

---

### W7 — Guardrails (process)

Revised 2026-11-07 after user feedback: quality-bar work must live on Claude's side, not require the user to write anything per task.

**Files to touch:**
- `QUALITY_BAR.md` (**new**, at repo root — one standing bar that applies to every page)
- `OPEN_DECISIONS.md` (**new**, at repo root — Claude's visible deferral log)
- `CLAUDE.md` (append a durable rule)

**Concrete steps:**
1. Create `QUALITY_BAR.md` — one page, written by Claude once, applies to any shipped surface. Covers: no placeholder text; no confident-wrong copy; every empty state names a real reason; every interactive surface has a visible purpose; popups show at least what a comparable product shows; no internal phase/code names visible anywhere; no raw source codes rendered without a human label.
2. Create `OPEN_DECISIONS.md` with three sections:
   - "User-asked, not in current plan" (new features user asked for that don't fit — Claude writes here instead of hiding in code comments)
   - "Plan says X but reality looks wrong" (places where Claude wants to deviate from the plan)
   - "Plan says X but it feels like busywork now" (defensive code Claude is tempted to skip)
   Rule: nothing moves on until an item here gets a decision. The file being visible forces the raise.
3. Append to `CLAUDE.md`: "When the plan says X but the product looks thin, wrong, or you've been asked for something outside scope — raise it in `OPEN_DECISIONS.md` and in chat before continuing. Silent deferral and silent interpretation are both failures."
4. When reporting shipped work, describe it in user-visible terms ("I added QR4 and the tail showed up"), not implementation terms ("the KV key exists"). If Claude can't describe a user-visible result, it hasn't built enough.

**What this prevents (five patterns from `REFLECTION_2026_11_07.md`):**
- Pattern 1 "does it render = done" → `QUALITY_BAR.md` makes rendering insufficient.
- Pattern 2 "plan language leaking into product copy" → `QUALITY_BAR.md` bans internal phase/code names.
- Pattern 3 "acceptance criteria ignored" → quality bar is one standing doc, not per-feature criteria the user has to write.
- Pattern 4 "user asks dissolved into DDL" → `OPEN_DECISIONS.md` forces them into the open.
- Pattern 5 "showcase lens never applied" → `QUALITY_BAR.md` names "would a user feel this is a product" as a check.

**Rollback:** trivial — delete the files.

---

## §5. Tradeoffs

### 5.1 Airport disruption monitor surface
- **Option A — dedicated page `/app/airports`:** clear information architecture; empty-state onboarding possible; low implementation cost (~2h). Cost: another nav item; another route to maintain.
- **Option B — widget on dashboard only:** fastest to build (~1h); zero nav cost. Cost: can't show detail per airport; no scaling path.
- **Option C — integrated into map:** aesthetically consistent with the "map is the hub" product narrative. Cost: more UI complexity, click-interaction conflicts with aircraft popups, 1-2 days of work for the right interaction model.
- **Chosen: A + small dashboard card.** Dedicated page is cheap and gives the feature a real home; the dashboard card is a 30-min add that solves "will I remember this exists." C is the right long-term move but is a Phase-2.5 project, not recovery work.

### 5.2 Visual identity direction
- **Option A — hero aviation photos (landing + app headers):** strongest "showcase" signal; free photos exist on Unsplash. Cost: ~200 KB/page bandwidth per image; must license-credit; any wrong photo choice reads as corporate stock.
- **Option B — subtle texture + palette work only:** cheap (CSS only); feels considered without being flashy; nothing to license. Cost: lower "wow" ceiling.
- **Option C — accent palette + typography only, no imagery:** cheapest; most restrained. Cost: risk of still reading as scaffolded.
- **Chosen: B (user-confirmed 2026-11-07).** Subtle texture + refined palette gets us off "flat dark-navy scaffold" at near-zero cost and no licensing drama. Hero photo on landing-only may be added later if user wants more.

### 5.3 Data enrichment provider budget
- **Option A — eager popup enrichment on every click:** best UX; small risk of quota burn on `adsbdb` (currently unmetered but could change).
- **Option B — lazy with "Show more" button:** safer quota; extra click = less magic.
- **Chosen: A, with a 15-minute KV cache per hex.** `adsbdb` and Planespotters are both unmetered; the KV bucket ensures a user hammering popups on one aircraft over 15 minutes costs us one request. AeroDataBox cooldown wiring (in W2) is the real quota protector.
- **Separate decision: refresh button on flight detail.** User-initiated, rate-limited 1/min/flight; fits the 600/mo AeroDataBox quota.

### 5.4 Scheduler panel placement
- **Option A — keep on `/app` with inline explanation (W4 plan):** honest about what the app does; simple IA.
- **Option B — move to `/app/settings`:** cleaner dashboard.
- **Chosen: A.** Hiding the scheduler mechanism on settings is dishonest about how the product works and sets wrong expectations. The explanation sentence bridges the gap.

### 5.5 Phase 3 ingest workflows (EUROCONTROL / BTS / CAA)
- **Option A — build the three monthly ingest workflows now:** unblocks real OTP data for the first time. Cost: ~4–6 hours per workflow (PDF/XLSX parsing, HMAC posting, failure retry); real risk of parser fragility; monthly data only.
- **Option B — keep punctuality honest-blank, defer ingest:** zero new work; OTP badges stay silent (per W1); no false data shown.
- **Chosen: B.** The ingest workflows are not a recovery job — they're a Phase 3 completion job. Building them inside the recovery would blow the "tightening not restarting" budget and risks pattern 1 ("does it ingest once = done") recurring. Defer to a future Phase 3.1. W1 makes the empty state honest in the meantime.

---

## §6. What NOT to do in this recovery

- Phase 4 Voice Q&A: deferred.
- Phase 5 Photo spotter: deferred.
- Phase 6 Price monitoring: deferred.
- Phase 7 PWA + push: deferred.
- No full landing-page redesign (W1 only touches the feature tile row).
- No "parsed as:" preview on the NL input (UX 2.12).
- No IANA timezone picker (UX 2.14) — leave as text input with the browser-detected suggestion already present.
- No status countdown with seconds precision — minute precision only.
- No airline logos on any surface — licensing uncertainty; punted.
- No track-history map on the flight detail page — deferred.
- No `ingest-eurocontrol.yml` / `ingest-bts.yml` / `ingest-caa-otp.yml` workflows (§5.5 tradeoff).

---

## §7. Definition of done for the recovery

The product is no longer crap when a cold user, invited for a retest and told nothing, can: open the landing page without seeing a feature they can't use, sign in and reach a dashboard whose primary action is obvious, add QR4 (or equivalent day-of-travel flight) and see a flight detail page with a coloured status chip, a live countdown, and either a real aircraft card or an honest explanation of why not plus a refresh button that actually re-tries; click an aircraft on the map and see operator, route, and a photo within two seconds; open `/app/airports` and add an airport to a watchlist; and come away feeling the app's shell looks deliberate. No string in the app references a Phase number. The user can read the product without being able to see the scaffolding through it.

---

## §8. How this plan avoids the five reflection patterns

1. **"Does it render?" treated as "is it done?"** → Every workstream's Acceptance block is testable by reading the UI *or* checking a DB/KV key, not by vibes. W7 bakes "did I open the page with fresh eyes" into a pre-ship checklist. The commit-message convention forces each commit to cite which Acceptance item it satisfies.
2. **Plan language leaked into product copy.** → W1 explicitly bans the word "Phase" from user-facing surfaces (grep check in §4 Acceptance). The OtpBadge `SOURCE_LABEL` map centralises source-code → human-label translation so new sources can't leak through.
3. **Acceptance criteria written then ignored.** → W7's commit-message convention cites specific `§4-W#-#` acceptance items in every commit. If no commit cites an item, that item is not done.
4. **Features requested by the user but not fitting a phase dissolved into schema comments.** → W5 is a first-class workstream with a route, migration, UI, and tests — not a table in `schema.sql` labelled "Phase N: airport_otp".
5. **The showcase lens was never applied.** → W6 is a dedicated workstream whose first step is a design decision (§5.2) that must be answered before execution. The recovery is not "done" until §1 bullet 11 is true.
