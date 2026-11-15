# Pattern overhaul: gallery

Phase 2 step 4 (15 Nov 2026). Before (main) and after for each of the eight Pattern games at 390 × 844, and short
clips of the hero effects. Images are in this folder.

<!-- Each game's section is between its own markers. -->

<!-- gridlock:start -->
## Gridlock

| Before (main) | After |
|---|---|
| <img src="../../game-reviews/img/pattern/unblock-1-start.webp" width="180"> | <img src="unblock-after-intro.webp" width="180"> |
| <img src="../../game-reviews/img/pattern/unblock-2-mid.webp" width="180"> | <img src="unblock-after-play.webp" width="180"> |
| <img src="../../game-reviews/img/pattern/unblock-3-end.webp" width="180"> | <img src="unblock-after-reveal-solution.webp" width="180"> <img src="unblock-after-reveal-yours.webp" width="180"> |

- **Look (A):** the cars and the lot are Blender renders (`docs/design/game-art/pattern/source/unblock.py`,
  `public/pattern-art/unblock/`): glossy painted toy cars in six muted bodies (blue, teal, red, violet, green, silver),
  2-long saloons and 3-long vans, each rendered horizontal and vertical so the light stays top left; the gold car is the
  only gold thing on the lot (metallic gold with dark pinstripes). The dark lot (kerb, asphalt, worn bay lines) is one
  render; the exit's gold dash and chevrons stay drawn over it. Every image is exactly its vehicle box. No glows.
- **Controls:** Undo and Reset in champagne gold on navy (`--jz-gold`, `--jz-surface-2`).
- **Undo gives the move back (unblockRev 4):** Moves, the par bonus and the stored figure count the slides left on the
  board; the help says so. Older stamps grade as before.
- **Reveal:** under Solution only "Par n" shows; "your moves" is on Yours, which shows the player's real final board,
  unfinished too (the after shot: one slide played, then the clock ran out).
- **Sound:** a short / long scrape by distance (`unblock.slide`, `unblock.slideLong`), a knock when a drag hits the car
  in the way (`unblock.blocked`), a glint when the gold car's lane opens (`unblock.laneClear`); the drive-out is kept.
<!-- gridlock:end -->

<!-- tessellate:start -->
## Tessellate
<!-- tessellate:end -->

<!-- pipeline:start -->
## Pipeline
<!-- pipeline:end -->

<!-- chroma:start -->
## Chroma Lines

| Before (main) | After |
|---|---|
| <img src="../../game-reviews/img/pattern/flow-2-mid.webp" width="180" alt="Chroma Lines before, mid-play"> | <img src="flow-after-play.webp" width="180" alt="Chroma Lines after, mid-play"> |
| <img src="../../game-reviews/img/pattern/flow-1-start.webp" width="180" alt="Chroma Lines before, start"> | <img src="flow-after-intro.webp" width="180" alt="Chroma Lines after, intro"> |
| <img src="../../game-reviews/img/pattern/flow-3-end.webp" width="180" alt="Chroma Lines before, end"> | <img src="flow-after-reveal.webp" width="180" alt="Chroma Lines after, reveal (Solution)"> <img src="flow-after-reveal-yours.webp" width="180" alt="Chroma Lines after, reveal (Yours)"> |

- **Look (A):** every dot is a glossy marble bead rendered in Blender (one per colour, `public/pattern-art/flow/`),
  each with its own white symbol so white/silver and yellow/lime are told apart; walls are hatched steel blocks, cells
  dark recessed slots; the lines keep their vivid colours as rich tubes with no glow.
- **flowRev 3:** drawing over another colour cuts that line back to the square before the crossing (the server grades
  the board by the same rule); a stray touch on a finished dot no longer wipes its line (only a drag restarts it).
- **Pills:** "Pairs 0 / 11" beside "Filled 8 / 78".
- **Reveal:** the player's own count reads "You: 0/11 pairs on route" and shows only under Yours.
- **Sound:** the line's tone rises as it grows (`flow.draw`), a cut (`flow.cut`), one sound for a join
  (`flow.connect`, the extra `correct` dropped), a near-miss hint (`flow.nearMiss`) and the solve (`flow.solve`).
<!-- chroma:end -->

<!-- skid:start -->
## Skid
<!-- skid:end -->

<!-- heave:start -->
## Heave

| Before (main) | After |
|---|---|
| <img src="../../game-reviews/img/pattern/push-1-start.webp" width="180" alt="Heave before, start"> | <img src="push-after-intro.webp" width="180" alt="Heave after, intro"> |
| <img src="../../game-reviews/img/pattern/push-2-mid.webp" width="180" alt="Heave before, mid-play"> | <img src="push-after-play.webp" width="180" alt="Heave after, mid-play"> |
| <img src="../../game-reviews/img/pattern/push-3-end.webp" width="180" alt="Heave before, end"> | <img src="push-after-reveal.webp" width="180" alt="Heave after, reveal"> |

- **Look (A):** every tile and piece is a Blender render, one cell each (`docs/design/game-art/pattern/source/push.py`,
  `public/pattern-art/push/`, 10 WebPs, 35 KB): brick wall tops whose courses run on from cell to cell, worn stone
  flags, dark painted marks with light tape corners, wooden crates, and the gold crate and gold mark in real gold. The
  worker (white hard hat, orange hi-vis vest, navy arms reaching to push) is rendered once per facing, so the light
  stays top left as it turns. A crate on a mark carries a bold green tick; no glows anywhere.
- **Pushes and Par** are the pills during play (Pushes red once over par); par is the fewest pushes, looked up on the
  phone from the dealt layout (`pushPar.ts`, a count only, never the route). The Moves pill made way for it.
- **Undo** always gave the push back; the help now says so, and where the arrows / swipe choice lives.
- **Controls:** Undo and Reset in champagne gold on navy.
- **Reveal:** under the minimum solution playing back, the player's own count reads "You: 0 / 5 home".
- **Sound:** the gold crate pushed off its mark (`push.goldOff`), a slot for the deadlock creak (`push.stuck`), and
  lines for the footstep, the crate's scrape and the lights coming on at the solve.
- No stamp: nothing Heave deals or grades changed.
<!-- heave:end -->

<!-- lightbender:start -->
## Lightbender
<!-- lightbender:end -->

<!-- topsy:start -->
## Topsy-Turvy
<!-- topsy:end -->
