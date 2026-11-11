# Tournaments interface (wave 4, session W4b)

The contract between W4b (the Tournaments hub, the Arena, the daily Score Attack) and **W4c** (the Category Cup,
Swiss, and the Joulz Championship, Knockout, both behind switches), and any later session that reads tournament
results (D2's weekly tournament challenges, leaderboards, the trophy cabinet).

Status: **kept current on the W4b PR.** Last change: 11 Nov 2026 (W3b's renames: `ratingsAdapter.server.ts`, `mm_` tables; flagged runs). W4b merges second in the wave 4 train.

Tournaments never change ratings: nothing under `src/lib/tournaments/` imports `recordRatedMatch` or writes a rated
table (tournaments-check proves it), and the economy-neutral rule holds (nothing here is read by grading, scoring,
replay, timing or the deal).

## 1. Where things live

| File | What |
| --- | --- |
| `src/config/tournamentConfig.ts` | The switches, the schedule, entry prices, prizes, the Arena's window (section 2). Joe edits it and merges to `main`. |
| `src/lib/tournaments/rules.ts` | Pure, phone-safe: the schedule (UK times), event ids, the Arena's points and streak, standings order, the prize table and the small-field safeguard, trophies, the featured category's rotation. |
| `src/lib/tournaments/types.ts` | The shapes the phone gets (section 4). |
| `src/lib/tournaments/tournaments.server.ts` | The flow: events, entry, refunds, the Arena (queue, pairing, duels, settling), Score Attack (its async room), finishing, payouts, trophies, badges, Joules, reminders. |
| `src/lib/tournaments/tournaments.functions.ts` | The server functions the phone calls (section 3). |
| `src/lib/tournaments/tournamentsApi.ts` | The phone's store (backend stand-in for checks: `setTournamentsBackend`). |
| `src/lib/data/tournaments.server.ts` | Every tournament table read and write (typed, no `any`). |
| `src/lib/tournaments/tasks/` | The Cron Trigger task: `tournaments:tick` every 5 minutes (on B2's `*/5 * * * *` trigger): starts, cancels, finishes and pays events, sends reminders. Every read of an event also advances it, so the cron is a safety net. |
| `supabase/migrations/20261115200000_tournaments.sql` | The tables and functions. |
| `supabase/migrations/20261115200100_tournament_badges.sql` | The seven tournament badges move from waiting to earnable. |
| `supabase/migrations/20261115200200_analytics_tournament_events.sql` | The three events and the `tournament` mode. |

## 2. Kinds, switches and the schedule

`TournamentKind` = `"arena" | "score_attack" | "category_cup" | "championship"`. Each kind has a switch in
`TOURNAMENT_KINDS_ON` (launch: `arena` and `score_attack` on; `category_cup` and `championship` off, W4c's). An event
of a kind that is off is never made, shown or entered.

`TOURNAMENTS_FOR_EVERYONE` (launch `false`): false, only accounts on D1's tester list (`shop.testers`) see and enter
tournaments; true, every account. The same answer as rated play's (`ratedPlayOpenFor`).

Schedule (`TOURNAMENT_SCHEDULE`, UK times, summer time included):

- **Arena**: every day at 13:00 and 20:00 UK (`ARENA_TIMES_UK`), free. The window to start duels is
  `ARENA_WINDOW_MIN` (45) minutes; a duel started in the window plays to its end. Starts only with
  `ARENA_MIN_ENTRANTS` (4) entrants; otherwise the event is cancelled and its entrants are told when the next one is.
- **Score Attack**: one a UK day, 00:00 to 24:00 (24 hours), 50 coins (`SCORE_ATTACK_COINS`) or a Score Attack
  ticket; while `category_cup` is off, a Category Cup ticket enters too. Featured pick (`featuredPick(day)`) rotates
  through the room picks; `SCORE_ATTACK_ROUNDS` (5) games from it, the same for everyone.

Event ids are fixed by the schedule: `arena:<YYYY-MM-DD>:<HHMM>` and `score_attack:<YYYY-MM-DD>` (W4c:
`category_cup:<YYYY-MM-DD>:<HHMM>`, `championship:<YYYY-MM>`). `eventIdFor(kind, startMs)` / `parseEventId(id)`.

## 3. Server functions (`src/lib/tournaments/tournaments.functions.ts`)

Every one takes the signed-in caller (`requireSupabaseAuth`); a guest (no profile) gets `{ ok: false, reason:
"account" }` for anything that changes something, and a hub with `account: false`.

| Function | Input | Answer |
| --- | --- | --- |
| `tournamentHubFn` | — | `TournamentHub`: `open`, `account`, `now` (server ms), `live` (events in progress), `next` (the next event), `week` (the next 7 UK days' events), `entries` (the caller's entries, newest first), `trophies`. |
| `tournamentEventFn` | `{ eventId }` | `TournamentEventView` (section 4) or null. |
| `tournamentEnterFn` | `{ eventId, entry }` | `EnterOutcome`: `{ ok: true, entry }` or `{ ok: false, reason, message }`; `entry` is `free`, `coins`, `ticket_score_attack` or `ticket_category_cup`. Refused: `account`, `closed`, `kind_off`, `bad_entry`, `insufficient`, `no_ticket`, `banned`, `rate_limit`, `not_open` (not a tester while the switch is off). Records `tournament_entered`. |
| `tournamentRemindFn` | `{ eventId, on }` | `{ ok: true, reminded }`. An entry is always reminded. |
| `arenaReadyFn` | `{ eventId }` | Joins the Arena's queue for the next duel: `ArenaPoll`. |
| `arenaPollFn` | `{ eventId }` | `ArenaPoll`: `{ state: "idle" }`, `{ state: "searching", waitedMs }`, `{ state: "duel", duel }` (open the room `/duel/<code>`), `{ state: "closed" }`. Call about once a second while searching. Settles the caller's finished duel first. |
| `arenaLeaveFn` | `{ eventId }` | Leaves the queue. |
| `arenaBoardFn` | `{ eventId }` | `ArenaBoard`: the live leaderboard (every entrant who has played, with `points`, `wins`, `streak`, `played`), `me`, `endsAt`. |
| `scoreAttackStartFn` | `{ eventId }` | `{ ok: true, roomId }` for the caller's one attempt (entrants only); the rounds then go through the Daily's async-room calls (`asyncRoundStartFn`, `asyncSubmitFn`, `asyncRevealFn`) as the Daily does. |
| `scoreAttackBoardFn` | `{ eventId }` | The board (the Daily's rules: open once your attempt has finished or the day has closed). |
| `myTrophiesFn` | — | `TrophyView[]`: the caller's trophies (Profile's cabinet). |

## 4. Shapes (`src/lib/tournaments/types.ts`)

- `TournamentEventView`: `id`, `kind`, `title`, `pick` (the featured pick or `mixed`), `startsAt`, `endsAt`,
  `status` (`scheduled`, `live`, `finished`, `cancelled`), `entrants`, `entryOptions` (each `{ entry, coins }` the
  caller may use now, with `affordable`), `prizes` (`PrizeLine[]`: place label, coins, trophy, the entrants needed),
  `mine` (the caller's `EntryView` or null), `reminded`, `rulesDraft: true`, `cancelledNext` (a cancelled Arena: the
  next one's start), `underReview` (the caller has a run the server flagged in this event).
- `EntryView`: `eventId`, `entry`, `coins`, `enteredAt`, `refunded`, `place` (when finished), `prizeCoins`, `underReview`.
- `ArenaBoard` and `ScoreAttackBoard` carry `underReview` for the caller (a flagged player is off the board).
- `ArenaDuelView`: `duelId`, `roomCode`, `opponent` (`userId`, `name`, `plate`), `status`.
- Every board row (`ArenaBoardRow`, `ScoreAttackBoardRow`) carries `plate` (section 10) and `name` is the plate's name.
- `PrizeLine`: `{ from, to, coins, trophy: "gold" | "silver" | "bronze" | null, minEntrants }`.
- `TrophyView`: `eventId`, `kind`, `medal`, `title`, `place`, `awardedAt`.

## 5. The database (all writes through service-role functions)

Nobody writes through the API: anon and authenticated have no INSERT, UPDATE or DELETE on any table below, and the
service role writes only through the functions listed (tournaments-check proves both). A signed-in player reads
their own entries, reminders, prizes and trophies (RLS); events are readable by any signed-in device; the Arena
board is read through the server.

| Table | Rows |
| --- | --- |
| `tournament_events` | One per event: `id` (section 2), `kind`, `title`, `pick`, `starts_at`, `ends_at`, `status`, `async_room_id` (Score Attack), `entrants`, `finished_at`, `cancelled_at`, `cancel_reason`. |
| `tournament_entries` | One per account and event: `entry`, `coins`, `ledger_id` (coins) or `consumable_line` (ticket), `entered_at`, `refunded_at`. |
| `tournament_reminders` | `event_id`, `user_id`, `asked_at`, `notified_at`. |
| `tournament_arena_queue` | The Arena's searchers: `event_id`, `user_id`, `rating`, `joined_at`, `last_opponent`. |
| `tournament_arena_duels` | Each duel: `id`, `event_id`, `a_user`, `b_user`, `duel_id` (the room), `status` (`playing`, `settled`, `void`), `winner` (`a`, `b`, `draw`), points each side earned, `games` (each game's scores and winner), `created_at`, `settled_at`. |
| `tournament_arena_players` | The live standings: `points`, `wins`, `losses`, `draws`, `streak`, `best_streak`, `game_streak`, `best_game_streak` (games won in a row, across duels), `played`, `score_total`, `last_win_at`. |
| `tournament_results` | Final places when an event finishes: `place`, `points` (Arena) or `total` / `tie_ms` (Score Attack). |
| `tournament_prizes` | One per prize paid: `place`, `coins`, `ledger_id`, `paid_at`. |
| `tournament_trophies` | One per account and event: `kind`, `medal`, `place`, `title`, `awarded_at`. |

Functions (service role only): `tournament_ensure_event`, `tournament_enter`, `tournament_cancel`,
`tournament_set_status`, `tournament_remind`, `tournament_arena_join`, `tournament_arena_leave`,
`tournament_arena_pair`, `tournament_arena_set_room`, `tournament_arena_settle`, `tournament_finish`,
`tournament_pay_prize`, `tournament_arena_void`, `tournament_mark_reminded`, `tournament_flag`,
`tournament_flagged_players`. Flags for Joe's review: `moderation.tournament_flags` (beside W3a's `rated_flags`),
`moderation.tournament_flag_queue()`, `moderation.tournament_flag_resolve(id, note)`. Joe's tools in the `tournaments`
schema (unreachable from the API): `tournaments.cancel_event(id, note)` (refunds every entry), `tournaments.summary(id)`.

**For W4c**: a Swiss or Knockout event is a row of its own kind in `tournament_events`; entry, refunds, reminders,
results, prizes and trophies are kind-agnostic (`tournament_enter`, `tournament_finish`, `tournament_pay_prize`,
`tournament_pay_prize`, which pays the trophy too). Add your own pairing tables beside the Arena's; reuse `arenaDuelRoom` (a best-of-3 room
on W3b's engine that never touches ratings) for each Swiss round or Knockout tie.

## 6. Entry

- `free`: Arena (and any kind priced 0).
- `coins`: `economy_spend` (reason `tournament_entry`, key `tournament_entry:<event>`); refunded in full with
  `economy_refund` if the event doesn't run (key `refund:<line id>`).
- `ticket_score_attack` / `ticket_category_cup`: `economy_use_consumable` (reason `tournament_entry`, key
  `tournament_entry:<event>`); a cancelled event gives the ticket back (`economy_grant_consumable`, reason `refund`,
  key `refund:consumable:<line id>`). A Category Cup ticket enters a Score Attack only while `category_cup` is off.
- Accounts only, one entry per account and event. Banned players can't enter (wave 1's ban). Under-18s can enter;
  tournament rooms use the stranger chat rules (`chatPolicy("tournament", …)`).

## 7. Prizes, trophies, badges, Joules

Fixed by Joulz, never pooled (`TOURNAMENT_PRIZES`):

| Kind | 1st | 2nd | 3rd | 4th–10th |
| --- | --- | --- | --- | --- |
| Arena | 100 | 60 | 30 | – |
| Score Attack | 300 | 200 | 100 | 60 |

Small-field safeguard (`prizeFor(kind, place, entrants)`): 1st pays with at least 4 entrants (Arena) or 5 (Score
Attack), 2nd with 8+, 3rd with 12+, Score Attack 4th–10th with 50+. Trophies (gold, silver, bronze) follow the same
rule. Coins through `economy_credit` (reason `tournament_prize`, key `tournament_prize:<event>:<user>`); every payout
also writes a `tournament_prizes` row, so it pays once and is logged.

Badges through C2's `badge_award` (idempotent): Entrant (a ranked finish in any tournament), Trophy Hunter (any
trophy), Arena Ace (8 games won in a row in one Arena, across duels; `applyArenaGames`, the database's `best_game_streak`), Champion (a gold trophy), Arena Champion, Score Attack
Champion (gold in that kind), Serial Winner (10 gold trophies).

Joules through D2's `creditTournamentJoules`: each settled Arena duel 100 to each player (`eventId`
`arena:<event>:<duel>`), finishing a Score Attack 150 (`eventId` the event's id).

## 8. Analytics (`src/lib/data/events.server.ts`)

`tournament_entered` (props `kind`, `entry`), `tournament_finished` (props `kind`, `place`), `prize_paid` (props
`kind`, `place`, `coins`). Mode `tournament` on the Score Attack's game events.

## 9. Flagged runs

Only the server's own flag counts: a stored grade's `extra.flagged === true` (`serverFlag` in `rules.ts`). A player
with a flagged run in an event earns nothing there (no points, score, place, prize, trophy, badge or Joules); in a
duel the opponent's result stands as a win (`flaggedDuelWinner`). Each flag is logged once through
`tournament_flag`; `readFlaggedPlayers(eventId)` answers who. W4c: log your rounds' flags the same way and leave
flagged players out of your standings.

## 10. Nameplates on every row (Joe's rule of 11 Nov 2026)

A player's card, avatar and frame show wherever they appear. Every board, standings and bracket row draws its player as
the nameplate strip from A2's player card: `TournamentPlate` (`src/components/tournaments/TournamentPlate.tsx`) with the
row's `plate` (`PlateView`, `src/lib/identity/plates.ts`). The card art band, the frame, the avatar, the name colour,
the rated emblem and the card's badges sit inside the name area only, never behind a place or a score; the strip is a
button and a tap opens the player's full card (`PlayerCard`) in a sheet from the same plate.

- **One call per page**: the server builds every row's plate with `platesFor(client, viewerId, rows, nowMs)`
  (`src/lib/identity/plates.server.ts`: one read each of A1's public cards, C2's card badges and titles, W3a's shown
  tiers through `shownTiersFor`, and the dates of birth) and sends them inside the board's own answer. The phone fetches
  nothing for a plate.
- `card`: an account (its username, never a row's stored name). `guest`: the room name on colour and initial.
  `hidden`: an under-18 seen by anyone but themselves: "Hidden player" on their colour and initial, with no username,
  cosmetics, emblem or badges in the answer. A failed age read hides every other player (fails closed).
- W4c: build your bracket and standings rows the same way (`platesFor` once per page, `plate` on each row, draw with
  `TournamentPlate`). tournament-plates-check proves the plates, the boards and the strip.

