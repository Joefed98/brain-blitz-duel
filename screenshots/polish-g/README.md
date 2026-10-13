# Polish G: before and after (12–13 Oct 2026)

Drawing-only polish for Gemstone (`matchup`), Grappler (`swing`), Roofbound (`flip`), Tempo (`beat`),
Wavefront (`wavefront`), Tilt (`tilt`) and Slice (`slice`), and distinct Retro border lights for Rally,
Breaker and Hover. No sim, scoring, rules or stamp changes. "Before" is `main` at 1551114; "after" is this branch.

## Seven games

Captured from a local `vite dev` server with Playwright driving the pre-installed Chromium at 390 × 700
(device scale 1). Each game was opened from `/practice` with the generate request rewritten to
`example: true` (the fixed intro example) and `Math.random` seeded, so before and after show the same puzzle.

- `-intro`: the RoundIntro screen about 2.5 s after it opens (Supabase is unreachable from the container,
  so intro demos show the app's fallback).
- `-play`: after Ready, following scripted inputs (8 s for most games; Wavefront 3 s; Grappler 0.5 s and
  Roofbound 1.2 s with no input, since both end quickly without a real player). Inputs are timed by the
  wall clock, so the two runs differ slightly in what is in flight.
- `-reveal`: the AnswerReveal after the run ends (the dimmed final frame behind it).

| Game | Intro | Mid-play | Reveal |
|---|---|---|---|
| Gemstone | [before](matchup-intro-before.png) · [after](matchup-intro-after.png) | [before](matchup-play-before.png) · [after](matchup-play-after.png) | [before](matchup-reveal-before.png) · [after](matchup-reveal-after.png) |
| Grappler | [before](swing-intro-before.png) · [after](swing-intro-after.png) | [before](swing-play-before.png) · [after](swing-play-after.png) | [before](swing-reveal-before.png) · [after](swing-reveal-after.png) |
| Roofbound | [before](flip-intro-before.png) · [after](flip-intro-after.png) | [before](flip-play-before.png) · [after](flip-play-after.png) | [before](flip-reveal-before.png) · [after](flip-reveal-after.png) |
| Tempo | [before](beat-intro-before.png) · [after](beat-intro-after.png) | [before](beat-play-before.png) · [after](beat-play-after.png) | [before](beat-reveal-before.png) · [after](beat-reveal-after.png) |
| Wavefront | [before](wavefront-intro-before.png) · [after](wavefront-intro-after.png) | [before](wavefront-play-before.png) · [after](wavefront-play-after.png) | [before](wavefront-reveal-before.png) · [after](wavefront-reveal-after.png) |
| Tilt | [before](tilt-intro-before.png) · [after](tilt-intro-after.png) | [before](tilt-play-before.png) · [after](tilt-play-after.png) | [before](tilt-reveal-before.png) · [after](tilt-reveal-after.png) |
| Slice | [before](slice-intro-before.png) · [after](slice-intro-after.png) | [before](slice-play-before.png) · [after](slice-play-after.png) | [before](slice-reveal-before.png) · [after](slice-reveal-after.png) |

## Retro border lights

Effects are timing-dependent, so these are rendered in Node (`@napi-rs/canvas`, 2×) through each game's
real renderer: a real mid-run state, one success counter raised, the frame drawn the stated time later.

| Moment | Before (Tuning D star dust) | After (border lights) |
|---|---|---|
| Rally, one paddle hit (cold rally), 120 ms | [before](fx-rally-hit-120ms-before.png) | [after](fx-rally-hit-120ms-after.png) |
| Rally, a hit 30 returns in at speed (hot), 120 ms | [before](fx-rally-hot-120ms-before.png) | [after](fx-rally-hot-120ms-after.png) |
| Rally, RALLY 10 milestone, 200 ms | [before](fx-rally-streak-200ms-before.png) | [after](fx-rally-streak-200ms-after.png) |
| Breaker, row clear, 150 ms | [before](fx-breaker-row-150ms-before.png) | [after](fx-breaker-row-150ms-after.png) |
| Breaker, power-up, 300 ms | [before](fx-breaker-powerup-300ms-before.png) | [after](fx-breaker-powerup-300ms-after.png) |
| Hover, a barrier passed, 120 ms | [before](fx-hover-barrier-120ms-before.png) | [after](fx-hover-barrier-120ms-after.png) |
| Hover, 7th barrier (zone), 330 ms | [before](fx-hover-zone-330ms-before.png) | [after](fx-hover-zone-330ms-after.png) |

Live mid-play shots (border lights only appear on a success, so these mostly show the unchanged art):

| Game | Mid-play |
|---|---|
| Rally | [before](rally-play-before.png) · [after](rally-play-after.png) |
| Breaker | [before](breaker-play-before.png) · [after](breaker-play-after.png) |
| Hover | [before](hover-play-before.png) · [after](hover-play-after.png) |
