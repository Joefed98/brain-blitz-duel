# Number polish: before and after (13 Oct 2026)

Drawing, layout and effects for the nine Number games. No sim, rule, scoring or stamp changes.
"Before" is `main` at eb143ad; "after" is this branch with all nine games merged.

Made with `scripts/shots/number-polish-shots.ts` (drivers in `scripts/shots/drivers/`): a local `vite dev`
server, Playwright driving the pre-installed Chromium at device scale 1, `/practice` with the generate request
rewritten to `example: true` (the fixed intro example) and `Math.random` seeded, so before and after show the
same puzzle. The #9 capture scripts lived outside the repo, so this one follows the same method and is kept here.

Each sheet: top row before, bottom row after.
- **intro**: the RoundIntro about 2.5 s in (Supabase is unreachable from the container, so intro demos show the app's fallback).
- **mid-play**: after Ready and a few scripted moves.
- **completion**: the driver solves the example; the frame is taken 200–450 ms after the solving move. Practice's
  grade request is held back 1.6 s by the capture script (only there) so the stage is still up to photograph.
  The "before" column shows the old stage at that moment (there was no completion effect).
- **reveal**: the AnswerReveal about 1.5 s after the server score arrives (a solved round).

| Game | 375 × 667 | 390 × 844 |
|---|---|---|
| Exact | [sheet](target-375x667.jpg) | [sheet](target-390x844.jpg) |
| Operator | [sheet](equation-375x667.jpg) | [sheet](equation-390x844.jpg) |
| Counterweight | [sheet](balance-375x667.jpg) | [sheet](balance-390x844.jpg) |
| Integer Pyramid | [sheet](numpyramid-375x667.jpg) | [sheet](numpyramid-390x844.jpg) |
| Trail | [sheet](trail-375x667.jpg) | [sheet](trail-390x844.jpg) |
| Brimful | [sheet](measure-375x667.jpg) | [sheet](measure-390x844.jpg) |
| Checkout | [sheet](checkout-375x667.jpg) | [sheet](checkout-390x844.jpg) |
| Ballpark | [sheet](numline-375x667.jpg) | [sheet](numline-390x844.jpg) |
| Tenfall | [sheet](tendrop-375x667.jpg) | [sheet](tendrop-390x844.jpg) |

## Arena gaps (px above / below the play area, before → after)

"Above" is the painted play area's top minus the game region's top (just below the timer); "below" is the first
control block under it (or the region's bottom) minus the play area's bottom. Painted = any non-control element
with a background, border, text, SVG shape or canvas. Measured at the start of play.

| Game | 375 × 667 | 390 × 844 | 430 × 932 |
|---|---|---|---|
| Exact | 48/12 → 12/12 | 137/12 → 12/12 | 181/12 → 12/12 |
| Operator | 114/12 → 12/12 | 203/12 → 12/12 | 247/12 → 12/12 |
| Checkout | 2/10 → 4/4 | 2/10 → 4/4 | 2/10 → 4/4 |
| Brimful | 2/4 → 2/4 | 2/4 → 2/4 | 2/4 → 2/4 |
| Integer Pyramid | 24/12 → 17/19 | 108/12 → 101/103 | 134/12 → 127/129 |
| Trail | 54/12 → 56/60 | 133/12 → 135/139 | 174/12 → 161/165 |
| Ballpark | 2/157 → 117/117 | 2/164 → 194/194 | 2/184 → 233/233 |
| Counterweight | 122/45 → 12/12 | 122/45 → 12/12 | 122/45 → 12/12 |
| Tenfall | 8/0 → 0/0 | 54/46 → 46/46 | 68/60 → 60/60 |

Integer Pyramid, Trail and Ballpark are width-limited (already as large as fits), so the spare height is shared
equally above and below. Tenfall's 0/0 at 375 × 667 means its board fills the region.

## Reveal at 375 × 667 (before → after)

| Game | Fits, no scroll | Smallest text |
|---|---|---|
| Exact | yes → yes | 14 → 14 px |
| Operator | yes → yes | 14 → 14 px |
| Counterweight | **no → yes** | 14 → 14 px |
| Integer Pyramid | **no → yes** | 7.6 → 12 px |
| Trail | yes → yes | 9.6 → 12 px |
| Brimful | yes → yes | 14 → 14 px |
| Checkout | yes → yes | 14 → 14 px |
| Ballpark | yes → yes | 9 → 12 px |
| Tenfall (shared ArcadeReveal) | yes → yes | 10 → 10 px (shared chrome, not changed) |

The 12 px minimums are board labels (pyramid and trail cells, ruler labels); body text is 14 px or more. The
script's contrast reading is not reliable: it cannot parse the theme's `oklch()` colours, and its lowest real
value (2.68) is the shared "ROUND 1 OF 6" label above every reveal, which is not part of these games. Text inside
the games' own reveals was set to at least 4.5:1 by hand.
