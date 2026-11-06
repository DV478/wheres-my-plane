# Where's My Plane

Personal flight-tracker companion with an always-on agent, voice I/O, photo-spotter OCR, and a global disruption map.

- **Product spec:** [WHERES_MY_PLANE.md](./WHERES_MY_PLANE.md)
- **First-time setup:** [SETUP.md](./SETUP.md)

## Stack

- **Frontend:** SvelteKit (Svelte 5) + MapLibre GL JS + deck.gl, deployed as a PWA on Cloudflare Pages.
- **Backend:** Cloudflare Workers (API, webhook, cron) + D1 (SQLite) + R2 (blobs) + KV (short-TTL cache).
- **Python workloads:** GitHub Actions (scrapers, bulk ingests, heavy OCR fallback), triggered from Workers via `workflow_dispatch` + HMAC callback.
- **Auth:** Email magic links via Resend. Invite-only (email allowlist in D1).
- **LLMs:** Gemini 2.0 Flash (free-tier Q&A) + OpenAI (`gpt-4o-mini` for agent/vision, Whisper STT, `tts-1` for voice notes).
- **Alerts:** Telegram bot (Phase 3), VAPID web push (Phase 7).

## Phased build

| Phase | What ships | Status |
|---|---|---|
| 0 | Skeleton: deploy, auth, D1 | **done** (local + deployable; keep-alive wired) |
| 1 | Add a flight → aircraft card | **done locally** (prod deploy pending; OTP copy tidy-up pending) |
| 2 | Global disruption map | next |
| 3 | Scheduled agent + Telegram alerts | - |
| 4 | Voice Q&A ("where's my plane?") | - |
| 5 | Photo spotter (OCR + story card) | - |
| 6 | Price monitoring | - |
| 7 | Harden + PWA (push, offline, attribution) | - |

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for per-phase detail, pending tidy-ups, and the session hand-off protocol.

## Local dev

```powershell
npm install
npm run dev
```

Needs `.dev.vars` populated — see [SETUP.md](./SETUP.md).

## Licence

Non-commercial, personal project. Data sources carry their own licences (OpenSky non-commercial; CAA attribution; Planespotters photographer credit required; adsb.lol ODbL attribution + share-alike).
