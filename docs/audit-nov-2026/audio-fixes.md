# Audio audit fixes (7 Nov 2026)

The file fixes and the app-side gapless fix from the audio audit (`docs/audit-nov-2026/audio.md`, its ranked fixes 1–4,
6–8 and 10's `music_menu`), for the 355 files in `public/sounds/` only. The 135 Lovable-hosted files (`/__l5e/…`) are
being copied into the repo in another PR and get their own pass afterwards. Same file names, same slots; nothing about
which sound plays when changed. Presentation only, no stamps.

**205 files changed.** Made by `scripts/sound-audit-nov-2026/fix.py` from the files on main cc8e1643 (deterministic: a
re-run gives the same bytes), measured before and after by `scripts/sound-audit-nov-2026/measure.py` (the audit's own
measures, which reproduce its figures: the same 20 files over 0 dBFS, the same 40 cut tails, the same 170 stereo
effects), table by `table.py`. Nothing was heard: Joe does the listening (below).

## Results

| | Before | After |
|---|---|---|
| Effect loops ticking at the join (`swing.lava`, `wavefront.danger`, `racing_idle_loop`) | step ×1.36–1.48 or slope ×2.5–5.8 | step ≤ ×0.55, slope ≤ ×0.50 (each under its own file's 99th-percentile sample step) |
| `curling_sweep_loop` pulse at the join | −5.2 dB over 400 ms | 0.0 dB |
| Beds stepping up at the join (400 ms) | `music_ricochet` +7.7, `music_cross` +4.8, `music_pool` +4.1, `music_matchup` +2.4 dB | +6.4, +0.8, +2.5, −0.5 dB: each at or under its own median bar line (+6.7, +2.6, +2.7, +0.5) |
| Files over 0 dBFS true peak | 20 | 0 (every changed file is at −1 dBFS or under) |
| Effects ending while still sounding | 40 (last sample up to −9 dBFS) | 0 end on a step: the last sample is −41 dBFS or quieter (most under −60) |
| Loudness outliers (effects > 3 dB off, beds, loops and voices > 2 dB, file and as played both) | 104 | 31 (below) |
| Stereo one-shot effects | 170 | 68 (102 made mono) |
| Decoded memory of the first-tap preload (48 kHz) | 91.8 MiB | 80.0 MiB (−11.7) |
| Download, `public/sounds/` | 22.3 MiB | 21.3 MiB |

## What was done

1. **Effect loop joins** (fix 4). `swing.lava`, `wavefront.danger`, `racing_idle_loop` and `curling_sweep_loop`: the
   loop's end crossfades (equal power, 37–45 ms; `curling_sweep_loop` 246 ms) into its own opening at the cut whose end
   best matches the opening, and the file starts just after the crossfade, so it wraps from one recorded sample into the
   next. `curling_sweep_loop`'s cut is the one whose last 0.4 s matches the opening's level (the 5 dB step); it is now
   1.01 s (was 1.51). The other three are 50–99 ms shorter. Manifest `ms` updated for the four slots.
2. **Encoding loops so the join survives MP3.** A plain MP3 encode treats each end of the file as silence, which put a
   new tick at every join (re-encoding `swing.lava` as it was gave slope ×2.8). Every loop and bed written is encoded
   with one frame (1,152 samples) of its own wrap-around audio either side, and the LAME tag's delay and padding are
   widened by that much (its CRC recomputed), so a gapless decoder drops them and the encoder saw the real waveform
   across the join. The app's own trim (below) reads the same numbers, so this holds on every browser.
3. **Bed joins** (fix 8). `music_ricochet`, `music_cross`, `music_pool`, `music_matchup`: the last bar crossfades into
   the first, one bar long (2.40, 1.92, 2.73, 1.82 s: each bed's bar from its onset autocorrelation, checked against
   its loop length in whole bars), so the beat stays on the grid and the lift into the opening becomes a one-bar swell.
   Each bed is a bar shorter and starts on its second bar. `music_ricochet`'s +7.7 dB turned out to be its ordinary
   downbeat (every bar line in it lifts +6.7 dB at the median), so it changes least.
4. **True peaks** (fix 2). Every file written ends at −1 dBFS true peak or under (ebur128, 4× oversampled), by plain
   gain; where that would take more than 0.5 dB off a file that isn't an outlier, the transparent limiter below holds
   its level instead, whichever lands closer. The 20 files over 0 dBFS: the loud ones went to target (the `retro.*`,
   `banner.*`, `speed.up`, `snake.rockFalling`, `swing.dragonNear`, `clay.launch`, `arrow.whoosh`, `signals.ruleChange`,
   `cave.lavaErupt`, now −16.5 to −17.6 LUFS from −3.8 to −13.9); `retro.enemyFire` (+8.6 dB as a file but played at
   `volume` 0.5, so on target as played) and `countup.countersTick`, `sky.gust`, `cave.stoneCrack` only lost their overs;
   `block.place` lost 1.5 dB with them (−20.0 → −21.5, now 4.0 under its target).
5. **Cut-off tails** (fix 3). The 40 effects whose last 10 ms were above −40 dBFS fade out over their last 30 ms (a
   quarter of the file at most), cos⁴ so the very end is near silence; 10 ms where the sound is still within 6 dB of its
   peak in those 30 ms (a charge or hit that ends on its climax: `sfx_logo_charge`, `cross.hop`, `bastion.jam`, …), so
   the climax isn't faded away. Nothing is trimmed and the file keeps its loudness. Eighteen still read above −40 dBFS
   over their last 10 ms (they are loud right to the end and the fade is that 10 ms), but all now end on near silence.
   Restoring real tails from the originals (the audit's other option for `cross.*`, `bastion.*`, `ricochet.flow`,
   `blockfall.topOut`) was not done.
6. **Loudness** (fixes 6, 2 and 10). Targets from `levels-nov-2026.md`: effects by length −22.7 / −17.5 / −17.1 / −16.5
   LUFS, effect loops −16.8, beds −18.45, voices −23.8, measured as the audit does. An outlier is more than 3 dB off
   (effects) or 2 dB (beds, loops, voices) both as the file and as its slots play it (plus 20 log₁₀ of the slots' median
   `volume`), so a hot file a slot turns down on purpose is left alone (`bonk.popUp` at 0.35, `retro.enemyFire` at 0.5,
   `gem.pick` at 0.6), while `beat.note8bit`, whose 0.8 doesn't cover it, went to target. 99 files levelled: the loud ones by gain, the
   quiet ones by gain and, where the peak stops it, `process.py`'s fast limiter only while it stays transparent (what
   it shaves at least 14 dB under the sound; 59 files with those held at their level in 4, 0.3–7.5 dB of peak shaved). A quiet file lifted more than 6 dB
   has what was under −60 dBFS after its last sound faded out, so its noise floor isn't lifted with it (`ui.select`,
   `inkbridge.cloudBounce`, …). `music_menu` +2.1 dB to −18.4. Not touched on purpose: `clay.missPuff` (−48 LUFS, probably
   meant faint: Joe to confirm) and `music_beat` (lifted in code, `BEAT_TRACK_BOOST`).
7. **Mono** (fix 7). Stereo one-shot effects whose side channel is at least 15 dB under the mid were made mono, 44.1
   kHz 96 kbps: 102 of 170. Collapsing them changes the level as played by under 0.15 dB and their image was already
   near the centre. The other 68 are wider (side −14.8 dB to +13.8 dB over the mid) and stay stereo, so the saving is
   11.7 MiB of the ~20 MiB the audit counted for all 170; turning those 68 mono would be audible on headphones
   (`room.winner.lock`, `gem.pick` and `room.prepare` are mostly side). Loops, ambience, beds and voices stay stereo.
   Web Audio plays a mono buffer on both speakers at full level, so a file made mono is measured as two identical
   channels (its plain ebur128 reading is 3.0 dB lower; the table's "as played" column adds it back).
8. **Formats** otherwise stay as they were (rate, channels, bitrate), so the batch checks' rules hold.

### Still outside the targets (31)

- Limited by the limiter staying transparent (click-heavy sounds whose loudness sits in one spike, as in
  `levels-nov-2026.md`), lifted part of the way: `cards_shuffle` −13.5 → −8.6 dB from target, `mahjong_shuffle`
  −16.2 → −11.1, `minigolf_putt` −11.0 → −10.3, `minigolf_cup` −12.1 → −9.5, `cards_home` −11.6 → −9.2,
  `minigolf_stone` −11.1 → −9.0, `freecell_cascade` −13.0 → −8.9, `inkbridge.cloudBounce` −24.9 → −8.3, `minigolf_rail`
  −8.6 → −7.6, `gem.refuse` −9.3 → −7.5, `curling_board` −9.7 → −7.1, `curling_hit` −8.6 → −6.9, `cards_place` −8.6 →
  −6.7, `pool_cue_hard` −8.7 → −6.2, `ricochet.lanternGrab` −6.9 → −5.5, `alleyroll.ring` −8.1 → −5.5, `homerun_foul`
  −7.6 → −5.1, `ui.select` −22.1 → −5.1, `safe.dialClick` −8.9 → −4.9, `ricochet.ledge` −5.1 → −4.8, `mines_cascade`
  −4.2 → −3.8, `swing.wings` −6.2 → −3.8 (a loop), `mahjong_match` −6.3 → −3.7, `mines_hit` −9.9 → −3.7,
  `wordslide.finish` −3.4 → −3.2. Further would need a slot `volume` above 1 (not allowed) or a heavier limiter.
- Left as they were (a lift was their only change and their peak, already at the limit, plus the re-encode would have
  made them quieter): `minigolf_splash` −5.8, `bastion.fastReload` −4.1, `bastion.loaded` −3.8.
- `block.place` −4.0 (over 0 dBFS before; see 4), `clay.missPuff` and `music_beat` (excluded, see 6).

### Not in this PR

The audit's other fixes: fix 5 (fade before stopping a retriggered cue, `sound.ts`), the 2 ms fade-in on the 92 effects
that start at full level, fix 9 (long silent tails and the older voice lines' 64–112 ms leads), fix 11 (the
Lovable-hosted files) and fix 12 (ducking, Joe's call). `minigolf_splash`, `bastion.fastReload` and `bastion.loaded`
could reach their targets from the original uploads (they peak at −1 dBFS as levelled).

## The app: trimming by the MP3 header (fix 1)

`src/lib/mp3Gapless.ts`, used by `decodeExact` in `src/lib/sound.ts` (the one place the app decodes audio: the first-tap
preload and every bed). Before decoding, the file's Info frame is read: frame count, the LAME/Lavc tag's encoder delay
and padding. After decoding, if the buffer is the exact length the browser honoured the tag and it is used as is; if
it is the whole decode (with or without the decoder's 529 samples, with or without the Info frame decoded as a silent
frame, at the file's rate or resampled), it is cut to exactly the sound, so effects start on time and loops have no
gap whether or not the browser reads the tag. Any other length is left as decoded. One of our own files decoded
exactly loops whole (the -60 dB edge trim is no longer applied to it, so `music_bastion` and friends no longer lose
their first 7–8 ms each pass); the hosted library and anything not placed keep the edge trim. With `?dev=1` the
console says once what the browser did (`[sound] MP3 gapless tag: honoured` or `trimmed`). Proved by
`mp3-gapless-check` (no browser).

**Phone test for Joe** (iPhone Safari, with Safari's Web Inspector on a Mac; paste into the console on joulz.uk):

```js
new AudioContext().decodeAudioData(await (await fetch('/sounds/blockfall.lock.mp3')).arrayBuffer()).then(b => alert(b.duration))
```

0.4766 means Safari honours the header (the app's trim is insurance); anything over 0.48 (about 0.52) means it keeps the
priming and the app's trim is what fixes it. (`blockfall.lock.mp3` is unchanged by this PR.)

## Checks

`mp3-gapless-check` (new: every file's tag, its CRC and frame count read two ways, loop lengths against the manifest,
the trim on every decoder behaviour at 44.1 and 48 kHz, and the wiring). `sound-retheme-check` pins
`inkbridge.cloudBounce.mp3` to the levelled bytes of the old footstep (its old pin, the original's SHA-256, is kept as
the source). sound-manifest-check, sound-batch6-check, sound-nov-2026-check, replay-sound-check, sound-controls-check,
sound-settings-check, offline-media-refresh-check and ci-shards-check pass unchanged. No browser test was run.

To re-run (originals in a folder, the manifest's slots as JSON; see the scripts' docstrings):
`bun scripts/sound-audit-nov-2026/slots.ts > slots.json`, `LOOPS=<the loop files> python3 -I scripts/sound-audit-nov-2026/measure.py before.json <originals>/*.mp3`, then
`python3 -I scripts/sound-audit-nov-2026/fix.py <originals> <out> slots.json before.json report.json`.

## Every file changed

Loudness "as played": a mono file's reading plus 3.0 dB when it was stereo before (see 7). Last 10 ms: RMS of the
loudest channel; last sample: the file's final sample. Loop join as in the audit: the sample step and the slope break
across the join against the file's own 99th-percentile step, and the level change into the join over 50 ms / 400 ms.

| File | Changes | Format | Length ms | True peak dBFS | LUFS as played | Last 10 ms / last sample dBFS | Loop join (step ×, slope ×, level 50 / 400 ms) | Decoded KB at 48 kHz |
|---|---|---|---|---|---|---|---|---|
| alert.newHazard.mp3 | mono (side -22.2 dB) | 48k st 192 → 44.1k mo 96 | 606 → 607 | -2.1 → -2.3 | -15.3 → -15.3 | -62 / -89 → -68 / -98 |  | 227 → 114 |
| alleyroll.goldCup.mp3 | tail fade 30 ms | 44.1k mo 96 | 1200 | -1.9 → -1.9 | -16.5 → -16.5 | -27 / -22 → -65 / -166 |  | 225 → 225 |
| alleyroll.gutter.mp3 | tail fade 30 ms | 44.1k mo 96 | 570 | -1.0 → -1.0 | -19.4 → -19.4 | -33 / -76 → -60 / -106 |  | 107 → 107 |
| alleyroll.pocket.mp3 | to target -17.1; limiter 4.0 dB | 44.1k mo 96 | 795 | -1.3 → -1.0 | -22.3 → -19.6 | -65 / -92 → -61 / -108 |  | 149 → 149 |
| alleyroll.ring.mp3 | to target -17.5; limiter 3.7 dB | 44.1k mo 96 | 357 | -1.0 → -1.0 | -25.6 → -23.0 | -60 / -102 → -56 / -90 |  | 67 → 67 |
| alleyroll.roll.mp3 | to target -17.5; limiter 3.4 dB | 44.1k mo 96 | 456 | -1.0 → -1.1 | -22.1 → -20.2 | -55 / -79 → -52 / -72 |  | 86 → 86 |
| arcade.wallThock.mp3 | tail fade 15 ms; mono (side -35.6 dB) | 48k st 192 → 44.1k mo 96 | 60 | -1.2 → -1.2 | -24.7 → -24.6 | -37 / -70 → -45 / -68 |  | 22 → 11 |
| arrow.whoosh.mp3 | to target -17.5; true peak over 0 | 48k st 192 | 486 | +1.1 → -3.2 | -12.7 → -17.5 | -73 / -100 → -78 / -106 |  | 182 → 182 |
| balance.level.mp3 | limiter 1.2 dB; mono (side -25.1 dB) | 48k st 192 → 44.1k mo 96 | 806 → 807 | -0.4 → -1.2 | -17.8 → -18.4 | -43 / -99 → -43 / -84 |  | 302 → 151 |
| balltrack.homeStreak.mp3 | mono (side -25.9 dB) | 48k st 192 → 44.1k mo 96 | 479 | -1.0 → -1.3 | -17.7 → -17.7 | -96 / -127 → -97 / -126 |  | 180 → 90 |
| banner.clear.mp3 | to target -17.1; true peak over 0 | 48k st 192 | 686 | +1.1 → -7.9 | -8.0 → -17.1 | -55 / -85 → -64 / -94 |  | 257 → 257 |
| banner.combo.mp3 | to target -17.1; true peak over 0; mono (side -22.9 dB) | 48k st 192 → 44.1k mo 96 | 606 → 607 | +0.8 → -6.3 | -10.2 → -17.1 | -57 / -82 → -64 / -89 |  | 227 → 114 |
| banner.fullClear.mp3 | to target -17.1; true peak over 0 | 48k st 192 | 806 | +0.5 → -6.3 | -10.5 → -17.1 | -47 / -82 → -53 / -90 |  | 302 → 302 |
| banner.streak.mp3 | to target -17.5; true peak over 0 | 48k st 192 | 486 | +1.0 → -6.8 | -9.7 → -17.4 | -56 / -77 → -64 / -86 |  | 182 → 182 |
| bastion.cannon.mp3 | tail fade 30 ms | 44.1k mo 96 | 800 | -1.0 → -1.2 | -17.6 → -17.8 | -38 / -102 → -65 / -103 |  | 150 → 150 |
| bastion.droneDown.mp3 | tail fade 30 ms | 44.1k mo 96 | 800 | -0.8 → -1.2 | -17.6 → -17.7 | -35 / -77 → -49 / -65 |  | 150 → 150 |
| bastion.jam.mp3 | tail fade 10 ms | 44.1k mo 96 | 566 | -1.3 → -1.2 | -17.1 → -17.3 | -13 / -49 → -16 / -73 |  | 106 → 106 |
| bastion.kill.mp3 | tail fade 30 ms | 44.1k mo 96 | 1200 | -1.4 → -1.4 | -16.5 → -16.5 | -32 / -30 → -76 / -112 |  | 225 → 225 |
| bastion.wave.mp3 | tail fade 10 ms | 44.1k mo 96 | 1342 | -4.7 → -4.7 | -16.5 → -16.5 | -17 / -13 → -28 / -63 |  | 252 → 252 |
| beat.miss.mp3 | mono (side -37 dB) | 48k st 192 → 44.1k mo 96 | 150 | -1.3 → -1.3 | -18.0 → -18.0 | -43 / -124 → -44 / -122 |  | 56 → 28 |
| beat.note8bit.mp3 | to target -22.7; tail fade 30 ms; mono (side -188.2 dB) | 48k st 192 → 44.1k mo 96 | 140 | -2.0 → -11.0 | -13.6 → -22.7 | -27 / -28 → -69 / -90 |  | 53 → 26 |
| beat.swipe.mp3 | to target -22.7 | 48k st 192 | 200 | -2.4 → -9.7 | -15.4 → -22.7 | -80 / -112 → -87 / -118 |  | 75 → 75 |
| bintoss.wind.mp3 | tail fade 30 ms | 44.1k mo 96 | 800 | -1.8 → -1.5 | -17.1 → -17.1 | -24 / -86 → -51 / -84 |  | 150 → 150 |
| block.place.mp3 | true peak over 0 | 48k st 192 | 486 | +0.7 → -1.1 | -20.0 → -21.5 | -72 / -88 → -74 / -90 |  | 182 → 182 |
| blockfall.topOut.mp3 | tail fade 10 ms | 44.1k mo 96 | 1200 | -1.4 → -4.4 | -16.5 → -16.5 | -10 / -12 → -22 / -62 |  | 225 → 225 |
| bomb.cut.mp3 | mono (side -24.4 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -0.8 → -1.1 | -16.2 → -16.9 | -52 / -78 → -59 / -97 |  | 182 → 91 |
| bomb.defuse.mp3 | mono (side -25 dB) | 48k st 192 → 44.1k mo 96 | 606 → 607 | -3.2 → -3.1 | -16.2 → -16.2 | -52 / -65 → -55 / -70 |  | 227 → 114 |
| bomb.solve.mp3 | mono (side -32.2 dB) | 48k st 192 → 44.1k mo 96 | 686 → 687 | -6.6 → -6.6 | -16.3 → -16.3 | -50 / -120 → -56 / -102 |  | 257 → 129 |
| bonk.popUp.mp3 | mono (side -34.7 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -0.0 → -1.0 | -8.4 → -9.3 | -42 / -73 → -44 / -76 |  | 182 → 91 |
| breaker.rowClear.mp3 | mono (side -17.2 dB) | 48k st 192 → 44.1k mo 96 | 680 | -4.0 → -4.3 | -17.1 → -17.1 | -93 / -141 → -95 / -132 |  | 255 → 128 |
| breaker.tenBricks.mp3 | mono (side -27 dB) | 48k st 192 → 44.1k mo 96 | 450 | -11.5 → -11.5 | -17.1 → -17.1 | -100 / -136 → -101 / -144 |  | 169 → 84 |
| bubble.joker.mp3 | mono (side -28.2 dB) | 48k st 192 → 44.1k mo 96 | 680 | -1.2 → -1.1 | -16.3 → -16.3 | -112 / -142 → -113 / -148 |  | 255 → 128 |
| bubble.rush.mp3 | mono (side -31 dB) | 48k st 192 → 44.1k mo 96 | 886 → 887 | -2.6 → -2.6 | -16.3 → -16.3 | -65 / -111 → -66 / -107 |  | 332 → 166 |
| bubble.torpedo.mp3 | mono (side -30.3 dB) | 48k st 192 → 44.1k mo 96 | 600 | -3.1 → -3.1 | -17.0 → -17.0 | -109 / -133 → -111 / -150 |  | 225 → 112 |
| burst.atomsDrop.mp3 | mono (side -33.1 dB) | 48k st 192 → 44.1k mo 96 | 450 | -6.6 → -6.7 | -16.3 → -16.3 | -92 / -148 → -93 / -148 |  | 169 → 84 |
| burst.waveCleared.mp3 | mono (side -19.2 dB) | 48k st 192 → 44.1k mo 96 | 686 → 687 | -8.9 → -9.3 | -17.5 → -17.5 | -52 / -98 → -53 / -78 |  | 257 → 129 |
| cards_home.mp3 | to target -17.5; limiter 4.1 dB | 44.1k mo 96 | 406 | -1.5 → -1.1 | -29.1 → -26.7 | -116 / -136 → -112 / -126 |  | 76 → 76 |
| cards_invalid.mp3 | to target -17.5; limiter 4.8 dB; lifted floor faded (1 ms) | 44.1k mo 96 | 434 | -6.8 → -1.0 | -28.8 → -18.7 | -47 / -68 → -36 / -85 |  | 81 → 81 |
| cards_place.mp3 | to target -17.5; limiter 4.1 dB | 44.1k mo 96 | 300 | -1.3 → -1.3 | -26.1 → -24.2 | -73 / -105 → -70 / -95 |  | 56 → 56 |
| cards_shuffle.mp3 | to target -16.5; limiter 6.1 dB | 44.1k mo 96 | 1093 | -1.3 → -1.1 | -30.0 → -25.1 | -83 / -100 → -78 / -90 |  | 205 → 205 |
| cave.lavaBubble.mp3 | mono (side -31.3 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -1.6 → -1.7 | -17.2 → -17.2 | -54 / -78 → -56 / -82 |  | 182 → 91 |
| cave.lavaErupt.mp3 | to target -17.5; true peak over 0; tail fade 30 ms | 48k st 192 | 486 | +0.3 → -3.5 | -13.6 → -17.6 | -34 / -36 → -71 / -117 |  | 182 → 182 |
| cave.rockCrumble.mp3 | to target -17.5; limiter 4.9 dB; lifted floor faded (6 ms); mono (side -18.8 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -6.3 → -1.0 | -27.6 → -19.0 | -60 / -77 → -56 / -88 |  | 182 → 91 |
| cave.stoneCrack.mp3 | to target -17.5; true peak over 0; limiter 4.5 dB | 48k st 192 | 486 | +0.3 → -1.1 | -22.0 → -20.0 | -68 / -86 → -66 / -83 |  | 182 → 182 |
| chain.breakTone.mp3 | mono (side -19.6 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -2.9 → -3.0 | -16.4 → -16.3 | -58 / -77 → -58 / -77 |  | 182 → 91 |
| chain.linkTone.mp3 | tail fade 30 ms | 48k st 192 | 486 | -2.2 → -2.3 | -16.2 → -16.2 | -30 / -54 → -61 / -98 |  | 182 → 182 |
| checkout.thud.mp3 | tail fade 30 ms; mono (side -20.3 dB) | 48k st 192 → 44.1k mo 96 | 606 → 607 | -0.2 → -2.0 | -18.6 → -18.6 | -34 / -60 → -66 / -94 |  | 227 → 114 |
| clay.launch.mp3 | to target -17.5; true peak over 0; mono (side -22.8 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | +1.2 → -4.1 | -12.4 → -17.5 | -75 / -114 → -81 / -109 |  | 182 → 91 |
| clay.missPuff.mp3 | mono (side -30.6 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -31.2 → -31.4 | -48.3 → -48.3 | -75 / -95 → -76 / -99 |  | 182 → 91 |
| clayshoot.birdIn.mp3 | to target -17.5; limiter 3.0 dB; lifted floor faded (92 ms); mono (side -28.7 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -8.8 → -1.4 | -27.1 → -17.5 | -76 / -92 → -200 / -240 |  | 182 → 91 |
| clayshoot.finalBurst.mp3 | mono (side -26.8 dB) | 48k st 192 → 44.1k mo 96 | 1080 | -3.1 → -3.3 | -16.4 → -16.4 | -59 / -80 → -65 / -99 |  | 405 → 202 |
| combo.lost.mp3 | to target -17.5; mono (side -22.6 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -0.5 → -5.4 | -12.8 → -17.5 | -42 / -63 → -47 / -72 |  | 182 → 91 |
| countup.countersTick.mp3 | true peak over 0; tail fade 30 ms; mono (side -20.1 dB) | 48k st 192 → 44.1k mo 96 | 1000 | +0.1 → -1.2 | -16.5 → -16.5 | -26 / -55 → -58 / -89 |  | 375 → 188 |
| cross.crossed.mp3 | tail fade 10 ms | 44.1k mo 96 | 607 | -1.3 → -4.0 | -17.1 → -17.1 | -13 / -49 → -16 / -59 |  | 114 → 114 |
| cross.freighter.mp3 | tail fade 30 ms | 44.1k mo 96 | 1350 | -1.9 → -2.0 | -16.5 → -16.5 | -22 / -15 → -64 / -120 |  | 253 → 253 |
| cross.hop.mp3 | tail fade 10 ms | 44.1k mo 96 | 487 | -1.2 → -2.2 | -17.5 → -17.5 | -9 / -25 → -10 / -41 |  | 91 → 91 |
| cross.streakUp.mp3 | tail fade 10 ms | 44.1k mo 96 | 607 | -1.2 → -2.9 | -17.1 → -17.1 | -14 / -48 → -16 / -52 |  | 114 → 114 |
| cups.shuffle.mp3 | mono (side -23.5 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -3.6 → -3.9 | -19.9 → -19.9 | -64 / -82 → -65 / -91 |  | 182 → 91 |
| curling_board.mp3 | to target -17.5; limiter 3.8 dB | 44.1k mo 96 | 400 | -1.4 → -1.3 | -27.2 → -24.6 | -82 / -136 → -78 / -119 |  | 75 → 75 |
| curling_hit.mp3 | to target -17.5; limiter 3.3 dB | 44.1k mo 96 | 400 | -1.3 → -1.0 | -26.1 → -24.4 | -60 / -108 → -56 / -123 |  | 75 → 75 |
| curling_slide_loop.mp3 | to target -16.8; limiter 4.1 dB | 44.1k mo 96 | 2177 | -1.4 → -1.3 | -20.1 → -16.8 | -24 / -52 → -20 / -24 | 0.08, 0.37, +2.7 / +2.1 → 0.20, 0.10, +2.7 / +1.9 | 408 → 408 |
| curling_sweep_loop.mp3 | loop re-cut (246 ms crossfade) | 44.1k mo 96 | 1508 → 1013 | -1.6 → -3.3 | -16.3 → -16.3 | -30 / -44 → -36 / -54 | 0.05, 0.10, -3.7 / -5.2 → 0.00, 0.00, +1.7 / -0.0 | 283 → 190 |
| done.chimeSweep.mp3 | mono (side -29 dB) | 48k st 192 → 44.1k mo 96 | 1000 | -7.7 → -7.8 | -16.3 → -16.4 | -67 / -82 → -69 / -84 |  | 375 → 188 |
| done.corks.mp3 | mono (side -36.1 dB) | 48k st 192 → 44.1k mo 96 | 1080 | -2.9 → -2.7 | -16.2 → -16.1 | -83 / -113 → -83 / -104 |  | 405 → 202 |
| done.pops.mp3 | mono (side -29.7 dB) | 48k st 192 → 44.1k mo 96 | 1000 | -4.1 → -3.9 | -16.3 → -16.4 | -70 / -106 → -70 / -100 |  | 375 → 188 |
| done.spinUp.mp3 | mono (side -24.2 dB) | 48k st 192 → 44.1k mo 96 | 1080 | -5.8 → -5.5 | -16.3 → -16.3 | -68 / -94 → -68 / -79 |  | 405 → 202 |
| freecell_cascade.mp3 | to target -16.5; limiter 5.7 dB | 44.1k mo 96 | 948 | -1.6 → -1.3 | -29.5 → -25.4 | -78 / -99 → -73 / -96 |  | 178 → 178 |
| freecell_win.mp3 | to target -16.5; limiter 4.4 dB | 44.1k mo 96 | 1362 | -1.5 → -1.3 | -20.2 → -16.5 | -81 / -106 → -77 / -103 |  | 255 → 255 |
| freekick_kick.mp3 | to target -17.5; limiter 3.1 dB | 44.1k mo 96 | 300 | -1.4 → -1.0 | -21.8 → -20.0 | -90 / -109 → -87 / -111 |  | 56 → 56 |
| freekick_wall.mp3 | to target -17.5; limiter 3.3 dB | 44.1k mo 96 | 300 | -1.4 → -1.2 | -21.3 → -19.6 | -60 / -109 → -56 / -102 |  | 56 → 56 |
| freekick_whistle.mp3 | to target -17.1 | 44.1k mo 96 | 683 | -3.4 → -7.8 | -12.7 → -17.1 | -86 / -142 → -91 / -109 |  | 128 → 128 |
| gem.forge.mp3 | mono (side -17 dB) | 48k st 192 → 44.1k mo 96 | 680 | -6.1 → -6.2 | -18.1 → -18.2 | -110 / -133 → -114 / -133 |  | 255 → 128 |
| gem.parSmashed.mp3 | mono (side -25.2 dB) | 48k st 192 → 44.1k mo 96 | 1360 | -8.0 → -8.5 | -18.6 → -18.7 | -107 / -126 → -108 / -176 |  | 510 → 255 |
| gem.pick.mp3 | tail fade 10 ms | 48k st 192 | 80 | -1.5 → -1.5 | -15.3 → -15.4 | -21 / -47 → -22 / -67 |  | 30 → 30 |
| gem.refuse.mp3 | to target -17.5; limiter 3.0 dB; mono (side -25.4 dB) | 48k st 192 → 44.1k mo 96 | 280 | -1.1 → -1.0 | -26.8 → -25.0 | -78 / -101 → -75 / -107 |  | 105 → 53 |
| gem.shatter.mp3 | mono (side -26 dB) | 48k st 192 → 44.1k mo 96 | 400 | -3.6 → -4.1 | -16.3 → -16.4 | -98 / -132 → -96 / -109 |  | 150 → 75 |
| gem.starBurst.mp3 | mono (side -26.8 dB) | 48k st 192 → 44.1k mo 96 | 800 | -5.1 → -5.0 | -17.1 → -17.1 | -102 / -120 → -103 / -120 |  | 300 → 150 |
| gem.swap.mp3 | to target -22.7 | 48k st 192 | 200 | -3.7 → -9.9 | -16.3 → -22.6 | -42 / -78 → -47 / -84 |  | 75 → 75 |
| gravity.lock.mp3 | limiter 0.3 dB; mono (side -19.9 dB) | 48k st 192 → 44.1k mo 96 | 201 | -1.6 → -1.1 | -22.6 → -23.3 | -77 / -107 → -79 / -117 |  | 75 → 38 |
| homerun_foul.mp3 | to target -17.5; limiter 3.8 dB | 44.1k mo 96 | 300 | -1.5 → -1.0 | -25.1 → -22.6 | -69 / -106 → -65 / -92 |  | 56 → 56 |
| homerun_mitt.mp3 | to target -17.5; limiter 4.2 dB | 44.1k mo 96 | 400 | -1.3 → -1.0 | -23.1 → -20.1 | -79 / -132 → -75 / -123 |  | 75 → 75 |
| homerun_pitch.mp3 | to target -17.5; limiter 4.3 dB | 44.1k mo 96 | 259 | -1.5 → -1.0 | -21.5 → -18.1 | -83 / -115 → -79 / -113 |  | 49 → 49 |
| homerun_sign.mp3 | to target -16.5; limiter 5.5 dB | 44.1k mo 96 | 994 | -1.2 → -1.1 | -24.2 → -19.4 | -129 / -156 → -123 / -132 |  | 186 → 186 |
| iceslide.crack.mp3 | to target -17.5; limiter 4.4 dB; mono (side -24.3 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -1.1 → -1.4 | -21.5 → -18.5 | -66 / -103 → -63 / -111 |  | 182 → 91 |
| iceslide.fall.mp3 | mono (side -33 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -11.4 → -11.2 | -16.3 → -16.3 | -56 / -106 → -62 / -107 |  | 182 → 91 |
| iceslide.solve.mp3 | mono (side -26.8 dB) | 48k st 192 → 44.1k mo 96 | 1200 | -0.8 → -1.2 | -18.0 → -18.1 | -79 / -106 → -79 / -94 |  | 450 → 225 |
| inkbridge.cloudBounce.mp3 | to target -17.5; limiter 3.5 dB; lifted floor faded (92 ms) | 48k st 192 | 486 | -17.1 → -1.2 | -42.4 → -25.8 | -81 / -85 → -200 / -240 |  | 182 → 182 |
| laser.solve.mp3 | mono (side -18.5 dB) | 48k st 192 → 44.1k mo 96 | 1080 | -9.2 → -8.8 | -16.4 → -16.4 | -67 / -97 → -67 / -103 |  | 405 → 202 |
| mahjong_clear.mp3 | to target -16.5; limiter 5.0 dB | 44.1k mo 96 | 1806 | -1.5 → -1.8 | -20.8 → -16.5 | -79 / -126 → -74 / -115 |  | 339 → 339 |
| mahjong_invalid.mp3 | to target -17.5; limiter 3.4 dB | 44.1k mo 96 | 300 | -1.4 → -1.1 | -21.6 → -19.1 | -67 / -95 → -63 / -115 |  | 56 → 56 |
| mahjong_match.mp3 | to target -17.5; limiter 4.3 dB | 44.1k mo 96 | 359 | -1.1 → -1.1 | -23.8 → -21.2 | -84 / -132 → -80 / -106 |  | 67 → 67 |
| mahjong_select.mp3 | to target -22.7; limiter 3.8 dB | 44.1k mo 96 | 200 | -1.5 → -1.5 | -25.8 → -22.7 | -73 / -106 → -70 / -103 |  | 38 → 38 |
| mahjong_shuffle.mp3 | to target -16.5; limiter 5.7 dB | 44.1k mo 96 | 1043 | -1.4 → -1.0 | -32.7 → -27.6 | -83 / -103 → -77 / -114 |  | 195 → 195 |
| marble.release.mp3 | to target -17.5; limiter 3.1 dB; mono (side -23.9 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -3.3 → -1.5 | -23.1 → -19.5 | -58 / -83 → -58 / -95 |  | 182 → 91 |
| mines_cascade.mp3 | to target -17.1; limiter 4.8 dB | 44.1k mo 96 | 604 | -1.6 → -1.2 | -21.3 → -20.9 | -50 / -57 → -48 / -56 |  | 113 → 113 |
| mines_flag.mp3 | to target -17.5; limiter 6.1 dB | 44.1k mo 96 | 300 | -1.4 → -1.1 | -23.5 → -18.4 | -60 / -71 → -54 / -66 |  | 56 → 56 |
| mines_hit.mp3 | to target -17.5; limiter 3.9 dB; lifted floor faded (24 ms) | 44.1k mo 96 | 474 | -5.1 → -1.0 | -27.4 → -21.2 | -79 / -141 → -124 / -132 |  | 89 → 89 |
| minigolf_cup.mp3 | to target -17.1; limiter 3.5 dB | 44.1k mo 96 | 733 | -1.6 → -1.0 | -29.2 → -26.6 | -82 / -114 → -78 / -101 |  | 138 → 138 |
| minigolf_putt.mp3 | to target -17.5; lifted floor faded (10 ms) | 44.1k mo 96 | 400 | -1.5 → -1.0 | -28.5 → -27.8 | -73 / -122 → -74 / -111 |  | 75 → 75 |
| minigolf_rail.mp3 | to target -17.5; limiter 3.2 dB | 44.1k mo 96 | 300 | -1.4 → -1.1 | -26.1 → -25.1 | -87 / -107 → -83 / -111 |  | 56 → 56 |
| minigolf_roll_loop.mp3 | to target -16.8; limiter 3.1 dB | 44.1k mo 96 | 1375 | -1.5 → -2.1 | -19.2 → -16.8 | -12 / -48 → -10 / -48 | 0.37, 0.10, -1.5 / -0.3 → 0.52, 0.03, -2.8 / -0.4 | 258 → 258 |
| minigolf_stone.mp3 | to target -17.5; limiter 3.2 dB | 44.1k mo 96 | 300 | -1.3 → -1.2 | -28.6 → -26.5 | -81 / -110 → -77 / -92 |  | 56 → 56 |
| move.appear.mp3 | to target -17.5; lifted floor faded (6 ms); mono (side -28.9 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -13.5 → -2.0 | -29.2 → -17.5 | -57 / -87 → -46 / -119 |  | 182 → 91 |
| move.combine.mp3 | mono (side -16.8 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -0.4 → -1.3 | -19.0 → -20.0 | -73 / -74 → -74 / -77 |  | 182 → 91 |
| move.slide.mp3 | to target -17.5; mono (side -23.5 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -4.4 → -1.0 | -21.7 → -18.0 | -79 / -94 → -76 / -91 |  | 182 → 91 |
| move.softFall.mp3 | to target -17.5; lifted floor faded (6 ms); mono (side -28.4 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -16.4 → -2.9 | -30.7 → -17.5 | -61 / -88 → -48 / -108 |  | 182 → 91 |
| music_cross.mp3 | last bar crossfades into the first (1921 ms) | 44.1k st 128 | 60029 → 58108 | -6.3 → -5.9 | -18.5 → -18.5 | -21 / -54 → -22 / -19 | 0.03, 0.03, +8.7 / +4.8 → 0.26, 0.34, +4.8 / +0.8 | 22511 → 21791 |
| music_matchup.mp3 | last bar crossfades into the first (1818 ms) | 44.1k st 128 | 54545 → 52727 | -4.8 → -5.0 | -18.5 → -18.5 | -26 / -42 → -24 / -16 | 0.15, 0.06, +6.7 / +2.4 → 0.12, 0.01, +4.6 / -0.5 | 20454 → 19772 |
| music_menu.mp3 | to target -18.45 | 44.1k st 128 | 38401 | -7.7 → -5.5 | -20.5 → -18.4 | -25 / -27 → -23 / -24 | 0.17, 0.26, -3.5 / -2.5 → 0.08, 0.12, -3.5 / -2.5 | 14400 → 14400 |
| music_pool.mp3 | last bar crossfades into the first (2728 ms) | 44.1k st 128 | 49097 → 46369 | -6.8 → -6.3 | -18.4 → -18.4 | -26 / -52 → -23 / -22 | 0.01, 0.07, +6.8 / +4.1 → 0.11, 0.10, +7.6 / +2.5 | 18411 → 17388 |
| music_ricochet.mp3 | last bar crossfades into the first (2401 ms) | 44.1k st 128 | 60029 → 57628 | -5.1 → -4.2 | -18.5 → -18.5 | -23 / -49 → -29 / -25 | 0.11, 0.09, +11.3 / +7.7 → 0.08, 0.08, +8.0 / +6.4 | 22511 → 21611 |
| orbit.blackHole.mp3 | mono (side -43.6 dB) | 48k st 192 → 44.1k mo 96 | 1080 | -8.5 → -8.6 | -18.5 → -18.5 | -100 / -153 → -100 / -140 |  | 405 → 202 |
| orbit.planetCatch.mp3 | to target -17.5 | 48k st 192 | 486 | -8.7 → -3.1 | -23.2 → -17.5 | -66 / -104 → -60 / -99 |  | 182 → 182 |
| orbit.shootingStar.mp3 | to target -17.1 | 48k st 192 | 806 | -0.3 → -5.5 | -11.9 → -17.4 | -56 / -80 → -61 / -86 |  | 302 → 302 |
| pinball.ballLost.mp3 | mono (side -35 dB) | 48k st 192 → 44.1k mo 96 | 587 | -9.8 → -9.7 | -16.2 → -16.2 | -76 / -118 → -76 / -114 |  | 220 → 110 |
| pinball.bankComplete.mp3 | mono (side -23 dB) | 48k st 192 → 44.1k mo 96 | 606 → 607 | -1.0 → -1.2 | -17.2 → -17.2 | -60 / -81 → -66 / -88 |  | 227 → 114 |
| pinball.dropTarget.mp3 | mono (side -17.8 dB) | 48k st 192 → 44.1k mo 96 | 454 | -1.1 → -1.0 | -16.5 → -16.5 | -80 / -110 → -81 / -103 |  | 170 → 85 |
| pinball.flipper.mp3 | mono (side -22.6 dB) | 48k st 192 → 44.1k mo 96 | 482 | -0.3 → -1.0 | -17.3 → -18.0 | -60 / -92 → -67 / -83 |  | 181 → 90 |
| pinball.gameOver.mp3 | to target -16.5; mono (side -26.3 dB) | 48k st 192 → 44.1k mo 96 | 1600 | -0.2 → -4.4 | -12.5 → -16.5 | -73 / -68 → -81 / -78 |  | 600 → 300 |
| pinball.laneLight.mp3 | mono (side -21.8 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -5.6 → -5.9 | -16.3 → -16.4 | -61 / -89 → -67 / -90 |  | 182 → 91 |
| pinball.lastBall.mp3 | to target -17.1; lifted floor faded (6 ms); mono (side -27.1 dB) | 48k st 192 → 44.1k mo 96 | 806 → 807 | -19.9 → -9.4 | -27.9 → -17.1 | -67 / -92 → -57 / -139 |  | 302 → 151 |
| pinball.sling.mp3 | to target -17.5; limiter 4.4 dB; mono (side -27.6 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -1.1 → -1.1 | -21.7 → -19.0 | -57 / -96 → -53 / -109 |  | 182 → 91 |
| pinball.spinner.mp3 | mono (side -26.3 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -1.0 → -1.1 | -16.2 → -16.2 | -64 / -86 → -66 / -113 |  | 182 → 91 |
| pinball.spinnerRip.mp3 | mono (side -24.1 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -0.9 → -1.3 | -18.4 → -18.6 | -70 / -101 → -71 / -83 |  | 182 → 91 |
| pinball.start.mp3 | mono (side -19.2 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -2.8 → -2.9 | -16.3 → -16.4 | -56 / -110 → -57 / -111 |  | 182 → 91 |
| pipes.flow.mp3 | mono (side -24.9 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -3.0 → -3.3 | -16.3 → -16.4 | -75 / -109 → -78 / -114 |  | 182 → 91 |
| pipes.solve.mp3 | mono (side -26.8 dB) | 48k st 192 → 44.1k mo 96 | 1200 | -3.7 → -4.0 | -16.3 → -16.3 | -75 / -105 → -75 / -116 |  | 450 → 225 |
| pool_chalk.mp3 | to target -17.1; limiter 7.5 dB; tail fade 10 ms; lifted floor faded (1 ms) | 44.1k mo 96 | 733 | -1.6 → -1.1 | -24.0 → -17.5 | -33 / -67 → -28 / -66 |  | 138 → 138 |
| pool_cue_hard.mp3 | to target -17.5; limiter 3.3 dB | 44.1k mo 96 | 400 | -1.3 → -1.0 | -26.2 → -23.7 | -89 / -104 → -85 / -103 |  | 75 → 75 |
| pool_cue_soft.mp3 | to target -17.5; limiter 4.9 dB | 44.1k mo 96 | 400 | -1.0 → -1.1 | -21.3 → -17.7 | -58 / -97 → -53 / -92 |  | 75 → 75 |
| pool_cushion.mp3 | to target -17.5; limiter 3.7 dB | 44.1k mo 96 | 300 | -1.4 → -1.0 | -23.2 → -20.3 | -80 / -111 → -76 / -97 |  | 56 → 56 |
| pool_foul.mp3 | tail fade 10 ms | 44.1k mo 96 | 484 | -2.5 → -2.6 | -15.5 → -15.4 | -30 / -86 → -36 / -61 |  | 91 → 91 |
| pool_pocket.mp3 | to target -16.5; limiter 5.5 dB | 44.1k mo 96 | 908 | -1.3 → -1.1 | -23.8 → -19.4 | -73 / -110 → -68 / -100 |  | 170 → 170 |
| pop.perfect.mp3 | to target -17.5; mono (side -22.4 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -15.7 → -4.8 | -28.6 → -17.6 | -42 / -80 → -34 / -74 |  | 182 → 91 |
| push.home.mp3 | mono (side -22.1 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -1.3 → -1.6 | -17.4 → -17.4 | -42 / -71 → -43 / -71 |  | 182 → 91 |
| racing_drive_loop.mp3 | to target -16.8 | 44.1k st 128 | 2419 | -1.4 → -5.1 | -13.0 → -16.8 | -12 / -12 → -16 / -16 | 0.59, 0.73, +0.6 / +1.9 → 0.63, 0.08, +0.6 / +1.8 | 907 → 907 |
| racing_idle_loop.mp3 | loop re-cut (45 ms crossfade); to target -16.8 | 44.1k st 128 | 2341 → 2283 | -1.5 → -4.5 | -13.8 → -16.8 | -15 / -21 → -11 / -15 | 1.36, 0.76, +0.7 / -0.4 → 0.55, 0.50, -4.6 / -0.7 | 878 → 856 |
| racing_light.mp3 | to target -22.7 | 44.1k mo 96 | 155 | -7.8 → -12.5 | -18.1 → -22.7 | -79 / -136 → -84 / -124 |  | 29 → 29 |
| racing_squeal.mp3 | tail fade 30 ms | 44.1k mo 96 | 1197 | -3.1 → -3.0 | -16.3 → -16.3 | -36 / -83 → -63 / -98 |  | 224 → 224 |
| rally.padPlusThree.mp3 | mono (side -15.7 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -4.7 → -4.6 | -17.6 → -17.6 | -63 / -84 → -65 / -75 |  | 182 → 91 |
| retro.appear.mp3 | to target -17.5; true peak over 0; tail fade 10 ms; mono (side -21.7 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | +0.1 → -9.8 | -7.3 → -17.5 | -11 / -43 → -25 / -92 |  | 182 → 91 |
| retro.atomBounce.mp3 | mono (side -27.7 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -5.9 → -5.9 | -19.7 → -19.8 | -40 / -80 → -41 / -77 |  | 182 → 91 |
| retro.brickBreak.mp3 | to target -17.5; limiter 4.2 dB | 48k st 192 | 486 | -3.7 → -1.0 | -23.8 → -18.5 | -52 / -72 → -46 / -66 |  | 182 → 182 |
| retro.enemyFire.mp3 | true peak over 0; limiter 2.9 dB; mono (side -18.9 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | +0.8 → -1.1 | -8.9 → -9.8 | -53 / -67 → -54 / -74 |  | 182 → 91 |
| retro.itemDrop.mp3 | to target -17.5; true peak over 0; mono (side -24.8 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | +0.5 → -10.2 | -6.9 → -17.5 | -56 / -81 → -73 / -93 |  | 182 → 91 |
| retro.powerDown.mp3 | to target -17.5; true peak over 0 | 48k st 192 | 486 | +1.2 → -10.3 | -6.3 → -17.5 | -49 / -75 → -60 / -108 |  | 182 → 182 |
| retro.saucerEnter.mp3 | to target -17.1; tail fade 10 ms; mono (side -28 dB) | 48k st 192 → 44.1k mo 96 | 606 → 607 | -0.1 → -13.2 | -3.9 → -17.2 | -17 / -61 → -32 / -71 |  | 227 → 114 |
| retro.shieldBreak.mp3 | to target -17.5; true peak over 0; tail fade 30 ms; mono (side -25.3 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | +1.9 → -10.1 | -5.6 → -17.5 | -38 / -58 → -82 / -101 |  | 182 → 91 |
| retro.wallBounce.mp3 | to target -17.5; tail fade 10 ms; lifted floor faded (1 ms); mono (side -22 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -8.8 → -1.0 | -26.4 → -18.4 | -29 / -66 → -25 / -68 |  | 182 → 91 |
| ricochet.flow.mp3 | tail fade 10 ms | 44.1k mo 96 | 685 | -5.2 → -5.1 | -17.1 → -17.1 | -16 / -46 → -18 / -70 |  | 128 → 128 |
| ricochet.lanternGrab.mp3 | to target -17.5; limiter 3.7 dB | 44.1k mo 96 | 429 | -0.9 → -1.0 | -24.4 → -23.0 | -56 / -97 → -53 / -64 |  | 80 → 80 |
| ricochet.ledge.mp3 | to target -17.5; limiter 3.7 dB; tail fade 30 ms | 44.1k mo 96 | 479 | -1.0 → -1.5 | -22.6 → -22.3 | -38 / -63 → -62 / -101 |  | 90 → 90 |
| ricochet.scroll.mp3 | tail fade 30 ms | 44.1k mo 96 | 592 | -1.5 → -1.6 | -17.1 → -17.1 | -35 / -78 → -64 / -93 |  | 111 → 111 |
| room.round.a.mp3 | mono (side -17.9 dB) | 48k st 192 → 44.1k mo 96 | 1600 | -5.3 → -5.1 | -16.4 → -16.4 | -76 / -101 → -78 / -103 |  | 600 → 300 |
| room.roundWon.mp3 | mono (side -17.3 dB) | 48k st 192 → 44.1k mo 96 | 680 | -6.1 → -6.1 | -17.1 → -17.1 | -104 / -137 → -104 / -161 |  | 255 → 128 |
| safe.dialClick.mp3 | to target -17.5; limiter 4.3 dB | 48k st 192 | 486 | -2.8 → -1.3 | -26.4 → -22.4 | -77 / -87 → -72 / -80 |  | 182 → 182 |
| sea.bubbleStick.mp3 | to target -17.5; lifted floor faded (88 ms); mono (side -34 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -11.6 → -5.6 | -23.7 → -17.5 | -77 / -108 → -200 / -240 |  | 182 → 91 |
| sfx_hero_whoosh.mp3 | to target -16.5; limiter 4.7 dB | 44.1k mo 112 | 1500 | -1.8 → -1.1 | -21.6 → -17.6 | -77 / -86 → -72 / -80 |  | 281 → 281 |
| sfx_logo_charge.mp3 | tail fade 10 ms | 44.1k mo 112 | 687 | -1.9 → -5.5 | -19.9 → -19.8 | -14 / -45 → -16 / -73 |  | 129 → 129 |
| sfx_meter_crackle_1.mp3 | tail fade 10 ms | 44.1k mo 112 | 450 | -1.8 → -1.3 | -19.7 → -19.6 | -22 / -42 → -23 / -84 |  | 84 → 84 |
| sfx_meter_crackle_2.mp3 | to target -17.5; limiter 4.4 dB; tail fade 10 ms | 44.1k mo 112 | 378 | -1.7 → -1.3 | -21.5 → -19.0 | -15 / -63 → -16 / -72 |  | 71 → 71 |
| sfx_meter_crackle_3.mp3 | to target -17.5; limiter 3.7 dB; tail fade 10 ms | 44.1k mo 112 | 450 | -0.6 → -1.1 | -20.6 → -19.4 | -25 / -41 → -32 / -75 |  | 84 → 84 |
| sfx_overtake_zap.mp3 | tail fade 10 ms | 44.1k mo 112 | 280 | -1.8 → -1.6 | -18.4 → -18.3 | -18 / -44 → -19 / -111 |  | 53 → 53 |
| sfx_streak_flourish.mp3 | to target -16.5 | 44.1k mo 112 | 1200 | -6.9 → -3.0 | -20.4 → -16.9 | -66 / -69 → -62 / -66 |  | 225 → 225 |
| sfx_streak_flourish_big.mp3 | to target -16.5 | 44.1k mo 112 | 1993 | -5.9 → -2.2 | -20.1 → -16.5 | -80 / -88 → -77 / -85 |  | 374 → 374 |
| sfx_victory_sting.mp3 | to target -16.5 | 44.1k mo 112 | 1756 | -4.0 → -1.4 | -20.2 → -17.2 | -76 / -70 → -73 / -67 |  | 329 → 329 |
| shared.perfect.mp3 | mono (side -23.9 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -5.7 → -5.7 | -16.3 → -16.3 | -56 / -78 → -57 / -77 |  | 182 → 91 |
| shared.playofthegame.mp3 | mono (side -15.5 dB) | 48k st 192 → 44.1k mo 96 | 1600 | -7.0 → -7.3 | -16.2 → -16.2 | -64 / -108 → -64 / -95 |  | 600 → 300 |
| shared.signature.solve.mp3 | mono (side -30.1 dB) | 48k st 192 → 44.1k mo 96 | 1000 | -5.1 → -5.3 | -16.2 → -16.2 | -58 / -52 → -59 / -56 |  | 375 → 188 |
| shared.slowmo.end.mp3 | mono (side -34.9 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -1.2 → -1.3 | -17.5 → -17.5 | -66 / -93 → -68 / -90 |  | 182 → 91 |
| signals.ruleChange.mp3 | to target -17.5; true peak over 0; mono (side -24.9 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | +1.4 → -2.3 | -13.9 → -17.5 | -54 / -74 → -64 / -82 |  | 182 → 91 |
| signals.whoosh.mp3 | to target -17.5; mono (side -18.8 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -0.1 → -6.9 | -10.6 → -17.5 | -46 / -69 → -59 / -82 |  | 182 → 91 |
| sky.gust.mp3 | true peak over 0; limiter 3.1 dB | 48k st 192 | 606 | +0.9 → -1.0 | -16.4 → -16.7 | -60 / -68 → -59 / -67 |  | 227 → 227 |
| skyline.floors.mp3 | mono (side -20.3 dB) | 48k st 192 → 44.1k mo 96 | 483 | -1.7 → -1.8 | -18.1 → -18.1 | -93 / -116 → -92 / -102 |  | 181 → 91 |
| slice.chilli.mp3 | tail fade 30 ms | 44.1k mo 96 | 485 | -1.0 → -2.3 | -17.9 → -18.7 | -26 / -53 → -53 / -60 |  | 91 → 91 |
| slice.fuse.mp3 | to target -17.1; lifted floor faded (6 ms) | 48k st 192 | 606 | -15.0 → -5.2 | -25.2 → -17.2 | -57 / -80 → -48 / -87 |  | 227 → 227 |
| slice.ketchup.mp3 | mono (side -27.9 dB) | 48k st 192 → 44.1k mo 96 | 350 | -1.2 → -1.4 | -18.2 → -18.1 | -84 / -94 → -82 / -93 |  | 131 → 66 |
| slice.mayo.mp3 | mono (side -24.5 dB) | 48k st 192 → 44.1k mo 96 | 450 | -7.5 → -6.7 | -17.0 → -17.1 | -88 / -144 → -88 / -148 |  | 169 → 84 |
| snake.cometRush.mp3 | mono (side -22 dB) | 48k st 192 → 44.1k mo 96 | 400 | -8.5 → -8.6 | -17.1 → -17.1 | -74 / -97 → -73 / -89 |  | 150 → 75 |
| snake.rockFalling.mp3 | to target -17.1; true peak over 0; mono (side -30.6 dB) | 48k st 192 → 44.1k mo 96 | 806 → 807 | +0.1 → -13.4 | -3.8 → -17.1 | -47 / -77 → -66 / -121 |  | 302 → 151 |
| speed.up.mp3 | to target -17.5; true peak over 0 | 48k st 192 | 486 | +0.7 → -9.0 | -7.8 → -17.5 | -58 / -75 → -68 / -85 |  | 182 → 182 |
| sports_crowd_loop.mp3 | to target -16.8; limiter 4.9 dB | 44.1k st 128 | 9271 | -1.3 → -1.7 | -20.8 → -16.9 | -22 / -30 → -18 / -25 | 0.52, 0.05, -1.0 / -0.3 → 0.51, 0.16, -0.9 / -0.3 | 3477 → 3477 |
| swing.dragonNear.mp3 | to target -16.5; true peak over 0; mono (side -33.2 dB) | 48k st 192 → 44.1k mo 96 | 1080 | +0.7 → -7.5 | -8.2 → -16.5 | -59 / -62 → -67 / -73 |  | 405 → 202 |
| swing.gate.mp3 | tail fade 30 ms | 44.1k mo 96 | 479 | -1.5 → -1.0 | -18.1 → -18.5 | -40 / -101 → -68 / -122 |  | 90 → 90 |
| swing.hundredMetres.mp3 | mono (side -31.7 dB) | 48k st 192 → 44.1k mo 96 | 562 | -5.4 → -5.4 | -17.0 → -17.0 | -89 / -129 → -90 / -128 |  | 211 → 105 |
| swing.lava.mp3 | loop re-cut (37 ms crossfade) | 48k st 192 | 6000 → 5950 | -1.8 → -1.7 | -14.9 → -14.9 | -19 / -18 → -16 / -16 | 1.48, 5.78, +0.2 / +1.2 → 0.04, 0.02, +2.1 / +1.6 | 2250 → 2231 |
| swing.slideVine.mp3 | to target -16.8; limiter 4.6 dB | 44.1k mo 96 | 2000 | -0.7 → -1.1 | -20.6 → -17.9 | -28 / -40 → -23 / -29 | 0.16, 0.16, +0.4 / -2.3 → 0.25, 0.26, +1.3 / -1.8 | 375 → 375 |
| swing.wings.mp3 | to target -16.8; limiter 3.8 dB | 44.1k mo 96 | 2000 | -1.0 → -1.1 | -23.0 → -20.6 | -58 / -91 → -55 / -96 | 0.02, 0.01, +1.6 / -3.5 → 0.01, 0.04, +1.7 / -3.5 | 375 → 375 |
| symscan.eagle.mp3 | tail fade 30 ms | 44.1k mo 96 | 807 | -7.4 → -7.3 | -17.1 → -17.1 | -35 / -47 → -67 / -95 |  | 151 → 151 |
| symscan.takeoff.mp3 | mono (side -19.3 dB) | 48k st 192 → 44.1k mo 96 | 1077 | -1.4 → -1.0 | -16.2 → -16.4 | -72 / -98 → -78 / -114 |  | 404 → 202 |
| tendrop.clear.mp3 | mono (side -23 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -1.3 → -1.3 | -16.2 → -16.1 | -48 / -78 → -52 / -78 |  | 182 → 91 |
| tubes.cork.mp3 | mono (side -41 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -3.5 → -3.4 | -16.3 → -16.4 | -56 / -117 → -56 / -141 |  | 182 → 91 |
| ui.clear.mp3 | to target -17.5; lifted floor faded (56 ms); mono (side -28.9 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -16.5 → -2.5 | -30.9 → -17.5 | -80 / -91 → -200 / -240 |  | 182 → 91 |
| ui.counterLock.mp3 | mono (side -21.8 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -1.2 → -1.1 | -16.5 → -16.4 | -68 / -104 → -73 / -99 |  | 182 → 91 |
| ui.nope.mp3 | mono (side -24.8 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -0.2 → -1.0 | -19.4 → -20.2 | -73 / -95 → -79 / -108 |  | 182 → 91 |
| ui.select.mp3 | to target -17.5; limiter 2.8 dB; lifted floor faded (388 ms) | 48k st 192 | 486 | -17.6 → -1.3 | -39.6 → -22.6 | -78 / -93 → -200 / -240 |  | 182 → 182 |
| ui.sheet.open.mp3 | mono (side -18.6 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -6.0 → -6.3 | -16.3 → -16.4 | -55 / -115 → -56 / -109 |  | 182 → 91 |
| ui.tap.small.mp3 | tail fade 30 ms; mono (side -18.8 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -0.7 → -1.0 | -16.8 → -17.2 | -22 / -70 → -58 / -116 |  | 182 → 91 |
| ui.warn.mp3 | to target -17.5; mono (side -32.7 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -4.8 → -8.4 | -14.0 → -17.5 | -58 / -88 → -67 / -92 |  | 182 → 91 |
| wavefront.danger.mp3 | loop re-cut (42 ms crossfade) | 48k st 192 | 2250 → 2151 | -1.4 → -1.4 | -16.3 → -16.3 | -18 / -21 → -17 / -14 | 0.61, 2.47, -2.3 / -2.2 → 0.02, 0.01, -2.1 / -2.0 | 844 → 807 |
| wavefront.greenBolt.mp3 | tail fade 10 ms; mono (side -18.4 dB) | 48k st 192 → 44.1k mo 96 | 90 | -10.5 → -10.4 | -24.2 → -24.1 | -38 / -68 → -40 / -75 |  | 34 → 17 |
| wavefront.march.mp3 | mono (side -40.8 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -6.7 → -6.8 | -18.2 → -18.2 | -52 / -77 → -58 / -85 |  | 182 → 91 |
| wavefront.waveIn.mp3 | mono (side -34.4 dB) | 48k st 192 → 44.1k mo 96 | 830 | -7.9 → -7.9 | -17.6 → -17.6 | -100 / -137 → -100 / -154 |  | 311 → 156 |
| whack.hedgehogUp.mp3 | to target -17.5; mono (side -28.5 dB) | 48k st 192 → 44.1k mo 96 | 486 → 487 | -7.2 → -3.6 | -21.0 → -17.6 | -73 / -93 → -70 / -90 |  | 182 → 91 |
| wordslide.finish.mp3 | to target -16.5; limiter 2.8 dB; mono (side -22.4 dB) | 48k st 192 → 44.1k mo 96 | 1001 | -0.3 → -1.3 | -19.9 → -19.7 | -80 / -122 → -79 / -99 |  | 375 → 188 |
