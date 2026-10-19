# Puzzle scoring rev 3 (20 Oct 2026): batch 1 of the scoring report

Batch 1 of `docs/scoring-report-oct-2026.md` (#119): the shared puzzle helper, the progress fixes, the bugs and the
agreed game changes. Batch 2 (Nucleus, Forage, Flash, Bang On, Tenfall, Pull!, Mixed Signals, Letterfall) is a
separate change; nothing here touches those games.

## The helper (`puzzleScoreRev 3`)

Every puzzle with a finish state (the 42 of rev 2's finish games) scores on one formula
(`src/lib/duel/puzzleScoreRev3.ts`, wired in `generate.server.ts`):

```
unfinished = min(110, round(110 × progress ÷ oneShort))
finished   = 120 + round(30 × min(1, time-left share ÷ fastShare) × efficiency)
```

- **progress** (0–1) is each game's own measure (`src/lib/duel/puzzleProgress.ts`; rev 1's unfinished credit ÷ 110
  where the report found it fair). Stored on the round as `extra.progressShare`.
- **oneShort** is the progress a board one action short holds (measured on 15 room seeds), so one short = 110.
- **fastShare** is the near-perfect kit's 75th-percentile time-left share, clamped to 0.40–0.75. A finish with
  that much of the clock left and no mistakes is 150. The help says "150 if you finish in about N s with no mistakes".
- **efficiency** (0–1) is the game's own mistake measure from the rev-1 breakdown (moves, tries, strikes, wrong
  taps). Mistakes only scale the 30 speed points: a correct finish never scores below 120. Strikeout's first 3
  strikes are free (letters are guesses: even the near-perfect kit strikes 0–3 times).
- Open games (Nucleus, Forage, Flash, Bang On, Ballpark) keep rev 2's curves under the new stamp (batch 2's).
- Older rounds keep their stamps and grade exactly as before (scoring-bands-check, solver-progress-check,
  jumbled-clock-check and puzzle-bands-depth-check pin new deals to rev 2 to keep proving it; room-figures-check's
  3,420 grades recorded on main and every legacy fixture are unchanged).

## Progress fixes (`puzzleProgress.ts`)

| Game | Measure under rev 3 |
| --- | --- |
| Slider | Joe's row scale: 1 row 30, 2 rows 70, 3 rows 90, 4 rows 110. Wasted moves only cut a finish's speed points. |
| Trail | Tiles on the solution path from 1 (a wrong turn later keeps them), or right tiles less wrong ones if more. |
| Counterweight | Scales in deal order, equal shares, plus the current scale's weights on their solution notches. |
| Operator | Equations in equal shares, plus the current equation's operators right from the left. |
| Brimful | Puzzles in equal shares, plus how much nearer solved the current jugs came (exact distance over the jug states, net of wasted moves). |
| Strikeout | Words solved plus the current word's found letters, word 5 included (no cap at 4). |
| Interlock | Tiles inside a real word; a run still being extended into an everyday word keeps the word it already spells (TANG on the way to TANGENT). 14 of 15 is one short. |
| Exact | The closest any number made came: off by 1 = 1 (one short = 110), then 1 − log(d) ÷ log(target), 0 at the target's own size. |
| Turntable | Exact solver distance (turns commute: one table per link pattern), best board reached, less one per turn that gained nothing. |
| Gridlock | Exact solver distance (the board's whole state space, cached per layout), the same way. |
| Jumbled | Exact solver distance (A* on tile distances), the same way. Its leaderboard figure reads "N/M moves closer". |
| Blackout | Presses still needed (6×6 has one solution), best reached, less wasted presses. |
| Hanoi | Exact distance to the gold post (one table per peg count and target), the same way. |
| Heave | Each crate's fewest pushes to a spot on the empty warehouse, best matching: a bound, not the exact solver (an exact search of a warehouse's push states took up to 5 s on room boards). Pushes beyond the stored minimum cost. |
| Lightbender | The most gems any layout the player stood on lit without a bomb, raised to 1.15 (the last gems count a little more). |
| Matchmaker | Pairs found (mismatches beyond 14 cost a pair per 3), raised to 0.75 (the first pairs, found with nothing known, count a little more). |
| Safe Cracker | Dials right on the best try beyond the free one, raised to 0.85. |

Every search is bounded and cached per board; scoring-rev3-check's slowest stored grade is under 70 ms.

## Results (`bun scripts/scoring-report.ts`, 15 room seeds, rev 3)

Run as `scripts/scoring-report.ts --category=<c> --no-arcade --seeds=15 --out=<dir>` per category, then
`--combine=<dir> --rev3-doc=docs/scoring-rev3-oct-2026.md`. Grid columns as the report's proposal grid; on rev 3 they
are the graded scores. "one-short progress" is the measured median; "fast time share" is the game's `fastShare`.

<!-- generated:rev3-grid -->
| Game | one-short progress | fast time share | 25 % | 50 % | 75 % | one short | buzzer finish | 50 % left | 90 % left | random | avg | good | great | near |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cryptogrid | 1 | 0.75 | 28 | 55 | 86 | 110 | 120 | 140 | 150 | 0 | 98 | 138 | 143 | 150 |
| Interlock | 0.87 | 0.72 | 0 | 55 | 86 | 102 | 120 | 141 | 150 | 0 | 86 | 133 | 143 | 149 |
| Lookout | 1 | 0.75 | 22 | 66 | 88 | 110 | 120 | 140 | 150 | 0 | 110 | 140 | 145 | 150 |
| Roundabout | 0.97 | 0.51 | 37 | 79 | 95 | 110 | 120 | 149 | 150 | 0 | 74 | 105 | 134 | 148 |
| Slider | 1 | 0.75 | 0 | 0 | 0 | 110 | 120 | 140 | 150 | 0 | 137 | 142 | 150 | 150 |
| Strikeout | 0.88 | 0.74 | 26 | 66 | 79 | 97 | 120 | 140 | 150 | 0 | 88 | 131 | 137 | 145 |
| Swapword | 1 | 0.75 | 24 | 55 | 83 | 110 | 120 | 140 | 150 | 0 | 121 | 140 | 147 | 150 |
| Brimful | 0.98 | 0.66 | 39 | 67 | 91 | 110 | 120 | 143 | 150 | 0 | 60 | 122 | 135 | 149 |
| Checkout | 0.91 | 0.58 | 24 | 51 | 110 | 110 | 120 | 146 | 150 | 0 | 51 | 110 | 134 | 148 |
| Counterweight | 0.95 | 0.59 | 37 | 69 | 89 | 106 | 120 | 145 | 150 | 0 | 89 | 126 | 138 | 148 |
| Exact | 0.51 | 0.75 | 1 | 2 | 7 | 56 | 120 | 140 | 150 | 7 | 84 | 137 | 145 | 150 |
| Integer Pyramid | 0.98 | 0.4 | 37 | 64 | 89 | 110 | 120 | 150 | 150 | 5 | 50 | 82 | 108 | 140 |
| Operator | 0.94 | 0.7 | 39 | 66 | 88 | 110 | 120 | 141 | 150 | 0 | 95 | 136 | 143 | 149 |
| Trail | 0.96 | 0.66 | 26 | 57 | 84 | 110 | 120 | 143 | 150 | 0 | 71 | 130 | 140 | 150 |
| Ascend | 1 | 0.7 | 29 | 57 | 86 | 110 | 120 | 141 | 150 | 0 | 66 | 129 | 137 | 149 |
| Don't Break the Chain | 1 | 0.53 | 42 | 82 | 99 | 110 | 121 | 149 | — | 0 | 20 | 82 | 137 | 150 |
| Double Take | 1 | 0.69 | 30 | 60 | 90 | 110 | 120 | 142 | 150 | 0 | 72 | 130 | 141 | 148 |
| Eagle Eye | 0.97 | 0.55 | 36 | 72 | 93 | 110 | 120 | 147 | 150 | 0 | 78 | 110 | 137 | 148 |
| Labyrinth | 0.99 | 0.48 | 23 | 53 | 82 | 110 | 120 | 150 | 150 | 3 | 63 | 122 | 138 | 148 |
| Matchmaker | 0.95 | 0.72 | 15 | 51 | 79 | 110 | 120 | 141 | 150 | 0 | 86 | 137 | 145 | 149 |
| Tally | 0.86 | 0.72 | 47 | 81 | 110 | 110 | 120 | 141 | 150 | 0 | 74 | 131 | 140 | 147 |
| Chroma Lines | 0.92 | 0.61 | 30 | 60 | 90 | 110 | 120 | 145 | 150 | 11 | 79 | 128 | 140 | 148 |
| Gridlock | 0.94 | 0.68 | 27 | 59 | 85 | 110 | 120 | 142 | 150 | 0 | 48 | 129 | 141 | 149 |
| Heave | 0.94 | 0.64 | 28 | 47 | 79 | 110 | 120 | 143 | 150 | 7 | 73 | 131 | 140 | 149 |
| Jumbled | 0.96 | 0.75 | 27 | 57 | 85 | 109 | 120 | 140 | 150 | 0 | 49 | 136 | 143 | 150 |
| Lightbender | 1 | 0.63 | 14 | 50 | 69 | 110 | 120 | 144 | 150 | 0 | 14 | 123 | 130 | 148 |
| Pipeline | 0.96 | 0.49 | 7 | 33 | 68 | 110 | 120 | 150 | 150 | 4 | 52 | 125 | 138 | 149 |
| Skid | 1 | 0.63 | 26 | 58 | 84 | 110 | 120 | 144 | 150 | 0 | 55 | 124 | 137 | 148 |
| Tessellate | 1 | 0.59 | 28 | 55 | 83 | 110 | 120 | 145 | 150 | 0 | 69 | 124 | 136 | 148 |
| Topsy-Turvy | 0.92 | 0.69 | 26 | 60 | 86 | 110 | 120 | 142 | 150 | 0 | 48 | 126 | 140 | 147 |
| Turntable | 0.86 | 0.75 | 18 | 55 | 91 | 110 | 120 | 140 | 150 | 0 | 48 | 137 | 145 | 149 |
| Blackout | 0.9 | 0.66 | 30 | 60 | 90 | 108 | 120 | 143 | 150 | 0 | 30 | 108 | 131 | 146 |
| Bomb Defusal | 1 | 0.75 | 22 | 66 | 88 | 110 | 120 | 140 | 150 | 0 | 110 | 139 | 147 | 150 |
| Box Six | 0.96 | 0.59 | 27 | 55 | 83 | 110 | 120 | 145 | 150 | 0 | 66 | 124 | 138 | 149 |
| Colour Flood | 0.96 | 0.73 | 11 | 45 | 85 | 108 | 120 | 141 | 150 | 0 | 97 | 135 | 141 | 148 |
| Hanoi | 0.97 | 0.69 | 27 | 55 | 84 | 110 | 120 | 142 | 150 | 0 | 64 | 129 | 139 | 147 |
| Lamplighter | 1 | 0.64 | 28 | 55 | 86 | 110 | 120 | 143 | 150 | 14 | 62 | 126 | 141 | 148 |
| Mosaic | 0.96 | 0.75 | 26 | 55 | 84 | 109 | 120 | 140 | 150 | 0 | 94 | 139 | 146 | 150 |
| Polypotions | 0.96 | 0.67 | 27 | 57 | 83 | 110 | 120 | 142 | 150 | 0 | 27 | 126 | 139 | 148 |
| Safe Cracker | 1 | 0.74 | 0 | 43 | 78 | 110 | 120 | 140 | 150 | 0 | 110 | 137 | 144 | 149 |
| Shikaku | 0.96 | 0.57 | 26 | 55 | 84 | 110 | 120 | 146 | 150 | 0 | 58 | 122 | 137 | 149 |
| Tents and Trees | 1 | 0.66 | 30 | 60 | 90 | 110 | 120 | 143 | 150 | 0 | 50 | 130 | 142 | 149 |
<!-- /generated:rev3-grid -->

<!-- generated:rev3-marks -->
| Game | one short | buzzer finish | perfect fast | half done | random (median / p90) | monotonic | rooms = practice | misses |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cryptogrid | 110 | 120 | 150 | 55 | 0 / 0 | ✓ | ✓ | none |
| Interlock | **102** ✗ | 120 | 150 | 55 | 0 / 24 | ✓ | ✓ | one short |
| Lookout | 110 | 120 | 150 | 66 | 0 / 0 | ✓ | ✓ | none |
| Roundabout | 110 | 120 | 150 | **79** ✗ | 0 / 0 | ✓ | ✓ | half done |
| Slider | 110 | 120 | 150 | **0** ✗ | 0 / 0 | ✓ | ✓ | half done |
| Strikeout | **97** ✗ | 120 | 150 | 66 | 0 / 0 | ✓ | ✓ | one short |
| Swapword | 110 | 120 | 150 | 55 | 0 / 8 | ✓ | ✓ | none |
| Brimful | 110 | 120 | 150 | 67 | 0 / 28 | ✓ | ✓ | none |
| Checkout | 110 | 120 | 150 | 51 | 0 / 0 | ✓ | ✓ | none |
| Counterweight | 106 | 120 | 150 | 69 | 0 / 14 | ✓ | ✓ | none |
| Exact | **56** ✗ | 120 | 150 | **2** ✗ | 7 / 32 | ✓ | ✓ | one short, half done |
| Integer Pyramid | 110 | 120 | 150 | 64 | 5 / 12 | ✓ | ✓ | none |
| Operator | 110 | 120 | 150 | 66 | 0 / 37 | ✓ | ✓ | none |
| Trail | 110 | 120 | 150 | 57 | 0 / 22 | ✓ | ✓ | none |
| Ascend | 110 | 120 | 150 | 57 | 0 / 0 | ✓ | ✓ | none |
| Don't Break the Chain | 110 | **121** ✗ | — | **82** ✗ | 0 / 0 | ✓ | ✓ | buzzer finish, half done |
| Double Take | 110 | 120 | 150 | 60 | 0 / 0 | ✓ | ✓ | none |
| Eagle Eye | 110 | 120 | 150 | **72** ✗ | 0 / 8 | ✓ | ✓ | half done |
| Labyrinth | 110 | 120 | 150 | 53 | 3 / 21 | ✓ | ✓ | none |
| Matchmaker | 110 | 120 | 150 | 51 | 0 / 0 | ✓ | ✓ | none |
| Tally | 110 | 120 | 150 | **81** ✗ | 0 / 0 | ✓ | ✓ | half done |
| Chroma Lines | 110 | 120 | 150 | 60 | **11** ✗ / 20 | ✓ | ✓ | random |
| Gridlock | 110 | 120 | 150 | 59 | 0 / 0 | ✓ | ✓ | none |
| Heave | 110 | 120 | 150 | 47 | 7 / 39 | ✓ | ✓ | none |
| Jumbled | 109 | 120 | 150 | 57 | 0 / 0 | ✓ | ✓ | none |
| Lightbender | 110 | 120 | 150 | 50 | 0 / 14 | ✓ | ✓ | none |
| Pipeline | 110 | 120 | 150 | **33** ✗ | 4 / 24 | ✓ | ✓ | half done |
| Skid | 110 | 120 | 150 | 58 | 0 / 0 | ✓ | ✓ | none |
| Tessellate | 110 | 120 | 150 | 55 | 0 / 0 | ✓ | ✓ | none |
| Topsy-Turvy | 110 | 120 | 150 | 60 | 0 / 0 | ✓ | ✓ | none |
| Turntable | 110 | 120 | 150 | 55 | 0 / 0 | ✓ | ✓ | none |
| Blackout | 108 | 120 | 150 | 60 | 0 / 0 | ✓ | ✓ | none |
| Bomb Defusal | 110 | 120 | 150 | 66 | 0 / 22 | ✓ | ✓ | none |
| Box Six | 110 | 120 | 150 | 55 | 0 / 0 | ✓ | ✓ | none |
| Colour Flood | 108 | 120 | 150 | 45 | 0 / 0 | ✓ | ✓ | none |
| Hanoi | 110 | 120 | 150 | 55 | 0 / 0 | ✓ | ✓ | none |
| Lamplighter | 110 | 120 | 150 | 55 | **14** ✗ / 48 | ✓ | ✓ | random |
| Mosaic | 109 | 120 | 150 | 55 | 0 / 14 | ✓ | ✓ | none |
| Polypotions | 110 | 120 | 150 | 57 | 0 / 0 | ✓ | ✓ | none |
| Safe Cracker | 110 | 120 | 150 | 43 | 0 / 43 | ✓ | ✓ | none |
| Shikaku | 110 | 120 | 150 | 55 | 0 / 38 | ✓ | ✓ | none |
| Tents and Trees | 110 | 120 | 150 | 60 | 0 / 10 | ✓ | ✓ | none |
<!-- /generated:rev3-marks -->


## Games that miss a mark, and why

| Game | Mark | Why |
| --- | --- | --- |
| Interlock | one short 102 | The kit's last tile completes a word, so its board one tile short holds 13 tiles in words. Joe's case (14 tiles in valid words) is 110 by construction. |
| Strikeout | one short 97 | The kit's last action types the whole last word, so its board one action short is that word part-revealed. One letter short scores 105–110. |
| Slider | half done 0 | Joe's scale counts whole rows, and a slide scramble makes its rows near the end: half the moves of a clean solve usually holds no finished row. |
| Exact | one short 56, half done 2 | Joe's rule is distance only, with off by 1 = 110. The kit's last-but-one step is usually far from the target (the last step makes the number). |
| Don't Break the Chain | buzzer finish 121, half done 82 | A timed game: the replayed solve cannot end exactly at the buzzer (121 = a finish with about 1 s left), and the kit taps the easy early links fastest. Not a batch-1 game. |
| Roundabout, Eagle Eye, Tally | half done 79 / 72 / 81 | Their measures (rev-1 credit, not batch-1 games) count the easy early words, eagles and trays: half the actions hold more than half the credit. |
| Pipeline | half done 33 | Tiles count only once joined to the source, which happens late (not a batch-1 game). Its ladder can also dip a few points when a turn cuts tiles off. |
| Chroma Lines, Lamplighter | random 11 / 14 | Blind fill strategies reach real progress (rev-1 credit, not batch-1 games; the report found the same). |

Every other mark holds in every helper game: a finish is 120 at the buzzer and 150 with 90 % of the clock left and
no mistakes; unfinished never passes 110; more progress, more time or fewer mistakes never scores less (scoring-rev3-check,
with Pipeline's dip listed); rooms = practice on every graded puzzle run.

## Joe's phone cases

| Case | Before | Now |
| --- | --- | --- |
| Slider 4 rows | 0 | 110 (3 rows 90) |
| Trail 8/26 | 0 | 35 (8 tiles on the path; right tiles less wrong ones if that is more) |
| Interlock 14 valid / 15 valid | 87 / 112–124 | 110 / 120–150 (Done now needs all 15) |
| Exact hit | 97–104 | 120–150 |
| Counterweight 1 scale | 15 | 28 |
| Roundabout all words | 118–119 | 120–150 |
| Lookout 4/6 | 54 | 88 |

## Polypotions: 27 against 71

#118 (`tubesRev 2`) measures Polypotions' progress by solver distance (`solverProgress.server.ts`): the average
kit player keeps about 0.2–0.24 of the board. #118's `tubes:2` knots map that result (21.2) to 70, so its average
scored 71. The report's 27 (and rev 3's 27 here) is the same measure put straight through the helper: 110 × 0.236 ÷
0.96 ≈ 27. Rev 3 uses #118's solver measure unchanged (the rev-1 credit Polypotions' grader computes from it); only
the knots' lift is gone, as for every helper game. The average kit player does not finish Polypotions in 90 s.

## Bugs fixed

- **Interlock:** Done needs all 15 tiles (the stage); the server grades a short grid as progress under rev 3.
  Tiles in a valid word have Slider's gold border; the reveal and leaderboard say "All 15 tiles · every word valid"
  or "14 of 15 tiles placed · 12 in valid words".
- **Colour Flood (`floodRev 3`):** a cycle-proof pool of 400 boards (`floodBankV3.server.json`): no cycling order
  of colours finishes any of them within par + 2 (a tighter limit could not work: on 25 of rev 2's boards a cycling
  order is itself a fastest route). flood-cycle-check proves it.
- **Reloads:** a room round's stage state is saved with the draft (`stageState.ts` `persistStageState`, puzzle rounds
  only, never practice or arcade), so a reload continues the same board. stage-state-reload-check proves it on Exact
  and Pipeline in happy-dom. Exact's board moved to `useStageState`.
- **Exact's intro example** now reads "A hit scores 120 to 150 (150 in about 19 s); off by 1 scores 110, less the
  further off".

## Game changes (each on a new stamp)

- **Strikeout `strikeoutRev 4`:** 12 strikes (1.25 a strike left, so the top stays 15).
- **Cryptogrid `codewordRev 3`:** a sixth starting letter: the hidden number that leaves the most numbers as the only
  unknown in some word (then the most such words, then the most squares, then the lowest). Next guesses per board go
  from 1.62 to 3.50 on average; all 1,000 boards are proven unique with six givens.
- **Swapword `swapwordRev 3`:** the swap budget is the minimum + 8.
- **Lookout `wordSearchRev 2`:** never hides a word that is or contains a form of the theme's name, or is part of a
  word in it (singular forms, AND / THE ignored). 33 of 76 themes lose 63 words; 134 of 1,520 grids are replaced by
  grids from the theme's remaining words (`wordSearchBankRev2.server.ts`).

## Decisions for Joe

1. **Finishing a puzzle is Great or better.** Puzzle averages (the kit's average player) rise to 50–137, against
   60–79 in arcade games. The report recommended keeping the rule for the beta and watching puzzles most players finish.
2. **Strikeout:** 1.25 a strike left (12 × 1.25 = 15, as rev 3's 10 × 1.5), and in the helper the first 3 strikes
   are free (otherwise the near-perfect kit could not reach 150).
3. **Lookout** matches the theme's words literally, so short ones reach far: SEA excludes SEAL, ART excludes CARTOON.
4. **Heave** uses a bound, not the exact solver distance (speed); it never counts more pushes than a solve needs.
5. **Exact, Slider:** Joe's rules (distance only; whole rows on his scale) leave the kits' half-done level near 0.
   A credit for steps made (Exact) or letters in place (Slider) would lift it, at the cost of random play.
6. **Small curves** on Matchmaker (0.75), Safe Cracker (0.85) and Lightbender (1.15) bring half done into 40–70.
7. **Games outside batch 1 that miss a mark** (table above): leave for a later batch?
8. **Stored 14-tile Interlock rounds** keep `is_correct = true`, so the leaderboard verdict still shows ✓ for them
   (only the wording changed); a display-side check could hide it.
9. **Strikeout's intro demo** is stopped until re-recorded on a 12-strike puzzle.
10. **Cryptogrid's** sixth given makes it easier (8–12 numbers to find instead of 9–13); its fastShare (0.75) was
    measured on five givens.

## Checks

See the PR description for every check run, by name.
