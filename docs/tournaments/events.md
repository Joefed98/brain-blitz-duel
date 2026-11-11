# The Category Cup and the Joulz Championship (wave 4, W4c)

11 Nov 2026. The two big events, built now and **switched off at launch** (decided 11 Nov 2026): the Category Cup
(Swiss) and the Joulz Championship (Knockout), on W4b's tournaments (`docs/tournaments/interface.md`). No gameplay,
scoring, stamp, rating or deal changed: every match is an ordinary room the server makes already started (W3b's
`createDealtMatchRoom`, a best of 3 from the room seed, the same for both players), graded by the rooms engine, and no
tournament result is ever passed to the ratings.

Mockups: `docs/mockups/wave-4/07-event-and-entry`, `09-swiss-round`, `10-knockout-bracket`.

## Switching an event on

W4b's switches, in `src/config/tournamentConfig.ts`:

| Switch | Launch | Meaning |
|---|---|---|
| `TOURNAMENT_KINDS_ON.category_cup` | `false` | The Category Cup: on the schedule, the hub and the event page; entry; the rules page. |
| `TOURNAMENT_KINDS_ON.championship` | `false` | The Joulz Championship, its hall of fame on the Tournaments tab, the Championship frame's line in Customise. |

Set one to `true` and merge to `main`; the deploy ships it. `TOURNAMENTS_FOR_EVERYONE` (W4b's) still decides whether
only testers see tournaments. While a kind is off, W4b's `scheduledEvent` has no such event, so the server refuses
entry (`kind_off`) and answers nothing for the page, W4b's Cron Trigger makes none, and W4c's two server functions
answer nothing (`bigEventFn` goes through W4b's `eventFor`; `hallOfFameFn` reads the switch).

## Files

| Piece | File |
|---|---|
| Prices and prizes (W4b's config) | `src/config/tournamentConfig.ts`: `CATEGORY_CUP_COINS`, `BIG_EVENT_TIME_UK`, `TOURNAMENT_PRIZES.category_cup` / `.championship` |
| Schedule on W4b's ids, rotation, field sizes, the month's standings, badges, rules pages (pure) | `src/lib/tournaments/eventRules.ts` |
| Swiss standings, tie-breaks and pairing (pure) | `src/lib/tournaments/swiss.ts` |
| The Knockout bracket (pure) | `src/lib/tournaments/knockout.ts` |
| The flow: start, rounds, rooms, settling, flags, finish, awards, the live view, the hall of fame | `src/lib/tournaments/eventsFlow.server.ts` |
| Server functions (the live part, the hall of fame) | `src/lib/tournaments/events.functions.ts` |
| Score Attack standings and Joules | `src/lib/tournaments/platform.server.ts` |
| Data layer | `src/lib/data/tournamentEvents.server.ts` (W4b's events, entries, results, prizes and trophies through `src/lib/data/tournaments.server.ts`) |
| Screens | `src/components/tournaments/BigEventLive.tsx` (drawn by W4b's `TournamentEvent.tsx` and the Tournaments tab) |
| Hooks in W4b's code | `rules.ts` (ids, schedule, entry price and options, prize table), `tournaments.server.ts` (`advanceEvent`, `isTournamentRoom`, `reminderDueAt`), `TournamentEvent.tsx`, `TournamentRules.tsx`, `routes/tournament-rules.tsx`, `routes/tournament.tsx`, `routes/tournaments.tsx` |
| The Championship frame | `docs/art/wave-4/catalogue.json` (placeholder art until drawn) |
| Migrations | `supabase/migrations/20261115300000_tournament_events.sql`, `20261115300100_analytics_tournament_events.sql` |
| Checks | `scripts/tournament-events-check.ts` (pure, ~6 s), `scripts/tournament-events-server-check.ts` (PostgreSQL, ~15 s, shard `e`) |

## The Category Cup (Swiss)

- **When**: Saturdays at 7 pm UK, `category_cup:<YYYY-MM-DD>:1900`. Entry opens six days before and closes at the start.
- **Category**: the 11 categories in turn (the six puzzle categories, then the five arcade groups), one a week,
  anchored so 10 Oct 2026 was Word (14 Nov 2026 is Logic). The event's `pick`; the title "Logic Cup".
- **Entry** (W4b's `tournament_enter`): accounts only; 150 coins or a Category Cup ticket, once (key
  `tournament_entry:<event>`). Banned players can't enter. No leaving once in (W4b's entry has none); a cup that
  doesn't run refunds everyone.
- **Minimum**: 16 entrants at the start, else it is called off (`too_few`) and W4b's `tournament_cancel` refunds every
  entry in full, once. Joe can call one off by hand with W4b's `tournaments.cancel_event(id, note)`.
- **Rounds by field size**: 5 with up to 31 players, 6 with up to 63, 7 from 64. Each round is one best of 3.
- **Pairing** (`pairSwissRound`): score group by score group from the top (points in halves: a match win 2, a draw 1,
  a bye 2); each group pairs within itself, nearest-placed first, floating its odd one out (and two more only if
  rematches force them) down to the next group, the lowest-placed first; never the same opponent twice; nobody knocked
  out. With an odd field, the lowest-placed player who hasn't had a bye gets one (worth a win).
- **Tie-breaks, in order**: points; Buchholz (the opponents' points, byes adding nothing); head-to-head (the points level
  players took from each other); the total score across the cup; entry order. Every place unique.
- **Prizes** (`TOURNAMENT_PRIZES.category_cup`, fixed, never from entries): 1st 3,000, 2nd 1,800 (8+ players), 3rd 900
  (12+ players), 4th–8th 300. Trophies (W4b's) gold, silver, bronze under the same rule. The winner: the Swiss Champion
  badge (and W4b's Champion; every placed player W4b's Entrant).

## The Joulz Championship (Knockout)

- **When**: the last Sunday of the month at 7 pm UK, `championship:<YYYY-MM>`.
- **Qualifying**: the month's top 64 Score Attack players at the start: from W4b's stored daily Score Attack results
  (`tournament_results`), each player's best 10 daily totals that month added up, then more days played, then the
  better best daily place (`monthStandings`). Accounts only; guests, repeats and banned players are skipped and the
  next one takes the place; seeded in that order; entered free by the server (W4b's entry, so the count, reminders and
  results work as for any event). Nobody can enter it themselves. It is held only with at least 16 qualifiers (Joe, 11 Nov 2026): with fewer it isn't held that month (`not_held`; nobody has paid, so nothing is refunded), and the Tournaments tab and the event page say "Not held this month". The rules page states the qualification and the minimum.
- **Bracket**: the smallest power of two holding the qualifiers (16–64), seeds in the standard order (1 v 64, 32 v 33,
  …; 1 and 2 meet only in the final). With fewer than 64, the top seeds get byes.
- **Matches**: best of 3; a level match goes to the most games won, then the higher total, then less time, then the
  higher seed. The semi-final losers play for 3rd; the final is live.
- **Places**: 1 and 2 from the final, 3 and 4 from the third-place match, 5 for every quarter-final loser (5th–8th).
- **Prizes** (`TOURNAMENT_PRIZES.championship`): 10,000, 5,000, 2,500, 1,000, 500 for 5th–8th. The winner also gets the
  animated Championship frame (`frame.championship`, source `tournament`, never sold; placeholder art until drawn: the
  card draws the Plain frame for it meanwhile), the Knockout Champion badge (a Legendary: its 250 coins come with it, as
  every Legendary badge's) and the hall of fame. Trophies to 1st–3rd.

## Both events

- **Who moves them on**: W4b's `advanceEvent` hands W4c's kinds to `advanceBigEvent`, so every read of the event (the
  page polls every 3 s while live) and W4b's 5-minute Cron Trigger move it on. One ticker at a time
  (`tournament_rounds_lock`); every step is a guarded update or an idempotent write.
- **Timing**: round 1 at the start; each later round's rooms a minute after the round before settles (at once after a
  round of byes only). A match room not finished 25 minutes after it was made is settled from what is stored
  (`MATCH_DEADLINE_MS`; a no-show scores 0).
- **Reminders**: W4b's (every entry is reminded, through B2's notification, 10 minutes before the start).
- **Flagged runs** (Joe, 11 Nov 2026): a run the server's own grading flags (a stored grade's `extra.flagged`, the same
  rule as W3a's `gradeFlagReason`; never anything a phone sends) costs that player the match: a Swiss loss with no
  points and no score (both sides flagged: neither takes anything), a Knockout loss (both: neither goes through). The
  player gets no place, so no prize, trophy, badge, frame or Joules, and sees "Your result is under review, so it
  doesn't count for now." Each flag is logged once per player and game in `moderation.tournament_flags`, beside W3a's
  `moderation.rated_flags` (whose rows must be rated matches), through `public.tournament_flag_log`. Joe lists them with
  `SELECT * FROM moderation.tournament_flag_queue();` (`(true)` for all) and closes one with
  `SELECT moderation.tournament_flag_resolve(<id>, 'note');`.
- **Payouts, once and logged**: the finish writes W4b's results (placed players only) and runs W4b's `payEvent`
  (coins with their ledger keys and `tournament_prizes` rows, trophies, W4b's badges); then W4c's own awards (the
  winner's badge, the frame, the hall of fame, Joules), each logged once in `tournament_awards`. A tick that dies part
  way leaves `tournament_rounds.awarded_at` unset and the next pays only what isn't logged.
- **Joules**: 150 for finishing, through D2's `creditTournamentJoules` (kind `finished`), once per event and account.
- **Ratings**: never changed. A tournament room is never a rated match; nothing here calls the ratings.
- **Rooms**: W4b's `isTournamentRoom` counts W4c's match rooms, so Play again is refused there ("Your next match opens when the round does.", `BIG_EVENT_PLAY_AGAIN_LINE`) and chat follows wave 1's
  stranger rules (guests and under-18s pick quick phrases).
- **Hall of fame**: every Championship winner by month, newest first, on the Tournaments tab while the Championship is
  on (a deleted account shows as "Deleted player").

## Events

`swiss_round_paired` (props `round`, `players`) once per Category Cup round; `knockout_match_played` (props `round`)
once per played Championship match, never a walkover. W4b's `tournament_entered`, `tournament_finished` and
`prize_paid` cover entry, the finish and prizes as for every event.

## Database

`20261115300000_tournament_events.sql`, server only (RLS on, no policies, no anon or authenticated grants):
`tournament_rounds`, `tournament_seeds`, `tournament_matches`, `tournament_awards`, `tournament_hall_of_fame`;
`moderation.tournament_flags` with Joe's `tournament_flag_queue` / `tournament_flag_resolve`; functions
`tournament_rounds_lock` / `_unlock`, `tournament_flag_log`; the catalogue row `frame.championship`; Swiss Champion and
Knockout Champion set earnable (Joe's approval, 11 Nov 2026). `20261115300100_analytics_tournament_events.sql` adds the
two events to the list as it stands.
