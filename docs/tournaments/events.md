# The Category Cup and the Joulz Championship (wave 4, W4c)

11 Nov 2026. The two big events, built now and **switched off at launch** (decided 11 Nov 2026): the Category Cup
(Swiss) and the Joulz Championship (Knockout). No gameplay, scoring, stamp, rating or deal changed: every match is an
ordinary room the server makes already started (W3b's `createStartedRoom`, three games dealt from a new room seed by
`dealRoomRounds`), graded by the rooms engine, and no tournament result is ever passed to the ratings.

Mockups: `docs/mockups/wave-4/07-event-and-entry`, `09-swiss-round`, `10-knockout-bracket`.

## Switching an event on

`src/config/tournamentEventsConfig.ts`:

| Switch | Launch | Meaning |
|---|---|---|
| `CATEGORY_CUP_ENABLED` | `false` | The Category Cup: its row on the Tournaments tab, `/cup`, entering, and the server ticking it on. |
| `JOULZ_CHAMPIONSHIP_ENABLED` | `false` | The Joulz Championship: its row, `/championship`, the hall of fame, the Championship frame's line in Customise. |

Set one to `true` and merge to `main`; the deploy ships it. While a switch is off the server refuses that event's
every call (`eventRefusal`, read from the config on each call), the Tournaments tab draws nothing new and calls
nothing, and no event row is made.

**Before switching the Championship on, W4b's Score Attack standings must be wired in** (`scoreAttackTop` in
`src/lib/tournaments/platform.server.ts`, see "Adapters"): until then nobody qualifies, so every Championship is
cancelled (`no_qualifiers`) and pays nothing.

## Files

| Piece | File |
|---|---|
| Switches | `src/config/tournamentEventsConfig.ts` |
| Schedule, rotation, field sizes, prizes, safeguard, trophies, badges, rules pages (pure) | `src/lib/tournaments/eventRules.ts` |
| Swiss standings, tie-breaks and pairing (pure) | `src/lib/tournaments/swiss.ts` |
| The Knockout bracket (pure) | `src/lib/tournaments/knockout.ts` |
| The flow: events, entry, refunds, the tick, settling, payouts, the event page, the hall of fame | `src/lib/tournaments/eventsFlow.server.ts` |
| Server functions | `src/lib/tournaments/events.functions.ts` |
| Adapters for W4b and D2 | `src/lib/tournaments/platform.server.ts` |
| Chat's stranger rules in match rooms | `src/lib/tournaments/eventChat.server.ts` (called from `chat.functions.ts`) |
| Data layer | `src/lib/data/tournamentEvents.server.ts` |
| Screens | `src/components/tournaments/BigEvents.tsx`, `eventsApi.ts`, routes `src/routes/cup.tsx`, `championship.tsx`, `src/polish-layout/tournament-events.css` |
| The Championship frame | `docs/art/wave-4/catalogue.json` (placeholder art until drawn) |
| Migrations | `supabase/migrations/20261115300000_tournament_events.sql`, `20261115300100_analytics_tournament_events.sql` |
| Checks | `scripts/tournament-events-check.ts` (pure, ~6 s), `scripts/tournament-events-server-check.ts` (PostgreSQL, ~10 s, shard `e`) |

## The Category Cup (Swiss)

- **When**: Saturdays at 7 pm UK. One event a Saturday (`category_cup:<date>`).
- **Category**: the 11 categories in turn (the six puzzle categories, then the five arcade groups), one a week,
  anchored so 10 Oct 2026 was Word (14 Nov 2026 is Logic).
- **Entry**: accounts only; 150 coins or one Category Cup ticket (A1's `ticket_category_cup`), spent once per entry
  under the key `tournament_entry:<event>:<user>:<attempt>`. Leaving before the start gives the entry back once (coins
  through the ledger's refund of the spend line, a ticket re-granted under `tournament_refund:…`); entering again pays
  again. Entry closes at the start. At most 128 players. Banned players can't enter.
- **Minimum**: 16 entrants at the start, else the cup is cancelled (`too_few`) and every entry refunded once. Joe can
  cancel an open cup by hand (`UPDATE public.tournament_events SET status = 'cancelled', cancelled_reason = 'by_joe'
  WHERE event_key = 'category_cup:YYYY-MM-DD' AND status = 'open';`); the next tick refunds every entry.
- **Rounds by field size**: 5 with up to 31 players, 6 with up to 63, 7 from 64. Each round is one best of 3.
- **Pairing**: score group by score group from the top (points counted in halves: a match win 2, a draw 1, a bye 2);
  each group pairs within itself, nearest-placed first, floating its odd one out (and two more only if rematches force
  them) down to the next group, the lowest-placed first; never the same opponent twice; nobody knocked out. With an
  odd field, the lowest-placed player who hasn't had a bye gets one (worth a win).
- **Tie-breaks, in order**: points; Buchholz (the sum of the opponents' points, byes adding nothing); head-to-head
  (the points level players took from each other); the total score across the cup; entry order. Every place unique.
- **Prizes** (fixed by Joulz, never from entries): 1st 3,000, 2nd 1,800, 3rd 900, 4th–8th 300. The small-field
  safeguard: 2nd only with 8 or more players, 3rd only with 12 or more (moot while the minimum is 16; kept so it
  holds if the minimum ever drops). Trophies: gold, silver, bronze to 1st–3rd under the same safeguard. The winner
  gets the Swiss Champion badge.

## The Joulz Championship (Knockout)

- **When**: the last Sunday of the month at 7 pm UK (`championship:<YYYY-MM>`).
- **Qualifying**: the month's top 64 Score Attack players as at the start (W4b's standings), accounts only (guests,
  repeats and banned players skipped, the next one taking the place), seeded by their Score Attack place. No entry fee,
  nothing to refund.
- **Bracket**: the smallest power of two holding the qualifiers (2–64), seeds in the standard order (1 v 64, 32 v 33,
  …; seeds 1 and 2 only meet in the final). With fewer than 64, the top seeds get byes. Fewer than 2 qualifiers:
  cancelled (`no_qualifiers`).
- **Matches**: best of 3; a level match goes to the most games won, then the higher total, then less time, then the
  higher seed. The semi-final losers play for 3rd; the final is live.
- **Places**: 1 and 2 from the final, 3 and 4 from the third-place match, 5 for every quarter-final loser (5th–8th).
- **Prizes**: 1st 10,000 coins, the animated Championship frame (`frame.championship`, an earned catalogue item,
  source `tournament`, never sold; placeholder art until drawn: the card draws the Plain frame for it meanwhile),
  the hall of fame and the Knockout Champion badge (a Legendary: its 250 coins come with it, as every Legendary
  badge's); 2nd 5,000; 3rd 2,500; 4th 1,000; 5th–8th 500. Trophies to 1st–3rd.

## Both events

- **Timing**: round 1 starts at the start; each later round's rooms are made a minute after the last match of the
  round before settles (at once after a round of byes only). A match room not finished 25 minutes after it was made
  is settled from what is stored (`MATCH_DEADLINE_MS`; a no-show scores 0).
- **Who moves an event on**: every phone on its page polls `tournamentEventFn` (about every 3 s), which ticks the event
  first. One ticker at a time (`tournament_event_lock`); every step is a guarded update or an idempotent write, so racing
  phones are safe. With nobody on the page the event waits; any later visit catches it up.
- **Reminders**: one to every cup entrant 15 minutes before the start (the platform's `remind`).
- **Payouts, once and logged**: at the finish each prize is paid with its own ledger key
  (`tournament_prize:<event>:<user>`, reason `tournament_prize`), badges through `badge_award`, the frame through
  `economy_grant_item` (`earned`), and one `tournament_payouts` row per entrant and kind (coins, trophy, badge, frame,
  hall_of_fame, joules): the log of what was paid. A payout tick that dies leaves `paid_at` unset and the next tick pays
  only what isn't logged.
- **Joules**: 150 for finishing either event, once per entrant per event (`tournament_finish:<event>:<user>`).
- **Ratings**: never changed. A tournament room is never a rated match, and nothing here calls the ratings.
- **Rooms**: tournament match rooms can't be played again (`rematchFn`), and their chat follows wave 1's stranger rules
  (`chatPolicy("tournament")`: guests and under-18s pick quick phrases).
- **Hall of fame**: every Championship winner by month, newest first, on the Tournaments tab while the Championship
  is on (`hallOfFameFn`; a deleted account shows as "Deleted player").

## Adapters (`src/lib/tournaments/platform.server.ts`)

W4b's contract (`docs/tournaments/interface.md`) wasn't open when this was built, so the three things these events need
from other sessions go through one adapter; wiring each in is one change there.

| Adapter | From | Until wired |
|---|---|---|
| `scoreAttackTop(client, month, limit, asOfMs)` | W4b: the month's Score Attack standings, best first (account ids) | `[]`: nobody qualifies |
| `awardJoules(client, { userId, amount, key })` | D2: Joules (the Season pass) | nothing paid (the payout row is still written once) |
| `remind(client, { userIds, eventName, startsAtMs })` | W4b's reminders / B2's notifications | nothing sent (`reminded_at` still set once) |

`setTournamentPlatform` is for checks only and does nothing in a production build (`import.meta.env.PROD`).

## Events

`swiss_round_paired` (props `round`, `players`) once per Category Cup round; `knockout_match_played` (props `round`)
once per played Championship match, never a walkover. Through `recordEvents` (`src/lib/data/events.server.ts`).

## Database

All in `20261115300000_tournament_events.sql`, server only (RLS on, no policies, no anon or authenticated grants):
`tournament_events`, `tournament_entries`, `tournament_matches`, `tournament_payouts`, `tournament_trophies`,
`tournament_hall_of_fame`; functions `tournament_event_lock` / `_unlock`, `tournament_enter`; ledger reasons
`tournament_entry`, `tournament_refund`, `tournament_prize`; the catalogue row `frame.championship`; Swiss Champion and
Knockout Champion set earnable (Joe's approval, 11 Nov 2026). The analytics migration adds the two events to the list
as it stands.
