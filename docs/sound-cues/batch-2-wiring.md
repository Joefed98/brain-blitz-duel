# Sound batch 2: wiring (16 Nov 2026)

**Wired on 18 Nov 2026** ([sound-wiring-nov18.md](sound-wiring-nov18.md)): every file below now plays in the live game, the held-back ones included, and `NEW_GAME_SOUNDS` is on; sound-manifest-check is strict again. The "nothing is wired" notes below describe the batch as it was delivered.

Joe's 309 ElevenLabs uploads for the Number (#431), Word (#437), Retro (#440), Cards and Board (#441), Strategy
(#442), Crazy Golf (#443) and Sports (#445) overhauls, listed in [sounds-batch-2.csv](sounds-batch-2.csv) (branch
`sounds-batch-2`, commit a512ca90). `python3 -I scripts/sound-batch-2/process.py <originals> public/sounds <report>`
cuts and levels them into `public/sounds/<file>` on batch 1's method ([batch-1-wiring.md](batch-1-wiring.md),
[levels-nov-2026.md](levels-nov-2026.md)); its measures are in `scripts/sound-batch-2/report.json`.

- **One-shots:** mono 44.1 kHz 96 kbps, trimmed to the attack, cut to `target_ms` with a 10 ms fade. A sound still
  within 10 dB of its peak at `target_ms` rings out to its natural decay, never past 1.5x (68 files). Two events
  where one was asked: only `kakuro.pencil` (a single graphite tick) keeps its first event; every other take with
  several events asked for them (“two beats”, “followed by”, “a run of ticks”).
- **Loops** (`loop` yes, 9 effects): the whole take made seamless by sound batch 6's `make_loop` (the loop whose
  waveform and level best match across the join, crossfaded into its head), levelled to the loops' -16.8 LUFS
  measured twice through, written with fix.py's wrap-around frames. `balltrack.roll` and `bubble.waves` replace
  November placeholders, whose 32,000-byte aim keeps them to about 2.5 s: `bubble.waves` (6 s asked) is a 2.2 s loop
  for now; when #442 wires it, it can re-run with that aim lifted for its slot.
- **`music_snake`:** stereo 128 kbps (the library's bed format), the beds' -18.45 LUFS. The take does not end on a
  fade, so it loops whole, its last 40 ms crossfaded into its opening.
- **Pitch series** (“Record ONE clean note only”): each `.base` file is processed, kept, and resampled into its
  series on the steps in word-elevenlabs.md (#437): Nucleus `wordsmith.word4–9` and Lookout `wordsearch.found4–9` six
  steps of a major scale (0, 2, 4, 5, 7, 9 semitones; Lookout's doc says only “six rising pitches”), Forage
  `wordhunt.trace1–9` nine major-scale steps (0 … 14), Roundabout `letterwheel.trace1–8` a pentatonic scale (0, 2, 4, 7,
  9, 12, 14, 16), Interlock `tilegrid.word3–7` a chord growing from three notes to five (0+4+7, 4+7+12, 0+4+7+12,
  4+7+12+16, 0+4+7+12+16). A higher note is also shorter, as a struck note is. They are listed in
  [sounds-batch-2-series.csv](sounds-batch-2-series.csv). The `.base` files have no slot of their own: they are the
  source of their series.
- **CSV fix:** `balance.solve` has `target_ms` 0; it takes its slot's 1080 ms from #431's manifest (the take is 0.5 s,
  so it keeps its natural 486 ms).
- **To record:** `wordhunt.word.mp3` (the upload is a byte-for-byte copy of `strikeout.solve.mp3`) and
  `target.operator.mp3` (digital silence): marked TO RECORD in the CSV, not processed, nothing in `public/sounds/`.

**Nothing is wired.** `NEW_GAME_SOUNDS` stays off; once a PR is on main, its manifest entry sets `url: "/sounds/<file>"`
and `ms` to the length below. None of batch 2's names is a file a slot plays live on main, so nothing is held back
(batch 1's `bomb.defuse` stays held back). 51 names replace November placeholders (played only with `NEW_GAME_SOUNDS`
on); make.py measures them instead of re-synthesising them, and they keep that data's limits (sound-review-fixes-check).
Marked † below.

**Merge order.** This branch contains batch 1 (#448) merged in, because it extends batch 1's tooling; merge #448 first.
Word's series files (`wordsmith.word4.mp3` …) are also added as placeholders by #437, so whichever lands second keeps
Joe's files: the merge captain takes this branch's copies and #437's manifest entries.

## sound-manifest-check and the offline download

Changed with Joe's approval, 16 Nov 2026 (batch-1 sounds awaiting wiring), extended to batch 2 at his request: a file
named in any `docs/sound-cues/sounds-batch-*.csv` that no slot plays yet is noted as awaiting wiring instead of failing
(`src/lib/offline/soundBatches.ts`), and left out of the offline download until wired (`awaitingWiringPaths`).
**This is temporary: once every batch file is wired, take the exception out of `scripts/sound-manifest-check.ts` so the
check is strict again.** The five `.base` files will never be wired: move them out of `public/sounds/` then.

## Retakes

The sounds still to re-record are in [batch-2-retakes.md](batch-2-retakes.md) (marked “retake” below).

## Every file

The first column is the file's manifest `url`. Length after processing (ms), loudness (LUFS) against its target, true
peak (dBFS). “Slot on the PR” says whether the PR's head of 16 Nov 2026 already has the slot in its manifest.

| File (`url`) | Slot | PR | Slot on the PR | Target ms | ms | LUFS (target) | True peak | Note |
|---|---|---|---|---|---|---|---|---|
| /sounds/cards.confirm.mp3 | `cards.confirm` | #441 | yes | 250 | 250 | -19.2 (-17.5) | -2.6 |  |
| /sounds/cards.hint.mp3 | `cards.hint` | #441 | yes | 500 | 480 | -17.5 (-17.5) | -6.9 |  |
| /sounds/cards.hintIdle.mp3 | `cards.hintIdle` | #441 | yes | 300 | 300 | -17.6 (-17.5) | -4.1 |  |
| /sounds/fivehands.columnTick.mp3 | `fivehands.columnTick` | #441 | yes | 80 | 80 | -25.6 (-22.7) | -2.6 | retake |
| /sounds/fivehands.countUp.mp3 | `fivehands.countUp` | #441 | yes | 500 | 500 | -17.2 (-17.1) | -2.1 |  |
| /sounds/fivehands.flip.mp3 | `fivehands.flip` | #441 | yes | 200 | 200 | -22.9 (-22.7) | -1.9 |  |
| /sounds/fivehands.stamp.mp3 | `fivehands.stamp` | #441 | yes | 300 | 300 | -21.7 (-17.5) | -2.5 |  |
| /sounds/freecell.combo.mp3 | `freecell.combo` | #441 | yes | 350 | 350 | -17.5 (-17.5) | -2.2 |  |
| /sounds/freecell.undo.mp3 | `freecell.undo` | #441 | yes | 300 | 300 | -23.5 (-17.5) | -2.4 | retake |
| /sounds/freecell.wobble.mp3 | `freecell.wobble` | #441 | yes | 300 | 300 | -29.0 (-17.5) | -2.3 | retake |
| /sounds/mahjong.blockers.mp3 | `mahjong.blockers` | #441 | yes | 150 | 150 | -22.7 (-22.7) | -4.9 |  |
| /sounds/mahjong.pairFly.mp3 | `mahjong.pairFly` | #441 | yes | 400 | 153 | -22.9 (-22.7) | -2.1 |  |
| /sounds/mahjong.undo.mp3 | `mahjong.undo` | #441 | yes | 300 | 300 | -22.4 (-17.5) | -2.3 |  |
| /sounds/mahjong.wrongPair.mp3 | `mahjong.wrongPair` | #441 | yes | 250 | 250 | -17.6 (-17.5) | -2.1 |  |
| /sounds/pyramid.pairFly.mp3 | `pyramid.pairFly` | #441 | yes | 400 | 400 | -25.1 (-17.5) | -2.5 | retake |
| /sounds/pyramid.uncover.mp3 | `pyramid.uncover` | #441 | yes | 200 | 300 | -17.5 (-17.5) | -2.1 | rings out |
| /sounds/pyramid.undo.mp3 | `pyramid.undo` | #441 | yes | 300 | 300 | -21.7 (-17.5) | -2.6 |  |
| /sounds/pyramid.wrongPair.mp3 | `pyramid.wrongPair` | #441 | yes | 250 | 250 | -27.7 (-17.5) | -1.8 | retake |
| /sounds/tripeaks.flip.mp3 | `tripeaks.flip` | #441 | yes | 200 | 200 | -29.4 (-22.7) | -2.4 | retake |
| /sounds/tripeaks.ladderBreak.mp3 | `tripeaks.ladderBreak` | #441 | yes | 400 | 400 | -21.2 (-17.5) | -2.2 |  |
| /sounds/tripeaks.nudge.mp3 | `tripeaks.nudge` | #441 | yes | 250 | 250 | -30.5 (-17.5) | -2.4 | retake |
| /sounds/tripeaks.peaksLight.mp3 | `tripeaks.peaksLight` | #441 | yes | 500 | 500 | -17.1 (-17.1) | -4.4 |  |
| /sounds/minigolf.aim.mp3 | `minigolf.aim` | #443 | to add | 50 | 75 | -22.7 (-22.7) | -10.2 | rings out, retake |
| /sounds/minigolf.chip.mp3 | `minigolf.chip` | #443 | yes | 350 | 263 | -28.4 (-17.5) | -2.5 | retake |
| /sounds/minigolf.flag.mp3 | `minigolf.flag` | #443 | to add | 400 | 389 | -18.7 (-17.5) | -2.2 |  |
| /sounds/minigolf.land.mp3 | `minigolf.land` | #443 | yes | 250 | 250 | -29.3 (-17.5) | -1.0 | retake |
| /sounds/minigolf.loopBack.mp3 | `minigolf.loopBack` | #443 | yes | 400 | 384 | -21.2 (-16.8) | -2.4 | loop |
| /sounds/minigolf.plip.mp3 | `minigolf.plip` | #443 | yes | 300 | 300 | -20.6 (-17.5) | -1.7 |  |
| /sounds/minigolf.putt.mp3 | `minigolf.putt` | #443 | yes | 300 | 300 | -21.3 (-17.5) | -1.9 |  |
| /sounds/minigolf.rattle.mp3 | `minigolf.rattle` | #443 | yes | 400 | 400 | -21.9 (-17.5) | -2.4 |  |
| /sounds/minigolf.sand.mp3 | `minigolf.sand` | #443 | yes | 300 | 300 | -20.3 (-17.5) | -2.2 |  |
| /sounds/balance.drop.mp3 | `balance.drop` | #431 | yes | 300 | 300 | -17.5 (-17.5) | -2.8 | † replaces the placeholder |
| /sounds/balance.fail.mp3 | `balance.fail` | #431 | yes | 300 | 300 | -17.6 (-17.5) | -2.6 |  |
| /sounds/balance.lift.mp3 | `balance.lift` | #431 | yes | 220 | 220 | -22.7 (-22.7) | -5.2 | † replaces the placeholder |
| /sounds/balance.nudge.mp3 | `balance.nudge` | #431 | yes | 200 | 300 | -22.2 (-17.5) | -2.6 | rings out |
| /sounds/balance.pickup.mp3 | `balance.pickup` | #431 | yes | 180 | 180 | -22.7 (-22.7) | -5.3 |  |
| /sounds/balance.select.mp3 | `balance.select` | #431 | yes | 150 | 150 | -22.7 (-22.7) | -6.0 |  |
| /sounds/balance.solve.mp3 | `balance.solve` | #431 | yes | 0 | 486 | -17.5 (-17.5) | -5.8 |  |
| /sounds/balance.stageClear.mp3 | `balance.stageClear` | #431 | yes | 500 | 487 | -17.5 (-17.5) | -3.7 |  |
| /sounds/checkout.aim.mp3 | `checkout.aim` | #431 | yes | 120 | 120 | -22.9 (-22.7) | -2.5 |  |
| /sounds/checkout.bust.mp3 | `checkout.bust` | #431 | yes | 450 | 414 | -22.6 (-17.5) | -2.5 |  |
| /sounds/checkout.nudge.mp3 | `checkout.nudge` | #431 | yes | 150 | 150 | -30.7 (-22.7) | -2.3 | retake |
| /sounds/checkout.stageClear.mp3 | `checkout.stageClear` | #431 | yes | 400 | 400 | -17.5 (-17.5) | -5.2 |  |
| /sounds/checkout.switch.mp3 | `checkout.switch` | #431 | yes | 90 | 90 | -22.8 (-22.7) | -2.5 |  |
| /sounds/checkout.tick.mp3 | `checkout.tick` | #431 | yes | 100 | 100 | -22.7 (-22.7) | -1.6 |  |
| /sounds/checkout.undo.mp3 | `checkout.undo` | #431 | yes | 220 | 220 | -22.8 (-22.7) | -2.6 |  |
| /sounds/checkout.wrong.mp3 | `checkout.wrong` | #431 | yes | 300 | 300 | -18.8 (-17.5) | -2.6 |  |
| /sounds/equation.chooseGap.mp3 | `equation.chooseGap` | #431 | yes | 100 | 150 | -22.7 (-22.7) | -5.6 | rings out, retake |
| /sounds/equation.clearGap.mp3 | `equation.clearGap` | #431 | yes | 120 | 120 | -22.6 (-22.7) | -4.2 |  |
| /sounds/equation.drop.mp3 | `equation.drop` | #431 | yes | 120 | 120 | -22.8 (-22.7) | -2.2 | † replaces the placeholder |
| /sounds/equation.fail.mp3 | `equation.fail` | #431 | yes | 300 | 300 | -17.7 (-17.5) | -1.8 |  |
| /sounds/equation.goBack.mp3 | `equation.goBack` | #431 | yes | 250 | 250 | -17.6 (-17.5) | -2.4 |  |
| /sounds/equation.skip.mp3 | `equation.skip` | #431 | yes | 300 | 300 | -22.6 (-17.5) | -2.5 |  |
| /sounds/equation.stageClear.mp3 | `equation.stageClear` | #431 | yes | 400 | 400 | -17.5 (-17.5) | -7.2 |  |
| /sounds/equation.tryCracked.mp3 | `equation.tryCracked` | #431 | yes | 150 | 150 | -22.9 (-22.7) | -1.9 |  |
| /sounds/kakuro.broken.mp3 | `kakuro.broken` | #431 | yes | 200 | 200 | -22.7 (-22.7) | -3.3 |  |
| /sounds/kakuro.clear.mp3 | `kakuro.clear` | #431 | yes | 200 | 200 | -22.8 (-22.7) | -6.8 |  |
| /sounds/kakuro.pencil.mp3 | `kakuro.pencil` | #431 | yes | 70 | 106 | -22.7 (-22.7) | -5.4 | rings out, first event only, retake |
| /sounds/kakuro.place.mp3 | `kakuro.place` | #431 | yes | 110 | 110 | -22.7 (-22.7) | -1.5 | retake |
| /sounds/kakuro.run.mp3 | `kakuro.run` | #431 | yes | 350 | 350 | -17.5 (-17.5) | -3.1 |  |
| /sounds/kakuro.select.mp3 | `kakuro.select` | #431 | yes | 60 | 90 | -22.8 (-22.7) | -8.9 | rings out, retake |
| /sounds/measure.empty.mp3 | `measure.empty` | #431 | yes | 300 | 300 | -17.7 (-17.5) | -2.3 | † replaces the placeholder |
| /sounds/measure.fail.mp3 | `measure.fail` | #431 | yes | 200 | 200 | -22.6 (-22.7) | -1.2 |  |
| /sounds/measure.fill.mp3 | `measure.fill` | #431 | yes | 400 | 486 | -17.5 (-17.5) | -2.3 | † replaces the placeholder, rings out |
| /sounds/measure.near.mp3 | `measure.near` | #431 | yes | 250 | 375 | -17.5 (-17.5) | -6.1 | rings out |
| /sounds/measure.pour.mp3 | `measure.pour` | #431 | yes | 350 | 350 | -19.0 (-17.5) | -2.4 | † replaces the placeholder |
| /sounds/measure.reject.mp3 | `measure.reject` | #431 | yes | 150 | 225 | -22.7 (-22.7) | -6.2 | rings out |
| /sounds/measure.reset.mp3 | `measure.reset` | #431 | yes | 250 | 250 | -20.8 (-17.5) | -2.4 | † replaces the placeholder, retake |
| /sounds/measure.select.mp3 | `measure.select` | #431 | yes | 150 | 150 | -24.4 (-22.7) | -2.2 |  |
| /sounds/measure.stageClear.mp3 | `measure.stageClear` | #431 | yes | 350 | 350 | -17.5 (-17.5) | -1.8 |  |
| /sounds/measure.target.mp3 | `measure.target` | #431 | yes | 200 | 200 | -22.7 (-22.7) | -13.9 |  |
| /sounds/numline.bullseye.mp3 | `numline.bullseye` | #431 | yes | 250 | 250 | -17.6 (-17.5) | -1.7 |  |
| /sounds/numline.dragTick.mp3 | `numline.dragTick` | #431 | yes | 30 | 30 | -27.4 (-22.7) | -2.1 |  |
| /sounds/numline.edge.mp3 | `numline.edge` | #431 | yes | 120 | 180 | -22.7 (-22.7) | -7.3 | rings out, retake |
| /sounds/numline.place.mp3 | `numline.place` | #431 | yes | 120 | 120 | -22.7 (-22.7) | -3.3 | † replaces the placeholder |
| /sounds/numline.stageClear.mp3 | `numline.stageClear` | #431 | yes | 350 | 487 | -17.5 (-17.5) | -3.9 | rings out |
| /sounds/numpyramid.crack.mp3 | `numpyramid.crack` | #431 | yes | 250 | 250 | -23.4 (-17.5) | -2.6 |  |
| /sounds/numpyramid.pick.mp3 | `numpyramid.pick` | #431 | yes | 120 | 120 | -22.8 (-22.7) | -1.5 |  |
| /sounds/numpyramid.place.mp3 | `numpyramid.place` | #431 | yes | 150 | 225 | -22.7 (-22.7) | -1.5 | † replaces the placeholder, rings out, retake |
| /sounds/numpyramid.row.mp3 | `numpyramid.row` | #431 | yes | 300 | 300 | -17.5 (-17.5) | -6.4 |  |
| /sounds/numpyramid.seam.mp3 | `numpyramid.seam` | #431 | yes | 200 | 300 | -17.5 (-17.5) | -1.8 | rings out |
| /sounds/numpyramid.skip.mp3 | `numpyramid.skip` | #431 | yes | 300 | 450 | -17.7 (-17.5) | -2.5 | rings out |
| /sounds/numpyramid.stageClear.mp3 | `numpyramid.stageClear` | #431 | yes | 400 | 400 | -17.5 (-17.5) | -1.6 |  |
| /sounds/numpyramid.swap.mp3 | `numpyramid.swap` | #431 | yes | 150 | 150 | -22.7 (-22.7) | -1.7 |  |
| /sounds/numpyramid.unplace.mp3 | `numpyramid.unplace` | #431 | yes | 150 | 150 | -22.7 (-22.7) | -5.7 |  |
| /sounds/target.combine.mp3 | `target.combine` | #431 | yes | 250 | 250 | -27.3 (-17.5) | -1.0 | retake |
| /sounds/target.lock.mp3 | `target.lock` | #431 | yes | 400 | 400 | -23.7 (-17.5) | -2.3 | retake |
| /sounds/target.operator.mp3 | `target.operator` | #431 | yes | 100 | | | | to record, retake |
| /sounds/target.reset.mp3 | `target.reset` | #431 | yes | 350 | 487 | -17.5 (-17.5) | -3.4 | rings out |
| /sounds/target.select.mp3 | `target.select` | #431 | yes | 120 | 120 | -22.7 (-22.7) | -2.4 |  |
| /sounds/target.solve.mp3 | `target.solve` | #431 | yes | 100 | 150 | -22.8 (-22.7) | -5.3 | rings out, retake |
| /sounds/target.undo.mp3 | `target.undo` | #431 | yes | 220 | 220 | -22.7 (-22.7) | -3.3 |  |
| /sounds/beat.holdCrackle.mp3 | `beat.holdCrackle` | #440 | yes | 200 | 300 | -17.5 (-17.5) | -4.7 | rings out, retake |
| /sounds/beat.missThud.mp3 | `beat.missThud` | #440 | yes | 120 | 120 | -22.8 (-22.7) | -2.3 |  |
| /sounds/blockfall.hardDrop.mp3 | `blockfall.hardDrop` | #440 | yes | 200 | 300 | -17.7 (-17.5) | -2.5 | rings out, retake |
| /sounds/blockfall.speedUp.mp3 | `blockfall.speedUp` | #440 | yes | 250 | 375 | -17.4 (-17.5) | -3.5 | † replaces the placeholder, rings out, retake |
| /sounds/blockfall.start.mp3 | `blockfall.start` | #440 | yes | 400 | 487 | -17.5 (-17.5) | -4.6 | rings out |
| /sounds/blockfall.sweep.mp3 | `blockfall.sweep` | #440 | yes | 300 | 450 | -17.5 (-17.5) | -7.5 | rings out, retake |
| /sounds/blockfall.turnRefused.mp3 | `blockfall.turnRefused` | #440 | yes | 80 | 80 | -23.4 (-22.7) | -2.2 |  |
| /sounds/breaker.ballLost.mp3 | `breaker.ballLost` | #440 | yes | 450 | 487 | -17.5 (-17.5) | -2.6 | † replaces the placeholder, rings out |
| /sounds/breaker.brickHit.mp3 | `breaker.brickHit` | #440 | yes | 70 | 70 | -22.9 (-22.7) | -2.2 | † replaces the placeholder |
| /sounds/breaker.capsuleIcon.mp3 | `breaker.capsuleIcon` | #440 | yes | 120 | 120 | -22.7 (-22.7) | -6.5 |  |
| /sounds/breaker.fireballLit.mp3 | `breaker.fireballLit` | #440 | yes | 400 | 487 | -17.5 (-17.5) | -3.1 | † replaces the placeholder, rings out |
| /sounds/breaker.goldTang.mp3 | `breaker.goldTang` | #440 | yes | 200 | 300 | -17.5 (-17.5) | -5.6 | rings out |
| /sounds/breaker.laser.mp3 | `breaker.laser` | #440 | yes | 100 | 150 | -22.7 (-22.7) | -7.7 | † replaces the placeholder, rings out, retake |
| /sounds/breaker.multiball.mp3 | `breaker.multiball` | #440 | yes | 300 | 252 | -17.6 (-17.5) | -4.5 | † replaces the placeholder |
| /sounds/breaker.paddle.mp3 | `breaker.paddle` | #440 | yes | 80 | 120 | -22.7 (-22.7) | -2.3 | † replaces the placeholder, rings out |
| /sounds/breaker.powerUp.mp3 | `breaker.powerUp` | #440 | yes | 400 | 487 | -17.5 (-17.5) | -2.4 | rings out |
| /sounds/breaker.start.mp3 | `breaker.start` | #440 | yes | 400 | 487 | -17.5 (-17.5) | -2.0 | rings out |
| /sounds/burst.fizzle.mp3 | `burst.fizzle` | #440 | yes | 120 | 180 | -22.7 (-22.7) | -5.2 | rings out, retake |
| /sounds/burst.freezeCaught.mp3 | `burst.freezeCaught` | #440 | yes | 500 | 487 | -17.4 (-17.5) | -5.1 | † replaces the placeholder |
| /sounds/burst.hit.mp3 | `burst.hit` | #440 | yes | 120 | 120 | -22.6 (-22.7) | -5.8 | † replaces the placeholder |
| /sounds/burst.lifeIconBreak.mp3 | `burst.lifeIconBreak` | #440 | yes | 200 | 200 | -22.6 (-22.7) | -4.7 |  |
| /sounds/burst.lifeLost.mp3 | `burst.lifeLost` | #440 | yes | 350 | 345 | -17.6 (-17.5) | -2.0 |  |
| /sounds/burst.overheadHum.mp3 | `burst.overheadHum` | #440 | yes | 300 | 450 | -17.5 (-17.5) | -9.1 | rings out, retake |
| /sounds/burst.powerUp.mp3 | `burst.powerUp` | #440 | yes | 400 | 487 | -17.5 (-17.5) | -1.9 | rings out |
| /sounds/burst.shot.mp3 | `burst.shot` | #440 | yes | 120 | 180 | -22.7 (-22.7) | -4.9 | † replaces the placeholder, rings out, retake |
| /sounds/burst.start.mp3 | `burst.start` | #440 | yes | 400 | 487 | -17.5 (-17.5) | -1.9 | rings out |
| /sounds/cross.jetPuff.mp3 | `cross.jetPuff` | #440 | yes | 80 | 120 | -22.7 (-22.7) | -6.6 | rings out, retake |
| /sounds/cross.land.mp3 | `cross.land` | #440 | yes | 50 | 75 | -22.8 (-22.7) | -8.4 | rings out, retake |
| /sounds/hover.crash.mp3 | `hover.crash` | #440 | yes | 400 | 400 | -17.6 (-17.5) | -2.1 |  |
| /sounds/hover.deadCentre.mp3 | `hover.deadCentre` | #440 | yes | 250 | 250 | -17.5 (-17.5) | -4.5 |  |
| /sounds/hover.gate.mp3 | `hover.gate` | #440 | yes | 150 | 225 | -22.7 (-22.7) | -9.5 | † replaces the placeholder, rings out |
| /sounds/hover.scrape.mp3 | `hover.scrape` | #440 | yes | 150 | 225 | -22.7 (-22.7) | -8.0 | rings out, retake |
| /sounds/hover.shieldShatter.mp3 | `hover.shieldShatter` | #440 | yes | 450 | 450 | -21.8 (-17.5) | -1.1 |  |
| /sounds/hover.star.mp3 | `hover.star` | #440 | yes | 180 | 180 | -22.8 (-22.7) | -5.5 | † replaces the placeholder |
| /sounds/hover.start.mp3 | `hover.start` | #440 | yes | 400 | 487 | -17.5 (-17.5) | -2.3 | rings out |
| /sounds/hover.thrust.mp3 | `hover.thrust` | #440 | yes | 60 | 90 | -22.6 (-22.7) | -9.2 | rings out, retake |
| /sounds/pinball.ballLocked.mp3 | `pinball.ballLocked` | #440 | yes | 500 | 487 | -19.1 (-17.5) | -2.1 |  |
| /sounds/pinball.outlaneSave.mp3 | `pinball.outlaneSave` | #440 | yes | 150 | 150 | -22.6 (-22.7) | -6.1 |  |
| /sounds/pinball.rampChase.mp3 | `pinball.rampChase` | #440 | to add | 500 | 487 | -17.4 (-17.5) | -5.9 |  |
| /sounds/rally.dead.mp3 | `rally.dead` | #440 | yes | 500 | 487 | -17.5 (-17.5) | -2.7 |  |
| /sounds/rally.edgeSave.mp3 | `rally.edgeSave` | #440 | yes | 100 | 150 | -22.8 (-22.7) | -5.3 | rings out, retake |
| /sounds/rally.fwip.mp3 | `rally.fwip` | #440 | yes | 150 | 225 | -22.7 (-22.7) | -6.3 | rings out, retake |
| /sounds/rally.goldHit.mp3 | `rally.goldHit` | #440 | yes | 120 | 120 | -22.7 (-22.7) | -7.4 | † replaces the placeholder |
| /sounds/rally.hit.mp3 | `rally.hit` | #440 | yes | 60 | 60 | -22.6 (-22.7) | -1.0 | † replaces the placeholder |
| /sounds/rally.lifeLost.mp3 | `rally.lifeLost` | #440 | yes | 400 | 487 | -17.5 (-17.5) | -2.8 | rings out |
| /sounds/rally.serve.mp3 | `rally.serve` | #440 | yes | 160 | 240 | -22.7 (-22.7) | -9.3 | rings out, retake |
| /sounds/rally.spinShot.mp3 | `rally.spinShot` | #440 | yes | 350 | 484 | -17.5 (-17.5) | -6.5 | rings out |
| /sounds/rally.start.mp3 | `rally.start` | #440 | yes | 300 | 450 | -17.6 (-17.5) | -2.7 | rings out, retake |
| /sounds/snake.dead.mp3 | `snake.dead` | #440 | yes | 500 | 487 | -17.5 (-17.5) | -2.2 |  |
| /sounds/snake.eat.mp3 | `snake.eat` | #440 | yes | 120 | 120 | -22.7 (-22.7) | -2.2 | † replaces the placeholder |
| /sounds/snake.goldStar.mp3 | `snake.goldStar` | #440 | yes | 300 | 300 | -17.6 (-17.5) | -2.2 |  |
| /sounds/snake.laneWhoosh.mp3 | `snake.laneWhoosh` | #440 | yes | 400 | 487 | -17.5 (-17.5) | -2.5 | rings out |
| /sounds/snake.rockGraze.mp3 | `snake.rockGraze` | #440 | yes | 180 | 180 | -22.8 (-22.7) | -8.7 |  |
| /sounds/snake.rockLand.mp3 | `snake.rockLand` | #440 | yes | 300 | 300 | -17.7 (-17.5) | -2.6 | † replaces the placeholder |
| /sounds/snake.rockWarn.mp3 | `snake.rockWarn` | #440 | yes | 200 | 300 | -17.5 (-17.5) | -3.6 | † replaces the placeholder, rings out, retake |
| /sounds/snake.saved.mp3 | `snake.saved` | #440 | yes | 400 | 400 | -17.5 (-17.5) | -2.2 |  |
| /sounds/snake.start.mp3 | `snake.start` | #440 | yes | 400 | 400 | -17.5 (-17.5) | -2.3 |  |
| /sounds/snake.turn.mp3 | `snake.turn` | #440 | yes | 40 | 60 | -22.6 (-22.7) | -6.5 | rings out, retake |
| /sounds/snake.warp.mp3 | `snake.warp` | #440 | yes | 300 | 450 | -17.5 (-17.5) | -3.9 | rings out, retake |
| /sounds/snake.wrap.mp3 | `snake.wrap` | #440 | yes | 120 | 180 | -22.6 (-22.7) | -9.3 | rings out, retake |
| /sounds/wavefront.boltZip.mp3 | `wavefront.boltZip` | #440 | yes | 100 | 150 | -22.8 (-22.7) | -12.6 | rings out, retake |
| /sounds/wavefront.bossHit.mp3 | `wavefront.bossHit` | #440 | yes | 200 | 300 | -17.6 (-17.5) | -2.3 | † replaces the placeholder, rings out |
| /sounds/wavefront.chargeRelease.mp3 | `wavefront.chargeRelease` | #440 | to add | 400 | 400 | -17.6 (-17.5) | -1.2 |  |
| /sounds/wavefront.dive.mp3 | `wavefront.dive` | #440 | yes | 450 | 487 | -17.5 (-17.5) | -2.0 | † replaces the placeholder, rings out |
| /sounds/wavefront.lifeLost.mp3 | `wavefront.lifeLost` | #440 | yes | 500 | 487 | -17.5 (-17.5) | -2.3 |  |
| /sounds/wavefront.pierce.mp3 | `wavefront.pierce` | #440 | yes | 120 | 120 | -22.6 (-22.7) | -1.8 | † replaces the placeholder |
| /sounds/wavefront.plateOff.mp3 | `wavefront.plateOff` | #440 | yes | 200 | 200 | -22.8 (-22.7) | -1.7 |  |
| /sounds/wavefront.powerChirp.mp3 | `wavefront.powerChirp` | #440 | yes | 300 | 450 | -17.5 (-17.5) | -5.1 | rings out |
| /sounds/wavefront.shapePop.mp3 | `wavefront.shapePop` | #440 | yes | 120 | 180 | -22.7 (-22.7) | -5.8 | † replaces the placeholder, rings out, retake |
| /sounds/curling.clack.mp3 | `curling.clack` | #445 | yes | 300 | 300 | -18.6 (-17.5) | -1.6 |  |
| /sounds/curling.countTick.mp3 | `curling.countTick` | #445 | yes | 100 | 150 | -22.7 (-22.7) | -8.1 | rings out |
| /sounds/curling.powerNotch.mp3 | `curling.powerNotch` | #445 | yes | 80 | 80 | -27.7 (-22.7) | -1.9 |  |
| /sounds/curling.powerNotchHouse.mp3 | `curling.powerNotchHouse` | #445 | yes | 150 | 150 | -27.6 (-22.7) | -1.5 |  |
| /sounds/pool.cueCrack.mp3 | `pool.cueCrack` | #445 | yes | 300 | 300 | -28.0 (-17.5) | -2.6 | retake |
| /sounds/pool.streakUp.mp3 | `pool.streakUp` | #445 | yes | 400 | 400 | -17.6 (-17.5) | -2.3 |  |
| /sounds/racing.sector.mp3 | `racing.sector` | #445 | yes | 300 | 450 | -17.4 (-17.5) | -9.4 | † replaces the placeholder, rings out, retake |
| /sounds/balltrack.booster.mp3 | `balltrack.booster` | #442 | yes | 200 | 200 | -22.7 (-22.7) | -2.1 |  |
| /sounds/balltrack.combo.mp3 | `balltrack.combo` | #442 | yes | 200 | 200 | -22.7 (-22.7) | -3.7 |  |
| /sounds/balltrack.cupPulse.mp3 | `balltrack.cupPulse` | #442 | yes | 400 | 400 | -17.6 (-17.5) | -2.3 | retake |
| /sounds/balltrack.marbleHome.mp3 | `balltrack.marbleHome` | #442 | yes | 300 | 300 | -20.2 (-17.5) | -2.0 | † replaces the placeholder |
| /sounds/balltrack.switch.mp3 | `balltrack.switch` | #442 | yes | 120 | 180 | -22.7 (-22.7) | -7.3 | † replaces the placeholder, rings out, retake |
| /sounds/balltrack.wrong.mp3 | `balltrack.wrong` | #442 | yes | 300 | 300 | -21.9 (-17.5) | -2.0 | † replaces the placeholder, limited past transparent (-8.8 dB) for the placeholder's 4.5 dB |
| /sounds/bubble.fallSplash.mp3 | `bubble.fallSplash` | #442 | to add | 400 | 400 | -24.1 (-17.5) | -2.4 | retake |
| /sounds/bubble.fastShot.mp3 | `bubble.fastShot` | #442 | to add | 300 | 300 | -17.7 (-17.5) | -1.0 |  |
| /sounds/bubble.load.mp3 | `bubble.load` | #442 | yes | 200 | 300 | -18.2 (-17.5) | -2.6 | † replaces the placeholder, rings out |
| /sounds/bubble.pop.mp3 | `bubble.pop` | #442 | yes | 120 | 103 | -22.6 (-22.7) | -5.4 | † replaces the placeholder |
| /sounds/bubble.thup.mp3 | `bubble.thup` | #442 | to add | 150 | 150 | -22.7 (-22.7) | -3.9 |  |
| /sounds/bubble.wallBlip.mp3 | `bubble.wallBlip` | #442 | to add | 80 | 80 | -22.7 (-22.7) | -4.4 |  |
| /sounds/bubble.warning.mp3 | `bubble.warning` | #442 | yes | 500 | 480 | -17.6 (-17.5) | -2.5 |  |
| /sounds/inkbridge.birdFlap.mp3 | `inkbridge.birdFlap` | #442 | yes | 400 | 400 | -27.4 (-17.5) | -2.6 | retake |
| /sounds/inkbridge.birdScatter.mp3 | `inkbridge.birdScatter` | #442 | to add | 500 | 486 | -22.5 (-17.5) | -1.8 |  |
| /sounds/inkbridge.bump.mp3 | `inkbridge.bump` | #442 | yes | 200 | 200 | -24.3 (-22.7) | -1.8 | † replaces the placeholder |
| /sounds/inkbridge.coinWobble.mp3 | `inkbridge.coinWobble` | #442 | yes | 300 | 300 | -20.4 (-17.5) | -1.8 |  |
| /sounds/inkbridge.parFlourish.mp3 | `inkbridge.parFlourish` | #442 | to add | 500 | 487 | -17.5 (-17.5) | -1.8 |  |
| /sounds/matchup.chestGlint.mp3 | `matchup.chestGlint` | #442 | to add | 400 | 400 | -17.5 (-17.5) | -2.1 |  |
| /sounds/matchup.goalSpark.mp3 | `matchup.goalSpark` | #442 | yes | 200 | 200 | -22.7 (-22.7) | -7.5 |  |
| /sounds/matchup.goalTick.mp3 | `matchup.goalTick` | #442 | to add | 250 | 375 | -17.5 (-17.5) | -2.4 | rings out |
| /sounds/matchup.iceCrack.mp3 | `matchup.iceCrack` | #442 | yes | 300 | 300 | -23.0 (-17.5) | -1.3 |  |
| /sounds/matchup.shatter.mp3 | `matchup.shatter` | #442 | to add | 300 | 300 | -21.8 (-17.5) | -1.9 |  |
| /sounds/tilt.caught.mp3 | `tilt.caught` | #442 | yes | 300 | 300 | -18.9 (-17.5) | -2.4 | † replaces the placeholder |
| /sounds/tilt.cup.mp3 | `tilt.cup` | #442 | yes | 400 | 193 | -22.7 (-22.7) | -2.2 | † replaces the placeholder |
| /sounds/tilt.gate.mp3 | `tilt.gate` | #442 | yes | 300 | 224 | -25.7 (-22.7) | -2.7 | † replaces the placeholder |
| /sounds/tilt.knock.mp3 | `tilt.knock` | #442 | yes | 100 | 100 | -22.9 (-22.7) | -1.7 | † replaces the placeholder |
| /sounds/tilt.pitWobble.mp3 | `tilt.pitWobble` | #442 | yes | 400 | 400 | -21.0 (-17.5) | -1.3 |  |
| /sounds/tilt.rimTick.mp3 | `tilt.rimTick` | #442 | yes | 50 | 50 | -22.4 (-22.7) | -1.6 |  |
| /sounds/codeword.jump.mp3 | `codeword.jump` | #437 | yes | 50 | 75 | -22.7 (-22.7) | -4.2 | rings out, retake |
| /sounds/codeword.ripple.mp3 | `codeword.ripple` | #437 | yes | 500 | 433 | -25.9 (-17.5) | -1.0 | retake |
| /sounds/codeword.word.mp3 | `codeword.word` | #437 | yes | 300 | 300 | -17.5 (-17.5) | -4.0 |  |
| /sounds/codeword.wrong.mp3 | `codeword.wrong` | #437 | yes | 350 | 350 | -21.9 (-17.5) | -2.4 |  |
| /sounds/letterwheel.jar.mp3 | `letterwheel.jar` | #437 | yes | 450 | 450 | -17.6 (-17.5) | -1.2 |  |
| /sounds/letterwheel.miss.mp3 | `letterwheel.miss` | #437 | yes | 200 | 200 | -22.7 (-22.7) | -3.6 |  |
| /sounds/letterwheel.repeat.mp3 | `letterwheel.repeat` | #437 | yes | 150 | 150 | -22.7 (-22.7) | -5.3 |  |
| /sounds/letterwheel.trace.base.mp3 | `letterwheel.trace.base` | #437 | base, no slot | 160 | 160 | -22.9 (-22.7) | -2.8 |  |
| /sounds/shared.wordDrop.mp3 | `shared.wordDrop` | #437 | yes | 70 | 70 | -26.5 (-22.7) | -2.2 |  |
| /sounds/shared.wordLongest.mp3 | `shared.wordLongest` | #437 | yes | 350 | 350 | -17.4 (-17.5) | -3.6 |  |
| /sounds/strikeout.flip.mp3 | `strikeout.flip` | #437 | yes | 110 | 110 | -22.7 (-22.7) | -3.5 |  |
| /sounds/strikeout.solve.mp3 | `strikeout.solve` | #437 | yes | 400 | 400 | -17.6 (-17.5) | -1.9 |  |
| /sounds/strikeout.strike.mp3 | `strikeout.strike` | #437 | yes | 250 | 375 | -17.5 (-17.5) | -1.6 | rings out, retake |
| /sounds/swapword.combo.mp3 | `swapword.combo` | #437 | yes | 400 | 400 | -17.5 (-17.5) | -1.8 |  |
| /sounds/swapword.gold.mp3 | `swapword.gold` | #437 | yes | 250 | 375 | -17.5 (-17.5) | -4.9 | rings out, retake |
| /sounds/swapword.locked.mp3 | `swapword.locked` | #437 | yes | 120 | 120 | -22.7 (-22.7) | -4.2 |  |
| /sounds/swapword.low.mp3 | `swapword.low` | #437 | yes | 350 | 350 | -21.4 (-17.5) | -1.8 |  |
| /sounds/swapword.out.mp3 | `swapword.out` | #437 | yes | 450 | 450 | -22.3 (-17.5) | -2.7 |  |
| /sounds/swapword.swap.mp3 | `swapword.swap` | #437 | yes | 260 | 260 | -18.7 (-17.5) | -2.4 |  |
| /sounds/tilegrid.back.mp3 | `tilegrid.back` | #437 | yes | 180 | 270 | -20.8 (-17.5) | -2.4 | rings out |
| /sounds/tilegrid.notword.mp3 | `tilegrid.notword` | #437 | yes | 150 | 150 | -22.7 (-22.7) | -5.7 |  |
| /sounds/tilegrid.pick.mp3 | `tilegrid.pick` | #437 | yes | 70 | 70 | -22.8 (-22.7) | -2.2 |  |
| /sounds/tilegrid.place.mp3 | `tilegrid.place` | #437 | yes | 120 | 120 | -22.9 (-22.7) | -2.6 |  |
| /sounds/tilegrid.word.base.mp3 | `tilegrid.word.base` | #437 | base, no slot | 500 | 480 | -17.5 (-17.5) | -3.0 |  |
| /sounds/word.key.mp3 | `word.key` | #437 | to add | 70 | 70 | -27.9 (-22.7) | -1.4 |  |
| /sounds/wordhunt.golden.mp3 | `wordhunt.golden` | #437 | yes | 350 | 350 | -19.6 (-17.5) | -1.8 |  |
| /sounds/wordhunt.points.mp3 | `wordhunt.points` | #437 | yes | 100 | 100 | -22.7 (-22.7) | -5.9 |  |
| /sounds/wordhunt.trace.base.mp3 | `wordhunt.trace.base` | #437 | base, no slot | 180 | 270 | -17.5 (-17.5) | -7.1 | rings out |
| /sounds/wordhunt.word.mp3 | `wordhunt.word` | #437 | yes | 400 | | | | to record, retake |
| /sounds/wordsearch.already.mp3 | `wordsearch.already` | #437 | yes | 180 | 180 | -26.3 (-22.7) | -1.6 | retake |
| /sounds/wordsearch.drag.mp3 | `wordsearch.drag` | #437 | yes | 120 | 120 | -22.5 (-22.7) | -2.5 |  |
| /sounds/wordsearch.found.base.mp3 | `wordsearch.found.base` | #437 | base, no slot | 450 | 450 | -25.8 (-17.5) | -1.2 | retake |
| /sounds/wordslide.lock.mp3 | `wordslide.lock` | #437 | yes | 140 | 140 | -24.9 (-22.7) | -1.6 |  |
| /sounds/wordslide.nudge.mp3 | `wordslide.nudge` | #437 | yes | 160 | 160 | -22.9 (-22.7) | -2.3 |  |
| /sounds/wordslide.resetArm.mp3 | `wordslide.resetArm` | #437 | yes | 200 | 200 | -22.9 (-22.7) | -2.1 | retake |
| /sounds/wordslide.slide.mp3 | `wordslide.slide` | #437 | yes | 220 | 330 | -19.6 (-17.5) | -2.4 | rings out |
| /sounds/wordslide.swap.mp3 | `wordslide.swap` | #437 | yes | 180 | 180 | -22.9 (-22.7) | -2.6 |  |
| /sounds/wordslide.unlock.mp3 | `wordslide.unlock` | #437 | yes | 120 | 120 | -26.0 (-22.7) | -2.5 |  |
| /sounds/wordslide.word.mp3 | `wordslide.word` | #437 | yes | 400 | 400 | -17.5 (-17.5) | -4.7 |  |
| /sounds/wordsmith.combo.mp3 | `wordsmith.combo` | #437 | yes | 500 | 487 | -17.5 (-17.5) | -1.9 |  |
| /sounds/wordsmith.invalid.mp3 | `wordsmith.invalid` | #437 | yes | 220 | 220 | -22.8 (-22.7) | -2.8 |  |
| /sounds/wordsmith.letter.mp3 | `wordsmith.letter` | #437 | yes | 60 | 60 | -25.6 (-22.7) | -2.4 |  |
| /sounds/wordsmith.shuffle.mp3 | `wordsmith.shuffle` | #437 | yes | 450 | 450 | -20.6 (-17.5) | -2.1 |  |
| /sounds/wordsmith.word.base.mp3 | `wordsmith.word.base` | #437 | base, no slot | 350 | 350 | -17.5 (-17.5) | -7.8 |  |
| /sounds/cards.deadEnd.mp3 | `cards.deadEnd` | #441 | yes | 600 | 600 | -17.1 (-17.1) | -7.7 |  |
| /sounds/fivehands.bigStamp.mp3 | `fivehands.bigStamp` | #441 | yes | 600 | 600 | -17.1 (-17.1) | -1.5 |  |
| /sounds/freecell.reset.mp3 | `freecell.reset` | #441 | yes | 600 | 600 | -21.2 (-17.1) | -2.1 |  |
| /sounds/mahjong.nearEnd.mp3 | `mahjong.nearEnd` | #441 | yes | 600 | 600 | -17.1 (-17.1) | -3.9 |  |
| /sounds/mahjong.reset.mp3 | `mahjong.reset` | #441 | yes | 600 | 530 | -23.3 (-17.1) | -2.5 | retake |
| /sounds/pyramid.reset.mp3 | `pyramid.reset` | #441 | yes | 600 | 600 | -27.0 (-17.1) | -2.4 | retake |
| /sounds/tripeaks.peakFly.mp3 | `tripeaks.peakFly` | #441 | yes | 600 | 600 | -17.1 (-17.1) | -4.1 |  |
| /sounds/minigolf.confetti.mp3 | `minigolf.confetti` | #443 | to add | 600 | 210 | -22.7 (-22.7) | -2.3 |  |
| /sounds/minigolf.loop.mp3 | `minigolf.loop` | #443 | yes | 600 | 419 | -21.2 (-16.8) | -2.5 | loop |
| /sounds/kakuro.combo.mp3 | `kakuro.combo` | #431 | yes | 600 | 505 | -17.1 (-17.1) | -2.6 |  |
| /sounds/beat.start.mp3 | `beat.start` | #440 | yes | 600 | 429 | -19.8 (-17.5) | -2.1 |  |
| /sounds/pinball.multiballEnd.mp3 | `pinball.multiballEnd` | #440 | yes | 600 | 600 | -17.1 (-17.1) | -3.4 |  |
| /sounds/wavefront.bigExplode.mp3 | `wavefront.bigExplode` | #440 | yes | 600 | 600 | -17.1 (-17.1) | -2.6 | † replaces the placeholder |
| /sounds/pool.jawRattle.mp3 | `pool.jawRattle` | #445 | yes | 600 | 600 | -21.3 (-17.1) | -2.6 |  |
| /sounds/bubble.reefRumble.mp3 | `bubble.reefRumble` | #442 | yes | 600 | 600 | -18.8 (-17.1) | -2.6 |  |
| /sounds/tilt.mazeDone.mp3 | `tilt.mazeDone` | #442 | yes | 600 | 600 | -21.5 (-17.1) | -2.6 | † replaces the placeholder, limited past transparent (-2.5 dB) for the placeholder's 4.5 dB |
| /sounds/tilegrid.combo.mp3 | `tilegrid.combo` | #437 | yes | 600 | 600 | -17.1 (-17.1) | -3.2 |  |
| /sounds/pyramid.kingFlourish.mp3 | `pyramid.kingFlourish` | #441 | yes | 700 | 680 | -17.0 (-17.1) | -1.0 |  |
| /sounds/burst.clearTick.mp3 | `burst.clearTick` | #440 | to add | 700 | 687 | -17.2 (-17.1) | -2.4 |  |
| /sounds/hover.flyOff.mp3 | `hover.flyOff` | #440 | yes | 700 | 687 | -17.1 (-17.1) | -2.5 |  |
| /sounds/pool.blackUnlock.mp3 | `pool.blackUnlock` | #445 | yes | 700 | 410 | -29.4 (-17.5) | -2.7 | retake |
| /sounds/bubble.chestOpen.mp3 | `bubble.chestOpen` | #442 | to add | 700 | 564 | -21.1 (-17.1) | -1.9 |  |
| /sounds/matchup.chestHome.mp3 | `matchup.chestHome` | #442 | to add | 700 | 687 | -22.3 (-17.1) | -2.6 |  |
| /sounds/letterwheel.fly.mp3 | `letterwheel.fly` | #437 | yes | 700 | 680 | -18.6 (-17.1) | -2.2 |  |
| /sounds/strikeout.combo.mp3 | `strikeout.combo` | #437 | yes | 700 | 680 | -17.1 (-17.1) | -5.5 |  |
| /sounds/strikeout.lastStrike.mp3 | `strikeout.lastStrike` | #437 | yes | 700 | 687 | -18.8 (-17.1) | -2.6 |  |
| /sounds/wordhunt.long.mp3 | `wordhunt.long` | #437 | yes | 700 | 685 | -17.1 (-17.1) | -3.0 |  |
| /sounds/blockfall.heartbeat.mp3 | `blockfall.heartbeat` | #440 | yes | 800 | 301 | -34.7 (-16.8) | -1.5 | loop, retake |
| /sounds/pool.rackRoll.mp3 | `pool.rackRoll` | #445 | yes | 800 | 800 | -24.3 (-17.1) | -2.3 | retake |
| /sounds/racing.scrape.mp3 | `racing.scrape` | #445 | yes | 800 | 800 | -17.1 (-17.1) | -2.6 |  |
| /sounds/inkbridge.missWhistle.mp3 | `inkbridge.missWhistle` | #442 | yes | 800 | 799 | -17.1 (-17.1) | -8.8 |  |
| /sounds/tilt.discSwap.mp3 | `tilt.discSwap` | #442 | yes | 800 | 793 | -17.3 (-17.1) | -2.5 |  |
| /sounds/wordsearch.bonus.mp3 | `wordsearch.bonus` | #437 | yes | 800 | 800 | -17.3 (-17.1) | -1.3 |  |
| /sounds/freecell.bounce.mp3 | `freecell.bounce` | #441 | yes | 900 | 887 | -26.6 (-17.1) | -2.6 | retake |
| /sounds/mahjong.spin.mp3 | `mahjong.spin` | #441 | yes | 900 | 880 | -24.7 (-17.1) | -2.5 | retake |
| /sounds/checkout.bigFinish.mp3 | `checkout.bigFinish` | #431 | yes | 900 | 887 | -17.1 (-17.1) | -2.7 |  |
| /sounds/burst.gameOver.mp3 | `burst.gameOver` | #440 | yes | 900 | 886 | -17.2 (-17.1) | -2.1 | † replaces the placeholder |
| /sounds/snake.showerAlarm.mp3 | `snake.showerAlarm` | #440 | yes | 900 | 886 | -17.1 (-17.1) | -2.2 | † replaces the placeholder |
| /sounds/curling.aw.mp3 | `curling.aw` | #445 | yes | 900 | 887 | -17.1 (-17.1) | -3.0 |  |
| /sounds/inkbridge.draw.mp3 | `inkbridge.draw` | #442 | yes | 900 | 880 | -17.1 (-17.1) | -3.3 | † replaces the placeholder |
| /sounds/tilegrid.bonus.mp3 | `tilegrid.bonus` | #437 | yes | 900 | 732 | -17.8 (-17.1) | -1.0 |  |
| /sounds/beat.feverRiser.mp3 | `beat.feverRiser` | #440 | yes | 1000 | 1000 | -16.5 (-16.5) | -3.5 |  |
| /sounds/blockfall.linesCount.mp3 | `blockfall.linesCount` | #440 | to add | 1000 | 1000 | -16.5 (-16.5) | -3.4 |  |
| /sounds/cross.tally.mp3 | `cross.tally` | #440 | to add | 1000 | 1000 | -16.5 (-16.5) | -1.5 |  |
| /sounds/racing.grass.mp3 | `racing.grass` | #445 | yes | 1000 | 1000 | -16.5 (-16.5) | -2.4 | † replaces the placeholder |
| /sounds/racing.kerb.mp3 | `racing.kerb` | #445 | yes | 1000 | 607 | -16.8 (-16.8) | -2.8 | loop |
| /sounds/inkbridge.pot.mp3 | `inkbridge.pot` | #442 | yes | 1000 | 763 | -19.4 (-17.1) | -1.2 | † replaces the placeholder |
| /sounds/mahjong.shower.mp3 | `mahjong.shower` | #441 | yes | 1200 | 1200 | -16.5 (-16.5) | -2.3 |  |
| /sounds/pyramid.outline.mp3 | `pyramid.outline` | #441 | yes | 1200 | 1200 | -16.5 (-16.5) | -4.0 |  |
| /sounds/tripeaks.stuck.mp3 | `tripeaks.stuck` | #441 | yes | 1200 | 1200 | -16.5 (-16.5) | -7.4 |  |
| /sounds/beat.fullCombo.mp3 | `beat.fullCombo` | #440 | yes | 1200 | 1200 | -16.6 (-16.5) | -1.9 |  |
| /sounds/breaker.timeToPoints.mp3 | `breaker.timeToPoints` | #440 | yes | 1200 | 1200 | -16.5 (-16.5) | -2.5 |  |
| /sounds/breaker.wallCleared.mp3 | `breaker.wallCleared` | #440 | yes | 1500 | 1360 | -16.5 (-16.5) | -2.5 |  |
| /sounds/pinball.counterRoll.mp3 | `pinball.counterRoll` | #440 | yes | 1500 | 1600 | -16.5 (-16.5) | -3.4 | rings out |
| /sounds/pinball.multiballStart.mp3 | `pinball.multiballStart` | #440 | yes | 1200 | 1200 | -16.5 (-16.5) | -5.0 |  |
| /sounds/wavefront.charge.mp3 | `wavefront.charge` | #440 | to add | 1200 | 1073 | -16.8 (-16.8) | -5.2 | loop |
| /sounds/curling.ooh.mp3 | `curling.ooh` | #445 | yes | 1200 | 1200 | -16.5 (-16.5) | -2.0 |  |
| /sounds/racing.speedRush.mp3 | `racing.speedRush` | #445 | yes | 1500 | 1319 | -16.8 (-16.8) | -2.4 | loop |
| /sounds/letterwheel.spin.mp3 | `letterwheel.spin` | #437 | yes | 1300 | 1300 | -17.4 (-16.5) | -1.8 |  |
| /sounds/swapword.scale.mp3 | `swapword.scale` | #437 | yes | 1300 | 1300 | -16.5 (-16.5) | -4.4 |  |
| /sounds/wordsearch.redraw.mp3 | `wordsearch.redraw` | #437 | yes | 1200 | 1600 | -16.5 (-16.5) | -1.7 | rings out |
| /sounds/wavefront.bossStages.mp3 | `wavefront.bossStages` | #440 | yes | 2000 | 1999 | -16.5 (-16.5) | -2.5 |  |
| /sounds/wordsmith.pangram.mp3 | `wordsmith.pangram` | #437 | yes | 1600 | 1600 | -16.5 (-16.5) | -3.3 |  |
| /sounds/racing.chequer.mp3 | `racing.chequer` | #445 | yes | 2500 | 2480 | -16.5 (-16.5) | -3.0 |  |
| /sounds/balltrack.roll.mp3 | `balltrack.roll` | #442 | yes | 3000 | 1694 | -16.8 (-16.8) | -2.5 | † replaces the placeholder, loop, shortened for the placeholder's size aim |
| /sounds/tilt.roll.mp3 | `tilt.roll` | #442 | yes | 3000 | 1938 | -16.8 (-16.8) | -2.6 | † replaces the placeholder, loop, shortened for the placeholder's size aim |
| /sounds/bubble.waves.mp3 | `bubble.waves` | #442 | yes | 6000 | 2249 | -16.9 (-16.8) | -1.2 | † replaces the placeholder, loop, shortened for the placeholder's size aim |
| /sounds/music_snake.mp3 | `music_snake` | #440 | to add | 60000 | 59984 | -18.5 (-18.45) | -5.9 | music bed, loops whole |
| /sounds/letterwheel.trace1.mp3 | `letterwheel.trace1` | #437 | yes | 160 | 160 | -22.8 (-22.7) | -2.6 | from `letterwheel.trace.base.mp3`, 0 semitones |
| /sounds/letterwheel.trace2.mp3 | `letterwheel.trace2` | #437 | yes | 143 | 143 | -22.9 (-22.7) | -2.6 | from `letterwheel.trace.base.mp3`, 2 semitones |
| /sounds/letterwheel.trace3.mp3 | `letterwheel.trace3` | #437 | yes | 127 | 127 | -22.5 (-22.7) | -1.7 | from `letterwheel.trace.base.mp3`, 4 semitones |
| /sounds/letterwheel.trace4.mp3 | `letterwheel.trace4` | #437 | yes | 107 | 107 | -22.5 (-22.7) | -1.8 | from `letterwheel.trace.base.mp3`, 7 semitones |
| /sounds/letterwheel.trace5.mp3 | `letterwheel.trace5` | #437 | yes | 95 | 95 | -22.4 (-22.7) | -1.2 | from `letterwheel.trace.base.mp3`, 9 semitones |
| /sounds/letterwheel.trace6.mp3 | `letterwheel.trace6` | #437 | yes | 80 | 80 | -22.8 (-22.7) | -1.0 | from `letterwheel.trace.base.mp3`, 12 semitones |
| /sounds/letterwheel.trace7.mp3 | `letterwheel.trace7` | #437 | yes | 71 | 71 | -23.1 (-22.7) | -2.7 | from `letterwheel.trace.base.mp3`, 14 semitones |
| /sounds/letterwheel.trace8.mp3 | `letterwheel.trace8` | #437 | yes | 63 | 63 | -23.3 (-22.7) | -2.7 | from `letterwheel.trace.base.mp3`, 16 semitones |
| /sounds/tilegrid.word3.mp3 | `tilegrid.word3` | #437 | yes | 480 | 480 | -17.5 (-17.5) | -1.8 | from `tilegrid.word.base.mp3`, 0+4+7 semitones |
| /sounds/tilegrid.word4.mp3 | `tilegrid.word4` | #437 | yes | 381 | 381 | -17.5 (-17.5) | -2.2 | from `tilegrid.word.base.mp3`, 4+7+12 semitones |
| /sounds/tilegrid.word5.mp3 | `tilegrid.word5` | #437 | yes | 480 | 480 | -17.5 (-17.5) | -1.1 | from `tilegrid.word.base.mp3`, 0+4+7+12 semitones |
| /sounds/tilegrid.word6.mp3 | `tilegrid.word6` | #437 | yes | 381 | 381 | -17.5 (-17.5) | -1.2 | from `tilegrid.word.base.mp3`, 4+7+12+16 semitones |
| /sounds/tilegrid.word7.mp3 | `tilegrid.word7` | #437 | yes | 480 | 480 | -17.6 (-17.5) | -2.5 | from `tilegrid.word.base.mp3`, 0+4+7+12+16 semitones |
| /sounds/wordhunt.trace1.mp3 | `wordhunt.trace1` | #437 | yes | 270 | 270 | -17.5 (-17.5) | -7.2 | from `wordhunt.trace.base.mp3`, 0 semitones |
| /sounds/wordhunt.trace2.mp3 | `wordhunt.trace2` | #437 | yes | 241 | 241 | -22.7 (-22.7) | -12.1 | from `wordhunt.trace.base.mp3`, 2 semitones |
| /sounds/wordhunt.trace3.mp3 | `wordhunt.trace3` | #437 | yes | 214 | 214 | -22.6 (-22.7) | -11.9 | from `wordhunt.trace.base.mp3`, 4 semitones |
| /sounds/wordhunt.trace4.mp3 | `wordhunt.trace4` | #437 | yes | 202 | 202 | -22.7 (-22.7) | -11.9 | from `wordhunt.trace.base.mp3`, 5 semitones |
| /sounds/wordhunt.trace5.mp3 | `wordhunt.trace5` | #437 | yes | 180 | 180 | -22.7 (-22.7) | -11.8 | from `wordhunt.trace.base.mp3`, 7 semitones |
| /sounds/wordhunt.trace6.mp3 | `wordhunt.trace6` | #437 | yes | 161 | 161 | -22.7 (-22.7) | -11.7 | from `wordhunt.trace.base.mp3`, 9 semitones |
| /sounds/wordhunt.trace7.mp3 | `wordhunt.trace7` | #437 | yes | 143 | 143 | -22.7 (-22.7) | -12.6 | from `wordhunt.trace.base.mp3`, 11 semitones |
| /sounds/wordhunt.trace8.mp3 | `wordhunt.trace8` | #437 | yes | 135 | 135 | -22.7 (-22.7) | -12.6 | from `wordhunt.trace.base.mp3`, 12 semitones |
| /sounds/wordhunt.trace9.mp3 | `wordhunt.trace9` | #437 | yes | 120 | 120 | -22.6 (-22.7) | -12.4 | from `wordhunt.trace.base.mp3`, 14 semitones |
| /sounds/wordsearch.found4.mp3 | `wordsearch.found4` | #437 | yes | 450 | 450 | -25.0 (-17.5) | -1.1 | from `wordsearch.found.base.mp3`, 0 semitones |
| /sounds/wordsearch.found5.mp3 | `wordsearch.found5` | #437 | yes | 401 | 401 | -25.3 (-17.5) | -1.2 | from `wordsearch.found.base.mp3`, 2 semitones |
| /sounds/wordsearch.found6.mp3 | `wordsearch.found6` | #437 | yes | 357 | 357 | -26.3 (-17.5) | -2.1 | from `wordsearch.found.base.mp3`, 4 semitones |
| /sounds/wordsearch.found7.mp3 | `wordsearch.found7` | #437 | yes | 337 | 337 | -26.4 (-17.5) | -2.3 | from `wordsearch.found.base.mp3`, 5 semitones |
| /sounds/wordsearch.found8.mp3 | `wordsearch.found8` | #437 | yes | 300 | 300 | -26.0 (-17.5) | -1.3 | from `wordsearch.found.base.mp3`, 7 semitones |
| /sounds/wordsearch.found9.mp3 | `wordsearch.found9` | #437 | yes | 268 | 268 | -26.9 (-17.5) | -2.4 | from `wordsearch.found.base.mp3`, 9 semitones |
| /sounds/wordsmith.word4.mp3 | `wordsmith.word4` | #437 | yes | 350 | 350 | -17.5 (-17.5) | -7.8 | from `wordsmith.word.base.mp3`, 0 semitones |
| /sounds/wordsmith.word5.mp3 | `wordsmith.word5` | #437 | yes | 312 | 312 | -17.5 (-17.5) | -7.8 | from `wordsmith.word.base.mp3`, 2 semitones |
| /sounds/wordsmith.word6.mp3 | `wordsmith.word6` | #437 | yes | 278 | 278 | -17.5 (-17.5) | -8.4 | from `wordsmith.word.base.mp3`, 4 semitones |
| /sounds/wordsmith.word7.mp3 | `wordsmith.word7` | #437 | yes | 262 | 262 | -17.5 (-17.5) | -8.4 | from `wordsmith.word.base.mp3`, 5 semitones |
| /sounds/wordsmith.word8.mp3 | `wordsmith.word8` | #437 | yes | 234 | 234 | -22.7 (-22.7) | -13.4 | from `wordsmith.word.base.mp3`, 7 semitones |
| /sounds/wordsmith.word9.mp3 | `wordsmith.word9` | #437 | yes | 208 | 208 | -22.7 (-22.7) | -13.1 | from `wordsmith.word.base.mp3`, 9 semitones |

## Main's overhaul trains (17 Nov 2026)

The puzzle and arcade trains (#449, #450) are on main, with their own placeholder files (behind `NEW_GAME_SOUNDS`) under
81 of batch 2's names; none of batch 2's names is a file a live slot plays, so nothing is held back for that reason.
This branch merges main through batch 1 (#448, which merged it first) and keeps Joe's recordings over those
placeholders; main's `newGameSounds.data.ts` measures them (make.py's recorded rows). They keep that data's limits
(sound-review-fixes-check: at most 4.5 dB under the target, at most 15,000 bytes), so seven takes were processed again
with the placeholder caps: `word.key`, `codeword.ripple` and `swapword.out` limited past transparent, `wordsmith.pangram`,
`wordsearch.redraw`, `letterwheel.spin` and `swapword.scale` shortened to about 1.16 s for the size aim.

**`wordsearch.found4`–`found9` keep main's placeholders for now.** Their `.base` take is a sharp spike over a quiet body
(on [batch-2-retakes.md](batch-2-retakes.md)): two of the six could not come within 4.5 dB of the house level even past
audible limiting, so the whole series waits for the retake rather than mix Joe's notes and placeholders.
`wordsearch.found.base.mp3` is kept; re-make the series with
`ONLY=wordsearch.found.base.mp3 python3 -I scripts/sound-batch-2/process.py <originals> public/sounds <report>`.
