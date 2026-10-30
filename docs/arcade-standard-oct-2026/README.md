# Arcade scoring standard, batch A (29 Oct 2026)

Seven arcade games score in fixed parts that sum to exactly 200, each on a new stamp one above its live one. Older
stamps replay and score exactly as before (each game's `<game>-standard-check`, on fixtures recorded on main 73f6bb7).
`scripts/arcade-standard/<type>.ts` holds each game's parts; `arcade-standard-check` proves the sum and a perfect 200.

The standard: core pays the game's main measure on a straight line; features pay fixed amounts; no curves, knots or
rising scales; speed only on a completed run; any played run scores at least 1; every player in a room plays the
identical seeded run. Per-game detail, rules and assumptions are in this folder (`<type>.md`).

## Parts

| Game | Stamp | Core | Features | Sum |
| --- | --- | --- | --- | --- |
| Slice | `sliceRev` 11 | 120, share of all food sliced | combo 40, golden fruit 20, tickets 10, dodges 10; chilli −10 | 200 |
| Breaker | `brkRev` 11 | 140, share of all 108 bricks | clear 10, speed 20 (full with half the clock left), gold bricks 30 | 200 |
| Tilt | `tiltRev` 10 | 140, 35 a maze (30 finish + 5 progress), 4 mazes | all four 10, speed 20 (full by 75 s), gold stars 30 | 200 |
| Fission | `burstRev` 10 | 140, share of all 87 atoms (splits count) | wave clears 35 (7 × 5), golden atoms 25; a lost life −5 | 200 |
| Gemstone | `matchupRev` 11 | 110, gems cleared, full at 375 | treasure 40 (10 × 4), goals 30, ice 10, big lines 10 | 200 |
| Meteor | `snakeRev` 11 | 120, stars eaten, full at 27 | gold stars 40, combos 20, lane rides 10, warp stars 10 | 200 |
| Hover | `hoverRev` 10 | 120, barriers passed (42) | star chains 30, gold stars 20, tight gates 20, centre line 10 | 200 |

Core targets measured with the skill-band tool: Gemstone 375 gems (near-flawless median 376); Meteor 27 stars (great's
median was 22, so the safeguard raised it to near-flawless's median). The other five have a fixed maximum.

## Medians, weak → flawless (room seeds 0–29, `arcade-skill-bands.ts --rev=now --levels=all`)

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
