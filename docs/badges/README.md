# Badges, titles and the account rewards (wave 2, train C, session C2)

11 Nov 2026. Every player's achievements on their card, the coins every account is owed, and the Daily streak moved
from the phone to the account. Presentation and account data only: no gameplay, scoring, stamp or timing changed, and
nothing here is read by scoring, grading, replay, matchmaking or timing code (economy-neutral-check).

## Files

| Piece | File |
| --- | --- |
| Migration: tables, functions, the reason `streak_freeze_used`, the two events, the backfill | `supabase/migrations/20261111120000_badges_titles.sql` |
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

Each badge has a `status`:

- **earnable**: its rule is in `rules.server.ts` and the server checks it from what is stored. Today only **Founding
  Player** (an account made before 26 January 2027 00:00 UK time; it carries the player number).
- **waits**: needs something not built yet. Shown locked with "Arrives with …"; the database refuses to award it.
  - rated play (wave 3): Storm Chaser, Lightning Strikes, Top 500;
  - mastery stars (C1a): First Star, All-Rounder, the 11 category masters, Grand Master;
  - practice challenges (C1b): Challenger, Challenge Seeker, Challenge Expert, Category Clear, Completionist;
  - tournaments (wave 4): Entrant, Trophy Hunter, Arena Ace, Champion, Arena Champion, Score Attack Champion, Swiss
    Champion, Knockout Champion, Serial Winner.
- **rule_pending**: the approved files give no rule. Shown locked with "How to earn this is announced soon."; can't be
  awarded. First Win, Placed, Hot Streak, Comeback Kid, Clean Sweep, Podium Regular, Unstoppable, Giant Slayer,
  Flawless, Perfectionist, Daily Habit, Dedicated, Daily Top 100, Century, Daily Champion, Revenge, Photo Finish, Buzzer
  Beater, Speed Demon, Friendly, Party Host, Gem Hunter.

### Rules

`docs/art/badges/README.md` says "see the Badge catalogue doc for how each is earned"; that document is not in the
repository, and neither the master plan nor the economy doc has the rules. So every rule but Founding Player's is
waiting for Joe. The art's engraved numbers (Daily Habit 7, Dedicated 30, Century 100, Challenger 10, Challenge Seeker
50, Challenge Expert 100, Perfectionist 25, Serial Winner 10, Flawless 200, Top 500) hint at counts but not at what is
counted, so none was guessed. The mockup (`customise-3-badges-and-title.png`) shows an older list ("200 Club", "All 40
badges"), not these 54.

**To make a badge earnable** once its rule is agreed: a new migration updates its row (`status = 'earnable'`, `rule`),
the same change in `catalogue.ts`, a rule in `BADGE_RULES` reading new `BadgeFacts` (gathered in `badges.server.ts`
`factsFor`, through `src/lib/data/`), and in `badges-check` a test that earns it and one that just misses. Practice
badges count only runs from C1a's fresh start; room, Daily and challenge badges may count what the server already stores.

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
