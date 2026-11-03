# Sound levels: Joe's November recordings re-cut (3 Nov 2026)

Joe could barely hear some of the sounds wired on 3 Nov 2026 (Moon Climb `ricochet.*`, Iron Wall `bastion.*`, Blockzone
`blockfall.*`, Ringer `alleyroll.*`, the five beds, round8–round11 and the five moment voice lines;
[mapping-nov-2026.csv](mapping-nov-2026.csv), [voice-lines-nov-2026.csv](voice-lines-nov-2026.csv)). Each file was
compared with Joe's upload (the `sounds-nov-2026` branch, commit f19a6876) and rebuilt from it.

## What was wrong

- **Attacks cut off.** The first wiring's leading-silence trim removed the sound itself on many effects: `alleyroll.ramp`
  peaked at -48.6 dBFS (the upload: -5.7), `ricochet.leap` -39.9 (-0.7), `ricochet.doubleJump` -38.0 (-2.4),
  `bastion.jam` -28.9 (-1.0), `bastion.reload` -37.9 (-7.1), `ricochet.lanternGrab` -42.5 (-18.6), `bastion.wave`
  -52.2 (-30.4); `bastion.loaded` and `ricochet.ledge` were cut to 47 and 42 ms.
- **Never levelled.** Every effect kept its upload's level, and many uploads are quiet: `blockfall.move` peaks at
  -34 dBFS, `ricochet.ledge` -29, `ricochet.scroll` -30, `bastion.drone` -21. The library's effects sit at a median
  -17.2 LUFS with peaks near -1.5 dBFS; the wired files were at -21 to -70 LUFS.
- **Beds too loud.** Four of the five beds sat at -11.4 to -14.5 LUFS against the library beds' -18.45, so they also
  drowned the effects under them.
- No clipping in any upload or wired file (every peak at or under -0.2 dBFS; one wired file decoded to +1.4 dBFS,
  `bastion.fastReload`, now -1.2).

## How the files are made now

`python3 -I scripts/sound-nov-2026/process.py <originals> public/sounds <report.json>` (originals: `git show
f19a6876:public/sounds/<file>`), measured by `scripts/sound-nov-2026/measure.py` (ebur128 integrated loudness with 1 s
of digital silence padded either side, so a sound under 400 ms still gets a gated block; peaks in the file's own
channels).

- **Effects:** only true digital silence is trimmed (under -60 dBFS): at least 10 ms is kept before the first sound, and
  the tail runs until it falls under -60 dBFS at the file's final level. Each effect is levelled to the median loudness
  of the library's effects of its length (253 files: under 0.25 s -22.7 LUFS, 0.25–0.5 s -17.5, 0.5–0.9 s -17.1, longer
  -16.5; short sounds read lower on a gated measure), peaks at most -1 dBFS after encoding. Where the peak stops the
  gain first, a fast lookahead limiter (0.5 ms attack, 5 ms release) takes the sub-millisecond spike these recordings
  open with, but only while it stays transparent (what it removes at least 14 dB under the sound); past that the file
  stays short of the median rather than be squashed. Mono 96 kbps, as the library.
- **Effect loops** (`bastion.drone`, `ricochet.lanternRide`, `alleyroll.rolling`): Joe's 2 s loops already join cleanly,
  so they are only levelled, to the library loops' median -16.8 LUFS (mono 96 kbps). The playing volume in the manifest
  and `loopCue` (0.3, the lantern ride 0.6 × that) is unchanged.
- **Beds:** levelled to the library beds' median -18.45 LUFS (stereo 128 kbps). Three uploads end on a fade
  (`music_alleyroll`, `music_blockfall`, `music_matchup`), which dipped to silence every minute when looped whole; they
  are cut on the bar whose next 4 s best match the bed's opening with a 40 ms crossfade (sound batch 6's music loop,
  `scripts/sound-batch6/process.py`). `music_bastion` and `music_ricochet` end at full level and loop whole.
- **Voice lines:** the same silence trim (10 ms before the first word, 60 ms after the last), levelled to the existing
  voice lines' median -23.8 LUFS (stereo 192 kbps, as `voice.tie`, `voice.youWin`...).

Every loop was checked at its join as `detectLoopPoints` plays it (edges under 0.001 trimmed): the sample step across
each join is below the file's own 99th-percentile step, and the level either side within 2 dB (`music_matchup` and
`music_ricochet` 6–11 dB, where the bed's phrase ends; the matchup and alleyroll/blockfall cuts were chosen by the
spectral match above).

## Every file

Length, sample peak (dBFS) and integrated loudness (LUFS) of Joe's upload, of the first wiring and now. "Under" marks
the effects still short of their length's library median: each of them opens with a cluster of sharp clicks, and lifting
them further under a -1 dBFS peak needs limiting that changes the sound (5–10 dB of it, measured).

| File | Original: length · peak · LUFS | First wiring | Now | Change |
|---|---|---|---|---|
| public/sounds/alleyroll.goldCup.mp3 | 1200 ms · -2.9 · -13.9 | 1200 ms · -5.6 · -26.2 | 1200 ms · -2.0 · -16.5 | re-cut from the original; levelled to -16.5 LUFS |
| public/sounds/alleyroll.gutter.mp3 | 607 ms · -29.1 · -46.8 | 231 ms · -26.7 · -50.1 | 570 ms · -1.1 · -19.4 | restored: the first trim cut it to 231 ms; levelled to -17.1 LUFS; 4.3 dB off its opening spike; **2.3 dB under** (more would need audible limiting) |
| public/sounds/alleyroll.pocket.mp3 | 807 ms · -12.6 · -33.1 | 631 ms · -10.2 · -34.3 | 795 ms · -1.3 · -22.3 | re-cut from the original; levelled to -17.1 LUFS; 4.3 dB off its opening spike; **5.2 dB under** (more would need audible limiting) |
| public/sounds/alleyroll.ramp.mp3 | 487 ms · -5.7 · -27.3 | 480 ms · -48.6 · -70.0 | 480 ms · -1.1 · -20.4 | restored: the first trim cut the attack (peak -5.7 → -48.6 dBFS); levelled to -17.5 LUFS; 3.7 dB off its opening spike; **2.9 dB under** (more would need audible limiting) |
| public/sounds/alleyroll.ring.mp3 | 607 ms · -7.4 · -30.2 | 301 ms · -5.4 · -31.8 | 357 ms · -1.0 · -25.6 | restored: the first trim cut it to 301 ms; levelled to -17.5 LUFS; 3.5 dB off its opening spike; **8.1 dB under** (more would need audible limiting) |
| public/sounds/alleyroll.roll.mp3 | 487 ms · -21.0 · -41.8 | 160 ms · -18.6 · -44.6 | 456 ms · -1.1 · -22.1 | restored: the first trim cut it to 160 ms; levelled to -17.5 LUFS; 3.9 dB off its opening spike; **4.6 dB under** (more would need audible limiting) |
| public/sounds/alleyroll.rolling.mp3 | 2000 ms · -13.3 · -29.0 | 2000 ms · -13.3 · -29.0 | 2000 ms · -1.4 · -16.8 | Joe's 2 s loop unchanged, levelled to -16.8 LUFS, mono |
| public/sounds/alleyroll.streak.mp3 | 687 ms · -3.1 · -13.6 | 680 ms · -2.1 · -25.2 | 679 ms · -2.9 · -17.1 | re-cut from the original; levelled to -17.1 LUFS |
| public/sounds/bastion.baseHit.mp3 | 1000 ms · -5.2 · -23.2 | 999 ms · -4.2 · -27.3 | 997 ms · -1.0 · -16.9 | re-cut from the original; levelled to -16.5 LUFS; 5.8 dB off its opening spike |
| public/sounds/bastion.cannon.mp3 | 807 ms · -4.5 · -22.6 | 800 ms · -5.9 · -28.8 | 800 ms · -1.0 · -17.6 | re-cut from the original; levelled to -17.1 LUFS; 3.9 dB off its opening spike |
| public/sounds/bastion.drone.mp3 | 2000 ms · -21.2 · -37.9 | 2000 ms · -21.2 · -37.9 | 2000 ms · -1.5 · -16.8 | Joe's 2 s loop unchanged, levelled to -16.8 LUFS, mono |
| public/sounds/bastion.droneDown.mp3 | 807 ms · -25.3 · -42.5 | 800 ms · -29.7 · -53.1 | 800 ms · -2.6 · -17.6 | re-cut from the original; levelled to -17.1 LUFS; 1.7 dB off its opening spike |
| public/sounds/bastion.fastReload.mp3 | 487 ms · -0.9 · -21.3 | 332 ms · 1.4 · -22.9 | 367 ms · -1.2 · -21.6 | re-cut from the original; levelled to -17.5 LUFS; 4.8 dB off its opening spike; **4.1 dB under** (more would need audible limiting) |
| public/sounds/bastion.hit.mp3 | 487 ms · -12.3 · -28.7 | 480 ms · -12.8 · -34.8 | 480 ms · -1.3 · -17.7 | re-cut from the original; levelled to -17.5 LUFS; 2.7 dB off its opening spike |
| public/sounds/bastion.jam.mp3 | 607 ms · -1.0 · -20.0 | 551 ms · -28.9 · -52.6 | 566 ms · -1.3 · -17.1 | restored: the first trim cut the attack (peak -1.0 → -28.9 dBFS); levelled to -17.1 LUFS; 7.2 dB off its opening spike |
| public/sounds/bastion.kill.mp3 | 1200 ms · -6.4 · -20.7 | 1200 ms · -7.3 · -29.2 | 1200 ms · -1.4 · -16.5 | re-cut from the original; levelled to -16.5 LUFS; 1.1 dB off its opening spike |
| public/sounds/bastion.loaded.mp3 | 487 ms · -11.0 · -29.9 | 47 ms · -28.6 · -50.7 | 398 ms · -1.1 · -21.3 | restored: the first trim cut the attack (peak -11.0 → -28.6 dBFS); levelled to -17.5 LUFS; 3.6 dB off its opening spike; **3.8 dB under** (more would need audible limiting) |
| public/sounds/bastion.miss.mp3 | 487 ms · -13.7 · -31.4 | 346 ms · -11.4 · -34.1 | 473 ms · -1.1 · -20.1 | re-cut from the original; levelled to -17.5 LUFS; 3.3 dB off its opening spike; **2.6 dB under** (more would need audible limiting) |
| public/sounds/bastion.reload.mp3 | 607 ms · -7.1 · -26.5 | 150 ms · -37.9 · -65.3 | 590 ms · -1.1 · -20.0 | restored: the first trim cut the attack (peak -7.1 → -37.9 dBFS); levelled to -17.1 LUFS; 5.1 dB off its opening spike; **2.9 dB under** (more would need audible limiting) |
| public/sounds/bastion.wave.mp3 | 1360 ms · -30.4 · -41.9 | 1315 ms · -52.2 · -70.0 | 1342 ms · -4.7 · -16.5 | restored: the first trim cut the attack (peak -30.4 → -52.2 dBFS); levelled to -16.5 LUFS |
| public/sounds/bastion.weak.mp3 | 487 ms · -22.7 · -39.9 | 174 ms · -21.1 · -43.6 | 479 ms · -1.3 · -18.0 | restored: the first trim cut it to 174 ms; levelled to -17.5 LUFS; 3.9 dB off its opening spike |
| public/sounds/blockfall.bigClear.mp3 | 1200 ms · -12.4 · -24.7 | 880 ms · -12.0 · -33.5 | 1194 ms · -1.3 · -16.5 | re-cut from the original; levelled to -16.5 LUFS; 0.3 dB off its opening spike |
| public/sounds/blockfall.clear.mp3 | 607 ms · -17.8 · -26.8 | 593 ms · -24.6 · -41.9 | 599 ms · -3.6 · -17.1 | re-cut from the original; levelled to -17.1 LUFS |
| public/sounds/blockfall.lock.mp3 | 487 ms · -11.6 · -33.5 | 458 ms · -13.0 · -36.0 | 477 ms · -1.5 · -20.2 | re-cut from the original; levelled to -17.5 LUFS; 5.6 dB off its opening spike; **2.7 dB under** (more would need audible limiting) |
| public/sounds/blockfall.move.mp3 | 487 ms · -34.2 · -52.3 | 54 ms · -31.8 · -54.4 | 122 ms · -1.7 · -22.7 | restored: the first trim cut it to 54 ms; levelled to -22.7 LUFS |
| public/sounds/blockfall.topOut.mp3 | 1200 ms · -1.5 · -18.4 | 1200 ms · -10.9 · -31.8 | 1200 ms · -1.4 · -16.5 | re-cut from the original; levelled to -16.5 LUFS; 4.6 dB off its opening spike |
| public/sounds/blockfall.turn.mp3 | 487 ms · -31.1 · -47.0 | 155 ms · -28.4 · -49.9 | 216 ms · -3.8 · -22.7 | restored: the first trim cut it to 155 ms; levelled to -22.7 LUFS |
| public/sounds/ricochet.doubleJump.mp3 | 487 ms · -2.4 · -19.9 | 460 ms · -38.0 · -63.6 | 473 ms · -1.3 · -18.5 | restored: the first trim cut the attack (peak -2.4 → -38.0 dBFS); levelled to -17.5 LUFS; 4.1 dB off its opening spike |
| public/sounds/ricochet.flow.mp3 | 687 ms · -9.3 · -22.3 | 683 ms · -22.7 · -41.8 | 685 ms · -5.2 · -17.1 | restored: the first trim cut the attack (peak -9.3 → -22.7 dBFS); levelled to -17.1 LUFS |
| public/sounds/ricochet.hit.mp3 | 487 ms · -1.0 · -14.8 | 479 ms · -0.4 · -21.2 | 476 ms · -1.4 · -17.5 | re-cut from the original; levelled to -17.5 LUFS; 0.4 dB off its opening spike |
| public/sounds/ricochet.land.mp3 | 487 ms · -15.7 · -34.9 | 218 ms · -26.8 · -56.8 | 396 ms · -1.2 · -19.4 | restored: the first trim cut the attack (peak -15.7 → -26.8 dBFS); levelled to -17.5 LUFS; 5.3 dB off its opening spike; **1.9 dB under** (more would need audible limiting) |
| public/sounds/ricochet.lanternGrab.mp3 | 487 ms · -18.6 · -40.1 | 338 ms · -42.5 · -67.8 | 429 ms · -1.0 · -24.4 | restored: the first trim cut the attack (peak -18.6 → -42.5 dBFS); levelled to -17.5 LUFS; 3.6 dB off its opening spike; **6.9 dB under** (more would need audible limiting) |
| public/sounds/ricochet.lanternRide.mp3 | 2000 ms · -25.9 · -40.0 | 2000 ms · -25.9 · -40.0 | 2000 ms · -1.4 · -16.8 | Joe's 2 s loop unchanged, levelled to -16.8 LUFS, mono |
| public/sounds/ricochet.leap.mp3 | 487 ms · -0.7 · -20.8 | 407 ms · -39.9 · -61.5 | 416 ms · -1.1 · -19.0 | restored: the first trim cut the attack (peak -0.7 → -39.9 dBFS); levelled to -17.5 LUFS; 5.3 dB off its opening spike; **1.5 dB under** (more would need audible limiting) |
| public/sounds/ricochet.ledge.mp3 | 487 ms · -29.3 · -51.5 | 42 ms · -27.2 · -50.4 | 479 ms · -1.0 · -22.6 | restored: the first trim cut it to 42 ms; levelled to -17.5 LUFS; 5.1 dB off its opening spike; **5.1 dB under** (more would need audible limiting) |
| public/sounds/ricochet.scroll.mp3 | 607 ms · -30.3 · -47.1 | 470 ms · -37.5 · -57.2 | 592 ms · -1.5 · -17.1 | re-cut from the original; levelled to -17.1 LUFS; 0.5 dB off its opening spike |
| public/sounds/ricochet.slip.mp3 | 607 ms · -12.9 · -30.0 | 233 ms · -16.7 · -37.9 | 593 ms · -1.1 · -17.8 | restored: the first trim cut it to 233 ms; levelled to -17.1 LUFS; 3.7 dB off its opening spike |
| public/sounds/music_alleyroll.mp3 | 60029 ms · -0.2 · -11.4 | 60029 ms · -0.2 · -11.4 | 53609 ms · -6.8 · -18.5 | cut to loop on a matching bar (the upload ends on a fade); turned down to the beds' -18.45 LUFS |
| public/sounds/music_bastion.mp3 | 60029 ms · -1.0 · -14.5 | 60029 ms · -1.0 · -14.5 | 60029 ms · -4.7 · -18.4 | loops whole (no ending fade); turned down to the beds' -18.45 LUFS |
| public/sounds/music_blockfall.mp3 | 60029 ms · -0.3 · -12.1 | 60029 ms · -0.3 · -12.1 | 52870 ms · -6.4 · -18.5 | cut to loop on a matching bar (the upload ends on a fade); turned down to the beds' -18.45 LUFS |
| public/sounds/music_matchup.mp3 | 60029 ms · -0.2 · -13.5 | 60029 ms · -0.2 · -13.5 | 54545 ms · -4.9 · -18.5 | cut to loop on a matching bar (the upload ends on a fade); turned down to the beds' -18.45 LUFS |
| public/sounds/music_ricochet.mp3 | 60029 ms · -1.2 · -14.3 | 60029 ms · -1.2 · -14.3 | 60029 ms · -5.2 · -18.5 | loops whole (no ending fade); turned down to the beds' -18.45 LUFS |
| public/sounds/round10.mp3 | 4754 ms · -10.4 · -23.6 | 2004 ms · -10.5 · -23.6 | 2847 ms · -10.6 · -23.8 | lead silence to 10 ms, tail 60 ms after the last word; levelled to the voice lines' -23.8 LUFS |
| public/sounds/round11.mp3 | 4676 ms · -11.2 · -21.8 | 2173 ms · -11.5 · -22.0 | 3101 ms · -13.3 · -23.8 | lead silence to 10 ms, tail 60 ms after the last word; levelled to the voice lines' -23.8 LUFS |
| public/sounds/round8.mp3 | 4598 ms · -10.9 · -24.0 | 1898 ms · -11.2 · -24.3 | 2788 ms · -10.7 · -23.8 | lead silence to 10 ms, tail 60 ms after the last word; levelled to the voice lines' -23.8 LUFS |
| public/sounds/round9.mp3 | 4676 ms · -11.3 · -22.5 | 2068 ms · -11.7 · -22.8 | 2988 ms · -12.6 · -23.8 | lead silence to 10 ms, tail 60 ms after the last word; levelled to the voice lines' -23.8 LUFS |
| public/sounds/voice.cleanSweep.mp3 | 4676 ms · -12.9 · -23.1 | 2185 ms · -13.2 · -23.1 | 3110 ms · -13.6 · -23.8 | lead silence to 10 ms, tail 60 ms after the last word; levelled to the voice lines' -23.8 LUFS |
| public/sounds/voice.draw.mp3 | 4362 ms · -12.3 · -23.5 | 2039 ms · -12.5 · -23.4 | 2802 ms · -12.7 · -23.8 | lead silence to 10 ms, tail 60 ms after the last word; levelled to the voice lines' -23.8 LUFS |
| public/sounds/voice.newBest.mp3 | 4989 ms · -11.7 · -23.0 | 2453 ms · -12.0 · -23.1 | 3275 ms · -12.7 · -23.8 | lead silence to 10 ms, tail 60 ms after the last word; levelled to the voice lines' -23.8 LUFS |
| public/sounds/voice.newLeader.mp3 | 4441 ms · -11.3 · -22.4 | 1848 ms · -11.5 · -22.6 | 2838 ms · -12.4 · -23.8 | lead silence to 10 ms, tail 60 ms after the last word; levelled to the voice lines' -23.8 LUFS |
| public/sounds/voice.photoFinish.mp3 | 4598 ms · -10.6 · -23.2 | 2143 ms · -10.8 · -23.5 | 3155 ms · -11.1 · -23.8 | lead silence to 10 ms, tail 60 ms after the last word; levelled to the voice lines' -23.8 LUFS |
