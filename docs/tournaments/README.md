# Tournaments: the hub, the Arena and the daily Score Attack (wave 4, W4b)

11 Nov 2026. The Tournaments tab as a living hub: two Arenas a day and one Score Attack a day, entered free, with
coins or with tickets, paying fixed prizes, **never changing ratings**. The contract for W4c (Swiss, Knockout) and
later sessions is `docs/tournaments/interface.md`. Mockups: `docs/mockups/wave-4/05`–`08`.

## The launch set and the switches

All in `src/config/tournamentConfig.ts`; Joe edits the file and merges to `main` (the deploy carries it). The server
reads them on every call.

| Setting | Launch | Meaning |
| --- | --- | --- |
| `TOURNAMENTS_FOR_EVERYONE` | `false` | false: only accounts on D1's tester list (`shop.testers`) see and enter tournaments; true: every account. Until then the tab shows exactly what it showed before (public games) for everyone else. |
| `TOURNAMENT_KINDS_ON` | Arena, Score Attack on; Category Cup, Championship off | W4c's two kinds stay off. While the Category Cup is off, a Category Cup ticket enters any daily Score Attack. |
| `ARENA_TIMES_UK` | `13:00`, `20:00` | The Arena's daily start times, UK time (summer time included). |
| `ARENA_WINDOW_MIN` | 45 | Minutes during which new duels can start; a duel started in time plays to its end. |
| `ARENA_MIN_ENTRANTS` | 4 | Below this at the start, the Arena is called off and its entrants are told when the next one is. |
| `ARENA_ENTRY_OPENS_H` | 24 | How long before its start an Arena can be entered (also during its window, until 5 minutes before it closes). |
| `SCORE_ATTACK_COINS` | 50 | The Score Attack's coin entry (or one Score Attack ticket). |
| `SCORE_ATTACK_ROUNDS` | 5 | Games in a Score Attack, all from the day's featured category. |
| `TOURNAMENT_PRIZES` | as below | The prize table and the small-field safeguard. |

**Changing the schedule:** edit `ARENA_TIMES_UK` (any "HH:MM" UK times) or `ARENA_WINDOW_MIN`, and merge. Event ids
are made from the schedule (`arena:<day>:<HHMM>`, `score_attack:<day>`), so a new time is a new event; an event
already stored keeps its row. The Score Attack's featured category rotates one a day through the room picks
(`featuredPick` in `src/lib/tournaments/rules.ts`).

## The Arena

Every day at 1 pm and 8 pm UK, free, accounts only. For the 45-minute window each entrant taps **Find a duel** and
is paired with another searching entrant by rating through W3b's pairing (`bestPartner`: the nearest rating within
the widening band, then the longest wait; from 12 s, the nearest however far; the opponent just played is passed
over while anyone else waits, for 20 s). Each duel is a best of 3 on W3b's room engine (`createDealtMatchRoom`, a
plain extraction of W3b's `createLiveMatch`), Mixed, Classic, stopping once won (2–0), as a rated best of 3 does
(`arenaDuelClinched`, W3b's `matchClinched`): an ordinary room, never a rated match, so no rating
moves (tournaments-check proves no `mm_matches` row and no `recordRatedMatch` call). Play again is refused in its
room; chat follows the stranger rules (`chatPolicy("tournament", …)`: under-18s and guests pick quick phrases).

The pairing rating is W3a's (`ratingsReady()` binds the real engine; read only: an Arena never calls
`recordRatedMatch` or `finishRatedMatch`). Points: 2 a win; after 2 wins in a row each win counts double (4) until the streak breaks; a loss or a draw scores
nothing and breaks it. Standings: points, then duel wins, then the total score, then who got there first. A live
leaderboard on the event page. A duel still playing 30 minutes after the window closes is void.

## The daily Score Attack

One a UK day, 24 hours from midnight; 50 coins or a Score Attack ticket. Everyone plays the same 5 games from the
featured category once, in an async room of kind `score_attack` (the Daily's engine: the same rounds and deals for
everyone, graded as rooms are). Highest total wins; the faster total time (the room tie-break) breaks a tie; any
number of players. Its board opens once your attempt has finished or the day has closed (the Daily's rule).

## Entry and refunds

Free, coins (A1's ledger: `economy_spend`, reason `tournament_entry`) or a ticket (A1's consumables). The payment
and the entry are one transaction, so an entry exists exactly when it was paid; one per account. An event that
doesn't run (an Arena under 4 entrants, or one Joe calls off) refunds every entry in full, once: coins through
`economy_refund`, tickets back through `economy_grant_consumable` (reason `refund`). Banned players can't enter.

## Prizes, trophies, badges, Joules

Fixed by Joulz, never pooled: Arena 100 / 60 / 30 coins; Score Attack 300 / 200 / 100, 4th–10th 60. Safeguard: 1st
pays with at least 4 entrants (Arena) or 5 (Score Attack), 2nd with 8+, 3rd with 12+, Score Attack 4th–10th with
50+; trophies (gold, silver, bronze) follow the same rule. Each payout is one ledger line (reason `tournament_prize`,
key `tournament_prize:<event>:<user>`) and one `tournament_prizes` row, in one transaction: paid once, logged.
Trophies show in Profile's trophy cabinet (F5's trophy art as the placeholder until the canvas art is drawn); the
cabinet isn't drawn without a trophy.

Badges through C2's `badge_award`: Entrant (a place in any tournament), Trophy Hunter (any trophy), Arena Ace (8 games won in a row in one Arena, counted
across duels: four straight 2–0 duels earn it; a game lost or drawn breaks the run; Joe, 11 Nov 2026), Champion (a gold trophy), Arena Champion, Score Attack Champion (gold in that
kind), Serial Winner (10 gold trophies). Joules through D2's `creditTournamentJoules`: 100 to each player of a
settled Arena duel, 150 for finishing a Score Attack.

## Flagged runs (Joe, 11 Nov 2026)

A run the server's grading flags (a stored grade's `extra.flagged === true`, set by the server replay on a failed
check, a mismatch or a desync; the same rule W3a's ratings read; never anything the phone sends) earns no Arena
points or Score Attack score: the flagged player gets no place, prize, trophy, badge or Joules in that event. In a
duel, the opponent's result stands as a win. Each flag is logged once for Joe's review in
`moderation.tournament_flags`, beside W3a's `moderation.rated_flags` in the moderation schema (unreachable from the
API, the service role included); `rated_flags` keys on rated matches, which tournaments never are. The player sees
"Your result is under review." on the event page, the Arena board and their entries.

## Joe's tools (Supabase SQL editor)

```sql
-- Call an event off and refund every entry in full (a note is required; logged in tournaments.admin_log).
SELECT tournaments.cancel_event('score_attack:2026-11-20', 'server outage');

-- One event at a glance: its row, entries by type, refunds, places, prizes and trophies.
SELECT tournaments.summary('arena:2026-11-20:1300');

-- Flagged tournament runs still open (or all with true), and closing one with a note.
SELECT * FROM moderation.tournament_flag_queue();
SELECT moderation.tournament_flag_resolve(12, 'checked: a real desync, no action');
```

## The tick

A Cron Trigger every 5 minutes (task `tournaments:tick` on B2's own `*/5 * * * *` trigger: one Cron Trigger runs
both) stores the coming day's events, moves
every open event on (start, call off and refund, finish and pay) and sends reminders through B2's
`notifyTournamentStarting`: an Arena 10 minutes before it starts, a Score Attack at noon UK on its day, once per
account and event, to entrants and anyone who tapped the bell. Every read of an event also moves it on, so the cron
is a safety net. Cloudflare's free plan allows 5 Cron Triggers; the built wrangler.json has four distinct expressions
(`*/5 * * * *` push friend sweep and the tournaments' tick, `41 * * * *` the Daily reminder, `23 * * * *` W3a's
standings, `37 4 * * *` W3b's practice-deals purge).

## The rules pages

`/tournament-rules?kind=arena` and `?kind=score_attack`, plain words, every number from the config, marked **Draft**
until the legal adviser's note on coin tournaments is in.

## Files and checks

Config `src/config/tournamentConfig.ts`; rules `src/lib/tournaments/rules.ts`; flow `tournaments.server.ts`;
functions `tournaments.functions.ts`; phone `tournamentsApi.ts` (the check-only `window.__DUELZ_ALLOW_TOURNAMENTS__`
is never read in a production build); chat `tournamentChat.server.ts`; task `tasks/`; data
`src/lib/data/tournaments.server.ts`; screens `src/components/tournaments/`, `src/routes/tournament.tsx`,
`src/routes/tournament-rules.tsx`, `src/polish-layout/tournaments.css`. Migrations
`20261115200000_tournaments.sql`, `20261115200100_tournament_badges.sql`,
`20261115200200_analytics_tournament_events.sql`. Checks: tournaments-check (~40 s, PostgreSQL, shard `e`),
tournaments-screens-check (~2 s).

## Nameplates

Every board row draws its player as the nameplate strip from A2's player card (Joe's rule of 11 Nov 2026): the card art
band, the frame, the avatar, the name colour, the rated emblem and the badges inside the name area only, never behind a
place or a score; a tap opens the full card. The plates come with the board (`platesFor`, one call per page). Guests and
hidden under-18s ("Hidden player") keep colour and initial. Contract: `interface.md` section 10; proof:
tournament-plates-check.
