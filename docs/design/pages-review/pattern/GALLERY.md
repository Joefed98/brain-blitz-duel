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

**The look: today | concept A | new** (mid-play, same scale)

| Today | Concept A | New |
|---|---|---|
| <img src="../../game-reviews/img/pattern/blockparty-2-mid.webp" width="180"> | <img src="blockparty-concept-A.webp" width="180"> | <img src="blockparty-after-play.webp" width="180"> |

The richness pass (sprite.py's rich studio): polished brass studs with a mirror highlight on the dome, lacquered
blocks with a hard clear coat (one crisp highlight on the bevel, depth down the sides, today's saturated colours: the
pieces render on the Standard view transform at a lower key, since AgX turned them pastel), satin recessed wells.

| | Before | After |
|---|---|---|
| Start / intro | <img src="../../game-reviews/img/pattern/blockparty-1-start.webp" width="180"> | <img src="blockparty-after-intro.webp" width="180"> |
| Mid-play | <img src="../../game-reviews/img/pattern/blockparty-2-mid.webp" width="180"> | <img src="blockparty-after-play.webp" width="180"> |
| Round end | <img src="../../game-reviews/img/pattern/blockparty-3-end.webp" width="180"> | <img src="blockparty-after-reveal.webp" width="180"> |

**The answer reveal** (390 × 844)

| Before, unfinished | After, unfinished (Yours) | After, solved (Yours) | After, Solution |
|---|---|---|---|
| <img src="blockparty-reveal-before-unfinished.webp" width="160"> | <img src="blockparty-reveal-after-unfinished.webp" width="160"> | <img src="blockparty-reveal-after-solved.webp" width="160"> | <img src="blockparty-after-reveal.webp" width="160"> |

- The solution drawn at full width (each board the reveal fit's own target, and a caption under it: with only a
  board in the shown view the fit had drawn it at half size).
- Under Yours: pieces off every solution spot outlined red, squares left empty dashed, a one-line key; pills from the
  stored grade: Pieces placed, Off the solution, Squares empty, Illegal drops (blockRev 4; Right first time on older
  rounds), Time left on a solve. No stray "×"; nothing under Solution but the board and its caption.

- **Look A** in Blender sprites (`public/pattern-art/blockparty/`, source `docs/design/game-art/pattern/source/blockparty.py`):
  brass studs for the pegs, satin recesses for the free squares, a glossy lacquered block for every square of a piece
  in today's nine colours, on a dark slab and tray. One image per board cell, exactly the cell's box (no hit area moved).
- **A double tap only flips**: a tap's turn waits out the 260 ms double-tap window, so the piece never turns first.
- **Undo and Reset** (blockRev 4), navy with champagne-gold icons: Undo gives the last move back, Reset sends every
  piece to the tray (Undo brings the board back).
- **Clean drops** (blockRev 4): moving a placed piece no longer costs the bonus; only a drop where a piece won't fit
  does (one piece's share each).
- **Help**: the flip, Undo and Reset are explained; "Drag a piece's anchor" is gone.
- **Reveal**: see the answer reveal above.
- **Tray**: the widest piece fits its own column (a four-long bar used to run over its neighbour once pieces were placed).
- **Sounds**: pick-up, illegal drop (a dull thud as the piece goes back; it was silent), Undo and Reset now sound.
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

**The play frame: today | concept A | new** (same scale)

| Today (main) | Concept A | New |
|---|---|---|
| <img src="../../game-reviews/img/pattern/iceslide-2-mid.webp" width="180"> | <img src="iceslide-concept-A.webp" width="180"> | <img src="iceslide-after-play.webp" width="180"> |

**Intro** (the example board in the new art): <img src="iceslide-after-intro.webp" width="180">

**The answer reveal: before | after**

| Before (main, unfinished) | After, unfinished: Solution | After, unfinished: Yours |
|---|---|---|
| <img src="../../game-reviews/img/pattern/iceslide-3-end.webp" width="180"> | <img src="iceslide-reveal-after-unfinished-solution.webp" width="180"> | <img src="iceslide-reveal-after-unfinished-yours.webp" width="180"> |

| After, solved: Solution | After, solved: Yours |
|---|---|
| <img src="iceslide-reveal-after-solved-solution.webp" width="180"> | <img src="iceslide-reveal-after-solved-yours.webp" width="180"> |

(Main had no solved-reveal shot in the review; its solved reveal is the same single board as the unfinished one, plus a
"n moves (fewest m)" line.)

- **Look (A, the richness pass):** every piece is a Blender render under the rich studio light
  (`docs/design/game-art/pattern/source/iceslide.py`, `public/pattern-art/iceslide/`, 13 images, 56 KB):
  - The ice is a clear-coated sheet over crystalline facets, each a slightly different blue, with flakes that catch
    the key light as sparkles.
  - The blocks are polished speckled granite.
  - The ball is deep-blue enamel over steel under a clear coat, with one crisp highlight.
  - The portals are a glossy magenta and a glossy teal enamel ring. The chevrons are navy lacquer on frosted plates.
  - Thin ice is clouded grey-blue with white cracks; the exit is a polished gold plate.
  - Each image is exactly its cell. There is no glow on any piece.
- **Controls:** the arrow pad, Undo and Reset in champagne gold on navy (`--jz-gold`, `--jz-surface-2`).
- **Undo gives the slide back (slideRev 5):**
  - The Slides pill, the par bonus and the stored figure count the slides still standing.
  - Unfinished credit still counts every slide played, so wandering and undoing never earns credit.
  - Older stamps grade as before.
- **A slide into a wall** costs nothing and gives a tiny bump (`iceslide.bump`). One slide from the exit at par, the
  exit glows softly (`iceslide.nearExit`).
- **Reveal (every stamp):** a Solution / Yours switch, one large board at a time.
  - Solution: the shortest route drawn on the rink, "Shortest route · n slides" and the par route as arrow chips (the
    arrow tiles' renders).
  - Yours: the player's own final board (the ball where it stopped, the slides left standing, the ice it broke) with a
    red ring on every square where the ball fell. Below it, pills from the stored grade: You · Par · Falls ·
    From the exit (unfinished) · Time left (solved). Then the player's slides against the par route as two rows of
    arrow chips.
- **Help and intro:** the arrow pad ("Swipe or tap an arrow") is named apart from the chevron tiles ("Chevron tiles turn
  you; holes send you back to the start"). Undo gives the slide back. The arrow pad or swipe is chosen in the game menu
  (⋮) or Settings → Game controls.
- **Intro demo:** a demo recorded before slideRev 5 is stopped; the intro shows its example board.
- **Sound:** a short or long ice hiss by distance (`iceslide.slide`, `iceslide.slideLong`), a thump when the ball
  stops (`iceslide.stop`), the bump and the near-exit shimmer. Crack, portal, fall and the exit shatter are kept.
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

| | Before (main) | After |
|---|---|---|
| Start / intro | <img src="../../game-reviews/img/pattern/laser-1-start.webp" width="180"> | <img src="laser-after-intro.webp" width="180"> |
| Mid-play (a shot) | <img src="../../game-reviews/img/pattern/laser-2-mid.webp" width="180"> | <img src="laser-after-play.webp" width="180"> |
| Out of shots | — (only "Fires left: 0") | <img src="laser-after-out-of-shots.webp" width="180"> |
| Reveal, unfinished | <img src="laser-reveal-before-unfinished.webp" width="180"> | <img src="laser-reveal-after-unfinished-yours.webp" width="180"> |
| Reveal, solved | (no solved "before" in the review) | <img src="laser-reveal-after-solved.webp" width="180"> <img src="laser-reveal-after-solved-yours.webp" width="180"> |

- **Look (A):** Blender sprites (`docs/design/game-art/pattern/source/laser.py`, `public/pattern-art/laser/`, 10 files,
  34 KB): graphite floor plates, terracotta brick walls, silvered glass mirrors on both diagonals, a violet glass
  splitter under its white split arrows, cut crystal gems (cool smoky crystal dark, burning gold when lit; a gem lit
  from one side only is drawn smaller with a bold arrow on its side), round black bombs with a red band (red hot when
  hit) and a gunmetal emitter turned to the beam. The beam is a solid golden line with a pale core: no blurred neon
  copy, halo or glows (batch P's beam, cell and gem glows removed).
- **Undo takes back any change (laserRev 4):** a place, turn, move, removal or Reset, with the ordinary log verbs, so
  grading is unchanged (no moves are counted; laserRev 4 grades exactly as 3). Older stamps: Undo removes the last
  placed piece, as before.
- **Out of shots (laserRev 4):** after the third missed shot the board dims, says "Out of shots" and takes no more
  changes; "Shots left" is a big figure, gold at 0. The Gems pill keeps the best shot; Par shows in play.
- **Controls:** Undo and Reset in champagne gold on navy; Fire stays the gold primary.
- **Reveal:** one large board at a time (Solution / Yours). Yours draws the solving shot, else the best shot as the
  board stood at that FIRE, with its beam; red squares on pieces not in the solution, the solution's mirror ghosted in
  gold dashes where it was missing, red rings on gems left dark, a short key. The numbers come from the stored grade
  ("Gems 0/6 · Shots 3/3 · Par 8"; on a solve "Mirrors 8 · Par 8 · Time left 49 s"), with a strip of the shots (gem
  dots, a bomb). The "Missed" line under the solution is gone; the player's line is "You: …" under Yours.
- **Sound:** a near miss (5 of 6) plays `laser.nearMiss` in place of `wrong`, a bomb only `laser.bomb`, out of shots
  `laser.outOfShots` (library stand-ins); place, turn and fire keep their November placeholders; the gem notes kept.
<!-- lightbender:end -->

<!-- topsy:start -->
## Topsy-Turvy

| | Before (main) | After |
|---|---|---|
| Mid-play | <img src="../../game-reviews/img/pattern/gravity-2-mid.webp" width="180"> | <img src="gravity-after-play.webp" width="180"> |
| Reveal, unfinished | <img src="../../game-reviews/img/pattern/gravity-3-end.webp" width="180"> | <img src="gravity-reveal-after-unfinished.webp" width="180"> |
| Reveal, solved | (no solved shot on main: its dev server would not start here) | <img src="gravity-reveal-after-solved.webp" width="180"> |

- **Look (A):** Blender sprites (`docs/design/game-art/pattern/source/gravity.py`, `public/pattern-art/gravity/`): grey
  honed-stone blocks, a dark slate floor, a glossy glass marble per ball colour and a cup rimmed in each ball's own
  colour (so every hole plainly belongs to one ball), inside a gunmetal tray frame. The marks stay drawn on the balls
  and in the cups. A ball home sits sunk in its cup. No glows round balls or holes. Undo and Reset gold on navy.
- **gravityRev 8:** each board's tilt limit is its fewest tilts + 8 (it was about twice what anyone needs); Undo and
  Reset give the tilt back. The Tilts pill is the board's own count against that board's par; Left counts down.
- **A tilt that moves nothing:** a small lean, no sound, no draft.
- **Clock:** the catalogue says the dealt 120 s (stored four-ball rounds keep 90 s).
- **Reveal:** one board at a time, large, with a Board 1 / 2 / 3 switcher (opening where you stopped, a tick on cleared
  boards); the board as you left it, balls not home and their empty cups ringed red; "Cleared / Out of tilts · You n
  tilts · Par p · n of 6 home"; the board's par route as gold arrow chips; key numbers from the stored grade (Boards,
  Home, You, Par, Time left).
- **Sound:** a looped marble rumble for exactly as long as the balls roll, a click as each stops, a pip as each drops
  home (a combo for two or more), a board-cleared sound, a closing clunk when a board runs out of tilts (library
  stand-ins until Joe's files).
<!-- topsy:end -->
