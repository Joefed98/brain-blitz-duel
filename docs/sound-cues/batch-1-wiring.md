# Sound batch 1: wiring and retakes (16 Nov 2026)

Joe's 153 ElevenLabs recordings for the Logic (sessions 1 and 2), Speed and Attention overhauls, listed in
[sounds-batch-1.csv](sounds-batch-1.csv) (uploaded to branch `sounds-batch-1`, commit e810f88d). Each is cut and
levelled into `public/sounds/<file>` by `python3 -I scripts/sound-batch-1/process.py <originals> public/sounds <report>`
(measures in `scripts/sound-batch-1/report.json`), on the house method of [levels-nov-2026.md](levels-nov-2026.md):

- mono, 44.1 kHz, 96 kbps CBR MP3 with the LAME gapless tag (fix.py's writer, so the app trims it exactly);
- starts on the attack: the first sample over -60 dBFS, with 1 ms of digital silence kept before it (nothing of the
  sound is lost); the tail ends where the sound falls 59 dB under its own peak;
- cut to the CSV's `target_ms` with a 10 ms raised-cosine fade; a file already shorter keeps its length (never
  stretched) with a 5 ms fade; no row is a loop (`loop` is `no` throughout);
- levelled to the library's effect median for its length (under 0.25 s -22.7 LUFS, 0.25–0.5 s -17.5, 0.5–0.9 s
  -17.1, longer -16.5), true peak -1 dBFS or under, the fast limiter only while transparent, otherwise left short.

**Nothing is wired.** `NEW_GAME_SOUNDS` stays off. Each slot belongs to an overhaul PR that is not on main yet; once
that PR is on main, its manifest entry (`src/lib/fx/manifest.ts`) sets `url: "/sounds/<file>"` and `ms` to the length
below. Until then sound-manifest-check notes these files as awaiting wiring (it still checks each is in
`public/sounds/` as a tagged mono 44.1 kHz MP3).

Joe's fixes of 16 Nov 2026: `tower.drop`, `chain.heartbeat`, `clayshoot.shot` and `clayshoot.goldShatter` keep
their first event only (the second hit cut at the quietest point between them); `tower.illegal`, `tubes.glint`,
`nonogram.paint`, `lightup.clash`, `trail.undo`, `spotdiff.pictureOut`, `maze.deadEnd`, `reaction.wrong`,
`numhunt.shuffle`, `tendrop.count` and `tendrop.tap` ring out to their natural decay, never past 1.5x `target_ms`,
then the fade (`FIRST_EVENT_ONLY`, `RING_OUT` in process.py). Faded reverb tails are kept unless the fade is audible.

Two special cases:

- **`bomb.defuse.mp3` is held back.** main already plays `public/sounds/bomb.defuse.mp3` for the live slot
  `bomb.defuse`, so writing Joe's file there would change the live game before #438. The file in `public/sounds/` is
  still main's; #438 (or whoever wires it) makes Joe's with
  `ONLY=bomb.defuse.mp3 python3 -I scripts/sound-batch-1/process.py <originals> public/sounds <report>`.
- **18 files replace the November placeholders** (`scripts/sound-review-nov-2026/make.py`'s synthesised sounds for
  the same slots, played only with `NEW_GAME_SOUNDS` on). make.py now leaves a recorded file alone and only measures it
  for `src/lib/fx/newGameSounds.data.ts`, so with the switch on those slots would play Joe's recording; with it off
  (today) nothing changes. They are marked † below. They also keep that data's limits (sound-review-fixes-check: at most
  4.5 dB under the target, at most 15,000 bytes), so five of them are limited a little past transparent (what the
  limiter removes 11–13 dB under the sound, against the house's 14) and `safe.solve` loses its last 26 ms of tail.

The first column of each table is the file's manifest `url` (and keeps sound-cue-sheet from reading these rows as cues).

## Retakes

The sounds still to re-record are in [batch-1-retakes.md](batch-1-retakes.md) (marked “retake” below).

## sound-manifest-check

Changed with Joe's approval, 16 Nov 2026 (batch-1 sounds awaiting wiring): a file named in
[sounds-batch-1.csv](sounds-batch-1.csv) that no manifest slot plays yet is noted as awaiting wiring instead of
failing. **This is temporary: once every batch-1 file is wired, take the exception out of
`scripts/sound-manifest-check.ts` so the check is strict again.** Until a file is wired it is also left out of the
offline download (`awaitingWiringPaths` in `src/lib/offline/swPlugin.ts`), so phones don't fetch sounds nothing plays.

## Every file

Length after processing (ms), loudness (LUFS) against its length's target, true peak (dBFS). “Slot on the PR” says
whether the PR's current head (16 Nov 2026) already has the slot in its manifest; where it doesn't, the PR adds the
slot and its entry together.

| File (`url`) | Slot | PR | Slot on the PR | Target ms | ms | LUFS (target) | True peak | Note |
|---|---|---|---|---|---|---|---|---|
| /sounds/sudoku.place.mp3 | `sudoku.place` | #430 | yes | 150 | 150 | -26.9 (-22.7) | -2.6 | † replaces the placeholder, limited past transparent (-12.9 dB) to stay within 4.5 dB |
| /sounds/sudoku.pencil.mp3 | `sudoku.pencil` | #430 | yes | 100 | 100 | -22.7 (-22.7) | -1.7 | retake |
| /sounds/sudoku.clash.mp3 | `sudoku.clash` | #430 | yes | 200 | 200 | -22.8 (-22.7) | -2.6 |  |
| /sounds/sudoku.line.mp3 | `sudoku.line` | #430 | yes | 500 | 480 | -17.5 (-17.5) | -3.7 |  |
| /sounds/sudoku.combo.mp3 | `sudoku.combo` | #430 | to add | 800 | 800 | -17.1 (-17.1) | -2.6 |  |
| /sounds/tubes.lift.mp3 | `tubes.lift` | #430 | yes | 300 | 300 | -17.7 (-17.5) | -2.5 |  |
| /sounds/tubes.pour.mp3 | `tubes.pour` | #430 | yes | 450 | 450 | -17.6 (-17.5) | -2.5 | † replaces the placeholder |
| /sounds/tubes.undo.mp3 | `tubes.undo` | #430 | yes | 200 | 200 | -23.9 (-22.7) | -2.5 |  |
| /sounds/tubes.wrong.mp3 | `tubes.wrong` | #430 | to add | 350 | 350 | -19.8 (-17.5) | -2.6 |  |
| /sounds/tubes.outOfPours.mp3 | `tubes.outOfPours` | #430 | yes | 600 | 600 | -17.1 (-17.1) | -4.7 |  |
| /sounds/tower.drop.mp3 | `tower.drop` | #430 | yes | 250 | 180 | -22.7 (-22.7) | -4.5 | † replaces the placeholder |
| /sounds/tower.illegal.mp3 | `tower.illegal` | #430 | to add | 250 | 375 | -17.5 (-17.5) | -4.2 |  |
| /sounds/tower.glint.mp3 | `tower.glint` | #430 | to add | 400 | 400 | -17.5 (-17.5) | -1.2 |  |
| /sounds/safe.wrongTry.mp3 | `safe.wrongTry` | #430 | yes | 400 | 400 | -22.0 (-17.5) | -2.1 |  |
| /sounds/safe.solve.mp3 | `safe.solve` | #430 | yes | 1200 | 1161 | -17.9 (-16.5) | -1.6 | † replaces the placeholder, tail shortened to stay under 15,000 bytes |
| /sounds/nonogram.fill.mp3 | `nonogram.fill` | #430 | yes | 150 | 150 | -24.1 (-22.7) | -2.7 | † replaces the placeholder |
| /sounds/nonogram.paint.mp3 | `nonogram.paint` | #430 | yes | 80 | 120 | -23.9 (-22.7) | -2.0 |  |
| /sounds/nonogram.mark.mp3 | `nonogram.mark` | #430 | yes | 120 | 120 | -22.7 (-22.7) | -4.4 | † replaces the placeholder |
| /sounds/nonogram.line.mp3 | `nonogram.line` | #430 | yes | 400 | 400 | -17.5 (-17.5) | -3.2 |  |
| /sounds/flood.spread.mp3 | `flood.spread` | #430 | yes | 300 | 300 | -17.5 (-17.5) | -1.7 | † replaces the placeholder |
| /sounds/flood.combo.mp3 | `flood.combo` | #430 | to add | 600 | 600 | -17.2 (-17.1) | -3.6 |  |
| /sounds/minesweeper.hit.mp3 | `minesweeper.hit` | #430 | yes | 450 | 450 | -17.5 (-17.5) | -2.1 |  |
| /sounds/minesweeper.defuse.mp3 | `minesweeper.defuse` | #430 | to add | 150 | 150 | -28.8 (-22.7) | -1.0 | retake |
| /sounds/minesweeper.tapNumber.mp3 | `minesweeper.tapNumber` | #430 | to add | 100 | 100 | -22.7 (-22.7) | -2.5 |  |
| /sounds/sudoku.clear.mp3 | `sudoku.clear` | #430 | to add | 120 | 120 | -26.6 (-22.7) | -2.6 | retake |
| /sounds/sudoku.solve.mp3 | `sudoku.solve` | #430 | yes | 1000 | 1000 | -16.5 (-16.5) | -4.1 |  |
| /sounds/tubes.combo.mp3 | `tubes.combo` | #430 | to add | 600 | 600 | -18.9 (-17.1) | -2.5 |  |
| /sounds/tubes.reset.mp3 | `tubes.reset` | #430 | to add | 500 | 480 | -23.5 (-17.5) | -2.6 | retake |
| /sounds/tower.lift.mp3 | `tower.lift` | #430 | yes | 250 | 250 | -17.5 (-17.5) | -2.9 |  |
| /sounds/tower.lower.mp3 | `tower.lower` | #430 | to add | 150 | 150 | -22.7 (-22.7) | -4.5 |  |
| /sounds/tower.undo.mp3 | `tower.undo` | #430 | to add | 250 | 250 | -17.5 (-17.5) | -1.3 |  |
| /sounds/tower.reset.mp3 | `tower.reset` | #430 | to add | 500 | 480 | -17.7 (-17.5) | -2.2 |  |
| /sounds/safe.drumLock.mp3 | `safe.drumLock` | #430 | to add | 150 | 150 | -24.1 (-22.7) | -2.6 |  |
| /sounds/flood.nearPar.mp3 | `flood.nearPar` | #430 | to add | 400 | 400 | -17.6 (-17.5) | -2.6 |  |
| /sounds/flood.outOfMoves.mp3 | `flood.outOfMoves` | #430 | to add | 600 | 599 | -17.1 (-17.1) | -3.5 |  |
| /sounds/minesweeper.clear.mp3 | `minesweeper.clear` | #430 | yes | 1200 | 1200 | -16.6 (-16.5) | -1.5 |  |
| /sounds/tubes.glint.mp3 | `tubes.glint` | #430 | to add | 200 | 300 | -17.5 (-17.5) | -5.9 |  |
| /sounds/tower.solve.mp3 | `tower.solve` | #430 | yes | 1000 | 975 | -18.3 (-16.5) | -2.1 |  |
| /sounds/tower.near.mp3 | `tower.near` | #430 | to add | 400 | 400 | -17.7 (-17.5) | -2.4 |  |
| /sounds/nonogram.combo.mp3 | `nonogram.combo` | #430 | to add | 600 | 600 | -17.1 (-17.1) | -3.2 |  |
| /sounds/nonogram.solve.mp3 | `nonogram.solve` | #430 | yes | 1000 | 739 | -19.7 (-17.1) | -2.1 | batch 3's take (the upload is 739 ms) |
| /sounds/flood.reject.mp3 | `flood.reject` | #430 | to add | 150 | 150 | -22.8 (-22.7) | -3.2 |  |
| /sounds/flood.solve.mp3 | `flood.solve` | #430 | yes | 1000 | 1000 | -16.6 (-16.5) | -2.6 |  |
| /sounds/minesweeper.cascadeTick.mp3 | `minesweeper.cascadeTick` | #430 | to add | 50 | 50 | -22.9 (-22.7) | -2.4 |  |
| /sounds/tents.pitch.mp3 | `tents.pitch` | #435 | yes | 300 | 300 | -21.8 (-17.5) | -2.3 | † replaces the placeholder, limited past transparent (-11.0 dB) to stay within 4.5 dB |
| /sounds/tents.grass.mp3 | `tents.grass` | #435 | yes | 200 | 200 | -22.9 (-22.7) | -5.0 | † replaces the placeholder |
| /sounds/tents.touch.mp3 | `tents.touch` | #435 | yes | 200 | 200 | -22.7 (-22.7) | -6.3 |  |
| /sounds/tents.signMet.mp3 | `tents.signMet` | #435 | yes | 400 | 400 | -17.5 (-17.5) | -8.1 |  |
| /sounds/tents.solve.mp3 | `tents.solve` | #435 | yes | 1200 | 1200 | -16.5 (-16.5) | -1.7 |  |
| /sounds/tents.lonely.mp3 | `tents.lonely` | #435 | yes | 200 | 200 | -22.7 (-22.7) | -5.7 |  |
| /sounds/shikaku.snap.mp3 | `shikaku.snap` | #435 | yes | 50 | 50 | -31.3 (-22.7) | -2.2 | retake |
| /sounds/shikaku.place.mp3 | `shikaku.place` | #435 | yes | 250 | 250 | -20.1 (-17.5) | -2.2 | † replaces the placeholder |
| /sounds/shikaku.invalid.mp3 | `shikaku.invalid` | #435 | yes | 150 | 150 | -22.7 (-22.7) | -7.5 | retake |
| /sounds/shikaku.remove.mp3 | `shikaku.remove` | #435 | yes | 200 | 200 | -22.7 (-22.7) | -7.1 | † replaces the placeholder |
| /sounds/shikaku.solve.mp3 | `shikaku.solve` | #435 | yes | 1000 | 1000 | -16.5 (-16.5) | -4.6 |  |
| /sounds/shikaku.dragStart.mp3 | `shikaku.dragStart` | #435 | yes | 80 | 80 | -26.2 (-22.7) | -1.8 |  |
| /sounds/lightup.lamp.mp3 | `lightup.lamp` | #435 | yes | 300 | 300 | -21.9 (-17.5) | -1.1 | † replaces the placeholder, limited past transparent (-12.0 dB) to stay within 4.5 dB |
| /sounds/lightup.clash.mp3 | `lightup.clash` | #435 | yes | 300 | 450 | -17.6 (-17.5) | -5.3 | retake |
| /sounds/lightup.wallMet.mp3 | `lightup.wallMet` | #435 | yes | 150 | 150 | -22.7 (-22.7) | -5.2 |  |
| /sounds/lightup.dot.mp3 | `lightup.dot` | #435 | yes | 100 | 100 | -26.7 (-22.7) | -2.6 | † replaces the placeholder |
| /sounds/lightup.dark.mp3 | `lightup.dark` | #435 | yes | 400 | 400 | -17.5 (-17.5) | -5.8 |  |
| /sounds/lightup.solve.mp3 | `lightup.solve` | #435 | yes | 1000 | 1000 | -16.5 (-16.5) | -3.0 |  |
| /sounds/trail.step.mp3 | `trail.step` | #435 | yes | 300 | 300 | -17.5 (-17.5) | -3.8 | † replaces the placeholder |
| /sounds/trail.fixed.mp3 | `trail.fixed` | #435 | yes | 500 | 480 | -17.5 (-17.5) | -1.3 |  |
| /sounds/trail.refused.mp3 | `trail.refused` | #435 | yes | 150 | 150 | -22.8 (-22.7) | -2.7 |  |
| /sounds/trail.undo.mp3 | `trail.undo` | #435 | yes | 150 | 225 | -22.7 (-22.7) | -4.4 | retake |
| /sounds/trail.reset.mp3 | `trail.reset` | #435 | yes | 400 | 400 | -17.7 (-17.5) | -2.6 |  |
| /sounds/trail.solve.mp3 | `trail.solve` | #435 | yes | 1100 | 1080 | -16.5 (-16.5) | -2.8 |  |
| /sounds/fences.cross.mp3 | `fences.cross` | #435 | yes | 150 | 150 | -22.7 (-22.7) | -4.8 |  |
| /sounds/fences.clear.mp3 | `fences.clear` | #435 | yes | 150 | 150 | -22.7 (-22.7) | -5.5 |  |
| /sounds/fences.numberMet.mp3 | `fences.numberMet` | #435 | yes | 200 | 200 | -22.7 (-22.7) | -7.0 |  |
| /sounds/fences.over.mp3 | `fences.over` | #435 | yes | 150 | 150 | -22.7 (-22.7) | -7.2 | retake |
| /sounds/fences.solve.mp3 | `fences.solve` | #435 | yes | 600 | 582 | -23.5 (-17.1) | -1.7 | retake |
| /sounds/fences.loopWrong.mp3 | `fences.loopWrong` | #435 | yes | 400 | 400 | -17.5 (-17.5) | -2.9 |  |
| /sounds/fences.undo.mp3 | `fences.undo` | #435 | yes | 120 | 120 | -22.6 (-22.7) | -4.2 |  |
| /sounds/fences.reset.mp3 | `fences.reset` | #435 | yes | 400 | 400 | -17.5 (-17.5) | -3.2 |  |
| /sounds/fillomino.stroke.mp3 | `fillomino.stroke` | #435 | yes | 80 | 80 | -22.8 (-22.7) | -3.2 |  |
| /sounds/fillomino.region.mp3 | `fillomino.region` | #435 | yes | 600 | 600 | -17.1 (-17.1) | -1.3 |  |
| /sounds/fillomino.over.mp3 | `fillomino.over` | #435 | yes | 150 | 150 | -22.7 (-22.7) | -4.1 | retake |
| /sounds/fillomino.erase.mp3 | `fillomino.erase` | #435 | yes | 150 | 150 | -22.9 (-22.7) | -2.3 |  |
| /sounds/fillomino.undo.mp3 | `fillomino.undo` | #435 | yes | 150 | 150 | -22.7 (-22.7) | -5.9 |  |
| /sounds/fillomino.pick.mp3 | `fillomino.pick` | #435 | yes | 80 | 80 | -25.6 (-22.7) | -2.3 |  |
| /sounds/fillomino.reset.mp3 | `fillomino.reset` | #435 | yes | 400 | 400 | -20.6 (-17.5) | -1.8 |  |
| /sounds/fillomino.solve.mp3 | `fillomino.solve` | #435 | yes | 1200 | 1200 | -16.6 (-16.5) | -2.0 |  |
| /sounds/bridges.build.mp3 | `bridges.build` | #435 | yes | 250 | 250 | -19.1 (-17.5) | -2.5 |  |
| /sounds/bridges.double.mp3 | `bridges.double` | #435 | yes | 300 | 300 | -26.1 (-17.5) | -1.0 | retake |
| /sounds/bridges.remove.mp3 | `bridges.remove` | #435 | yes | 250 | 250 | -21.4 (-17.5) | -1.9 |  |
| /sounds/bridges.snapBack.mp3 | `bridges.snapBack` | #435 | yes | 200 | 200 | -22.8 (-22.7) | -2.1 |  |
| /sounds/bridges.islandMet.mp3 | `bridges.islandMet` | #435 | yes | 400 | 400 | -17.4 (-17.5) | -2.3 |  |
| /sounds/bridges.solve.mp3 | `bridges.solve` | #435 | yes | 1000 | 1000 | -16.6 (-16.5) | -3.3 |  |
| /sounds/bridges.undo.mp3 | `bridges.undo` | #435 | yes | 150 | 150 | -22.7 (-22.7) | -1.5 |  |
| /sounds/bridges.reset.mp3 | `bridges.reset` | #435 | yes | 400 | 400 | -17.6 (-17.5) | -1.4 |  |
| /sounds/symscan.mark.mp3 | `symscan.mark` | #438 | yes | 100 | 100 | -26.7 (-22.7) | -2.5 | † replaces the placeholder, limited past transparent (-11.0 dB) to stay within 4.5 dB |
| /sounds/symscan.unmark.mp3 | `symscan.unmark` | #438 | yes | 80 | 80 | -24.3 (-22.7) | -1.3 | † replaces the placeholder |
| /sounds/symscan.gridClear.mp3 | `symscan.gridClear` | #438 | yes | 600 | 594 | -26.4 (-17.1) | -2.5 | retake |
| /sounds/symscan.cleanGrid.mp3 | `symscan.cleanGrid` | #438 | yes | 400 | 400 | -17.6 (-17.5) | -4.5 |  |
| /sounds/symscan.missed.mp3 | `symscan.missed` | #438 | yes | 200 | 200 | -22.7 (-22.7) | -6.0 |  |
| /sounds/spotdiff.found.mp3 | `spotdiff.found` | #438 | yes | 350 | 350 | -20.9 (-17.5) | -1.7 | † replaces the placeholder |
| /sounds/spotdiff.miss.mp3 | `spotdiff.miss` | #438 | yes | 150 | 150 | -22.9 (-22.7) | -2.6 |  |
| /sounds/spotdiff.hidden.mp3 | `spotdiff.hidden` | #438 | yes | 600 | 600 | -17.1 (-17.1) | -3.3 |  |
| /sounds/spotdiff.pictureOut.mp3 | `spotdiff.pictureOut` | #438 | yes | 350 | 486 | -17.4 (-17.5) | -4.5 |  |
| /sounds/countup.key.mp3 | `countup.key` | #438 | yes | 60 | 60 | -23.4 (-22.7) | -2.6 |  |
| /sounds/countup.mark.mp3 | `countup.mark` | #438 | yes | 80 | 80 | -25.6 (-22.7) | -1.8 |  |
| /sounds/countup.unmark.mp3 | `countup.unmark` | #438 | yes | 60 | 60 | -27.2 (-22.7) | -2.1 |  |
| /sounds/countup.trayOut.mp3 | `countup.trayOut` | #438 | yes | 400 | 400 | -17.5 (-17.5) | -2.6 |  |
| /sounds/countup.revealTick.mp3 | `countup.revealTick` | #438 | yes | 40 | 40 | -22.7 (-22.7) | -4.3 | retake |
| /sounds/countup.soClose.mp3 | `countup.soClose` | #438 | yes | 400 | 400 | -17.4 (-17.5) | -2.7 |  |
| /sounds/maze.step.mp3 | `maze.step` | #438 | yes | 50 | 50 | -22.8 (-22.7) | -2.6 |  |
| /sounds/maze.bump.mp3 | `maze.bump` | #438 | yes | 120 | 120 | -22.7 (-22.7) | -5.8 | retake |
| /sounds/maze.back.mp3 | `maze.back` | #438 | yes | 40 | 40 | -22.6 (-22.7) | -1.4 |  |
| /sounds/maze.deadEnd.mp3 | `maze.deadEnd` | #438 | yes | 300 | 450 | -17.5 (-17.5) | -7.6 |  |
| /sounds/maze.trace.mp3 | `maze.trace` | #438 | yes | 1000 | 1000 | -16.5 (-16.5) | -3.3 |  |
| /sounds/bomb.press.mp3 | `bomb.press` | #438 | yes | 120 | 120 | -22.8 (-22.7) | -3.3 | † replaces the placeholder |
| /sounds/bomb.step.mp3 | `bomb.step` | #438 | yes | 50 | 50 | -26.4 (-22.7) | -2.2 |  |
| /sounds/bomb.defuse.mp3 | `bomb.defuse` | #438 | yes | 1200 | 1199 | -16.5 (-16.5) | -5.5 | held back (main's file kept) |
| /sounds/bomb.instant.mp3 | `bomb.instant` | #438 | to add | 800 | 724 | -17.2 (-17.1) | -1.9 |  |
| /sounds/pairmatch.flip.mp3 | `pairmatch.flip` | #438 | yes | 100 | 100 | -22.7 (-22.7) | -5.8 |  |
| /sounds/pairmatch.match.mp3 | `pairmatch.match` | #438 | yes | 350 | 350 | -17.4 (-17.5) | -3.1 |  |
| /sounds/pairmatch.miss.mp3 | `pairmatch.miss` | #438 | yes | 150 | 150 | -22.8 (-22.7) | -7.6 |  |
| /sounds/pairmatch.gold.mp3 | `pairmatch.gold` | #438 | yes | 700 | 680 | -17.1 (-17.1) | -3.7 |  |
| /sounds/pairmatch.cardWave.mp3 | `pairmatch.cardWave` | #438 | yes | 1000 | 1000 | -16.5 (-16.5) | -1.8 |  |
| /sounds/reaction.hit.mp3 | `reaction.hit` | #439 | yes | 90 | 90 | -24.4 (-22.7) | -2.6 |  |
| /sounds/reaction.combo.mp3 | `reaction.combo` | #439 | yes | 250 | 250 | -17.5 (-17.5) | -2.5 |  |
| /sounds/reaction.wrong.mp3 | `reaction.wrong` | #439 | yes | 140 | 210 | -22.7 (-22.7) | -9.6 | retake |
| /sounds/reaction.done.mp3 | `reaction.done` | #439 | yes | 600 | 600 | -17.4 (-17.1) | -2.0 | retake |
| /sounds/reaction.bar.mp3 | `reaction.bar` | #439 | yes | 70 | 70 | -22.7 (-22.7) | -3.9 |  |
| /sounds/numhunt.note-low.mp3 | `numhunt.note-low` | #439 | yes | 300 | 300 | -17.5 (-17.5) | -3.9 |  |
| /sounds/numhunt.note-mid.mp3 | `numhunt.note-mid` | #439 | yes | 300 | 300 | -17.5 (-17.5) | -5.4 |  |
| /sounds/numhunt.note-high.mp3 | `numhunt.note-high` | #439 | yes | 300 | 300 | -17.5 (-17.5) | -3.2 |  |
| /sounds/numhunt.combo.mp3 | `numhunt.combo` | #439 | yes | 400 | 400 | -17.5 (-17.5) | -2.7 |  |
| /sounds/numhunt.wrong.mp3 | `numhunt.wrong` | #439 | yes | 150 | 150 | -22.8 (-22.7) | -2.6 |  |
| /sounds/numhunt.warn.mp3 | `numhunt.warn` | #439 | yes | 900 | 869 | -17.1 (-17.1) | -4.4 |  |
| /sounds/numhunt.shuffle.mp3 | `numhunt.shuffle` | #439 | yes | 320 | 480 | -17.5 (-17.5) | -2.2 |  |
| /sounds/chain.reshuffle.mp3 | `chain.reshuffle` | #439 | yes | 300 | 300 | -17.5 (-17.5) | -1.2 |  |
| /sounds/chain.heartbeat.mp3 | `chain.heartbeat` | #439 | yes | 500 | 135 | -22.8 (-22.7) | -1.1 |  |
| /sounds/whack.bonk.mp3 | `whack.bonk` | #439 | yes | 180 | 180 | -22.7 (-22.7) | -7.2 | retake |
| /sounds/whack.whistle.mp3 | `whack.whistle` | #439 | yes | 450 | 450 | -17.5 (-17.5) | -6.8 |  |
| /sounds/whack.slam.mp3 | `whack.slam` | #439 | yes | 260 | 260 | -17.6 (-17.5) | -2.6 |  |
| /sounds/whack.hedgehog.mp3 | `whack.hedgehog` | #439 | yes | 320 | 320 | -17.6 (-17.5) | -2.6 |  |
| /sounds/whack.wrongHat.mp3 | `whack.wrongHat` | #439 | yes | 150 | 150 | -22.6 (-22.7) | -5.6 |  |
| /sounds/whack.diamond.mp3 | `whack.diamond` | #439 | yes | 420 | 420 | -17.5 (-17.5) | -4.0 |  |
| /sounds/whack.emptyTap.mp3 | `whack.emptyTap` | #439 | yes | 80 | 80 | -22.7 (-22.7) | -1.4 |  |
| /sounds/tendrop.apply.mp3 | `tendrop.apply` | #439 | yes | 70 | 70 | -22.7 (-22.7) | -3.1 |  |
| /sounds/tendrop.count.mp3 | `tendrop.count` | #439 | yes | 30 | 45 | -22.8 (-22.7) | -3.9 | retake |
| /sounds/tendrop.near.mp3 | `tendrop.near` | #439 | yes | 300 | 300 | -17.5 (-17.5) | -3.5 |  |
| /sounds/tendrop.tenBurst.mp3 | `tendrop.tenBurst` | #439 | yes | 500 | 417 | -26.6 (-17.5) | -2.5 | retake |
| /sounds/tendrop.shatter.mp3 | `tendrop.shatter` | #439 | yes | 420 | 396 | -21.0 (-17.5) | -2.3 |  |
| /sounds/tendrop.tap.mp3 | `tendrop.tap` | #439 | yes | 50 | 75 | -22.7 (-22.7) | -1.5 | retake |
| /sounds/clayshoot.shot.mp3 | `clayshoot.shot` | #439 | yes | 450 | 210 | -22.8 (-22.7) | -2.0 |  |
| /sounds/clayshoot.goldShatter.mp3 | `clayshoot.goldShatter` | #439 | yes | 450 | 274 | -18.9 (-17.5) | -1.3 |  |
| /sounds/clayshoot.goldChime.mp3 | `clayshoot.goldChime` | #439 | yes | 500 | 486 | -17.5 (-17.5) | -5.1 |  |
| /sounds/clayshoot.escape.mp3 | `clayshoot.escape` | #439 | yes | 400 | 400 | -17.5 (-17.5) | -7.9 |  |
| /sounds/clayshoot.birdWrong.mp3 | `clayshoot.birdWrong` | #439 | yes | 250 | 250 | -25.2 (-17.5) | -1.1 | retake |

## Main's overhaul trains (17 Nov 2026)

The puzzle and arcade trains (#449, #450) brought the overhauls to main with their own placeholder files under many of
batch 1's names. Merging main into this branch:

- **33 files are held back**, `bomb.defuse` and 32 the Speed overhaul (#439) now plays live with its own recordings:
  `chain.heartbeat`, `chain.reshuffle`, `clayshoot.birdWrong`, `clayshoot.escape`, `clayshoot.goldChime`, `clayshoot.goldShatter`, `clayshoot.shot`, `numhunt.combo`, `numhunt.note-high`, `numhunt.note-low`, `numhunt.note-mid`, `numhunt.shuffle`, `numhunt.warn`, `numhunt.wrong`, `reaction.bar`, `reaction.combo`, `reaction.done`, `reaction.hit`, `reaction.wrong`, `tendrop.apply`, `tendrop.count`, `tendrop.near`, `tendrop.shatter`, `tendrop.tap`, `tendrop.tenBurst`, `whack.bonk`, `whack.diamond`, `whack.emptyTap`, `whack.hedgehog`, `whack.slam`, `whack.whistle`, `whack.wrongHat`. Main's files are kept; wiring Joe's
  in their place is a choice for Joe (re-make any with
  `ONLY=<file> python3 -I scripts/sound-batch-1/process.py <originals> public/sounds <report>`).
- **11 more names are November-style placeholders on main** (behind `NEW_GAME_SOUNDS`): Joe's files are kept, and
  `src/lib/fx/newGameSounds.data.ts` (main's) measures them (make.py's recorded rows).

## Retakes from batch 3

Each new take was processed on batch 1's method with the two fixes (ring out up to 1.5x where a cut would chop; first
event only where one was asked) and scored against the batch-1 file by the retake measures (a near-silent upload counting
twice, then the distance under the house level, then how much of it sounds); the better one is kept.

- `bridges.double.mp3` (#435): **kept new**, fewer or lighter problems. Old: a click then nothing; 8.6 dB quieter than its family (a spike over a quiet body). New: 8.2 dB quieter than its family (a spike over a quiet body).
- `clayshoot.birdWrong.mp3` (#439): **kept new**, no problems left. Old: 7.7 dB quieter than its family (a spike over a quiet body). New: none. Live on main (the Speed overhaul's own file plays there), so not written: the winner is re-made by retakes.py without HELD when Joe wires it.
- `countup.revealTick.mp3` (#438): **kept new**, fewer or lighter problems. Old: near-silent upload (-68.0 LUFS); reverb tail: the fade starts 1.8 dB under the peak. New: 6.0 dB quieter than its family (a spike over a quiet body); still sounding at 1.5x its length (-4.4 dB under its peak at the fade).
- `fences.over.mp3` (#435): **kept new**, no problems left. Old: reverb tail: the fade starts 6.6 dB under the peak. New: none.
- `fillomino.over.mp3` (#435): **kept new**, no problems left. Old: near-silent upload (-66.7 LUFS). New: none.
- `lightup.clash.mp3` (#435): **kept new**, no problems left. Old: still sounding at 1.5x its length (-3.1 dB under its peak at the fade). New: none.
- `maze.bump.mp3` (#438): **kept new**, no problems left. Old: reverb tail: the fade starts 8.5 dB under the peak. New: none.
- `minesweeper.defuse.mp3` (#430): **kept new**, no problems left. Old: 6.1 dB quieter than its family (a spike over a quiet body). New: none.
- `reaction.wrong.mp3` (#439): **kept new**, no problems left. Old: still sounding at 1.5x its length (-5.1 dB under its peak at the fade). New: none. Live on main (the Speed overhaul's own file plays there), so not written: the winner is re-made by retakes.py without HELD when Joe wires it.
- `shikaku.invalid.mp3` (#435): **kept new**, no problems left. Old: near-silent upload (-67.1 LUFS); reverb tail: the fade starts 4.5 dB under the peak. New: none.
- `shikaku.snap.mp3` (#435): **kept new**, no problems left. Old: 8.6 dB quieter than its family (a spike over a quiet body). New: none.
- `sudoku.clear.mp3` (#430): **kept new**, no problems left. Old: a click then nothing. New: none.
- `sudoku.pencil.mp3` (#430): **kept new**, no problems left. Old: reverb tail: the fade starts 9.1 dB under the peak. New: none.
- `tendrop.count.mp3` (#439): **kept new**, no problems left. Old: still sounding at 1.5x its length (-9.0 dB under its peak at the fade). New: none. Live on main (the Speed overhaul's own file plays there), so not written: the winner is re-made by retakes.py without HELD when Joe wires it.
- `tendrop.tap.mp3` (#439): **kept new**, no problems left. Old: still sounding at 1.5x its length (-5.5 dB under its peak at the fade). New: none. Live on main (the Speed overhaul's own file plays there), so not written: the winner is re-made by retakes.py without HELD when Joe wires it.
- `tendrop.tenBurst.mp3` (#439): **kept new**, no problems left. Old: a click then nothing; 9.1 dB quieter than its family (a spike over a quiet body). New: none. Live on main (the Speed overhaul's own file plays there), so not written: the winner is re-made by retakes.py without HELD when Joe wires it.
- `trail.undo.mp3` (#435): **kept old**, the same problems, and the old take sits closer to the house level. Old: still sounding at 1.5x its length (-2.5 dB under its peak at the fade). New: still sounding at 1.5x its length (-3.5 dB under its peak at the fade).
- `tubes.reset.mp3` (#430): **kept old**, the same problems, and the old take sits closer to the house level. Old: 6.0 dB quieter than its family (a spike over a quiet body). New: 6.8 dB quieter than its family (a spike over a quiet body).
- `whack.bonk.mp3` (#439): **kept new**, no problems left. Old: near-silent upload (-59.9 LUFS). New: none. Live on main (the Speed overhaul's own file plays there), so not written: the winner is re-made by retakes.py without HELD when Joe wires it.
- `fences.solve.mp3` (#435): **kept new**, fewer or lighter problems. Old: a click then nothing; 6.4 dB quieter than its family (a spike over a quiet body). New: 13.7 dB quieter than its family (a spike over a quiet body).
- `reaction.done.mp3` (#439): **kept new**, no problems left. Old: a click then nothing. New: none. Live on main (the Speed overhaul's own file plays there), so not written: the winner is re-made by retakes.py without HELD when Joe wires it.
- `symscan.gridClear.mp3` (#438): **kept new**, the same problems, closer to the house level. Old: 9.3 dB quieter than its family (a spike over a quiet body). New: 7.4 dB quieter than its family (a spike over a quiet body).
- `nonogram.solve.mp3` (#430): **kept new** (compared on 17 Nov 2026 at Joe's request: batch 3's "Tiles flipping row by row" take), no problems left. Old: 9.8 dB quieter than its family (a spike over a quiet body), -26.3 LUFS against -16.5, 39 % of it sounding. New: -19.7 LUFS against -17.1 (2.6 dB under, inside the family), 64 % sounding, true peak -2.1 dB, 739 ms (the upload's own length; nothing stretched).
