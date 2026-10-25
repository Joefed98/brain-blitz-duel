# D5: Topsy-Turvy and Jumbled remodels (25 Oct 2026)

Two Pattern games get new gameplay under new version stamps. Each keeps its name, its category, its place in
the app, the game frame and its polished look. Each now scores up to **200** (`ROUND_MAX`; docs/scoring-200.md).
Older rounds keep their stamps and grade exactly as before.

| Game | New stamp | Old stamps (unchanged) | Clock | Max |
| --- | --- | --- | --- | --- |
| Topsy-Turvy (`gravity`) | `gravityRev 3` | absent, 1, 2 (four balls, locking targets) | 120 s (`timeLimitMs` on the puzzle) | 200 |
| Jumbled (`tiles`) | `tilesRev 3` | absent (3 × 3), 1 and 2 (the extra-cell board) | 120 s (`timeLimitMs` on the puzzle) | 200 |

## Topsy-Turvy, gravityRev 3

**Rules** (`src/lib/duel/topsy.ts`, used by both the phone and the server):

- A round is **three boards** played one after another. Each board is **10 × 10** and has 14–22 blocks,
  **six balls** and one **hole** per ball in that ball's colour. Each ball also has its own mark (dot, triangle,
  square, diamond, cross, bar), shown on the ball, in its hole and in its ring, so colour is never the only cue.
  Each board also has **two stars**.
- A tilt (the four arrow controls, unchanged) rolls every ball still on the board. A ball keeps rolling until it
  meets the edge, a block or another ball; the ball in front moves first.
- A ball is **home the moment it rolls over its own hole**: it drops in and leaves the board, so it stops
  blocking. It does not have to stop on the hole. A ball rolls straight over other colours' holes.
- Any ball that rolls through a star collects it.
- Each board has a public **tilt limit**: the board's all-stars minimum + 6, rounded up to a multiple of 5 (so
  the limit does not reveal the minimum). Undo and Reset work within a board and never give a tilt back. If a
  board runs out of tilts, play moves on to the next board; that board stays unfinished.
- When a board is cleared (or runs out of tilts) it stays on screen for 0.9 s (0.5 s with reduced motion), then
  the next board appears. The round goes in when all three boards are done, or at the buzzer.
- Progress is shown as **a row of six coloured rings** just above the board, one per ball, each filled once that
  ball is home. The goal line shows "Board n of 3". The summary line shows Tilts n / limit · Stars n / 2 ·
  Home n / 18.

**Generation and proof** (`topsy.server.ts`). Each board is built from a random walk: blocks and balls are
placed, a random tilt sequence (with no holes yet) is rolled, and each ball's hole goes on a square it rolls
through in the second half of that walk. The walk only seeds the layout; every board is then judged on its own:

- No ball may drop on the very first tilt.
- A breadth-first search over the joint state (every ball's square, or home) finds the **exact fewest tilts**
  to get every ball home. This must be 4–7.
- The two stars go on squares that balls roll through near a shortest route. The plain shortest route must miss
  at least one star, so collecting both is a real choice.
- A second breadth-first search over (balls, stars taken) finds the fewest tilts home **with every star**. This
  must be at most the minimum + 2.

A round generates live in about 20–40 ms on the room's server call. Rooms store it, so every player gets the
same boards. Measured over 30 room rounds (90 boards), board minimums were: 4 tilts on 24 boards, 5 on 40,
6 on 21, 7 on 5. `verifyTopsyPuzzle` repeats every search and replays the stored routes.

Topsy-Turvy's old bank (`gravityBank.server.ts`, gravityRev 2 boards) is no longer dealt. It stays in the bank
list as a **retired bank** (`RETIRED_BANKS` in `puzzleBank.server.ts`): it is still verified and rebuildable,
but it gives no intro example.

**Score** (`scoreTopsy`, max 200):

- **Every board cleared**: 120, + 5 per star (6 stars, up to 30), + up to 50 for speed. The full 50 needs 45 % of
  the clock left, which means finishing in about 66 s. So 200 requires every star and a fast clear.
- **Unfinished**: 100 × balls home ÷ 18, + 5 per star on the boards you cleared, capped at 119 (always below a
  full clear). Stars on an unfinished board do not count, because random tilting collects them too.

## Jumbled, tilesRev 3

**Rules** (`src/lib/duel/jumbled.ts`):

- The board is a **5 × 5 colour gradient**: deep blue at the top left, through purple and pink, to coral at the
  bottom right. In OKLCH, lightness rises down the board (0.31 → 0.89) and hue turns across and down
  (267° → 394°).
- A move slides one whole **row left or right**, or one whole **column up or down**, by any number of steps. The
  tiles wrap round; there is no empty gap.
- The **four corners are fixed anchors**, marked with a small dark dot. No slide moves them. The top and bottom
  rows and the left and right columns slide only their middle three tiles; the middle rows and columns slide all
  five. That gives 32 distinct slides, and each one is undone by the opposite slide. Every board is the solved
  gradient scrambled by random slides, so every board is solvable.
- Every slide counts as a move, including ones later undone. Undo and Reset give no move back, as before.
- **Par** is shown during play. The summary reads **"Moves n · Par p"** with a **par marker**: one pip per par
  move, filling as you slide, with pips past par drawn in warn red. Par is the proved minimum + 3.
- **Tiles in their correct place glow softly** in their own colour (the batch-P glow), and a tile that arrives
  home flashes once.
- **The swipe**:
  - The first clear direction of a drag picks the line: across picks the row, up or down picks the column.
  - The line follows the finger. It wraps smoothly: five copies of the line slide inside a box clipped to it, so a
    drag of up to one and a half turns either way stays covered.
  - On release the line settles on the nearest step in 110 ms, and only then is the move recorded.
  - Grabbing an anchor shakes it, with the shared reject cue.
  - With reduced motion or reduced effects the slide lands at once, with no settle.
- **Number toggle**: a "123" button in the dock (stored on the device as `duelz-jumbled-numbers:v1`) shows each
  tile's number, 1–25, in reading order. It is in the game's dock rather than in Settings, because Settings is a
  shared file.

**Generation and proof** (`jumbled.server.ts`):

- Each board is a 6-slide scramble (never the same line twice in a row), with at least 16 of the 21 movable
  tiles out of place.
- The exact minimum is proved by **meet-in-the-middle**. Every frame within 3 slides of the solved gradient is
  tabled once per server process (the goal never changes). Every frame within 3 slides of the scramble is looked
  up in that table.
- A board is kept if its minimum is 5 or 6.
- Generation plus proof takes about 40 ms. Over 30 room boards: minimum 5 on 2, minimum 6 on 28.
- `verifyJumbledPuzzle` repeats the proof, checks par and the anchors, and replays the stored route.

**Score** (`scoreJumbled`, max 200):

- **Solved**: 120, + par points, + up to 40 for speed.
  - Par points: 40 at or under par, then 10 fewer for each move over (so 0 from par + 4).
  - Speed: the full 40 needs 65 % of the clock left, which means finishing in about 42 s.
- **Unsolved**: 110 × the net share of the tiles that started out of place and are now in place, capped at 110.
  Random slides score about 0.

**Colours** (`JUMBLED_PALETTE`, measured by `scripts/d5-remodels/colour.ts`, the player-looks-check method).
The palette came from a search that maximised the smallest difference between neighbouring tiles.
Smallest ΔE2000 between neighbours / between any two tiles:

| Vision | Neighbours | Any two |
| --- | --- | --- |
| Normal | 6.2 | 2.8 |
| Protanopia | 4.1 | 1.9 |
| Deuteranopia | 4.8 | 2.0 |
| Tritanopia | 5.1 | 2.2 |

Neighbours read apart in every vision type. A few tiles that are not neighbours come close under protan or
deutan vision. **That is why the number toggle exists** (noted as asked). Tiles in place also glow, which helps.

## Tuning

`bun scripts/d5-remodels/tuning.ts 30`: simulated players at five levels on 30 room-dealt rounds each, three runs
per level per round, all graded by the server's own `gradeAnswer`. The bots are in `scripts/d5-remodels/bots.ts`.

- Each level has a pace (seconds per action relative to a solid player) and a mistake rate.
- **Topsy-Turvy**: a solid player takes 3.6 s per tilt and 6 s to read each board, and misjudges one tilt in four
  (six balls roll at once). Players route for every star 0–100 % of the time, depending on level.
- **Jumbled**: a solid player takes 6 s per slide and 10 s to read the board. A mistake is an unhelpful slide
  plus the slide back. A solid player makes about twice par's slides.
- **Random spam** tilts every 0.4 s, or slides every 0.5 s.

| Topsy-Turvy (tilts) | median | p10–p90 | mean | finished | tilts | notes |
| --- | --- | --- | --- | --- | --- | --- |
| Random spam | 44 | 17–67 | 44 | 0 % | 43.9 | 7.7 home, 4.9 stars |
| Novice | 38 | 11–72 | 38 | 0 % | 14 | 6.1 home, 2 stars, 0 s left |
| Average | 60 | 33–109 | 66 | 10 % | 19.2 | 10.2 home, 2.9 stars, 9 s left |
| Solid | 147 | 61–179 | 129 | 51 % | 23.3 | 15.8 home, 4.2 stars, 31 s left |
| Strong | 190 | 98–200 | 169 | 76 % | 23 | 17.2 home, 5.3 stars, 53 s left |
| Near-perfect | 200 | 200–200 | 195 | 94 % | 20 | 17.9 home, 6 stars, 75 s left |

| Jumbled (slides) | median | p10–p90 | mean | finished | slides | notes |
| --- | --- | --- | --- | --- | --- | --- |
| Random spam | 0 | 0–0 | 1 | 0 % | 239 | |
| Novice | 28 | 0–72 | 34 | 4 % | 10.6 | 14 s left, at/under par 1 % |
| Average | 81 | 31–169 | 93 | 44 % | 13.4 | 24 s left, at/under par 9 % |
| Solid | 143 | 81–194 | 144 | 87 % | 13.7 | 42 s left, at/under par 20 % |
| Strong | 188 | 148–200 | 185 | 100 % | 9.5 | 73 s left, at/under par 46 % |
| Near-perfect | 200 | 200–200 | 199 | 100 % | 6.7 | 93 s left, at/under par 94 % |

Reading the table:

- **Solid players** land at a median of about 143–147. That is around today's Pattern finish scores (120–150) and
  sits in the "great" band on the 200 scale.
- **Strong players** land at 188–190 and **near-perfect players** at 200. Only strong, fast play reaches 190–200.
- **Topsy-Turvy is bimodal for solid players**: about half clear all three boards, and the other half run a board
  out of tilts. That is the tilt limit's job.
- **Random tilting in Topsy-Turvy scores about what a novice does** (around 40), well under an average player.
  Rolling over your own hole makes stray tilts drop some balls, and the tilt limit plus the stars rule keep that
  in check.
- d5-remodels-check re-runs the table on 20 rounds and holds these bands.

## Replay coverage

- **Old stamps**: `scripts/fixtures/d5-remodels-legacy.json.gz` was recorded on unmodified main (37aab99) by
  `scripts/d5-remodels-legacy-record.ts`. It holds 1,889 answers: empty runs, spam, four kit levels and
  part-played runs, on 52 stored puzzles.
  - Topsy-Turvy: gravityRev 0, 1 and 2.
  - Jumbled: tilesRev 1 and 2.
  - Each under puzzleScoreRev 0–3.
  - `d5-remodels-legacy-check` regrades every answer and requires the same score, verdict, counts, stored time and
    stored extra.
- **New stamps**: `scripts/fixtures/d5-remodels-runs.json.gz` holds 72 runs (bots at every level plus perfect
  routes) recorded on this branch. `d5-remodels-check --record` re-records it; the check regrades every run and
  needs both games to reach 200.
- **Checks written for the old versions keep proving them**:
  - Their room puzzles come from the old deal: `pinD5LegacyDeal` in `d5Remodels.ts` is check-only, used by
    `scripts/puzzle-fairness/run.ts` for these two games, and pinned at the top of move-limits-check and
    pattern-logic-oct14-check.
  - This works the same way `pinDealtPuzzleScoreRev` does for score revisions.

## Intro, help and demos

- **Goal / How / Score** are rewritten for the new games. The score texts use `{max}` (`topsyHelpScore`,
  `TOPSY_INTRO_SCORE`, `jumbledHelpScore`, `JUMBLED_INTRO_SCORE`), so they read 200.
- **Each intro shows a still**:
  - Topsy-Turvy: one tilt right, five balls drop and gold takes a star. The after-board is computed by the real
    rules.
  - Jumbled: the middle row slid one step right rebuilds the gradient.
- **Recorded demos are stopped** for both games until a demo is recorded on the new stamp
  (`introDemo.functions.ts`: a demo whose puzzle is below gravityRev 3 / tilesRev 3 is not played).
- **The reveal** shows each game's final board.
  - Topsy-Turvy also shows each board's shortest all-stars route, boards cleared, balls home, stars and tilts,
    and "120 + stars + speed".
  - Jumbled also shows moves against par and the minimum, and "120 + par + speed".
- **The round leaderboard summaries** are new for both: Topsy-Turvy shows boards, balls home and stars; Jumbled
  shows moves against par, or tiles placed if unfinished.

## Sound, motion, layout

- **Sound**: only existing cues are used.
  - Topsy-Turvy: tilt `pz_gravity_pull` + `gravity.tilt`; a ball home `lock` + `gravity.lock`; a star `tick`; a
    board cleared `correct`; the round `gravity.solve`.
  - Jumbled: slide `tiles.slide` + a soft `tick`; solve `lock` + `tiles.solve`; an anchor grab plays the shared
    reject cue.
  - Everything goes through the sound system, so mute and the Effects slider apply.
- **Motion**: under prefers-reduced-motion, balls jump instead of rolling, there is no tray lean, star pops are
  instant, and Jumbled slides land at once. Reduced effects does the same for the star pop, the drop and the
  settle.
- **First paint**: both boards size from their arena in a layout effect (`useGridMetrics`), so nothing moves after
  the first frame.
  - Topsy-Turvy's ring row is a fixed 24 px row inside the arena.
  - Jumbled's summary line has a fixed height.
- **Cell sizes**: Joe's iPhone 11 (414 × 896) is the target.
  - **Topsy-Turvy**: the board is 406 px, so cells are about 40 px. At 375 × 667 the cells are about 35 px.
    "About 10 × 10" and "about 40 px at 375" cannot both hold: ten 40 px cells need 400 px. I kept the bigger
    board and thinned the tray rim (1.6 %) to give the cells every pixel. See Assumptions.
  - **Jumbled**: cells are about 76 px at 414 and 68 px at 375.
- **Desktop**: Topsy-Turvy tilts with the arrow keys or WASD (through ArrowPad); Z or Backspace is Undo, R is
  Reset. Jumbled is played by dragging with the mouse, with Z / Backspace and R as above. Jumbled has **no keyboard
  slides yet**; that is a decision for Joe, for docs/desktop-support.md.

## Assumptions (made without stopping, as asked)

- **"Several puzzles per round as today"**: today's Topsy-Turvy has one board per round. I read the request as
  asking for several boards per round, so a round is three boards on a 120 s clock.
- **Board size against cell width**: about 10 × 10 wins over 40 px at 375 (see above). The cells are about 40 px on
  Joe's phone.
- **Topsy-Turvy's tilt limit**: random tilting drops balls by chance, so each board has a tilt limit (all-stars
  minimum + 6, rounded up to 5). Running out moves play to the next board instead of ending the round.
- **Stars**: any ball can collect a star. Stars count fully on a cleared round; on an unfinished round they count
  only on the boards that were cleared.
- **Jumbled's par** is public, as Colour Flood's is. It is the proved minimum + 3, so the minimum can be worked out
  from it. That gives nothing away about the route.
- **Jumbled's move count**: one swipe is one move, whatever its length. The minimum is counted the same way.
- **Jumbled's anchors**: the edge lines slide their middle three tiles round the fixed corners. Every slide has an
  inverse, so every scramble is solvable. Every dealt board is also proved by the solver.
- **The colour-blind accommodation** is the number toggle, kept in the game's dock (Settings is shared).
- **Old stored rounds' "?" help and intro**: these texts are per game, not per round, so they now describe the
  remodels. Stored old rounds only reach the reveal, which still draws the old boards.
- **Topsy-Turvy's reveal heading** now reads "Shortest routes, every star". The heading is per game, so an old
  round's reveal shows it too.

## Files

**The games' own files** (new or changed):

- Rules, generation, solvers and scoring:
  - `src/lib/duel/topsy.ts` (new) and `topsy.server.ts` (new)
  - `src/lib/duel/jumbled.ts` (new) and `jumbled.server.ts` (new)
  - `src/lib/duel/d5Remodels.ts` (new: the check-only deal pin and the remodelled set)
- Stage, reveal, intro and art:
  - `src/components/puzzles/pattern/topsyBoard.tsx` (new) and `gradientBoard.tsx` (new)
  - `src/polish-pattern/topsy.css` (new) and `jumbled.css` (new)
  - `src/puzzles/gravityMaze.tsx` and `slidingTiles.tsx` (each routes the new stamp to the new stage and reveal;
    old rounds keep theirs)
- Checks and tools:
  - `scripts/d5-remodels-check.ts` (new)
  - `scripts/d5-remodels-legacy-check.ts` and `scripts/d5-remodels-legacy-record.ts` (new)
  - `scripts/d5-remodels/{bots,tuning,colour}.ts` (new)
  - `scripts/fixtures/d5-remodels-{legacy,runs}.json.gz` (new)
  - `scripts/shots/d5-remodel-shots.ts` (new)
  - `scripts/shots/drivers/{gravity,tiles}.ts` (updated for the new stage state)
  - `scripts/jumbled-clock-check.ts` (comment only)
- The two games' lines in `ROUND_MAX` (both 200).

**The games' own lines in shared files**. Each change touches only these two games:

- `types.ts`: the stamps and new fields on `GravityPuzzleData` and `TilesPuzzleData`.
- `secrets.ts`: the new server-only fields.
- `grade.ts`: the new-stamp branch of each game's case.
- `generate.server.ts`:
  - the live deal of the remodels;
  - the remodels' grades are taken as they are (no rev-3 mapping).
- `moveLimits.server.ts`: gravityRev 3 gets no gravityRev 1 limit.
- `instructions.ts` and `introScore.ts`: each game's entry.
- `GameFrame.tsx` (`SHORT_GOALS`): Topsy-Turvy's goal changed, Jumbled's added.
- `puzzleBandsText.ts` (`DEALT_LIMIT_S`): both clocks are now 120.
- `roundSummaries.ts` and `progressFigures.ts`: each game's new-stamp branch.
- `introDemo.functions.ts`: the two demo stops.
- `practiceStamps.data.ts`: regenerated, so both games start fresh practice bests.

**Shared files changed because the remodels required it** (see Shared requests):

- `puzzleBank.server.ts`: `RETIRED_BANKS`.
- `scripts/puzzle-bank-check.ts` and `scripts/puzzle-bank-lib.ts`: retired-bank handling.
- `scripts/puzzle-fairness/run.ts`: old deal for these two games' kits.
- `scripts/round-max-check.ts`: a `RAISED` table.
- `scripts/scoring-bands-check.ts` and `scripts/scoring-rev3-check.ts`: skip the help-text equality for the
  remodelled games.
- `scripts/move-limits-check.ts` and `scripts/pattern-logic-oct14-check.ts`: pin the old deal.

## Shared requests

1. **`round-max-check`** now has a `RAISED` table. Other depth sessions raising their own games will add lines
   to the same table, so expect a merge conflict there. They are simple to resolve.
2. **`gradeAnswer`** (`generate.server.ts`) has a one-line pass-through for the remodels' 200-point grades. A
   shared "this stamp scores itself" hook would serve every expansion.
3. **The retired-bank mechanism** (`RETIRED_BANKS`) in `puzzleBank.server.ts`, puzzle-bank-check and
   puzzle-bank-lib: Topsy-Turvy's old bank is kept and verified but not dealt. CLAUDE.md's "six banked types"
   sentence could mention it.
4. **The fairness kits** (`scripts/puzzle-fairness/`) still model the old Topsy-Turvy and Jumbled, and
   `roomPuzzle` pins the old deal for them. The remodels' bots live in `scripts/d5-remodels/`. If the scoring
   reports should cover the new versions, those bots would need porting into kits.
5. **Settings**: a shared "show tile numbers" setting would be a better home for Jumbled's number toggle than its
   dock.
6. **docs/desktop-support.md**: Jumbled's control map changes (drag a line; no keyboard slides yet). Topsy-Turvy's
   is unchanged (arrows / WASD, Z, R).
7. **CLAUDE.md**: a line for the remodels (stamps, files, checks), as earlier batches have.
8. **Intro demos**: record new demos on gravityRev 3 and tilesRev 3.
