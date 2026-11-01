# Golf Solitaire on the arcade scoring standard (golfSolRev 1, 1 Nov 2026)

A new Arcade game in the Cards & Board group, born on the standard: `golfsol` (id chosen because `golfRev` is Crazy
Golf's stamp), a **75 s** run (78 s round clock; the brief allowed 60–90 s). Sim `src/lib/arcade/cards/golfSol.ts`, art
`golfSol.renderer.ts` (Free Cell's deck and blue felt), stage `src/puzzles/golfSol.tsx`, replay `replayGolfSolRun`.

## Rules

- Seven columns of five cards, all face up (35), and a 16-card stock whose first card starts the one foundation pile.
- Tap a column (or drag its bottom card onto the foundation) to play its exposed card when it is one higher or lower
  than the foundation's top. Suits don't matter; no wrapping (nothing between a King and an Ace).
- Tap the stock when stuck: its next card becomes the foundation's top (and ends the current run).
- **Undo** (kind 3) and **Reset** (kind 4) as Pyramid's: positions restored with the run counters; the clock runs on.
- The round ends with all 35 cleared, at the buzzer, or with the stock empty and nothing playable.

## The deal and the proof of 200

A bank of 300 deal seeds (`src/lib/arcade/cards/golfSolDeals.data.ts`, `bun scripts/golfsol-bank.ts [--check]`):
seeds 1, 2, 3, … kept only when the solver (`scripts/cards/golfSolSolver.ts`, depth first with memoised positions and a
bound on the runs still possible) finds a line clearing all 35 with five runs of five; 4,363 seeds were left out (about
one shuffle in 16 qualifies; about one in five clears at all). The lines are `scripts/fixtures/golfsol-solutions.json`
(checks and bots only, never shipped). Rooms deal a bank index. cards-solitaire-check replays all 300 lines through the
server's replay to exactly 200; `CHECKS_FULL=1` rebuilds the bank byte for byte (~10 min).

## Scoring (200)

| Part | Max | How |
| --- | --- | --- |
| Cards cleared | 140 | a straight line over the 35 tableau cards |
| All cleared | 20 | all 35 cleared |
| Speed | 20 | cleared only: full by 28 s (the near-perfect median clear, 27.7 s), 0 at the buzzer |
| Runs | 20 | 4 for each run of five or more tableau cards without drawing, up to 5 (counted when a run reaches five) |

## Skill bands (`bun scripts/cards-bands.ts golfsol --seeds=100`)

| Level | Median | p10–p90 | Cleared | Clear time (median) |
| --- | --- | --- | --- | --- |
| Weak | 108 | 88–124 | 0/100 | — |
| Average | 132 | 100–148 | 6/100 | 68.9 s |
| Good | 132 | 92–148 | 1/100 | 46.6 s |
| Great | 136 | 108–152 | 9/100 | 33.9 s |
| Near-perfect | 140 | 116–192 | 32/100 | 27.7 s |
| Elite | 148 | 116–200 | 46/100 | 22.6 s |
| Flawless | 200 | 200–200 | 100/100 | 13.8 s |

Golf is a hard patience (most deals need planning across draws); below near-perfect the bots look 1–5 plays ahead
(`scripts/arcade-skill-bands/bots/golfsol.ts`); near-perfect and elite search the deal within a human-sized budget
(5,000 and 15,000 positions). Good and average tie at the median (132).
