# Duelz — Migration Readiness: Lovable Cloud → own Supabase (London) + Edge Functions

Read-only audit, 11 Oct 2026, against `main` at `3c09847`. No app code, schema or data was changed. Every timing here was measured in this audit's cloud container. Timings are not from production.

## Summary

1. **Puzzle generation is the blocker.** Supabase Edge Functions allow **2 s of CPU per request**. `startRoomFn` builds every round of a room in one request. Under Deno, Chroma Lines (`flow`) can take up to 5.7 s and Tessellate (`blockparty`) up to 3.8 s. Polypotions (`tubes`, 2.5 s) and Topsy-Turvy (`gravity`, 1.4 s) also go over on bad seeds. Room starts that draw these games will fail with `546 WORKER_LIMIT`. Six games are over 500 ms and should move to precomputed banks before cutover (§3).
2. **Arcade grading fits.** The worst-case full input log for every active engine game replays in ≤ 54 ms under Deno, except Rainbow Bridge (`inkbridge`): 214 ms median, 421 ms worst. Peak heap stays under 92 MB, against a 256 MB limit (§4).
3. **The server code already runs on Deno.** I loaded it from source under Deno 2.9.6 and it generated and graded correctly. That took one import map (`@/`), "sloppy imports" (no file extensions) and a JSON import attribute in `flood.server.ts`. The simpler route is a Bun-built ESM bundle: 4.96 MB, it loads under plain `deno run` in 135–360 ms, and the limit is 20 MB (§5).
4. **Replays match across engines.** 580 arcade runs were recorded under Bun (JavaScriptCore) and replayed under Deno (V8): **0 score or checkpoint mismatches** (§4.3).
5. **Lovable-specific pieces are small and known.** They are listed in §1.3 and §2.8.

---

## 1. Server functions

There are 26 `createServerFn` handlers in 5 files. Client calls go through `src/lib/duel/api.ts` and six other files (§5.3).

**Auth key.** "Auth" means `requireSupabaseAuth` (`src/integrations/supabase/auth-middleware.ts`). It requires a `Bearer` JWT, validates it with `supabase.auth.getClaims`, and puts `userId` and a user-scoped (RLS) client in `context`. "Admin" means `supabaseAdmin`, which uses the service role and bypasses RLS. Most room functions use admin through `db()`.

### 1.1 `src/lib/duel/duel.functions.ts` (room flow; all Auth; all writes via Admin)

| Function | What it does | Input | Reads | Writes |
|---|---|---|---|---|
| `createRoomFn` | Creates a room and seats the host in slot 1. Reuses the host's last category choice. Retries up to 8 times on a room-code collision (23505). | `{displayName}` | `duels` (host's latest `selected_categories`) | `duels` insert, `duel_players` insert |
| `joinRoomFn` | Joins by code. Re-activates a player who `left` while the room is still waiting. Takes the first free slot up to `max_players`. | `{roomCode, displayName}` | `duels` (by `room_code`), `duel_players` | `duel_players` insert/update `status` |
| `startRoomFn` | Host only. Draws an Unblock bank row and reads the host's recent orders, Word Match words and Go/No-Go opener. Calls `buildRoomPuzzles` (**CPU-heavy, §3**), splits answers off, claims the room (`status waiting→in_progress`) and stores the secrets. | `{roomId}` | `duel_players`, `duels` (room + host's last 15/30/3 rooms), `unblock_bank` | `unblock_bank.last_used_at`, `duels` (order, `puzzles_public`, phase), `duel_secrets` upsert |
| `setRoomModesFn` | Host only, in the lobby: sets `selected_categories`. | `{roomId, categories}` | `duel_players`, `duels` | `duels` |
| `removePlayerFn` | Host only, in the lobby: deletes a player row. | `{roomId, slot}` | `duels` | `duel_players` delete |
| `leaveRoomFn` | Marks the caller `left`. If the caller is the host, disbands the room. | `{roomId}` | `duels` | `duel_players`, `duels` (`disbanded_at`, `status`) |
| `disbandRoomFn` | Host disbands the room. | `{roomId}` | `duels` | `duels` |
| `checkHostPresenceFn` | Calls RPC `disband_stale_room`: a waiting room whose host has been silent for over 2 minutes is disbanded. | `{roomId}` | `duel_players` | via RPC: `duels` |
| `advancePhaseFn` | The only phase/round state machine: starting → round_title → intro → puzzle → reveal → result → standings or winner_reveal → finished. Idempotent, with guarded `UPDATE … WHERE phase = from`. Uses the server's `Date.now()`. | `{roomId, hostNext?}` | `duel_players`, `duels`, `round_results` (count, slots) | `duels`, `duel_players.status` (inactivity) |
| `submitAnswerFn` | Grades on the server (`gradeAnswer`, **which replays arcade runs, §4**). Clamps the client's claimed time against server time. Inserts the result and advances to reveal once all active players are in. | `{roomId, roundNumber, answer (≤400,000 chars for arcade), msRemaining, extra?}` | `duel_players`, `duels`, `round_results`, `duel_secrets` | `round_results` insert, `duel_players.status`, `duels` phase |
| `markReadyFn` | Sets `ready_round`. | `{roomId, roundNumber}` | `duel_players` | `duel_players` |
| `readyUpFn` | Intro READY tap. When every active player is ready, pulls the intro start back to the countdown. | `{roomId, roundNumber}` | `duel_players`, `duels` | `duel_players`, `duels.phase_started_at` |
| `heartbeatFn` | Stamps `last_seen_at`. Called on a timer by every phone, so it is the highest-volume call. | `{roomId}` | — | `duel_players` |
| `revealAnswerFn` | After the round ends: returns the merged puzzle, the correct answer and per-player summaries. | `{roomId, roundNumber}` | `duel_players`, `duels`, `duel_secrets`, `round_results` | — |
| `rematchFn` | Host only: calls RPC `restart_duel_room`. | `{roomId}` | `duel_players`, `duels` | via RPC: `round_results`, `duel_secrets`, `duel_players` (deletes/updates), `duels` |
| `checkWordFn` | Live word check for Roundabout, Lookout, Forage, Interlock, Slider, Word Ladder and Nucleus. Uses the server-only dictionary and private placements. | `{roomId, roundNumber, word, found[], path?}` | `duel_players`, `duels`, `duel_secrets` | — |
| `checkGroupFn` | Groups: checks four tiles against the private partition. | `{roomId, roundNumber, indices}` | `duel_players`, `duels`, `duel_secrets` | — |

### 1.2 Other files

| Function | File | Auth | What it does | Input | Reads | Writes |
|---|---|---|---|---|---|---|
| `sendRoomMessageFn` | `chat.functions.ts` | Auth | Chat message. Reads through the **user's RLS client**: the sender row and the rate-limit history. Applies the per-player cap and minimum gap, then the profanity `censor`. | `{roomId, text}` | `duel_players`, `room_messages` (RLS) | `room_messages` (Admin) |
| `allowReactionFn` | `chat.functions.ts` | Auth | Validates the emoji and the 1/s limit, then stamps `last_reaction_at`. The client then sends a Realtime **broadcast**. | `{roomId, emoji}` | `duel_players` (RLS) | `duel_players` (Admin) |
| `reportMessageFn` | `chat.functions.ts` | Auth | Files a report. | `{roomId, messageId}` | `duel_players` (RLS) | `room_reports` (Admin) |
| `setPlayerMutedFn` | `chat.functions.ts` | Auth | Host mutes or unmutes a slot. | `{roomId, slot, muted}` | `duels` (RLS) | `duel_players` (Admin) |
| `practiceGenerateFn` | `practice.functions.ts` | **none** | Generates one practice puzzle (**CPU-heavy, §3**). Returns the public half plus the private half **sealed** with AES-GCM, using a key derived from `SUPABASE_SERVICE_ROLE_KEY`. `example: true` uses the fixed intro seed. | `{type, example?}` | `unblock_bank` (Unblock only) | `unblock_bank.last_used_at` |
| `practiceGradeFn` | `practice.functions.ts` | none | Unseals, then calls `gradeAnswer` (**arcade replay, §4**). Nothing is stored. | `{puzzle, sealed, answer, msRemaining, extra?}` | — | — |
| `practiceCheckWordFn` | `practice.functions.ts` | none | Practice word check (as `checkWordFn`). | `{puzzle, word, found, path?, sealed?}` | — | — |
| `practiceCheckGroupFn` | `practice.functions.ts` | none | Practice Groups check. | `{puzzle, sealed, indices}` | — | — |
| `checkDemoKeyFn` | `practice.functions.ts` | none | Constant-time compare against `INTRO_DEMO_KEY`. | `{key}` | — | — |
| `saveIntroDemoFn` | `practice.functions.ts` | `INTRO_DEMO_KEY` | Dev only: saves an engine-game intro demo. | `{puzzle, sealed, answer, dev, key}` | — | `intro_demos` upsert (Admin) |
| `savePuzzleDemoFn` | `practice.functions.ts` | `INTRO_DEMO_KEY` | Dev only: saves a puzzle-game demo for the fixed example. | `{puzzle, sealed, log, dev, key}` | — | `intro_demos` upsert (Admin) |
| `getIntroDemoFn` (GET) | `introDemo.functions.ts` | none | Public read of one demo. Rejects stale revisions (orbit, laser, balltrack, stroop, bomb, inkbridge, clayshoot, chain, swing). | `{type}` | `intro_demos` (anon key) | — |
| `serverTimeFn` (GET) | `time.functions.ts` | none | Returns `Date.now()` for the shared clock. The client keeps the lowest-RTT sample of 3 (`clock.ts`). | — | — | — |

### 1.3 Lovable-specific or Node-only code, and what changes on Deno

| Item | Where | Deno Edge Function status |
|---|---|---|
| `createServerFn`, `createMiddleware`, `getRequest` (TanStack Start RPC) | all `*.functions.ts`, `auth-middleware.ts`, `auth-attacher.ts`, `start.ts` | **Replace.** Each function becomes an HTTP handler (`Deno.serve`). Input arrives as JSON. Add CORS headers and an `OPTIONS` reply, because the browser calls `*.supabase.co` cross-origin. The CSRF middleware in `start.ts` stops applying. TanStack's seroval serialisation becomes plain JSON. The return values are already JSON-safe (`practiceGradeFn` already stringifies `extra`). |
| `process.env[...]` | `auth-middleware.ts`, `client.server.ts`, `introDemo.functions.ts`, `practice.functions.ts` | Works in Deno 2 (Node globals) but the idiom is `Deno.env.get`. `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically into Edge Functions. `SUPABASE_PUBLISHABLE_KEY` is **not** injected under that name; `introDemo.functions.ts` already falls back to `SUPABASE_ANON_KEY`. |
| `import { createHash, timingSafeEqual } from "crypto"` (bare specifier) | `practice.functions.ts` (`demoKeyOk`) | Use `node:crypto` (Deno supports it), or a Web Crypto digest compare. Bundling resolves the bare name too (§5). `cron-auth.ts` already uses `node:crypto`. |
| JSON import without attribute | `flood.server.ts` (`import bankData from "./floodBank.server.json"`) | **Fails on Deno from source** ("Attempted to load JSON module without specifying type"). Fixed by `with { type: "json" }` or by bundling. This was the only source-level runtime error found. |
| Extensionless relative imports and the `@/` alias | everywhere | Deno needs an import map (`"@/": "./src/"`) and `"unstable": ["sloppy-imports"]`, or a bundle. |
| `cron-auth.ts` (`LOVABLE_CRON_SECRET`, `LOVABLE_CRON_SECRET_PREVIOUS`) | generated by Lovable | **Not used by any app code.** Nothing to port. If scheduled work is ever needed, use `pg_cron` plus `pg_net`, or Supabase Scheduled Functions. |
| `previewAuthStorage.ts` | client auth storage | Lovable editor preview only. On a non-Lovable host it falls back to `localStorage`. Keep it while Lovable hosts the front end. |
| `lovable-error-reporting.ts`, `error-capture.ts`, `server.ts` (h3 swallowed-error wrapper) | client/SSR | Lovable hosting telemetry and SSR error page. These do not move to Edge Functions. |
| `@lovable.dev/vite-tanstack-config` | `vite.config.ts` | The front-end build. It targets Nitro → Cloudflare by default (its own comment says so), which **appears** to be how Lovable runs SSR and server functions today. Assumption: Lovable runs on Workers-class V8 isolates with a larger CPU allowance. That would explain why ~10 s room starts work today. |
| Auto-generated `src/integrations/supabase/*` ("Do not edit") | Lovable | Lovable regenerates these. A custom backend URL must survive Lovable syncs (see risk R3). |
| Console logging (`console.log/warn/error`) | everywhere | Works. It appears in the Edge Function logs. |
| `crypto.getRandomValues`, `crypto.subtle` (AES-GCM, SHA-256), `TextEncoder`, `atob`/`btoa` | `random.ts`, `practice.functions.ts` | Web standard; works unchanged. |
| `withSeededRandom` temporarily overwrites global `Math.random` | `random.ts` (practice examples) | Works, but it is process-global state. An Edge worker can serve concurrent requests. The swap is synchronous (no `await` inside), so it cannot interleave. Keep it synchronous. |

No module in the server graph uses `fs`, `path`, `Buffer`, `require`, `__dirname`, `child_process` or `worker_threads`. Canvas (`@napi-rs/canvas`) and `happy-dom` appear only in `scripts/` checks.

---

## 2. Schema (reconstructed from all 26 files in `supabase/migrations/`, cross-checked with `src/integrations/supabase/types.ts`)

### 2.1 Tables

**`public.duels`** (one row per room; still named duels):
`id uuid PK default gen_random_uuid()`, `room_code text NOT NULL UNIQUE`, `status text NOT NULL default 'waiting'`, `round_order jsonb NOT NULL`, `current_round int NOT NULL default 0`, `round_started_at timestamptz`, `next_duel_id uuid`, `created_at timestamptz NOT NULL default now()`, `phase text NOT NULL default 'intro'`, `phase_started_at timestamptz`, `puzzles_public jsonb NOT NULL default '[]'`, `host_user_id uuid`, `max_players int NOT NULL default 10`, `round_count int NOT NULL default 6`, `no_maths bool NOT NULL default false`, `add_maths bool NOT NULL default false`, `add_arcade bool NOT NULL default true`, `selected_categories jsonb NOT NULL default '["logic","pattern","speed","attention","word","arcade"]'`, `tournament_history jsonb NOT NULL default '[]'`, `disbanded_at timestamptz`.
CHECK `duels_no_memory_category`: `NOT (selected_categories ? 'memory')`. `add_memory` has been dropped. `no_maths`, `add_maths`, `add_arcade` and `next_duel_id` are legacy columns that current code no longer writes. Keep them, because stored rows hold them.

**`public.duel_players`**: `id uuid PK`, `duel_id uuid NOT NULL → duels(id) ON DELETE CASCADE`, `player_slot int NOT NULL`, `display_name text NOT NULL`, `ready_round int NOT NULL default 0`, `last_seen_at timestamptz NOT NULL default now()`, `created_at timestamptz NOT NULL default now()`, `user_id uuid NOT NULL` (the anonymous `auth.uid()`; **no FK** to `auth.users`), `status text NOT NULL default 'active'`, `joined_at timestamptz NOT NULL default now()`, `intro_ready_round int NOT NULL default 0`, `muted_by_host bool NOT NULL default false`, `last_reaction_at timestamptz`.
CHECKs: `duel_players_slot_range` (`player_slot BETWEEN 1 AND 10`), `duel_players_status_valid` (`status IN ('active','inactive','left')`).

**`public.round_results`**: `id uuid PK`, `duel_id uuid NOT NULL → duels ON DELETE CASCADE`, `player_slot int NOT NULL`, `round_number int NOT NULL`, `answer text`, `is_correct bool NOT NULL default false`, `ms_remaining int NOT NULL default 0`, `score int NOT NULL default 0`, `submitted_at timestamptz NOT NULL default now()`, `reaction_avg_ms int`, `correct_count int`, `errors int`, `extra jsonb`.

**`public.duel_secrets`**: `duel_id uuid PK → duels ON DELETE CASCADE`, `puzzles_private jsonb NOT NULL`, `created_at timestamptz NOT NULL default now()`.

**`public.room_messages`**: `id uuid PK`, `duel_id uuid NOT NULL → duels ON DELETE CASCADE`, `sender_user_id uuid NOT NULL`, `sender_name text NOT NULL`, `text text NOT NULL`, `created_at timestamptz NOT NULL default now()`.

**`public.room_reports`**: `id uuid PK`, `duel_id uuid NOT NULL → duels ON DELETE CASCADE`, `message_id uuid → room_messages(id) ON DELETE SET NULL`, `reporter_user_id uuid NOT NULL`, `created_at timestamptz NOT NULL default now()`.

**`public.unblock_bank`** (the live Gridlock bank): `id serial PK`, `layout text NOT NULL UNIQUE`, `min_moves int NOT NULL CHECK (min_moves BETWEEN 15 AND 22)`, `solution text NOT NULL`, `last_used_at timestamptz`, `created_at timestamptz NOT NULL default now()`. The rows were loaded by `scripts/unblock-bank.ts`, not by a migration. **The data must be copied** (§6, step 6).

**`public.intro_demos`**: `game_type text PK`, `seed bigint NOT NULL`, `puzzle jsonb NOT NULL`, `input_log jsonb NOT NULL`, `start_tick int NOT NULL default 0`, `length_ticks int NOT NULL default 480`, `recorded_at timestamptz NOT NULL default now()`, `example_id text`. The rows are recorded by hand in dev practice. **The data must be copied.**

### 2.2 Indexes and unique constraints

| Table | Index / constraint |
|---|---|
| duels | PK `id`; UNIQUE `room_code` |
| duel_players | PK; UNIQUE `(duel_id, player_slot)` (table constraint, plus the identical `duel_players_duel_slot_key`); UNIQUE `duel_players_duel_user_key (duel_id, user_id)`; `idx_duel_players_duel (duel_id)` |
| round_results | PK; UNIQUE `(duel_id, player_slot, round_number)` (plus the duplicate `round_results_duel_slot_round_key`); `idx_round_results_duel (duel_id)` |
| room_messages | PK; `room_messages_duel_created_idx (duel_id, created_at DESC)` |
| unblock_bank | PK; UNIQUE `layout`; `unblock_bank_last_used_idx (last_used_at NULLS FIRST)` |
| duel_secrets, room_reports, intro_demos | PK only |

Gap to consider (not a migration blocker): no index on `duels.host_user_id`. `createRoomFn` and `startRoomFn` filter and sort by `host_user_id, created_at`.

### 2.3 Grants and RLS (RLS is enabled on all 8 tables)

- `anon` and `authenticated` hold **no write privileges** on any table. `authenticated` has `SELECT` on `duels`, `duel_players`, `round_results` and `room_messages`. `anon` and `authenticated` have `SELECT` on `intro_demos`. `service_role` has `ALL` on everything, plus `USAGE, SELECT` on `unblock_bank_id_seq`.
- `duel_secrets`, `room_reports` and `unblock_bank` have RLS on and **no policies**, so only `service_role` can reach them.

| Table | Policy | Kind | Rule |
|---|---|---|---|
| duels | "Participants can read their duel" | permissive SELECT, authenticated | `is_duel_participant(id)` |
| duels | "No client writes to duels" | **RESTRICTIVE** ALL, anon+authenticated | `USING (true) WITH CHECK (false)` |
| duel_players | "Participants can read players of their duel" | permissive SELECT | `is_duel_participant(duel_id)` |
| duel_players | "No client writes to players" | RESTRICTIVE ALL | as above |
| round_results | "Participants can read own results and finished rounds" | permissive SELECT | `is_duel_participant(duel_id) AND (player_slot = my_duel_slot(duel_id) OR duel_round_ended(duel_id, round_number))` |
| round_results | "No client writes to results" | RESTRICTIVE ALL | as above |
| room_messages | "Participants can read messages of their room" | permissive SELECT | `is_duel_participant(duel_id)` |
| room_messages | "No client writes to messages" | RESTRICTIVE ALL | as above |
| intro_demos | "Intro demos are public" | permissive SELECT, anon+authenticated | `true` |

### 2.4 Database functions (all `SECURITY DEFINER`, `search_path = public`)

| Function | Returns | Purpose | EXECUTE granted to |
|---|---|---|---|
| `is_duel_participant(_duel_id uuid)` | bool (sql, STABLE) | Caller has a player row (`auth.uid()`). | authenticated, service_role |
| `my_duel_slot(_duel_id uuid)` | int (sql, STABLE) | Caller's slot. | authenticated, service_role |
| `duel_round_ended(_duel_id uuid, _round int)` | bool (sql, STABLE) | Latest version (20261005031307): participant **and** (finished, or a later round, or phase in reveal/result/standings). | authenticated, service_role. **Note:** the latest `CREATE OR REPLACE` did not re-run REVOKE/GRANT. Postgres keeps existing ACLs on replace, so the effective ACL should be unchanged. Verify it on the live DB before you dump. |
| `restart_duel_room(p_room_id uuid, p_host_id uuid)` | bool (plpgsql) | Rematch. Archives the winner and Word Match prompts into `tournament_history`. Deletes the room's results and secrets and its `left` players, resets the room. (This deletes a room's own rows on rematch; it is existing behaviour, not a migration.) | service_role only |
| `disband_stale_room(p_room_id uuid)` | bool (plpgsql) | Disbands a waiting room whose host was last seen more than 2 minutes ago. | service_role only |

**No triggers, no views, no enums, no sequences other than `unblock_bank_id_seq`.**

### 2.5 Realtime

- Publication `supabase_realtime` includes **`duels`, `duel_players`, `round_results`, `room_messages`**, all with `REPLICA IDENTITY FULL`. On a fresh project, run `ALTER PUBLICATION supabase_realtime ADD TABLE …` again; the first migration does this.
- Channel `duel-<roomCode>` (`useDuel.ts`): `postgres_changes` `*` on `duels`, `duel_players` and `round_results`, **with no `filter`**. RLS decides delivery and the client discards other rooms. It works, but every change in every room is RLS-checked for every subscriber. A `filter: 'duel_id=eq.<id>'` (and `id=eq.` for duels) would scale better. That is a later, optional change.
- Channel `room-chat-<roomId>` (`useRoomChat.ts`): `postgres_changes` INSERT on `room_messages` (no filter) plus **Broadcast** event `reaction` (`self: true`). Broadcast authorization is not enabled (public channel). Any client that knows the room id could broadcast a reaction; the server-side `allowReactionFn` gate is advisory. This matches today's behaviour.
- No Presence is used.

### 2.6 Storage

**No storage buckets are used.** No `supabase.storage` calls exist; all art is code-drawn or bundled.

### 2.7 Auth

- **Anonymous sign-in must be enabled** (`supabase.auth.signInAnonymously()` in `session.ts`). Every device gets an `auth.users` row. No email, OAuth or magic-link flow exists yet.
- Recommended on the new project: enable CAPTCHA/Turnstile or rate limits for anonymous sign-ins (Supabase recommends this for anonymous auth). Site URL `https://brain-blitz-duel.lovable.app` (plus any custom domain). No redirect URLs are needed until real sign-in exists.
- JWT: the server validates with `getClaims`, which works with both the legacy JWT secret and the new asymmetric signing keys. The app code already handles the new `sb_publishable_` / `sb_secret_` key formats.
- Existing anonymous identities **will not carry over** unless `auth.users` is migrated, and that also needs the same JWT secret (§6, R5). Consequence: devices get new user ids, and hosts lose the "recent rooms" anti-repeat history. Stored rows keep their old `user_id`s untouched.

### 2.8 Secrets and environment variables Lovable Cloud manages (names only)

| Name | Used by | On the new stack |
|---|---|---|
| `SUPABASE_URL` | server and SSR client | Auto-injected into Edge Functions |
| `SUPABASE_PUBLISHABLE_KEY` | auth middleware, intro demo read | Not auto-injected under this name; use `SUPABASE_ANON_KEY` (injected) or set it as a secret. Supabase **reserves the `SUPABASE_` prefix** for custom secrets, so the code should read the injected name. |
| `SUPABASE_ANON_KEY` | intro demo fallback | Auto-injected |
| `SUPABASE_SERVICE_ROLE_KEY` | admin client; **practice seal key material** | Auto-injected. Recommend a dedicated `PRACTICE_SEAL_KEY` secret, so that rotating the service key does not change the seal. Changing the key only breaks practice puzzles in flight. |
| `SUPABASE_PROJECT_ID` | `.env` only | Front-end build var |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` | browser client (Vite build-time) | Point at the new project when the front end switches |
| `INTRO_DEMO_KEY` | demo save and dev key check | Set as an Edge Function secret |
| `LOVABLE_CRON_SECRET`, `LOVABLE_CRON_SECRET_PREVIOUS` | `cron-auth.ts` (unused) | Not needed |

`.env` (committed) holds only the public URL, project id and publishable key for the current Lovable project. `supabase/config.toml` holds `project_id = "minlikhzjmfvuexouebw"`.

---

## 3. Puzzle generation cost

**Method.** All 68 active types come from `typesInCategory` over all categories; memory is excluded, so `RETIRED_TYPES` are excluded too. Each type ran in a **fresh process**, so the first call includes lazy initialisation (dictionary parse, bank decode). It made 20 calls of `generatePuzzle(type, {})` under `withSeededRandom(seed)` for seeds 7919…158380, which makes the results reproducible. Production draws from the CSPRNG instead, so the seeds sample the same distribution. Unblock used the file bank (no DB row); production draws a DB row, at the same cost plus one query.

Two runtimes were used: **Deno 2.9.6 / V8 15.0** (the engine family of the Supabase Edge Runtime) and **Bun 1.4.2 / JavaScriptCore**. Times are CPU-bound wall time on this container's CPU. Treat them as relative; production CPUs can be slower. **Flagged** means worst > 500 ms; *watch* means worst > 100 ms.

| Category | Game (`id`) | Deno median ms | Deno worst ms | Bun median ms | Bun worst ms | >500 ms? |
|---|---|---:|---:|---:|---:|---|
| logic | Blackout (`lightsout`) | 0.22 | 1.2 | 0.18 | 1.8 |  |
| logic | Pipeline (`pipes`) | 0.17 | 1.5 | 0.11 | 1.5 |  |
| logic | Box Six (`sudoku`) | 0.56 | 3.3 | 0.52 | 2.5 |  |
| logic | Chroma Lines (`flow`) | 757 | 5691 | 987 | 6781 | **YES** |
| logic | Heave (`push`) | 0.00 | 0.33 | 0.00 | 0.36 |  |
| logic | Hanoi (`tower`) | 205 | 245 | 230 | 291 | watch |
| logic | Polypotions (`tubes`) | 208 | 2541 | 186 | 2047 | **YES** |
| logic | Safe Cracker (`safe`) | 21 | 80 | 17 | 74 |  |
| logic | Bomb Defusal (`bomb`) | 0.02 | 0.65 | 0.01 | 1.9 |  |
| logic | Mosaic (`nonogram`) | 2.3 | 21 | 1.2 | 26 |  |
| logic | Colour Flood (`flood`) | 0.01 | 0.53 | 0.00 | 0.39 |  |
| logic | Tents and Trees (`tents`) | 0.66 | 10 | 0.53 | 4.4 |  |
| logic | Shikaku (`shikaku`) | 1.1 | 14 | 0.96 | 15 |  |
| logic | Lamplighter (`lightup`) | 101 | 640 | 112 | 739 | **YES** |
| pattern | Gridlock (`unblock`) | 0.02 | 0.55 | 0.01 | 2.3 |  |
| pattern | Tessellate (`blockparty`) | 1161 | 3802 | 1081 | 3749 | **YES** |
| pattern | Skid (`iceslide`) | 151 | 707 | 116 | 545 | **YES** |
| pattern | Lightbender (`laser`) | 2.1 | 7.5 | 2.3 | 8.7 |  |
| pattern | Topsy-Turvy (`gravity`) | 170 | 1387 | 165 | 2015 | **YES** |
| pattern | Jumbled (`tiles`) | 0.63 | 15 | 0.52 | 11 |  |
| pattern | Turntable (`rings`) | 6.5 | 25 | 8.7 | 35 |  |
| speed | Flash (`reaction`) | 0.59 | 4.8 | 0.33 | 2.9 |  |
| speed | Ascend (`numhunt`) | 0.78 | 4.6 | 0.58 | 2.8 |  |
| speed | Bang On (`stopwatch`) | 0.02 | 0.55 | 0.01 | 0.54 |  |
| speed | Don't Break the Chain (`chain`) | 0.61 | 3.4 | 0.31 | 2.5 |  |
| speed | Bonk (`whack`) | 0.00 | 0.35 | 0.00 | 0.53 |  |
| speed | Pull! (`clayshoot`) | 0.00 | 0.63 | 0.00 | 0.36 |  |
| attention | Mixed Signals (`stroop`) | 0.00 | 0.45 | 0.00 | 0.36 |  |
| attention | Eagle Eye (`symscan`) | 0.08 | 0.76 | 0.05 | 0.93 |  |
| attention | Double Take (`spotdiff`) | 0.12 | 1.1 | 0.09 | 1.2 |  |
| attention | Tally (`countup`) | 1.5 | 6.9 | 1.8 | 5.8 |  |
| attention | Labyrinth (`maze`) | 14 | 51 | 13 | 45 |  |
| attention | Interloper (`intruder`) | 0.07 | 0.89 | 0.07 | 1.0 |  |
| attention | Matchmaker (`pairmatch`) | 0.04 | 0.58 | 0.04 | 0.54 |  |
| word | Nucleus (`wordsmith`) | 6.3 | 103 | 5.2 | 76 | watch |
| word | Interlock (`tilegrid`) | 0.87 | 69 | 0.81 | 49 |  |
| word | Slider (`wordslide`) | 0.02 | 70 | 0.03 | 43 |  |
| word | Forage (`wordhunt`) | 8.1 | 154 | 8.4 | 124 | watch |
| word | Lookout (`wordsearch`) | 0.01 | 0.38 | 0.00 | 0.37 |  |
| word | Roundabout (`letterwheel`) | 0.00 | 0.44 | 0.00 | 0.35 |  |
| number | Counterweight (`balance`) | 0.59 | 3.2 | 0.53 | 2.8 |  |
| number | Exact (`target`) | 6.7 | 127 | 8.1 | 128 | watch |
| number | Operator (`equation`) | 0.28 | 4.1 | 0.20 | 1.5 |  |
| number | Tenfall (`tendrop`) | 0.00 | 0.33 | 0.00 | 0.38 |  |
| number | Integer Pyramid (`numpyramid`) | 0.01 | 0.33 | 0.01 | 0.44 |  |
| number | Trail (`trail`) | 0.00 | 0.40 | 0.00 | 0.45 |  |
| arcade | Hover (`hover`) | 0.00 | 0.32 | 0.00 | 0.52 |  |
| arcade | High Rise (`skyline`) | 0.00 | 0.35 | 0.00 | 0.42 |  |
| arcade | Swish (`bintoss`) | 0.00 | 0.42 | 0.00 | 0.40 |  |
| arcade | Flightpath (`bullseye`) | 0.01 | 0.44 | 0.01 | 0.42 |  |
| arcade | Gemstone (`matchup`) | 0.00 | 0.36 | 0.00 | 0.40 |  |
| arcade | Breaker (`breaker`) | 0.00 | 0.36 | 0.00 | 0.38 |  |
| arcade | Rally (`rally`) | 0.00 | 0.31 | 0.00 | 0.48 |  |
| arcade | Slice (`slice`) | 0.00 | 0.33 | 0.00 | 0.57 |  |
| arcade | Coral Pop (`bubble`) | 0.00 | 0.48 | 0.00 | 0.39 |  |
| arcade | Tempo (`beat`) | 0.00 | 0.36 | 0.00 | 0.36 |  |
| arcade | Meteor (`snake`) | 0.00 | 0.33 | 0.00 | 0.42 |  |
| arcade | Jaywalk (`cross`) | 0.00 | 0.32 | 0.00 | 0.38 |  |
| arcade | Wavefront (`wavefront`) | 0.00 | 0.34 | 0.00 | 0.34 |  |
| arcade | Roofbound (`flip`) | 0.00 | 0.33 | 0.00 | 0.42 |  |
| arcade | Junction (`junction`) | 0.00 | 0.35 | 0.00 | 0.42 |  |
| arcade | Rainbow Bridge (`inkbridge`) | 0.00 | 0.62 | 0.00 | 0.37 |  |
| arcade | Fission (`burst`) | 0.00 | 0.31 | 0.00 | 0.34 |  |
| arcade | Orbit (`orbit`) | 0.07 | 0.66 | 0.02 | 0.69 |  |
| arcade | Grappler (`swing`) | 0.00 | 0.43 | 0.00 | 1.0 |  |
| arcade | Scrumper (`snip`) | 0.00 | 0.37 | 0.00 | 0.55 |  |
| arcade | Tilt (`tilt`) | 0.00 | 0.35 | 0.00 | 0.36 |  |
| arcade | Ball Tracker (`balltrack`) | 0.02 | 0.58 | 0.01 | 0.41 |  |

### 3.1 What the 2 s CPU limit means for `startRoomFn`

A room start runs `buildRoomPuzzles` for **one type per selected category, up to 7, in one request**. All CPU spent in the request counts against 2 s (DB awaits do not).
- Worst realistic draw: Chroma Lines (logic) plus Tessellate (pattern). That is 5.7 s + 3.8 s ≈ **9.5 s of CPU**, about 5× the limit.
- Even the medians are tight. Chroma Lines (0.76 s) plus Tessellate (1.16 s) ≈ 1.9 s before the other five rounds.
- Chance per room (assuming a uniform draw; the real draw avoids recent orders): logic draws a flagged game (`flow`, `tubes`, `lightup`) 3/14 of the time, and pattern draws one (`blockparty`, `gravity`, `iceslide`) 3/7 of the time. That gives 1 − (11/14 × 4/7) ≈ **55 % of standard rooms with at least one flagged game**. Most of those stay under 2 s on a typical seed; the failures come from the bad seeds and the flow-plus-blockparty pairings.
- Practice (`practiceGenerateFn`) generates one puzzle per request. Chroma Lines and Tessellate still exceed 2 s on bad seeds.

**Precomputed-bank candidates (worst > 500 ms):** Chroma Lines (`flow`), Tessellate (`blockparty`), Polypotions (`tubes`), Topsy-Turvy (`gravity`), Lamplighter (`lightup`), Skid (`iceslide`). Hanoi (`tower`, ~200–250 ms on every seed) is borderline; bank it too if it shares a request with others. Follow the existing pattern: `scripts/<game>-bank.ts` writes a `*Bank.server.ts`, and the generator picks a row by seed. Under **rule 2**, if the banked boards differ from what the live generator would produce (different difficulty filter or rules), stamp them (e.g. `flowRev`). Unstamped stored rounds must keep grading exactly as now. The grader replays moves against the stored board, so existing rounds are unaffected either way.

Fallback options if banks are not ready in time:
- Generate each round in its own invocation, so the CPU budget is per puzzle. This still fails for `flow` and `blockparty` worst cases.
- Keep `startRoomFn` and `practiceGenerateFn` on a host without the 2 s cap (see §6, step 3).

### 3.1a Update (11 Oct 2026): the six flagged games are banked

Chroma Lines, Tessellate, Polypotions, Topsy-Turvy, Lamplighter and Skid now draw rooms and practice from committed banks of 1,000 boards each (`src/lib/duel/puzzleBank.server.ts`, built by `scripts/<game>-bank.ts`). Each board is the live generator's output under a fixed seed, re-verified with the generator's own rules. The room seed picks the board, and boards from the host's last 20 rooms are skipped. An empty bank falls back to capped live generation. The stored puzzle shape is unchanged, so there is no stamp. Measured the same way as §3 (60 seeded 7-category rooms in one process; composite = each category's slowest type at its worst):

| | Bun before | Bun after | Deno before | Deno after |
|---|---:|---:|---:|---:|
| Room median | 307 ms | 10 ms | 211 ms | 9 ms |
| Room p95 | 3,890 ms | 341 ms | 3,029 ms | 226 ms |
| Worst room | 6,605 ms | 451 ms | 5,957 ms | 276 ms |
| Worst composite room | 14,986 ms | 697 ms | 8,834 ms | 525 ms |
| Slowest banked draw | — | 0.45 ms | — | 0.22 ms |

Hanoi (`tower`, ~250–365 ms worst) is now the largest single cost. The Bun ESM server bundle grew from 4.91 MB to 6.83 MB; the six bank files total 2.1 MB of source.

### 3.2 Existing banks

| Game | Bank | Entries | Source size |
|---|---|---:|---:|
| **Gridlock** (`unblock`) | DB table `unblock_bank` (live, LRU draw over 100) + fallback `unblockBank.server.ts` | DB rows: **not measurable from here** (Lovable DB); file fallback **400** (15–22 moves) | 65 KB |
| **Bomb Defusal** (`bomb`, v2) | `bombBank.server.ts` `BOMB_V2_BANK` | **300** | 252 KB |
| **Orbit** (`orbit`, rev 3) | `orbitRev3Bank.server.ts` `ORBIT_REV3_BANK` (+ `orbitRev3Course.server.ts`) | **504** | 727 KB |
| **Grappler** (`swing`, v3) | `swingBank.server.ts` `SWING_V3_BANK` (live `proveSwingSeed` only as a fallback) | **504** | 17 KB |
| Ball Tracker | `ballTrackBank.server.ts` | 400 | 392 KB |
| Integer Pyramid | `numberPyramidBank.server.ts` | 400 | 300 KB |
| Lookout | `wordSearchBank.server.ts` | 500 | 214 KB |
| Dig (retired) | `digBank.server.ts` | 300 | 210 KB |
| Colour Flood | `floodBank.server.json` | 400 | 185 KB |
| Roundabout | `letterWheelBank.server.ts` | 300 | 142 KB |
| Trail | `trailBank.server.ts` | 300 | 85 KB |
| Heave | `pushBank.server.ts` | 120 | 53 KB |
| Dictionary | `wordlist.server.ts` (SCOWL British, 58,287 common words) | 1 string | 951 KB |

---

## 4. Arcade grading cost

### 4.1 Supabase Edge Function limits

`supabase.com` **could not be fetched from this environment**: the network policy fails DNS for it. The figures below come from a web search that returned the official limits page (supabase.com/docs/guides/functions/limits). They were **not read directly; confirm them in the docs or dashboard**:

| Limit | Value |
|---|---|
| Memory | 256 MB |
| CPU time per request (excludes async I/O) | **2 s** |
| Wall clock per worker | 150 s (Free) / 400 s (paid) |
| Request idle timeout | 150 s (then 504) |
| Bundle size (after CLI bundling) | 20 MB |
| Functions per project | Free 100 / Pro 500 / Team 1000 |
| Over CPU or memory | HTTP 546 `WORKER_LIMIT` |

### 4.2 Worst-case full-log replay

**Method.** For each active engine game (22 arcade, plus Pull!, Bonk, Tenfall and Mixed Signals), I generated a real stored puzzle with current stamps (Orbit rev 3, Grappler v3, Rainbow Bridge rev 3, and so on). I then built the **largest log the server accepts**: one in-range input event on **every tick** of the run, capped at `MAX_INPUT_EVENTS` = 6,000 (taps for Hover and High Rise, capped at `MAX_INPUT_TAPS`). `endTick` was 0, so the server replays the full run length, with no client checkpoints. The log went through the real `gradeAnswer` path: replay, desync bookkeeping and `buildArcadeReveal`. I used 5 seeds per game and a fresh process per game. "Heap peak" is the V8 heap after grading, including all loaded modules (about 45–50 MB at rest); "delta" is what grading added.

| Game (`id`) | Run length | Log size (chars) | Deno median ms | Deno worst ms | Deno heap peak / delta MB | Bun median ms | Bun worst ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| Hover (`hover`) | 3600 ticks (60 s) | 16,906 | 2.6 | 9.1 | 56 / 4 | 2.6 | 6.7 |
| High Rise (`skyline`) | 3600 ticks (60 s) | 16,906 | 2.7 | 6.6 | 58 / 5 | 1.7 | 5.8 |
| Swish (`bintoss`) | 3600 ticks (60 s) | 77,217 | 14 | 28 | 80 / 28 | 7.8 | 19 |
| Flightpath (`bullseye`) | 2700 ticks (45 s) | 58,165 | 8.4 | 18 | 66 / 13 | 8.3 | 19 |
| Gemstone (`matchup`) | 3600 ticks (60 s) | 52,906 | 13 | 37 | 80 / 28 | 7.1 | 26 |
| Breaker (`breaker`) | 5400 ticks (90 s) | 87,217 | 27 | 39 | 87 / 34 | 14 | 33 |
| Rally (`rally`) | 3600 ticks (60 s) | 59,129 | 9.8 | 25 | 67 / 14 | 6.4 | 22 |
| Slice (`slice`) | 3600 ticks (60 s) | 67,000 | 22 | 45 | 84 / 31 | 14 | 32 |
| Coral Pop (`bubble`) | 5400 ticks (90 s) | 117,372 | 38 | 59 | 82 / 30 | 49 | 68 |
| Tempo (`beat`) | 3600 ticks (60 s) | 54,706 | 16 | 32 | 82 / 30 | 9.2 | 21 |
| Meteor (`snake`) | 3600 ticks (60 s) | 52,906 | 12 | 24 | 79 / 27 | 7.2 | 21 |
| Jaywalk (`cross`) | 3600 ticks (60 s) | 52,906 | 30 | 54 | 91 / 39 | 29 | 64 |
| Wavefront (`wavefront`) | 3600 ticks (60 s) | 59,129 | 19 | 36 | 84 / 31 | 8.9 | 20 |
| Roofbound (`flip`) | 3600 ticks (60 s) | 52,906 | 35 | 50 | 89 / 36 | 28 | 46 |
| Junction (`junction`) | 3600 ticks (60 s) | 56,506 | 12 | 23 | 77 / 25 | 8.4 | 18 |
| Rainbow Bridge (`inkbridge`) | 7200 ticks (120 s) | 105,228 | 214 | 421 | 92 / 40 | 404 | 643 |
| Fission (`burst`) | 5400 ticks (90 s) | 84,517 | 22 | 31 | 90 / 38 | 10 | 22 |
| Orbit (`orbit`) | 5400 ticks (90 s) | 79,906 | 18 | 32 | 84 / 31 | 8.8 | 21 |
| Grappler (`swing`) | 3600 ticks (60 s) | 54,708 | 29 | 51 | 78 / 25 | 19 | 41 |
| Scrumper (`snip`) | 3600 ticks (60 s) | 84,980 | 25 | 46 | 90 / 37 | 14 | 30 |
| Tilt (`tilt`) | 5400 ticks (90 s) | 97,812 | 25 | 37 | 91 / 39 | 10 | 32 |
| Ball Tracker (`balltrack`) | 3600 ticks (60 s) | 59,536 | 13 | 27 | 75 / 22 | 9.6 | 22 |
| Pull! (`clayshoot`) | 3600 ticks (60 s) | 68,821 | 22 | 36 | 79 / 27 | 12 | 28 |
| Bonk (`whack`) | 3600 ticks (60 s) | 57,856 | 16 | 33 | 84 / 31 | 5.7 | 22 |
| Tenfall (`tendrop`) | 5400 ticks (90 s) | 94,996 | 28 | 39 | 79 / 26 | 9.9 | 25 |
| Mixed Signals (`stroop`) | 4500 ticks (75 s) | 74,164 | 2.9 | 6.8 | 60 / 8 | 1.5 | 7.2 |

**Verdict.** Every game fits inside 2 s of CPU and 256 MB with a wide margin, except Rainbow Bridge, which uses ~20 % of the CPU budget in the worst case. Realistic play is far cheaper. The repo's `arcade-self-replay-check` (realistic random play, runs end at game over) shows a worst replay of 0.2–37 ms per game under Deno. One grading request plus the DB round-trips fits comfortably. The full arcade payload is at most about 120 KB per submit, and the server caps it at 400,000 characters.

### 4.3 Cross-engine determinism (rule 1)

The repo's `arcade-self-replay-check.ts` logic (a copy in scratch, with a dump/load hook added) drove 20 runs for each of 29 sims under **Bun/JSC** and saved the logs, scores and checkpoints. It then replayed all **580 runs under Deno/V8**: **0 mismatches** in score or in the full checkpoint list. The same check run natively under Deno also passed 31/31 game variants. This supports moving grading to Deno without regrading drift. Production today already runs on V8 (Workers), so this is belt and braces.

---

## 5. Shared code and keeping one source

### 5.1 What is shared

I built bundle graphs of the client (all `src/routes/*.tsx`, with server functions stubbed as RPC) and the server (the five `*.functions.ts` with every dynamic import followed):
- Client: **365** `src/` modules. Server: **380**. **Shared: 311.** Server-only: **69**.
- Shared rules and sims include all of `src/lib/arcade/*.ts` sims and `engine.ts` (86 modules). From `src/lib/duel/` (89 modules) they include `types.ts`, `registry.ts`, `scoring.ts`, `speedPar.ts`, `stagedRounds.ts`, `random.ts`, `categories.ts`, `gameNames.ts`, `roundSummaries.ts`, `instructions.ts`, `arcadeRun.ts`, `puzzleDemo.ts`, `startPresentation.ts`, `chatConstants.ts`, and every per-game rules module (`<game>.ts`: `flow.ts`, `unblock.ts`, `orbit.ts`, `swing.ts`, `inkBridge.ts`, `wordSearch.ts`, `letterWheel.ts` …).
- **Server-only (69):** the five `*.functions.ts`, `auth-middleware.ts`, `client.server.ts`, `grade.ts`, `secrets.ts`, `selection.ts`, `puzzles.ts`, `arcade/reveal.ts`, every `*.server.ts` generator and bank, `dictionary.server.ts`, `wordlist.server.ts`, `profanity.server.ts` and `floodBank.server.json`.
- **The server graph also pulls in UI.** `registry.ts` imports every `src/puzzles/<game>.tsx`, and through those 29 `src/components/**` files, React hooks and JSX. It also reaches 41 `src/lib/arcade/*.renderer.ts` art modules: through the puzzle modules, and through `practice.functions.ts` → `revealRenderers.ts` for the demo-save type check. None of that UI code runs during generation or grading. It costs bundle size (the bundle is 4.96 MB minified, 1.3 MB gzip) and cold-start parse time. The arcade AGENTS rule "renderers are never imported by the sim or server" holds for the sim modules, but not for the server's transitive graph.

### 5.2 Keeping one source with Deno Edge Functions

Recommended: **bundle at build time, never fork.**
1. Keep all code in `src/` exactly as now. Add thin Edge entry files (for example `supabase/functions/duel/index.ts`) that import the same handler logic. Factor each `createServerFn` body into a plain `async function (input, ctx)` in a shared `*.handlers.server.ts`. Then TanStack (while Lovable still serves it) and the Edge entry call the **same** function.
2. Build each Edge Function with `bun build --target=browser --format=esm` (as this audit did) into `supabase/functions/<fn>/index.js`, then `supabase functions deploy`. Verified: the 4.96 MB bundle runs under plain `deno run --no-config`. Load took 135–360 ms; the first Nucleus generation took 92–111 ms; heap was 44–50 MB at rest. Mark `@supabase/supabase-js` as `npm:` or bundle it.
3. The alternative is Deno resolving the source directly. That needs `deno.json` with `"imports": {"@/": "../../src/"}`, `"unstable": ["sloppy-imports"]`, JSX settings and the JSON-attribute fix. It works locally (verified: 1.6 s first load including TypeScript transpile), but Supabase's deploy bundler support for sloppy imports outside the functions folder is an assumption I could not test here. The build-step bundle avoids that dependency.
4. Generate the bundles in CI from the same commit. Never commit hand-edited copies. A check should fail if `supabase/functions/*/index.js` is stale.
5. Optional, later: split `registry.ts` into a rules-only registry (generate, grade, summaries, answers, durations) and a UI registry. The server bundle would then lose React and the renderers, roughly halving size and cold start. This touches many files; do it as its own change, guarded by the room/practice parity checks.

### 5.3 Client call sites to switch

`src/lib/duel/api.ts` (17 room functions), `src/lib/duel/useRoomChat.ts` (chat), `src/lib/duel/clock.ts` (time), `src/routes/practice.tsx` (practice), `src/components/duel/IntroDemo.tsx` and `PuzzleDemo.tsx` (intro demo), `src/components/duel/SaveDemoButton.tsx` (dev save). A single `callEdge(name, input)` helper (`supabase.functions.invoke` attaches the session JWT) can replace the RPC stubs with the same input and output shapes.

---

## 6. Migration plan (in order)

Steps marked **[Joe]** need Joe: dashboard clicks, keys, DNS, or Lovable access.

1. **[Joe] Decide the hosting split.** Edge Functions replace only the server functions. The React front end still needs a host: Lovable, or any static/SSR host. Both routes (`/duel/$code`, `/practice`) are `ssr: false`, so a static SPA build is possible.
   - **[Joe]** Ask Lovable whether a Lovable project can point at an external Supabase project, and whether Lovable will keep editing `src/integrations/supabase/*` (R3).
   - Agree who holds the branch (CLAUDE.md rule).
2. **[Joe] Create the Supabase project** in **London (`eu-west-2`)**, on a paid plan: 400 s wall clock, daily backups, no auto-pause.
   - **[Joe]** Copy the project ref, URL, anon/publishable key and service/secret key into the deploy environment's secret store. Never paste them into the repo or chat.
   - **[Joe]** Enable **Anonymous sign-ins** (Auth → Providers) and CAPTCHA/rate limits for them.
   - **[Joe]** Set the Site URL.
3. **Fix the CPU blocker before any cutover.** Build banks (with stamps where rule 2 requires them) for `flow`, `blockparty`, `tubes`, `gravity`, `lightup`, `iceslide`, and probably `tower`.
   - Re-measure with this audit's method: every active type's worst case < 500 ms, and the worst 7-category room < 1.5 s.
   - Until then, the safe interim is to keep `startRoomFn` and `practiceGenerateFn` on the current host.
4. **Recreate the schema.** Run all 26 `supabase/migrations/*.sql` in order against the new project (`supabase link` + `supabase db push`, **[Joe]** for the DB password).
   - Two migrations `DELETE`/`UPDATE` rows. On an empty DB they are no-ops, which is fine.
   - Then compare policies, grants and function ACLs against the live Lovable DB with `pg_dump --schema-only` (needs **[Joe]**: Lovable DB access, see R1).
   - Confirm Realtime publication membership for the four tables.
5. **Set Edge Function secrets.** **[Joe]** `supabase secrets set INTRO_DEMO_KEY=…` and the recommended `PRACTICE_SEAL_KEY=…`. `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.
6. **Copy reference data exactly** (rule 4: copy, never transform):
   - `unblock_bank` with all columns, including `last_used_at` and `id`. Reset the sequence.
   - `intro_demos` with all rows unchanged.
   - Use `pg_dump --data-only -t` and `pg_restore`, then verify with row counts plus `md5(string_agg(row::text …))` on both sides. **[Joe]** for Lovable DB access.
7. **Decide on historical rooms.** Options: (a) copy `duels`, `duel_players`, `round_results`, `duel_secrets`, `room_messages` and `room_reports` byte-for-byte with the same checksum verification; or (b) leave them archived on Lovable Cloud and export a dump for safekeeping. Either way, nothing is regraded or rewritten. I recommend (a) only if hosts' recent-room history or results history matters; otherwise (b).
8. **Port the server functions** (§5.2): shared handler bodies, Edge entry files, bundling, CORS, auth via `getClaims` (anonymous JWTs are valid), and `verify_jwt` on the authenticated functions. The public ones (`practice-*`, `intro-demo`, `time`) need `verify_jwt = false`, or must accept the anon key.
   - Group the functions to limit cold starts, e.g. `room` (all room functions dispatched by name), `chat`, `practice`, `public` (time, intro demo).
   - Pin invocations to the London region (the `x-region` / `forceFunctionRegion` option; confirm it in the docs). Edge Functions otherwise run near the caller, far from the DB, and every room function makes 3–8 sequential DB calls.
9. **Verify on staging without touching live data.**
   - Run `bun scripts/run-checks.ts` (all 83 checks) on the branch.
   - Run the cross-engine replay proof (§4.3) against the **bundled** Edge code.
   - **Shadow-grade** a sample of stored `round_results`: read each stored answer and puzzle, grade with the Edge bundle **in memory only**, and compare to the stored score. This is read-only; it never writes and never regrades a stored row.
   - Then run end-to-end rooms (2–10 players), practice, chat, reactions, rematch, disband and intro demos against the staging project. **[Joe]** for phone testing.
10. **[Joe] Point the front end at the new project.** Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PROJECT_ID`, and update `.env` and `supabase/config.toml`. Merge to `main` and press **Publish** in Lovable (pushing a branch does not deploy).
    - Expect every device to get a new anonymous identity, and rooms open at cutover to be stranded. **Cut over at a quiet time** and post a notice.
11. **[Joe] DNS (only if moving off `*.lovable.app` or adding a custom domain).** Point the domain at the chosen front-end host and add the domain to the Supabase Auth Site URL / allowed origins. A Supabase custom domain for the API (an add-on) is optional.
12. **Monitor** Edge Function logs for `546` (CPU/memory) and `504`, and track room-start latency. Keep Lovable Cloud read-only for a rollback window (see R8), then **[Joe]** decommission it.

### Risks

- **R1 — Lovable DB access.** Exporting live data (`unblock_bank`, `intro_demos`, any history) and dumping the true live schema needs a connection string or export from Lovable Cloud. I could not confirm that Lovable provides one. **[Joe]** must ask. Without it, the `intro_demos` rows would have to be re-recorded, and the `unblock_bank` rows rebuilt from `scripts/unblock-bank.ts`. That would be a *new* bank, not a copy of the old one.
- **R2 — CPU limit on generation** (§3). It is the only measured hard blocker.
- **R3 — Lovable regenerating integration files.** `src/integrations/supabase/*` is marked auto-generated. If Lovable rewrites the client to its own Cloud project on a sync, the app would silently point back. Confirm with Lovable before cutover.
- **R4 — Latency.** Today all server work is one hop from the phone. With Edge Functions not pinned to London, each sequential DB call crosses regions. Pin the region. Consider moving multi-step logic (`advancePhaseFn`, `submitAnswerFn` bookkeeping) into SQL functions later.
- **R5 — Identity reset.** Anonymous users do not migrate unless `auth.users` and `auth.identities` are copied **and** the new project uses the same JWT signing secret. That needs Supabase support or a manual auth-schema import. The recommendation is to accept the reset; nothing gameplay-critical depends on old identities.
- **R6 — Shared clock and receipt time.** `submitAnswerFn` compares the claimed time with the server's `Date.now()` minus the stored `phase_started_at`. Both stamps come from the function host's clock, so this works on Edge too. Cold starts add RTT noise; `clock.ts` already keeps the lowest-RTT of 3 samples.
- **R7 — Concurrency.** Edge workers may serve concurrent requests in one isolate. Today's handlers keep no module-level mutable state, except the synchronous `withSeededRandom` swap (safe) and lazy caches (dictionary Set, banks), which are read-only once built.
- **R8 — Rollback.** Writes after cutover land only in the new DB. Rolling back to Lovable Cloud would lose them. Keep the rollback window short, and decide in advance that rooms played after cutover are not migrated back.
- **R9 — Limits unverified here.** The Supabase limits came from search results because supabase.com was unreachable from this container. Re-read the limits page before planning around them.

### Assumptions made (no questions were asked)

- "Active puzzle type" means the 68 types the room draw can produce (`typesInCategory`). Memory and retired types are excluded.
- "Active arcade sim" means the 22 arcade-category games, plus the four engine-driven games in other categories (Pull!, Bonk, Tenfall, Mixed Signals), since they replay the same way.
- "Worst-case full input log" means the maximum the server accepts: an event on every tick up to 6,000, with a full-length replay.
- Gridlock is `unblock`, Bomb Defusal is `bomb`, Orbit is `orbit` and Grappler is `swing`, per `gameNames.ts`.
- The production host is taken to be Workers-like (Nitro/Cloudflare), inferred from `vite.config.ts`; not confirmed with Lovable.

### How the numbers were produced

The scripts lived in the session scratchpad, not the repo. They were: `gen-one.ts` (generation), `arc-one.ts` (arcade worst case), `graph.ts` (shared-module graph via `Bun.build` metafiles), a scratch copy of `scripts/arcade-self-replay-check.ts` with a dump/load hook (cross-engine proof), and a bundle-load probe. Deno 2.9.6 was installed into the scratchpad from npm. The repo is unchanged except for this file.
