# Pattern overhaul: gallery

Phase 2 step 4 (15 Nov 2026). Before (main) and after for each of the eight Pattern games at 390 × 844, and short
clips of the hero effects. Images are in this folder.

<!-- Each game's section is between its own markers. -->

<!-- gridlock:start -->
## Gridlock
<!-- gridlock:end -->

<!-- tessellate:start -->
## Tessellate
<!-- tessellate:end -->

<!-- pipeline:start -->
## Pipeline

| | Before (main) | After |
|---|---|---|
| Start / intro | <img src="../../game-reviews/img/pattern/pipes-1-start.webp" width="180"> | <img src="pipes-after-intro.webp" width="180"> |
| Mid-play | <img src="../../game-reviews/img/pattern/pipes-2-mid.webp" width="180"> | <img src="pipes-after-play.webp" width="180"> |
| Reveal | <img src="../../game-reviews/img/pattern/pipes-3-end.webp" width="180"> | <img src="pipes-after-reveal.webp" width="180"> |

- **Look**: Blender sprites (`docs/design/game-art/pattern/source/pipes.py`, `public/pattern-art/pipes/`, 13 files,
  55 KB): chrome pipes on dark tiles, each shape (end, straight, corner, tee, cross) rendered dry (plain chrome) and wet
  (blue water in sight-glass runs), turned by a CSS transform under even overhead light; the red source valve; no glow
  round the network (batch P's blue tile rims and drop shadows removed).
- **Leaks live** (pipesRev 5): water spills from every open end the water reaches, in play, the intro and the reveal.
- **Turns both ways** (pipesRev 5): a tap turns clockwise, a long press (380 ms), a swipe (14 px) or a right click
  anticlockwise; the log carries `-cell`; par is the fewest turns either way.
- **Turns / Par** sit directly under the board (were at the screen's bottom with a gap).
- **Reveal**: the player's line is Yours-only ("You: 12 / 49 connected"), no "×".
- **Sounds**: `pipes.combo` (6+ joined), `pipes.drain` (a turn that cuts pipes off), `pipes.bubble` (the source on the
  solve) added on library placeholders; `pipes.rotate` fires for both directions.
<!-- pipeline:end -->

<!-- chroma:start -->
## Chroma Lines
<!-- chroma:end -->

<!-- skid:start -->
## Skid
<!-- skid:end -->

<!-- heave:start -->
## Heave
<!-- heave:end -->

<!-- lightbender:start -->
## Lightbender
<!-- lightbender:end -->

<!-- topsy:start -->
## Topsy-Turvy
<!-- topsy:end -->
