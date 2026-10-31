# Rooms of 16 and the colour wheel (31 Oct 2026)

Rooms now seat 16 players (`MAX_PLAYERS`, was 10). This is for groups of friends. Big events (pubs, offices, 40+) are left to
the tournament system. No game's rules, scoring, grading or version stamps changed.

## What changed

| Area | Change | Where |
| --- | --- | --- |
| Cap | 16 seats in every lobby, rooms stored with `max_players` 10 included (`roomCapacity`). The 17th join gets "That room is full (16 players)." | `types.ts`, `roomSeats.ts` (`seatFor`, used by `joinRoomFn`) |
| Database | Migration `20261031150000_room_16_players.sql`, **written but not applied**: slots 1–16, `max_players` default 16, colours 0–31, share counts 1–20. Until it is applied the database still refuses slot 11, and the join reports "full (10 players)" through `RoomSeatsError` instead of an error. Wheel colours past 9 are seated as "no colour" (shown as the slot colour). | `playerLook.server.ts` |
| Lobby | Players in two columns (`rs-grid`). Tap your own chip to open the colour wheel for this room, which scrolls into view. | `RoomLobby.tsx`, `room-screens.css` |
| Round results, standings | Rooms of 11+ (bigger than the old cap, so rooms of up to 10 look exactly as before) use compact rows (`isCompactRoom`). Your own row is pinned in view (sticky to the page's top and to just above the room footer). The list uses `overflow: clip` so the page scroll drives the pin. | `RoundResultsTable.tsx`, `Standings.tsx` |
| Arcade "Who's ahead" | In rooms of 11+, the top 8 by score plus you (`chartShown`), with "The top eight and you · everyone on the results" under it. The chart shows no digits but its scale (room-extras-check). Rooms of up to 10 still draw everyone. "Still scoring" names two and "others" past three. | `arcadeChart.ts`, `ArcadeScoreChart.tsx` |
| Reveal overlap (bug) | At 375×667, a game with four part lines left the chart panel less height than the chart needs. The panel had `min-h-0`, so the chart drew over the parts card. The panel now never shrinks below its chart, and the reveal column scrolls instead. | `ArcadeReveal.tsx` |
| Podium | Rooms of 11+ show the top three, a "Your place: 12th of 16" line and your row, plus "See all 16 players". | `Podium.tsx` |
| Share card | Unchanged. It draws the top three and "of 16 players" (share-check). | `resultCard.ts` |
| Colours | A colour wheel of 32 swatches in three rings (18 + 10 + 4, the most colourful outside), every pair at least 14 ΔE2000 apart (closest 14.8, Violet/Periwinkle), all 4.5:1 on the background and under the badge glyph. Indices 0–9 are the October ten, unchanged, still colour-blind separated, and are a room's first ten auto colours. Stored and remembered indices keep their colour. | `playerLook.ts` (`PLAYER_COLOURS`, `colourWheel`, `nearestFreeColour`) |
| Picking | Profile sets your default (device storage, `duelz_player_look`). The lobby changes it for this room only. A colour someone in the room holds is greyed out with their initial and can't be tapped. If your default is taken when you join, you get the nearest free swatch (ΔE2000). | `RoomLobby.tsx` `ColourWheel`, `profile.tsx` |
| Initials | Every badge carries the player's initial (or icon) next to their name: lobby, results, standings, chart, podium (room-16-check). | `PlayerBadge.tsx` |
| Apex ghosts | Only your 3 nearest ghost cars along the track are drawn. Display only; nothing reaches the sim. | `racing.renderer.ts` `nearestRacingGhosts` |

## Load test

`bun scripts/room-load-test.ts [--players=16,32] [--scenario=arcade,dealt] [--json=<path>]` is a tool, not a check. Its
scripted bots play whole rooms against the real room server functions (`duel.functions.ts`: create, join, start,
advance, READY, submit, reveal, Continue, heartbeat). Everything runs against an in-memory **test copy** of the database:
the Supabase service client is replaced before anything is imported, and the tool refuses to run with
`SUPABASE_SERVICE_ROLE_KEY` set. The 32-player room is a test copy only, stored with `max_players` 32, which
`roomCapacity` honours. Rooms seat 16.

Time runs on a virtual clock. Every server call's own work is timed in real time, in-process, so database and network
latency are not included. The bots behave as the phone does (`useDuel.ts`, the room route):

- a heartbeat every 4 s;
- every room row change delivered to every phone;
- player and result refetches batched to one a second;
- a results read on each phase change;
- the host's phase timer once a second;
- READY and Continue after a few seconds;
- one answer per round at a random moment (about 6 % of players never answer).

The "arcade" scenario deals six recorded runs from `scripts/fixtures/replay-runs.json` (Apex, Grappler, Orbit,
Wavefront, Gemstone, Pinball, today's revisions), so every answer is a full server replay. Each replay stored exactly the
recorded run's score. The "dealt" scenario uses `startRoomFn`'s own deal with time-out answers.

Run on 31 Oct 2026, in this container:

| Scenario | Players | Rounds | Answers stored | Realtime messages | Room msgs/s | Msgs/s a phone | Peak room msgs/s | Requests/s (room) | Submit + grade ms p50 / p95 / max | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| arcade | 16 | 6 | 96/96 | 59,872 | 68.6 | 4.29 | 448 | 25.4 | 5.9 / 57.1 / 133.6 | none |
| arcade | 32 | 6 | 174/174 | 243,840 | 270.6 | 8.46 | 1376 | 53.4 | 4.6 / 45 / 90 | none |
| dealt | 16 | 6 | 90/90 | 59,008 | 68.3 | 4.27 | 288 | 25.4 | 1 / 6.5 / 16.2 | none |
| dealt | 32 | 6 | 186/186 | 228,448 | 272.9 | 8.53 | 1280 | 52.8 | 0.8 / 2.7 / 7.2 | none |

- **Messages.** `duel_players` changes are 96–97 % of all realtime messages. Almost all of them are heartbeats: each phone
  writes its row every 4 s, and every write reaches every phone. That grows with the square of the room: 4 heartbeats a
  second in a room of 16 become 64 messages a second, and 8 a second in a room of 32 become 256. `duels` changes are
  about 1 % and `round_results` about 2.5 %.
- **Requests.** Each phone refetches the players about once a second (the battery update's batching caps it there): 16
  a second at 16 players, 32 at 32. Then come heartbeats (4 and 8 a second) and phase-timer calls (about 2.5 and 4.5 a
  second).
- **Grading.** Answers are graded as they arrive (`submitAnswerFn`), never in a batch at the end of the round. The
  slowest arcade replay took 134 ms, and the round close itself (`advancePhaseFn` moving to the reveal) under 1 ms.
  Nothing queues at the buzzer: 32 replays at once is about 1.5 s of CPU spread over the requests.
- **Failures.** None. Every room finished, every answer was stored, the 17th join was refused, and colours were unique at 16.
- **Not measured here.** Supabase Realtime's own fan-out cost and plan quotas, Postgres latency and row-level-security
  cost per message. Before running rooms of 16 at scale, compare the per-room rates above with the project's Realtime
  quota.

**Worth doing before bigger rooms** (not done here): move the heartbeat to Realtime Presence, or stop broadcasting
`last_seen_at` updates. That would remove about 95 % of the messages. Filtering the room's `postgres_changes`
subscriptions by `duel_id` would also save RLS checks on other rooms' rows.

## Checks

- **room-16-check** (about 1.5 min with its browser pass, shard `play14`) covers:
  - the cap and the 17th join;
  - the pre-migration fallback;
  - colour uniqueness through the real server code in 120 random rooms of 16, with racing joins and lobby changes;
  - the nearest free swatch, by brute force and through the server's seat;
  - the wheel's spacing and contrast;
  - the ghosts' limit of three;
  - the chart's top 8 plus you;
  - in Chromium at 414×896 (home-screen app) and 375×667: the lobby's two columns, both wheels (44 px swatches that
    never overlap, the 15 taken ones greyed out in the lobby), the pinned row at the top and bottom of the scroll, the
    reveal's chart against the parts card (it fails on the old layout: the chart's bottom was 173 px past its panel at
    375×667), the podium's top three and place line, no page wider than the screen, and an initial on every badge.
- **player-looks-check** now proves the 32-swatch wheel (14 ΔE2000, normal vision) and keeps the October ten's
  colour-blind separation. The migrations are applied to a local PostgreSQL: colour 32, colour -1 and slot 17 are refused.
- The 16-player screens joined theme-check and no-wrap-check (`ROOM_16_SCREENS` in `scripts/theme-screens.ts`).

Screenshots: `bun scripts/shots/room16-shots.ts` (`screenshots/room16-oct-2026/`).
