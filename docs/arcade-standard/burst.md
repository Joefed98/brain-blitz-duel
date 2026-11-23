# Fission under the arcade scoring standard (`burstRev 10`)

## Levels (D5, 23 Nov 2026)

Folded into the unshipped **burstRev 14** (no round was ever dealt on it; no new stamp number), with Normal's scoring
refit (Joe's rule of 23 Nov 2026 and his approval of the refit). The spec's lever (`docs/polish-plan-final/difficulty-spec.md`
"### Fission"): **the atoms in each wave**. burstRev 13 keeps its own table (`BURST_LEVELS`) and Normal's waves; every older
round replays and scores exactly as before (`scripts/fixtures/d5-levels-legacy.json.gz`, `burst-small-legacy.json.gz`).

**Normal's scoring** (`BURST_V14_CLEAR_FULL`, `BURST_V14_GOLD_FULL`, `burstSmallLines` in `src/lib/arcade/burst.ts`): each
wave still earns up to 7 wave-clear points by its clear time, and the wave-clears part (35) is full at **19** of the 35
(about 55 %); the golden-atoms part (25) is full at **2 of the 5** (12 for one). The core (140 at all 87 atoms), the lives
and the wasted beams are burstRev 13's. Play is unchanged: the Normal-play legacy fixture
(`scripts/fixtures/burst-ladder-legacy.json.gz`, 100 runs recorded before the refit) replays to the same final state; only
scores move, never down.

**The levels** (`BURST_LEVELS_SMALL` in `src/lib/arcade/retroLevels.ts`, read from the run's state `lv`; the registry mirrors
it; a level's run starts on its own waves, `burstLevelWaves`, the k-th spawn of wave w from side (s + w + k) mod 2, s the
side the seed gives Normal's first atom, k × 30 px higher, with its golden atoms and carriers scheduled from the seed as
Normal's are):

| | Easy | Normal | Hard | Expert |
|---|---|---|---|---|
| Waves (L, M, S) | S; M; M; M S; L | M; L; M M; L S S; L L | M M; L; L M; L M; L L | M M M; L M; L M; L L; L L |
| Atoms (every split piece) | 42 | 87 | 103 | 125 |
| Lives | 4 | 3 | 3 | 2 |
| Atom size | 125 % | 100 % | 100 % | 100 % |
| Quick-clear time | 150 % | 100 % | 100 % | 100 % |
| Free wasted beams (or one an atom popped) | 60 | 20 | 20 | 20 |
| Core full at (atoms) | 42 | 87 | 98 | 105 |
| Wave clears full at / golden atoms full at | 19 / 2 | 19 / 2 | 19 / 2 | 17 / 2 |
| First seconds | one small atom, drawn a quarter bigger | one M atom | two atoms bouncing in the opening wave | three atoms at once from the start, two lives |

Easy's free beams are 60, not the spec's 40: with only 42 atoms the realistic elite's ordinary firing (about 46 beams that
hit nothing) cost it 200 on most runs. Hard's and Expert's own core lines (98 of 103, 105 of 125) are decision 12's
per-level lines: the realistic elite pops every one of 103 atoms in the 90 s on 31 % of Hard runs and every one of 125 on
2 % of Expert runs.

**The proof.** Normal and each level deal from their own list (`src/lib/duel/burstLevelDeals.server.ts`, built by
`bun scripts/burst-level-deal.ts [--level=…] [--check]`; witnesses `scripts/fixtures/burst-level-deal-witness.json.gz`): a
seed is kept at a level only when the skill-band flawless player **held to the human limits** (0.25 s to react, 0.15 s to
move, or one of nine slower variants, `BURST_DEAL_LIMITS`, never faster) scores exactly 200 through the server replay at
that level, unflagged. 100 seeds a level: Normal 100 of 101 candidates, Easy 100 of 104, Hard 100 of 103, Expert 100 of 134
(the witnesses were found on the lines first tried, Hard's core at 100 and Expert's at 110 with wave clears at 17; the lines
were then lowered, which leaves every witness at 200). The pin `burstPreSmall` still deals burstRev 13 on the room seed;
burstRev 14 deals the seed its level's list gives that room seed.

**Measured** (the D5 ladder, `bun scripts/d5-ladder-record.ts burst --deals=96`, both players held to HUMAN_LIMITS, real
deals graded by the server; `scripts/fixtures/d5-ladder-burst.json.gz`):

| Level | Average before → after | Elite before → after | Elite at 200, before → after |
|---|---|---|---|
| Easy | 122.9 → **183.5** | 180.8 → **191.9** | 0 % → **56 %** |
| Normal | 85.6 → **101.8** | 173.9 → **190.6** | 0 % → **39 %** |
| Hard | 81.5 → **77.6** | 166.0 → **190.6** | 0 % → **32 %** |
| Expert | 61.6 → **58.4** | 153.3 → **178.4** | 0 % → **25 %** |

"Before" is burstRev 14 as first built (burstRev 13's levels on Normal's waves, the old lines, any seed). Joe's ladder test
passes: the average player steps down 82, 24 and 19 points; the elite reaches 200 on 56 %, 39 %, 32 % and 25 % of runs
(Normal a point under the aim's 40 %: its elite pops all 87 atoms in time on 72 % of runs, and the core's line stays put).
The Normal refit lifts the average player by about 16 points (the golden atoms: 2 of 5 fill the part, and they
reach them on a third of runs), which is the approved refit's own effect. The spec's average targets (Hard 55–75, Expert
25–45) are met on Hard and nearly on Expert; Easy sits a little above its 150–180.

`scripts/burst-ladder-check.ts` proves it all (Normal's play, the older stamps, the waves and settings, the lines, the
deals and witnesses, the recorded ladder and a live sample of it, the lever picture); `burst-small-check` follows the
per-level deal. **The intro demo needs recording on burstRev 14** (as before).

## burstRev 14: the middle atoms (D5, 22 Nov 2026)

Approved by Joe on 20 Nov 2026 (the polish plan's C1.8, `docs/polish-plan-final/earlier-plan.md`: smaller atoms, a
middle table between burstRev 13's and the original). New stamp **burstRev 14** (`BURST_REV_SMALL`): burstRev 13's waves, lives, beams, power-ups, golden atoms,
parts, kinder wave clears and levels, with every atom drawn and collided at `BURST_RADIUS_SMALL`, between burstRev 13's
table and the original one:

| Size | Original (burstRev ≤ 12) | burstRev 13 | **burstRev 14** | burstRev 14 Easy (125 %) |
|---|---|---|---|---|
| L | 32 | 38 | **35** | 43 |
| M | 22 | 26 | **24** | 30 |
| S | 14 | 17 | **15** | 18 |
| XS | 8 | 10 | **9** | 11 |

- One radius function serves everything, as on burstRev 13: `burstRadius(state, size)` reads the state's `small: 1`
  (in place of burstRev 13's `big: 1`), then a level's `sizePct` on top (`Math.trunc(r × pct ÷ 100)`; Easy 125 %, Hard
  and Expert 100 %). The sim's beams, bounces, walls, ceiling and spawn places, the renderer, the sound observer and the
  near-miss moments all read it. The marker and the stamp are folded into the checkpoint checksum last, so every earlier
  checksum is unchanged and burstRev 14's are its own.
- **An atom touches the ship at the radius it is drawn at, its level's size included** (burstRev 14 only). On burstRev 13
  the touch read the size table alone, so on Easy a quarter-bigger atom (47 px drawn) touched the ship only at 38 px: the
  arcade bounds rule's one gap. burstRev 13 keeps its own touch exactly; Normal, Hard and Expert were never affected.
- The golden atom (9 px), the ship, the beams and every number in the help are unchanged; the help states no atom size,
  so no text changed.
- Rooms deal it at every level; checks written for burstRev 13 pin **`burstPreSmall`** (`DEAL_PINS`), which deals
  burstRev 13 on the same seed (and `preRetro` still deals burstRev 11). The practice definition, the intro still and
  LIVE_BANDS name burstRev 14; only an intro demo recorded on burstRev 14 plays (`SAME_PLAY_DEMO_REVS`), so the Fission
  demo needs recording on it (`bun scripts/retro-demos-record.ts burst`, then the Save intro demos workflow).
- The standard's perfect run: the same oracle (scripts/burst-small-oracle.ts, the standard entry's search with the game
  passed in) reaches 200 on 3 of 200 room seeds on burstRev 14 (1 of 200 on burstRev 13); on a real deal, level-tune's
  deal 64 (seed **330123215**) scores 200 through `gradeAnswer`, every part at its maximum. burstRev 13's seed 489736026
  scores 194 on burstRev 14.

Measured on 24 real deals a level under Joe's human limits (`bun scripts/d5-ladder.ts burst --deals=24
--bots=average,elite,proof`; averages, with the median in brackets; nothing reached 200 on either stamp):

| Level | Average, 13 → 14 | Elite, 13 → 14 | Proof (flawless at the limits), 13 → 14 |
|---|---|---|---|
| Easy | 148.0 (151) → 121.7 (126) | 183.9 (185) → 184.8 (187) | 186.2 (188) → 173.5 (184) |
| Normal | 93.4 (87) → 89.3 (88) | 172.9 (180) → 178.8 (178) | 176.1 (182) → 170.9 (179) |
| Hard | 88.8 (83) → 84.9 (83) | 165.2 (173) → 170.6 (169) | 168.6 (175) → 163.5 (170) |
| Expert | 70.7 (61) → 66.0 (62) | 157.3 (165) → 156.8 (162) | 160.2 (167) → 152.4 (163) |

On 120 Normal deals: average 94.8 → 82.1, elite 176.1 → 173.9, proof 180.1 → 177.4 (medians 94 → 82, 181 → 178,
182 → 180). Smaller atoms are harder to hit and easier to dodge: the average player loses most, the best players about
as much as they gain. Easy drops most for the average player (its atoms shrink, and they now touch the ship at the size
they are drawn).

Medians (p10–p90) on 20 room seeds, `bun scripts/arcade-skill-bands.ts burst --rev=now --seeds=20 --levels=all` (no
human limits; burstRev 13's row measured again the same day, identical to its section below):

| Stamp | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---|---|---|---|---|---|---|
| burstRev 13 | 34 (14–55) | 102 (40–143) | 162 (129–178) | 178 (165–185) | 178 (159–190) | 181 (169–189) | 189 (183–194) |
| burstRev 14 | 25 (5–58) | 82 (26–130) | 157 (91–173) | 176 (164–183) | 180 (169–191) | 183 (170–188) | 182 (177–191) |

The skill-band bot reads its atoms' paths with `burstRadius({ big }, …)` (scripts/arcade-skill-bands/bots/burst.ts,
`path`), so on burstRev 14 it predicts bounces with the original table (1–3 px small); its danger watch reads the state's
own radius. A copy reading `{ big, small }` measured the same within noise on Normal (elite 176.9, proof 168.2, average
83.2 on the 24 deals); the one-line fix is listed for Joe's approval. burst-small-check proves the stamp: burstRev 13 at
every level and burstRev 12 replay and grade exactly as recorded before it (scripts/fixtures/burst-small-legacy.json.gz,
scripts/burst-small-legacy-record.ts), the deal and pin, the radius rules, the art within 2 px of every collision radius
(Normal, Easy, Hard), and the perfect deal at 200.

## burstRev 13: bigger atoms (the Retro overhaul, 15 Nov 2026)

Joe (15 Nov 2026): "bigger Fission atoms, with their stamps". New stamp **burstRev 13** (`BURST_REV_BIG`): burstRev
12's waves, lives, beams, power-ups, golden atoms, parts and kinder wave clears, with every atom drawn and collided at
`BURST_RADIUS_BIG` (38, 26, 17 and 10 px; were 32, 22, 14 and 8): the smallest grow the most, since they were the
hardest to read. One radius function, `burstRadius(state, size)`, serves the sim, the renderer, the sound observer and
the bot. States add `big: 1`, folded into the checkpoint checksum last. Rooms deal it; checks written for the stamps
before pin `preRetro` (burstRev 11). Only an intro demo recorded on burstRev 13 plays (the atoms' size changes the
play). The standard's perfect run is the same oracle on a seed found again on burstRev 13 (`PERFECT_SEED` 489736026;
it scores 194 on burstRev 12's 1453580015).

Medians (p10–p90) on 20 room seeds, `bun scripts/arcade-skill-bands.ts burst --rev=now --seeds=20 --levels=all`:

| Stamp | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---|---|---|---|---|---|---|
| burstRev 12 | 23 (10–52) | 82 (29–125) | 147 (74–174) | 159 (115–182) | 181 (145–188) | 181 (162–189) | 188 (181–193) |
| burstRev 13 | 34 (14–55) | 102 (40–143) | 162 (129–178) | 178 (165–185) | 178 (159–190) | 181 (169–189) | 189 (183–194) |

Bigger targets lift the weaker levels most; the top is unchanged. The level tuning (stage 3) re-measures under human
limits.

## burstRev 12: kinder wave clears (the Retro overhaul, 15 Nov 2026)

Joe's review (docs/design/game-reviews/retro.md "Fission"): tune the wave-clear bonuses so a good wave earns them more
often (the Near-perfect bot earned 11 of 35 on burstRev 11). New stamp **burstRev 12** (`BURST_REV_WIDE`): burstRev
11's play, parts and fair-play rules exactly; a wave's clear bonus is still the full 7 within its quick time (1 s plus
0.6 s an atom: Normal's quick time is unchanged, as the level table keeps it), then falls evenly to 0 at **three** times
the quick time (`BURST_V12_CLEAR_ZERO`; twice on burstRev 10 and 11). The HUD's "CLEAR +n" shows the live value. States
add `wide: 1`; `playRevOf` maps 12 to 11's play. retro-overhaul-check proves the same play tick for tick on the bots'
logs, never a lower score, and more clear points on good runs.


29 Oct 2026, batch A of the arcade scoring standard. Gameplay and scoring change on a new stamp: rooms and practice
deal `burstRev 10` (`BURST_REV_STD`, `src/lib/arcade/burst.ts`, "The arcade scoring standard"). Every older stamp
(unstamped to `burstRev 9`) replays and scores exactly as before: burst-standard-check replays 72 runs recorded on
main 73f6bb7 (`scripts/burst-standard-legacy.ts`, `scripts/fixtures/burst-standard-legacy.json.gz`) to the identical
score and final state, and fission-carry-check, expansion-e9-check, arcade-tuning-g1-check, arcade-batch3-check and
replay-check still prove their revisions.

## Parts (straight lines, 200 in all)

| Part | Max | Rule |
|---|---|---|
| Core: atoms popped | 140 | floor(140 × popped ÷ 87). Every atom and every piece its splits make counts once when it is shot (an L atom is 15: itself, 2 M, 4 S, 8 XS). Golden atoms are **not** atoms here. |
| Wave clears | 35 | 7 a wave × 5. A wave cleared within its quick time (1 s + 0.6 s for every atom it holds, splits included: 5.2 / 10 / 9.4 / 13.6 / 19 s for waves 1–5) pays 7; after that evenly less, floor(7 × (2Q − t) ÷ Q), reaching 0 at twice the quick time (10.4 / 20 / 18.8 / 27.2 / 38 s). |
| Golden atoms | 25 | 25 ÷ 5 = 5 for each golden atom a shot takes. |
| Power-ups | 0 | DOUBLE, BURST and FREEZE still ride on seeded atoms and still help; they pay nothing. |
| Lives | −5 each | Each life lost costs 5 (3 lives; the third ends the run). |

Total = core + clears + golden − lives, at least 1 for a run with any input, 0 for none, at most 200.

**Core target:** the core has a fixed maximum (all 87 atoms of the five waves), so it needs no measured target. For the
record, the near-perfect level's median run pops all 87 (23 of 30 near runs complete; tuning seeds 0–29).

## Gameplay changes (`burstRev 10` only)

- **The run is five waves**: burstRev 9's waves 1–5 from the seed (M; L; M M; L S S; L L = 87 atoms). Clearing all five
  completes the run (`done`, `ended = 1`) as soon as the last golden atom is gone (taken or faded); otherwise it ends at
  90 s or with the third life. A cleared wave counts once (no waves follow the fifth). The carriers (power-ups) are
  burstRev 9's rule on these five waves, on a stream of their own.
- **One golden atom per wave**, five a run. Each appears a seeded 1–2 s after its wave appears, at a seeded spot,
  setting off to a seeded side (`burstScheduleV10`, fixed at init from the room seed, the same for every player). If
  one is still up when the next is due, the next waits until it fades. It bounces as on burstRev 9 for 5 s, FREEZE
  stops it, and **it takes a life if it touches the ship**, like any atom (same invulnerability after a hit).
- Everything else is burstRev 9: the 390 × 650 arena, the atoms' bounces, DOUBLE, BURST and FREEZE carried by seeded
  atoms, the ship and its controls.

States keep burstRev 9's fields (`carry: 1`) and add `std: 1`, `gDue`, `gUntil` and `done`, folded into the checkpoint
checksum after burstRev 9's, so every earlier checksum is unchanged.

## Medians, before (`burstRev 9`) and after (`burstRev 10`)

`bun scripts/arcade-skill-bands.ts burst --rev=now --levels=all --seeds=30 --jobs=4` (tuning seeds 0–29, the fixed
bots, the server replay's score). Median (10th–90th percentile).

| Rev | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---|---|---|---|---|---|---|
| 9 (before, main) | 28 (10–54) | 82 (40–126) | 146 (72–170) | 163 (138–178) | 174 (149–192) | 182 (152–199) | 183 (159–195) |
| 10 (after) | 20 (4–40) | 79 (16–125) | 135 (54–169) | 153 (95–176) | 173 (148–180) | 178 (153–186) | 182 (174–188) |

The medians rise at every level, with about 5 points between near-perfect, elite and flawless (burstRev 9 had 1 between
elite and flawless). Weak and average fall a little: the golden atom now costs them lives, and the 10 for lasting the
90 s is gone. No played run scores 0.

A perfect run: the oracle in `scripts/arcade-standard/burst.ts` (a search through the real sim with the phone's snap
move and taps) scores 200 through the server replay on room seed 1453580015 (87 atoms, five waves each inside its quick
time, five golden atoms, no life lost, complete at 43.5 s); on tuning seeds 0–29 it scores 184–200 on all but two.

## Bots

`scripts/arcade-skill-bands/bots/burst.ts`, gated on the state's `std` (every earlier revision plays exactly as
before): once noticed, the golden atom's read path is in the danger watch, its fade time is the state's own, and the
flawless level presses every 4 ticks (the others keep their press gaps).

## Texts and screens

The "?" help states the parts ("Wave clears add up to 35 (7 a wave) and golden atoms up to 25 (5 each): 140 + 35 + 25 =
200. Each life lost costs 5; power-ups score nothing.") and that the golden atom hurts; the intro: "Atoms up to 140, fast
waves 35, golden atoms 25; a lost life costs 5. Up to 200."; the reveal's breakdown is the parts (atoms of 87 → core,
wave clears and golden atoms, lives lost × 5), with golden atoms of 5 and waves cleared of 5 as tiles; the HUD's
"CLEAR +n" counts down from 7 on the new line and the golden atom shows "+5". The intro demo stays stopped until one is
recorded on burstRev 10 (`introDemo.functions.ts`).

## Assumptions

- "Total poppable atoms in the run" needs a fixed run, so the run is the five waves the time bonus names (7 × 5). The
  top bots cleared burstRev 9's fifth wave at about 75–85 s, so five waves fill the 90 s for good players.
- The golden atom's moment is seeded relative to its wave's appearance (like the atoms of the wave themselves), so
  every player meets the same five golden atoms at the same point of the run; what spawns never depends on play.
- The quick time is burstRev 9's (1 s + 0.6 s an atom); the zero point is twice it.
- `arcade-batch3-check`'s intro assertion ("10 more for the 90 s") now asserts the new parts line, since the 10 for
  lasting is gone on the dealt revision.

## burstRev 11: progress counts, aiming counts (Nov 2026, the scoring audit)

`docs/audit-nov-2026/scoring.md` issues 2 and 7: weak runs lost their atoms to the lives' cost (1–4), and standing still
firing every 5 ticks scored a median of 98, like an average player. burstRev 11 (`BURST_REV_AIM`) is burstRev 10's play and
parts exactly (states add `aim: 1` and `whiffs` outside the checksum):

- the life that ends the run is not charged; each life lost before it costs 5;
- a wasted beam is a beam or BURST shot that reaches the ceiling without hitting an atom or golden atom (`whiffs`). A run
  gets one free for each atom popped, and at least 20 (`BURST_V11_FREE_MISSES`); each beyond costs 2 (`BURST_V11_MISS_COST`).
  Aimed play (every bot level) wastes fewer beams than it pops atoms, so it pays nothing;
- lives and wasted beams together never take more than half the atom points.

| Level | Weak | Average | Good | Great | Near | Elite | Flawless |
|---|---|---|---|---|---|---|---|
| burstRev 10 | 22 (4–45) | 80 (17–125) | 136 (57–171) | 153 (97–176) | 173 (148–180) | 178 (153–187) | 183 (174–189) |
| burstRev 11 | 27 (10–50) | 81 (22–130) | 139 (62–171) | 156 (102–176) | 173 (148–180) | 178 (153–187) | 183 (174–189) |

Fire-spam (standing at the start, firing every 5 ticks or every tick): median 98 → 63 and 115 → 67 on 30 seeds, below the
average player's 81 (scoring-audit-arcade-check proves it on 12 seeds: 103 → 63 against the average bot's 96). The
reveal's penalty row adds both costs, so the breakdown adds up. 200 stays reachable (the oracle's perfect run, arcade-standard-check).
Issue 20 (200 on every dealt seed) is not part of this change.

The table's medians (p10–p90) are 30 room seeds, measured with `bun scripts/arcade-skill-bands.ts cross wavefront burst skyline slice --rev=now --seeds=30 --levels=all` on main and on this branch.
