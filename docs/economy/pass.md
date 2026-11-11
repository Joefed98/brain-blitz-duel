# The Season pass, Joules and weekly challenges (wave 2, train D, session D2)

13 Nov 2026. Season 1 "Neon Circuit" working end to end for Joe and the shop's testers: Joules earned from play, 60
levels on a free and a premium track, claiming, a test purchase of the premium track, and three weekly challenges,
ready to switch on for everyone when Season 1 starts. The agreed design is `docs/economy/economy-design.md`; mockup
`docs/art/wave-2/screens/battle-pass.png`. Nothing in the pass helps anyone win: no gameplay, scoring, stamp, timing
or room-flow change, and economy-neutral-check proves no scoring, grading, replay, matchmaking or timing code reaches a
pass module.

## Files

| Piece | File |
| --- | --- |
| Migration: seasons, Joules, members, premium, claims, pass titles, weekly draws, the stored-results reader, Joe's functions | `supabase/migrations/20261113100000_season_pass.sql` |
| Migration: the four analytics events (added to the list as it stands) | `supabase/migrations/20261113100100_analytics_pass_events.sql` |
| Migration: the pass titles in public.titles, test-season reward reasons, `pass.remove_test_season_rewards` | `supabase/migrations/20261113100200_pass_titles_test_rewards.sql` |
| Both tracks level by level, levels | `src/lib/pass/rewards.ts` |
| Joules amounts, day limits, soft cap (pure mirror of the database's arithmetic), the wave 3 / 4 amounts | `src/lib/pass/joules.ts` |
| The weekly pool of 45, the weekly draw, progress (pure) | `src/lib/pass/weekly.ts` |
| UK days | `src/lib/pass/ukDays.ts` |
| Server rules | `src/lib/pass/pass.server.ts` |
| Server functions | `src/lib/pass/pass.functions.ts` |
| Data layer | `src/lib/data/pass.server.ts` |
| Phone calls and the shared pass state | `src/lib/pass/passApi.ts`, `src/lib/pass/types.ts` |
| The switch | `src/config/passConfig.ts` (`PASS_FOR_EVERYONE`, false) |
| Screens | `src/components/pass/` (PassScreen in the Shop tab's Pass part, PassHomeCard on Play, JoulesLine on results, PassLevelNotice), `src/polish-layout/pass.css` |
| Checks | `scripts/pass-check.ts` (shard `e`, ~25 s, PostgreSQL), `scripts/pass-screens-check.tsx` (happy-dom, ~3 s) |

## Who sees it

- **Testers only, for now**: D1's one list, `shop.testers` (Joe manages it with `shop.add_tester` /
  `shop.remove_tester`). Every pass function (`getPassFn`, `claimPassRewardFn`, `testPremiumFn`, `passLevelSeenFn`,
  `passJoulesSinceFn`) refuses guests and, while `PASS_FOR_EVERYONE` is off, every account not on the list.
- A tester sees the **test season** while it runs, otherwise the live real season. Season 1 has no dates yet, so until
  Joe starts the test season or sets Season 1's dates, a tester sees "The pass is coming".
- Test purchases are testers only, always (checked by the server and again by the database).

## Seasons (Joe's functions; the app never writes a season)

In the `pass` schema, unreachable from the app and the API. Every change writes a `pass.admin_log` line (who, what,
when, which season, about whom, the note, required). A player is named by username (any capitals) or user id.

```sql
-- Season 1's dates (no fixed length; the end may be null, open-ended, and set later).
SELECT pass.set_season_dates('s1', '2027-01-26 00:00 Europe/London', '2027-03-23 00:00 Europe/London', 'Season 1 dates');
-- End a season now (Joules stop; the pass stays open 14 days for claiming what was reached, CLAIM_GRACE_DAYS).
SELECT pass.end_season('s1', 'Season 1 over');
-- A later season.
SELECT pass.create_season('s2', 'Season 2 name', 'next season');

-- The testers' season (testers only): start now (optionally with an end), reset, end.
SELECT pass.start_test_season('testing the pass');
SELECT pass.start_test_season('two-week test', now() + interval '14 days');
SELECT pass.reset_test_season('again from zero', 'TheirUsername');   -- one tester
SELECT pass.reset_test_season('everyone again from zero');           -- every tester
SELECT pass.end_test_season('testing finished');

-- Test purchases of the premium track, and taking one away (marked removed, never deleted; what was claimed stays).
SELECT * FROM pass.test_purchases();
SELECT * FROM pass.test_purchases('TheirUsername');
SELECT pass.remove_test_purchase('TheirUsername', 'end of the test round');          -- every season's
SELECT pass.remove_test_purchase('TheirUsername', 'end of the test round', 'test');  -- one season's

-- Before launch: take back everything the testers' season paid, in one call (all testers, or one). Coins and
-- consumables get a line of their own (test_pass_reward_removed; never below zero: the answer says what was already
-- spent), items claimed only in the test season are removed, test-season titles go (a card showing one goes back to
-- Rookie), and the test season's premium tracks are marked removed. Running it again takes nothing more.
SELECT pass.remove_test_season_rewards('clean-up before launch');
SELECT pass.remove_test_season_rewards('clean-up', 'TheirUsername');

-- Any week's three weekly challenges as drawn (any day of the week).
SELECT pass.week('2026-11-18');
-- One account's pass at a glance; the log.
SELECT pass.summary('TheirUsername');
SELECT at, by_role, action, season_id, user_id, detail, note FROM pass.admin_log ORDER BY at DESC;
```

A reset never deletes: each account's place in a season has a start ("epoch": the season's start, moved on by a
reset), and Joules lines, claims and levels are kept per start. Items and coins claimed before a reset stay owned;
claiming the same level again after a reset pays its coins and consumables again (test season only, as test rewards).

## Joules (`economy-design.md` "Joules and pacing")

Worked out on the server from stored results only, every time the pass is read (the Pass screen, the Home card, a
claim, the results line): `public.pass_activity` reads this account's stored play since its start in the season, and
`public.pass_credit_joules` credits each source event once (unique per season, start, account and source key), paying
in the order the play happened, under a lock on the account, so two reads never pay twice or past a limit.

| Source (stored) | Joules | Limit (per UK day) | Key |
| --- | --- | --- | --- |
| The Daily Puzzle finished | 150 | once a day (one Daily a day) | `daily_puzzle:<day>` |
| The Daily Arcade finished | 150 | once a day | `daily_arcade:<day>` |
| A room round played (live, or archived by Play again) | 20 | none | `room_round:<result id>` |
| A room finished (the last round's result stored) | 50 | none | `room_finish:<room>:<game index>` |
| A friend challenge finished (attempts copied in from a room left out) | 100 | the first 5 | `challenge:<attempt id>` |
| A Practice run counted by C1a (graded, after its fresh start; no examples) | 20 | up to 200 | `practice:<play id>` |
| A Practice challenge's first completion (C1b) | 100 | once per challenge | `practice_challenge:<id>` |
| A weekly challenge completed | 500 / 750 / 1,250 | three a week | `weekly:<week>:<tier>:<id>` |

- **Soft cap**: after 4,000 Joules from play in a UK day, further play earns half (rounded down; an event straddling
  4,000 pays the part below in full). Weekly rewards are paid whole and don't count towards the day.
- Every day limit and the cap count per UK calendar day **of the play** (the stored result's own time: midnight to
  midnight in London, summer time included), never the day it is credited: `pass_joules.uk_day` comes from the source
  event's time, and the limits and cap sum that day's lines. Play late on Wednesday and open the pass on Thursday, and
  the Joules count on Wednesday (pass-check, "UK day of play"). Nobody is ever stopped from playing.
- **Hooks for later** (named, nothing calls them yet): `creditRatedMatchJoules` (wave 3: 150 a win, 100 a loss, 1.5×
  for the longer formats) and `creditTournamentJoules` (wave 4: an Arena duel 100, finishing an event 150), in
  `pass.server.ts`, amounts in `joules.ts`.
- 1,000 Joules a level, 60 levels.
- **Results**: a small line in electric lime (`--jz-joules`) with the bolt mark, "+170 Joules", under the room's final
  screen (podium and two-player), Practice's reveal and the Daily / challenge results, for what that game earned
  (`passJoulesSinceFn`: Joules from the game's first stored result, or, for Practice and the Daily, from just before
  the screen opened). Never next to a rating; nothing at all where the pass is off.

## The two tracks (`economy-design.md`, level by level; `rewards.ts`)

- Free: 30 rewards, every second level. Premium: 60 rewards, every level. Items are catalogue.json's pass items at
  their levels (pass-check proves both tracks against the doc's tables and the catalogue).
- Rewards are paid through A1's functions under the claim's own key (`pass:<season>:<epoch>:<track>:<level>`): items
  by `grantItem` (how `pass`), coins by `creditCoins` (reason `pass_reward`), streak freezes and tournament tickets by
  `grantConsumable` (reason `pass_reward`), the two titles (Neon Rider, Circuit Breaker) into
  `public.pass_title_unlocks`. **The testers' season pays its coins and consumables as test rewards** (reason
  `test_pass_reward`, as D1's test coin packs are `test_purchase`).
- **The pass titles are equippable once unlocked** (Joe's approval, 11 Nov 2026): Neon Rider and Circuit Breaker are
  rows of `public.titles` (kind `pass`, after the brief's 32; badges-check's two counts are 34 with the approval beside
  them), and `badge_set_title` equips one only with its row in `public.pass_title_unlocks`. Customise's title list
  shows them once unlocked (`MyBadges.passTitles`); other players read them on the card as any title.
- **Pictures**: each reward shows its real picture. Card arts and frames are drawn by A2's player card renderer
  (`CardPiece`), name colours as the player's own name in the colour (`NamePiece`); every other pass item (skins, world
  themes, reactions, celebrations, tile styles, avatar items) uses its approved still, cut by
  `bun scripts/shop-previews.ts` (extended to the pass's items, the same `public/shop/<id>.webp` and
  `SHOP_PREVIEWS`). Coins, tickets, freezes and titles keep their marks.
- **Claiming**: a tap on the pass screen (`claimPassRewardFn`); only a reached level, premium only with the premium
  track; twice (even at the same moment) pays once.
- **Premium**: a late purchase makes every premium reward already passed claimable at once; the Neon Captain Joulz
  helmet (premium level 1) is granted on purchase.
- **The level-up notice**: "Level 12 reached in the pass" above the tab bar, once per level, on tab pages only (never
  over a round, reveal, result, podium, standings or share screen).
- Tickets show "for tournaments, coming soon" until wave 4.

## The premium track

- **Test purchase** (testers, until real payments exist): "Test purchase: unlock Premium" on the Pass screen, no
  payment, stored as `source = 'test'`, removable with `pass.remove_test_purchase`.
- **For E2 (Joulz Plus) and real purchases later**: `grantPremiumTrack(client, { userId, seasonId, source: "plus" |
  "purchase", key })` in `src/lib/pass/pass.server.ts` (server only; the database's `public.pass_grant_premium`).
  Idempotent: the same account and season again answers `already`; answers `granted`, `already`, `no_account`,
  `unknown_season`. Records `pass_bought` (test false) once and grants the helmet at once when the season is the one
  the account sees now (otherwise on its first look at that season's pass). A season not yet started can be granted
  ahead of time.

## Weekly challenges (`weekly.ts`)

- Three every Monday at midnight UK, the same for everyone: Easy 500, Medium 750, Hard 1,250 Joules; they expire the
  next Monday. Drawn from the economy doc's pool of 45, leaving out those needing tournaments (Score Attack, Arena:
  wave 4) and, while rated play is off for everyone, every R challenge (wave 3 W3a, 11 Nov 2026, Joe's approval:
  `drawable` reads `RATED_PLAY_FOR_EVERYONE` through `ratedChallengesDrawable()`; `drawableWith(c, ratedOn)` for the
  checks): 13 Easy, 10 Medium and 10 Hard drawable now, the nine R ones (3 / 3 / 3) joining when it is on. R challenges
  count the week's counted rated matches (`public.rated_week_matches`: played, won, games won in a category, a best of
  3 won 2–0, wins in a row, categories won in). Each tier walks a seeded
  order of its drawable challenges (one full cycle before any repeats) and takes the first whose category the week
  doesn't already have, so each week's three are in three different categories.
- The week's picks are recorded the first time anyone's pass reads the week (`public.pass_weeks`, never changed), so
  any week can be checked later (`pass.week`).
- Progress is worked out on the server from stored results only: room, Daily and friend-challenge rounds, Practice runs
  counted by C1a (after its fresh start), C1a's stars and C1b's completions, inside the week and the season. Every
  week of the season so far is checked (the latest 26), so a challenge finished on Sunday pays even if the pass is
  next opened on Tuesday. Any difficulty level counts.
- Readings (assumptions): "Play the Daily …" counts a day with a round of that Daily played; "Score N+ on the Daily …"
  means a round of that Daily scoring N or more; "Play/Score … in N X games" counts plays unless the text says
  "different"; categories are the six puzzle categories and the five arcade groups (Retro, Sports, Cards & Board,
  Action, Strategy), so "all 11 categories" is those eleven.

## Switching the pass on for everyone at Season 1

1. `SELECT pass.set_season_dates('s1', '<start>', '<end or NULL>', 'Season 1');`
2. `src/config/passConfig.ts`: `PASS_FOR_EVERYONE = true` (with D1's `SHOP_TAB_ENABLED = true` and the bundle
   schedule's start, docs/economy/shop.md), merged to main.
3. Optionally `SELECT pass.end_test_season('Season 1 is live');` so testers see Season 1 too.

Joules count from Season 1's start for everyone. Test purchases stay testers only.

## Analytics

Through `recordEvents` (`src/lib/data/events.server.ts`), server only: `pass_bought` (season, test, source),
`pass_level_reached` (season, level; once per level reached), `reward_claimed` (season, track, level, kind),
`weekly_challenge_completed` (tier, challenge id). A1's `coins_credited` and `item_granted` are recorded alongside.

## Who can reach what

anon and authenticated: nothing (no grants on any pass table or function). The server (service role) reads the
tables and writes only through the `public.pass_*` functions. The `pass` schema is unreachable from the app and the
API. pass-check proves it.
