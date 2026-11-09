# Speed fixes 1 and 5 (Nov 2026)

From `docs/audit-nov-2026/performance.md`, findings 1 ("every page downloads all 92 games") and 5 ("the first tap
decodes about 100 MB of sound"). No game's rules, scoring, stamps or look changed.

## Results

Measured with `bun scripts/perf-budget.ts` on production builds (`bun run build`) of main 1509a99 and this branch.
Raw bytes from stat, gzip at level 9 (Cloudflare serves brotli, 10–20 % smaller). Decoded sound is what Web Audio
holds: duration × channels × 48 kHz × 4 bytes.

| | Before (main) | After |
|---|---|---|
| First screen (the root and the Play tab, every static import) | 36 files, 4,651 KB raw, 1,397 KB gzip | 58 files, 1,519 KB raw, 419 KB gzip (−67 % raw, −70 % gzip) |
| Room screen before any game | 4,921 KB raw, 1,492 KB gzip | 3,850 KB raw, 1,250 KB gzip |
| Practice list before any game | 4,760 KB raw, 1,435 KB gzip | 3,665 KB raw, 1,183 KB gzip |
| Each game's own code on top of the room screen | (already downloaded) | median 26 KB raw / 11 KB gzip, largest (Cue Ball) 73 KB / 26 KB |
| First tap: sound files fetched and decoded | 429 files, 6,565 KB, 416 s of audio, ≈107 MB decoded | 50 files (63 slots), 605 KB, 41 s, ≈9 MB decoded |

First-tap memory is the decoded sound (the audit's ≈100 MB); JS heap was not measured (no browser runs).

## 1. Only the game being played is downloaded

- **`src/lib/duel/catalogue.ts`**: the light catalogue. Every game's id, name, category, clock, reveal length and
  heading, arcade run, timer, retired flag, theme, desktop mode and GOAL line, and every timing and category helper
  (`puzzleTimeLimitMs`, `typesInCategory`, `puzzleRunMs`…). Menus, lists, room settings, the tie-break, the offline
  packs and the play header read it. Its data, `catalogue.data.ts`, is generated from the registry by
  `bun scripts/game-catalogue.ts`; **re-run it after adding a game or changing a definition's name, category,
  timeLimitMs, revealMs, arcadeRun, showTimer, revealHeading or GOAL line** (game-catalogue-check fails until then).
- **`src/lib/duel/registry.ts`**: still the full registry, for the server and the checks; it re-exports every
  catalogue helper, so both read the same values. **The phone never imports it** (game-catalogue-check: only
  `*.server.ts` files and `puzzles.ts` may).
- **`src/lib/duel/gameModules.ts`** (generated with the catalogue): one `import()` per game, so each game is its own
  chunk. **`src/lib/duel/gameLoader.ts`**: `loadGameDef`, `preloadGame`, `useGameDef`; the definition is built by
  `registerDefinition.ts`, exactly as the registry builds it. **`src/components/duel/GameParts.tsx`**: `GameStage`,
  `GameReveal`, `GameIntroExample`, which draw the game's own components once its chunk is here.
- **Preloading.** A room preloads the current round's game and the next one's (round 1's from the lobby), so the
  next game arrives during this round and a round never waits. Practice fetches the game's chunk alongside its deal
  and opens the intro once both are here. The Daily and challenges preload the current and next round's game.
  Intro demos wait for the game's chunk with their still showing; replays and reveals load on demand.
- **Offline practice.** The service worker already keeps every client file, game chunks included, so a pack plays
  with no signal as before.
- **Cut from the root:** the offline queue reads `arcade/diagnosticsWire.ts` (the counters' wire format) instead of
  the diagnostics that import every sim; the play header's goal line reads the catalogue's GOAL line instead of the
  whole help copy; the game menu's own help sheet is loaded when first opened; RoundIntro's course and deal builders
  (Grappler, Rainbow Bridge, Muggins, Thirteen) and art preload load their game's code when the intro starts.

**Still shared (follow-up):** the room and practice routes carry the help copy (`instructions.ts`), the arcade
reveal and replay renderers (`revealRenderers.ts`, `playback.renderer.ts`), the sound observers (`gameSounds.ts`)
and the reveal breakdowns, which import constants and helpers from every arcade sim, so those routes still
download every sim once (≈0.26 MB gzip) before the first game. Splitting them per game is the next step.

## 5. Sounds when needed

`src/lib/sound.ts`:

- The first tap fetches and decodes only the small shared set, group `core` (UI, the clock's warnings,
  `shared.*`): 50 files.
- A room (and the Daily's and challenges' screens) loads group `room` (Prepare to Duel, round titles, the winner
  and podium) and group `voice`.
- A game starting (`loadGameSounds(type)`, from its intro and its stage) loads `voice`, the shared arcade (`arc_*`)
  or puzzle (`pz_*`) sounds its kind uses, and its own slots (named for it, `<gameId>.<event>` or `<gameId>_…`,
  `soundSlotGame`). The games before the last two let their files go; shared groups stay.
- At most five files decode at once. Each URL is fetched and decoded once, however many slots share it.
- A slot asked for before its file is here plays nothing (or the shared sound it stands in for, as during the old
  first-tap preload) and is fetched then, so it plays from its next moment. Music still loads per screen and round.
- **No first sound is silent.** Rooms (and the Daily and challenges) decode the next round's sounds during the
  current round, and the intro's Ready waits for `gameSoundsReady(type)` (`useGameSoundsReady`, at most 4 s if a
  file never answers). sound-on-demand-check proves the first tap decodes only `core`, that every game's sounds
  decode within its intro and within the shortest round on a simulated 1.6 Mbit/s link (slowest, Mixed Signals,
  ≈5.6 s of a 30 s window), that a three-round room has each round's sounds ready as its intro opens with only two
  games resident, and that every slot then plays its own file the first time.
- **Checks.** sound-manifest, sound-batch6, sound-nov-2026 and sound-retheme play every slot, so each calls the
  checks-only `loadAllSounds()` right after `unlockAudio()` (Joe's decision, 8 Nov 2026); their assertions are
  unchanged.

# Speed fixes 2, 4 and 6 (8 Nov 2026)

Items 2, 4 and 6 of `docs/audit-nov-2026/performance.md`. No game's rules, scoring, grading or stamps changed;
no stored data is touched. Realtime (the subscriptions, the presence heartbeat, the socket's own heartbeat) is
left for the Supabase move.

## 2. The offline download

**What changed**

- A device that hasn't finished a practice round, or is on Save-Data, a metered or 2G-class connection, Battery
  saver, or has a room, daily or challenge on screen, registers `/sw.js?fill=later`. That worker's install
  downloads nothing: it only drops kept media whose bytes changed (`src/lib/offline/serviceWorker.ts`
  `registrationUrl`, `install.ts` `fillAtInstall`).
- The download comes later. Each offline sync (3 s after opening, on reconnecting, on returning to the app, every
  5 minutes, and back on the Practice list after the first finished round) sends the worker a `FILL` message when
  offline practice may download (`packs.ts` `offlineDownloadAllowed`, the packs' own rules plus "no room on
  screen"). The worker downloads while the packs top up; the packs never wait for it. A second `FILL` does
  nothing.
- Any install also downloads nothing on Save-Data, a metered or 2G connection, or with a room, daily or
  challenge open (the worker checks its own connection and open windows; `sw.template.js` `fillDeferred`). That
  covers a new build arriving mid-room on a device that already has the download.
- A download takes only what changed (`fill()`). The build gives each app file a SHA-256 (`CONFIG.appHash`, from
  `swPlugin.ts`). The worker keeps a record of the last download (`/__joulz-manifest` in the media cache):
  - an app file with the same hash is copied from the cache that holds it;
  - a content-named bundle file kept by any build is copied;
  - the four kept pages are always fetched;
  - media is checked against the record, so the phone hashes kept media only when the record doesn't know it.
    That happens once on the first download after this change, and for a file kept once played.
- Packs no longer top up while a room, daily or challenge is on screen.
- Devices that already had the worker keep `/sw.js`; they are never switched.

**Before → after** (production build of this branch: 80 app files, 5.43 MB; 460 install media files, 22.23 MB)

| | Before | After |
|---|---|---|
| First visit (a room link, the Play tab) | 27.7 MB in the background from the first open | 0 MB until the first finished practice round; only what the page itself loads |
| Save-Data, metered or 2G, Battery saver, in a room | 27.7 MB | 0 MB (waits) |
| After the first finished practice round | (already done) | 27.7 MB, then the packs, as before |
| After a Publish (only the build id changed) | 5.43 MB of app files, plus SHA-256 of ~22 MB of kept media on the phone | 0.93 MB (30 changed files) + 4 pages; no hashing |
| After a Publish that changes shared code (this PR's build against main's) | same as above | 4.20 MB (41 changed files) + 4 pages; no hashing |

The two Publish rows compare real builds file by file. A change to shared code renames many chunks, because
each importer's content names its imports, so a release still re-downloads most of the JS it touches.

## 4. The room's results refetch

**What changed** (`src/lib/duel/roomResults.ts`, `api.ts` `fetchResults`, `useDuel.ts`)

- The refetch names its columns and leaves out `answer` (an arcade run's whole input log).
- This device's own answers are fetched once a row, by row id. A stored answer never changes.
- Other players' rows carry `answer: null`. No room screen read them: replays fetch the one log they play through
  `roundReplayFn` / `gameReplaysFn` when they are shown.
- `extra` is kept whole, because the reveal, near misses and breakdowns read it.

**Before → after**

- Measured in server-functions-check, on its room of 2 players × 3 rounds of real bot input logs:
  - `select("*")`: 72,594 bytes;
  - the named columns: 7,850 bytes (about 1.3 KB a row);
  - the device's own 3 answers, fetched once: 64,688 bytes (about 21.6 KB an arcade answer).
- In a 16-player arcade room *(est., from those per-row figures)*:
  - **at round 6:** 96 rows a refetch, about **2.2 MB → 126 KB**;
  - **at round 12:** 192 rows a refetch, about **4.4 MB → 250 KB**;
  - **a whole round** (about 7 refetches): about **15 MB → 0.9 MB** a phone, plus the device's own answer once
    (~22 KB).

## 6. Timeouts and retries

**What changed** (`src/lib/net/request.ts`)

Every call has a time limit. Past it the request is aborted and fails like a dropped one. Only calls the server
answers the same way however often they arrive are retried here.

| Calls | Limit | Retries |
|---|---|---|
| Reads: reveal, word and move checks, room preview; the room, players and results reads (`supabaseRead`) | 8 s | 3 tries, 300 / 900 ms apart, on a dropped request, a time-out or a gateway 408/502/503/504 (never on the app's own error) |
| The answer | 10 s | by the room's sender (roomSend.ts: 400 ms, 800 ms … while the round takes answers); the server keeps one row per player per round and answers a duplicate "stored" (server-functions-check: racing duplicates, one row, both ok) |
| Phase steps, READY, Continue, host presence | 8 s | none (each phone asks again on its own schedule) |
| Presence heartbeat | 5 s | none (the next one follows in 4 s) |
| Clock sample | 3 s | none (three samples; a round trip over 1 s doesn't replace a measured clock) |
| Practice pack deals (background, nobody waits) | 3 min | none |
| Every other server call (`createStart` default) | 60 s | none (create, join, start and Play again are never sent twice blindly) |

On a dev server every limit is 6 times longer, because a dev server compiles modules on first use.

**On a dropped connection, before → after**

- **A stalled answer send.** Before, it stayed "sending" for good and was never sent again, so the round could
  end with no answer. After, it is aborted at 10 s and sent again until it lands or the round closes.
- **The clock's first measurement.** Before, it had no limit, so the room screen could stay on loading forever.
  After, it takes at most 9 s, then the room loads.
- **A lost phase-change event.** Before, a dead socket missed phase changes for up to about 25 s. After, a phase
  still due 3 s after it fell due reads the room again, every 4 s at most, so the phone catches up in about 3–4 s
  (`duel.$code.tsx`, `CATCH_UP_AFTER_MS`).
- **Room reads** (the room, players, results). Before, they had no limit. After, a read that stalls is aborted at
  8 s and tried twice more.

## Checks

- **New:**
  - offline-delta-check (~1 s): the deferred install, FILL, only-what-changed, no phone hashing, the deferral
    rules and the page's registration choice;
  - net-request-check (~15 s): limits, retries, a hung answer sent again by the room's sender, the clock limit,
    the results columns and own answers, and the wiring.
- **Extended:** server-functions-check gains a "results refetch" section, with new assertions only. Through a
  device's own client (RLS and grants apply), the named columns plus the own-answer read give exactly the
  `select("*")` rows, with other players' answers left out.
- **Not run here:** offline-check is a browser check, left to the Full suite. Its passes are unchanged by design:
  - a fresh device's worker still controls the page (the deferred worker);
  - a device that has practised registers `/sw.js` and downloads on install, as before.

# Speed fixes 3 and 7 (9 Nov 2026)

Items 3 and 7 of `docs/audit-nov-2026/performance.md`, for the Supabase move. No game's rules, scoring, grading or
stamps changed; no stored row is rewritten.

## 3. Lighter live rooms

**What changed**

- **Per-room realtime** (also security audit L6). `useDuel` opens its channel once the room's id is known, and each
  subscription carries a filter: `duels` `id=eq.<id>`, `duel_players` and `round_results` `duel_id=eq.<id>`.
  `useRoomChat`'s `room_messages` inserts have `duel_id=eq.<id>`. Realtime no longer checks every change in every
  room against every phone.
- **Heartbeats off the realtime feed.** `heartbeatFn` writes `duel_presence` (`presence.server.ts`
  `recordHeartbeat`), a table outside the `supabase_realtime` publication, so a heartbeat reaches no phone. Its reply
  carries the room's last-seen times (members only), and the phone lays them over its player rows (`roomSeen.ts`
  `withSeen`). So `isConnected` and every rule built on it read the same times as before, with no refetch. The server
  reads the later of the two columns (`withPresence`, in advance, READY, Continue and Finish now). The lobby's
  stale-host RPC does the same.
- **Player updates in place.** A `duel_players` UPDATE is applied to the list (`applyPlayerUpdate`). If only
  `last_seen_at` changed (a heartbeat on a database without the table), only the time is noted. A new row, or a
  payload that lacks a field, reads the list afresh as before.
- `useDuel`'s full read (`load`) sends a heartbeat alongside it. Back from the background, the rows and the times
  arrive together.

**Migration** `supabase/migrations/20261109130000_room_presence.sql`, **written but not applied**. It is
idempotent (applied three times over every migration on a local PostgreSQL 16). Apply it to both the current
Lovable database and the new project, in either order with publishing. It creates `duel_presence` with a composite
key to `duel_players (duel_id, user_id)`, ON DELETE CASCADE, so an outsider's heartbeat is refused. RLS is on, no
client grants, and the table is not published. It also redefines `disband_stale_room` to read
`greatest(duel_players.last_seen_at, duel_presence.last_seen_at)`. Until it is applied, the heartbeat writes
`duel_players.last_seen_at` as before. The phones then apply that update in place instead of refetching, and the
reply carries the times from there. The server rechecks for the table every 5 minutes.

**Volume for a room of 16** *(est., from the code paths)*

| | Before | After, no migration | After, migration applied |
|---|---|---|---|
| Player-list refetches from heartbeats | ~16 a second (one a second per phone) | 0 | 0 |
| Realtime messages from heartbeats | 4 changes a second × 16 phones | the same | 0 |
| Realtime RLS checks per change | every subscriber in every room | this room's phones only | this room's phones only |
| Database calls per heartbeat (server) | 1 update | update + 1 read | upsert + 1 read |

## 7. Faster server start

**What changed**

- **Minified server build.** `vite.config.ts` passes `nitro: { minify: true }`. The Cloudflare preset sets
  `minify: false`, and Lovable's config forwards other nitro options inside its own build too.
- **The grader apart from the generators.** `gradeAnswer` (and `standardParts`) moved, line for line, to
  `gradeAnswer.server.ts`. `roomGrade.server.ts` imports it from there, so a room, daily or challenge answer no
  longer loads `generate.server` and `puzzleBank.server`. `generate.server.ts` re-exports both. Practice still
  imports `gradeAnswer` through `generate.server` (its deal loads that chunk anyway). This also keeps the built
  `generate.server` chunk exporting `gradeAnswer` by name, which standard-live-check reads.

**Measured** with Nitro's node-server preset builds of main e4526b6 and this branch, on this container (4 cores).
Each figure is the median of 7 fresh `node` processes (`import()` of the chunk, then one call). The first answer
grades the 7 rounds of a room dealt from seed 6100 (empty answers). The first deal is `buildRoomPuzzles` for seed
6100 with all seven categories. Gzip is level 6 over every server `.mjs`.

| | Before (main) | After |
|---|---|---|
| Server JS (Cloudflare preset) | 26.4 MB raw | 13.5 MB raw (node preset, 26.5 → 13.5 MB) |
| Server JS gzip (node preset) | 5.50 MB | 3.87 MB |
| What the first answer loads (roomGrade's static closure) | 23.6 MB | 5.8 MB |
| What the first deal loads (generate.server's closure) | 23.6 MB | 12.1 MB |
| First answer (import + grade) | 912–1,001 ms (import 878–954) | 498–505 ms (import 452–454) |
| First deal (import + deal) | 1,267–1,364 ms (import 949–972) | 1,074–1,112 ms (import 741–799) |

A Workers isolate on shared hardware is likely slower in absolute terms. The ratios are what to expect. Grades are
identical: the built bundle's `gradeAnswer` matches the source on score and verdict for every stored run in
`replay-runs.json` and for three answers to each round of 40 dealt rooms (1,085 grades, 0 differ). A grade's `extra`
and a deal's boards vary between two runs of the source itself, so they can't be compared byte for byte.

**Not done (follow-ups):** each bank behind its own `import()` (fix 7.2, needs async deal paths); the grader's
closure still carries the dictionary (1 MB), a renderer chunk and react-router (the shared registry); Hanoi's bank
and Gridlock's tables (7.5); practice's first grade still loads the generators.

## Checks (3 and 7)

- **New:** room-presence-check (~1 s): the last-seen view, in-place updates, filtered subscriptions, the
  unpublished table, the grader's imports and the minify setting.
- **Extended:** server-functions-check gains a "heartbeat presence" section (8 new assertions, none changed):
  - duel_presence is unpublished;
  - the reply carries the times;
  - the player row is not written;
  - an outsider stores and learns nothing;
  - a device can't read the table;
  - the stale-host RPC reads both columns;
  - before the migration, the player row is written as before.
- **Changed with Joe's approval:** room-practice-grade-check line 254's exemption now also names
  `gradeAnswer.server.ts`, the definition's new home. Its grader list and the async-room guard are unchanged.
