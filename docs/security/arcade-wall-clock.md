# Arcade wall clock: the log-only trial (13 Nov 2026)

How long an arcade run takes on the server's clock against the run's own length, recorded so a limit can be chosen
from real figures. Nothing is flagged, regraded or refused yet; after a week Joe approves the number and a small
follow-up turns on the existing flag (`extra.flagged`).

## What is recorded

- **Server** (`src/lib/round/wallClock.ts`, `wallClock.server.ts`): every new room or practice arcade run whose arrival
  minus the server's start for the round is past `run length × 1.3 + 15 s` is recorded as the analytics event
  `arcade_run_slow` (game, mode, `props.run_ms`, `props.over_ms`, and in practice `props.token_age_s`, the time since the
  deal was sealed). A room's start is its puzzle phase (an answer taken in the reveal isn't judged; a room's own window,
  its close plus the reveal, ends before the line for every active arcade game anyway). Practice's start is the
  server's (practiceReceipt.ts: the start token, else the deal plus the intro).
- **Phone** (`src/lib/arcade/runTiming.ts`, sent by `ArcadeCanvasStage`): `arcade_run_timed` once a played run, with
  `wall_ms` (first tick to the end), `hidden_ms` (time the app was hidden in between; the sim waits while hidden),
  `run_ticks`, and `dropped_ticks` (ticks the sim fell behind the visible wall time). Never a score.

Reading a week of server records:

```sql
SELECT game, mode, count(*) AS runs, percentile_cont(0.5) WITHIN GROUP (ORDER BY (props ->> 'over_ms')::int) AS median_over_ms
  FROM analytics.events
 WHERE event = 'arcade_run_slow' AND occurred_at > now() - interval '7 days'
 GROUP BY game, mode ORDER BY runs DESC;
```

## The lab: slow phones (13 Nov 2026)

`bun scripts/arcade-perf.ts --rates=4,6` (headless Chromium at 390×844, the CPU slowed 4× and 6× through CDP, seeded
taps and swipes, about 8 s of measured live play per game and rate). "sim ÷ wall" is sim time (ticks × 16.67 ms) over
wall time across the measured play: 1 is real time, under 1 the sim fell behind the clock.

| Game (id) | 4× fps | 4× sim ÷ wall | 6× fps | 6× sim ÷ wall |
|---|---:|---:|---:|---:|
| hover | 52 | 0.967 | 34 | 0.966 |
| breaker | 53 | 1.001 | 35 | 0.999 |
| rally | 58 | 0.999 | 50 | 1.002 |
| beat | 57 | 1.001 | 53 | 1.001 |
| snake | 47 | 1.003 | 19 | 1.003 |
| burst | 58 | 0.999 | 44 | 1.006 |
| wavefront | 48 | 1.001 | 25 | 1.004 |
| orbit | 50 | 1.007 | 18 | 1.004 |
| skyline | 56 | 1.000 | 34 | 0.998 |
| cross | 49 | 1.008 | 44 | 1.119 |
| inkbridge | 44 | 1.005 | 15 | 0.999 |
| slice | 54 | 1.002 | 39 | 1.001 |
| bintoss | 49 | 1.000 | 16 | 0.998 |
| bullseye | 55 | 0.995 | 45 | 1.002 |
| bubble | 52 | 1.001 | 21 | 1.004 |
| flip | 36 | 0.999 | 16 | 1.083 |
| swing | 49 | 1.000 | 19 | 1.005 |
| tilt | 40 | 0.999 | 18 | 0.998 |
| balltrack | 50 | 1.002 | 29 | 1.000 |
| matchup | 33 | 1.003 | 15 | 0.997 |
| pinball | 54 | 1.001 | 19 | 0.999 |
| minesweeper | 53 | 0.999 | 45 | 1.001 |
| mahjong | 55 | 1.001 | 35 | 1.007 |
| homerun | 52 | 1.001 | 21 | 1.001 |
| freekick | 47 | 1.002 | 32 | 1.009 |
| racing | 13 | 0.998 | 8 | 0.997 |
| freecell | 45 | 1.002 | 18 | 1.002 |
| tripeaks | 51 | 1.001 | 34 | 1.000 |
| fivehands | 44 | 1.003 | 20 | 1.005 |
| pyramid | 45 | 1.001 | 29 | 1.006 |
| minigolf | 50 | 1.000 | 33 | 1.003 |
| bastion | 57 | 1.001 | 43 | 1.002 |
| pool | 57 | 1.002 | 45 | 1.006 |
| curling | 51 | 1.001 | 45 | 1.006 |
| blockfall | 56 | 1.000 | 48 | 1.003 |
| alleyroll | 46 | 0.999 | 24 | 1.000 |
| ricochet | 58 | 0.999 | 42 | 1.004 |
| tendrop | 57 | 1.000 | 53 | 1.002 |
| stroop | 56 | 1.001 | 45 | 1.003 |
| whack | 59 | 1.000 | 55 | 1.000 |
| clayshoot | 59 | 1.000 | 55 | 1.000 |

The stage catches up up to 12 ticks a frame, so even at 8 fps (Apex at 6×) the sim keeps real time: at both slowdowns
every game's sim time is within about 1 % of wall time but Hover's (3.4 % behind at both rates), and the few readings
above 1 (Spacewalk and Roofbound at 6×) are a stall caught up inside the measured span. A slow phone therefore doesn't stretch a run's wall time; the longest legitimate runs are the run's
length plus the intro and any time hidden. The 1.3 × + 15 s line leaves a wide margin over that (a 120 s run: 171 s).
Letterfall (retired) isn't on the Practice list's shelves, so the tool doesn't reach it.
