# Depth batch 4: Pattern / Logic to 200 (25 Oct 2026)

Eight games raise their round maximum from 150 to 200 (`ROUND_MAX`, docs/scoring-200.md), each under a new
version stamp. Rounds dealt before this change carry no stamp and play and score exactly as before (proved by
depth4-check against 1,440 rounds recorded on main).

| Game | Type | Route | Stamp | What is new |
| --- | --- | --- | --- | --- |
| Gridlock | `unblock` | FEATURE | `unblockRev 1` | par moves (the solver's minimum), shown as "Moves n · Par p" |
| Tessellate | `blockparty` | STRETCH | `blockRev 1` | a 7×7 board: sixteen pegs, nine pieces (a Plus for the Dot), 33 cells to fill (from 29) |
| Pipeline | `pipes` | STRETCH + par turns | `pipesRev 1` | par turns (fewest taps to the stored solution); the answer carries the tap log |
| Chroma Lines | `flow` | STRETCH | `flowRev 1` | the curve only (the board is unchanged) |
| Skid | `iceslide` | FEATURE | `slideRev 1` | ice gems off the shortest route |
| Heave | `push` | FEATURE | `pushRev 1` | a gold crate and its gold mark; a bigger warehouse with five crates |
| Lightbender | `laser` | STRETCH + elegant beam | `laserRev 1` | two spare mirrors; an elegant beam lights every gem with no more mirrors than the solution needs |
| Turntable | `rings` | STRETCH + par turns | `ringsRev 1` | par turns; every round's link pattern has two rules on the legend, never one |

## Where it lives

| File | What |
| --- | --- |
| `src/lib/duel/depth4/stamps.ts` | the eight stamp fields, `isDepth4`, `d4RevOf` |
| `src/lib/duel/depth4/score.ts` | the 200-point finish on top of rev 3 (`d4Finish`), each game's stretch / feature split and elite share (`D4_GAMES`), `parShare` |
| `src/lib/duel/depth4/grade.server.ts` | `withDepth4`: the rev-3 grade plus stretch and feature, the par steps (`D4_PAR_STEP`), Tessellate's progress |
| `src/lib/duel/depth4/deal.server.ts` | `dealDepth4`: the new deals (called first by `generatePuzzle`); `pinDepth4Off` for old-rule checks |
| `src/lib/duel/depth4/pipesTaps.ts` | Pipeline's tap-log answer and par turns (phone and server) |
| `src/lib/duel/depth4/iceGems.ts`, `gems.server.ts` | Skid's gem replay (phone and server) and gem placement / gem routes (server) |
| `src/lib/duel/depth4/pushD4*.ts` | Heave's bank (`scripts/depth4-push-bank.ts`, seeded) and draw |
| `src/lib/duel/depth4/blockD4*.ts` | Tessellate's 7×7 solver, generator and 1,000-board bank (`scripts/depth4-block-bank.ts`, seeded, rebuilds byte for byte) |
| `src/lib/duel/depth4/text.ts` | intro SCORE lines and "?" help (with `{max}`) |
| `src/components/puzzles/depth4/` | the par meter (`ParMeter.tsx`), Skid's gems (`IceGems.tsx`), `depth4.css` |
| `scripts/depth4-check.ts` | the check (below) |
| `scripts/depth4-tune.ts`, `scripts/depth4/players.ts` | the tuning table (simulated players, old versus new) |
| `scripts/depth4-record.ts`, `scripts/fixtures/depth4-legacy.json.gz` | the legacy fixture, recorded on main 37aab99 |

Hooks in shared files are one line each: `generate.server.ts` (`dealDepth4` first in `generateUnstamped`;
`withDepth4` round the rev-3 grade), `roundMax.ts` (eight lines to 200), `grade.ts` (each game's case stores its
facts under the stamp: par, turns, gems, the gold crate, the solving shot's mirrors, Tessellate's geometry),
`introDemo.functions.ts` (older demos stopped), `instructions.ts` / `introScore.ts` (the eight texts),
`progressFigures.ts` (Tessellate's geometry), `types.ts` (the new optional fields), `GameFrame.tsx` (Tessellate's goal line "Fit every piece", true of both boards).

## Scoring

Everything starts from today's rev-3 grade (`puzzleScoreRev3.ts`): an unfinished round and a finish up to 150
score exactly as today.

    finished = rev-3 finish (120 + up to 30 for speed, cut by mistakes)
             + stretch: up to S × s × efficiency²,  s = 0 at the game's fast share (today's 150 pace),
                                                    rising evenly to 1 at its elite share of the clock left
             + feature: the feature's share × (B × (0.3 + 0.7 × min(1, time left ÷ fast share))
                                                + (F − B) × s)     (B = F where the game sets no base)

| Game | Stretch S | Feature F | Base B (at 150 pace) | Fast share (rev 3) | Elite share | Feature share |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Gridlock | 0 | 50 | 25 | 0.68 | 0.78 | 1 at or under par, an eighth less per move over |
| Skid | 0 | 50 | 30 (10 a gem) | 0.63 | 0.69 | gems collected ÷ gems |
| Heave | 0 | 50 | 15 | 0.64 | 0.70 | 1 when the gold crate ends on the gold mark |
| Tessellate | 50 | 0 | – | 0.59 | 0.72 | – |
| Chroma Lines | 50 | 0 | – | 0.61 | 0.75 | – |
| Pipeline | 25 | 25 | 25 | 0.49 | 0.66 | 1 at or under par turns, a tenth less per tap over |
| Lightbender | 25 | 25 | 25 | 0.63 | 0.75 | 1 with no more mirrors than par, half less per extra mirror |
| Turntable | 25 | 25 | 25 | 0.75 | 0.86 | 1 at or under par, a third less per turn over |

- FEATURE games put all 50 on the feature, so the extra is reachable only through it. Since the pre-merge review
  (26 Oct 2026) only a fixed base B is paid at today's 150 pace; the rest of the feature is paid on the elite stretch,
  so a near-perfect player with the feature lands about 165–175 and only elite pace reaches 190–200.
- Skid's gems are not wasted moves: a finish's efficiency is measured against the fewest slides that collect the
  gems it collected (`gemMinMoves`), not the bare minimum.
- The reveal's breakdown adds up to the score: "120 + 50 par + 30 speed" (the stretch is part of the speed figure).

## Tuning table

**Gridlock retune (merge, 26 Oct 2026; unblockRev 1 is not live, so the stamp is kept).** The near-perfect players find a
fewest-moves plan only a quarter of the time and otherwise finish 2–6 moves over par, where a third less per move paid
nothing, so near-perfect sat at today's 150. The fixed part at today's 150 pace is now 25 (from 15) and each move over
par costs an eighth of the par bonus (from a third; nothing from 8 over): good 130 → 139 (+7 %), near-perfect 165 (top
10 % 179), elite 198. The rest of the 50 is still paid only on the elite stretch.

Simulated players (the fairness kits at the audit's four levels plus an elite level: pace 0.32, 0.4 % mistakes),
60 room seeds a game, every answer graded by `gradeAnswer`. "Old" is the same seed dealt on the old stamps.
`bun scripts/depth4-tune.ts --seeds=60` reproduces it.

| Game | Level | Old median | Old top 10 % | Old best | New median | New top 10 % | New best | Solved old → new |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Gridlock | average | 47 | 76 | 123 | 47 | 76 | 128 | 3 % → 3 % |
| Gridlock | good | 130 | 136 | 143 | 139 | 147 | 152 | 77 % → 77 % |
| Gridlock | great | 139 | 146 | 149 | 152 | 161 | 167 | 100 % → 100 % |
| Gridlock | near | 148 | 150 | 150 | 165 | 179 | 194 | 100 % → 100 % |
| Gridlock | elite | 150 | 150 | 150 | 198 | 200 | 200 | 100 % → 100 % |
| Tessellate | average | 69 | 83 | 83 | 69 | 83 | 96 | 0 % → 0 % |
| Tessellate | good | 125 | 130 | 132 | 125 | 130 | 132 | 73 % → 72 % |
| Tessellate | great | 137 | 142 | 148 | 137 | 142 | 148 | 100 % → 100 % |
| Tessellate | near | 149 | 150 | 150 | 149 | 167 | 173 | 100 % → 100 % |
| Tessellate | elite | 150 | 150 | 150 | 199 | 200 | 200 | 100 % → 100 % |
| Pipeline | average | 51 | 59 | 67 | 51 | 59 | 67 | 0 % → 0 % |
| Pipeline | good | 125 | 128 | 129 | 127 | 134 | 139 | 88 % → 88 % |
| Pipeline | great | 139 | 141 | 143 | 148 | 154 | 161 | 100 % → 100 % |
| Pipeline | near | 149 | 150 | 150 | 161 | 171 | 176 | 100 % → 100 % |
| Pipeline | elite | 150 | 150 | 150 | 191 | 195 | 196 | 100 % → 100 % |
| Chroma Lines | average | 79 | 98 | 108 | 79 | 98 | 108 | 0 % → 0 % |
| Chroma Lines | good | 129 | 136 | 142 | 129 | 136 | 142 | 95 % → 95 % |
| Chroma Lines | great | 141 | 145 | 148 | 141 | 145 | 148 | 100 % → 100 % |
| Chroma Lines | near | 150 | 150 | 150 | 152 | 166 | 188 | 100 % → 100 % |
| Chroma Lines | elite | 150 | 150 | 150 | 198 | 200 | 200 | 100 % → 100 % |
| Skid | average | 65 | 78 | 91 | 58 | 78 | 91 | 0 % → 0 % |
| Skid | good | 124 | 132 | 137 | 120 | 132 | 144 | 70 % → 53 % |
| Skid | great | 138 | 143 | 146 | 142 | 155 | 167 | 100 % → 97 % |
| Skid | near | 148 | 150 | 150 | 167 | 174 | 178 | 100 % → 100 % |
| Skid | elite | 150 | 150 | 150 | 192 | 200 | 200 | 100 % → 100 % |
| Heave | average | 74 | 121 | 127 | 68 | 87 | 103 | 12 % → 0 % |
| Heave | good | 133 | 142 | 144 | 132 | 141 | 146 | 95 % → 82 % |
| Heave | great | 144 | 148 | 150 | 148 | 157 | 161 | 100 % → 100 % |
| Heave | near | 150 | 150 | 150 | 162 | 174 | 195 | 100 % → 100 % |
| Heave | elite | 150 | 150 | 150 | 190 | 200 | 200 | 100 % → 100 % |
| Lightbender | average | 14 | 69 | 89 | 14 | 69 | 89 | 0 % → 0 % |
| Lightbender | good | 124 | 133 | 140 | 130 | 138 | 159 | 77 % → 77 % |
| Lightbender | great | 138 | 144 | 148 | 143 | 156 | 166 | 100 % → 100 % |
| Lightbender | near | 149 | 150 | 150 | 161 | 175 | 189 | 100 % → 100 % |
| Lightbender | elite | 150 | 150 | 150 | 192 | 200 | 200 | 100 % → 100 % |
| Turntable | average | 73 | 126 | 132 | 73 | 131 | 140 | 28 % → 30 % |
| Turntable | good | 135 | 142 | 145 | 140 | 148 | 164 | 98 % → 98 % |
| Turntable | great | 143 | 147 | 149 | 149 | 167 | 173 | 100 % → 100 % |
| Turntable | near | 150 | 150 | 150 | 161 | 177 | 188 | 100 % → 100 % |
| Turntable | elite | 150 | 150 | 150 | 192 | 200 | 200 | 100 % → 100 % |

Assumptions in the players (scripts/depth4/players.ts), for Joe's beta data to tune:

- The kits replay the stored minimum, which no player is handed, so each level finds a fewest-moves plan
  (Gridlock, Turntable, Pipeline par; Lightbender's fewest mirrors) with a fixed chance: average 2 %, good 8 %,
  great 15 %, near-perfect 25 %, elite 85 %; otherwise it finishes a few steps over (Gridlock 2–6 moves, Turntable
  1–4 turns, Pipeline 2–12 taps, Lightbender 1–2 mirrors).
- Each level goes for Heave's gold crate and Skid's gems with a fixed chance: 25 / 45 / 65 / 85 / 100 %. A Skid
  player who goes for the gems plays the shortest route that collects them all (`gemRoute`).
- Tessellate's player places a piece every 5.5 s at good pace (the audit's figure), so one more piece costs time.

## Bigger boards

The request assumed smaller boards than the game has today:

- **Gridlock** is already 7×7 (`UNBLOCK_COLS = 7`, the bank and the `unblock_bank` table since Oct 2026): kept.
- **Chroma Lines** is already 9×9 (`FLOW_COLS = 9`, 10–12 pairs), bigger than the 8×8 asked for; 10×10 would make
  cells about 36 px at 375 px: kept.
- **Skid** is already 12×12 with its border (a 10×10 ice field), the size asked for: kept, the gems placed on it.
- **Heave** stays on its 9×9 grid (the border is wall; 10×10 would make cells about 36 px at 375 px). The warehouse
  is bigger inside: 4–9 inner walls (from 5–12), so more floor, and five crates (from four or five), 18–27 pushes,
  every crate pushed at least three times, the detour rule kept. 120 layouts, seeded.
- **Tessellate** grows to 7×7 (49 cells, from 36) with nine pieces covering 33 cells (from 29): the 6×6 set with the
  Dot swapped for a Plus, sixteen pegs, 5–60 solutions, the same band as the 6×6 board. Keeping nine pieces keeps the
  round's pace (a first version with ten pieces cost good players 12 %); the tray is unchanged, so the board keeps its
  size; its board is 406 px at 414×896 and 367 px at 375×667 (frame-probe), so cells are about 58 and 52 px.

Round lengths are unchanged. Every new board is solver-verified: Gridlock's par by breadth-first search
(depth4-check re-solves a sample), Turntable's by the exact 8⁵ search, Heave's by the backward search (depth = minimum
pushes), Tessellate's by the exact-cover count, Skid's gem route by a search over (state, gems).

## Known costs

- **Heave**: five crates on a bigger floor take longer; the good player's median holds but fewer finish.
- **Tessellate**: the near-perfect median stays about 150 (a stretch game: the stretch pays only above the fast share).

## Intro demos

Every one of the eight intros shows its still until a demo is recorded on the new stamp
(`introDemo.functions.ts` drops a stored demo whose puzzle lacks the stamp). **All eight demos need re-recording.**
The banked games' fixed intro examples (Chroma Lines, Skid, Tessellate) stay the old stored boards (the bank
checks prove them); the screenshot tool's example mode therefore shows those three on the old rules.

## Sounds

No audio files were added. A collected gem and the gold crate reaching its mark play the shared `correct`
(`playCorrect`, through the sound system: mute and the Effects slider apply); the gem also flashes the toolkit's
right-move ring. Reduced motion: the gem pop and par-meter fill transition are off; reduced effects: no glows.

## Checks

depth4-check (new, ~1 min) proves old rounds, the new deals, the banks, 200 reachable, the breakdowns and the phone /
server parity. Updated for the new stamps: round-max-check (a `RAISED` list), scoring-rev3-check and
scoring-bands-check (these eight games' texts are depth4/text.ts's), stage-state-reload-check (Pipeline's draft
carries the tap log), puzzle-fairness/run.ts (the rev-1 shape's checks also pin the old deals).

## Shared requests

- The par meter (`src/components/puzzles/depth4/ParMeter.tsx`) could move to the toolkit for other par games.
- `round-max-check` keeps a `RAISED` list that each expansion extends; a merge of two expansion PRs touches the same
  lines.
