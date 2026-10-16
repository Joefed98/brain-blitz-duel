# Beta numbers: SQL (27 Oct – 23 Nov 2026)

SQL to measure the four-week public beta (100–300 strangers on the web app, anonymous device
identities, no accounts). Every query is read-only and self-contained: paste one into the Lovable
Cloud / Supabase SQL editor and run it. Nothing here changes a game, sim, score, timing, input, replay,
version stamp or stored row.

Written 16 Oct 2026 against `supabase/migrations/` (27 files, latest `20261013120000`), which match
`src/integrations/supabase/types.ts`. Section 5 says how each query was run; section 6 lists what the
data doesn't record yet, with the smallest change that would record it (none of them made).

## 1. Where the data lives

All tables are in `public`, written only by server functions in `src/lib/duel/*.functions.ts` (service
role); clients can only read their own rooms (RLS). Rows are deleted in two places only: Play again
(below), and a host removing a player in the lobby (`removePlayerFn` deletes that `duel_players` row).

| Table | One row per | What it records |
|---|---|---|
| `auth.users` (Supabase) | device identity | `id` = the device id; `created_at` = first visit (every page load signs in anonymously, `src/routes/__root.tsx` → `ensureSession()` in `src/lib/duel/session.ts`); `last_sign_in_at`; `is_anonymous`. Needs a role that can read `auth` (the SQL editor's `postgres` role can). |
| `duels` | room (one code, possibly several games through Play again) | `id`, `room_code`, `host_user_id` (the device that created it), `created_at`, `status` (`waiting` / `in_progress` / `finished`), `phase`, `phase_started_at` (start of the current phase only; overwritten), `current_round`, `round_count`, `round_order` (jsonb array of game ids, one per round), `puzzles_public` (jsonb, one puzzle per round, each with `type` and sometimes `timeLimitMs`), `selected_categories`, `tournament_history` (jsonb: one entry per earlier game in the room, `{winner, date, score, round_order, forfeit?, forfeited_by?}`), `disbanded_at`. `next_duel_id` is never written. |
| `duel_players` | device in a room | `duel_id`, `user_id` (device id), `player_slot` (1–10), `display_name`, `status` (`active` / `inactive` / `left`), `joined_at`, `created_at`, `last_seen_at` (heartbeat), `ready_round`, `intro_ready_round`, `muted_by_host`. |
| `round_results` | answer (device × round) of the room's **current** game | `duel_id`, `player_slot` (→ `duel_players.user_id`), `round_number` (game id = `round_order[round_number - 1]`), `score` (the server's own, 0–1000-ish per round), `is_correct`, `ms_remaining` (time left when answered, after the server's 1.5 s clamp), `submitted_at`, `answer`, `reaction_avg_ms`, `correct_count`, `errors`, `extra` (jsonb; arcade runs carry `flagged`, `diag`, `claimedScore`, `endedSeconds`; tap- and action-log rounds carry `repaired`, `clamped`, `dropped`). |
| `duel_secrets` | room | answers (server-only); not needed here. |
| `room_messages`, `room_reports` | chat line / report | `duel_id`, sender / reporter device id, `created_at`. |
| `intro_demos`, `unblock_bank` | — | content, not plays. |

How each item you asked about is (or isn't) recorded:

| Item | Where | Notes |
|---|---|---|
| device id | `duel_players.user_id`, `duels.host_user_id`, `auth.users.id` | anonymous Supabase user; a new browser, private window, cleared site data or the iOS home-screen app (separate storage from Safari) is a new device. |
| room id | `duels.id` (`room_code` is the shared code) | one room can hold several games (Play again keeps the code). |
| game id | `duels.round_order ->> (round_number - 1)` (= `puzzles_public -> (round_number - 1) ->> 'type'`) | display names: `src/lib/duel/gameNames.ts` (inlined in Q4). |
| timestamps | `duels.created_at`, `duel_players.joined_at`, `round_results.submitted_at`, `tournament_history[].date`, `auth.users.created_at` | no stored start time for a game or a round (section 6). |
| score | `round_results.score` | server-graded (rule 7). |
| timed out | not stored as such: `ms_remaining = 0` | the phone submits its draft with `msRemaining: 0` when the clock runs out (`src/routes/duel.$code.tsx`). Flash and Bang On always store 0 (fixed-length rounds), so they get no timeout rate. Arcade-clock games: 0 = the run lasted to the buzzer. A phone that never answered has no row at all. |
| finished early | not stored: inferred per round (Q4) | early = every player who answered anything in the game answered this round with time left. |
| practice vs room | rooms only | **practice plays are not recorded anywhere** (`practiceGradeFn` grades and returns; no row, no device id). Q5 is written against the table proposed in section 6. |
| anti-cheat flags | `round_results.extra ->> 'flagged'` (arcade-engine rounds) | true when the server replay rejected inputs, the client's claimed score mismatched, or a checkpoint desynced (`src/lib/duel/arcadeRun.ts`). A desync can also be honest lag, so Q6 shows how many there are. The 1.5 s time-claim clamp is only logged to the console, not stored. |

**Play again deletes data.** `restart_duel_room` (migration `20260926012640…`) deletes the room's
`round_results`, `duel_secrets` and `left` players, resets `round_order` / `puzzles_public`, and appends
one `tournament_history` entry (winner name, date, winner's score, round order). So per-round results,
times and timeouts survive only for each room's **last** game; earlier games in the room keep only their
round order and date. Q1 counts every game; Q4 can only see last games. This is gap G1.

## 2. Assumptions

- Days and weeks are UTC (`date_trunc('week', …)` weeks start on Monday). The beta window defaults to
  27 Oct 00:00 – 24 Nov 00:00 UTC (four weeks); change it in the filter block.
- A device "played a room" when it has a `duel_players` row in a room that started (has a round order now
  or a Play again in its history). Its time is `joined_at`.
- A room is **started** when it has dealt rounds now or in its history. A game is **completed** when it
  reached the winner reveal (`phase = 'winner_reveal'`, or older rooms ending on the last round's
  standings); **finished by Finish now** when it ended `finished` with no disband (the last player
  ended it); **abandoned** when the host left or disbanded before the end. Every `tournament_history`
  entry is a finished game (Play again only works from a finished, undisbanded room), counted as
  completed unless it says `forfeit`.
- A game's start time is not stored: the current game uses its first answer's `submitted_at` (else
  `created_at`); earlier games use their history `date` (the Play again tap, just after it ended).
- "Returning device" in Q3: the device had played a room on an earlier UTC day. "7-day return" in Q2: played
  another room 1–7 UTC days after the day of its first room (a second room the same day doesn't count; a
  Play again in the same room isn't another room).
- **Exclusions.** Rooms with any of Joe's devices in them, rooms on the test-code list, and rooms outside
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
finished ones ended; and games started but still unfinished.
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
                    WHERE dp.duel_id = d.id AND dp.user_id IN (SELECT user_id FROM my_devices))),
beta_rooms AS (
  SELECT d.* FROM clean_rooms d, params
  WHERE d.created_at >= params.beta_start AND d.created_at < params.beta_end),
games AS (
  -- earlier games in the room (one per Play again)
  SELECT d.id AS room_id,
         (h.e ->> 'date')::timestamptz AS started_at,
         (h.e ->> 'date')::timestamptz AS ended_at,
         CASE WHEN (h.e ->> 'forfeit')::boolean THEN 'finish_now' ELSE 'completed' END AS outcome
  FROM beta_rooms d CROSS JOIN LATERAL jsonb_array_elements(d.tournament_history) AS h(e)
  UNION ALL
  -- the room's current game, if it has been dealt
  SELECT d.id,
         coalesce((SELECT min(r.submitted_at) FROM public.round_results r WHERE r.duel_id = d.id), d.created_at),
         CASE WHEN d.status = 'finished'
              THEN coalesce(CASE WHEN d.phase = 'winner_reveal' THEN d.phase_started_at END,
                            d.disbanded_at,
                            (SELECT max(r.submitted_at) FROM public.round_results r WHERE r.duel_id = d.id),
                            d.phase_started_at) END,
         CASE WHEN d.status = 'finished'
                   AND (d.phase = 'winner_reveal' OR (d.phase = 'standings' AND d.current_round >= d.round_count))
                THEN 'completed'
              WHEN d.status = 'finished' AND d.disbanded_at IS NULL THEN 'finish_now'
              WHEN d.status = 'finished' THEN 'abandoned'
              ELSE 'unfinished' END
  FROM beta_rooms d
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

Over started rooms, by week of creation: devices per room (Play again drops players who had left, so
this undercounts rooms that lost players), games per room, rounds dealt per room across all its games, and
rounds that got at least one answer in the room's last game.
Returns: `week, started_rooms, avg_players, max_players, avg_games_per_room, avg_rounds_dealt, avg_rounds_answered_last_game`.

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
                    WHERE dp.duel_id = d.id AND dp.user_id IN (SELECT user_id FROM my_devices))),
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
         (SELECT count(DISTINCT p.user_id) FROM public.duel_players p WHERE p.duel_id = s.id) AS players,
         (SELECT count(DISTINCT r.round_number) FROM public.round_results r WHERE r.duel_id = s.id) AS rounds_answered
  FROM started s)
SELECT week,
       count(*)                                   AS started_rooms,
       round(avg(players), 2)                     AS avg_players,
       max(players)                               AS max_players,
       round(avg(games), 2)                       AS avg_games_per_room,
       round(avg(rounds_dealt), 2)                AS avg_rounds_dealt,
       round(avg(rounds_answered), 2)             AS avg_rounds_answered_last_game
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
                    WHERE dp.duel_id = d.id AND dp.user_id IN (SELECT user_id FROM my_devices))),
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
                    WHERE dp.duel_id = d.id AND dp.user_id IN (SELECT user_id FROM my_devices))),
played AS (               -- every (device, started room), all time
  SELECT p.user_id, p.duel_id, p.joined_at
  FROM public.duel_players p
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
                    WHERE dp.duel_id = d.id AND dp.user_id IN (SELECT user_id FROM my_devices))),
beta_rooms AS (
  SELECT d.* FROM clean_rooms d, params
  WHERE d.created_at >= params.beta_start AND d.created_at < params.beta_end),
played AS (
  SELECT p.user_id, p.duel_id, p.joined_at, d.host_user_id
  FROM public.duel_players p
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
Every room here was created, never joined: creating is the only way to host. Whether the creator then
shared it by code or by link isn't recorded (gap G4).

### Q3b. Room codes shared to new devices

By week of the new device's first room: new devices, how many arrived in someone else's room (the code or
link reached them), how many started by hosting their own, and how many distinct hosts brought someone
new in. `new_per_inviting_host` is a rough spread factor.
Returns: `week, new_devices, arrived_by_invite, arrived_as_host, invite_share, inviting_hosts, new_per_inviting_host`.

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
                    WHERE dp.duel_id = d.id AND dp.user_id IN (SELECT user_id FROM my_devices))),
played AS (
  SELECT p.user_id, p.duel_id, p.joined_at, d.host_user_id
  FROM public.duel_players p
  JOIN clean_rooms d ON d.id = p.duel_id
  WHERE jsonb_array_length(d.round_order) > 0 OR jsonb_array_length(d.tournament_history) > 0),
firsts AS (
  SELECT DISTINCT ON (user_id) user_id, duel_id, joined_at, host_user_id
  FROM played ORDER BY user_id, joined_at, duel_id),
new_devices AS (
  SELECT f.*, f.host_user_id IS DISTINCT FROM f.user_id AS invited
  FROM firsts f, params
  WHERE f.joined_at >= params.beta_start AND f.joined_at < params.beta_end)
SELECT date_trunc('week', joined_at)::date                        AS week,
       count(*)                                                   AS new_devices,
       count(*) FILTER (WHERE invited)                            AS arrived_by_invite,
       count(*) FILTER (WHERE NOT invited)                        AS arrived_as_host,
       round(count(*) FILTER (WHERE invited)::numeric / nullif(count(*), 0), 3) AS invite_share,
       count(DISTINCT host_user_id) FILTER (WHERE invited)        AS inviting_hosts,
       round(count(*) FILTER (WHERE invited)::numeric
             / nullif(count(DISTINCT host_user_id) FILTER (WHERE invited), 0), 2) AS new_per_inviting_host
FROM new_devices
GROUP BY ROLLUP (date_trunc('week', joined_at)::date)
ORDER BY week NULLS LAST;
```

### Q4. Per game: plays, timeouts, scores, time to answer, early vs timer

One row per game over every answered round the data still holds (each room's last game; gap G1),
flagged arcade runs left out of the score columns. Timeout and time-to-answer columns are empty where
they mean nothing: Flash and Bang On (`fixed`) always store 0 ms left; for arcade-clock games (`run`) a
"timeout" is a run that lasted to the buzzer. A round "ended early" when every player who answered any
round of that game answered it with time left; otherwise it ran to the timer (or someone never answered).
Returns: `game_id, game, category, timer_kind, plays, devices, flagged_excluded, timeout_rate, solved_rate,
score_median, score_p25, score_p75, score_stddev, score_min, score_max, mean_secs_to_answer,
rounds, rounds_ended_early, rounds_at_timer, missing_answers`.

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
                    WHERE dp.duel_id = d.id AND dp.user_id IN (SELECT user_id FROM my_devices))),
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
answers AS (
  SELECT r.duel_id, r.round_number, r.player_slot, r.score, r.is_correct, r.ms_remaining,
         p.user_id,
         d.round_order ->> (r.round_number - 1) AS game_id,
         coalesce((d.puzzles_public -> (r.round_number - 1) ->> 'timeLimitMs')::int, g.default_limit_ms) AS limit_ms,
         coalesce(g.timer_kind, 'answer') AS timer_kind,
         coalesce((r.extra ->> 'flagged')::boolean, false)
           -- OR coalesce((r.extra ->> 'repaired')::int, 0) > 0   -- uncomment to also drop repaired tap/action logs
           AS suspect
  FROM public.round_results r
  JOIN beta_rooms d ON d.id = r.duel_id
  LEFT JOIN public.duel_players p ON p.duel_id = r.duel_id AND p.player_slot = r.player_slot
  LEFT JOIN game_list g ON g.game_id = d.round_order ->> (r.round_number - 1)),
room_players AS (                  -- who took part in each room's last game
  SELECT duel_id, count(DISTINCT player_slot) AS n FROM answers GROUP BY duel_id),
rounds AS (
  SELECT a.duel_id, a.round_number, a.game_id, a.timer_kind,
         count(*) AS answered,
         bool_and(a.ms_remaining > 0) AS all_with_time_left,
         max(rp.n) AS expected
  FROM answers a JOIN room_players rp USING (duel_id)
  GROUP BY a.duel_id, a.round_number, a.game_id, a.timer_kind),
per_game_rounds AS (
  SELECT game_id,
         count(*) AS rounds,
         CASE WHEN bool_or(timer_kind = 'fixed') THEN NULL
              ELSE count(*) FILTER (WHERE answered = expected AND all_with_time_left) END AS rounds_ended_early,
         CASE WHEN bool_or(timer_kind = 'fixed') THEN NULL
              ELSE count(*) FILTER (WHERE NOT (answered = expected AND all_with_time_left)) END AS rounds_at_timer,
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
       pr.rounds, pr.rounds_ended_early, pr.rounds_at_timer, pr.missing_answers
FROM per_game pg
JOIN per_game_rounds pr USING (game_id)
LEFT JOIN game_list g USING (game_id)
ORDER BY pg.plays DESC, pg.game_id;
```

`mean_secs_to_answer` leaves out timeouts (they'd all read as the full limit) and is measured from the
clock's start, after any prep time. `solved_rate` is `is_correct`, which for arcade games means the run
survived. To see a game's whole score distribution, swap the final SELECT for
`SELECT game_id, width_bucket(score, 0, 1000, 10) AS bucket, count(*) FROM answers WHERE NOT suspect GROUP BY 1, 2 ORDER BY 1, 2`.

### Q5. Practice plays per device, and the most-practised games

**Not runnable today: practice isn't recorded (gap G2).** Written against the `practice_plays` table
proposed there, so it works the day that table exists. Two result sets: devices by practice plays, then
games by practice plays.
Returns (a): `practice_plays_per_device, devices` (a histogram) and the average; (b): `game_id, practice_plays, devices, avg_score`.

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
    AND x.user_id NOT IN (SELECT user_id FROM my_devices))
SELECT game_id, count(*) AS practice_plays, count(DISTINCT user_id) AS devices,
       round(avg(score), 1) AS avg_score
FROM pp
GROUP BY game_id
ORDER BY practice_plays DESC, game_id;
```

`avg_plays_per_practising_device` is the same on every row. Devices that never practised don't appear;
compare with the device count from Q2.

### Q6. Suspected cheating per game (for the exclusions)

How many rounds each game would drop as suspect: arcade runs the replay flagged, and (shown, not dropped
by default) tap- and action-log rounds whose logs the server repaired. Read this before trusting Q4's
score columns; a high flagged count on one game more likely means desync than cheating.
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
                    WHERE dp.duel_id = d.id AND dp.user_id IN (SELECT user_id FROM my_devices))),
beta_rooms AS (
  SELECT d.* FROM clean_rooms d, params
  WHERE d.created_at >= params.beta_start AND d.created_at < params.beta_end)
SELECT d.round_order ->> (r.round_number - 1)                         AS game_id,
       count(*)                                                       AS rounds,
       count(*) FILTER (WHERE (r.extra ->> 'flagged')::boolean)       AS flagged,
       round(avg(coalesce((r.extra ->> 'flagged')::boolean, false)::int), 3) AS flagged_rate,
       count(*) FILTER (WHERE coalesce((r.extra ->> 'repaired')::int, 0) > 0) AS repaired_logs,
       count(DISTINCT p.user_id) FILTER (WHERE (r.extra ->> 'flagged')::boolean) AS flagged_devices
FROM public.round_results r
JOIN beta_rooms d ON d.id = r.duel_id
LEFT JOIN public.duel_players p ON p.duel_id = r.duel_id AND p.player_slot = r.player_slot
GROUP BY 1
ORDER BY flagged DESC, rounds DESC;
```

### Q7. Visitors who never played a room (needs `auth.users`)

By day of first visit: new device identities, how many went on to play a room, and how many hosted one.
The rest only looked (or only practised, which isn't recorded). Bots that run JavaScript also create
identities here.
Returns: `day, new_identities, played_a_room, hosted_a_room, play_rate`.

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
                    WHERE dp.duel_id = d.id AND dp.user_id IN (SELECT user_id FROM my_devices))),
ids AS (
  SELECT u.id, u.created_at FROM auth.users u, params
  WHERE u.is_anonymous AND u.created_at >= params.beta_start AND u.created_at < params.beta_end
    AND u.id NOT IN (SELECT user_id FROM my_devices))
SELECT i.created_at::date AS day,
       count(*) AS new_identities,
       count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM public.duel_players p JOIN clean_rooms d ON d.id = p.duel_id
         WHERE p.user_id = i.id
           AND (jsonb_array_length(d.round_order) > 0 OR jsonb_array_length(d.tournament_history) > 0))) AS played_a_room,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM clean_rooms d WHERE d.host_user_id = i.id)) AS hosted_a_room,
       round(count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM public.duel_players p JOIN clean_rooms d ON d.id = p.duel_id
         WHERE p.user_id = i.id
           AND (jsonb_array_length(d.round_order) > 0 OR jsonb_array_length(d.tournament_history) > 0)))::numeric
             / nullif(count(*), 0), 3) AS play_rate
FROM ids i
GROUP BY 1
ORDER BY 1;
```

## 4. Reading the numbers

- Device counts are upper bounds on people: one person on Safari and on the home-screen app is two
  devices, and so is anyone who clears site data. Return rates are lower bounds for the same reason.
- Q4 sees only each room's last game. If Play again is popular (Q1c), Q4 under-represents the games of
  early rounds in long sessions; G1 fixes it.
- Small numbers: with 100–300 devices a weekly cohort may hold a few dozen; read rates with their counts.

## 5. How these queries were checked

No production database is reachable from the development container, so each query was run against a
local copy of the schema:

1. PostgreSQL 16.15, a stub of the Supabase pieces the migrations reference (roles `anon`,
   `authenticated`, `service_role`; schema `auth` with `auth.users(id, created_at, last_sign_in_at,
   is_anonymous)` and `auth.uid()`; publication `supabase_realtime`).
2. All 27 files in `supabase/migrations/` applied in order with `ON_ERROR_STOP`; the resulting
   tables match `src/integrations/supabase/types.ts` column for column.
3. Synthetic beta data (not real): 80 anonymous devices, 140 rooms over 27 Oct – 25 Nov (waiting,
   in progress, completed, Finish now, abandoned; 0–3 Play again entries), 549 player rows, 2,305
   answers across 14 games, with timeouts, missing answers and a few flagged arcade runs.
4. Every SQL block in this file run as written (placeholder filter rows), plus once with a real device
   id and room code in the filter, which removed that device's rooms as expected. Q5 was run after
   creating the proposed `practice_plays` table (G2) in the local copy only.

| Query | Result on the local copy |
|---|---|
| Q0 | ran, 80 rows |
| Q1a | ran, 24 rows |
| Q1b | ran, 6 rows |
| Q1c | ran, 6 rows |
| Q2 | ran, 4 rows |
| Q3a | ran, 6 rows |
| Q3b | ran, 5 rows |
| Q4 | ran, 14 rows |
| Q5 (a) | ran, 4 rows |
| Q5 (b) | ran, 5 rows |
| Q6 | ran, 14 rows |
| Q7 | ran, 24 rows |

Q2's `window_complete` reads false on the local copy only because the synthetic dates are in the
future of the run (16 Oct). Q4's `devices` column and Q3b's totals were cross-checked against direct
counts; the filter check removed exactly the 15 rooms (and 285 answers) an independent count predicted.
To repeat the check: initialise PostgreSQL 16, run the stub above, apply the migrations in filename
order, insert test rows, and run each block with `psql -v ON_ERROR_STOP=1`.

## 6. Gaps: what isn't recorded today

None of these changes has been made. Each is the smallest change that would record the missing fact;
none touches a game, sim, score, timing, input, replay or version stamp, and none rewrites stored rows
(rule 4): they only add new rows or columns from now on.

| # | Missing | Needed by | Smallest change |
|---|---|---|---|
| G1 | **Earlier games' rounds after Play again.** `restart_duel_room` deletes the room's `round_results` and its `left` players, so per-game numbers, timeouts and times for every game before a room's last are lost, as are the devices that left. | Q4, Q6 (and Q1b player counts, Q2/Q3 for devices that left before a Play again) | New migration: a `round_results_archive` table (`round_results` columns + `game_index int` + `game_id text` + `archived_at`) and, in `restart_duel_room`, `INSERT INTO round_results_archive SELECT …, jsonb_array_length(tournament_history), round_order ->> (round_number - 1), now() FROM round_results WHERE duel_id = p_room_id` before its `DELETE`; the same for `duel_players` rows with `status = 'left'`. Q4 then reads `round_results UNION ALL round_results_archive`. |
| G2 | **Practice plays.** `practiceGradeFn` grades and returns; nothing is stored and it doesn't even know the device. | Q5 | A `practice_plays(id uuid default gen_random_uuid(), user_id uuid, game_id text, score int, is_correct bool, ms_remaining int, created_at timestamptz default now())` table (service role only, like `room_reports`) and one insert in `practiceGradeFn` after grading, with `requireSupabaseAuth` added to read the device id (the phone already has a session from app load). Store only the outcome, not the answer. |
| G3 | **Game and round start/end times, and why a round ended.** `phase_started_at` / `round_started_at` are overwritten each phase; a game's start, finish and each round's end are inferred. | Q1a (dates), Q4 (early vs timer is inferred from answers) | A `room_events(duel_id, game_index, round_number, event text, at timestamptz default now())` table with one insert where `startRoomFn` claims the room (`game_started`), where `setPhase` moves `puzzle → reveal` (`round_ended`, with `'all_in'` or `'timer'` from the branch that called it: `advancePhaseFn`'s `allIn`/`timeUp` or `submitAnswerFn`'s last answer), and where the room becomes `finished` (`game_finished`, `finish_now`, `disbanded`). |
| G4 | **Joined by code or by link.** Both paths call `joinRoomFn`; nothing tells them apart. | Q3a/Q3b split of how invites travel | A nullable `duel_players.join_via text` (`'code'`, `'link'`, `'host'`), set from an optional `via` field that the home screen's code entry and `JoinFromLink` pass to `joinRoomFn` (and `'host'` in `createRoomRow`). |
| G5 | **A timed-out flag.** Timeout is inferred from `ms_remaining = 0`, which can't separate a buzzer-beater from a timeout, and Flash and Bang On always store 0. | Q4 timeout rate | Add `timedOut: true` to `submitAnswerFn`'s input from the phone's timer effect in `duel.$code.tsx` and store it as `round_results.timed_out boolean` (or in `extra`). Grading ignores it. |
| G6 | **Time-claim clamps.** When the server clamps a phone's `msRemaining` (more than 1.5 s better than its own estimate) it only logs `console.warn`. | Q6 (a timing-cheat signal) | Store `clamped: true` alongside, e.g. a nullable `round_results.time_clamped boolean` written in `submitAnswerFn` from the `clamped` it already computes. |
| G7 | **Device first-seen outside `auth`.** `auth.users.created_at` has it, but only roles that can read the `auth` schema see it, and Lovable Cloud may not expose it everywhere. | Q7 | None needed if the SQL editor can read `auth.users`; otherwise a `devices(user_id primary key, first_seen_at default now(), last_seen_at)` table upserted by a tiny server function the root calls once after `ensureSession()`. |
| G8 | **Same person, several devices.** Anonymous ids split a person across browsers and the home-screen app. | Q2, Q3 (undercount returns) | Nothing small: accounts, or a self-chosen link step. Read device numbers as upper bounds for people. |

Not gaps: device id (`user_id`), room id, game id, score, room created time, host (creator) and Play
again count are all recorded for every room.
