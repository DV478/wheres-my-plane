# IMPLEMENTATION_PLAN.md — Where's My Plane (Phases 1–7)

This document is the sole source of truth for executing Phases 1–7. Phase 0 is complete and not revisited. The executing agent reads this file first every session.

## Status (last updated 2026-11-05 end-of-session)

| Phase | State | Notes |
|---|---|---|
| 0 | ✅ done | Auth, D1, KV, deploy skeleton |
| 1 | ✅ done + deployed | `BA7 tomorrow` end-to-end works locally. 25 Vitest pass. svelte-check clean. OTP copy fix landed. **Deployed to https://wheres-my-plane.pages.dev on 2026-11-05.** All 8 Pages secrets set, D1 migrated + seeded (54 airports), invite row for `dereck.varghese@gmail.com` inserted, prod `/` and `/login` both return 200. |
| 2 | ✅ done + deployed + smoke-tested | Global disruption map. **Live and visually confirmed working at https://wheres-my-plane.pages.dev/app/map on 2026-11-05.** MapLibre v5 dark basemap (Protomaps hosted vector tiles, key `e693aed07528fb91`, CORS locked to prod + `*.wheres-my-plane.pages.dev`) + deck.gl ScatterplotLayer coloured by altitude. Click an aircraft → side panel with reg/type/callsign/alt/speed/heading (via `map.on('click')` + `overlay.pickObject()`). Hover → pointer cursor. Migration 0003 applied remote. R2 bucket `wmp-blobs` enabled on account but unused (reserved for Phase 5 photos). svelte-check clean, 41/41 tests pass. **Key tradeoff**: pivoted away from self-hosted PMTiles on R2 after discovering the planet file is 139 GB (not 100 MB as the plan originally guessed). Protomaps hosted = free for non-commercial use, zero R2 upload, zero ongoing egress. Escape hatch if ever monetised: `pmtiles extract` a region to R2 — same schema, same `style.ts`, URL swap only. |
| 3-7 | ⏳ | — |

### Phase 2 "didn't render" post-mortem (DO NOT REPEAT)

Spent ~90 min chasing a blank-map bug caused by **five independent silent failures layered on top of each other**. Each was invisible on its own (no console error). If the symptom recurs on a different page/component, check these in order — cheapest first:

1. **Canvas size**: run `document.querySelector('.maplibregl-canvas').offsetHeight` in the console. If it's less than the container's visible height, the issue is sizing. Fix: use **inline `style="height: calc(…)"` instead of Tailwind `h-[calc(…)]` arbitrary values** + call `map.resize()` after load + attach a `ResizeObserver` to the container. Tailwind arbitrary values with `calc()` + brackets have been intermittently unreliable in the SvelteKit + Vite + Tailwind v4 combo in this project.
2. **MapLibre version**: pin to `^5` (currently 5.24). MapLibre 6.x changed worker loading in a way that breaks with Vite's default bundling — the worker request hangs forever as `(pending)` in Network with no error logged.
3. **Style source config**: use `sources: { x: { type: 'vector', url: 'https://.../v4.json?key=...' } }` (TileJSON URL), NOT `tiles: ['https://.../{z}/{x}/{y}.mvt?key=...']` (inline). MapLibre 3+ needs the `vector_layers` metadata that TileJSON supplies for style validation.
4. **URL encoding when deriving TileJSON URL from tile template**: use **string replace**, never `new URL(...)` — the URL constructor auto-encodes `{z}/{x}/{y}` to `%7Bz%7D/%7Bx%7D/%7By%7D` which then breaks the regex. Test covered in `src/lib/map/style.test.ts`.
5. **`$effect` placement in Svelte 5**: must be at component script top level, NEVER inside an async callback inside `onMount`. The inner `$effect` throws silently — your reactive updates just stop happening.

Debugging shortcut if ever again faced with "map area is dark but no features visible": first thing — compare the map's painted background color to the surrounding page. If they're the same shade, you're seeing the page bleeding through because the map canvas is 0-sized or isn't rendering. Crank the background to bright red/green in `style.ts` for one deploy to disambiguate.

### Known fixed bugs (do not reintroduce)
- SvelteKit `throw redirect()` throws a `{status, location}` plain object, **not** a `Response`. Catch blocks must use `isRedirect(err)` from `@sveltejs/kit` before handling as error. Fixed in `src/routes/app/flights/new/+page.server.ts`.
- deck.gl `MapboxOverlay` with `interleaved: false` does NOT receive click events — MapLibre's canvas swallows them. Pick objects via `map.on('click', e => overlay.pickObject({ x: e.point.x, y: e.point.y }))`, not via the layer's `onClick` prop. Already wired in `src/routes/app/map/+page.svelte`.

## Section 0 — Decisions register

Every "which library / which pattern / which name" call that could otherwise block execution. Do not relitigate.

| Area | Choice | Why (one line) |
|---|---|---|
| Validation | **Zod 3** | The whole JS/TS LLM-tooling ecosystem (OpenAI SDK, AI SDK, Gemini tool-calling) targets Zod schemas; same schemas reused for form validation. |
| HTTP client (Workers + browser) | **Native `fetch`** wrapped in `src/lib/server/http.ts` (`httpJson<T>(url, opts, { cacheKey, ttlSec, source })`) | No new dep. Wrapper handles KV read-through cache + retry/backoff + `User-Agent: wheres-my-plane/0.x (+https://wheres-my-plane.pages.dev)`. |
| Logging | Thin `log.ts` wrapper: `log.info/warn/error(event, fields)` emitting single-line JSON to `console` | Workers logs are already JSON-friendly; no pino bundle bloat; grep-able. |
| Error handling | **Throw `AppError` (class with `.code`, `.status`, `.publicMessage`)**; API routes convert to `{ ok:false, code, message }` JSON | Idiomatic in SvelteKit actions, simple to reason about. No Result type. |
| Timezone | **Luxon** (`luxon` ^3) | Mature, tree-shakes acceptably, handles IANA tz names from the airports table out of the box. Temporal polyfill too large for Workers bundle budget. |
| Map tiles | **Protomaps PMTiles stored on R2**, served by MapLibre's `pmtiles://` protocol | One-time 100 MB upload, no external tile tenancy, no monthly map-tile bills; attribution handled in a fixed footer. |
| Map style | **MapLibre inline style** adapted from `protomaps/basemaps` "Dark Matter" port (hand-crafted JSON in `src/lib/map/style.ts`) | Avoids pulling an external style file at runtime; one file to tweak. |
| ADS-B viewport strategy | **Single bbox call per viewport**, debounced 1000 ms after `moveend`; KV key `adsb:bbox:{roundedBbox}:{15sBucket}`, TTL 15 s; only polls while tab visible (`document.visibilityState === 'visible'`) | adsb.lol has no API key; polite rate matches their request to go gentle. |
| Client state | **Svelte 5 runes + `$state` modules** (one per domain: `flights.svelte.ts`, `map.svelte.ts`, `agent.svelte.ts`) | No nanostores dep. Runes support cross-component reactivity via module-level `$state`. |
| Data fetching | **SvelteKit `load` for initial render + direct `fetch` from runes modules for interactive polling** | TanStack Query not worth the kB; SvelteKit's load+invalidate covers it. |
| Testing | **Vitest** for pure modules (parsers, reducers, HMAC, tz math), **no Playwright in v1**. Minimum 20 tests, concentrated on parsing/scheduling | Headless Chromium on CF Pages CI is overkill for a solo project; the units most likely to break are parsers. |
| Lint/format | **Prettier + eslint-config-svelte** (Svelte team default), no Biome | Mix with Svelte 5 is well-trodden; Biome's Svelte support is still partial. |
| Commits | **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `ci:`) | Lets later changelog gen be a one-liner; no commitlint hook, discipline-only. |
| Worker → Actions HMAC | `workflow_dispatch` payload includes `{ job_id, callback_url, nonce, issued_at }`; action replies `POST {callback_url}` with `X-WMP-Signature: sha256=hex(HMAC(SHARED_SECRET, raw_body))` and `X-WMP-Nonce` echoed; Worker rejects if nonce seen in `nonces` KV (5-min TTL), if timestamp drift > 10 min, or if sig mismatch | One shared secret `WMP_INGEST_SECRET` on both sides. Replay-safe. |
| Fan-out / scheduling | **Direct D1 query + Worker cron**, no Cloudflare Queues | Free tier: one-minute cron, scan `flight_checks WHERE next_check_at <= now LIMIT 50`. Queues free tier exists but adds config surface we don't need. |
| Rate limiting | **KV counter** per user+route (`rl:{uid}:{route}:{minute}`), TTL 70 s. No Cloudflare Rate Limiting rules | Free, inspectable, enough for single-user traffic. |
| Secret rotation | Each secret has a comment `# rotated YYYY-MM-DD` in `.dev.vars.example`. Rotation = `wrangler pages secret put <NAME>`; no multi-version grace period in v1 | Solo project; downtime of one request is fine. |
| i18n | **English only**, strings inline. No i18n framework | Add `@sveltejs/kit`-compatible i18n later only if a second user requests it. |
| a11y baseline | **WCAG AA**, enforced by `svelte-check` + `eslint-plugin-svelte` a11y rules + manual `axe DevTools` pass before marking any phase done | Named tool: axe DevTools browser extension. |
| Node version | Node 20 LTS (already pinned in `.nvmrc`) | Matches Workers runtime capability floor with `nodejs_compat`. |
| IDs | `randomId(16)` (existing helper in `src/lib/server/random.ts`) for row IDs, `randomId(32)` for tokens | Already written; keep. |
| Time format on wire | **Unix seconds (INTEGER)** in D1, **ISO 8601 UTC strings** on the HTTP wire | D1 integers index cheaply; ISO on the wire is human-debuggable. |
| Money | **GBP, stored as REAL** (`price_gbp`), rendered with `Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP' })`. Non-GBP sources converted at poll time via a cached fx rate (`https://open.er-api.com/v6/latest/GBP`, TTL 24 h) | Avoids a second currency column multiplying pain. |
| Flight-number parser | `src/lib/flights/parse.ts` with regex `^([A-Z]{2,3})\s*0*(\d{1,4})$` | Covers IATA 2-letter and ICAO 3-letter; leading zeros collapsed. |

## Section 1 — Secrets register

| Key | Provider | Phase unlocked | Lives in | Who sets |
|---|---|---|---|---|
| `RESEND_API_KEY` | Resend | 0 (done) | `.dev.vars` + `wrangler pages secret put` | User |
| `MAGIC_LINK_FROM` | Resend | 0 (done) | same | User |
| `PUBLIC_BASE_URL` | — | 0 (done) | same | User |
| `SESSION_SECRET` | self | 0 (done) | same | User |
| `AERODATABOX_RAPIDAPI_KEY` | RapidAPI | 1 | `.dev.vars` + Pages secret | **USER** signs up at rapidapi.com/aedbx-aedbx/api/aerodatabox, subscribes to Basic (free) plan, copies X-RapidAPI-Key |
| `AIRLABS_KEY` | AirLabs | 1 | same | **USER** signs up at airlabs.co |
| `AVIATIONSTACK_KEY` | aviationstack | 1 | same | **USER** optional, only needed if both primaries fail |
| `OPENAI_API_KEY` | OpenAI | 1 (NLU), 4 (STT/TTS), 5 (vision) | same | **USER** — already has credits per memory |
| `GEMINI_API_KEY` | Google AI Studio | 1 (chat composer) | same | **USER** ai.google.dev → Get API key |
| `ADSBLOL_UA` | adsb.lol | 2 | same | Agent sets to `wheres-my-plane/0.x (contact: dereck.varghese@gmail.com)` — no key needed |
| `OPENSKY_USER` / `OPENSKY_PASS` | OpenSky | 2 (fallback) | same | **USER** opensky-network.org account |
| `TELEGRAM_BOT_TOKEN` | Telegram | 3 | `wrangler pages secret put` only (prod); local uses dev bot | **USER** talks to @BotFather, `/newbot`, saves token |
| `TELEGRAM_WEBHOOK_SECRET` | self | 3 | both | Agent generates (`randomBytes(32).hex`), **USER** registers webhook URL via a one-shot script agent provides |
| `GITHUB_PAT_ACTIONS_DISPATCH` | GitHub | 3 (workflow_dispatch) | Pages secret | **USER** creates fine-grained PAT, scope: repo `actions:write`, single repo |
| `WMP_INGEST_SECRET` | self | 3 | Pages secret + GH Actions secret | Agent generates, **USER** pastes identical value to both locations |
| `KIWI_TEQUILA_API_KEY` | Kiwi Tequila | 6 | `.dev.vars` + Pages secret | **USER** signs up at tequila.kiwi.com/portal |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | self | 7 | Pages secret | Agent generates with `npx web-push generate-vapid-keys`, **USER** pastes |
| `VAPID_SUBJECT` | — | 7 | same | Fixed: `mailto:dereck.varghese@gmail.com` |

**Convention:** any key beginning `PUBLIC_` is exposed to the browser via SvelteKit `$env/static/public`. Everything else is server-only.

## Section 2 — External API contracts

All server-side calls go through `src/lib/server/http.ts::httpJson`. Cache keys below are what to pass as `cacheKey`.

### AeroDataBox (via RapidAPI)
- Base: `https://aerodatabox.p.rapidapi.com`
- Auth: headers `X-RapidAPI-Key: $AERODATABOX_RAPIDAPI_KEY`, `X-RapidAPI-Host: aerodatabox.p.rapidapi.com`
- Rate: Basic plan ~600 req/month hard quota. Treat 429 as "cooldown 24h" (set KV `cooldown:aerodatabox` TTL 86400).
- Endpoints used: `GET /flights/number/{flightNo}/{yyyy-MM-dd}`, `GET /aircrafts/reg/{reg}`, `GET /aircrafts/icao24/{hex}`, `GET /airports/iata/{iata}/delays`
- Cache key pattern: `aerodatabox:flight:{flightNo}:{yyyy-MM-dd}` TTL 3600 before window opens, 300 inside window; `aerodatabox:reg:{reg}` TTL 86400
- Consumer: Worker `/api/flights POST`, scheduled `cron`
- Fallback chain: AirLabs → aviationstack → "unknown, retry later"
- Attribution: none required

### AirLabs
- Base: `https://airlabs.co/api/v9`
- Auth: query `?api_key=...`
- Rate: free plan 1000 req/month
- Endpoints: `GET /flight?flight_iata=BA456`, `GET /flights?dep_iata=LHR&arr_iata=SIN` (bbox not supported — not used for map)
- Cache: `airlabs:flight:{flightNo}` TTL 300
- Consumer: Worker, fallback for AeroDataBox
- Attribution: none required

### aviationstack
- Base: `http://api.aviationstack.com/v1`
- Auth: query `?access_key=...`
- Rate: 100 req/month
- Endpoints: `GET /flights?flight_iata=BA456`
- Cache: `aviationstack:flight:{flightNo}:{date}` TTL 3600
- Attribution: none; emergency fallback only

### adsb.lol
- Base: `https://api.adsb.lol/v2`
- Auth: none, send `User-Agent: wheres-my-plane/0.x (...)`
- Rate: no documented key cap; our self-imposed: max 1 req / 15 s / viewport
- Endpoints: `GET /lat/{lat}/lon/{lon}/dist/{nm}` (used for viewport), `GET /hex/{hex}` (used for pinned aircraft)
- Cache: `adsb:bbox:{roundedBbox}:{15sBucket}` TTL 15 s; `adsb:hex:{hex}` TTL 30 s
- Consumer: Worker `/api/traffic`, Worker `/api/aircraft/{hex}/position`
- Fallback: OpenSky live
- Attribution: ODbL — "Live aircraft data © adsb.lol contributors, ODbL" in map footer

### OpenSky live
- Base: `https://opensky-network.org/api`
- Auth: HTTP Basic (`OPENSKY_USER:OPENSKY_PASS`), optional for public endpoints but unauth'd rate is 100 credits/day
- Rate: auth'd ~4000 credits/day
- Endpoints: `GET /states/all?lamin=&lamax=&lomin=&lomax=`, `GET /states/all?icao24={hex}`
- Cache: same keys as adsb.lol, prefix `opensky:` when used
- Consumer: Worker `/api/traffic` fallback
- Attribution: "Non-commercial use. © OpenSky Network."

### OpenSky aircraft database (bulk)
- Base: `https://opensky-network.org/datasets/metadata/aircraftDatabase.csv`
- Auth: none
- Rate: one download / week
- Consumer: GitHub Actions workflow `ingest-aircraft-db.yml` (schedule: weekly)
- Target: inserts into D1 `aircraft` (upsert on `hex`)
- Attribution: none required

### adsbdb
- Base: `https://api.adsbdb.com/v0`
- Auth: none, UA required
- Rate: generous; cache aggressively
- Endpoints: `GET /aircraft/{hex}`, `GET /callsign/{callsign}`
- Cache: `adsbdb:aircraft:{hex}` TTL 86400, `adsbdb:callsign:{cs}` TTL 3600
- Consumer: Worker `/api/flights POST` (enrichment)

### Planespotters photo API
- Base: `https://api.planespotters.net/pub/photos`
- Auth: none, UA with contact string required
- Rate: unmetered, polite usage requested
- Endpoints: `GET /reg/{reg}`, `GET /hex/{hex}`
- Cache: `planespotters:reg:{reg}` TTL 604800 (7 days)
- Consumer: `/api/aircraft/{reg}/photo`
- Attribution: **mandatory** — show `photographer` text next to image + link to Planespotters page. Free tier only; must not be gated behind payment.

### aviationweather.gov
- Base: `https://aviationweather.gov/api/data`
- Auth: none
- Endpoints: `GET /metar?ids=EGLL,WSSS&format=json`, `GET /taf?ids=...&format=json`
- Cache: `avwx:metar:{ids}` TTL 300, `avwx:taf:{ids}` TTL 1800
- Consumer: Worker `/api/weather`

### EUROCONTROL Aviation Intelligence Portal
- Base: `https://www.eurocontrol.int/sites/default/files/content/documents/official-documents/facts-and-figures/...` (monthly PDFs/XLSX)
- Auth: none
- Rate: one download / month
- Consumer: GitHub Actions `ingest-eurocontrol.yml` monthly, Python parses XLSX → D1 `routes_otp` / `airport_otp`
- Attribution: "Source: EUROCONTROL" shown wherever these figures surface; no modification of the data.

### BTS (US on-time)
- Base: `https://www.transtats.bts.gov/DL_SelectFields.aspx?...` (monthly CSV download via automated POST form)
- Rate: one / month
- Consumer: GitHub Actions `ingest-bts.yml` monthly
- Target: `routes_otp` with `source='BTS'`

### FAA NAS
- Base: `https://nasstatus.faa.gov/api/airport-status-information`
- Rate: no cap documented; poll max every 5 min
- Cache: `faa:nas` TTL 300
- Consumer: Worker `/api/delays/us`
- Attribution: "FAA NAS status"

### FAA Releasable DB
- Base: `https://registry.faa.gov/database/ReleasableAircraft.zip`
- Rate: one / weekday
- Consumer: GitHub Actions `ingest-faa-reg.yml` weekly
- Target: `aircraft` (US `N-` prefix only)

### CAA punctuality
- Base: scrape pages linked from https://www.caa.co.uk/data-and-analysis/uk-aviation-market/flight-punctuality/ (monthly CSV links)
- Rate: once / month
- Consumer: GitHub Actions `ingest-caa-otp.yml` monthly
- Attribution: "Source: UK Civil Aviation Authority. © CAA." — must not be sold.

### CAA G-INFO
- Scrape `https://siteapps.caa.co.uk/g-info/` by registration pattern, once per unseen G- registration, cached forever in `aircraft`
- Attribution: "Source: UK CAA G-INFO."

### airfleets.net
- Scrape `https://www.airfleets.net/recherche/?key={reg}`
- Rate: self-cap 1 req / 10 s, retry with 10-min backoff on 429/503
- Cache: result into `aircraft.prev_regs_json` + `aircraft.first_flight_date`, no re-scrape within 180 days
- Consumer: GitHub Actions `enrich-aircraft.yml` (triggered when `aircraft` row has null fields)

### airport-data.com
- Scrape `https://www.airport-data.com/aircraft/{reg}.html`
- Same rules as airfleets

### Kiwi Tequila
- Base: `https://api.tequila.kiwi.com`
- Auth: header `apikey: $KIWI_TEQUILA_API_KEY`
- Rate: generous for personal use; cap at 1 poll per watched flight per 6 h
- Endpoints: `GET /v2/search?fly_from=LHR&fly_to=SIN&date_from=05/11/2026&date_to=05/11/2026`
- Cache: `kiwi:search:{from}:{to}:{yyyy-MM-dd}` TTL 21600
- Consumer: cron Worker `/cron/prices` + Worker `/api/flights/{id}/price-watch`
- Attribution: none

### Telegram Bot API
- Base: `https://api.telegram.org/bot{token}`
- Rate: 30 msgs/sec globally, 1/sec per chat
- Endpoints: `sendMessage`, `sendVoice`, `setWebhook`
- Webhook target: `POST https://wheres-my-plane.pages.dev/api/telegram/webhook` with `X-Telegram-Bot-Api-Secret-Token` header matching `TELEGRAM_WEBHOOK_SECRET`

### Resend
- Base: `https://api.resend.com`
- Already wired in `src/lib/server/email.ts`. No further change.

### Gemini 2.0 Flash
- Base: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
- Auth: `?key=$GEMINI_API_KEY`
- Rate: 15 RPM, 1M tokens/day free tier
- Consumer: `/api/ask` (routine Q&A composition)
- Cache: `gemini:{sha256(prompt)}` TTL 600 (same prompt within 10 min reuses)

### OpenAI
- Base: `https://api.openai.com/v1`
- Models used: `gpt-4o-mini` (chat + vision), `whisper-1` (STT), `tts-1` with `voice=alloy` (TTS)
- Rate: tied to account tier; cache by `sha256(prompt)` on tool-calling turns
- Consumer: `/api/flights POST` (NLU structured output), `/api/photo POST` (vision), `/api/voice/transcribe`, `/api/voice/speak`

## Section 3 — Phase-by-phase implementation plan

---

## Phase 1 — Add a flight → aircraft card

### Goal
User signs in, hits `/app/flights/new`, types "BA456 tomorrow" or fills a form, and sees within 3 s an aircraft card showing registration (if assigned), type, age, delivery date, previous operators, a credited Planespotters photo, and route-punctuality text that names its source. Flights persist to D1 and list at `/app/flights`.

### Dependencies
- Phase 0 complete.
- Secrets: `AERODATABOX_RAPIDAPI_KEY`, `AIRLABS_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`.

### User actions (one-time, cannot be automated)
1. ⚠️ USER ACTION: Sign up at rapidapi.com, subscribe to AeroDataBox Basic (free), copy key.
2. ⚠️ USER ACTION: Sign up at airlabs.co, copy key.
3. ⚠️ USER ACTION: Create Gemini API key at ai.google.dev.
4. ⚠️ USER ACTION: Confirm OpenAI key is already set (it is per memory); if not, provide one.
5. ⚠️ USER ACTION: Run `npm run db:console:local -- "INSERT INTO invites (email) VALUES ('test2@example.com')"` if testing a second user flow.
6. ⚠️ USER ACTION: `npx wrangler pages secret put AERODATABOX_RAPIDAPI_KEY`, same for `AIRLABS_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` for prod.

### Agent actions
(a) **DB migration** `db/migrations/0002_phase1_flights.sql`:
- Uncomment and apply the Phase 1 blocks from `db/schema.sql`: `flights`, `aircraft`, `aircraft_reg_idx`, `airports`.
- Seed `airports` from a static JSON at `src/lib/data/airports.seed.json` (bundle a 50-row seed of the top hubs; the rest fills lazily via AeroDataBox airport lookups).

(b) **Library modules:**
- `src/lib/server/http.ts` — `httpJson<T>(url, { method?, headers?, body?, cacheKey?, ttlSec?, source })`, uses KV read-through and backoff.
- `src/lib/server/kv.ts` — typed wrappers `getJson<T>`, `putJson`, `cooldownActive`, `markCooldown`.
- `src/lib/server/providers/aerodatabox.ts` — `getFlight(flightNo, date)`, `getAircraft(hex|reg)`, `getAirportDelays(iata)`.
- `src/lib/server/providers/airlabs.ts` — `getFlight(flightNo)`.
- `src/lib/server/providers/aviationstack.ts` — `getFlight(flightNo, date)`.
- `src/lib/server/providers/planespotters.ts` — `getPhoto(reg)`.
- `src/lib/server/providers/adsbdb.ts` — `getAircraftByHex(hex)`.
- `src/lib/server/flights/resolve.ts` — orchestrates the fallback chain; returns a canonical `ResolvedFlight` shape (Zod schema in the same file).
- `src/lib/server/flights/otp.ts` — picks EUROCONTROL / BTS / CAA / AeroDataBox stats / "own history empty" based on origin+dest+carrier; returns `{ source: 'EUROCONTROL'|..., otp15: number|null, label: string }`.
- `src/lib/server/nlu.ts` — "BA456 tomorrow" → structured `{ flight_no, flight_date }` via `gpt-4o-mini` with Zod-validated response. Rejects to form-only on failure.
- `src/lib/flights/parse.ts` — pure, deterministic flight-number regex.
- `src/lib/time.ts` — Luxon helpers: `renderDual(utcSec, airportTz, homeTz)` → `"21:10 SGT · 13:10 GMT"`.
- `src/lib/log.ts` — see Section 0.
- `src/lib/errors.ts` — `AppError` class.

(c) **SvelteKit routes:**
- `src/routes/app/flights/+page.svelte` + `+page.server.ts` — list upcoming flights (D1 `SELECT WHERE user_id = ? AND flight_date >= today ORDER BY sched_dep_utc`). Empty state links to `/app/flights/new`.
- `src/routes/app/flights/new/+page.svelte` + `+page.server.ts` — form (NL input OR split fields), POSTs to the same page action; action calls `resolve` and `INSERT INTO flights`.
- `src/routes/app/flights/[id]/+page.svelte` + `+page.server.ts` — detail page: aircraft card, OTP line with source badge.
- `src/routes/api/flights/+server.ts` — same POST handler as action, JSON surface for voice/Telegram use later.
- `src/routes/api/aircraft/[key]/+server.ts` — key = reg or hex, returns merged `aircraft` row + Planespotters photo.

(d) **UI components:**
- `src/lib/components/AircraftCard.svelte`
- `src/lib/components/OtpBadge.svelte` (shows source: EUROCONTROL | BTS | CAA | provider | pending)
- `src/lib/components/FlightRow.svelte`
- `src/lib/components/EmptyState.svelte`

(e) **GitHub Actions:** none this phase.

### Data model deltas
Full DDL copied from `db/schema.sql` Phase 1 block. Plus: add `flights.nlu_raw TEXT` nullable (debugging aid).

New KV prefixes: `aerodatabox:*`, `airlabs:*`, `aviationstack:*`, `adsbdb:*`, `planespotters:*`, `cooldown:*`, `nlu:{sha}`.

New R2: none.

New secrets: see above.

### Acceptance criteria
- [x] `/app/flights` lists upcoming flights, empty state links to new.
- [x] `/app/flights/new` accepts "BA456 tomorrow" and renders the detail page within 3 s on a cold cache.
- [~] Detail page shows an aircraft card with photo + photographer credit + link to Planespotters. — renders; photo depends on Planespotters having a shot of the assigned tail.
- [x] OTP badge visibly names its source. — copy for the empty state needs tidy-up (see pending list above).
- [x] Repeat submission of the same flight hits KV and returns < 300 ms.
- [ ] AeroDataBox 429 triggers fallback to AirLabs — covered in unit tests via mocked spies; not yet reproduced live.
- [x] Zero red errors in browser console on a happy path.
- [x] `svelte-check` clean (0 errors, 0 warnings).
- [x] Vitest: parse + time + resolve fallback logic covered (25 tests across 3 files).

### Risks
- **AeroDataBox quota blown on dev.** Mitigation: `httpJson` logs every provider call with `source` and D1 `api_cache` persists results across restarts.
- **Planespotters UA blocking.** Mitigation: set UA with contact string; back off on 403.
- **NLU hallucination.** Mitigation: Zod-validate the model's JSON response; on invalid, show the form.

### Open questions worth checking with the user before starting
- **Date interpretation for ambiguous "BA456"**: if the user omits a date, default to "next scheduled departure within 7 days". Confirm vs "always ask".
- **Form fields**: should the form show cabin class? It's not used until Phase 6. Suggest: hide it until Phase 6.

---

## Phase 2 — Global disruption map

### Goal
`/app/map` loads a MapLibre dark basemap in under 2 s, shows live aircraft within the viewport (deck.gl `ScatterplotLayer` zoomed out, `IconLayer` zoomed in), colours major airports by current delay, pans/zooms smoothly on mobile, and shows the user's active flights' aircraft tracks as `ArcLayer`s. Click an aircraft → side panel with registration, type, origin/dest.

### Dependencies
- Phase 1 done so `aircraft` + `airports` exist.
- No new API keys strictly required; OpenSky creds optional.

### User actions (one-time)
1. ⚠️ USER ACTION (optional): Create OpenSky account and set `OPENSKY_USER` / `OPENSKY_PASS` for 4000 credits/day fallback.
2. ⚠️ USER ACTION: One-off build + upload Protomaps PMTiles to R2. Agent produces a script; user runs it (requires enabling R2 in Cloudflare dashboard first — one click).

### Agent actions
(a) **DB migration** `db/migrations/0003_phase2_positions.sql`:
- `positions_recent` (per schema.sql)
- `scrape_log` and `api_cache` tables (also from schema.sql — needed so viewport queries persist across cold starts)
- Nightly trim via Worker cron: `DELETE FROM positions_recent WHERE ts < unixepoch() - 86400`.

(b) **Enable R2** in `wrangler.toml`:
- Uncomment the `BLOBS` binding.
- Add `R2_PUBLIC_URL` secret pointing at the public R2 custom subdomain (Cloudflare provides one when R2 is enabled; no custom domain).
- Script `scripts/upload-pmtiles.ps1`: downloads `https://build.protomaps.com/YYYYMMDD.pmtiles` (world, ~100 MB), uploads to R2 as `basemap.pmtiles`.

(c) **Library modules:**
- `src/lib/map/style.ts` — inline MapLibre style JSON, PMTiles source URL from `PUBLIC_PMTILES_URL`.
- `src/lib/map/layers.ts` — deck.gl layer factories.
- `src/lib/map/bbox.ts` — round a map bbox to a 0.5° grid (keeps KV keys hot).
- `src/lib/server/providers/adsblol.ts` — `getTrafficInBbox(bbox)`, `getPositionByHex(hex)`.
- `src/lib/server/providers/opensky.ts` — same shape, used as fallback.
- `src/lib/server/providers/faa_nas.ts` — `getUsAirportDelays()`.
- `src/lib/server/providers/aviationweather.ts` — `getMetar(ids[])`.
- `src/lib/server/map/airports.ts` — aggregates delay colouring: FAA NAS for US airports, EUROCONTROL (nightly ingest) elsewhere.

(d) **SvelteKit routes:**
- `src/routes/app/map/+page.svelte` — map canvas, layer toggles, side panel.
- `src/routes/api/traffic/+server.ts?lamin&lamax&lomin&lomax` — returns deduped `[{hex, lat, lon, alt, gs, heading, callsign}]`.
- `src/routes/api/delays/+server.ts` — combined delay feed.
- `src/routes/api/weather/+server.ts?ids=`
- `src/routes/api/aircraft/[hex]/track/+server.ts` — returns today's position trail from `positions_recent` plus a scheduled-arc from the flight's origin/dest.

(e) **GitHub Actions:**
- `.github/workflows/ingest-aircraft-db.yml` — weekly, pulls OpenSky bulk CSV, pushes rows to D1 via Wrangler + HMAC `ingest` endpoint.

(f) **Worker-side HMAC ingest:**
- `src/routes/api/ingest/+server.ts` — accepts HMAC-signed POST with `{ table, rows }`; validates `X-WMP-Signature`, inserts in batches of 500.

### Data model deltas
`positions_recent`, `api_cache`, `scrape_log` (schema.sql). KV prefixes: `adsb:*`, `opensky:*`, `faa:*`, `avwx:*`. R2: `basemap.pmtiles`.

New secrets: `WMP_INGEST_SECRET`, `R2_PUBLIC_URL`, optionally `OPENSKY_USER`/`PASS`.

### Acceptance criteria
- [ ] `/app/map` first paint < 2 s on a throttled Fast 3G (WebPageTest or Chrome DevTools).
- [ ] Panning the map does not fire more than one `/api/traffic` call per debounce window.
- [ ] Zooming from world to EGLL smoothly reveals icon layer; no visible layer swap flicker.
- [ ] US airports coloured by NAS delay; EUROCONTROL-area airports coloured from monthly data if present, grey otherwise.
- [ ] Click aircraft → panel with correct reg + type.
- [ ] Footer carries adsb.lol ODbL, OpenSky non-commercial, Protomaps/OSM attributions.
- [ ] Only polls while tab visible.
- [ ] Nightly trim worked once (manual trigger OK on first day).

### Risks
- **PMTiles 100 MB cold fetch latency.** Mitigation: served via Cloudflare R2 public URL which is behind the CDN; set long cache headers (`Cache-Control: public, max-age=86400`).
- **adsb.lol unexpectedly requires a key.** Mitigation: fallback chain already includes OpenSky; the UI must show "live data unavailable" rather than freeze.
- **deck.gl bundle size.** Mitigation: dynamic-import the map route; it is a separate chunk.

### Open questions worth checking with the user before starting
- **PMTiles freshness**: regenerate monthly via a cron workflow, or treat the first upload as permanent? Monthly adds an Action; permanent is fine for v1 since labels change rarely.
- **Default map layers on first visit**: suggest live traffic + my flights ON, delays + weather OFF; confirm.

---

## Phase 3 — Scheduled agent + Telegram alerts

**STATUS 2026-11-06: done + deployed to prod.** Telegram `/start` + `/link` end-to-end verified. Scheduler runs via GitHub Actions cron workflow hitting `/api/cron/tick` every minute (Pages Projects don't support native `[triggers]` in wrangler.toml — only Workers do). Alerts are **text-only in v1**; voice note generation deferred to Phase 4's Q&A pipeline. Repo: https://github.com/DV478/wheres-my-plane. See "Resume point" in project memory for the next-session hand-off, including a `BA7 tomorrow` smoke test that still needs to be run to confirm the full add-flight → tail-assignment → Telegram-ping loop. Also see `feedback_pages_wrangler_constraints.md` for three sharp Cloudflare/Pages gotchas that bit us.

### Goal
User gets a Telegram alert that reads, in text + voice, "Your BA456 aircraft (G-STBD) has just been assigned. It is currently inbound from Dubai, due to turn around at 21:10 local. Expect pushback on time." Alerts fire only on material change. Agent runs via a 1-minute cron Worker that respects per-flight check windows.

### Dependencies
- Phase 1 (flights exist).
- Secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `WMP_INGEST_SECRET`, `GITHUB_PAT_ACTIONS_DISPATCH`.

### User actions
1. ⚠️ USER ACTION: @BotFather → `/newbot`, name `wheres-my-plane-bot`, copy token.
2. ⚠️ USER ACTION: Set the token as a Pages secret: `npx wrangler pages secret put TELEGRAM_BOT_TOKEN`.
3. ⚠️ USER ACTION: Run the one-shot `scripts/register-telegram-webhook.ps1` the agent provides — it calls `setWebhook` with the production URL and the `TELEGRAM_WEBHOOK_SECRET`.
4. ⚠️ USER ACTION: In Telegram, start a chat with the bot, send `/start`. The bot replies with a 6-digit link code. Paste it on `/app/settings`.
5. ⚠️ USER ACTION: Create a GitHub fine-grained PAT (`actions:write` on the repo), set `GITHUB_PAT_ACTIONS_DISPATCH` and `WMP_INGEST_SECRET` as Pages secrets AND as GitHub Actions secrets (same value in both places).

### Agent actions
(a) **DB migration** `db/migrations/0004_phase3_scheduler.sql`:
- `flight_checks`, `events` from schema.sql.
- `tg_link_codes` (new): `(code TEXT PK, user_id TEXT, expires_at INTEGER, consumed_at INTEGER)` — 6-digit, 15-min TTL.

(b) **Worker cron**: add to `wrangler.toml`:
```
[triggers]
crons = ["* * * * *"]
```
- Handler at `src/routes/api/cron/+server.ts` guarded by header `X-WMP-Cron: true` (set by Cloudflare automatically on `scheduled` events — but Pages runs this via the scheduled handler, which the SvelteKit `@sveltejs/adapter-cloudflare` v4 route-based approach supports as a custom export).
- Logic: select up to 50 `flight_checks WHERE next_check_at <= now`, for each: call `resolve` for fresh status, diff against last known, write `events` for material change, enqueue Telegram message, then update `next_check_at` using cadence rules below.

(c) **Cadence:**
- Outside window (`now < window_open_at`): no action; `next_check_at` set to `window_open_at`.
- Window opens: 6 h before `sched_dep_utc` (12 h for long-haul: inbound flight distance > 5000 km).
- Inside window: default 30 min cadence, tightened to 15 min once tail assigned, 5 min from T-2h.
- After `window_close_at` (= `sched_dep_utc + 1 h`): row becomes inert; `next_check_at` NULL.

(d) **Library modules:**
- `src/lib/server/scheduler.ts` — `tickOnce(env)`, `recomputeNextCheck(flight, lastKnown)`.
- `src/lib/server/providers/telegram.ts` — `sendMessage(chatId, text)`, `sendVoice(chatId, mp3Blob, caption)`, `setWebhook(url, secret)`.
- `src/lib/server/agent/diff.ts` — compares `ResolvedFlight` t-1 vs t and emits typed `MaterialChange` events (`tail_assigned`, `delay_change`, `cancelled`, `diverted`, `gate_change`).
- `src/lib/server/agent/brief.ts` — composes a < 20 s voice script via Gemini 2.0 Flash, prompt template in-file.
- `src/lib/server/agent/voice.ts` — calls OpenAI `tts-1` to make an MP3 under 1 MB, returns `Blob`.
- `src/lib/server/user_hash.ts` — `hashUser(userId, SESSION_SECRET)` → 16-hex. Used for `events.user_hash`.
- `src/lib/server/actions/dispatch.ts` — triggers GitHub `workflow_dispatch` with HMAC-nonce, returns job id.
- `src/lib/server/hmac.ts` — `sign(body, secret)`, `verify(body, sig, secret)`, `freshNonce(kv)`.

(e) **SvelteKit routes:**
- `src/routes/api/telegram/webhook/+server.ts` — POST, reads `X-Telegram-Bot-Api-Secret-Token`, handles `/start`, `/link <code>`, `/status`, `/mute`.
- `src/routes/app/settings/+page.svelte` + `+page.server.ts` — shows link code status + home timezone picker (defaults to browser TZ, writes `users.home_tz`).
- `src/routes/api/ingest/+server.ts` — generic HMAC ingest for Action callbacks (built in Phase 2 — reused).

(f) **GitHub Actions:**
- `.github/workflows/ingest-eurocontrol.yml` — monthly, pulls EUROCONTROL punctuality, posts to `/api/ingest` with HMAC.
- `.github/workflows/ingest-bts.yml` — monthly, same shape.
- `.github/workflows/ingest-caa-otp.yml` — monthly.
- `.github/workflows/enrich-aircraft.yml` — `workflow_dispatch` only, called by Worker when `aircraft.first_flight_date IS NULL` queue exceeds 5 rows; scrapes airfleets + airport-data, posts back.

### Data model deltas
`flight_checks`, `events`, `tg_link_codes`, `routes_otp`, `airport_otp`.

New KV prefixes: `cron:lock` (1-minute advisory lock), `nonces:{nonce}`, `rl:*`.

New secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `WMP_INGEST_SECRET`, `GITHUB_PAT_ACTIONS_DISPATCH`.

### Acceptance criteria
- [ ] Linking a Telegram account via `/start` + `/link` writes `users.tg_chat_id`.
- [ ] A test flight in the next hour fires one `tail_assigned` event in D1 when the tail is populated and one Telegram message (text + voice note).
- [ ] No API calls are made for a flight 2 days from now.
- [ ] HMAC ingest rejects an unsigned request with 401.
- [ ] HMAC ingest rejects a replay (same nonce twice) with 409.
- [ ] `/mute` on Telegram stops further alerts for the sender's active flights.
- [ ] Monthly Action imports at least one row into `routes_otp` after the first run.

### Risks
- **Cron coalescing on Pages scheduled events.** Mitigation: advisory KV lock `cron:lock` with 55 s TTL prevents overlap.
- **Gemini voice prompt drift.** Mitigation: Zod-validate the brief is ≤ 400 chars; fallback to template string on invalid.
- **Telegram rate limit.** Mitigation: 1 msg / chat / sec, queue in KV `tg:queue:{chatId}`.

### Open questions worth checking with the user before starting
- **How loud is the default alert set?** Options: (A) every material change with voice, (B) every material change text-only, (C) only delay/cancel/divert with voice, gate/tail text-only. Suggest (C).
- **Home timezone source**: browser detection + override, or pin to `Europe/London`? Suggest detect + override.

---

## Phase 4 — Voice Q&A ("where's my plane?")

### Goal
In the web app, user taps a mic, says "Where's my plane?"; within 5 s hears a spoken answer that leads with the answer and names its sources. Same question in Telegram as a voice note returns a voice-note reply. Follow-ups work ("How old is it?", "How's the weather at Changi?").

### Dependencies
- Phase 3 (Telegram, voice helpers).
- Secret: `OPENAI_API_KEY` (already set).

### User actions
- None.

### Agent actions
(a) **DB migration**: none.

(b) **Library modules:**
- `src/lib/voice/client.ts` — Web Speech API wrapper: `startListen(onFinal)`, `speak(text)`, feature-detects and falls back to upload-to-server for Whisper STT.
- `src/lib/server/agent/qna.ts` — single-turn tool-calling loop with `gpt-4o-mini`. Tools available:
  - `get_my_flights_today()` → list
  - `get_flight_status(flight_id)` → latest resolved shape
  - `get_aircraft_position(hex)` → latest from `positions_recent` or ADS-B call
  - `get_weather(iata)` → METAR + TAF
  - `get_otp(origin, dest, carrier)` → OTP line
- `src/lib/server/agent/narrate.ts` — composes a < 20 s script from the tool results via Gemini 2.0 Flash, then `voice.ts` turns it into MP3.

(c) **SvelteKit routes:**
- `src/routes/api/ask/+server.ts` — accepts `{ text }`, returns `{ answer_text, audio_url? }`. Long path streams audio into an R2 object `voice/{sha256(text)}.mp3` with 1 h TTL (lifecycle rule) and returns the URL.
- `src/routes/api/voice/transcribe/+server.ts` — accepts audio Blob, calls Whisper, returns text.
- `src/routes/api/voice/speak/+server.ts` — thin wrapper around `voice.ts` (used by Telegram webhook + browser fallback).
- `src/routes/app/ask/+page.svelte` — mic button + transcript panel; browser uses Web Speech where supported, else records and POSTs.

(d) **Telegram:**
- Extend `src/routes/api/telegram/webhook/+server.ts` to handle `voice` messages: download via `getFile`, post to `/api/voice/transcribe`, pass text to `qna.answer`, send result via `sendVoice`.

### Data model deltas
R2 lifecycle rule for prefix `voice/`: delete after 1 day. No D1 changes.

### Acceptance criteria
- [ ] Browser mic → answer under 5 s on happy path, < 10 s when invoking all four tools.
- [ ] Answer leads with the direct answer, mentions sources in-line (e.g. "per EUROCONTROL last month, 78% on time").
- [ ] Telegram voice-in → voice-out works.
- [ ] If the aircraft is outside ADS-B coverage, the answer says "last seen at..." not an estimate.
- [ ] All voice MP3s are < 1 MB.

### Risks
- **Tool loop runaway.** Mitigation: max 3 tool-call iterations, cap total tokens 2k.
- **Whisper latency on long clips.** Mitigation: client-side VAD stops recording at 1.5 s of silence.

### Open questions
- **Voice choice**: `alloy` default; user may want `nova` or `shimmer`. Suggest `alloy`.
- **Keep voice replies**: 1 h R2 TTL (default) vs session-only (strip immediately after fetch). Suggest 1 h for re-listen.

---

## Phase 5 — Photo spotter

### Goal
Logged-in user drops a photo onto `/app/spotter`. Within 6 s sees "9V-SMU — Boeing 777-300ER, 13 years old, delivered to Singapore Airlines 2013. Currently on the ground at Changi." Photo + EXIF discarded immediately after the vision call. Uses `gpt-4o-mini` vision.

### Dependencies
- R2 enabled (Phase 2).
- Secret: `OPENAI_API_KEY`.

### User actions
- None.

### Agent actions
(a) **DB migration**: none (we reuse `aircraft`).

(b) **Library modules:**
- `src/lib/server/photo/strip_exif.ts` — strip EXIF in Workers via a minimal JPEG/HEIC parser (skip HEIC → convert via gpt-4o-mini acceptance, EXIF stripped by re-encode on client side first as a defence in depth).
- `src/lib/photo/strip_exif_client.ts` — browser-side pre-upload re-encode to JPEG (canvas round-trip) so EXIF never reaches the server.
- `src/lib/server/photo/ocr.ts` — vision prompt: "Return JSON `{ registration: string | null, confidence: number, prefix_country: string | null }`"; Zod-validated.
- `src/lib/server/photo/validate_reg.ts` — checks the returned reg against known country prefix patterns from `src/lib/data/reg_prefixes.ts`.
- `src/lib/server/photo/story.ts` — joins to `aircraft` (via `hex` or `reg`); if missing, triggers `enrich-aircraft` Action and returns a "we'll know in a few minutes" placeholder.

(c) **SvelteKit routes:**
- `src/routes/app/spotter/+page.svelte` — drop zone.
- `src/routes/api/photo/+server.ts` — POST multipart, returns `{ registration, confidence, story }`. R2 upload is **ephemeral**: upload to `spotter/{uuid}` with 5-min lifecycle, delete on success.

(d) **Fallback path** (no reg readable):
- If vision returns `{ registration: null }`, prompt user to enter photo capture location + time; call `/api/aircraft/near?lat&lon&ts` which queries `positions_recent` for aircraft within 20 nm in that minute, returns candidates.

### Data model deltas
R2 lifecycle: `spotter/` prefix → delete after 10 min.

### Acceptance criteria
- [ ] Clear daylight photo of a 9V- aircraft returns correct reg.
- [ ] Night / angled photo returns `null` cleanly and the fallback flow renders.
- [ ] No EXIF on any R2 object (`exiftool` shows nothing).
- [ ] Spotter R2 bucket is empty 10 min after the session.
- [ ] Any shown third-party photo (Planespotters link in the story card) carries the photographer credit.

### Risks
- **gpt-4o-mini hallucinating a plausible-but-wrong reg.** Mitigation: `validate_reg.ts` rejects a reg whose prefix doesn't match a known country; return `null` with reason.

### Open questions
- **Do we let anonymous (non-signed-in) users use the spotter?** Spec says "anyone". Current v1 is invite-only; suggest: require sign-in for v1; relax later.

---

## Phase 6 — Price monitoring

### Goal
On the flight detail page, a "Watch price" toggle polls Kiwi every 6 h, stores market baseline + series, charts the trend, and alerts (Telegram) if the market price drops ≥ 10% below the baseline OR ≥ 10% below the user's paid price.

### Dependencies
- Phase 3 (cron + Telegram).
- Secret: `KIWI_TEQUILA_API_KEY`.

### User actions
1. ⚠️ USER ACTION: Sign up at tequila.kiwi.com/portal, request a personal API key (approval is quick).
2. ⚠️ USER ACTION: `wrangler pages secret put KIWI_TEQUILA_API_KEY`.

### Agent actions
(a) **DB migration** `db/migrations/0005_phase6_prices.sql`:
- `prices`, `price_watches` from schema.sql.

(b) **Library modules:**
- `src/lib/server/providers/kiwi.ts` — `search(from, to, date)`, returns cheapest fare in GBP.
- `src/lib/server/prices/poll.ts` — one-poll-per-watched-flight-per-6h.
- `src/lib/server/prices/alert.ts` — threshold check, Telegram emit via existing voice/text path.
- `src/lib/charts/sparkline.svelte` — trivial inline SVG sparkline; no chart library.

(c) **SvelteKit routes:**
- `src/routes/api/flights/[id]/price-watch/+server.ts` POST/DELETE.
- Extend `src/routes/app/flights/[id]/+page.svelte` with a Watch button + sparkline.

(d) **Cron hookup:** extend `src/lib/server/scheduler.ts` so that when a `flight_checks` tick fires and the flight has a `price_watches` row, poll prices iff last poll > 6 h ago.

### Data model deltas
`prices`, `price_watches`. No KV changes beyond `kiwi:*`.

### Acceptance criteria
- [ ] Toggling Watch writes `price_watches` and triggers an immediate poll.
- [ ] Six hours later a second row lands in `prices`.
- [ ] A hand-forced "price drop" (edit a row to -11%) fires one Telegram message.
- [ ] Sparkline renders ≥ 2 points without blowing up.

### Risks
- **Kiwi rejects personal keys without upfront approval.** Mitigation: feature gates itself to users with a `kiwi_enabled=1` D1 flag; disable the UI if the key is missing.

### Open questions
- **Alert on price UP as well as down?** Spec says drop; suggest drop-only for v1.

---

## Phase 7 — Harden + PWA

### Goal
App installable from mobile Chrome/Safari; survives offline for the shell + last-known flights; VAPID web push works as an alert channel alongside Telegram; all data-source attributions visibly surface; CSP headers in place; a `/about` page lists sources.

### Dependencies
- All prior phases.

### User actions
1. ⚠️ USER ACTION: Generate VAPID keys locally via `npx web-push generate-vapid-keys`, paste into Pages secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

### Agent actions
(a) **DB migration** `db/migrations/0006_phase7_push.sql`:
- `push_subs`.

(b) **PWA:**
- `static/manifest.webmanifest` — name, icons (agent generates 192 + 512 PNGs placeholder; user may replace).
- `src/service-worker.ts` — Workbox-less, hand-rolled: cache `/`, `/app`, `/app/flights`, `/app/map`'s shell; network-first for `/api/*`; stale-while-revalidate for tile requests; handle `push` event with a notification builder.
- `src/lib/components/InstallPrompt.svelte` — shows "Add to Home Screen" when `beforeinstallprompt` fires.

(c) **Push:**
- `src/lib/server/push.ts` — `sendPush(subscription, payload)` using `@cloudflare/web-push` WASM port (small) or hand-signed VAPID JWT via `jose`.
- Extend scheduler: if `push_subs` row exists, send push in parallel with Telegram.
- `src/routes/api/push/subscribe/+server.ts` + unsubscribe.
- `/app/settings` gains a "Enable notifications" button.

(d) **Attribution surfaces:**
- `src/routes/about/+page.svelte` — one page listing every source with its licence text.
- Map footer already created in Phase 2; audit here.
- Aircraft card: Planespotters credit.
- OTP badges: EUROCONTROL/CAA/BTS credit line in the card detail popover.

(e) **Security hardening:**
- CSP header via SvelteKit hook, strict allowlist.
- Rate limit `/api/*` to 60 req/min/user via KV counter.
- `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.

(f) **Nice-to-have:**
- `/app/history` — list of past flights with actual vs scheduled (data accumulated from `events`).

### Data model deltas
`push_subs`. No new KV prefixes beyond `rl:*` added already.

### Acceptance criteria
- [ ] Lighthouse PWA score ≥ 90 on mobile.
- [ ] Install prompt appears on Android Chrome.
- [ ] Offline reload of `/app/flights` shows last cached list.
- [ ] Web push arrives on Chrome + iOS 16.4+ Safari within 10 s of a test event.
- [ ] `/about` lists all sources with required credits.
- [ ] CSP has no `unsafe-inline` for scripts.
- [ ] axe DevTools: zero WCAG AA issues on the key pages (`/`, `/login`, `/app/flights`, `/app/flights/new`, `/app/flights/[id]`, `/app/map`, `/app/settings`, `/about`).

### Risks
- **iOS push quirks.** Mitigation: feature-detect; show "Install app to receive push on iOS" copy.
- **Service worker breaking auth cookies.** Mitigation: never cache `/magic/*`, `/login*`, `/logout`.

### Open questions
- **Icon artwork**: AI-generated placeholder vs user-provided? Suggest placeholder then iterate.
- **Push payload language**: identical wording to Telegram, or shorter? Suggest shorter: title + one line, link into app.

---

## Section 4 — Running order & time budget

| Order | Phase | Rough agent exec time | Depends on | Unlocks |
|---|---|---|---|---|
| 1 | Phase 1 | 6–8 h | Phase 0 + user API keys | all downstream phases need flights |
| 2 | Phase 2 | 6–10 h | Phase 1 | voice answers that know positions, spotter near-match |
| 3 | Phase 3 | 10–14 h | Phase 1, Phase 2 cron infra | alert channel reused by 6, 7 |
| 4 | Phase 4 | 4–6 h | Phase 3 (voice helpers) | — |
| 5 | Phase 5 | 4–6 h | Phase 2 (R2) | — |
| 6 | Phase 6 | 3–5 h | Phase 3 | — |
| 7 | Phase 7 | 6–10 h | all | demo-ready |

Total: 40–60 agent-hours.

## Section 5 — Explicitly out of scope for v1

- Confidence percentages on delay predictions (Phase 2 v2 only).
- ATC audio of any kind.
- Native mobile wrap (Capacitor): PWA only.
- Custom domain.
- Public sign-up: invite-only forever in v1.
- Multiple currencies on the wire: GBP only.
- i18n: English only.
- Historical ADS-B archive import beyond 24 h of `positions_recent`.
- Kaggle v2 predictor training.
- A second map style (dark only).
- Granular per-user API-quota tracking (one shared pool is enough).

## Section 6 — Session hand-off protocol

New coding session, do these in order:

1. Read `IMPLEMENTATION_PLAN.md` (this file) top to bottom. It overrides any contradicting assumption.
2. Read `README.md` and note the phase status table — the first phase row not marked **done** is the active phase.
3. `git log --oneline -20` to see what the previous session landed.
4. Run `npm run check` and `npx wrangler d1 migrations list wmp-db --local` to confirm local state.
5. Open the active phase's acceptance-criteria checklist. The first unchecked item is the next task.
6. Only when all items in a phase are ticked, flip the phase row in `README.md` to **done** and commit `docs: close phase N`.
7. Open questions in a phase's "Open questions" section are the **only** moments to prompt the user. Prompt in a single message that lists all of that phase's questions with the recommended answer bolded; if the user does not reply within one turn, proceed with the recommendation.
8. At session end: write a one-line entry to the top of `README.md`'s status table and commit `docs: session handoff`.
