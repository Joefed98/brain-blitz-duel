# Sound cues: Joe's recordings for the re-themed games (6 Nov 2026)

Joe's 24 uploads on the `sounds-retheme-nov-2026` branch (commit 293fcf51) for the games re-themed on 3 Nov 2026:
Spacewalk (`cross`), Grappler's jungle canopy (`swing`, swingRev 17), Swish's boardwalk (`bintoss`), Flightpath's darts
stall (`bullseye`), and Slice's chilli and Eagle Eye's eagle. Each file was cut and levelled from the upload by
`python3 -I scripts/sound-retheme-nov-2026/process.py <uploads> public/sounds <report.json>`, which runs
[levels-nov-2026.md](levels-nov-2026.md)'s method (`scripts/sound-nov-2026/process.py`): effects trimmed only of true
digital silence (10 ms kept before the attack), levelled to the library median for their length with peaks at or under
-1 dBFS (the transparent fast limiter on the opening spike only), mono 96 kbps; the two 2 s effect loops left as they
join and levelled to the library loops' -16.8 LUFS; the three 8 s ambience beds and `music_cross` levelled to the beds'
-18.45 LUFS, stereo 128 kbps. Every loop's join was measured clean (the sample step across it under the file's own
99th-percentile step, the level either side within 2 dB), so each loops whole. [mapping-retheme-nov-2026.csv](mapping-retheme-nov-2026.csv)
maps each file to its slot; `sound-retheme-check` proves the files and that every cue fires at its moment in play.

Joe kept his existing sounds for `bullseye.thunk` / `bullseye.bull` (slots `bullseye.thud` and `bullseye.bull`) and
`pipes.flow`: unchanged. With no new file, `swing.pteroCatch` (the library's screech) and `cross.traffic` (the library's
drone loop) are unchanged too.

## Files whose name is not their slot

| Upload (`upload/` = the sounds-retheme-nov-2026 branch) | Slot | Why |
|---|---|---|
| upload/cross.hit.mp3 | `cross.lifeLost` | the astronaut is hit |
| upload/cross.dock.mp3 | `cross.crossed` | a crossing ends at the docking platform |
| upload/cross.comet.mp3 | `cross.pastBikes` | the bikes are drawn as comets (the "Past the comets' plasma lane" moment) |
| upload/cross.pass.mp3 | `cross.pastRoadworks` | a whoosh that swells and falls: through the drifting debris (assumption: Joe may have meant another pass-by) |
| upload/cross.streak.mp3 | `cross.streakUp` | `cross.streak` is the replays' moment cue (replays.md), so the live streak needs its own name |
| upload/swing.grab.mp3 | `swing.vineCreak` | the vine catches |
| upload/swing.ptero.mp3 | `swing.pterodactyl` | the pterodactyl swoops in |

## New slots

- **Spacewalk:** `cross.closeCall` and `cross.streakUp` (on crossRev 9+, in place of `arc_retro_pickup` and
  `arc_fair_sting`), `cross.freighter` (a freighter lane crossed, at most one per 600 ms). `cross.hop` is Joe's jet hop;
  Rainbow Bridge's cloud bounce, which shared Jaywalk's old footstep file, keeps it as `inkbridge.cloudBounce.mp3`.
  `music_cross` is Joe's bed (Top Bins and Crazy Golf already had their own beds).
- **Grappler (swingRev 17 only; every earlier course sounds as before):** `swing.release` (letting go of a vine),
  `swing.land` (landing on a tree platform, never the restart's placing), `swing.gate` (a speed gate lit, in place of
  `swing.assaultGate`'s zap: the moment row carries `when`, `momentCues.ts`), `swing.streak` (each block of the
  clean-swing streak paid), and two effect loops: `swing.wings` while the pterodactyl chases and `swing.slideVine` while a
  sliding vine still slides on screen.
- **Swish:** `bintoss.wind` (a gust as each windy throw comes into hand).
- **Slice:** `slice.chilli` (a chilli launched on sliceRev 12's food board, in place of `slice.fuse`).
- **Eagle Eye:** `symscan.eagle` (an eagle's cry with the take-off).

## Ambience beds

`swing.jungle` (silent until now), `bintoss.ambience` and `bullseye.ambience` start with the round's live run and fade
out over 500 ms when it ends or the stage unmounts (`ambienceCue` in `gameSounds.ts`). They play on the effects channel
(its volume and mute) at 0.3 and are held off while the music is muted or at zero, so either setting silences them; never
in an intro demo.

## Every file

Length, sample peak (dBFS) and integrated loudness (LUFS, `scripts/sound-nov-2026/measure.py`) of Joe's upload and now,
and what `sound-retheme-check` saw in play (the skill-band bots through the sim with the real observer). "Under" marks
the ones still short of their target: lifting them further under a -1 dBFS peak needs limiting that changes the sound.

| Upload | Slot | Upload: length · peak · LUFS | Now | Change | Fires |
|---|---|---|---|---|---|
| upload/bintoss.ambience.mp3 | `bintoss.ambience` | 8000 ms · -21.5 · -35.7 | 8000 ms · -4.3 · -18.5 | 8 s ambience bed, loops whole (clean join), levelled to the beds' -18.45 LUFS, stereo | yes: ambience bed for the whole live run (12 of 12) |
| upload/bintoss.wind.mp3 | `bintoss.wind` | 807 ms · -30.3 · -42.8 | 800 ms · -1.9 · -17.1 | effect, levelled to -17.1 LUFS | yes: each windy throw coming into hand (120 = 120) |
| upload/bullseye.ambience.mp3 | `bullseye.ambience` | 8000 ms · -21.6 · -34.3 | 8000 ms · -5.7 · -18.4 | 8 s ambience bed, loops whole (clean join), levelled to the beds' -18.45 LUFS, stereo | yes: ambience bed for the whole live run (4 of 4) |
| upload/cross.closeCall.mp3 | `cross.closeCall` | 487 ms · -2.4 · -22.3 | 223 ms · -1.2 · -23.0 | effect, levelled to -22.7 LUFS; 1.7 dB off its opening spike | yes: every close call (41 = 41) |
| upload/cross.comet.mp3 | `cross.pastBikes` | 487 ms · -9.8 · -25.5 | 480 ms · -1.2 · -17.5 | effect, levelled to -17.5 LUFS; 0.2 dB off its opening spike | yes: past a comet lane (44 plays) |
| upload/cross.dock.mp3 | `cross.crossed` | 607 ms · -1.0 · -16.4 | 607 ms · -1.5 · -17.1 | effect, levelled to -17.1 LUFS; 2.6 dB off its opening spike | yes: every crossing docked (74 = 74) |
| upload/cross.freighter.mp3 | `cross.freighter` | 1360 ms · -16.2 · -27.7 | 1350 ms · -1.9 · -16.5 | effect, levelled to -16.5 LUFS | yes: a freighter lane crossed (72 plays, capped 1 per 600 ms) |
| upload/cross.hit.mp3 | `cross.lifeLost` | 487 ms · -7.5 · -23.4 | 350 ms · -1.2 · -18.5 | effect, levelled to -17.5 LUFS; 1.6 dB off its opening spike; **1.0 dB under** (more would need audible limiting) | yes: every hit (25 plays = 25 hits) |
| upload/cross.hop.mp3 | `cross.hop` | 487 ms · -1.3 · -21.2 | 487 ms · -1.2 · -17.5 | effect, levelled to -17.5 LUFS; 5.5 dB off its opening spike | yes: every hop or side-step (capped 1 per 90 ms; 3,109 plays in 18 bot runs) |
| upload/cross.pass.mp3 | `cross.pastRoadworks` | 487 ms · -6.1 · -21.3 | 464 ms · -2.5 · -17.5 | effect, levelled to -17.5 LUFS | yes: through the debris (28 plays) |
| upload/cross.streak.mp3 | `cross.streakUp` | 607 ms · -1.1 · -15.0 | 607 ms · -1.2 · -17.1 | effect, levelled to -17.1 LUFS; 1.1 dB off its opening spike | yes: every streak rise (18 = 18) |
| upload/music_cross.mp3 | `music_cross` | 60029 ms · -0.2 · -12.3 | 60029 ms · -6.3 · -18.5 | bed, loops whole (no ending fade), turned down to the beds' -18.45 LUFS | yes: Spacewalk's round bed, looping |
| upload/slice.chilli.mp3 | `slice.chilli` | 487 ms · -18.5 · -32.3 | 485 ms · -1.1 · -17.9 | effect, levelled to -17.5 LUFS; 0.7 dB off its opening spike | yes: a chilli launched on sliceRev 12 (32 plays, capped 1 per 150 ms) |
| upload/swing.gate.mp3 | `swing.gate` | 487 ms · -11.9 · -28.1 | 479 ms · -1.8 · -18.1 | effect, levelled to -17.5 LUFS; 0.6 dB off its opening spike; **0.6 dB under** (more would need audible limiting) | yes: every gate lit on swingRev 17 (17 = 17); swingRev 16 keeps the zap |
| upload/swing.grab.mp3 | `swing.vineCreak` | 487 ms · -19.7 · -38.5 | 480 ms · -1.1 · -19.2 | effect, levelled to -17.5 LUFS; 5.6 dB off its opening spike; **1.7 dB under** (more would need audible limiting) | yes: every vine grab (727 = 727) |
| upload/swing.jungle.mp3 | `swing.jungle` | 8000 ms · -29.0 · -42.3 | 8000 ms · -5.1 · -18.5 | 8 s ambience bed, loops whole (clean join), levelled to the beds' -18.45 LUFS, stereo | yes: ambience bed for the whole live run (6 of 6 runs) |
| upload/swing.land.mp3 | `swing.land` | 487 ms · -11.6 · -30.7 | 485 ms · -1.1 · -18.9 | effect, levelled to -17.5 LUFS; 4.5 dB off its opening spike; **1.4 dB under** (more would need audible limiting) | yes: every platform landing (96 = 96) |
| upload/swing.ptero.mp3 | `swing.pterodactyl` | 1200 ms · -18.1 · -28.3 | 1198 ms · -3.3 · -16.5 | effect, levelled to -16.5 LUFS | yes: the pterodactyl swooping in (3 = 3) |
| upload/swing.release.mp3 | `swing.release` | 487 ms · -11.5 · -24.6 | 480 ms · -1.7 · -17.6 | effect, levelled to -17.5 LUFS | yes: every let-go (742 plays, capped 1 per 90 ms) |
| upload/swing.slideVine.mp3 | `swing.slideVine` | 2000 ms · -23.4 · -47.8 | 2000 ms · -1.2 · -20.6 | 2 s loop untouched, levelled to -16.8 LUFS, mono; 9.0 dB off its peaks; **3.8 dB under** (more would need audible limiting) | yes: loops while a sliding vine slides on screen (6 of 6 runs) |
| upload/swing.splash.mp3 | `swing.splash` | 887 ms · -18.2 · -31.4 | 880 ms · -1.7 · -17.1 | effect, levelled to -17.1 LUFS; 1.0 dB off its opening spike | yes: every miss into the river (15 = 15) |
| upload/swing.streak.mp3 | `swing.streak` | 607 ms · -3.0 · -14.6 | 600 ms · -3.2 · -17.2 | effect, levelled to -17.1 LUFS | yes: every streak block (80 = 80) |
| upload/swing.wings.mp3 | `swing.wings` | 2000 ms · -5.9 · -29.9 | 2000 ms · -1.0 · -23.0 | 2 s loop untouched, levelled to -16.8 LUFS, mono; 4.1 dB off its peaks; **6.2 dB under** (more would need audible limiting) | yes: loops exactly while the pterodactyl chases (2 of 6 runs reached it) |
| upload/symscan.eagle.mp3 | `symscan.eagle` | 807 ms · -16.5 · -23.5 | 807 ms · -7.4 · -17.1 | effect, levelled to -17.1 LUFS | yes: with the eagles' take-off |
