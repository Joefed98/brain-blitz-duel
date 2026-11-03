# Intro demos and round replays: audit (23 Oct 2026, Prompt D)

Display only. Nothing here changes a rule, a score, a timer, a round's flow, a seed, a server call,
stored data, a route, a storage key or a version stamp. Replays show only what a round stored.

## What changed

- **Intro demo box** (`src/components/duel/IntroStage.tsx`). Every intro has the same layout: GOAL,
  HOW, one demo box, SCORE, READY. The box takes the height the text leaves, so its size never depends
  on what is inside it. Until a saved demo has drawn its first frame the box shows the game's still
  (its fixed `IntroExample`, scaled to fit and centred); a game with no demo keeps the still for good.
  The demo is laid out at the largest size of its own shape that fits, centred, looping, inside the
  box, never over READY or Back. The intro now enters with a fade only (`animate-round-in`, as the game
  screen does): its old 10 px rise moved everything on the first frames. Rooms, practice, the daily and
  friend challenges all draw `RoundIntro`, so they share this.
  Before: an engine game's intro had no demo area while its demo loaded or when it had none (the text
  was centred), then grew a demo area when one arrived, so the whole screen jumped; puzzle demos
  replaced the example in a box sized from whichever was showing.
- **Puzzle time-lapses** (`src/components/replay/ReplayPanels.tsx`, `src/lib/replay/timelapse.ts`).
  **Why replays showed no puzzle:** the board's fitting box (`FitHeight`) sat in a centred flex column
  with only an absolutely positioned child, so it had no width; it measured 0 px and scaled every
  board to nothing. The panel showed its move counter over an empty card, for every time-lapse game,
  on the results screen and in the podium's play of the game. Fixed, and the board is now laid out as
  on the answer reveal (a definite 360 × 520 box with the page's own colours, `data-skin-off`), then
  what it drew is scaled to fit. Boards that size from their parent (`flex-1 min-h-0`) had collapsed
  to nothing in the old auto-height box even with a width.
- Time-lapses follow a timed answer's own rhythm (Lightbender's action log: each move at its recorded
  time, every gap scaled by one factor), end on the player's final board with the **stored** score on
  the counter line, and last at most about 8 s (the plans keep to 7.5 s; the results screen keeps its
  own time limit). Untimed move lists stay evenly spaced: their answers record no times.
  Mid-time-lapse the reveal's own text lines are hidden (they described the part-played prefix:
  "Solved", a points breakdown that wasn't the stored score).
- **Lookout and Roundabout** join the time-lapse (their stored lists are the words found, in order, and
  their boards draw the words found so far). **Lightbender** joins it on rounds with the action log
  (`alogRev 1`).
- **Every other puzzle** shows the round winner's real final board (the game's own Reveal, given the
  stored answer) with "Replay not available for this game yet" and the stored score. Nothing is
  invented.
- **Arcade reveal chart** (`src/components/duel/ArcadeScoreChart.tsx`): see "Arcade reveal line" below.

## Recorded demos: what could and could not be checked here

The saved demos live in the live database (`intro_demos`), which this session could not reach (the
container's network policy refuses Supabase and the published app). So:

- **Has a demo** says what today's code allows: **No (stopped)** where `getIntroDemoFn`
  (`src/lib/duel/introDemo.functions.ts`) refuses every demo recorded before the game's current
  revision (CLAUDE.md lists these as stopped until re-recorded); **Not confirmed** where a demo plays if
  one is recorded on today's revision and presentation (`puzzleInputDemoCompatible` in
  `src/components/puzzles/wordInput.ts` for puzzles). Run the query below on the live database to turn
  every "Not confirmed" into a yes or no.
- **Demo at 414×896** is what `demo-intro-check` proves for every game with a stand-in demo of the
  right shape (an engine run on a generated puzzle; taps over the puzzle's fixed intro example on
  today's layout and presentation): the demo player mounts, draws, sits inside the box at the largest
  size that fits, loops, never covers READY, and nothing on the screen moves from the first frame to
  the demo playing. A real recording's touches landing on the right targets is what
  `scripts/shots/demo-taps.ts` checks once the recordings are at hand.
- Every intro is now correct whether or not its demo exists: no demo, a refused demo or a slow
  network all show the still in the same box. So no intro looks broken; a missing demo only means the
  still stays.

```sql
-- Which saved demos today's intro will play (run on the live database, read only).
select game_type,
       input_log->>'presentation' as presentation,
       input_log->>'layout' as layout,
       coalesce(puzzle->>'brkRev', puzzle->>'rallyRev', puzzle->>'wavRev', puzzle->>'burstRev', puzzle->>'beatRev',
                puzzle->>'sliceRev', puzzle->>'bubbleRev', puzzle->>'clashRev', puzzle->>'swingRev', puzzle->>'orbitRev',
                puzzle->>'btRev', puzzle->>'clayRev', puzzle->>'inkRev', puzzle->>'bombVersion', puzzle->>'strikeoutRev') as stamp
from intro_demos order by game_type;
```

A puzzle row plays when its `presentation` equals the value in the table's Notes (games without one
need none); an engine row plays when its stamp is the one `getIntroDemoFn` asks for.

## The 73 active games

Replay columns describe the room's results-screen highlight and the podium's play of the game.

| Game | Category | Has a demo | Demo at 414×896 | Has a replay | Replay shows the real board and moves | Notes |
|---|---|---|---|---|---|---|
| Cryptogrid (`codeword`) | Word | Not confirmed | Yes | Final board | No: final board only | Demo needs presentation `oct14-word-batch`. Moves are stored in order, but the reveal draws only correct/incorrect colours for a part-played list (needs the player's letters drawn). |
| Forage (`wordhunt`) | Word | Not confirmed | Yes | Moment card | No: best-word card | Demo needs `oct10-polish-a`. Paths are not stored; needs a timed log of traced paths. |
| Interlock (`tilegrid`) | Word | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct13-word-polish`. Stores the final grid only; needs an action log. |
| Lookout (`wordsearch`) | Word | Not confirmed | Yes | Time-lapse | Yes (new): words found in order, evenly spaced | Demo needs `oct14-word-batch`. No times stored. |
| Nucleus (`wordsmith`) | Word | Not confirmed | Yes | Moment card | No: best-word card | Demo needs `oct13-word-polish`. Needs a timed word log to replay. |
| Roundabout (`letterwheel`) | Word | Not confirmed | Yes | Time-lapse | Yes (new): crossword fills in order, evenly spaced | Demo needs `oct14-word-batch`. No times stored. |
| Slider (`wordslide`) | Word | Not confirmed | Yes | Time-lapse | Yes (fixed): moves in order, evenly spaced | Demo needs `oct13-word-polish`. No times stored. |
| Strikeout (`strikeout`) | Word | No (stopped) | n/a: still | Time-lapse | Yes (fixed): guesses in order, evenly spaced | Demo stopped until recorded on `strikeoutRev 4`, presentation `oct14-word-batch`. |
| Swapword (`swapword`) | Word | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct13-word-polish`. Swaps are stored in order, but the reveal marks swaps without moving the letters (needs `run.board` drawn per prefix). |
| Ballpark (`numline`) | Number | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct14-number-tuning`. Placements are stored in order and the reveal draws them as dots, but it was not proved here; a candidate for the time-lapse after a check. |
| Brimful (`measure`) | Number | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct13-number-polish`. Jug actions per board are stored; needs a jug view of a part-played board. |
| Checkout (`checkout`) | Number | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct13-number-polish`. Darts per stage are stored; needs a dartboard view per dart. |
| Counterweight (`balance`) | Number | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct14-number-tuning`. Stores the final pegs only; needs an action log. |
| Exact (`target`) | Number | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct13-number-polish`. Steps are stored; needs a tile-pool view per step. |
| Integer Pyramid (`numpyramid`) | Number | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct13-number-polish`. Stores the final boards only; needs an action log. |
| Operator (`equation`) | Number | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct13-move-limits`. Per-stage picks (quiz-style). |
| Tenfall (`tendrop`) | Number | Not confirmed | Yes | Arcade highlight | Yes: the stored run on the game's renderer | Engine game; replay-check proves the replay equals the server's. |
| Trail (`trail`) | Number | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct13-number-polish`. Stores the final path only; needs an action log. |
| Ascend (`numhunt`) | Speed | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct14-speed-tuning`. Its tap log has times; needs a reveal that draws the board per tap. |
| Bang On (`stopwatch`) | Speed | Not confirmed | Yes | Moment card | No: closest-stop card | Demo needs `oct10-polish-a`. Tap log has times; a timed stopwatch view could replay it. |
| Bonk (`whack`) | Speed | Not confirmed | Yes | Arcade highlight | Yes: the stored run | Engine game. |
| Don't Break the Chain (`chain`) | Speed | Not confirmed | Yes | Final board | No: final board only | Demo needs `chainDemoCompatible`. Its answer has times (`node@ms`); needs a node-board view per step. |
| Flash (`reaction`) | Speed | Not confirmed | Yes | Moment card | No: fastest-reaction card | Demo needs `oct10-polish-a`. Tap log has times. |
| Pull! (`clayshoot`) | Speed | No (stopped) | n/a: still | Arcade highlight | Yes: the stored run | Demo stopped until recorded on today's `clayRev`. |
| Double Take (`spotdiff`) | Attention | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct14-attention-rework`. Per-picture picks; needs an action log with times. |
| Eagle Eye (`symscan`) | Attention | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct14-attention-rework`. Per-grid picks; needs an action log. |
| Labyrinth (`maze`) | Attention | Not confirmed | Yes | Time-lapse | Yes (fixed): path in order, evenly spaced | Demo needs `oct10-polish-b`. No times stored. |
| Matchmaker (`pairmatch`) | Attention | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct10-polish-b`. Flips are stored in order, but the reveal ignores a part-played list (needs `replay.matched` drawn). |
| Mixed Signals (`stroop`) | Attention | No (stopped) | n/a: still | Arcade highlight | Yes: the stored run | Demo stopped until recorded on `clashRev 5`+ (tall). |
| Tally (`countup`) | Attention | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct14-attention-rework`. Per-tray counts (quiz-style). |
| Chroma Lines (`flow`) | Pattern | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct10-polish-b`. Stores final paths only; needs an action log. |
| Gridlock (`unblock`) | Pattern | Not confirmed | Yes | Time-lapse (solved rounds) | Yes (fixed): moves in order, evenly spaced | Demo needs `oct13-pattern-polish`. Its reveal draws the player's board only for a correct answer. |
| Heave (`push`) | Pattern | Not confirmed | Yes | Time-lapse (solved rounds) | Yes (fixed): steps in order, evenly spaced | Demo needs `oct13-pattern-polish`. As Gridlock. |
| Jumbled (`tiles`) | Pattern | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct14-pattern-logic-batch`. Moves are stored in order, but the reveal ignores a part-played list (needs `replay.frame` drawn). |
| Lightbender (`laser`) | Pattern | No (stopped unless `splitterPieces 1`) | Yes | Time-lapse (action-log rounds) | Yes (new): every piece and FIRE at its recorded time, scaled | Demo needs `oct10-polish-b` and a movable-piece example. Older answers (no action log) show the final board. |
| Pipeline (`pipes`) | Pattern | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct13-pattern-polish`. Stores final tiles only; needs an action log. |
| Skid (`iceslide`) | Pattern | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct13-pattern-polish`. Moves are stored in order, but the reveal ignores a part-played list (needs the ball and paths drawn per prefix). |
| Tessellate (`blockparty`) | Pattern | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct10-polish-b`. Placements stored, removals lost; needs an action log. |
| Topsy-Turvy (`gravity`) | Pattern | Not confirmed | Yes | Time-lapse | Yes (fixed): tilts in order, evenly spaced | Demo needs `oct10-polish-b`. No times stored. |
| Turntable (`rings`) | Pattern | Not confirmed | Yes | Time-lapse | Yes (fixed): turns in order, evenly spaced | Demo needs `oct13-pattern-polish`. No times stored. |
| Blackout (`lightsout`) | Logic | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct13-logic-polish`. Presses are stored in order, but the reveal ignores a part-played list (needs `replayLights` drawn per prefix). |
| Bomb Defusal (`bomb`) | Logic | No (stopped unless `bombVersion 3`) | Yes | Final board | No: final board only | Demo needs `oct13-logic-polish` on a v3 card. Steps stored; needs a board view per step. |
| Box Six (`sudoku`) | Logic | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct13-logic-polish`. Stores final digits only; needs an action log. |
| Colour Flood (`flood`) | Logic | Not confirmed | Yes | Time-lapse | Yes (fixed): moves in order, evenly spaced | Demo needs `oct14-pattern-logic-batch`. No times stored. |
| Hanoi (`tower`) | Logic | Not confirmed | Yes | Time-lapse | Yes (fixed): moves in order, evenly spaced | Demo needs `oct13-logic-polish`. No times stored. |
| Lamplighter (`lightup`) | Logic | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct13-logic-polish`. Stores bulbs only; needs an action log. |
| Mosaic (`nonogram`) | Logic | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct13-logic-polish`. Stores filled cells only; needs an action log. |
| Polypotions (`tubes`) | Logic | Not confirmed | Yes | Time-lapse | Yes (fixed): pours in order, evenly spaced | Demo needs `oct14-pattern-logic-batch`. No times stored. |
| Safe Cracker (`safe`) | Logic | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct13-logic-polish`. Stores up to three tries; needs a per-try view. |
| Shikaku (`shikaku`) | Logic | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct13-logic-polish`. Stores final rectangles only; needs an action log. |
| Tents and Trees (`tents`) | Logic | Not confirmed | Yes | Final board | No: final board only | Demo needs `oct13-logic-polish`. Stores tents only; needs an action log. |
| Ball Tracker (`balltrack`) | Arcade | No (stopped) | n/a: still | Arcade highlight | Yes: the stored run | Demo stopped until recorded on `btRev 4`+ (12 rows). |
| Breaker (`breaker`) | Arcade | No (stopped) | n/a: still | Arcade highlight | Yes: the stored run | Demo stopped until recorded on `brkRev 6`+ (tall). |
| Coral Pop (`bubble`) | Arcade | No (stopped) | n/a: still | Arcade highlight | Yes: the stored run | Demo stopped until recorded on `bubbleRev 5`+ (tall). |
| Fission (`burst`) | Arcade | No (stopped) | n/a: still | Arcade highlight | Yes: the stored run | Demo stopped until recorded on `burstRev 4`+ (tall). |
| Flightpath (`bullseye`) | Arcade | Not confirmed | Yes | Arcade highlight | Yes: the stored run | |
| Gemstone (`matchup`) | Arcade | Not confirmed | Yes | Arcade highlight | Yes: the stored run | |
| Grappler (`swing`) | Arcade | No (stopped) | n/a: still | Arcade highlight | Yes: the stored run | Demo stopped until recorded on `swingRev 9`+ (tall). |
| High Rise (`skyline`) | Arcade | Not confirmed | Yes | Arcade highlight | Yes: the stored run | |
| Hover (`hover`) | Arcade | Not confirmed | Yes | Arcade highlight | Yes: the stored run | |
| Jaywalk (`cross`) | Arcade | Not confirmed | Yes | Arcade highlight | Yes: the stored run | |
| Meteor (`snake`) | Arcade | Not confirmed | Yes | Arcade highlight | Yes: the stored run | |
| Orbit (`orbit`) | Arcade | No (stopped) | n/a: still | Arcade highlight | Yes: the stored run | Demo stopped until recorded on `orbitRev 8`+ with today's belt period and revision. |
| Pinball (`pinball`) | Arcade | Not confirmed | Yes | Arcade highlight | Yes: the stored run | |
| Rainbow Bridge (`inkbridge`) | Arcade | Not confirmed (older block-era demos stopped) | Yes | Arcade highlight | Yes: the stored run | Plays a demo on inkRev 3, 4, the band or Tuning C revision only. |
| Rally (`rally`) | Arcade | No (stopped) | n/a: still | Arcade highlight | Yes: the stored run | Demo stopped until recorded on `rallyRev 6`+ (tall). |
| Roofbound (`flip`) | Arcade | Not confirmed | Yes | Arcade highlight | Yes: the stored run | |
| Scrumper (`snip`) | Arcade | Not confirmed | Yes | Arcade highlight | Yes: the stored run | |
| Slice (`slice`) | Arcade | No (stopped) | n/a: still | Arcade highlight | Yes: the stored run | Demo stopped until recorded on `sliceRev 6`+ (tall). |
| Swish (`bintoss`) | Arcade | Not confirmed | Yes | Arcade highlight | Yes: the stored run | |
| Tempo (`beat`) | Arcade | No (stopped) | n/a: still | Arcade highlight | Yes: the stored run | Demo stopped until recorded on `beatRev 6`+ (tall). |
| Tilt (`tilt`) | Arcade | Not confirmed | Yes | Arcade highlight | Yes: the stored run | |
| Wavefront (`wavefront`) | Arcade | No (stopped) | n/a: still | Arcade highlight | Yes: the stored run | Demo stopped until recorded on `wavRev 6`+ (tall). |
| Blockzone (`blockfall`) | Arcade | No (none yet) | n/a: still | Arcade highlight | Yes: the stored run | New 1 Nov 2026; Blockzone (`blockfallRev 2`) since 3 Nov 2026: on the later list for a demo recorded on `blockfallRev 2`; the intro shows its still. |
| Alley Roll (`alleyroll`) | Arcade | No (none yet) | n/a: still | Arcade highlight | Yes: the stored run | New 1 Nov 2026: on the later list for a demo recorded on `alleyRollRev 1`; the intro shows its still. |

"Yes" under *Demo at 414×896* means the player, box and layout pass `demo-intro-check` with a stand-in
demo; a stopped demo's intro shows its still (also proved there, as the no-demo case).

## Puzzle replays: what each game would need recording (beta week 1)

- **Times for every move list** (all time-lapse games but Lightbender): the shared action log
  (`alog1:`, `docs/puzzle-action-log.md`) already carries round-clock times; putting a game on it (its
  own stamp, as Lightbender's `alogRev 1`) gives its time-lapse the real rhythm with no other change.
- **Moves stored, board view missing** (no new recording needed, a Reveal change): Blackout, Skid,
  Jumbled, Matchmaker, Cryptogrid, Swapword; Ballpark to be proved.
- **Final state only, needs an action log**: Interlock, Counterweight, Integer Pyramid, Trail, Chroma
  Lines, Pipeline, Tessellate, Box Six, Lamplighter, Mosaic, Shikaku, Tents and Trees.
- **Stored with times, needs a board view per step**: Ascend, Don't Break the Chain (and Flash, Bang
  On, which show cards today).
- **Multi-stage boards, needs a per-step view**: Brimful, Checkout, Exact, Safe Cracker, Bomb Defusal.
- **Quiz-style picks**: Operator, Tally, Eagle Eye, Double Take (a per-pick view with times).
- **Word games**: Nucleus and Forage (a timed word log; Forage's traced paths).

## Demos still needed

Games whose intro shows only the still until a demo is recorded on today's revision. Puzzle games
first; within them, "stopped" ones are certain, the rest depend on the query above.

1. Strikeout (stopped: `strikeoutRev 4`)
2. Lightbender (stopped unless recorded on the movable-piece example)
3. Bomb Defusal (stopped unless recorded on a `bombVersion 3` card)
4. Every other puzzle game whose saved demo is missing or not on the presentation in its row
   (run the query).
5. Pull! (stopped: today's `clayRev`)
6. Mixed Signals (stopped: tall `clashRev`)
7. Ball Tracker, Breaker, Coral Pop, Fission, Grappler, Orbit, Rally, Slice, Tempo, Wavefront
   (stopped: their tall revisions)
8. Fences, Fillomino, Bridges and Kakuro (new 1 Nov 2026; no demo recorded yet: their intros show the fixed still
   until one is recorded on `fencesRev` / `fillominoRev` / `bridgesRev` / `kakuroRev` 1). Their replays show the
   winner's final board ("Final state only, needs an action log" above).
9. Moon Climb (Ricochet's id; 1 Nov 2026 the ninja wall-climb, `ricoRev` 2, and since 3 Nov 2026 Moon Climb, `ricoRev` 3, a demo to be recorded on 3; no demo recorded yet, the intro shows its still, a frame
   of seed 0's witness climb drawn by the game's own renderer). Record one on `ricoRev` 2 later.
10. Bastion (1 Nov 2026: the tank-defence shooter, `bastionRev 2`; no demo yet, the intro shows its still; record one on
   `bastionRev 2`, an original-turret demo stays stopped, `introDemo.functions.ts`)

## Arcade reveal line

The room answer reveal's snake chart (`ArcadeScoreChart`): each player's own line runs along the snake
from 0 to their place in their colour, 6 px with round caps and joins (the old track was 3 px), this
player's 8 px and drawn last; the chart takes the reveal's spare height (rows spread up to 150 px
further apart, no page scroll at 414×896); all its text (names, the 0 / 50 / 100 / 150 scale and the
heading) is #F3F1EC, 13 px, semibold, on a dark backing, so it reads over the lines; markers that would
touch stack into lanes with a thin leader to their dot. **Assumption:** "scores" in the brief is read
as the chart's scale labels. The chart still shows no points figure for any player (the rule since
17 Oct 2026, proved by arcade-chart-check, room-extras-check and reveal-window-check): exact scores are
for the results screen.

## Assumptions

- The intro's still is each game's own `IntroExample` (every game has one, engine games included); the
  icon fallback was not needed.
- One layout per intro: practice adds its Back button and "Best" line, a room its ready count; the
  box's size comes from what each shows, never from the demo.
- Highlight sizes on the results screen are unchanged (`highlightPx`), so a time-lapse board is at most
  about 200 px tall there.
- Untimed move lists keep even spacing: it is how fast the replay shows each real move, not a
  claim about the player's timing.
