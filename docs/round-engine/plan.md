# B6: one round engine (plan, Stage 1; as built, Stage 2)

> **Temporary parity check.** `scripts/round-engine/legacy.ts` (main da93f5d's own code), `spans.ts`, `deals.ts` and
> `round-engine-parity-check` are retired at the start of wave 3, with Joe's approval.

Wave 0 night 2, Session B. Starts from main da93f5d. Nothing in this plan changes what a player sees or how
anything scores. No stamps, no migrations, no `bun.lock` change.

## 1. How a round runs today

### 1.1 Rooms (live)

| Step | Where | What happens |
|---|---|---|
| Order | `duel.functions.ts` `startRoomFn` | Settings rooms use `dealRoomRounds` (`roomDeal.ts`). Older rooms use `pickRoundOrder` inside `buildRoomPuzzles`. The seed comes from `newRoomSeed()`. Inputs: the host's last 3 orders (`recentRoundOrders`), recent bank keys and the unblock row. |
| Deal | `generate.server.ts` `buildRoomPuzzles` | Calls `stampTieRev(generatePuzzle(type, { unblockRow, bankSeed: seed, recentBankKeys }))` for each type. `generatePuzzle` is B4's one decider: base stamps, then `DEAL_LAYERS`. |
| Store | `startRoomFn` → `splitPuzzle` → data layer `claimRoomStart`, `writePrivatePuzzles` | Also writes `recordRoundRecords` and the `game_started` event. |
| Phases | `advancePhaseFn` (polled by every phone) and data layer `rooms.server.ts` | The order is starting → round_title → intro → puzzle → reveal → result → standings → next round, and after the last round winner_reveal → finished. Timed moves are guarded (`moveTimedPhase`). Other moves go through `setPhase` → `movePhase`, guarded on round and from-phase. Then `leaveBetweenRoundScreen`, `startNextRound`, `finishFromStandings`, `finishAfterWinnerReveal` (`roomPhase.server.ts`). The puzzle phase closes on `puzzleCloseReason` (`roomClose.ts`). The intro starts early on `allIntroReady`. Between-round screens move on early on `betweenScreenDue` / `allContinued`. |
| Grade | `submitAnswerFn` → `roomGrade.server.ts` `gradeRoomAnswer` | The receipt is the room phase plus `phase_started_at` and the server's now. `roomReceiptMsRemaining` gives 0 in the reveal phase. Then `trustedMsRemaining` (ceiling: the limit when there is no stamp), then `gradeAnswer(puzzle, answer, ms, extra, received)`. |
| Store result | data layer `results.server.ts` `insertRoundResult` | One row per (room, slot, round). A duplicate hits the unique index and is ignored. Then `recordInputType`, `markSubmitted` (the buzzer gate) and the player set back to active. If everyone has answered, the room closes (`setPhase` puzzle → reveal, `round_ended all_answered`). |
| Dropouts | `markInactivity` (reveal → result), `finishGame` (Finish now), `forfeitRecord` / `recordForfeitInHistory` | |
| Rank | `scoring.ts` `standings` / `duelOutcome` → `ranking.ts` (B3) | `compareRank`: placing points, then the total, then time used. Time used is `roundTimeUsedMs` per `TieRound`. |

### 1.2 Async: the Daily and challenges

| Step | Where | What happens |
|---|---|---|
| Order and deal | `daily.server.ts` `dealDaily`, `challenge.server.ts` `dealChallenge` | Each picks its own order (`dailyRoundOrder`, `challengeRoundOrder`). Then each runs the same loop as `buildRoomPuzzles`: `stampTieRev(generatePuzzle(type, { unblockRow, bankSeed, recentBankKeys? }))`. That loop now exists three times. |
| Store | `asyncRoom.server.ts` `createAsyncRoom` | Writes the room through data layer `async.server.ts` (`insertAsyncRoom`, `insertAsyncRoomSecrets`). The first insert under a key wins. |
| Round start | `startAsyncRound` | The player taps READY. The server stores `async_results.started_at` (that stamp is the round's own puzzle phase) and records `round_started`. Rounds must be played in order, and none start after `closes_at`. |
| Timings | `asyncRoom.ts` `asyncRoundWindow` / `asyncReceipt` | Built on the room's `roomTimeoutMs`, `roomPuzzleCloseMs` and `puzzleRevealMs`, so they match the room's timings already. |
| Grade | `gradeAsyncAnswer` → `gradeRoomAnswer` | An answer in time counts as a puzzle-phase answer from `started_at`. A late one counts as a reveal-phase answer (0 ms left). |
| Store result | `submitAsyncAnswer` → `updateOpenAsyncResult` | The update is guarded on `answered = false`, so the first stored answer stands. Records `round_finished`, then `refreshAttempt`. |
| Dropouts | `closeMissedRounds` | Once a round's window closes it scores 0 as missed, and `round_abandoned` is recorded. |
| Attempt totals | `refreshAttempt` | Sets `total_score`, `round_scores` and `tie_ms` (from `tieTotal`, which uses the same `roundTimeUsedMs` as rooms). Records `attempt_finished`. |
| Rank | `daily.ts` `rankBoard` → `placesOf`; challenge boards → `standings` | Both go through B3's ranking. |

### 1.3 Practice

| Step | Where | What happens |
|---|---|---|
| Deal | `practice.functions.ts` `dealPractice` / `practiceGenerateFn` / `practicePackFn` | Calls `generatePuzzle(type, { unblockRow, bankSeed: newRoomSeed() })` with no `stampTieRev`. The deal is sealed with `__dealtAt` and a digest of the public half (`practiceSeal.server.ts`). |
| Round start | `practiceStartFn` | Returns a sealed start token. |
| Grade | `practiceGradeFn` / `practiceGradeQueuedFn` → `gradePracticeRun` | `openDealOrThrow` opens the deal. `practiceReceiptMsRemaining` takes `dealtAt` and `startAt` and holds the start to deal + `INTRO_MS` (+5 s with a token). Then `practiceTrustedMs`: with no bound, the claim is used as it is, unlike rooms. Then `gradeAnswer`, imported through `generate.server` on purpose (standard-live-check). Queued runs have no receipt bound. |
| Store | Nothing is stored for the player | Only the beta `practice_plays` row (`recordPracticePlay`). The phone keeps bests and goals on the device. |
| Rank | None | |

### 1.4 The phone (audit B6's own finding)

The room page (`routes/duel.$code.tsx`), the async runner (`components/async/AsyncRun.tsx`) and practice
(`routes/practice.tsx`) each wire the same pieces by hand:

- `createRoomSender`
- `createDraftKeeper`
- `persistStageState` / `clearStageState`
- `useCrashContext`
- `useSignatureVerdict`
- RoundIntro → stage → AnswerReveal

Practice adds the offline queue and the start token.

## 2. Shared or mode-specific

**Shared, and already one function:**

- `generatePuzzle` (the deal and its stamps)
- `gradeAnswer`
- `trustedMsRemaining`
- the close timings (`roomClose.ts`)
- the tie time (`roundTimeUsedMs`)
- the ranking (`ranking.ts`)

**Shared, but copied:**

- "Deal these types on this seed" exists three times: `buildRoomPuzzles`, `dealDaily`, `dealChallenge`.
- "Turn a receipt into the server's time left" exists three times: `roomReceiptMsRemaining`, the mapping inside `gradeAsyncAnswer`, and `practiceReceiptMsRemaining`.
- "Turn a grade into result columns" exists twice: the `insertRoundResult` object and `submitAsyncAnswer`'s `values`. Practice returns the same figures under other names.
- The window "timeout, late from, closes": rooms compute it inline in `advancePhaseFn`; async uses `asyncRoundWindow`.

**Must stay mode-specific:**

- Rooms:
  - live phases and their guarded writes
  - READY and Continue marks
  - presence and inactivity
  - Finish now and forfeits
  - Play again
  - finished pings
  - slots
  - placings
- Async:
  - the attempt (one per device)
  - READY starting each round
  - rounds played in order
  - the room's `closes_at` window
  - missed rounds
  - the H2 solution lock
  - copying a room into a challenge (never regraded)
- Practice:
  - sealing and opening the deal
  - the start token
  - packs and the offline queue
  - no stored result
  - device bests
  - no `stampTieRev`
- Policy differences the engine must keep exactly:
  - With no receipt bound, rooms clamp the claim to the limit through `trustedMsRemaining`; practice passes the raw claim to `gradeAnswer`.
  - Practice imports `gradeAnswer` through `generate.server`.

## 3. The engine

A new directory, `src/lib/round/`. It is server-first, because the rated match needs the deal, grade, store and rank,
and those decide fairness.

| File | Contents |
|---|---|
| `src/lib/round/receipt.ts` (pure, phone and server) | `type RoundReceipt = { mode: "phase"; phase; phaseStartedAt; nowMs }` (rooms) `\| { mode: "start"; startedAt; nowMs }` (async; mapped to phase or late by `asyncReceipt`) `\| { mode: "sealed"; dealtAt?; startAt?; nowMs }` (practice) `\| { mode: "none" }` (queued runs). `receiptMsRemaining(puzzle, receipt): number \| undefined` replaces the three copies; the old names stay as one-line wrappers. |
| `src/lib/round/window.ts` (pure) | `roundWindow(puzzle, startMs)`: `{ timeoutAt, lateFrom, closesAt }`. Today's `asyncRoundWindow`, moved here; `asyncRoom.ts` re-exports it. `roomClose.ts` stays as it is, and the window is built on it. |
| `src/lib/duel/roomGrade.server.ts` (grading stays in this file) | `gradeRound(puzzle, receipt, input, trust: "room" \| "practice")`: receipt → `trustedMsRemaining` (or practice's rule) → `gradeAnswer`. Returns `{ graded, clamped, serverMs, msLeft, receipt }`. `gradeRoomAnswer` stays, as a wrapper with the same signature and result. |
| `src/lib/round/result.ts` (pure) | `resultColumns(graded)`: `{ answer, is_correct, ms_remaining, reaction_avg_ms, correct_count, errors, extra, score }`, which rooms insert and async updates. `practiceReply(graded, puzzle)`: today's practice return shape. |
| `src/lib/round/deal.server.ts` | `dealRounds(order, { seed, unblockRow, recentBankKeys?, tie: true })` → `PuzzleData[]` (the one loop). `dealOne(type, ctx)` for practice (no tie stamp). `buildRoomPuzzles`, `dealDaily` and `dealChallenge` keep their signatures and call it. |
| `src/lib/round/rank.ts` | Re-exports `ranking.ts` and `roundTimeUsedMs` / `tieTotal` under one name, so a new mode imports the engine rather than reaching into scoring.ts. Nothing moves out of `ranking.ts`. |
| `src/lib/round/index.ts` | The surface: `RoundMode = "room" \| "async" \| "practice"` (later `"rated"`) and the types above. |

How each mode calls it:

- **Rooms:**
  - `startRoomFn` keeps its order logic and calls `buildRoomPuzzles` (now through `dealRounds`).
  - `submitAnswerFn` keeps `gradeRoomAnswer(...)` and builds its insert from `resultColumns(graded)` plus duel_id, slot and round.
  - Phases are untouched.
- **Async:**
  - `dealDaily` / `dealChallenge` go through `dealRounds`.
  - `gradeAsyncAnswer` calls `gradeRoomAnswer` with the receipt from `receiptMsRemaining({ mode: "start" … })`.
  - `submitAsyncAnswer` builds `values` from `resultColumns(graded)` plus `answered` / `answered_at`.
  - `asyncRoundWindow` is the engine's `roundWindow`.
- **Practice:**
  - `dealPractice` goes through `dealOne`.
  - `practiceReceiptMsRemaining` and `practiceTrustedMs` become wrappers on the engine's receipt and trust rule.
  - `gradePracticeRun` still calls `gradeAnswer` (through `generate.server`) and returns `practiceReply(...)`.

**Why the call sites keep their names.** About 30 checks read the server and route files' text. Two examples:

- room-practice-grade-check requires exactly three files that call `gradeAnswer(` or `gradeRoomAnswer(`: `asyncRoom.server.ts`, `duel.functions.ts` and `practice.functions.ts`. It also requires the literal `await import("./roomGrade.server")` in `submitAnswerFn`.
- beta-recording-check, round-time-check, room-late-run-check and finished-pings-check pin `setPhase`, `recordRoomEvent`, `puzzleCloseReason`, `markSubmitted` and `msLeft` text in `duel.functions.ts`.

So the engine takes the shared policy, and each mode's server function keeps its own calls, guards, events and data
layer writes, in the same order. Under this plan **no existing check's text changes**. If Stage 2 finds one that
must change, I stop and ask, listing it.

**What this plan does not do: the phone hook (`useRoundSession`).** Audit B6's phone half would move the sender,
drafts, stage state and phase wiring out of the three screens. room-send-check (24 scans), room-draft-check (17),
stage-state-reload-check (19), net-request-check (7) and room-practice-grade-check (3) read that wiring out of
`duel.$code.tsx`, `AsyncRun.tsx` and `practice.tsx`. That needs your approval of each changed check, and a
first-paint and parity run in the browser. I propose it as a **separate PR (B6b)** after this one, with the list of
check edits written up for approval first. In this PR the phone gets only `receipt.ts` and `window.ts`, which are
pure; no screen changes.

### How the rated match (wave 3) plugs in, without building it

- **Deal:**
  - A rated match is a set of rounds on a server seed: `dealRounds(order, { seed, tie: true })`.
  - For best-of-N, deal N rounds at the start. The order picker is the rated mode's own. The stamps are recorded through `dealtSignature`.
  - 4 or 8 players: the same deal for everyone, as rooms.
- **Timing and grading:**
  - Live 1v1 / 4 / 8 would use rooms' phase receipt.
  - Recorded runs (play now, opponent later) would use async's `{ mode: "start" }` receipt and `roundWindow`.
  - Both go through `gradeRound` → `gradeAnswer`, so they score as practice does.
- **Store:** `resultColumns(graded)` into the rated table's row. A new data-layer module (`src/lib/data/rated.server.ts`) does the write.
- **Rank:**
  - The match winner per round comes from `compareRank` on (total, time).
  - Best-of-N is the count of round wins: the rated mode's own rule, kept beside the engine as `rated/series.ts`.
  - Final places come from `placesOf`.
  - The rating update reads those places.
- **Phone:** after B6b, `useRoundSession("rated")` drives intro → play → reveal as the other three modes do.

## 4. Proving nothing changed

**Existing checks.** All run unchanged:

- Grading and receipts: room-practice-grade-check (42,690 grades: room = practice), practice-receipt-check, practice-seal-check.
- Room flow and timings: round-time-check, room-late-run-check, finished-pings-check, beta-recording-check, tie-break-check, dropout-finish-check, room-continue-check.
- Async and challenges: daily-check, challenge-check, security-fixes-check.
- Deal and ranking identity: deal-identity-check (every game's deal and 16 whole rooms against main), ranking-identity-check (3,000 rooms and 2,000 Daily boards).
- The whole server path: server-functions-check (create through Play again on a real PostgreSQL, the stored score equal to practice's replay, plus the daily, async and a challenge).
- Browser checks in CI: room-practice-parity-check, arcade-room-practice-check, standard-live-check.

**New: round-engine-parity-check** (fast, shard `e`). It compares main's code with the engine's, both in one
process. Main's functions are kept verbatim as a fixture copy in
`scripts/round-engine/legacy.ts`, taken from da93f5d and checked byte for byte against `git show`.

- **Deals:** `buildRoomPuzzles`, `dealDaily` and `dealChallenge` before and after, on 200 seeds × the room settings presets, both dailies and three challenge sizes; practice's `dealOne` against `generatePuzzle` on 6 seeds a game. The digests must be identical.
- **Receipts and grades:** every case from room-practice-grade-check's fixtures (puzzle-score-legacy, tap logs, replay runs, empty and junk answers). Each is graded under:
  - a room receipt: puzzle phase +80 ms / +1.2 s; reveal phase +0.1 s / +3 s; no stamp
  - an async receipt: in time, late, closed
  - a practice receipt: with a token, without one, a token too late, no `dealtAt`, queued

  Before and after must give the same `Graded` (deep-equal), `clamped`, `serverMs` and `msLeft`.
- **Result rows:** `resultColumns(graded)` equals the object the old `insertRoundResult` call and the old async `values` built (deep-equal, including `answer: null` for ""). Practice's reply is unchanged.
- **Windows:** `roundWindow` equals `asyncRoundWindow` for every active game at 5 start times. Rooms' close moment (`puzzleCloseReason`) is unchanged at elapsed −1 / 0 / +1 ms around the close.
- **Rankings, tie-breaks and dropouts:**
  - Rooms: 2,000 seeded rooms of 2–16 players, Total and Placings, built from engine-made results. They include level totals and level times, players who left or went inactive mid-room, and missed rounds (no row).
  - Async: missed rounds scored 0 as missed.
  - The old and the engine's paths must give the same `standings`, `duelOutcome`, `rankBoard` and `tieTotal`.
- **End to end:** server-functions-check already stores a room, a Daily and a challenge through the real handlers. The new check re-runs that harness's room, daily and challenge flows once with the legacy grade functions swapped in, and compares every stored `round_results` / `async_results` row field for field (ids and times excluded).

## 5. Commits (Stage 2, once approved)

1. The engine (`src/lib/round/*`, `gradeRound` in `roomGrade.server.ts`) and round-engine-parity-check, with nothing calling the engine yet.
2. Rooms onto it (`buildRoomPuzzles` → `dealRounds`, `submitAnswerFn` → `resultColumns`).
3. Async onto it (`dealDaily`, `dealChallenge`, `gradeAsyncAnswer`, `submitAsyncAnswer`, `asyncRoundWindow`).
4. Practice onto it (`dealPractice`, the receipt and trust wrappers, `practiceReply`).
5. Merge Session A, keeping every `events.server.ts` call where it fires (each stays in its mode's server function, since none of those move). Then docs and the CLAUDE.md line.

## 6. Questions for Joe

1. **Scope:** do the server engine now, and the phone hook (B6b) as its own PR with its check edits listed for approval? Recommended.
2. **The fixture copy of main's functions** (`scripts/round-engine/legacy.ts`) for the parity check: acceptable? The alternative is recorded fixtures only.
3. **Practice's no-bound rule** (the raw claim, where rooms clamp to the limit) stays as a named policy, `trust: "practice"`, not unified. `gradeSubmission` clamps to the limit anyway, but a non-number claim and Nucleus / Forage (graded outside `gradeSubmission`) could score differently if unified, so I'd leave it.

## 7. Stage 2: as built (approved by Joe, 9 Nov 2026)

Scope as approved: the server engine only. The phone half (`useRoundSession`) is B6b, a separate PR later, before wave
3's match screens.

**The engine, `src/lib/round/`:**

| File | What it holds | Who calls it |
|---|---|---|
| `window.ts` | `roundWindow`, `windowReceipt` (moved unchanged from `asyncRoom.ts`) | `asyncRoom.ts` re-exports them as `asyncRoundWindow` / `asyncReceipt`, so the Daily, challenges and the phone's `AsyncRun` are unchanged |
| `receipt.ts` | `RoundReceipt` (`phase`, `start`, `sealed`, `none`), `receiptMsRemaining`, `phaseReceiptOf`, `sealedStartMs`, `PRACTICE_START_SLACK_MS` | `roomGrade.server.ts` (`roomReceiptMsRemaining`), `asyncRoom.server.ts` (`gradeAsyncAnswer`), `practiceReceipt.ts` (its three functions are wrappers) |
| `trust.ts` | `trustedClaim(…, "room" \| "practice")`: the two named rules, practice's raw claim with no bound kept exactly | `roomGrade.server.ts` `gradeRound`, `practiceReceipt.ts` `practiceTrustedMs` |
| `result.ts` | `resultColumns(graded)` | `submitAnswerFn` (rooms' insert, `extra: asJson(...)` as before), `submitAsyncAnswer` (its `values`, `extra: ?? null` as before) |
| `deal.server.ts` | `dealRounds`, `dealOne` (defined in `generate.server.ts` beside `generatePuzzle`, so neither file imports the other) | `buildRoomPuzzles`, `dealDaily`, `dealChallenge`; practice's `dealPractice` |
| `rank.ts` | re-exports `ranking.ts` and `roundTimeUsedMs` | wave 3; nothing moved |
| `index.ts` | `RoundMode` and the pure parts | wave 3 |

`roomGrade.server.ts` gains `gradeRound(puzzle, receipt, answer, ms, extra, rule)`. `gradeRoomAnswer` keeps its
signature and calls it.

**Different from the plan:**

- **`practiceReply` was not added.** beta-recording-check pins practiceGradeFn's literal `return { puzzle, isCorrect: graded.isCorrect, score: graded.score, …`, so practice keeps its return as it is.
- **No end-to-end re-run of server-fn-harness with main's functions swapped in.** The app's modules can't be swapped without a module mock. Instead:
  - the parity check compares the row builders themselves, main's against the engine's, on every graded case and on odd grades;
  - server-functions-check still stores a room, a Daily and a challenge through the real handlers on PostgreSQL and checks the scores, unchanged.
- **Deals are compared in two fresh processes** (`scripts/round-engine/deals.ts legacy|engine`), with the platform's random sources seeded:
  - Generators keep caches across calls, so a second deal in one process can draw differently, on main as today.
  - Under bun, main's own `dealDaily` dealt differently in two processes even inside `withSeededRandom`. The generators reached through the `@/` alias (src/puzzles) apparently read a copy of random.ts that the seeded hook doesn't reach.
  - That is a check-time property only (the live app draws from crypto anyway) and is left as it is. It is flagged in the report.
- **Depth:**
  - The quick run (fast shard `e`, ~35 s locally) has all 2,000 seeded rooms, every receipt shape for every case, and grades on two room and two async receipts per case (arcade runs: the first stored run of each game, in time).
  - `CHECKS_FULL=1` (Actions → Checks → Run workflow with "full") grades every case under every receipt, every stored arcade run, and 6 practice seeds and 40 room seeds (~2 min).
  - The Full suite holds browser checks only, by its own rule (`.github/ci/browser.ts`), so the full depth runs in Checks, not in the Full suite.
