# Badges, titles and the account rewards (wave 2, train C, session C2)

11 Nov 2026. Every player's achievements on their card, the coins every account is owed, and the Daily streak moved
from the phone to the account. Presentation and account data only: no gameplay, scoring, stamp or timing changed, and
nothing here is read by scoring, grading, replay, matchmaking or timing code (economy-neutral-check).

## Files

| Piece | File |
| --- | --- |
| Migration: tables, functions, the reason `streak_freeze_used`, the two events, the backfill | `supabase/migrations/20261111220000_badges_titles.sql` |
| The 54 badges and the titles (phone and server; the migration seeds the same rows) | `src/lib/badges/catalogue.ts` |
| Each earnable badge's rule | `src/lib/badges/rules.server.ts` |
| Rewards, awards, equipping (server) | `src/lib/badges/badges.server.ts` |
| Server functions | `src/lib/badges/badges.functions.ts` |
| Data layer | `src/lib/data/badges.server.ts` |
| The phone's store (badges, title, Daily record) | `src/lib/badges/badgesApi.ts`, types `src/lib/badges/types.ts` |
| Daily streak rule (pure) and the server's record | `src/lib/duel/dailyStreak.ts`, `src/lib/duel/dailyStreak.server.ts` |
| Screens | `src/components/badges/BadgeCollection.tsx` (Profile), `BadgeMoment.tsx` (tab pages), Customise's third tab (`src/routes/customise.tsx` `BadgesAndTitle`), the card (`PlayerCard` `badges` / `title`), `src/polish-layout/badges.css` |
| Badge art | `public/art/badges/<slug>.svg`, the approved `docs/art/badges/svg` byte for byte |
| Checks | `scripts/badges-check.ts` (shard `e`, ~10 s, PostgreSQL), `scripts/badges-screens-check.tsx` (~5 s, happy-dom) |

## Badges

54 permanent badges in six groups (competitive, mastery, Daily and tournaments, challenges, fun, social and special),
8 Common, 12 Rare, 17 Epic, 9 Elite, 8 Legendary, from `docs/art/badges/badges.json`. Earned, never bought; no hidden
badges: Profile lists every one, a locked one with how it is earned. A card shows up to three.

Every badge's rule is Joe's approved catalogue (**`docs/badges/catalogue.md`**, 11 Nov 2026; badges-check holds the
code to its table). Every badge shows its rule; a locked badge the server counts shows its progress ("4 of 7 days").
Each badge has a `status`:

- **earnable** (40; 16 until wave 3 W3a made rated play's 13 earnable, 29 until wave 4 W4a made the two Daily board badges earnable, 31 until wave 4 W4b made the tournaments' seven earnable, and 38 until wave 4 W4c made Swiss Champion and Knockout Champion earnable, 11 Nov 2026; counts set 13 Nov 2026): the server checks its rule now from what it stores (`rules.server.ts`, facts from
  `public.badge_facts`, the Daily record and the profile), or another session awards it through `badge_award`:
  - Flawless (a 200 in any game), Perfectionist (200 in 25 different games);
  - Daily Habit, Dedicated, Century (7 / 30 / 100 days in a row: the longest run in the server's Daily history, a
    freeze-covered day joining a run without adding to it; progress shows today's streak);
  - Buzzer Beater (a puzzle finished, `is_correct`, with 1–999 ms left), Speed Demon (10 puzzles finished with more
    than two thirds of the clock left; the clock is the stored `time_limit_ms` where kept, else the type's);
  - Party Host (25 room games hosted, `duels.host_user_id`, that at least 3 players played: on now or in Play again's
    archive);
  - First Star (a mastery star), All-Rounder (a star in every active game; the count follows the live game list, so
    the database row stores none) and Gem Hunter (a gem colour): C1a's `public.practice_progress` (`star_at`, Easy /
    Classic / Hard) and `public.gem_unlocks`; a counted run that earns a star or a gem also checks them at once
    (C1a's `onCounted` hook in `gradePracticeRun`, fire-and-forget);
  - Challenger, Challenge Seeker, Challenge Expert (10 / 50 / 100 Practice challenges completed: C1b's
    `public.practice_challenge_progress` rows with `completed_at` set; Practice challenges only exist in Practice);
  - Founding Player (as before);
  - Friendly (5 friends): earnable, but **B1 awards it** through `badge_award` (`AWARDED_ELSEWHERE`); no rule here;
  - rated play's 13 (First Win, Placed, Hot Streak, Comeback Kid, Clean Sweep, Podium Regular, Unstoppable, Giant
    Slayer, Storm Chaser, Lightning Strikes, Top 500, Revenge, Photo Finish): `BadgeFacts.rated`, from
    `public.rated_badge_facts` (wave 3 W3a; `docs/rated/README.md` "Badges"); checked after every rated match
    (`finishRatedMatch`) and after the standings job for a tier rise, and on every sync;
  - Daily Champion and Daily Top 100 (wave 4 W4a, 11 Nov 2026; `docs/leaderboards.md`): first, or in the top 100, on a
    final Daily board (`public.daily_board_entries`, accounts at least 24 hours old, each account's one finished
    attempt, never a flagged run) that counted 100+ players (Champion) or 500+ (Top 100), read by
    `public.daily_board_badge_facts` with the field sizes from `src/lib/leaderboards/boards.ts`. Approved by Joe in the
    W4a prompt: the two move from waiting to earnable (badges-check's counts updated with that date);
  - Entrant, Trophy Hunter, Arena Ace, Champion, Arena Champion, Score Attack Champion, Serial Winner (wave 4, W4b):
    earnable, **awarded by the tournaments code** (`src/lib/tournaments/tournaments.server.ts`, `AWARDED_ELSEWHERE`;
    docs/tournaments/README.md says when each is given); no rule here.
  - Swiss Champion and Knockout Champion (W4c, Joe's approval of 11 Nov 2026; migration
    `20261115300000_tournament_events.sql`): earnable, **awarded by the events** when a Category Cup or a Joulz
    Championship finishes (`src/lib/tournaments/eventsFlow.server.ts`, `AWARDED_ELSEWHERE`); no rule here.

  "Any game / any mode" counts rooms (the game on now and the archive), the Daily and challenges (not the results a
  challenge copied from the player's own room), and Practice only from C1a's fresh start
  (`public.practice_progress_start`, read by `badge_facts`). Puzzle means a non-arcade game.
- **waits** (14; 38 before wave 3 W3a, 25 before wave 4 W4a, 23 before wave 4 W4b, 16 before wave 4 W4c): the database refuses to award it; shown with "Arrives with …":
  - all three stars per game (wave 3.5): the 11 category masters, Grand Master;
  - Hard and Expert challenges (wave 3.5): Category Clear, Completionist;

**To make a badge earnable** later: a new migration updates its row (`status = 'earnable'`, `waits_for = NULL`), the
same change in `catalogue.ts` and `catalogue.md`, a rule in `BADGE_RULES` reading new `BadgeFacts` (gathered in
`badges.server.ts` `factsFor`, through `src/lib/data/`), and in `badges-check` a test that earns it and one that just
misses.

### Awarding

`public.badge_award(user, badge, detail)` (service role only): one row per account and badge, so awarding is
idempotent. A Legendary pays **250 coins once** through the ledger (reason `badge_reward`, key `badge_reward:<slug>`)
in the same transaction; asked again it re-posts under the same key, which answers `duplicate`. The phone's
`syncMyBadges` (once per app open, on the tab pages) settles the account rewards, checks every earnable rule and
answers the account's badges; `badge_earned` (badge, rarity) is recorded once per award.

## Titles

One at a time, small gold text under the name on the card. Earned, never bought. **Rookie** for everyone (no row in
`public.card_titles`); the 31 badge titles unlock with their badge (Grand Master, Top 500, Daily Champion, Knockout
Champion, Serial Winner, Completionist, Lightning, Founding Player; Unstoppable, Giant Slayer, Perfectionist, Century,
Storm Chaser; Comeback Kid, Clean Sweeper, Speed Demon, Podium Regular; Logician, Wordsmith, Number Cruncher, Pattern
Seeker, Speedster, Sharp Eye, Action Hero, Retro Legend, Sports Star, Card Shark, Strategist; Photo Finisher, Buzzer
Beater, Avenger). Season and pass titles plug into `public.titles` later with `kind` `season` / `pass` (refused until
their grant exists). `title_equipped` (title) is recorded on a change.

## Account rewards

- **Sign-up reward**: 1,000 coins, once, reason `signup_reward`, key `signup_reward:<user id>`, through `creditCoins`.
- **Founding Players** (`profiles.founding`, from `accounts.is_founding(created_at)`: 23:59 on 25 January 2027 UK time
  qualifies, 00:00 on 26 January doesn't): the Founding Player badge with their number, its 250 coins and the Founding
  frame (`frame.founding`, how `earned`).

Both are paid by `settleAccountRewards`, called by `syncMyBadges`: right after sign-up (the welcome step) and on any tab
page. They are not paid inside `completeSignUpFn` itself (economy-check proves a new account's wallet starts at 0 there).
The migration backfills every existing account (Joe's #0001 included) under the same keys, so neither path can pay
twice; its counts go to the deploy log (`badges backfill: N accounts; …`).

**They can't be missed, and land before the coin counter is seen.** A sync that fails or is refused clears the
phone's `loading`, so the next tab page tries again (`refreshBadges`), and every tab page draws `BadgeMoment`, whose
`useMyBadges` starts a sync whenever none has answered (and again a minute after the last). The coin counter's read
(`refreshIdentity`) first waits for `rewardsSettled()` (up to 4 s), so a new account's first balance already holds the
1,000. The server's idempotency keys make every retry safe.

## The Daily streak on the account (Joe's decision, 10 Nov 2026)

The server works the streak out from the Daily starts it stores (`public.daily_history`: an `async_attempts` row on a
`daily_puzzle` / `daily_arcade` room), with exactly the phone's rule (`dailyRecord.ts`): a UK day counts once a Daily
of either kind was started; the streak is the run of counted days ending today, or yesterday while today is open.
Without freezes it equals the device rule (badges-check proves it on 2,000 histories). Profile's Daily section, the Play
tab's Daily card, the desktop aside and the Daily screens' streak milestone read it (`useDailyRecord`); the device's own
record shows only until the server answers, and where they differ the server wins. Guests get theirs from their own
auth user; a second device's guest is a different user and stays separate.

**Streak freeze rule**: a missed UK day that has closed is covered by one `streak_freeze` (A1's consumable), used
automatically when the server works out the streak, if it saves a streak (a counted day lies behind the gap) and the
account holds enough freezes for every missed day of that gap; a longer gap breaks the streak and uses none. A covered
day keeps the streak alive but doesn't add to it. Each use is recorded once per day: a consumable line (reason
`streak_freeze_used`, key `streak_freeze:<day>`) and a row in `public.daily_streak_freezes`. Guests hold none; today
(still open) is never frozen. Nobody has freezes until the pass and Plus grant them.

How many players' streaks differ from their phones can't be read from the server: the phone's record never leaves the
device. They match wherever the phone recorded the same starts; they differ for a player who cleared the app's storage
(the server keeps more), who played on another device under the same account (the server counts both), or whose start
reached the server but not the phone's storage (rare).

For B2's evening reminder and the streak badges: `dailyStreakFor(client, userId)` (`streak`, `playedToday`) and
`dailyRecordFor` in `src/lib/duel/dailyStreak.server.ts`.

## Screens

- **Customise → Badges and title**: earned badges toggle onto the card (three at most, in tap order), and one title
  from the 32 (locked ones show which badge unlocks them). Save sends both; the server checks again.
- **The card** (`PlayerCard`): the title under the name and up to three badges bottom right, wherever the card is drawn
  (Profile, Customise; other players' through `getCardBadges`).
- **Profile**: the whole collection by group, earned ones lit (the Founding Player's number), locked ones with how.
- **The badge-earned moment** (`BadgeMoment`): a small toast on the tab pages only (PhoneShell `tabs`, like "Save your
  progress"), so it never covers a round, a reveal or any result, podium, standings or share screen.

Under browser automation (`navigator.webdriver`) the phone calls none of this unless the page sets
`window.__DUELZ_ALLOW_BADGES__`; checks stand in with `setBadgesBackend`.

## Who can write

Nobody through the API: anon, authenticated and the service role have no INSERT, UPDATE or DELETE on `badges`,
`titles`, `player_badges`, `card_badges`, `card_titles` or `daily_streak_freezes`; a player reads only their own rows.
The server writes through `badge_award`, `badge_set_card`, `badge_set_title`, `badge_mark_seen` and
`daily_streak_freeze` (service role only); `badge_public_cards` is readable by any signed-in device.
