# Code audit 6: music and sounds (7 Nov 2026)

Read-only audit of every audio file the app ships and of how `src/lib/sound.ts` plays it. Nothing in the app was
changed. Measured on main 34272737 with ffmpeg 6 and numpy (scripts kept out of the repo); no browser tests were run.
**Nothing here was heard on a phone**: Joe does the device listening, and the cross-browser points below say what to
test.

## What was measured

- **Files:** all 355 MP3s in `public/sounds/` (23.3 MB). Every one is used by at least one manifest slot, and every
  `/sounds/` URL in `src/lib/fx/manifest.ts` has its file (1,108 slots: 737 on `/sounds/`, 153 on Lovable-hosted
  `/__l5e/assets-v1/…` URLs, 218 with no file).
- **Not measured:** the 135 Lovable-hosted files (`/__l5e/…`: the original library's core effects such as `tick`,
  `correct`, `wrong`, `warning_10`, and 41 music beds, among them `lobby_loop`, `intro_loop`, `standings_loop`,
  `podium_loop` and every puzzle-category and older arcade bed). They are not in the repo and the session's network
  could not reach joulz.uk. Fix 11 says how to cover them.
- **Per file:** format (ffprobe), the gapless header (every file has an `Info` frame written by libavcodec with
  encoder delay 576 and its padding), length, sample peak and true peak (ebur128, 4× oversampled), integrated loudness
  (ebur128 with 1 s of silence padded either side, as `scripts/sound-nov-2026/measure.py` does, so short sounds read
  lower: the targets are per length for that reason), leading silence (to -60 dBFS), onset (the first sample within
  30 dB of the peak), trailing silence, the first sample's level, the last 10 ms's level, and clipped runs (3+ samples
  at |x| ≥ 0.995 in the decode).
- **Loops** (the 20 beds and 18 effect loops on `/sounds/`): the loop region the app plays (`detectLoopPoints`:
  edges under 0.001 trimmed), the sample step across the join against the file's own 99th-percentile step ("step ×"),
  the slope break (the first sample against the straight-line prediction from the last two, "slope ×"), the level
  either side of the join over 50 ms and 400 ms, and each end's 200 ms against the whole loop. Each loop was decoded
  twice: with the gapless header honoured (what ffmpeg, Chrome and Firefox do) and with it ignored (priming and
  padding left in, `-flags2 +skip_manual`), the worst case for a browser that ignores it.
- **Targets** (the levelled ones in `docs/sound-cues/levels-nov-2026.md`; there is no separate "F8" document in the
  repo, so these are the ones used): effects by length -22.7 LUFS (< 0.25 s), -17.5 (0.25–0.5 s), -17.1 (0.5–0.9 s),
  -16.5 (longer), true peak ≤ -1 dBFS; effect loops -16.8; beds -18.45; voice lines -23.8. Outliers: more than 3 dB off
  for effects, 2 dB for beds, loops and voices. A slot's `volume` in the manifest (109 files have one) scales the
  file on top; where it matters it is named below.

## Summary

| Area | Result |
|---|---|
| Playback code (loops) | **Pass.** Every loop is an `AudioBufferSourceNode` with `loop = true`; there is no `<audio>` element anywhere (sound.ts line 12). Buffer loops are sample-exact: the code adds no gap. |
| Beds on a gapless decode | **Pass, 4 with a level step.** No click at any join (step ≤ ×0.23, slope ≤ ×0.5 of the file's own). `music_ricochet` (+7.7 dB over 400 ms), `music_cross` (+4.8), `music_pool` (+4.1) and `music_matchup` (+2.4, under the bar) step up at the join where a phrase ends: musical, but audible every minute. |
| Effect loops | **3 joins to re-cut:** `swing.lava` (slope break ×5.8), `wavefront.danger` (×2.5), `racing_idle_loop` (step ×1.36). `curling_sweep_loop` dips 5 dB at the join. |
| MP3 priming | **Risk on iPhone, unverified.** Every file carries libavcodec's gapless header. If WebKit's `decodeAudioData` ignores it, each loop gains 12–26 ms of near-silence at its join that the -60 dB trim does not remove, and every effect starts 23–25 ms late. Fix 1 makes the app independent of it. |
| Leading silence | **Pass for effects** (no effect file has over 10 ms). Five older voice lines (`voice.perfect`, `voice.timesUp`, `voice.tie`, `voice.youWin`, `voice.rematch`) open with 64–112 ms of silence. |
| Tails | **40 effects end while still sounding** (last 10 ms above -40 dBFS, up to -9 dBFS): a click at the end. 92 start at full level on sample 0 (no fade-in): a small click under the attack. |
| Clipping | **20 files have true peaks over 0 dBFS**, 14 of them clipped in the decode (`retro.shieldBreak` +1.9, `signals.ruleChange` +1.4, `retro.powerDown` +1.2, `clay.launch` +1.2, the `banner.*` stings). 38 more sit between -1 and 0 dBFS. |
| Loudness | Beds and voices on target (beds -18.4 to -18.5 but `music_menu` -20.5 and `music_beat` -20.6; voices -23.1 to -24.6). **Effects spread 44 dB**: 21 are 9–31 dB under their target (`clay.missPuff` -48.3 LUFS, `inkbridge.cloudBounce` -42.4, `ui.select` -39.6, `cards_shuffle` -30.0, `mahjong_shuffle` -32.7) and 15 are 7–13 dB over (`snake.rockFalling` -3.8, `retro.saucerEnter` -3.9, `retro.shieldBreak` -5.6, the `retro.*` and `banner.*` family). |
| Wiring | **Pass.** No missing file, no unused file; the 24 re-themed slots in `mapping-retheme-nov-2026.csv` each point at their own file; sound-manifest-check, sound-batch6-check, sound-nov-2026-check, sound-retheme-check and replay-sound-check pass. Two code paths can sound an event twice or cut it (below). |
| Size | 23.3 MB in the repo: beds 17.3 MB (17.5 minutes), everything else 6.0 MB, all fetched and decoded on the first tap. **Decoded, the preloaded effects take about 96 MB of memory** at 48 kHz (about 21 MB less with the 170 stereo effects mono). |

## 1. Music loops

### How the app loops

- Beds (`startMusic`, `playRoundMusic`, the home bed) and effect loops (`ensureLoop`, `loopCue`, `ambienceCue`) all
  play a decoded `AudioBuffer` through one `AudioBufferSourceNode` with `loop = true` and `loopStart` / `loopEnd`
  from `detectLoopPoints` (sound.ts ~1411): the first and last sample above 0.001 (-60 dBFS) in any channel. Web Audio
  wraps a buffer loop sample-exactly, so **the code itself adds no gap**; HTML audio's `loop`, which does gap on
  iOS, is not used anywhere.
- Tempo's `music_beat` loops seconds 8–56 of its file (`BEAT_TRACK_GROOVE_FROM_S` / `TO_S`). Measured at those points
  the join is clean (step ×0.18; +6.8 dB over 50 ms is the downbeat at 8 s, +1.6 dB over 400 ms). When the beat drifts
  more than 40 ms from the sim, `syncBeatTrack` hard-stops the source and starts a new one at the right offset with no
  crossfade, a possible click on each re-sync (fix 8).
- Bed changes crossfade (400 ms, `FADE_MS`); effect loops fade in 400 ms and out 300 ms; the home bed resumes where it
  was left. None of this creates a gap.
- Two code details worth knowing: every one-shot effect ducks the music to 30 % for its length plus 0.2 s
  (`duckMusic`), so a busy arcade run pumps the bed; and the -60 dB trim removes real audio when a loop's own first or
  last few milliseconds are quiet: `music_bastion`, `music_cross` and `music_ricochet` lose 7–8 ms at their start each
  pass, so a loop cut exactly on the bar comes round 7–8 ms early. Under 10 ms is not audible as a stutter; it would be
  with a longer quiet lead.

### The files (gapless decode)

No bed or effect loop starts or ends in silence or a fade (each end's 200 ms within 6 dB of the loop's average) except
`swing.wings` (a wingbeat loop: its ends are between flaps, -25 dB, which is how it should sound) and
`music_ricochet`'s last 200 ms (-7.3 dB, the phrase end). Joins:

| Loop | Finding |
|---|---|
| `swing.lava` | Slope break ×5.8 and step ×1.48 at the join: a soft tick every 6 s. Re-cut on a zero crossing with a 20–40 ms crossfade. |
| `wavefront.danger` | Slope break ×2.5: a faint tick every 2.25 s. Same fix. |
| `racing_idle_loop` | Step ×1.36 at the join, 2.34 s loop: a tick at idle. Same fix. |
| `curling_sweep_loop` | Level drops 3.7 dB (50 ms) / 5.2 dB (400 ms) across the join: a pulse every 1.5 s. Re-cut where the sweep's level matches. |
| `racing_kerb_loop` | -5.1 dB over 50 ms only (-0.5 over 400 ms): a transient, acceptable. |
| `music_ricochet`, `music_cross`, `music_pool`, `music_matchup` | Clean sample join, but the level steps up 4–8 dB (400 ms) from the last phrase into the first. Already noted for `music_ricochet` and `music_matchup` in levels-nov-2026.md. A 1–2 s crossfade of the end into a copy of the start (or a cut on a matching bar, as `music_alleyroll` / `music_blockfall` got) would hide it. |
| Every other bed and loop | Pass (step ≤ ×0.9, slope ≤ ×0.8, level within 3 dB). |

### Encoder padding

- Every file is MP3 from libavcodec (LAME-style `Info` frame, encoder delay 576 samples, padding 576–1,416). A decoder
  that reads the header (ffmpeg; Chrome and Firefox build `decodeAudioData` on it) drops the delay plus the
  decoder's 529 samples and the padding, giving the exact original length: that is what the table measures.
- A decoder that ignores the header keeps 1,105 samples of priming in front and the padding behind. Measured that
  way, the -60 dB trim does **not** remove it: the MP3 pre-echo and the decoder's tail run above -60 dB, so every loop's
  played region grows by 12–26 ms of very quiet audio at the join (a dropout every pass, worst on the 0.7–2 s effect
  loops), and every effect starts 1,105 samples (23–25 ms) late, plus its 10 ms lead where it has one.
- **Whether iPhone Safari honours the header is the open question.** It was not testable here. The check for Joe: on
  the iPhone, decode `public/sounds/blockfall.lock.mp3` and read `buffer.duration` (it is resampled to the context's
  rate, so compare seconds): **0.4766 s** means the header was honoured, **about 0.52 s** (anything over 0.48 s) means priming
  and padding were kept. (Its raw decode is 23,040 samples at 44.1 kHz; gapless 21,018.)
- Formats that avoid the question: **AAC in .m4a with an iTunSMPB atom** (Safari honours it; Chrome and Firefox
  too), or keeping MP3 and having the app trim by the header's own numbers (fix 1), which works on every browser with
  no re-encode. WAV/FLAC have no padding but are 5–10× larger. Ogg/Opus is the smallest gapless format but older iOS
  versions cannot decode it in `decodeAudioData`, so it is not recommended for this app's phones.

## 2. Sound effects

- **Leading silence: pass.** No effect has more than 10 ms of silence before it (the November re-cut keeps 10 ms;
  most library files start on sample 0). Thirteen start quietly and take 28–182 ms to reach 30 dB under their peak
  (`bastion.reload` 182, `ui.nope` 154, `alleyroll.ramp` 137, `bastion.miss` 112, `cross.freighter` 60,
  `bastion.loaded` 52, `sfx_hero_whoosh` 52, …): fine for a swell or a whoosh, late for a reload or a "nope". The voice
  lines `voice.perfect`, `voice.timesUp`, `voice.tie`, `voice.youWin` and `voice.rematch` open with 64–112 ms of
  silence (the November voices keep 10 ms).
- **Starts at full level: 92 effects** begin on sample 0 above -20 dBFS (up to -3.5 dBFS: `blockfall.lock`,
  `checkout.thud`, `replay.end`, `retro.itemDrop`, `room.winner.lock`, `ricochet.ledge`), i.e. trimmed hard to the
  attack with no fade-in. The step from silence is mostly hidden by the transient, but it is a click on soft or tonal
  ones (`ui.sheet.close`, `chain.linkTone`, `done.goldPulse`). A 2 ms fade-in removes it without moving the attack.
- **Cut-off tails: 40 effects** end while still sounding (their last 10 ms above -40 dBFS): `cross.hop` and
  `blockfall.topOut` at -9 dBFS, `retro.appear`, `cross.crossed`, `bastion.jam` at -13, `sfx_logo_charge`,
  `cross.streakUp` -14, `sfx_meter_crackle_2` -15, `ricochet.flow` -16, `retro.saucerEnter`, `bastion.wave` -17,
  `sfx_overtake_zap` -18, and 28 more in the table. Each ends on a click and a truncated decay. A 10–30 ms fade-out
  (or restoring the tail from the original) fixes it.
- **Long tails:** 12 files carry 150–390 ms of silence after the sound (`ui.select` 388 ms of a 486 ms file,
  `sfx_streak_flourish_big` 359, `room.round.a` 339, `done.corks` 282, `gem.parSmashed` 272, `homerun_sign` 256).
  Harmless to the ear, but `playSound` returns the buffer's length and callers use it for timing, and `duckMusic`
  ducks the bed for it.
- **Clipping:** 20 files decode with true peaks over 0 dBFS (`retro.shieldBreak` +1.9, `signals.ruleChange` +1.4,
  `retro.powerDown` +1.2, `clay.launch` +1.2, `arrow.whoosh`, `banner.clear` +1.1, `banner.streak` +1.0, `sky.gust`
  +0.9, `banner.combo`, `retro.enemyFire` +0.8, `block.place`, `speed.up`, `swing.dragonNear` +0.7, `banner.fullClear`,
  `retro.itemDrop` +0.5, `cave.lavaErupt`, `cave.stoneCrack` +0.3, `countup.countersTick`, `retro.appear`,
  `snake.rockFalling` +0.1); 14 of them have runs of clipped samples (`retro.powerDown` 31 runs, `banner.combo` 19,
  `retro.shieldBreak` 11, `signals.ruleChange` 10, `sky.gust` 10). Web Audio sums in float, so the overs become real
  clipping only at the output, where they add to whatever else is playing. These are also the loudest files (below):
  turning them down to target removes the overs.

## 3. Loudness

The table lists every file's integrated loudness and its difference from its target. By group:

- **Beds (20 measured):** -18.4 to -18.5 LUFS, except `music_menu` (the home and practice bed) at -20.5 and
  `music_beat` (Tempo) at -20.6; Tempo's is lifted in code (`BEAT_TRACK_BOOST`), so only `music_menu` is really 2 dB
  quiet. Peaks -4.7 to -7.7 dBFS: plenty of headroom.
- **Voice lines (14):** -23.1 to -24.6 LUFS: on target.
- **Effect loops (18):** `swing.wings` -23.0 (6.2 under), `sports_crowd_loop` -20.8 (4.0 under, the Home Run and Top
  Bins crowd), `swing.slideVine` -20.6 (3.8 under), `curling_slide_loop` -20.1 (3.3 under); `racing_drive_loop` -13.0
  and `racing_idle_loop` -13.8 (3–4 over). Loops also pass a per-call volume (0.25–0.35), so these are relative
  differences between loops.
- **Effects (303):** median -17.5 LUFS, on target, but a 44 dB spread. Most under target (more than 9 dB):
  `clay.missPuff` -48.3 (also `volume` 0.5), `inkbridge.cloudBounce` -42.4, `ui.select` -39.6 (`volume` 0.6; three
  puzzle slots), `mahjong_shuffle` -32.7, `ui.clear` -30.9, `move.softFall` -30.7, `cards_shuffle` -30.0,
  `freecell_cascade` -29.5, `minigolf_cup` -29.2, `move.appear` -29.2, `cards_home` -29.1, `cards_invalid` -28.8,
  `minigolf_stone` -28.6, `pop.perfect` -28.6, `minigolf_putt` -28.5, `pinball.lastBall` -27.9, `cave.rockCrumble`
  -27.6, `mines_hit` -27.4, `curling_board` -27.2, `clayshoot.birdIn` -27.1, `gem.refuse` -26.8. Several Sports and
  Cards & Board files (batch 6) peak at -1.4 dBFS yet read 9–13 dB quiet: short clicks whose loudness sits in one
  spike, the same limit levels-nov-2026.md hit. Most over target (more than 7 dB): `snake.rockFalling` -3.8,
  `retro.saucerEnter` -3.9, `retro.shieldBreak` -5.6, `retro.powerDown` -6.3, `retro.itemDrop` -6.9, `retro.appear`
  -7.3, `speed.up` -7.8, `banner.clear` -8.0, `swing.dragonNear` -8.2, `bonk.popUp` -8.4 (but `volume` 0.35, so
  about on target), `retro.enemyFire` -8.9, `banner.streak` -9.7, `beat.note8bit` -13.6 (140 ms; `volume` 0.8),
  `gem.pick` -15.3 (80 ms), `beat.swipe` -15.4 (200 ms). The hot ones are mostly the 48 kHz stereo 192 kbps library
  (batches 2–4), never levelled down.

## 4. Wiring

- **Every slot with a `/sounds/` URL has its file; every file in `public/sounds/` is used** (by 1–8 slots; 109 files
  shared). sound-manifest-check proves the same and passes.
- **218 slots have no file** (`url: null`, `frequency: 0`): silent by design until a recording exists (for example
  `blockfall.speedUp`, `tension_loop`, `music_prepare`, `music_reveal`, `music_winner`). None plays a placeholder
  tone: every one has `frequency: 0` and no `fallback`.
- **The re-themed games (6 Nov 2026):** all 24 rows of `mapping-retheme-nov-2026.csv` point at their own file
  (`cross.*`, `swing.*`, `bintoss.*`, `bullseye.*`, `slice.chilli`, `symscan.eagle`), and the code wires them as the
  doc says: `swing.gate` sounds only on `slide` states while `swing.assaultGate` (the zap) is limited to the others
  (`momentCues.ts` rows with `when`), `slice.chilli` replaces `slice.fuse` on `v12` states only (an if/else in
  `gameSounds.ts`), `cross.freighter` replaces `cross.crossed` (if/else), `cross.pastBikes` / `pastRoadworks` replace
  that frame's `cross.hop`, the jungle loops and `swing.jungle` run only on the jungle course. `cross.traffic` plays
  Iron Wall's `bastion.drone.mp3`, as the retro polish chose. sound-retheme-check passes (452 checks).
- **Double plays to look at:**
  - Spacewalk: a no-stop crossing after a no-stop crossing plays `cross.crossed` (or `cross.freighter`) and
    `cross.streakUp` on the same tick (gameSounds.ts ~315–323). Probably meant as a layered reward; if not, let the
    streak replace the crossing sound on that tick.
  - Eagle Eye's finish plays `symscan.takeoff` and `symscan.eagle` together (eagleEyeArt.tsx 112–114): intended (the
    cry over the wingbeats, per retheme-nov-2026.md).
  - No other same-event pair was found in the code read; the checks above cover the batch mappings.
- **Retriggers cut without a fade:** `playSound` stops the previous instance of a cue with `source.stop()` when it
  plays again (non-overlap is the default), and `stopSound` does the same. If the old sound is still loud, that is a
  click; rapid cues without a `gapMs` (puzzle `move`, `place`, `tick`, card `place`) do it most. Fix 5.

## 5. Size and format

- **Repo files: 23.3 MB**, plus the 135 Lovable-hosted files (not measured; 41 of them beds, so likely about
  30 MB more at the same 128 kbps).
- **Beds: 17.3 MB for 17.5 minutes** (44.1 kHz stereo 128 kbps; `music_beat` 192 kbps, 1.44 MB). They load on demand
  per screen and are released afterwards, so a player downloads only the beds they hear (the offline worker keeps them
  all).
- **Everything else: 6.0 MB, fetched and decoded on the first tap** (`preloadFiles`: every non-music slot with a file).
  Formats: 119 effects mono 96 kbps (the levelled batches), 14 mono 112 kbps (celebrations), **170 at 48 kHz stereo
  192 kbps** (2.7 MB; the batch 2–4 library, whose stereo is narrow: side 19 dB under mid at the median), 2 at 48 kHz
  stereo 96 kbps, voices 44.1 kHz stereo 192 kbps (1.0 MB). No single effect is over 80 KB; the largest non-bed files
  are the 6–9 s ambience loops (129–149 KB).
- **Memory:** decoded at a 48 kHz context, the preloaded set is about **96 MB of PCM** held for the session (stereo
  files decode to two channels). Making the 170 stereo 48 kHz effects mono saves about 21 MB; every non-bed file mono
  would bring it to about 58 MB. On older iPhones a tab near 200–300 MB is at
  risk of being reloaded, so this is the largest audio cost, more than the download.
- **Best format for phones:** MP3 is fine and universal; the gains are in settings, not the codec:
  - Effects: **44.1 kHz mono, 96 kbps CBR** (or VBR q≈5), 2 ms fade in and 10–30 ms fade out, the gapless header kept.
    Re-encoding the 170 stereo 48 kHz effects this way saves about 1.5 MB of download and about 21 MB of memory.
  - Beds: 44.1 kHz stereo **112–128 kbps** MP3 is adequate under effects on a phone speaker; 112 kbps saves about
    2 MB. AAC-LC .m4a at 96 kbps is the same quality as 128 kbps MP3, about 4 MB smaller across the 20 beds, and its
    gapless data is read by Safari; it would need a browser pass to confirm Chrome and Firefox decode it as cleanly
    (they do in general, but this app has never shipped it).
  - Voice: mono 64–96 kbps is enough for speech (half of today's 1.0 MB).

## Every file

Kind: `bed` (music channel), `loop` (an effect slot marked `loop`), `voice`, `fx`. Lead / onset: ms of silence
before the first sample over -60 dBFS / ms to the first sample within 30 dB of the peak. LUFS target per section 3's
targets. Loop join (loops only): step ×, slope × (against the file's own 99th-percentile sample step; above ×1.2 or
×2 is an issue), and the level change into the join over 50 ms / 400 ms. "true peak above -1" is the mildest issue
(the levelled target), "starts at full level" a small click under the attack.

| File | Kind | Format (kHz, ch, kbps) | KB | Length ms | Lead / onset ms | Peak / true peak dBFS | LUFS (Δ target) | Loop join | Result |
|---|---|---|---:|---:|---|---|---|---|---|
| music_alleyroll.mp3 | bed | 44.1k st 128 | 859 | 53609 | 0 / 0 | -6.8 / -6.6 | -18.5 (-0.1) | step ×0.19, slope ×0.4; level +1.2 / +1.0 dB | pass |
| music_bastion.mp3 | bed | 44.1k st 128 | 961 | 60029 | 8 / 23 | -4.7 / -4.7 | -18.4 (+0.1) | step ×0.04, slope ×0.1; level +1.7 / -1.6 dB | **issue:** app trims 8 ms quiet head |
| music_beat.mp3 | bed | 44.1k st 192 | 1444 | 60087 | 0 / 1 | -7.6 / -7.4 | -20.6 (-2.2) | groove 8–56 s: step ×0.18; level +6.8 / +1.6 dB (whole-file join not used) | **issue:** quiet -2.2 dB |
| music_blockfall.mp3 | bed | 44.1k st 128 | 847 | 52870 | 0 / 0 | -6.4 / -6.4 | -18.5 (-0.1) | step ×0.21, slope ×0.5; level +1.1 / +0.1 dB | pass |
| music_cross.mp3 | bed | 44.1k st 128 | 961 | 60029 | 7 / 16 | -6.3 / -6.3 | -18.5 (-0.1) | step ×0.03, slope ×0.0; level +8.7 / +4.8 dB | **issue:** level jump at join; app trims 7 ms quiet head |
| music_curling.mp3 | bed | 44.1k st 128 | 630 | 39317 | 0 / 0 | -5.4 / -5.4 | -18.5 (-0.1) | step ×0.23, slope ×0.4; level +8.6 / -0.7 dB | pass |
| music_freecell.mp3 | bed | 44.1k st 128 | 759 | 47400 | 0 / 0 | -4.6 / -4.6 | -18.4 (+0.1) | step ×1.06, slope ×0.2; level -3.0 / -1.5 dB | pass |
| music_freekick.mp3 | bed | 44.1k st 128 | 860 | 53705 | 0 / 0 | -6.9 / -6.9 | -18.4 (+0.1) | step ×0.87, slope ×0.4; level +1.4 / -0.2 dB | pass |
| music_homerun.mp3 | bed | 44.1k st 128 | 833 | 52002 | 0 / 0 | -5.6 / -5.5 | -18.4 (+0.1) | step ×0.13, slope ×0.0; level +4.8 / +2.6 dB | pass |
| music_mahjong.mp3 | bed | 44.1k st 128 | 769 | 48036 | 0 / 0 | -3.6 / -3.6 | -18.4 (+0.1) | step ×0.60, slope ×0.2; level +4.0 / -0.2 dB | pass |
| music_matchup.mp3 | bed | 44.1k st 128 | 874 | 54545 | 0 / 0 | -4.9 / -4.8 | -18.5 (-0.1) | step ×0.15, slope ×0.1; level +6.7 / +2.4 dB | pass |
| music_menu.mp3 | bed | 44.1k st 128 | 616 | 38401 | 0 / 0 | -7.7 / -7.7 | -20.5 (-2.1) | step ×0.17, slope ×0.3; level -3.5 / -2.5 dB | **issue:** quiet -2.1 dB |
| music_minesweeper.mp3 | bed | 44.1k st 128 | 896 | 55920 | 0 / 0 | -3.1 / -3.1 | -18.4 (+0.1) | step ×0.08, slope ×0.3; level +1.3 / -0.4 dB | pass |
| music_minigolf.mp3 | bed | 44.1k st 128 | 836 | 52190 | 0 / 0 | -4.7 / -4.7 | -18.5 (-0.1) | step ×0.08, slope ×0.1; level +1.8 / +1.3 dB | pass |
| music_pinball.mp3 | bed | 44.1k st 128 | 738 | 46080 | 0 / 0 | -7.5 / -7.5 | -20.4 (-1.9) | step ×0.04, slope ×0.2; level +1.6 / +0.2 dB | pass |
| music_pokersquares.mp3 | bed | 44.1k st 128 | 884 | 55217 | 0 / 0 | -5.9 / -5.9 | -18.5 (-0.1) | step ×0.33, slope ×0.1; level -1.1 / -0.5 dB | pass |
| music_pool.mp3 | bed | 44.1k st 128 | 787 | 49097 | 0 / 0 | -6.8 / -6.8 | -18.4 (+0.1) | step ×0.01, slope ×0.1; level +6.8 / +4.1 dB | **issue:** level jump at join |
| music_racing.mp3 | bed | 44.1k st 128 | 897 | 55983 | 0 / 0 | -6.5 / -6.4 | -18.4 (+0.1) | step ×0.23, slope ×0.2; level +3.4 / -0.1 dB | pass |
| music_ricochet.mp3 | bed | 44.1k st 128 | 961 | 60029 | 7 / 22 | -5.2 / -5.1 | -18.5 (-0.1) | step ×0.11, slope ×0.1; level +11.3 / +7.7 dB | **issue:** level jump at join; app trims 7 ms quiet head; quiet ends |
| music_tripeaks.mp3 | bed | 44.1k st 128 | 893 | 55724 | 0 / 1 | -6.1 / -6.1 | -18.5 (-0.1) | step ×0.03, slope ×0.0; level +5.3 / +3.0 dB | pass |
| alleyroll.rolling.mp3 | loop | 44.1k mo 96 | 25 | 2000 | 0 / 0 | -1.4 / -1.4 | -16.8 (+0.0) | step ×0.16, slope ×0.2; level +0.5 / +0.9 dB | pass |
| bastion.drone.mp3 | loop | 44.1k mo 96 | 25 | 2000 | 0 / 0 | -1.5 / -0.9 | -16.8 (+0.0) | step ×0.44, slope ×0.4; level +1.4 / +1.5 dB | **issue:** true peak above -1 |
| bintoss.ambience.mp3 | loop | 44.1k st 128 | 129 | 8000 | 0 / 0 | -4.3 / -4.2 | -18.5 (-1.7) | step ×0.41, slope ×0.2; level +1.3 / +0.8 dB | pass |
| bullseye.ambience.mp3 | loop | 44.1k st 128 | 129 | 8000 | 0 / 0 | -5.7 / -5.7 | -18.4 (-1.6) | step ×0.35, slope ×0.7; level -0.6 / -0.1 dB | pass |
| curling_slide_loop.mp3 | loop | 44.1k mo 96 | 27 | 2177 | 0 / 0 | -1.4 / -1.4 | -20.1 (-3.3) | step ×0.08, slope ×0.4; level +2.7 / +2.1 dB | **issue:** quiet -3.3 dB |
| curling_sweep_loop.mp3 | loop | 44.1k mo 96 | 19 | 1508 | 0 / 0 | -1.6 / -1.6 | -16.3 (+0.5) | step ×0.05, slope ×0.1; level -3.7 / -5.2 dB | **issue:** level jump at join |
| minigolf_roll_loop.mp3 | loop | 44.1k mo 96 | 17 | 1375 | 0 / 0 | -1.5 / -1.5 | -19.2 (-2.4) | step ×0.37, slope ×0.1; level -1.5 / -0.3 dB | **issue:** quiet -2.4 dB |
| racing_drive_loop.mp3 | loop | 44.1k st 128 | 40 | 2419 | 0 / 0 | -1.4 / -1.4 | -13.0 (+3.8) | step ×0.59, slope ×0.7; level +0.6 / +1.9 dB | **issue:** loud +3.8 dB |
| racing_grass_loop.mp3 | loop | 44.1k mo 96 | 9 | 726 | 0 / 0 | -1.8 / -1.7 | -17.8 (-1.0) | step ×0.86, slope ×0.4; level +0.6 / +1.7 dB | pass |
| racing_idle_loop.mp3 | loop | 44.1k st 128 | 38 | 2341 | 0 / 0 | -1.5 / -1.5 | -13.8 (+3.0) | step ×1.36, slope ×0.8; level +0.7 / -0.4 dB | **issue:** loud +3.0 dB; join discontinuity |
| racing_kerb_loop.mp3 | loop | 44.1k mo 96 | 9 | 672 | 0 / 0 | -1.8 / -1.7 | -17.7 (-0.9) | step ×0.18, slope ×0.1; level -5.1 / -0.5 dB | pass |
| ricochet.lanternRide.mp3 | loop | 44.1k mo 96 | 25 | 2000 | 0 / 0 | -1.4 / -1.4 | -16.8 (+0.0) | step ×0.34, slope ×0.1; level +1.1 / +0.3 dB | pass |
| sports_crowd_loop.mp3 | loop | 44.1k st 128 | 149 | 9271 | 0 / 0 | -1.3 / -1.3 | -20.8 (-4.0) | step ×0.52, slope ×0.0; level -1.0 / -0.3 dB | **issue:** quiet -4.0 dB |
| swing.jungle.mp3 | loop | 44.1k st 128 | 129 | 8000 | 0 / 0 | -5.1 / -5.0 | -18.5 (-1.7) | step ×0.46, slope ×0.3; level +1.2 / -0.8 dB | pass |
| swing.lava.mp3 | loop | 48k st 192 | 145 | 6000 | 0 / 0 | -1.8 / -1.8 | -14.9 (+1.9) | step ×1.48, slope ×5.8; level +0.2 / +1.2 dB | **issue:** join discontinuity |
| swing.slideVine.mp3 | loop | 44.1k mo 96 | 25 | 2000 | 0 / 0 | -1.2 / -0.7 | -20.6 (-3.8) | step ×0.16, slope ×0.2; level +0.4 / -2.3 dB | **issue:** quiet -3.8 dB; true peak above -1 |
| swing.wings.mp3 | loop | 44.1k mo 96 | 25 | 2000 | 0 / 474 | -1.0 / -1.0 | -23.0 (-6.2) | step ×0.02, slope ×0.0; level +1.6 / -3.5 dB | **issue:** quiet -6.2 dB; level jump at join; quiet ends |
| wavefront.danger.mp3 | loop | 48k st 192 | 55 | 2250 | 0 / 0 | -1.4 / -1.4 | -16.3 (+0.5) | step ×0.61, slope ×2.5; level -2.3 / -2.2 dB | **issue:** join discontinuity |
| round10.mp3 | voice | 44.1k st 192 | 70 | 2847 | 10 / 16 | -10.6 / -10.6 | -23.8 (+0.0) | – | pass |
| round11.mp3 | voice | 44.1k st 192 | 76 | 3101 | 11 / 29 | -13.3 / -13.3 | -23.8 (+0.0) | – | **issue:** lead silence 11 ms; tail silence 202 ms |
| round8.mp3 | voice | 44.1k st 192 | 68 | 2788 | 10 / 22 | -10.7 / -10.7 | -23.8 (+0.0) | – | pass |
| round9.mp3 | voice | 44.1k st 192 | 73 | 2988 | 10 / 18 | -12.6 / -12.6 | -23.8 (+0.0) | – | **issue:** tail silence 170 ms |
| voice.cleanSweep.mp3 | voice | 44.1k st 192 | 76 | 3110 | 10 / 13 | -13.6 / -13.6 | -23.8 (+0.0) | – | pass |
| voice.draw.mp3 | voice | 44.1k st 192 | 69 | 2802 | 10 / 24 | -12.7 / -12.7 | -23.8 (+0.0) | – | pass |
| voice.newBest.mp3 | voice | 44.1k st 192 | 80 | 3275 | 10 / 15 | -12.7 / -12.7 | -23.8 (+0.0) | – | pass |
| voice.newLeader.mp3 | voice | 44.1k st 192 | 70 | 2838 | 12 / 14 | -12.4 / -12.4 | -23.8 (+0.0) | – | **issue:** lead silence 12 ms; tail silence 249 ms |
| voice.perfect.mp3 | voice | 44.1k st 192 | 59 | 2395 | 65 / 83 | -10.0 / -10.0 | -24.6 (-0.8) | – | **issue:** lead silence 65 ms; tail silence 202 ms |
| voice.photoFinish.mp3 | voice | 44.1k st 192 | 77 | 3155 | 10 / 50 | -11.1 / -11.2 | -23.8 (+0.0) | – | **issue:** soft attack, peak-30 dB at 50 ms |
| voice.rematch.mp3 | voice | 44.1k st 192 | 64 | 2594 | 112 / 118 | -12.2 / -12.2 | -24.0 (-0.2) | – | **issue:** lead silence 112 ms |
| voice.tie.mp3 | voice | 44.1k st 192 | 71 | 2886 | 100 / 113 | -11.0 / -11.0 | -23.7 (+0.1) | – | **issue:** lead silence 100 ms |
| voice.timesUp.mp3 | voice | 44.1k st 192 | 68 | 2752 | 64 / 79 | -12.3 / -12.3 | -23.8 (+0.0) | – | **issue:** lead silence 64 ms |
| voice.youWin.mp3 | voice | 44.1k st 192 | 70 | 2823 | 110 / 114 | -12.6 / -12.5 | -23.1 (+0.7) | – | **issue:** lead silence 110 ms |
| alert.newHazard.mp3 | fx | 48k st 192 | 16 | 606 | 0 / 0 | -2.8 / -2.1 | -15.3 (+1.8) | – | **issue:** starts at full level, no fade-in |
| alleyroll.goldCup.mp3 | fx | 44.1k mo 96 | 15 | 1200 | 0 / 0 | -2.0 / -1.9 | -16.5 (+0.0) | – | **issue:** cut-off tail (last 10 ms -27 dBFS) |
| alleyroll.gutter.mp3 | fx | 44.1k mo 96 | 8 | 570 | 0 / 0 | -1.1 / -1.0 | -19.4 (-2.3) | – | **issue:** cut-off tail (last 10 ms -33 dBFS) |
| alleyroll.pocket.mp3 | fx | 44.1k mo 96 | 10 | 795 | 0 / 0 | -1.3 / -1.3 | -22.3 (-5.2) | – | **issue:** quiet -5.2 dB |
| alleyroll.ramp.mp3 | fx | 44.1k mo 96 | 7 | 480 | 0 / 137 | -1.1 / -1.1 | -20.4 (-2.9) | – | **issue:** soft attack, peak-30 dB at 137 ms |
| alleyroll.ring.mp3 | fx | 44.1k mo 96 | 5 | 357 | 0 / 0 | -1.0 / -1.0 | -25.6 (-8.1) | – | **issue:** quiet -8.1 dB; starts at full level, no fade-in |
| alleyroll.roll.mp3 | fx | 44.1k mo 96 | 6 | 456 | 3 / 9 | -1.1 / -1.0 | -22.1 (-4.6) | – | **issue:** quiet -4.6 dB |
| alleyroll.streak.mp3 | fx | 44.1k mo 96 | 9 | 679 | 0 / 0 | -2.9 / -2.9 | -17.1 (+0.0) | – | pass |
| any.final-second.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -4.4 / -4.4 | -16.4 (+1.1) | – | pass |
| any.final.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -2.4 / -2.3 | -16.2 (+1.3) | – | **issue:** starts at full level, no fade-in |
| arcade.wallThock.mp3 | fx | 48k st 192 | 3 | 60 | 0 / 1 | -1.3 / -1.2 | -24.7 (-2.0) | – | **issue:** cut-off tail (last 10 ms -37 dBFS) |
| arrow.whoosh.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | 1.1 / 1.1 | -12.7 (+4.8) | – | **issue:** loud +4.8 dB; true peak over 0 dBFS; clipped (2) |
| balance.level.mp3 | fx | 48k st 192 | 21 | 806 | 0 / 0 | -1.0 / -0.4 | -17.8 (-0.7) | – | **issue:** true peak above -1; starts at full level, no fade-in |
| balltrack.homeStreak.mp3 | fx | 48k st 192 | 13 | 479 | 0 / 0 | -1.0 / -1.0 | -17.7 (-0.2) | – | pass |
| banner.clear.mp3 | fx | 48k st 192 | 18 | 686 | 0 / 0 | 1.1 / 1.1 | -8.0 (+9.1) | – | **issue:** loud +9.1 dB; true peak over 0 dBFS; clipped (1); starts at full level, no fade-in |
| banner.combo.mp3 | fx | 48k st 192 | 16 | 606 | 0 / 0 | 0.8 / 0.8 | -10.2 (+6.9) | – | **issue:** loud +6.9 dB; true peak over 0 dBFS; clipped (19); starts at full level, no fade-in |
| banner.fullClear.mp3 | fx | 48k st 192 | 21 | 806 | 0 / 0 | 0.5 / 0.5 | -10.5 (+6.6) | – | **issue:** loud +6.6 dB; true peak over 0 dBFS; clipped (1); starts at full level, no fade-in |
| banner.streak.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | 0.9 / 1.0 | -9.7 (+7.8) | – | **issue:** loud +7.8 dB; true peak over 0 dBFS; clipped (1); starts at full level, no fade-in |
| bastion.baseHit.mp3 | fx | 44.1k mo 96 | 13 | 997 | 0 / 0 | -1.0 / -1.0 | -16.9 (-0.4) | – | pass |
| bastion.cannon.mp3 | fx | 44.1k mo 96 | 10 | 800 | 0 / 0 | -1.0 / -1.0 | -17.6 (-0.5) | – | **issue:** starts at full level, no fade-in; cut-off tail (last 10 ms -38 dBFS) |
| bastion.droneDown.mp3 | fx | 44.1k mo 96 | 10 | 800 | 0 / 0 | -2.6 / -0.8 | -17.6 (-0.5) | – | **issue:** true peak above -1; starts at full level, no fade-in; cut-off tail (last 10 ms -35 dBFS) |
| bastion.fastReload.mp3 | fx | 44.1k mo 96 | 5 | 367 | 0 / 0 | -1.2 / -1.0 | -21.6 (-4.1) | – | **issue:** quiet -4.1 dB |
| bastion.hit.mp3 | fx | 44.1k mo 96 | 7 | 480 | 0 / 0 | -1.3 / -1.1 | -17.7 (-0.2) | – | **issue:** starts at full level, no fade-in |
| bastion.jam.mp3 | fx | 44.1k mo 96 | 8 | 566 | 8 / 17 | -1.3 / -1.3 | -17.1 (+0.0) | – | **issue:** cut-off tail (last 10 ms -13 dBFS) |
| bastion.kill.mp3 | fx | 44.1k mo 96 | 15 | 1200 | 0 / 0 | -1.4 / -1.4 | -16.5 (+0.0) | – | **issue:** starts at full level, no fade-in; cut-off tail (last 10 ms -32 dBFS) |
| bastion.loaded.mp3 | fx | 44.1k mo 96 | 6 | 398 | 1 / 52 | -1.1 / -0.7 | -21.3 (-3.8) | – | **issue:** quiet -3.8 dB; true peak above -1; soft attack, peak-30 dB at 52 ms |
| bastion.miss.mp3 | fx | 44.1k mo 96 | 7 | 473 | 0 / 112 | -1.1 / -1.0 | -20.1 (-2.6) | – | **issue:** soft attack, peak-30 dB at 112 ms |
| bastion.reload.mp3 | fx | 44.1k mo 96 | 8 | 590 | 1 / 182 | -1.1 / -1.1 | -20.0 (-2.9) | – | **issue:** soft attack, peak-30 dB at 182 ms |
| bastion.wave.mp3 | fx | 44.1k mo 96 | 17 | 1342 | 0 / 0 | -4.7 / -4.7 | -16.5 (+0.0) | – | **issue:** cut-off tail (last 10 ms -17 dBFS) |
| bastion.weak.mp3 | fx | 44.1k mo 96 | 7 | 479 | 0 / 0 | -1.3 / -1.2 | -18.0 (-0.5) | – | **issue:** starts at full level, no fade-in |
| beat.miss.mp3 | fx | 48k st 192 | 5 | 150 | 0 / 0 | -1.3 / -1.3 | -18.0 (+4.7) | – | **issue:** loud +4.7 dB; starts at full level, no fade-in |
| beat.note8bit.mp3 | fx | 48k st 192 | 5 | 140 | 0 / 0 | -2.4 / -2.0 | -13.6 (+9.1) | – | **issue:** loud +9.1 dB; cut-off tail (last 10 ms -27 dBFS) |
| beat.swipe.mp3 | fx | 48k st 192 | 6 | 200 | 0 / 0 | -2.4 / -2.4 | -15.4 (+7.3) | – | **issue:** loud +7.3 dB; starts at full level, no fade-in |
| bintoss.wind.mp3 | fx | 44.1k mo 96 | 10 | 800 | 0 / 0 | -1.9 / -1.8 | -17.1 (+0.0) | – | **issue:** cut-off tail (last 10 ms -24 dBFS) |
| block.place.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 43 | 0.5 / 0.7 | -20.0 (-2.5) | – | **issue:** true peak over 0 dBFS; clipped (1); soft attack, peak-30 dB at 43 ms |
| blockfall.bigClear.mp3 | fx | 44.1k mo 96 | 15 | 1194 | 0 / 0 | -1.3 / -0.9 | -16.5 (+0.0) | – | **issue:** true peak above -1; starts at full level, no fade-in |
| blockfall.clear.mp3 | fx | 44.1k mo 96 | 8 | 599 | 0 / 0 | -3.6 / -3.5 | -17.1 (+0.0) | – | **issue:** starts at full level, no fade-in |
| blockfall.lock.mp3 | fx | 44.1k mo 96 | 7 | 477 | 0 / 0 | -1.5 / -0.9 | -20.2 (-2.7) | – | **issue:** true peak above -1; starts at full level, no fade-in |
| blockfall.move.mp3 | fx | 44.1k mo 96 | 2 | 122 | 0 / 0 | -1.7 / -1.7 | -22.7 (+0.0) | – | **issue:** starts at full level, no fade-in |
| blockfall.topOut.mp3 | fx | 44.1k mo 96 | 15 | 1200 | 0 / 0 | -1.4 / -1.4 | -16.5 (+0.0) | – | **issue:** starts at full level, no fade-in; cut-off tail (last 10 ms -9 dBFS) |
| blockfall.turn.mp3 | fx | 44.1k mo 96 | 3 | 216 | 0 / 0 | -3.8 / -3.8 | -22.7 (+0.0) | – | **issue:** starts at full level, no fade-in |
| bomb.cut.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -1.1 / -0.8 | -16.2 (+1.3) | – | **issue:** true peak above -1; starts at full level, no fade-in |
| bomb.defuse.mp3 | fx | 48k st 192 | 16 | 606 | 0 / 0 | -3.4 / -3.2 | -16.2 (+0.9) | – | pass |
| bomb.solve.mp3 | fx | 48k st 192 | 18 | 686 | 0 / 0 | -6.6 / -6.6 | -16.3 (+0.8) | – | **issue:** starts at full level, no fade-in |
| bonk.popUp.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -0.1 / -0.0 | -8.4 (+9.1) | – | **issue:** loud +9.1 dB; true peak above -1; starts at full level, no fade-in |
| breaker.rowClear.mp3 | fx | 48k st 192 | 18 | 680 | 0 / 0 | -4.2 / -4.0 | -17.1 (+0.0) | – | pass |
| breaker.slider.mp3 | fx | 48k st 192 | 8 | 250 | 0 / 0 | -4.1 / -4.1 | -16.2 (+1.3) | – | **issue:** starts at full level, no fade-in |
| breaker.tenBricks.mp3 | fx | 48k st 192 | 12 | 450 | 0 / 0 | -11.5 / -11.5 | -17.1 (+0.4) | – | **issue:** starts at full level, no fade-in |
| bubble.joker.mp3 | fx | 48k st 192 | 18 | 680 | 0 / 0 | -1.2 / -1.2 | -16.3 (+0.8) | – | **issue:** starts at full level, no fade-in |
| bubble.rush.mp3 | fx | 48k st 192 | 23 | 886 | 0 / 0 | -2.6 / -2.6 | -16.3 (+0.8) | – | pass |
| bubble.seaMine.mp3 | fx | 48k st 192 | 17 | 662 | 0 / 0 | -2.0 / -2.0 | -17.0 (+0.1) | – | pass |
| bubble.torpedo.mp3 | fx | 48k st 192 | 16 | 600 | 0 / 0 | -3.1 / -3.1 | -17.0 (+0.1) | – | **issue:** starts at full level, no fade-in |
| burst.atomsDrop.mp3 | fx | 48k st 192 | 12 | 450 | 0 / 0 | -6.6 / -6.6 | -16.3 (+1.2) | – | **issue:** starts at full level, no fade-in |
| burst.waveCleared.mp3 | fx | 48k st 192 | 18 | 686 | 0 / 0 | -9.0 / -8.9 | -17.5 (-0.4) | – | pass |
| cards_deal.mp3 | fx | 44.1k mo 96 | 3 | 220 | 0 / 2 | -1.5 / -1.3 | -25.3 (-2.6) | – | pass |
| cards_home.mp3 | fx | 44.1k mo 96 | 6 | 406 | 0 / 2 | -1.5 / -1.5 | -29.1 (-11.6) | – | **issue:** quiet -11.6 dB |
| cards_invalid.mp3 | fx | 44.1k mo 96 | 6 | 434 | 0 / 3 | -6.9 / -6.8 | -28.8 (-11.3) | – | **issue:** quiet -11.3 dB |
| cards_pick.mp3 | fx | 44.1k mo 96 | 5 | 334 | 0 / 2 | -1.4 / -1.3 | -15.9 (+1.6) | – | pass |
| cards_place.mp3 | fx | 44.1k mo 96 | 4 | 300 | 0 / 2 | -1.4 / -1.3 | -26.1 (-8.6) | – | **issue:** quiet -8.6 dB |
| cards_shuffle.mp3 | fx | 44.1k mo 96 | 14 | 1093 | 0 / 3 | -1.4 / -1.3 | -30.0 (-13.5) | – | **issue:** quiet -13.5 dB |
| cave.lavaBubble.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 1 | -1.6 / -1.6 | -17.2 (+0.3) | – | pass |
| cave.lavaErupt.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | 0.2 / 0.3 | -13.6 (+3.9) | – | **issue:** loud +3.9 dB; true peak over 0 dBFS; starts at full level, no fade-in; cut-off tail (last 10 ms -35 dBFS) |
| cave.rockCrumble.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 1 | -6.3 / -6.3 | -27.6 (-10.1) | – | **issue:** quiet -10.1 dB |
| cave.stoneCrack.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 8 | 0.3 / 0.3 | -22.0 (-4.5) | – | **issue:** quiet -4.5 dB; true peak over 0 dBFS |
| chain.breakTone.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -2.9 / -2.9 | -16.4 (+1.1) | – | pass |
| chain.linkTone.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -2.5 / -2.2 | -16.2 (+1.3) | – | **issue:** starts at full level, no fade-in; cut-off tail (last 10 ms -32 dBFS) |
| checkout.thud.mp3 | fx | 48k st 192 | 16 | 606 | 0 / 0 | -0.3 / -0.2 | -18.6 (-1.5) | – | **issue:** true peak above -1; starts at full level, no fade-in; cut-off tail (last 10 ms -35 dBFS) |
| clay.launch.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | 1.1 / 1.2 | -12.4 (+5.1) | – | **issue:** loud +5.1 dB; true peak over 0 dBFS |
| clay.missPuff.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -31.2 / -31.2 | -48.3 (-30.8) | – | **issue:** quiet -30.8 dB |
| clayshoot.birdIn.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -8.8 / -8.8 | -27.1 (-9.6) | – | **issue:** quiet -9.6 dB |
| clayshoot.birdStartle.mp3 | fx | 48k st 192 | 16 | 606 | 0 / 0 | -0.8 / -0.8 | -19.0 (-1.9) | – | **issue:** true peak above -1 |
| clayshoot.finalBurst.mp3 | fx | 48k st 192 | 27 | 1080 | 0 / 0 | -3.8 / -3.1 | -16.4 (+0.1) | – | pass |
| combo.lost.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -0.8 / -0.5 | -12.8 (+4.7) | – | **issue:** loud +4.7 dB; true peak above -1; starts at full level, no fade-in |
| countup.countersTick.mp3 | fx | 48k st 192 | 25 | 1000 | 0 / 0 | -1.1 / 0.1 | -16.5 (+0.0) | – | **issue:** true peak over 0 dBFS; starts at full level, no fade-in; cut-off tail (last 10 ms -27 dBFS) |
| countup.trayIn.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -1.2 / -0.8 | -17.2 (+0.3) | – | **issue:** true peak above -1; starts at full level, no fade-in |
| cross.closeCall.mp3 | fx | 44.1k mo 96 | 3 | 223 | 0 / 0 | -1.2 / -1.2 | -23.0 (-0.3) | – | **issue:** starts at full level, no fade-in |
| cross.crossed.mp3 | fx | 44.1k mo 96 | 8 | 607 | 0 / 0 | -1.5 / -1.3 | -17.1 (+0.0) | – | **issue:** cut-off tail (last 10 ms -13 dBFS) |
| cross.freighter.mp3 | fx | 44.1k mo 96 | 17 | 1350 | 10 / 60 | -1.9 / -1.9 | -16.5 (+0.0) | – | **issue:** soft attack, peak-30 dB at 60 ms; cut-off tail (last 10 ms -21 dBFS) |
| cross.hop.mp3 | fx | 44.1k mo 96 | 7 | 487 | 0 / 0 | -1.2 / -1.2 | -17.5 (+0.0) | – | **issue:** cut-off tail (last 10 ms -9 dBFS) |
| cross.lifeLost.mp3 | fx | 44.1k mo 96 | 5 | 350 | 0 / 0 | -1.2 / -1.0 | -18.5 (-1.0) | – | pass |
| cross.pastBikes.mp3 | fx | 44.1k mo 96 | 7 | 480 | 0 / 0 | -1.2 / -0.4 | -17.5 (+0.0) | – | **issue:** true peak above -1 |
| cross.pastRoadworks.mp3 | fx | 44.1k mo 96 | 6 | 464 | 1 / 37 | -2.5 / -2.5 | -17.5 (+0.0) | – | **issue:** soft attack, peak-30 dB at 37 ms |
| cross.streakUp.mp3 | fx | 44.1k mo 96 | 8 | 607 | 0 / 0 | -1.2 / -1.2 | -17.1 (+0.0) | – | **issue:** cut-off tail (last 10 ms -14 dBFS) |
| cups.shuffle.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -3.7 / -3.6 | -19.9 (-2.4) | – | pass |
| curling_applause.mp3 | fx | 44.1k mo 96 | 25 | 1995 | 0 / 2 | -1.5 / -1.4 | -17.7 (-1.2) | – | pass |
| curling_board.mp3 | fx | 44.1k mo 96 | 6 | 400 | 0 / 1 | -1.4 / -1.4 | -27.2 (-9.7) | – | **issue:** quiet -9.7 dB |
| curling_hit.mp3 | fx | 44.1k mo 96 | 6 | 400 | 0 / 0 | -1.4 / -1.3 | -26.1 (-8.6) | – | **issue:** quiet -8.6 dB |
| curling_release.mp3 | fx | 44.1k mo 96 | 7 | 484 | 0 / 2 | -1.4 / -1.4 | -16.9 (+0.6) | – | pass |
| curling_shot.mp3 | fx | 44.1k mo 96 | 13 | 998 | 0 / 0 | -1.6 / -1.6 | -15.7 (+0.8) | – | pass |
| done.chimeSweep.mp3 | fx | 48k st 192 | 25 | 1000 | 0 / 0 | -7.9 / -7.7 | -16.3 (+0.2) | – | pass |
| done.corks.mp3 | fx | 48k st 192 | 27 | 1080 | 0 / 0 | -2.9 / -2.9 | -16.2 (+0.3) | – | **issue:** starts at full level, no fade-in; tail silence 282 ms |
| done.glowSweep.mp3 | fx | 48k st 192 | 25 | 1000 | 0 / 0 | -4.9 / -4.9 | -16.2 (+0.3) | – | pass |
| done.goldPulse.mp3 | fx | 48k st 192 | 25 | 1000 | 0 / 0 | -0.6 / -0.5 | -18.8 (-2.3) | – | **issue:** true peak above -1; starts at full level, no fade-in |
| done.pops.mp3 | fx | 48k st 192 | 25 | 1000 | 0 / 0 | -4.1 / -4.1 | -16.3 (+0.2) | – | pass |
| done.rising.mp3 | fx | 48k st 192 | 27 | 1080 | 0 / 0 | -1.8 / -1.8 | -16.3 (+0.2) | – | **issue:** starts at full level, no fade-in |
| done.spinUp.mp3 | fx | 48k st 192 | 27 | 1080 | 0 / 0 | -5.8 / -5.8 | -16.3 (+0.2) | – | pass |
| done.tileFlip.mp3 | fx | 48k st 192 | 25 | 1000 | 0 / 0 | -5.5 / -5.5 | -16.3 (+0.2) | – | **issue:** starts at full level, no fade-in |
| flip.tenSeconds.mp3 | fx | 48k st 192 | 13 | 480 | 0 / 0 | -4.4 / -4.4 | -16.2 (+1.3) | – | **issue:** starts at full level, no fade-in |
| flip.tunnelRush.mp3 | fx | 48k st 192 | 11 | 390 | 0 / 0 | -4.0 / -4.0 | -16.2 (+1.3) | – | pass |
| flow.connect.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -3.7 / -3.6 | -16.4 (+1.1) | – | pass |
| freecell_cascade.mp3 | fx | 44.1k mo 96 | 12 | 948 | 0 / 3 | -1.6 / -1.6 | -29.5 (-13.0) | – | **issue:** quiet -13.0 dB |
| freecell_win.mp3 | fx | 44.1k mo 96 | 17 | 1362 | 0 / 1 | -1.5 / -1.5 | -20.2 (-3.7) | – | **issue:** quiet -3.7 dB |
| freekick_kick.mp3 | fx | 44.1k mo 96 | 4 | 300 | 0 / 3 | -1.4 / -1.4 | -21.8 (-4.3) | – | **issue:** quiet -4.3 dB |
| freekick_net.mp3 | fx | 44.1k mo 96 | 9 | 698 | 1 / 2 | -1.7 / -1.6 | -19.2 (-2.1) | – | pass |
| freekick_post.mp3 | fx | 44.1k mo 96 | 8 | 604 | 0 / 0 | -1.6 / -1.6 | -18.7 (-1.6) | – | pass |
| freekick_save.mp3 | fx | 44.1k mo 96 | 2 | 130 | 0 / 2 | -1.5 / -1.5 | -23.9 (-1.2) | – | pass |
| freekick_target.mp3 | fx | 44.1k mo 96 | 8 | 600 | 0 / 0 | -1.1 / -1.0 | -15.9 (+1.2) | – | pass |
| freekick_wall.mp3 | fx | 44.1k mo 96 | 4 | 300 | 0 / 3 | -1.4 / -1.4 | -21.3 (-3.8) | – | **issue:** quiet -3.8 dB |
| freekick_whistle.mp3 | fx | 44.1k mo 96 | 9 | 683 | 0 / 1 | -3.4 / -3.4 | -12.7 (+4.4) | – | **issue:** loud +4.4 dB |
| gem.crossBeam.mp3 | fx | 48k st 192 | 12 | 450 | 0 / 0 | -4.8 / -4.4 | -17.1 (+0.4) | – | **issue:** starts at full level, no fade-in |
| gem.forge.mp3 | fx | 48k st 192 | 18 | 680 | 0 / 0 | -6.2 / -6.1 | -18.1 (-1.0) | – | pass |
| gem.glint.mp3 | fx | 48k st 192 | 9 | 300 | 0 / 0 | -2.0 / -1.3 | -16.3 (+1.2) | – | **issue:** starts at full level, no fade-in |
| gem.jackpot.mp3 | fx | 48k st 192 | 30 | 1200 | 0 / 0 | -6.9 / -6.5 | -18.4 (-1.9) | – | **issue:** starts at full level, no fade-in |
| gem.parSmashed.mp3 | fx | 48k st 192 | 34 | 1360 | 0 / 0 | -8.5 / -8.0 | -18.6 (-2.1) | – | **issue:** tail silence 272 ms |
| gem.pick.mp3 | fx | 48k st 192 | 4 | 80 | 0 / 0 | -1.7 / -1.5 | -15.3 (+7.4) | – | **issue:** loud +7.4 dB; cut-off tail (last 10 ms -21 dBFS) |
| gem.refuse.mp3 | fx | 48k st 192 | 8 | 280 | 0 / 2 | -1.3 / -1.1 | -26.8 (-9.3) | – | **issue:** quiet -9.3 dB |
| gem.shatter.mp3 | fx | 48k st 192 | 11 | 400 | 0 / 0 | -3.7 / -3.6 | -16.3 (+1.2) | – | **issue:** starts at full level, no fade-in |
| gem.starBurst.mp3 | fx | 48k st 192 | 21 | 800 | 0 / 0 | -5.6 / -5.1 | -17.1 (+0.0) | – | **issue:** starts at full level, no fade-in |
| gem.swap.mp3 | fx | 48k st 192 | 6 | 200 | 0 / 0 | -4.0 / -3.7 | -16.3 (+6.4) | – | **issue:** loud +6.4 dB |
| gravity.lock.mp3 | fx | 48k st 192 | 6 | 201 | 0 / 0 | -1.9 / -1.6 | -22.6 (+0.1) | – | pass |
| homerun_crack.mp3 | fx | 44.1k mo 96 | 2 | 106 | 0 / 0 | -1.7 / -1.6 | -23.6 (-0.9) | – | pass |
| homerun_foul.mp3 | fx | 44.1k mo 96 | 4 | 300 | 0 / 0 | -1.5 / -1.5 | -25.1 (-7.6) | – | **issue:** quiet -7.6 dB |
| homerun_mitt.mp3 | fx | 44.1k mo 96 | 6 | 400 | 0 / 0 | -1.3 / -1.3 | -23.1 (-5.6) | – | **issue:** quiet -5.6 dB |
| homerun_organ.mp3 | fx | 44.1k mo 96 | 19 | 1512 | 0 / 0 | -2.8 / -2.8 | -17.1 (-0.6) | – | pass |
| homerun_pitch.mp3 | fx | 44.1k mo 96 | 4 | 259 | 0 / 3 | -1.5 / -1.5 | -21.5 (-4.0) | – | **issue:** quiet -4.0 dB |
| homerun_sign.mp3 | fx | 44.1k mo 96 | 13 | 994 | 0 / 3 | -1.2 / -1.2 | -24.2 (-7.7) | – | **issue:** quiet -7.7 dB; tail silence 256 ms |
| homerun_whiff.mp3 | fx | 44.1k mo 96 | 6 | 400 | 0 / 1 | -1.4 / -1.4 | -20.5 (-3.0) | – | pass |
| hover.slipPast.mp3 | fx | 48k st 192 | 10 | 350 | 0 / 0 | -4.7 / -4.3 | -17.0 (+0.5) | – | **issue:** starts at full level, no fade-in |
| hover.splitGap.mp3 | fx | 48k st 192 | 9 | 300 | 0 / 0 | -5.0 / -5.0 | -16.4 (+1.1) | – | pass |
| hover.zone.mp3 | fx | 48k st 192 | 13 | 481 | 0 / 0 | -6.4 / -6.4 | -17.7 (-0.2) | – | pass |
| iceslide.crack.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -1.3 / -1.1 | -21.5 (-4.0) | – | **issue:** quiet -4.0 dB |
| iceslide.fall.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -11.4 / -11.4 | -16.3 (+1.2) | – | pass |
| iceslide.portal.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -3.9 / -3.3 | -16.5 (+1.0) | – | pass |
| iceslide.solve.mp3 | fx | 48k st 192 | 30 | 1200 | 0 / 0 | -1.1 / -0.8 | -18.0 (-1.5) | – | **issue:** true peak above -1 |
| inkbridge.cloudBounce.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -17.2 / -17.1 | -42.4 (-24.9) | – | **issue:** quiet -24.9 dB |
| laser.bomb.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -1.0 / -0.6 | -16.8 (+0.7) | – | **issue:** true peak above -1; starts at full level, no fade-in |
| laser.solve.mp3 | fx | 48k st 192 | 27 | 1080 | 0 / 0 | -9.2 / -9.2 | -16.4 (+0.1) | – | pass |
| mahjong_clear.mp3 | fx | 44.1k mo 96 | 23 | 1806 | 0 / 1 | -1.5 / -1.5 | -20.8 (-4.3) | – | **issue:** quiet -4.3 dB |
| mahjong_invalid.mp3 | fx | 44.1k mo 96 | 4 | 300 | 0 / 0 | -1.5 / -1.4 | -21.6 (-4.1) | – | **issue:** quiet -4.1 dB |
| mahjong_match.mp3 | fx | 44.1k mo 96 | 5 | 359 | 0 / 2 | -1.2 / -1.1 | -23.8 (-6.3) | – | **issue:** quiet -6.3 dB |
| mahjong_select.mp3 | fx | 44.1k mo 96 | 3 | 200 | 0 / 2 | -1.5 / -1.5 | -25.8 (-3.1) | – | **issue:** quiet -3.1 dB |
| mahjong_shuffle.mp3 | fx | 44.1k mo 96 | 13 | 1043 | 0 / 3 | -1.5 / -1.4 | -32.7 (-16.2) | – | **issue:** quiet -16.2 dB |
| marble.release.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 8 | -3.4 / -3.3 | -23.1 (-5.6) | – | **issue:** quiet -5.6 dB |
| mines_cascade.mp3 | fx | 44.1k mo 96 | 8 | 604 | 0 / 0 | -1.6 / -1.6 | -21.3 (-4.2) | – | **issue:** quiet -4.2 dB |
| mines_clear.mp3 | fx | 44.1k mo 96 | 13 | 998 | 0 / 0 | -1.1 / -0.7 | -16.8 (-0.3) | – | **issue:** true peak above -1 |
| mines_flag.mp3 | fx | 44.1k mo 96 | 4 | 300 | 0 / 0 | -1.4 / -1.4 | -23.5 (-6.0) | – | **issue:** quiet -6.0 dB |
| mines_hit.mp3 | fx | 44.1k mo 96 | 7 | 474 | 0 / 0 | -5.1 / -5.1 | -27.4 (-9.9) | – | **issue:** quiet -9.9 dB |
| mines_reveal.mp3 | fx | 44.1k mo 96 | 2 | 80 | 0 / 2 | -1.6 / -1.1 | -23.7 (-1.0) | – | pass |
| mines_unflag.mp3 | fx | 44.1k mo 96 | 5 | 350 | 0 / 1 | -1.5 / -1.5 | -20.2 (-2.7) | – | pass |
| minigolf_birdie.mp3 | fx | 44.1k mo 96 | 13 | 994 | 0 / 3 | -1.4 / -1.4 | -15.4 (+1.1) | – | pass |
| minigolf_bush.mp3 | fx | 44.1k mo 96 | 6 | 439 | 0 / 2 | -1.5 / -1.1 | -18.1 (-0.6) | – | pass |
| minigolf_cup.mp3 | fx | 44.1k mo 96 | 10 | 733 | 0 / 2 | -1.6 / -1.6 | -29.2 (-12.1) | – | **issue:** quiet -12.1 dB |
| minigolf_putt.mp3 | fx | 44.1k mo 96 | 6 | 400 | 0 / 1 | -1.5 / -1.5 | -28.5 (-11.0) | – | **issue:** quiet -11.0 dB |
| minigolf_rail.mp3 | fx | 44.1k mo 96 | 4 | 300 | 0 / 2 | -1.4 / -1.4 | -26.1 (-8.6) | – | **issue:** quiet -8.6 dB |
| minigolf_splash.mp3 | fx | 44.1k mo 96 | 10 | 803 | 0 / 0 | -2.0 / -0.9 | -22.9 (-5.8) | – | **issue:** quiet -5.8 dB; true peak above -1 |
| minigolf_stone.mp3 | fx | 44.1k mo 96 | 4 | 300 | 0 / 3 | -1.4 / -1.3 | -28.6 (-11.1) | – | **issue:** quiet -11.1 dB |
| move.appear.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -13.6 / -13.5 | -29.2 (-11.7) | – | **issue:** quiet -11.7 dB |
| move.combine.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -0.4 / -0.4 | -19.0 (-1.5) | – | **issue:** true peak above -1; starts at full level, no fade-in |
| move.slide.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 17 | -4.4 / -4.4 | -21.7 (-4.2) | – | **issue:** quiet -4.2 dB |
| move.softFall.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -16.6 / -16.4 | -30.7 (-13.2) | – | **issue:** quiet -13.2 dB; starts at full level, no fade-in |
| orbit.blackHole.mp3 | fx | 48k st 192 | 27 | 1080 | 0 / 0 | -8.5 / -8.5 | -18.5 (-2.0) | – | pass |
| orbit.planetCatch.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -8.7 / -8.7 | -23.2 (-5.7) | – | **issue:** quiet -5.7 dB; starts at full level, no fade-in |
| orbit.shootingStar.mp3 | fx | 48k st 192 | 21 | 806 | 0 / 0 | -0.6 / -0.3 | -11.9 (+5.2) | – | **issue:** loud +5.2 dB; true peak above -1 |
| pinball.ballLost.mp3 | fx | 48k st 192 | 16 | 587 | 0 / 0 | -9.8 / -9.8 | -16.2 (+0.9) | – | **issue:** starts at full level, no fade-in |
| pinball.bankComplete.mp3 | fx | 48k st 192 | 16 | 606 | 0 / 0 | -1.0 / -1.0 | -17.2 (-0.1) | – | pass |
| pinball.bumperHit.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -0.8 / -0.2 | -16.6 (+0.9) | – | **issue:** true peak above -1; starts at full level, no fade-in |
| pinball.dropTarget.mp3 | fx | 48k st 192 | 12 | 454 | 0 / 0 | -1.1 / -1.1 | -16.5 (+1.0) | – | pass |
| pinball.flipper.mp3 | fx | 48k st 192 | 13 | 482 | 0 / 22 | -1.1 / -0.3 | -17.3 (+0.2) | – | **issue:** true peak above -1 |
| pinball.gameOver.mp3 | fx | 48k st 192 | 40 | 1600 | 0 / 0 | -0.3 / -0.2 | -12.5 (+4.0) | – | **issue:** loud +4.0 dB; true peak above -1; starts at full level, no fade-in |
| pinball.laneLight.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -5.8 / -5.6 | -16.3 (+1.2) | – | pass |
| pinball.lastBall.mp3 | fx | 48k st 192 | 21 | 806 | 0 / 0 | -20.1 / -19.9 | -27.9 (-10.8) | – | **issue:** quiet -10.8 dB |
| pinball.launch.mp3 | fx | 48k st 192 | 12 | 428 | 0 / 0 | -1.2 / -1.1 | -16.2 (+1.3) | – | pass |
| pinball.sling.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -1.2 / -1.1 | -21.7 (-4.2) | – | **issue:** quiet -4.2 dB; starts at full level, no fade-in |
| pinball.spinner.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -2.0 / -1.0 | -16.2 (+1.3) | – | pass |
| pinball.spinnerRip.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 3 | -1.2 / -0.9 | -18.4 (-0.9) | – | **issue:** true peak above -1 |
| pinball.start.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -2.9 / -2.8 | -16.3 (+1.2) | – | pass |
| pipes.flow.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -3.0 / -3.0 | -16.3 (+1.2) | – | pass |
| pipes.solve.mp3 | fx | 48k st 192 | 30 | 1200 | 0 / 0 | -3.7 / -3.7 | -16.3 (+0.2) | – | pass |
| poker_big_hand.mp3 | fx | 44.1k mo 96 | 14 | 1122 | 0 / 1 | -3.5 / -3.5 | -17.5 (-1.0) | – | pass |
| poker_final.mp3 | fx | 44.1k mo 96 | 13 | 983 | 0 / 2 | -3.0 / -3.0 | -17.5 (-1.0) | – | pass |
| poker_hand.mp3 | fx | 44.1k mo 96 | 7 | 484 | 0 / 0 | -4.3 / -4.2 | -17.6 (-0.1) | – | pass |
| pool_ball_click.mp3 | fx | 44.1k mo 96 | 3 | 200 | 0 / 2 | -1.7 / -1.7 | -21.7 (+1.0) | – | pass |
| pool_black_win.mp3 | fx | 44.1k mo 96 | 17 | 1327 | 0 / 0 | -3.1 / -3.1 | -16.8 (-0.3) | – | pass |
| pool_chalk.mp3 | fx | 44.1k mo 96 | 10 | 733 | 0 / 2 | -1.6 / -1.6 | -24.0 (-6.9) | – | **issue:** quiet -6.9 dB; cut-off tail (last 10 ms -33 dBFS) |
| pool_cue_hard.mp3 | fx | 44.1k mo 96 | 6 | 400 | 0 / 1 | -1.5 / -1.3 | -26.2 (-8.7) | – | **issue:** quiet -8.7 dB |
| pool_cue_soft.mp3 | fx | 44.1k mo 96 | 6 | 400 | 0 / 1 | -1.1 / -1.0 | -21.3 (-3.8) | – | **issue:** quiet -3.8 dB |
| pool_cushion.mp3 | fx | 44.1k mo 96 | 4 | 300 | 0 / 2 | -1.4 / -1.4 | -23.2 (-5.7) | – | **issue:** quiet -5.7 dB |
| pool_foul.mp3 | fx | 44.1k mo 96 | 7 | 484 | 0 / 0 | -2.6 / -2.5 | -15.5 (+2.0) | – | **issue:** cut-off tail (last 10 ms -30 dBFS) |
| pool_pocket.mp3 | fx | 44.1k mo 96 | 12 | 908 | 0 / 3 | -1.3 / -1.3 | -23.8 (-7.3) | – | **issue:** quiet -7.3 dB |
| pop.bonus.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -0.5 / -0.5 | -16.5 (+1.0) | – | **issue:** true peak above -1 |
| pop.perfect.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -15.7 / -15.7 | -28.6 (-11.1) | – | **issue:** quiet -11.1 dB |
| push.home.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -1.3 / -1.3 | -17.4 (+0.1) | – | **issue:** starts at full level, no fade-in |
| push.solve.mp3 | fx | 48k st 192 | 29 | 1147 | 0 / 0 | -1.1 / -1.1 | -16.9 (-0.4) | – | **issue:** starts at full level, no fade-in |
| racing_bump.mp3 | fx | 44.1k mo 96 | 8 | 604 | 0 / 1 | -1.4 / -1.3 | -17.1 (+0.0) | – | pass |
| racing_flag.mp3 | fx | 44.1k mo 96 | 17 | 1357 | 0 / 0 | -1.8 / -1.8 | -17.1 (-0.6) | – | pass |
| racing_go.mp3 | fx | 44.1k mo 96 | 6 | 469 | 0 / 2 | -2.9 / -2.9 | -16.4 (+1.1) | – | pass |
| racing_lap.mp3 | fx | 44.1k mo 96 | 10 | 800 | 0 / 0 | -4.8 / -4.8 | -16.0 (+1.1) | – | pass |
| racing_light.mp3 | fx | 44.1k mo 96 | 3 | 155 | 0 / 0 | -7.8 / -7.8 | -18.1 (+4.6) | – | **issue:** loud +4.6 dB |
| racing_squeal.mp3 | fx | 44.1k mo 96 | 15 | 1197 | 0 / 0 | -3.1 / -3.1 | -16.3 (+0.2) | – | **issue:** cut-off tail (last 10 ms -36 dBFS) |
| rally.goldServe.mp3 | fx | 48k st 192 | 10 | 350 | 0 / 0 | -5.1 / -5.0 | -17.2 (+0.3) | – | pass |
| rally.padPlusThree.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -4.7 / -4.7 | -17.6 (-0.1) | – | **issue:** starts at full level, no fade-in |
| replay.end.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -1.0 / -0.7 | -18.1 (-0.6) | – | **issue:** true peak above -1; starts at full level, no fade-in |
| replay.moment.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -2.9 / -2.4 | -16.4 (+1.1) | – | pass |
| replay.rewind.mp3 | fx | 48k st 192 | 16 | 606 | 0 / 0 | -5.5 / -4.6 | -16.3 (+0.8) | – | pass |
| retro.appear.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | 0.1 / 0.1 | -7.3 (+10.2) | – | **issue:** loud +10.2 dB; true peak over 0 dBFS; starts at full level, no fade-in; cut-off tail (last 10 ms -13 dBFS) |
| retro.atomBounce.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -5.9 / -5.9 | -19.7 (-2.2) | – | **issue:** starts at full level, no fade-in |
| retro.brickBreak.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -3.8 / -3.7 | -23.8 (-6.3) | – | **issue:** quiet -6.3 dB; starts at full level, no fade-in |
| retro.enemyFire.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | 0.7 / 0.8 | -8.9 (+8.6) | – | **issue:** loud +8.6 dB; true peak over 0 dBFS; clipped (4); starts at full level, no fade-in |
| retro.itemDrop.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | 0.5 / 0.5 | -6.9 (+10.6) | – | **issue:** loud +10.6 dB; true peak over 0 dBFS; clipped (3); starts at full level, no fade-in |
| retro.powerDown.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | 1.0 / 1.2 | -6.3 (+11.2) | – | **issue:** loud +11.2 dB; true peak over 0 dBFS; clipped (31); starts at full level, no fade-in |
| retro.saucerEnter.mp3 | fx | 48k st 192 | 16 | 606 | 0 / 0 | -0.1 / -0.1 | -3.9 (+13.2) | – | **issue:** loud +13.2 dB; true peak above -1; starts at full level, no fade-in; cut-off tail (last 10 ms -17 dBFS) |
| retro.shieldBreak.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | 1.6 / 1.9 | -5.6 (+11.9) | – | **issue:** loud +11.9 dB; true peak over 0 dBFS; clipped (11); starts at full level, no fade-in; cut-off tail (last 10 ms -39 dBFS) |
| retro.wallBounce.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -8.9 / -8.8 | -26.4 (-8.9) | – | **issue:** quiet -8.9 dB; starts at full level, no fade-in; cut-off tail (last 10 ms -30 dBFS) |
| ricochet.doubleJump.mp3 | fx | 44.1k mo 96 | 7 | 473 | 10 / 29 | -1.3 / -1.3 | -18.5 (-1.0) | – | **issue:** soft attack, peak-30 dB at 29 ms |
| ricochet.flow.mp3 | fx | 44.1k mo 96 | 9 | 685 | 0 / 0 | -5.2 / -5.2 | -17.1 (+0.0) | – | **issue:** cut-off tail (last 10 ms -16 dBFS) |
| ricochet.hit.mp3 | fx | 44.1k mo 96 | 7 | 476 | 0 / 0 | -1.4 / -1.4 | -17.5 (+0.0) | – | **issue:** starts at full level, no fade-in |
| ricochet.land.mp3 | fx | 44.1k mo 96 | 6 | 396 | 5 / 12 | -1.2 / -1.0 | -19.4 (-1.9) | – | pass |
| ricochet.lanternGrab.mp3 | fx | 44.1k mo 96 | 6 | 429 | 0 / 43 | -1.0 / -0.9 | -24.4 (-6.9) | – | **issue:** quiet -6.9 dB; true peak above -1; soft attack, peak-30 dB at 43 ms |
| ricochet.leap.mp3 | fx | 44.1k mo 96 | 6 | 416 | 0 / 28 | -1.1 / -1.0 | -19.0 (-1.5) | – | **issue:** soft attack, peak-30 dB at 28 ms |
| ricochet.ledge.mp3 | fx | 44.1k mo 96 | 7 | 479 | 0 / 0 | -1.0 / -1.0 | -22.6 (-5.1) | – | **issue:** quiet -5.1 dB; starts at full level, no fade-in; cut-off tail (last 10 ms -38 dBFS) |
| ricochet.scroll.mp3 | fx | 44.1k mo 96 | 8 | 592 | 0 / 0 | -1.5 / -1.5 | -17.1 (+0.0) | – | **issue:** cut-off tail (last 10 ms -35 dBFS) |
| ricochet.slip.mp3 | fx | 44.1k mo 96 | 8 | 593 | 0 / 0 | -1.1 / -0.9 | -17.8 (-0.7) | – | **issue:** true peak above -1 |
| room.finalRound.mp3 | fx | 48k st 96 | 35 | 2880 | 0 / 0 | -2.8 / -2.8 | -16.5 (+0.0) | – | pass |
| room.prepare.flash.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -4.7 / -4.7 | -16.6 (+0.9) | – | **issue:** starts at full level, no fade-in |
| room.prepare.mp3 | fx | 48k st 96 | 63 | 5165 | 0 / 10 | -11.0 / -11.0 | -16.5 (+0.0) | – | **issue:** tail silence 152 ms |
| room.round.a.mp3 | fx | 48k st 192 | 40 | 1600 | 0 / 0 | -5.9 / -5.3 | -16.4 (+0.1) | – | **issue:** tail silence 339 ms |
| room.round.b.mp3 | fx | 48k st 192 | 40 | 1600 | 0 / 0 | -4.1 / -3.6 | -16.4 (+0.1) | – | pass |
| room.round.c.mp3 | fx | 48k st 192 | 40 | 1600 | 0 / 0 | -6.5 / -6.0 | -16.8 (-0.3) | – | pass |
| room.roundResults.mp3 | fx | 48k st 192 | 23 | 875 | 0 / 8 | -8.2 / -8.2 | -18.2 (-1.1) | – | pass |
| room.roundWon.mp3 | fx | 48k st 192 | 18 | 680 | 0 / 0 | -6.1 / -6.1 | -17.1 (+0.0) | – | **issue:** starts at full level, no fade-in |
| room.winner.lock.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -1.2 / -1.0 | -18.3 (-0.8) | – | **issue:** starts at full level, no fade-in |
| safe.dialClick.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 3 | -2.8 / -2.8 | -26.4 (-8.9) | – | **issue:** quiet -8.9 dB |
| sea.bubbleStick.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -11.6 / -11.6 | -23.7 (-6.2) | – | **issue:** quiet -6.2 dB |
| sfx_count_ding.mp3 | fx | 44.1k mo 112 | 8 | 487 | 0 / 1 | -6.9 / -6.9 | -19.2 (-1.7) | – | pass |
| sfx_count_tick.mp3 | fx | 44.1k mo 112 | 2 | 60 | 0 / 0 | -1.4 / -1.2 | -22.8 (-0.1) | – | pass |
| sfx_hero_whoosh.mp3 | fx | 44.1k mo 112 | 22 | 1500 | 1 / 52 | -1.9 / -1.8 | -21.6 (-5.1) | – | **issue:** quiet -5.1 dB; soft attack, peak-30 dB at 52 ms |
| sfx_joulz_zap.mp3 | fx | 44.1k mo 112 | 6 | 380 | 0 / 0 | -4.8 / -4.9 | -19.1 (-1.6) | – | pass |
| sfx_logo_charge.mp3 | fx | 44.1k mo 112 | 11 | 687 | 0 / 1 | -1.9 / -1.9 | -19.9 (-2.8) | – | **issue:** cut-off tail (last 10 ms -14 dBFS) |
| sfx_meter_crackle_1.mp3 | fx | 44.1k mo 112 | 7 | 450 | 0 / 2 | -1.9 / -1.8 | -19.7 (-2.2) | – | **issue:** cut-off tail (last 10 ms -22 dBFS) |
| sfx_meter_crackle_2.mp3 | fx | 44.1k mo 112 | 6 | 378 | 0 / 0 | -1.8 / -1.7 | -21.5 (-4.0) | – | **issue:** quiet -4.0 dB; cut-off tail (last 10 ms -15 dBFS) |
| sfx_meter_crackle_3.mp3 | fx | 44.1k mo 112 | 7 | 450 | 0 / 0 | -1.6 / -0.6 | -20.6 (-3.1) | – | **issue:** quiet -3.1 dB; true peak above -1; cut-off tail (last 10 ms -25 dBFS) |
| sfx_overtake_zap.mp3 | fx | 44.1k mo 112 | 5 | 280 | 0 / 3 | -1.9 / -1.8 | -18.4 (-0.9) | – | **issue:** cut-off tail (last 10 ms -18 dBFS) |
| sfx_spark_chime.mp3 | fx | 44.1k mo 112 | 9 | 600 | 0 / 0 | -3.7 / -3.7 | -19.1 (-2.0) | – | pass |
| sfx_streak_flourish.mp3 | fx | 44.1k mo 112 | 18 | 1200 | 0 / 1 | -7.4 / -6.9 | -20.4 (-3.9) | – | **issue:** quiet -3.9 dB |
| sfx_streak_flourish_big.mp3 | fx | 44.1k mo 112 | 29 | 1993 | 1 / 16 | -6.0 / -5.9 | -20.1 (-3.6) | – | **issue:** quiet -3.6 dB; tail silence 359 ms |
| sfx_thunder_crack.mp3 | fx | 44.1k mo 112 | 11 | 750 | 0 / 5 | -7.3 / -7.2 | -20.0 (-2.9) | – | pass |
| sfx_victory_sting.mp3 | fx | 44.1k mo 112 | 26 | 1756 | 1 / 5 | -4.4 / -4.0 | -20.2 (-3.7) | – | **issue:** quiet -3.7 dB |
| shared.highlight.clip.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -2.5 / -2.2 | -16.5 (+1.0) | – | pass |
| shared.momentcard.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 1 | -0.6 / -0.6 | -16.6 (+0.9) | – | **issue:** true peak above -1 |
| shared.perfect.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -6.2 / -5.7 | -16.3 (+1.2) | – | pass |
| shared.playofthegame.mp3 | fx | 48k st 192 | 40 | 1600 | 0 / 0 | -7.0 / -7.0 | -16.2 (+0.3) | – | **issue:** starts at full level, no fade-in |
| shared.signature.fast.mp3 | fx | 48k st 192 | 25 | 1000 | 0 / 0 | -3.2 / -3.2 | -16.3 (+0.2) | – | **issue:** starts at full level, no fade-in |
| shared.signature.solve.mp3 | fx | 48k st 192 | 25 | 1000 | 0 / 0 | -5.3 / -5.1 | -16.2 (+0.3) | – | pass |
| shared.slowmo.end.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -1.2 / -1.2 | -17.5 (+0.0) | – | pass |
| shared.slowmo.mp3 | fx | 48k st 192 | 34 | 1360 | 0 / 0 | -6.8 / -6.8 | -16.3 (+0.2) | – | pass |
| signals.ruleChange.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | 1.4 / 1.4 | -13.9 (+3.6) | – | **issue:** loud +3.6 dB; true peak over 0 dBFS; clipped (10) |
| signals.whoosh.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 5 | -0.1 / -0.1 | -10.6 (+6.9) | – | **issue:** loud +6.9 dB; true peak above -1 |
| sky.gust.mp3 | fx | 48k st 192 | 16 | 606 | 0 / 0 | 0.9 / 0.9 | -16.4 (+0.7) | – | **issue:** true peak over 0 dBFS; clipped (10); starts at full level, no fade-in |
| skyline.floors.mp3 | fx | 48k st 192 | 13 | 483 | 0 / 0 | -2.4 / -1.7 | -18.1 (-0.6) | – | pass |
| slice.bottleToss.mp3 | fx | 48k st 192 | 9 | 300 | 0 / 0 | -1.2 / -1.2 | -19.4 (-1.9) | – | pass |
| slice.chilli.mp3 | fx | 44.1k mo 96 | 7 | 485 | 0 / 0 | -1.1 / -1.0 | -17.9 (-0.4) | – | **issue:** starts at full level, no fade-in; cut-off tail (last 10 ms -26 dBFS) |
| slice.fuse.mp3 | fx | 48k st 192 | 16 | 606 | 0 / 0 | -15.4 / -15.0 | -25.2 (-8.1) | – | **issue:** quiet -8.1 dB |
| slice.ketchup.mp3 | fx | 48k st 192 | 10 | 350 | 0 / 0 | -1.5 / -1.2 | -18.2 (-0.7) | – | pass |
| slice.mayo.mp3 | fx | 48k st 192 | 12 | 450 | 0 / 0 | -8.6 / -7.5 | -17.0 (+0.5) | – | pass |
| slice.mustard.mp3 | fx | 48k st 192 | 13 | 479 | 0 / 0 | -3.9 / -3.7 | -17.8 (-0.3) | – | pass |
| snake.cometRush.mp3 | fx | 48k st 192 | 11 | 400 | 0 / 0 | -8.7 / -8.5 | -17.1 (+0.4) | – | **issue:** starts at full level, no fade-in |
| snake.rockFalling.mp3 | fx | 48k st 192 | 21 | 806 | 0 / 0 | 0.0 / 0.1 | -3.8 (+13.3) | – | **issue:** loud +13.3 dB; true peak over 0 dBFS; starts at full level, no fade-in |
| snip.goldLeaf.mp3 | fx | 48k st 192 | 11 | 386 | 0 / 0 | -4.5 / -4.5 | -17.1 (+0.4) | – | **issue:** starts at full level, no fade-in |
| speed.up.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | 0.7 / 0.7 | -7.8 (+9.7) | – | **issue:** loud +9.7 dB; true peak over 0 dBFS; clipped (3); starts at full level, no fade-in |
| sports_crowd_groan.mp3 | fx | 44.1k mo 96 | 25 | 1995 | 1 / 3 | -1.8 / -1.8 | -16.9 (-0.4) | – | pass |
| sports_crowd_roar.mp3 | fx | 44.1k mo 96 | 43 | 3477 | 0 / 1 | -1.7 / -1.7 | -16.3 (+0.2) | – | pass |
| swing.dragonNear.mp3 | fx | 48k st 192 | 27 | 1080 | 0 / 0 | 0.7 / 0.7 | -8.2 (+8.3) | – | **issue:** loud +8.3 dB; true peak over 0 dBFS; clipped (3) |
| swing.gate.mp3 | fx | 44.1k mo 96 | 7 | 479 | 0 / 0 | -1.8 / -1.5 | -18.1 (-0.6) | – | **issue:** starts at full level, no fade-in; cut-off tail (last 10 ms -40 dBFS) |
| swing.hundredMetres.mp3 | fx | 48k st 192 | 15 | 562 | 0 / 0 | -5.4 / -5.4 | -17.0 (+0.1) | – | **issue:** starts at full level, no fade-in |
| swing.land.mp3 | fx | 44.1k mo 96 | 7 | 485 | 0 / 0 | -1.1 / -1.0 | -18.9 (-1.4) | – | **issue:** starts at full level, no fade-in |
| swing.pterodactyl.mp3 | fx | 44.1k mo 96 | 15 | 1198 | 0 / 2 | -3.3 / -3.3 | -16.5 (+0.0) | – | pass |
| swing.release.mp3 | fx | 44.1k mo 96 | 7 | 480 | 0 / 0 | -1.7 / -0.7 | -17.6 (-0.1) | – | **issue:** true peak above -1 |
| swing.splash.mp3 | fx | 44.1k mo 96 | 11 | 880 | 0 / 0 | -1.7 / -1.7 | -17.1 (+0.0) | – | **issue:** starts at full level, no fade-in |
| swing.streak.mp3 | fx | 44.1k mo 96 | 8 | 600 | 0 / 10 | -3.2 / -3.2 | -17.2 (-0.1) | – | pass |
| swing.vineCreak.mp3 | fx | 44.1k mo 96 | 7 | 480 | 0 / 2 | -1.1 / -0.7 | -19.2 (-1.7) | – | **issue:** true peak above -1 |
| symscan.eagle.mp3 | fx | 44.1k mo 96 | 10 | 807 | 0 / 0 | -7.4 / -7.4 | -17.1 (+0.0) | – | **issue:** cut-off tail (last 10 ms -35 dBFS) |
| symscan.takeoff.mp3 | fx | 48k st 192 | 27 | 1077 | 0 / 5 | -2.4 / -1.4 | -16.2 (+0.3) | – | pass |
| tendrop.clear.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -1.7 / -1.3 | -16.2 (+1.3) | – | **issue:** starts at full level, no fade-in |
| tendrop.reset.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 1 | -1.3 / -1.3 | -17.3 (+0.2) | – | pass |
| tilt.goldStar.mp3 | fx | 48k st 192 | 12 | 450 | 0 / 0 | -1.5 / -1.2 | -16.2 (+1.3) | – | **issue:** starts at full level, no fade-in |
| tripeaks_clear.mp3 | fx | 44.1k mo 96 | 21 | 1666 | 0 / 0 | -1.6 / -1.6 | -16.1 (+0.4) | – | pass |
| tripeaks_peak.mp3 | fx | 44.1k mo 96 | 13 | 998 | 0 / 2 | -1.5 / -1.3 | -15.4 (+1.1) | – | pass |
| tripeaks_run.mp3 | fx | 44.1k mo 96 | 5 | 329 | 0 / 0 | -3.8 / -3.8 | -18.7 (-1.2) | – | pass |
| tubes.cork.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -3.7 / -3.5 | -16.3 (+1.2) | – | **issue:** starts at full level, no fade-in |
| ui.clear.mp3 | fx | 48k st 192 | 13 | 486 | 1 / 22 | -17.1 / -16.5 | -30.9 (-13.4) | – | **issue:** quiet -13.4 dB |
| ui.counterLock.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -1.3 / -1.2 | -16.5 (+1.0) | – | **issue:** starts at full level, no fade-in |
| ui.nope.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 154 | -0.2 / -0.2 | -19.4 (-1.9) | – | **issue:** true peak above -1; soft attack, peak-30 dB at 154 ms |
| ui.select.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -17.6 / -17.6 | -39.6 (-22.1) | – | **issue:** quiet -22.1 dB; tail silence 388 ms |
| ui.sheet.close.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -1.3 / -1.3 | -16.8 (+0.7) | – | **issue:** starts at full level, no fade-in |
| ui.sheet.open.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -6.0 / -6.0 | -16.3 (+1.2) | – | **issue:** starts at full level, no fade-in |
| ui.tap.small.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -0.8 / -0.7 | -16.8 (+0.7) | – | **issue:** true peak above -1; cut-off tail (last 10 ms -25 dBFS) |
| ui.warn.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -4.8 / -4.8 | -14.0 (+3.5) | – | **issue:** loud +3.5 dB |
| wavefront.diverDown.mp3 | fx | 48k st 192 | 10 | 350 | 0 / 0 | -6.8 / -6.6 | -17.1 (+0.4) | – | pass |
| wavefront.greenBolt.mp3 | fx | 48k st 192 | 4 | 90 | 0 / 1 | -10.8 / -10.5 | -24.2 (-1.5) | – | **issue:** cut-off tail (last 10 ms -38 dBFS) |
| wavefront.march.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -6.7 / -6.7 | -18.2 (-0.7) | – | **issue:** starts at full level, no fade-in |
| wavefront.waveIn.mp3 | fx | 48k st 192 | 21 | 830 | 0 / 0 | -7.9 / -7.9 | -17.6 (-0.5) | – | pass |
| whack.hedgehogUp.mp3 | fx | 48k st 192 | 13 | 486 | 0 / 0 | -7.2 / -7.2 | -21.0 (-3.5) | – | **issue:** quiet -3.5 dB |
| wordslide.finish.mp3 | fx | 48k st 192 | 25 | 1001 | 0 / 4 | -1.2 / -0.3 | -19.9 (-3.4) | – | **issue:** quiet -3.4 dB; true peak above -1; tail silence 173 ms |

## Ranked fixes

Ranked by how much the player hears it against the work. Effort: S under an hour, M a session, L more. All are
presentation only (sound files and sound.ts), no stamps. Anything that changes a file should be measured again with
this audit's method and the five sound checks.

| # | Fix | What it fixes | Effort |
|---|---|---|---|
| 1 | **Trim by the MP3 header in the app.** The files are already fetched as bytes: read the `Info` frame's delay and padding (12 bits each, 21 bytes into the LAME/Lavc block), and if the decoded length matches the raw frame count (frames × 1,152, scaled to the context's rate), set `loopStart` / `loopEnd` from delay + 529 and padding, and start one-shots at that offset. Keep `detectLoopPoints` only for files without the header. First run Joe's one-line test in section 1 on the iPhone: if Safari already honours the header, this is insurance only. | The 12–26 ms dropout at every loop's join and the 23–25 ms late start of every effect on a browser that ignores the header; also stops the -60 dB trim eating the 7–8 ms quiet head of `music_bastion`, `music_cross`, `music_ricochet`. | M |
| 2 | **Turn down the 20 files over 0 dBFS true peak and the hot `retro.*` / `banner.*` family** to their length's target (-17.1 / -17.5 LUFS), true peak ≤ -1 dBFS: `snake.rockFalling`, `retro.saucerEnter`, `retro.shieldBreak`, `retro.powerDown`, `retro.itemDrop`, `retro.appear`, `speed.up`, `banner.clear`, `banner.streak`, `banner.combo`, `banner.fullClear`, `swing.dragonNear`, `retro.enemyFire`, `signals.ruleChange`, `signals.whoosh`, `clay.launch`, `arrow.whoosh`, `sky.gust`, `orbit.shootingStar`, `combo.lost`, `pinball.gameOver`, `cave.*`, `block.place`, `countup.countersTick`. A plain gain change from the files themselves (no re-trim). | Clipping at the output and sounds 7–13 dB louder than their neighbours (Retro games, banners). | S |
| 3 | **Fade the 40 cut-off tails** (10–30 ms fade-out, or restore the tail from the original where one exists: `cross.hop`, `cross.crossed`, `cross.streakUp`, `cross.freighter` from `sounds-retheme-nov-2026`; `bastion.jam`, `bastion.wave`, `ricochet.flow`, `blockfall.topOut` from `sounds-nov-2026`), and add a 2 ms fade-in to the 92 that start at full level. Script it on the levels-nov-2026 pipeline. | Clicks at the end of 40 effects and under the attack of soft ones. | S–M |
| 4 | **Re-cut four effect loops** on a matching zero crossing with a 20–40 ms crossfade: `swing.lava`, `wavefront.danger`, `racing_idle_loop`, and `curling_sweep_loop` (level-matched). | A tick or pulse every 1.5–6 s while they play. | S |
| 5 | **Fade before stopping in code:** in `playSound` (retrigger), `stopSound` and `stopBeatTrack` (re-sync), ramp the source's own gain to 0 over 5 ms and stop at the end of the ramp (each source already has a gain node, except the beat re-sync, which can crossfade old and new over 10–20 ms). | Clicks when a cue retriggers while still sounding, and at Tempo's re-syncs. | S |
| 6 | **Lift the quiet ones** to target or set their slot `volume`: `inkbridge.cloudBounce`, `ui.select`, `ui.clear`, `move.softFall`, `move.appear`, `pop.perfect`, `cave.rockCrumble`, `clayshoot.birdIn`, `pinball.lastBall` (gain, plenty of headroom: peaks -13 to -20 dBFS), and the click-heavy batch 6 files (`cards_shuffle`, `mahjong_shuffle`, `freecell_cascade`, `cards_home`, `cards_invalid`, `minigolf_*`, `mines_hit`, `curling_board`, `gem.refuse`) with the transparent limiter of levels-nov-2026.md as far as it stays clean. `clay.missPuff` (-48 LUFS before its 0.5 volume) is probably meant to be faint; confirm with Joe. Loops: `swing.wings`, `sports_crowd_loop`, `swing.slideVine`, `curling_slide_loop` up 3–6 dB; `racing_drive_loop` / `racing_idle_loop` down 3–4 dB. | Sounds that are lost under the bed (card games, Crazy Golf, puzzle select and clear). | M |
| 7 | **Re-encode effects as 44.1 kHz mono 96 kbps** (the 170 stereo 48 kHz files; loops and ambience stay stereo) and voices as mono 96 kbps. | About 21 MB less decoded memory (about 29 MB with the voices), 1.5 MB less first-tap download (+0.5 MB voices). | S (script) + a listen |
| 8 | **Smooth the four bed joins** with a level step (`music_ricochet`, `music_cross`, `music_pool`, `music_matchup`): a 1–2 s crossfade of the end into the opening, or a cut on a matching bar as for `music_alleyroll`. | A 4–8 dB lift every ~50–60 s. | S each |
| 9 | **Trim the long silent tails** of 12 files to 60 ms after the sound (`ui.select`, `sfx_streak_flourish_big`, `room.round.a`, `done.corks`, `gem.parSmashed`, `homerun_sign`, …) and the 64–112 ms lead of the five older voice lines to 10 ms. | Music ducking and caller timing that last longer than the sound; voice lines that start late. | S |
| 10 | **Beds:** lift `music_menu` 2 dB to -18.45 LUFS; optionally re-encode the beds at 112 kbps (about 2 MB) or AAC 96 kbps (about 4 MB, needs a browser pass on Chrome and Firefox). | The home bed sitting under the others; download size. | S / M |
| 11 | **Audit the 135 Lovable-hosted files** (`/__l5e/…`: core puzzle effects, 41 beds including `lobby_loop`, `intro_loop`, `standings_loop`, `podium_loop`): download them from the published app (or Lovable's asset list) into a scratch folder and run this audit's measurements; or move them into `public/sounds/` so they are versioned, cached by the offline worker's media hash and measured by the checks. | The part of the app's audio this audit could not see. | S to measure, M to move |
| 12 | **Decide on duck-per-effect** (`duckMusic` takes the bed to 30 % for every effect): ducking only for stings, voices and long effects would stop the bed pumping in busy arcade runs. A design call for Joe. | Bed pumping. | S |

## Checks run

Read-only, no browser: sound-manifest-check **pass**, sound-batch6-check **pass**, sound-nov-2026-check **pass** (481
checks), sound-retheme-check **pass** (452 checks), replay-sound-check **pass** (43 checks). This PR changes only
this document, so the CI workflows skip it (docs-only).
