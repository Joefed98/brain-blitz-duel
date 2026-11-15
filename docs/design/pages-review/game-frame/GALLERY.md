# Game frame, arena and effects kit: gallery

Phase 2, step 4 (pass 2, 15 Nov 2026). Before = main (1c9a5edf), after = this branch. Drawn through the screens
harness (fixed clock, stubbed server); the computer clip on the dev server. Guide:
[../../game-fx/README.md](../../game-fx/README.md). The room shots' harness clock has run out, so their timers read 0.

## The arena on a computer (clip)

Breaker in practice at 1440 × 900, played with the arrow keys: the world fills the height, the side panel carries the
game, the timer bar, the best, the goal and the Controls tab.

![Breaker in the arena](arena-computer-breaker.webp)

## Header and timer options

Pick one; the default is one line in `src/config/gameFrameConfig.ts` (`GAME_HEADER_STYLE`, today `mockup`). Every
style keeps the header's 60 px. Also on `/dev-design` → Header styles, side by side, with "Use in games".

![Mockup, ring, digital, chip](header-options.webp)

| Style | Practice | A room (one-on-one) |
|---|---|---|
| mockup (default) | ![](header-mockup-practice-phone-after.webp) | ![](header-mockup-room-phone-after.webp) |
| ring | ![](header-ring-practice-phone-after.webp) | ![](header-ring-room-phone-after.webp) |
| digital | ![](header-digital-practice-phone-after.webp) | ![](header-digital-room-phone-after.webp) |
| chip | ![](header-chip-practice-phone-after.webp) | ![](header-chip-room-phone-after.webp) |

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
| Full | [effects-full.webm](effects-full.webm) |
| Lite (reduced effects, battery saver) | [effects-lite.webm](effects-lite.webm) |
| Reduced motion | [effects-reduced.webm](effects-reduced.webm) |
| Calm (celebrations off; payoff kinds only) | [effects-calm.webm](effects-calm.webm) |

![The showcase](effects-showcase.webp)
