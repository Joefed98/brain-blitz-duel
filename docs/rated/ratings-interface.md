# Ratings interface (wave 3, session W3a)

What W3b (matchmaking and the match engine), W3c (the screens) and W3d (4 and 8 players) build on. Kept current with
the code: the types are `src/lib/data/ratings.ts`, the server's functions `src/lib/rated/ratings.server.ts`, the pure
rules `src/lib/rated/`, the constants `src/lib/rated/glicko.config.ts`. How it works and why: `docs/rated/README.md`.

Every rating is the server's. The phone never sends a rating, a result or a change; it reads them through the four
server functions in `src/lib/rated/ratings.functions.ts`. Status: built and checked (`scripts/ratings-check.ts`).

## Server only: `finishRatedMatch(client, result)` / `recordRatedMatch(client, result)`

```ts
import { finishRatedMatch } from "@/lib/rated/rewards.server";
const outcome: RatedMatchOutcome = await finishRatedMatch(await adminDb(), result);
```

The match engine (W3b) calls **`finishRatedMatch`** once a rated match has finished, with the service-role client:
it is `recordRatedMatch` (`src/lib/rated/ratings.server.ts`: ratings, placement, tiers, history, events, Joules
amounts) followed by the competitive badges each live player's record now earns (each player's `badges`). The two
are split so the ratings engine itself reaches no economy module (a Legendary badge pays coins): code named as
matchmaking that imports `recordRatedMatch` stays clear of economy-neutral-check. Neither is a server function: no
`*.functions.ts` names them, and the database functions they call are executable by the service role only
(`ratings-check` proves both). An optional third argument, `nowMs`, is the server's time (checks only).

`result: RatedMatchResult`:

| Field | Meaning |
| --- | --- |
| `matchId` | uuid; **idempotent**: the same id again answers `status: "duplicate"` with the stored changes, moving nothing |
| `format` | `{ kind: "duel", bestOf: 3 \| 5 \| 7 }` or `{ kind: "placings", players: 4 \| 8 }` |
| `choice` | `"mixed"`, `"puzzles"` (All puzzles) or `"arcade"` (All arcade) |
| `players` | `{ playerId, side: "live" }` or `{ playerId, side: "recorded", run: { runId, ownerId, source } }`; `ownerId` must be `playerId`; `source` is `"rated" \| "room" \| "daily" \| "practice"` |
| `games` | in the order played: `{ type, pool, category, version: "classic", signature, scores: { [playerId]: number } }`; `pool` and `category` must be what the server works out from `type` (else `pool_mismatch`); every player has a score |
| `placings` | 4 and 8 players only: `{ [playerId]: place }`, 1 = first, level players share a place |
| `rematchOf` | optional: the match this one is a rematch of (Revenge) |
| `finishedAt` | optional ISO time; the server's now when left out (the UK day of the 4th-match rule is taken from it) |

What it does, in one transaction per match (retried on a concurrent change to any player's row):

1. **Comparisons.** A 1v1: each game is one result (higher score wins the game, level is a draw) against the
   opponent. 4 and 8 players: the final placings, a placing counting as a win against everyone below and a loss
   against everyone above; each game's weight is spread over the other players, so the whole match moves a rating
   about as much as one 1v1 (W3d's rule).
2. **Weights.** Each game weighs `GAME_WEIGHT` (½: a best-of-3 won 2–0 weighs one match) in its pool for All puzzles
   / All arcade, half that for Mixed; its category's rating moves at the full game weight.
3. **Who moves.** Live players fully. A recorded run's owner exactly half (`RECORDED_OWNER_FACTOR`), only when the
   run came from a rated game, and not past `RUN_USES_PER_DAY` (5) uses of that run in a UK day (W3b enforces the 5;
   every use is recorded here, in `rated_run_uses`, read back by `rated_state`'s `runs`). Room, Daily and Practice runs never move their owner. From the
   4th rated match between the same two live players in a UK day, the match plays but neither moves against the other
   (`frozen: "same_opponent_today"`).
4. **Glicko-2** per rating (`src/lib/rated/glicko2.ts`), with the match as the rating period, the RD floor schedule,
   idle time and the 100 floor (README).
5. **Placement, Joulz Rating, tier, history, events, Joules, badges** (below).

`RatedMatchOutcome`: `{ ok: true, status: "recorded" | "duplicate", matchId, players: RatedPlayerChange[] }`, or
`{ ok: false, reason, message }` with `reason` one of `bad_match`, `bad_format`, `bad_players`, `bad_games`,
`bad_placings`, `pool_mismatch`, `busy`, `error` (nothing stored).

`RatedPlayerChange`: `playerId`, `side`, `moved`, `frozen` (`same_opponent_today` | `recorded_unrated_source` |
`recorded_daily_limit` | null), `changes` (each rating moved: `key`, `before`, `after`, `delta`, `rdBefore`,
`rdAfter`), `joulz` (before / after, null in placement), `placement` (`played`, `of: 5`, `done`, `label`,
`justFinished`: show the reveal), `tier` (before / after `TierView`, null in placement), `result` (`win` / `loss` /
`draw`; first place is a win), `place` (4 and 8 players), `joules`, `badges` (competitive badges newly awarded).

## Read by the phone (server functions, `src/lib/rated/ratings.functions.ts`)

| Function | Answers |
| --- | --- |
| `getMyRatingsFn()` → `getMyRatings(client, userId)` | `PlayerRatings` for the signed-in device |
| `getRatingsForFn({ playerId })` → `getRatingsFor(client, playerId)` | another player's `PlayerRatings` (the same hiding) |
| `placementStatusFn()` → `placementStatus(client, userId)` | `PlacementStatus`: `{ played, of: 5, done, label }` ("Placement 1 of 5") |
| `getTierLadderFn()` → `getTierLadder(client)` | `TierLadderRung[]` with each tier's live share of rated players |

`PlayerRatings`: `placement`; `joulz`, `tier`, `pools`, `categories` are null while in placement (every rating hidden).
A pool or category is `{ status: "not_played" }` ("Not played yet", never counted against you) or
`{ status: "rated", rating, rd, matches, provisional }`.

## Pure (phone and server, `src/lib/rated/tiers.ts`)

- `tierFor(rating, standing?)` → `TierView`. `standing: TierStanding` = `{ capsActive, stormOk, top500Ok, rank, share }`
  from the standings job (`capsActive` once there are 1,000 rated players; `stormOk` / `top500Ok` in the share or
  within its 3-day grace); without it, or with the caps not active, the tier goes by rating alone. Labels: "Volt II", "Top 500 #37";
  `heldBack.label` "Storm-rated, top 4%"; `next` the next step up and the points to it.
- `TIER_DEFS` (the thresholds), `tierFromRating(rating)` (rating alone), `tierLadder(shares)`, `tierRank(tier)`.
- `src/lib/rated/match.ts`: `gamePool(type)`, `gameCategory(type)` (the server's pool and category for a game),
  `placementOf(played)`, `joulzRating(pools, recentGames)`.

## For D2 (Joules) and the weekly challenges

- `ratedMatchJoules(format, result)` (`src/lib/rated/joules.ts`): best of 3, 150 a win and 100 a loss; best of 5 or 7,
  and 4 or 8 players, 1.5 times that. Each live player's amount is stored on their row of the match
  (`rated_match_players.joules`) and in the outcome; D2's pass credits it under `ratedJoulesKey(matchId, playerId)`
  (`rated_match:<match>:<player>`), so it pays once. Recorded runs' owners earn none.
- `RATED_PLAY_FOR_EVERYONE` (`src/config/ratedConfig.ts`, false): the one switch W3b and the weekly challenges share;
  `ratedChallengesDrawable()` answers it, and R challenges are drawn only while it is on.

## Analytics (`src/lib/data/events.server.ts`)

`rated_match_finished` (one per live player; props `format`: bo3 / bo5 / bo7 / 4p / 8p, `choice`, `result`,
`opponent`: live / recorded), `placement_finished` (`tier`), `tier_changed` (`from`, `to`; after a match or from the
standings job).

## The standings job

`runStandingsAndBadges(client)` (`rewards.server.ts`; `runStandingsJob` in `ratings.server.ts` without the badges),
hourly at :23 UTC on a Cloudflare Cron Trigger (`src/lib/rated/tasks/standings.task.ts`, `vite.config.ts`
`RATED_TASKS`). Answers `{ ratedPlayers, capsActive, changed: [{ playerId, from, to }] }`.
