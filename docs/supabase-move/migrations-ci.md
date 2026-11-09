# Database migrations from GitHub

Wave 0, 9 Nov 2026. The app runs on Cloudflare (`.github/workflows/deploy-cloudflare.yml`) with Joe's own Supabase
project in London. Until now migrations were applied by hand from a Claude Code session (`runbook.md` 1.2 and 1.4).
From this change, GitHub applies them, using the same method.

The code is `scripts/migrate-lib.ts` (the applier and the guard) and `scripts/migrate.ts` (the command line). The
check is `scripts/migrations-check.ts`.

## What runs where

| When | What | Touches the live database? |
|---|---|---|
| Every pull request (Checks → **migrations (guard + local PostgreSQL)**) | 1. The guard reads the PR's new migration files. A changed or deleted merged file fails the job. 2. Every file is applied to a fresh local PostgreSQL with the live wrapper, then run again to show nothing is left pending. | No (no secrets) |
| Every pull request (Checks shard `e`) | `migrations-check`: the guard's cases, stop-on-error and rollback, refusals, and `--live` against a stand-in API | No |
| Every push to `main` (Deploy to Cloudflare) | 1. All migrations on a fresh local PostgreSQL (before the build). 2. The build and its checks. 3. **Apply database migrations (London project)**. 4. `wrangler deploy`. | Yes, at step 3 only |
| A PR labelled `deploy-preview` | Build and preview upload only | No |

A refused or failing migration fails step 3. `wrangler deploy` then doesn't run, so the old app keeps running on the
old schema. Step 1 runs on `main` as well as on PRs because Lovable can push migrations straight to `main`, which
skips the PR checks.

## How a file is applied

This is `runbook.md` 1.2's method:

- The applier reads `supabase_migrations.schema_migrations` on the London project through the Management API
  (`POST /v1/projects/{ref}/database/query`, HTTPS, run as `postgres`).
- Every file in `supabase/migrations` whose version (the digits before the first `_`) isn't recorded there is
  pending. Pending files are applied in file-name order.
- Each file is one request:

  ```sql
  BEGIN;
  INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES (…);
  <the file>
  ;
  COMMIT;
  ```

- The history row goes first. A version that is already recorded (say, from a second deploy racing this one) fails
  before any of the file's SQL runs. Production deploys also queue one at a time.
- If a file fails, its transaction rolls back along with its history row, and later files are not tried. The run
  summary names the file and gives the database's error.
- Before anything is applied, every pending file is checked:
  - **The destructive guard.** It refuses `DROP TABLE`, `DROP COLUMN` (`ALTER TABLE … DROP [COLUMN] x`), `TRUNCATE`,
    and `DELETE` or `UPDATE` with no `WHERE`. It reads top-level statements and `DO` blocks. It ignores comments,
    strings and function bodies, because a function's body runs later, not when the file is applied. It also ignores
    `ON DELETE CASCADE`, `DROP CONSTRAINT`, `ALTER COLUMN … DROP DEFAULT`, `ALTER PUBLICATION … DROP TABLE` and
    similar statements, which change no data.
  - **Transaction control.** A file with its own `BEGIN`, `COMMIT`, `VACUUM`, `CONCURRENTLY` and the like can't go
    inside the wrapper, so it is refused.
  - If any file is refused, **none** is applied.
- A pending file older than the newest recorded version (for example, a branch merged late) is still applied, in file
  order, with a warning.

### Approving a destructive migration

Put this line on a line of its own anywhere in the file:

```sql
-- destructive: approved by Joe
```

The repository's three historical destructive files (`20260909205823`, `20261003000000`, `20261003234626`) don't
have this line. They were applied long ago, so the guard never sees them on the London project. If the history were
ever empty, the guard would refuse them; `migrations-check` proves that. The local from-scratch proof doesn't run the
guard, since it applies the whole history.

### When a migration fails on main

The deploy stops and nothing is recorded for that file. Fix it in a new PR:

- **Either** add a new, later file and leave the failed one as it is. This only works if the failed file can now
  succeed, so usually it can't.
- **Or** edit the failed file itself and add this line:

  ```sql
  -- edited: not applied live, approved by Joe
  ```

  The PR guard refuses any other change to a merged file, because a recorded file is never re-run, so an edit would
  silently do nothing. Check the deploy summary first to be sure the file really wasn't applied.

After the merge, the next push to `main` applies it. To retry without a new commit, use Actions → Deploy to
Cloudflare → Run workflow on `main`.

### Notices and warnings

Every notice and warning a file raises is printed under it in the job log, as `WARNING from <file>: <message>`
or `NOTICE from <file>: <message>`. Warnings are also listed in the run summary. On the live run (the deploy) each
warning is a GitHub annotation on the run as well; the local proof only prints them, since its database is a
fresh one and not London's (#344's "pg_cron is not available" warning shows there on every run).

- **Local** (PRs, and `main` before the build): psql reports every `RAISE NOTICE` and `RAISE WARNING`, plus
  PostgreSQL's own notices ("… already exists, skipping"), with their DETAIL and HINT lines. A failing file's
  warnings are printed before its FAILED line.
- **Live** (the London project): the Management API's query endpoint returns rows only. A plain `RAISE` never
  reaches it, so it can't show in the deploy log. (Supabase's SQL editor uses the same endpoint and doesn't show
  them either. I couldn't test the endpoint from the session, because `api.supabase.com` is blocked there.)
  A migration that wants a message in the deploy log calls the helper from
  `20261109150000_migration_log.sql` at the same level:

  ```sql
  SELECT migration_log.note('warning', 'kept 3 rows with no owner');
  -- inside DO or plpgsql:
  PERFORM migration_log.note('notice', format('%s rows moved', n));
  ```

  It raises the message as `RAISE` would, so the local run shows it the same way. It also keeps a row in
  `migration_log.notes`. After each file the live run reads back the rows written since the file started and
  prints them. The rows of a failed file roll back with it, so live shows only the database's error for a
  failed file. Reading the notes never fails a deploy: the file is already committed, so a failed read is a
  warning. The `migration_log` schema isn't in PostgREST's list. Every right on it, its table, its sequence and `note()`
  is revoked explicitly from PUBLIC, `anon` and `authenticated`, and nothing is granted to them, so only the owner can
  use it. `migrations-check` 3a proves it after the whole history, and again with default privileges that would
  grant everything.

  **Rule:** to show a warning or notice in the live deploy log, a migration must call
  `migration_log.note('warning'|'notice', '...')`, never a plain `RAISE`.

Nothing changes in how a file is applied: the same wrapper and SQL, one transaction a file. `migrations-check`
section 5 proves it. A test migration's `RAISE WARNING` and `RAISE NOTICE` appear in `migrate.ts --local`'s output.
A failing file's warning comes before FAILED. `migrate.ts --live`, against a stand-in that drops notices as the
API does, prints `migration_log.note`'s warning and notice under the right file, with the annotation and the
summary line.

## Secrets Joe must add

Add both of these **before merging this PR**. Without them, every push to `main` fails at "Required secrets are set"
and deploys nothing. If you merge first, add them and then use Actions → Deploy to Cloudflare → Run workflow.

In GitHub: **Settings → Secrets and variables → Actions → New repository secret**. Paste each value straight from
Supabase, with no spaces or line breaks before or after it. The workflow rejects stray whitespace.

| Secret | What it is | Where to get it |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | A Supabase **personal access token** (starts `sbp_`). The Management API uses it to run SQL as `postgres`. | Supabase dashboard → your avatar → **Account preferences → Access Tokens** (supabase.com/dashboard/account/tokens) → **Generate new token** |
| `SUPABASE_PROJECT_REF` | The London project's reference ID, 20 lower-case letters and digits | Project → **Project Settings → General → Project ID**. It's also the subdomain in `SUPABASE_URL` (`https://<ref>.supabase.co`). |

Step by step:

1. Sign in to supabase.com as the account that owns the `joulz` project.
2. Open **Account preferences → Access Tokens** and choose **Generate new token**.
   - Name it `github-actions-migrations`.
   - If the form offers an expiry, pick the longest one and put a reminder in your calendar a week before it
     ends. An expired token stops deploys at the migration step with "the access token was refused".
   - If the form offers scoping to one organisation or project, limit it to the `joulz` project.
3. Copy the token. Supabase shows it only once.
4. In GitHub, add the secret `SUPABASE_ACCESS_TOKEN` and paste the token as its value.
5. In Supabase, open the `joulz` project → **Project Settings → General**, and copy **Project ID**.
6. In GitHub, add the secret `SUPABASE_PROJECT_REF` with that value. The workflow checks it against `SUPABASE_URL`
   and refuses to run if they name different projects.
7. Optional test: Actions → Deploy to Cloudflare → Run workflow on `main`. The summary's "Database migrations (live)"
   section should say "Nothing pending." (all 46 files were applied by hand, `runbook.md` 1.4).

About the token:

- A personal access token acts as your Supabase account on every project that account can reach, not only `joulz`,
  and it can run any SQL. Treat it like the service-role key.
- I can't confirm that Supabase offers access tokens limited to one project. If yours doesn't, the safer setup is a
  separate Supabase account that is a member of only the `joulz` organisation, with the token made on that account.
- GitHub never passes repository secrets to pull requests from forks.
- In this workflow, the token is read only by the "Apply database migrations" step, which runs only on `main`. The
  code never prints it (`migrations-check` proves this), and GitHub masks it in logs.
- To revoke the token: Access Tokens → the token → Revoke. Deploys then stop at the migration step until a new token
  is saved.

`SUPABASE_DB_PASSWORD`, which the hand-applied runbook session had, is **not** needed. The Management API works over
HTTPS with the token alone.

## Running it by hand

```bash
bun scripts/migrate.ts --local
```

```bash
bun scripts/migrate.ts --pr-guard=origin/main
```

```bash
SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_REF=… bun scripts/migrate.ts --live --dry-run
```

`--dry-run` reads the history and lists what it would apply, without applying anything.
