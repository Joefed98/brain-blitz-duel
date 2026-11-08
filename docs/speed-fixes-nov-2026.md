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
  screen"). The worker downloads, then the packs top up. A second `FILL` does nothing.
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
| Every other server call (`createStart` default) | 30 s | none (create, join, start and Play again are never sent twice blindly) |

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
