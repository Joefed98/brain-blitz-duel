# The arcade scoring standard, batch B (29 Oct 2026)

High Rise, Swish, Flightpath, Pinball, Rally, Coral Pop and Tempo score on one shape, each on a new version stamp one
above its live stamp. Every older round replays and scores exactly as before (each game's `<game>-standard-check`
replays runs recorded on the live stamp before the change). Per-game notes, assumptions and full tables:
`docs/arcade-standard/<type>.md`.

## The shape (`src/lib/arcade/arcadeStandard.ts`)

- **Core**: the game's main measure on a straight line, `max × min(value, fullAt) ÷ fullAt` rounded down
  (`stdLinear`). No curve, knots or rising scale. Where the game has no fixed maximum, `fullAt` is the near-perfect
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

## The games

| Game | Stamp | Core (max, full at) | Features | Play change |
| --- | --- | --- | --- | --- |
| High Rise | `skylineRev` 9 | floors 140, full at 61 (near median) | perfect drops 30 (share of drops, over at least 61), perfect streak 10 (1 per perfect in the best streak), gold blocks 20 (4 each of 5 seeded golds) | 5 seeded gold blocks, one per fifth of blocks 4–60; no multiplier or milestone points |
| Swish | `binRev` 9 | buckets 130 (13 each, +1 a close miss), full at 10 | far buckets 36 (6 each, throws 1–6), hoops 24 (8 each of 3), all ten in 10 | exactly 3 hoops on every seed (rev 8 sometimes dealt fewer) |
| Flightpath | `bullRev` 9 | dart total 150, full at **112** (Joe: 130) | bull streak 30 (as today), dead-centre 20 (shared between the darts whose 10 is the middle ring) | none |
| Pinball | `pinRev` 6 | table points 130, full at 61,000 (near median 60,780) | J-O-U-L-Z 20 (10 a set, up to 2), multiball 20, jackpots 15 (5 each, 3), ramp combos 15 (5 each, 3) | the table's ×2–×5 multiplier and rising combo chain are gone (×1, a flat 1,000 a combo) |
| Rally | `rallyRev` 12 | gold-ball hits 140, full at 23 (near median 22.5) | pink pads 30 (3 each, up to 10), gold targets 30 (5 each of 6); lasting the minute 0 | the spin reversed: a left swipe leaves left and curves back right (mirror for right); losing the blue ball already ended the run |
| Coral Pop | `bubbleRev` 11 | bubbles cleared 120, full at the reef (95) | reef cleared 10, speed 10 (cleared only; full with half the clock left), chests 30 (5 each of 6), bank shots 15 (1 per 2), combos 15 (1 each) | the mine pops only the 4 bubbles nearest where it lands |
| Tempo | `beatRev` 11 | accuracy 130, full at 1,000 per mille (see below) | fever 25 (6/12/18/25 for 1–4 fevers), golden notes 15 (share), double taps 15 (share), Perfect streak 15 (share of the song) | none (fever no longer doubles) |

### Deviations from Joe's rows (decisions for Joe)

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

## Medians, weak → flawless (before = the stamp rooms dealt before, after = the standard stamp)

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

## Intro demos

All seven intro demos stay stopped until re-recorded on the new stamps (each game's `introDemo.functions.ts` guard
plays only a demo recorded on its standard stamp).
