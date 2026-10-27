# Tempo (`beat`): phone notes, 27 Oct 2026

Joe's note: "Tempo: louder background music that starts straight away (it takes 5–10 s to kick in). Make it
about 20% easier, especially once the 5th lane arrives; scores should rise accordingly."

## 1. Music (presentation only, no stamp)

**Why it took 5–10 s.** Two causes, measured:

- `public/sounds/music_beat.mp3` opens with an 8 s quiet intro: per-second RMS about −37 dB for 0–7 s, then
  about −22.5 dB from 8.00 s to 56.00 s (the full groove), then a fade (ffmpeg `astats`). The track started at
  tick 120 (2 s into the run) from file second 0, so the music proper arrived about 10 s into the run.
- The file (1.4 MB, 60 s) was only fetched and decoded on the stage's first frame, so on a phone it began a
  second or more late, and the synthesised fallback beat waited for tick 120.

**What changed** (`src/lib/sound.ts` "Tempo's track", `src/puzzles/beat.tsx`):

- The track is fetched and decoded while the intro shows: `prepareBeatTrack()` from `RoundIntro` (practice
  and rooms), `RoundTitle` and `DuelStart` (rooms), or on unlock if no audio context exists yet. The stage's
  first frame still loads it as a fallback.
- Only the full groove plays, looped: file seconds [8, 56) after its first audible sample (24 bars, both ends
  on a downbeat), so it also covers beatRev 9+'s 75 s song (the synth no longer takes over near the end).
- It plays from the run's first tick: the chart's first beat (tick 120) lands on the groove's first downbeat,
  and ticks 0–120 play the groove's last bar as the lead-in. Still tick-locked: the file position is
  `grooveStart + ((tick − 120) / 60 mod 48)` s, re-synced past 40 ms (circular distance on the loop).
- Louder: level 0.9 rising to 1.0 over the last 15 s (was the arcade round ramp, 0.5 → 0.9), times the music
  volume and the slot's 0.8. With the groove itself ~14 dB above the old intro, the start is far louder.
- A 300 ms fade at the run's end or a lock-in (was an abrupt stop).
- Until the file decodes (or if it fails) the synthesised beat plays from tick 0, on the same grid.
- A file too short for the groove plays as before (from its start at tick 120, not looped).

`scripts/sound-manifest-check.ts`'s Tempo block was rewritten for the new behaviour (as strict: the start offset
54 s at tick 0, loop points 8/56, no restart at the wrap, drift re-sync, the loop past 48 s, the level, release,
and loading both from the intro and from the stage). No new audio file and no manifest change.

## 2. Gameplay: `beatRev 10` (`BEAT_REV_EASE`, live was `beatRev 9`)

beatRev 9's song (75 s, five lanes from 40 s), features, base curve and skill pay, with:

- **Wider hit windows:** 4 / 8 / 13 ticks either side of the line (were 3 / 7 / 12): Perfect ±67 ms (was ±50),
  Good ±133 ms, OK ±217 ms. A hold's release uses the same Perfect/Good. A golden note still needs the very tick.
- **A lighter chart**, built on beatRev 9's own stream (`buildChartV9` with a plan; beatRev 9's plan reproduces
  its chart draw for draw):

  | Section | beatRev 9 eighths / chords | beatRev 10 |
  |---|---|---|
  | 14–26 s | 30 / 0 | 25 / 0 |
  | 26–40 s | 35 / 20 | 30 / 15 |
  | 40–44 s (five lanes arrive) | 25 / 15 | single quarter notes only |
  | 44–56 s | 25 / 15 | 15 / 8 |
  | 56–75 s | 35 / 25 | 25 / 15 |

  Holds 15 % then 10 % from 40 s (were 15), swipes 22 % then 14 % (were 22); double taps unchanged at 12 %
  (cutting them left too few for the 8-point double-tap cap: a flawless run reached 200 on only 38 of 60 seeds).
  About 191 notes (median, 60 seeds; 215 on beatRev 9), 95 from 40 s (113).
- States add `ease: 1`, folded into the checkpoint checksum last; every older revision's state and checksum
  is unchanged. `beatWindows(state)` gives the windows (the renderer's note culling reads it too).
- Scoring: `BEAT_V10_BAND_CURVE` = `BEAT_V9_BAND_CURVE` and `BEAT_V9_SKILL_PAY`, unchanged, so the same play
  scores more (Joe asked for scores to rise). Every note Perfect + every feature maxed is still 200.

Judgement calls: the five-lane break stays one second (the renderer's "5 LANES!" banner timing is shared with
beatRev 9); the easing after lane 5 is the 4 s of single quarter notes plus the thinner sections, fewer holds and
swipes. Effect where Joe asked: a good player's notes hit after 40 s rise from 88 % to 92 % (before 40 s 92 → 93 %);
an average player's from 74 % to 82 % (82 → 84 %).

### Medians (skill-band tool, `--rev=now`, bots v2)

Tuning seeds 0–59 (before: the coordinator's `bands/before-all.json`, beatRev 9; after: beatRev 10):

| Level | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---|---|---|---|---|---|---|
| beatRev 9 | 27 | 68 | 101 | 138 | 172 | 180 | 200 |
| beatRev 10 | 43 | 85 | 114 | 148 | 176 | 179 | 200 |

Fresh seeds 10000–10099 (beatRev 9 measured with the same bots on the same seeds):

| Level | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---|---|---|---|---|---|---|
| beatRev 9 | 27 | 67 | 101 | 135 | 170 | 179 | 200 |
| beatRev 10 | 41 | 81 | 114 | 144 | 174 | 191 | 200 |

Good rises 13 % (101 → 114 on both seed sets); weaker players gain most. No played run scores 0 (lowest weak run
28 tuning / 30 fresh). Medians still climb weak < average < good < great < near-perfect ≤ elite < flawless (on the
tuning seeds elite 179 is a hair over near-perfect 176, as before the change, 180 vs 172). A flawless run reaches
200 on 54 of 60 tuning seeds (59 on beatRev 9; min 192) and 92 of 100 fresh (92).

## Text, demo

- Help: the 75-second song line says the five lanes ease in with a few seconds of single notes
  (`src/lib/duel/instructions.ts`); the score text's numbers come from `LIVE_BANDS` (curve unchanged).
- Intro demo stopped until recorded on beatRev 10 (`introDemo.functions.ts`).

## Checks

New: `scripts/tempo-ease-check.ts` (~10 s; fixture `scripts/fixtures/tempo-ease-runs.json.gz`, `--record`): wiring,
windows on 10 vs 9 (taps and holds), the chart rules, paired bot medians rising and climbing, 28 stored runs
replaying through the server, a 200 among them.

Updated wiring assertions: expansion-e2-check ("rooms deal beatRev 10"), arcade-tuning-g2-check (rooms deal
beatRev 10; Tempo's demo plays only on beatRev 10). beatRev 1–9 stay proved by expansion-e2-check's fixtures.
