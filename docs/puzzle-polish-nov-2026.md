# Puzzle polish, 3 Nov 2026

Joe's audit of the six puzzle categories (`screenshots/audit-nov-2026/`), built on the shared-screens PR (reveal layout,
margins, fonts, disabled buttons, puzzle pill HUDs). Joe tests on an iPhone 11 (414×896); the checks also cover 375×667
and the computer layout. Before → after screenshots: `screenshots/puzzle-polish-nov-2026/`.

## Status lines as separate pills

The shared-screens PR turned each small status line into one pill by CSS, so "0 / 5 words · 0 locked · Moves 1 · Par 8"
was still one pill with dots in it. Every game touched here draws its status line through `HudPills`
(`src/components/puzzles/HudPills.tsx`, `src/polish-layout/hud-pills.css`): one pill per label and value ("Moves 12",
"Par 14"), no dots inside a pill, the row's 24 px reserved so nothing moves. A move-limit counter keeps its
`data-move-limit` hook (`limit` on the item; move-limits-check reads it).

## 1. Gameplay and scoring

### Operator's gaps (`gapsRev 1`, `src/lib/duel/operatorGaps.ts`, builder `operatorGaps.server.ts`)

| Equation | Numbers | Gaps | Tray |
| --- | --- | --- | --- |
| 1 | 3 (2–12) | both signs | none; exactly one answer (the old rule) |
| 2 | 4 (2–15) | 3 numbers; the signs given | 5: the three that fit and two decoys |
| 3 | 5 (2–15) | 2 or more signs and 2 numbers, no ÷ | 4: two that fit and two decoys |
| 4 | 5 (2–20) | 3 signs and 2 numbers; the answer uses × and ÷ | 4: two that fit and two decoys |

- Sign gaps are gold circles, number gaps teal squares, everywhere (play, intro, reveal, the finale). A sign key fills
  the leftmost empty sign gap, a tray number the leftmost empty number gap; tapping a filled gap empties it (its number
  goes back to the tray). The pad is always two rows (signs over the tray; a row an equation doesn't use says so), so
  nothing moves between equations. Desktop: + − × ÷, digits type a tray number, Backspace, Enter.
- Left to right as before; every step must stay a whole number, never negative. **Any fill that makes the equation true
  counts**: the server works it out (`gapStageCorrect`), never matching one stored answer. Each tray number is used at
  most once (a tray holding a number twice gives two chips).
- Every equation is built from an answer and searched: equation 1 has exactly one true set of signs, 2–4 between one
  and three true fills. The stored fills (`gapAnswers`) stay server-side until the reveal.
- Tries as before: every full fill is a try, three an equation (`equationRev 1`); the first full fill right is the
  clean bonus. Scoring is the standard's (unchanged formulas): 150 + speed 40 + clean 10.
- The answer segment is the gaps' fills in reading order, comma separated ("7,×,4"); stages, `|` and the tries suffix as
  before. Older rounds (signs only) keep their screen, grader and texts; `pinPreOperatorGaps(true)` deals them.
- The intro demo stays stopped (the still shows) until one is recorded on gapsRev 1 (`introDemo.functions.ts`).
- The equation row: the one-line fit (`useFitOneLine`, now shared in `src/components/puzzles/useFitOneLine.tsx`) takes a
  second pass when em-sized gaps don't scale exactly with the glyphs, down to 13 px, so five-number equations fit at 375.

### Labyrinth, Topsy-Turvy, Skid: stricter par (`mazeRev 5`, `gravityRev 7`, `slideRev 4`; `parMoves.ts`)

The puzzle batch's boards and play; the puzzle stores its par (`par`, public) and the play screen shows
"Moves n" and "Par p" pills. Speed is full earlier and the par points fall to 0 at 1.5× par (was 2×):

| | Speed full by (was) | Par points 0 at |
| --- | --- | --- |
| Labyrinth | 32 s (40) | 1.5× the route's steps |
| Topsy-Turvy | 32 s (80) | 1.5× the boards' fewest tilts |
| Skid | 30 s (60) | 1.5× the fewest slides |

The "full by" times come from the bots' finish times (near-perfect: medians 35 s Labyrinth, 37 s Topsy-Turvy, 35 s Skid;
flawless 31, 18 and 24 s), so near-perfect play no longer ties flawless. Older stamps keep their graders and texts;
`pinPreParStrict(true)` deals the puzzle batch's stamps (puzzle-batch-nov-check pins it).

### Skid, Chroma Lines and Tessellate at 150 in the audit

Not a scoring or reveal bug in live rounds. The audit's capture tool plays each game's fixed intro example (the
practice "Intro examples" dev switch). For these three banked games the example was the bank's first board, which
carries none of the live stamps (their live boards come from the depth banks, dealt only from a bank seed), so it
graded on the older `puzzleScoreRev 3` shape: 120 + 30 speed = 150, exactly as the reveal said. Live rooms and practice
deal the stamped boards and score to 200. Fixed: the example for these three is now the live deal at the example seed
(`practice.functions.ts`), so captures and demos show the live game. `bankedIntroExample` (puzzle-bank-check's
identity) is unchanged.

### Medians, weak → flawless, before → after (60 room seeds)

`bun scripts/puzzle-polish-bands.ts --seeds=60` (Operator: the fairness kit at a weak level, its four and a flawless one;
Labyrinth, Topsy-Turvy, Skid: the puzzle batch's players; random = the kits' spam answers and random tilting, at the
buzzer):

| Game | | random | weak | average | good | great | near | flawless |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Operator | before | 0 | 65 | 96 | 196 | 200 | 200 | 200 |
| | after | 0 | 64 | 65 | 167 | 200 | 200 | 200 |
| Labyrinth | before | 6 | 38 | 64 | 169 | 194 | 200 | 200 |
| | after | 6 | 38 | 64 | 164 | 186 | 197 | 200 |
| Topsy-Turvy | before | 0 | 35 | 47 | 173 | 196 | 200 | 200 |
| | after | 0 | 35 | 47 | 160 | 181 | 197 | 200 |
| Skid | before | 0 | 39 | 65 | 176 | 198 | 200 | 200 |
| | after | 0 | 39 | 65 | 168 | 184 | 197 | 200 |

- Operator's number and mixed equations are harder for average and good players (each number gap is a choice among the
  tray); its top stays at 200 (great, near and flawless all finish quickly and clean). Not changed here: the brief asked
  only for the par games' top to be pulled apart.
- Guessing never pays: random play is 0 on Operator, Topsy-Turvy and Skid, and Labyrinth's 6 is the blind depth-first
  walk's route credit (unchanged from before).

## 2–7. Display polish by category (no stamps; answers the phone sends unchanged)

**Word** (`src/polish-layout/polish-nov3-word.css`)
- Nucleus: the PANGRAM +20 badge has its own reserved 24 px row above the ring (never over the panel's corner).
- Slider: Undo and Reset carry icons and text, aria-labels "Undo last move" / "Reset the board".
- Forage: the reveal's missed words are wrapping chips.
- Roundabout: the crossword may grow to 380 × 400 px (cells about 23 → 40 px at 414×896); the wheel 172–220 px (280
  only with spare height); the bonus jar 26 × 35 px with a 15 px count pill, gold when full.
- Strikeout: the arena is capped at 176 px with the solved word just above the tiles, so tiles and keypad sit higher.
- Cryptogrid: clue numbers a third larger on the live board, the decode strip's boxes 34 × 44 px with 19 px letters;
  the on-board "Tap a square, then a letter" hint is gone.

**Number** (`polish-nov3-number.css`, `src/components/puzzles/number/StepChips.tsx`)
- Counterweight: notches 50 px wide in a live round, the instrument up to 400 px tall, 72 px tray cups (intros, demos
  and the tile keep 44 px so recorded touches land).
- Exact: "Lock in 150 (564 away)" ("Lock in 714" when exact, "Lock" with no steps).
- Operator: see section 1 (the row refits on five-number equations).
- Tenfall: "Total 16", "Target 25" and the cleared pegs as pills, on one row in the plank's fixed 56 px band above the board (arcade-play-check's `ABOVE_PX.tendrop`).
- Brimful and Checkout reveals: the best route as numbered step chips, one chip per move or dart.
- Ballpark: the tape 24 px (was 16), the live marker r 14, pins r 7.5, the card 4 px above the line (was 22).

**Speed** (`polish-nov3-speedatt.css`, `src/components/puzzles/SpeedRevealList.tsx`)
- Ascend: the cut "NEX…" label is now pills ("Next 11", "In a row", "Errors").
- Flash and Bang On reveals: the big average first, then the reactions in two columns (1–5, 6–10), notes below.
- Bang On: the watch up to 38 % of the height (was 30 %); "Tap to stop" 18 px.
- Don't Break the Chain: charms scale with the board (37 px at the smallest, was 25), never overlapping; the reveal uses
  the shared verdict row (AnswerReveal's `puzzleOwnsRevealLayout` is gone; Chain was its only user).

**Attention**
- Eagle Eye: an original bold eagle seen from above (hooked gold beak, spread wings, fanned tail) in the eight
  directions the plane encoded, everywhere: grid, targets, intro, reveal and the tile (`public/tiles/symscan.webp`).
- Labyrinth: the arrow pad is smaller and secondary on a live round (52 × 44 px, outlined, muted); "Moves" and "Par"
  pills on mazeRev 5.
- Bomb Defusal: clues 16 px on a 22 px line with more room.
- Matchmaker: cards larger (36 px glyphs, up to a 460 px board); "Flips" and "Streak" in pills above the board.

**Pattern** (`polish-nov3-pattern.css`, `src/components/puzzles/pattern/framePills.tsx`)
- Pipeline: brighter steel pipes; a pipe the water reaches turns blue as a whole tube with flowing ripples (still under
  reduced motion).
- Gridlock: the reveal plays the stored shortest solution; when solved, Solution and Yours side by side (the switch);
  the results-screen time-lapse still shows only the player's moves. The board is centred vertically in play.
- Skid: brighter ice, the ball 92 % of a square (was 80 %); Moves / Par pills.
- Topsy-Turvy: Moves, Par, Home and the board's tilts left as pills (the limit pill keeps `data-move-limit`).
- Lightbender: mirrors pale glass lines, splitters a violet prism, blocks solid brick.
- Turntable: the ring-link legend as a small diagram (ring discs, ↻ / ↺, "same way" / "opposite way").
- Gradient: the toggle reads "123 Numbers".
- Chroma Lines: "Filled 31 / 77" as a pill under the board, in the pill row (not the game header).
- Arrow pads (Skid, Heave, Topsy-Turvy, also Labyrinth and Mixed Signals): the stray gold arrow was the button's
  default `hover:bg-primary`, which a touch screen keeps on the last button tapped; every arrow is now the same card,
  tinted only while pressed (`GridDrag.tsx`).

**Logic** (`polish-nov3-logic.css`)
- Regions: the 1–9 + eraser pad in two rows of five, every key at least 44 × 44 px.
- Tents and Trees: trees 88 % and tents 92 % of a square (were 70 / 74 %), 19 px sign numbers, a higher-contrast grid.
- Mosaic: live clue numbers 16 px or more, weight 800.
- Lamplighter: a faint warm tint on lit squares instead of the gold wash; walls near-black with a light edge, numbers
  white 16–24 px.
- Colour Flood: the reveal shows Moves (against the limit) and Par, and a strip of the moves made (those past par
  outlined); the final board small.

## Known, not changed

- Lightbender's practice reveal: the board spills past the Solution / Yours panel on 414×896. It does the same on main
  (the shared reveal fit), so it is left for the shared screens.
- Intro demos: Operator's stays stopped until recorded on gapsRev 1; Roundabout's and Strikeout's boards moved
  (`docs/demo-replay-audit.md` lists their demos as not confirmed; Strikeout's is already stopped).

### Proofs

`scripts/puzzle-polish-nov-check.ts` (~4 min; `--seeds=N` for the bands, default 12): deals and pins, the same board on
the par games, the par public and equal to the graded par; every case of
`scripts/fixtures/puzzle-polish-nov-legacy.json.gz` (582 answers on 18 puzzles: Operator's signs-only stamp and the
puzzle batch's stamps, recorded on main 2c19b253 by `scripts/puzzle-polish-nov-record.ts`) regrades exactly; Operator's
kinds, trays, answer counts, the stored fill true, a second true fill counted, invalid fills refused, whole steps, tries
and 200; the par games' flawless 200, the 1.5× par line and the new speed times; the bands; the help texts.
