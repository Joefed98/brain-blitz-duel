# Word scoring fix: Interlock, Slider and Lookout (7 Nov 2026)

Code audit 5 (`docs/audit-nov-2026/scoring.md`) issues 10 and 17. Three Word games on the puzzle scoring standard
(`docs/scoring-standard.md`) each move up one stamp; the board, play and clock are the previous stamp's, only the
grade changes. Older stamps grade exactly as before.

| Game | Stamp before → new | What changed |
| --- | --- | --- |
| Interlock (`tilegrid`) | `tileGridRev` 3 → 4 | Big words scaled to the deal's own maximum; unfinished tiles counted against the answer grid |
| Slider (`wordslide`) | `wordSlideRev` 4 → 5 | Unfinished credit from the solver distance to the dealt words |
| Lookout (`wordsearch`) | `wordSearchRev` 4 → 5 | The miss penalty is taken after the bonus word is added |

Code: `src/lib/duel/wordNov7.ts` (stamps, `dealWordNov7` after the other deal steps in `generatePuzzle`,
`pinPreWordNov7`), the graders in `src/lib/duel/standard/word.server.ts`, numbers and help texts in
`src/lib/duel/standard/word.ts` (`STD_WORD_NOV7`, `interlockFairBigPoints`, `WORD_NOV7_HELP`), Slider's distance in
`src/lib/duel/wordSlideDistance.server.ts`. Proof: `scripts/word-nov7-check.ts` (~16 s); legacy fixture
`scripts/fixtures/word-nov7-legacy.json.gz` (3,120 cases on tileGridRev 3, wordSlideRev 3 and 4 and wordSearchRev 4,
recorded on main cc8e1643 by `scripts/word-nov7-record.ts`); report `bun scripts/word-nov7-bands.ts [--seeds=60]
[--pin]` (`--pin` deals the stamps before; its output is identical to the run on unmodified main).

## Interlock, `tileGridRev 4`

**Big words.** The bonus was 6 / 10 / 15 for each valid word of 5 / 6 / 7 letters, capped at 30, but a deal is three
words whose lengths add to 17, so the dealt solution's own big words give 25–27 and the solution itself scored
195–197. Now the points are scaled to the deal's own maximum: `30 × min(1, points ÷ the solution's points)`
(`interlockFairBigPoints`). The dealt solution, done in time, scores 200 on every seed; another grid with more big
words is capped at 30 as before. Unfinished grids get the same scaled points.

**Unfinished tiles.** Only tiles inside a finished word counted, so a correct tile that ran into an unfinished word
dropped the score (by up to 51 on the flawless line). Now an unfinished grid counts, per tile (8 each plus up to 1 for
how early), the larger of:

- the tiles in a real word (as before), and
- the tiles placed as in the dealt answer grid **less** the tiles that are not, under the best placing of that grid on
  the board (any shift, or turned on its side) (`interlockSolutionTiles`).

Building the answer anywhere counts tile by tile; a stray tile counts against it; scattered tiles score no more than on
the old stamp (word-nov7-check proves it for every spam on every seed). The reveal line says "12 of 15 tiles placed ·
11 counted" (`countedTiles`).

## Slider, `wordSlideRev 5`

The credit was 24 for each row made into a word, plus up to 2 each for how early. A shortest line's middle slides
break rows, so a flawless player's unfinished score could fall to 0 (seed 7217: 0 → 78 → 0 → 0 → 0 before the finish).
Tile matching was tried and dropped: on 24 of 60 seeds it falls along the shortest line too.

Now the credit is the larger of:

- `120 × (slides closer ÷ the start's distance)`: the fewest row and column slides (every row and column free, either
  way) from the board to the dealt words, against the start's (`wordSlideDistance`, a bidirectional search capped at
  the deal's scramble length; the start's distance is cached per board), and
- 24 for each row made into a real word other than the dealt word for that row (a dealt word in place is already in
  the distance).

There are no early extras on this stamp (the rows rise and fall along the line, so they would dip). Along every
shortest line the credit rises with every slide (word-nov7-check, 31 boards including 7217); seed 7217 now reads
20 → 40 → 60 → 80 → 100 → finish. The leaderboard figure reads "3/6 slides closer" (or "2/5 rows made" when other
words count more). A grade costs one or two searches, at most about 0.1 to 0.25 s on a far board.

## Lookout, `wordSearchRev 5`

The credit was `max(0, words − penalty) + bonus`, so random drags that stumbled on the bonus word kept its 30 however
many misses (3 of 24 random runs in the audit). Now it is `max(0, words + bonus − penalty)`: the bonus word and 20
wrong drags score 0 (was 30), with 8 wrong drags 24. A finish is unchanged (misses never cost a finish).

## Bands (60 room seeds, 6100 + 7k)

Medians (p10–p90) from `bun scripts/word-nov7-bands.ts --seeds=60`, before (the stamps before, identical to unmodified
main) → after. Flawless is the kit with no mistakes at 0.35 × pace.

| Level | Interlock | Slider | Lookout |
| --- | --- | --- | --- |
| nothing | 0 → 0 | 0 → 0 | 0 → 0 |
| spam | 0 (0–24) → 0 (0–24) | 0 (0–24) → 0 (0–24) | 0 (0–30) → 0 (0–0) |
| average | 114 (74–127) → 118 (85–130) | 189 (174–200) → 189 (174–200) | 151 (83–157) → 151 (83–157) |
| good | 184 (181–188) → 188 (184–192) | 200 → 200 | 164 → 164 |
| great | 192 (188–194) → 196 (193–198) | 200 → 200 | 170 → 170 |
| near | 195 (194–197) → 200 (198–200) | 200 → 200 | 170 (170–200) → 170 (170–200) |
| flawless | 196, 0/60 at 200 → 200, 60/60 | 200, 60/60 → 200, 60/60 | 200, 49/60 → 200, 49/60 |

Lookout's flawless kit spots the bonus word 85 % of the time; a perfect solve (the bonus word, then the six) scores
200 on every seed (word-nov7-check).

**Prefix curves** along the flawless line, every prefix graded unfinished at the buzzer:

| | Drops (seeds) | Largest drop | Median at ¼ / ½ / ¾ of the line |
| --- | --- | --- | --- |
| Interlock before | 47 / 60 | 51 | 0 / 77 / 118 |
| Interlock after | 0 / 60 | 0 | 36 / 88 / 121 |
| Slider before | 9 / 60 | 52 | 0 / 0 / 26 |
| Slider after | 0 / 60 | 0 | 34 / 69 / 90 |
| Lookout before | 0 / 60 | 0 | 43 / 94 / 116 |
| Lookout after | 0 / 60 | 0 | 43 / 94 / 116 |

Example lines (unfinished score at each step, F = the finish at the buzzer):

- Interlock seed 6100, before: 0 0 27 0 0 64 64 64 64 64 118 118 118 130 F176; after: 9 18 27 36 45 65 74 83 92 101 121
  130 130 130 F180.
- Slider seed 7217, before: 0 78 0 0 0 F165; after: 20 40 60 80 100 F165.

## Texts

The help ("?") for each game states the new rule (`WORD_NOV7_HELP`, chosen in `instructions.ts` while
`wordNov7Dealt`): Interlock's big words "the puzzle's own long words earn all of it" and the answer-grid tiles; Slider's
"a share of 120 by how many slides closer to the answer words you are than at the start, or, if more, 24 for each row you
make into a different real word"; Lookout's penalty "taken from the words and the bonus word together". The intro
SCORE lines are unchanged (still true).

## Existing checks

Joe's "pin + bump": standard-word-check and puzzle-notes-check pin `pinPreWordNov7(true)` so they keep dealing the
stamps they test; no assertion changed.
