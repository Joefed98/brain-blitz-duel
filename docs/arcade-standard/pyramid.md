# Pyramid on the arcade scoring standard (pyramidRev 1, 1 Nov 2026)

A new Arcade game in the Cards & Board group (`src/lib/duel/arcadeGroups.ts`), born on the standard: `pyramid`, a 90 s
run (93 s round clock). Sim `src/lib/arcade/cards/pyramid.ts`, art `pyramid.renderer.ts` (Free Cell's deck and blue
felt), stage `src/puzzles/pyramid.tsx`, replay `replayPyramidRun` (`src/lib/duel/cards.ts`).

## Rules

- A 28-card pyramid (seven rows, the bottom row of seven uncovered; every card face up), a 24-card stock and a waste
  pile. A card is free once both cards covering it are gone.
- Tap two free cards that add to 13 (Q+A, J+2, 10+3, 9+4, 8+5, 7+6) to remove them; a King goes alone with one tap. The
  waste's top card pairs too (pyramid + waste, or a King on the waste).
- Tap the stock to turn a card onto the waste. Three passes: the empty stock turns the waste back over twice.
- A refused pair (not 13) moves the selection to the new card and pulses red; a covered card is refused.
- **Undo** (input kind 3: the position before the last removal, draw or turn, unlimited) and **Reset** (kind 4: the
  deal, itself undoable); both restore the score parts with the cards; the clock runs on.
- The round ends when the pyramid is clear, at the buzzer, or with no pair, no King and no stock left.

## The deal and the proof of 200

Pairs of two pyramid cards worth 20 means a deal must clear with ten of them; a random shuffle allows that about once
in 200 (3,000 shuffles tried: 14), so a seed bank was impractical. `pyBuildDeal(seed)` builds the deal with its line:
free positions are removed in a random legal order as Kings (0–2), exactly ten pyramid pairs and pairs with a stock
card; ranks and suits are drawn to fit (each pair adding to 13); the stock (the waste partners and every card left) is
shuffled; then the witness taps are played through the sim's own rules, drawing and turning the waste as needed. An
attempt that runs into a dead end is rebuilt on the same PRNG stream. So every dealt seed clears with ten pyramid pairs.
The build takes about 1 ms; the deal is cached per seed and RoundIntro builds it while the intro is up.

The solver (`scripts/cards/pyramidSolver.ts`, depth first: Kings at once, pyramid pairs, then waste pairs, then the
stock) independently re-proves sampled deals clearable with ten pyramid pairs (cards-solitaire-check: 24 of them).
cards-solitaire-check replays the witness through the server's replay to exactly 200 on every tuning seed (0–59),
every fresh seed (10000–10199) and 200 room-style seeds; arcade-standard-check replays six more.

## Scoring (200)

| Part | Max | How |
| --- | --- | --- |
| Pyramid cards | 140 | a straight line over the 28 pyramid cards removed |
| Cleared | 20 | all 28 removed |
| Speed | 20 | cleared only: full by 45 s, 0 at the buzzer (Joe's figure) |
| Pyramid pairs | 20 | 2 for each pair of two pyramid cards, up to 10 |

Any played run scores at least 1; no input 0.

## Skill bands (`bun scripts/cards-bands.ts pyramid --seeds=60`)

| Level | Median | p10–p90 | Cleared | Clear time (median) |
| --- | --- | --- | --- | --- |
| Weak | 113 | 82–140 | 0/60 | — |
| Average | 143 | 98–182 | 7/60 | 83.3 s |
| Good | 183 | 114–191 | 42/60 | 73.5 s |
| Great | 191 | 108–198 | 43/60 | 58.4 s |
| Near-perfect | 198 | 108–200 | 45/60 | 41.9 s |
| Elite | 198 | 114–200 | 44/60 | 33.2 s |
| Flawless | 200 | 200–200 | 60/60 | 32.4 s |

The bots (`scripts/arcade-skill-bands/bots/pyramid.ts`) spend 3.2 s (an average player's) spotting a pair adding to 13,
0.45 s on its second tap and 0.7 s on a stock turn, scaled by level; Kings first, pyramid pairs over waste pairs,
valued by what they uncover. Searching the deal (tried for near-perfect and elite) turned the stock more and finished
later than a quick eye, so no level searches. Near-perfect and elite tie at the median: the deals are generous once a
player sees the pairs, and the top separates on speed (full by 45 s) rather than the median.
