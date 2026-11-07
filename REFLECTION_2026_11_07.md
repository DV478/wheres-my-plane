# Reflection — 2026-11-07

## Core finding

Each phase was treated as a checklist of files to land rather than a product slice to use. We shipped the plumbing, ticked the plan's acceptance boxes, and skipped the parts that would have been obvious the first time a human read the actual screen — because no one on our side ever opened the actual screen with the eyes of a user.

---

## 1. "Punctuality feeds arrive in Phase 3" still on screen after Phase 3 shipped

The string lives at `src/lib/server/flights/otp.ts:88`:

```ts
return {
  source: 'pending',
  otp15: null,
  label: 'Punctuality feeds arrive in Phase 3.'
};
```

It is rendered by `src/lib/components/OtpBadge.svelte` whenever `pickOtp` falls through its three regional branches. The three regional branches each query the `routes_otp` table. That table is still **commented out** in `db/schema.sql:180-184`; no migration has ever created it. So every call to `pickOtp` for every flight hits the "pending" return.

This is neither dead code nor a scoping miss — it is a wiring gap we hid from ourselves with a confident copy string. Phase 3's plan (`IMPLEMENTATION_PLAN.md:460-463`) lists three ingest workflows as Phase 3 deliverables: `ingest-eurocontrol.yml`, `ingest-bts.yml`, `ingest-caa-otp.yml`. None of them exist in `.github/workflows/` (the folder contains only `cron.yml` and `keep-alive.yml`, confirmed by file listing). The `routes_otp` table those workflows populate was never migrated either.

What this says about calling Phase 3 "done": we closed Phase 3 on the basis of the Telegram alert pipeline running, and treated the three monthly ingest workflows — which are the actual punctuality *feeds* that the plan promised — as if they didn't count. The plan's own acceptance checklist (`IMPLEMENTATION_PLAN.md:479`) has an item "Monthly Action imports at least one row into `routes_otp` after the first run" which is explicitly unticked. We shipped anyway. And worse, the copy still references "Phase 3" — a phrase that only makes sense to the person who wrote the plan. The user sees a product that is apologising to itself.

---

## 2. "Aircraft not yet assigned" for QR4 when FR24 has the tail

QR4 is the Qatar 14:15 LHR → DOH. The FR24 screenshot shows the aircraft is A7-API, equipment A388, callsign QTR4E. We returned no tail.

The provider chain at `src/lib/server/flights/resolve.ts:23-45` is AeroDataBox → AirLabs → aviationstack. Any of these three can return a `reg`, a `modeS` hex and an aircraft model (see parsers in `aerodatabox.ts:12-17`, `airlabs.ts:11-13`, `aviationstack.ts:30-38`). Three plausible reasons we got nothing:

1. **AeroDataBox free-plan quota (~600 req/mo) is burned.** Every call from dev plus every scheduler tick for every existing flight goes through this provider first. Phase 3's scheduler ticks every minute and re-resolves on each cadence. There is no cooldown wired — `IMPLEMENTATION_PLAN.md:94` specifies `cooldown:aerodatabox` TTL 24h, and `kv.ts` exports `cooldownActive` / `markCooldown`, but `aerodatabox.ts` never calls them. A 429 falls through to the next provider silently, but once the quota resets we don't wait — and once it's burned we don't record it. This is the most likely cause.
2. **AirLabs' `/flight` endpoint returns an empty response on `flight_iata=QR4`** because AirLabs often needs the equivalent 3-letter ICAO (`QTR4`) and we only ever pass the IATA code through unchanged.
3. **aviationstack is capped at 100 requests/month** (`IMPLEMENTATION_PLAN.md:112`). Any real-world use pattern blows through that in a day.

The deeper issue is in the UI, not the providers. `src/routes/app/flights/[id]/+page.svelte:72-81` makes the empty-aircraft case render a bland paragraph:

```
Aircraft not yet assigned
Airlines often publish the tail number only on the day of travel.
```

That copy was written as if the only reason for a null tail is the airline not having assigned one yet. We did not distinguish "provider gave us nothing" from "provider was skipped" from "quota exhausted" from "flight is more than 72 h out". So when FR24 has a tail and we don't, we lie confidently. The *design* of the empty state assumed one failure mode and ignored the others.

Why "we'll add this later" felt acceptable at ship: because the Phase 1 acceptance criteria (`IMPLEMENTATION_PLAN.md:313-322`) phrased the goal as "renders an aircraft card with photo + photographer credit", which is satisfied by *any* card including the empty one. The word "any" was doing a lot of work.

---

## 3. The map popup is table-stakes thin

`src/routes/app/map/+page.svelte:162-197` is the full popup. It renders `reg`, `callsign`, `type`, `alt_ft`, `gs_kt`, `heading`, and a "Look up in my flights →" link. Nothing else.

The reason it is that thin is in `src/lib/map/layers.ts` → the `Aircraft` type (the shape that comes back from `/api/traffic`). That endpoint (`src/routes/api/traffic/+server.ts`) calls `adsblol` → `opensky` and returns whatever those feeds have, which is raw ADS-B state: hex, lat/lon, altitude, speed, heading, callsign, reg, aircraft type code. ADS-B simply does not broadcast airline name or route.

The bits that *would* make the popup useful — airline, origin, destination, scheduled times — are a per-aircraft join: callsign → `adsbdb` route lookup (or flight-number → AeroDataBox), aircraft hex → `aircraft` table for operator name, aircraft hex → Planespotters for a photo. Every one of those datapaths exists already in the codebase (`src/lib/server/providers/adsbdb.ts`, `src/lib/server/aircraft.ts`, `src/lib/server/providers/planespotters.ts`). None of them is wired into the popup click path.

Phase 2's acceptance criteria (`IMPLEMENTATION_PLAN.md:386-394`) says "Click aircraft → panel with correct reg + type." That is the entire bar. We hit it exactly. Nowhere in the Phase 2 plan was "compare the popup side-by-side with FR24" written down as a check, so we didn't. The map was treated as an engineering problem — tiles, layers, click handlers — and the "what do users expect to see" question was not asked. The popup shipped with the first thing that rendered.

---

## 4. Scheduler Start/Stop panel with zero onboarding

`src/routes/app/+page.svelte` is the dashboard. The Start/Stop panel at lines 77-98 renders a heading `Scheduler`, a button that says `Start`, a status line that reads `Idle`, and nothing else. There is no explanation of what the scheduler does, no indication that it polls every two minutes, no note that it needs the tab open, no explanation of what "tick" means.

The panel exists because of today's cron-switch commit (`69ff38d`, "Switch cron to on-demand Start/Stop panel"). We removed the GitHub Actions cron workflow and moved its job client-side. That move has real cost-and-correctness upside — fits the hard budget — but we shipped the UI as an admin console: a developer who already knows what tick(), the 120 s interval, and the visibility pause all mean. A new user has none of that context and nothing on the page provides it.

The signal is right there in the file: the only "What's next" copy at lines 113-122 is still listing Phase 3, 4, 5, 6, 7 — the phase names from `IMPLEMENTATION_PLAN.md`. That is the implementation plan's language leaking directly onto the user's dashboard. We never translated the shipping sequence into product copy. "Phase 3 — Scheduled agent + Telegram alerts" is not something a user is supposed to read.

What this says about our mindset at ship: we didn't think of this as a user-facing surface. We thought of it as a control to prove the mechanism works. "First use" was never modelled.

---

## 5. Disruption monitoring by airport is nowhere in the repo

The user explicitly asked for this. Searching the repo for it:

- `IMPLEMENTATION_PLAN.md` mentions `airport_otp` only twice, both as table names in a Phase 3 deliverables list (`IMPLEMENTATION_PLAN.md:172`, `466`). No feature description, no acceptance criteria, no UI route.
- `WHERES_MY_PLANE.md` mentions airport delays in the map layer table (`WHERES_MY_PLANE.md:80`) and in the OTP source table (`WHERES_MY_PLANE.md:41` — "daily airport delay data" from EUROCONTROL). Both references are embedded in bigger lists.
- `db/schema.sql:186-189` has an `airport_otp` table **commented out**.
- Code: `src/routes/api/delays/+server.ts` is a 10-line stub that returns FAA NAS US airport delays only. There is no UI route that consumes it. There is no per-airport detail page.

So: the ask was spoken, half-captured in the product spec, translated into two table-name mentions in the implementation plan, and then quietly dropped. The `/api/delays` endpoint exists but has no consumer. The user had no way to tell this had happened until they went looking for the feature in the live app and couldn't find it.

What this says about how we captured user asks: when a request didn't map cleanly onto a phase's primary goal, we represented it with a database table and a workflow filename in a status column, then let the plan file do the remembering. The remembering did not happen. A user ask became a schema comment, which became nothing.

---

## 6. Flat dark-navy background

`src/app.css:4-16` is the entire theming layer:

```css
@theme {
  --font-sans: 'Inter', ...;
  --color-ink: #0b1020;
  --color-sky: #1e3a8a;
  --color-cloud: #e2e8f0;
}
html, body {
  background: var(--color-ink);
  color: var(--color-cloud);
}
```

That's it. No imagery. No gradient. No texture. No hero element. `src/routes/+layout.svelte` adds a 1px-border header and a plain `<main>` with a max-width. `src/app.html:7` sets `theme-color` to the same `#0b1020`.

The mindset gap: we built the stylesheet the way we'd build a developer tool. Dark backgrounds signal "serious utility" in dev-tool culture (GitHub, Vercel, Linear), and we defaulted to that tone because it's what our hands reach for. But this product is a *showcase*. The user told us so repeatedly in memory (`user_showcase_builder.md`). A showcase is advertising its own existence; it has to look like something somebody chose. We produced the visual texture of a staging environment.

Nobody ever paused to ask "does this actually look like a product someone would open?" The Phase 1 and Phase 2 plans both mention a11y, bundle size, Lighthouse, test counts. Neither mentions aesthetic — not once. The plan silently graded style as out-of-scope by never making it in-scope, and we followed the plan.

---

## 7. Did the diffs match what the plan promised?

Commit `48dda5d` ("Initial import: phases 0-3 complete") is 738 lines of `IMPLEMENTATION_PLAN.md` plus roughly 80 code files. Commit `0fda6c4` adjusts docs and deletes a broken deploy workflow. Reading the diffs against the plan:

**What Phase 1 promised vs shipped:** aircraft card with photo, OTP line naming its source, NLU that accepts "BA456 tomorrow". All present. Phase 1 is the closest to honest.

**What Phase 2 promised vs shipped:**
- Promised: live traffic + my-flights arcs + delay-coloured airports + weather + coverage layer + disruption side panel (`IMPLEMENTATION_PLAN.md:76-83`).
- Shipped: live traffic layer only. `+page.svelte` has toggles for Traffic and My flights but the My-flights `ArcLayer` factory in `src/lib/map/layers.ts` exists and is never built into the layer list by the `$effect` (`+page.svelte:109-122` only ever pushes the traffic layer). No delay-coloured airports. No weather layer. No coverage layer. No disruption feed. Six of seven promised layers were written as intents in the plan and shipped as nothing.

**What Phase 3 promised vs shipped:**
- Promised: scheduled agent + Telegram text+voice alerts + monthly EUROCONTROL/BTS/CAA/airfleets ingests + aircraft-enrichment Action (`IMPLEMENTATION_PLAN.md:460-463`).
- Shipped: scheduler + text-only Telegram + webhook `/start` and `/link`. Voice was deferred to Phase 4 (noted in `README.md:24` — acceptable, but then the "Punctuality feeds arrive in Phase 3" copy should have changed with it). The four monthly ingest workflows never landed. The enrichment workflow never landed. The `routes_otp` and `airport_otp` tables never migrated.
- The Phase 3 acceptance checklist in the plan (`IMPLEMENTATION_PLAN.md:472-479`) has eight items. Looking at the state: items about Telegram linking, HMAC ingest, nonces work. The monthly OTP import item is explicitly unmet. There are no actually-ticked boxes on that list in the file — the plan uses `[ ]` throughout — which is itself a tell: we shipped Phase 3 without ever marking its own acceptance criteria as met.

What were we doing that let us consider them done? We were reading the running code. The scheduler ticks. The map renders. The Telegram bot replies. The engine starts, so we called the car finished. We did not go back to the plan with a checklist and tick items against reality. The plan became retrospective justification rather than a contract.

---

## Patterns I see

1. **"Does it render?" treated as "is it done?"** On the flight detail page the aircraft panel renders with a flat apology instead of a tail. The scheduler panel renders with a button. The map popup renders with alt/spd/hdg. In every case "renders without error" was the ship bar. Comparison to the actual product class (FR24, Google Maps, Linear) was never the ship bar.

2. **Plan language leaked into product copy.** "Punctuality feeds arrive in Phase 3." "Phase 3 — Scheduled agent + Telegram alerts." These strings are planning-document language shipped as user-facing text. They expose the user to our internal process. The product is talking to itself out loud.

3. **Acceptance criteria were written, then ignored.** The Phase 2 and Phase 3 acceptance lists in `IMPLEMENTATION_PLAN.md` are detailed and honest. Nobody went back and ran them. The `[ ]` checkboxes are still empty in the file. We wrote criteria, then shipped, then forgot the criteria existed.

4. **Features requested by the user but not fitting a phase dissolved into schema comments.** Airport disruption is in two SQL comments and one UI layer bullet, with no code path and no consumer. If a user ask isn't the headline goal of a phase, our pattern is to represent it as a DDL stub in `db/schema.sql` and assume the plan will "remember" it. The plan does not have that power.

5. **The showcase lens was never applied.** The project memory records this is a personal showcase, invite-only, aesthetic-led. The implementation plan contains no entry for aesthetic, no visual reference, no "does this look like a product" check. We shipped a dev-tool-coloured surface and were surprised it felt like a dev tool. The mindset gap isn't that we tried for aesthetic and missed; we didn't try.
