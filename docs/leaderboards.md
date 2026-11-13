# Leaderboards (wave 4, session W4a, 11 Nov 2026)

Every player can see where they stand, honestly, and privately enough for under-18s. Mockups:
`docs/mockups/wave-4/01-leaderboards`, `02-daily-leaderboard-top-100`, `03-top-500-emblem` (the built look wins).
No gameplay, scoring, stamp, rating or deal change.

## What there is

- **Rating boards** (`/leaderboards`, Profile → Leaderboards): Joulz Rating, Puzzles and Arcade; Global, your country
  (`profiles.country`) and Friends (B1's `friendships`, ranked among themselves); this season or each player's all-time
  peak. Pages of 50 up to the top 500; your own row is pinned below (gold edge) when it isn't in view. The Top 500 shows
  "Top 500 #37" with mockup 03's emblem (`public/art/emblems/top-500.svg`, the 28 px art byte for byte) on this
  season's Joulz Rating board, from W3a's tier (`top500`).
- **Category boards** ("Top Logic players"): the 11 categories' boards, top 5 and your place, in Profile's stats area
  (accounts) and under the rating boards.
- **The Daily top 100** (`/daily-board`, the Daily page's "Top 100", Profile → Daily top 100): Daily Puzzle and Daily
  Arcade, today and every earlier day (arrows to the nearest days with a board), Top 100 or Friends, your place
  pinned ("You came 412th of 2,318 · 694, top 18%"), each row's time and score. Ties go to the faster time; level on
  both shares a place (1, 2, 2, 4), exactly `src/lib/duel/ranking.ts` (proved against `daily.ts` `rankBoard`).
  Today's board opens once you've finished, or at midnight (the Daily's own rule).
  - Counts only: accounts (a profile), each account's one attempt that day (unique per room and player), finished,
    by an account at least 24 hours old when the attempt started, never an attempt with a flagged round
    (`async_results.extra.flagged`). Your own line says why you're not on it ("New accounts count on the board from their
    second day", …).
  - A board is refreshed until 30 minutes after its day closes (so rounds started before midnight finish), then frozen
    (`final`) and kept; it is never recomputed.
- **Privacy** (decided 11 Nov 2026): on global and country boards an under-18 shows as "Hidden player" in their place
  (rank and value unchanged, no name, colour or number) unless they switch "Show me on leaderboards" on; adults show by
  default and can switch it off (Settings → Account → Leaderboards). Friends always see each other, everyone sees their
  own row, an account waiting for deletion is hidden, a deleted one reads "Deleted player". A row carries only rank,
  value, the card's username, colour and player number (and the Daily's time); never a country, age or id.
- **Badges** (C2's `badge_award` through `syncBadges`): Daily Champion (first on a final Daily board of **100+**
  counted players) and Daily Top 100 (top 100 on a final board of **500+**) are earnable (`daily_board_badge_facts`;
  field sizes `DAILY_CHAMPION_FIELD` / `DAILY_TOP100_FIELD` in `src/lib/leaderboards/boards.ts`).

## Players' cards on the boards (Joe's rule, 11 Nov 2026)

A player's card, avatar and frame show wherever they appear:

- **Every board row** (rating, category and Daily boards) draws the player through the shared nameplate
  (`NameplateStrip` in `@/design/identity`, docs/nameplate.md; W4b's and W4c's rows use it too): the card art as a band, the frame round it, the avatar, the name in its name
  colour, W3a's tier emblem (the Top 500's own emblem for the Top 500) and C2's badges. It sits in the name area only;
  places, scores and times stay outside it on the plain row.
- **A tap on a row** opens that player's full card (`NameplateSheet`, A2's `PlayerCard` with title and badges, the place and
  value under it).
- **The top 3** show above the rows as full cards (`BoardPodium`): stacked 1st, 2nd, 3rd on a phone, 1st in the middle
  from 700 px wide; places and scores under each card.
- **One call per page:** the board's own call carries the cards. The SQL gives each visible row its player's id (`pid`)
  and tier for the server alone (`20261115100400_leaderboard_cards.sql`); `leaderboards.server.ts` reads the cards for
  those ids through the shared `nameplatesFor` (the Friends follow-up's `publicCardsFor` and C2's `cardBadgesFor`, 100
  a read), puts each card on its row and removes every id before the page leaves the server.
- **Hidden players** (under-18s by default, opted-out adults, accounts waiting for deletion) stay "Hidden player" with
  no card, no tier and nothing to open, on a plain neutral disc with no initial or colour; a deleted account reads
  "Deleted player". Boards hold accounts only, so no
  guest appears; a row without a card keeps its colour and initial.
- The card's approved art is marked `data-skin-off`, as a game's own art is: its metallic name colours paint the text
  through a gradient, so the page skin's contrast check can't read them; identity-motion-check judges the items against
  their approved pictures.

## How boards refresh

`public.leaderboard_refresh()` runs from two schedules, every 5 minutes each: pg_cron's `leaderboards-refresh` job (the
migration leaves a `migration_log` warning where pg_cron isn't available) and the Worker's Cron Trigger
`leaderboards:refresh` (`*/5 * * * *`, `LEADERBOARD_TASKS` in `vite.config.ts`, `src/lib/leaderboards/tasks/`, as W3a's
`rated:standings`), so the boards refresh with or without pg_cron. Running it twice does no harm: one run at a time
(an advisory lock; a run that finds it taken does nothing), and a run writes the same boards from the same stored data
(leaderboards-check runs the Worker task twice at once and again, and finds every board exactly as after one run).
Boards are never computed per request: a request reads the stored snapshot and applies privacy for the caller.

- Ratings: each run writes a new generation of `leaderboard_rating_rows` (global rank, country rank, display
  position) from `leaderboards.rating_source()`; the newest complete generation is read, the one before is kept for
  reads in flight, older ones are removed.
- Daily: every board not yet final is recomputed into `daily_board_entries`; final boards are left alone.

## W3a's ratings: the binding

The rating boards read W3a's engine (#373) through one function, `leaderboards.rating_source()`, bound to W3a's tables by
`20261115100300_leaderboards_rating_source.sql`:

- **Joulz Rating**: `rated_profiles.joulz` (the stored Joulz Rating, kept current by every match and the hourly
  standings job) and its tier `rated_profiles.shown_tier` (`top500` gives "Top 500 #n" with the board's rank);
- **Puzzles, Arcade and the 11 categories**: `rated_ratings.rating`;
- every value rounded as W3a shows it; level shown ratings share a place, as W3a's standings do;
- **this season** is the current rating (W3a has no seasons yet); **all-time peak** is the highest after any stored
  match (`rated_match_players.changes` for a pool or category that moved, `rated_matches.outcome`'s Joulz `after`), or
  the current one if higher;
- players still in placement are left out (W3a hides their ratings); a guest who plays rated has a rating but no
  username, so is never on a board.

leaderboards-check records matches through W3a's own `recordRatedMatch` and proves the boards equal its stored, rounded
ratings and what `getRatingsFor` answers, and the peak.

## Where it lives

- SQL: `supabase/migrations/20261115100000_leaderboards.sql` (tables, functions, schedule),
  `20261115100100_daily_board_badges.sql` (the two badge rows to earnable), `20261115100200_analytics_leaderboard_events.sql`,
  `20261115100300_leaderboards_rating_source.sql` (the binding to W3a), `20261115100400_leaderboard_cards.sql` (each visible
  row's id and tier, for the server's card read).
  Nothing is readable or writable by anon or authenticated; the server calls the service-role functions.
- Data: `src/lib/data/leaderboards.server.ts`. Rules: `src/lib/leaderboards/boards.ts` (shared),
  `leaderboards.server.ts`, `leaderboards.functions.ts` (`ratingBoardFn`, `dailyBoardFn`, `boardVisibilityFn`,
  `setBoardVisibilityFn`), `leaderboardsApi.ts` (phone).
- Screens: `src/routes/leaderboards.tsx`, `src/routes/daily-board.tsx`, `src/components/leaderboards/`,
  `src/polish-layout/leaderboards.css`.
- Events: `leaderboard_viewed` (board, scope, period; first page only), `daily_board_viewed` (kind, day).
- Cron: `src/lib/leaderboards/tasks/refresh.task.ts`, `refreshTask.server.ts` (`LEADERBOARD_CRONS`).
- Checks: leaderboards-check (PostgreSQL, ~30 s, shard `e`), leaderboards-ui-check (happy-dom, ~2 s); the screens in
  theme-check and no-wrap-check (`LEADERBOARD_SCREENS` in `scripts/theme-screens.ts`, answers from
  `scripts/leaderboards-fixture.ts`).
