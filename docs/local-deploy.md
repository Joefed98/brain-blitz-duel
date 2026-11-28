# Local production deploy (draft, 27 Nov 2026)

**Status: a draft.** Nothing here is approved to run against production yet. It exists only while GitHub Actions
is locked (an unpaid Actions bill from when the repo was private). Once Actions runs again, the
**Deploy to Cloudflare** workflow is the only deploy route again.

`scripts/deploy-local.sh` mirrors the production job of `.github/workflows/deploy-cloudflare.yml`, step for step,
on Joe's own computer. It stops at the first failure. It touches the London database only after every local step
has passed, and it deploys only after the migrations succeed.

## What it needs (six values)

| Name | What it is | Where to find it |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | a Cloudflare API token that can deploy the Worker | Cloudflare → My Profile → API Tokens → Create Token |
| `CLOUDFLARE_ACCOUNT_ID` | the account that owns the Worker `joulz` | Cloudflare → Workers & Pages → Account details (or the id in the dashboard URL, dash.cloudflare.com/<id>/) |
| `SUPABASE_URL` | `https://<ref>.supabase.co` of the London project | Supabase → the London project → Project Settings → Data API → Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | the publishable key (`sb_publishable_…`), baked into the browser bundle | Project Settings → API Keys → Publishable key |
| `SUPABASE_PROJECT_REF` | the project's id (the `<ref>` in the URL) | Project Settings → General → Project ID |
| `SUPABASE_ACCESS_TOKEN` | a personal access token for the Management API (`sbp_…`), used only by the migrations | Supabase → your avatar → Account preferences → Access Tokens → Generate new token |

The two Supabase app values must be exactly the ones in the GitHub secrets `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY`. GitHub never shows secrets again, so copy them from the dashboard.

**Not needed:** `SUPABASE_SERVICE_ROLE_KEY`, `PRACTICE_SEAL_KEY`, `INTRO_DEMO_KEY`, `TURNSTILE_SECRET_KEY`,
`VAPID_PRIVATE_KEY` and `FEEDBACK_HMAC_KEY`. These are the Worker's own secrets. The CI job re-sends them with every
deploy (`--secrets-file`), but `wrangler deploy` without `--secrets-file` keeps the secrets the Worker already has: a
new version inherits them. The CI job relies on the same inheritance: an optional secret left empty is left out of
its file and "the Worker keeps its existing one". To be safe, the script lists the Worker's secret names before
deploying. It refuses to deploy if `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`PRACTICE_SEAL_KEY` or `INTRO_DEMO_KEY` is missing. After deploying it lists the names again and fails loudly if any
has gone. The script only ever prints names, never values.

### The secrets file

A plain text file **outside the repo**, at a path Joe chooses, one `NAME=value` per line, with no quotes, spaces or
`export`:

```
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_PROJECT_REF=xxxxxxxxxxxxxxxxxxxx
SUPABASE_ACCESS_TOKEN=sbp_...
```

Make it readable by you alone: `chmod 600 <file>`. The script refuses a file that is readable by anyone else, one
inside the repo, a name it doesn't know, or a value with quotes or stray spaces or line breaks. It reads the file
and never runs it.

## One-time setup

### Cloudflare token

Cloudflare → My Profile → API Tokens → **Create Token** → the **Edit Cloudflare Workers** template.

- **Account resources:** Include → your account only.
- **Zone resources:** Include → the joulz.uk zone only. The template asks for a zone, but this deploy changes no
  routes.
- **Expiry:** optionally a TTL of a month or so, since this is a stop-gap.
- Copy the token once into the secrets file.

The template's permissions are what the deploy uses: Workers Scripts (Edit) for the upload, the Cron Triggers and
observability, plus Account Settings and Memberships (Read). Joe can narrow the token later. A token that can't list
the Worker's secrets makes the script stop before deploying.

### macOS

1. Install Homebrew if it isn't there (brew.sh).
2. `brew install git node@22 postgresql@16`. Don't start PostgreSQL; the script runs its own throwaway copy.
3. `brew link --overwrite node@22`, so `node --version` prints `v22…`.
4. bun **1.4.2** exactly (CI's version): `curl -fsSL https://bun.sh/install | bash -s "bun-v1.4.2"`, then open a new
   Terminal window. `bun --version` must print `1.4.2`.
5. `git clone https://github.com/Joefed98/brain-blitz-duel.git ~/joulz` (or use an existing clean clone).
6. Make the secrets file, for example `~/.joulz/deploy.env`, then `chmod 600 ~/.joulz/deploy.env`.

The script finds Homebrew's PostgreSQL by itself (`/opt/homebrew/opt/postgresql@16/bin`). For any other location,
set `JOULZ_PG_BIN=/path/to/postgres/bin`.

### Windows (through WSL2 Ubuntu)

The script is bash, and the migration proof uses the Linux PostgreSQL layout, so on Windows it runs inside WSL2.

1. In PowerShell as administrator: `wsl --install -d Ubuntu-24.04`. Restart, then set a Linux user name and password.
2. In the Ubuntu window:
   `sudo apt update && sudo apt install -y git curl unzip postgresql`. Ubuntu 24.04's PostgreSQL 16 lands in
   `/usr/lib/postgresql/16/bin`, where the script looks. Then `sudo systemctl disable --now postgresql`, since the
   script runs its own copy.
3. Node 22: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs`.
4. bun 1.4.2: `curl -fsSL https://bun.sh/install | bash -s "bun-v1.4.2"`, then `exec bash`, then
   `bun --version` must print `1.4.2`.
5. Clone inside Linux's own disk, not under `/mnt/c`, which is slow:
   `git clone https://github.com/Joefed98/brain-blitz-duel.git ~/joulz`.
6. Make the secrets file in Linux, for example `~/.joulz/deploy.env`, then `chmod 600 ~/.joulz/deploy.env`.

### First time: a rehearsal

```
cd ~/joulz && git checkout main && git pull --ff-only
bash scripts/deploy-local.sh ~/.joulz/deploy.env --rehearse
```

This runs everything except the two production steps. It does the live migration dry run (it lists what *would*
be applied, nothing is applied) and lists the Worker's secret names. It ends with "Rehearsal passed … Nothing was
applied to the database and nothing was deployed." It takes about 3–5 minutes.

## Each time (after the captain says main is ready)

```
cd ~/joulz && git checkout main && git pull --ff-only
bash scripts/deploy-local.sh ~/.joulz/deploy.env
```

It stops to show the migrations it will apply, then asks you to **type DEPLOY**. Anything else stops it with nothing
changed.

**Success looks like this:**

- `Applied N` or `Nothing pending.` under the live migrations step.
- The deploy lines (`Total Upload`, `Worker Startup Time`, `Current Version ID`) and the four `schedule:` lines:
  `*/5 * * * *`, `41 * * * *`, `23 * * * *` and `37 4 * * *`.
- "The Worker still has its secrets".
- Finally "Deployed <commit>.".

Then open https://joulz.uk and send the captain the printed lines.

**If it fails:**

- **Before the live migrations step:** nothing changed anywhere.
- **At the migrations:** the failing file rolled back, files before it stay applied, and the Worker was **not**
  deployed.
- **At the deploy:** the migrations are applied, but the Worker still runs the version it had.

## Rolling back

Cloudflare → Workers & Pages → **joulz** → **Deployments** → the previous version → **⋯** → **Rollback**. Or
`npx wrangler@4.153.0 rollback --name joulz` with the two Cloudflare values in the environment.

A rollback changes only the Worker. Migrations are never rolled back; a migration fix is a new file, as always.

## Step table (the workflow's production job → this script)

| Workflow step | Script | Notes |
| --- | --- | --- |
| checkout | "The checkout is main, clean and up to date" | Refuses anything but a clean `main` equal to `origin/main`. |
| setup-bun 1.4.2, setup-node 22 | "Tools" | Exact bun 1.4.2 and node 22.x, or it stops. |
| bun cache | — | Not needed on a computer (bun keeps its own cache). |
| Required secrets are set | "Required secrets are set" | The same checks: present, no stray whitespace or newline, URL shape, the ref matches the URL. Six values instead of eleven: the Worker's own secrets aren't sent (see above). |
| Install dependencies | "Install dependencies" | The same registry rewrite (done with node, so it works with macOS sed), `bun install --frozen-lockfile`, bun.lock restored and diffed; also restored if anything fails. |
| Migrations apply to a fresh local PostgreSQL | same | `bun scripts/migrate.ts --local`; `JOULZ_PG_BIN` for Homebrew. |
| Build | "Build" | Same three `VITE_*` values, same output files tested. |
| Workers Logs kept on | same | The same four flags, read with node instead of jq. |
| The build talks to the new project only | "…the London project only" | Same. |
| Publishable key exact | same | The same script. |
| Bundle size (dry run) | same | Same wrangler, name and date. |
| — | "Migrations … (dry run)" | **Added:** shows what will be applied before anything is. |
| — | "The Worker's existing secrets" | **Added:** names only; refuses if a required one is missing. |
| — | "Type DEPLOY" | **Added:** one confirmation before production. |
| Apply database migrations | same | `bun scripts/migrate.ts --live`, same three values. |
| Deploy to workers.dev | "Deploy to the Worker" | The same wrangler 4.153.0, `--name joulz`, `--compatibility-date 2026-10-15`; message `<sha> (local)`; **no `--secrets-file`**. |
| — | "The Worker still has its secrets" | **Added:** names before and after. |
| Upload preview version | — | Left out: PR previews only, never production. |
| Step summaries (`$GITHUB_STEP_SUMMARY`) | printed lines | No GitHub run to write to. |
| concurrency: one production deploy at a time | — | Joe runs it by hand, one at a time. If Actions comes back, a push to `main` deploys from CI too: don't run both for the same commit. |
