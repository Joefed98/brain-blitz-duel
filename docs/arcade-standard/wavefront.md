# Wavefront on the arcade scoring standard (wavRev 12, 29 Oct 2026)

## Levels (D5, 23 Nov 2026)

Folded into the unshipped **wavRev 16** (no round was ever dealt on it; no new stamp number), with Normal's scoring refit
(Joe's rule of 23 Nov 2026 and his approval of the refit: the wider formation had dropped the realistic elite's 200s from
21 % to 0 %). The spec's lever (`docs/polish-plan-final/difficulty-spec.md` "### Wavefront"): **the enemy bolts in the
air**. wavRev 15 keeps its own table (`WAVEFRONT_LEVELS`) and every older round replays and scores exactly as before
(`scripts/fixtures/d5-levels-legacy.json.gz`, `wavefront-wide-legacy.json.gz`).

**Normal's scoring** (`WAVEFRONT_STD_WIDE`, `WAV_V16_SAUCERS_FULL`, `WAV_V16_WEAK_FULL`): the saucers part (20) is full at
**4 of the 5** saucers a run flies (5 a saucer), the cannons and weak points part (10) at **5 of the 6** (2 each); the
core (150 at 294 units), the boss's two parts and the lives are wavRev 15's. Play is unchanged: the Normal-play legacy
fixture (`scripts/fixtures/wavefront-ladder-legacy.json.gz`, 100 runs recorded before the refit) replays to the same final
state; only scores move, never down.

**The levels** (`WAVEFRONT_LEVELS_WIDE` in `src/lib/arcade/retroLevels.ts`, read from the run's state `lv`; the registry
mirrors it; the sim's fire table is `wavWideVolley` / `wavWideLv` in `src/lib/arcade/wavefront.ts`):

| | Easy | Normal | Hard | Expert |
|---|---|---|---|---|
| Bolts a volley | 1 for the whole run | 1, two from wave 3 on one volley in three | **2** from wave 1, 3 from wave 3 | **3** from wave 1, 4 from wave 3 |
| Bolts in the air at most (the boss's included) | 4 | 10 | 14 | 18 |
| Divers | none | from wave 3, two at once from wave 4 | from wave 2, two from wave 3 | from wave 1, two from wave 2 |
| Lives | 4 | 3 | 3 | 2 |
| Bolt speed, boss hit points, boss kill time | 80 %, 80 %, 24 s | 100 %, 100 %, 20 s | as Normal | as Normal |
| Saucers full at / weak points full at | 3 / 4 | 4 / 5 | 4 / 5 | 4 / 4 |
| First seconds | a single slow bolt at a time, four lives | | bolts fall in pairs from the first volley | triple volleys, a ship diving within seconds, two lives |

Each volley's bolts come from different columns of the formation's lowest two rows; a level's divers start on its own
wave (160 ticks between dives on the first, 20 fewer each wave after, never under 100). The spec's "three from wave 3" is
every volley (`upOdds` 1): tried on Hard with Normal's one volley in three (`upOdds` 3), 48 deals left the average
player at 158 against 155 with every volley, too close to Normal's 161 for a step (the bots dodge pairs easily).

**The proof.** Each level deals from its own list (`src/lib/duel/wavefrontDealV16.server.ts`, built by
`bun scripts/wavefront-wide-deal.ts [--level=…] [--check]`; witnesses `scripts/fixtures/wavefront-wide-deal-witness.json.gz`):
a seed is kept at a level only when the skill-band flawless player **held to the human limits** (0.25 s to react, 0.15 s
to move; its saucer reaction only ever later, by one of the jitter ticks) scores exactly 200 through the server replay at
that level, unflagged. 100 seeds a level: Normal 100 of 101 candidates, Easy 100 of 100, Hard 100 of 104, Expert 100 of
106.

**Measured** (the D5 ladder, `bun scripts/d5-ladder-record.ts wavefront --deals=96`, both players held to HUMAN_LIMITS,
real deals graded by the server; `scripts/fixtures/d5-ladder-wavefront.json.gz`):

| Level | Average before → after | Elite before → after | Elite at 200, before → after |
|---|---|---|---|
| Easy | 171.4 → **182.7** | 191.9 → **198.2** | 4 % → **71 %** |
| Normal | 159.0 → **166.6** | 192.2 → **194.5** | 5 % → **41 %** |
| Hard | 152.4 → **150.6** | 190.6 → **194.1** | 6 % → **32 %** |
| Expert | 126.4 → **136.7** | 185.1 → **182.4** | 3 % → **26 %** |

"Before" is wavRev 16 as first built (wavRev 15's levels, the old lines, the first deal). Joe's ladder test passes: the
average player steps down 16, 16 and 14 points; the elite reaches 200 on 71 %, 41 %, 32 % and 26 % of runs. The spec's
average targets (Hard 55–75, Expert 25–45) are far below what the bots score here: they dodge every bolt they have seen
for a reaction, so the extra bolts cost the average player time (slower clears, fewer boss kills: 57 %, 28 %, 19 % of
runs at Normal, Hard, Expert) more than lives.

`scripts/wavefront-ladder-check.ts` proves it all (Normal's play, the older stamps, the rules on every tick, the lines,
the deals and witnesses, the recorded ladder and a live sample of it, the lever picture). **The intro demo needs
recording on wavRev 16** (as before; only a wavRev 16 demo plays).

## wavRev 16 (D5, 22 Nov 2026): the wider formation

Joe's approval of 20 Nov 2026 (earlier plan C1.6, `docs/polish-plan-final/earlier-plan.md`; plan section 8.2). wavRev 15's
world, waves, bosses, charged shot, larger hit cells, levels (`WAVEFRONT_LEVELS`; since 23 Nov 2026 its own, "Levels" above), parts and scoring (Normal refit since 23 Nov 2026) exactly,
with the formation spread wider so it fills more of the 390 px sky (`WAV_REV_WIDE`, `src/lib/arcade/wavefront.ts`):

- **Wave 1's grid** sits on a 52 px column pitch (`WAV_V16_PITCH_X`, was 44): 288 px wide instead of 248, centred
  (`WAV_V16_START_X` 51). Rows (36 px) unchanged.
- **Waves 2–5's shapes** (`WAV_FORMS_W`, with their six escorts `WAV_FORMS_XW`): every outline ship spread about the
  shape's centre until the shape is 326 px wide (`WAV_V16_FORM_W`; was 306, 288, 290 and 306), rows unchanged; the armour
  core keeps its 44 px spacing (so the warship is drawn over its cells exactly as before) and its centre moves by the same
  spread. No two cells overlap that did not already.
- **Everything that places a ship follows**, because it all reads the state's geometry (`wavShapeBox`, `wavForm`,
  `wavPitchX`): the hit boxes, the divers' starts and returns, the march's wall limits, enemy fire's columns and each
  wave's centring. The gunship and the mothership are centred on the world and move as before. States add `wide: 1`,
  folded into the checkpoint checksum last; every older revision plays, replays and scores exactly as before.
- **The art** follows with no renderer change: each hull is drawn on its own `wavShapeBox`, 4 px past the cell (inside
  the 3 px larger hit box plus the bounds rule's 2 px), and the renderer's own copy of the 44 px pitch is used only for
  the armour warship, whose spacing stays 44 (the renderer only gained wavRev 16's art game, `wavefrontArtGameFor`).

**Why 326 px, not the pitch's 52 / 44.** The plan's first recipe spread the shapes by the grid's own 52 / 44 (336–356 px).
That leaves the march 18 px of room on waves 2 and 5, so the formation drops a row at every second step and comes down
three to four times as fast. Measured with `bun scripts/wavefront-wide-variants.ts` (the skill-band bots held to
HUMAN_LIMITS, the deal builder's first candidate seeds; "reached" = runs the formation ended by reaching the ship's line):

| Players held to the limits | wavRev 15 | wider grid only | wavRev 16 (326 px) | 52 / 44 spread (336–356 px) |
|---|---|---|---|---|
| Average, Normal (60 seeds): mean, reached | 166.8, 0 | 167.2, 0 | 163.5, 0 | 151.1, 10 of 60 |
| Average, Hard (60 seeds): mean, reached | 157.3, 0 | 159.8, 0 | 149.5, 0 | 133.4, 17 of 60 |
| Normal, flawless (12 seeds × 8 jitters): mean, reached, at 200 | 194.3, 0, 21 | 194.7, 0, 31 | 193.6, 0, 14 | 173.8, 38, 4 |

326 px keeps 48 px of march, six 8 px steps a pass.

**The deal** (`src/lib/duel/wavefrontDealV16.server.ts`, built by `bun scripts/wavefront-wide-deal.ts [--check]`;
witnesses `scripts/fixtures/wavefront-wide-deal-witness.json.gz`; wavRev 15's `WAV_DEAL` untouched): a seed is dealt only
when, at Easy, Expert, Normal and Hard, a witness scores exactly 200 through the server replay, unflagged, and every
witness is the skill-band flawless player **held to the human limits** (`new Human("wavefront", seed, "perfect",
HUMAN_LIMITS)`, 0.25 s to react, 0.15 s to move, the Oct 2026 fixes on), its saucer reaction delayed by one of today's
jitter ticks (0–50) until one does. 100 of the first 397 candidates (the skill-band room seeds n = 0–59, then from
10000) were kept; the 297 left out first failed at Easy 181, Expert 71, Normal 24 and Hard 21 (Easy's boss, at 80 % of
its hit points, falls before the last cannon or saucer is taken more often). The wider formation halves the yield: on
the same first 100 candidates and the same human-limited search, wavRev 15 keeps 47 and wavRev 16 22 (a saucer is
harder to reach past ships spread across more of the sky). The wavRev 15 deal (100 of 212) was built without the limits.

**Pins.** `wavPreWide` (`DEAL_PINS`, `pinWavPreWide`) deals wavRev 15 from `WAV_DEAL` exactly as before; `preRetro` still
deals wavRev 13.

**Measured** (`bun scripts/d5-ladder.ts wavefront --deals=24`, real deals graded by the server, both players held to
HUMAN_LIMITS; at200 = the share of runs at 200):

| Level | Player | Before (wavRev 15, `WAV_DEAL`) | After (wavRev 16, `WAV_DEAL_V16`) |
|---|---|---|---|
| Easy | Average | avg 172.0, median 175, best 189, at200 0 %, boss killed 83 % | avg 169.5, median 168, best 185, at200 0 %, boss killed 67 % |
| Easy | Elite | avg 193.4, median 194, best 200, at200 13 % | avg 193.1, median 192, best 200, at200 8 % |
| Normal | Average | avg 169.3, median 173, best 185, at200 0 %, boss killed 75 % | avg 159.0, median 156, best 187, at200 0 %, boss killed 38 % |
| Normal | Elite | avg 195.3, median 196, best 200, at200 21 % | avg 193.4, median 194, best 198, at200 0 % |
| Hard | Average | avg 164.3, median 170, best 183, at200 0 %, boss killed 58 % | avg 151.0, median 143, best 185, at200 0 %, boss killed 29 % |
| Hard | Elite | avg 193.5, median 194, best 200, at200 8 % | avg 189.7, median 191, best 200, at200 4 % |
| Expert | Average | avg 149.0, median 140, best 183, at200 0 %, boss killed 29 % | avg 125.7, median 118, best 182, at200 0 %, boss killed 8 % |
| Expert | Elite | avg 192.7, median 194, best 200, at200 17 % | avg 182.5, median 190, best 200, at200 4 % |

The two columns are different seeds (each stamp's own deal). On the same 24 wavRev 16 deals, played as wavRev 15, as
wavRev 16 with only the wider grid, and as wavRev 16 (averages; scratch measurement with the ladder's players):

| Level | Player | wavRev 15 | wider grid only | wavRev 16 |
|---|---|---|---|---|
| Normal | Average | 164.9 | 167.1 | 159.0 |
| Normal | Elite | 194.9 | 193.2 | 193.4 |
| Hard | Average | 156.3 | 156.5 | 151.0 |
| Hard | Elite | 193.0 | 193.3 | 189.7 |
| Expert | Average | 134.5 | 128.3 | 125.7 |
| Expert | Elite | 189.2 | 191.4 | 182.5 |

So the wider grid alone costs little (Average −6 to +2, Elite −2 to +2); with the wider shapes the Average player loses 5
to 9 points and the Elite 1.5 to 7 against wavRev 15 (slower clears: bolts pass between ships spread further apart, so
fewer bosses fall in the 90 s). The levels' tables are unchanged; tune them on this Normal.

**Proofs.** `scripts/wavefront-wide-check.ts`: wavRev 15 (every level), 14 and 13 runs recorded before the change
(`scripts/fixtures/wavefront-wide-legacy.json.gz`, `bun scripts/wavefront-wide-legacy-record.ts`) replay to their recorded
score and final state; the stamp and pins; the geometry (the grid, each shape's rule and width, no new overlap, the
escorts, the march's room, no ship drawn or hit outside the world on any tick of runs at every level, each ship's drawing
on its hit box); the deal file rebuilt from its witnesses, every witness at 200 at every level and re-played as the
human-limited player's own log; 2,000 deals on proved seeds; the parts' 200 and a witness through `gradeAnswer` on a
dealt puzzle. **The intro demo needs re-recording on wavRev 16** (only a wavRev 16 demo plays now).

## wavRev 15 (the Retro overhaul, stage 3, 16 Nov 2026): larger hit cells

wavRev 14's world, waves, bosses, charged shot, parts and scoring exactly, with each ship's hit box reaching
`WAV_V15_HIT_PAD` (3 px) further on every side (34 px where the cell is 28), formation and divers; the hull is drawn 4 px
past the cell (`WAV_V15_HULL_BLEED`), inside the bounds rule. The flawless bot still reaches 200 (4 recorded runs,
scripts/fixtures/wavefront-big-runs.json.gz, `bun scripts/wavefront-big-record.ts`), but on fewer seeds than wavRev 14:
its bolts now meet ships first more often, so a saucer can pass unhit. So rooms deal wavRev 15 only on proved seeds
(`WAV_DEAL`, `wavefrontDeal.server.ts`, `bun scripts/wavefront-big-deal.ts [--check]`): each has a stored witness scoring
exactly 200 through the server replay at Normal, Easy, Hard and Expert (wavefront-deal-check). Levels: lives, enemy bolts'
speed, the final boss's hit points and the kill time (Expert 16 s, as Hard). States add `big: 1` (checksum, last). Rooms
deal it (preRetro: wavRev 13 on the room seed). The wider formation followed in wavRev 16 (above).

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

## wavRev 13: progress made always counts (Nov 2026, the scoring audit)

`docs/audit-nov-2026/scoring.md` issue 2: a slow sweep that shot 30 ships (core 15) and lost all three lives (−15) scored
1. wavRev 13 (`WAV_REV_KEEP`) is wavRev 12's play and parts exactly (states add `keep: 1` outside the checksum), with the
lives' cost changed: the life that ends the run is not charged (only lives lost before it cost 5), and lives never take
more than half the ships, hits and waves points.

| Level | Weak | Average | Good | Great | Near | Elite | Flawless |
|---|---|---|---|---|---|---|---|
| wavRev 12 | 137 (108–159) | 155 (130–177) | 173 | 186 | 191 | 194 | 196 (192–200) |
| wavRev 13 | 140 (113–159) | 155 (135–177) | 173 | 186 | 191 | 194 | 196 (192–200) |

The bots rarely lose lives, so the medians barely move; the change matters for short runs (weak minimum 56 → 61). Issue 11
(Wavefront's compressed bands) is not part of this change. Proofs: scoring-audit-arcade-check, arcade-standard-check.

The table's medians (p10–p90) are 30 room seeds, measured with `bun scripts/arcade-skill-bands.ts cross wavefront burst skyline slice --rev=now --seeds=30 --levels=all` on main and on this branch.
