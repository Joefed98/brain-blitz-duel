# Game frame, arena and effects kit: gallery

Phase 2, step 4 (pass 3, 15 Nov 2026). Before = main (1c9a5edf), after = this branch; the phone-gap rows compare
pass 2 with pass 3. Drawn through the screens
harness (fixed clock, stubbed server); the computer clip on the dev server. Guide:
[../../game-fx/README.md](../../game-fx/README.md). The room shots' harness clock has run out, so their timers read 0.

## The arena on a computer (clip)

Breaker in practice at 1440 × 900, played with the arrow keys: the world fills the height, the side panel carries the
game, the timer bar, the best, the goal and the Controls tab.

![Breaker in the arena](arena-computer-breaker.webp)

## The game timer (Settings → Appearance → Game timer)

The header is one design; the timer is the player's choice. Bar is the default: a gold bar along the header's foot,
no seconds for most of the round, red with the seconds in the last 10 s; the time is always in its accessible label.
Every choice keeps the header's 60 px. Also on `/dev-design` → Game timer.

![Bar, ring and chip, with the last ten seconds](timer-options.webp)

| Choice | Practice | A room (one-on-one) | The computer's side panel |
|---|---|---|---|
| Bar (default) | ![](timer-bar-practice-phone-after.webp) | ![](timer-bar-room-phone-after.webp) | ![](timer-bar-panel-desktop-after.webp) |
| Ring | ![](timer-ring-practice-phone-after.webp) | ![](timer-ring-room-phone-after.webp) | ![](timer-ring-panel-desktop-after.webp) |
| Chip | ![](timer-chip-practice-phone-after.webp) | ![](timer-chip-room-phone-after.webp) | ![](timer-chip-panel-desktop-after.webp) |

![Settings → Appearance](timer-setting-phone-after.webp)

## The side panel (computer, 1600 × 900)

Below the timer, each only when the game has it: the score (in practice, the best), this game's stars, the board's
progress and status pills (moved off the board, so each number shows once), the goal, the next challenges in
progress; the Controls tab at the foot.

| Colour Flood (moves, par, progress) | Polypotions (pours, par) | Mosaic (progress only) | Meteor (arcade) |
|---|---|---|---|
| ![](panel-flood-desktop-after.webp) | ![](panel-tubes-desktop-after.webp) | ![](panel-nonogram-desktop-after.webp) | ![](practice-arcade-desktop-after.webp) |

## Phones: no dead band (pass 2 → pass 3)

The board and its controls sit together at the bottom, in thumb reach; the spare height is above the board.
`phone-gap-check` proves it on every puzzle at 360, 375, 390 and 430 px wide.

| | 360 × 780 before | 360 × 780 after | 430 × 932 before | 430 × 932 after |
|---|---|---|---|---|
| Grid (Box Six) | ![](gap-sudoku-360-before.webp) | ![](gap-sudoku-360-after.webp) | ![](gap-sudoku-430-before.webp) | ![](gap-sudoku-430-after.webp) |
| Word keypad (Cryptogrid) | ![](gap-codeword-360-before.webp) | ![](gap-codeword-360-after.webp) | ![](gap-codeword-430-before.webp) | ![](gap-codeword-430-after.webp) |
| Number pad (Kakuro) | ![](gap-kakuro-360-before.webp) | ![](gap-kakuro-360-after.webp) | ![](gap-kakuro-430-before.webp) | ![](gap-kakuro-430-after.webp) |
| Drag (Gridlock) | ![](gap-unblock-360-before.webp) | ![](gap-unblock-360-after.webp) | ![](gap-unblock-430-before.webp) | ![](gap-unblock-430-after.webp) |

## Phone (390 × 844)

| | Before | After |
|---|---|---|
| Practice, puzzle (Box Six) | ![](practice-puzzle-phone-before.webp) | ![](practice-puzzle-phone-after.webp) |
| Practice, arcade (Meteor) | ![](practice-arcade-phone-before.webp) | ![](practice-arcade-phone-after.webp) |
| Room, puzzle (one-on-one) | ![](room-puzzle-phone-before.webp) | ![](room-puzzle-phone-after.webp) |
| Room, arcade | ![](room-arcade-phone-before.webp) | ![](room-arcade-phone-after.webp) |

## Sideways tablet (1180 × 820, touch): the arena

| | Before | After |
|---|---|---|
| Practice, puzzle | ![](practice-puzzle-tablet-before.webp) | ![](practice-puzzle-tablet-after.webp) |
| Practice, arcade | ![](practice-arcade-tablet-before.webp) | ![](practice-arcade-tablet-after.webp) |
| Room, puzzle | ![](room-puzzle-tablet-before.webp) | ![](room-puzzle-tablet-after.webp) |
| Room, arcade | ![](room-arcade-tablet-before.webp) | ![](room-arcade-tablet-after.webp) |

## Computer (1600 × 900): the arena

| | Before | After |
|---|---|---|
| Practice, puzzle | ![](practice-puzzle-desktop-before.webp) | ![](practice-puzzle-desktop-after.webp) |
| Practice, arcade | ![](practice-arcade-desktop-before.webp) | ![](practice-arcade-desktop-after.webp) |
| Room, puzzle (room panel with the game's block) | ![](room-puzzle-desktop-before.webp) | ![](room-puzzle-desktop-after.webp) |
| Room, arcade | ![](room-arcade-desktop-before.webp) | ![](room-arcade-desktop-after.webp) |

## Reveal and result screens (phone)

| | Before | After |
|---|---|---|
| Reveal, puzzle (room) | ![](reveal-puzzle-room-phone-before.webp) | ![](reveal-puzzle-room-phone-after.webp) |
| Reveal, arcade (room) | ![](reveal-arcade-room-phone-before.webp) | ![](reveal-arcade-room-phone-after.webp) |
| Round leaderboard | ![](results-leaderboard-phone-before.webp) | ![](results-leaderboard-phone-after.webp) |
| Final results, two players | ![](results-final-phone-before.webp) | ![](results-final-phone-after.webp) |

Practice's reveal adds the game's three stars (landing), "Star earned" and the new-best badge above the result; the
payoff is motion, so see the effects clips below.

## Effects (clips, /dev-design → Effects)

| Variant | Clip |
|---|---|
| Full | [effects-full.mp4](effects-full.mp4) |
| Lite (reduced effects, battery saver) | [effects-lite.mp4](effects-lite.mp4) |
| Reduced motion | [effects-reduced.mp4](effects-reduced.mp4) |
| Calm (celebrations off; payoff kinds only) | [effects-calm.mp4](effects-calm.mp4) |

![The showcase](effects-showcase.webp)
