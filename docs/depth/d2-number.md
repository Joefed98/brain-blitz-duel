# Depth D2: the Number games to 200 (25 Oct 2026)

Nine Number games now score up to 200 (`ROUND_MAX` in `src/lib/duel/roundMax.ts`). The eight puzzles are dealt
`depthRev 1` (`src/lib/duel/numberDepth.ts`); Tenfall is dealt `tenRev 4` (its own sim; see
`docs/depth/d2-number-tenfall.md`). Every round stored before keeps its stamps and scores exactly as before.

| Game | Route | Stamp | What earns the extra 50 |
| --- | --- | --- | --- |
| Counterweight | Stretch | `depthRev 1` | Finishing faster than today's 150 pace, no mistakes |
| Operator | Stretch | `depthRev 1` | The same |
| Integer Pyramid | Stretch | `depthRev 1` | The same |
| Trail | Stretch | `depthRev 1` | The same |
| Exact | Feature | `depthRev 1` | Elegance: hitting the target with 5 numbers, not all 6 |
| Brimful | Feature | `depthRev 1` | Par pours: a puzzle solved in its fewest moves |
| Checkout | Feature | `depthRev 1`, `checkoutRev 2` | Big finish: checking out on the Bull or a treble |
| Ballpark | Stretch + feature | `depthRev 1` | Bullseye streak (up to 30) and finishing faster (up to 20) |
| Tenfall | Stretch + feature | `tenRev 4` | Gold tens (a gold tile as the tap that hits the target, 5 each, up to 25) and a faster clear (up to 25) |

## How the score works

`depthRev 1` is a layer on top of the grade puzzleScoreRev 3 already gives (Ballpark: rev 2's curve), applied in
`gradeAnswer` (`withNumberDepth`, `src/lib/duel/numberDepth.server.ts`). A round without the stamp is returned as
graded, so stored rounds never change.

- **Unfinished runs** score exactly as before (at most 110). Solid players who don't finish see no change.
- **Stretch** (Counterweight, Operator, Integer Pyramid, Trail): a finish keeps rev 3's
  `120 + 30 × min(1, left ÷ fast) × efficiency`, then adds `50 × x² × efficiency²`, with
  `x = (left − fast) ÷ (elite − fast)` clamped to 0–1. `fast` is rev 3's fast share (unchanged);
  `elite` is the new per-game share fitted on the kit players (see "Tuning"). Convex, so a finish at today's
  150 pace stays 150 and halfway to the elite share is about 162; mistakes cut the stretch twice over (squared),
  so 200 needs a clean, very fast finish.

  | Game | Clock | fast (150) | elite (200) | 150 in about | 200 in about |
  | --- | --- | --- | --- | --- | --- |
  | Counterweight | 120 s | 0.59 | 0.695 | 49 s | 37 s |
  | Operator | 90 s | 0.70 | 0.79 | 27 s | 19 s |
  | Integer Pyramid | 120 s | 0.40 | 0.505 | 72 s | 59 s |
  | Trail | 120 s | 0.66 | 0.765 | 41 s | 28 s |

- **Features** (Exact, Brimful, Checkout): a finish keeps rev 3's 120 + up to 30, then adds
  `50 × feature share × min(1, left ÷ fast)²`. The feature pays in full only with a finish at today's 150
  pace, and a finish without it scores exactly as today. The share is: Exact 1 for five numbers (else 0);
  Brimful the puzzles solved at par out of four; Checkout the boards ended on a big finish out of five.
- **Ballpark**: rev 2's score (≤ 150) + streak (0–30) + speed (0–20). A *bullseye* is a placement within
  0.5 % of exact (half of rev 2's full-points 1 %). Walking the fifteen numbers in order, each bullseye adds the
  current streak length capped at 4 (1, 2, 3, 4, 4, …; a miss resets), so fifteen in a row sum to 54 = the full
  30. Speed: `20 × x² × close share`, `x = (left − 0.5) ÷ (0.81 − 0.5)` (0.5 is rev 1's full-speed point; close =
  within 1 %). Only an all-placed run earns either.
- The breakdown stored on the round adds up to the score: the stretch rides in `speed` ("120 + 62 speed"), a
  feature in the efficiency slot under its own name ("120 + 30 speed + 50 elegance", "par", "big finish",
  "streak"). `extra.depth` keeps the feature's figures (tiles used, par boards, big finishes, streak sum).

## The features

- **Exact, elegance.** Exact's targets always needed five or six numbers (none from four or fewer). On
  `depthRev 1` the generator also requires both a five-number and a six-number answer (`findElegantTarget` in
  `target.ts`), so elegance is always a choice, never the only way; the stored solution is the five-number one
  (the reveal shows "An elegant way (5 numbers)"). In play the live summary shows "✦ 5 numbers = elegant" in place
  of the step count, then "✦ Elegant" or "6 numbers used" once a number is on target; each tile counts the
  starting numbers that fed it (display only; the server counts its own from the steps). Generation: average
  50 ms, worst 352 ms on 40 seeds (was ~40 ms).
- **Brimful, par pours.** Each board's fewest moves is stored publicly as `par` (it was private as `minMoves`).
  The moves row reads "Moves 3 / 12 · Par 4", gold while on par, dim once over; a par solve shows "★ Par" during
  the hold. The reveal marks "★ par" per puzzle.
- **Checkout, big finish** (`checkoutRev 2`). A rules change on the new stamp only: every board may also check
  out on a *big finish*, the Bull (inner, 50), or a treble on a board that finishes on a double. The generator's
  route search, route count and greedy test all count big finishes (`checkoutFinisher`), so the boards stay as
  hard as before. Trebles on the treble-finish board are its normal finish, so there only the Bull is big. The
  rule line reads "Double · ★ Bull/treble · up to 3 darts"; a big finish turns the board's tab to "★" and the
  rule line to "★ Big finish!" during the hold; the reveal marks "★ big finish".
- **Ballpark, bullseye streak.** The exact values stay on the server until the reveal, so the streak is judged
  there (a live judgement would leak positions). In play the live summary shows "◎ Streak bonus"; the reveal marks
  each bullseye "◎" and states "◎ n bullseyes · best streak k".

## Tuning

`bun scripts/number-depth-bands.ts --seeds=30` plays each game on 30 room seeds with the puzzle-fairness kit
players (average, good, great, near-perfect) and an elite player (pace 0.35, no slips; Ballpark's estimates within
0.3 %), on the board rooms dealt before the stamp (old) and the depth board (new), through the real grader.
Exact's five-number answer and Checkout's big finishes are played by a share of each level (average 10 %, good
30 %, great 50 %, near-perfect 80 %, elite 100 %); Brimful's par comes from the kit's own slips.
Median / top 10 % / best:

| Game | Level | Old | New |
| --- | --- | --- | --- |
| Counterweight | average | 89 / 94 / 100 | 89 / 94 / 100 |
| | good | 125 / 130 / 134 | 125 / 130 / 134 |
| | great | 139 / 142 / 145 | 139 / 142 / 145 |
| | near-perfect | 148 / 150 / 150 | 148 / 151 / 155 |
| | elite | 150 / 150 / 150 | 188 / 200 / 200 |
| Operator | average | 95 / 122 / 130 | 95 / 122 / 130 |
| | good | 135 / 139 / 141 | 135 / 139 / 141 |
| | great | 144 / 146 / 148 | 144 / 146 / 148 |
| | near-perfect | 149 / 150 / 150 | 149 / 159 / 161 |
| | elite | 150 / 150 / 150 | 193 / 200 / 200 |
| Integer Pyramid | average | 50 / 59 / 63 | 50 / 59 / 63 |
| | good | 80 / 87 / 89 | 80 / 87 / 89 |
| | great | 105 / 121 / 125 | 105 / 121 / 125 |
| | near-perfect | 140 / 144 / 145 | 140 / 144 / 145 |
| | elite | 150 / 150 / 150 | 187 / 200 / 200 |
| Trail | average | 62 / 84 / 93 | 62 / 84 / 93 |
| | good | 128 / 132 / 135 | 128 / 132 / 135 |
| | great | 139 / 143 / 144 | 139 / 143 / 144 |
| | near-perfect | 150 / 150 / 150 | 150 / 154 / 162 |
| | elite | 150 / 150 / 150 | 191 / 200 / 200 |
| Exact | average | 40 / 131 / 133 | 16 / 131 / 147 |
| | good | 136 / 142 / 146 | 137 / 169 / 183 |
| | great | 143 / 148 / 149 | 146 / 197 / 200 |
| | near-perfect | 149 / 150 / 150 | 200 / 200 / 200 |
| | elite | 150 / 150 / 150 | 200 / 200 / 200 |
| Brimful | average | 28 / 78 / 88 | 28 / 78 / 88 |
| | good | 121 / 129 / 132 | 121 / 133 / 141 |
| | great | 133 / 142 / 143 | 143 / 168 / 173 |
| | near-perfect | 147 / 150 / 150 | 188 / 199 / 200 |
| | elite | 150 / 150 / 150 | 200 / 200 / 200 |
| Checkout | average | 51 / 79 / 110 | 51 / 79 / 110 |
| | good | 110 / 128 / 133 | 110 / 127 / 136 |
| | great | 136 / 144 / 146 | 138 / 159 / 172 |
| | near-perfect | 148 / 150 / 150 | 183 / 194 / 195 |
| | elite | 150 / 150 / 150 | 194 / 200 / 200 |
| Ballpark | average | 70 / 86 / 90 | 70 / 86 / 91 |
| | good | 97 / 108 / 120 | 99 / 110 / 122 |
| | great | 120 / 131 / 134 | 123 / 136 / 144 |
| | near-perfect | 141 / 144 / 150 | 153 / 160 / 168 |
| | elite | 150 / 150 / 150 | 189 / 199 / 200 |

Reading it: on the stretch games every level up to great is unchanged, near-perfect (today's 150 pace) moves to
148–162, and only the elite player reaches 190–200. On the feature games a solid (good) player's median is
unchanged and their mean moves by at most 7 %; the extra 50 goes to players who use the feature, in full only
at today's 150 pace. Exact's average-level median (16 vs 40) is the kit's bimodal finish-or-not on fresh
boards (means 57 → 50): the new boards' six-number answers are no harder, but the average kit finishes about as
often as it misses, so its median jumps between the two modes.

### Tenfall (tenRev 4, details in d2-number-tenfall.md)

`bun scripts/tendrop-depth-bands.ts`, 30 room seeds, median / top 10 % / best:

| Player | tenRev 3 | tenRev 4 |
| --- | --- | --- |
| average (kit) | 97 / 110 / 110 | 97 / 110 / 110 |
| good (kit) | 129 / 137 / 141 | 137 / 151 / 153 |
| great (kit) | 137 / 144 / 147 | 143 / 165 / 176 |
| near-perfect (kit) | 141 / 145 / 147 | 158 / 175 / 191 |
| near-perfect + gold | 135 / 144 / 146 | 160 / 181 / 191 |
| elite + gold | 138 / 144 / 148 | 162 / 177 / 188 |
| scripted best | 143 / 148 / 150 | 183 / 198 / 200 |

## Assumptions (no questions asked)

- Tenfall's gold ten counts only when the gold tile is the tap that hits the target (gold anywhere in the total
  gave gold-blind players 4–5 gold tens of 10 and moved a good player 18 %).

- One stamp name for the eight puzzles, `depthRev 1`, dealt with puzzleScoreRev 3 (a check that pins an older
  puzzleScoreRev, or `pinNumberDepth(true)`, gets the old boards). Checkout's rules also carry `checkoutRev 2`.
- Ballpark's streak is judged at the reveal only (values are server-only).
- Checkout's "treble" big finish applies on the double-finish boards; on the treble-finish board only the Bull
  is big (trebles are its normal finish).
- Brimful's par is the BFS minimum, now public on depth rounds.
- Exact's elegance is exactly five numbers (the fewest any depth target allows).
- Feature bonuses pay in full at rev 3's fast share; stretch elite shares were fitted so the elite kit's median
  lands about 190.

## Demos

Exact's and Checkout's fixed intro examples change on the new generators, so their stored coordinate demos are
rejected (`NUMBER_DEPTH_DEMOS`, presentation `oct25-number-depth` in `src/components/puzzles/wordInput.ts`):
the intros show the game's still until **re-recorded**. Counterweight, Operator, Integer Pyramid, Trail, Brimful
and Ballpark keep their examples and layouts, so their demos still play (they show today's moves; Brimful's par
and Ballpark's streak line are display only). Re-recording all eight on the depth stamp is suggested.

## Checks

Run locally, all PASS: number-depth-check, tendrop-depth-check, tendrop-check, round-max-check,
intro-score-text-check, intro-demo-check, reveal-score-check, replay-check, scoring-rev3-check,
scoring-bands-check, scoring-batch2-check, number-batch-check, number-pyramid-check, trail-check,
practice-bests-check, room-practice-grade-check, round-time-check, puzzle-bands-depth-check,
stage-state-reload-check, reveal-window-check, first-paint-check (the eight puzzles), the board-size probe
(`frame-probe.ts --compare`, every board at least main's size), no-wrap-check (answer reveal, round
leaderboard), arcade-play-check (tendrop), arcade-fx-check, sound-manifest-check.

- `number-depth-check` (new, ~4 s): the legacy fixture `scripts/fixtures/number-depth-legacy.json.gz` (1,004
  answers recorded on main before the stamp by `scripts/number-depth-record.ts`) grades identically; the stamp;
  the layer's rules on kit plays; each feature; the texts.
- Updated for the raised games: round-max-check (games at 200 are listed and proved at 200), number-batch-check
  (the intro lines), scoring-rev3-check and scoring-bands-check (the help and intro come from
  `numberDepthText.ts` for these games; rev 3's numbers are still in them).

## Shared requests

Files outside the nine games that this PR had to touch (each change is limited to these games or is a hook):

- `src/lib/duel/generate.server.ts`: two hook lines, `stampNumberDepth(...)` on every generated puzzle (a no-op
  for other games) and `withNumberDepth(...)` around the rev-3 / rev-2 grade (a no-op without the stamp). Other
  depth sessions may want one generic per-game hook here instead of each adding their own.
- `src/lib/duel/types.ts`: `depthRev?` on the eight puzzles' interfaces, `par?` on Brimful, `bigFinish?` on a
  Checkout stage.
- `src/lib/duel/instructions.ts`, `src/lib/duel/introScore.ts`: these games' entries only.
- `src/components/puzzles/wordInput.ts`: `NUMBER_DEPTH_DEMOS` (Exact and Checkout demos rejected).
- `scripts/round-max-check.ts`: raised games (any at `SCORE_CEILING`) are expected at 200 and skipped by the
  "one game raised" proof; every expansion PR will need this.
- `scripts/scoring-rev3-check.ts`, `scripts/scoring-bands-check.ts`: accept these games' depth texts.
- `src/lib/duel/practiceStamps.data.ts`: regenerated (`bun scripts/practice-stamps.ts`).
- Not done (would be shared): a live bullseye signal for Ballpark (needs a server round trip), and showing the
  depth breakdown's feature name with an icon in AnswerReveal's shared breakdown line.
