# Sound batch 1: retakes (16 Nov 2026)

The batch-1 recordings ([sounds-batch-1.csv](sounds-batch-1.csv)) that still need re-recording after Joe's fixes of
16 Nov 2026 ([batch-1-wiring.md](batch-1-wiring.md)). Judged by measurement (`scripts/sound-batch-1/report.json`);
each file is processed and usable meanwhile. Re-record at the CSV's prompt, then re-run
`ONLY=<file> python3 -I scripts/sound-batch-1/process.py <originals> public/sounds <report>`.

- `sudoku.pencil.mp3` (#430): reverb tail: the fade starts only 9.1 dB under the peak, so the stop is audible.
- `minesweeper.defuse.mp3` (#430): 6.1 dB quieter than its family: a sharp spike over a quiet body, more needs audible limiting.
- `sudoku.clear.mp3` (#430): Joe to judge by ear: a click then nothing, which may be right for the short tick asked.
- `tubes.reset.mp3` (#430): 6.0 dB quieter than its family: a sharp spike over a quiet body, more needs audible limiting.
- `nonogram.solve.mp3` (#430): 9.8 dB quieter than its family: a sharp spike over a quiet body, more needs audible limiting.
- `shikaku.snap.mp3` (#435): 8.6 dB quieter than its family: a sharp spike over a quiet body, more needs audible limiting.
- `shikaku.invalid.mp3` (#435): near-silent upload (-67.1 LUFS): lifted 44.4 dB, its noise with it.
- `lightup.clash.mp3` (#435): still sounding at 1.5x its length (450 ms, -3.1 dB under its peak): the fade is an audible chop.
- `trail.undo.mp3` (#435): still sounding at 1.5x its length (225 ms, -2.5 dB under its peak): the fade is an audible chop.
- `fences.over.mp3` (#435): reverb tail: the fade starts only 6.6 dB under the peak, so the stop is audible.
- `fences.solve.mp3` (#435): a click then nothing: the second part the prompt asks for is missing; 6.4 dB quieter than its family: a sharp spike over a quiet body, more needs audible limiting.
- `fillomino.over.mp3` (#435): near-silent upload (-66.7 LUFS): lifted 44.0 dB, its noise with it.
- `bridges.double.mp3` (#435): a click then nothing: the second part the prompt asks for is missing; 8.6 dB quieter than its family: a sharp spike over a quiet body, more needs audible limiting.
- `symscan.gridClear.mp3` (#438): 9.3 dB quieter than its family: a sharp spike over a quiet body, more needs audible limiting.
- `countup.revealTick.mp3` (#438): near-silent upload (-68.0 LUFS): lifted 45.3 dB, its noise with it.
- `maze.bump.mp3` (#438): reverb tail: the fade starts only 8.5 dB under the peak, so the stop is audible.
- `reaction.wrong.mp3` (#439): still sounding at 1.5x its length (210 ms, -5.1 dB under its peak): the fade is an audible chop.
- `reaction.done.mp3` (#439): a click then nothing: the second part the prompt asks for is missing.
- `whack.bonk.mp3` (#439): near-silent upload (-59.9 LUFS): lifted 37.2 dB, its noise with it.
- `tendrop.count.mp3` (#439): still sounding at 1.5x its length (45 ms, -9.0 dB under its peak): the fade is an audible chop.
- `tendrop.tenBurst.mp3` (#439): a click then nothing: the second part the prompt asks for is missing; 9.1 dB quieter than its family: a sharp spike over a quiet body, more needs audible limiting.
- `tendrop.tap.mp3` (#439): still sounding at 1.5x its length (75 ms, -5.5 dB under its peak): the fade is an audible chop.
- `clayshoot.birdWrong.mp3` (#439): 7.7 dB quieter than its family: a sharp spike over a quiet body, more needs audible limiting.

23 files.
