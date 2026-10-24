# Game look audit (24 Oct 2026, Prompt C)

A report only: no app code, check, CI or data changed. It goes with the contact sheets in
`screenshots/contact-sheet-oct-2026/`:

- `sheet-<category>.png`: one sheet per category (Word, Number, Speed, Attention, Pattern, Logic, Arcade), each frame at 25 %
  with the game's name and id under it;
- `overview.png`: all 73 active games on one sheet;
- `<category>/<game>.png`: the full-size 414×896 frames (DPR 1).

**How the frames were taken.** `bun scripts/shots/contact-sheet.ts` (new; it reuses the capture tool's practice setup, its
game drivers and the pre-installed Chromium, and adds no dependency). Each game opens in practice at 414×896 (iPhone 11 size,
in the browser, not as a home-screen app) on the fixed intro example with `Math.random` seeded, presses Ready and plays for a
few seconds before the frame:

- 45 puzzles use their capture driver's mid-play inputs or seeded mid-play state (`scripts/shots/drivers/`);
- the 22 arcade games and the engine games Mixed Signals, Bonk and Pull! get seeded taps and swipes on the arena for about
  3.5 s, the way arcade-play-check plays them. Some arcade frames therefore show a bot's run (for example Hover is still near
  its first barrier);
- Flash waits for the gold cue and taps it twice, so its frame shows the readout;
- Ascend, Bang On, Don't Break the Chain, Labyrinth and Matchmaker get six seeded taps on their buttons and cells.

The tool's dev server points Supabase at a closed port so server calls fail at once. Without that, Gridlock's example request
hangs in a cloud container. The grade request is held, so a finished board stays on screen. To redo the sheets, run the
script; `--sheets-only` rebuilds the sheets from the saved frames.

**How the descriptions were made.** Style and board colours come from the frames. Fonts and feedback come from reading the
code (`src/puzzles/`, `src/components/puzzles/`, `src/lib/arcade/*.renderer.ts`, `src/lib/fx/`). Nothing was heard or seen
on a phone. Joe does the device testing.

## What every game shares

- **Puzzles (51).** These are the Word, Number, Speed, Attention, Pattern and Logic games, apart from the four engine games
  listed below.
  - *Header.* The app header (Joulz ⚡, sound, music) sits above a row with PRACTICE, the game's name and "?", then the ring
    timer and score.
  - *Fonts.* Space Grotesk (`--font-display`) is used for labels and action buttons, Inter (`--font-body`) for body text,
    and JetBrains Mono for numbers, letters and HUD lines (`[data-puzzle-numeric]`, `.font-mono`). All three load from
    Google Fonts in `__root.tsx`.
  - *Every move.* `fx.onMove` plays "move" and draws a trail.
  - *Word checks.* `fx.onCorrect` plays "correct" with a burst; `fx.onWrong` plays "wrong" with a shake.
  - *Any "wrong".* `usePuzzleRejections` adds a ±3 px shake and a 240 ms red outline. A direct `puzzleReject()` also plays
    `shared.reject`.
  - *Stage complete.* "CORRECT" appears with `stage_complete` and a glow.
  - *Solve.* The game's own `<id>.solve` / `<id>.finish` effect plays. 1 s later the signature beat follows (`signature.ts`:
    a gold flash, the logo burst and `shared.signature.*`, plus `shared.perfect` on 150). Haptics use `buzz()`.
- **Arcade (22) and the engine games on the arcade stage** (Tenfall, Mixed Signals, Bonk, Pull!).
  - *Header.* One 52 px arcade header with the score or PRACTICE, the timer and the sound buttons, then the world edge to
    edge on its screen fill.
  - *Good events.* `arcadeFeedback` → `momentFrame` handles every good event: pops, streaks, combos and clears, with the
    shared effects (particle bursts, "+1" pops, banners, edge glow, border bulbs, confetti on the final). The banner font and
    particle type come from the game's world:
    - retro: Press Start 2P and pixel particles;
    - space: monospace and stars;
    - all other worlds: "Fredoka" with confetti, leaf, bubble or ember particles.
  - *Mistakes.* The shared layer only celebrates. A mistake gets the game's own sound and whatever its renderer draws.

## Word (9)

- **Nucleus** (`wordsmith`). Style: flat DOM letter ring with SVG link lines, gold and blue discs on near-black. Fonts:
  JetBrains Mono letters, Space Grotesk buttons. Correct: shared "correct" + burst, `wordsmith.finish`. Mistake: "wrong" +
  shake.
- **Interlock** (`tilegrid`). Style: flat grey DOM tiles with soft shadows, grey and blue keypad. Fonts: Space Grotesk and
  mono. Correct: `playLock` when the grid is valid (word checks are silent). Mistake: `playWrong` + red flash on bad cells
  (700 ms).
- **Slider** (`wordslide`). Style: flat dark tiles with white mono letters and padlock icons per row. Fonts: mono, Space
  Grotesk. Correct: `pz_padlock` when a row locks. Mistake: dragging a locked row → `shared.reject` + shake.
- **Forage** (`wordhunt`). Style: flat; large white tiles with black letters, a blue trace and a gold Submit. Fonts: mono,
  Space Grotesk. Correct: green flash + "correct". Mistake: `playWrong` + red flash + reject.
- **Lookout** (`wordsearch`). Style: flat dense mono letter grid with an SVG selection line and gold chips. Fonts: mono.
  Correct: "correct" + haptic. Mistake: "wrong" + error-cell shake.
- **Roundabout** (`letterwheel`). Style: flat SVG wheel and crossword stub, grey on near-black. Fonts: mono. Correct:
  "correct" + haptic. Mistake: shake, a "Not in this puzzle" flash, reject.
- **Strikeout** (`strikeout`). Style: flat; grey row slots, a QWERTY keypad coloured gold, red and grey by result. Fonts:
  mono, Space Grotesk. Correct: "correct" + place sounds + haptic. Mistake: "wrong" + buzz pattern + reject.
- **Cryptogrid** (`codeword`). Style: flat black and white crossword with gold given letters and a QWERTY keypad. Fonts:
  mono, Space Grotesk. Correct: place sound. Mistake: "wrong" + buzz + reject on the key.
- **Swapword** (`swapword`). Style: flat crossword tiles with shadows; teal, gold and white letters. Fonts: mono, Space
  Grotesk. Correct: place and move sounds + haptic. Mistake: no wrong move exists.

## Number (9)

- **Counterweight** (`balance`). Style: glossy SVG scale with gradients, a wooden base and gold weights. Fonts: mono.
  Correct: `balance.select/lift/drop/level`, `playCorrect` when level, CORRECT. Mistake: reject on a taken peg.
- **Exact** (`target`). Style: glossy DOM number tiles with heavy shadows; a gold target number on near-black. Fonts: mono,
  Space Grotesk. Correct: `target.select/combine`. Mistake: `playWrong` + shake.
- **Operator** (`equation`). Style: glossy chips; a gold operator slot and green progress bars. Fonts: mono. Correct:
  `equation.drop/advance/correct`. Mistake: a full wrong set → reject.
- **Tenfall** (`tendrop`). Style: glossy wooden canvas columns with a blue falling tile, on the arcade header. Fonts: Space
  Grotesk on canvas, mono HUD. Correct: `tendrop.apply/clear/nextTarget` + `playCorrect`. Mistake: `tendrop.refused/reset`
  + `playWrong`.
- **Integer Pyramid** (`numpyramid`). Style: glossy beige and dark bricks. Fonts: mono. Correct: `numpyramid.place`,
  `playCorrect` + CORRECT. Mistake: none live.
- **Trail** (`trail`). Style: flat dark-green grid with cream path discs and an SVG path. Fonts: mono, Space Grotesk.
  Correct: `trail.step` + haptic. Mistake: error-cell shake.
- **Brimful** (`measure`). Style: glossy SVG jugs; blue water, white measuring marks. Fonts: mono. Correct:
  `measure.pour/fill/empty`, `playCorrect` per stage. Mistake: `measure.reject` + `playWrong` + jug shake + haptic.
- **Checkout** (`checkout`). Style: glossy SVG dartboard (21 gradients) in red, green, cream and black, with gold, red and
  blue buttons. Fonts: JetBrains Mono in SVG. Correct: `checkout.aim/thud/tick/stage` + `playCorrect`. Mistake: shake +
  `playWrong`.
- **Ballpark** (`numline`). Style: flat; a white number line on near-black, a big percentage readout and a muted gold
  button. Fonts: mono. Correct: `numline.place/line/sweepTick`. Mistake: none possible.

## Speed (6)

- **Flash** (`reaction`). Style: flat dark panel; the readout is gold, or red for a false start. Fonts: Space Grotesk
  ("WAIT FOR GOLD…"), mono readout. Correct: "NNN ms" readout + move sound, `reaction.goldPulse` at the end. Mistake:
  "False start" in red + `shared.reject`.
- **Ascend** (`numhunt`). Style: flat grey SVG discs on near-black. Fonts: mono. Correct: move sound only,
  `numhunt.discsPop` at the end. Mistake: "wrong" + red disc flash (no shake).
- **Bang On** (`stopwatch`). Style: flat dark track with a gold target band. Fonts: mono. Correct: a result label,
  `stopwatch.goldFaces` at the end. Mistake: a label only, **no sound**.
- **Don't Break the Chain** (`chain`). Style: flat bright SVG shapes and icons on near-black; the CHAIN BROKEN banner is
  red. Fonts: Space Grotesk, mono. Correct: a tone that rises with each link (`chain.linkTone`). Mistake: `chain.breakTone`
  + haptic + banner.
- **Bonk** (`whack`). Style: glossy canvas meadow with dark holes, a gold TAP GOLD banner and the arcade header. Fonts:
  mono. Correct: `whack.popUp/sink` + `playCorrect`, `whack.finale`. Mistake: `whack.bomb/emptyTap` + `playWrong`.
- **Pull!** (`clayshoot`). Style: glossy painted sky, grass and clouds on the arcade header. Fonts: mono. Correct:
  `clayshoot.shatter/goldShatter` + particles. Miss: `clayshoot.missPuff/escape`.

## Attention (6)

- **Mixed Signals** (`stroop`). Style: flat canvas lanes in red, blue and green on black, with a gold sorting banner and the
  arcade header. Fonts: mono. Correct: `stroop.right`, gate pulse. Mistake: `stroop.wrong`.
- **Eagle Eye** (`symscan`). Style: line-drawn white arrow and eagle glyphs on dark cells, with pink progress bars. Fonts:
  Space Grotesk. Correct: `symscan.mark/unmark`. Mistake: none live.
- **Double Take** (`spotdiff`). Style: busy, colourful flat SVG emoji-like scenes, two panels. Fonts: Space Grotesk, mono.
  Correct: `spotdiff.found` + `playCorrect` + glow. Mistake: `spotdiff.miss` + `playWrong`.
- **Tally** (`countup`). Style: flat bright confetti shapes in pink, orange and red on dark, with a number keypad. Fonts:
  Space Grotesk, mono. Correct: `countup.trayIn/countersTick/Lock`. Mistake: none live.
- **Labyrinth** (`maze`). Style: line-drawn white maze walls on slate, a gold ball and a star exit. Fonts: mono. Correct:
  `playCorrect` on the solve only. Mistake: hitting a wall → reject.
- **Matchmaker** (`pairmatch`). Style: flat magenta crosshatched card backs; the faces are blue shapes. Fonts: mono.
  Correct: `playCorrect`, `pairmatch.cardWave`. Mistake: `playWrong` + haptic + reject.

## Pattern (10)

- **Gridlock** (`unblock`). Style: glossy SVG cars (12 gradients) on a grey lot. Fonts: mono, Space Grotesk. Correct:
  `unblock.slide`, `pz_car_escape` on the solve. Mistake: car shake.
- **Tessellate** (`blockparty`). Style: glossy SVG blocks in blue, orange, yellow, red and gold. Fonts: mono. Correct:
  `blockparty.place/turn/flip`. Mistake: piece shake.
- **Pipeline** (`pipes`). Style: glossy metal pipes on dark tiles, with blue water and a red valve. Fonts: mono. Correct:
  `pipes.rotate/flow`, `playCorrect`. Mistake: none.
- **Chroma Lines** (`flow`). Style: line-drawn neon paths (pink, green, cyan, orange) on dark cells. Fonts: mono. Correct:
  `flow.connect` + `playCorrect`. Mistake: reject.
- **Skid** (`iceslide`). Style: glossy pale-blue ice with dark rocks. Fonts: mono. Correct: `iceslide.slide/crack/portal`.
  Mistake: a fall → `iceslide.fall` + red flash + `playWrong`.
- **Heave** (`push`). Style: textured brick walls, a stone floor and hazard-striped crates. Fonts: mono. Correct:
  `push.step/push/home`. Mistake: reject when blocked.
- **Lightbender** (`laser`). Style: line-drawn beams on grey bevelled blocks, with gems. Fonts: mono. Correct:
  `laser.place/turn/fire/gem`. Mistake: `laser.bomb` + `playWrong` + haptic.
- **Topsy-Turvy** (`gravity`). Style: glossy grey blocks with coloured balls and black holes. Fonts: mono, Space Grotesk.
  Correct: `gravity.tilt/lock`, `playLock`. Mistake: none.
- **Jumbled** (`tiles`). Style: flat pastel number tiles (teal, blue, green, tan). Fonts: Space Grotesk, mono. Correct:
  `tiles.slide`, `playLock` on the solve. Mistake: reject.
- **Turntable** (`rings`). Style: glossy SVG record with multicoloured ring segments and a metal rim. Fonts: mono. Correct:
  `rings.turn`, `playLock` on the solve. Mistake: none.

## Logic (11)

- **Blackout** (`lightsout`). Style: glossy dark cells with gold bulbs. Fonts: mono. Correct: `lightsout.toggle` + a
  180 ms cell flash. Mistake: none.
- **Box Six** (`sudoku`). Style: flat; white grid lines on black, gold given digits and a 1–6 keypad. Fonts: mono, Space
  Grotesk. Correct: `sudoku.place` + haptic. Mistake: error cells shake red.
- **Hanoi** (`tower`). Style: flat wooden pegs with rainbow discs. Fonts: mono. Correct: `tower.lift/drop`. Mistake: peg
  shake + `playWrong`.
- **Polypotions** (`tubes`). Style: glossy glass tubes with saturated liquid layers. Fonts: mono. Correct:
  `tubes.lift/pour/cork`. Mistake: shake + `playWrong`.
- **Safe Cracker** (`safe`). Style: glossy metal safe with teal arrow buttons and gold dial digits. Fonts: mono. Correct:
  `safe.click`, `pz_safe_open`. Mistake: shake + `playWrong` + haptic.
- **Bomb Defusal** (`bomb`). Style: flat dark card with coloured wires and a dense rules list. Fonts: mostly mono. Correct:
  `bomb.cut/press/defuse`. Mistake: none live (the explosion shows only on the reveal).
- **Mosaic** (`nonogram`). Style: flat teal fills on dark cells. Fonts: mono. Correct: `nonogram.fill/mark`, `playLock`.
  Mistake: error cells shake red.
- **Colour Flood** (`flood`). Style: flat pastel blocks (pink, blue, yellow, green) with glossy swatch buttons. Fonts:
  mono. Correct: `flood.spread`, `playLock`. Mistake: none.
- **Tents and Trees** (`tents`). Style: flat dark-green grid with SVG trees and gold tents. Fonts: mono. Correct:
  `tents.pitch/grass/clear`. Mistake: none live.
- **Shikaku** (`shikaku`). Style: glossy gold glass rectangles on dark cells. Fonts: mono. Correct: `shikaku.place/remove`
  + haptic. Mistake: frame shake.
- **Lamplighter** (`lightup`). Style: glossy gold lamps with light rays, grey walls. Fonts: mono. Correct:
  `lightup.lamp/dot/clear`. Mistake: reject when tapping a wall.

## Arcade (22)

- **Hover** (`hover`). Style: pixel retro with CRT scanlines; magenta barriers on deep red, gold and cyan text. Fonts:
  Press Start 2P. Correct: `hover.gate/star`, +1 pops, a border step on a new zone, FULL CLEAR. Mistake:
  `hover.crash` (retro explosion) + a crash mark on the saucer.
- **High Rise** (`skyline`). Style: flat vector night city, an orange crane and lit tower blocks. Fonts: JetBrains Mono.
  Correct: `skyline.drop/perfect/streakDrop` + pop. Mistake: `skyline.miss`; the overhang falls away in chunks.
- **Swish** (`bintoss`). Style: glossy fairground at dusk, with bunting and wood. Fonts: JetBrains Mono. Correct:
  `bintoss.basket/perfect/hoopGlow` + flash. Mistake: `bintoss.missBounce`.
- **Flightpath** (`bullseye`). Style: glossy painted target on hay at dusk. Fonts: JetBrains Mono. Correct:
  `bullseye.bull/perfect` + a ring. Mistake: `bullseye.thud` only (a miss looks and sounds like any other landing).
- **Gemstone** (`matchup`). Style: glossy faceted gems (red, green, gold, purple, pink) on velvet. Fonts: JetBrains Mono.
  Correct: `matchup.cascade/lineOfFive/jackpot`, a pitched match sound, shatter. Mistake: `matchup.invalid`, sound only.
- **Breaker** (`breaker`). Style: pixel retro with scanlines; rainbow bricks on black. Fonts: Press Start 2P. Correct:
  brick burst, row chase, `wallCleared` + shake, power-ups. Mistake: `breaker.ballLost`.
- **Pinball** (`pinball`). Style: neon outlines on glossy dark, with cyan, gold and pink. Fonts: Press Start 2P. Correct:
  bumper glow and light ripple, bank and spinner cues. Mistake: `pinball.ballLost` (the drain fades), `gameOver`.
- **Rally** (`rally`). Style: pixel retro neon court, magenta paddles on near-black. Fonts: Press Start 2P. Correct:
  court lights flash on every return, `longRally`/`targetHit`/`goldHit`. Mistake: `rally.dead`.
- **Slice** (`slice`). Style: glossy wood board, a warm kitchen. Fonts: JetBrains Mono, ui-monospace. Correct: `slice.cut`,
  combo, frenzy, juice splats. Mistake: `slice.bomb` + bell + tint flash, `comboEnd`.
- **Coral Pop** (`bubble`). Style: glossy bubbles on a navy reef. Fonts: ui-monospace. Correct: `bubble.pop/line` + bubble
  particles. Mistake: `bubble.descend`, `reefLost`.
- **Tempo** (`beat`). Style: retro neon note lanes with scanlines, magenta and gold on black. Fonts: Press Start 2P.
  Correct: `beat.note`, combo tiers, a lane tint. Mistake: `beat.miss`, `comboLost`.
- **Meteor** (`snake`). Style: pixel retro grid with scanlines, a lime snake and orange rocks. Fonts: Press Start 2P.
  Correct: `snake.eat/speedUp`. Mistake: `snake.dead`; rock shadow warnings beforehand.
- **Jaywalk** (`cross`). Style: flat vector top-down road with bright cars and the hero sprite. Fonts: JetBrains Mono.
  Correct: `cross.crossed/hop` + confetti. Mistake: `cross.lifeLost` + a small flash and the lives display.
- **Wavefront** (`wavefront`). Style: glossy neon space shooter, with pink, yellow and cyan invaders. Fonts: JetBrains
  Mono. Correct: shape pops, big explosions, boss hits, stars. Mistake: `wavefront.lifeLost` + flashing hit, danger loop.
- **Roofbound** (`flip`). Style: glossy lava-lit rooftops, dark with orange glow, and the hero sprite. Fonts: JetBrains
  Mono. Correct: `flip.flip/speedUp` + embers. Mistake: `flip.crash`; collapse with a sideways shake.
- **Rainbow Bridge** (`inkbridge`). Style: flat vector sunny meadow, rainbow ink, a pot. Fonts: system sans (bold 11/16 px,
  no family set). Correct: `inkbridge.coinLand/pot` + flash. Mistake: `inkbridge.bump/fail` + a different flash,
  `inkOut`.
- **Fission** (`burst`). Style: pixel retro with scanlines; green and cyan on black. Fonts: Press Start 2P. Correct:
  `burst.hit/newWave/powerUp`. Mistake: `burst.lifeLost/lastLife`, the lives display flashes.
- **Orbit** (`orbit`). Style: glossy space with radial-gradient planets and glow. Fonts: JetBrains Mono. Correct:
  `planetCaught/checkpoint/shootingStar`. Mistake: `orbit.crash` + a tint on respawn.
- **Grappler** (`swing`). Style: glossy cave and lava with gradients; the hero and a dragon. Fonts: JetBrains Mono.
  Correct: `swing.grapple/starTaken`. Mistake: `swing.crash`, a lava loop, falling stalactites.
- **Scrumper** (`snip`). Style: line-drawn ropes and fruit on a flat sky and orchard, a wicker basket. Fonts: shared
  "Fredoka" only. Correct: `snip.cut/basket/star` + leaves. Mistake: `snip.miss`.
- **Tilt** (`tilt`). Style: glossy wooden toy labyrinth. Fonts: ui-monospace. Correct: `tilt.cup/gate/starTaken/mazeDone`
  + stars. Mistake: `tilt.caught`, `pitFall`, `chaserFall`.
- **Ball Tracker** (`balltrack`). Style: glossy wooden marble run with coloured marbles. Fonts: JetBrains Mono. Correct:
  `balltrack.marbleHome` + a settle wobble. Mistake: `balltrack.wrong` (a wood knock); a grey marble bounces out.

## Biggest inconsistencies

1. **Two screen frames.** Puzzles have the app header, a PRACTICE/name row and the ring timer. Arcade and engine games have
   the 52 px arcade header. Tenfall (Number), Bonk and Pull! (Speed) and Mixed Signals (Attention) use the arcade frame,
   while the rest of their categories use the puzzle frame. Next to each other on a category sheet, they look like a
   different app.
2. **Four type systems.**
   - Puzzles: Space Grotesk, Inter and JetBrains Mono.
   - Retro arcade: Press Start 2P.
   - Other arcade: JetBrains Mono or `ui-monospace`. Rainbow Bridge sets no family, so it falls back to the system sans.
   - Tab pages and skinned screens: Archivo, Saira and Manrope (`docs/design-system.md`).

   Games never use the app's newer brand fonts. The arcade effects' "Fredoka"/"Nunito" display font is not loaded anywhere
   I could find (no @font-face and no Google Fonts entry), so banners on non-retro, non-space worlds draw in whatever
   rounded or system sans the phone has.
3. **Mixed art styles inside a category.**
   - Pattern mixes glossy (Gridlock, Tessellate, Pipeline, Skid, Turntable) with line-drawn (Chroma Lines, Lightbender) and
     flat pastel (Jumbled).
   - Arcade mixes pixel CRT retro (Hover, Breaker, Rally, Tempo, Meteor, Fission, partly Pinball) with glossy painted
     worlds (Swish, Flightpath, Gemstone, Slice, Tilt, Ball Tracker) and flat vector (High Rise, Jaywalk, Rainbow Bridge).
   - Logic and Word are mostly flat dark-glass.
4. **Mistakes are weaker than successes in arcade.** The shared arcade layer (particles, banners, bulbs, confetti) fires
   only on success. A miss is a sound plus whatever the game draws, and some games draw almost nothing:
   - Gemstone's invalid swap is sound only;
   - Flightpath's miss uses the same thud as any landing;
   - Breaker and Rally have no visual hit beyond the ball resetting or the run ending (Hover at least marks the saucer).

   Puzzles, by contrast, all get the shared red outline and shake.
5. **Games with no live mistake feedback.**
   - Bang On's miss is a label with no sound.
   - Ascend's wrong tap plays "wrong" but has no shake.
   - Several puzzles cannot signal a mistake during play at all: Integer Pyramid, Eagle Eye, Tally, Bomb Defusal, Tents and
     Trees, Ballpark, Pipeline, Topsy-Turvy, Turntable, Blackout and Colour Flood. In some this is by design, since no move
     is wrong.
6. **Correct-move feedback varies a lot.** Word games use the shared "correct" + burst. Interlock and Slider turn their
   word checks off. Ascend gives only the generic move sound. Most Logic and Pattern games play only their own move sound
   until the solve, while Number games often add CORRECT and `playCorrect` per stage.
7. **The timer ring's colour changes by category** (pink, orange, purple, green), and the score sits under it on puzzles
   but beside it in the arcade header.
8. **Board density.** Lookout, Bomb Defusal's rules list, Cryptogrid's keypad and the puzzles' HUD lines ("CONNECTED 3 /
   49") are set small in mono at 414 px. They were the hardest text to read on the 25 % sheets, and on the full-size frames
   they are well below the Arcade header's text size.
