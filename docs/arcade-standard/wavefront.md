# Wavefront on the arcade scoring standard (wavRev 12, 29 Oct 2026)

Rooms and practice deal **wavRev 12**. Play is wavRev 11's exactly (Joe's phone notes: carriers, saucer lasers, no
streak, the mothership only after wave 5): a wavRev 11 log steps tick for tick on wavRev 12 with every checkpoint the
same (wavefront-phone-check). Only the scoring changed. States add `std: 1` and `coresHit` (which bosses' open cores
were hit), both outside the checkpoint checksum. wavRev 11 and every older round replay and score exactly as before.

Code: `WAV_REV_STD`, `WAVEFRONT_STD`, `wavStdScore`, `wavefrontStdParts` and `WAV_V12_BAND_CURVE` in
`src/lib/arcade/wavefront.ts`, built on `src/lib/arcade/arcadeStandard.ts`.

## The parts (total 200)

| Part | Max | How it counts |
|---|---|---|
| Ships, hits and waves (core) | 150 | Units: each ship shot 1, each armour hit 1, each gunship hit point 1, each cleared wave 15 (the gunship counts as a wave). A straight line, `stdLine(150, units, 294)`: about 0.51 a unit, full at 294. |
| Boss destroyed | 10 | The mothership destroyed. |
| Boss speed | 10 | Only with the mothership destroyed: full within 20 s of its arrival (`bossAt`), 0 at 40 s, a straight line between (`stdSpeed(10, fight, 1200, 2400)`). |
| Saucers | 20 | 4 a saucer, of the 5 a run flies. |
| Cannons and weak points | 10 | Equal shares of 6: each of the 4 cannons destroyed (two on the gunship, two on the mothership) and each boss's open core hit at least once (2). `stdLine(10, taken, 6)`. |
| Power-ups | 0 | Spread, shield and the laser pay nothing (they still help). |
| Lives | −5 each | Each life lost costs 5. The total is clamped to 1–200 for anyone who plays; no input scores 0. |

150 + 10 + 10 + 20 + 10 = 200.

## The core's fixed maximum (294)

The waves are deterministic: five formation waves of 36 ships each (`WAV_X_SHAPES`), waves 2–5 with an armoured piece
whose cells are not ships but whose hits count (`WAV_ARMOUR_BY_WAVE`: 4/6, 6/8, 8/10, 10/12 cells/hits, so 28 cells
and 36 hits), six cleared waves (five formations and the gunship) at 15, and the gunship's 16 hit points:
180 − 28 + 36 + 90 + 16 = **294**, which is `WAV_PAR_X − WAV_X_BOSS_HP` (wavRev 10's perfect base less the mothership's
36 hit points). The mothership's hit points are not core units; destroying it is its own part. wavefront-phone-check
derives the figure from the wave tables and checks that every recorded perfect run holds exactly 294 units on the tick
the mothership arrives and still 294 at the end. A ship that rams you is not shot, so it is never counted.

## Assumptions where the brief left room

- **Five saucers, not six.** A saucer flies every 15 s while the 90 s clock runs (`SAUCER_EVERY`, `tick < runTicks`):
  at 15, 30, 45, 60 and 75 s, so 5 (`WAV_X_SAUCERS`). They are 4 each. wavefront-phone-check proves that every run
  flies exactly the saucers due by its end tick, all 5 for any run that lasts the 90 s.
- **Saucers after a quick kill.** Destroying the mothership ends the run, so a fast finish could never meet the
  saucers still to come. A run that ends with the boss destroyed is credited the saucers its clock had not yet flown
  (`wavStdSaucers`). A missed saucer still costs 4. A run lost or timed out gets no credit. Without the credit the
  speed part would cost saucer points, and a perfect run would have to wait for the 75 s saucer.
- **Weak points.** The brief's "cannons and weak points" is read as the bosses' six weak points: four cannons, and
  each boss's open core, which counts once when hit at least once (`coresHit` bits 1 = gunship, 2 = mothership).
  Precision (`precise`) pays nothing on wavRev 12.
- **The gunship's hit points are core units** (they were base units on wavRev 10 and 11 and come before the boss);
  the mothership's are not.
- The help and intro: the "?" SCORE line states every part with its maximum and that they total 200 (`liveBandHelp`
  plus `stdFeaturesHelp`). The "how" lines no longer mention skill points or precision. The intro line is "Ships,
  hits, waves, a fast boss kill, saucers, cannons, cores; a lost life −5. Total 200." (at most 90 characters).
- Intro demo: the play HUD shows the run's score, so only a demo recorded on wavRev 12 plays (none is recorded yet).
  This follows flipRev 9.

## Bots (skill-band tool, wavRev 12 only)

On wavRev 11's bots the core was already full from the average level up (median 294 units), so near-perfect, elite and
flawless bunched at 189–191. They were never planning for the parts that now pay. The bot
(`scripts/arcade-skill-bands/bots/wavefront.ts`) now plans these parts, on `seen.std` states only, so every older
revision's recorded and pinned runs are unchanged. The chance of each rises with the level:

- cannons first on a boss (`STD_CANNON_FIRST`), switching to the other cannon when the bolts already in flight will
  finish the current one;
- then one open-core hit, standing clear of the boss while its core is shut (`STD_CORE_WAIT`);
- a saucer before a falling power-up (`STD_SAUCER_FIRST`);
- with the clock short for what is left of the mothership, the kill first.

## Measured (after)

`bun scripts/arcade-skill-bands.ts wavefront --rev=now --levels=all --seeds=30 --jobs=1`, wavRev 12, fixed bots:

| Level | Median | p10–p90 |
|---|---|---|
| Weak | 136 | 108–158 |
| Average | 155 | 130–175 |
| Good | 173 | 159–185 |
| Great | 186 | 169–191 |
| Near-perfect | 191 | 187–196 |
| Elite | 194 | 188–198 |
| Flawless | 196 | 192–200 |

The medians rise at every level. The top gaps are small (191 → 194 → 196) because the core is full from the average
level up. Above that, only the 50 feature points separate players, and the flawless bot loses most of its remaining
points on saucers that a formation column blocks. Before the bot's wavRev 12 planning, near-perfect, elite and flawless
were 191, 189 and 191.

The core target is the fixed maximum (294 units, everything before the boss), not a measured median. The near-perfect
median of core units is also 294.

## Proofs

- `bun scripts/arcade-standard-check.ts wavefront` covers the sum (200) and dealing. It checks four recorded flawless
  runs scoring 200 through the server replay (`scripts/fixtures/wavefront-std-runs.json.gz`, from
  `bun scripts/wavefront-std-record.ts`, each checked clean: 3 lives, all cannons and cores, the kill within 20 s) and
  a built full state. It also checks that played runs score at least 1 and idle runs 0, and the help.
- `bun scripts/wavefront-phone-check.ts`:
  - wavRev 11 logs step tick for tick on wavRev 12;
  - the 294 derivation;
  - five saucers a run;
  - every part's rule on built states;
  - the core bits;
  - random drags score 1–25.
- `arcade-self-replay-check` has an appended `wavefront/std` entry.

## The enemy ships restyled (3 Nov 2026, display only, every revision, no stamp)

Joe's mockups ("Wavefront ships: A + B combined", with the three directions board): every enemy ship, the boss and the
UFO in **gunmetal steel** with **magenta neon edge lights**, **orange furnace seams**, **side cannons** and **fire exhaust
with a blue-hot core**, mixing direction A's sleek darts and fighters with direction B's heavier, blockier warships.
Each type has its own silhouette (`src/lib/arcade/wavefront.renderer.ts`):

| Kind | Name | Look |
|---|---|---|
| 0 | Dart | a sleek arrowhead scout: swept wings, magenta leading edges, a cyan cockpit, twin exhausts |
| 1 | Raptor | a fighter: a narrow body on broad wings, magenta-tipped wingtip cannons, orange seams, twin exhausts |
| 2 | Bulwark | a blocky heavy: a furnace grid of orange seams, side cannons, a glowing furnace core, three exhausts |
| armoured ship | — | a gunmetal warship, orange-seamed plates (one a hit point), the furnace glowing through lost plates |
| boss | Leviathan | a broad warship with a row of exhausts, a furnace grid, magenta lower edges, gun pods and a glowing magenta-white weak core (wavRev 10+: the iris opens magenta-white) |
| saucer | UFO | a gunmetal disc, a blue-hot glass dome, a furnace band underneath and chasing magenta rim lights |

The hit boxes are unchanged (no stamp, no band change): every hull still fills its 28 px cell, the exhaust burning in
the cell's top fifth and the hull below it (`drawExhaust`), the armoured ship and boss inside their boxes (clipped), the
UFO inside the saucer's hit box. A ship's colour picks its steel (light, mid or dark gunmetal) and the 3-in-16 tints
(maroon, navy, dark red) stay (`wavHullTint`). `scripts/wavefront-ships-check.ts` proves the hulls and the UFO on their
boxes and three distinct silhouettes. The tile shows a Dart, a Bulwark and a Raptor in formation over the fighter's beam.
