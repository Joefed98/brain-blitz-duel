# Polish F: before and after (12 Oct 2026)

Drawing-only polish for Ball Tracker (`balltrack`), Coral Pop (`bubble`), Flightpath (`bullseye`),
Jaywalk (`cross`) and Swish (`bintoss`). No sim, scoring, rules or effects changes.

Captured from a local `vite dev` server with Playwright driving the pre-installed Chromium at
390 × 700 (device scale 1). Each game was opened from `/practice` with the generate request
rewritten to `example: true` (the fixed intro example) and `Math.random` seeded, so before and
after show the same puzzle. "Before" is `main` at 384dfca; "after" is this branch.

- `-intro`: the RoundIntro screen about 2.5 s after it opens.
- `-play`: about 9 s after Ready, after four scripted inputs (flicks for Swish, Flightpath and
  Coral Pop, taps for Ball Tracker; Jaywalk is left on the kerb so the road is in view).
  Inputs are timed by the wall clock, so the two runs differ slightly in what is in flight.
- `-reveal`: the AnswerReveal after the round runs out (the dimmed final frame behind it).

Supabase is unreachable from the container, so intro demos show the app's fallback.

| Game | Intro | Mid-play | Reveal |
|---|---|---|---|
| Ball Tracker | [before](balltrack-intro-before.png) · [after](balltrack-intro-after.png) | [before](balltrack-play-before.png) · [after](balltrack-play-after.png) | [before](balltrack-reveal-before.png) · [after](balltrack-reveal-after.png) |
| Coral Pop | [before](bubble-intro-before.png) · [after](bubble-intro-after.png) | [before](bubble-play-before.png) · [after](bubble-play-after.png) | [before](bubble-reveal-before.png) · [after](bubble-reveal-after.png) |
| Flightpath | [before](bullseye-intro-before.png) · [after](bullseye-intro-after.png) | [before](bullseye-play-before.png) · [after](bullseye-play-after.png) | [before](bullseye-reveal-before.png) · [after](bullseye-reveal-after.png) |
| Jaywalk | [before](cross-intro-before.png) · [after](cross-intro-after.png) | [before](cross-play-before.png) · [after](cross-play-after.png) | [before](cross-reveal-before.png) · [after](cross-reveal-after.png) |
| Swish | [before](bintoss-intro-before.png) · [after](bintoss-intro-after.png) | [before](bintoss-play-before.png) · [after](bintoss-play-after.png) | [before](bintoss-reveal-before.png) · [after](bintoss-reveal-after.png) |
