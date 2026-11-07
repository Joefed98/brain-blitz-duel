# Code audit 1: security and trust (7 Nov 2026)

Read-only audit of `main` at 34272737, done before accounts, coins and purchases are added. **No code, database or
setting was changed.** It builds on `docs/security-audit-oct-2026.md` (16 Oct 2026, called "the October audit" below)
and covers everything added since: async rooms, the daily, friend challenges, offline practice packs, room settings and
scoring mode, 16-player rooms, Apex's ghost cars, share and terms events, and `input_type`.

**How it was done:**

- Read all 43 migrations in `supabase/migrations/`, every `createServerFn` in `src/` (73 in 12 files), the auth
  middleware, the realtime channels and the service worker.
- Searched git history across all revisions for secrets.
- No browser tests were run. Nothing was executed against a database.
- Each finding was traced to the lines cited below. The denial-of-service paths were **read, not run**.

**How severity is judged.** Severity is judged against the app you're about to build, where scores, places and
rewards carry value. "Today" notes how much each finding matters in the current beta, where nothing is worth money.

**When to do it:**

- **Before the move:** before the Supabase move. These are cheap and limit damage now.
- **With accounts:** with accounts, before any coin, reward or purchase depends on the value.
- **Later:** ranked or money play, or general hardening.

Effort: **S** is under a day, **M** is one to three days, **L** is a project.

## Summary

| # | Finding | Severity | Effort | When |
|---|---------|----------|--------|------|
| H1 | Signed-out callers can exhaust server memory through practice grading | High | S | Before the move |
| H2 | A throwaway account reveals every daily and challenge answer; attempts are unlimited | High | S–M | Before the async migrations are applied |
| H3 | Practice tokens replay forever, return the solution, and take the client's seed, stamp and clock | High | M | With accounts |
| H4 | Every practice reward (best, stars, challenges) lives only on the device | High | L | With accounts |
| H5 | Bonuses from counts, times and histories the phone reports | High | L | With accounts (needed for ranked) |
| H6 | Strikeout's live check answers every probe | High | M | With accounts |
| H7 | Arcade runs: public seeds, no wall-clock limit, flagged runs still score | High | M | With accounts |
| M1 | Realtime broadcast channels are public and spoofable | Medium | M | Before the move |
| M2 | Room names (and chat) are not filtered or cleaned | Medium | S | Before the move |
| M3 | Challenge codes can be listed; `myChallengesFn` shows any challenge's board | Medium | S | Before the async migrations are applied |
| M4 | Rate limits are per user, fail open, and miss signed-out and hot paths | Medium | M | Before the move |
| M5 | No security headers (CSP, framing, HSTS) | Medium | M | Before the move |
| M6 | Players who left still count as members and can reactivate themselves | Medium | S | Before the move |
| M7 | Intro-demo saving is guarded only by a key and a client-set `dev` flag | Medium | S | Before the move |
| M8 | Colours above 9 break dailies and half-import challenges | Medium | S | Before the async migrations are applied |
| M9 | "Finish now" can forfeit a player who backgrounded the app for 15 s | Medium | S | With accounts |
| M10 | Every round's puzzle is readable from the start (the October audit's #3, still open) | Medium | M | With accounts |
| L1–L13 | Error text leaks, untyped inputs, races, analytics spam, logs, keys, service worker and more | Low | S each | See the list |

**Nothing Critical.**

- No client can write a score, `is_correct`, place or points to any table.
- No table grants a client a write.
- No answer is readable before the round has closed for that player.
- No secret is in the repo, its history or the client bundle.

The High findings are about what becomes worth cheating once scores carry value, plus one denial-of-service path (H1).

## What holds up (checked, with evidence)

- **Auth.** Every server function except `serverTimeFn` and `appVersionFn` uses `requireSupabaseAuth` or is
  deliberately public: practice and intro demos (M4, M7). The middleware verifies the JWT with `getClaims` and takes
  the user id from `claims.sub` (`src/integrations/supabase/auth-middleware.ts:88-100`). No function takes a user id
  from its input.
- **Room scores.** Graded on the server only.
  - `submitAnswerFn` grades through `gradeRoomAnswer` (`src/lib/duel/roomGrade.server.ts:39-50`).
  - The client never sends `score` or `is_correct`.
  - The claimed time left is held to the server's receipt time plus 1.5 s (`src/lib/duel/grade.ts:271-299`).
  - The answer window needs the current round and the puzzle or reveal phase (`answerWindow.ts`).
  - An answer received in the reveal phase counts 0 ms left (`roomGrade.server.ts:31`).
- **One answer per round.** A database unique index on `(duel_id, player_slot, round_number)`
  (`20260909205823_…sql:24`). A parallel second submit hits `23505` and is dropped (`duel.functions.ts:915`).
- **Placings, standings, awards and the winner** are worked out from stored `round_results` (`scoringMode.ts`,
  `standings()`, `podiumAwards.ts`). The client sends only the room id.
- **Arcade replays in rooms.**
  - The seed and stamps are server-stored and come from the CSPRNG (`src/lib/duel/arcade.server.ts:99`,
    `src/lib/duel/random.ts`).
  - Ticks are clamped to the run, ordered and capped at 6,000 events (`src/lib/arcade/engine.ts:296-347`).
  - The client's claimed score and checksums only set `flagged` (`src/lib/duel/arcadeRun.ts:121-130`). The stored
    score is always the server replay's.
- **Async rooms (daily and challenges).**
  - The round start is the server's time at READY (`asyncRoom.server.ts:516-554`), and READY again returns the stored
    start (`:507-511`).
  - Rounds go in order (`:512-514`).
  - Double submits are blocked (`:628-637`).
  - The 20-player cap is a trigger with an advisory lock (`20261022120000_friend_challenges.sql:74-96`).
- **Database.**
  - Every table has RLS on.
  - Every client grant is SELECT only. Writes go through server functions with the service role.
  - Restrictive "no client writes" policies sit on `duels`, `duel_players`, `round_results` and `room_messages`
    (`20260920145655_…sql:36-50`).
  - Every beta table (`room_joins`, `room_events`, `practice_plays`, the archives, `share_events`, `terms_events`,
    `rate_limit_hits`) is `REVOKE ALL … FROM PUBLIC, anon, authenticated` with no policy.
  - Every SECURITY DEFINER function sets `search_path = public`. These are `is_duel_participant`, `my_duel_slot`,
    `duel_round_ended`, `restart_duel_room`, `disband_stale_room`, `take_rate_limit`, `async_board_open` and
    `challenge_attempt_cap`.
  - Every one that writes is service-role only.
- **Secrets.**
  - `.env` holds the project URL, id and the **publishable** key only, as the October audit found.
  - Git history (all revisions) has no JWTs, `sb_secret_` values, `sk-` or `ghp_` tokens, PEM keys, AWS keys or
    service-role assignments.
  - No non-`.server` module imports `client.server` at top level. Every use is a dynamic import inside a handler.
  - The client reads only the `VITE_` public pair (`src/integrations/supabase/client.ts:36-38`).
  - `betaConfig.ts` holds only empty values or public addresses.
  - No logs print tokens, answers or keys.
- **HTML injection and redirects.**
  - `dangerouslySetInnerHTML` is used only for static icon and art markup (`Icon.tsx:62`, `Art.tsx:48`) and the two
    constant boot scripts (`src/routes/__root.tsx:174,176`).
  - No `innerHTML`, `eval` or `new Function`.
  - Names and chat render as React text or canvas `fillText`.
  - No open redirect: `?ref`, `?room`, `?game` and `/challenge?code` drive internal navigation only, and the challenge
    code is validated (`challenge.tsx:53`).
  - Every `target=_blank` has `rel="noopener noreferrer"`.
  - Feedback and Discord URLs must be http or https (`src/lib/beta/feedback.ts`).
- **Room codes** come from the CSPRNG with 31 characters, about 923k codes (`src/lib/duel/roomCode.ts`,
  `puzzles.ts:21-28`).

## High

### H1. Signed-out callers can exhaust server memory through practice grading

- **Evidence:**
  - `practiceGradeFn` and `practiceGradeQueuedFn` need no sign-in. They grade `mergePuzzle(data.puzzle, priv)`
    (`src/lib/duel/practice.functions.ts:149, 284`), where the **public half comes from the client**.
  - It is checked against the dealt puzzle only for pack deals (`:283`, the `__pub` digest).
  - Hanoi's progress search sizes its table from the client's `start` (peg count) and `discs`:
    `new Uint8Array(pegs ** discs)` then a breadth-first search (`src/lib/duel/puzzleProgress.ts:166, 889-920, 926`).
  - It caches each table in `TOWER_TABLES` for good. `RING_TABLES` (`:564-587`) is likewise never evicted and keyed by
    a client `pattern`.
  - The client also sets the stamps, so it can choose the progress path.
  - One sealed token, which `practiceGenerateFn` hands to anyone, is all it takes.
- **Impact:**
  - 4 pegs and 14 discs is a 268 MB table.
  - More pegs or discs allocate gigabytes or throw.
  - A handful of requests can take the server down for everyone.
- **Fix:**
  - Seal a digest of the public half into every token, not only pack tokens, and refuse a mismatch. The same digest
    also fixes H3's seed and stamp choice.
  - Validate `discs`, the peg count and `pattern` against their legal ranges.
  - Bound both caches (LRU, a few entries).
- **Effort:** S. **When:** before the move.

### H2. A throwaway account reveals every daily and challenge answer, and attempts are unlimited

- **Evidence:**
  - "One attempt per device" is `UNIQUE (room_id, user_id)` (`20261021130000_async_rooms_daily.sql:65`), and
    `user_id` is a free anonymous sign-in.
  - Once a player's round is done, `asyncRevealFn` returns the full merged puzzle and `correctAnswer`
    (`src/lib/duel/asyncRoom.server.ts:675-695`). `challengeRoundBoard` returns it too (`challenge.server.ts:650-666`).
  - Every player gets the same rounds.
  - The board does not dedupe people or names (`daily.server.ts:241-260`).
  - The start limit is per user (`daily.functions.ts:77`).
- **Impact:**
  - Play the daily on a throwaway account with empty answers, collect every solution in about a minute, then play on
    the real account for near-200.
  - Or play many accounts and keep the best.
  - The arcade daily's seeds come out the same way, ready for an offline oracle (see H7).
- **Fix:**
  - Withhold the private half and `correctAnswer` for daily and challenge rooms until the room closes. Show only the
    player's own result and score until then.
  - With accounts: one daily attempt per **account**, and only accounts of a minimum age or play history on the
    public board.
  - Turn on the anonymous sign-in IP limit and CAPTCHA (the October audit's #2).
- **Effort:** S (withholding answers), M (the rest).
- **When:** before `20261021130000` and `20261022120000` are applied (they are written but not applied, so the
  features are off today).

### H3. Practice tokens replay forever, return the solution, and take the client's seed, stamp and clock

- **Evidence:**
  - The seal is AES-GCM with a random nonce and a key derived from the service-role key (`practice.functions.ts:22-51`).
    It is sound and the player can't decrypt it.
  - The token carries no user, expiry or single-use record.
  - `gradePracticeRun` returns the full merged puzzle, solution included (`:182-191`).
  - `msRemaining` is the client's, with no receipt time in practice (`:162`).
  - The client can set `timeLimitMs` on the public half (`registry.ts:403-407`).
  - Arcade games have no private half, so the token binds only the type. Seed and stamps come from the client, and a
    seed mismatch only sets `flagged` (`arcadeRun.ts:121-123`).
  - A pack deal's single use is enforced on the device only (`src/lib/offline/packs.ts:9`).
- **Impact:**
  - Grade once with an empty answer, read the solution, then regrade the same token with a perfect answer and the
    full clock.
  - Arcade: replay a committed bank witness (a 200 run) on its own seed, or pick an older stamp's softer curve.
  - Each fresh seed or stamp also forces an expensive deal build (Grappler 60–550 ms; Pyramid, Muggins and
    Minefield searches), signed out.
- **Fix:**
  - Single-use, user-bound, expiring tokens: a nonce row consumed on grade.
  - The public-half digest from H1.
  - Refuse stamps that aren't the type's dealt stamps (except stored pack deals).
  - Server-timed practice: store the start when the deal is issued and grade on receipt time, as rooms do.
  - Return the solution only after the token is spent.
- **Effort:** M. **When:** with accounts. Today it only affects device bests and beta numbers.

### H4. Every practice reward signal lives only on the device

- **Evidence:**
  - Bests: `practiceBest.ts:33, 63` (localStorage `duelz-practice-best:v3:`).
  - Stars and challenges: `practiceGoals.ts:69, 83` (`duelz-practice-goals:v1`), read from the run's `extra` the
    device keeps.
  - The offline queue writes confirmed scores straight into these (`src/lib/offline/queue.ts:153-162`).
  - Daily streaks, the room record and Profile's stats are device storage too (`dailyRecord.ts`,
    `useDeviceRoomRecord`).
  - `practice_plays` records a client-claimed time (`betaRecord.server.ts:196`) and a client-claimed `input_type`.
- **Impact:** none of these can back "Unlocks with your account" rewards, coins or achievements. Editing
  localStorage awards anything.
- **Fix:** with accounts, server-side records keyed by user and written only from server grading:
  - bests, stars, challenge progress, streaks and room history;
  - **every reward granted by the server, in the same transaction that stores the graded result**;
  - coin balances as a ledger table with no client grant;
  - purchases confirmed by store receipts verified on the server, never by the client.

  This depends on H3.
- **Effort:** L. **When:** with accounts.

### H5. Bonuses from counts, times and histories the phone reports

- **Evidence.** Each of these is the phone's word, held only to "not later than receipt":
  - **Clean bonuses and "how early" extras** on standard puzzles. They are rebuilt from the client's draft timeline
    (`src/lib/duel/standard/timeline.ts:16, 120-146`), used by the grid puzzles (`standard/grid.server.ts:51-56,
    69-71`), Pattern (`pattern.server.ts:206, 442`), Logic (`logic.server.ts:68`), Number (`number.server.ts:194-257`)
    and Eagle Eye (`attention.server.ts:95`). A one-entry timeline ending on the right answer scores no mistakes, and
    part times can be backdated.
  - **Counterweight's par bonus** comes from the claimed hang counts (`number.server.ts:147-166`).
  - **Operator's first-try bonus** comes from the claimed try counts (`:122-141`).
  - **Matchmaker's gold-pair time** is `@ms` (`attention.server.ts:219-221`).
  - **Forage's misses** (`!cells`) can be left out by the phone.
  - **Flash, Bang On and Ascend's tap timings** are the phone's clock (CLAUDE.md "Trusted client inputs").
  - The standard grader sees the answer body before the 4,000-character cap (`generate.server.ts:339-351`; L13).
- **Impact:** a modified client adds 10–50 points a round on these games, in rooms, dailies and challenges.
- **Fix:**
  - Short term: use only what the server can replay.
    - Grade counts and mistakes from the full move or action logs, as Polypotions and Brimful already do.
    - Count Forage misses from `checkWordFn` calls stored server-side.
    - Drop or zero bonuses that can't be replayed in rated modes.
  - Long term: stream inputs to the server (server-timed taps), as the October audit and CLAUDE.md say.
- **Effort:** L (per game, S–M). **When:** with accounts, before any ranked mode or reward on these games.

### H6. Strikeout's live check answers every probe

- **Evidence:**
  - `checkMovesFn` replays whatever move list it is sent, with no memory between calls and no limit
    (`src/lib/duel/duel.functions.ts:1173-1191`).
  - For Strikeout, `so2View` returns the revealed letters, hits, misses and strikes (`strikeout.ts:486-501`).
- **Impact:** a script probes "my moves + one letter" for every letter, then submits only the hits: a perfect run
  with no strikes.
- **Same shape, less to gain:** `checkWordFn` and `practiceCheckWordFn` are an unlimited dictionary oracle for Tile
  Grid, Slider, Wordsmith and Forage. Cryptogrid only returns complete or solved.
- **Fix:**
  - Store each player's checked moves per round. Accept only a check that extends them, and grade from the stored
    list (or require the answer to start with it).
  - Cap checks per round.
- **Effort:** M. **When:** with accounts.

### H7. Arcade runs: public seeds, no wall-clock limit, flagged runs still score

- **Evidence:**
  - The sim runs on the phone (rule 1), so seeds are public.
  - The repo ships oracles that reach 200 on any seed (`scripts/*-oracle.ts`).
  - Nothing checks that a run's replayed ticks fit inside the time since the round started. A 90 s run can arrive
    at second 2.
  - A flagged run (checksum desync, seed mismatch, bad events) still scores (`arcadeRun.ts:121-130`).
  - The client's `endTick` can end the replay early (`:94-96`), which can dodge a penalty due later.
  - Only one event per tick is kept (`:97-98`).
- **Impact:** a bot computes a perfect input log from the seed and submits it.
- **Fix:**
  - Refuse runs whose replayed length exceeds the server's elapsed time since the round (or async round) started
    plus a tolerance.
  - In rated modes, zero or hold for review any flagged run, and any client `endTick` short of the run's end without
    a matching game-over.
  - Keep input logs for audit and flag 200s on public boards.
  - A full fix needs server-timed input.
- **Effort:** M. **When:** with accounts.

## Medium

### M1. Realtime broadcast channels are public and spoofable

- **Evidence:**
  - Reactions go out on `room-chat-${roomId}` (`src/lib/duel/useRoomChat.ts:118`) and Apex ghosts on
    `race-ghosts-${roomId}:${round}` (`src/lib/duel/raceGhosts.ts:50`).
  - Neither channel is private, and no migration has a `realtime.messages` policy.
  - `allowReactionFn` is only advisory; the phone broadcasts afterwards (`useRoomChat.ts:221-226`).
  - Receivers trust the payload's `userId` and `name` (`useRoomChat.ts:131-152`) and the ghost's `key`, `name` and
    `colour` (`raceGhosts.ts:51-56`; the key is just the slot).
  - The ghost map only filters stale entries and never deletes them (`:38-41, 54-55`).
  - Anyone holding the room UUID can send, including removed, left or muted players (M6).
- **Impact:**
  - Reactions under any name, the host's included.
  - The host's mute and the one-a-second limit dodged by changing `userId`.
  - Fake ghost cars.
  - Flooding unique ghost keys slows a victim's phone during an Apex round.
  - All of it renders as text, so there is no script injection.
- **Fix:**
  - Private channels (`config: { private: true }`, `realtime.setAuth`).
  - A `realtime.messages` policy limiting a topic to active, unmuted participants.
  - Receivers take names from the player list by slot and ignore non-players.
  - Cap the ghost map at 16 and delete stale entries.
- **Effort:** M. **When:** before the move. The policy is written against the new project.

### M2. Room names, and chat, are not filtered or cleaned

- **Evidence:**
  - Room names: `cleanName` only trims and keeps 14 UTF-16 units (`duel.functions.ts:91-94`). That can split an
    emoji into a lone surrogate.
  - Rooms have no `offensiveName` check. The daily and challenges do have one (`daily.functions.ts:69-75`,
    `challenge.functions.ts:21-27`).
  - Making a challenge from a room copies the room's names onto a board strangers see, unchecked
    (`challenge.server.ts:374`).
  - Neither names nor chat strip control, bidi (U+202E) or zero-width characters. Chat only collapses whitespace
    (`chat.functions.ts:50`).
  - Both filters fold everything outside a–z away (`boardName.server.ts:34-44`, `profanity.server.ts:48-70`), so
    look-alike letters, accents and zero-width splits get through.
  - The chat filter matches whole tokens only ("fuckyou" passes).
  - Names aren't unique or reserved, so "Joulz" or the host's name can be copied.
- **Impact:**
  - Offensive or impersonating names in the public room JULZ, on share cards sent outside the app, and on
    challenge boards.
  - Right-to-left tricks in names and chat.
- **Fix:** one shared `cleanDisplayName`, used in create, join, the challenge copy and the async starts, with chat
  using the same character strip and the stronger matcher:
  - type check;
  - NFKC normalisation;
  - strip `\p{Cc}`, `\p{Cf}` and lone surrogates;
  - cut by code point;
  - map look-alikes or allow a Latin, digit and punctuation set;
  - `offensiveName`;
  - reserved names (Joulz, staff).
- **Effort:** S. **When:** before the move. Needed for accounts' usernames anyway.

### M3. Challenge codes can be listed; `myChallengesFn` shows any challenge's board

- **Evidence:**
  - `GRANT SELECT (id, kind, room_key, …) ON async_rooms TO authenticated` with `USING (true)`
    (`20261021130000_async_rooms_daily.sql:126-130`). `room_key` is `challenge:<CODE>`.
  - `myChallengesFn` accepts any 20 codes per call, with no membership check and no rate limit. It returns every
    player's name and each finished player's total (`challenge.server.ts:744-773`).
  - The attempts policy `user_id = auth.uid() OR async_board_open(room_id)` (`…sql:159-160`) doesn't require
    `finished_at` for other users' rows, so a finished reader sees in-progress attempts' `round_scores`.
- **Impact:**
  - Link-only challenges become public: list them all, read their players and scores.
  - Fill them to the 20-player cap with throwaway accounts.
- **Fix:**
  - Drop `room_key` and `kind` from the grant, or limit the policy to daily rooms.
  - Answer `myChallengesFn` only for codes the caller made or has an attempt in, under the room-lookup rate limit.
  - Add `finished_at IS NOT NULL` for other users' rows.
- **Effort:** S. **When:** before the async migrations are applied.

### M4. Rate limits are per user, fail open, and miss signed-out and hot paths

- **Evidence:**
  - `withinRateLimit` allows the call on any RPC error (`src/lib/duel/rateLimit.server.ts:40-47`). Until
    `20261016120000_rate_limits.sql` is applied, every limit is off; the repo can't show whether it has been.
  - Every bucket is keyed on the user id, and anonymous sign-ins are free (the October audit's #2).
  - With no limit at all:
    - the signed-out practice functions;
    - `practicePackFn`: up to 60 generations a call, and each Unblock deal marks a bank board used
      (`practice.functions.ts:223-254`);
    - every practice grade, which inserts a `practice_plays` row;
    - `checkWordFn` and `checkMovesFn`;
    - `startRoomFn`, `startChallengeFn` and `setPlayerLookFn`;
    - share and terms events (L4).
  - `CHALLENGE_CREATE_LIMIT` counts per `created_by` (`challenge.server.ts:150-163`), and each challenge builds 3–10
    puzzles.
- **Impact:** CPU and database cost, and bank boards burnt. The per-user limits are dodged by signing in again.
- **Fix:**
  - Apply the migration and confirm it live.
  - Require a session on practice.
  - Add per-IP buckets alongside per-user ones. The IP comes from the request at the edge.
  - Fail closed on the create buckets.
  - Add an edge limit on `/_serverFn` (Cloudflare or the new host).
  - CAPTCHA on anonymous sign-in.
  - Draw pack boards without marking them used.
- **Effort:** M. **When:** before the move.

### M5. No security headers

- **Evidence:** there is no `Content-Security-Policy`, `X-Frame-Options` or `frame-ancestors`,
  `Strict-Transport-Security`, `Referrer-Policy` or `X-Content-Type-Options` anywhere in `src/`, `vite.config.ts` or
  `public/`. `src/server.ts` and `src/start.ts` set no headers. CSRF middleware is present (`src/start.ts:24-26`).
- **Impact:** the app can be framed (clickjacking Create, Join, Disband, and later purchases), and there is no
  second line of defence if script injection ever appears.
- **Fix:** set these in the server entry:
  - `frame-ancestors 'none'`;
  - `nosniff`;
  - `strict-origin-when-cross-origin`;
  - HSTS;
  - a CSP that hashes the two inline boot scripts and allows the Supabase https and wss host, Google Fonts and
    Sentry.
- **Effort:** M. **When:** before the move. Required before purchases.

### M6. Players who left still count as members and can reactivate themselves

- **Evidence:**
  - `is_duel_participant` ignores `status` (`20260909205823_…sql:27-33`), so a left or removed player still reads the
    room, chat and results.
  - `requireParticipant` doesn't check status either (`duel.functions.ts:134-147`).
  - `submitAnswerFn` sets any non-active player back to active (`:926-928`), and so does `readyUpFn` (`:971-975`).
    `joinRoomFn` refuses a rejoin after the start (`:423-424`).
- **Impact:**
  - A removed player keeps reading chat and spoofing broadcasts (M1).
  - A left player can come back into a game in progress and keep submitting graded answers or probing checks.
- **Fix:** refuse `status = 'left'` in these paths and in `setPlayerLookFn`. Decide whether RLS should hide later
  chat from removed players.
- **Effort:** S. **When:** before the move.

### M7. Intro-demo saving is guarded only by a key and a client-set `dev` flag

- **Evidence:**
  - `saveIntroDemoFn` and `savePuzzleDemoFn` check `data.dev === true`, which the client sends, never the server's
    environment (`src/lib/duel/introDemo.functions.ts:371, 411`).
  - `checkDemoKeyFn` allows unlimited guesses. The comparison is constant-time (`:346-358`).
- **Impact:** whoever holds or guesses `INTRO_DEMO_KEY` can overwrite every game's public demo in production.
- **Fix:**
  - Refuse saves in production builds (`import.meta.env.PROD` or a server flag).
  - Rate-limit `checkDemoKeyFn`.
  - Confirm the key is 32+ random characters.
- **Effort:** S. **When:** before the move.

### M8. Colours above 9 break dailies and half-import challenges

- **Evidence:**
  - `async_attempts.colour CHECK (colour BETWEEN 0 AND 9)` (`20261021130000_async_rooms_daily.sql:56`) was not
    widened by `20261031150000_room_16_players.sql`.
  - `isPlayerColour` accepts 0–31 (`playerLook.ts:106`).
  - `startAttempt` throws the raw Postgres error (`asyncRoom.server.ts:264-270`).
  - `createChallengeFromRoom` fails after the room and challenge rows exist (`:325`, then the import loop at
    `:342-381`). Later calls return the half-imported challenge with players missing for good (`:286-298`).
- **Impact:** a correctness bug with an integrity effect: results silently missing from a shared board.
- **Fix:**
  - Widen the check to 0–31 in the same migration batch, or store null above 9.
  - Make the import all-or-nothing (one RPC, or delete on failure).
- **Effort:** S. **When:** before the async migrations are applied.

### M9. "Finish now" can forfeit a player who backgrounded the app for 15 s

- **Evidence:**
  - `canFinishNow` counts anyone without a heartbeat for 15 s (`roomFlow.ts:114-123`, `DISCONNECT_MS` in `types.ts`).
  - Since the battery batch the heartbeat stops while the app is hidden (`useDuel.ts:193-199`).
  - `finishGame` marks those players left (`roomPhase.server.ts:154-155`).
- **Impact:** in a two-player room, checking a text message is enough to be forfeited. That matters once wins carry
  rewards.
- **Fix:** require a longer absence (60 s, or a missed round) before Finish now is offered and accepted.
- **Effort:** S. **When:** with accounts.

### M10. Every round's puzzle is readable from the start (the October audit's #3, still open)

- **Evidence:** `startRoomFn` writes every round's public half at once (`duel.functions.ts:516`), and members can
  read `duels.puzzles_public`.
- **Impact:** round 6's board, or arcade seed, can be solved or botted during round 1.
- **Fix:** release each round's public half at its round title. This is a room-flow change, so prove it with the room
  checks.
- **Effort:** M. **When:** with accounts.

## Low

| # | Finding | Evidence | Fix | Effort / when |
|---|---------|----------|-----|---------------|
| L1 | Raw Postgres error text reaches the client (column and constraint names, "invalid input syntax for type uuid"). TanStack serialises thrown errors past the root error middleware. | `duel.functions.ts:107, 118, 226, 533, 744, 759, 915`; `roomSettings.server.ts:32, 66`; `playerLook.server.ts:77, 134-179`; `reveal.server.ts:70`; `asyncRoom.server.ts:115-342`; `challenge.server.ts:159, 211`. `leaveRoomFn`, `disbandRoomFn` and `removePlayerFn` call `getRoom` before any membership check. | Log the detail and throw a generic message. Check `roomId` is a UUID first. | S, before the move |
| L2 | Input validators pass input straight through (`.inputValidator((input) => input)`) everywhere except the replay functions (`replay.functions.ts:18-21`). Wrong types give 500s, for example a non-string `displayName` or chat `text` (`chat.functions.ts:51`). Queries are parameterised, so there's no injection. | as cited | zod schemas on every function, starting with anything accounts or coins touch | M, with accounts |
| L3 | The chat limits (2 s gap, 30 a room) are read-then-insert, so parallel sends get past both | `chat.functions.ts:54-69` | a `take_rate_limit` bucket or a trigger | S, before the move |
| L4 | Share and terms events: no rate limit, and the client chooses `place`, `players`, `rounds`, `duelId` and `agreed_at`. Also a data bug: `most = room ? 10 : 20` stores null place for 11–16-player rooms. | `betaRecord.server.ts:348-389, 372, 433-439` | a rate-limit bucket; check the place against stored results; use the server's time for `agreed_at`; set `most` to 16 | S, before the move |
| L5 | `startRoomFn` builds every puzzle and draws bank boards before its guarded claim, so parallel host calls burn CPU and boards | `duel.functions.ts:477-481, 521-522` | claim the room first | S, later |
| L6 | `postgres_changes` subscriptions have no filter, so Realtime checks RLS for every change in every room, for every subscriber. Data is safe: RLS gates it, and DELETEs carry primary keys only. | `useDuel.ts:112-135`; `useRoomChat.ts:119-121` | `filter: duel_id=eq.<id>` (`id=eq.<id>` on `duels`) | S, before the move (cost at scale) |
| L7 | Room and daily seeds are written to server logs, so anyone with log access can deal the day's daily first | `duel.functions.ts:505`; `daily.server.ts:126` | log a hash or nothing | S, before the move |
| L8 | The practice seal key is derived from the service-role key: rotating one breaks all offline packs. The production build refuses to seal without it; the dev fallback remains. | `practice.functions.ts:22-29` | a dedicated `PRACTICE_SEAL_KEY` with a key id | S, before the move (the move rotates keys) |
| L9 | The service worker caches any same-origin GET that returns 200, keyed by full URL with query, so it can grow without bound. There's no remote kill switch. Server calls and non-GET requests are never cached. | `src/lib/offline/sw.template.js:71-74, 84, 107-116` | cache only `CONFIG.app` paths; keep a kill-switch `/sw.js` ready | S, later |
| L10 | The feedback link sends the anonymous user id to Tally (a third party) once `TALLY_URL` is set | `src/lib/beta/feedback.ts` | send a hashed id, or none; say so in the privacy terms | S, with accounts |
| L11 | Leaving a room doesn't stop broadcasts or reads (see M1, M6); there's no `is_anonymous` distinction in the auth middleware | `auth-middleware.ts:88-100` | with accounts, check `is_anonymous` for anything that pays out or spends | S, with accounts |
| L12 | Room ids are visible in shares and links; member auth ids are visible to room-mates (the October audit's #10) | `duel_players.user_id` | once accounts exist, never expose an account's auth id; use a public profile id | S, with accounts |
| L13 | The standard grader receives the answer body before the 4,000-character cap | `generate.server.ts:339-351` | cap the body first | S, before the move |

## The October audit's findings, rechecked

| October # | Status now |
|-----------|------------|
| 1 Rate limits | Code in place, but it fails open and is off unless the migration was applied (M4) |
| 2 Unlimited anonymous sign-ups | Open; now also undermines the daily and challenges (H2, M3) |
| 3 Every round public at start | Open (M10) |
| 4 Bots and solvers | Open and larger: H5, H6, H7 |
| 5 Public reaction channel | Open; Apex's ghost channel added the same way (M1) |
| 6 Report any message id | Fixed (message must be in the room) |
| 7 Seal key fallback | Fixed in production; key reuse remains (L8) |
| 8 Signed-out practice and demo functions | Open and larger: packs, queued grading, the H1 memory path (H1, M4, M7) |
| 9 Pass-through validators | Open (L2) |
| 10 Auth ids visible to room-mates | Open (L12) |
| 11, 12 Backups; live policies versus migrations | Still need Joe (below) |

## Before accounts, coins and purchases: the order

1. **Now / before the Supabase move:**
   - H1;
   - M1, M2, M4, M5, M6, M7;
   - L1, L3, L4, L6, L7, L8, L13.

   On the new project:
   - apply the rate-limit migration;
   - write the `realtime.messages` policy;
   - set CAPTCHA and the anonymous sign-in limit;
   - rotate keys.

   Then re-run the live policy query from the October audit and compare.
2. **Before applying the async migrations:** H2's answer withholding, M3, M8.
3. **With accounts:**
   - H3, H4 (server-side progress, rewards and coin ledger);
   - H5, H6, H7, M9, M10;
   - L2, L10, L11, L12.

   Rules for the new tables:
   - no client grants on any balance, reward, purchase or ledger table;
   - grants and spends only in SECURITY DEFINER functions or server functions, run as the service role, in one
     transaction with the graded result they depend on;
   - purchase receipts verified on the server;
   - idempotency keys on every grant.
4. **Later (ranked or money play):** server-timed inputs (streamed taps and moves) to close H5 and H7 fully, plus
   review queues for public-board 200s.

## Needs Joe

- Whether `20261016120000_rate_limits.sql` (and the other "written but not applied" migrations) are live. The repo
  can't show it.
- The October audit's live checks still stand: compare the live policies and grants with the migrations, backups and
  PITR, the anonymous sign-in limit, CAPTCHA, the `INTRO_DEMO_KEY` length, and the Realtime settings.

Not legal advice: privacy terms for Tally (L10), and for accounts and purchases generally, need Joe's adviser.
