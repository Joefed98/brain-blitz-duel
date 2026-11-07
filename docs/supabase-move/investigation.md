# Supabase move, step 1: investigation

Read-only investigation, 7 Nov 2026, against `main` at `34272737`. Nothing in the code, database, settings or
hosting was changed. This document is the only file added. It contains no secret values, keys or passwords;
environment variables are named, never shown.

**Goal.** Move Joulz from Lovable Cloud (Lovable-managed Supabase) to Joe's own Supabase project (London, Pro),
with no real players yet: every phone started fresh on joulz.uk on 31 Oct 2026 (`docs/domain-move-oct-2026.md`).

**Earlier work this builds on.** `docs/migration-readiness-oct-2026.md` (11 Oct 2026) planned a move to Supabase
**Edge Functions**. It measured generation and grading under Deno, found room starts were over the 2 s CPU limit,
and the six slow generators were banked as a result. Much has been added since: 26 server functions became 61,
8 tables became 23, and there is now a daily, friend challenges and offline practice. This document re-inventories
everything and asks a different first question: can the server code stay as it is and only the database move?

**What could not be reached from this container.** The Lovable docs site (`docs.lovable.dev`) does not resolve
here (DNS blocked), and the live database refused REST calls through the network proxy (HTTP 403). So:

- Lovable behaviour is taken from the repo's own evidence (generated files and Lovable bot commits) and from a
  third-party guide. Every Lovable claim below is labelled with where it comes from. Confirm the open ones with
  Lovable support (the decisions section lists the questions).
- Row counts could not be read. Section 3.6 has the SQL to run in Lovable's Cloud SQL view.

---

## Summary

1. **The server code does not need to move.** All 61 server functions are TanStack Start `createServerFn`s,
   built by Nitro's `cloudflare-module` preset (with `nodejs_compat`). They reach Supabase only through
   `supabase-js` over HTTPS, using three environment variables. Nothing ties them to Lovable Cloud's database
   beyond those values. They can keep running on Lovable hosting against an outside project, **provided Lovable
   hosting injects the new project's service-role key into the server runtime**. Neither the repo nor the
   reachable docs prove that it does. That is the one question to put to Lovable before anything else.
2. **If Lovable can't do that, Cloudflare Workers runs the same build unchanged.** The production build already
   emits a Workers bundle and `wrangler.json`, which suggests that Lovable runs this app on Workers today. The
   server code is 25.8 MB raw and 5.1 MB gzipped, so it needs a paid Workers plan (free allows 3 MB, paid 10 MB).
   Vercel also works, through Nitro's `vercel` preset. Either way, one non-code blocker comes first: **93 sound
   files live only in Lovable's asset store** (`/__l5e/…` URLs served by Lovable hosting) and must be copied out.
3. **Edge Functions are not needed**, and should stay the last resort. They would mean rewriting 61 handlers as
   HTTP functions, plus CORS, region pinning and a separate bundle.
4. **Database: 23 tables, 8 functions, 1 trigger, 0 views, 0 storage buckets, 0 scheduled jobs.** Realtime is
   used on 4 tables plus two broadcast channels. With no real players, carry over only two reference tables:
   `unblock_bank` (Gridlock's live bank) and `intro_demos` (recorded intro demos). Everything else starts empty.
5. **Migrations.** `supabase/migrations/` holds 43 files. By the evidence, all but two are applied on Lovable
   Cloud: `20261031150000_room_16_players.sql` and `20261107120000_room_code_digits.sql` appear not to be, and
   `20261031170000_result_input_type.sql` is applied at least in part. On the new project, run all 43 in order;
   that also closes the gaps.
6. **Auth.** Each device is an anonymous Supabase user. On a new project every phone signs in again
   automatically, with a new id. Nothing breaks, and with no real players nothing is lost. One small side effect:
   offline-practice runs still queued on a phone at switchover show "Couldn't be confirmed" (section 6).
7. **Checks and CI do not depend on Lovable Cloud.** No workflow uses a secret or a database. Two things
   depend on Lovable as a *host*: the `bun.lock` registry rewrite, and standard-live-check mirroring Lovable's
   Cloudflare build.
8. **Recommended route:** keep Lovable hosting and the server code as they are. Create the London project,
   rehearse it on a Lovable remix, then switch the live project's backend in one quiet evening (section 8). Total
   effort is about 1½ to 2 days, most of it rehearsal. If Lovable can't give server functions the outside
   project's keys, the fallback is Cloudflare Workers under Joe's account. That adds about 2 days, and gives the
   cleanest rollback: DNS back to Lovable.

---

## 1. Server code

### 1.1 How it runs today

- **Framework.** TanStack Start 1.168 (`package.json`). Server functions are `createServerFn` handlers. The
  browser calls them over HTTP at `/_serverFn/…`; the offline worker skips that path on purpose
  (`src/lib/offline/sw.template.js:74`).
- **Where they are.** There are 61 handlers in 12 files:
  - `src/lib/duel/duel.functions.ts`: 21 room functions (create, join, start, settings, phases, submit, reveal,
    rematch, word and move checks…).
  - `challenge.functions.ts`: 11.
  - `practice.functions.ts`: 9 (generate, grade, packs, queued grading, word and move checks, demo key, demo saving).
  - `asyncRoom.functions.ts`: 6.
  - `chat.functions.ts`: 4.
  - `daily.functions.ts`: 3.
  - `replay/replay.functions.ts`: 2.
  - One each: `introDemo.functions.ts`, `time.functions.ts`, `share.functions.ts`, `appVersion.functions.ts`
    and `beta/terms.functions.ts`.
- **What they call.** Their logic is in `*.server.ts` modules (generators, banks, grading, the
  dictionary, rate limiting, beta recording), imported only from the functions.
- **There are no other server entry points.** No route in `src/routes/` has server handlers, there are no API
  routes, and there are no Supabase Edge Functions (`supabase/` holds only `config.toml` and `migrations/`).
- **Middleware.**
  - `src/start.ts:24-31` installs CSRF protection and `attachSupabaseAuth`, which sends the device's JWT with
    every call (`src/integrations/supabase/auth-attacher.ts`).
  - `requireSupabaseAuth` (`auth-middleware.ts`) checks that JWT with the project's URL and publishable key
    (`auth-middleware.ts:36-37`).
  - Writes go through `supabaseAdmin`, built from `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
    (`client.server.ts:36-37`).
- **Server entry.** `src/server.ts` is Lovable's SSR error wrapper. It exports a `fetch(request, env, ctx)`
  handler: the Workers module shape.
- **Build target.** `vite.config.ts:1-5` (Lovable's comment) says `@lovable.dev/vite-tanstack-config` adds
  "nitro (build-only using cloudflare as a default target)". A local `vite build` today produced
  `.output/nitro.json` with `"preset": "cloudflare-module"`, and `.output/server/wrangler.json` with
  `compatibility_flags: ["nodejs_compat"]` and `no_bundle: true`. The repo's own checks say the same:
  standard-live-check builds "the same tree-shaking as Lovable's Cloudflare build"
  (`scripts/standard-live-check.ts:12`). **Inference, not confirmed by Lovable:** Lovable hosting runs this app
  on Cloudflare Workers (or Workers for Platforms).
- **Pages.** Every page route but `/` is `ssr: false` (`src/routes/*.tsx`), so SSR is light. The server's real
  work is the functions.

### 1.2 Server bundle measured today (local `vite build`, output deleted afterwards)

| | Size |
|---|---:|
| Server JS, raw | 25.8 MB (`.output/server`) |
| Server JS, gzip -9 | 5.1 MB |
| Largest chunks | `generate.server` 9.1 MB (1.5 MB gz), `puzzleBank.server` 4.4 MB, `registry` 4.4 MB, `bastionTank` 1.2 MB, `dictionary.server` 1.0 MB |
| Static assets | 31 MB (`.output/public`) |

The big chunks are loaded by dynamic `import()` inside handlers (e.g. `practice.functions.ts:61`, `:136`), so a
cold start does not parse all of them.

### 1.3 Node-only APIs, file system, long work, memory

| Item | Where | Effect |
|---|---|---|
| `await import("crypto")` (bare Node name) | `practice.functions.ts:317` (`demoKeyOk`, the dev demo key) | Works on Workers with `nodejs_compat` (today's build), on Vercel (Node) and on Lovable. On Deno it needs `node:crypto`. |
| `await import("node:crypto")` | `cron-auth.ts:16` (generated, imported by nothing) | Unused. |
| `node:fs`, `node:path`, `node:crypto` | `src/lib/offline/swPlugin.ts:8-10` | **Build time only** (a Vite plugin), never in the server bundle. |
| `node:child_process` | `vite.config.ts` (`git rev-parse` for the build id) | Build time only; falls back to "build" without git. |
| JSON imports | `flood.server.ts:10-11` | Bundled at build; fine on every host. |
| File system at runtime | none | No `fs`, `Buffer`, `__dirname` or `require` in the server graph. |
| Long-running work | none | No background jobs, queues, cron or `waitUntil`. The longest request is a room start (one generation per round, banked since 11 Oct; the worst 7-category room measured 0.5–0.7 s CPU, `migration-readiness-oct-2026.md` §3.1a) or an arcade replay (≤ 0.65 s worst). `betaRecord.server.ts:34-37` caps a best-effort insert with a timer. |
| Module-level state | read-only caches (dictionary, banks), `withSeededRandom`'s synchronous `Math.random` swap | Safe under concurrent requests (prior audit, R7). |
| Memory | Deno heap peak under 92 MB with all modules loaded (prior audit §4.2) | Fits Workers' 128 MB per isolate and Vercel's 1–2 GB. The bundle has grown since; re-measure on the chosen host. |

### 1.4 Can they run unchanged on Lovable hosting pointed at an outside Supabase project?

**In code, yes.** Nothing names the Lovable Cloud project. The client and the server read only:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (browser, build time; `client.ts:36-38`);
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (server runtime);
- `INTRO_DEMO_KEY`.

Change those values and the same code talks to the new project.

**Unproven: who supplies the server values.** On Lovable Cloud, Lovable injects `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` into the hosted runtime; the service key is in no repo file. The generated error text
says "Connect Supabase in Lovable Cloud" (`client.server.ts`). For a project connected to an *external* Supabase
project, Lovable's integration historically assumed Supabase Edge Functions for server code. Whether Lovable
hosting gives TanStack server functions the external project's service-role key is not shown anywhere I could
reach. **Ask Lovable** (decision D1). Possible answers:

- **Yes, Lovable injects it** (or lets Joe set `SUPABASE_SERVICE_ROLE_KEY` as a project secret): route A works with
  no code change.
- **No:** the app fails on every room write, since `client.server.ts` throws "Missing Supabase environment
  variable(s)". Use route B (Cloudflare) or C (Vercel).

### 1.5 Could they run unchanged on Cloudflare (Workers) or Vercel?

**Cloudflare Workers: yes, the same build.** `npx nitro deploy --prebuilt` / `wrangler deploy` on the output
`vite build` already makes.

| Blocker / work | Detail |
|---|---|
| Plan | Paid Workers plan ($5/month at the time of writing). The 5.1 MB gzipped bundle is over the free plan's 3 MB limit and inside paid's 10 MB (Cloudflare limits page). |
| Startup time | Workers allow 1 s of startup per isolate (the current limits page; an older page said 400 ms). The entry is small, and the heavy chunks load lazily. Measure it with `wrangler deploy --dry-run` and a first-request test. |
| CPU per request | Paid default 30 s (configurable). Room starts and replays need well under 1 s. |
| **Lovable-hosted sounds** | 93 MP3s exist only in Lovable's asset store: `src/assets/sounds/*.asset.json` hold an `r2_key` and a `/__l5e/assets-v1/…` URL; `src/lib/fx/manifest.ts` references 151 such URLs. None has a copy in `public/sounds/`. Off Lovable hosting these 404, and the sound plays nothing. Download them from joulz.uk while Lovable still serves them, add them under `public/sounds/`, and point the manifest at them. That is one docs-plus-assets PR, with sound-manifest-check updated. |
| Lovable-only extras | `lovable-error-reporting.ts` (used at `__root.tsx:60`) posts to the Lovable editor and does nothing elsewhere. `previewAuthStorage.ts` falls back to `localStorage` off Lovable's preview hosts. Both are harmless. |
| Deploys | Lovable's Publish button no longer deploys the live site. A GitHub Action (or Cloudflare's Git integration) runs `vite build` plus `wrangler deploy` on `main`, with secrets set by `wrangler secret put` (names in section 5). |
| Domain | joulz.uk becomes a custom domain on the Worker (DNS at Cloudflare or a CNAME). Lovable keeps serving the old copy until DNS moves, which makes rollback a DNS change. |
| `bun.lock` | The build needs the same registry rewrite CI uses (section 7). |

**Vercel: yes, with Nitro's `vercel` preset** (one build setting, e.g. `NITRO_PRESET=vercel`). It runs on Node, so
`crypto` and everything else work as they are; function bundles may be 250 MB. Pin the functions to London
(`lhr1`) next to the database. The same sound blocker and deploy change apply. Note: Vercel's Hobby plan is for
non-commercial use; Pro is per seat. Vercel adds a second vendor where Cloudflare would host the very build
Lovable makes today, so Cloudflare is the better fallback.

### 1.6 Last resort: Supabase Edge Functions

This is planned in full in `migration-readiness-oct-2026.md` §1.3, §5 and §6, and still applies. In short:

- Each `createServerFn` body moves into a plain handler shared by both sides.
- Thin `Deno.serve` entries, bundled with `bun build`, go into `supabase/functions/*`.
- Add CORS and `OPTIONS`, `verify_jwt` settings per function, and London region pinning.
- A `callEdge()` helper replaces the RPC stubs at every call site.
- `demoKeyOk` moves to `node:crypto`.
- Each function gets 2 s of CPU and 256 MB; the banks brought the worst room start inside that.

It is now 61 handlers instead of 26, so expect 5–8 days with the cross-engine replay proof. It buys nothing the
other routes don't, except dropping the separate host.

---

## 2. Lovable

### 2.1 Can a Lovable Cloud project be switched to an outside Supabase project?

- **Official docs:** not readable from this container. A search snippet of `docs.lovable.dev/integrations/supabase`
  says an existing Supabase project is connected from the editor's settings, and that "each Lovable project
  connects to one Supabase project at a time".
- **Third-party guide** (`github.com/CarolMonroe22/lovable-cloud-to-supabase-migration`, not Lovable's): the same
  Lovable project can be moved. Export from Cloud (Cloud tab → Overview → Advanced settings: Export, Pause,
  Remove), restore into your own project, **Remove Cloud**, then connect your own Supabase to the same project.
  Lovable then rewrites the project's environment configuration. The guide warns that Lovable's integration can
  overwrite `src/integrations/supabase/client.ts` ("client.ts overwrite breaking SSR"), that secrets are never
  exported (re-enter them by hand), and that auth passwords don't export usably (irrelevant here: anonymous users
  have none).
- **Not known:** whether Remove Cloud can be undone. That decides rollback for route A (section 8.3).

### 2.2 The generated client and types

| File | Header | What it does |
|---|---|---|
| `src/integrations/supabase/client.ts` | "automatically generated. Do not edit" | Browser client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`, falling back to `process.env` for SSR (`:36-38`). Auth storage is `brokeredPreviewStorage()`. |
| `client.server.ts` | same | `supabaseAdmin` (service role, bypasses RLS). |
| `auth-middleware.ts` | same | `requireSupabaseAuth`, validated with `getClaims` (works with legacy and new asymmetric JWT keys, and with `sb_publishable_` / `sb_secret_` keys). |
| `auth-attacher.ts` | same | Adds the bearer token to server-function calls. |
| `cron-auth.ts` | same | `LOVABLE_CRON_SECRET` check; **imported by nothing**. |
| `previewAuthStorage.ts` | same | Shares the login with the Lovable editor preview; otherwise `localStorage`. |
| `types.ts` | (generated) | The `Database` type, **regenerated by Lovable from the live schema**. |

Evidence for `types.ts`: Lovable's bot commits `20a8fec7` ("Work in progress", 7 Nov 2026, adding `input_type` to
four tables) and `e3f0bd95` ("Changes", 7 Nov, adding `duels.scoring_mode` together with
`drizzle/migrations/0012_room_scoring_mode.sql`). After the switch, Lovable should regenerate it from the new
project. Since the new schema comes from the same migrations, the file should not change. A diff in it is the
quickest sign the schemas differ.

None of the generated files names the project. Only these do: `.env` (committed, Lovable's convention),
`supabase/config.toml` (`project_id`) and Lovable's runtime secrets. So the switch changes values, not code.

### 2.3 How the project URL and keys are configured today

- **`.env`** (committed, written by Lovable). Names: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PROJECT_ID`. All
  are public values (the URL, the project id and the publishable key, which ships in the browser bundle anyway).
- **Lovable Cloud runtime secrets** (not in the repo): `SUPABASE_SERVICE_ROLE_KEY`, `INTRO_DEMO_KEY`, and Lovable's
  own `LOVABLE_CRON_SECRET` / `LOVABLE_CRON_SECRET_PREVIOUS`.
- **`supabase/config.toml`**: `project_id` only.
- **`drizzle.config.ts`**: reads `LOVABLE_DB_MIGRATION_URL`. This is Lovable's own migration tool; see section 4.

On the switch, Lovable (route A) or Joe (routes B and C) sets the same names to the new project's values.
Supabase's newer key formats (`sb_publishable_…`, `sb_secret_…`) are already handled by every generated client
(`isNewSupabaseApiKey`).

---

## 3. Database inventory

Reconstructed from `supabase/migrations/` (43 files) and cross-checked against Lovable's generated
`src/integrations/supabase/types.ts`, which reflects the live schema.

### 3.1 Tables (23)

"Carry over" assumes Joe's statement that there are no real players yet. Nothing below is rewritten. A table not
carried over starts empty; the old data can be kept as an export (section 8, step 2).

| Table | Purpose | Written by | Carry over? |
|---|---|---|---|
| `duels` | One row per room: code, settings (`selected_categories`, `scoring_mode`), round order, public puzzles, phase clock | room functions | **No.** Optional: the persistent public room **JULZ** (`src/config/publicGames.ts:35`), made by hand (`docs/beta-sql.md` §11); no public games are scheduled, so recreate it when they are. |
| `duel_players` | Seats in a room: device user id, slot, name, colour, icon, heartbeat, ready flags, `submitted_round` | room functions | No |
| `round_results` | One graded result per player per round (answer, score, extra, `input_type`) | `submitAnswerFn` | No |
| `duel_secrets` | Private puzzle halves (answers) for a room; service role only | `startRoomFn` | No |
| `room_messages` | Room chat | `sendRoomMessageFn` | No |
| `room_reports` | Chat reports | `reportMessageFn` | No (a moderation history only, if any exists) |
| `rate_limit_hits` | Per-user counters for `take_rate_limit` | `rateLimit.server.ts` | No |
| **`unblock_bank`** | **Gridlock's live board bank**, drawn LRU from the 100 least-used (`unblock.server.ts:44-61`) | loaded by `scripts/unblock-bank.ts`, not a migration | **Yes, copy it exactly** (all columns). If it is empty, Gridlock falls back to the 400-board file bank (`unblock.server.ts:23`). That works, but is a different pool from what rooms draw today. |
| **`intro_demos`** | **Recorded intro demos** (seed, puzzle, input log), read publicly by `getIntroDemoFn` | recorded by hand in dev practice (`saveIntroDemoFn`, `savePuzzleDemoFn`) | **Yes, copy it exactly.** Otherwise the intros show their stills until the demos are re-recorded. |
| `room_joins` | Beta recording: joins | server | No |
| `room_events` | Beta recording: room milestones | server | No |
| `practice_plays` | Beta recording: practice outcomes | server | No |
| `round_results_archive` | Results kept when Play again clears a room | `restart_duel_room` | No |
| `duel_players_archive` | Players kept the same way | `restart_duel_room` | No |
| `share_events` | Beta: share taps, arrivals, welcome card | `recordShareEventFn` | No |
| `async_rooms` | Daily and challenge rooms (dealt rounds, window) | daily and challenge functions | No (today's daily is dealt again on its first start) |
| `async_room_secrets` | Their private halves | same | No |
| `async_attempts` | One attempt per device per async room (board) | same | No |
| `async_results` | Per-round results of attempts | same | No |
| `async_events` | Beta: async events | same | No |
| `challenges` | Friend challenge codes (7-day links) | challenge functions | No (links made before the switch stop working, which is acceptable with no players) |
| `challenge_events` | Beta: challenge events | same | No |
| `terms_events` | Beta: terms agreements | `recordTermsAgreedFn` | No (each phone agreed on its device, `duelz-terms:v1`; the server row is a record only) |

There are no enums, no views and no other sequences beyond the serial/identity ones (`unblock_bank_id_seq`,
`practice_plays.id`). Every table has RLS on.

### 3.2 RLS policies

Every client write is blocked: no write grants for `anon` / `authenticated`, plus explicit restrictive policies on
the four realtime tables. Every table without a listed policy is reachable only by `service_role`.

| Table | Policy | Rule |
|---|---|---|
| `duels` | "Participants can read their duel" (SELECT, authenticated) | `is_duel_participant(id)` |
| `duels` | "No client writes to duels" (RESTRICTIVE, ALL, anon + authenticated) | `USING (true) WITH CHECK (false)` (`20260920145655`) |
| `duel_players` | "Participants can read players of their duel" / "No client writes to players" | as above, on `duel_id` |
| `round_results` | "Participants can read own results and finished rounds" / "No client writes to results" | `is_duel_participant(duel_id) AND (player_slot = my_duel_slot(duel_id) OR duel_round_ended(duel_id, round_number))` |
| `room_messages` | "Participants can read messages of their room" / "No client writes to messages" | `is_duel_participant(duel_id)` |
| `intro_demos` | "Intro demos are public" (SELECT, anon + authenticated) | `true` |
| `async_rooms` | `async_rooms_read` (SELECT, authenticated) | `true` (column grants limit it to the window columns) |
| `async_attempts` | `async_attempts_read` (SELECT, authenticated) | `user_id = auth.uid() OR async_board_open(room_id)`, on the leaderboard columns only (`20261021130000:150-160`) |
| all 15 others | none | service role only |

### 3.3 Database functions and triggers

| Function | Kind | Purpose | Callable by |
|---|---|---|---|
| `is_duel_participant(uuid)` | SQL, SECURITY DEFINER | caller has a seat (`auth.uid()`) | authenticated, service_role |
| `my_duel_slot(uuid)` | SQL, SECURITY DEFINER | caller's slot | authenticated, service_role |
| `duel_round_ended(uuid, int)` | SQL, SECURITY DEFINER | a round is closed for everyone (latest body: `20261013120000`) | authenticated, service_role |
| `restart_duel_room(uuid, uuid)` | plpgsql, SECURITY DEFINER | Play again: archive, clear, reset (latest body: `20261031170000`) | service_role (`duel.functions.ts:1085`) |
| `disband_stale_room(uuid)` | plpgsql | disband a waiting room whose host went quiet | service_role (`duel.functions.ts:703`) |
| `take_rate_limit(uuid, text, int, int)` | plpgsql | atomic rate-limit counter | service_role (`rateLimit.server.ts:34`) |
| `async_board_open(uuid)` | SQL, SECURITY DEFINER | an async board is readable | used in the policy above |
| `challenge_attempt_cap()` | trigger function | at most 20 attempts on a challenge room (advisory lock) | trigger only |

**Trigger:** `challenge_attempt_cap` BEFORE INSERT on `async_attempts` (`20261022120000:94`). It is the only one.

### 3.4 Extensions, views, storage, scheduled jobs

- **Extensions:** none created by the migrations. They use only Supabase's defaults (`gen_random_uuid()` is core
  Postgres 13+).
- **Views:** none.
- **Storage buckets:** none. There are no `supabase.storage` calls; art is drawn in code, and sounds are in
  `public/` or Lovable's asset store (section 1.5).
- **Scheduled jobs:** none. There is no `pg_cron`, no `pg_net` and no cron route; `cron-auth.ts` is generated and
  imported by nothing. The daily is dealt on its first start of the UK day; stale rooms are disbanded on demand
  (`checkHostPresenceFn`).

### 3.5 Realtime

| Channel | Kind | Source |
|---|---|---|
| `duel-<roomCode>` | `postgres_changes` `*` on `duels`, `duel_players` and `round_results` (no `filter`; RLS decides delivery and the client drops other rooms' rows) | `src/lib/duel/useDuel.ts:111-131` |
| `room-chat-<roomId>` | `postgres_changes` INSERT on `room_messages`, and **broadcast** `reaction` (`self: true`) | `src/lib/duel/useRoomChat.ts:118-131`, send at `:221` |
| `race-ghosts-<roomId>:<round>` | **broadcast** `car` (Apex ghost cars; display only) | `src/lib/duel/raceGhosts.ts:50-85` |

On the new project:

- Publication `supabase_realtime` must include `duels`, `duel_players`, `round_results` and `room_messages`, with
  `REPLICA IDENTITY FULL` (`20260909175522:56-62`, `20260919215757:21-22`). The migrations do this.
- Broadcast needs Realtime enabled, with no channel authorisation; the channels are public today. Presence is not
  used.

### 3.6 Row counts

These could not be read here (the live REST API answered 403 through this container's proxy). Run this in Lovable's
Cloud SQL view (read-only) before deciding what to keep:

```sql
SELECT relname AS table_name, n_live_tup AS approx_rows
FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY relname;
SELECT count(*) FROM public.unblock_bank;
SELECT count(*) FROM public.intro_demos;
SELECT count(*) FROM auth.users;
```

Expected from the code: `unblock_bank` in the low thousands (built by `scripts/unblock-bank.ts`; the draw pool is
100), and `intro_demos` up to one row per game that has a recorded demo (the demo audit lists many still to
record).

---

## 4. Migrations: what is applied on Lovable Cloud

Evidence, in order of strength:

1. **Lovable's own migration journal.** Since 31 Oct 2026 (it arrived in the repo with PR #223's merge) Lovable has
   kept `drizzle/migrations/` with `meta/_journal.json`. `drizzle.config.ts` reads `LOVABLE_DB_MIGRATION_URL`, so
   this is Lovable's applier, not app code. Each entry is a copy of a `supabase/migrations` file, stamped with
   Lovable's apply time.
2. **`types.ts`**, regenerated by Lovable from the live schema (section 2.2).
3. **Lovable-authored file names** (`<timestamp>_<uuid>.sql`): Lovable writes these when it applies a change.

| File(s) | Applied? | Evidence |
|---|---|---|
| The 25 Lovable-named files, `20260909175522_…` to `20261005120255_…` | **Yes** | Written by Lovable when applied. Every table and column they create is in `types.ts`. |
| `20261003000000_drop_add_memory.sql` | **Yes** | `duels` in `types.ts` has no `add_memory`. |
| `20261013120000_reveal_phase_answers_closed.sql` | **Probably** | It only replaces a function body, which `types.ts` cannot show. Verify (SQL below). |
| `20261016120000_rate_limits` to `20261016170000_beta_archive_round_records` (5 files) | **Yes** | drizzle 0000–0005, applied 16 Oct 2026 |
| `20261017120000_player_colour_icon`, `20261017140000_player_submitted_round` | **Yes** | drizzle 0006–0007, 17 Oct |
| `20261021120000_beta_share_events`, `20261021130000_async_rooms_daily` | **Yes** | drizzle 0008–0009 |
| `20261022120000_friend_challenges` | **Yes** | drizzle 0010 |
| `20261023120000_beta_terms_events` | **Yes** | drizzle 0011, 23 Oct |
| `20261108120000_room_scoring_mode` | **Yes** | drizzle 0012, applied 7 Nov 2026, with `scoring_mode` in `types.ts` |
| `20261031170000_result_input_type` | **At least the columns** | `input_type` on `round_results`, `round_results_archive`, `async_results` and `practice_plays` in `types.ts` (Lovable commit `20a8fec7`, 7 Nov), but **no drizzle entry**. Whether its CHECK constraints and its new `restart_duel_room` body went in is unknown. Verify. |
| `20261031150000_room_16_players` | **Probably not** | No drizzle entry; it changes only constraints and a default, which `types.ts` doesn't show. The CLAUDE.md "Rooms of 16" entry still calls it written but not applied. |
| `20261107120000_room_code_digits` | **Probably not** | No drizzle entry; a constraint only. |

Several docs (`CLAUDE.md`, `docs/beta-sql.md`) still say "written but not applied" for files the journal shows as
applied. Those notes were written before Lovable applied them, so the journal is the better guide.

**For the new project this barely matters.** Running all 43 files in order (`supabase db push`, or `psql -v
ON_ERROR_STOP=1` file by file) gives the intended schema, including the two that are probably missing live. The
local-PostgreSQL checks already do this on a stub (player-looks-check, daily-check, challenge-check,
beta-recording-check). The `drizzle/` folder is Lovable's record and must not be run as well: its files duplicate
`supabase/migrations`.

SQL to confirm the live state (read-only, Lovable's SQL view):

```sql
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conname IN ('duel_players_slot_range', 'duel_players_colour_range', 'share_events_room_code_check',
                  'round_results_input_type_check');
SELECT position('input_type' in prosrc) > 0 AS restart_copies_input_type
FROM pg_proc WHERE proname = 'restart_duel_room';
SELECT position('''result''' in prosrc) > 0 AS reveal_closed_fix
FROM pg_proc WHERE proname = 'duel_round_ended';
```

---

## 5. Secrets and settings (names only)

| Name | Read by | Set today | On the new project |
|---|---|---|---|
| `VITE_SUPABASE_URL` | browser client, build time (`client.ts:36`) | `.env` (Lovable) | the new project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser client (`client.ts:38`) | `.env` | the new publishable key |
| `VITE_SUPABASE_PROJECT_ID` | nothing in `src/` | `.env` | the new ref |
| `SUPABASE_URL` | `auth-middleware.ts:36`, `client.server.ts:36`, `client.ts:36` (SSR), `introDemo.functions.ts:57`, `practiceSeal.ts:51` (dev seal fallback) | `.env` and the Lovable runtime | the new URL |
| `SUPABASE_PUBLISHABLE_KEY` | `auth-middleware.ts:37`, `client.ts:38`, `introDemo.functions.ts:56` | `.env` and the Lovable runtime | the new publishable key |
| `SUPABASE_ANON_KEY` | `introDemo.functions.ts:56` (fallback only) | not set as far as the repo shows | not needed |
| `SUPABASE_PROJECT_ID` | nothing in `src/` | `.env` | the new ref |
| `SUPABASE_SERVICE_ROLE_KEY` | `client.server.ts:37`; **the practice seal key's fallback** while `PRACTICE_SEAL_KEY` is unset, and the second key unsealing tries (`practiceSeal.ts:49`); the "is there a database?" guards in `terms.functions.ts:15`, `share.functions.ts:33`, `challenge.functions.ts:225` and `practice.functions.ts:133` | Lovable Cloud runtime only | the new project's service-role (or `sb_secret_`) key: Lovable (route A) or the host's secret store (B/C) |
| `PRACTICE_SEAL_KEY` | `practiceSeal.ts:48`: the key that seals practice's private halves (live practice and offline packs; D5). Unset or empty: the seal falls back to `SUPABASE_SERVICE_ROLE_KEY`, exactly as before. Set: new seals use it, and unsealing still accepts the service-role key, so tokens sealed before it was set keep working until that key changes | not set until Joe sets it (a Lovable Cloud secret) | **the same value**, carried across unchanged, so packs on phones survive the move |
| `INTRO_DEMO_KEY` | `practice.functions.ts:315` (dev demo saving) | Lovable secret, set by Joe | the same or a new long random value |
| `LOVABLE_CRON_SECRET`, `LOVABLE_CRON_SECRET_PREVIOUS` | `cron-auth.ts` (imported by nothing) | Lovable-managed | not needed |
| `LOVABLE_DB_MIGRATION_URL` | `drizzle.config.ts` (Lovable's migration tool) | Lovable-managed | Lovable's concern |
| `DUELZ_BUILD_ID` | `vite.config.ts` | set by the build itself | unchanged |

**Repo constants, not secrets** (unchanged by the move): `APP_URL` (`src/config/appUrl.ts`), and `SENTRY_DSN`,
`TALLY_URL`, `CONTACT_EMAIL` and `DISCORD_URL` (`src/config/betaConfig.ts`), plus `supabase/config.toml`'s
`project_id`, which should be updated to the new ref.

**Settings outside the repo, on the new Supabase project (Joe):**

- Auth: Anonymous sign-ins **on**. Site URL `https://joulz.uk`, with redirect URLs for joulz.uk (none is used
  until real sign-in exists).
- Anonymous sign-in rate limit: 30 an hour per IP by default (Supabase docs). Review it, and consider Turnstile
  CAPTCHA later; that needs a client change (`docs/security-audit-oct-2026.md` #2).
- Realtime enabled. The publication comes from the migrations.
- Region London (`eu-west-2`), Pro plan: daily backups, no pausing. Consider PITR.
- JWT signing keys: default is fine (`getClaims` handles both kinds).

---

## 6. Auth today, and what the move means

- **How it works.** `ensureSession()` (`src/lib/duel/session.ts:16-30`) reuses the stored Supabase session or
  calls `signInAnonymously()`. Each device becomes an anonymous `auth.users` row. Its id is the
  `user_id` / `host_user_id` / `created_by` everywhere: there are no foreign keys to `auth.users`, and the RLS
  helpers read `auth.uid()`. The session lives in `localStorage` (via `previewAuthStorage.ts`) under
  supabase-js's default key, `sb-<project-ref>-auth-token`. The token refreshes itself. Server functions receive
  it as a bearer token and check it with `getClaims`.
- **What the move does.** The new project has a different ref, so supabase-js looks under a new storage key, finds
  no session and signs in anonymously again: **every phone silently gets a new id on first open.** The old token
  stays unused in `localStorage`. No code change is needed. Copying `auth.users` is pointless with no players, and
  would not work anyway without the old project's JWT secret.
- **Effects, all acceptable with no real players:**
  - Rooms open at switchover are stranded; the room's row is not in the new database.
  - "Rejoin your last room", Profile's "Your challenges" codes and links to old challenges and rooms point at rows
    that no longer exist. The screens already handle that: room not found, challenge not found.
  - The host's recent-rooms history (used to avoid repeats) starts again.
  - Device-only records survive, because they are keyed by origin, not user id: practice bests, stars, look,
    streaks and terms agreement.
  - **Offline practice.** Packs are sealed with `PRACTICE_SEAL_KEY` when it is set, else with a key derived from
    `SUPABASE_SERVICE_ROLE_KEY` (`src/lib/duel/practiceSeal.ts`). If `PRACTICE_SEAL_KEY` is set (and carried to the
    new host unchanged) before the move, nothing below happens to packs sealed after it was set. Otherwise a new
    service key means:
    - packs already on a phone fail to unseal;
    - a queued run is shown "Couldn't be confirmed" (`src/lib/offline/queue.ts:150`);
    - live practice and new packs are unaffected.

    To avoid that, Joe sets `PRACTICE_SEAL_KEY` (the code reads it since D5, 7 Nov 2026; security audit #7).
    Packs sealed before it was set still open while the old service key is in place, so setting it is safe at any
    time; only packs sealed before it was set are lost at the move. With no players it can wait. Note it as an
    expected one-off.

---

## 7. Checks and CI

Nothing in the check suite or the workflows talks to Lovable Cloud.

- **Workflows** (`.github/workflows/checks.yml`, `full-suite.yml`) use no secrets (no `secrets.` reference), no
  database and no Supabase CLI.
- **Lovable as a package host.** CI and local installs rewrite `bun.lock`'s Lovable private npm URLs to
  npmjs.org for the install (`checks.yml:69-75`, `full-suite.yml:105-110`, `:242`). Route A changes nothing here.
  Routes B and C need the same rewrite in their deploy job, or Lovable's cache answers 403.
- **Lovable as a build target.** standard-live-check (`scripts/standard-live-check.ts:12`, `:113`) and
  offline-check (`:121`) build the production bundle "as Lovable's Cloudflare build" and run it with a made-up
  `SUPABASE_SERVICE_ROLE_KEY` as the seal secret. They are unaffected by route A or B. Route C (Vercel) would want
  standard-live-check to build the Vercel preset as well.
- **Supabase URL patterns.**
  - offline-check stubs Supabase's auth answers and aborts `supabase\.co/(rest|realtime|storage)`
    (`scripts/offline-check.ts:214-237`).
  - arcade-play-check ignores console noise matching `/supabase/i` (`:284`).
  - Both still match a new `*.supabase.co` project. A Supabase custom domain for the API would need these patterns
    widened.
- **Local PostgreSQL checks.** player-looks-check, daily-check, challenge-check and beta-recording-check apply
  `supabase/migrations/*.sql` in order to a local Postgres stub. They are the rehearsal of step 3 below.
- **Generated-types dependents.** share-check (`:572-574`) accepts `types.ts` with or without `share_events`, as
  Lovable generates it. If the new project's regenerated `types.ts` is identical, nothing changes.
- **Lovable-hosted sound URLs.** sound-manifest-check counts `/__l5e/` files (`:203`). Only routes B and C must
  change them (section 1.5).
- **No-side-effect-imports-check** allows Lovable's `src/server.ts` error capture import. That is unaffected.

---

## 8. Recommended route

### 8.1 Route A (recommended): keep Lovable hosting and the server code, swap the backend

Least change: no code edits. Only values (`.env`, `supabase/config.toml`, Lovable's runtime secrets) and two
reference tables move. It depends on Lovable answering D1 "yes".

Steps, in order (**[Joe]** = dashboards, keys or Lovable access):

| # | Step | Who | Effort |
|---|---|---|---|
| 1 | Ask Lovable support the questions under D1–D3. Agree who holds the branch while Lovable rewrites `.env` and `src/integrations/supabase/` (CLAUDE.md: Lovable and Claude Code never edit at once). | Joe | ½ h, plus waiting |
| 2 | Export what to keep from Lovable Cloud: `unblock_bank` and `intro_demos` as data (`COPY … TO` / CSV from the SQL view, or Cloud's Export), plus, optionally, a full export of everything else as an archive, deleted later if it holds credentials. Run section 3.6's counts and section 4's verification SQL and note the results. | Joe (Claude can write the exact SQL) | 1 h |
| 3 | Create the Supabase project (London, Pro). Turn anonymous sign-ins on; set the Site URL. Run all 43 `supabase/migrations` in order (`supabase link`, `supabase db push`). Confirm the realtime publication holds the four tables. Compare the schema with `types.ts` (`supabase gen types` should match it apart from formatting). | Joe for keys and the DB password; Claude for the commands and the comparison | 2 h |
| 4 | Load `unblock_bank` and `intro_demos` exactly as exported (all columns, ids kept, sequence reset). Check row counts and an `md5(string_agg(row::text, '' ORDER BY id))` on both sides. | Joe and Claude | 1 h |
| 5 | **Rehearsal on a Lovable remix** (if Lovable allows a remix to connect to an external project): connect the remix to the new project, set `SUPABASE_SERVICE_ROLE_KEY`, `INTRO_DEMO_KEY` and `PRACTICE_SEAL_KEY`, publish it on its lovable.app address, and play a 2-phone room, practice, a daily, a challenge, chat and Play again. This proves D1 without touching joulz.uk. | Joe (phones); Claude for a checklist | ½ day |
| 6 | Switchover evening (8.2). | Joe | 1–2 h |
| 7 | Afterwards: a small PR updating `supabase/config.toml`, the docs that name the old project, and the "written but not applied" notes. Keep the Lovable Cloud export for a month, then delete it. | Claude | ½ h |

Total: about 1½ to 2 days of elapsed work, most of it the rehearsal and waiting on Lovable.

### 8.2 Switchover evening (route A)

1. Pick a quiet evening. No players are expected; post a note in the beta Discord or chat if testers are active.
2. Re-run the section 3.6 counts. Re-export `intro_demos` if a demo was recorded since step 2, and reload it.
3. In Lovable: Cloud → export (kept as the archive), then **Remove Cloud** and connect the new project (or
   whatever path Lovable confirmed under D1). Set the runtime secrets `SUPABASE_SERVICE_ROLE_KEY` and
   `INTRO_DEMO_KEY` if Lovable doesn't do so itself, and keep `PRACTICE_SEAL_KEY` at its existing value.
4. Check that Lovable's sync commit changes only `.env` values and (maybe) `types.ts` formatting, and that the
   generated `client.ts` still reads `import.meta.env` first and falls back to `process.env` (the guide warns of a
   client overwrite). Merge, and press **Publish**.
5. Smoke test on joulz.uk, with two phones on mobile data:
   - first open signs in;
   - create, join, start and play a room with a puzzle, an arcade game and Gridlock;
   - chat, a reaction, Play again;
   - practice: a grade and a pack top-up;
   - the daily and a challenge;
   - an intro demo plays.

   In Supabase, see the rows arrive and the Auth anonymous user count grow.
6. Watch for an hour: Supabase logs (API 4xx/5xx, Realtime connections) and the app's error toasts.

### 8.3 Rollback (route A)

- **If Remove Cloud can be undone, or Lovable lets the project reconnect to its Cloud database:** reconnect, put
  the old secrets back and press Publish. Rooms and dailies played on the new project in between are lost. That is
  acceptable with no players; decide it in advance.
- **If it can't be undone**, rollback is "fix forward", or switching hosting to route B, which needs the sound
  copy-out done first.

So, unless Lovable confirms a reconnect path, do steps 1–5 of route B's preparation (8.4, rows 1–2) *before*
the switchover evening. That way an emergency move to Cloudflare is ready if the Lovable switch misbehaves.

### 8.4 Route B (fallback): Cloudflare Workers, own account

Use this if D1 is "no", or if a guaranteed rollback matters more than the Lovable workflow.

| # | Step | Effort |
|---|---|---|
| 1 | Copy the 93 Lovable-hosted sounds into `public/sounds/`, point `manifest.ts` at them, and update sound-manifest-check. Lovable hosting still serves them, so this is safe to merge first. | ½ day |
| 2 | A deploy workflow: `bun.lock` registry rewrite, `bun install`, `vite build`, `wrangler deploy` of `.output`, with secrets `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PRACTICE_SEAL_KEY` and `INTRO_DEMO_KEY` set by `wrangler secret put` [Joe], and the `VITE_*` values as build env. A paid Workers plan [Joe]. | 1 day |
| 3 | Steps 2–4 of route A (the database). | ½ day |
| 4 | Test on the `*.workers.dev` address: 2 phones, as in 8.2 step 5. Measure startup and the first room start. | ½ day |
| 5 | Switchover: point joulz.uk at the Worker (custom domain; DNS TTL lowered a day before). Lovable keeps serving the old app on Lovable Cloud. | 1 h |
| 6 | **Rollback:** point DNS back at Lovable. | minutes plus TTL |

Total: about 3–4 days. The ongoing cost is that Lovable's Publish no longer deploys the live site, and the
Lovable editor keeps editing a copy wired to Lovable Cloud unless it is also reconnected.

Route C (Vercel) is the same with Nitro's `vercel` preset and the London region (`lhr1`). Use it only if Joe would
rather not use Cloudflare. Route D (Edge Functions) is 5–8 days (section 1.6); avoid it.

### 8.5 Decisions for Joe

- **D1 (blocks everything).** Ask Lovable support:
  - "My project uses TanStack Start server functions on Lovable hosting. If I remove Lovable Cloud and connect my
    own Supabase project, do the server functions get `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and
    `SUPABASE_SERVICE_ROLE_KEY` for the new project, or can I set them as secrets?"
  - "Can Remove Cloud be undone?"
  - "Will a remix of the project let me rehearse this?"
- **D2.** Is Lovable's editor still wanted after the move? Route A keeps it fully; route B splits the deploy away
  from Lovable's Publish.
- **D3.** The rollback stance: lose what is played on the new project during the rollback window (recommended;
  there are no players), or keep both databases writable (not possible without dual-writing).
- **D4.** What to carry: `unblock_bank` and `intro_demos` only (recommended), or also an archive dump of the beta
  tables.
- **D5.** A dedicated `PRACTICE_SEAL_KEY`. **Done in code (7 Nov 2026):** the server reads it and falls back to today's
  key while it is unset (`src/lib/duel/practiceSeal.ts`, practice-seal-check). Joe sets the value, ideally before
  the move, and carries the same value to the new host.
- **D6.** Supabase settings: PITR (paid add-on), the anonymous sign-in rate limit, and Turnstile now or later.
- **D7.** The two probably-unapplied migrations (`room_16_players`, `room_code_digits`) come with the fresh schema.
  Confirm Joe wants rooms of 16 and digit room codes live from the switch. The app is built to work with or without
  them.

---

## Sources

- Repo: every file and line cited above; Lovable bot commits `20a8fec7` and `e3f0bd95`; a local
  `vite build` (output deleted).
- `docs/migration-readiness-oct-2026.md`, `docs/domain-move-oct-2026.md`, `docs/security-audit-oct-2026.md`,
  `docs/beta-sql.md`, `docs/duelz-master-plan.md` (Phase 3, item 11).
- Lovable: `docs.lovable.dev/integrations/supabase` (search snippet only; the site did not resolve from this
  container); third-party guide `github.com/CarolMonroe22/lovable-cloud-to-supabase-migration` (README; not
  Lovable's).
- Cloudflare Workers limits: `developers.cloudflare.com/workers/platform/limits`.
- Supabase anonymous sign-ins and rate limits: `supabase.com/docs/guides/auth/auth-anonymous`,
  `supabase.com/docs/guides/auth/rate-limits`.
