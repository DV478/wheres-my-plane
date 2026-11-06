# Phase 0 setup — first deploy

This gets you from an empty machine to a deployed `*.pages.dev` URL where you can log in via a magic link. Target time: **~30 minutes**, mostly waiting on signup confirmations.

## Prerequisites

- **Node.js 20 LTS** (`nvm use 20` if you have nvm; `.nvmrc` in the repo pins it).
- **A Cloudflare account** (free): [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
- **A Resend account** (free): [resend.com/signup](https://resend.com/signup)
- **A GitHub account** (you probably have this).
- **Git**.

## 1. Install dependencies

```powershell
npm install
```

## 2. Log into Cloudflare

```powershell
npx wrangler login
```

This opens a browser. Approve.

## 3. Create the D1 database

```powershell
npx wrangler d1 create wmp-db
```

Output looks like:

```
✅ Successfully created DB 'wmp-db' in region EEUR
Created your new D1 database.

[[d1_databases]]
binding = "DB"
database_name = "wmp-db"
database_id = "a1b2c3d4-..."
```

**Copy the `database_id`** and paste it into `wrangler.toml` where it says `REPLACE_WITH_D1_ID_AFTER_WRANGLER_D1_CREATE`.

## 4. Create the KV namespace

```powershell
npx wrangler kv namespace create CACHE
```

Output includes an `id = "..."`. **Copy it** into `wrangler.toml` where it says `REPLACE_WITH_KV_ID_AFTER_WRANGLER_KV_CREATE`.

## 5. Create the R2 bucket

```powershell
npx wrangler r2 bucket create wmp-blobs
```

No ID to paste — the bucket name is enough.

## 6. Apply the D1 migration

Local (for `vite dev`):

```powershell
npm run db:migrate:local
```

Remote (production):

```powershell
npm run db:migrate:remote
```

## 7. Set up Resend

- Go to [resend.com/api-keys](https://resend.com/api-keys) → **Create API Key** → copy it (starts with `re_`).
- Without a custom domain, you'll use Resend's shared sender address `onboarding@resend.dev`. It works. Emails will show "via resend.dev" in some clients.

## 8. Local secrets

Copy the template and fill in:

```powershell
Copy-Item .dev.vars.example .dev.vars
```

Edit `.dev.vars`:

| Key | Value |
|---|---|
| `RESEND_API_KEY` | from step 7 |
| `MAGIC_LINK_FROM` | `Where's My Plane <onboarding@resend.dev>` |
| `PUBLIC_BASE_URL` | `http://localhost:5173` (local) |
| `SESSION_SECRET` | run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste the output |

## 9. Add yourself to the invite list

In D1, locally:

```powershell
npm run db:console:local -- "INSERT INTO invites (email) VALUES ('your.email@example.com')"
```

Later, in production:

```powershell
npm run db:console:remote -- "INSERT INTO invites (email) VALUES ('your.email@example.com')"
```

## 10. Run locally

```powershell
npm run dev
```

Open http://localhost:5173, click **Sign in**, enter your email. The magic link arrives at your inbox (or if Resend fails, is printed to the Vite console). Click it → you land on `/app`.

## 11. Deploy

**First-time production secrets** (one-off; set each with `wrangler pages secret put`):

```powershell
npx wrangler pages secret put RESEND_API_KEY     --project-name wheres-my-plane
npx wrangler pages secret put MAGIC_LINK_FROM    --project-name wheres-my-plane
npx wrangler pages secret put PUBLIC_BASE_URL    --project-name wheres-my-plane
npx wrangler pages secret put SESSION_SECRET     --project-name wheres-my-plane
```

For `PUBLIC_BASE_URL` set `https://wheres-my-plane.pages.dev` (or whatever your project becomes).

Then deploy:

```powershell
npm run deploy
```

Your app is live at `https://wheres-my-plane.pages.dev`.

## 12. Wire up GitHub Actions (optional, do once)

1. Push this repo to GitHub.
2. Create a Cloudflare API token at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) with the **Edit Cloudflare Workers** template plus `D1:Edit` permission.
3. In the GitHub repo → **Settings → Secrets and variables → Actions**, add:
   - `CLOUDFLARE_API_TOKEN` (from step 2)
   - `CLOUDFLARE_ACCOUNT_ID` (shown in the Cloudflare dashboard sidebar)
4. Push to `main`. The `Deploy` workflow builds, applies D1 migrations, and deploys Pages.
5. The `Keep-alive` workflow auto-runs on the 1st and 15th of every month to prevent GitHub from pausing scheduled workflows after 60 days of inactivity.

## Done

Phase 0 is working when:

- [x] `npm run dev` serves the landing page at localhost.
- [x] Clicking **Sign in**, entering your allowlisted email, and clicking the magic link signs you in.
- [x] `/app` shows "Hello, your.email@..."
- [x] `npm run deploy` publishes to `*.pages.dev` and the same flow works there.

Next: Phase 1 — add a flight → aircraft card.
