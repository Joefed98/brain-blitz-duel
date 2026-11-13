# Matchmaking interface (wave 3, W3b)

The contract between W3b (matchmaking, rated matches, recorded runs) and the sessions that use it: **W3c** (the
rated screens: Play card, choosing, searching, VS, the 1v1 game frame, the match result) and **W3d** (4 and 8
players). W3a's side is `docs/rated/ratings-interface.md` (merged into W3b's branch on 11 Nov 2026); section 6 says how
W3b calls it.

Status: **kept current on the W3b PR.** Last change: 11 Nov 2026.

## 1. Where things live

| File | What |
|---|---|
| `src/config/matchmakingConfig.ts` | W3b's switches: formats and choices (section 2). |
| `src/config/ratedConfig.ts` | `RATED_PLAY_FOR_EVERYONE`, the one switch W3b and W3a's R challenges share (W3a's file; W3b ships the same one line until W3a's lands). |
| `src/lib/rated/matchmaking.ts` | Pure rules, phone-safe: formats, choices, the queue's bands, pairing, recorded-run choice, playback, the hidden finish, the match outcome, rematch timing, the age label. |
| `src/lib/rated/timeline.server.ts` | A recorded game's score over time, from the server's own replay. |
| `src/lib/rated/ratingsAdapter.server.ts` | The W3a adapter: the queue's rating from `getMyRatings`, W3a's `RatedMatchResult` from W3b's settlement. |
| `src/lib/rated/rated.server.ts` | The flow: queue, match making, recorded runs, settling, rematch, live progress. |
| `src/lib/rated/rated.functions.ts` | The server functions the phone calls (section 3). |
| `src/lib/rated/ratedChat.server.ts` | Wave 1's stranger chat rules in rated rooms. |
| `src/lib/rated/practiceDeals.server.ts` | Stores each counted Practice play's deal (Practice as a recorded-run source). |
| `src/lib/data/rated.server.ts` | Every matchmaking table read and write (typed, no `any`). |
| `supabase/migrations/20261114200000_matchmaking.sql` | The `mm_*` tables and functions. |
| `supabase/migrations/20261114200100_analytics_rated_events.sql` | The four events. |
| `supabase/migrations/20261114200200_matchmaking_practice_and_forget.sql` | `mm_practice_deals` (kept 15 days), and `forget_user`'s removal of a deleted account's runs. |

Tables (server only; no phone reads or writes any): `mm_queue` (one row per searcher), `mm_matches` (each match, its
room, kind, the recorded run it plays against, rematch, result), `mm_match_players`, `mm_runs` (each player's run from
a settled rated match, the first recorded-run pool), `mm_run_uses` (the 5-a-day cap), `mm_progress` (the live score a
phone reports during a game, display only), `mm_practice_deals` (each counted Practice play's deal). The `mm_` prefix
keeps them apart from W3a's ratings tables. When `accounts.forget_user` removes a user, the trigger
`mm_forget_removed_user` deletes their runs, practice deals, search and progress, and re-keys their seats in other
players' matches (and the run keys and uses that name them) to one fresh id, the owner shown as "Deleted player".

## 2. Switches

Joe edits the file and merges to `main` (the deploy carries it). The server reads them on every queue join
(`ratedOptionRefusal`), so an option that is off can't be queued for whatever a phone sends.

| Switch | File | Launch | Meaning |
|---|---|---|---|
| `RATED_PLAY_FOR_EVERYONE` | `ratedConfig.ts` | `false` | false: only accounts on `shop.testers` (D1's list; Joe adds with `shop.add_tester`) can queue; true: everyone, guests included (a new player taps Play and plays with no sign-up, placement first). W3a's R challenges read the same switch. |
| `RATED_FORMATS_ON.bo3` | `matchmakingConfig.ts` | `true` | 1v1 best of 3. |
| `RATED_FORMATS_ON.bo5`, `.bo7` | `matchmakingConfig.ts` | `false` | 1v1 best of 5 and 7. |
| `RATED_FORMATS_ON.ffa4`, `.ffa8` | `matchmakingConfig.ts` | `false` | 4 and 8 players (W3d). |
| `RATED_CHOICES_ON.mixed`, `.puzzles`, `.arcade` | `matchmakingConfig.ts` | `true` | Mixed (the default), All puzzles, All arcade. |
| `RATED_CHOICES_ON.<pick>` | `matchmakingConfig.ts` | `false` | Each single category: the six puzzle categories and the five arcade groups. W3a takes only the three above today, so a single category also needs W3a's support before it is switched on. |

The phone offers only `openOptions()`. The tester list is read through `public.mm_is_tester` (false for everyone
before D1's migration).

## 3. Server functions (`src/lib/rated/rated.functions.ts`)

Every one takes the caller (`requireSupabaseAuth`: an account or a guest's anonymous user). While rated play is
testers-only a guest gets `{ ok: false, reason: "account" }`; once it is for everyone a guest plays with no sign-up
and **never types a name**: rated play is where strangers meet (wave 1's decision), so a guest is seated under a
generated energy name such as "Swift Volt 48" (`guestEnergyName`, `src/lib/rated/guestName.server.ts`: the same name
every match, from their player id) and the views tag them Guest (`guest: true`). Typed guest names stay for rooms only. A guest's matches, and W3a's ratings and placement, key on the same player id, which wave 1's linking keeps
when they sign up, so everything carries to the account. The save-your-progress prompt after the first finished match
is the phone's (W3c: `FinishedGameCounter` / `takePendingPrompt`, as rooms and the Daily do).

| Function | Input | Answer |
|---|---|---|
| `ratedStatusFn` | — | `RatedStatus`: `account`, `open` (testers / everyone), `options` (what is on, empty when closed), `searching` (the caller's queue entry), `activeMatchId`. |
| `ratedQueueJoinFn` | `{ format, choice }` | `{ ok: true, joinedAtMs }` or `{ ok: false, reason, message }`, `reason` one of `account`, `closed`, `option`, `banned`, `rate_limit` (`RATED_QUEUE_LIMIT`, 30 in 10 min), `no_rating` (W3a not bound), `in_match`. Settles the caller's finished matches first. Records `queue_joined`. |
| `ratedQueuePollFn` | — | `QueuePoll`: `{ state: "idle" }`, `{ state: "searching", waitedMs, band }` or `{ state: "found", match }` (or `{ busy: true }` past `RATED_POLL_LIMIT`). Call about once a second while searching. Each poll tries to pair the caller (section 4) and, from 8 s, makes a recorded match (a beginner's run for a placement player). Records `match_found`. |
| `ratedQueueLeaveFn` | — | `{ ok: true }` (a searcher already claimed by a match stays in it; the next poll finds it). |
| `ratedMatchFn` | `{ matchId }` | `RatedMatchView` (section 5), for the match's players only (null otherwise). |
| `ratedOpponentScoreFn` | `{ matchId }` | `OpponentScore` for the room's current game: `{ round, score, finished, hidden }`. `score` is null before the game starts, while hidden (the final 20 %), and for a recorded game without a timeline until the game's result; from the reveal on it is the stored score. Poll about once a second during a game. |
| `ratedProgressFn` | `{ matchId, round, score }` | Display only: the caller's live score this game (the phone's own running score), shown to a live opponent. Accepted only during that game's puzzle phase. Never read to grade, rank or rate. |
| `ratedSettleFn` | `{ matchId }` | `SettleOutcome`: `{ state: "playing" }` until the room is finished, then `{ state: "settled", result: RatedSettlement }` (a forfeit's `result.ending` says so), or `{ state: "aborted", leavers }` for an abort (section 6b). Idempotent; W3a's `recordRatedMatch` is called exactly once per match whoever calls this. Also run by the player's next queue join. |
| `ratedRematchFn` | `{ matchId }` | `{ state: "waiting" }`, `{ state: "agreed", match }` or `{ state: "closed" }`. Live matches only; both players within 8 s of the match's end (`REMATCH_WINDOW_MS`, from the room's finish). The rematch is a new rated match with `rematchOf`, counted by W3a like any other (its 4th-match rule). Records `rematch_requested` per player, `rematch_accepted` once. |
| `ratedHeadToHeadFn` | `{ opponentId }` | `HeadToHead`: `{ wins, losses, draws, played }`, the caller's rated record against that player, for W3c's VS screen ("your record against each other"). Counts settled **live** rated matches between the two only, by the stored winner from the caller's side; recorded runs are left out (the run's owner never played the caller), and so is any match with a flagged run (it moved nobody's rating). A match still playing doesn't count yet. Against yourself, or a malformed id: all zero. |
| `ratedRoomFn` | `{ roomId }` | `RatedRoomInfo \| null`: from a room id, the rated match it is: `{ matchId, format, choice, kind, totalGames, status }` (`totalGames` the dealt N; a best of N may stop sooner once decided). So a rated room opened in another tab, on another device or after a reload still draws the rated header and polls `ratedOpponentScoreFn` with `matchId` for the hidden finish. null for an ordinary room, a malformed id, or a caller who isn't one of the match's players (nothing about another player's match is given away). |

## 4. The queue

- Entries are matched only with the same `format` and the same `choice`.
- The band: ±50 (`BAND_START`), +50 (`BAND_STEP`) every 2 s (`BAND_STEP_MS`), so ±200 (`BAND_MAX`) from 6 s; at 8 s
  (`RECORDED_AFTER_MS`) the searcher gets a recorded run. Two searchers pair when their ratings are within the wider
  of their two bands (`canPair`); the nearest rating wins, then the longest wait (`bestPartner`). After 8 s with no run
  to play against, the search carries on at ±200.
- The rating is the one the match will move (`matchRatingFrom` on W3a's `getMyRatings`): All puzzles the puzzles pool,
  All arcade the arcade pool, Mixed the Joulz Rating (else the two pools' mean), a single category half its own rating
  and half its pool's; an unrated pool counts as W3a's starting rating.
- Placement players (`placement.done` false; Joe, 11 Nov 2026): two placement players searching at the same time are
  matched live with each other, within the same widening; a placed player is never matched live with a placement player
  (`canPair`: both placement or both placed). A placement player with no placement partner by 8 s gets a recorded run
  from a beginner (owner rating at most `beginnerMax`, or unrated).
- Pairing is atomic: `public.mm_queue_claim(users, match, format, choice)` puts every listed searcher in one match or
  none. W3d passes 4 or 8 users (the 1v1 poll pairs only when `FORMAT_PLAYERS[format]` is 2).

## 5. Rated matches

- A match is an ordinary room (`public.duels`), made by the server already started (phase `starting`), with the room's
  own phases, grading and results: the same deals for every player, Classic (`RATED_GAME_MODE`, today's live deal),
  dealt by `dealRoomRounds(matchSettings(format, choice))` and `buildRoomPuzzles` on a new room seed. Best of N deals
  N games and **stops as soon as it is decided** (`matchClinched`: one side has won a majority, 2 of 3, 3 of 5, 4 of 7;
  a drawn game counts for nobody, so a best of 5 at 2–0 with two drawn games plays game 5; W3a's own `checkMatch`
  rule, and rated-matchmaking-check proves the two agree on every win / draw / loss sequence): that game's result screen leads straight to the winner
  reveal (`ratedMatchClinched`, called from `advancePhaseFn` as a rated room leaves a result; ordinary rooms answer
  false). The match is the games won (`matchOutcome`: a level game score is a drawn game, as in W3a; level on games,
  the higher total, then less time used). A stopped match is settled on the games played. Nobody else can join it (it is already started), and
  Play again (`rematchFn`) is refused in it.
- The phone opens the room with the existing room route (`/duel/<roomCode>`).
- `RatedMatchView`: `matchId`, `format`, `choice`, `gameMode`, `kind` (`live` / `recorded`), `roomId`, `roomCode`,
  `status`, `players` (`userId`, `slot`, `displayName`, `guest`, `ratingBefore`, `placement`), `rematchOf`, and for a recorded
  match `recorded`: `label` ("Recorded run · 2 h ago", `recordedAgeLabel`), `recordedAtMs`, `ownerId` (for the
  player card, A2's `getPublicCard`), `ownerName` (the username, or a guest's energy name, never a typed name),
  `ownerGuest` (show the Guest tag), `look` (the owner's stored look per game, E1's `look` on the
  source results; null before E1's migration or for none; the scenery stays the viewer's world theme), `fallback`.
- The game header shows both scores; `ratedOpponentScoreFn` gives the opponent's. Hidden for the final 20 % of each
  game's own time (`opponentScoreHidden`, `HIDDEN_FINISH_SHARE`), on the server, and revealed with the game's result.
- Chat: wave 1's stranger rules (`chatPolicy("rated", …)`), enforced in `sendRoomMessageFn`: guests and under-18s send
  quick phrases only (by id or exact text; anything else is refused with `QUICK_PHRASES_ONLY_MESSAGE`); adults with an
  account type through the room's filter. Ordinary rooms are unchanged.

## 6. Settling and W3a

`ratedSettleFn` / `settleMatch` builds W3b's `RatedSettlement` from what is stored (the room's results for the live
players, the run's stored scores for a recorded one; time used by `roundTimeUsedMs`), turns it into W3a's
`RatedMatchResult` (`toRatingsResult`: `format` `{ kind: "duel", bestOf }`, `choice`, players `live` or `recorded`
with `run: { runId: <run key>, ownerId, source }`, each game's `type`, `pool`, `category`, `version: "classic"`,
`signature`, both scores and **`gradeExtras`: each player's stored server grade `extra` for that game, exactly as
stored** (a live player's `round_results.extra`; a recorded owner's from the run's source: the rated room's, room's
or Daily's result row, or the Practice grade kept in `mm_practice_deals.extra`), `rematchOf`, `finishedAt`) and calls
W3a's `finishRatedMatch` once (W3a's `recordRatedMatch`, then the Joules through D2's hook and C2's badges; claimed
`playing → settling` with a guarded update; a `busy` / `error` answer puts it back to `playing` for a retry; W3a is
idempotent on the match id). W3a's answer is kept on the settlement (`ratings`); the phone's `ratedSettleFn` answer
leaves every stored grade out (`publicSettleOutcome`). Who moves, and by how much, is W3a's: a recorded rated run's
owner at most half; room, Daily and Practice runs never; the 4th match between the same two players in a UK day frozen;
**a flagged grade in any game (the server's own `extra.flagged`) moves nobody, is logged in `moderation.rated_flags`
and earns the flagged player no Joules** (Joe's rule; rated-server-check plays it end to end on W3a's real engine).

**Binding.** `ratingsReady()` binds W3a's `getMyRatings` (`src/lib/rated/ratings.server.ts`) and `finishRatedMatch`
(`src/lib/rated/rewards.server.ts`) on the service-role client the first time rated play needs it, with W3a's `START_RATING` as the starting rating and the
beginners' bound; a check's stand-in (`setRatingsBackend`) wins. Flagged runs never reach W3a: the flag comes only from
the server's grading, and a flagged run is never stored or chosen as a recorded run (so W3a's `run.flagged` backstop
is never needed); a flag in a live player's game reaches W3a through `gradeExtras`.

## 6b. Leaving a match (Joe, 12 Nov 2026)

Live matches only (recorded-run matches are unaffected). Rules `departureVerdict` / `placeWithLeavers` in
`src/lib/rated/matchmaking.ts` (`DEPARTURE_GRACE_MS` 20 s); acted on once by `reviewDepartures` (rated.server.ts) on
every heartbeat, phase move (`advancePhaseFn`), Leave (`leaveRoomFn` → `leaveRatedRoom`, which never disbands a rated
room) and rated poll (`ratedMatchFn`, `ratedOpponentScoreFn`, `ratedSettleFn`). A player's time away runs from their own
Leave, else their last heartbeat.

- **Set-up** is everything before the first game's intro appears (`mm_matches.intro_at`, the room's fixed first deadline:
  Prepare to Duel / VS, then the title). A Leave in it, or an absence that began in it and lasts past 20 s (never
  connected counts), **aborts**: the match is `abandoned` with `ended = 'abort'`, the room closed, and the players who
  stayed go straight back to searching (same format and choice). No rating change, no Joules, not a placement match:
  `finishRatedMatch` is never called. Analytics `rated_match_aborted` (one per leaver, props.step `starting` or
  `round_title`, props.format).
- **After the intro** a dropped player has 20 s: back within it (a heartbeat), play carries on.
- **Away for more than 20 s before the match is decided** is a **forfeit**: `ended = 'forfeit'`, the room ends now, and
  the settle is a loss for each leaver and a win for every player who stayed, whatever the score (W3a's `forfeit` field,
  `docs/rated/ratings-interface.md`). The games fully played count (at least the first). It counts as a placement match;
  the leaver earns no Joules, the stayer the normal win Joules. A match already decided (a best of N's majority) ends on
  its result instead. Analytics `rated_match_forfeited` (props.format, props.games_played).
- **A flagged run still comes first**: nobody's rating moves (W3a's rule).
- **4 and 8 players**: a leaver is marked gone (`mm_match_players.gone_at`, their departure time) and the rest play on;
  with fewer than two players left it ends as a forfeit. Leavers place below everyone who stayed, the latest leaver
  highest, and earn no Joules; the rest place on total score over the games played (`matchPlacings`).
- **What the screens get**: `RatedMatchView.ending` (`{ kind: "abort" | "forfeit", leavers: [{ userId, at, step }] }` or
  null), `RatedRoomInfo.ended`, `ratedSettleFn`'s `{ state: "aborted", leavers }` for an abort, and on a settled forfeit
  `result.ending` (`{ kind: "forfeit", leavers }`) and, for 4 and 8 players, `result.placings`. A forfeit or abort leaves
  no recorded run and no rematch.

Migration `20261114200300_rated_departures.sql` (additive: the columns above, `mm_match_players.left_at`, and the two
event names). Checks: rated-matchmaking-check (the rules), rated-server-check "leaving a match" and "a flagged run plus a
leaver" (W3a's real engine), ratings-check "a forfeit".

## 7. Recorded runs

Chosen by `chooseRecordedRun` (`recordedRefusal` says why a run is out):

1. Eligible: never a run with a game the server's replay flagged (`extra.flagged` on the stored result or practice
   grade: `recordedRefusal` "flagged"; a flagged rated run is never stored and a flagged practice deal never read);
   never the viewer's own; never the same owner as the viewer's last recorded opponent; from the last 14
   days (`RECORDED_WINDOW_MS`); used fewer than 5 times today (`RECORDED_DAILY_USES`, UK day, claimed atomically by
   `public.mm_run_use`); exactly the format's game count; every game in the choice; every game on today's version
   (`gameVersionOf(puzzle)` equals `dealtSignature(type)`); for a rated run the same format and choice; never a run whose
   owner has asked to delete their account (removed outright once `forget_user` runs). A rated run is stored only when
   every dealt game was played, so **a match that ends early (2–0, 3–0, 3–1) leaves no recorded run** (Joe accepted
   this on 11 Nov 2026: the Practice, rooms and Daily fallback covers it).
2. The nearest-rated rated run within ±200 (`RECORDED_NEAR`).
3. Otherwise (no rated run near enough) the fallback: a real player's server-graded run from a room, the Daily or
   Practice in the last 14 days, on today's versions. Rooms and the Daily: the newest 40 finished of each, the first N
   rounds of the run that fit the choice. Practice: each play C1a counts (graded, not the intro example, not flagged,
   after the fresh start) has its deal stored in `mm_practice_deals`; an owner's newest plays of N different games
   that fit the choice make one run (key `practice:<owner>:<play ids>`), aged by its **oldest** game (the label and
   the 14-day window), never the newest. The owner's rating never moves. The deals are kept 15 days: the Worker's Cron
   Trigger `rated:practice-deals-purge` (daily 04:37 UTC, `vite.config.ts` MATCHMAKING_TASKS,
   `src/lib/rated/tasks/`) runs `public.mm_purge_practice_deals`, so the purge happens whether or not the database has
   pg_cron (where it has, pg_cron runs it too; the purge is idempotent).
4. Otherwise the nearest rated run however far; otherwise the searcher keeps searching.

The live player is dealt exactly the run's games and deals: the stored puzzles (public and private halves) are copied
into the match's room.

**Playback** (`recordedViewAt`): a game with a timeline plays back at its real pace (the last point at or before the
elapsed time); a game without one shows nothing until the game's end, when the stored score is the result. Never
invented progress. `finished` turns true at the run's real finish time. Timelines are made by `scoreTimeline` from the
server's own replay (src/lib/replay/steppers.ts) and kept only when they end on the stored score: the arcade games
and the engine games on the arcade stage (Tenfall, Bonk, Pull!, Mixed Signals) have one; **every puzzle and
Letterfall have none** (puzzles store no timeline; Letterfall's replay needs the dictionary).

## 8. Events

Through `recordEvents` (`src/lib/data/events.server.ts`): `queue_joined` (`format`, `choice`), `match_found` (`kind`
live / recorded, `waited_s`, `format`, `choice`), `rematch_requested` (`format`), `rematch_accepted` (`format`).

## 9. Checks

- `rated-matchmaking-check` (~1 s, shard `e`): the pure rules (switches, deal, bands, pairing, recorded-run choice,
  playback, hidden finish, result, rematch, rated chat, W3a's shapes).
- `rated-server-check` (~5 s, shard `e`, PostgreSQL): the whole flow through the real server functions and code on a
  local database with every migration, W3a stood in. Its "head to head and a room's match (W3c)" section proves the
  record from both sides (wins as slot 1 and slot 2, a loss, a draw), that recorded, unfinished, flagged and
  other-opponent matches are left out (the flagged one also through the real queue's settled match), and that
  `ratedRoomFn` answers a live and a recorded match's room for its players and null for anyone else or an ordinary room.
