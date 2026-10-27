# Rally: phone notes (27 Oct 2026), `rallyRev 11`

Joe's notes: "Spin shots must visibly swerve and curve the ball. Keep the gold target on screen a little longer.
The main white ball warms to orange then red (not yellow then red)."

## What changed

| Change | Kind | Where |
|---|---|---|
| Spin shots curve through the flight | gameplay, `rallyRev 11` | `src/lib/arcade/rally.ts` (`RALLY_REV_CURVE`, `RALLY_V11_*`, `rallyCurveSpinFrom`, `stepBonus`'s `curving` branch) |
| Gold bonus targets stay up 5 s (was 4 s) | gameplay, `rallyRev 11` | `RALLY_V11_BONUS_LIFE`, `rallyBonusLife(state)` (sim, renderer, shared fx layer) |
| Blue ball warms white → orange (10 returns) → red (20); the "RALLY ×n" pop follows | look only, every revision | `src/lib/arcade/rally.renderer.ts` (`HEAT_RED`) |
| A curving ball keeps a 16-frame trail (6 otherwise), so the arc shows | look only, `rallyRev 11` | `rally.renderer.ts` (`trailLen`) |

`rallyRev 11` is `rallyRev 10` (court, pads, bumpers, target places and times, scoring) with those two rule changes. Its
init draws exactly `rallyRev 10`'s stream (the same opening, gold balls, pad spots, bumpers and targets for a seed);
states carry `exp: 2` (rallyRev 10: `exp: 1`), already folded into the checkpoint. Every older stamp replays exactly as
before (expansion-e9-check's 92 legacy runs and 39 rallyRev 10 runs).

### The curve

rallyRev 10's spin bent the flight by up to 24/256 px a tick and lost 1/16 of it a tick, so it was gone in about a
third of a second: a small kink after the paddle, then a straight line. On rallyRev 11:

- spin = paddle speed at contact (smoothed, 1/256 px a tick) × 40 / 256, none under 1.5 px a tick, capped at 256;
- each tick the ball's velocity is bent sideways by spin / 16 (1/256 px a tick, scaled with the ball's speed) and
  renormalised to the ball's speed;
- the spin wears off by 1/40 a tick (at least 1) and stops under 8: about two thirds of a second of curve;
- a bend that would take |vy| under 40 % of the speed ends the spin instead (never a flat ball skimming the walls);
- side walls mirror the spin, the far wall ends it; bumpers keep it. Spin still pays nothing itself.

Measured from a straight-down ball on the paddle's centre (lateral offset from the straight line, px, after 20 / 40 /
60 / 80 / 100 / 120 ticks):

| Paddle speed at contact | rallyRev 10 | rallyRev 11 |
|---|---|---|
| 2 px a tick | 1 · 3 · 5 · 6 · 8 · 9 | 3 · 11 · 22 · 34 · 46 · 58 |
| 3 px a tick (an ordinary move) | 3 · 6 · 10 · 13 · 17 · 20 | 5 · 17 · 33 · 52 · 72 · 91 |
| 5 px a tick | 7 · 16 · 25 · 33 · 42 · 51 | 8 · 28 · 53 · 83 · 115 · 148 |
| 8 px a tick (a hard swipe) | 11 · 27 · 43 · 59 · 75 · 91 | 11 · 36 · 69 · 108 · 149 · 192 |

rallyRev 10's offset grows linearly (a fixed new angle); rallyRev 11's accelerates for most of a second (a curve), up to
about 30° of turn at full spin.

## Judgement calls

- The curve applies to gold balls as well as the blue one (the same `move`), as rallyRev 10's spin did.
- Target lifetime 5 s: the 9 s slots and 0–3 s jitter still keep targets from overlapping and every target's whole 5 s
  inside the run (proved for 300 seeds).
- Heat colours: orange `SUCCESS_ACCENTS.orange` (#FF8A3C), red #FF3A24 (kept apart from the crash flash's #FF3B5C pink-red).
  Applied to every revision (presentation only).
- The bots were not changed (they read landings from the live velocity every tick, so they follow a curving ball).
- Help: "stays about 5 seconds"; the spin line now says the ball swerves the way the paddle moved.
- The intro demo stays stopped (introDemo.functions.ts) until one is recorded on rallyRev 11.

## Scores (skill-band bots, `--rev=now`, all levels)

Tuning seeds (0–59), before = main (rallyRev 10), after = rallyRev 11; median (p10–p90):

| Level | Before | After |
|---|---|---|
| Weak | 46 (14–96) | 57 (24–86) |
| Average | 86 (42–148) | 84 (57–144) |
| Good | 115 (53–161) | 124 (60–168) |
| Great | 140 (83–180) | 137 (88–189) |
| Near-perfect | 170 (102–189) | 170 (137–194) |
| Elite | 174 (117–194) | 177 (133–197) |
| Flawless | 182 (122–200) | 184 (157–200) |

Fresh seeds (10000–10199):

| Level | Before | After |
|---|---|---|
| Weak | 45 (11–96) | 58 (11–105) |
| Average | 79 (33–138) | 79 (38–135) |
| Good | 114 (50–171) | 124 (67–173) |
| Great | 147 (88–183) | 154 (101–184) |
| Near-perfect | 164 (94–188) | 170 (112–192) |
| Elite | 173 (115–200) | 178 (128–197) |
| Flawless | 182 (136–200) | 185 (150–200) |

No played run scored 0; none flagged. The longer-lived targets lift the lower levels a little (more targets struck);
the curve unchanged (`RALLY_V10_BAND_CURVE`).

## Checks

expansion-e9-check (new section 7: rallyRev 11 starts from rallyRev 10's draws, 5 s targets on 300 seeds, a touch at
4.5 s scores on rallyRev 11 only, the curve proved against rallyRev 10's kink, never flatter than 40 %, spin pays
nothing, same-room identity on rallyRev 11 for weak / elite / random players, doing nothing scores 0), arcade-batch5,
tuning-b, arcade-tuning-f, arcade-tuning-g1, six-game-scoring (wiring updated to rallyRev 11), arcade-fx (plays
rallyRev 11), round-max, arcade-help-bands, intro-score-text, arcade-score-bands, scoring-bands, scoring-targets,
reveal-score, arcade-room-schedule, arcade-self-replay, arcade-drag, arcade-input, intro-demo, reveal-marker,
replay-access, presentation-geometry: pass. replay-check and practice-bests-check fail only on the new stamp
(no stored replay-runs entry; practiceStamps.data.ts out of date), the coordinator's regeneration.
