# The arcade scoring standard (29 Oct 2026)

Joe's one scoring shape for the arcade games, built in four batches by separate sessions (A: Slice, Breaker, Tilt,
Fission, Gemstone, Meteor, Hover; B: High Rise, Swish, Flightpath, Pinball, Rally, Coral Pop, Tempo; C: Jaywalk,
Wavefront, Roofbound, Rainbow Bridge, Orbit, Ball Tracker; D: Grappler's swingRev 15) and combined before any landed:
**one helper, one check, one docs folder.** This folder holds this README (the standard, the helper, the check, every
game's parts) and one page per game, `<type>.md` (exactly how each part counts, the decisions and assumptions, the
skill-band medians).

## The standard

- **Core**: the game's main measure on a **straight line** from 0 to its maximum, full at a fixed figure (a fixed
  maximum, or the near-perfect skill-band level's median where there is none, measured with
  `scripts/arcade-skill-bands.ts --rev=now`). Each step of better play adds about the same points. No curves, knots or
  rising scales.
- **Features**: fixed amounts, so much each up to a cap or an equal share of a cap for each item.
- **Speed** counts only on a completed run.
- The parts' maximums sum to **exactly 200**. Mistakes cost what each game's page says. Anyone who plays (any input)
  scores at least 1; a run with no input scores 0.
- Everyone in a room plays the identical seeded run (every feature at seeded moments and places from the room seed).
- Each game moves onto it on a **new stamp one above its live one**; every older stamp replays and scores exactly as
  before (each game's own legacy check on runs recorded on main before the change).

## The helper: `src/lib/arcade/arcadeStandard.ts`

The only standard helper; every game on the standard uses it (no game keeps its own copy of these rules).

| Export | What it does |
| --- | --- |
| `STD_MAX` | 200, every standard revision's maximum (ROUND_MAX's 200). |
| `StdSpec`, `StdSpecPart` | A game's spec: `field`, `rev` and its parts, the core first (key `"core"`), each with `label`, `max` and, where the game states them, `of` (items the maximum is split over), `item` / `items` and `how` (help words). `stdCore`, `stdFeatures`, `stdSpecPart` read it. |
| `stdLine(max, got, of)` | A part on a straight line: floor(max × got ÷ of), held to 0…max. `stdPartLine(part, got)` reads `max` and `of` from a spec part. |
| `stdEach(count, each, max)` | So much each, up to the cap. |
| `stdSpeed(max, value, fullAt, zeroAt)` | A speed part (completed runs only): full at `fullAt`, 0 at `zeroAt`, a straight line between, either direction. |
| `stdFinal(sum, acted)` | The stored score: 0 with no input, else held to 1…200. `stdScore` (a parts list) and `stdTotal` (a breakdown) both end in it. |
| `StdPart`, `stdPart`, `stdSum`, `stdScore`, `stdLines`, `stdHelp` | A run's parts as a list with what each measured: the reveal's one line per part and the help built from each part's `how`. |
| `StdBreakdown`, `stdTotal`, `stdBandParts`, `stdFeaturesHelp` | A run as core points, each feature's points and the mistakes' cost: BandParts for the reveal, band tables and bots, and the help built from each feature's `of`. |
| `stdSpecMax` | The sum of a spec's maximums (200 on every game). |

Integer maths only: the phone and the server must never round differently. Nothing is registered by import: every
table is imported by name (no-side-effect-imports-check).

## The check: `scripts/arcade-standard-check.ts`

One check, one entry per game in `scripts/arcade-standard/<type>.ts` (the entry shape is
`scripts/arcade-standard/entry.ts`). `STANDARD_ROSTER` in the check lists all 33 games (batches A–C, Grappler, and the Cards & Board and Sports games born on it); once rooms deal a game's
standard stamp it must have an entry. For every entry it proves: the parts (core first) sum to exactly 200 and the round
maximum is 200; rooms deal the stamp and LIVE_BANDS lists it; every perfect run, through the game's real scoring path
(a server replay or the sim's own score), scores exactly 200, each part at its maximum where the run is split. Where an
entry gives them, it also proves: played runs score at least 1 (or exactly their stated score) and idle runs 0, the
help says the parts total 200 and states every maximum and feature, the core is a straight line with no feature points
on it, older revisions have no standard parts, the standard is the stamp one above the one dealt before, the sim's spec
is the entry's (and LIVE_BANDS carries it), and the game's own assertions. It also proves the helper's lines.

Each game's own `<game>-standard-check` (and Grappler's swing-rework-check) proves its rules and that older stamps
replay exactly as before; standard-live-check grades every stored arcade run through the production build.

## The games

| Game | Type | Stamp | Batch | Page |
| --- | --- | --- | --- | --- |
| Slice | `slice` | `sliceRev` 11 | A | [slice.md](slice.md) |
| Breaker | `breaker` | `brkRev` 11 | A | [breaker.md](breaker.md) |
| Tilt | `tilt` | `tiltRev` 10 | A | [tilt.md](tilt.md) |
| Fission | `burst` | `burstRev` 10 | A | [burst.md](burst.md) |
| Gemstone | `matchup` | `matchupRev` 12 (11 before, Nov 2026) | A | [matchup.md](matchup.md) |
| Meteor | `snake` | `snakeRev` 12 | A | [snake.md](snake.md) |
| Hover | `hover` | `hoverRev` 10 | A | [hover.md](hover.md) |
| High Rise | `skyline` | `skylineRev` 9 | B | [skyline.md](skyline.md) |
| Swish | `bintoss` | `binRev` 9 | B | [bintoss.md](bintoss.md) |
| Flightpath | `bullseye` | `bullRev` 9 | B | [bullseye.md](bullseye.md) |
| Pinball | `pinball` | `pinRev` 6 | B | [pinball.md](pinball.md) |
| Rally | `rally` | `rallyRev` 12 | B | [rally.md](rally.md) |
| Coral Pop | `bubble` | `bubbleRev` 11 | B | [bubble.md](bubble.md) |
| Tempo | `beat` | `beatRev` 11 | B | [beat.md](beat.md) |
| Jaywalk | `cross` | `crossRev` 10 | C | [cross.md](cross.md) |
| Wavefront | `wavefront` | `wavRev` 12 | C | [wavefront.md](wavefront.md) |
| Roofbound | `flip` | `flipRev` 11 (10 before, Nov 2026) | C | [flip.md](flip.md) |
| Rainbow Bridge | `inkbridge` | `inkRev` 12 | C | [inkbridge.md](inkbridge.md) |
| Orbit | `orbit` | `orbitRev` 13 | C | [orbit.md](orbit.md) |
| Ball Tracker | `balltrack` | `btRev` 8 | C | [balltrack.md](balltrack.md) |
| Grappler | `swing` | `swingRev` 16 (15 before 1 Nov 2026) | D | [swing.md](swing.md) |
| Minesweeper | `minesweeper` | `minesRev` 1 | Cards & Board | [minesweeper.md](minesweeper.md) |
| Mahjong Solitaire | `mahjong` | `mahjongRev` 1 | Cards & Board | [mahjong.md](mahjong.md) |
| Home Run Derby | `homerun` | `homerunRev` 1 | Sports | [homerun.md](homerun.md) |
| Top Bins | `freekick` | `freekickRev` 3 (1 Nov 2026; 1 and 2 replay) | Sports | [freekick.md](freekick.md) |
| Racing | `racing` | `racingRev` 1 | Sports | [racing.md](racing.md) |
| Free Cell | `freecell` | `freecellRev` 3 (2 and 1 for stored rounds) | Cards & Board | [freecell.md](freecell.md) |
| Summit | `tripeaks` | `tripeaksRev` 1 | Cards & Board | [tripeaks.md](tripeaks.md) |
| Full House | `pokersquares` | `pokerSquaresRev` 2 | Cards & Board | [pokersquares.md](pokersquares.md) |
| Five Hands | `fivehands` | `fiveHandsRev` 2 (1 for stored rounds) | Cards & Board | [fivehands.md](fivehands.md) |
| Bastion | `bastion` | `bastionRev` 2 | Action | [bastion.md](bastion.md) |
| Pyramid | `pyramid` | `pyramidRev` 1 | Cards & Board | [pyramid.md](pyramid.md) |
| Golf Solitaire | `golfsol` | `golfSolRev` 1 | Cards & Board | [golfsol.md](golfsol.md) |
| Muggins | `muggins` | `mugginsRev` 1 | Cards & Board | [muggins.md](muggins.md) |
| Crazy Golf (was Minigolf) | `minigolf` | `golfRev` 2 (1 for stored rounds) | Sports | [minigolf.md](minigolf.md) |
| Cue Ball (was Speed Pool) | `pool` | `poolRev` 3 (2 and 1 for stored rounds) | Sports | [pool.md](pool.md) |
| Curl Champ (was Curling) | `curling` | `curlRev` 3 (1 and 2 for stored rounds) | Sports | [curling.md](curling.md) |
| Blockfall | `blockfall` | `blockfallRev` 1 | Retro | [blockfall.md](blockfall.md) |
| Alley Roll | `alleyroll` | `alleyRollRev` 1 | Sports | [alleyroll.md](alleyroll.md) |
| Ricochet (the ninja wall-climb) | `ricochet` | `ricoRev` 2 (unstamped: the old shaft, never on the standard) | Action | [ricochet.md](ricochet.md) |

The batches land one at a time on top of this; each adds its games' entries, pages and its summary section below.

## Batch A: Slice, Breaker, Tilt, Fission, Gemstone, Meteor, Hover

Seven arcade games score in fixed parts that sum to exactly 200, each on a new stamp one above its live one. Older
stamps replay and score exactly as before (each game's `<game>-standard-check`, on fixtures recorded on main 73f6bb7).
`scripts/arcade-standard/<type>.ts` holds each game's parts; `arcade-standard-check` proves the sum and a perfect 200.

The standard: core pays the game's main measure on a straight line; features pay fixed amounts; no curves, knots or
rising scales; speed only on a completed run; any played run scores at least 1; every player in a room plays the
identical seeded run. Per-game detail, rules and assumptions are in this folder (`<type>.md`).

### Parts

| Game | Stamp | Core | Features | Sum |
| --- | --- | --- | --- | --- |
| Slice | `sliceRev` 11 | 120, share of all food sliced | combo 40, golden fruit 20, tickets 10, dodges 10; chilli −10 | 200 |
| Breaker | `brkRev` 11 | 140, share of all 108 bricks | clear 10, speed 20 (full with half the clock left), gold bricks 30 | 200 |
| Tilt | `tiltRev` 10 | 140, 35 a maze (30 finish + 5 progress), 4 mazes | all four 10, speed 20 (full by 75 s), gold stars 30 | 200 |
| Fission | `burstRev` 10 | 140, share of all 87 atoms (splits count) | wave clears 35 (7 × 5), golden atoms 25; a lost life −5 | 200 |
| Gemstone | `matchupRev` 11 | 110, gems cleared, full at 375 | treasure 40 (10 × 4), goals 30, ice 10, big lines 10 | 200 |
| Gemstone (Nov 2026) | `matchupRev` 12 | 108, gems cleared, full at 360 | treasure 36 (6 × 6), goals 36 (6 × 6), ice 10, big lines 10 | 200 |
| Meteor | `snakeRev` 12 | 120, stars eaten (a gold star counts 2), full at 28 (snakeRev 11: 27 stars) | gold stars 40, combos 20, lane rides 10, warp stars 10 | 200 |
| Hover | `hoverRev` 10 | 120, barriers passed (42) | star chains 30, gold stars 20, tight gates 20, centre line 10 | 200 |

Core targets measured with the skill-band tool: Gemstone 375 gems (near-flawless median 376); Meteor 27 stars (great's
median was 22, so the safeguard raised it to near-flawless's median). The other five have a fixed maximum.

### Medians, weak → flawless (room seeds 0–29, `arcade-skill-bands.ts --rev=now --levels=all`)

| Game | | Weak | Average | Good | Great | Near | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Slice | before | 38 | 73 | 128 | 176 | 177 | 182 | 184 |
| | after | 75 | 116 | 156 | 173 | 181 | 194 | 200 |
| Breaker | before | 66 | 73 | 115 | 142 | 170 | 179 | 181 |
| | after | 45 | 58 | 105 | 119 | 137 | 154 | 168 |
| Tilt | before | 81 | 101 | 134 | 163 | 179 | 180 | 186 |
| | after | 70 | 83 | 110 | 136 | 184 | 190 | 200 |
| Fission | before | 28 | 82 | 146 | 163 | 174 | 182 | 183 |
| | after | 20 | 79 | 135 | 153 | 173 | 178 | 182 |
| Gemstone | before | 52 | 67 | 81 | 95 | 110 | 150 | 164 |
| | after | 82 | 101 | 116 | 148 | 165 | 176 | 183 |
| Meteor | before | 50 | 73 | 115 | 139 | 175 | 186 | 191 |
| | after | 48 | 74 | 115 | 141 | 171 | 181 | 182 |
| Hover | before | 28 | 104 | 104 | 123 | 172 | 182 | 200 |
| | after | 8 | 47 | 47 | 94 | 156 | 170 | 197 |

Hover's average and good tie at 30 seeds (they tied before too); on 60 seeds they separate, 36 and 52. Slice's and
Tilt's flawless level is the oracle player (each seed's ceiling). Meteor's top three are close (171 / 181 / 182): combos
and warp stars fill their caps early, so only gold-star timing and lane rides separate them.

## Batch B: High Rise, Swish, Flightpath, Pinball, Rally, Coral Pop, Tempo

High Rise, Swish, Flightpath, Pinball, Rally, Coral Pop and Tempo score on one shape, each on a new version stamp one
above its live stamp. Every older round replays and scores exactly as before (each game's `<game>-standard-check`
replays runs recorded on the live stamp before the change). Per-game notes, assumptions and full tables:
`<type>.md` in this folder.

### The shape (`src/lib/arcade/arcadeStandard.ts`)

- **Core**: the game's main measure on a straight line, `max × min(value, fullAt) ÷ fullAt` rounded down
  (`stdLine`). No curve, knots or rising scale. Where the game has no fixed maximum, `fullAt` is the near-perfect
  skill-band level's median on the tuning seeds 0–59 (`scripts/arcade-skill-bands.ts --rev=now`), the reading of
  Joe's "near-flawless level".
- **Features**: fixed amounts (so much each up to a cap, or a share of a cap).
- **Total**: the parts' maximums sum to exactly 200; no input scores 0; anyone who plays scores at least 1
  (`stdScore`).
- Each sim exports `<GAME>_STD_SPEC` (parts, maximums, help wording) and `<game>StdParts(state)`; `standard/index.ts`
  lists them. The arcade reveal shows one line per part (`stdLines`), the "?" help lists every part with its maximum
  and "Together 200 points." (`stdHelp`, `liveStdHelp`), and LIVE_BANDS carries the spec (`std`) with the core's
  straight line as its curve.
- `arcade-standard-check` proves, per game: maximums sum to 200, rooms deal the spec's stamp, a perfect run scores
  exactly 200 (a real played best run for Flightpath), a run that played and earned nothing scores 1, no input 0,
  the core is the straight line with no feature points on it (a finish part such as Swish's "All ten in" only from a
  full core), and older revisions have no standard parts.

### The games

| Game | Stamp | Core (max, full at) | Features | Play change |
| --- | --- | --- | --- | --- |
| High Rise | `skylineRev` 9 | floors 140, full at 61 (near median) | perfect drops 30 (share of drops, over at least 61), perfect streak 10 (1 per perfect in the best streak), gold blocks 20 (4 each of 5 seeded golds) | 5 seeded gold blocks, one per fifth of blocks 4–60; no multiplier or milestone points |
| Swish | `binRev` 9 | buckets 130 (13 each, +1 a close miss), full at 10 | far buckets 36 (6 each, throws 1–6), hoops 24 (8 each of 3), all ten in 10 | exactly 3 hoops on every seed (rev 8 sometimes dealt fewer) |
| Flightpath | `bullRev` 9 | dart total 150, full at **112** (Joe: 130) | bull streak 30 (as today), dead-centre 20 (shared between the darts whose 10 is the middle ring) | none |
| Pinball | `pinRev` 6 | table points 130, full at 61,000 (near median 60,780) | J-O-U-L-Z 20 (10 a set, up to 2), multiball 20, jackpots 15 (5 each, 3), ramp combos 15 (5 each, 3) | the table's ×2–×5 multiplier and rising combo chain are gone (×1, a flat 1,000 a combo) |
| Rally | `rallyRev` 12 | gold-ball hits 140, full at 23 (near median 22.5) | pink pads 30 (3 each, up to 10), gold targets 30 (5 each of 6); lasting the minute 0 | the spin reversed: a left swipe leaves left and curves back right (mirror for right); losing the blue ball already ended the run |
| Coral Pop | `bubbleRev` 11 | bubbles cleared 120, full at the reef (95) | reef cleared 10, speed 10 (cleared only; full with half the clock left), chests 30 (5 each of 6), bank shots 15 (1 per 2), combos 15 (1 each) | the mine pops only the 4 bubbles nearest where it lands |
| Tempo | `beatRev` 11 | accuracy 130, full at 1,000 per mille (see below) | fever 25 (6/12/18/25 for 1–4 fevers), golden notes 15 (share), double taps 15 (share), Perfect streak 15 (share of the song) | none (fever no longer doubles) |

#### Deviations from Joe's rows (decisions for Joe)

- **Flightpath, full at 112 not 130; dead-centre shared.** No seed allows a dart total above 113–124 (a dart scores
  at most 12, the 10 is the centre ring on only 6–9 darts, balloons add 6), so 130 can never be reached; the dead-centre
  ring exists on only 6–9 darts, so "2 per dart, up to 20" can't either. 112 is reachable on every seed (ten bulls and
  every dead centre give 100 + 2 × the dead-centre darts, at least 6); with it the best run replays to exactly 200 on
  all 260 tuning and fresh seeds (bullseye-standard-check). The bull streak keeps today's +2, +4, +6… rule, as the row
  says "as today".
- **Tempo, "full at 1,000" read as per mille.** Songs hold 183–219 notes, so 1,000 raw points (4 / 3 / 1 / −2) is out
  of reach (a flawless run earns 732–876). Core is `raw ÷ (4 × notes) × 1,000` on the straight line to 130 at 1,000
  (every note Perfect; misses still cost 2). Near-perfect's median is 992.
- **Rally pads, 3 each up to 10** (not split over 6): with 6, near-perfect, elite and flawless all max the pads and the
  top bunches.
- **High Rise perfect drops** are a share over at least 61 drops, so one perfect drop and quitting can't take 30.
- **Coral Pop bank shots** pay 1 per 2 (near-perfect made ~25 a run on rev 10); a chest the mine pops pays nothing.

### Medians, weak → flawless (before = the stamp rooms dealt before, after = the standard stamp)

Tuning seeds 0–59 (60), fresh seeds 10000–10099 (100), the skill-band tool's default (fixed) bots, every run through
the server's replay. No level scores 0 on any run, before or after, in any game.

| Game | Seeds | Weak | Average | Good | Great | Near | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| High Rise | tuning | 59 → 33 | 78 → 44 | 107 → 64 | 125 → 90 | 177 → 159 | 192 → 172 | 200 → 198 |
| | fresh | 63 → 35 | 76 → 44 | 102 → 60 | 124 → 91 | 177 → 161 | 192 → 172 | 200 → 198 |
| Swish | tuning | 63 → 58 | 83 → 81 | 106 → 94 | 131 → 112 | 175 → 144 | 185 → 164 | 200 → 200 |
| | fresh | 59 → 55 | 83 → 80 | 105 → 94 | 148 → 118 | 176 → 152 | 185 → 172 | 200 → 200 |
| Flightpath | tuning | 56 → 70 | 77 → 95 | 103 → 112 | 141 → 152 | 172 → 181 | 181 → 186 | 200 → 200 |
| | fresh | 55 → 70 | 71 → 90 | 104 → 115 | 143 → 149 | 172 → 178 | 181 → 188 | 200 → 200 |
| Pinball | tuning | 60.5 → 34.5 | 66.5 → 48 | 97 → 90.5 | 123 → 146 | 169 → 175 | 173.5 → 180 | 195.5 → 190 |
| | fresh | 57.5 → 33.5 | 75.5 → 63.5 | 106.5 → 118 | 124 → 143.5 | 163 → 179 | 176 → 185 | 188 → 190 |
| Rally | tuning | 57 → 74 | 84 → 110 | 125 → 140 | 137 → 165 | 170 → 175 | 177 → 178 | 184 → 185 |
| | fresh | 56 → 68 | 83 → 100 | 123 → 140 | 151 → 169 | 163 → 173 | 179 → 181 | 186 → 185 |
| Coral Pop | tuning | 42 → 21 | 75 → 40 | 101 → 75.5 | 124.5 → 123 | 171.5 → 158 | 179 → 158.5 | 187 → 170.5 |
| | fresh | 43 → 19 | 79 → 46 | 104 → 85 | 128 → 125 | 170 → 158 | 183 → 161 | 188 → 175.5 |
| Tempo | tuning | 43 → 49 | 85 → 97 | 114 → 135 | 148 → 161 | 176 → 184 | 179 → 190 | 200 → 198 |
| | fresh | 41 → 48 | 81 → 94 | 114 → 133 | 144 → 159 | 174 → 179 | 191 → 192 | 200 → 198 |

Medians rise level by level in every game. Where the gaps at the top are thin, it is the bots, not the shape:

- **Coral Pop** near → elite is +0.5 / +3: both bots run out of clock 6–7 bubbles short and both reach the combo cap;
  elite clears the reef more often (its p10 is higher). The straight core also drops the lower levels, which rev 8's
  curve lifted for a half-cleared reef.
- **Rally** near → elite → flawless +3 / +1 (tuning): great and near-perfect bots hit the same gold-ball count once the
  core is full; only pads and targets separate them.
- **High Rise, Pinball, Coral Pop** lower levels fall: their old curves were steep at the bottom; a straight line in
  floors / table points / bubbles isn't (Joe: don't chase bot number targets).

### Intro demos

All seven intro demos stay stopped until re-recorded on the new stamps (each game's `introDemo.functions.ts` guard
plays only a demo recorded on its standard stamp).

## Batch C: Jaywalk, Wavefront, Roofbound, Rainbow Bridge, Orbit, Ball Tracker

Jaywalk, Wavefront, Roofbound, Rainbow Bridge, Orbit and Ball Tracker move onto Joe's arcade scoring standard. One
page per game in `docs/arcade-standard/` gives exactly how each part counts and the assumptions made.

### The standard

- The core (the game's main measure) pays on a **straight line** (`stdLine` in `src/lib/arcade/arcadeStandard.ts`):
  full at a fixed figure, or at the Near-perfect level's median where there is none.
- Each feature pays a fixed equal share of its own maximum per item. No rising scales or skill-points curves.
- Speed counts only on a completed run (`stdSpeed`).
- The parts' maximums sum to exactly 200. A played run scores at least 1; no input scores 0 (`stdTotal`, ending in `stdFinal`).
- Everyone in a room plays the identical seeded run.
- arcade-standard-check proves, for each game (`scripts/arcade-standard/<type>.ts`): the parts sum to 200, rooms deal the
  new stamp, perfect runs score 200 (replayed through the server), a played run scores at least 1, idle 0, and the help
  names every part and says the parts total 200.

### The six games

| Game | Stamp | Core | Features | Core full at |
|---|---|---|---|---|
| Jaywalk | crossRev 10 (play change) | Rows and crossings 150 | Coins 30 (1.5 × 20), crossing streak 10 (2 per clean crossing after a clean one, 5), close calls 10 (1 × 10) | 92 units (Near-perfect median 91.5, measured on crossRev 10) |
| Wavefront | wavRev 12 | Ships, hits and waves 150 | Boss destroyed 10, boss speed 10 (full ≤ 20 s after arrival, 0 at 40 s), saucers 20 (4 × 5), cannons and weak points 10 (6 shares), power-ups 0; −5 a life lost | 294 units: everything before the mothership |
| Roofbound | flipRev 10 | Time survived 150 | Gold stars 15 (1.5 × 10), star trails 15 (3.75 × 4), sweet landings 10 (1.25 × 8), double flips 10 (1 × 10) | The full minute (120 half seconds) |
| Rainbow Bridge | inkRev 12 | Levels potted 140 (14 each) | Speed 10 (all ten only; full with 45 s left), ink stars 20 (2.5 × 8), trick shots 12 (3 × 4), shamrock 10, silver coins 8 (0.5 × 16) | All 10 levels |
| Orbit | orbitRev 13 | Planets reached 130 (sixteenths of a planet, so part of a flight counts) | Speed 20 (sun only; full with half the time left), stardust 15 (0.5 × 30), slingshots 12 (3 × 4), asteroid fields 12 (4 × 3), perfect orbits 11 (11/21 each of 21) | The sun (40 planets) |
| Ball Tracker | btRev 8 | Marbles home 140 | Gold marbles 25 (6 shares), combos 20 (1 per marble home from the third in a row), boosted marbles 15 (15/36 per boosted marble home) | All 36 |

Only Jaywalk's play changes: crossing 1 has half crossRev 9's traffic, 2 two thirds, 3 five sixths, 4 full, 5 13/12, 6 14/12,
7+ 15/12, each crossing still proved passable (a crossing that fails steps back toward 12/12; `scripts/cross-std-density.ts`).
The others keep their previous stamp's play exactly (states add `std: 1` outside the checksum).

### Skill-band medians, before → after

`bun scripts/arcade-skill-bands.ts <games> --rev=now --levels=all --seeds=30`, before on main 73f6bb7 (the stamps then
dealt), after on this branch. Medians (p10–p90 after).

| Game | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---|---|---|---|---|---|---|
| Jaywalk | 49 → 88 (59–110) | 78 → 117 (90–129) | 122 → 133 (113–149) | 146 → 144 (124–171) | 168 → 181 (157–189) | 189 → 187 (163–192) | 200 → 194 (185–195) |
| Wavefront | 77 → 136 (108–158) | 129 → 155 (130–175) | 158 → 173 (159–185) | 168 → 186 (169–191) | 184 → 191 (187–196) | 186 → 194 (188–198) | 198 → 196 (192–200) |
| Roofbound | 64 → 117 (105–164) | 100 → 167 (42–171) | 138 → 175 (153–181) | 165 → 184 (177–188) | 174 → 189 (184–193) | 194 → 195 (192–197) | 200 → 198 (195–200) |
| Rainbow Bridge | 36 → 28 (14–59) | 38 → 31 (14–56) | 61 → 52 (28–104) | 107 → 110 (55–162) | 173 → 179 (134–191) | 183 → 190 (144–198) | 200 → 200 (200–200) |
| Orbit | 34 → 13 (3–47) | 62 → 51 (14–104) | 92 → 105 (48–152) | 146 → 157 (114–180) | 175 → 183 (166–191) | 179 → 191 (180–195) | 195 → 194 (186–200) |
| Ball Tracker | 47 → 52 (31–61) | 66 → 75 (51–95) | 103 → 137 (100–172) | 132 → 172 (147–188) | 173 → 193 (177–197) | 188 → 198 (190–200) | 199 → 200 (195–200) |

Every game's medians rise weak < average < good < great < near-perfect < elite < flawless. Gaps at the top are 3–8 points: the straight cores are full for
near-perfect play, so the top is separated by the features alone. Wavefront's core is full from the average player up and
Roofbound's (time survived) from the good player up, so their middle runs high. Flawless bot medians below 200 are the
bots' own misses; each game's oracle or built perfect run scores 200 (arcade-standard-check).

### Open items for Joe

- The Jaywalk, Wavefront, Roofbound and Orbit intro demos stay stopped until recorded on the new stamps.
- Jaywalk's in-game ×2–×4 streak pill and "STREAK ×n" pop are unchanged; no multiplier pays on crossRev 10.
- Roofbound: the 10 s survival pause after a checkpoint save is dropped (time survived is literal), so a saved crash costs nothing.
- Ball Tracker (second pass, 30 Oct 2026): btRev 8 deals 299 of the 300 bank courses (`BT_V8_DEAL`, course 56 left out), every one proved to reach 200 by a stronger boosted oracle through the server replay (balltrack-deal-check); the first pass's 11 short courses were its weaker oracle's misses.
- Wavefront deals 5 saucers a run, not 6, so each pays 4.

## Grappler (D): swingRev 15, the swinging course

Grappler's rework (Joe's direction after swingRev 14) scores on the standard: the course 140 (a straight line on the
share of the course's length behind the hero), pars 30 (shared evenly by the stretches, each full at 30 ticks under
par) and gates, gems and stars 30 (2 each for the 5 of each kind); clearing the course pays nothing more; no input 0,
any input at least 1 (`swingScoreV15`, the shared `stdFinal`). The course, its rules, the bots and the skill-band
medians are on its page, [swing.md](swing.md); swing-rework-check proves every older revision replays as before and
every course's own route clears it under par.

**swingRev 16 (1 Nov 2026):** the same parts over a 90 s run on a longer course (42 blocks, six ledge runs) whose ledge
runs go dark (hooks in the dark cannot be grabbed); swing-dark-check proves it, and that swingRev 14 and 15 replay as
before. See [swing.md](swing.md), "swingRev 16".


## Cards & Board: Minesweeper and Mahjong Solitaire (30 Oct 2026)

Two new arcade games, born on the standard (their first revision, `minesRev` 1 and `mahjongRev` 1), dealt in rooms from
the start. Each deals its whole board in the sim from the room seed, proved by the deal itself: Minesweeper's board is
the first the logic solver clears from its opening (no guessing), Mahjong's stack is built backwards so its build order
clears it. cards-board-check replays both proofs through the server to 200 on every tuning and fresh seed.

| Game | Stamp | Core | Features | Cost | Speed full by |
| --- | --- | --- | --- | --- | --- |
| Minesweeper | `minesRev` 1 | Safe squares 150 (share beyond the opening) | No mines hit 20 (the same share, no hit), Speed 30 (cleared) | −5 a mine hit | 50 s (near-perfect median 49.7 s) |
| Mahjong Solitaire | `mahjongRev` 1 | Pairs 150 (share of 36) | No shuffles 20 (the same share, no Shuffle), Speed 30 (cleared) | −5 a Shuffle | 65 s (near-perfect median 65.0 s) |

Medians (tuning seeds 0–59), weak → flawless: Minesweeper 115 / 140.5 / 173.5 / 190.5 / 200 / 200 / 200; Mahjong
103 / 136 / 174 / 189.5 / 199 / 200 / 200. The pages have the tables, the bots and the assumptions.
## The Sports group (30 Oct 2026): Home Run Derby, Free Kick, Racing

Three new arcade games, born on the standard at stamp 1 (no older revision to replay). Each deals a seed from its own
proved deal (`src/lib/duel/<game>Deal.server.ts`: 300 seeds, each taken to exactly 200 by the game's oracle,
`scripts/<game>-oracle.ts`, through the server replay; any seed it could not take to 200 was dropped). Each has its own
`<game>-check` (`CHECKS_FULL=1` re-proves all 300 seeds) and an arcade-standard-check entry.

| Game | Stamp | Core | Features | Sum |
| --- | --- | --- | --- | --- |
| Home Run Derby | `homerunRev` 1 | 130, distance (13 a pitch, full at 450 ft) | home runs 50 (5 each), sign hits 20 (5 each of 4) | 200 |
| Top Bins | `freekickRev` 3 | 130, 10 a goal + up to 3 placement, full at 1,100 units (rev 1–2: 1,300) | targets 40 (10 each of 4), curled round the wall 20 (2 a goal), five in a row 10 | 200 |
| Racing | `racingRev` 1 | 140, distance (full at two laps) | clean sectors 30 (8 passes), finish 10, speed 20 (full by par 80.8 s) | 200 |

Medians, weak → flawless (each game's `bun scripts/<game>-bands.ts`, room seeds 0–59 on the dealt seeds):

| Game | Weak | Average | Good | Great | Near | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home Run Derby | 46 | 71 | 114 | 163 | 190 | 197 | 200 |
| Free Kick | 23 | 36 | 66 | 102 | 148 | 165 | 200 |
| Racing | 131 | 155 | 182 | 192.5 | 198 | 200 | 200 |
## Cards & Board: FreeCell, TriPeaks, Poker Squares (30 Oct 2026)

Three new Arcade games, born on the standard at revision 1 (LIVE_BANDS marks them `born`: no score-band history).

| Game | Stamp | Core | Features | Sum |
| --- | --- | --- | --- | --- |
| FreeCell | `freecellRev` 1 | 140, cards home (full) and in sorted runs (half), full at all 52 home | par moves 30, speed 30 (finished; full by 66 s) | 200 |
| TriPeaks | `tripeaksRev` 1 | 120, share of the 28 peak cards cleared (60 s run) | peak tops 30, longest run 20, clear 10, speed 20 (full by 27 s) | 200 |
| Poker Squares | `pokerSquaresRev` 1 | 160, hand points, full at 68 (the near-perfect median) | made hands 40 (4 a line) | 200 |

31 Oct 2026: renamed Free Cell, Summit and Full House (ids unchanged). Free Cell `freecellRev` 2 adds Undo and Reset
(each a move for par; same parts, speed still full by 66 s). Full House `pokerSquaresRev` 2 is full at 73 hand points,
the elite median (rev 1's 68 was the near-perfect median). New: **Five Hands** (`fivehands`, `fiveHandsRev` 1): five
rows built a card a turn under even filling, a discard each turn; hand points 160 (full at 23, the elite median) + made
hands 40 (8 a row) = 200; every dealt deck carries a witness arrangement that reaches 200.

Speed's "full by" times are the near-perfect bots' median finish (`bun scripts/cards-bands.ts`). cards-check proves
every dealt deal reaches 200 through the server's replay.

## Blockfall and Alley Roll (1 Nov 2026)

Two new Arcade games, born on the standard at revision 1 (LIVE_BANDS marks them `born`).

| Game | Stamp | Core | Features | Sum |
| --- | --- | --- | --- | --- |
| Blockfall (Retro) | `blockfallRev` 1 | 140, lines, full at 33 (the elite median) | multi-line clears 40 (4 / 8 / 12 for two / three / four at once), low stack 20 | 200 |
| Alley Roll (Sports) | `alleyRollRev` 1 | 150, ring points, full at 540 (the elite median) | 100 pockets 30 (10 each), hot streak 20 (4 a ball) | 200 |

Medians weak → flawless: Blockfall 21 / 40 / 91 / 137 / 174 / 200 / 200, Alley Roll 41 / 52 / 66 / 119 / 177 / 200 /
200 (room seeds 0–59). Each page says why the core is full at the elite median (the near-perfect one left the top three
levels level at 200).

## The 1 Nov 2026 tuning: Cue Ball, Free Cell, Five Hands

Each on a new stamp one above its live one; older stamps replay and score as before (`scripts/fixtures/tuning-nov1-legacy.json`,
recorded on main by `scripts/tuning-nov1-legacy-record.ts`).

| Game | Stamp | Parts (max) | Core full at |
| --- | --- | --- | --- |
| Cue Ball | `poolRev` 3 | Spots 140, Black 10, Pots in a row 30, Speed 20 (full by 73 s); fouls −10 | all 7 spots |
| Free Cell | `freecellRev` 3 | Cards 140, Par moves 30, Speed 30 | 54 units (rev 2: 104), the near-perfect median at 60 s |
| Five Hands | `fiveHandsRev` 2 | Hand points 200 (one part; pair 5 … straight flush 75) | 49 hand points |

Cue Ball poolRev 3: 25 % harder top speed, 1.75× follow, draw and side, a shot touching no ball a foul, its own proved
bank (`poolBankV3.server.ts`). See each game's page.

## Ricochet, the ninja wall-climb (1 Nov 2026)

Ricochet (`ricochet`) is back from retirement under its own id on **`ricoRev` 2**, born on the standard: height climbed
130 on a straight line (full at 241 m, the near-perfect median), coins 30 (shared across 60), gold lanterns 20 (2 each
of 10), scrolls 20 (5 each of 4) = 200. Unstamped Ricochet rounds keep the old ball-and-spikes shaft and its 150-point
score exactly. Every tower is dealt in the sim with a witness route proved through the real step (all 74 items, no
hit, at least 241 m), so a perfect run reaches 200 on every tower. [ricochet.md](ricochet.md) has the rules, the
bands and the decisions.

1 Nov 2026: three more, born on the standard at revision 1, with Undo and Reset like Free Cell and Mahjong:
**Pyramid** (`pyramidRev` 1, 90 s, one pass: pyramid cards 120, cleared 10, speed 50 full by 20 s, pyramid pairs 20;
deals built so no quick player with no plan clears them), **Golf Solitaire** (`golfsol`, `golfSolRev` 1, 75 s: cards
140, all cleared 20, speed 20 full by 15 s, runs of four 20; a bank a strong human line clears) and **Muggins**
(`mugginsRev` 1, 90 s solo dominoes: points 150 full at 55, hand cleared 20, speed 20 full by 19 s, big plays 10; a draw
is final and only the pile's next tile is face up). cards-solitaire-check proves every dealt deal reaches 200 through the server's
replay. Muggins is practice only since 2 Nov 2026 (Joe's decision: its good, great and near-perfect medians, 146, 141
and 141, don't rise with skill); stored rounds replay and grade as before.

