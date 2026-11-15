# Game sounds from the November reviews (15 Nov 2026)

The game reviews (`docs/design/game-reviews/`) found three sound problems across the puzzles and the arcade:

1. **Two sounds on solve.** Most puzzles played the generic `correct` / `lock` / `complete` and their own solve sound
   in the same frame. Now a puzzle's own solve or finish cue (`<game>.solve`, `<game>.finish`) that plays from its file
   leaves the generic sounds of that moment out (`ownMomentReplaces` / `holdMomentSounds` in `src/lib/sound.ts`: for
   150 ms after it, and one started up to 150 ms before it is faded out in 8 ms, in practice before a sample of it is
   heard). A solve cue with no file keeps the generic sound. Safe Cracker's opening and Gridlock's drive-out (Joe, 15 Nov
   2026: one sound on opening) play their recordings through the solve cue's slot (`safe.solve` → `pz_safe_open.mp3`,
   `unblock.solve` → `pz_car_escape.mp3`, live with the switch off), no longer straight from the game beside it.
2. **Silent shakes.** Every shake the shared rejection paint draws (`puzzleReject`, which also catches every game's own
   `animate-shake`: Shikaku, Tents, Trail, Gridlock, Tessellate…) sounds the quiet `wrong` once (`playRejectWrong`,
   volume 0.6). If the move already played `wrong`, nothing more plays; a game's `wrong` just after the shake's is left
   out. `shared.reject` (`ui.nope.mp3`) is no longer played by the shake. A shake a game marks harmless (an element
   inside `[data-quiet-shake]`) stays silent. Tenfall's refused tile plays it in place of the tap tick.
3. **Missing sounds.** Every effect slot a live game plays that had no file of its own got one:
   `scripts/sound-review-nov-2026/make.py` synthesises them from code (decaying modes for wood, glass, stone and metal,
   band-passed noise for air, water and grit, band-limited pulse waves for the Retro games; seeded, so a rebuild writes
   the same bytes), on the house method of [levels-nov-2026.md](levels-nov-2026.md) (mono 44.1 kHz 96 kbps with the
   gapless tag; levelled to the library's median for their length, true peaks at -1 dBFS or under, the limiter only
   while transparent; loops built on their own crossfade and written with fix.py's wrap-around frames). 99 files,
   109 slots, about 389 KB, each loading with its own game (never on the first tap).

**They are behind one switch, `NEW_GAME_SOUNDS` in `src/config/soundConfig.ts`, off by default**: off, the manifest is
exactly as written and every cue plays what it did. On, `manifest.ts` gives each slot its file at load
(`applyNewGameSounds`, `src/lib/fx/newGameSounds.ts`): an arcade moment plays it in place of its library sound, a
puzzle cue in place of the shared sound that moment played (the `replaces` column), and the one-sound-on-solve rule
uses the new files too. Every sound can be played on `/dev-design` → Sounds (development only) whatever the switch
says. Turning the switch on also changes what the cue sheet calls each slot's file today: re-run
`bun scripts/sound-cue-sheet.ts` with it (sound-manifest-check compares the sheet with the manifest).

`safe.solve.mp3` and `unblock.solve.mp3` are placeholders (switch on only) for Safe Cracker's and Gridlock's solve
moments; switch off they keep the game's own recordings above.

Left without a file (sound-review-fixes-check's `EXEMPT`): Lightbender's `laser.gem`, Topsy-Turvy's `gravity.tilt` and Pull!'s clays (each moment already plays its own `pz_*`
recording), Checkout's `checkout.tick` (its own `checkout.thud`), `clayshoot.goldSparkle` (silent by design), the
wrong-move shakes `spotdiff.miss`, `measure.reject` and `tendrop.refused` (the quiet `wrong`), and the stage moments
`equation.advance` and `numline.line` (the shared `stage_complete`, one sound for every stage game).

Rebuild: `python3 -I scripts/sound-review-nov-2026/make.py` (about 2 minutes; rewrites the files and
`src/lib/fx/newGameSounds.data.ts`). Re-measure: `python3 -I scripts/sound-audit-nov-2026/measure.py <out.json>
public/sounds/<file>…`. Proved by sound-review-fixes-check.

| Game | File | Slots | What it sounds like | ms | Size | LUFS (target) | Plays in place of |
|---|---|---|---|---|---|---|---|
| Box Six | `sudoku.place.mp3` | `sudoku.place` | a soft wooden tap, a digit set on a board | 125 | 2.1 KB | -25.8 (-22.7) | `move` |
| Hanoi | `tower.drop.mp3` | `tower.drop` | a ring dropping onto its post: a mid wooden clunk with a low knock | 132 | 2.4 KB | -22.9 (-22.7) | `move` |
| Polypotions | `tubes.pour.mp3` | `tubes.pour` | a glassy pour: bubbles rising in pitch inside a glass tube | 327 | 4.6 KB | -17.5 (-17.5) | `move` |
| Mosaic | `nonogram.fill.mp3` | `nonogram.fill` | a felt stamp: a soft, dense press into the square | 80 | 1.8 KB | -24 (-22.7) | `move` |
| Mosaic | `nonogram.mark.mp3` | `nonogram.mark` | a pencil tick: a light, dry scratch | 69 | 1.5 KB | -23.3 (-22.7) | `move` |
| Colour Flood | `flood.spread.mp3` | `flood.spread` | a liquid ripple washing out across the board | 327 | 4.6 KB | -17.7 (-17.5) | `move` |
| Tents and Trees | `tents.pitch.mp3` | `tents.pitch` | canvas snapping taut, a peg tapped into the ground | 128 | 2.1 KB | -22.9 (-22.7) | `move` |
| Tents and Trees | `tents.grass.mp3` | `tents.grass` | a soft brush of grass | 107 | 2.1 KB | -22.9 (-22.7) | `move` |
| Safe Cracker | `safe.solve.mp3` | `safe.solve` | placeholder: the safe opening: three drum clicks in turn, then a heavy latch and a low door swing | 707 | 9.2 KB | -20.4 (-17.1) | `pz_safe_open` (the slot's live recording) |
| Gridlock | `unblock.solve.mp3` | `unblock.solve` | placeholder: the gold block driving out: a short rising engine buzz and a whoosh past the exit | 675 | 8.6 KB | -17.1 (-17.1) | `pz_car_escape` (the slot's live recording) |
| Shikaku | `shikaku.place.mp3` | `shikaku.place` | a frame snapping into place: two quick clicks on a wooden body | 109 | 2.1 KB | -22.9 (-22.7) | `move` |
| Shikaku | `shikaku.remove.mp3` | `shikaku.remove` | the frame lifted off: a soft, falling wooden knock | 99 | 1.8 KB | -23.2 (-22.7) | `move` |
| Lamplighter | `lightup.lamp.mp3` | `lightup.lamp` | a warm lamp switching on: a soft hum swelling under a small glass ping | 341 | 4.9 KB | -17.5 (-17.5) | `move` |
| Lamplighter | `lightup.dot.mp3` | `lightup.dot` | a tiny dot set: a short, quiet tick | 60 | 1.5 KB | -22.6 (-22.7) | `move` |
| Trail | `trail.step.mp3` | `trail.step` | a soft step tone, a short rounded pluck | 103 | 1.8 KB | -22.7 (-22.7) | `move` |
| Counterweight | `balance.drop.mp3` | `balance.drop` | a brass weight set on the pan: a metal clink over a soft knock | 302 | 4.3 KB | -20.5 (-17.5) | `move` |
| Counterweight | `balance.lift.mp3` | `balance.lift` | a weight lifted off: a light clink and a small upward breath | 147 | 2.4 KB | -22.6 (-22.7) | `move` |
| Operator | `equation.drop.mp3` | `equation.drop` | a number tile clacking into its gap | 97 | 1.8 KB | -22.9 (-22.7) | `move` |
| Integer Pyramid | `numpyramid.place.mp3` | `numpyramid.place` | a stone set on the pyramid: a short, dense tap | 115 | 2.1 KB | -22.7 (-22.7) | `move` |
| Brimful | `measure.pour.mp3` | `measure.pour` | water poured from jug to jug: a short glug | 336 | 4.6 KB | -17.7 (-17.5) | `move` |
| Brimful | `measure.fill.mp3` | `measure.fill` | a jug filled at the tap: water rising in pitch | 373 | 5.2 KB | -17.5 (-17.5) | `move` |
| Brimful | `measure.empty.mp3` | `measure.empty` | a jug emptied: a falling gurgle | 318 | 4.6 KB | -17.6 (-17.5) | `move` |
| Brimful | `measure.reset.mp3` | `measure.reset` | the jugs set back: a soft, short whoosh | 259 | 3.7 KB | -17.6 (-17.5) | `move` |
| Ballpark | `numline.place.mp3` | `numline.place` | a pin pressed into the line: a small, bright metal tick | 113 | 2.1 KB | -22.9 (-22.7) | `tick` + `place` + `move` |
| Pipeline | `pipes.rotate.mp3` | `pipes.rotate` | a pipe joint turned: a metal ratchet click on a hollow body | 111 | 2.1 KB | -23 (-22.7) | `move` |
| Skid | `iceslide.slide.mp3` | `iceslide.slide` | a slide across ice: a bright, glassy swish | 165 | 2.8 KB | -22.8 (-22.7) | `move` |
| Heave | `push.step.mp3` | `push.step` | a soft footstep | 82 | 1.8 KB | -22.6 (-22.7) | `move` |
| Heave | `push.push.mp3` | `push.push` | a crate shoved one square: a wooden thump with a short scrape | 141 | 2.4 KB | -22.7 (-22.7) | `move` |
| Lightbender | `laser.place.mp3` | `laser.place` | a mirror set down: a small glass click | 81 | 1.8 KB | -22.8 (-22.7) | `move` |
| Lightbender | `laser.turn.mp3` | `laser.turn` | a mirror turned: two light glass ticks | 92 | 1.8 KB | -22.8 (-22.7) | `move` |
| Lightbender | `laser.fire.mp3` | `laser.fire` | the beam fired: a clean rising zap that settles into a short hum | 406 | 5.5 KB | -17.5 (-17.5) | `move` |
| Eagle Eye | `symscan.mark.mp3` | `symscan.mark` | a symbol marked: a short, clear ping | 106 | 2.1 KB | -22.7 (-22.7) | `move` |
| Eagle Eye | `symscan.unmark.mp3` | `symscan.unmark` | a mark taken back: a lower, softer ping | 77 | 1.5 KB | -22.7 (-22.7) | `move` |
| Double Take | `spotdiff.found.mp3` | `spotdiff.found` | a difference found: a bright two-note chime, up a fifth | 426 | 5.8 KB | -17.5 (-17.5) | `correct` |
| Bomb Defusal | `bomb.press.mp3` | `bomb.press` | a panel key pressed: a firm plastic click with a short beep | 67 | 1.5 KB | -22.8 (-22.7) | `move` |
| Hover, Breaker, Rally, Fission, Tempo, Meteor, Blockzone | `retro.start.mp3` | `hover.start`, `breaker.start`, `rally.start`, `burst.start`, `beat.start`, `snake.start`, `blockfall.start` | the Retro run starting: a quick three-note pulse arpeggio up to a held note | 300 | 4.3 KB | -17.5 (-17.5) | the library sound |
| Hover, Meteor, Rally | `retro.crash.mp3` | `hover.crash`, `snake.dead`, `rally.dead` | a Retro crash: a crunchy noise burst falling in pitch | 281 | 4.0 KB | -18 (-17.5) | the library sound |
| Fission, Wavefront | `retro.lifeLost.mp3` | `burst.lifeLost`, `wavefront.lifeLost` | a life lost: three falling pulse notes, the last one bending down | 420 | 5.8 KB | -17.5 (-17.5) | the library sound |
| Breaker, Fission | `retro.powerUp.mp3` | `breaker.powerUp`, `burst.powerUp` | a power-up caught: a fast four-note climb | 220 | 3.4 KB | -22.7 (-22.7) | the library sound |
| Hover | `hover.gate.mp3` | `hover.gate` | through a barrier: a quick two-note pulse, up a fourth | 100 | 1.8 KB | -22.7 (-22.7) | the library sound |
| Hover | `hover.star.mp3` | `hover.star` | a gold star: a bright sparkling arpeggio | 160 | 2.8 KB | -22.7 (-22.7) | the library sound |
| Breaker | `breaker.paddle.mp3` | `breaker.paddle` | the ball off the paddle: a short, round blip | 60 | 1.5 KB | -22.7 (-22.7) | the library sound |
| Breaker | `breaker.brickHit.mp3` | `breaker.brickHit` | a brick hit: a hard high blip with a tick | 32 | 1.2 KB | -24.3 (-22.7) | the library sound |
| Breaker | `breaker.ballLost.mp3` | `breaker.ballLost` | the ball lost: a pulse sliding down | 300 | 4.3 KB | -17.4 (-17.5) | the library sound |
| Breaker | `breaker.fireballLit.mp3` | `breaker.fireballLit` | the fireball lit: a rising rush of noise and pulse | 174 | 2.8 KB | -22.6 (-22.7) | the library sound |
| Breaker | `breaker.laser.mp3` | `breaker.laser` | a paddle laser: a classic pew diving in pitch | 160 | 2.8 KB | -22.7 (-22.7) | the library sound |
| Breaker | `breaker.multiball.mp3` | `breaker.multiball` | multiball: three quick blips, up | 120 | 2.1 KB | -22.6 (-22.7) | the library sound |
| Fission | `burst.hit.mp3` | `burst.hit` | an atom popped: a chip pop falling an octave | 41 | 1.2 KB | -24.4 (-22.7) | the library sound |
| Fission | `burst.shot.mp3` | `burst.shot` | a shot fired: a short, high pew | 60 | 1.5 KB | -22.8 (-22.7) | the library sound |
| Fission | `burst.gameOver.mp3` | `burst.gameOver` | game over: a slow falling four-note phrase | 750 | 9.5 KB | -17.1 (-17.1) | the library sound |
| Fission | `burst.freezeCaught.mp3` | `burst.freezeCaught` | a freeze caught: an icy shimmer of high notes | 240 | 3.7 KB | -22.7 (-22.7) | the library sound |
| Meteor | `snake.eat.mp3` | `snake.eat` | a star eaten: a tiny two-note blip, up | 60 | 1.5 KB | -22.7 (-22.7) | the library sound |
| Meteor | `snake.rockLand.mp3` | `snake.rockLand` | a rock landing: a low chip thud with grit | 56 | 1.5 KB | -22.5 (-22.7) | the library sound |
| Meteor | `snake.rockWarn.mp3` | `snake.rockWarn` | a rock incoming: a short warning beep | 90 | 1.8 KB | -22.7 (-22.7) | the library sound |
| Meteor | `snake.showerAlarm.mp3` | `snake.showerAlarm` | a meteor shower: a two-tone alarm | 200 | 3.1 KB | -22.7 (-22.7) | the library sound |
| Rally | `rally.hit.mp3` | `rally.hit` | the ball returned: a round bop | 60 | 1.5 KB | -22.7 (-22.7) | the library sound |
| Rally | `rally.goldHit.mp3` | `rally.goldHit` | a gold target hit: a bright coin, two notes | 160 | 2.8 KB | -22.7 (-22.7) | the library sound |
| Wavefront | `wavefront.pierce.mp3` | `wavefront.pierce` | a shot piercing a ship: a hard zap | 55 | 1.5 KB | -24.6 (-22.7) | the library sound |
| Wavefront | `wavefront.bigExplode.mp3` | `wavefront.bigExplode` | a big explosion: a long chip blast falling away | 666 | 8.6 KB | -17.3 (-17.1) | the library sound |
| Wavefront | `wavefront.shapePop.mp3` | `wavefront.shapePop` | a ship destroyed: a crisp chip pop | 64 | 1.5 KB | -22.8 (-22.7) | the library sound |
| Wavefront | `wavefront.bossHit.mp3` | `wavefront.bossHit` | the boss hit: a metallic chip clang | 64 | 1.5 KB | -22.9 (-22.7) | the library sound |
| Wavefront | `wavefront.dive.mp3` | `wavefront.dive` | a ship diving: a quick swoop down | 120 | 2.1 KB | -22.8 (-22.7) | the library sound |
| Blockzone | `blockfall.speedUp.mp3` | `blockfall.speedUp` | the speed steps up: a rising two-note chime | 180 | 2.8 KB | -22.7 (-22.7) | the library sound |
| Roofbound | `flip.flip.mp3` | `flip.flip` | gravity flipped: an airy whoosh that turns upward | 255 | 3.7 KB | -17.6 (-17.5) | the library sound |
| Roofbound | `flip.crash.mp3` | `flip.crash` | a crash into the cave: a heavy thud with falling grit | 328 | 4.6 KB | -20 (-17.5) | the library sound |
| Orbit | `orbit.launch.mp3` | `orbit.launch` | the rocket launched: a short thruster roar | 325 | 4.6 KB | -17.6 (-17.5) | the library sound |
| Orbit | `orbit.checkpoint.mp3` | `orbit.checkpoint` | a checkpoint set: a soft two-note beacon | 300 | 4.3 KB | -17.5 (-17.5) | the library sound |
| Orbit | `orbit.crash.mp3` | `orbit.crash` | a crash in space: a muffled, low burst | 334 | 4.6 KB | -18.7 (-17.5) | the library sound |
| Orbit | `orbit.ambience.mp3` | `orbit.ambience` | deep space: a slow, low pad with a faint airy shimmer (loop) | 2000 | 24.8 KB | -16.8 (-16.8) | the library sound |
| Grappler | `swing.crash.mp3` | `swing.crash` | a fall into the lava: a heavy splash-thud | 284 | 4.0 KB | -19.2 (-17.5) | the library sound |
| Grappler | `swing.grapple.mp3` | `swing.grapple` | the grapple thrown and caught: a whip of rope and a metal clink | 211 | 3.4 KB | -22.7 (-22.7) | the library sound |
| Grappler | `swing.starTaken.mp3` | `swing.starTaken` | a star taken: a quick bright sparkle | 184 | 3.1 KB | -22.8 (-22.7) | the library sound |
| Grappler | `swing.dragon.mp3` | `swing.dragon` | the dragon closing in: a low, rough growl | 604 | 8.0 KB | -17.1 (-17.1) | the library sound |
| Grappler | `swing.rockShake.mp3` | `swing.rockShake` | rocks about to fall: a short low rumble | 200 | 3.1 KB | -22.7 (-22.7) | the library sound |
| Grappler | `swing.rockLand.mp3` | `swing.rockLand` | a rock landing: a dull stone thud | 119 | 2.1 KB | -23.9 (-22.7) | the library sound |
| High Rise | `skyline.drop.mp3` | `skyline.drop` | a block landing on the tower: a solid clank over a thud | 191 | 3.1 KB | -22.7 (-22.7) | the library sound |
| High Rise | `skyline.streakDrop.mp3` | `skyline.streakDrop` | a perfect drop: the clank with a bright ring on top | 243 | 3.7 KB | -22.9 (-22.7) | the library sound |
| High Rise | `skyline.miss.mp3` | `skyline.miss` | a block missing the tower: a falling whistle and a distant thud | 413 | 5.5 KB | -17.6 (-17.5) | the library sound |
| Home Run | `homerun.swing.mp3` | `homerun.swing` | the bat swung: a fast, clean whoosh | 155 | 2.4 KB | -22.7 (-22.7) | the library sound |
| Top Bins | `freekick.net.mp3` | `freekick.net` | the ball in the net: a soft rope swish | 240 | 3.7 KB | -22.9 (-22.7) | the library sound |
| Apex | `racing.sector.mp3` | `racing.sector` | a clean sector: a short, bright timing chime | 225 | 3.4 KB | -22.7 (-22.7) | the library sound |
| Apex | `racing.grass.mp3` | `racing.grass` | off onto the gravel: a gritty rumble | 191 | 3.1 KB | -22.9 (-22.7) | the library sound |
| Rainbow Bridge | `inkbridge.draw.mp3` | `inkbridge.draw` | a rainbow drawn: a soft glissando of sine tones with a shimmer | 455 | 6.1 KB | -17.5 (-17.5) | the library sound |
| Rainbow Bridge | `inkbridge.pot.mp3` | `inkbridge.pot` | the coin in the pot: a bright clink and a little cascade of bells | 604 | 8.0 KB | -17.1 (-17.1) | the library sound |
| Rainbow Bridge | `inkbridge.bump.mp3` | `inkbridge.bump` | the ball bouncing off the ink: a soft, round boing | 134 | 2.4 KB | -22.7 (-22.7) | the library sound |
| Tilt | `tilt.roll.mp3` | `tilt.roll` | a marble rolling on wood: a soft, steady rumble (loop) | 1200 | 15.3 KB | -16.8 (-16.8) | the library sound |
| Tilt | `tilt.caught.mp3` | `tilt.caught` | a marble dropping into a hole: a clack and a hollow fall | 168 | 2.8 KB | -22.9 (-22.7) | the library sound |
| Tilt | `tilt.mazeDone.mp3` | `tilt.mazeDone` | a maze done: a warm three-note wooden chime | 286 | 4.0 KB | -17.5 (-17.5) | the library sound |
| Tilt | `tilt.cup.mp3` | `tilt.cup` | a marble home in its cup: a wooden thunk with a short rattle | 151 | 2.4 KB | -22.6 (-22.7) | the library sound |
| Tilt | `tilt.gate.mp3` | `tilt.gate` | a gate swinging: a light wooden click | 89 | 1.8 KB | -24.2 (-22.7) | the library sound |
| Tilt | `tilt.knock.mp3` | `tilt.knock` | the marble against a wall: a short wood knock | 92 | 1.8 KB | -24.3 (-22.7) | the library sound |
| Coral Pop | `bubble.waves.mp3` | `bubble.waves` | a calm sea under the reef: slow swells of filtered noise (loop) | 2400 | 29.4 KB | -16.8 (-16.8) | the library sound |
| Coral Pop | `bubble.load.mp3` | `bubble.load` | a bubble loaded: a round, rising bloop | 109 | 2.1 KB | -22.7 (-22.7) | the library sound |
| Coral Pop | `bubble.pop.mp3` | `bubble.pop` | a bubble popped: a small wet pop | 55 | 1.5 KB | -24.2 (-22.7) | the library sound |
| Ball Tracker | `balltrack.roll.mp3` | `balltrack.roll` | marbles running through a tube: a hollow, steady roll (loop) | 1200 | 15.3 KB | -16.8 (-16.8) | the library sound |
| Ball Tracker | `balltrack.marbleHome.mp3` | `balltrack.marbleHome` | a marble home: a glassy clink into its slot | 125 | 2.1 KB | -22.6 (-22.7) | the library sound |
| Ball Tracker | `balltrack.wrong.mp3` | `balltrack.wrong` | a marble in the wrong cup: a dull, low clunk | 74 | 1.5 KB | -24.5 (-22.7) | the library sound |
| Ball Tracker | `balltrack.switch.mp3` | `balltrack.switch` | a track switched: a click-clack | 78 | 1.5 KB | -25.3 (-22.7) | the library sound |
| Iron Wall | `bastion.dry.mp3` | `bastion.dry` | a dry fire: an empty mechanical click | 72 | 1.5 KB | -25.7 (-22.7) | the library sound |

## Replacing these with Joe's own sounds

Joe will replace the synthesised files with sounds he generates. The file names, slots and loudness are the contract,
so a later session can drop new files in without touching code:

1. **Names.** Each recording is `public/sounds/<file>.mp3` with the file name in the table below (and in
   `src/lib/fx/newGameSounds.data.ts`, `NEW_GAME_SOUND_RECORDINGS`). Keep the name; one file may serve several slots
   (the shared Retro files). Don't rename a file a slot points at.
2. **Levelling.** Cut and level each new file on the house method: [levels-nov-2026.md](levels-nov-2026.md) and
   `scripts/sound-audit-nov-2026/fix.py` (mono 44.1 kHz 96 kbps with the LAME gapless tag; an effect levelled to the
   library median for its length, the target is the table's "target" column; true peak -1 dBFS or under; trim only
   digital silence, 10 ms kept before the attack; loops crossfaded and written with wrap-around frames). Measure with
   `python3 -I scripts/sound-audit-nov-2026/measure.py out.json public/sounds/<file>.mp3`.
3. **The make step.** `make.py` writes the synthesised files *and* `newGameSounds.data.ts` (each file's exact length,
   which the manifest uses as the slot's `ms`). After dropping in real files, don't re-run make.py over them (it would
   write the synthesised ones back); instead update that file's `ms` in `newGameSounds.data.ts` to the new file's
   length (measure.py prints it) and remove its recipe from make.py, or run make.py into a scratch folder
   (`python3 -I scripts/sound-review-nov-2026/make.py <dir> -`) to compare.
4. **Prove it.** `bun scripts/sound-review-fixes-check.ts` (format, length, size, true peak and loudness band of every
   file; every slot played once with the switch on), `bun scripts/sound-manifest-check.ts`, `bun scripts/mp3-gapless-check.ts`.
   Listen on `/dev-design` → Sounds, then turn `NEW_GAME_SOUNDS` on and re-run `bun scripts/sound-cue-sheet.ts`.
