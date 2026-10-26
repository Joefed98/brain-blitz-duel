# Arcade skill bands with an elite level (Oct 2026)

26 Oct 2026. Measurement only: no game's scoring, stamps, `ROUND_MAX` or gameplay changed. This
report re-measures every arcade game on main and the twelve parked 200-point expansions with the
skill-band bots (`scripts/arcade-skill-bands/`), after three changes to the tool:

1. **Three new levels** (`scripts/arcade-skill-bands/human.ts`):
   - **weak**: a casual first go (reactions 380 ± 70 ms with frequent lapses, timing sd 65 ms,
     aim sd 13 px, a slip one decision in six);
   - **elite**: a top-1 % human (reactions 145 ± 15 ms, timing sd 9 ms, aim sd 1.8 px, a lapse one
     decision in 300, a slip one in 250). A step past near-perfect (160 ms, 12 ms, 2.5 px), not
     superhuman: the overnight queue's extrapolated elite (140 ms, 8 ms, 1.5 px, never committed)
     was past what a finger on glass delivers run after run. Each bot's per-level tables carry
     elite values chosen per game, and elite plays a **protect-the-base policy**: it takes a
     feature only when that doesn't cost more base points than it pays;
   - **flawless** (`perfect`): no human error at all. It is not a player: it estimates each seed's
     **ceiling**, the most a run could score on that seed.
2. **Competent bots**: every bot was checked for under-play at near-perfect (does it complete what a
   strong human completes, use the controls properly, retry with a corrected plan) and fixed where
   it fell short (per game below). The fixes are gated on `BotCtx.fixes`, which only the band tool
   sets, so every check that runs a bot plays exactly as before (`--bots=v1` reproduces the old bots;
   each fix was proved score-identical with it off).
3. **Paired seeds** (Joe's ruling, 26 Oct: every player in a room plays the identical run, so seed
   luck is not a fairness problem): every level plays the same seeds, the tables compare levels on
   those same seeds, and the steps between levels are the median of the per-seed differences.

## How to read the tables

- **Tuning seeds**: n = 0–59 (`roomSeed(n)` and each game's own dealing), the seeds bots and
  expansions were tuned on. **Fresh seeds**: n = 10000–10199, never used for tuning by anyone.
- Each cell is median / top 10 % (the 90th percentile) of the replayed score: every run's input
  log goes through the server's own encode + replay, and only the replayed score counts.
- **Zeros**: runs scoring 0.
- **Ceiling**: per seed, the best score any level reached on it (the flawless bot included).
  It is a floor on what a perfect run could score there: a bot plans within its own heuristics,
  so a seed "below max" means no bot found a route to the maximum on it, which for features
  placed by the seed usually means the seed offers too little.
- **Flags**: medians must rise weak < average < good < great < near-perfect < elite; flagged when
  not, when good → near-perfect is under ~25 or when near-perfect → elite is under ~10 (fresh).
- **Gates** (200-point games): the overnight queue's bar: good within ±10 % of the revision before
  the expansion (main's score-band revision on the same seeds); near-perfect median 165–175 with
  its top 10 % at most ~185; elite median at least ~175 and top 10 % 190–200; no zeros for weak or
  average play.

Reproduce: `bun scripts/arcade-skill-bands.ts <games> --rev=now --levels=all --seeds=60 --jobs=4
--json=tuning.json`, the same with `--from=10000 --seeds=200 --json=fresh.json`, then
`bun scripts/arcade-bands-elite.ts main=tuning.json,fresh.json`. On a parked branch, apply its
patch from `scripts/arcade-skill-bands/parked/` first (it adds the same tool and that branch's bot
fixes).

## Headlines

- **The old bots were the problem in most of the parked failures.** In 16 of 22 games the near-perfect bot
  under-played, often so badly that even the error-free bot could not do better: it was the bot's plan, not the human
  model (table below). Fixed, the picture flips for most parked games: near-perfect now collects nearly everything the
  game pays, and elite has little left to win.
- **Paired seeds:** with every level on the same seeds, medians rise level by level in every game except where a score
  cap ties them. The exceptions are Rainbow Bridge's weak = average on inkRev 9 (both stall on level 1–2) and Fission
  on burstRev 7 (elite 172 against near-perfect 174). Gaps under the flag thresholds are listed per game below.
- **Main's 150-point curves were fitted on the old bots.** With competent bots, Fission (burstRev 6) gives good and every
  level above 150; Wavefront, Roofbound, Jaywalk, Flightpath, Orbit and Rally put great or near-perfect at or near 150.
  The curves are lenient for competent play; no curve was changed here.
- **The 10 shipped 200-point games** (Ball Tracker, Tempo, Swish, Breaker, Coral Pop, Gemstone, Pinball, High Rise, Slice,
  Meteor) all rise level by level. Near-perfect → elite is under 10 in Tempo (8), Breaker (8), Pinball (1) and Slice
  (0: the base curve is flat from 704 to 797 units and the bonus near its cap). Gemstone reaches 200 on no seed (its
  treasure sticks where no swap frees it) and Swish's elite median is 200.

## The 12 parked games

Joe's classes (26 Oct): **(a)** passes with the fixed bots (a payout exists that meets the bar); **(b)** needs guaranteed
opportunities (seeds on which even flawless play can't reach 200); **(c)** needs skill headroom (near-perfect already
collects nearly everything, so elite can't score higher). Seed luck is not a failure reason (every player in a room
plays the same seed). "Payout" is the feasibility test in each game's section: whether any one rising remap of today's
scores could meet every score gate on both seed sets at once. "Before" for the good gate is main's score-band revision
on the same seeds with the same fixed bots. Fresh seeds unless stated; the tables per game are further down.

| Game | Branch | Near-perfect median / top 10 % | Elite median / top 10 % | Flawless | Fresh seeds below 200 (lowest) | Payout | Verdict | The overnight failure was |
|---|---|---|---|---|---|---|---|---|
| Jaywalk | e1-parked | 183 / 195 | 192 / 200 | 198 | 102 of 200 (163) | exists, steep top | **(c)**, a little (b) | measurement first (the bot hopped between kerb and lane 1), now a real design limit |
| Hover | e1-parked | 179 / 194 | 194 / 199 | 194 | 199 of 200 (156) | exists | **(c)** plus zeros | real design: elite = flawless; 199 is the practical top; average scores 0 on 11 of 200 |
| Rainbow Bridge | e1-parked | 157 / 181 | 171 / 191 | 195 | 142 of 200 (0) | exists | **(b)** plus zeros | measurement first (near potted 5 of 10 levels; now 7.9), now real design |
| Roofbound | e7-parked | 192 / 200 | 200 / 200 | 200 | 31 of 200 (153) | none | **(c)**, a little (b) | measurement first (double flips cost gold stars: the 158 vs 195 swing), now real design |
| Orbit | e7-parked | 185 / 193 | 187 / 196 | 190 | 193 of 200 (147) | none | **(c)** plus zeros | real design (near ≈ elite), with a measurement caveat (features) |
| Grappler | e7-parked | 161 / 169 | 166 / 173 | 165 | 200 of 200 (154) | exists only by stretching 170 → 190 | **(b) and (c)** | measurement in part (the bot died to the dragon), now real design |
| Wavefront | e8-parked | 168 / 183 | 171 / 186 | 176 | 193 of 200 (156) | exists, 3-point stretch | **(b) and (c)**, nearest to passing | measurement (boss aim, good's seed-set swing gone), now a time limit |
| Tilt | e8-parked | 158 / 183 | 160 / 186 | 167 | 197 of 200 (17) | exists only by stretching | **(b)**, with (c) | measurement first (a stuck detector rolled strong players into holes), now real design |
| Scrumper | e8-parked | 143 / 177 | 147 / 173 | 200 | 86 of 200 (152) | none | **(b)** plus a precision wall | measurement in part (cut windows), now real design |
| Rally | #154 practical-curie | 180 / 200 | 187 / 200 | 191 | 110 of 200 (115) | none | **(c)**, with (b) | measurement (gold balls given up; the tuning/fresh split is gone), now real design |
| Fission | #155 vigilant-fermi | 174 / 190 | 172 / 190 | 172 | 192 of 200 (163) | none | **(c)**, with (b) | measurement in part (BURST played as the harpoon), now real design |
| Flightpath | flightpath-e5-parked | 196 / 200 | 200 / 200 | 200 | 7 of 200 (177) | none | **(c)** | real design, confirmed (the bot was also broken: it ignored the sway) |

**None is (a) outright.** Jaywalk, Wavefront and Hover come closest: a payout exists. Jaywalk's must squeeze its top 5 points;
Wavefront's must separate near-perfect's top 10 % (183) from elite's (186). Hover also has average-play zeros, which no
payout lifts.

### Why, game by game

- **Jaywalk (crossRev 8): (c), a little (b).**
  - The bonus (coins + streak) is capped at 50, and near-perfect fills most of it: about 93 % of what the best run on
    the seed scores.
  - Elite gains 9 on the median (6 paired); flawless reaches 198.
  - On half the fresh seeds no run reaches 200, but the lowest best run is 163 and the median 198. That is mostly the
    cap binding, not missing coins.
  - Good holds ±10 % (116 against 120).
  - The overnight "no payout reaches 165" came from the old bot looping at the kerb. Fixed, near-perfect is 183.
- **Hover (hoverRev 8): (c) plus zeros.**
  - Elite and flawless both score 194 on fresh seeds; near-perfect's top 10 % is also 194. Nothing above near-perfect
    is left for elite to win except surviving.
  - The base tops out at 149, so 199 is the practical maximum: the best run reaches 199 on most seeds, and 200 on one
    in 200.
  - Weak and average score 0 on 33 and 11 of 200 fresh seeds: crashes before the first barrier, which scores nothing
    (hoverRev 7 behaves the same). The crash rate there is no higher than at later barriers.
  - A payout exists for the medians, but the zeros fail the bar whatever the payout.
- **Rainbow Bridge (inkRev 9): (b) plus zeros.**
  - Separation is healthy: near-perfect → elite +9 paired; flawless 195.
  - On 142 of 200 fresh seeds no run reaches 200, and on one even the flawless bot scores 0. That is a level-1
    "needle", where no hand-drawable line was found: on another seed, 3 of 2,160 hand-made variants pot.
  - The level generator proves exact reference lines, not lines a finger can draw. Needle levels and the live levels
    9–10 are what limit every level.
  - Weak and average both stall on level 1–2 (median 42 each): average scores 0 on 54 of 200 fresh seeds, weak on 95.
  - Good is 71 against 79 on main (−10 %, outside).
- **Roofbound (flipRev 7): (c), a little (b).**
  - Near-perfect takes all ten gold stars on most runs (top 10 % 200); elite's median is 200.
  - The only thing separating the top levels is the tenth gold star (worth 42 points at the 147 → 150-unit cliff).
  - On 31 of 200 seeds a gold star becomes readable only one reaction before the last flip that takes it, so even the
    flawless bot misses it.
  - No payout can put elite's top 10 % above near-perfect's.
- **Orbit (orbitRev 11): (c) plus zeros, with a measurement caveat.**
  - Near-perfect 185, elite 187, flawless 190; no payout separates them.
  - Good is +14 % (123 against 108), outside ±10 %.
  - Average scores 0 on 18 of 200 fresh seeds: a slip on the first release, at the same rate as on later hops.
  - Caveat: the bot aims at features only within the window it picked. Even error-free play takes about 39 of the 50
    feature points, while the bank's witness run proves every one can be taken. A feature-aware planner could lift
    elite and flawless; it would not lift the ceiling of what human-like play reaches.
- **Grappler (swingRev 12): (b) and (c).**
  - No seed reaches 200 for any level (best run median 169, lowest 154).
  - Near-perfect 161, elite 166, flawless 165: precise play is already at the top of what the human model reaches.
  - The gap is combos (25 points) and gems (12). The bots take 1–2 combo points and 2–3 gems; the beam-search witness
    takes 17–23 and 7–11.
  - Combos need chains of 25+ fast regrabs, about one a second. Valuing them in the planner shortened runs and lowered
    scores. Whether a person can chain like that is the design question.
- **Wavefront (wavRev 9): (b) and (c), nearest to passing.**
  - Near-perfect meets its band on both seed sets (168 / 183 fresh, 167 / 181 tuning); good holds ±10 % on both.
  - Elite is only +3 (171 / 186), and flawless reaches 176 / 193. No run at any level reaches 200 on 193 of 200 fresh
    seeds.
  - The binding limit is time: the mothership arrives around tick 4450–4580 of 5400, and even flawless kills it in
    only about two runs in three.
  - About 185 is the practical top for strong play on this revision.
- **Tilt (tiltRev 7): (b), with (c).**
  - On 197 of 200 fresh seeds no run reaches 200 (best run median 173).
  - Some ice corridors with three parallel drops stop even the flawless bot (the lowest best run is 17).
  - Near-perfect 158, elite 160, flawless 167.
  - Good is 105 against 128 on the tuning seeds (outside ±10 %) and 110 against 111 on fresh seeds.
- **Scrumper (snipRev 10): (b) plus a precision wall.**
  - The flawless bot scores 200 on most seeds; on 86 of 200 fresh seeds no run reaches 200.
  - The human levels can't get near it: near-perfect 143, elite 147, against flawless 200. Later cuts tolerate only
    ±1–2 ticks (17–33 ms), and near-perfect's 12 ms timing spread loses fruit there.
  - Near-perfect reaches only 72–76 % of what the best run on the seed scores. This is not (c): the headroom exists,
    but only with machine timing.
- **Rally (rallyRev 9): (c), with (b).**
  - Skill points reach their 50 cap at near-perfect, mostly from spin shots (40), so above near-perfect only base points
    separate players.
  - Near-perfect's top 10 % is 200. On 110 of 200 fresh seeds even flawless play misses 200, because the gold-ball
    schedule forces genuine two-ball conflicts.
  - The overnight tuning-vs-fresh split (166 vs 130–137) is gone: near-perfect is 186 on the tuning seeds and 180 on the
    fresh ones.
  - Joe is replacing the gliding pads and multi-ball.
- **Fission (burstRev 7): (c), with (b).**
  - Base points are capped from great up (near-perfect averages 105–108 units on a curve that tops at 92).
  - Features pay about 20–26 of 50 at every level from good up, so near-perfect (174), elite (172) and flawless (172)
    tie. Good is 161 against 150 (+7 %).
  - Chains and golden atoms are still under-collected (the bot has no chain planner). Joe is replacing these features.
- **Flightpath (bullRev 7): (c).**
  - Once the bot allows for the sway, near-perfect puts all ten darts in the gold 10 and reaches the 50-point streak cap
    (196 / 200).
  - Elite and flawless score 200.
  - Seeds are not the limit: 193 of 200 allow 200. The streak is all-or-nothing on the bull rate.

## What was wrong with the bots, game by game

Every change below is gated on `BotCtx.fixes` (`--bots=v1` and every check play the old bots: 352 records on the
four core levels across all 22 games compared score for score, 0 differences; the 15 checks that import a bot pass).
"Flawless" is the no-error level; when even it fell short, the cause was the bot's plan, not the human model.

| Game | What the near-perfect (and often the flawless) bot did wrong | What changed |
|---|---|---|
| Rainbow Bridge | On about 1 level in 8 its line search found no line that pots even with no hand error (the proved reference is often not drawable on a phone: a near-vertical leg breaks into wall pieces); it redrew the same line after every failed drop; live ramps were drawn at 12 px a tick and only became solid on lift, while the phone sends the newest finger point every tick; moving pots were released at the edge of the window; stars were tried on lines that held 1 wobble in 6. Near-perfect potted 4.5 of 10 levels, flawless 8.0. | A wider planner (`inkPlan`: seeded ramps, ramp + chute, backstop walls, 8-wobble reliability with hill-climbing; moving pots aim at the middle of the widest window; live ramps drawn and judged as the phone sends them over 12–26-tick hand delays); retries move to the next-ranked line; a star or trick line only when it holds 8 of 8 wobbles (7 of 8 for near and elite on inkRev 9) and never with one failure left. Near now pots 7.8 levels, flawless 9.6. |
| Jaywalk | Planned one lane at a time and wanted 22 clear ticks at every level, so it could hop between the kerb and lane 1 for 50 s (flawless, seed 6). | A look-ahead search through the traffic as the player sees it (one lane ahead up to great, two for near and elite, three for flawless), per-level margins widened by read error, impatience after ~5 s without progress. crossRev 8: a coin only on a way as safe and at most 60–90 ticks slower, never once the bonus is full. |
| Hover | Flew lines that a few ticks of lateness ruin; no look-ahead to the next barrier. Flawless crashed in 18–23 of 60 runs, all survivable by brute force. | Among the best one- or two-tap lines, the one that keeps the most room one timing sd early or late; a full tap-sequence search when no simple line works; one barrier of look-ahead; gold stars only when that room is kept; hoverRev 8: a tight gate given up for the main gap unless the room is there or a shield is held. |
| Orbit | Released into 1–3-tick windows its own jitter often missed. | Each release window is judged by the chance the player's jitter loses the rocket; the first window under the level's tolerance, else the safest within the usual wait; elite and flawless take a hole or a feature only when its window passes the same test. |
| Roofbound | A star already read never triggered a re-plan; flipRev 7 double flips ignored the star and trail being planned for. | Re-plan on a newly read star; double flips respect it; combos stop once capped. |
| Grappler | Never reeled in, grabbed ropes it could not leave (the dragon caught even the flawless bot on 7 of 30 main seeds), ignored the clock. | Reel when stuck, no dead-hang grabs, pace from the clock after 30 s; near-perfect and up plan each release tick by tick weighted by their own timing spread and look one rope ahead for ledges (swingRev 12). |
| Wavefront | The boss aim error was a fixed 19 px at every level and the lead never allowed for the boss turning at a wall (27 % of even the flawless bot's boss shots missed); bolts fired at a column already finished by bolts in flight. | Lead through the wall turn, boss aim spread from the player's own aim, no shot at a covered column; elite and flawless take a saucer only within 60 px. |
| Tilt | Its "stuck" detector fired a random tilt 4 s after every star (no hole check), so the levels that took most stars wandered into most holes: near and elite scored below great; dead spots also got random tilts; stars taken against the clock. | Stuck detector reset per goal, safe random tilts or a two-move plan or the other marble; a brake check short of holes; a star dropped when the pace can't spare the detour; elite and flawless never take a star at a hole's mouth. Runs ending in a hole or caught: near 22 → 6 of 60. |
| Scrumper | Cut at the middle of a 3-tick-sampled timing window, a tick it never tested; windows have gaps, so fruit was lost with no human error. | The centre of a run of ticks that all work. Elite and flawless go for the golden leaf only when the window is at least 4 timing sd wide. |
| Rally | Gave up a gold ball whenever the blue one landed within 30 ticks, though the finger crosses the court in under 10. | A gold (or twin) is given up only when both can't be reached. rallyRev 9: once skill points are capped, no flicks or multi-ball aiming. |
| Fission | Played the BURST power-up like the harpoon (waited for all three short shots to leave the screen; the harpoon's hit test), ~1.3 hits a press, so the better the player (catching BURST more often) the worse it did: near-perfect below great. burstRev 7: ignored the DOUBLE beam's offset lines; chased capped golden atoms. | Re-press as soon as the burst is away and predict whether a short shot meets an atom (twice the hit rate); DOUBLE-aware aiming; capped golden atoms ignored. No chain planner (chains are still opportunistic). |
| Flightpath | Ignored the reticle's sway on the seven drifting-board darts at every level: every throw landed 5–9 px off, so even the flawless bot missed the inner bull and the streak. | A per-level share of the sway allowed for (weak 0.2 … flawless 1); near and up throw balloons through the part over the 10 and only when pop + ring pays at least a plain dart (bullRev 7: never outside the 10, so the streak is kept). |
| Slice | Held off for triples while ×3 was already live, letting ~22 of ~125 foods fall even at flawless; the extrapolated elite chased gold and tickets while foods fell (the merge's Slice problem). | With ×3 live and over 4 s left, stroke through everything in reach (chance by level from good up); elite and flawless go for gold or the ticket only when no other food leaves within 1 s, and never past the bonus cap. |
| Gemstone | Found moves under the treasure gem only by chance. | Treasure-column scans first and two-move set-ups under it. Treasures still stick 1–2 rows from the bottom where often no swap frees them: no level reaches 200. |
| Ball Tracker | ~2 marbles a run (flawless) to the wrong cup just after a re-lay or colour shuffle. | Routes re-checked when the countdown appears, on the real landing tick; boosters taken when cheap. Flawless wrong cups 2.1 → 0.2 a run. |
| Swish | Read arcs only to the old 390 px edge, so far-bucket throws on the 430 px fairground became flat drags (flawless 8.2 of 10 buckets). | Arcs read to the rim of the wider fairground. |
| Breaker | Weak never lost a ball (its landing read sharpened as the ball fell) and scored above average. | Weak chases the ball's current position 70 % of rallies and moves slower; elite and flawless value paddle positions by what they actually pay. |
| Pinball | Weak aimed its plunges like everyone and earned more skill shots than average. | Weak plunges without aiming, 70 % reflex flips; elite values a drained ball at 8,000 table points and always shoots a ball resting on a flipper. Lane sets (J-O-U-L-Z) are completed ~0.3 times a run at every level: not planned for. |
| Meteor | – | Elite and flawless take a gold comet only when it pays more than the stars the detour costs, never past the cap. |
| Coral Pop | – | Elite and flawless ignore capped features. |
| Tempo | – | Flawless no longer drops notes from overload. Near-perfect already collects 48.5 of 50 feature points. |
| High Rise | – | None (a pure timing game, no feature choice). |

**Elite tables.** Each bot's per-level tables carry per-game elite and flawless values (in the bot files); the
shared elite profile needed no per-game override (`ELITE_BY_GAME` is empty). Where an agent saw a lever it did not
pull (Swish, High Rise, Tempo: elite timing or aim; Scrumper's read), the report says so in that game's section.

**Consequence for main's curves.** The score-band curves on main were fitted on the old bots. Where a bot was
crippled, competent play now reaches the top of the curve early: on Fission (burstRev 6) good and every level above
score 150; on Wavefront, Roofbound, Rally, Jaywalk, Orbit and Flightpath (150-point games) great or near-perfect sit
at 142–150. That is a finding about those curves (they are lenient for competent play), not a change to them.

## Caveats

- **The ceiling is a floor.** "Seeds below 200" counts seeds where no bot found a 200 route, the flawless one included.
  A bot plans within its own heuristics (Orbit's features and Grappler's combos are known gaps; recorded witness runs
  do better), so a seed below 200 here may still allow 200 to a better planner, though not necessarily to a person.
- **Comparisons with older measurements** (the expansion docs, the overnight queue's tables) used the old bots. The
  fixes moved the core levels too (most up, a few down by a few points from RNG-stream changes), so compare within
  this report only. `--bots=v1` reproduces the old bots exactly.
- **The parked branches were not touched on GitHub.** Their runs used each branch's code with the same tool and that
  branch's fixed bots, saved as patches in `scripts/arcade-skill-bands/parked/` (each applies cleanly to its branch:
  `git apply scripts/arcade-skill-bands/parked/<branch>.patch`). The good gate's "before" is main's score-band
  revision (the revision each expansion replaces) on the same seeds and bots; the parked branches' own copies of the
  old revision were not re-run.
- Elite needed no per-game profile override (`ELITE_BY_GAME` is empty). Levers noted but not pulled: elite timing for
  High Rise and Tempo, elite aim for Swish (its elite median is 200), Scrumper's read error.

## All games: summary (fresh seeds)

| Game | Source | Max | Fresh medians: weak / average / good / great / near / elite | Flawless | Seeds below max / lowest ceiling | Flags |
|---|---|---|---|---|---|---|
| Ball Tracker | main | 200 | 40 / 72 / 101 / 139 / 172 / 198 | 200 | 96 / 140 | – |
| Tempo | main | 200 | 27 / 68 / 101 / 135 / 171 / 179 | 200 | 15 / 192 | fresh: near-perfect → elite only 8 (under ~10) |
| Swish | main | 200 | 56 / 80 / 115 / 166 / 187 / 200 | 200 | 3 / 190 | – |
| Breaker | main | 200 | 68 / 81 / 112 / 144 / 169 / 177 | 180 | 200 / 144 | fresh: near-perfect → elite only 8 (under ~10) |
| Coral Pop | main | 200 | 37 / 79 / 104 / 128 / 168 / 183 | 190 | 200 / 152 | – |
| Flightpath | main | 150 | 53 / 66 / 102 / 132 / 148 / 150 | 150 | 0 / 150 | fresh: near-perfect → elite only 2 (under ~10) |
| Fission | main | 150 | 18 / 82 / 150 / 150 / 150 / 150 | 150 | 0 / 150 | tuning: Great median not above Good (150 → 150); tuning: Near-perfect median not above Great (150 → 150); tuning: Elite median not above Near-perfect (150 → 150); fresh: Great median not above Good (150 → 150); fresh: Near-perfect median not above Great (150 → 150); fresh: Elite median not above Near-perfect (150 → 150); fresh: good → near-perfect only 0 (under ~25); fresh: near-perfect → elite only 0 (under ~10) |
| Jaywalk | main | 150 | 50 / 82 / 120 / 144 / 150 / 150 | 150 | 45 / 141 | tuning: Elite median not above Near-perfect (150 → 150); fresh: Elite median not above Near-perfect (150 → 150); fresh: near-perfect → elite only 0 (under ~10) |
| Roofbound | main | 150 | 40 / 74 / 120 / 150 / 150 / 150 | 150 | 1 / 120 | tuning: Great median not above Good (120 → 120); tuning: Elite median not above Near-perfect (150 → 150); fresh: Near-perfect median not above Great (150 → 150); fresh: Elite median not above Near-perfect (150 → 150); fresh: near-perfect → elite only 0 (under ~10) |
| Hover | main | 150 | 25 / 76 / 113 / 120 / 149 / 149 | 149 | 195 / 118 | fresh: Elite median not above Near-perfect (149 → 149); fresh: near-perfect → elite only 0 (under ~10) |
| Rainbow Bridge | main | 150 | 33 / 51 / 79 / 103 / 121 / 144 | 150 | 53 / 53 | – |
| Gemstone | main | 200 | 51 / 68 / 85 / 109 / 131 / 147 | 168 | 200 / 97 | – |
| Orbit | main | 150 | 35 / 73 / 108 / 139 / 147 / 150 | 150 | 26 / 147 | fresh: near-perfect → elite only 3 (under ~10) |
| Pinball | main | 200 | 55 / 78 / 98 / 120 / 171 / 172 | 187 | 160 / 166 | fresh: near-perfect → elite only 1 (under ~10) |
| Rally | main | 150 | 43 / 70 / 103 / 142 / 143 / 144 | 145 | 162 / 104 | tuning: Elite median not above Near-perfect (144 → 144); fresh: near-perfect → elite only 1 (under ~10) |
| High Rise | main | 200 | 56 / 70 / 97 / 115 / 168 / 185 | 200 | 1 / 196 | – |
| Slice | main | 200 | 37 / 70 / 114 / 175 / 183 / 183 | 182 | 145 / 164 | tuning: Elite median not above Near-perfect (181 → 181); fresh: Elite median not above Near-perfect (183 → 183); fresh: near-perfect → elite only 0 (under ~10) |
| Meteor | main | 200 | 44 / 80 / 108 / 142 / 163 / 178 | 185 | 194 / 155 | – |
| Scrumper | main | 150 | 46 / 67 / 95 / 115 / 124 / 130 | 147 | 186 / 130 | fresh: near-perfect → elite only 6 (under ~10) |
| Grappler | main | 150 | 37 / 89 / 112 / 134 / 147 / 148 | 147 | 198 / 146 | tuning: Elite median not above Near-perfect (147 → 147); fresh: near-perfect → elite only 1 (under ~10) |
| Tilt | main | 150 | 44 / 86 / 111 / 129 / 138 / 140 | 143 | 200 / 55 | fresh: near-perfect → elite only 2 (under ~10) |
| Wavefront | main | 150 | 59 / 70 / 133 / 150 / 150 / 150 | 150 | 0 / 150 | tuning: Near-perfect median not above Great (150 → 150); tuning: Elite median not above Near-perfect (150 → 150); fresh: Near-perfect median not above Great (150 → 150); fresh: Elite median not above Near-perfect (150 → 150); fresh: good → near-perfect only 17 (under ~25); fresh: near-perfect → elite only 0 (under ~10) |
| Jaywalk | claude/e1-parked | 200 | 55 / 75 / 116 / 149 / 183 / 192 | 198 | 102 / 163 | fresh: near-perfect → elite only 9 (under ~10) |
| Hover | claude/e1-parked | 200 | 25 / 90 / 114 / 137 / 179 / 194 | 194 | 199 / 156 | – |
| Rainbow Bridge | claude/e1-parked | 200 | 42 / 42 / 71 / 102 / 157 / 171 | 195 | 142 / 0 | tuning: Average median not above Weak (42 → 42); fresh: Average median not above Weak (42 → 42) |
| Roofbound | claude/e7-parked | 200 | 32 / 75 / 121 / 151 / 192 / 200 | 200 | 31 / 153 | fresh: near-perfect → elite only 8 (under ~10) |
| Orbit | claude/e7-parked | 200 | 25 / 69 / 123 / 169 / 185 / 187 | 190 | 193 / 147 | fresh: near-perfect → elite only 2 (under ~10) |
| Grappler | claude/e7-parked | 200 | 43 / 77 / 113 / 142 / 161 / 166 | 165 | 200 / 154 | fresh: near-perfect → elite only 5 (under ~10) |
| Scrumper | claude/e8-parked | 200 | 53 / 67 / 91 / 108 / 143 / 147 | 200 | 86 / 152 | fresh: near-perfect → elite only 4 (under ~10) |
| Tilt | claude/e8-parked | 200 | 64 / 85 / 110 / 139 / 158 / 160 | 167 | 197 / 17 | fresh: near-perfect → elite only 2 (under ~10) |
| Wavefront | claude/e8-parked | 200 | 63 / 80 / 134 / 152 / 168 / 171 | 176 | 193 / 156 | fresh: near-perfect → elite only 3 (under ~10) |
| Rally | claude/practical-curie-12smnb | 200 | 39 / 71 / 106 / 147 / 180 / 187 | 191 | 110 / 115 | fresh: near-perfect → elite only 7 (under ~10) |
| Fission | claude/vigilant-fermi-08fdgo | 200 | 24 / 100 / 161 / 169 / 174 / 172 | 172 | 192 / 163 | tuning: Elite median not above Near-perfect (171 → 171); fresh: Elite median not above Near-perfect (174 → 172); fresh: good → near-perfect only 13 (under ~25); fresh: near-perfect → elite only -2 (under ~10) |
| Flightpath | claude/flightpath-e5-parked | 200 | 50 / 65 / 106 / 150 / 196 / 200 | 200 | 7 / 177 | fresh: near-perfect → elite only 4 (under ~10) |

## Per-game tables

One section per game and source; the parked branches' sections follow main's.

### Ball Tracker (`balltrack` rev 7, max 200; main)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 45 / 56 | 0 | 40 / 54 | 0 |
| Average | 71 / 92 | 0 | 72 / 90 | 0 |
| Good | 103 / 135 | 0 | 101 / 132 | 0 |
| Great | 135 / 174 | 0 | 139 / 176 | 0 |
| Near-perfect | 176 / 200 | 0 | 172 / 200 | 0 |
| Elite | 199 / 200 | 0 | 198 / 200 | 0 |
| Flawless (ceiling bot) | 199 / 200 | 0 | 200 / 200 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +26, Average → Good +40, Good → Great +32, Great → Near-perfect +27, Near-perfect → Elite +12; fresh: Weak → Average +33, Average → Good +30, Good → Great +38, Great → Near-perfect +31, Near-perfect → Elite +20.
- Ceiling, tuning seeds: median 199, lowest 147; 31 of 60 seeds below 200. Near-perfect scores a median 89 % of its seed's ceiling.
- Ceiling, fresh seeds: median 200, lowest 140; 96 of 200 seeds below 200. Near-perfect scores a median 89 % of its seed's ceiling.
- Gates: tuning near-perfect 176 / top 10 % 200 (misses 165–175, ≤ 185); tuning elite 199 / top 10 % 200 (meets median ≥ 175, top 10 % 190–200); tuning zeros (weak/average): none; fresh near-perfect 172 / top 10 % 200 (misses 165–175, ≤ 185); fresh elite 198 / top 10 % 200 (meets median ≥ 175, top 10 % 190–200); fresh zeros (weak/average): none.
- Any one rising payout meeting every score gate on both seed sets: none: a score of 200 would have to pay at least 190 and at most 185 (tuning near-perfect top 10 %, tuning elite top 10 %, fresh near-perfect top 10 %, fresh elite top 10 %).
- Flags: none (medians rise level by level; good → near-perfect ≥ 25, near-perfect → elite ≥ 10).

### Tempo (`beat` rev 9, max 200; main)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 27 / 35 | 0 | 27 / 35 | 0 |
| Average | 68 / 75 | 0 | 68 / 75 | 0 |
| Good | 101 / 114 | 0 | 101 / 110 | 0 |
| Great | 138 / 156 | 0 | 135 / 151 | 0 |
| Near-perfect | 172 / 190 | 0 | 171 / 180 | 0 |
| Elite | 180 / 200 | 0 | 179 / 200 | 0 |
| Flawless (ceiling bot) | 200 / 200 | 0 | 200 / 200 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +42, Average → Good +33, Good → Great +35, Great → Near-perfect +33, Near-perfect → Elite +11; fresh: Weak → Average +41, Average → Good +34, Good → Great +34, Great → Near-perfect +37, Near-perfect → Elite +9.
- Ceiling, tuning seeds: median 200, lowest 194; 1 of 60 seeds below 200. Near-perfect scores a median 86 % of its seed's ceiling.
- Ceiling, fresh seeds: median 200, lowest 192; 15 of 200 seeds below 200. Near-perfect scores a median 86 % of its seed's ceiling.
- Gates: tuning near-perfect 172 / top 10 % 190 (misses 165–175, ≤ 185); tuning elite 180 / top 10 % 200 (meets median ≥ 175, top 10 % 190–200); tuning zeros (weak/average): none; fresh near-perfect 171 / top 10 % 180 (meets 165–175, ≤ 185); fresh elite 179 / top 10 % 200 (meets median ≥ 175, top 10 % 190–200); fresh zeros (weak/average): none.
- Any one rising payout meeting every score gate on both seed sets: exists (it may need a steep stretch).
- Flags: fresh: near-perfect → elite only 8 (under ~10).

### Swish (`bintoss` rev 7, max 200; main)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 67 / 87 | 0 | 56 / 80 | 0 |
| Average | 80 / 105 | 0 | 80 / 129 | 0 |
| Good | 110 / 148 | 0 | 115 / 157 | 0 |
| Great | 157 / 179 | 0 | 166 / 184 | 0 |
| Near-perfect | 187 / 200 | 0 | 187 / 200 | 0 |
| Elite | 200 / 200 | 0 | 200 / 200 | 0 |
| Flawless (ceiling bot) | 200 / 200 | 0 | 200 / 200 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +19, Average → Good +25, Good → Great +37, Great → Near-perfect +31, Near-perfect → Elite +6; fresh: Weak → Average +24, Average → Good +35, Good → Great +40, Great → Near-perfect +27, Near-perfect → Elite +10.
- Ceiling, tuning seeds: median 200, lowest 200; 0 of 60 seeds below 200. Near-perfect scores a median 94 % of its seed's ceiling.
- Ceiling, fresh seeds: median 200, lowest 190; 3 of 200 seeds below 200. Near-perfect scores a median 94 % of its seed's ceiling.
- Gates: tuning near-perfect 187 / top 10 % 200 (misses 165–175, ≤ 185); tuning elite 200 / top 10 % 200 (meets median ≥ 175, top 10 % 190–200); tuning zeros (weak/average): none; fresh near-perfect 187 / top 10 % 200 (misses 165–175, ≤ 185); fresh elite 200 / top 10 % 200 (meets median ≥ 175, top 10 % 190–200); fresh zeros (weak/average): none.
- Any one rising payout meeting every score gate on both seed sets: none: a score of 200 would have to pay at least 190 and at most 185 (tuning near-perfect top 10 %, tuning elite median, tuning elite top 10 %, fresh near-perfect top 10 %, fresh elite median, fresh elite top 10 %).
- Flags: none (medians rise level by level; good → near-perfect ≥ 25, near-perfect → elite ≥ 10).

### Breaker (`breaker` rev 9, max 200; main)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 67 / 88 | 0 | 68 / 115 | 0 |
| Average | 75 / 157 | 0 | 81 / 148 | 0 |
| Good | 107 / 179 | 0 | 112 / 173 | 0 |
| Great | 139 / 184 | 0 | 144 / 180 | 0 |
| Near-perfect | 166 / 181 | 0 | 169 / 185 | 0 |
| Elite | 178 / 187 | 0 | 177 / 188 | 0 |
| Flawless (ceiling bot) | 179 / 189 | 0 | 180 / 189 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +12, Average → Good +25, Good → Great +3, Great → Near-perfect +4, Near-perfect → Elite +2; fresh: Weak → Average +17, Average → Good +24, Good → Great +24, Great → Near-perfect +13, Near-perfect → Elite +4.
- Ceiling, tuning seeds: median 183, lowest 134; 60 of 60 seeds below 200. Near-perfect scores a median 89 % of its seed's ceiling.
- Ceiling, fresh seeds: median 185, lowest 144; 200 of 200 seeds below 200. Near-perfect scores a median 92 % of its seed's ceiling.
- Gates: tuning near-perfect 166 / top 10 % 181 (meets 165–175, ≤ 185); tuning elite 178 / top 10 % 187 (misses median ≥ 175, top 10 % 190–200); tuning zeros (weak/average): none; fresh near-perfect 169 / top 10 % 185 (meets 165–175, ≤ 185); fresh elite 177 / top 10 % 188 (misses median ≥ 175, top 10 % 190–200); fresh zeros (weak/average): none.
- Any one rising payout meeting every score gate on both seed sets: exists (it may need a steep stretch).
- Flags: fresh: near-perfect → elite only 8 (under ~10).

### Coral Pop (`bubble` rev 8, max 200; main)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 41 / 78 | 3 | 37 / 75 | 8 |
| Average | 73 / 90 | 0 | 79 / 96 | 1 |
| Good | 97 / 127 | 0 | 104 / 124 | 0 |
| Great | 124 / 170 | 0 | 128 / 166 | 0 |
| Near-perfect | 167 / 187 | 0 | 168 / 187 | 0 |
| Elite | 183 / 190 | 0 | 183 / 190 | 0 |
| Flawless (ceiling bot) | 189 / 190 | 0 | 190 / 192 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +27, Average → Good +34, Good → Great +30, Great → Near-perfect +40, Near-perfect → Elite +8; fresh: Weak → Average +34, Average → Good +27, Good → Great +24, Great → Near-perfect +30, Near-perfect → Elite +13.
- Ceiling, tuning seeds: median 190, lowest 166; 60 of 60 seeds below 200. Near-perfect scores a median 90 % of its seed's ceiling.
- Ceiling, fresh seeds: median 190, lowest 152; 200 of 200 seeds below 200. Near-perfect scores a median 88 % of its seed's ceiling.
- Gates: tuning near-perfect 167 / top 10 % 187 (misses 165–175, ≤ 185); tuning elite 183 / top 10 % 190 (meets median ≥ 175, top 10 % 190–200); tuning zeros (weak/average): Weak 3; fresh near-perfect 168 / top 10 % 187 (misses 165–175, ≤ 185); fresh elite 183 / top 10 % 190 (meets median ≥ 175, top 10 % 190–200); fresh zeros (weak/average): Weak 8, Average 1.
- Any one rising payout meeting every score gate on both seed sets: exists (it may need a steep stretch).
- Flags: none (medians rise level by level; good → near-perfect ≥ 25, near-perfect → elite ≥ 10).

### Flightpath (`bullseye` rev 6, max 150; main)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 53 / 67 | 0 | 53 / 72 | 1 |
| Average | 73 / 107 | 1 | 66 / 110 | 0 |
| Good | 100 / 136 | 0 | 102 / 128 | 0 |
| Great | 134 / 145 | 0 | 132 / 145 | 0 |
| Near-perfect | 148 / 150 | 0 | 148 / 150 | 0 |
| Elite | 150 / 150 | 0 | 150 / 150 | 0 |
| Flawless (ceiling bot) | 150 / 150 | 0 | 150 / 150 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +22, Average → Good +26, Good → Great +30, Great → Near-perfect +14, Near-perfect → Elite +2; fresh: Weak → Average +14, Average → Good +29, Good → Great +25, Great → Near-perfect +14, Near-perfect → Elite +2.
- Ceiling, tuning seeds: median 150, lowest 150; 0 of 60 seeds below 150. Near-perfect scores a median 99 % of its seed's ceiling.
- Ceiling, fresh seeds: median 150, lowest 150; 0 of 200 seeds below 150. Near-perfect scores a median 99 % of its seed's ceiling.
- Flags: fresh: near-perfect → elite only 2 (under ~10).

### Fission (`burst` rev 6, max 150; main)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 26 / 66 | 6 | 18 / 51 | 34 |
| Average | 80 / 150 | 0 | 82 / 150 | 5 |
| Good | 150 / 150 | 2 | 150 / 150 | 1 |
| Great | 150 / 150 | 0 | 150 / 150 | 2 |
| Near-perfect | 150 / 150 | 0 | 150 / 150 | 0 |
| Elite | 150 / 150 | 0 | 150 / 150 | 0 |
| Flawless (ceiling bot) | 150 / 150 | 0 | 150 / 150 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +59, Average → Good +52, Good → Great +0, Great → Near-perfect +0, Near-perfect → Elite +0; fresh: Weak → Average +69, Average → Good +38, Good → Great +0, Great → Near-perfect +0, Near-perfect → Elite +0.
- Ceiling, tuning seeds: median 150, lowest 150; 0 of 60 seeds below 150. Near-perfect scores a median 100 % of its seed's ceiling.
- Ceiling, fresh seeds: median 150, lowest 150; 0 of 200 seeds below 150. Near-perfect scores a median 100 % of its seed's ceiling.
- Flags: tuning: Great median not above Good (150 → 150); tuning: Near-perfect median not above Great (150 → 150); tuning: Elite median not above Near-perfect (150 → 150); fresh: Great median not above Good (150 → 150); fresh: Near-perfect median not above Great (150 → 150); fresh: Elite median not above Near-perfect (150 → 150); fresh: good → near-perfect only 0 (under ~25); fresh: near-perfect → elite only 0 (under ~10).

### Jaywalk (`cross` rev 7, max 150; main)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 51 / 93 | 0 | 50 / 85 | 0 |
| Average | 74 / 105 | 0 | 82 / 119 | 0 |
| Good | 118 / 142 | 0 | 120 / 147 | 0 |
| Great | 142 / 150 | 0 | 144 / 150 | 0 |
| Near-perfect | 150 / 150 | 0 | 150 / 150 | 0 |
| Elite | 150 / 150 | 0 | 150 / 150 | 0 |
| Flawless (ceiling bot) | 150 / 150 | 0 | 150 / 150 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +20, Average → Good +31, Good → Great +10, Great → Near-perfect +6, Near-perfect → Elite +0; fresh: Weak → Average +24, Average → Good +33, Good → Great +6, Great → Near-perfect +4, Near-perfect → Elite +0.
- Ceiling, tuning seeds: median 150, lowest 142; 14 of 60 seeds below 150. Near-perfect scores a median 100 % of its seed's ceiling.
- Ceiling, fresh seeds: median 150, lowest 141; 45 of 200 seeds below 150. Near-perfect scores a median 100 % of its seed's ceiling.
- Flags: tuning: Elite median not above Near-perfect (150 → 150); fresh: Elite median not above Near-perfect (150 → 150); fresh: near-perfect → elite only 0 (under ~10).

### Roofbound (`flip` rev 6, max 150; main)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 36 / 62 | 0 | 40 / 68 | 0 |
| Average | 72 / 120 | 0 | 74 / 120 | 1 |
| Good | 120 / 150 | 0 | 120 / 150 | 0 |
| Great | 120 / 150 | 0 | 150 / 150 | 0 |
| Near-perfect | 150 / 150 | 0 | 150 / 150 | 0 |
| Elite | 150 / 150 | 0 | 150 / 150 | 0 |
| Flawless (ceiling bot) | 150 / 150 | 0 | 150 / 150 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +43, Average → Good +30, Good → Great +20, Great → Near-perfect +0, Near-perfect → Elite +0; fresh: Weak → Average +36, Average → Good +30, Good → Great +20, Great → Near-perfect +0, Near-perfect → Elite +0.
- Ceiling, tuning seeds: median 150, lowest 120; 2 of 60 seeds below 150. Near-perfect scores a median 100 % of its seed's ceiling.
- Ceiling, fresh seeds: median 150, lowest 120; 1 of 200 seeds below 150. Near-perfect scores a median 100 % of its seed's ceiling.
- Flags: tuning: Great median not above Good (120 → 120); tuning: Elite median not above Near-perfect (150 → 150); fresh: Near-perfect median not above Great (150 → 150); fresh: Elite median not above Near-perfect (150 → 150); fresh: near-perfect → elite only 0 (under ~10).

### Hover (`hover` rev 7, max 150; main)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 34 / 77 | 2 | 25 / 70 | 33 |
| Average | 76 / 114 | 3 | 76 / 112 | 11 |
| Good | 110 / 139 | 0 | 113 / 135 | 2 |
| Great | 132 / 149 | 0 | 120 / 149 | 2 |
| Near-perfect | 139 / 149 | 0 | 149 / 149 | 0 |
| Elite | 149 / 149 | 0 | 149 / 149 | 0 |
| Flawless (ceiling bot) | 149 / 149 | 0 | 149 / 149 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +35, Average → Good +14, Good → Great +26, Great → Near-perfect +10, Near-perfect → Elite +0; fresh: Weak → Average +42, Average → Good +28, Good → Great +21, Great → Near-perfect +10, Near-perfect → Elite +0.
- Ceiling, tuning seeds: median 149, lowest 117; 60 of 60 seeds below 150. Near-perfect scores a median 93 % of its seed's ceiling.
- Ceiling, fresh seeds: median 149, lowest 118; 195 of 200 seeds below 150. Near-perfect scores a median 100 % of its seed's ceiling.
- Flags: fresh: Elite median not above Near-perfect (149 → 149); fresh: near-perfect → elite only 0 (under ~10).

### Rainbow Bridge (`inkbridge` rev 8, max 150; main)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 33 / 65 | 13 | 33 / 65 | 66 |
| Average | 51 / 84 | 8 | 51 / 79 | 37 |
| Good | 75 / 116 | 5 | 79 / 116 | 10 |
| Great | 102 / 126 | 0 | 103 / 130 | 6 |
| Near-perfect | 124 / 146 | 0 | 121 / 146 | 0 |
| Elite | 144 / 148 | 0 | 144 / 148 | 1 |
| Flawless (ceiling bot) | 150 / 150 | 0 | 150 / 150 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +17, Average → Good +27, Good → Great +21, Great → Near-perfect +21, Near-perfect → Elite +2; fresh: Weak → Average +13, Average → Good +19, Good → Great +21, Great → Near-perfect +22, Near-perfect → Elite +3.
- Ceiling, tuning seeds: median 150, lowest 53; 14 of 60 seeds below 150. Near-perfect scores a median 86 % of its seed's ceiling.
- Ceiling, fresh seeds: median 150, lowest 53; 53 of 200 seeds below 150. Near-perfect scores a median 87 % of its seed's ceiling.
- Flags: none (medians rise level by level; good → near-perfect ≥ 25, near-perfect → elite ≥ 10).

### Gemstone (`matchup` rev 9, max 200; main)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 56 / 79 | 0 | 51 / 81 | 0 |
| Average | 66 / 95 | 0 | 68 / 101 | 0 |
| Good | 81 / 125 | 0 | 85 / 125 | 0 |
| Great | 100 / 148 | 0 | 109 / 160 | 0 |
| Near-perfect | 123 / 169 | 0 | 131 / 167 | 0 |
| Elite | 150 / 180 | 0 | 147 / 178 | 0 |
| Flawless (ceiling bot) | 170 / 187 | 0 | 168 / 182 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +12, Average → Good +19, Good → Great +14, Great → Near-perfect +24, Near-perfect → Elite +17; fresh: Weak → Average +18, Average → Good +15, Good → Great +21, Great → Near-perfect +18, Near-perfect → Elite +13.
- Ceiling, tuning seeds: median 176, lowest 122; 60 of 60 seeds below 200. Near-perfect scores a median 73 % of its seed's ceiling.
- Ceiling, fresh seeds: median 176, lowest 97; 200 of 200 seeds below 200. Near-perfect scores a median 76 % of its seed's ceiling.
- Gates: tuning near-perfect 123 / top 10 % 169 (misses 165–175, ≤ 185); tuning elite 150 / top 10 % 180 (misses median ≥ 175, top 10 % 190–200); tuning zeros (weak/average): none; fresh near-perfect 131 / top 10 % 167 (misses 165–175, ≤ 185); fresh elite 147 / top 10 % 178 (misses median ≥ 175, top 10 % 190–200); fresh zeros (weak/average): none.
- Any one rising payout meeting every score gate on both seed sets: exists (it may need a steep stretch).
- Flags: none (medians rise level by level; good → near-perfect ≥ 25, near-perfect → elite ≥ 10).

### Orbit (`orbit` rev 10, max 150; main)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 32 / 77 | 7 | 35 / 81 | 21 |
| Average | 77 / 106 | 5 | 73 / 108 | 16 |
| Good | 108 / 135 | 2 | 108 / 135 | 3 |
| Great | 128 / 146 | 0 | 139 / 146 | 0 |
| Near-perfect | 149 / 150 | 0 | 147 / 150 | 0 |
| Elite | 150 / 150 | 0 | 150 / 150 | 0 |
| Flawless (ceiling bot) | 150 / 150 | 0 | 150 / 150 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +32, Average → Good +31, Good → Great +14, Great → Near-perfect +20, Near-perfect → Elite +1; fresh: Weak → Average +28, Average → Good +29, Good → Great +28, Great → Near-perfect +10, Near-perfect → Elite +2.
- Ceiling, tuning seeds: median 150, lowest 148; 10 of 60 seeds below 150. Near-perfect scores a median 99 % of its seed's ceiling.
- Ceiling, fresh seeds: median 150, lowest 147; 26 of 200 seeds below 150. Near-perfect scores a median 98 % of its seed's ceiling.
- Flags: fresh: near-perfect → elite only 3 (under ~10).

### Pinball (`pinball` rev 4, max 200; main)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 60 / 110 | 0 | 55 / 88 | 0 |
| Average | 68 / 109 | 0 | 78 / 130 | 0 |
| Good | 99 / 158 | 0 | 98 / 170 | 0 |
| Great | 118 / 171 | 0 | 120 / 174 | 0 |
| Near-perfect | 170 / 179 | 0 | 171 / 182 | 0 |
| Elite | 175 / 186 | 0 | 172 / 184 | 0 |
| Flawless (ceiling bot) | 189 / 200 | 0 | 187 / 200 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +10, Average → Good +34, Good → Great +30, Great → Near-perfect +38, Near-perfect → Elite +2; fresh: Weak → Average +19, Average → Good +21, Good → Great +22, Great → Near-perfect +30, Near-perfect → Elite +2.
- Ceiling, tuning seeds: median 190, lowest 164; 39 of 60 seeds below 200. Near-perfect scores a median 89 % of its seed's ceiling.
- Ceiling, fresh seeds: median 188, lowest 166; 160 of 200 seeds below 200. Near-perfect scores a median 89 % of its seed's ceiling.
- Gates: tuning near-perfect 170 / top 10 % 179 (meets 165–175, ≤ 185); tuning elite 175 / top 10 % 186 (misses median ≥ 175, top 10 % 190–200); tuning zeros (weak/average): none; fresh near-perfect 171 / top 10 % 182 (meets 165–175, ≤ 185); fresh elite 172 / top 10 % 184 (misses median ≥ 175, top 10 % 190–200); fresh zeros (weak/average): none.
- Any one rising payout meeting every score gate on both seed sets: exists (it may need a steep stretch).
- Flags: fresh: near-perfect → elite only 1 (under ~10).

### Rally (`rally` rev 8, max 150; main)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 46 / 79 | 0 | 43 / 85 | 0 |
| Average | 80 / 142 | 0 | 70 / 142 | 0 |
| Good | 114 / 146 | 0 | 103 / 145 | 0 |
| Great | 142 / 147 | 0 | 142 / 147 | 0 |
| Near-perfect | 144 / 149 | 0 | 143 / 148 | 0 |
| Elite | 144 / 150 | 0 | 144 / 149 | 0 |
| Flawless (ceiling bot) | 146 / 150 | 0 | 145 / 149 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +37, Average → Good +24, Good → Great +1, Great → Near-perfect +3, Near-perfect → Elite +0; fresh: Weak → Average +34, Average → Good +18, Good → Great +7, Great → Near-perfect +2, Near-perfect → Elite +1.
- Ceiling, tuning seeds: median 147, lowest 118; 42 of 60 seeds below 150. Near-perfect scores a median 98 % of its seed's ceiling.
- Ceiling, fresh seeds: median 146, lowest 104; 162 of 200 seeds below 150. Near-perfect scores a median 97 % of its seed's ceiling.
- Flags: tuning: Elite median not above Near-perfect (144 → 144); fresh: near-perfect → elite only 1 (under ~10).

### High Rise (`skyline` rev 7, max 200; main)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 54 / 75 | 0 | 56 / 73 | 0 |
| Average | 72 / 95 | 0 | 70 / 94 | 0 |
| Good | 99 / 112 | 0 | 97 / 108 | 0 |
| Great | 116 / 134 | 0 | 115 / 133 | 0 |
| Near-perfect | 168 / 179 | 0 | 168 / 180 | 0 |
| Elite | 185 / 200 | 0 | 185 / 200 | 0 |
| Flawless (ceiling bot) | 200 / 200 | 0 | 200 / 200 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +16, Average → Good +27, Good → Great +18, Great → Near-perfect +47, Near-perfect → Elite +24; fresh: Weak → Average +14, Average → Good +24, Good → Great +23, Great → Near-perfect +46, Near-perfect → Elite +22.
- Ceiling, tuning seeds: median 200, lowest 194; 1 of 60 seeds below 200. Near-perfect scores a median 84 % of its seed's ceiling.
- Ceiling, fresh seeds: median 200, lowest 196; 1 of 200 seeds below 200. Near-perfect scores a median 84 % of its seed's ceiling.
- Gates: tuning near-perfect 168 / top 10 % 179 (meets 165–175, ≤ 185); tuning elite 185 / top 10 % 200 (meets median ≥ 175, top 10 % 190–200); tuning zeros (weak/average): none; fresh near-perfect 168 / top 10 % 180 (meets 165–175, ≤ 185); fresh elite 185 / top 10 % 200 (meets median ≥ 175, top 10 % 190–200); fresh zeros (weak/average): none.
- Any one rising payout meeting every score gate on both seed sets: exists (it may need a steep stretch).
- Flags: none (medians rise level by level; good → near-perfect ≥ 25, near-perfect → elite ≥ 10).

### Slice (`slice` rev 9, max 200; main)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 37 / 55 | 1 | 37 / 56 | 0 |
| Average | 71 / 89 | 0 | 70 / 88 | 0 |
| Good | 126 / 179 | 0 | 114 / 175 | 0 |
| Great | 175 / 189 | 0 | 175 / 191 | 0 |
| Near-perfect | 181 / 200 | 0 | 183 / 199 | 0 |
| Elite | 181 / 200 | 0 | 183 / 200 | 0 |
| Flawless (ceiling bot) | 184 / 197 | 0 | 182 / 200 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +38, Average → Good +58, Good → Great +35, Great → Near-perfect +6, Near-perfect → Elite +0; fresh: Weak → Average +29, Average → Good +56, Good → Great +40, Great → Near-perfect +9, Near-perfect → Elite +1.
- Ceiling, tuning seeds: median 191, lowest 162; 46 of 60 seeds below 200. Near-perfect scores a median 96 % of its seed's ceiling.
- Ceiling, fresh seeds: median 192, lowest 164; 145 of 200 seeds below 200. Near-perfect scores a median 96 % of its seed's ceiling.
- Gates: tuning near-perfect 181 / top 10 % 200 (misses 165–175, ≤ 185); tuning elite 181 / top 10 % 200 (meets median ≥ 175, top 10 % 190–200); tuning zeros (weak/average): Weak 1; fresh near-perfect 183 / top 10 % 199 (misses 165–175, ≤ 185); fresh elite 183 / top 10 % 200 (meets median ≥ 175, top 10 % 190–200); fresh zeros (weak/average): none.
- Any one rising payout meeting every score gate on both seed sets: none: a score of 200 would have to pay at least 190 and at most 185 (tuning near-perfect top 10 %, tuning elite top 10 %, fresh elite top 10 %).
- Flags: tuning: Elite median not above Near-perfect (181 → 181); fresh: Elite median not above Near-perfect (183 → 183); fresh: near-perfect → elite only 0 (under ~10).

### Meteor (`snake` rev 9, max 200; main)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 45 / 82 | 0 | 44 / 75 | 0 |
| Average | 82 / 104 | 0 | 80 / 104 | 1 |
| Good | 101 / 133 | 0 | 108 / 134 | 0 |
| Great | 144 / 170 | 0 | 142 / 170 | 0 |
| Near-perfect | 167 / 186 | 0 | 163 / 184 | 0 |
| Elite | 179 / 188 | 0 | 178 / 188 | 0 |
| Flawless (ceiling bot) | 182 / 195 | 0 | 185 / 195 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +27, Average → Good +26, Good → Great +41, Great → Near-perfect +20, Near-perfect → Elite +9; fresh: Weak → Average +31, Average → Good +28, Good → Great +35, Great → Near-perfect +19, Near-perfect → Elite +14.
- Ceiling, tuning seeds: median 185, lowest 142; 60 of 60 seeds below 200. Near-perfect scores a median 92 % of its seed's ceiling.
- Ceiling, fresh seeds: median 186, lowest 155; 194 of 200 seeds below 200. Near-perfect scores a median 89 % of its seed's ceiling.
- Gates: tuning near-perfect 167 / top 10 % 186 (misses 165–175, ≤ 185); tuning elite 179 / top 10 % 188 (misses median ≥ 175, top 10 % 190–200); tuning zeros (weak/average): none; fresh near-perfect 163 / top 10 % 184 (misses 165–175, ≤ 185); fresh elite 178 / top 10 % 188 (misses median ≥ 175, top 10 % 190–200); fresh zeros (weak/average): Average 1.
- Any one rising payout meeting every score gate on both seed sets: exists (it may need a steep stretch).
- Flags: none (medians rise level by level; good → near-perfect ≥ 25, near-perfect → elite ≥ 10).

### Scrumper (`snip` rev 9, max 150; main)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 51 / 80 | 0 | 46 / 64 | 0 |
| Average | 74 / 97 | 0 | 67 / 95 | 0 |
| Good | 97 / 121 | 0 | 95 / 121 | 0 |
| Great | 120 / 128 | 0 | 115 / 130 | 0 |
| Near-perfect | 124 / 144 | 0 | 124 / 142 | 0 |
| Elite | 130 / 145 | 0 | 130 / 145 | 0 |
| Flawless (ceiling bot) | 147 / 149 | 0 | 147 / 149 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +21, Average → Good +27, Good → Great +17, Great → Near-perfect +6, Near-perfect → Elite +6; fresh: Weak → Average +23, Average → Good +31, Good → Great +18, Great → Near-perfect +10, Near-perfect → Elite +7.
- Ceiling, tuning seeds: median 147, lowest 131; 57 of 60 seeds below 150. Near-perfect scores a median 85 % of its seed's ceiling.
- Ceiling, fresh seeds: median 147, lowest 130; 186 of 200 seeds below 150. Near-perfect scores a median 85 % of its seed's ceiling.
- Flags: fresh: near-perfect → elite only 6 (under ~10).

### Grappler (`swing` rev 11, max 150; main)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 44 / 87 | 0 | 37 / 91 | 0 |
| Average | 84 / 118 | 0 | 89 / 118 | 0 |
| Good | 112 / 134 | 0 | 112 / 134 | 0 |
| Great | 135 / 148 | 0 | 134 / 148 | 0 |
| Near-perfect | 147 / 148 | 0 | 147 / 149 | 0 |
| Elite | 147 / 148 | 0 | 148 / 149 | 0 |
| Flawless (ceiling bot) | 147 / 148 | 0 | 147 / 148 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +29, Average → Good +30, Good → Great +17, Great → Near-perfect +7, Near-perfect → Elite +0; fresh: Weak → Average +33, Average → Good +22, Good → Great +19, Great → Near-perfect +2, Near-perfect → Elite +0.
- Ceiling, tuning seeds: median 148, lowest 146; 60 of 60 seeds below 150. Near-perfect scores a median 100 % of its seed's ceiling.
- Ceiling, fresh seeds: median 148, lowest 146; 198 of 200 seeds below 150. Near-perfect scores a median 100 % of its seed's ceiling.
- Flags: tuning: Elite median not above Near-perfect (147 → 147); fresh: near-perfect → elite only 1 (under ~10).

### Tilt (`tilt` rev 6, max 150; main)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 57 / 91 | 0 | 44 / 78 | 0 |
| Average | 77 / 129 | 0 | 86 / 128 | 0 |
| Good | 128 / 136 | 0 | 111 / 136 | 0 |
| Great | 133 / 141 | 0 | 129 / 141 | 0 |
| Near-perfect | 141 / 147 | 0 | 138 / 145 | 0 |
| Elite | 143 / 148 | 0 | 140 / 147 | 0 |
| Flawless (ceiling bot) | 143 / 148 | 0 | 143 / 148 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +34, Average → Good +15, Good → Great +8, Great → Near-perfect +7, Near-perfect → Elite +2; fresh: Weak → Average +36, Average → Good +9, Good → Great +5, Great → Near-perfect +4, Near-perfect → Elite +2.
- Ceiling, tuning seeds: median 145, lowest 75; 60 of 60 seeds below 150. Near-perfect scores a median 98 % of its seed's ceiling.
- Ceiling, fresh seeds: median 145, lowest 55; 200 of 200 seeds below 150. Near-perfect scores a median 96 % of its seed's ceiling.
- Flags: fresh: near-perfect → elite only 2 (under ~10).

### Wavefront (`wavefront` rev 8, max 150; main)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 59 / 67 | 0 | 59 / 67 | 0 |
| Average | 67 / 128 | 0 | 70 / 125 | 0 |
| Good | 120 / 150 | 0 | 133 / 150 | 0 |
| Great | 150 / 150 | 0 | 150 / 150 | 0 |
| Near-perfect | 150 / 150 | 0 | 150 / 150 | 0 |
| Elite | 150 / 150 | 0 | 150 / 150 | 0 |
| Flawless (ceiling bot) | 150 / 150 | 0 | 150 / 150 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +8, Average → Good +27, Good → Great +22, Great → Near-perfect +0, Near-perfect → Elite +0; fresh: Weak → Average +10, Average → Good +41, Good → Great +10, Great → Near-perfect +0, Near-perfect → Elite +0.
- Ceiling, tuning seeds: median 150, lowest 150; 0 of 60 seeds below 150. Near-perfect scores a median 100 % of its seed's ceiling.
- Ceiling, fresh seeds: median 150, lowest 150; 0 of 200 seeds below 150. Near-perfect scores a median 100 % of its seed's ceiling.
- Flags: tuning: Near-perfect median not above Great (150 → 150); tuning: Elite median not above Near-perfect (150 → 150); fresh: Near-perfect median not above Great (150 → 150); fresh: Elite median not above Near-perfect (150 → 150); fresh: good → near-perfect only 17 (under ~25); fresh: near-perfect → elite only 0 (under ~10).

### Jaywalk (`cross` rev 8, max 200; claude/e1-parked)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 57 / 79 | 0 | 55 / 76 | 0 |
| Average | 82 / 114 | 0 | 75 / 119 | 0 |
| Good | 122 / 162 | 0 | 116 / 158 | 0 |
| Great | 151 / 178 | 0 | 149 / 174 | 0 |
| Near-perfect | 183 / 198 | 0 | 183 / 195 | 0 |
| Elite | 192 / 200 | 0 | 192 / 200 | 0 |
| Flawless (ceiling bot) | 198 / 200 | 0 | 198 / 200 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +27, Average → Good +36, Good → Great +24, Great → Near-perfect +25, Near-perfect → Elite +6; fresh: Weak → Average +23, Average → Good +34, Good → Great +22, Great → Near-perfect +28, Near-perfect → Elite +6.
- Ceiling, tuning seeds: median 200, lowest 180; 27 of 60 seeds below 200. Near-perfect scores a median 93 % of its seed's ceiling.
- Ceiling, fresh seeds: median 198, lowest 163; 102 of 200 seeds below 200. Near-perfect scores a median 93 % of its seed's ceiling.
- Gates: tuning good 122 vs 118 before (within ±10 %); tuning near-perfect 183 / top 10 % 198 (misses 165–175, ≤ 185); tuning elite 192 / top 10 % 200 (meets median ≥ 175, top 10 % 190–200); tuning zeros (weak/average): none; fresh good 116 vs 120 before (within ±10 %); fresh near-perfect 183 / top 10 % 195 (misses 165–175, ≤ 185); fresh elite 192 / top 10 % 200 (meets median ≥ 175, top 10 % 190–200); fresh zeros (weak/average): none.
- Any one rising payout meeting every score gate on both seed sets: exists (it may need a steep stretch).
- Flags: fresh: near-perfect → elite only 9 (under ~10).

### Hover (`hover` rev 8, max 200; claude/e1-parked)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 34 / 77 | 2 | 25 / 83 | 33 |
| Average | 77 / 119 | 3 | 90 / 120 | 11 |
| Good | 106 / 132 | 0 | 114 / 139 | 2 |
| Great | 141 / 169 | 0 | 137 / 169 | 2 |
| Near-perfect | 174 / 194 | 0 | 179 / 194 | 0 |
| Elite | 189 / 199 | 0 | 194 / 199 | 0 |
| Flawless (ceiling bot) | 199 / 199 | 0 | 194 / 199 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +33, Average → Good +9, Good → Great +34, Great → Near-perfect +25, Near-perfect → Elite +10; fresh: Weak → Average +44, Average → Good +16, Good → Great +23, Great → Near-perfect +35, Near-perfect → Elite +10.
- Ceiling, tuning seeds: median 199, lowest 174; 60 of 60 seeds below 200. Near-perfect scores a median 90 % of its seed's ceiling.
- Ceiling, fresh seeds: median 199, lowest 156; 199 of 200 seeds below 200. Near-perfect scores a median 92 % of its seed's ceiling.
- Gates: tuning good 106 vs 110 before (within ±10 %); tuning near-perfect 174 / top 10 % 194 (misses 165–175, ≤ 185); tuning elite 189 / top 10 % 199 (meets median ≥ 175, top 10 % 190–200); tuning zeros (weak/average): Weak 2, Average 3; fresh good 114 vs 113 before (within ±10 %); fresh near-perfect 179 / top 10 % 194 (misses 165–175, ≤ 185); fresh elite 194 / top 10 % 199 (meets median ≥ 175, top 10 % 190–200); fresh zeros (weak/average): Weak 33, Average 11.
- Any one rising payout meeting every score gate on both seed sets: exists (it may need a steep stretch).
- Flags: none (medians rise level by level; good → near-perfect ≥ 25, near-perfect → elite ≥ 10).

### Rainbow Bridge (`inkbridge` rev 9, max 200; claude/e1-parked)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 42 / 71 | 25 | 42 / 57 | 95 |
| Average | 42 / 90 | 19 | 42 / 85 | 54 |
| Good | 71 / 113 | 7 | 71 / 115 | 24 |
| Great | 112 / 148 | 2 | 102 / 148 | 11 |
| Near-perfect | 163 / 182 | 0 | 157 / 181 | 4 |
| Elite | 172 / 194 | 0 | 171 / 191 | 3 |
| Flawless (ceiling bot) | 195 / 200 | 0 | 195 / 200 | 1 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +0, Average → Good +29, Good → Great +34, Great → Near-perfect +43, Near-perfect → Elite +9; fresh: Weak → Average +0, Average → Good +23, Good → Great +30, Great → Near-perfect +47, Near-perfect → Elite +9.
- Ceiling, tuning seeds: median 195, lowest 87; 41 of 60 seeds below 200. Near-perfect scores a median 84 % of its seed's ceiling.
- Ceiling, fresh seeds: median 195, lowest 0; 142 of 200 seeds below 200. Near-perfect scores a median 82 % of its seed's ceiling.
- Gates: tuning good 71 vs 75 before (within ±10 %); tuning near-perfect 163 / top 10 % 182 (misses 165–175, ≤ 185); tuning elite 172 / top 10 % 194 (misses median ≥ 175, top 10 % 190–200); tuning zeros (weak/average): Weak 25, Average 19; fresh good 71 vs 79 before (outside ±10 %); fresh near-perfect 157 / top 10 % 181 (misses 165–175, ≤ 185); fresh elite 171 / top 10 % 191 (misses median ≥ 175, top 10 % 190–200); fresh zeros (weak/average): Weak 95, Average 54.
- Any one rising payout meeting every score gate on both seed sets: exists (it may need a steep stretch).
- Flags: tuning: Average median not above Weak (42 → 42); fresh: Average median not above Weak (42 → 42).

### Roofbound (`flip` rev 7, max 200; claude/e7-parked)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 41 / 58 | 0 | 32 / 54 | 1 |
| Average | 76 / 117 | 0 | 75 / 115 | 0 |
| Good | 122 / 179 | 0 | 121 / 176 | 0 |
| Great | 148 / 191 | 0 | 151 / 195 | 0 |
| Near-perfect | 195 / 200 | 0 | 192 / 200 | 0 |
| Elite | 200 / 200 | 0 | 200 / 200 | 0 |
| Flawless (ceiling bot) | 200 / 200 | 0 | 200 / 200 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +35, Average → Good +49, Good → Great +32, Great → Near-perfect +19, Near-perfect → Elite +3; fresh: Weak → Average +44, Average → Good +48, Good → Great +27, Great → Near-perfect +17, Near-perfect → Elite +3.
- Ceiling, tuning seeds: median 200, lowest 151; 10 of 60 seeds below 200. Near-perfect scores a median 98 % of its seed's ceiling.
- Ceiling, fresh seeds: median 200, lowest 153; 31 of 200 seeds below 200. Near-perfect scores a median 98 % of its seed's ceiling.
- Gates: tuning good 122 vs 120 before (within ±10 %); tuning near-perfect 195 / top 10 % 200 (misses 165–175, ≤ 185); tuning elite 200 / top 10 % 200 (meets median ≥ 175, top 10 % 190–200); tuning zeros (weak/average): none; fresh good 121 vs 120 before (within ±10 %); fresh near-perfect 192 / top 10 % 200 (misses 165–175, ≤ 185); fresh elite 200 / top 10 % 200 (meets median ≥ 175, top 10 % 190–200); fresh zeros (weak/average): Weak 1.
- Any one rising payout meeting every score gate on both seed sets: none: a score of 200 would have to pay at least 190 and at most 185 (tuning near-perfect top 10 %, tuning elite median, tuning elite top 10 %, fresh near-perfect top 10 %, fresh elite median, fresh elite top 10 %).
- Flags: fresh: near-perfect → elite only 8 (under ~10).

### Orbit (`orbit` rev 11, max 200; claude/e7-parked)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 26 / 81 | 4 | 25 / 84 | 33 |
| Average | 77 / 121 | 2 | 69 / 116 | 18 |
| Good | 119 / 155 | 0 | 123 / 154 | 4 |
| Great | 160 / 183 | 1 | 169 / 185 | 1 |
| Near-perfect | 185 / 193 | 0 | 185 / 193 | 0 |
| Elite | 187 / 193 | 0 | 187 / 196 | 0 |
| Flawless (ceiling bot) | 189 / 196 | 0 | 190 / 197 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +30, Average → Good +36, Good → Great +41, Great → Near-perfect +23, Near-perfect → Elite +2; fresh: Weak → Average +17, Average → Good +51, Good → Great +41, Great → Near-perfect +12, Near-perfect → Elite +2.
- Ceiling, tuning seeds: median 191, lowest 148; 60 of 60 seeds below 200. Near-perfect scores a median 98 % of its seed's ceiling.
- Ceiling, fresh seeds: median 192, lowest 147; 193 of 200 seeds below 200. Near-perfect scores a median 98 % of its seed's ceiling.
- Gates: tuning good 119 vs 108 before (outside ±10 %); tuning near-perfect 185 / top 10 % 193 (misses 165–175, ≤ 185); tuning elite 187 / top 10 % 193 (meets median ≥ 175, top 10 % 190–200); tuning zeros (weak/average): Weak 4, Average 2; fresh good 123 vs 108 before (outside ±10 %); fresh near-perfect 185 / top 10 % 193 (misses 165–175, ≤ 185); fresh elite 187 / top 10 % 196 (meets median ≥ 175, top 10 % 190–200); fresh zeros (weak/average): Weak 33, Average 18.
- Any one rising payout meeting every score gate on both seed sets: none: a score of 193 would have to pay at least 190 and at most 185 (tuning near-perfect top 10 %, tuning elite top 10 %, fresh near-perfect top 10 %).
- Flags: fresh: near-perfect → elite only 2 (under ~10).

### Grappler (`swing` rev 12, max 200; claude/e7-parked)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 43 / 88 | 0 | 43 / 88 | 0 |
| Average | 66 / 111 | 0 | 77 / 111 | 0 |
| Good | 99 / 144 | 0 | 113 / 143 | 0 |
| Great | 147 / 160 | 0 | 142 / 159 | 0 |
| Near-perfect | 161 / 170 | 0 | 161 / 169 | 0 |
| Elite | 164 / 172 | 0 | 166 / 173 | 0 |
| Flawless (ceiling bot) | 167 / 172 | 0 | 165 / 171 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +18, Average → Good +39, Good → Great +39, Great → Near-perfect +13, Near-perfect → Elite +2; fresh: Weak → Average +23, Average → Good +39, Good → Great +29, Great → Near-perfect +18, Near-perfect → Elite +3.
- Ceiling, tuning seeds: median 170, lowest 154; 60 of 60 seeds below 200. Near-perfect scores a median 96 % of its seed's ceiling.
- Ceiling, fresh seeds: median 169, lowest 154; 200 of 200 seeds below 200. Near-perfect scores a median 97 % of its seed's ceiling.
- Gates: tuning good 99 vs 112 before (outside ±10 %); tuning near-perfect 161 / top 10 % 170 (misses 165–175, ≤ 185); tuning elite 164 / top 10 % 172 (misses median ≥ 175, top 10 % 190–200); tuning zeros (weak/average): none; fresh good 113 vs 112 before (within ±10 %); fresh near-perfect 161 / top 10 % 169 (misses 165–175, ≤ 185); fresh elite 166 / top 10 % 173 (misses median ≥ 175, top 10 % 190–200); fresh zeros (weak/average): none.
- Any one rising payout meeting every score gate on both seed sets: exists (it may need a steep stretch).
- Flags: fresh: near-perfect → elite only 5 (under ~10).

### Scrumper (`snip` rev 10, max 200; claude/e8-parked)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 57 / 112 | 0 | 53 / 105 | 0 |
| Average | 64 / 140 | 0 | 67 / 133 | 0 |
| Good | 96 / 141 | 0 | 91 / 142 | 0 |
| Great | 117 / 147 | 0 | 108 / 155 | 0 |
| Near-perfect | 133 / 177 | 0 | 143 / 177 | 0 |
| Elite | 147 / 176 | 0 | 147 / 173 | 0 |
| Flawless (ceiling bot) | 200 / 200 | 0 | 200 / 200 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +12, Average → Good +24, Good → Great +14, Great → Near-perfect +22, Near-perfect → Elite +7; fresh: Weak → Average +16, Average → Good +13, Good → Great +13, Great → Near-perfect +33, Near-perfect → Elite +7.
- Ceiling, tuning seeds: median 200, lowest 149; 27 of 60 seeds below 200. Near-perfect scores a median 72 % of its seed's ceiling.
- Ceiling, fresh seeds: median 200, lowest 152; 86 of 200 seeds below 200. Near-perfect scores a median 76 % of its seed's ceiling.
- Gates: tuning good 96 vs 97 before (within ±10 %); tuning near-perfect 133 / top 10 % 177 (misses 165–175, ≤ 185); tuning elite 147 / top 10 % 176 (misses median ≥ 175, top 10 % 190–200); tuning zeros (weak/average): none; fresh good 91 vs 95 before (within ±10 %); fresh near-perfect 143 / top 10 % 177 (misses 165–175, ≤ 185); fresh elite 147 / top 10 % 173 (misses median ≥ 175, top 10 % 190–200); fresh zeros (weak/average): none.
- Any one rising payout meeting every score gate on both seed sets: none: a score of 177 would have to pay at least 190 and at most 185 (tuning near-perfect top 10 %, fresh near-perfect top 10 %).
- Flags: fresh: near-perfect → elite only 4 (under ~10).

### Tilt (`tilt` rev 7, max 200; claude/e8-parked)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 58 / 78 | 0 | 64 / 86 | 0 |
| Average | 80 / 121 | 0 | 85 / 131 | 0 |
| Good | 105 / 149 | 0 | 110 / 150 | 0 |
| Great | 124 / 171 | 0 | 139 / 168 | 0 |
| Near-perfect | 144 / 180 | 0 | 158 / 183 | 0 |
| Elite | 157 / 185 | 0 | 160 / 186 | 0 |
| Flawless (ceiling bot) | 163 / 190 | 0 | 167 / 190 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +19, Average → Good +14, Good → Great +14, Great → Near-perfect +10, Near-perfect → Elite +2; fresh: Weak → Average +21, Average → Good +19, Good → Great +20, Great → Near-perfect +11, Near-perfect → Elite +1.
- Ceiling, tuning seeds: median 166, lowest 56; 58 of 60 seeds below 200. Near-perfect scores a median 93 % of its seed's ceiling.
- Ceiling, fresh seeds: median 173, lowest 17; 197 of 200 seeds below 200. Near-perfect scores a median 94 % of its seed's ceiling.
- Gates: tuning good 105 vs 128 before (outside ±10 %); tuning near-perfect 144 / top 10 % 180 (misses 165–175, ≤ 185); tuning elite 157 / top 10 % 185 (misses median ≥ 175, top 10 % 190–200); tuning zeros (weak/average): none; fresh good 110 vs 111 before (within ±10 %); fresh near-perfect 158 / top 10 % 183 (misses 165–175, ≤ 185); fresh elite 160 / top 10 % 186 (misses median ≥ 175, top 10 % 190–200); fresh zeros (weak/average): none.
- Any one rising payout meeting every score gate on both seed sets: exists (it may need a steep stretch).
- Flags: fresh: near-perfect → elite only 2 (under ~10).

### Wavefront (`wavefront` rev 9, max 200; claude/e8-parked)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 63 / 81 | 0 | 63 / 79 | 0 |
| Average | 90 / 145 | 0 | 80 / 135 | 0 |
| Good | 132 / 166 | 0 | 134 / 169 | 0 |
| Great | 150 / 174 | 0 | 152 / 177 | 0 |
| Near-perfect | 167 / 181 | 0 | 168 / 183 | 0 |
| Elite | 172 / 188 | 0 | 171 / 186 | 0 |
| Flawless (ceiling bot) | 178 / 191 | 0 | 176 / 193 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +24, Average → Good +37, Good → Great +15, Great → Near-perfect +13, Near-perfect → Elite +9; fresh: Weak → Average +14, Average → Good +39, Good → Great +21, Great → Near-perfect +15, Near-perfect → Elite +4.
- Ceiling, tuning seeds: median 185, lowest 167; 60 of 60 seeds below 200. Near-perfect scores a median 91 % of its seed's ceiling.
- Ceiling, fresh seeds: median 183, lowest 156; 193 of 200 seeds below 200. Near-perfect scores a median 91 % of its seed's ceiling.
- Gates: tuning good 132 vs 120 before (within ±10 %); tuning near-perfect 167 / top 10 % 181 (meets 165–175, ≤ 185); tuning elite 172 / top 10 % 188 (misses median ≥ 175, top 10 % 190–200); tuning zeros (weak/average): none; fresh good 134 vs 133 before (within ±10 %); fresh near-perfect 168 / top 10 % 183 (meets 165–175, ≤ 185); fresh elite 171 / top 10 % 186 (misses median ≥ 175, top 10 % 190–200); fresh zeros (weak/average): none.
- Any one rising payout meeting every score gate on both seed sets: exists (it may need a steep stretch).
- Flags: fresh: near-perfect → elite only 3 (under ~10).

### Rally (`rally` rev 9, max 200; claude/practical-curie-12smnb)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 47 / 76 | 0 | 39 / 75 | 0 |
| Average | 77 / 104 | 0 | 71 / 134 | 0 |
| Good | 127 / 174 | 0 | 106 / 170 | 0 |
| Great | 163 / 193 | 0 | 147 / 189 | 0 |
| Near-perfect | 186 / 198 | 0 | 180 / 200 | 0 |
| Elite | 189 / 200 | 0 | 187 / 200 | 0 |
| Flawless (ceiling bot) | 188 / 200 | 0 | 191 / 200 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +26, Average → Good +56, Good → Great +23, Great → Near-perfect +17, Near-perfect → Elite +4; fresh: Weak → Average +33, Average → Good +27, Good → Great +29, Great → Near-perfect +19, Near-perfect → Elite +6.
- Ceiling, tuning seeds: median 196, lowest 106; 33 of 60 seeds below 200. Near-perfect scores a median 95 % of its seed's ceiling.
- Ceiling, fresh seeds: median 198, lowest 115; 110 of 200 seeds below 200. Near-perfect scores a median 93 % of its seed's ceiling.
- Gates: tuning good 127 vs 114 before (outside ±10 %); tuning near-perfect 186 / top 10 % 198 (misses 165–175, ≤ 185); tuning elite 189 / top 10 % 200 (meets median ≥ 175, top 10 % 190–200); tuning zeros (weak/average): none; fresh good 106 vs 103 before (within ±10 %); fresh near-perfect 180 / top 10 % 200 (misses 165–175, ≤ 185); fresh elite 187 / top 10 % 200 (meets median ≥ 175, top 10 % 190–200); fresh zeros (weak/average): none.
- Any one rising payout meeting every score gate on both seed sets: none: a score of 200 would have to pay at least 190 and at most 185 (tuning elite top 10 %, fresh near-perfect top 10 %, fresh elite top 10 %).
- Flags: fresh: near-perfect → elite only 7 (under ~10).

### Fission (`burst` rev 7, max 200; claude/vigilant-fermi-08fdgo)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 30 / 86 | 1 | 24 / 75 | 7 |
| Average | 99 / 159 | 0 | 100 / 169 | 1 |
| Good | 159 / 184 | 0 | 161 / 181 | 0 |
| Great | 167 / 186 | 0 | 169 / 185 | 1 |
| Near-perfect | 171 / 188 | 0 | 174 / 190 | 0 |
| Elite | 171 / 182 | 0 | 172 / 190 | 0 |
| Flawless (ceiling bot) | 170 / 191 | 0 | 172 / 191 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +54, Average → Good +42, Good → Great +7, Great → Near-perfect +2, Near-perfect → Elite -1; fresh: Weak → Average +74, Average → Good +52, Good → Great +11, Great → Near-perfect +6, Near-perfect → Elite -1.
- Ceiling, tuning seeds: median 182, lowest 161; 58 of 60 seeds below 200. Near-perfect scores a median 94 % of its seed's ceiling.
- Ceiling, fresh seeds: median 185, lowest 163; 192 of 200 seeds below 200. Near-perfect scores a median 95 % of its seed's ceiling.
- Gates: tuning good 159 vs 150 before (within ±10 %); tuning near-perfect 171 / top 10 % 188 (misses 165–175, ≤ 185); tuning elite 171 / top 10 % 182 (misses median ≥ 175, top 10 % 190–200); tuning zeros (weak/average): Weak 1; fresh good 161 vs 150 before (within ±10 %); fresh near-perfect 174 / top 10 % 190 (misses 165–175, ≤ 185); fresh elite 172 / top 10 % 190 (misses median ≥ 175, top 10 % 190–200); fresh zeros (weak/average): Weak 7, Average 1.
- Any one rising payout meeting every score gate on both seed sets: none: a score of 188 would have to pay at least 190 and at most 185 (tuning near-perfect top 10 %).
- Flags: tuning: Elite median not above Near-perfect (171 → 171); fresh: Elite median not above Near-perfect (174 → 172); fresh: good → near-perfect only 13 (under ~25); fresh: near-perfect → elite only -2 (under ~10).

### Flightpath (`bullseye` rev 7, max 200; claude/flightpath-e5-parked)

| Level | Tuning (60 seeds): median / top 10 % | zeros | Fresh (200 seeds): median / top 10 % | zeros |
|---|---|---|---|---|
| Weak | 50 / 65 | 0 | 50 / 67 | 0 |
| Average | 67 / 100 | 1 | 65 / 100 | 2 |
| Good | 102 / 139 | 0 | 106 / 136 | 0 |
| Great | 155 / 193 | 0 | 150 / 194 | 0 |
| Near-perfect | 197 / 200 | 0 | 196 / 200 | 0 |
| Elite | 199 / 200 | 0 | 200 / 200 | 0 |
| Flawless (ceiling bot) | 200 / 200 | 0 | 200 / 200 | 0 |

- Paired steps (median of per-seed differences), tuning: Weak → Average +20, Average → Good +28, Good → Great +50, Great → Near-perfect +39, Near-perfect → Elite +2; fresh: Weak → Average +14, Average → Good +38, Good → Great +50, Great → Near-perfect +36, Near-perfect → Elite +2.
- Ceiling, tuning seeds: median 200, lowest 180; 1 of 60 seeds below 200. Near-perfect scores a median 99 % of its seed's ceiling.
- Ceiling, fresh seeds: median 200, lowest 177; 7 of 200 seeds below 200. Near-perfect scores a median 98 % of its seed's ceiling.
- Gates: tuning good 102 vs 100 before (within ±10 %); tuning near-perfect 197 / top 10 % 200 (misses 165–175, ≤ 185); tuning elite 199 / top 10 % 200 (meets median ≥ 175, top 10 % 190–200); tuning zeros (weak/average): Average 1; fresh good 106 vs 102 before (within ±10 %); fresh near-perfect 196 / top 10 % 200 (misses 165–175, ≤ 185); fresh elite 200 / top 10 % 200 (meets median ≥ 175, top 10 % 190–200); fresh zeros (weak/average): Average 2.
- Any one rising payout meeting every score gate on both seed sets: none: a score of 200 would have to pay at least 190 and at most 185 (tuning near-perfect top 10 %, tuning elite top 10 %, fresh near-perfect top 10 %, fresh elite median, fresh elite top 10 %).
- Flags: fresh: near-perfect → elite only 4 (under ~10).
