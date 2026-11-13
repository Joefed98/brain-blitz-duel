# Seasons for ratings (wave 4, session W4d)

11 Nov 2026. One season clock for ratings and the pass, a clean season end, a fair reset and peak-tier rewards. No
gameplay, scoring, stamp, timing or deal change; nothing here is read by scoring, grading, replay or matchmaking
(seasons-check proves it: only W3a's post-match hook, `src/lib/rated/rewards.server.ts`, notes each match).

## One season

D2's `public.pass_seasons` is the only list of seasons; Joe's `pass.*` functions set every date and length
(docs/economy/pass.md). A rated match counts in the season the player is in when it finishes, by D2's rule: a tester
(`shop.testers`) is in the testers' season while it runs, everyone else in the live real season, and between seasons
in none. A test season run again with `pass.start_test_season` is a new run (keyed by its start).

## What is recorded during a season

`public.season_rated_matches`: one row per live player per rated match (`kind 'match'`), with the tier shown after it
(W3a's `TierView.tier`: a cap-held "Storm-rated" player shows Surge, so Surge is what counts) and whether placement was
done; plus a row for each tier the standings job gives (`kind 'standing'`, Top 500 and the caps come only from it),
which counts for the peak but never as a match. Written only by `public.season_note_rated_match` /
`public.season_note_tier`, which `finishRatedMatch` and `runStandingsAndBadges` call (idempotent on the match; a
failure never fails the match and is retried by the next call for it).

What counts towards the 10 (Joe, 11 Nov 2026): every live rated match, **matches against recorded runs included**
(most beta matches will be); the recorded run's owner gets nothing from it. A match with a run the server flagged
(W3a's `frozen: "flagged_run"`, live or recorded) counts for nobody. seasons-check proves both on the real engine.

## The season end (Joe)

```sql
-- End Season 1 now (if still running) and close it: rewards, then the reset. Safe to run again.
SELECT pass.close_season('s1', 'Season 1 over');
-- The same path for the testers' season (ends it if running, rewards the testers who qualified, resets the testers).
SELECT pass.close_test_season('trying the season end');
-- A season's closes at a glance (rewards per tier, the reset).
SELECT pass.season_report('s1');
-- Before launch: take back the tier rewards the testers' season paid (frames, titles; ratings stay reset).
SELECT pass.remove_test_season_tier_rewards('clean-up before launch');
SELECT pass.remove_test_season_tier_rewards('clean-up', 'TheirUsername');
```

Every close is logged in `pass.admin_log` (`close_season`, `close_test_season`). A close is idempotent: rewards are
granted once (`public.season_rewards`, one row per player per season run), and a reset is done once
(`public.season_closes.reset_status`).

### Testing it end to end

1. `SELECT pass.start_test_season('season end test');` (testers only).
2. Testers play rated matches (finish placement, 10+ matches).
3. `SELECT pass.close_test_season('season end test');` — the testers who qualified get the S1 emblem, frame and title
   (marked `test`), the notice shows on their next tab page, and the testers' ratings reset (3 placement matches next).
4. Optionally again: `pass.start_test_season` starts a new run; `pass.remove_test_season_tier_rewards` takes the
   test rewards back.

## Rewards (decided 11 Nov 2026)

Earned by every player who finished placement and played at least 10 rated matches that season, from the peak tier
actually held. Every tier earns: the season emblem (the approved tier emblem with an "S1" mark; Top 500 on the Lightning
shield with a plate until its own emblem is drawn), the Season 1 frame for that tier (`frame.s1-<tier>`, seven earned
catalogue items in `docs/art/wave-4/catalogue.json` after W4c's Championship frame, animated for Storm, Lightning and
Top 500, **placeholder art** from `bun scripts/season-frame-placeholders.ts` in `docs/art/wave-4/placeholders/frame/`
until drawn), the tier's card art (`card-art.tier.<tier>`, A1's seven; Joe, 11 Nov 2026: kept forever, an already-owned
one gives nothing more) and the title "S1 [tier]" (C2's `public.titles`, kind `season`; `badge_set_title`, D2's latest
text plus one rule, equips one only once granted). Frames and card arts go through A1's `economy.add_item`
(`earned`); each reward lists what it actually added (`granted_items`), so `pass.remove_test_season_tier_rewards` takes
back only that (an item the tester owned before stays). The testers' season pays Season 1's set (`public.season_reward_sets`); a later
season with no set records the peak and its emblem's mark only.

The in-app notice (`SeasonNotice`) is drawn only on tab pages (never over a round, reveal, result, podium, standings
or share screen), waits while a badge moment is due, and is marked shown once tapped or after 7 s.

## The reset

At a season's end, for every placed player in scope (everyone, or the testers for the testers' season): Puzzles,
Arcade and the 11 categories each move **a third of the way back towards the average of placed players rated in
it**, and their uncertainty widens a third of the way back to 350 (never narrower; `public.season_reset_rating`, mirrored
by `src/lib/seasons/rules.ts`). Then placement goes back to 2 of 5 (`rated_profiles.placement_played` 2,
`placement_from` 2): the new season starts with **3 placement matches** ("Placement 2 of 3", `placementOf(played,
from)` in `src/lib/rated/match.ts`; `of` is 5 or 3), the Joulz Rating and tier hidden until it is done, when the
engine works the Joulz Rating out again from the reset pools; `public.season_placement_for` and
`placementFor` (`reveal: "small"`) tell W3c's screens to show the smaller reveal. Players still in placement are left
as they are. The reset is W3a's `public.ratings_season_reset`, called by name from `public.season_reset_ratings`, so a
database without it records `waiting_for_ratings` and a later close completes it.

## Profile

`SeasonSection` (Profile, accounts, real data only): the season peak (the season now: the peak tier held so far) and the
season history (each reward with its emblem). W4b's trophy cabinet (`TrophyCabinet`) shows the season emblems beside
the tournament trophies, from the account's own history (`useMySeasons`).

## Files

| Piece | File |
| --- | --- |
| Migration: tables, notes, the reset, Joe's functions, the seven frames and titles, `badge_set_title` | `supabase/migrations/20261115400000_seasons.sql` |
| Migration: the two analytics events (added to the list as it stands) | `supabase/migrations/20261115400100_analytics_season_events.sql` |
| Pure rules (reset maths, placement label, eligibility, rewards) | `src/lib/seasons/rules.ts` |
| Server, server functions, phone store, types | `src/lib/seasons/seasons.server.ts`, `seasons.functions.ts`, `seasonsApi.ts`, `types.ts` |
| Data layer | `src/lib/data/seasons.server.ts` |
| Screens | `src/components/seasons/SeasonSection.tsx`, `SeasonNotice.tsx`, `src/polish-layout/seasons.css` |
| Placeholder frames | `scripts/season-frame-placeholders.ts`, `docs/art/wave-4/placeholders/frame/`; both catalogue files read through `scripts/catalogue-files.ts` |
| Checks | `scripts/seasons-check.ts` (shard `e`, PostgreSQL), `scripts/seasons-screens-check.tsx` (happy-dom) |

## Analytics

Recorded by the database during Joe's close through `economy.note_event` (A1's in-database twin of
`src/lib/data/events.server.ts`: the same RPC and row shape): `season_ended` (season, players_rewarded),
`season_reward_granted` (tier, season). The frame's `item_granted` goes alongside.

## Who can reach what

anon and authenticated: nothing (no grants; RLS on). The server reads the tables and writes only through
`season_note_rated_match`, `season_note_tier` and `season_reward_seen`. Closing a season, granting its rewards and
resetting ratings run only in Joe's `pass` functions; no API role, the service role included, can run them.
