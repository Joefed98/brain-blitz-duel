# Sound batch 3: wiring (17 Nov 2026)

**Wired on 18 Nov 2026** ([sound-wiring-nov18.md](sound-wiring-nov18.md)): every file below now plays in the live game, the held-back ones included, and `NEW_GAME_SOUNDS` is on; sound-manifest-check is strict again. The "nothing is wired" notes below describe the batch as it was delivered.

Joe's 141 ElevenLabs uploads, listed in [sounds-batch-3.csv](sounds-batch-3.csv) (branch `sounds-batch-3`, commit
6d5a5e7d): 118 new sounds for the Pattern (#433), Action (#436), Home Run and Top Bins (#444) and Logic 1 (#430)
overhauls, and 23 retakes of batch 1.

- **New sounds:** `python3 -I scripts/sound-batch-3/process.py <originals> public/sounds <report>` on batch 2's method
  (trim to the attack, cut to `target_ms` with a 10 ms fade, ring out to the natural decay up to 1.5x where the cut
  would chop (17 files), levelled to the house standard, mono 44.1 kHz 96 kbps; measures in `scripts/sound-batch-3/report.json`).
  No take made two events where its prompt asked for one, so nothing is cut to its first event.
- **Loops** (`orbit.thrust`, `freekick.bendWhistle`, `freekick.powerTone`, `freekick.windFlag`, `gravity.tilt`): made
  seamless by sound batch 6's `make_loop`, levelled to the loops' -16.8 LUFS. The three Top Bins loops replace
  placeholders, so they keep that data's 32,000-byte aim (about 2.5 s at most).
- **Long beds** (`bastion.dustWind`, `bastion.stormFire`): stereo 128 kbps at the beds' -18.45 LUFS, as the library's
  ambience beds. Each is looped by `bed_loop`: the join is placed away from the booms and crackles, with the levels either
  side as close as the take allows, and a 0.4 s equal-power crossfade, written with fix.py's wrap-around frames.
  `bastion.dustWind`: a 4.78 s loop (from 0.0 s to 4.78 s of the take), the level across the join -0.1 dB over
  400 ms and +2.2 dB over 50 ms, the sample step 0.36x the file's own (house limits: 2 dB, under 1x).
  `bastion.stormFire`: a 3.82 s loop (from 0.17 s to 3.99 s of the take), the level across the join +1.7 dB over
  400 ms and +1.9 dB over 50 ms, the sample step 0.26x the file's own (house limits: 2 dB, under 1x).
- **Batch 1's retakes** are compared with the batch-1 files on #448's branch (`scripts/sound-batch-1/retakes.py`); which
  take won and why is in [batch-1-wiring.md](batch-1-wiring.md) "Retakes from batch 3", and this branch carries #448's
  result (merged in). `nonogram.solve`: Joe kept batch 1's take; the new upload measures clean if he wants it.

**Nothing is wired.** `NEW_GAME_SOUNDS` stays off. The four overhaul PRs are already on main (the puzzle and arcade trains,
#449 and #450), so wiring is a change on main: each slot's manifest entry takes `url: "/sounds/<file>"` and `ms` below.
Files waiting for wiring are left out of the offline download (`awaitingWiringPaths`) and noted, not failed, by
sound-manifest-check (the temporary exception approved for batch 1, now covering every `sounds-batch-*.csv`).

**Held back** (a live slot on main already plays main's file of that name, so main's is kept): `flow.connect`, `laser.bomb`, `pipes.flow`, `swing.streak`, `push.solve`.
Joe's processed take of each is re-made by `ONLY=<file> python3 -I scripts/sound-batch-3/process.py <originals> public/sounds <report>`
when he chooses to swap it in.

**38 names replace placeholders on main** (behind `NEW_GAME_SOUNDS`): Joe's files are kept, main's
`newGameSounds.data.ts` measures them, and they keep that data's limits (sound-review-fixes-check), so a few are limited
a little past transparent (noted below). `orbit.checkpoint` keeps main's placeholder: its take misses the level limit even past
audible limiting (on [batch-3-retakes.md](batch-3-retakes.md)).

**Merge order:** this branch carries #448 and #451 merged in (each merged main first); merge them before this one.

## Retakes

The sounds still to re-record are in [batch-3-retakes.md](batch-3-retakes.md) (marked “retake” below).

## Every file

The first column is the file's manifest `url`. Length after processing (ms), loudness (LUFS) against its target, true
peak (dBFS). “Slot on main” says whether main's manifest has the slot today, and its file if it plays one.

| File (`url`) | Slot | PR | Slot on main | Target ms | ms | LUFS (target) | True peak | Note |
|---|---|---|---|---|---|---|---|---|
| /sounds/bastion.dry.mp3 | `bastion.dry` | #436 | yes, silent | 120 | 180 | -22.8 (-22.7) | -1.8 | replaces the placeholder, rings out |
| /sounds/bastion.nearMiss.mp3 | `bastion.nearMiss` | #436 | yes, silent | 350 | 350 | -23.4 (-17.5) | -2.7 |  |
| /sounds/bastion.panelCrack.mp3 | `bastion.panelCrack` | #436 | yes, silent | 500 | 485 | -17.6 (-17.5) | -2.0 |  |
| /sounds/bastion.shellIn.mp3 | `bastion.shellIn` | #436 | yes, silent | 90 | 90 | -22.9 (-22.7) | -1.0 |  |
| /sounds/bastion.tally.mp3 | `bastion.tally` | #436 | yes, silent | 150 | 150 | -22.9 (-22.7) | -2.7 |  |
| /sounds/bastion.tip.mp3 | `bastion.tip` | #436 | yes, silent | 300 | 300 | -17.5 (-17.5) | -2.3 |  |
| /sounds/bastion.weakTing.mp3 | `bastion.weakTing` | #436 | yes, silent | 250 | 250 | -17.7 (-17.5) | -1.6 |  |
| /sounds/flip.crash.mp3 | `flip.crash` | #436 | yes, silent | 300 | 450 | -17.5 (-17.5) | -2.2 | replaces the placeholder, rings out |
| /sounds/flip.doubleFlip.mp3 | `flip.doubleFlip` | #436 | yes, plays /sounds/banner.combo.mp3 | 450 | 450 | -17.5 (-17.5) | -2.0 |  |
| /sounds/flip.flipDown.mp3 | `flip.flipDown` | #436 | yes, silent | 300 | 300 | -17.7 (-17.5) | -1.5 |  |
| /sounds/flip.flipUp.mp3 | `flip.flipUp` | #436 | yes, silent | 300 | 300 | -17.5 (-17.5) | -1.6 |  |
| /sounds/flip.flowBreak.mp3 | `flip.flowBreak` | #436 | yes, silent | 350 | 350 | -31.3 (-17.5) | -1.4 | retake |
| /sounds/flip.flowTen.mp3 | `flip.flowTen` | #436 | yes, silent | 300 | 300 | -17.6 (-17.5) | -1.1 |  |
| /sounds/flip.flowTick.mp3 | `flip.flowTick` | #436 | yes, silent | 160 | 240 | -22.7 (-22.7) | -9.4 | rings out, retake |
| /sounds/flip.land.mp3 | `flip.land` | #436 | yes, silent | 180 | 180 | -22.8 (-22.7) | -4.6 |  |
| /sounds/flip.nearMiss.mp3 | `flip.nearMiss` | #436 | yes, silent | 250 | 250 | -17.5 (-17.5) | -3.1 |  |
| /sounds/flip.respawn.mp3 | `flip.respawn` | #436 | yes, silent | 500 | 487 | -17.5 (-17.5) | -2.6 |  |
| /sounds/flip.sweetLanding.mp3 | `flip.sweetLanding` | #436 | yes, plays /sounds/sfx_spark_chime.mp3 | 400 | 400 | -17.5 (-17.5) | -2.5 |  |
| /sounds/orbit.checkpoint.mp3 | `orbit.checkpoint` | #436 | yes, silent | 300 | 300 | -25.2 (-17.5) | -1.0 | main's placeholder kept, limited past transparent (-10.4 dB), retake |
| /sounds/orbit.crash.mp3 | `orbit.crash` | #436 | yes, silent | 300 | 300 | -17.7 (-17.5) | -1.1 | replaces the placeholder |
| /sounds/orbit.launch.mp3 | `orbit.launch` | #436 | yes, silent | 150 | 225 | -22.7 (-22.7) | -7.9 | replaces the placeholder, rings out |
| /sounds/orbit.planetCaught.mp3 | `orbit.planetCaught` | #436 | yes, plays /sounds/orbit.planetCatch.mp3 | 500 | 482 | -21.3 (-17.5) | -2.3 |  |
| /sounds/orbit.respawnReady.mp3 | `orbit.respawnReady` | #436 | yes, silent | 250 | 250 | -17.5 (-17.5) | -11.2 |  |
| /sounds/orbit.stardust.mp3 | `orbit.stardust` | #436 | yes, silent | 120 | 180 | -22.7 (-22.7) | -7.7 | rings out, retake |
| /sounds/skyline.drop.mp3 | `skyline.drop` | #436 | yes, silent | 350 | 350 | -17.5 (-17.5) | -2.9 | replaces the placeholder |
| /sounds/skyline.perfect.mp3 | `skyline.perfect` | #436 | yes, plays /sounds/skyline.floors.mp3 | 250 | 250 | -17.5 (-17.5) | -2.8 |  |
| /sounds/skyline.wideBlock.mp3 | `skyline.wideBlock` | #436 | yes, silent | 400 | 400 | -18.6 (-17.5) | -2.3 |  |
| /sounds/swing.outOfReach.mp3 | `swing.outOfReach` | #436 | yes, silent | 300 | 300 | -22.9 (-17.5) | -2.6 |  |
| /sounds/swing.ropeSnap.mp3 | `swing.ropeSnap` | #436 | yes, silent | 200 | 200 | -26.1 (-22.7) | -2.9 |  |
| /sounds/swing.speedWhoosh.mp3 | `swing.speedWhoosh` | #436 | yes, silent | 450 | 450 | -17.7 (-17.5) | -2.0 |  |
| /sounds/swing.streakMeter.mp3 | `swing.streakMeter` | #436 | yes, silent | 120 | 120 | -24.4 (-22.7) | -2.5 |  |
| /sounds/swing.stretchTally.mp3 | `swing.stretchTally` | #436 | yes, silent | 90 | 90 | -22.7 (-22.7) | -3.4 |  |
| /sounds/freekick.goldTick.mp3 | `freekick.goldTick` | #444 | yes, silent | 120 | 180 | -22.7 (-22.7) | -10.9 | replaces the placeholder, rings out |
| /sounds/freekick.spill.mp3 | `freekick.spill` | #444 | yes, silent | 500 | 480 | -21.9 (-17.5) | -2.3 | replaces the placeholder, limited past transparent (-3.2 dB) |
| /sounds/freekick.wallJump.mp3 | `freekick.wallJump` | #444 | yes, silent | 500 | 487 | -21.8 (-17.5) | -1.8 | replaces the placeholder, limited past transparent (-7.4 dB) |
| /sounds/homerun.aimThunk.mp3 | `homerun.aimThunk` | #444 | yes, silent | 250 | 250 | -21.8 (-17.5) | -2.1 | replaces the placeholder, limited past transparent (-11.8 dB) |
| /sounds/homerun.perfect.mp3 | `homerun.perfect` | #444 | yes, silent | 400 | 400 | -17.5 (-17.5) | -2.1 | replaces the placeholder |
| /sounds/homerun.swing.mp3 | `homerun.swing` | #444 | yes, silent | 120 | 180 | -22.7 (-22.7) | -6.3 | replaces the placeholder, rings out, retake |
| /sounds/nonogram.autoCross.mp3 | `nonogram.autoCross` | #430 | yes, silent | 140 | 140 | -24.7 (-22.7) | -2.3 | replaces the placeholder |
| /sounds/sudoku.check.mp3 | `sudoku.check` | #430 | yes, silent | 200 | 200 | -24.3 (-22.7) | -2.3 | replaces the placeholder |
| /sounds/tubes.uncover.mp3 | `tubes.uncover` | #430 | yes, silent | 300 | 300 | -17.5 (-17.5) | -5.3 | replaces the placeholder |
| /sounds/blockparty.flip.mp3 | `blockparty.flip` | #433 | yes, plays /sounds/ui.select.mp3 | 200 | 200 | -22.9 (-22.7) | -1.3 |  |
| /sounds/blockparty.illegal.mp3 | `blockparty.illegal` | #433 | yes, plays /sounds/checkout.thud.mp3 | 350 | 350 | -20.0 (-17.5) | -2.6 |  |
| /sounds/blockparty.pickup.mp3 | `blockparty.pickup` | #433 | yes, plays /sounds/gem.pick.mp3 | 180 | 180 | -22.7 (-22.7) | -1.4 |  |
| /sounds/blockparty.place.mp3 | `blockparty.place` | #433 | yes, plays /sounds/block.place.mp3 | 200 | 200 | -24.2 (-22.7) | -1.9 |  |
| /sounds/blockparty.reset.mp3 | `blockparty.reset` | #433 | yes, plays /sounds/move.slide.mp3 | 450 | 487 | -17.5 (-17.5) | -3.3 | rings out |
| /sounds/blockparty.solve.mp3 | `blockparty.solve` | #433 | yes, plays /sounds/done.pops.mp3 | 100 | 150 | -22.7 (-22.7) | -9.9 | rings out, retake |
| /sounds/blockparty.turn.mp3 | `blockparty.turn` | #433 | yes, plays /sounds/ui.select.mp3 | 180 | 180 | -22.7 (-22.7) | -6.0 |  |
| /sounds/blockparty.undo.mp3 | `blockparty.undo` | #433 | yes, plays /sounds/gem.pick.mp3 | 180 | 180 | -22.7 (-22.7) | -4.1 |  |
| /sounds/flow.connect.mp3 | `flow.connect` | #433 | yes, plays /sounds/flow.connect.mp3 | 500 | 487 | -21.9 (-17.5) | -1.4 | held back (main's file plays live) |
| /sounds/flow.cut.mp3 | `flow.cut` | #433 | yes, plays /sounds/arc_sea_pop.mp3 | 240 | 360 | -17.6 (-17.5) | -2.5 | rings out, retake |
| /sounds/flow.draw.mp3 | `flow.draw` | #433 | yes, plays /sounds/arc_sea_bubble.mp3 | 150 | 225 | -22.7 (-22.7) | -6.2 | rings out, retake |
| /sounds/gravity.combo.mp3 | `gravity.combo` | #433 | yes, plays /sounds/combo.mp3 | 500 | 480 | -17.5 (-17.5) | -5.3 |  |
| /sounds/gravity.stop.mp3 | `gravity.stop` | #433 | yes, plays /sounds/arc_marble_clink.mp3 | 100 | 100 | -22.9 (-22.7) | -3.2 |  |
| /sounds/iceslide.bump.mp3 | `iceslide.bump` | #433 | yes, plays /sounds/arc_wood_knock.mp3 | 80 | 120 | -22.7 (-22.7) | -1.3 | rings out, retake |
| /sounds/iceslide.nearExit.mp3 | `iceslide.nearExit` | #433 | yes, plays /sounds/gem.glint.mp3 | 300 | 300 | -17.5 (-17.5) | -4.5 |  |
| /sounds/iceslide.slide.mp3 | `iceslide.slide` | #433 | yes, silent | 170 | 255 | -17.4 (-17.5) | -4.8 | replaces the placeholder, rings out, retake |
| /sounds/iceslide.stop.mp3 | `iceslide.stop` | #433 | yes, plays /sounds/arc_fair_thud.mp3 | 150 | 150 | -22.8 (-22.7) | -3.2 | retake |
| /sounds/laser.bomb.mp3 | `laser.bomb` | #433 | yes, plays /sounds/laser.bomb.mp3 | 490 | 479 | -17.6 (-17.5) | -2.6 | held back (main's file plays live) |
| /sounds/laser.fire.mp3 | `laser.fire` | #433 | yes, silent | 400 | 487 | -17.6 (-17.5) | -2.7 | replaces the placeholder, rings out |
| /sounds/laser.place.mp3 | `laser.place` | #433 | yes, silent | 120 | 120 | -22.8 (-22.7) | -2.5 | replaces the placeholder |
| /sounds/laser.turn.mp3 | `laser.turn` | #433 | yes, silent | 130 | 195 | -22.6 (-22.7) | -3.9 | replaces the placeholder, rings out, retake |
| /sounds/pipes.drain.mp3 | `pipes.drain` | #433 | yes, plays /sounds/combo.lost.mp3 | 500 | 480 | -17.6 (-17.5) | -1.0 |  |
| /sounds/pipes.flow.mp3 | `pipes.flow` | #433 | yes, plays /sounds/pipes.flow.mp3 | 300 | 300 | -18.6 (-17.5) | -2.6 | held back (main's file plays live) |
| /sounds/pipes.rotate.mp3 | `pipes.rotate` | #433 | yes, silent | 150 | 150 | -22.9 (-22.7) | -1.8 | replaces the placeholder |
| /sounds/push.goldOff.mp3 | `push.goldOff` | #433 | yes, plays /sounds/retro.powerDown.mp3 | 400 | 400 | -21.0 (-17.5) | -2.3 |  |
| /sounds/push.push.mp3 | `push.push` | #433 | yes, silent | 220 | 330 | -17.6 (-17.5) | -2.3 | replaces the placeholder, rings out, retake |
| /sounds/push.step.mp3 | `push.step` | #433 | yes, silent | 110 | 110 | -22.9 (-22.7) | -2.5 | replaces the placeholder |
| /sounds/push.stuck.mp3 | `push.stuck` | #433 | yes, plays /sounds/swing.vineCreak.mp3 | 500 | 487 | -19.1 (-17.5) | -2.1 |  |
| /sounds/unblock.blocked.mp3 | `unblock.blocked` | #433 | yes, plays /sounds/arc_wood_knock.mp3 | 120 | 120 | -22.7 (-22.7) | -2.8 |  |
| /sounds/unblock.laneClear.mp3 | `unblock.laneClear` | #433 | yes, plays /sounds/gem.glint.mp3 | 350 | 350 | -17.5 (-17.5) | -1.5 |  |
| /sounds/unblock.slideLong.mp3 | `unblock.slideLong` | #433 | yes, plays /sounds/move.slide.mp3 | 250 | 375 | -17.6 (-17.5) | -4.0 | rings out |
| /sounds/bastion.debris.mp3 | `bastion.debris` | #436 | yes, silent | 600 | 600 | -17.1 (-17.1) | -1.9 |  |
| /sounds/orbit.lowFuel.mp3 | `orbit.lowFuel` | #436 | yes, silent | 600 | 268 | -17.5 (-17.5) | -6.7 |  |
| /sounds/skyline.goldChime.mp3 | `skyline.goldChime` | #436 | to add | 600 | 600 | -17.2 (-17.1) | -1.8 |  |
| /sounds/skyline.lifeLost.mp3 | `skyline.lifeLost` | #436 | yes, silent | 600 | 493 | -22.4 (-17.5) | -2.5 |  |
| /sounds/skyline.miss.mp3 | `skyline.miss` | #436 | yes, silent | 600 | 600 | -17.1 (-17.1) | -1.1 | replaces the placeholder |
| /sounds/swing.streak.mp3 | `swing.streak` | #436 | yes, plays /sounds/swing.streak.mp3 | 600 | 600 | -17.1 (-17.1) | -3.4 | held back (main's file plays live) |
| /sounds/freekick.dive.mp3 | `freekick.dive` | #444 | yes, silent | 600 | 600 | -20.7 (-17.1) | -2.6 | replaces the placeholder |
| /sounds/freekick.hoopShrink.mp3 | `freekick.hoopShrink` | #444 | yes, silent | 600 | 600 | -17.1 (-17.1) | -2.6 | replaces the placeholder |
| /sounds/homerun.slide.mp3 | `homerun.slide` | #444 | yes, silent | 600 | 599 | -17.1 (-17.1) | -1.0 | replaces the placeholder |
| /sounds/homerun.umpBall.mp3 | `homerun.umpBall` | #444 | yes, silent | 600 | 519 | -17.0 (-17.1) | -1.5 | replaces the placeholder |
| /sounds/gravity.boardClear.mp3 | `gravity.boardClear` | #433 | yes, plays /sounds/ui.counterLock.mp3 | 600 | 600 | -17.0 (-17.1) | -1.8 |  |
| /sounds/gravity.outOfTilts.mp3 | `gravity.outOfTilts` | #433 | yes, plays /sounds/checkout.thud.mp3 | 600 | 600 | -21.0 (-17.1) | -2.4 |  |
| /sounds/pipes.bubble.mp3 | `pipes.bubble` | #433 | yes, plays /sounds/arc_sea_bubble.mp3 | 550 | 550 | -19.3 (-17.1) | -2.4 |  |
| /sounds/pipes.combo.mp3 | `pipes.combo` | #433 | yes, plays /sounds/combo.mp3 | 600 | 600 | -17.1 (-17.1) | -5.2 |  |
| /sounds/unblock.slide.mp3 | `unblock.slide` | #433 | yes, plays /sounds/move.slide.mp3 | 530 | 530 | -17.1 (-17.1) | -1.5 |  |
| /sounds/bastion.jamGrind.mp3 | `bastion.jamGrind` | #436 | yes, silent | 700 | 562 | -17.2 (-17.1) | -2.4 |  |
| /sounds/skyline.sliver.mp3 | `skyline.sliver` | #436 | yes, silent | 700 | 687 | -17.1 (-17.1) | -1.3 |  |
| /sounds/skyline.trim.mp3 | `skyline.trim` | #436 | yes, silent | 700 | 683 | -22.0 (-17.1) | -1.1 |  |
| /sounds/homerun.umpOut.mp3 | `homerun.umpOut` | #444 | yes, silent | 700 | 683 | -17.2 (-17.1) | -2.5 | replaces the placeholder |
| /sounds/homerun.umpStrike.mp3 | `homerun.umpStrike` | #444 | yes, silent | 700 | 680 | -17.1 (-17.1) | -3.2 | replaces the placeholder |
| /sounds/homerun.walk.mp3 | `homerun.walk` | #444 | yes, silent | 700 | 687 | -17.1 (-17.1) | -5.2 | replaces the placeholder |
| /sounds/flow.nearMiss.mp3 | `flow.nearMiss` | #433 | yes, plays /sounds/arc_retro_blip.mp3 | 700 | 680 | -20.4 (-17.1) | -2.5 |  |
| /sounds/laser.nearMiss.mp3 | `laser.nearMiss` | #433 | yes, plays /sounds/arc_retro_blip.mp3 | 700 | 680 | -17.1 (-17.1) | -3.2 |  |
| /sounds/laser.outOfShots.mp3 | `laser.outOfShots` | #433 | yes, plays /sounds/retro.powerDown.mp3 | 700 | 685 | -17.2 (-17.1) | -2.0 |  |
| /sounds/homerun.runScores.mp3 | `homerun.runScores` | #444 | yes, silent | 800 | 800 | -17.1 (-17.1) | -4.3 | replaces the placeholder |
| /sounds/flip.flowCount.mp3 | `flip.flowCount` | #436 | yes, silent | 900 | 880 | -17.1 (-17.1) | -1.7 |  |
| /sounds/orbit.outOfFuel.mp3 | `orbit.outOfFuel` | #436 | yes, silent | 900 | 884 | -17.1 (-17.1) | -1.9 |  |
| /sounds/homerun.footsteps.mp3 | `homerun.footsteps` | #444 | yes, silent | 900 | 880 | -21.5 (-17.1) | -2.5 | replaces the placeholder, limited past transparent (-4.7 dB), retake |
| /sounds/iceslide.slideLong.mp3 | `iceslide.slideLong` | #433 | yes, plays /sounds/move.slide.mp3 | 900 | 886 | -17.1 (-17.1) | -2.9 |  |
| /sounds/homerun.strikeout.mp3 | `homerun.strikeout` | #444 | yes, silent | 1000 | 1000 | -16.7 (-16.5) | -2.4 | replaces the placeholder |
| /sounds/orbit.thrust.mp3 | `orbit.thrust` | #436 | yes, silent | 1500 | 1344 | -16.8 (-16.8) | -3.6 | loop |
| /sounds/swing.pteroShadow.mp3 | `swing.pteroShadow` | #436 | yes, silent | 1200 | 1200 | -16.7 (-16.5) | -2.6 |  |
| /sounds/freekick.bendWhistle.mp3 | `freekick.bendWhistle` | #444 | yes, silent | 1200 | 1447 | -16.8 (-16.8) | -8.0 | replaces the placeholder, loop |
| /sounds/flow.solve.mp3 | `flow.solve` | #433 | yes, plays /sounds/done.glowSweep.mp3 | 1200 | 1200 | -16.5 (-16.5) | -4.2 |  |
| /sounds/push.solve.mp3 | `push.solve` | #433 | yes, plays /sounds/push.solve.mp3 | 1300 | 1230 | -22.3 (-16.5) | -2.2 | held back (main's file plays live) |
| /sounds/bastion.wallHeld.mp3 | `bastion.wallHeld` | #436 | yes, silent | 1800 | 1800 | -16.6 (-16.5) | -2.2 |  |
| /sounds/swing.courseCleared.mp3 | `swing.courseCleared` | #436 | yes, silent | 1600 | 1600 | -16.5 (-16.5) | -2.2 |  |
| /sounds/freekick.powerTone.mp3 | `freekick.powerTone` | #444 | yes, silent | 1600 | 1815 | -16.8 (-16.8) | -9.4 | replaces the placeholder, loop |
| /sounds/orbit.sunBloom.mp3 | `orbit.sunBloom` | #436 | yes, silent | 2500 | 2480 | -16.5 (-16.5) | -2.4 |  |
| /sounds/skyline.endCount.mp3 | `skyline.endCount` | #436 | to add | 2500 | 2480 | -16.5 (-16.5) | -2.7 |  |
| /sounds/homerun.inningsEnd.mp3 | `homerun.inningsEnd` | #444 | yes, silent | 2500 | 1174 | -16.5 (-16.5) | -2.0 | replaces the placeholder, shortened for the placeholder's size aim |
| /sounds/freekick.windFlag.mp3 | `freekick.windFlag` | #444 | yes, silent | 3000 | 1776 | -16.8 (-16.8) | -2.5 | replaces the placeholder, loop, shortened for the placeholder's size aim |
| /sounds/gravity.tilt.mp3 | `gravity.tilt` | #433 | yes, plays /sounds/arc_marble_roll.mp3 | 3000 | 2573 | -20.0 (-16.8) | -2.6 | loop |
| /sounds/freekick.chant.mp3 | `freekick.chant` | #444 | yes, silent | 4000 | 1153 | -16.5 (-16.5) | -1.9 | replaces the placeholder, shortened for the placeholder's size aim |
| /sounds/bastion.dustWind.mp3 | `bastion.dustWind` | #436 | yes, silent | 6000 | 4780 | -18.4 (-18.45) | -7.3 | ambience bed, stereo loop |
| /sounds/bastion.stormFire.mp3 | `bastion.stormFire` | #436 | yes, silent | 6000 | 3820 | -18.4 (-18.45) | -2.1 | ambience bed, stereo loop, retake |

