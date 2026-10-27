# Swish: phone notes (27 Oct 2026), `binRev 8`

Joe's notes: "The +9 small bucket becomes 60 % of its current size (harder); make the ball more visible; show wind as
a small waving flag pointing the wind's way, with the strength number on it."

## What changed

| Change | Kind | Where |
|---|---|---|
| The +9 far bucket's mouth, rim and walls at 60 % of binRev 7's (half-width 28.9 → 17.3 px; 35 px across for a 14 px ball) | gameplay, `binRev 8` | `src/lib/arcade/binToss.ts` (`BINTOSS_REV_SMALL_FAR`, `BINTOSS_V8_FAR_HALF`, `binTossFarHalf`) |
| A missed throw that came close (crossed the rim line within 28 px of either bucket's mouth, rim hits included) counts 1 unit, once a throw | scoring, `binRev 8` | `BINTOSS_V8_CLOSE`, state `close` / `closeNow`, `binTossV7Parts` |
| The far bucket drawn at its new size (art = collision, as before) | look | `src/lib/arcade/binTossArt.renderer.ts` |
| The ball: a soft warm halo (decoration, fades out by r + 9) and a thin dark ring on its edge (within 1.7 px), a cream ring just inside it, a brighter trail | look only, every revision | `ballHalo`, `drawRubberBall(…, outline)` |
| The wind: a small red flag on a pole at the top of the stall, flying the wind's way, longer the stronger it is, waving on the render clock (still under reduced motion), its strength printed on the cloth; no wind = a limp flag reading 0. Replaces the old arrow, bars and corner pennant | look only, every revision | `drawWind` |

binRev 8 is binRev 7 exactly (world, throws, winds, main bucket, far bucket places, hoops, spinners, curve) apart from
the far bucket's size and the close-miss unit. Its init draws exactly binRev 7's stream; states add `farHalf`, `close`
and `closeNow` (`farHalf` and `close` fold into the checkpoint last). binRev 7 and every older stamp replay exactly as
before (expansion-e5-check's 72 legacy runs and its stored binRev 7 runs).

## Judgement calls

- "60 % of its current size" is read as the mouth width (the half-width the rim, inner window and walls use); the
  bucket's height is unchanged (both buckets share the rim line).
- The close-miss unit: with the smaller bucket the skill-band bots' first run showed a weak run scoring 0 on the fresh
  seeds (it had made one far basket by luck on binRev 7), against Joe's bar that anyone who plays scores more than 0.
  One unit a close miss (at most 10, about 1–3 points each on the curve) fixes that and keeps an ordinary player's score
  steady; it also gives a near-miss at the small bucket a little back. Help: "each throw that only just misses a bucket 1".
  It has no on-screen pop yet (a candidate for a later look pass).
- The bots were not taught to go for the small bucket less often (an experiment halving their far attempts on binRev 8
  moved good/great up a little and near-perfect and above down; left as is, the honest measure of the same players).
- Help: the intro reads "Wind 1 = a quarter bucket. Aim into the flag." and "Small far bucket: +9, and its hoop +3."; the
  help describes the flag and the small bucket. The intro demo stays stopped until one is recorded on binRev 8.

## Scores (skill-band bots, `--rev=now`, all levels)

Tuning seeds (0–59), before = main (binRev 7), after = binRev 8; median (p10–p90):

| Level | Before | After |
|---|---|---|
| Weak | 66 (42–96) | 62 (46–96) |
| Average | 80 (56–106) | 83 (60–113) |
| Good | 110 (80–148) | 106 (83–148) |
| Great | 157 (111–184) | 131 (90–166) |
| Near-perfect | 187 (175–200) | 175 (140–197) |
| Elite | 200 (184–200) | 185 (175–200) |
| Flawless | 200 (200–200) | 200 (200–200) |

Fresh seeds (10000–10199):

| Level | Before | After |
|---|---|---|
| Weak | 56 (28–80) | 59 (33–84) |
| Average | 80 (42–129) | 80 (47–122) |
| Good | 115 (77–157) | 106 (71–148) |
| Great | 166 (102–184) | 144 (84–167) |
| Near-perfect | 187 (175–200) | 175 (143–197) |
| Elite | 200 (184–200) | 185 (175–200) |
| Flawless | 200 (200–200) | 200 (200–200) |

No played run scored 0 (without the close-miss unit one fresh weak run did); none flagged. Weak to good stay steady;
great and above pay for the harder far bucket (fewer +9s, and a missed far try is a missed basket), as the note asked.
Medians still rise with skill.

## Checks

expansion-e5-check (rooms deal binRev 8; new section 5: binRev 8 starts from binRev 7's draws on 300 seeds, the 60 %
half-width, the same throw, a grid of 6,700 throw-1 launches flown on both stamps: 636 far baskets on binRev 7, 280 on
binRev 8, every binRev 8 far basket inside the small mouth and also a binRev 7 one, close misses counted once and only
for misses that came close, the far buckets, hoops and winds fixed for every player under random throws),
bintoss-small-bucket, arcade-batch5 (wiring), arcade-fx, round-max, arcade-help-bands, intro-score-text,
arcade-score-bands, scoring-bands, scoring-targets, reveal-score, arcade-room-schedule, arcade-self-replay,
arcade-input, intro-demo, presentation-geometry, sound-manifest: pass. replay-check and practice-bests-check fail only
on the new stamp (coordinator's regeneration).
