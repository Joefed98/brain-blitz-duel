# Supabase move: runbook

Phase 1, step 1: set up the new database. Done on 9 Nov 2026 from a Claude Code cloud session, against `main` at
`b33ed8c`. Only the new Supabase project was touched. Nothing changed in the live app, in Lovable, in Lovable
Cloud's database or in any app code. This file contains no keys, passwords, tokens or project ref. The session read
them from `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD`, which are named here and never
shown.

The plan this follows is `docs/supabase-move/investigation.md`, section 8.1 (route A). The brief also named
`docs/road-to-launch`, but no such file is on `main` or on any other branch. If it exists outside the repo, check that
its step numbers match the "What's left" section below.

---

## 1. What was done

### 1.1 The project

| | |
|---|---|
| Name | `joulz` |
| Region | **eu-west-2 (London)**, confirmed through the Management API (`GET /v1/projects/{ref}`) |
| Status | `ACTIVE_HEALTHY`, created 8 Nov 2026 |
| Postgres | 17.11 (Lovable Cloud's PostgREST reports 14.17, the new project 14.18) |
| Extensions present | `plpgsql`, `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault` (Supabase defaults; the migrations create none) |

The Supabase CLI (3.0.0, the GitHub release binary, not installed in the repo) linked to the project
(`supabase link --project-ref …`, run in a scratch copy of `supabase/` so the repo's `supabase/.temp` stays
untouched).

### 1.2 Migrations: why not `supabase db push`

This container allows outbound HTTPS only. Postgres ports are refused: the direct host has no IPv4 address, and the
London pooler refused 5432. So `supabase db push` (which needs a Postgres connection) could not run here. The
migrations went through the **Management API's SQL endpoint** (`POST /v1/projects/{ref}/database/query`, HTTPS)
instead, which runs SQL as the `postgres` role, as `db push` does.

How each file was applied:

- one request per file, in file-name order;
- the file wrapped in `BEGIN; … COMMIT;` (no migration contains its own `BEGIN`, `COMMIT`, `VACUUM` or
  `CONCURRENTLY`);
- inside the same transaction, a row in `supabase_migrations.schema_migrations` (`version`, `name`, `statements`):
  the same history `db push` writes. A later `supabase db push` or `supabase migration list` from a machine with a
  Postgres connection should therefore see all 44 as applied. Not tested here, since it needs that connection. If a
  newer CLI expects extra history columns, it adds them itself.
- stop at the first error, and roll back.

**Result: all 44 files applied, no errors**, from `20260909175522_ce7046a0-…` to `20261108130000_async_attempt_colours`.
That includes the files that are probably unapplied on Lovable Cloud (`20261031150000_room_16_players`,
`20261107120000_room_code_digits`, the whole of `20261031170000_result_input_type`) and the new
`20261108130000_async_attempt_colours`. The history table holds 44 rows, the latest `20261108130000`. (The
investigation counted 43 files; `async_attempt_colours` was added after it.) Lovable's `drizzle/` copies were not run.

### 1.3 Auth settings (Management API, `PATCH /v1/projects/{ref}/config/auth`)

| Setting | Before | After |
|---|---|---|
| Anonymous sign-ins (`external_anonymous_users_enabled`) | off | **on** |
| Site URL | `http://localhost:3000` | **`https://joulz.uk`** |
| Redirect URLs (`uri_allow_list`) | empty | **`https://joulz.uk/**`, `https://www.joulz.uk/**`** |
| Sign-ups (`disable_signup`) | allowed | unchanged (anonymous sign-in needs sign-ups allowed) |
| CAPTCHA | off | unchanged |
| JWT expiry / refresh-token rotation | 3600 s / on | unchanged |

**Anonymous sign-in rate limit: 30 an hour per IP address** (`rate_limit_anonymous_users`, Supabase's default; left
unchanged). Each phone signs in once and then refreshes its token (refresh limit 150 per 5 minutes per IP, the
default), so 30 an hour only bites when many *new* devices share one address, such as a school or office network or
a mobile carrier's NAT at a launch event. Decision D6 is Joe's: raise it before a public launch, and consider
Turnstile, which needs a client change.

The API keys exist in both kinds: legacy `anon` / `service_role`, and the new `publishable` / `secret`. The generated
clients handle either (investigation section 2.3). No key was copied anywhere.

### 1.4 Later migrations

**From Wave 0 (9 Nov 2026), GitHub applies them**, by the same method, on every push to `main` before the
Cloudflare deploy: see `migrations-ci.md` (secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`). The table below
records the ones applied by hand before that.

Applied the same way as 1.2: one Management API request, the file in `BEGIN; … COMMIT;` with its row in
`supabase_migrations.schema_migrations`. The applier skips every version already recorded.

| Date | File | Result |
|---|---|---|
| 9 Nov 2026 | `20261109120000_submitted_round_max_rounds` | applied, no errors. `duel_players_submitted_round_range` is now `CHECK (submitted_round >= 0 AND submitted_round <= 12)`, the only check on the column. The column is unchanged: integer, NOT NULL, default 0. History: 45 rows, the latest `20261109120000`. No stored row changed; the table was empty. |
| 9 Nov 2026 | `20261109130000_room_presence` | applied, no errors. **`duel_presence`** exists: `duel_id`, `user_id`, `last_seen_at` (timestamptz, NOT NULL, default `now()`), primary key `(duel_id, user_id)`, and a foreign key to `duel_players (duel_id, user_id)` ON DELETE CASCADE. RLS is on with no policies; only `service_role` has privileges (`anon` and `authenticated` have none). It is **not** in `supabase_realtime`, which still holds exactly `duels`, `duel_players`, `round_results` and `room_messages`. **`disband_stale_room`** is replaced: it LEFT JOINs `duel_presence` and tests `greatest(p.last_seen_at, s.last_seen_at)`, the later of the two last-seen times; it stays SECURITY DEFINER and executable by `service_role` only. Behaviour test (four waiting rooms, rolled back afterwards): a stale host with no presence row is disbanded; fresh presence keeps the room; both stale disbands; a fresh `duel_players` time with stale presence keeps the room. A presence row for someone not in the room is refused by the foreign key; deleting the player deletes its presence row. History: 46 rows, the latest `20261109130000`. The test left no rows. |

---

## 2. Verification results

### 2.1 Generated types

`supabase gen types typescript` (public schema) from the new project, diffed against
`src/integrations/supabase/types.ts`:

```
13c13
<     PostgrestVersion: "14.17"
---
>     PostgrestVersion: "14.18"
```

That is the only difference: 1,190 lines on both sides, every table, column, type, relationship and function
identical. The line is metadata about the PostgREST server, not the schema. When Lovable regenerates `types.ts`
from the new project, expect exactly this one-line change.

### 2.2 Realtime publication

`supabase_realtime` holds exactly these four tables, each with `REPLICA IDENTITY FULL`:

| Table | Replica identity |
|---|---|
| `duels` | FULL |
| `duel_players` | FULL |
| `round_results` | FULL |
| `room_messages` | FULL |

Broadcast (room chat reactions, Apex ghost cars) needs no database setup. Realtime is on by default for the project.

### 2.3 Constraints (investigation section 4)

| Constraint | Definition on the new project | Expected |
|---|---|---|
| `duel_players_slot_range` | `player_slot >= 1 AND player_slot <= 16` | slots 1–16 ✓ |
| `duel_players_colour_range` | `colour IS NULL OR colour 0–31` | colours 0–31 ✓ |
| `share_events_room_code_check` | `room_code IS NULL OR room_code ~ '^[A-Z0-9]{4}$'` | digit room codes ✓ |
| `async_attempts_colour_range` | `colour IS NULL OR colour 0–31`; the old `async_attempts_colour_check` (0–9) is gone | colours 0–31 ✓ |
| `round_results_input_type_check`, `async_results_input_type_check`, `practice_plays_input_type_check` | `input_type IS NULL OR input_type ~ '^(touch\|mouse\|keyboard)(\+(mouse\|keyboard))*$'` | all three ✓ |
| `duels_scoring_mode_check` | `scoring_mode IN ('total','placings')` | ✓ |
| `challenges_code_check`, `share_events_challenge_code_check` | the challenge alphabet, 6 characters | ✓ |

### 2.4 Functions and the trigger

All 8 functions exist, are SECURITY DEFINER and are executable only by the roles below (`PUBLIC` and `anon` have no
EXECUTE on any of them):

| Function | Executable by | Body check |
|---|---|---|
| `is_duel_participant`, `my_duel_slot`, `async_board_open` | authenticated, service_role | |
| `duel_round_ended` | authenticated, service_role | the `20261013120000` fix: `_round >= 1`, and `in_progress` with phase `result` / `standings` / `winner_reveal` (no longer `reveal`) ✓ |
| `restart_duel_room` | service_role | the `20261031170000` body: the `round_results_archive` insert copies `input_type` ✓ |
| `disband_stale_room`, `take_rate_limit` | service_role | |
| `challenge_attempt_cap` | service_role (trigger function) | |

Trigger: `challenge_attempt_cap BEFORE INSERT ON public.async_attempts FOR EACH ROW` ✓ (the only one).

### 2.5 Tables, RLS and a live client test

- 23 tables in `public`, every one with RLS on; 11 policies (as in investigation section 3.2).
- One anonymous sign-in against the new project's Auth API with the publishable key: **200, `is_anonymous: true`**.
  As that user, reading `duels`, `intro_demos` and `unblock_bank` returned 200 with no rows (all empty);
  `async_rooms?select=*` was refused 403, as intended (only the window columns are granted); a client `INSERT` into
  `duels` was refused 403 (no grant). The test user was then deleted. `auth.users` is back to 0 rows, and every
  public table is empty.

### 2.6 Found while checking, since fixed

- **`duel_players_submitted_round_range` allowed only 0–7**, from `20261017140000_player_submitted_round`. Rooms have
  allowed up to 12 rounds since room settings (31 Oct 2026). `markSubmitted` (`src/lib/duel/finishedPing.server.ts`)
  is best effort, so in rounds 8–12 the write failed quietly and no "finished" pings showed. Submitting and grading
  were unaffected.
- **Fixed** by `20261109120000_submitted_round_max_rounds` (merged to `main` on 9 Nov 2026), which widens the check
  to 0–12. It is applied on the new project (section 1.4). On Lovable Cloud it is still to apply, which matters only
  until the switch.

### 2.7 Realtime refused on the workers.dev test (9 Nov 2026, fixed)

- **Symptom:** on joulz.playjoulz.workers.dev (room Z7XH) a phone missed the 3-2-1 countdown and chat arrived late;
  joulz.uk was smooth.
- **Cause:** the GitHub secret `SUPABASE_PUBLISHABLE_KEY`, which the deploy bakes into the browser build as
  `VITE_SUPABASE_PUBLISHABLE_KEY`, had stray whitespace (likely a trailing newline).
  - Browsers trim header values, so every REST call still worked (200).
  - In the Realtime WebSocket URL the whitespace became part of the key, so every connection was refused: 401
    `UNAUTHORIZED_INVALID_API_KEY`, 114 attempts in 11 minutes from both devices.
  - The phones fell back to the 8 s room poll, which can miss the whole 3 s countdown and delays chat.
  - Reproduced: the real key plus a newline, space, CRLF or quote gives REST 200 and WebSocket 401.
- **The project was not at fault.** Realtime settings are the defaults with public channels. An end-to-end test with
  two anonymous players subscribed as `useDuel` / `useRoomChat` received every change in about 0.25–0.5 s and
  broadcasts in about 30 ms.
- **Fix:** Joe re-saved the secret with no whitespace and re-ran the deploy. In the re-test (room 62AM) each device
  opened one connection (101) and the polling stopped.
- **Safeguard:** the deploy workflow will reject secrets containing whitespace (its own PR). Until then, paste keys
  straight from the Supabase dashboard into GitHub's box, with nothing after them.
- **How to spot it again:** the project logs (Management API `analytics/endpoints/logs`, table `logs`) show
  `/realtime/v1/websocket` with status 401 and `sb_error_code` `UNAUTHORIZED_INVALID_API_KEY`.

---

## 3. Carrying over `unblock_bank` (400 rows) and `intro_demos` (29 rows)

Do this when the switch is near. `intro_demos` changes whenever a demo is recorded, so re-run the export if one is
recorded after you copy it (investigation 8.2 step 2). **Done on 9 Nov 2026: see 3.6 for the load and its
verification.** Sections 3.1–3.5 stay as the procedure for a re-load.

Columns, identical on both sides (same migrations; check with query 3.1 first):

- `unblock_bank`: `id` integer (serial, `unblock_bank_id_seq`), `layout` text, `min_moves` integer, `solution` text,
  `last_used_at` timestamptz **nullable**, `created_at` timestamptz.
- `intro_demos`: `game_type` text (primary key), `seed` bigint, `puzzle` jsonb, `input_log` jsonb, `start_tick`
  integer, `length_ticks` integer, `recorded_at` timestamptz, `example_id` text **nullable**.

### 3.1 On Lovable (source): check the columns and take the fingerprint

In Lovable's Cloud SQL view (read-only queries only), run:

```sql
SELECT table_name, string_agg(column_name || ':' || data_type, ', ' ORDER BY ordinal_position) AS cols
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('unblock_bank', 'intro_demos')
GROUP BY 1;
```

It should list exactly the columns above, in that order. If it doesn't, stop and tell Claude.

Then run the **fingerprint query** below and write down the four values (two counts, two md5s):

```sql
SELECT 'unblock_bank' AS t, count(*) AS n,
  md5(string_agg(concat_ws('|', id, layout, min_moves, solution,
      coalesce((last_used_at AT TIME ZONE 'UTC')::text, '<null>'),
      (created_at AT TIME ZONE 'UTC')::text), E'\n' ORDER BY id)) AS md5
FROM public.unblock_bank
UNION ALL
SELECT 'intro_demos', count(*),
  md5(string_agg(concat_ws('|', game_type, seed, puzzle::text, input_log::text, start_tick, length_ticks,
      (recorded_at AT TIME ZONE 'UTC')::text, coalesce(example_id, '<null>')), E'\n' ORDER BY game_type))
FROM public.intro_demos;
```

It names every column explicitly, so column order cannot change the hash. It writes times in UTC, so the session's
time zone doesn't matter either. NULL and empty text hash differently, so an import that turns NULLs into `''` (or
the reverse) shows up. jsonb's text form is canonical, so the same JSON hashes the same on both sides.

Expected: `unblock_bank` 400, `intro_demos` 29.

Also note, for the NULL check after the import:

```sql
SELECT (SELECT count(*) FROM public.unblock_bank WHERE last_used_at IS NULL) AS bank_never_used,
       (SELECT count(*) FROM public.intro_demos WHERE example_id IS NULL) AS demos_no_example,
       (SELECT count(*) FROM public.intro_demos WHERE example_id = '') AS demos_empty_example,
       (SELECT max(id) FROM public.unblock_bank) AS bank_max_id;
```

### 3.2 On Lovable: export the two CSVs

For each table, in Lovable's Cloud SQL view:

1. Run the export query, with every column in the table's own order:
   - `SELECT id, layout, min_moves, solution, last_used_at, created_at FROM public.unblock_bank ORDER BY id;`
   - `SELECT game_type, seed, puzzle, input_log, start_tick, length_ticks, recorded_at, example_id FROM public.intro_demos ORDER BY game_type;`
2. Check the result shows every row (400 and 29). If the view pages or caps the results, raise the limit or export
   in pages (`… WHERE id BETWEEN 1 AND 200`, then `201 AND 400`) and import each page.
3. Use **Export CSV**. Save as `unblock_bank.csv` and `intro_demos.csv`. Don't open and re-save them in Excel or
   Numbers: they rewrite quotes, dates and long numbers. A text editor is fine for a look.
4. Look at the files: the first line must be the header, with exactly the column names above. JSON cells must be
   double-quoted, with inner quotes doubled (`"{""a"":1}"`). A NULL should be an empty cell. If a NULL comes out as
   the word `null` or `NULL`, note that; step 3.4 handles it.

Ask Lovable's Cloud tab for its own Export instead only if the SQL view has no CSV export.

### 3.3 On Supabase: import

In the Supabase dashboard for the London project → **Table Editor**:

1. Select `unblock_bank` → **Insert** → **Import data from CSV** → choose `unblock_bank.csv`.
2. In the preview, check that every column is matched to its same-named column, **including `id`**. Keep `id`: the
   ids are carried over exactly. Don't let the importer skip it or generate new ids. Do the same for `created_at`
   and `last_used_at`: keep them, don't let them default to `now()`.
3. Import. The editor should report 400 rows.
4. Repeat for `intro_demos` with `intro_demos.csv` (29 rows). `game_type` is the primary key, so a second import of
   the same file fails on duplicates rather than doubling the rows. `puzzle` and `input_log` must be matched to the
   jsonb columns.

If the importer refuses a file (large JSON cells, quoting), stop there, don't edit the CSV by hand, and pass it to
Claude. A session with Management API access can load the same file exactly and run the same checks.

### 3.4 On Supabase: reset the sequence and fix NULLs (SQL Editor)

```sql
-- The next Gridlock board inserted gets max(id) + 1, as on Lovable.
SELECT setval('public.unblock_bank_id_seq', (SELECT max(id) FROM public.unblock_bank));
```

Run the NULL check from 3.1 on Supabase. If its counts differ from Lovable's because the importer wrote `''` where
Lovable has NULL in `example_id` (and Lovable's `demos_empty_example` was 0), put the NULLs back:

```sql
UPDATE public.intro_demos SET example_id = NULL WHERE example_id = '';
```

(`last_used_at` is a timestamp, so it can't come in as `''`. If the import failed on that column, the CSV had
`null` text. Pass the file to Claude, as above.)

### 3.5 Confirm the match

Run the same **fingerprint query** from 3.1 in Supabase's SQL Editor. The two counts and two md5s must equal
Lovable's exactly. Also run:

```sql
SELECT last_value, is_called FROM public.unblock_bank_id_seq;   -- last_value = bank_max_id, is_called = true
```

If an md5 differs, find the row:

```sql
SELECT id, md5(concat_ws('|', id, layout, min_moves, solution,
  coalesce((last_used_at AT TIME ZONE 'UTC')::text, '<null>'), (created_at AT TIME ZONE 'UTC')::text))
FROM public.unblock_bank ORDER BY id;
SELECT game_type, md5(concat_ws('|', game_type, seed, puzzle::text, input_log::text, start_tick, length_ticks,
  (recorded_at AT TIME ZONE 'UTC')::text, coalesce(example_id, '<null>')))
FROM public.intro_demos ORDER BY game_type;
```

Run these on both sides and compare the lists. Then delete the bad rows on Supabase and re-import only those.

### 3.6 Done: the load of 9 Nov 2026 (move step 4)

Joe ran 3.1 on Lovable and exported both tables to CSV. The files sat in `move-data/` on the `move-data` branch,
which is not merged and was not copied anywhere else. The Supabase table editor was not used. The rows went in through
the Management API's SQL endpoint, so the import couldn't change any value.

**The export's shape.** `;` as the separator, quotes only where needed (doubled inside), LF line ends, one header
row, and the **columns in alphabetical order**: `created_at;id;last_used_at;layout;min_moves;solution` and
`example_id;game_type;input_log;length_ticks;puzzle;recorded_at;seed;start_tick`. A NULL is an empty, unquoted cell.
Neither file has a quoted empty cell (`""`), so every empty cell is a NULL. The column checks:

- `unblock_bank`: 400 rows, ids exactly 1–400, no empty cell in any column;
- `intro_demos`: 29 rows, 29 distinct `game_type`s, every `puzzle` and `input_log` valid JSON, `example_id` empty in 27.

Both match Lovable's NULL check before the load.

**How it was loaded.** The CSVs were parsed by column *name* with Python's `csv` module (`delimiter=';'`). One
transaction inserted every row with an explicit column list, which keeps every value exactly:

- `id`, `min_moves`, `seed`, `start_tick` and `length_ticks` as integers;
- text quoted as SQL literals;
- the timestamps as the exported text cast to `timestamptz`;
- `puzzle` and `input_log` cast to `jsonb`;
- an empty cell as `NULL`, never `''`.

The same transaction ran `setval('public.unblock_bank_id_seq', (SELECT max(id) FROM public.unblock_bank))`. Both
tables were checked empty first.

**Verification** (3.1's queries on the new project, against Lovable's values): every value matched on the first
load, so no row needed the per-row query or a fix.

| Check | Lovable | New project |
|---|---|---|
| `unblock_bank` rows / md5 | 400 / `b43e4622a9bfdfde20c16d030d66d05d` | 400 / `b43e4622a9bfdfde20c16d030d66d05d` ✓ |
| `intro_demos` rows / md5 | 29 / `262af845d4e7117dc2299e665ba979e2` | 29 / `262af845d4e7117dc2299e665ba979e2` ✓ |
| `bank_never_used` | 0 | 0 ✓ |
| `demos_no_example` | 27 | 27 ✓ |
| `demos_empty_example` | 0 | 0 ✓ |
| `bank_max_id` | 400 | 400 ✓ |
| `unblock_bank_id_seq` last_value / is_called | 400 / true | 400 / true ✓ |

**Before the switchover.** Live rooms keep stamping `unblock_bank.last_used_at` on Lovable as Gridlock boards are
drawn, and new intro demos may be recorded there. If the exact pool matters on the night, re-run 3.1 on Lovable and
compare the md5s with the table above. If they differ, empty both tables here
(`TRUNCATE public.unblock_bank, public.intro_demos;`) and load a fresh export the same way. With no players, a slightly
older `last_used_at` only changes which boards are drawn first.

---

## 4. What's left

Step numbers are investigation section 8.1's (route A). This runbook covers its steps 3 and 4.

| Step | What | Who | State |
|---|---|---|---|
| 1 | D1–D3 questions to Lovable support (server functions get the outside project's keys? can Remove Cloud be undone? can a remix rehearse it?). Agree who holds the branch while Lovable rewrites `.env` and `src/integrations/supabase/`. | Joe | open |
| 2 | On Lovable Cloud: run the row counts (investigation 3.6) and the live-state SQL (investigation section 4); keep an archive export of everything. | Joe | open |
| 3 | **Set up the new database.** | Claude | **done (this runbook)** |
| 4 | Carry over `unblock_bank` and `intro_demos` (section 3 here), and confirm the md5s match. | Joe (export), Claude (load) | **done (section 3.6)** |
| 5 | Rehearsal on a Lovable remix pointed at the new project: set `SUPABASE_SERVICE_ROLE_KEY` (or the `sb_secret_` key), `INTRO_DEMO_KEY` and `PRACTICE_SEAL_KEY` (the same value as live, if set); then a 2-phone room, practice, a daily, a challenge, chat and Play again. | Joe (phones); Claude for a checklist | open |
| 6 | Switchover evening (investigation 8.2), with the rollback stance decided first (8.3). | Joe | **done**: joulz.uk runs on Cloudflare Workers and this project (route B) |
| 7 | Follow-up PR: `supabase/config.toml`'s `project_id`, the docs that name the old project, the "written but not applied" notes (CLAUDE.md, `docs/beta-sql.md`), (the `submitted_round` range is done: 2.6). | Claude | **done** (post-move tidy-up PR) |

Route B, step 2 (investigation 8.4 row 2): the Cloudflare deploy workflow, `.github/workflows/deploy-cloudflare.yml`,
deploys `main` to the Worker `joulz` on workers.dev only (no joulz.uk route). Setup, measurements and Joe's dashboard steps:
`docs/supabase-move/cloudflare-deploy.md`.

Decisions still open for Joe (investigation 8.5): D1 (blocks route A), D2, D3, D4 (only the two tables is the plan
here), D5 (`PRACTICE_SEAL_KEY` value), D6 (PITR; the 30-an-hour anonymous limit and Turnstile, section 1.3), D7
(rooms of 16 and digit codes go live with the new schema: they are applied here).

Notes for whoever picks this up:

- **Don't re-run the migrations on this project.** They are applied and recorded. A schema change from now on is a
  new migration file; GitHub applies it here on merge to `main` (`migrations-ci.md`).
- **Postgres from a cloud session.** This container could reach the database only over the Management API. A machine
  with IPv6 or a working pooler connection can use `supabase db push` / `psql` normally, with the database password.
- No check, workflow or app file changed; no browser tests were run.
