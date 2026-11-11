# Matchmaking interface (wave 3, W3b)

The contract between W3b (matchmaking, rated matches, recorded runs) and the sessions that use it: **W3c** (the
rated screens: Play card, choosing, searching, VS, the 1v1 game frame, the match result) and **W3d** (4 and 8
players). W3a's side is `docs/rated/ratings-interface.md`; until W3a's draft is merged in, W3b codes against the
adapter in `src/lib/rated/ratings.server.ts` (section 6), and this file says what it assumes.

Status: **draft, kept current on the W3b PR.** Last change: 11 Nov 2026.

## 1. Where things live

| File | What |
|---|---|
| `src/config/ratedConfig.ts` | The switches (section 2). |
| `src/lib/rated/matchmaking.ts` | Pure rules, phone-safe: formats, choices, the queue's bands, pairing, recorded-run choice, playback, the hidden finish, the match outcome, rematch timing, the age label. |
| `src/lib/rated/timeline.server.ts` | A recorded game's score over time, from the server's own replay. |
| `src/lib/rated/ratings.server.ts` | The W3a adapter (`matchRating`, `recordRatedMatch`). |
| `src/lib/rated/rated.server.ts` | The flow: queue, match making, recorded runs, settling, rematch, live progress. |
| `src/lib/rated/rated.functions.ts` | The server functions the phone calls (section 3). |
| `src/lib/data/rated.server.ts` | Every rated table read and write (typed, no `any`). |
| `supabase/migrations/20261114200000_rated_matchmaking.sql` | The tables and functions. |
| `supabase/migrations/20261114200100_analytics_rated_events.sql` | The four events. |

## 2. Switches

All in `src/config/ratedConfig.ts`; Joe edits the file and merges to `main`. The server reads them on every queue
join (`ratedOptionRefusal`), so an option that is off can't be queued for whatever a phone sends.

| Switch | Launch | Meaning |
|---|---|---|
| `RATED_PLAY_FOR_EVERYONE` | `false` | false: only accounts on `shop.testers` (D1's list) can queue; true: every signed-in account. W3a's weekly R challenges read the same answer through `ratedPlayOpenFor(isTester)`. |
| `RATED_FORMATS_ON.bo3` | `true` | 1v1 best of 3. |
| `RATED_FORMATS_ON.bo5`, `.bo7` | `false` | 1v1 best of 5 and 7. |
| `RATED_FORMATS_ON.ffa4`, `.ffa8` | `false` | 4 and 8 players (W3d). |
| `RATED_CHOICES_ON.mixed`, `.puzzles`, `.arcade` | `true` | Mixed (the default), All puzzles, All arcade. |
| `RATED_CHOICES_ON.<pick>` | `false` | Each single category: the six puzzle categories and the five arcade groups (the room picks). |

The phone offers only `openOptions()`.

## 3. Server functions (`src/lib/rated/rated.functions.ts`)

Every one takes the signed-in caller (`requireSupabaseAuth`); a guest (no profile) gets `{ ok: false, reason: "account" }`.

| Function | Input | Answer |
|---|---|---|
| `ratedStatusFn` | — | `RatedStatus`: `open` (testers / everyone), `account`, `options` (what is on), `placement`, `searching` (the caller's queue entry), `activeMatchId`. |
| `ratedQueueJoinFn` | `{ format, choice }` | `{ ok: true, joinedAtMs }` or `{ ok: false, reason, message }`. Refused: not open to the caller, option off, banned, rate limit (`RATED_QUEUE_LIMIT`), no rating from W3a, already in a match. Records `queue_joined`. |
| `ratedQueuePollFn` | — | `QueuePoll`: `{ state: "idle" }`, `{ state: "searching", waitedMs, band }` or `{ state: "found", match }`. Call about once a second while searching. Each poll tries to pair the caller (section 4) and, from 8 s, makes a recorded match. Records `match_found`. |
| `ratedQueueLeaveFn` | — | `{ ok: true }` (a searcher already claimed by a match stays in it). |
| `ratedMatchFn` | `{ matchId }` | `RatedMatchView` (section 5), players of the match only. |
| `ratedOpponentScoreFn` | `{ matchId }` | `OpponentScore` for the current game: `{ round, score, finished, hidden }`. `score` is null while hidden (the final 20 %) and, for a recorded game without a timeline, until the game's result. |
| `ratedProgressFn` | `{ matchId, round, score }` | Display only: the caller's live score this game, shown to the opponent. Never read to grade, rank or rate. |
| `ratedSettleFn` | `{ matchId }` | The match result once its room is finished (`RatedMatchResult`, section 6). Idempotent; W3a's `recordRatedMatch` is called exactly once per match whoever calls this. Also run by the next queue join. |
| `ratedRematchFn` | `{ matchId }` | `{ state: "waiting" }`, `{ state: "agreed", match }` or `{ state: "closed" }`. Live matches only; both players within 8 s of the match's end (`REMATCH_WINDOW_MS`). The rematch is a new rated match, counted by W3a like any other (its 4-a-day rule). Records `rematch_requested`, then `rematch_accepted` once. |

## 4. The queue

- Entries are matched only with the same `format` and the same `choice`.
- The band: ±50 (`BAND_START`), +50 (`BAND_STEP`) every 2 s (`BAND_STEP_MS`), so ±200 (`BAND_MAX`) from 6 s; at 8 s
  (`RECORDED_AFTER_MS`) the searcher gets a recorded run. Two searchers pair when their ratings are within the wider
  of their two bands (`canPair`); the nearest rating wins, then the longest wait (`bestPartner`).
- The rating is W3a's `matchRating(user, { format, choice })`: the rating the match will move (a single-category
  choice blends that category's in, on W3a's side).
- Placement players (`placement: true` from W3a) never enter the live queue: their first poll makes a recorded match
  against a beginner's run (owner rating at most `beginnerMax`, or unrated).
- Pairing is atomic: `rated_queue_claim` puts every listed searcher in one match or none. W3d passes 4 or 8 users.

## 5. Rated matches

- A match is an ordinary room (`public.duels`), made by the server already started, with the room's own phases,
  grading and results: the same deals for every player, Classic (`RATED_GAME_MODE`), dealt by `dealRoomRounds` from
  `matchSettings(format, choice)` (best of N deals N games, all played; the match is the games won).
- `RatedMatchView`: `matchId`, `format`, `choice`, `gameMode`, `kind` (`live` / `recorded`), `roomId`, `roomCode`,
  `status`, `players` (`userId`, `slot`, `displayName`, `ratingBefore`, `placement`), and for a recorded match
  `recorded` (`label` "Recorded run · 2 h ago", `recordedAtMs`, `ownerName`, `ownerId` for the player card, `look`
  (the owner's stored skin per game, E1's `look`; the scenery stays the viewer's world theme), `fallback`).
  The phone opens the room with the existing room route (`/duel/<code>`).
- The game header shows both scores; `ratedOpponentScoreFn` gives the opponent's, hidden for the final 20 % of each
  game (`opponentScoreHidden`, `HIDDEN_FINISH_SHARE`) and revealed with the game's result (the room's reveal).
- Chat: wave 1's stranger rules (`chatPolicy("rated", …)`): guests and under-18s pick quick phrases, enforced by the
  server's chat function in rated rooms.
- Play again (`rematchFn`) is refused in a rated room; rematch goes through `ratedRematchFn`.

## 6. The result and W3a

`src/lib/rated/ratings.server.ts` is the only place W3b calls W3a:

```ts
interface RatingsBackend {
  /** The rating the match will move, and whether the player is still in placement; null: no rating (refused). */
  matchRating(userId: string, option: { format: RatedFormat; choice: RatedChoice }): Promise<{ rating: number; placement: boolean } | null>;
  /** Called once per match, with the server's own result. Must be idempotent on result.matchId (a retry after a failure). */
  recordRatedMatch(result: RatedMatchResult): Promise<void>;
  /** An unrated owner counts as this when choosing a recorded run (W3a's starting rating). */
  startingRating: number;
  /** Placement opponents: recorded runs whose owner rating is at most this (or unrated). */
  beginnerMax: number;
}
```

`RatedMatchResult`: `matchId`, `format`, `choice`, `gameMode`, `kind`, `rematchOf`, `finishedAt`, `players` (each
`userId`, `slot`, `ratingBefore`, `placement`, `scores` and `timesMs` per game, `gamesWon`, `total`), `games` (each
game's `type` and winner side), `winner` (`a`, `b` or `draw`; `a` is slot 1), and for a recorded match `recorded`
(`ownerId`, `key`, `source`, `fallback`, `scores`, `timesMs`, `ownerMoves: false`). A recorded owner's rating never
moves; the 4th-match rule against the same opponent is W3a's.

## 7. Recorded runs

Chosen by `chooseRecordedRun` (`recordedRefusal` says why a run is out):

1. Eligible: never the viewer's own, never the same owner as the viewer's last recorded opponent, from the last 14 days
   (`RECORDED_WINDOW_MS`), used fewer than 5 times today (`RECORDED_DAILY_USES`, UK day, claimed atomically by
   `rated_run_use`), exactly the format's game count, every game in the choice, every game on today's version
   (`gameVersionOf(puzzle)` equals `dealtSignature(type)`), and for a rated run the same format and choice.
2. The nearest-rated rated run within ±200 (`RECORDED_NEAR`).
3. Otherwise (no rated run near enough) the fallback: a real player's server-graded run from a room or the Daily in
   the last 14 days, on today's versions; its owner's rating never moves. Practice can't be a source yet (see the PR's
   question: practice plays don't store their deal).
4. Otherwise the nearest rated run however far; otherwise the searcher keeps searching.

The live player is dealt exactly the run's games and deals (the stored puzzles are copied into the match's room).

**Playback** (`recordedViewAt`): a game with a timeline plays back at its real pace (the last point at or before the
elapsed time); a game without one shows nothing until the game's end, when the stored score is the result. Never
invented progress. `finished` turns true at the run's real finish time. Timelines are made by `scoreTimeline` from the
server's own replay and kept only when they end on the stored score: the arcade games and the engine games (Tenfall,
Bonk, Pull!, Mixed Signals) have one; **every puzzle and Letterfall have none**.

## 8. Events

`queue_joined` (format, choice), `match_found` (kind, waited_s, format, choice), `rematch_requested`,
`rematch_accepted` (format), through `recordEvents` (`src/lib/data/events.server.ts`).
