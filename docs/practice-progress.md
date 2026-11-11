# Practice progress on accounts (wave 2, train C, session C1a)

Practice stars and bests live on the player (guest or account), decided by the server from graded runs only, the same on
every device. No gameplay, scoring, grading, stamp or timing changed.

## The rules

- **Stars.** One star per game per level for a score of **175 or more** on Easy, Classic or Hard. Expert's 175+ is a
  crown (wave 3.5), never a star. Every run is Classic until wave 3.5, so 92 stars at most for now; the total is out of
  **276** (92 games × 3 levels). A star once earned is kept. The old 120 / 160 / 190 tiers are retired.
- **Bests.** The best graded score per player, game and level. It only rises. "New best" means an earlier best was
  beaten, never on a first run.
- **Level.** `practice_plays.level`. NULL or anything unknown is Classic (`levelOf`). The grade reads it from the dealt
  puzzle's `level` field, which no deal sets yet. Wave 3.5 puts it there.
- **Gems.** Unlocked by the star total and never removed: Amber 10, Rose Quartz 20, Ruby 30, Jade 50, Amethyst 75,
  Aquamarine 100, Sapphire 125, Pearl 150, Obsidian 200, Diamond 250. Gems need an account, because A1's `gem_unlocks`
  keys on `profiles`. A guest's stars unlock their gems when they sign up (the `practice_new_profile_gems` trigger; same
  user id).
- **Never counted:** the intro example, a run the server replay flagged, a grade with no player, and any run graded
  before the fresh start. Each play counts once (`progress_counted_at`).

## The fresh start (Joe's decision, 10 Nov 2026)

- **On the server.** `public.practice_progress_start.fresh_start_at` is set when the migration first runs on the live
  database, which happens on merge to `main`, right before the deploy. Only runs graded after that moment count. Older
  `practice_plays` rows stay as they are; nothing is deleted.
- **On the phone.** The first time a screen reads progress, `clearDeviceProgressOnce()` (`src/lib/practice/deviceFreshStart.ts`)
  removes every `duelz-practice-best:*` key (all prefixes) and `duelz-practice-goals:v1`, then marks
  `duelz-practice-fresh:v1`. Nothing else on the device is touched. From then on, device stars and bests are never read
  or shown. The challenge code still records its ticks on the device, starting again from zero, until C1b replaces it.
- **The note.** Practice shows "Stars and challenges have had a refresh. Everything you earn now is saved to your
  account." once per player, and only to players who existed before the fresh start (`practice_refresh_note_due`; a
  brand-new player has nothing that was refreshed). The server records it as seen (`practice_refresh_notes`), so it
  shows once on any device.

## The offline copy and the footer (Joe, 11 Nov 2026)

- **Display-only copy.** The phone keeps the server's last answer (`src/lib/practice/progressCache.ts`,
  `duelz-practice-view:v1`, under the session's auth id). It is shown only when Practice opens before the server has
  answered, for example offline after a restart, and the next server answer replaces it. It is written only from the
  server's answers (the progress read and a counted run's own `progress`), never sent to the server and never read by
  grading. Another player's copy is never shown. progress-cache-check proves it.
- **Footer.** Accounts see "Stars and bests are saved to your account." Guests see "Save your progress to keep your
  stars on any phone"; "Save your progress" opens the existing save-your-progress sheet.
- **Pack limit.** Practice packs are limited to 100 an hour per network (`IP_PRACTICE_PACK_LIMIT`, 20 until
  11 Nov 2026). At 20, a new phone's first top-up (16 calls) held back its next visit within the hour.

## Storage (`supabase/migrations/20261111101500_practice_progress.sql`)

| Object | What it holds |
| --- | --- |
| `practice_plays.breakdown` (jsonb) | The server's own graded extra for the run, exactly what a room stores in `round_results.extra` for the same answer |
| `practice_plays.level` | `easy` / `classic` / `hard` / `expert`, NULL = Classic |
| `practice_plays.progress_counted_at` | When the play was looked at for progress (once) |
| `practice_progress` | `(user_id, game_id, level)` → `best_score`, `best_play_id`, `best_at`, `star_at`, `star_score` |
| `practice_progress_start` | The fresh start's moment (one row) |
| `practice_refresh_notes` | The note has been seen |
| `practice_record_play(play_id)` | Counts a play; answers `counted`, `reason`, `game`, `level`, `score`, `previous_best`, `best`, `best_set`, `improved`, `star`, `star_earned`, `star_score`, `star_total`, `gems_unlocked` |
| `practice_star_total(user)`, `practice_gems_for(stars)`, `practice_sync_gems(user)`, `practice_mark_refresh_note_seen(user)` | Helpers |

Who can reach it:
- anon and authenticated: nothing at all.
- The service role reads the tables and writes only through the functions.
- Rows key on `auth.users` with ON DELETE CASCADE, so an account's removal takes its progress with it.

## The interface for C1b and C2

- **Stored breakdown.** Read it with `readPracticePlayBreakdown(client, playId)` (`src/lib/data/practiceProgress.server.ts`).
  It has the same shape as `round_results.extra`: standard parts, facts and the arcade reveal's lines. The best's play
  is `practice_progress.best_play_id`.
- **Hook after a count.** A counted run reaches `onCounted(outcome, userId)` in `gradePracticeRun`
  (`src/lib/duel/practice.functions.ts`). C1b can evaluate challenges there, or per play from the stored breakdown.
- **Player's view.** `progressFor(client, userId)` (`src/lib/practice/progress.server.ts`) returns a
  `PracticeProgressView`: `games[type][level] = { best, star, starScore }`, `stars`, `gems`, `noteSeen`, `freshStartAt`.
  The phone reads it through `getMyPracticeProgressFn` and `usePracticeProgress()`.
- **Per-run answer.** The grade's `progress` (`PracticeRunProgress`): `counted`, `level`, `best`, `previousBest`,
  `improved`, `star`, `starEarned`, `starTotal`, `gemsUnlocked`.
- **Lookups.** `bestOf`, `starOf`, `levelStarsOf` and `starCountOf` (`src/lib/practice/progress.ts`), and the rules in
  `progressRules.ts`.
- **Events** (through `src/lib/data/events.server.ts`, no mode): `best_set` and `star_earned` with the game and
  `props.level`; `gem_unlocked` with `props.gem`.

## Checks

practice-progress-check (~15 s, PostgreSQL, no browser) proves:
- the rules;
- the stored breakdown equals a room's for the same answer;
- 175 / 174, Classic only, NULL as Classic;
- the fresh start;
- gems at their thresholds, setAvatar's refusal and the sign-up unlock;
- two sessions of one account read the same, and a second-device guest stays separate;
- offline runs count once graded;
- the note;
- role access and the events;
- the device clear and the wiring.

offline-check (browser, shard `play20`) now runs its production server on the server-function harness's local PostgreSQL
and REST / GoTrue stand-in. Each browser context is its own guest on its own test network address. The check proves:
- a queued, unsynced run never shows as the best, and nothing is counted while runs wait on the phone;
- once the queue uploads, exactly the confirmed runs are graded and counted, never the rejected one;
- the server's Meteor best is the best confirmed run, and Practice shows it.

No workflow change: GitHub's ubuntu runners ship PostgreSQL 16, which the harness finds.
