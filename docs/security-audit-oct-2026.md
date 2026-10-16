# Pre-beta security audit (16 Oct 2026)

For the open beta on 27 Oct 2026 (100–300 strangers). Read from the repo at `main` 3853213: the 27 migrations in
`supabase/migrations/`, every `createServerFn` in `src/`, the Supabase clients in `src/integrations/supabase/`, the
committed `.env`, all 517 commits of git history, and a production client build (`vite build`, `.output/public`).
No game, sim, score, timing, input, replay or version stamp was changed, and nothing was applied to the live database.

**Assumptions** (not visible from the repo, so not verified):

- The live database matches the migrations. Lovable can change the schema outside the repo; if Joe ever ran SQL by
  hand in Lovable Cloud, check the live policies too (see "Needs Joe" below).
- Every player is a Supabase **anonymous** user (`signInAnonymously`, `src/lib/duel/session.ts`), so to Postgres every
  stranger is the `authenticated` role. "Signed-in" below means that; there are no email or password accounts.
- The only Supabase Storage buckets are the ones in the migrations, which means there are none. Sounds and images are
  static files in `public/`.

## Findings

| # | Item | Risk | What a stranger could do | Fix |
|---|------|------|--------------------------|-----|
| 1 | **No rate limit on room creation, room-code lookups or chat reports** (`createRoomFn`, `roomPreviewFn`, `joinRoomFn`, `reportMessageFn`) | Medium | Script thousands of rooms or reports and fill the database. Room codes are 4 letters from 24 (331,776 codes), so a script can try codes until it hits an open lobby and join strangers' rooms (to troll their chat). | **In this PR:** migration `20261016120000_rate_limits.sql` (table `rate_limit_hits`, RLS on, no client grants; function `take_rate_limit`, service role only) and `src/lib/duel/rateLimit.server.ts`. Limits per user: 20 rooms an hour, 60 code lookups (preview and join combined) per 10 min, 20 reports per 10 min. It fails open until the migration is applied, so the code can ship before it. **Needs Joe:** apply the migration. Also see #2. |
| 2 | **Anonymous sign-ups are unlimited per device**, so per-user limits can be dodged by signing in again | Medium | Make a fresh anonymous user for each burst and get around #1 and the chat caps. | **Needs Joe:** in the Supabase / Lovable Cloud Auth settings, check the "anonymous sign-ins" rate limit (Supabase's default is 30 an hour per IP) and consider turning on CAPTCHA (Cloudflare Turnstile) for anonymous sign-ins. Without CAPTCHA, the client also needs a code change. |
| 3 | **Every round's puzzle is readable from the start of the game.** `startRoomFn` writes all rounds' public halves (`duels.puzzles_public`, arcade seeds included) at once, and every room member can `SELECT` the row | Medium | A player who reads the row can see round 6's board during round 1 and solve it offline (puzzle solver or arcade bot) before it starts. **Answers and solutions are not exposed:** they're in `duel_secrets`. | **Needs a decision:** release each round's public half when its round title opens. That's a room-flow change that touches stored rounds, so it isn't in this audit. Low urgency while there's no money play. |
| 4 | **Bots and solvers in general.** Arcade seeds are public by design (the phone runs the sim). Banked boards, and their solutions after grading, can be pulled from practice with no limit. `checkWordFn` and `checkMovesFn` answer every probe during a round with no limit | Medium (beta), High before money play | Script perfect arcade input logs, look up a banked board's solution, or brute-force Lookout word paths through `checkWordFn`. The server still grades everything (players can't submit a score), but a scripted player can get top scores. | **Needs a decision** (it would change inputs, so not in this PR): per-round caps on `checkWordFn` and `checkMovesFn`, rate limits on practice, and the server-timed taps already noted in CLAUDE.md under "Trusted client inputs". See `docs/duelz-anti-cheat.md`. |
| 5 | **Reactions go over a public Realtime broadcast channel** (`room-chat-<roomId>`). The server check (`allowReactionFn`) runs, then the phone broadcasts | Low | Someone who knows the room's id (a UUID only room members get) could skip the server check and broadcast reactions with any name, user id or text, or keep reacting after the host muted them. | **In this PR:** phones now show only the six room emoji and cut the name to 14 characters (`useRoomChat.ts`), so arbitrary text can't be shown. **Later:** Realtime private channels with policies on `realtime.messages`, plus "allow public access" turned off in Realtime settings. |
| 6 | **`reportMessageFn` accepted any message id** | Low | File reports against messages from other rooms, or ones that don't exist, to flood `room_reports`. | **In this PR:** the message must be in the caller's room (checked through the caller's own RLS read), plus the limit in #1. |
| 7 | **Practice seal key fell back to the public Supabase URL** when `SUPABASE_SERVICE_ROLE_KEY` was missing (`practice.functions.ts` `sealKey`) | Low | With a misconfigured server, anyone could decrypt practice answers in the browser. In production the key is set, because every room write needs it, so this was latent. | **In this PR:** a production build refuses to seal without the secret. The dev server, which the browser checks use, keeps the old fallback. **Later:** use a dedicated `PRACTICE_SEAL_KEY`, so rotating the service-role key doesn't also invalidate in-flight practice puzzles. |
| 8 | **Practice and intro-demo functions are unauthenticated** (`practiceGenerateFn`, `practiceGradeFn`, `practiceCheck*`, `getIntroDemoFn`, `checkDemoKeyFn`) | Low | Spend server CPU by generating puzzles in a loop. Every practice Unblock draw also marks a bank board used, which shuffles which board rooms get next. `checkDemoKeyFn` lets anyone guess the demo key with no limit. | **Needs Joe:** make sure `INTRO_DEMO_KEY` is long and random (32+ characters). An edge rate limit (Cloudflare or Lovable) on `/_serverFn` would cover the rest; nothing in the repo can rate-limit callers who aren't signed in. |
| 9 | **Input validators mostly pass input through unchecked** (`.inputValidator((input) => input)`) | Low | Send wrong types (for example a non-UUID `roomId` or an object as `text`) and get a 500. Queries are parameterised, membership is checked, answers are capped (4,000 characters; 400,000 for arcade logs) and chat text is capped at 120, so there's no injection or write outside the caller's own rows. | None needed for beta. Typed validation (zod) can come later. |
| 10 | **Room members can see each other's anonymous auth ids** (`duel_players.user_id`, `room_messages.sender_user_id`, `duels.host_user_id`) | Low | Link the same anonymous player across rooms they share. The ids are random and grant nothing. | None needed. |
| 11 | **Backups and point-in-time recovery not visible in the repo** | Unknown until checked | If the database is lost or a bad write happens, rooms, results and chat could be lost with no way back. | **Needs Joe:** see "Backups" below. |
| 12 | **Live policies may differ from the migrations** | Unknown until checked | If someone edited a policy in the dashboard, anything above could be different live. | **Needs Joe:** run the query in "Needs Joe" and compare the output with the inventory below. |

No high-risk finding: no table lets a stranger write, scores and answers can't be written by any client, and no
secret is in the repo, its history or the client bundle. Nothing needs a key rotation.

## 1. Database inventory (from the migrations)

Grants in the last column are what anonymous (`anon`) and signed-in (`authenticated`) clients may do. Every player
is `authenticated` (anonymous auth). All writes go through server functions using the service role, which bypasses RLS.

| Table | RLS | Client policies | Readable by a stranger? | Writable by a stranger? |
|-------|-----|-----------------|-------------------------|-------------------------|
| `duels` (rooms) | On | SELECT for `authenticated` when `is_duel_participant(id)`; RESTRICTIVE "no client writes" | Only rooms they've joined. Includes `puzzles_public` for every round (finding 3), `round_order`, `tournament_history` and `host_user_id`. No answers. | No (SELECT grant only; writes revoked, and the restrictive policy would block them anyway) |
| `duel_players` | On | SELECT when participant; RESTRICTIVE no writes | Players of rooms they've joined (names, slots, status, `user_id`) | No |
| `round_results` (scores, answers) | On | SELECT when participant AND (own slot OR `duel_round_ended`, i.e. the results screen or later) | Their own row at any time; others' rows only once the round has closed (#43 fix) | No |
| `duel_secrets` (answers / solutions) | On | None; all grants revoked | No | No |
| `room_messages` (chat) | On | SELECT when participant; RESTRICTIVE no writes | Chat of rooms they've joined | No (sent through `sendRoomMessageFn`) |
| `room_reports` | On | None; all grants revoked | No | No |
| `unblock_bank` (Unblock boards and solutions) | On | None | No (only the service role is granted) | No |
| `intro_demos` | On | SELECT for `anon` and `authenticated`, `true` | Yes, by design: the public half of each fixed practice example and its demo input log. Not a room puzzle. | No (no write policy) |
| `rate_limit_hits` (new, this PR) | On | None; all grants revoked | No | No |

**Views:** none. **Storage buckets:** none created by any migration.
**Realtime:** `duels`, `duel_players`, `round_results` and `room_messages` are published for `postgres_changes`, which
applies the same RLS for each subscriber. With `REPLICA IDENTITY FULL` and RLS on, Supabase sends only the primary key
on DELETE events, so nothing leaks on delete. The reaction broadcast channel is public (finding 5).

**SQL functions (RPCs):**

| Function | Who may call it | Notes |
|----------|-----------------|-------|
| `is_duel_participant(uuid)`, `my_duel_slot(uuid)` | `authenticated`, service role | Read-only. They only answer for the caller's own membership. |
| `duel_round_ended(uuid, int)` | `authenticated`, service role | Read-only. Returns false unless the caller is in the room. |
| `restart_duel_room(uuid, uuid)` | Service role only | Rematch. Host checked in SQL and in `rematchFn`. |
| `disband_stale_room(uuid)` | Service role only | Only lobbies whose host has been gone for 2+ minutes. |
| `take_rate_limit(uuid, text, int, int)` (new) | Service role only | Finding 1. |

## 2. Secrets

- **Repo at HEAD:** `.env` is committed (Lovable's convention) and holds only `SUPABASE_URL`, `SUPABASE_PROJECT_ID` and
  the **publishable** key (`sb_publishable_…`), plus their `VITE_` copies. That's expected.
- **Git history (all 517 commits):** searched for JWTs (`eyJ…`), `sb_secret_`, `sk-ant-`, ElevenLabs (`sk_` + hex,
  `xi-api-key`), GitHub and AWS tokens, private keys, and assignments to `*_SERVICE_ROLE_KEY`, `ANTHROPIC_*`,
  `ELEVENLABS_*`, `INTRO_DEMO_KEY` and `LOVABLE_CRON_SECRET`. Nothing found. Both historical versions of `.env` hold
  the same six public names. One AWS-shaped hit (`AKIA…`) is letters inside a Lookout word-search grid.
- **Client bundle** (`vite build`): the publishable key and URL only. No `SUPABASE_SERVICE_ROLE_KEY`, `service_role`,
  `duel_secrets`, `puzzles_private`, `INTRO_DEMO_KEY`, `LOVABLE_CRON_SECRET`, server bank data, grading or move
  checking. The only `sb_secret_` string is Supabase's own key-prefix test.
- **ElevenLabs and Anthropic:** no code uses either. They're mentioned only as a plan in `docs/duelz-master-plan.md`.
- **Server-only secrets the code reads:** `SUPABASE_SERVICE_ROLE_KEY` (`client.server.ts`; it also derives the
  practice seal key), `INTRO_DEMO_KEY` and `LOVABLE_CRON_SECRET(_PREVIOUS)` (`cron-auth.ts`, generated by Lovable and
  unused by any route).
- **Key rotation:** none needed, because nothing leaked.

## 3. Server functions

Unless noted, a function's *auth* is `requireSupabaseAuth` (a valid Supabase JWT; the user id comes from its claims,
never from the input). *Membership* is the server's own check that the caller has a player row in the room. Every
write uses the service role after these checks.

| Function | Auth | Membership / role check | Input validation | Rate limit | Can it write scores, change others' rooms or leak answers? |
|----------|------|-------------------------|------------------|------------|-------------------------------|
| `createRoomFn` | Yes | n/a (caller becomes host) | Name trimmed to 14 characters | **20/h (this PR)** | No |
| `roomPreviewFn` | Yes | None needed (returns state and count only) | Code trimmed to 8 characters | **60/10 min shared with join (this PR)** | No. No names, puzzles or answers. |
| `joinRoomFn` | Yes | Lobby only; room must not be full | Name trimmed to 14 characters | **Shared lookup limit (this PR)** | No |
| `startRoomFn` | Yes | Member and host | Room state | None | No |
| `setRoomModesFn` | Yes | Member and host, lobby only | Categories normalised | None | No |
| `removePlayerFn` | Yes | Host, lobby only, can't remove self | Slot passed through | None | No |
| `leaveRoomFn` | Yes | Writes only the caller's row (a leaving host closes the room) | Pass-through | None | No |
| `disbandRoomFn` | Yes | Host | Pass-through | None | No |
| `checkHostPresenceFn` | Yes | Member | Pass-through | None | No (disbands only a lobby with an absent host) |
| `advancePhaseFn` | Yes | Member; host only for `hostNext` | Pass-through; time-gated and idempotent | None | No |
| `submitAnswerFn` | Yes | Member; writes the caller's own slot only | Answer capped, time claim clamped to the server clock; one row per slot per round | None | No: the server grades and scores, and the client never sends `score` or `is_correct` |
| `readyUpFn`, `continueFn` | Yes | Member; caller's own row | Round clamped | None | No |
| `finishNowFn` | Yes | Member; only the last player still present | Pass-through | None | No |
| `heartbeatFn` | Yes | Caller's own row only | Pass-through | None | No |
| `revealAnswerFn` | Yes | Member | Round must have ended; others' answers only once closed | None | No (fixed in #43; `reveal-window-check`) |
| `rematchFn` | Yes | Member and host | Pass-through | None | No |
| `checkWordFn`, `checkMovesFn` | Yes | Member; live puzzle phase only | Lists and paths capped | None (finding 4) | Verdicts only, never the solution; open to brute force |
| `sendRoomMessageFn` | Yes | Member, not left, not muted | 120 characters, profanity filtered | 1 per 2 s, 30 per room | No |
| `allowReactionFn` | Yes | Member, not muted | Fixed emoji | 1 per second | No (finding 5) |
| `reportMessageFn` | Yes | Member; **message must be in the room (this PR)** | | **20/10 min (this PR)** | No |
| `setPlayerMutedFn` | Yes | Host | Boolean coerced | None | No |
| `roundReplayFn`, `gameReplaysFn` | Yes | Member | Round or game must be closed | None | No |
| `practiceGenerateFn`, `practiceGradeFn`, `practiceCheckWordFn`, `practiceCheckMovesFn` | **None** | n/a: nothing stored | Type checked; answer sealed with AES-GCM | None (finding 8) | No room data touched |
| `getIntroDemoFn` | None (public) | n/a | Type cut to 40 characters | None | Reads public `intro_demos` with the publishable key |
| `checkDemoKeyFn`, `saveIntroDemoFn`, `savePuzzleDemoFn` | `INTRO_DEMO_KEY` (constant-time compare) | Saves need dev mode and the fixed example | Size caps | None (finding 8) | Writes only `intro_demos` |
| `serverTimeFn`, `appVersionFn` | None | n/a | None | None | No |

**Verdict:** no function lets a caller write a score, change a room they're not in, or read an answer before the round
has closed for them.

## 4. Backups

Nothing in the repo shows the backup or point-in-time recovery (PITR) setting. `supabase/config.toml` holds only the
project id, and the database is Lovable Cloud's managed Supabase (project `minlikhzjmfvuexouebw`).
`docs/migration-readiness-oct-2026.md` plans to move to a paid Supabase project *with* daily backups, which suggests
they aren't confirmed today. **Joe needs to check this:**

- In Lovable: the project's **Cloud** tab, under database settings. If backups aren't shown there, ask Lovable support
  whether daily backups and PITR are on for this project and how long they're kept.
- If you can open the Supabase dashboard for the project: **Database → Backups** shows the daily backups (included on
  Pro and above), and **Project Settings → Add-ons → Point in time recovery** shows PITR.
- Before 27 Oct, take one manual export as a baseline (`pg_dump`, or the dashboard's backup download).

## 5. Changes in this PR

- `supabase/migrations/20261016120000_rate_limits.sql`: new `rate_limit_hits` table and `take_rate_limit` function,
  both server-only. **Not applied to the live database.**
- `src/lib/duel/rateLimit.server.ts`: the limits, failing open if the migration isn't applied or the database errors.
- `src/lib/duel/duel.functions.ts`: limits on `createRoomFn`, `roomPreviewFn` and `joinRoomFn` (and the join code is
  now cut to 8 characters, as the preview already was).
- `src/lib/duel/chat.functions.ts`: `reportMessageFn` requires the message to be in the room, plus its limit.
- `src/lib/duel/useRoomChat.ts`: received reactions must be one of the six room emoji; names are cut to 14 characters.
- `src/lib/duel/practice.functions.ts`: a production build won't seal practice answers with the public URL.

None of these touch a game, sim, grade, score, timing, input log, replay or version stamp.

## Needs Joe

1. **Apply** `20261016120000_rate_limits.sql` (through Lovable once this is merged). Until then the new limits are
   inactive but harmless.
2. **Auth settings:** check the anonymous sign-in rate limit, and decide on CAPTCHA (finding 2).
3. **Backups and PITR:** check where section 4 says.
4. **Live policy check:** in the SQL editor, run
   `select tablename, policyname, permissive, roles, cmd, qual, with_check from pg_policies where schemaname = 'public' order by 1, 2;`
   and `select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon', 'authenticated') order by 1, 2;`
   then compare the output with section 1. Also confirm **Storage** has no buckets, and that **Realtime → Settings**
   shows what you expect.
5. **`INTRO_DEMO_KEY`:** make sure it's long and random (finding 8).
6. **Decisions for after the beta, before money play:** findings 3 and 4.
