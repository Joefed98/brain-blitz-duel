# Golf Solitaire on the arcade scoring standard (golfSolRev 1, 1 Nov 2026)

A new Arcade game in the Cards & Board group, born on the standard: `golfsol` (id chosen because `golfRev` is Crazy
Golf's stamp), a **75 s** run (78 s round clock; the brief allowed 60–90 s). Sim `src/lib/arcade/cards/golfSol.ts`, art
`golfSol.renderer.ts` (Free Cell's deck and blue felt), stage `src/puzzles/golfSol.tsx`, replay `replayGolfSolRun`.

## Rules

- Seven columns of five cards, all face up (35), and a 16-card stock whose first card starts the one foundation pile.
- Tap a column (or drag its bottom card onto the foundation) to play its exposed card when it is one higher or lower
  than the foundation's top. Suits don't matter; no wrapping (nothing between a King and an Ace).
- Tap the stock when stuck: its next card becomes the foundation's top (and ends the current run).
- **Undo** (kind 3) and **Reset** (kind 4): positions restored with the run counters; the clock runs on.
- The round ends with all 35 cleared, at the buzzer, or with the stock empty and nothing playable.

## The deal and the proof of 200

A bank of 300 deal seeds (`src/lib/arcade/cards/golfSolDeals.data.ts`, `bun scripts/golfsol-bank.ts [--check]`, about
6 s): seeds 1, 2, 3, … kept only when

- a **strong human line** (`scripts/cards/golfSolHuman.ts`: each turn the exposed card starting the longest chain in
  view, six cards deep, ties to the taller column; it never sees the stock) clears all 35, so a clear needs good play,
  not solver-perfect play; and
- the solver (`scripts/cards/golfSolSolver.ts`) finds a line clearing them with five runs of four (the 200 ceiling).

16,959 seeds were left out. The solver's lines are `scripts/fixtures/golfsol-solutions.json` (checks and bots only,
never shipped). cards-solitaire-check replays all 300 through the server's replay to exactly 200 and runs the human line
on every one.

## Scoring (200)

| Part | Max | How |
| --- | --- | --- |
| Cards cleared | 140 | a straight line over the 35 tableau cards |
| All cleared | 20 | all 35 cleared |
| Speed | 20 | cleared only: full by 15 s (the flawless pace), 0 at the buzzer |
| Runs | 20 | 4 for each run of **four** or more tableau cards without drawing, up to 5 (counted when a run reaches four) |

## Skill bands, before → after (`bun scripts/cards-bands.ts golfsol --seeds=60 --from=10000`, fresh seeds)

| Level | Before | After | Cleared after | Clear time after |
| --- | --- | --- | --- | --- |
| Weak | 112 | 116 | 0/60 | — |
| Average | 132 | 140 | 13/60 | 68.7 s |
| Good | 136 | 152 | 27/60 | 51.2 s |
| Great | 136 | 184 | 36/60 | 36.7 s |
| Near-perfect | 144 | 191 | 46/60 | 27.1 s |
| Elite | 184 | 194 | 54/60 | 22.1 s |
| Flawless | 200 | 200 | 60/60 | 13.7 s |

Below near-perfect the bots look 1–5 plays ahead; near-perfect and elite search the deal within human-sized budgets.
Every level now separates. The bottom stays above Joe's 40–70: a weak player still clears about 26 of the 35 cards, and
the core pays for each one.
