# Partial-credit fixes (7 Nov 2026)

From the scoring audit (`docs/audit-nov-2026/scoring.md`), issues 1, 3 and 4. Puzzles only. Each game moves up one
stamp above the one rooms dealt. Older rounds replay and score exactly as before. `partial-credit-check` proves this on
917 grades recorded on main cc8e1643 (`scripts/fixtures/partial-credit-legacy.json.gz`, `scripts/partial-credit-record.ts`).

Code: `src/lib/duel/partialCredit.ts`, which holds the stamps, `dealPartialCredit` (the last step of `generatePuzzle`),
`pinPrePartialCredit` and the reveal note. The graders are in `standard/logic.server.ts`, `standard/pattern.server.ts`
and `standard/number.server.ts`. Gradient's swap limit is in `jumbled.ts`.

| Game | Stamp | What changed |
|---|---|---|
| Blackout | `depthRev 3` | Unfinished score = 130 × the solver-distance share |
| Hanoi | `depthRev 3` | Same |
| Polypotions | `depthRev 3` | Same |
| Gridlock | `unblockRev 3` | Same |
| Turntable | `ringsRev 4` | Same |
| Exact | `depthRev 4` | Unfinished score = 130 × the share of a solution built, or the old closeness curve, whichever is more |
| Gradient | `tilesRev 7` | A swap limit (1.5 × par, rounded up, stored as `swapLimit` and shown as "Left n"). Unfinished score = 130 × the swap-minimum share |

The finish (150 + speed + bonus) is unchanged on all seven, so 200 is still reachable. An unfinished round's breakdown is
still one part ("58 for progress"), so it adds up. The reveal adds what the credit counted: "45 % of the way", or for
Exact "50 % of a solution built" or "closest 12 away".

## How each share is measured

- **Solver-distance share**, used by Blackout, Hanoi, Polypotions, Gridlock and Turntable:
  - Find the best board the player stood on (Undo and Reset never take progress back).
  - Work out how much closer that board is to solved, in the fewest moves the stored minimum counts.
  - Divide by that minimum.
  - Each move that brought the board no closer cancels one that did. For Turntable it cancels 0.3 of one, and for
    Polypotions it cancels 3.
  - This is the measure the stamps before the scoring standard used (`puzzleProgress.ts`, `solverProgress.server.ts`).
  - It can only rise along the optimal line. The standard's rough counts (rings home, flasks corked, lights off, blocks
    cleared, segments placed) could fall along it.
  - The standard's "how early" extras are dropped on these stamps, so the score is in proportion to the share.
- **Exact:**
  - Count the fewest numbers on the board that an exact answer still needs (`exactNumbersNeeded`).
  - Each step that joins two numbers a solution needs brings that count one closer to one. For a 5-number solution,
    each step is a quarter of the way.
  - Steps on the board that brought it no closer cancel one each, so random chains earn about 0.
  - The closeness curve (129 × 0.93^distance) still applies when it pays more.
- **Gradient:**
  - Swaps past the limit don't happen. The phone stops taking swaps at the limit and sends the board.
  - The unfinished share is the swap minimum (`gradientMinimum`, exact) closed by the best board.
  - Each swap that brought the board no closer cancels half a swap's worth. At a weight of 1, a sloppy player's median
    fell to 33; at 0.25, random swapping's 90th percentile rose to 33.

## Before and after

Measured with `bun scripts/partial-credit-bands.ts --seeds=30` (room seeds 6100 + 7k). Gradient uses its own route
players, the same as standard-pattern-check's, plus random swapping at two swaps a second. The other games use the kit
players.

The optimal-line figures come from each prefix of a flawless player's line, graded at the buzzer. They are given as
min–median–max.

**Optimal line** (min–median–max at a quarter / a half / three quarters of the way; lines that ever dip; the median at 45 %):

| Game | Before | Dips before | 45 % before | After | Dips after | 45 % after |
|---|---|---|---|---|---|---|
| Blackout | 0–9–60 / 0–20–83 / 11–51–96 | 15 of 30 (worst 30) | 16 | 29–33–39 / 65–65–72 / 95–98–104 | 0 | 65 |
| Hanoi | 0–0–22 / 14–26–57 / 26–51–74 | 0 | 22 | 31–34–35 / 65–67–68 / 96–98–100 | 0 | 59 |
| Polypotions | 0–0–16 / 0–16–32 / 32–48–64 | 0 | 16 | 31–33–35 / 65–65–68 / 96–98–100 | 0 | 60 |
| Gridlock | 0–22–65 / 0–37–74 / 0–64–90 | 0 | 32 | 31–35–36 / 65–65–69 / 95–98–101 | 0 | 59 |
| Turntable | 0–0–65 / 0–29–86 / 0–60–96 | 24 of 30 (worst 45) | 29 | 33–37–37 / 65–74–74 / 93–93–98 | 0 | 56 |
| Exact | 0–0–104 / 0–0–104 / 0–38–120 | 0 | 0 | 33–33–104 / 65–65–104 / 98–98–120 | 0 | 65 |
| Gradient | 26–26–43 / 51–60–69 / 77–94–94 | 0 | 52 | 30–33–37 / 65–65–71 / 95–100–102 | 0 | 56 |

**Kit medians** (nothing / spam / average / good / great / near-perfect; Gradient: random swapping, then average to near-perfect):

| Game | Before | After |
|---|---|---|
| Blackout | 0 / 0 / 24 / 169 / 182 / 194 | 0 / 0 / 33 / 169 / 182 / 194 |
| Hanoi | 0 / 0 / 41 / 176 / 195 / 200 | 0 / 0 / 63 / 176 / 195 / 200 |
| Polypotions | 0 / 0 / 31 / 177 / 195 / 200 | 0 / 0 / 40 / 177 / 195 / 200 |
| Gridlock | 0 / 0 / 53 / 186 / 199 / 200 | 0 / 0 / 57 / 186 / 199 / 200 |
| Turntable | 0 / 0 / 62 / 198 / 200 / 200 | 0 / 0 / 99 / 198 / 200 / 200 |
| Exact | 0 / 0 / 170 (p10 0) / 197 / 200 / 200 | 0 / 0 (p90 1) / 170 (p10 78) / 197 / 200 / 200 |
| Gradient | random **185** / 66 / 174 / 188 / 197 | random **0** / 60 / 174 / 188 / 197 |

Every median rises with skill, and random play stays at 0. Exact's spam is 0 except a lucky one-step merge: "multiply the two biggest" now scores 33 on some seeds where that product is part of a 4-number solution. Gradient's average route player falls from 66 to 60: it wastes swaps, and some runs hit the limit. Its unfinished credit now counts those wasted swaps against it, where the old credit counted the tiles that random luck locked home.

## Texts

- **Help:**
  - The "Not finished" line now says the credit counts in proportion: the presses, moves, pours, turns or swaps still
    needed, less wasted ones.
  - For Exact, it names the solution built.
  - For Gradient, it states the swap limit, and How gains "Swaps are limited: the Left counter shows how many remain;
    out of swaps, the board ends."
- **Intro:**
  - "…; partway counts. Bonuses for speed and fewest …"
  - Gradient: "Place every tile before the swaps run out; …"
- **Reveal:** the progress note beside the score line.

Checks written for the standard's stamps (standard-logic-check, standard-number-check, standard-pattern-check) pin new
deals with `pinPrePartialCredit(true)`, as earlier batches did. Their assertions are unchanged.
