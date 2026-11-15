# Game frame and effects kit: gallery

Phase 2, step 4 (15 Nov 2026). Before = main (dd9acbe6), after = this branch. Drawn through the screens harness
(fixed clock, stubbed server; `frame-shots`, the same screens theme-check uses). Guide: [../../game-fx/README.md](../../game-fx/README.md).

## Effects (clips, /dev-design → Effects)

Each clip plays tap, pick up / drop, slide, pour, match, wrong, combo ×4, near miss and win, then the round-end payoff
(count-up, stars landing, new best).

| Variant | Clip |
|---|---|
| Full | [effects-full.webm](effects-full.webm) |
| Lite (reduced effects, battery saver) | [effects-lite.webm](effects-lite.webm) |
| Reduced motion | [effects-reduced.webm](effects-reduced.webm) |
| Calm (celebrations off; payoff kinds only) | [effects-calm.webm](effects-calm.webm) |

![The showcase](effects-showcase.webp)

## In play: phone

| | Before | After |
|---|---|---|
| Practice, puzzle (Box Six) | ![](practice-puzzle-phone-before.webp) | ![](practice-puzzle-phone-after.webp) |
| Practice, arcade (Meteor) | ![](practice-arcade-phone-before.webp) | ![](practice-arcade-phone-after.webp) |
| Room, puzzle | ![](room-puzzle-phone-before.webp) | ![](room-puzzle-phone-after.webp) |
| Room, arcade | ![](room-arcade-phone-before.webp) | ![](room-arcade-phone-after.webp) |

The header keeps its 60 px and every box its place (no board, world or control moves); secondary lines in text 2,
status pills as solid surface chips.

## In play: computer (1600 × 900)

| | Before | After |
|---|---|---|
| Practice, puzzle: the arena panel | ![](practice-puzzle-desktop-before.webp) | ![](practice-puzzle-desktop-after.webp) |
| Practice, arcade: the arena panel | ![](practice-arcade-desktop-before.webp) | ![](practice-arcade-desktop-after.webp) |
| Room, puzzle (room panel, unchanged) | ![](room-puzzle-desktop-before.webp) | ![](room-puzzle-desktop-after.webp) |
| Room, arcade | ![](room-arcade-desktop-before.webp) | ![](room-arcade-desktop-after.webp) |

The panel appears only where the space right of the centred column holds it (puzzles from 1452 px, tall arcade
worlds from 1332 px). The stub clock is frozen, so the time reads as the harness left it.

## Results (phone)

| | Before | After |
|---|---|---|
| Round leaderboard | ![](results-leaderboard-phone-before.webp) | ![](results-leaderboard-phone-after.webp) |
| Final results, two players | ![](results-final-phone-before.webp) | ![](results-final-phone-after.webp) |

The payoff is motion (count-up, the winner's `win`, stars, new best), so the stills look alike: see the clips. Score
bars now fill by scale rather than width.
