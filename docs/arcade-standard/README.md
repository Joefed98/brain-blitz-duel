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
`scripts/arcade-standard/entry.ts`). `STANDARD_ROSTER` in the check lists all 21 games; once rooms deal a game's
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
| Gemstone | `matchup` | `matchupRev` 11 | A | [matchup.md](matchup.md) |
| Meteor | `snake` | `snakeRev` 11 | A | [snake.md](snake.md) |
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
| Roofbound | `flip` | `flipRev` 10 | C | [flip.md](flip.md) |
| Rainbow Bridge | `inkbridge` | `inkRev` 12 | C | [inkbridge.md](inkbridge.md) |
| Orbit | `orbit` | `orbitRev` 13 | C | [orbit.md](orbit.md) |
| Ball Tracker | `balltrack` | `btRev` 8 | C | [balltrack.md](balltrack.md) |
| Grappler | `swing` | `swingRev` 15 | D | [swing.md](swing.md) |

The batches land one at a time on top of this; each adds its games' entries, pages and its summary section below.
