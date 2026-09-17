# Split between-round results into two screens

## Goal
After each answer reveal, show the round outcome first, then the updated overall standings. Keep all puzzle scoring, answer grading, and round order unchanged.

## Sequence and timing
- Keep the existing answer reveal unchanged.
- Reuse the current `result` phase for **Screen A: ROUND RESULTS** so existing rooms remain compatible.
- Add a `standings` phase for **Screen B: OVERALL STANDINGS**.
- Screen A lasts 8 seconds. The host can advance it immediately with **Next**.
- Screen B lasts 10 seconds. The host can advance it immediately with **Next**.
- Non-host players see the shared countdown and follow the host/server transition.
- After rounds 1–5: `reveal → result → standings → next round intro`.
- After round 6: `reveal → result → existing final podium/result`; do not show Screen B.
- Make each server transition guarded and idempotent so simultaneous device requests cannot skip a screen.

## Screen A — Round results
- Header: `Round N · Puzzle name`, appending the existing correct-answer text only when that puzzle supplies one.
- Add a compact `1 of 2` corner indicator. On the final round, label it `Final round` because no second between-round screen follows.
- In rooms with 3–10 players, show every non-left player ordered by round points descending, then quicker round time, then stable player slot.
- Each compact row shows rank, name, elapsed answer time, large monospace round points, summary, and status.
- Mark every player tied for the highest positive round score in gold with `ROUND WON`; tint the viewer’s row gold independently.
- Truncate long summaries to one line. Tapping a row expands its complete summary/detail while keeping the default 10-player view scroll-free.
- Missing submissions show `—` for time and the existing `No answer` summary.
- In two-player rooms, retain the VS card layout and add both players’ elapsed times, complete summaries, and round points. Do not show running totals on this screen.

## Screen B — Overall standings
- Header: `After round N of 6` with a compact `2 of 2` indicator.
- In rooms with 3–10 players, use the existing overall ordering and tie-break: running total descending, then quicker combined answer time.
- Each row shows rank, name, large monospace total, small `+round points`, and `▲N`, `▼N`, or `–` versus the previous overall standings.
- Tint the viewer’s row gold and grey inactive players.
- Preserve the FLIP-style movement by first laying rows out in their previous order, then animating them to the new order when Screen B opens.
- In two-player rooms, retain a VS layout showing both running totals, each round increment, and each position-change marker.

## Compact mobile layout
- Use fixed compact headers, flexible row tracks, and reduced row padding/font spacing before omitting any requested information.
- Size the result list for all 10 rows plus the footer action within 390×700; use the same constraints for 375×667.
- Expansion may temporarily use more vertical room, but the closed default state remains fully visible without scrolling.

## Technical details
- Extend the shared phase type with `standings`; no database schema change is required because the stored phase is already text.
- Add distinct 8-second and 10-second constants and use them on both client and server.
- Change the result-screen **Next** action to an authenticated host-only immediate phase advance. Timed advancement remains available as a fallback from another active device if the host stalls.
- Treat both `result` and `standings` as completed-round states for totals, reveal access, and round pips.
- Derive display time from the puzzle’s actual time limit and stored remaining time; use stored reaction average for reaction rounds.
- Reuse existing server-produced `roundSummary`, detail lines, statuses, animated score, sounds, and final podium/result.

## Validation
- Add focused tests for round-score ordering, time formatting, position deltas, and previous-order animation input.
- Run TypeScript, focused lint, relevant unit tests, source assertions, and inspect the preview build log.
- Do not run browser tests.
