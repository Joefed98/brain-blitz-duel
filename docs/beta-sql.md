# Beta numbers: SQL (27 Oct – 23 Nov 2026)

SQL to measure the four-week public beta (100–300 strangers on the web app, anonymous device
identities, no accounts). Every query is read-only and self-contained: paste one into the Lovable
Cloud / Supabase SQL editor and run it. Nothing here changes a game, sim, score, timing, input, replay,
version stamp or stored row.

Written 16 Oct 2026 against `supabase/migrations/` (32 files, latest `20261016130300`). Updated the same
day for the beta recording (gaps G1–G4, now recorded from the four `2026101613xxxx_beta_*` migrations:
archived rounds and players, practice plays, game and round events, join methods); those tables are
not in `src/integrations/supabase/types.ts` until Lovable regenerates it. Updated again the same day for
the G1 fix-up (`20261016170000_beta_archive_round_records.sql`, not yet applied): archived rounds now
record the time limit they actually used and their version stamps, as `practice_plays` does. Section 5 says how each query
was run; section 6 lists what the data still doesn't record.

**Recording starts when the migrations are applied and the code is published.** Rows from before then
have no archive, events, joins or practice rows; every query falls back to the old inference for them
(marked "fallback" below), so it runs the same on old and new data.

## 1. Where the data lives

All tables are in `public`, written only by server functions in `src/lib/duel/*.functions.ts` (service
role) and the `restart_duel_room` function; clients can only read their own rooms (RLS), and can't read
the six beta tables at all. Rows are deleted in two places only: Play again (below, now archived first),
and a host removing a player in the lobby (`removePlayerFn` deletes that `duel_players` row, not archived).

| Table | One row per | What it records |
|---|---|---|
| `auth.users` (Supabase) | device identity | `id` = the device id; `created_at` = first visit (every page load signs in anonymously, `src/routes/__root.tsx` → `ensureSession()` in `src/lib/duel/session.ts`); `last_sign_in_at`; `is_anonymous`. Needs a role that can read `auth` (the SQL editor's `postgres` role can). |
| `duels` | room (one code, possibly several games through Play again) | `id`, `room_code`, `host_user_id` (the device that created it), `created_at`, `status` (`waiting` / `in_progress` / `finished`), `phase`, `phase_started_at` (start of the current phase only; overwritten), `current_round`, `round_count`, `round_order` (jsonb array of game ids, one per round), `puzzles_public` (jsonb, one puzzle per round, each with `type` and sometimes `timeLimitMs`), `selected_categories`, `tournament_history` (jsonb: one entry per earlier game in the room, `{winner, date, score, round_order, forfeit?, forfeited_by?}`), `disbanded_at`. `next_duel_id` is never written. |
| `duel_players` | device in a room | `duel_id`, `user_id` (device id), `player_slot` (1–10), `display_name`, `status` (`active` / `inactive` / `left`), `joined_at`, `created_at`, `last_seen_at` (heartbeat), `ready_round`, `intro_ready_round`, `muted_by_host`; once `20261017120000_player_colour_icon.sql` is applied, `colour` (0–9, the player colour; NULL = shown from the slot) and `icon` (an icon id or NULL), display only and not archived. |
| `round_results` | answer (device × round) of the room's **current** game | `duel_id`, `player_slot` (→ `duel_players.user_id`), `round_number` (game id = `round_order[round_number - 1]`), `score` (the server's own, 0–1000-ish per round), `is_correct`, `ms_remaining` (time left when answered, after the server's 1.5 s clamp), `submitted_at`, `answer`, `reaction_avg_ms`, `correct_count`, `errors`, `extra` (jsonb; arcade runs carry `flagged`, `diag`, `claimedScore`, `endedSeconds`; tap- and action-log rounds carry `repaired`, `clamped`, `dropped`). |
| `duel_secrets` | room | answers (server-only), and `round_records` (G1 fix-up: per round `{time_limit_ms, revision}`, written by `startRoomFn` at the deal, copied into `round_results_archive` by Play again); not read by the queries. |
| `room_messages`, `room_reports` | chat line / report | `duel_id`, sender / reporter device id, `created_at`. |
| `intro_demos`, `unblock_bank` | — | content, not plays. |
| `round_results_archive` (G1) | answer of an **earlier** game in a room | every `round_results` column (`id` is the original row's) plus `game_index` (the room's Play again count before that game: 0 = its first game, = the index of its `tournament_history` entry), `game_id`, `time_limit_ms` (the limit the round actually used: its own `timeLimitMs`, else its game's default, by the same rule as `practice_plays.time_limit_ms`), `revision` (the round puzzle's numeric version stamps, as `practice_plays.revision`), `user_id` (the slot's device), `archived_at`. Written by `restart_duel_room` just before it deletes `round_results`. Rows archived before the fix-up migration `20261016170000` (the first 12), and games dealt before its code shipped, have `time_limit_ms` only when the puzzle had its own limit (else null) and `revision` null; use `coalesce(time_limit_ms, <game default>)` as Q4 does. |
| `duel_players_archive` (G1) | device that **left** before a Play again | every `duel_players` column but `last_reaction_at`, plus `game_index` and `archived_at`. Written by `restart_duel_room` just before it deletes the `left` players. |
| `room_events` (G3) | game or round moment | `duel_id`, `game_index`, `round_number` (0 for game events), `event`, `reason`, `at`. `game_started` (the host's start claimed the room, `startRoomFn`); `round_started` (the round's clock started: intro → puzzle); `round_ended` with `all_answered` (every active player had answered) or `timer` (the clock ran out first); `game_ended` with `completed` (the winner reveal, or the last standings in older rooms), `finish_now`, `host_left` or `disbanded` (only for a game in progress). One row per (room, game, round, event). |
| `room_joins` (G4) | arrival of a device in a room's game | `duel_id`, `user_id`, `player_slot`, `game_index`, `via` (`host` = created it, `code` = home screen's code boxes, `link` = the room link's join card, `play_again` = still in the room when the host pressed Play again; null = a phone on a build from before this), `rejoin` (came back after leaving, in the lobby), `joined_at`. A device's first row in a room is how it got in. |
| `practice_plays` (G2) | graded practice play | `user_id` (the device; null if the call had no session), `game_id`, `revision` (the puzzle's numeric version stamps, e.g. `{"brkRev": 6}`), `score`, `is_correct`, `timed_out` (the phone's clock had run out), `duration_ms` (the arcade run's stored length, else the time used against the clock), `time_limit_ms`, `ms_remaining`, `example` (the fixed intro example), `flagged`, `created_at`. Written by `practiceGradeFn` after grading; outcome only, never the answer. |

How each item you asked about is (or isn't) recorded:

| Item | Where | Notes |
|---|---|---|
| device id | `duel_players.user_id`, `duels.host_user_id`, `auth.users.id` | anonymous Supabase user; a new browser, private window, cleared site data or the iOS home-screen app (separate storage from Safari) is a new device. |
| room id | `duels.id` (`room_code` is the shared code) | one room can hold several games (Play again keeps the code). |
| game id | `duels.round_order ->> (round_number - 1)` (= `puzzles_public -> (round_number - 1) ->> 'type'`) | display names: `src/lib/duel/gameNames.ts` (inlined in Q4). |
| timestamps | `duels.created_at`, `duel_players.joined_at`, `round_results.submitted_at`, `tournament_history[].date`, `auth.users.created_at`, `room_events.at`, `room_joins.joined_at`, `practice_plays.created_at` | game and round starts and ends from `room_events` (G3); older rooms fall back to the inference in section 2. |
| score | `round_results.score` | server-graded (rule 7). |
| timed out | not stored as such: `ms_remaining = 0` | the phone submits its draft with `msRemaining: 0` when the clock runs out (`src/routes/duel.$code.tsx`). Flash and Bang On always store 0 (fixed-length rounds), so they get no timeout rate. Arcade-clock games: 0 = the run lasted to the buzzer. A phone that never answered has no row at all. |
| finished early | `room_events` `round_ended.reason` (G3): `all_answered` vs `timer` | fallback for rounds without an event: early = every player who answered anything in the game answered this round with time left (Q4). |
| practice vs room | `practice_plays` (G2) for practice, the room tables for rooms | practice before the migration isn't recorded. |
| how a device joined | `room_joins.via` (G4) | host / code / link / Play again; null for older phones and for rooms before the migration. |
| anti-cheat flags | `round_results.extra ->> 'flagged'` (arcade-engine rounds) | true when the server replay rejected inputs, the client's claimed score mismatched, or a checkpoint desynced (`src/lib/duel/arcadeRun.ts`). A desync can also be honest lag, so Q6 shows how many there are. The 1.5 s time-claim clamp is only logged to the console, not stored. |

**Play again archives, then deletes.** `restart_duel_room` (redefined in `20261016130300_beta_play_again_archive.sql`)
copies the room's `round_results` into `round_results_archive` and its `left` players into
`duel_players_archive` (tagged with the game index), then, as before, deletes the room's `round_results`,
`duel_secrets` and `left` players, resets `round_order` / `puzzles_public`, appends one
`tournament_history` entry (winner name, date, winner's score, round order) and records everyone still
there in `room_joins` as joining the next game by `play_again`. A room's games are `game_index` 0, 1, 2…:
earlier ones in the archive (and `tournament_history[game_index]`), the current one in `round_results`
(`game_index = jsonb_array_length(tournament_history)`). Rooms that pressed Play again before the
migration still lost those earlier games' rounds.

**Archived limits and stamps (fix-up, migration `20261016170000_beta_archive_round_records.sql`).**
The first version copied `time_limit_ms` only when the puzzle had its own `timeLimitMs`, so normal rounds
archived null while `practice_plays` stored the limit actually used (e.g. 63,000). Now `startRoomFn`
stores each dealt round's effective limit (`registry.puzzleTimeLimitMs`: the puzzle's own limit, else its
game's default; the same call `practiceGradeFn` and the room's grading use) and its version stamps
(`revisionStamps` on the full puzzle, as practice) in `duel_secrets.round_records`, best-effort, and
`restart_duel_room` copies them into `round_results_archive.time_limit_ms` and the new `revision`
column. The limit is fixed by the stored puzzle, so storing it at the deal equals storing it when the
round starts. Room rows and practice rows for the same game and revision now compare directly
(`GROUP BY game_id, revision`). The 12 rows archived before this are not backfilled (rule 4): their
`time_limit_ms` is null unless the puzzle had its own limit, and `revision` is null; games dealt before
the code ships (or while the migration isn't applied) archive the same way. Nothing here changes play,
scoring, timing or the stamps.

## 2. Assumptions

- Days and weeks are UTC (`date_trunc('week', …)` weeks start on Monday). The beta window defaults to
  27 Oct 00:00 – 24 Nov 00:00 UTC (four weeks); change it in the filter block.
- A device "played a room" when it has a `duel_players` row, or a `duel_players_archive` row (it left
  before a Play again), in a room that started (has a round order now or a Play again in its history).
  Its time is `joined_at`.
- A room is **started** when it has dealt rounds now or in its history. A game is **completed** when it
  reached the winner reveal (`phase = 'winner_reveal'`, or older rooms ending on the last round's
  standings); **finished by Finish now** when it ended `finished` with no disband (the last player
  ended it); **abandoned** when the host left or disbanded before the end. Every `tournament_history`
  entry is a finished game (Play again only works from a finished, undisbanded room), counted as
  completed unless it says `forfeit`.
- A game's start and end are its `room_events` `game_started` / `game_ended` rows. Fallback for games
  without them: the current game starts at its first answer's `submitted_at` (else `created_at`); earlier
  games use their history `date` (the Play again tap, just after it ended).
- A round "ended early" when its `room_events` `round_ended` reason is `all_answered` (everyone the room
  was waiting for had answered) and "on the timer" when it is `timer`. Fallback for rounds without one:
  the inference in Q4.
- "Returning device" in Q3: the device had played a room on an earlier UTC day. "7-day return" in Q2: played
  another room 1–7 UTC days after the day of its first room (a second room the same day doesn't count; a
  Play again in the same room isn't another room).
- **Exclusions.** Rooms with any of Joe's devices in them (now or archived), rooms on the test-code list, and rooms outside
  the window are dropped everywhere. Suspected cheating: rounds with `extra.flagged = true` are dropped from
  score statistics (Q4 says how many); to also drop tap- and action-log rounds whose logs were repaired,
  uncomment the marked line in Q4.

### The filter block

Every query starts with this block, between `>>> FILL IN` and `<<< END FILL IN`. Fill it in the same way
in each query you run (use Q0 to find your device ids). The placeholder rows match nothing.

```sql
-- >>> FILL IN (same in every query)
params AS (SELECT timestamptz '2026-10-27 00:00+00' AS beta_start,
                  timestamptz '2026-11-24 00:00+00' AS beta_end),
my_devices(user_id) AS (VALUES                           -- Joe's own devices (duel_players.user_id)
  ('00000000-0000-0000-0000-000000000000'::uuid)),
test_rooms(room_code) AS (VALUES                         -- test rooms (duels.room_code)
  ('XXXXXX')),
-- <<< END FILL IN
```

## 3. Queries

### Q0. Find your own devices

Every device with its names, room count and first and last room, newest first; spot yours by name, by a
room code you know, or by the times you played.
Returns: `user_id, names, rooms, hosted, first_joined, last_joined, room_codes`.

```sql
SELECT p.user_id,
       array_agg(DISTINCT p.display_name)                       AS names,
       count(DISTINCT p.duel_id)                                AS rooms,
       count(DISTINCT d.id) FILTER (WHERE d.host_user_id = p.user_id) AS hosted,
       min(p.joined_at)                                         AS first_joined,
       max(p.joined_at)                                         AS last_joined,
       (array_agg(DISTINCT d.room_code))[1:10]                  AS room_codes
FROM public.duel_players p
JOIN public.duels d ON d.id = p.duel_id
GROUP BY p.user_id
ORDER BY last_joined DESC;
```

### Q1a. Rooms created, started and finished per day

Per UTC day: rooms created; games started and finished (a room's Play again games each count); how the
finished ones ended; and games started but still unfinished. Start and end times and the outcome come
from `room_events` (G3) when the game has them, else the fallback in section 2. "Abandoned" = the host
left or disbanded mid-game.
Returns: `day, rooms_created, games_started, games_completed, games_finish_now, games_abandoned, games_unfinished`.

```sql
WITH
-- >>> FILL IN (same in every query)
params AS (SELECT timestamptz '2026-10-27 00:00+00' AS beta_start,
                  timestamptz '2026-11-24 00:00+00' AS beta_end),
my_devices(user_id) AS (VALUES                           -- Joe's own devices (duel_players.user_id)
  ('00000000-0000-0000-0000-000000000000'::uuid)),
test_rooms(room_code) AS (VALUES                         -- test rooms (duels.room_code)
  ('XXXXXX')),
-- <<< END FILL IN
clean_rooms AS (
  SELECT d.* FROM public.duels d
  WHERE d.room_code NOT IN (SELECT room_code FROM test_rooms)
    AND (d.host_user_id IS NULL OR d.host_user_id NOT IN (SELECT user_id FROM my_devices))
    AND NOT EXISTS (SELECT 1 FROM public.duel_players dp
                    WHERE dp.duel_id = d.id AND dp.user_id IN (SELECT user_id FROM my_devices))
    AND NOT EXISTS (SELECT 1 FROM public.duel_players_archive da
                    WHERE da.duel_id = d.id AND da.user_id IN (SELECT user_id FROM my_devices))),
beta_rooms AS (
  SELECT d.* FROM clean_rooms d, params
  WHERE d.created_at >= params.beta_start AND d.created_at < params.beta_end),
game_events AS (          -- G3: one game_started / game_ended per room and game
  SELECT duel_id, game_index,
         min(at) FILTER (WHERE event = 'game_started') AS started_at,
         min(at) FILTER (WHERE event = 'game_ended')   AS ended_at,
         min(reason) FILTER (WHERE event = 'game_ended') AS end_reason
  FROM public.room_events WHERE round_number = 0
  GROUP BY duel_id, game_index),
games AS (
  -- earlier games in the room (one per Play again; game_index = position in the history)
  SELECT d.id AS room_id,
         coalesce(ge.started_at, (h.e ->> 'date')::timestamptz) AS started_at,
         coalesce(ge.ended_at, (h.e ->> 'date')::timestamptz) AS ended_at,
         CASE WHEN (h.e ->> 'forfeit')::boolean THEN 'finish_now' ELSE 'completed' END AS outcome
  FROM beta_rooms d CROSS JOIN LATERAL jsonb_array_elements(d.tournament_history) WITH ORDINALITY AS h(e, n)
  LEFT JOIN game_events ge ON ge.duel_id = d.id AND ge.game_index = h.n - 1
  UNION ALL
  -- the room's current game, if it has been dealt
  SELECT d.id,
         coalesce(ge.started_at,
                  (SELECT min(r.submitted_at) FROM public.round_results r WHERE r.duel_id = d.id), d.created_at),
         coalesce(ge.ended_at,
                  CASE WHEN d.status = 'finished'
                       THEN coalesce(CASE WHEN d.phase = 'winner_reveal' THEN d.phase_started_at END,
                                     d.disbanded_at,
                                     (SELECT max(r.submitted_at) FROM public.round_results r WHERE r.duel_id = d.id),
                                     d.phase_started_at) END),
         CASE WHEN ge.end_reason IN ('completed', 'finish_now') THEN ge.end_reason
              WHEN ge.end_reason IN ('host_left', 'disbanded') THEN 'abandoned'
              -- fallback: games without a game_ended event
              WHEN d.status = 'finished'
                   AND (d.phase = 'winner_reveal' OR (d.phase = 'standings' AND d.current_round >= d.round_count))
                THEN 'completed'
              WHEN d.status = 'finished' AND d.disbanded_at IS NULL THEN 'finish_now'
              WHEN d.status = 'finished' THEN 'abandoned'
              ELSE 'unfinished' END
  FROM beta_rooms d
  LEFT JOIN game_events ge ON ge.duel_id = d.id AND ge.game_index = jsonb_array_length(d.tournament_history)
  WHERE jsonb_array_length(d.round_order) > 0),
days AS (
  SELECT created_at::date AS day, 'created' AS what FROM beta_rooms
  UNION ALL SELECT started_at::date, 'started' FROM games
  UNION ALL SELECT coalesce(ended_at, started_at)::date, outcome FROM games)
SELECT day,
       count(*) FILTER (WHERE what = 'created')    AS rooms_created,
       count(*) FILTER (WHERE what = 'started')    AS games_started,
       count(*) FILTER (WHERE what = 'completed')  AS games_completed,
       count(*) FILTER (WHERE what = 'finish_now') AS games_finish_now,
       count(*) FILTER (WHERE what = 'abandoned')  AS games_abandoned,
       count(*) FILTER (WHERE what = 'unfinished') AS games_unfinished
FROM days
GROUP BY day
ORDER BY day;
```

### Q1b. Average players and rounds per room

Over started rooms, by week of creation: devices per room (including devices that left before a Play
again, from `duel_players_archive`; rooms that pressed Play again before the migration still undercount),
games per room, rounds dealt per room across all its games, and rounds that got at least one answer across
all its games (archived games included).
Returns: `week, started_rooms, avg_players, max_players, avg_games_per_room, avg_rounds_dealt, avg_rounds_answered`.

```sql
WITH
-- >>> FILL IN (same in every query)
params AS (SELECT timestamptz '2026-10-27 00:00+00' AS beta_start,
                  timestamptz '2026-11-24 00:00+00' AS beta_end),
my_devices(user_id) AS (VALUES                           -- Joe's own devices (duel_players.user_id)
  ('00000000-0000-0000-0000-000000000000'::uuid)),
test_rooms(room_code) AS (VALUES                         -- test rooms (duels.room_code)
  ('XXXXXX')),
-- <<< END FILL IN
clean_rooms AS (
  SELECT d.* FROM public.duels d
  WHERE d.room_code NOT IN (SELECT room_code FROM test_rooms)
    AND (d.host_user_id IS NULL OR d.host_user_id NOT IN (SELECT user_id FROM my_devices))
    AND NOT EXISTS (SELECT 1 FROM public.duel_players dp
                    WHERE dp.duel_id = d.id AND dp.user_id IN (SELECT user_id FROM my_devices))
    AND NOT EXISTS (SELECT 1 FROM public.duel_players_archive da
                    WHERE da.duel_id = d.id AND da.user_id IN (SELECT user_id FROM my_devices))),
beta_rooms AS (
  SELECT d.* FROM clean_rooms d, params
  WHERE d.created_at >= params.beta_start AND d.created_at < params.beta_end),
started AS (
  SELECT d.*,
         jsonb_array_length(d.tournament_history)
           + CASE WHEN jsonb_array_length(d.round_order) > 0 THEN 1 ELSE 0 END AS games,
         coalesce((SELECT sum(jsonb_array_length(h.e -> 'round_order'))
                   FROM jsonb_array_elements(d.tournament_history) AS h(e)), 0)
           + jsonb_array_length(d.round_order) AS rounds_dealt
  FROM beta_rooms d
  WHERE jsonb_array_length(d.round_order) > 0 OR jsonb_array_length(d.tournament_history) > 0),
per_room AS (
  SELECT s.id, date_trunc('week', s.created_at)::date AS week, s.games, s.rounds_dealt,
         (SELECT count(DISTINCT u.user_id) FROM (
            SELECT p.user_id FROM public.duel_players p WHERE p.duel_id = s.id
            UNION SELECT a.user_id FROM public.duel_players_archive a WHERE a.duel_id = s.id) u) AS players,
         (SELECT count(DISTINCT r.round_number) FROM public.round_results r WHERE r.duel_id = s.id)
           + (SELECT count(*) FROM (SELECT DISTINCT a.game_index, a.round_number
                                    FROM public.round_results_archive a WHERE a.duel_id = s.id) x) AS rounds_answered
  FROM started s)
SELECT week,
       count(*)                                   AS started_rooms,
       round(avg(players), 2)                     AS avg_players,
       max(players)                               AS max_players,
       round(avg(games), 2)                       AS avg_games_per_room,
       round(avg(rounds_dealt), 2)                AS avg_rounds_dealt,
       round(avg(rounds_answered), 2)             AS avg_rounds_answered
FROM per_room
GROUP BY ROLLUP (week)
ORDER BY week NULLS LAST;
```

The last row (`week` empty) is the whole beta.

### Q1c. "Play again" usage

By week of creation: rooms whose first game finished, how many of them pressed Play again at least once,
the share, the total presses, and the most in one room. (Each `tournament_history` entry is one press.)
Returns: `week, rooms_with_a_finished_game, rooms_played_again, play_again_rate, play_again_presses, most_in_one_room`.

```sql
WITH
-- >>> FILL IN (same in every query)
params AS (SELECT timestamptz '2026-10-27 00:00+00' AS beta_start,
                  timestamptz '2026-11-24 00:00+00' AS beta_end),
my_devices(user_id) AS (VALUES                           -- Joe's own devices (duel_players.user_id)
  ('00000000-0000-0000-0000-000000000000'::uuid)),
test_rooms(room_code) AS (VALUES                         -- test rooms (duels.room_code)
  ('XXXXXX')),
-- <<< END FILL IN
clean_rooms AS (
  SELECT d.* FROM public.duels d
  WHERE d.room_code NOT IN (SELECT room_code FROM test_rooms)
    AND (d.host_user_id IS NULL OR d.host_user_id NOT IN (SELECT user_id FROM my_devices))
    AND NOT EXISTS (SELECT 1 FROM public.duel_players dp
                    WHERE dp.duel_id = d.id AND dp.user_id IN (SELECT user_id FROM my_devices))
    AND NOT EXISTS (SELECT 1 FROM public.duel_players_archive da
                    WHERE da.duel_id = d.id AND da.user_id IN (SELECT user_id FROM my_devices))),
beta_rooms AS (
  SELECT d.* FROM clean_rooms d, params
  WHERE d.created_at >= params.beta_start AND d.created_at < params.beta_end),
finished_once AS (
  SELECT d.created_at, jsonb_array_length(d.tournament_history) AS presses
  FROM beta_rooms d
  WHERE jsonb_array_length(d.tournament_history) > 0
     OR (d.status = 'finished' AND jsonb_array_length(d.round_order) > 0))
SELECT date_trunc('week', created_at)::date                  AS week,
       count(*)                                              AS rooms_with_a_finished_game,
       count(*) FILTER (WHERE presses > 0)                   AS rooms_played_again,
       round(count(*) FILTER (WHERE presses > 0)::numeric / nullif(count(*), 0), 3) AS play_again_rate,
       sum(presses)                                          AS play_again_presses,
       max(presses)                                          AS most_in_one_room
FROM finished_once
GROUP BY ROLLUP (date_trunc('week', created_at)::date)
ORDER BY week NULLS LAST;
```

Finished games include ones ended by Finish now or a host who left after the end; to count only rooms
that reached the winner reveal, add `AND d.phase = 'winner_reveal'` to the second condition.

### Q2. 7-day return by weekly cohort

Devices whose first room ever (not just in the beta) was played in a given week, and the share that played
a different room 1–7 days after that first day. `window_complete` is false while some of the cohort's
seven days are still to come, so its rate can still rise. Returns after the beta's end still count.
Returns: `cohort_week, new_devices, returned_d1_7, return_rate, window_complete`.

```sql
WITH
-- >>> FILL IN (same in every query)
params AS (SELECT timestamptz '2026-10-27 00:00+00' AS beta_start,
                  timestamptz '2026-11-24 00:00+00' AS beta_end),
my_devices(user_id) AS (VALUES                           -- Joe's own devices (duel_players.user_id)
  ('00000000-0000-0000-0000-000000000000'::uuid)),
test_rooms(room_code) AS (VALUES                         -- test rooms (duels.room_code)
  ('XXXXXX')),
-- <<< END FILL IN
clean_rooms AS (
  SELECT d.* FROM public.duels d
  WHERE d.room_code NOT IN (SELECT room_code FROM test_rooms)
    AND (d.host_user_id IS NULL OR d.host_user_id NOT IN (SELECT user_id FROM my_devices))
    AND NOT EXISTS (SELECT 1 FROM public.duel_players dp
                    WHERE dp.duel_id = d.id AND dp.user_id IN (SELECT user_id FROM my_devices))
    AND NOT EXISTS (SELECT 1 FROM public.duel_players_archive da
                    WHERE da.duel_id = d.id AND da.user_id IN (SELECT user_id FROM my_devices))),
played AS (               -- every (device, started room), all time; archived = left before a Play again
  SELECT p.user_id, p.duel_id, p.joined_at
  FROM (SELECT user_id, duel_id, joined_at FROM public.duel_players
        UNION ALL SELECT user_id, duel_id, joined_at FROM public.duel_players_archive) p
  JOIN clean_rooms d ON d.id = p.duel_id
  WHERE jsonb_array_length(d.round_order) > 0 OR jsonb_array_length(d.tournament_history) > 0),
firsts AS (
  SELECT DISTINCT ON (user_id) user_id, duel_id AS first_room, joined_at AS first_at
  FROM played ORDER BY user_id, joined_at, duel_id),
cohort AS (
  SELECT f.*,
         EXISTS (SELECT 1 FROM played q
                 WHERE q.user_id = f.user_id AND q.duel_id <> f.first_room
                   AND q.joined_at::date - f.first_at::date BETWEEN 1 AND 7) AS returned
  FROM firsts f, params
  WHERE f.first_at >= params.beta_start AND f.first_at < params.beta_end)
SELECT date_trunc('week', first_at)::date                                AS cohort_week,
       count(*)                                                          AS new_devices,
       count(*) FILTER (WHERE returned)                                  AS returned_d1_7,
       round(count(*) FILTER (WHERE returned)::numeric / nullif(count(*), 0), 3) AS return_rate,
       bool_and(first_at::date + 7 < current_date)                       AS window_complete
FROM cohort
GROUP BY 1
ORDER BY 1;
```

### Q3a. Rooms created by returning devices (no invite)

By week: rooms created; of those, created by a device in its first room ever, or by a returning device
(it had played a room on an earlier day, so it came back and started one itself rather than following an
invite); and returning creators who had only ever joined other people's rooms before.
Returns: `week, rooms_created, by_first_timers, by_returning, returning_share, by_returning_who_had_only_joined`.

```sql
WITH
-- >>> FILL IN (same in every query)
params AS (SELECT timestamptz '2026-10-27 00:00+00' AS beta_start,
                  timestamptz '2026-11-24 00:00+00' AS beta_end),
my_devices(user_id) AS (VALUES                           -- Joe's own devices (duel_players.user_id)
  ('00000000-0000-0000-0000-000000000000'::uuid)),
test_rooms(room_code) AS (VALUES                         -- test rooms (duels.room_code)
  ('XXXXXX')),
-- <<< END FILL IN
clean_rooms AS (
  SELECT d.* FROM public.duels d
  WHERE d.room_code NOT IN (SELECT room_code FROM test_rooms)
    AND (d.host_user_id IS NULL OR d.host_user_id NOT IN (SELECT user_id FROM my_devices))
    AND NOT EXISTS (SELECT 1 FROM public.duel_players dp
                    WHERE dp.duel_id = d.id AND dp.user_id IN (SELECT user_id FROM my_devices))
    AND NOT EXISTS (SELECT 1 FROM public.duel_players_archive da
                    WHERE da.duel_id = d.id AND da.user_id IN (SELECT user_id FROM my_devices))),
beta_rooms AS (
  SELECT d.* FROM clean_rooms d, params
  WHERE d.created_at >= params.beta_start AND d.created_at < params.beta_end),
played AS (               -- archived = left before a Play again
  SELECT p.user_id, p.duel_id, p.joined_at, d.host_user_id
  FROM (SELECT user_id, duel_id, joined_at FROM public.duel_players
        UNION ALL SELECT user_id, duel_id, joined_at FROM public.duel_players_archive) p
  JOIN clean_rooms d ON d.id = p.duel_id
  WHERE jsonb_array_length(d.round_order) > 0 OR jsonb_array_length(d.tournament_history) > 0),
created AS (
  SELECT d.id, d.created_at,
         EXISTS (SELECT 1 FROM played q
                 WHERE q.user_id = d.host_user_id AND q.duel_id <> d.id
                   AND q.joined_at::date < d.created_at::date) AS is_returning,
         NOT EXISTS (SELECT 1 FROM played q
                     WHERE q.user_id = d.host_user_id AND q.duel_id <> d.id
                       AND q.joined_at < d.created_at) AS first_timer,
         NOT EXISTS (SELECT 1 FROM played q
                     WHERE q.user_id = d.host_user_id AND q.host_user_id = d.host_user_id
                       AND q.duel_id <> d.id AND q.joined_at < d.created_at) AS never_hosted_before
  FROM beta_rooms d)
SELECT date_trunc('week', created_at)::date                         AS week,
       count(*)                                                     AS rooms_created,
       count(*) FILTER (WHERE first_timer)                          AS by_first_timers,
       count(*) FILTER (WHERE is_returning)                         AS by_returning,
       round(count(*) FILTER (WHERE is_returning)::numeric / nullif(count(*), 0), 3) AS returning_share,
       count(*) FILTER (WHERE is_returning AND never_hosted_before) AS by_returning_who_had_only_joined
FROM created
GROUP BY ROLLUP (date_trunc('week', created_at)::date)
ORDER BY week NULLS LAST;
```

Rooms that are neither (a device's second room on the same day as its first) make up the difference.
Every room here was created, never joined: creating is the only way to host. How its guests got in
(code or link) is in Q3b and Q3c.

### Q3b. Room codes shared to new devices

By week of the new device's first room: new devices, how many arrived in someone else's room (the code or
link reached them), split by how they joined that first room (`room_joins.via`, G4: typed code or room
link; "unrecorded" = before the migration or an older phone), how many started by hosting their own, and
how many distinct hosts brought someone new in. `new_per_inviting_host` is a rough spread factor.
Returns: `week, new_devices, arrived_by_invite, arrived_by_code, arrived_by_link, arrived_unrecorded,
arrived_as_host, invite_share, inviting_hosts, new_per_inviting_host`.

```sql
WITH
-- >>> FILL IN (same in every query)
params AS (SELECT timestamptz '2026-10-27 00:00+00' AS beta_start,
                  timestamptz '2026-11-24 00:00+00' AS beta_end),
my_devices(user_id) AS (VALUES                           -- Joe's own devices (duel_players.user_id)
  ('00000000-0000-0000-0000-000000000000'::uuid)),
test_rooms(room_code) AS (VALUES                         -- test rooms (duels.room_code)
  ('XXXXXX')),
-- <<< END FILL IN
clean_rooms AS (
  SELECT d.* FROM public.duels d
  WHERE d.room_code NOT IN (SELECT room_code FROM test_rooms)
    AND (d.host_user_id IS NULL OR d.host_user_id NOT IN (SELECT user_id FROM my_devices))
    AND NOT EXISTS (SELECT 1 FROM public.duel_players dp
                    WHERE dp.duel_id = d.id AND dp.user_id IN (SELECT user_id FROM my_devices))
    AND NOT EXISTS (SELECT 1 FROM public.duel_players_archive da
                    WHERE da.duel_id = d.id AND da.user_id IN (SELECT user_id FROM my_devices))),
played AS (               -- archived = left before a Play again
  SELECT p.user_id, p.duel_id, p.joined_at, d.host_user_id
  FROM (SELECT user_id, duel_id, joined_at FROM public.duel_players
        UNION ALL SELECT user_id, duel_id, joined_at FROM public.duel_players_archive) p
  JOIN clean_rooms d ON d.id = p.duel_id
  WHERE jsonb_array_length(d.round_order) > 0 OR jsonb_array_length(d.tournament_history) > 0),
firsts AS (
  SELECT DISTINCT ON (user_id) user_id, duel_id, joined_at, host_user_id
  FROM played ORDER BY user_id, joined_at, duel_id),
new_devices AS (
  SELECT f.*, f.host_user_id IS DISTINCT FROM f.user_id AS invited,
         (SELECT j.via FROM public.room_joins j            -- G4: how it got into that first room
          WHERE j.duel_id = f.duel_id AND j.user_id = f.user_id
          ORDER BY j.joined_at, j.id LIMIT 1) AS via
  FROM firsts f, params
  WHERE f.joined_at >= params.beta_start AND f.joined_at < params.beta_end)
SELECT date_trunc('week', joined_at)::date                        AS week,
       count(*)                                                   AS new_devices,
       count(*) FILTER (WHERE invited)                            AS arrived_by_invite,
       count(*) FILTER (WHERE invited AND via = 'code')           AS arrived_by_code,
       count(*) FILTER (WHERE invited AND via = 'link')           AS arrived_by_link,
       count(*) FILTER (WHERE invited AND via IS DISTINCT FROM 'code' AND via IS DISTINCT FROM 'link') AS arrived_unrecorded,
       count(*) FILTER (WHERE NOT invited)                        AS arrived_as_host,
       round(count(*) FILTER (WHERE invited)::numeric / nullif(count(*), 0), 3) AS invite_share,
       count(DISTINCT host_user_id) FILTER (WHERE invited)        AS inviting_hosts,
       round(count(*) FILTER (WHERE invited)::numeric
             / nullif(count(DISTINCT host_user_id) FILTER (WHERE invited), 0), 2) AS new_per_inviting_host
FROM new_devices
GROUP BY ROLLUP (date_trunc('week', joined_at)::date)
ORDER BY week NULLS LAST;
```

### Q3c. Joins by code vs link

By week: every arrival in a beta room by how it happened (`room_joins`, G4), new or returning device.
`host` = created the room; `code` = typed (or pasted) the code on the home screen; `link` = opened the
room link; `play_again` = carried into the room's next game; `unrecorded` = a phone on a build from before
the recording (rooms from before the migration have no rows at all). `rejoins` counts devices that came
back after leaving, in the lobby (also counted under their method).
Returns: `week, arrivals, host, by_code, by_link, play_again, unrecorded, rejoins, devices_by_code, devices_by_link, link_share_of_invites`.

```sql
WITH
-- >>> FILL IN (same in every query)
params AS (SELECT timestamptz '2026-10-27 00:00+00' AS beta_start,
                  timestamptz '2026-11-24 00:00+00' AS beta_end),
my_devices(user_id) AS (VALUES                           -- Joe's own devices (duel_players.user_id)
  ('00000000-0000-0000-0000-000000000000'::uuid)),
test_rooms(room_code) AS (VALUES                         -- test rooms (duels.room_code)
  ('XXXXXX')),
-- <<< END FILL IN
clean_rooms AS (
  SELECT d.* FROM public.duels d
  WHERE d.room_code NOT IN (SELECT room_code FROM test_rooms)
    AND (d.host_user_id IS NULL OR d.host_user_id NOT IN (SELECT user_id FROM my_devices))
    AND NOT EXISTS (SELECT 1 FROM public.duel_players dp
                    WHERE dp.duel_id = d.id AND dp.user_id IN (SELECT user_id FROM my_devices))
    AND NOT EXISTS (SELECT 1 FROM public.duel_players_archive da
                    WHERE da.duel_id = d.id AND da.user_id IN (SELECT user_id FROM my_devices))),
beta_rooms AS (
  SELECT d.* FROM clean_rooms d, params
  WHERE d.created_at >= params.beta_start AND d.created_at < params.beta_end),
joins AS (
  SELECT j.* FROM public.room_joins j JOIN beta_rooms d ON d.id = j.duel_id)
SELECT date_trunc('week', joined_at)::date                              AS week,
       count(*)                                                         AS arrivals,
       count(*) FILTER (WHERE via = 'host')                             AS host,
       count(*) FILTER (WHERE via = 'code')                             AS by_code,
       count(*) FILTER (WHERE via = 'link')                             AS by_link,
       count(*) FILTER (WHERE via = 'play_again')                       AS play_again,
       count(*) FILTER (WHERE via IS NULL)                              AS unrecorded,
       count(*) FILTER (WHERE rejoin)                                   AS rejoins,
       count(DISTINCT user_id) FILTER (WHERE via = 'code')              AS devices_by_code,
       count(DISTINCT user_id) FILTER (WHERE via = 'link')              AS devices_by_link,
       round(count(*) FILTER (WHERE via = 'link')::numeric
             / nullif(count(*) FILTER (WHERE via IN ('code', 'link')), 0), 3) AS link_share_of_invites
FROM joins
GROUP BY ROLLUP (date_trunc('week', joined_at)::date)
ORDER BY week NULLS LAST;
```

A link pasted into the home screen's code boxes counts as `code` (the phone only knows which screen the
join came from).

### Q4. Per game: plays, timeouts, scores, time to answer, early vs timer

One row per game over every answered round: each room's current game (`round_results`) plus every
earlier game Play again archived (`round_results_archive`, G1), flagged arcade runs left out of the score
columns. Timeout and time-to-answer columns are empty where they mean nothing: Flash and Bang On (`fixed`)
always store 0 ms left; for arcade-clock games (`run`) a "timeout" is a run that lasted to the buzzer.
A round "ended early" when its recorded `round_ended` reason (G3) is `all_answered` and "at the timer"
when it is `timer`; `rounds_end_recorded` says how many rounds had that event. Fallback for rounds
without one (before the migration): early when every player who answered any round of that game answered
it with time left, else at the timer (or someone never answered); left empty for `fixed` games.
Returns: `game_id, game, category, timer_kind, plays, devices, flagged_excluded, timeout_rate, solved_rate,
score_median, score_p25, score_p75, score_stddev, score_min, score_max, mean_secs_to_answer,
rounds, rounds_end_recorded, rounds_ended_early, rounds_at_timer, missing_answers`.

```sql
WITH
-- >>> FILL IN (same in every query)
params AS (SELECT timestamptz '2026-10-27 00:00+00' AS beta_start,
                  timestamptz '2026-11-24 00:00+00' AS beta_end),
my_devices(user_id) AS (VALUES                           -- Joe's own devices (duel_players.user_id)
  ('00000000-0000-0000-0000-000000000000'::uuid)),
test_rooms(room_code) AS (VALUES                         -- test rooms (duels.room_code)
  ('XXXXXX')),
-- <<< END FILL IN
clean_rooms AS (
  SELECT d.* FROM public.duels d
  WHERE d.room_code NOT IN (SELECT room_code FROM test_rooms)
    AND (d.host_user_id IS NULL OR d.host_user_id NOT IN (SELECT user_id FROM my_devices))
    AND NOT EXISTS (SELECT 1 FROM public.duel_players dp
                    WHERE dp.duel_id = d.id AND dp.user_id IN (SELECT user_id FROM my_devices))
    AND NOT EXISTS (SELECT 1 FROM public.duel_players_archive da
                    WHERE da.duel_id = d.id AND da.user_id IN (SELECT user_id FROM my_devices))),
beta_rooms AS (
  SELECT d.* FROM clean_rooms d, params
  WHERE d.created_at >= params.beta_start AND d.created_at < params.beta_end),
-- From src/lib/duel/registry.ts and gameNames.ts on 16 Oct 2026: id, name, category, default time
-- limit (ms), timer kind, dealt in rooms. A puzzle's own timeLimitMs wins over the default.
game_list(game_id, game, category, default_limit_ms, timer_kind, active) AS (VALUES
    ('wordsmith', 'Nucleus', 'word', 100000, 'answer', true),
    ('tilegrid', 'Interlock', 'word', 100000, 'answer', true),
    ('wordslide', 'Slider', 'word', 100000, 'answer', true),
    ('balance', 'Counterweight', 'number', 90000, 'answer', true),
    ('target', 'Exact', 'number', 75000, 'answer', true),
    ('equation', 'Operator', 'number', 90000, 'answer', true),
    ('reaction', 'Flash', 'speed', 60000, 'fixed', true),
    ('numhunt', 'Ascend', 'speed', 60000, 'answer', true),
    ('stroop', 'Mixed Signals', 'attention', 78000, 'run', true),
    ('symscan', 'Eagle Eye', 'attention', 30000, 'answer', true),
    ('spotdiff', 'Double Take', 'attention', 30000, 'answer', true),
    ('stopwatch', 'Bang On', 'speed', 60000, 'fixed', true),
    ('countup', 'Tally', 'attention', 45000, 'answer', true),
    ('wordhunt', 'Forage', 'word', 100000, 'answer', true),
    ('unblock', 'Gridlock', 'pattern', 60000, 'answer', true),
    ('blockparty', 'Tessellate', 'pattern', 60000, 'answer', true),
    ('lightsout', 'Blackout', 'logic', 75000, 'answer', true),
    ('pipes', 'Pipeline', 'pattern', 120000, 'answer', true),
    ('sudoku', 'Box Six', 'logic', 90000, 'answer', true),
    ('flow', 'Chroma Lines', 'pattern', 75000, 'answer', true),
    ('iceslide', 'Skid', 'pattern', 90000, 'answer', true),
    ('push', 'Heave', 'pattern', 120000, 'answer', true),
    ('laser', 'Lightbender', 'pattern', 60000, 'answer', true),
    ('tower', 'Hanoi', 'logic', 90000, 'answer', true),
    ('maze', 'Labyrinth', 'attention', 60000, 'answer', true),
    ('tubes', 'Polypotions', 'logic', 90000, 'answer', true),
    ('safe', 'Safe Cracker', 'logic', 75000, 'answer', true),
    ('bomb', 'Bomb Defusal', 'logic', 75000, 'answer', true),
    ('gravity', 'Topsy-Turvy', 'pattern', 90000, 'answer', true),
    ('chain', 'Don''t Break the Chain', 'speed', 45000, 'answer', true),
    ('nonogram', 'Mosaic', 'logic', 120000, 'answer', true),
    ('pairmatch', 'Matchmaker', 'attention', 90000, 'answer', true),
    ('flood', 'Colour Flood', 'logic', 60000, 'answer', true),
    ('tiles', 'Jumbled', 'pattern', 60000, 'answer', true),
    ('rings', 'Turntable', 'pattern', 60000, 'answer', true),
    ('hover', 'Hover', 'arcade', 63000, 'run', true),
    ('swerve', 'Swerve', 'arcade', 63000, 'run', false),
    ('skyline', 'High Rise', 'arcade', 63000, 'run', true),
    ('bintoss', 'Swish', 'arcade', 63000, 'run', true),
    ('bullseye', 'Flightpath', 'arcade', 48000, 'run', true),
    ('matchup', 'Gemstone', 'arcade', 63000, 'run', true),
    ('breaker', 'Breaker', 'arcade', 93000, 'run', true),
    ('pinball', 'Pinball', 'arcade', 63000, 'run', true),
    ('rally', 'Rally', 'arcade', 63000, 'run', true),
    ('steady', 'Steady', 'arcade', 63000, 'run', false),
    ('slice', 'Slice', 'arcade', 63000, 'run', true),
    ('bubble', 'Coral Pop', 'arcade', 93000, 'run', true),
    ('beat', 'Tempo', 'arcade', 63000, 'run', true),
    ('snake', 'Meteor', 'arcade', 63000, 'run', true),
    ('cross', 'Jaywalk', 'arcade', 63000, 'run', true),
    ('dual', 'Dual', 'arcade', 63000, 'run', false),
    ('ricochet', 'Ricochet', 'arcade', 63000, 'run', false),
    ('whack', 'Bonk', 'speed', 63000, 'run', true),
    ('tents', 'Tents and Trees', 'logic', 90000, 'answer', true),
    ('shikaku', 'Shikaku', 'logic', 90000, 'answer', true),
    ('lightup', 'Lamplighter', 'logic', 90000, 'answer', true),
    ('wavefront', 'Wavefront', 'arcade', 93000, 'run', true),
    ('bastion', 'Bastion', 'arcade', 63000, 'run', false),
    ('rooftop', 'Rooftop Run', 'arcade', 63000, 'run', false),
    ('flip', 'Roofbound', 'arcade', 63000, 'run', true),
    ('junction', 'Junction', 'arcade', 63000, 'run', false),
    ('inkbridge', 'Rainbow Bridge', 'arcade', 123000, 'run', true),
    ('burst', 'Fission', 'arcade', 93000, 'run', true),
    ('orbit', 'Orbit', 'arcade', 93000, 'run', true),
    ('swing', 'Grappler', 'arcade', 63000, 'run', true),
    ('snip', 'Scrumper', 'arcade', 63000, 'run', true),
    ('tilt', 'Tilt', 'arcade', 93000, 'run', true),
    ('hotfloor', 'Hot Floor', 'arcade', 123000, 'run', false),
    ('balltrack', 'Ball Tracker', 'arcade', 63000, 'run', true),
    ('wordsearch', 'Lookout', 'word', 120000, 'answer', true),
    ('letterwheel', 'Roundabout', 'word', 100000, 'answer', true),
    ('strikeout', 'Strikeout', 'word', 100000, 'answer', true),
    ('codeword', 'Cryptogrid', 'word', 120000, 'answer', true),
    ('swapword', 'Swapword', 'word', 120000, 'answer', true),
    ('tendrop', 'Tenfall', 'number', 93000, 'run', true),
    ('wordfall', 'Letterfall', 'word', 93000, 'run', true),
    ('clayshoot', 'Pull!', 'speed', 63000, 'run', true),
    ('numpyramid', 'Integer Pyramid', 'number', 120000, 'answer', true),
    ('dig', 'Dig', 'logic', 60000, 'answer', false),
    ('trail', 'Trail', 'number', 120000, 'answer', true),
    ('measure', 'Brimful', 'number', 120000, 'answer', true),
    ('checkout', 'Checkout', 'number', 90000, 'answer', true),
    ('numline', 'Ballpark', 'number', 75000, 'answer', true)),
all_answers AS (                   -- the current game's answers and every archived game's (G1)
  SELECT r.duel_id, jsonb_array_length(d.tournament_history) AS game_index, r.round_number, r.player_slot,
         r.score, r.is_correct, r.ms_remaining, r.extra, p.user_id,
         d.round_order ->> (r.round_number - 1) AS game_id,
         (d.puzzles_public -> (r.round_number - 1) ->> 'timeLimitMs')::int AS own_limit_ms
  FROM public.round_results r
  JOIN beta_rooms d ON d.id = r.duel_id
  LEFT JOIN public.duel_players p ON p.duel_id = r.duel_id AND p.player_slot = r.player_slot
  UNION ALL
  SELECT a.duel_id, a.game_index, a.round_number, a.player_slot,
         a.score, a.is_correct, a.ms_remaining, a.extra, a.user_id, a.game_id, a.time_limit_ms
  FROM public.round_results_archive a
  JOIN beta_rooms d ON d.id = a.duel_id),
answers AS (
  SELECT a.duel_id, a.game_index, a.round_number, a.player_slot, a.score, a.is_correct, a.ms_remaining,
         a.user_id, a.game_id,
         coalesce(a.own_limit_ms, g.default_limit_ms) AS limit_ms,
         coalesce(g.timer_kind, 'answer') AS timer_kind,
         coalesce((a.extra ->> 'flagged')::boolean, false)
           -- OR coalesce((a.extra ->> 'repaired')::int, 0) > 0   -- uncomment to also drop repaired tap/action logs
           AS suspect
  FROM all_answers a
  LEFT JOIN game_list g ON g.game_id = a.game_id),
room_players AS (                  -- who took part in each game of each room
  SELECT duel_id, game_index, count(DISTINCT player_slot) AS n FROM answers GROUP BY duel_id, game_index),
round_ends AS (                    -- G3: the recorded reason each round ended
  SELECT duel_id, game_index, round_number, reason
  FROM public.room_events WHERE event = 'round_ended'),
rounds AS (
  SELECT a.duel_id, a.game_index, a.round_number, a.game_id, a.timer_kind,
         count(*) AS answered,
         bool_and(a.ms_remaining > 0) AS all_with_time_left,
         max(rp.n) AS expected,
         max(e.reason) AS end_reason
  FROM answers a
  JOIN room_players rp USING (duel_id, game_index)
  LEFT JOIN round_ends e USING (duel_id, game_index, round_number)
  GROUP BY a.duel_id, a.game_index, a.round_number, a.game_id, a.timer_kind),
per_game_rounds AS (
  SELECT game_id,
         count(*) AS rounds,
         count(*) FILTER (WHERE end_reason IS NOT NULL) AS rounds_end_recorded,
         CASE WHEN bool_or(timer_kind = 'fixed') AND bool_and(end_reason IS NULL) THEN NULL
              ELSE count(*) FILTER (WHERE end_reason = 'all_answered'
                                       OR (end_reason IS NULL AND timer_kind <> 'fixed'
                                           AND answered = expected AND all_with_time_left)) END AS rounds_ended_early,
         CASE WHEN bool_or(timer_kind = 'fixed') AND bool_and(end_reason IS NULL) THEN NULL
              ELSE count(*) FILTER (WHERE end_reason = 'timer'
                                       OR (end_reason IS NULL AND timer_kind <> 'fixed'
                                           AND NOT (answered = expected AND all_with_time_left))) END AS rounds_at_timer,
         sum(expected - answered) AS missing_answers
  FROM rounds GROUP BY game_id),
per_game AS (
  SELECT game_id, max(timer_kind) AS timer_kind,
         count(*) AS plays,
         count(DISTINCT user_id) AS devices,
         count(*) FILTER (WHERE suspect) AS flagged_excluded,
         round(avg((ms_remaining = 0)::int) FILTER (WHERE timer_kind <> 'fixed'), 3) AS timeout_rate,
         round(avg(is_correct::int), 3) AS solved_rate,
         percentile_cont(0.5)  WITHIN GROUP (ORDER BY score) FILTER (WHERE NOT suspect) AS score_median,
         percentile_cont(0.25) WITHIN GROUP (ORDER BY score) FILTER (WHERE NOT suspect) AS score_p25,
         percentile_cont(0.75) WITHIN GROUP (ORDER BY score) FILTER (WHERE NOT suspect) AS score_p75,
         round(stddev_samp(score) FILTER (WHERE NOT suspect), 1) AS score_stddev,
         min(score) FILTER (WHERE NOT suspect) AS score_min,
         max(score) FILTER (WHERE NOT suspect) AS score_max,
         round(avg((limit_ms - ms_remaining) / 1000.0)
               FILTER (WHERE timer_kind = 'answer' AND ms_remaining > 0), 1) AS mean_secs_to_answer
  FROM answers GROUP BY game_id)
SELECT pg.game_id, g.game, g.category, pg.timer_kind, pg.plays, pg.devices, pg.flagged_excluded,
       pg.timeout_rate, pg.solved_rate, pg.score_median, pg.score_p25, pg.score_p75, pg.score_stddev,
       pg.score_min, pg.score_max, pg.mean_secs_to_answer,
       pr.rounds, pr.rounds_end_recorded, pr.rounds_ended_early, pr.rounds_at_timer, pr.missing_answers
FROM per_game pg
JOIN per_game_rounds pr USING (game_id)
LEFT JOIN game_list g USING (game_id)
ORDER BY pg.plays DESC, pg.game_id;
```

`mean_secs_to_answer` leaves out timeouts (they'd all read as the full limit) and is measured from the
clock's start, after any prep time. `solved_rate` is `is_correct`, which for arcade games means the run
survived. `missing_answers` counts, per round, players who answered some round of that game but not
this one. To see a game's whole score distribution, swap the final SELECT for
`SELECT game_id, width_bucket(score, 0, 1000, 10) AS bucket, count(*) FROM answers WHERE NOT suspect GROUP BY 1, 2 ORDER BY 1, 2`.

### Q5. Practice plays per device, and the most-practised games

From `practice_plays` (G2): one row per graded practice play since the migration. Two result sets:
devices by practice plays (plays without a device id are left out), then games by practice plays (all
plays, with the fixed intro example counted separately).
Returns (a): `practice_plays_per_device, devices` (a histogram) and the average; (b): `game_id, practice_plays,
devices, example_plays, timeout_rate, solved_rate, avg_score, median_score, avg_secs, flagged`.

```sql
-- (a) practice plays per device
WITH
-- >>> FILL IN (same in every query)
params AS (SELECT timestamptz '2026-10-27 00:00+00' AS beta_start,
                  timestamptz '2026-11-24 00:00+00' AS beta_end),
my_devices(user_id) AS (VALUES                           -- Joe's own devices (duel_players.user_id)
  ('00000000-0000-0000-0000-000000000000'::uuid)),
test_rooms(room_code) AS (VALUES                         -- test rooms (duels.room_code)
  ('XXXXXX')),
-- <<< END FILL IN
pp AS (
  SELECT x.* FROM public.practice_plays x, params
  WHERE x.created_at >= params.beta_start AND x.created_at < params.beta_end
    AND x.user_id IS NOT NULL
    AND x.user_id NOT IN (SELECT user_id FROM my_devices)),
per_device AS (SELECT user_id, count(*) AS plays FROM pp GROUP BY user_id)
SELECT plays AS practice_plays_per_device, count(*) AS devices,
       round(sum(plays * count(*)) OVER () / sum(count(*)) OVER (), 2) AS avg_plays_per_practising_device
FROM per_device
GROUP BY plays
ORDER BY plays;
```

```sql
-- (b) most-practised games
WITH
-- >>> FILL IN (same in every query)
params AS (SELECT timestamptz '2026-10-27 00:00+00' AS beta_start,
                  timestamptz '2026-11-24 00:00+00' AS beta_end),
my_devices(user_id) AS (VALUES                           -- Joe's own devices (duel_players.user_id)
  ('00000000-0000-0000-0000-000000000000'::uuid)),
test_rooms(room_code) AS (VALUES                         -- test rooms (duels.room_code)
  ('XXXXXX')),
-- <<< END FILL IN
pp AS (
  SELECT x.* FROM public.practice_plays x, params
  WHERE x.created_at >= params.beta_start AND x.created_at < params.beta_end
    AND (x.user_id IS NULL OR x.user_id NOT IN (SELECT user_id FROM my_devices)))
SELECT game_id,
       count(*)                                           AS practice_plays,
       count(DISTINCT user_id)                            AS devices,
       count(*) FILTER (WHERE example)                    AS example_plays,
       round(avg(timed_out::int), 3)                      AS timeout_rate,
       round(avg(is_correct::int), 3)                     AS solved_rate,
       round(avg(score) FILTER (WHERE NOT flagged), 1)    AS avg_score,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY score) FILTER (WHERE NOT flagged) AS median_score,
       round(avg(duration_ms) / 1000.0, 1)                AS avg_secs,
       count(*) FILTER (WHERE flagged)                    AS flagged
FROM pp
GROUP BY game_id
ORDER BY practice_plays DESC, game_id;
```

`avg_plays_per_practising_device` is the same on every row. Devices that never practised don't appear;
compare with the device count from Q2. `timeout_rate` has the room caveat: Flash and Bang On always send
0 ms left, so they always read as timed out. Practice rounds can be several revisions of one game;
`GROUP BY game_id, revision` splits them.

### Q6. Suspected cheating per game (for the exclusions)

How many rounds each game would drop as suspect: arcade runs the replay flagged, and (shown, not dropped
by default) tap- and action-log rounds whose logs the server repaired, over current and archived games
(G1). Read this before trusting Q4's score columns; a high flagged count on one game more likely means
desync than cheating.
Returns: `game_id, rounds, flagged, flagged_rate, repaired_logs, flagged_devices`.

```sql
WITH
-- >>> FILL IN (same in every query)
params AS (SELECT timestamptz '2026-10-27 00:00+00' AS beta_start,
                  timestamptz '2026-11-24 00:00+00' AS beta_end),
my_devices(user_id) AS (VALUES                           -- Joe's own devices (duel_players.user_id)
  ('00000000-0000-0000-0000-000000000000'::uuid)),
test_rooms(room_code) AS (VALUES                         -- test rooms (duels.room_code)
  ('XXXXXX')),
-- <<< END FILL IN
clean_rooms AS (
  SELECT d.* FROM public.duels d
  WHERE d.room_code NOT IN (SELECT room_code FROM test_rooms)
    AND (d.host_user_id IS NULL OR d.host_user_id NOT IN (SELECT user_id FROM my_devices))
    AND NOT EXISTS (SELECT 1 FROM public.duel_players dp
                    WHERE dp.duel_id = d.id AND dp.user_id IN (SELECT user_id FROM my_devices))
    AND NOT EXISTS (SELECT 1 FROM public.duel_players_archive da
                    WHERE da.duel_id = d.id AND da.user_id IN (SELECT user_id FROM my_devices))),
beta_rooms AS (
  SELECT d.* FROM clean_rooms d, params
  WHERE d.created_at >= params.beta_start AND d.created_at < params.beta_end),
all_answers AS (                   -- the current game's answers and every archived game's (G1)
  SELECT d.round_order ->> (r.round_number - 1) AS game_id, r.extra, p.user_id
  FROM public.round_results r
  JOIN beta_rooms d ON d.id = r.duel_id
  LEFT JOIN public.duel_players p ON p.duel_id = r.duel_id AND p.player_slot = r.player_slot
  UNION ALL
  SELECT a.game_id, a.extra, a.user_id
  FROM public.round_results_archive a
  JOIN beta_rooms d ON d.id = a.duel_id)
SELECT game_id,
       count(*)                                                       AS rounds,
       count(*) FILTER (WHERE (extra ->> 'flagged')::boolean)         AS flagged,
       round(avg(coalesce((extra ->> 'flagged')::boolean, false)::int), 3) AS flagged_rate,
       count(*) FILTER (WHERE coalesce((extra ->> 'repaired')::int, 0) > 0) AS repaired_logs,
       count(DISTINCT user_id) FILTER (WHERE (extra ->> 'flagged')::boolean) AS flagged_devices
FROM all_answers
GROUP BY 1
ORDER BY flagged DESC, rounds DESC;
```

### Q7. Visitors who never played a room (needs `auth.users`)

By day of first visit: new device identities, how many went on to play a room (archived departures
included), how many hosted one, and how many practised (`practice_plays`, G2), including those who only
practised. The rest only looked. Bots that run JavaScript also create identities here.
Returns: `day, new_identities, played_a_room, hosted_a_room, practised, only_practised, play_rate`.

```sql
WITH
-- >>> FILL IN (same in every query)
params AS (SELECT timestamptz '2026-10-27 00:00+00' AS beta_start,
                  timestamptz '2026-11-24 00:00+00' AS beta_end),
my_devices(user_id) AS (VALUES                           -- Joe's own devices (duel_players.user_id)
  ('00000000-0000-0000-0000-000000000000'::uuid)),
test_rooms(room_code) AS (VALUES                         -- test rooms (duels.room_code)
  ('XXXXXX')),
-- <<< END FILL IN
clean_rooms AS (
  SELECT d.* FROM public.duels d
  WHERE d.room_code NOT IN (SELECT room_code FROM test_rooms)
    AND (d.host_user_id IS NULL OR d.host_user_id NOT IN (SELECT user_id FROM my_devices))
    AND NOT EXISTS (SELECT 1 FROM public.duel_players dp
                    WHERE dp.duel_id = d.id AND dp.user_id IN (SELECT user_id FROM my_devices))
    AND NOT EXISTS (SELECT 1 FROM public.duel_players_archive da
                    WHERE da.duel_id = d.id AND da.user_id IN (SELECT user_id FROM my_devices))),
ids AS (
  SELECT u.id, u.created_at,
         EXISTS (SELECT 1
                 FROM (SELECT user_id, duel_id FROM public.duel_players
                       UNION ALL SELECT user_id, duel_id FROM public.duel_players_archive) p
                 JOIN clean_rooms d ON d.id = p.duel_id
                 WHERE p.user_id = u.id
                   AND (jsonb_array_length(d.round_order) > 0
                        OR jsonb_array_length(d.tournament_history) > 0)) AS played,
         EXISTS (SELECT 1 FROM clean_rooms d WHERE d.host_user_id = u.id) AS hosted,
         EXISTS (SELECT 1 FROM public.practice_plays x WHERE x.user_id = u.id) AS practised
  FROM auth.users u, params
  WHERE u.is_anonymous AND u.created_at >= params.beta_start AND u.created_at < params.beta_end
    AND u.id NOT IN (SELECT user_id FROM my_devices))
SELECT created_at::date AS day,
       count(*) AS new_identities,
       count(*) FILTER (WHERE played)                    AS played_a_room,
       count(*) FILTER (WHERE hosted)                    AS hosted_a_room,
       count(*) FILTER (WHERE practised)                 AS practised,
       count(*) FILTER (WHERE practised AND NOT played)  AS only_practised,
       round(count(*) FILTER (WHERE played)::numeric / nullif(count(*), 0), 3) AS play_rate
FROM ids
GROUP BY 1
ORDER BY 1;
```

## 4. Reading the numbers

- Device counts are upper bounds on people: one person on Safari and on the home-screen app is two
  devices, and so is anyone who clears site data. Return rates are lower bounds for the same reason.
- Q4 and Q6 see every game played after the G1 migration was applied; rooms that pressed Play again
  before it still show only their last game, so the earliest beta days (if the migration lands late)
  under-represent long Play again sessions. `rounds_end_recorded` in Q4 shows how much of each game's
  early-vs-timer split is recorded rather than inferred.
- Small numbers: with 100–300 devices a weekly cohort may hold a few dozen; read rates with their counts.

## 5. How these queries were checked

No production database is reachable from the development container, so each query was run against a
local copy of the schema, twice:

**16 Oct 2026, first version (before the beta recording).** PostgreSQL 16.15 with a stub of the Supabase
pieces the migrations reference (roles `anon`, `authenticated`, `service_role`; schema `auth` with
`auth.users(id, created_at, last_sign_in_at, is_anonymous)` and `auth.uid()`; publication
`supabase_realtime`); the 27 migrations of the time applied in order with `ON_ERROR_STOP`; synthetic data
(80 devices, 140 rooms, 549 player rows, 2,305 answers across 14 games); every block run as written and
once with a real device id and room code in the filter.

**16 Oct 2026, this version (G1–G4 recorded).** The same stub with all 32 migrations applied in order
(including the four `2026101613xxxx_beta_*` ones), then synthetic data (not real) written the way the
new code writes it: 60 anonymous devices, 50 rooms over the beta window with 2–5 players and 1–3 games
each (48 Play agains: 412 archived answers and departed players in the archive tables, 411 current
answers), 294 `round_ended` events (all_answered / timer), game events, 305 `room_joins` (host, code,
link, play_again and null) and 300 `practice_plays` (some without a device id). Every SQL block in this
file was run as written:

| Query | Result on the local copy |
|---|---|
| Q0 | ran, 54 rows |
| Q1a | ran, 23 rows; 98 games started = 50 current + 48 archived, 88 completed + 10 unfinished |
| Q1b | ran, 5 rows |
| Q1c | ran, 5 rows |
| Q2 | ran, 4 rows |
| Q3a | ran, 5 rows |
| Q3b | ran, 5 rows; invited = code + link + unrecorded |
| Q3c | ran, 5 rows; matches a direct count of `room_joins` by `via` |
| Q4 | ran, 7 rows; plays = 823 = 411 current + 412 archived; ended early + at timer = the 135 + 155 recorded reasons of answered rounds |
| Q5 (a) | ran, 11 rows |
| Q5 (b) | ran, 7 rows |
| Q6 | ran, 7 rows (current and archived answers) |
| Q7 | ran, 21 rows |

The filter check: Q1a with a device that appears only in `duel_players_archive` (it left before a Play
again) in `my_devices` dropped exactly that device's rooms (49 of 50 left, as an independent count
predicted). `scripts/beta-recording-check.ts` repeats the schema part on every run: it applies every
migration to a throwaway local PostgreSQL and plays Play again, archives, joins, events and RLS against it.
To repeat the query check: initialise PostgreSQL 16, run the stub above, apply the migrations in filename
order, insert test rows, and run each block with `psql -v ON_ERROR_STOP=1`.

## 6. Gaps: what isn't recorded today

G1–G4 are **done** (16 Oct 2026; recording starts once the four `2026101613xxxx_beta_*` migrations are
applied and the code is published; the G1 fix-up `20261016170000_beta_archive_round_records.sql`, which
stores archived rounds' effective limits and version stamps, needs applying too). G5–G8 are not made; each is the smallest change that would record the
missing fact. None of them touches a game, sim, score, timing, input, replay or version stamp, and none
rewrites stored rows (rule 4): they only add new rows from now on. Every recording write is best-effort
(`src/lib/duel/betaRecord.server.ts`; the archive's own sub-block in `restart_duel_room`): a failure is
logged and play carries on. `scripts/beta-recording-check.ts` proves them, running the SQL on a local
PostgreSQL when one is installed.

| # | Missing | Needed by | Smallest change |
|---|---|---|---|
| G1 | **Done.** Earlier games' rounds after Play again, and the devices that left. | Q1b, Q2, Q3, Q4, Q6, Q7 | `restart_duel_room` (migration `20261016130300_beta_play_again_archive.sql`) copies the room's `round_results` into `round_results_archive` and its `left` players into `duel_players_archive`, with `game_index` (the Play again count before that game), `game_id`, `time_limit_ms`, `revision` and the slot's `user_id`, before its deletes; the rest of the reset is unchanged. Fix-up (migration `20261016170000_beta_archive_round_records.sql`): `time_limit_ms` is the limit the round used (own `timeLimitMs`, else the game default) and `revision` its version stamps, both by `practice_plays`' rule (`registry.puzzleTimeLimitMs`, `revisionStamps`), taken from `duel_secrets.round_records`, which `startRoomFn` writes once per game at the deal because the database can't see the game defaults. |
| G2 | **Done.** Practice plays. | Q5, Q7 | `practice_plays` (migration `20261016130200`), one row per graded play from `practiceGradeFn` after grading: device id read from the call's bearer token (the global `attachSupabaseAuth` already sends it; no auth requirement was added, so practice still works without a session and records `user_id` null), game id, revision stamps, score, solved, timed out, duration, limit, time left, intro example, flagged. Outcome only. |
| G3 | **Done.** Game and round start/end times, and why a round ended. | Q1a, Q4 | `room_events` (migration `20261016130100`): `game_started` (`startRoomFn`'s claim), `round_started` (intro → puzzle in `advancePhaseFn`), `round_ended` with `all_answered` (`advancePhaseFn`'s `allIn`, or `submitAnswerFn`'s last answer) or `timer` (`advancePhaseFn`'s `timeUp`), `game_ended` with `completed` (`leaveBetweenRoundScreen`: result → winner reveal, or older rooms' last standings), `finish_now` (`finishGame`), `host_left` (`leaveRoomFn`) or `disbanded` (`disbandRoomFn`), the last two only mid-game. Written only by the call whose guarded update moved the room (`setPhase` now returns its stamp to that call), and a unique index keeps one row per room, game, round and event. |
| G4 | **Done.** Joined by code or by link. | Q3b, Q3c | `room_joins` (migration `20261016130000`): `host` (`createRoomRow`), `code` / `link` from an optional `via` that the home screen's code boxes and `JoinFromLink` pass to `joinRoomFn` (rejoins in the lobby flagged `rejoin`), and `play_again` for everyone `restart_duel_room` carries into the next game. Older phones send no `via` and are stored as null. A link pasted into the code boxes counts as `code`. |
| G5 | **A timed-out flag.** Timeout is inferred from `ms_remaining = 0`, which can't separate a buzzer-beater from a timeout, and Flash and Bang On always store 0. | Q4 timeout rate | Add `timedOut: true` to `submitAnswerFn`'s input from the phone's timer effect in `duel.$code.tsx` and store it as `round_results.timed_out boolean` (or in `extra`). Grading ignores it. |
| G6 | **Time-claim clamps.** When the server clamps a phone's `msRemaining` (more than 1.5 s better than its own estimate) it only logs `console.warn`. | Q6 (a timing-cheat signal) | Store `clamped: true` alongside, e.g. a nullable `round_results.time_clamped boolean` written in `submitAnswerFn` from the `clamped` it already computes. |
| G7 | **Device first-seen outside `auth`.** `auth.users.created_at` has it, but only roles that can read the `auth` schema see it, and Lovable Cloud may not expose it everywhere. | Q7 | None needed if the SQL editor can read `auth.users`; otherwise a `devices(user_id primary key, first_seen_at default now(), last_seen_at)` table upserted by a tiny server function the root calls once after `ensureSession()`. |
| G8 | **Same person, several devices.** Anonymous ids split a person across browsers and the home-screen app. | Q2, Q3 (undercount returns) | Nothing small: accounts, or a self-chosen link step. Read device numbers as upper bounds for people. |

Not gaps: device id (`user_id`), room id, game id, score, room created time, host (creator) and Play
again count are all recorded for every room.

Not recorded even now (G1–G4 limits): a host removing a player in the lobby still deletes that row
without an archive (the player never played that game); rooms and practice before the migrations have no
rows in the new tables; a phone that never sends its answer still leaves no row, so `missing_answers` stays
inferred; `round_started` is the clock's start, so the round title and intro (and a puzzle's prep time)
are before it; the winner reveal's own end (status `finished`) is not a separate event.

## 7. The share loop (21 Oct 2026)

`share_events` (migration `20261021120000_beta_share_events.sql`, **written but not applied**; until it
is, every write fails quietly and the app is unchanged) records the growth loop from the final screen's
Share button (`src/components/share/ShareResultButton.tsx`, `src/lib/share/`). Server-only (RLS on, no
client grants), written best-effort by `recordShareEventFn` (`src/lib/duel/share.functions.ts` →
`betaRecord.server.ts` `recordShareEvent`); outcome only, never an answer, puzzle, name or score.

| event | One row per | Columns |
|---|---|---|
| `share_tap` | tap on Share (podium or two-player result) | `user_id`, `duel_id`, `game_index`, `room_code`, `place` (null after leaving or a forfeit loss), `players`, `rounds`, `method` (`native` = the share sheet opened, `copy` = text and link copied), `created_at` |
| `arrival` | device, its first visit from a shared link (`?ref=share`) | `user_id`, `landing` (`room` = the room link, `home` = the app's home), `room_code` (room links only) |
| `arrival_finished` | device, the first room it saw to the final screen after arriving | `user_id`, `duel_id`, `game_index`, `room_code`, `place`, `players`, `rounds` |

A tap means the sheet opened (or the text was copied), not that anything was sent: the share sheet does
not say. Shared links name the room while it is open (not disbanded, host still in it) and the home
otherwise; both carry `?ref=share`. `arrival` and `arrival_finished` are one row per device (unique
indexes keep the first), so a device that clears its storage is a new device (G8). The phone remembers
its arrival in localStorage (`duelz-share-arrival:v1`) and sends `arrival_finished` from the final
screen; `room_joins` and `room_events` give the same answer server-side (Q-S3).

**Q-S1. Shares per day.**

```sql
select date_trunc('day', created_at) as day,
       count(*) as taps,
       count(*) filter (where method = 'native') as share_sheet,
       count(*) filter (where method = 'copy') as copied,
       count(distinct user_id) as sharing_devices,
       round(avg(place), 2) as avg_place
from public.share_events
where event = 'share_tap'
group by 1 order by 1;
```

**Q-S2. Arrivals from shared links, and how many went on to finish a room.**

```sql
select date_trunc('day', a.created_at) as day,
       count(*) as arrivals,
       count(*) filter (where a.landing = 'room') as via_room_link,
       count(f.user_id) as finished_a_room,
       round(100.0 * count(f.user_id) / nullif(count(*), 0), 1) as finish_pct
from public.share_events a
left join public.share_events f on f.user_id = a.user_id and f.event = 'arrival_finished'
where a.event = 'arrival'
group by 1 order by 1;
```

**Q-S3. The same from the room tables** (an arrival's device joined a game that reached `game_ended`
`completed` after it arrived; works even for phones whose final-screen send failed).

```sql
select count(distinct a.user_id) as arrivals,
       count(distinct a.user_id) filter (where exists (
         select 1 from public.room_joins j
         join public.room_events e on e.duel_id = j.duel_id and e.game_index = j.game_index
           and e.event = 'game_ended' and e.reason = 'completed'
         where j.user_id = a.user_id and j.joined_at >= a.created_at
       )) as finished_a_room
from public.share_events a
where a.event = 'arrival';
```
