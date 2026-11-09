# Supabase move, step 2: deploy to Cloudflare Workers (route B)

9 Nov 2026. Route B of `investigation.md` (section 8.4, row 2): a GitHub Actions workflow,
`.github/workflows/deploy-cloudflare.yml`, builds the app and deploys it to a Cloudflare Worker named **`joulz`**
on its **workers.dev address only**. joulz.uk is untouched: Lovable keeps serving it on Lovable Cloud until the
switchover (8.4 row 5). No app code, `.env`, `vite.config.ts` or `bun.lock` changed. This file holds no values.

## What the workflow does

| When | What |
|---|---|
| Every push to `main`; Actions → Deploy to Cloudflare → Run workflow (on `main`) | build, then `wrangler deploy` to `joulz.<subdomain>.workers.dev` |
| A same-repo PR labelled **`deploy-preview`** (and each push while the label is on) | build, then `wrangler versions upload --preview-alias pr-<n>`: a preview version at `pr-<n>-joulz.<subdomain>.workers.dev`, **not deployed** (production unchanged). It uses the Worker's own secrets; none are sent from a PR. Needs one production deploy first. |

Steps:

1. Checks the GitHub secrets exist (names only; required: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
   `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; optional, with a warning:
   `PRACTICE_SEAL_KEY`, `INTRO_DEMO_KEY`).
2. Installs with checks.yml's `bun.lock` registry rewrite, then restores the lockfile exactly.
3. `bun run build` (`vite build`, nitro's `cloudflare-module` preset, as Lovable builds it) with
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` from the secrets `SUPABASE_URL` /
   `SUPABASE_PUBLISHABLE_KEY` (and `VITE_SUPABASE_PROJECT_ID` from the URL's ref). Vite's `loadEnv` lets the
   process environment win over `.env`, so this build alone talks to the London project.
4. A guard fails the run if `.env`'s Lovable URL or publishable key is anywhere in `.output`, or the new URL is
   missing from the browser bundle.
5. A dry run writes the bundle size to the job summary.
6. `wrangler deploy --name joulz --compatibility-date 2026-10-15 --secrets-file <temp file>`: the code and the five
   runtime secrets (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PRACTICE_SEAL_KEY`,
   `INTRO_DEMO_KEY`) go up as **one version**, so there is no moment without secrets. The temp file is written by
   `jq` with `umask 077` and deleted in the same step; empty optional values are left out (the Worker keeps the one
   it has). Wrangler lists secrets as `(hidden)`. The summary gets the startup time and the workers.dev URL.

Pinned: Wrangler 4.153.0 (26 Oct 2026, past bunfig's 24 h guard), compatibility date 2026-10-15 (the newest that
Wrangler's local runtime accepts is 2026-10-30; nitro would otherwise write the build day). `nodejs_compat` comes
from nitro's generated `wrangler.json`; with a date after 2025-04-01 it fills `process.env` from the Worker's
secrets, which is how `client.server.ts` and `auth-middleware.ts` read them. No route, no custom domain: the
generated config has none, so Wrangler enables workers.dev only.

## Measured (9 Nov 2026, `main` at `e4526b6`, local build)

| | |
|---|---:|
| Build | ~1 min (CI: about 3–4 min with the install) |
| Worker modules | 468, 25,534 KiB |
| Total upload | **25,757 KiB, 5,293 KiB gzip**: inside the paid plan's 10 MB, over the free plan's 3 MB |
| Static assets | 997 files, 94 MB, largest 2.9 MB (limits: 25 MiB a file; 20,000 files free, 100,000 paid) |
| Startup (`wrangler check startup`, local workerd, 3 runs) | 388 / 438 / 421 ms profiled wall time, of which the Worker's own top-level JavaScript is 1–14 ms; the rest is the runtime loading the modules. Limit 1 s. The real figure is what Cloudflare reports on upload ("Worker Startup Time"), which the deploy step writes to the job summary. |

The heavy chunks (`generate.server` 8.6 MB, `puzzleBank.server` 4.4 MB, `dictionary.server` 1.0 MB) are loaded by
`import()` inside handlers, so the first request that needs one pays its parse, not startup.

## Joe's dashboard steps (before merging)

1. **Cloudflare: Workers Paid plan** (Workers & Pages → Plans; $5/month). The bundle doesn't fit the free plan.
2. **Cloudflare: a workers.dev subdomain.** Workers & Pages → Overview shows `<subdomain>.workers.dev`; on a new
   account, pick one there first. The app will be at `https://joulz.<subdomain>.workers.dev`.
3. **Cloudflare: an API token.** My Profile → API Tokens → Create Token → template **Edit Cloudflare Workers**,
   limited to this account (zone resources: none needed, no route is set). Copy the account ID from Workers &
   Pages → Overview (right-hand side).
4. **GitHub: repository secrets** (Settings → Secrets and variables → Actions → New repository secret):
   `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_URL` (the London project's `https://<ref>.supabase.co`),
   `SUPABASE_PUBLISHABLE_KEY` (its publishable or anon key), `SUPABASE_SERVICE_ROLE_KEY` (its service-role or
   `sb_secret_` key), `PRACTICE_SEAL_KEY` (the **same value** as on Lovable, if set there), `INTRO_DEMO_KEY`.
5. **GitHub: the `deploy-preview` label** (Issues → Labels), only if PR previews are wanted.

## Merging and the first deploy

- Merge after steps 1–4. If the PR merges first, the run on `main` fails at "Required secrets are set" and
  deploys nothing; add the secrets, then Actions → Deploy to Cloudflare → Run workflow.
- The first run creates the Worker `joulz` (about 4–6 minutes). Its summary shows the bundle size, the startup time
  and the URL. Every later push to `main` deploys again.
- On the workers.dev address the app signs each phone in anonymously on the **London** project (new device ids;
  nothing is shared with joulz.uk's Lovable Cloud rooms). Links the app hands out (share, challenge, room links)
  still point at **joulz.uk** (`APP_URL`), so open rooms by typing the code there, not by a shared link.
- Practice packs sealed by Lovable's key open only if `PRACTICE_SEAL_KEY` matches; on a fresh device none are kept.
- Intro demo saving stays off in production builds unless the Worker also has `INTRO_DEMO_SAVES=1` (security fix
  M7); not set by this workflow.

## Rollback

Nothing to roll back on joulz.uk: it is still Lovable's. To stop the Worker, delete it (Workers & Pages → joulz
→ Settings → Delete) or disable the workflow (Actions → Deploy to Cloudflare → ⋯ → Disable).
