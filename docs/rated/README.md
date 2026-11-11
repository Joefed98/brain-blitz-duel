# Rated play: the ratings engine (wave 3, session W3a)

14 Nov 2026. The server decides every rating: Glicko-2 for Puzzles, Arcade and the 11 categories, the Joulz Rating,
placement, tiers and their caps, keyed on each game's dealt signature, with nothing trusted from the phone. The
contract W3b, W3c and W3d build on is **`docs/rated/ratings-interface.md`**. No gameplay, scoring, stamp or deal
changed: the engine reads finished matches' stored scores.

## Files

| Piece | File |
| --- | --- |
| Every constant, beside its target | `src/lib/rated/glicko.config.ts` |
| Glicko-2 (weighted results, the RD floor schedule, time away, the floor) | `src/lib/rated/glicko2.ts` |
| One match, worked out (pure): comparisons, weights, freezes, placement, Joulz Rating, tiers, badge facts | `src/lib/rated/match.ts` |
| Tiers, divisions, caps, the ladder | `src/lib/rated/tiers.ts` |
| Joules amounts and D2's key | `src/lib/rated/joules.ts` |
| The engine (record, read, standings job) | `src/lib/rated/ratings.server.ts` |
| Badges after a match or a tier rise (the match engine calls `finishRatedMatch`) | `src/lib/rated/rewards.server.ts` |
| The phone's reads | `src/lib/rated/ratings.functions.ts` |
| The Cron Trigger | `src/lib/rated/tasks/` and `vite.config.ts` (`RATED_TASKS`) |
| Types | `src/lib/data/ratings.ts`; database calls `src/lib/data/ratings.server.ts` |
| The switch shared with W3b and the weekly challenges | `src/config/ratedConfig.ts` (`RATED_PLAY_FOR_EVERYONE`, false) |
| Migrations | `20261114100000_ratings.sql`, `20261114100100_analytics_rated_events.sql`, `20261114100200_rated_badges_earnable.sql` |
| Check | `scripts/ratings-check.ts` (shard `e`, ~10 s, PostgreSQL) |

## Glicko-2 and its targets

One rating period per match (ratings update after every rated match, never batched). Each game is a result against
each opponent with a weight; the Glicko-2 sums are weighted (Glickman's partial-game form). Starting values to tune
with beta data; ratings-check proves every target on simulated players (one player against settled opponents, and a
seeded population of 240 with hidden skills playing 110 matches each).

"A match" in the targets is a 1v1 best of 3 in All puzzles or All arcade won or lost 2–0 against an equal opponent
(the launch format). A 2–1 moves about half that, Mixed half again.

| Constant | Value | Target | Measured (ratings-check) |
| --- | --- | --- | --- |
| `START_RATING`, `RATING_FLOOR` | 1,000, 100 | start 1,000, floor 100 | losing every match stops at 100 |
| `GLICKO_SCALE` | 400 / ln 10 | chess scale: 400 apart, the stronger wins about 10 in 11 | 0.909 |
| `START_RD`, `MAX_RD` | 350 | Glicko-2's standard | |
| `START_VOLATILITY`, `TAU` | 0.06, 0.5 | settled moves (σ sets the steady RD of about 60) | RD 61.6 after 80 matches |
| `GAME_WEIGHT` | ½ a game | a best of 3 won 2–0 weighs one match | |
| `MIXED_POOL_FACTOR` | ½ | Mixed moves Puzzles / Arcade at half weight | ×0.50 |
| `PLACEMENT_MATCHES`, `PLACEMENT_RD` | 5, RD floor 300 | placement matches move about 100–200 | 175, 148, 148, 148, 148 (population median 139) |
| `NEWISH_START_RD` → `NEWISH_END_RD` by `NEWISH_UNTIL` | 222 → 98 by the 30th match | a newish player's moves shrink gradually from about 100 to about 25 | 104 at the 6th, 82, 47, 25 at the 30th (population 100, 23) |
| `MIN_RD` | 45 | a safety floor | |
| (Glicko-2 alone after the 30th) | | a settled player moves about 8–15 a match | 10.7–13.3 (population median 9.2) |
| `IDLE_RD2_PER_DAY` | 66 points² a day | after about 3 months away a match moves about 25 | 25.8 |
| (Glicko-2's expectation) | | upsets move more | beating a player 400 above: 19.8; an equal: 10.7; 400 below: 2.1 |
| `RECORDED_OWNER_FACTOR` | ½ | a recorded run moves its owner at most half as much | exactly half (the move is scaled) |
| `RUN_USES_PER_DAY` | 5 | at most 5 uses of a run a day (W3b enforces; recorded here) | the 6th moves nothing |
| `SAME_OPPONENT_FREEZE_FROM` | 4 | from the 4th rated match against the same live opponent in a UK day, no move | |
| `PROVISIONAL_MATCHES` | 10 | a pool's provisional mark for its first few matches | |
| `JOULZ_WINDOW_DAYS` | 90 | the Joulz Rating's window | |

Two additions to Glicko-2, each for a target: **the RD floor schedule** (by the matches a rating has had: 300 through
placement, then falling evenly on a log scale to 98 by the 30th match, then only `MIN_RD`), because Glicko-2's own RD
shrinks too fast for "100–200 for each placement match"; and **time away** (φ² grows by `IDLE_RD2_PER_DAY` a day,
Glicko-1's c²), because Glicko-2's volatility alone doesn't reach "about 25 after 3 months".

## Pools, weights and who moves

- **Pools:** each game moves Puzzles or Arcade by its kind, and its category (the six puzzle categories, the five
  arcade groups, main category only), the server's own (`gamePool`, `gameCategory`); a game sent with another pool or
  category is refused. All puzzles / All arcade: full game weight in the pool. Mixed: half. Categories: the full game
  weight either way.
- **1v1:** each game a result (the higher stored score wins it, level is a draw). **4 and 8 players:** the final
  placings, each pair a win for the higher place; each game's weight spread over the other players, so the winner of
  4 moves about as much as one 1v1 win (W3d's rule).
- **Recorded runs:** the live player moves fully against one. The run's owner moves exactly half as much (the
  rating, RD and volatility each move half the way the full update would), only for a run from a rated game, and not
  past 5 uses of that run in a UK day (every use is in `rated_run_uses`). Room, Daily and Practice runs never move
  their owner. A run's owner plays no placement match and earns no Joules. Two recorded runs aren't compared.
- **The 4th-match rule:** live pairs only, counted per UK day (`rated_pair_days`, from the match's finish time, so
  British Summer Time is followed); from the 4th, the pair's results are dropped (the match plays, pays Joules and
  counts for the day, but moves nothing and counts for no placement, streak or badge).

## Placement, the Joulz Rating and tiers

- **Placement:** 5 rated matches that counted (any mix of puzzles and arcade). Until then every rating is hidden
  ("Placement 1 of 5"); the 5th's change has `placement.justFinished` (the reveal) and `placement_finished` is
  recorded. A pool never played shows "Not played yet" and never counts against you.
- **The Joulz Rating:** Puzzles and Arcade weighted by the share of the player's live rated games in each over the last
  90 days; equal weight with no recent play; a pool never played left out. Worked out after each match (stored) and by
  the standings job (the window moves with the days); the phone's reads work it out live.
- **Tiers:** from the Joulz Rating as shown (rounded), the master plan's thresholds (`TIER_DEFS`). The caps count only
  once there are 1,000 rated players (placed): Storm and above needs 1,900+ and the top 3%; Top 500 needs Lightning and a
  top-500 rank (numbered). A player outside the share is held back at Surge I ("Storm-rated, top 4%"). Dropping out of a
  capped share keeps the tier for 3 days (`storm_grace_until` / `top500_grace_until`, refreshed each run the player is
  in it). Before 1,000 rated players there is no Top 500.
- **Difficulty by tier** waits for wave 3.5: every rated game deals Classic (`version: "classic"`, the only one
  accepted).

## The standings job (a Cloudflare Cron Trigger)

Hourly at :23 UTC (`RATED_CRONS`, `vite.config.ts`'s `RATED_TASKS`, nitro's scheduled tasks as B2's push tasks are;
`nitroTasks` merges task sets, so B2's join with one line). `public.rated_recompute_standings`: every placed player's
Joulz Rating from their ratings and 90 days of games, ranks (level shown ratings share one), shares, the caps' grace;
then the server works out each affected player's tier and stores it (`rated_set_tiers`), records `tier_changed` and,
for a rise to Storm or above, checks the tier badges. Cloudflare's free plan allows 5 Cron Triggers a Worker; this is
one.

## Badges

Rated play's 13 badges are earnable (Joe's approval in the W3a brief; the counts move from 16 earnable and 38 waiting
to 29 and 25). The server's rated record (`rated_profiles`, through `public.rated_badge_facts`) feeds C2's rules
(`BadgeFacts.rated`); `finishRatedMatch` checks them after every match, the standings job after a tier rise, and C2's
sync on every tab page. Each is awarded once by `badge_award` (a Legendary's 250 coins once). Readings:

| Badge | From the rated record |
| --- | --- |
| First Win | a rated win (1v1, or first place of 4 or 8) |
| Placed | 5 placement matches |
| Hot Streak / Unstoppable | 5 / 10 rated wins in a row (a loss or draw breaks the run; frozen matches neither add nor break) |
| Comeback Kid | a best of 3 or 5 won after losing the first game |
| Clean Sweep | a best of 5 won without losing or drawing a game |
| Podium Regular | top 3 in 25 four- or eight-player matches |
| Giant Slayer | beat a player whose Joulz Rating was at least 300 above yours before the match (both placed) |
| Storm Chaser / Lightning Strikes | the tier shown reached Storm / Lightning (Top 500 counts as both) |
| Top 500 | shown as Top 500 at any point |
| Revenge | won a match sent as the rematch (`rematchOf`) of one lost to the same live player |
| Photo Finish | won a 1v1 whose deciding game was won by 1 point or less; or first alone in 4 or 8 by 1 point or less in total |

## Joules and the weekly challenges

D2 (the Season pass) has no code on main yet. Each live player's Joules for the match (`ratedMatchJoules`: 150 a win
and 100 a loss for a best of 3, 1.5 times that for a best of 5 or 7 and for 4 or 8 players) is in the outcome and
stored on `rated_match_players.joules`; D2's pass credits it under `ratedJoulesKey(matchId, playerId)`, once.
`ratedChallengesDrawable()` (the switch `RATED_PLAY_FOR_EVERYONE`, shared with W3b) is what the weekly draw reads for
challenges marked R: none before it is on.

## Who can write

Nobody through the API: anon and authenticated have no right on any rated table or function; the service role reads
the tables and writes only through `rated_apply_match` (one transaction a match, optimistic versions on every row it
changes, retried on a concurrent change, idempotent on the match id), `rated_set_tiers` and
`rated_recompute_standings`. The phone reads through `ratings.functions.ts`. A removed user's rows go with their auth
user (ON DELETE CASCADE).

## Events

`rated_match_finished` (`format`, `choice`, `result`, `opponent`: live / recorded), `placement_finished` (`tier`),
`tier_changed` (`from`, `to`), through `src/lib/data/events.server.ts`.
