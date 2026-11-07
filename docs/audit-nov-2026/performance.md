# Code audit 3: performance and reliability (7 Nov 2026)

Read-only audit of `main` at 34272737. **No code was changed.** This file is the only output.

What makes Joulz slower, heavier or less reliable than it needs to be, ranked by how much
players feel it. The weighting favours cheaper phones and poor signal.

## How it was measured

- **Production build.** `bun run build` took 48 s (preset `cloudflare-module`). A second build used
  `vite build --sourcemap`, so the chunks could be attributed to source folders. The attribution
  script read each chunk's source map with `@jridgewell/sourcemap-codec`.
- **Sizes.** Raw bytes come from `stat`. Gzip sizes come from `gzip -9`. Brotli was not available,
  and Cloudflare would serve it about 10–20 % smaller than gzip.
- **Sounds.** `ffprobe` read each file in `SOUND_MANIFEST`. Decoded memory is duration × channels ×
  48 kHz × 4 bytes, which is what Web Audio holds once a file is decoded.
- **Server timings.** Node 22 imported the built `.output/server/_ssr` chunks on a 2.1 GHz Xeon (4 cores).
  - Each import and generator was timed with `performance.now()`.
  - Each puzzle type was dealt four times with `bankSeed`, the way rooms and practice deal.
- **What was not run.** No browser tests. No live Supabase. So these are estimates, marked *(est.)*:
  - realtime message counts and payload sizes, worked out from the code paths;
  - parse times on phones, worked out from the bundle sizes.
- **Help.** Two read-only helper agents went through the realtime and server code. I checked their main
  claims against the code before including them:
  - the subscriptions have no filter;
  - the heartbeat writes a table that is published to realtime;
  - `select("*")` on results;
  - no index on `duels.host_user_id`;
  - the challenge count reads every row;
  - the practice functions have no auth.

## Summary

| # | Finding | Who feels it | Effort | Risk |
|---|---|---|---|---|
| 1 | Every page downloads all 92 games before the first screen: 4.7 MB of JS and CSS, 1.42 MB gzipped | Everyone, worst on cheap phones and 3G | L | M |
| 2 | The service worker downloads about 30 MB on the first visit and 5.7 MB again after every Publish, with no check on the connection | First-time players on mobile data, metered users | S–M | L |
| 3 | Room realtime has no per-room filter, and a 4 s heartbeat triggers a players refetch about once a second on every phone | Every room; Supabase load grows with players², across all rooms | M | M |
| 4 | The results refetch downloads every player's input log for every round, several times a round | 16-player arcade rooms on mobile data | S–M | L–M |
| 5 | The first tap fetches about 430 sound files and decodes about 100 MB of audio, kept for the whole session | Low-RAM phones (tab reloads, jank on the first tap) | M | L–M |
| 6 | No request timeouts: a hung answer send never retries, and a dead socket is noticed only after about 25 s | Poor signal mid-round | S–M | L |
| 7 | Server cold start: 25.8 MB of unminified JS (5.3 MB gzipped); loading the generator alone takes about 0.5 s; the first deal and the first submit both pay it | The first room or submit on a fresh isolate (the "first-deal spike") | M–L | M |
| 8 | `submitAnswerFn` makes 10–13 sequential database calls, and 16 phones submit in the same second at the buzzer | The last answers of each round, in big rooms | M | L–M |
| 9 | Every phone asks to advance the phase at once; retries run in lockstep | Server load at every transition | S | L |
| 10 | No index on `duels(host_user_id, created_at)`; the challenge rate limit reads every challenge a user ever made; `tournament_history` grows forever and is read on every call | Hosts with long histories, over time | S | L |
| 11 | The practice server functions have no auth and no rate limit (a pack deals up to 60 puzzles); the practice grade waits up to 1.5 s for beta logging | Practice latency; a way to exhaust server CPU | S | L |
| 12 | Challenge pings poll at 1 Hz, about 5 queries each | Challenge players on poor signal; database load | S–M | L |
| 13 | Apex ghosts broadcast at 6.7 Hz per phone: about 1,600 deliveries/s in a 16-player room | Realtime quota | S | L |
| 14 | A render-blocking Google Fonts stylesheet on every page, for a font only Retro games use; 473 KB of global CSS | First paint on poor signal | S | L |
| 15 | Smaller issues: AsyncRun ticks at 10 Hz with no gating; word and move checks re-read every round's boards; refetches can arrive out of order; unused font files | Minor | S | L |

What is already in good shape is listed at the end.

---

## 1. The first screen downloads every game (highest impact)

### Measurement

The root route's preload list (`.output/server/_tanstack-start-manifest_*.mjs`) includes
`registry-*.js` on **every** route, the Play tab included.

| Chunk | Raw | Gzip | Contents (from the source map) |
|---|---|---|---|
| `registry-*.js` | 3,340 KB | 1,052 KB | arcade renderers 831 KB, arcade sims 749 KB, `src/puzzles` 741 KB, `src/lib/duel` 370 KB, puzzle widgets 167 KB, `src/lib/fx` 162 KB (`manifest.ts` alone 101 KB), cards 89 KB; the largest single file is `instructions.ts` at 103 KB |
| `index-*.js` | 292 KB | 94 KB | react-dom 171 KB, TanStack Router 59 KB |
| `client-*.js` | 219 KB | 56 KB | supabase-js (auth 97 KB, realtime 55 KB, storage 22 KB) |
| `PhoneShell-*.js` | 202 KB | 66 KB | room and app chrome, vaul, Radix slider |
| `styles-*.css` + `registry-*.css` | 473 KB | 86 KB | all CSS for every game |
| **All of the root and `/` (32 files)** | **4,699 KB** | **1,415 KB** | |

All client JS together is 4.68 MB (1.47 MB gzipped). So the first screen already downloads
**about 96 % of the whole app**.

About 95 % of `registry-*.js` is game code: the sims and renderers for every revision of every game,
the retired ones included. The Play tab draws none of it.

Three import paths pull the registry into the root (traced with a static import graph of `src/`):

- `__root.tsx` → `lib/offline/install.ts` → `lib/offline/packs.ts` → `registry.ts`. It needs only `PUZZLE_TYPES`.
- `__root.tsx` → `lib/share/shareRef.ts` → `roomShare.ts` → `tieBreak.ts` → `registry.ts`. It needs `puzzleTimeLimitMs`.
- `__root.tsx` → `components/app/ErrorState.tsx` → `design/components/index.ts` (the barrel) →
  `GameTile.tsx` → `GameIcon.tsx` → `registry.ts`. It needs `puzzleDef`.

`registry.ts` then has 114 static imports, one per `src/puzzles/<game>.tsx`, and each of those pulls in
its sim and renderer.

### Player impact *(est.)*

- **Download on poor signal:** 1.4 MB gzipped is about 7–10 s on a slow 3G link (about 1.6 Mbit/s with
  high latency), before the first tap.
- **Parse and compile on a cheap Android phone:** low-end phones manage roughly 1 MB of JS a second, so
  4.7 MB is about 3–5 s of main-thread work on first open, and again whenever the browser drops its
  code cache (after every Publish).
- **Memory:** every game's module-level tables and caches are created at start-up.

### Fix

1. **Split `registry.ts` in two.**
   - A light **catalogue**: ids, display names, categories, time limits, `isArcade`, desktop modes. Most
     callers need only this: GameIcon, tieBreak, packs, the Practice list, room settings.
   - A **definition loader**, `loadPuzzleDef(type)` → `import("@/puzzles/<game>")`, one chunk per game,
     used only by the round intro, the stage, the reveal and replays.
   - The migration-readiness doc (§5, "rules-only registry") already proposes the same split for the server.
2. **Start loading early.** Begin fetching the game chunk when the round title or intro shows (rooms
   already know the next round's type), and use the existing `RoundIntro` "prepare" hook (as
   `prepareSwingCourse` does). That way the 5–7 s intro hides the download.
3. **Cut the three root paths.**
   - `packs.ts` should get `PUZZLE_TYPES` from the catalogue.
   - `ErrorState` should import `Button` from its own file, not the `design/components` barrel.
   - `tieBreak` should use the catalogue.
4. **Split the CSS by game too.** Vite does this automatically once the game modules are separate chunks.

- **Effort:** L. About 100 call sites of `puzzleDef(...)` need to become catalogue reads or async loads.
- **Risk:** M. These must not change:
  - intro timing;
  - the "no layout shift from the first frame" checks (first-paint, demo-intro);
  - offline practice, where the service worker must keep every game chunk (it already keeps every client file).
- **Expected gain:** the first screen drops to roughly 1.2 MB raw / 0.35 MB gzipped *(est.: everything but
  the registry and game CSS)*, and each game then costs 20–150 KB when first played.

## 2. The offline worker downloads about 30 MB with no check on the connection

### Measurement

- The worker registers on the root's first mount in production (`src/lib/offline/serviceWorker.ts:46`,
  from `__root.tsx` → `installOfflinePractice`).
- Its `install` (`src/lib/offline/sw.template.js:29-42`) fetches:
  - every app file: 82 files, **5.71 MB**, all required;
  - every media file: 460 files, **24.28 MB** (sounds, tiles, the Letterfall word list).
  - Both lists were read from the built `/sw.js` `CONFIG`.
- Each new build (every Publish) installs a new worker, which re-downloads all 5.71 MB of app files with
  `cache: "reload"`.
- It then SHA-256-hashes every cached media file to look for changed bytes (`staleMedia`, about 24 MB of
  hashing on the phone each time).
- Nothing checks `Save-Data`, a metered connection, 2G, Battery saver or a live room. Practice packs
  already check all of these (`packGrowth.ts`, `packs.ts:147-151`).
- The handover poll (`serviceWorker.ts:67`) runs `getRegistration()` every 2 s for the whole session.

### Player impact

- A first-time player who opens a room link on mobile data downloads about 30 MB in the background while
  they join and play the first round. It competes with the realtime socket and the answer sends.
- On a capped plan, that is a visible data cost.
- After each Publish, every returning phone downloads another 5.7 MB.

### Fix

1. **Wait before installing.** Register the worker only after the first screen is idle, never while a
   room, daily or challenge is on screen, and never on Save-Data, a metered connection, 2G or Battery saver.
   Reuse `packGrowth`'s conditions.
2. **Install only what is needed.** Keep the app shell and the shared sounds at install. Fetch the rest at
   runtime: the worker's `cacheFirst` already caches media when it is played. Each game's own sounds and
   tiles can be fetched when its first practice pack lands, so offline practice still works for the games
   a player has packs for.
3. **Hash less.** Hash only files whose `mediaHash` changed between builds (compare the old worker's
   `CONFIG` with the new one), not every cached file.
4. **Stop the 2 s poll.** Use `registration.onupdatefound` and the `statechange` event instead.

- **Effort:** S–M.
- **Risk:** L. offline-check and offline-media-refresh-check cover the behaviour. Joe needs to decide how
  much media "offline practice" must guarantee before the first pack lands.

## 3. Room realtime: no filter, and the heartbeat drives a refetch storm

### Measurement

- `src/lib/duel/useDuel.ts:111-133`: one channel subscribes to `postgres_changes` for **every** row of
  `duels`, `duel_players` and `round_results`, with **no `filter:`**. Rows from other rooms are dropped in
  JavaScript, after they have arrived (`row.duel_id !== duelIdRef.current`).
- All three tables use `REPLICA IDENTITY FULL` and are in `supabase_realtime`.
- `heartbeatFn` (`duel.functions.ts:1031-1042`) updates `duel_players.last_seen_at` every 4 s for each
  player (`useDuel.ts:197`). It is paused while the app is hidden.
- Each heartbeat is a realtime event to every phone in the room, and each event triggers `fetchPlayers`
  (`api.ts:61`, `select("*")`), limited to one a second by `batched` (`battery.ts:252`).

### Volume for 16 players *(est.)*

- 4 heartbeat writes a second, so every phone refetches all players about **once a second**: about
  16 queries a second per room, about 1,400 per 90 s round, even when nothing on screen changed.
- 4 heartbeat server-function calls a second on top.
- **Across all rooms:** Supabase Realtime checks RLS for every change against every subscriber on the
  table, in every room, because there is no filter. RLS here is per-row SECURITY DEFINER functions.
  - Cost: (all heartbeats) × (all connected phones).
  - Example: 100 rooms of 16 players is about 400 changes a second × 1,600 subscribers, about 640,000 RLS
    checks a second.
  - This limits the beta's capacity long before CPU does.

### Fix

1. **Filter per room.** Add `filter: \`duel_id=eq.${id}\`` to `duel_players` and `round_results`, and
   `id=eq.${id}` to `duels`. This means subscribing after `fetchDuelByCode` has given the id.
2. **Take `last_seen_at` out of the published table.** Either move it to an unpublished
   `duel_presence (duel_id, user_id, last_seen_at)` table that the server reads, or use Realtime Presence.
3. **Apply `payload.new` to the players list** instead of refetching, as the `duels` handler already does.

- **Effort:** M.
- **Risk:** M. The stale-player and inactive logic (`markInactivity`) and finished pings read these
  columns, so room-16-check and finished-pings-check must stay green.

## 4. The results refetch downloads every input log, several times a round

### Measurement

- `fetchResults` is `select("*")` on every round of the room (`api.ts:71-75`), `answer` included.
- For arcade rounds, `answer` is the raw input log:
  - capped at 24,000 characters (`actionLog.ts:31`), 16,000 (`tapLog.ts:91`) or 400,000 (`grade.ts:371`);
  - 17–117 K characters per run in practice, from docs/migration-readiness-oct-2026.md.
- `extra` also carries `diag` and `reveal` (`grade.ts:3079`).
- The refetch runs:
  - on every phase or round change (about 7 a round, `useDuel.ts:152-162`);
  - after any result event (limited to one a second);
  - on every resubscribe and every return to the foreground.
- The room screen reads only this player's own `answer` (`duel.$code.tsx:1102`).
- Each submit writes the row twice: an insert, then the `input_type` update
  (`inputType.server.ts:18`). So there are two full-row realtime events and two refetches.

### Volume *(est.)*

- Late in a 16-player arcade-heavy room: 176 rows × 10–20 KB is about 2–3 MB per fetch, so roughly
  **15–20 MB per phone per round**.
- On a 1 Mbit/s link, the standings screen waits on this.

### Fix

1. Select explicit columns without `answer`, and leave out `extra.diag` (or move it to a server-only column).
2. Fetch this player's own answer once per round (or have `submitAnswerFn` return it).
3. Refetch only the current round's rows on phase changes.
4. Write `input_type` in the insert. Once its migration is applied, it no longer needs a second update.

- **Effort:** S–M.
- **Risk:** L–M. Check which `extra` fields nearMiss, standings, the reveal chart and replays read.
  replay-board-check and room-figures-check cover them.

## 5. The first tap decodes about 100 MB of sound

### Measurement

- `preload()` (`src/lib/sound.ts:179-207`) runs on the first tap. It fetches **every** effect and voice
  file in `SOUND_MANIFEST` **in parallel**: about 429 local files, 6.04 MB, plus some of the 135 Lovable
  `/__l5e/` assets.
- It decodes all of them with `decodeAudioData` and keeps the buffers for the whole session.
- Decoded effects come to about 317 s of audio: **about 100 MB of float32 PCM** at 48 kHz.
- Music is handled well: it loads per screen and is released (`releaseRoomMusic`, `releaseRoundBuffer`).

### Player impact

- 100 MB is a large share of what iOS Safari allows a tab on a 2–3 GB iPhone, before canvases and the JS
  heap. A tab that goes over is reloaded, which mid-room means a rejoin.
- Several hundred parallel decodes on the first tap compete with the main thread just as the player
  starts their first round.

### Fix

1. **Preload a small shared set** (shared, room and UI cues, the voices).
2. **Load each game's own effects** when its round intro shows, and release them when the round's reveal
   ends, as music already does. This cuts the resident set to roughly 10–20 MB *(est.)*.
3. Decode with a small concurrency limit (4–6) rather than all at once.

- **Effort:** M.
- **Risk:** L–M. A cue that fires before its file is decoded is already skipped silently; the
  sound-manifest, sound-batch6, sound-nov-2026 and sound-retheme checks prove the slots.

## 6. Poor signal: no timeouts, and slow detection of a dead connection

### Measurement

- **No timeouts.** No client code uses `AbortController` or a fetch timeout, and the Supabase client sets
  none (`integrations/supabase/client.ts:50-59`).
- **A hung send never retries.** `roomSend.ts` retries only when the request **throws**
  (`roomSend.ts:52-62`). A request that stalls stays `"sending"`, and `tick()` acts only on `"waiting"`
  (`:77`).
- **A dead socket is noticed slowly.** The realtime heartbeat is the library default of 25 s; no
  `heartbeatIntervalMs` is set.
  - Until it fires, `live` stays true and the 8 s safety-net poll stays off (`useDuel.ts:203`), so a phone
    on a dead socket misses phase changes for up to about 25 s.
- **Clock samples are not bounded.** `initServerClock()` (`clock.ts:41-68`) takes 3 sequential samples
  with no timeout and no round-trip limit.
  - A 2 s round trip gives up to about 1 s of offset error, close to the 1.5 s receipt tolerance.
  - The room screen waits on it, so it can sit on "loading" forever.

### Fix

1. Add an 8 s timeout to the answer send (abort, then go back to `"waiting"` so it retries).
2. Add a 3 s timeout to each clock sample, and drop samples with a round trip over about 1 s.
3. Set `heartbeatIntervalMs` to 10–15 s on the realtime client.
4. If no `duels` event arrives within about 3 s of a phase being due, call `load()`.

- **Effort:** S–M.
- **Risk:** L. room-send-check, clock-round-check and room-late-run-check cover these paths.

## 7. Server cold start: the "first-deal spike"

### Measurement

- **Bundle size.** The server bundle is 25.8 MB of **unminified** JS, 5.3 MB gzipped.
  - Cloudflare's free-plan script limit is 3 MB; paid is 10 MB.
  - `wrangler.json` has `no_bundle: true` and no `cpu_ms` limit.
- **Largest chunks:**

  | Chunk | Raw | Gzip |
  |---|---|---|
  | `generate.server` | 9.1 MB | 1.55 MB |
  | `puzzleBank.server` | 4.4 MB | — |
  | `registry` (the React UI, also loaded on the server) | 4.4 MB | — |
  | `bastionTank` | 1.2 MB | — |
  | `dictionary.server` | 1.0 MB | — |
  | `removedGames` | 0.9 MB | — |

- **Load times** (Node, 2.1 GHz Xeon):
  - importing `generate.server` takes **493–512 ms**;
  - importing `puzzleBank.server` alone takes 358 ms;
  - `dictionary.server` takes 14 ms;
  - the first `buildRoomPuzzles` takes 79 ms, later ones 11–69 ms.
  - A Workers isolate on shared hardware is likely slower.
- **Both the first deal and the first submit pay it.** `generate.server` is dynamically imported by the
  practice functions and statically by `roomGrade.server` (`gradeAnswer`), `daily.server` and
  `challenge.server`. So the first deal **and** the first answer on a fresh isolate both wait for it.
- **Later on the same isolate:**
  - the first word check builds a Set of about 102 k words (`dictionary.server.ts:94-101`);
  - the first Gridlock rev-3 grade builds its tables (median 132 ms, max 377 ms, docs/scoring-rev3-oct-2026.md).
- **This is the spike.** A new isolate parses and evaluates about 19 MB of mostly bank object literals
  before it can deal. It happens again on every new isolate: after a deploy, after idle, and as traffic
  spreads across isolates.
- **Deal costs once loaded (banked, as rooms deal).** The worst first deal per type:

  | Game | Worst of 4 deals |
  |---|---|
  | Hanoi (`tower`) | 241 ms |
  | Fences | 128 ms |
  | Fillomino | 127 ms |
  | Wordsmith | 89 ms |
  | Safe | 86 ms |
  | Kakuro | 85 ms |
  | Wordhunt | 80 ms |
  | every other type | under 70 ms |

  Without `bankSeed`, Flow's live generator takes **4–23 s**. Every current caller passes `bankSeed` or
  uses the banked intro example; keep it that way.

### Fix

1. **Minify the server build.** One setting, roughly 2× smaller and quicker to parse *(est.)*.
2. **Load each bank with its own dynamic `import()`** from its spec in `puzzleBank.server.ts`, so a deal
   loads only the banks its rounds use.
3. **Move `gradeAnswer` out of `generate.server`**, so grading doesn't load every generator.
4. **Use the rules-only registry** on the server (finding 1's split), dropping React and the renderers.
5. **Bank Hanoi**, and precompute Gridlock's tables into its bank row.
6. Optionally, warm an isolate after deploy with a cheap call that imports the generator.

- **Effort:** M–L.
- **Risk:** M. Deals and grades must stay byte-identical. The legacy, bank and standard-live checks
  already prove that.

## 8. Answer submission: sequential round trips and a burst at the buzzer

### Measurement

`submitAnswerFn` (`duel.functions.ts:854-951`) runs these steps one after another:

1. auth `getClaims`;
2. `requireParticipant`;
3. `getRoom`, `select("*")`, which carries every round's `puzzles_public` and the growing `tournament_history`;
4. the existing-row check;
5. every round's private puzzles, to use one;
6. the insert;
7. the `input_type` update;
8. `markSubmitted`;
9. an optional status update;
10. `getPlayers`;
11. `answeredSlots`;
12. `setPhase`, then `recordRoomEvent`.

That is 10–13 sequential database calls. At the buzzer, all 16 phones send their drafts in the same tick
(`duel.$code.tsx:502-511`).

Arcade grading replays the log on the server: at most 54 ms on a full log, Rainbow Bridge up to 421 ms
(docs/migration-readiness-oct-2026.md). Requests on one isolate run one at a time, so the last of 16
answers can wait about 1–7 s *(est.)*.

`startRoomFn` makes about 11 sequential calls. Among them:

- it always draws a Gridlock row, even when no Gridlock round is dealt;
- it reads `puzzles_public` from the host's last 20 rooms (`:309-315`).

### Fix

1. Run the participant, room and secret reads in one `Promise.all`, and select only the columns needed
   (`puzzles_public->N`, `puzzles_private->N`).
2. Drop the pre-check (the unique index already refuses duplicates).
3. Put `input_type` in the insert.
4. Merge the `submitted_round` and `status` updates.
5. Read players and answered slots in parallel. Better still, one SQL function.
6. In `startRoomFn`, draw the Gridlock row only when Gridlock is dealt, and read only the bank keys.

- **Effort:** M.
- **Risk:** L–M. room-practice-grade-check, beta-recording-check and finished-pings-check cover these paths.

## 9. Every phone pushes each phase forward; retries move in step

### Measurement

- In `starting`, `round_title` and `winner_reveal`, **every** phone calls `advancePhaseFn`, and repeats it
  every 1.5 s until the phase changes (`duel.$code.tsx:520-554`).
- Each call does auth, `requireParticipant`, `getRoom` (`select *`) and `getPlayers`.
- That is 16 near-simultaneous calls, 3 times a round, about 48 reads per transition.
- The phone also ignores the reply (`:554`).
- Answer retries use fixed delays, 400 / 800 / 1600 / 3200 / 5000 ms (`roomSend.ts:19`), with no random
  spread, so retries after a blip arrive together.

### Fix

1. In those phases, only the host calls straight away; other phones wait 2.5 s plus a random delay.
2. Return the room row and apply it on the phone.
3. Spread retry delays by ±30 %.

- **Effort:** S.
- **Risk:** L. The server already ignores early or duplicate advances.

## 10. Queries that grow with history

| What | Where | Cost | Fix |
|---|---|---|---|
| No index on `duels(host_user_id, created_at)` | 4 queries in `duel.functions.ts:289, 314, 344`, `roomSettings.server.ts:96`, run on create and start | A sequential scan and sort of every room ever made; grows with the table | Add `create index on duels (host_user_id, created_at desc)`. This is a new index, so no stored data changes |
| `challengesMadeLastHour` | `challenge.server.ts:150-162` | Reads **every** challenge the user ever made, then filters in JS | Add `.gte("created_at", oneHourAgo)` with `count: "exact", head: true` (the `challenges_creator` index covers it) |
| `tournament_history` | grows on every Play again; read by every `getRoom` | Bigger every game in a long-lived room (JULZ) | Select explicit columns, and read the history only where `gameIndexOf` needs it |
| The daily board and challenge rows | `asyncRoom.server.ts:218`, `challenge.server.ts:553, 627` | `select("*")` includes other players' answer logs | List only the needed columns |
| N+1 updates | `markInactivity` (`duel.functions.ts:270`), `persistAutoColours` (`playerLook.server.ts:88`), `myChallenges` (`challenge.server.ts:740-760`, up to 33 queries), `createChallengeFromRoom` (16 × 2 inserts), `closeMissedRounds` | One call per row | Batch with `.in()` or `upsert` |

- **Effort:** S each.
- **Risk:** L.

## 11. Practice server functions

### Measurement

- `practiceGenerateFn`, `practiceGradeFn`, `practicePackFn` and the word and move checks
  (`practice.functions.ts:85-335`) have no auth middleware and no rate limit.
- `practicePackFn` deals up to 6 games × 10 puzzles in one request. With Hanoi, that is about 1 s of CPU
  *(est.)*.
- `practiceGradeFn` **awaits** `recordPracticePlay`, with a 1.5 s timeout (`practice.functions.ts:166-169`),
  plus another `getClaims`. The comment says it never blocks, but a slow beta write adds up to 1.5 s
  before the score shows.

### Fix

1. Add `requireSupabaseAuth` and `withinRateLimit`.
2. Fire the beta write without waiting for it (`waitUntil` on Workers, or `void`).

- **Effort:** S.
- **Risk:** L. offline-check covers queued grading.

## 12. Challenge pings poll at 1 Hz

### Measurement

- `PING_POLL_MS = 1000` (`components/async/rivals.tsx:37, 125`), with no check for a request still on
  its way, so slow replies stack up on poor signal.
- Each call does auth, then `async_rooms select *` (every round's puzzles), `challenges`,
  `async_attempts` twice, and `async_results select *`, which includes earlier players' answers.
- That is about 5 queries a second per player while a round is running.

### Fix

Earlier players' finish times are fixed when the friend starts. Fetch them once per round and work out
the pings on the phone. If polling stays, use 3 s with an in-flight guard.

- **Effort:** S–M.
- **Risk:** L. challenge-check covers it.

## 13. Apex ghosts

### Measurement

- Each phone broadcasts `{key, name, colour, s, x}` every 150 ms (`raceGhosts.ts`): about 6.7 a second.
- A 16-player room sends about 107 a second, about 1,600 deliveries a second, about 96,000 per 60 s race.
- The payload is about 250 B with the envelope.

### Fix

Send every 250–300 ms, smooth the movement on the receiving phone, and send name and colour once.

- **Effort:** S.
- **Risk:** L (display only).

## 14. Render-blocking and global CSS

- **A third-party stylesheet blocks every first paint.** `__root.tsx:140-145` links
  `fonts.googleapis.com/css2?family=Press+Start+2P` as a normal stylesheet on every page, Play included.
  - That is two extra connections (googleapis and gstatic) before the first paint.
  - On poor signal, or where Google is slow or blocked, the Play tab waits for a font only Retro game art uses.
  - **Fix:** self-host it like Archivo (OFL), and load it from `preloadGameArt` with the Retro games, the
    way JetBrains Mono already is. Or at least link it with `media="print" onload`.
- **All game CSS is global.** `styles-*.css` (373 KB) and `registry-*.css` (100 KB) carry every game's
  CSS on every page. It splits automatically with finding 1.
- Only `archivo-var-latin.woff2` (90 KB) is preloaded, which is right.

- **Effort:** S.
- **Risk:** L. theme-check and no-wrap-check cover the fonts.

## 15. Smaller items

- **`AsyncRun` re-renders at 10 Hz all the time.** `AsyncRun.tsx:98-104` sets the time every 100 ms for
  the whole daily or challenge run, intro and results included.
  - It doesn't use `useArcadeScreenTickMs` the way the room's `useNow` does (`useDuel.ts:31`), and it
    doesn't pause while the app is hidden.
  - battery-check does not cover async runs.
  - **Fix:** use the same ticker as rooms. Effort S.
- **Word and move checks re-read every round.** `checkWordFn` and `checkMovesFn`
  (`duel.functions.ts:1113-1190`) re-read every round's public and private boards (3 sequential reads)
  on every word or move.
  - **Fix:** cache the merged puzzle per isolate by (room, round), since it never changes during a game.
- **Refetches have no error handling and can land out of order.** `batched` refetches in `useDuel.ts:103-110`
  have no `.catch`, and an older, slower reply can overwrite a newer one.
  - **Fix:** a sequence number per fetch.
- **Returning to the app loads the room twice:** once from the visibility handler (`useDuel.ts:176`) and
  once when the channel re-subscribes (`:139`).
- **Unused fonts ship.** `public/fonts/manrope-500-800-*.woff2` (40 KB) and their licence are no longer
  used since F1. Remove them, or keep them out of the worker's lists.
- **A failed migration still costs a request.** The written-but-not-applied migrations (input type,
  share, terms and others) make their writes fail quietly, but each failure still costs a database round
  trip on a hot path, such as `recordInputType` on every submit. `hasLookColumns` re-probes every 60 s.

---

## Already in good shape

- **Memory caches are bounded.** The course and deal caches (`swing.ts`, `orbit.ts`, `pyramid.ts`,
  `muggins.ts`) clear at 16–64 entries. Renderer sprite caches are keyed by colour and size. Music buffers
  are released per round or screen.
- **The battery work holds.** Arcade loops go through `arenaFrame` (none while hidden), the canvas pixel
  ratio is capped at 2, the AudioContext is suspended when idle, and refetches are limited to one a second.
  So idle tab screens draw nothing.
- **Generators are cheap once loaded.** Banked deals cost under 250 ms each; dictionary load is 14 ms.
- **Practice packs top up carefully.** They respect Save-Data, metered connections, 2G and Battery saver,
  and never top up mid-round. The run queue backs off and retries properly.
- **Indexes are otherwise sound.** `duel_players`, `round_results`, `async_*`, `challenges`,
  `share_events`, `practice_plays`, `room_messages` and the rate-limit table each have the indexes their
  queries use. Only `duels.host_user_id` is missing.

## Suggested order

| Step | Change | Covers | Effort |
|---|---|---|---|
| 1 | Room realtime filters, heartbeat off the published table, results without `answer` | 3, 4 | ~2 days |
| 2 | Hold back the worker install; self-host Press Start 2P | 2, 14 | ~1 day |
| 3 | Timeouts on answer send and clock samples, realtime heartbeat, staggered phase advance | 6, 9 | ~1 day |
| 4 | Host index, challenge count, practice auth and rate limit, async beta write | 10, 11 | half a day |
| 5 | Sound preload per game | 5 | ~2 days |
| 6 | Registry split and per-game chunks, client and server, plus server minify and lazy banks | 1, 7 | the big one, ~1–2 weeks; touches many files |
| 7 | `submitAnswerFn` and `startRoomFn` round trips | 8 | ~2 days |

None of these changes a game's rules, scoring or stored data, so none needs a version stamp.

Rule 4 ("never rewrite stored data") is respected throughout:

- the new index adds no data;
- moving `last_seen_at` changes no stored round, result or log.
