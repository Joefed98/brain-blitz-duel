# Sound wiring (18 Nov 2026)

Joe's recordings from sound batches 1–3 ([sounds-batch-1.csv](sounds-batch-1.csv), [sounds-batch-2.csv](sounds-batch-2.csv),
[sounds-batch-3.csv](sounds-batch-3.csv)) and his last uploads ([sounds-retakes.csv](sounds-retakes.csv): 150 retakes,
two music tracks and the announcer's twelve lines) are wired into the live game, and `NEW_GAME_SOUNDS` is on.

- **Processing:** `python3 -I scripts/sound-wiring-nov18/process.py <work dir> [--write]` (measures in
  `scripts/sound-wiring-nov18/report.json`), on each batch's own method (trim to the attack, cut to `target_ms` with a short
  fade, ring out to the natural decay up to 1.5x where a cut would chop, the first event only where two were made and one
  was asked, levelled to the house standard of [levels-nov-2026.md](levels-nov-2026.md), mono 44.1 kHz).
- **Wiring:** `bun scripts/sound-wiring-nov18/wire.ts [--check]` points every recorded slot's manifest entry at its
  `/sounds/<file>` with `ms` its exact length and adds the slots the batches marked "to add" (below). A slot served by the
  switch (`src/lib/fx/newGameSounds.data.ts`, Joe's file under the placeholder's name) plays it through `NEW_GAME_SOUNDS`.
- **Kept as main (Joe):** `hover.gate`, `hover.star`, `hover.thrust`, `bastion.weakTing` (rows marked TO RECORD; their files
  are not served). `orbit.checkpoint` keeps main's placeholder (its take was damaged): still to record.
- **Lookout's series** (`wordsearch.found4`–`found9`) keeps main's placeholders: the retaken `.base` note is still a sharp
  spike over a quiet body, so `found7`–`found9` can't come within 4.5 dB of the house level. Still to record.
- **`.base` notes** are the sources of their pitch series, not served (the uploads stay in the branches' history).
- **Meteor's bed:** batch 2's `music_snake` is `music_eatgrow` (Meteor's slot), replacing the earlier bed.
- **Pinball multiball:** `pinball.multiballStart` plays once for each extra ball released, 120 ms apart.
- **The announcer:** [announcer](#the-announcer) below.

## Slots added on wiring

| Cue | Game | Trigger | Length |
|---|---|---|---|
| `sudoku.combo` | Box Six | A digit completes two or more rows, columns or boxes at once (in place of `sudoku.line`) | 0.8 s |
| `sudoku.clear` | Box Six | A digit or pencil marks cleared (Clear, Backspace, or the same digit tapped again) | 0.12 s |
| `tubes.wrong` | Polypotions | A pour refused: the lifted flask tips and nothing pours | 0.35 s |
| `tubes.combo` | Polypotions | A second cork within 4 s (in place of `tubes.cork`) | 0.6 s |
| `tubes.reset` | Polypotions | Reset with moves made | 0.5 s |
| `tubes.glint` | Polypotions | The solve: one ting per corked flask, staggered with the cork pops | 0.4 s |
| `tower.illegal` | Hanoi | An illegal drop refused (the ring bounces back) | 0.25 s |
| `tower.lower` | Hanoi | The lifted ring lowered back onto its own post | 0.15 s |
| `tower.glint` | Hanoi | A ring lands on the gold post in order (not the last ring: that drop is the solve) | 0.4 s |
| `tower.undo` | Hanoi | Undo | 0.25 s |
| `tower.reset` | Hanoi | Reset | 0.5 s |
| `tower.near` | Hanoi | The reveal of an unfinished board one or two moves from done, once | 0.6 s |
| `flood.reject` | Colour Flood | The current colour tapped | 0.25 s |
| `flood.combo` | Colour Flood | 20 or more squares in one move (in place of `flood.spread`) | 0.6 s |
| `flood.nearPar` | Colour Flood | The moves counter first turns gold near par | 0.4 s |
| `flood.outOfMoves` | Colour Flood | The last allowed move used up | 0.6 s |
| `safe.drumLock` | Safe Cracker | The opening: one click per drum, staggered with the drums locking | 0.15 s |
| `nonogram.combo` | Mosaic | Two or more lines matched at once (in place of `nonogram.line`) | 0.6 s |
| `pinball.rampChase` | Pinball | A plain ramp shot: the ramp light chases the ball up | 0.5 s |
| `wavefront.charge` | Wavefront | Holding to charge the heavy shot (loop, stops on release or the run's end) | 1.2 s |
| `wavefront.chargeRelease` | Wavefront | The charged blast released | 0.4 s |
| `burst.clearTick` | Fission | The wave-clear bonus ticks in | 0.7 s |
| `blockfall.linesCount` | Blockzone | The end: the lines count up | 1 s |
| `cross.tally` | Spacewalk | The end: the crossings tally | 1 s |
| `bubble.fastShot` | Coral Pop | A boosted shot fired (in place of `bubble.load`) | 0.3 s |
| `bubble.wallBlip` | Coral Pop | The bubble in flight glances off a wall | 0.08 s |
| `bubble.fallSplash` | Coral Pop | Bubbles cut loose fall to the seabed | 0.4 s |
| `bubble.chestOpen` | Coral Pop | A treasure chest falls with the cluster (in place of the splash) | 0.7 s |
| `bubble.thup` | Coral Pop | A shot sticks without popping (in place of `bubble.stick`) | 0.15 s |
| `inkbridge.birdScatter` | Rainbow Bridge | A failed drop on a bird | 0.5 s |
| `inkbridge.parFlourish` | Rainbow Bridge | A level potted within its ink par | 0.5 s |
| `matchup.shatter` | Gemstone | A match: the gems shatter (in place of `arc_gem_match`) | 0.3 s |
| `matchup.chestHome` | Gemstone | A treasure collected | 0.7 s |
| `matchup.chestGlint` | Gemstone | A treasure comes within three rows of home | 0.4 s |
| `matchup.goalTick` | Gemstone | The run's end: one tick per goal met | 0.25 s |
| `skyline.goldChime` | High Rise | A gold block landed perfectly (in place of the shared spark chime) | 0.6 s |
| `skyline.endCount` | High Rise | The end: the floors count up | 2.5 s |
| `minigolf.aim` | Crazy Golf | The aim meter ticks, rising with the pull (in place of the synthesised tone) | 0.05 s |
| `minigolf.flag` | Crazy Golf | A holed ball: the flagstick lifted | 0.4 s |
| `minigolf.confetti` | Crazy Golf | A birdie or better: the party popper (in place of `minigolf.flag`) | 0.6 s |

## The announcer

`src/lib/fx/announcer.ts`: one line on this player's own round result, from the round's stored, graded score, once per
round, 150 ms after the reveal's score sting begins; never during play, on a replay or a reveal reopened later; each device
plays only its own player's line; never the same line twice in a row on a device; Settings → Sound → Announcer voice (on by
default, off whenever sound effects are off). The lines are trimmed tight (no breath before, no room tail), under 1.3 s
(seven tightened in time with pitch and formants kept, `tempo` in the report), stereo 192 kbps, all at -17 LUFS.

| Cue | Trigger | Length |
|---|---|---|
| `voice.great` | A round result of 175–184 (one of three, at random) | 0.9 s |
| `voice.brilliant` | A round result of 175–184 | 1.0 s |
| `voice.superb` | A round result of 175–184 | 1.24 s |
| `voice.amazing` | A round result of 185–194 | 1.1 s |
| `voice.outstanding` | A round result of 185–194 | 1.24 s |
| `voice.incredible` | A round result of 185–194 | 1.24 s |
| `voice.sensational` | A round result of 195–199 | 1.24 s |
| `voice.unbelievable` | A round result of 195–199 | 1.24 s |
| `voice.phenomenal` | A round result of 195–199 | 1.24 s |
| `voice.legendary` | A round result of 200 | 1.24 s |
| `voice.flawless` | A round result of 200 | 1.24 s |

`voice.perfect` (a round result of 200, and the perfect-score moment of a 150-point game) is listed where it already was.

## Library stand-ins

These library sounds stood in for slots that now play Joe's own recording. They stay in the manifest: each still plays if
that slot's own file hasn't decoded yet (`sfx(slot, fallback)` and `overCue` in `src/lib/fx/gameSounds.ts`).

| Cue | Trigger | Length |
|---|---|---|
| `arc_space_ambience` | Stand-in for an Orbit and Spacewalk space bed until the slot's own file decodes | loop |
| `arc_thruster` | Stand-in for Hover's and Orbit's thrust until the slot's own file decodes | 160 ms |
| `arc_retro_pickup` | Stand-in for a Retro pickup until the slot's own file decodes | 100 ms |
| `arc_sea_waves` | Stand-in for Coral Pop's waves until the slot's own file decodes | 600 ms |
| `arc_sea_bubble` | Stand-in for a Coral Pop bubble until the slot's own file decodes | 120 ms |
| `arc_rainbow` | Stand-in for Rainbow Bridge's and Gemstone's sparkle until the slot's own file decodes | 910 ms |
| `arc_grapple` | Stand-in for Grappler's grab until the slot's own file decodes | 450 ms |
| `arc_gravity_flip` | Stand-in for Roofbound's flip until the slot's own file decodes | 330 ms |
| `arc_laser_beam` | Stand-in for a laser shot until the slot's own file decodes | 370 ms |
| `arc_multiball` | Stand-in for Breaker's and Pinball's multiball until the slot's own file decodes | 64 ms |
| `arc_big_explode` | Stand-in for a big explosion until the slot's own file decodes | 810 ms |
| `arc_shape_pop` | Stand-in for Wavefront's shape pop until the slot's own file decodes | 150 ms |
| `arc_rainbow_pot` | Stand-in for Rainbow Bridge's pot until the slot's own file decodes | 1000 ms |
| `arc_rainbow_bump` | Stand-in for Rainbow Bridge's bump until the slot's own file decodes | 200 ms |

## The retakes

150 retakes replace the files of the same name (batch 1: 28, batch 2: 94, batch 3: 28). Joe chose each by ear, so the new take wins unless it is broken by measurement (near-silent, clipped, or two events where one was asked with no quiet point to cut at): **none was**, so every new take is used.

- Cut to their first event (two were made, one asked): `clayshoot.goldShatter`, `mahjong.reset`, `homerun.footsteps`.
- Rung out to their natural decay (at most 1.5x `target_ms`): 33 files.
- Placeholder names (they keep sound-review-fixes-check's limits: within 4.5 dB of the house level, at most 15,000 bytes) limited past transparent: `flip.crash` (-7.0 dB), `orbit.crash` (-14.0 dB), `numpyramid.place` (-4.8 dB), `codeword.ripple` (-3.1 dB), `strikeout.strike` (-10.7 dB), `wordslide.lock` (-5.2 dB), `homerun.footsteps` (-4.7 dB), `safe.solve` (-6.8 dB).
- Quieter than their family by 6 dB or more (a sharp spike over a quiet body, as recorded; more would need audible limiting), for Joe to judge by ear: `minigolf.land` (12.9 dB), `tripeaks.nudge` (12.7 dB), `minigolf.chip` (12.0 dB), `fences.solve` (11.9 dB), `pyramid.wrongPair` (11.8 dB), `blockfall.heartbeat` (10.1 dB), `freecell.bounce` (10.1 dB), `pool.blackUnlock` (9.9 dB), `minigolf.plip` (9.2 dB), `freecell.undo` (9.1 dB), `pool.cueCrack` (8.0 dB), `pool.rackRoll` (7.9 dB), `freecell.wobble` (7.7 dB), `tendrop.tenBurst` (7.7 dB), `symscan.gridClear` (7.4 dB), `bridges.double` (7.1 dB), `tripeaks.flip` (7.0 dB), `bubble.fallSplash` (6.5 dB), `inkbridge.birdFlap` (6.5 dB), `tents.solve` (6.4 dB), `inkbridge.parFlourish` (6.2 dB), `tubes.reset` (6.1 dB), `wordsearch.found.base` (6.1 dB).

## The held-back files, now wired

Each was processed from its batch's upload on its batch's method and replaces main's file of that name: `bomb.defuse`, `chain.heartbeat`, `chain.reshuffle`, `clayshoot.birdWrong` (its batch-3 retake), `clayshoot.escape`, `clayshoot.goldChime`, `clayshoot.goldShatter`, `clayshoot.shot`, `numhunt.combo`, `numhunt.note-high`, `numhunt.note-low`, `numhunt.note-mid`, `numhunt.shuffle`, `numhunt.warn`, `numhunt.wrong`, `reaction.bar`, `reaction.combo`, `reaction.done` (its batch-3 retake), `reaction.hit`, `reaction.wrong` (its batch-3 retake), `tendrop.apply`, `tendrop.count` (its batch-3 retake), `tendrop.near`, `tendrop.shatter`, `tendrop.tap` (its batch-3 retake), `tendrop.tenBurst` (its batch-3 retake), `whack.bonk` (its batch-3 retake), `whack.diamond`, `whack.emptyTap`, `whack.hedgehog`, `whack.slam`, `whack.whistle`, `whack.wrongHat`, `flow.connect`, `laser.bomb`, `pipes.flow`, `swing.streak`, `push.solve`. A retake of the same name (above) is the final take.

`minigolf.loop` and `minigolf.loopBack` are one-shots (the loop-the-loop): batch 2's CSV marked them `loop`, so they were made as seamless loops; they are made again as one-shots and their rows corrected.

## Music

- `music_blockfall`: stereo 128 kbps, -18.5 LUFS (the beds' -18.45), true peak -6.2 dB. The take ends on a fade-out, so it loops at 54.4 s, the best match before the fade (a whole 60 s loop would leave a gap): crossfade 40 ms.
- `music_matchup`: stereo 128 kbps, -18.4 LUFS (the beds' -18.45), true peak -7.1 dB. The take ends on a fade-out, so it loops at 51.0 s, the best match before the fade (a whole 60 s loop would leave a gap): crossfade 40 ms.
- `music_eatgrow` (Meteor's bed): batch 2's take (uploaded as `music_snake.mp3`), replacing the bed copied from Lovable; its `sources.json` pin is the new file's.

## The announcer's lines

| File | Take | Word | Kept | Tempo | LUFS | True peak |
|---|---|---|---|---|---|---|
| `/sounds/voice.great.mp3` | 4127 ms | 67–960 ms | 893 ms | 1 | -17.0 | -5.3 |
| `/sounds/voice.brilliant.mp3` | 4284 ms | 53–1060 ms | 1007 ms | 1 | -17.0 | -6.1 |
| `/sounds/voice.superb.mp3` | 4676 ms | 93–1468 ms | 1240 ms | 1.109 | -17.0 | -4.7 |
| `/sounds/voice.amazing.mp3` | 4284 ms | 71–1156 ms | 1084 ms | 1 | -17.0 | -3.4 |
| `/sounds/voice.outstanding.mp3` | 4598 ms | 80–1536 ms | 1240 ms | 1.174 | -17.0 | -3.7 |
| `/sounds/voice.incredible.mp3` | 4676 ms | 84–1494 ms | 1240 ms | 1.137 | -17.0 | -3.5 |
| `/sounds/voice.sensational.mp3` | 4754 ms | 44–1644 ms | 1240 ms | 1.29 | -17.0 | -4.6 |
| `/sounds/voice.unbelievable.mp3` | 4754 ms | 97–1549 ms | 1240 ms | 1.171 | -17.0 | -5.1 |
| `/sounds/voice.phenomenal.mp3` | 4676 ms | 113–1472 ms | 1240 ms | 1.096 | -17.0 | -3.5 |
| `/sounds/voice.perfect.mp3` | 4284 ms | 116–1037 ms | 921 ms | 1 | -17.0 | -1.6 |
| `/sounds/voice.legendary.mp3` | 4676 ms | 108–1513 ms | 1240 ms | 1.133 | -17.0 | -5.4 |
| `/sounds/voice.flawless.mp3` | 4676 ms | 147–1413 ms | 1240 ms | 1.021 | -17.0 | -6.3 |

The tempo (rubberband, pitch and formants kept) tightens the seven words longer than 1.24 s so every line is under 1.3 s; `voice.sensational` needed the most (1.29x), so it's the first to listen to. All twelve sit at -17 LUFS: 3 dB over the score sting (`reveal_score`, -20.2) and 1.4 dB under the solve chime (`correct`), which has finished by then.

## Still to record

- `orbit.checkpoint`: main's placeholder plays (the take was damaged).
- `wordsearch.found4`–`found9` (Lookout's series): main's placeholders play; the retaken note is still a sharp spike over a quiet body.
- `wordhunt.word`: main's placeholder plays (the batch-2 upload was a copy of `strikeout.solve`).
- `hover.gate`, `hover.star`, `hover.thrust`, `bastion.weakTing`: Joe kept main's sound; a new take only if he wants one.
- `target.operator`: never recorded (batch 2's upload was digital silence).
