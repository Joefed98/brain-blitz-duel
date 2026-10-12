# Duelz game facts — October 2026

A record of every game type exactly as the code stands, written as a read-only audit. Nothing here changes behaviour; where this file and the code disagree, the code wins.

- **Snapshot:** `main` at commit `3c09847` (11 Oct 2026), audited on branch `claude/upbeat-clarke-4771du`.
- **Scope:** all 94 `PuzzleType`s in `src/lib/duel/registry.ts` — 68 active, 26 retired (`RETIRED_TYPES`, practice only).
- **Sources:** `registry.ts`, `gameNames.ts`, `instructions.ts`, `types.ts`, `grade.ts`, `scoring.ts`, `stagedRounds.ts`, `speedPar.ts`, `generate.server.ts`, `arcade.server.ts`, each game's `src/puzzles/<game>.tsx`, `src/lib/duel/<game>*.ts` and `src/lib/arcade/<game>.ts`.

## How to read this

- **Name:** display name from `GAME_DISPLAY_NAMES` with the stable `PuzzleType` id in brackets.
- **Time limit:** the registry `timeLimitMs`. For types on the arcade clock (category `arcade` or `arcadeRun: true`) the sim run is the registry limit minus `ARCADE_PHASE_SLACK_MS` (3 s); I checked each sim's own `*_RUN_TICKS` / `runSeconds` and every one matches its registry figure.
- **Revision:** every new puzzle is stamped `speedPar: 1` by `generatePuzzle()` in `generate.server.ts`. Game-specific stamps are listed where they exist. Unstamped (older) rounds keep their original rules.
- **Speed bonus:** with `speedPar: 1`, `speedBonusCurve(max, left, limit)` pays the full bonus when at least half the limit is left, then falls evenly to 0 at the buzzer. Unstamped rounds use the old linear `max × left ÷ limit`. The arcade engine's `finishScore(run, tick)` = 130 + `speedBonusCurve(20, ticks left, run)`, capped at 150.
- **Shape B / C:** the shared fewest-moves scorer `scoreSolvedMoves()` in `scoring.ts`: B = 100 + MOVES(25) + SPEED(25); C = 100 + MOVES(40) + SPEED(10). MOVES(b, m, min) = round(b × clamp(1 − (m − min) ÷ min, 0, 1)).
- **Arcade units:** sims run at 60 ticks a second; positions and speeds are in 1/256 px (“FP”). Converted figures are given in px or seconds.
- **Intro text** is quoted from `PUZZLE_INSTRUCTIONS` as the app resolves it at runtime (each HOW line is the action and detail joined).

### Assumptions

- Board sizes and item counts come from the constants plus one generated sample of every type (run through `generatePuzzle()` from a scratch script outside the repo). Where a count is drawn from a range, the range is given.
- Input type is read from each Stage component, the intro text and the sim's input constants. Nothing was tested on a phone.
- “Bank size” is the length of the server-only bank array as loaded at runtime.
- I ran no `scripts/*-check.ts` checks: this is a documentation-only change and no code was touched.

## Totals

| Category | Active | Retired | Total |
|---|---:|---:|---:|
| Word | 6 | 3 | 9 |
| Number | 6 | 4 | 10 |
| Speed | 6 | 1 | 7 |
| Attention | 7 | 0 | 7 |
| Pattern | 7 | 3 | 10 |
| Logic | 14 | 2 | 16 |
| Arcade | 22 | 9 | 31 |
| Memory (dormant: `typesInCategory` returns none) | 0 | 4 | 4 |
| **All** | **68** | **26** | **94** |

Core categories (always drawn): Logic, Pattern, Speed, Attention, Word. Opt-in: Number. Arcade: at most one round, host toggle. `gameCounts()` therefore reports 46 puzzle games and 22 arcade games for marketing lines.

## Active games

### Word

#### Forage (`wordhunt`)

- **Category / status:** Word · Active
- **Time limit:** registry 100,000 ms (100 s); no sim run (not on the arcade clock)
- **Board and items:** 5×5 letter grid (`WORDHUNT_COLS`); boards need ≥ 40 words (`WORDHUNT_MIN_WORDS`)
- **Revision:** `speedPar: 1` only
- **Input:** Drag or tap through touching letters (8 directions); release, re-tap last letter or Submit
- **Scoring:** `scoreWordHunt()` in `src/lib/duel/scoring.ts`, via `gradeWordHunt()` in `src/lib/duel/wordHunt.server.ts` = 2 × word points, cap 150
- **Tuning:** Min length 4; word points 4=1, 5=2, 6=4, 7=7, 8+=11; plurals accepted; par share 0.35
- **Intro text:**
  - GOAL: “Find as many valid words as you can.”
  - HOW:
    - “Drag or tap through letters that touch, including diagonally.”
    - “Words must be at least 4 letters. Don't reuse a tile. Plurals count.”
    - “Release, tap the last letter again, or tap Submit to submit each word.”
    - “Words are checked against a standard British English dictionary.”
  - SCORE: “Round score = 2 × word points, up to 150. The counter shows word points.”

#### Interlock (`tilegrid`)

- **Category / status:** Word · Active
- **Time limit:** registry 100,000 ms (100 s); no sim run (not on the arcade clock)
- **Board and items:** 7×7 grid (`TG_SIZE`), 15 tiles (`TG_TILES`)
- **Revision:** `speedPar: 1` only
- **Input:** Tap a rack tile, then an empty cell (tap-only)
- **Scoring:** `scoreTileGrid()` in `src/lib/duel/tileGrid.ts`; speed from `wordSpeedBonus()` in `src/lib/duel/scoring.ts`
- **Tuning:** Valid 15-tile grid = 130 + up to 20 speed; otherwise 8 per tile in a real word
- **Intro text:**
  - GOAL: “Build a mini crossword from your tiles.”
  - HOW:
    - “Tap a tile, then a cell. Words must be at least 3 letters. Every run must be a real word, and all tiles must connect.”
    - “Double-tap a placed tile to take it back. Clear empties the grid.”
    - “Tap Done to check - red runs need fixing.”
    - “Words are checked against a standard British English dictionary.”
  - SCORE: “All fifteen tiles in a valid grid = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 8 per tile inside a real word.”

#### Lookout (`wordsearch`)

- **Category / status:** Word · Active
- **Time limit:** registry 120,000 ms (120 s); no sim run (not on the arcade clock)
- **Board and items:** 10×10 grid (`WS_SIZE`), 6 words (`WS_WORDS`)
- **Revision:** `speedPar: 1` only
- **Input:** Drag in a straight line (8 directions, backwards allowed)
- **Scoring:** `scoreWordSearch()` in `src/lib/duel/wordSearch.ts`
- **Tuning:** Bank: 500 boards across 26 categories (`wordSearchBank.server.ts`); 20 per word (cap 120); all six = 130 + up to 20; wrong selections not penalised; max 300 selections decoded
- **Intro text:**
  - GOAL: “Find the six hidden words from the category.”
  - HOW:
    - “Drag in a straight line through the letters in any direction, backwards too.”
    - “A found word gets a line through it and a filled chip. Only the count shows until you find them.”
  - SCORE: “20 per word. Find all six for 130 plus up to 20 speed points.”

#### Nucleus (`wordsmith`)

- **Category / status:** Word · Active
- **Time limit:** registry 100,000 ms (100 s); no sim run (not on the arcade clock)
- **Board and items:** 8, 9, 10 or 11 letters on round tiles (`WORDSMITH_SIZES`); centre letter at index 4; 25–60 / 30–80 / 40–100 / 50–120 possible words by size
- **Revision:** `speedPar: 1` only
- **Input:** Tap letter tiles in order, Enter to check (live server word check)
- **Scoring:** `scoreWordsmith()` in `src/lib/duel/scoring.ts`, via `gradeWordsmith()` in `src/lib/duel/wordsmith.server.ts` = floor(2.5 × word points), cap 150; `isCorrect` = points ≥ par
- **Tuning:** Min length 4; word points 4=1, 5=2, 6=4, 7=7, 8=11, 9+=15; plurals and -s verb forms rejected (`isPluralForm`); par = 35 % of all board points (`WORDSMITH_PAR_SHARE`)
- **Intro text:**
  - GOAL: “Make words from the 8-11 letters - the centre letter must be in every word.”
  - HOW:
    - “Words must be at least 4 letters. Use each letter once. There's always a word using every tile.”
    - “No plurals or -s verb forms (FINDS, BOXES); words like GLASS are fine.”
    - “Tap the round letter tiles in order Include the glowing centre letter. Tap a selected letter again to remove it. Clear empties the word; Enter checks it.”
    - “Shuffle rearranges the outer letters for free; the centre stays fixed.”
    - “Words are checked against a standard British English dictionary.”
  - SCORE: “Longer words score more: 8 letters = 11 word points; 9-11 letters = 15. Round score = floor(2.5 × word points), up to 150.”

#### Roundabout (`letterwheel`)

- **Category / status:** Word · Active
- **Time limit:** registry 100,000 ms (100 s); no sim run (not on the arcade clock)
- **Board and items:** Crossword of 8 or 9 slots on a grid up to 8×8; 6 or 7 wheel letters
- **Revision:** `speedPar: 1` only
- **Input:** Drag through wheel letters and release, or tap letters then Submit
- **Scoring:** `scoreLetterWheel()` in `src/lib/duel/letterWheel.ts`
- **Tuning:** Bank: 300 boards (36 eight-word/6-letter, 76 eight-word/7-letter, 81 nine-word/6-letter, 107 nine-word/7-letter); 15 per word on 8-word boards, 13 on 9-word; all = 130 + up to 20; max 400 words decoded
- **Intro text:**
  - GOAL: “Fill the crossword using the letters on the wheel.”
  - HOW:
    - “Drag through the letters and let go, or tap letters then Submit or the word.”
    - “Crossword words fill gold. Words must be at least 3 letters. Other real words are not in this puzzle.”
    - “Shuffle rearranges the wheel for free without changing the crossword.”
  - SCORE: “15 per word on eight-word puzzles, 13 on nine-word puzzles. Find them all for 130 plus up to 20 for speed: the full 20 if you finish with at least half the time left.”

#### Slider (`wordslide`)

- **Category / status:** Word · Active
- **Time limit:** registry 100,000 ms (100 s); no sim run (not on the arcade clock)
- **Board and items:** 5×5 letter grid (`WS_SIZE`), all 5 rows marked (`WS_MARKED_ROWS`)
- **Revision:** `speedPar: 1` only
- **Input:** Swipe rows sideways / columns up-down (wrap); Undo, Reset, padlock
- **Scoring:** `scoreWordSlide()` in `src/lib/duel/scoring.ts`
- **Tuning:** Par = number of scramble shifts used to build the board; complete = 100 + SPEED(30) + MOVES(20); otherwise 22 per word row; shift animation 120 ms
- **Intro text:**
  - GOAL: “Slide rows and columns until every row is a word.”
  - HOW:
    - “Swipe a row sideways or a column up and down - letters wrap around the edge. Words must be 5 letters.”
    - “Tap Undo or Reset to take shifts back; they still count as moves.”
    - “Lock a finished word with the padlock so it stays put - column swipes go around it.”
    - “Words are checked against a standard British English dictionary.”
  - SCORE: “All five rows words = 100 + up to 30 for speed: the full 30 if you finish with at least half the time left + up to 20 for moves (full at par, 0 at twice par). Otherwise 22 per word row.”

### Number

#### Counterweight (`balance`)

- **Category / status:** Number · Active
- **Time limit:** registry 90,000 ms (90 s); no sim run (not on the arcade clock)
- **Board and items:** 3 scales (`BAL_SCALES`), 8 numbered pegs per beam (`BAL_PEGS`)
- **Revision:** `speedPar: 1` only
- **Input:** Tap a kettlebell, then a beam notch; double-tap to return
- **Scoring:** `balanceRoundScore()` in `src/lib/duel/balance.ts`; solved count from `balanceSolvedCount()` (stops at the first unsolved scale)
- **Tuning:** Stage points 20 / 40 / 60 (`BAL_STAGE_POINTS`); all three = 120 + up to 30 speed; reveal 8 s
- **Intro text:**
  - GOAL: “Balance the scale.”
  - HOW:
    - “Tap a kettlebell, then a numbered beam notch. Further from the middle counts more - a 2 on peg 3 equals a 3 on peg 2.”
    - “Double-tap a placed kettlebell to return it to the tray.”
  - SCORE: “20, 40 and 60 for scales 1, 2 and 3. All three = 120 + up to 30 for speed: the full 30 if you finish with at least half the time left.”

#### Exact (`target`)

- **Category / status:** Number · Active
- **Time limit:** registry 75,000 ms (75 s); no sim run (not on the arcade clock)
- **Board and items:** 6 number tiles and a target
- **Revision:** `speedPar: 1` only
- **Input:** Tap two numbers, then an operation
- **Scoring:** `scoreTargetNumber()` in `src/lib/duel/scoring.ts`
- **Tuning:** Exact = 130 + up to 20; d ≤ 10: 120 − (d−1)(d+2)/2; d > 10: round(66 − 0.6(d−10)), 0 from d = 120
- **Intro text:**
  - GOAL: “Use the six numbers to reach the target.”
  - HOW:
    - “Tap two numbers then choose an operation.”
    - “Use each number at most once.”
    - “Keep every step to a whole number.”
  - SCORE: “Exact = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Off by 1 = 120, falling faster the further off; 120+ away scores 0.”

#### Integer Pyramid (`numpyramid`)

- **Category / status:** Number · Active
- **Time limit:** registry 120,000 ms (120 s); no sim run (not on the arcade clock)
- **Board and items:** 4 pyramids of 5 rows (15 cells); empty cells 6–7, 8–10, 10–12, 12–13; 2 decoy tiles (`NP_DECOYS`)
- **Revision:** `speedPar: 1` only
- **Input:** Drag tray tiles into cells; double-tap to return; drag to swap; Skip
- **Scoring:** `scoreNumberPyramid()` in `src/lib/duel/numberPyramid.ts`
- **Tuning:** Bank: 400 sets (`numberPyramidBank.server.ts`); 30 per completed pyramid; all four + up to 30 speed; current pyramid partial = round(30 × correct ÷ empty)
- **Intro text:**
  - GOAL: “Complete four pyramids: every cell is the sum of the two below it.”
  - HOW:
    - “Drag a tile from the tray into an empty cell.”
    - “Double-tap a placed tile to return it to the tray; drag it onto another cell to swap.”
    - “Two tiles are decoys - nothing fills itself in.”
    - “Skip moves to the next pyramid without completing this one.”
  - SCORE: “30 per completed pyramid, plus up to 30 for finishing all four early. The current pyramid earns proportional partial points.”

#### Operator (`equation`)

- **Category / status:** Number · Active
- **Time limit:** registry 90,000 ms (90 s); no sim run (not on the arcade clock)
- **Board and items:** 4 stages (`EQUATION_STAGE_COUNT`), each a number row with operator gaps
- **Revision:** `speedPar: 1`; legacy detected by stage count (3-stage rounds keep 30/40/50 + 30 speed)
- **Input:** Tap each gap to cycle operators; Next to skip
- **Scoring:** `scoreEquationStages()` in `src/lib/duel/stagedRounds.ts`
- **Tuning:** Stage points 25 / 30 / 35 / 40 (`EQUATION_STAGE_POINTS`); all four + up to 20 speed (`EQUATION_SPEED_POINTS`) against 90 s; strict left-to-right evaluation, whole non-negative steps only
- **Intro text:**
  - GOAL: “Make four increasingly difficult equations equal their targets.”
  - HOW:
    - “Tap each gap to choose an operator, worked left to right.”
    - “A true equation holds for 1 second, then moves on; the timer keeps running.”
    - “Press Next to skip ahead - 90 seconds for all four; the last uses division in a harder operator mix.”
  - SCORE: “Solved stages: 25 / 30 / 35 / 40. All four: 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise sum solved stage points. Maximum 150.”

#### Tenfall (`tendrop`)

- **Category / status:** Number · Active · runs on the arcade engine (`arcadeRun: true`)
- **Time limit:** registry 93,000 ms (93 s); sim run 90 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 360×520 world, 4 columns, tile 76×64; 10 targets
- **Revision:** `speedPar: 1` only (no game revision field)
- **Input:** Tap falling tiles (arcade engine, `arcadeRun: true`)
- **Scoring:** `tenDropScore()` in `src/lib/arcade/tenDrop.ts`, replayed on the server by `src/lib/duel/tenDrop.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Targets 19–25 ×3, 26–45 ×3, 46–80 ×2, 80–140 ×2; fall speed 288→504 (1/256 px/tick, +24 a stage); spawn gap 34→25 ticks; 13 per target (`pointsPerTarget`); clear bonus 20; ops mix: ×2, ÷2, ÷3, −N (N up to 3/4/5 by tier); 30-tick clear hold
- **Intro text:**
  - GOAL: “Make the running total hit the target exactly.”
  - HOW:
    - “Tap falling tiles - each one applies to the total in tap order.”
    - “×2, ÷2, ÷3 and −N work on the total; a ÷ that doesn't divide exactly is refused.”
    - “Go past the target and the total drops back to 0.”
  - SCORE: “13 per target cleared. All ten adds up to 20 for clearing them early.”

#### Trail (`trail`)

- **Category / status:** Number · Active
- **Time limit:** registry 120,000 ms (120 s); no sim run (not on the arcade clock)
- **Board and items:** 6×6 (`TR_SIZE`), path 1–36, 10 fixed givens (`TR_MIN_GIVENS` = `TR_MAX_GIVENS` = 10)
- **Revision:** `speedPar: 1` only
- **Input:** Tap next square (8-neighbour) or drag from path end; tap last square or drag back to undo
- **Scoring:** `scoreTrail()` in `src/lib/duel/trail.ts`
- **Tuning:** Bank: 300 boards (`trailBank.server.ts`); complete = 130 + up to 20; otherwise 5 per correct player tile, cap 130
- **Intro text:**
  - GOAL: “Draw one path from 1 to 36 through every square.”
  - HOW:
    - “Tap an empty square touching the path end to place the next number. Or drag from the end, including diagonals. Tap your last square to undo.”
    - “Ten dark numbers are fixed - the path must reach each one at exactly that step. You fill the other 26.”
    - “Undo removes your last square; Reset clears your path. Dragging back along the path also undoes. Fixed numbers stay.”
  - SCORE: “Complete path = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 5 per player tile in its correct cell; wrong tiles = 0, no penalty.”

### Speed

#### Ascend (`numhunt`)

- **Category / status:** Speed · Active
- **Time limit:** registry 60,000 ms (60 s); no sim run (not on the arcade clock)
- **Board and items:** 24 numbered circles (`NUMHUNT_COUNT`), 42 px; 4 layouts
- **Revision:** `speedPar: 1` only
- **Input:** Tap numbers in ascending order
- **Scoring:** `scoreNumberHunt()` in `src/lib/duel/scoring.ts`
- **Tuning:** Untapped numbers move every 15 s (`NUMHUNT_MOVE_MS`); 5 per number; all 24 = 130 + up to 20; −5 per wrong tap; cap 150
- **Intro text:**
  - GOAL: “Tap all 24 numbers from smallest to largest.”
  - HOW:
    - “Find the smallest remaining number.”
    - “Tap in order until every number is cleared.”
    - “Keep looking - untapped numbers move every 15 seconds.”
  - SCORE: “5 per number in order; all 24 = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left; −5 per wrong tap. Maximum 150.”

#### Bang On (`stopwatch`)

- **Category / status:** Speed · Active
- **Time limit:** registry 60,000 ms (60 s); no sim run (not on the arcade clock)
- **Board and items:** 10 watches (`STOPWATCH_ATTEMPTS`)
- **Revision:** `speedPar: 1` only
- **Input:** Tap to stop the marker
- **Scoring:** `scoreStopWatch()` in `src/lib/duel/scoring.ts`
- **Tuning:** Watch i allows i+2 right-edge arrivals (2 → 11); watches 8–10 wrap; 600 ms gap; miss = 500 ms; 150 at ≤ 20 ms average, −0.27 per ms
- **Intro text:**
  - GOAL: “Stop the marker in the gold zone - ten times, each one trickier.”
  - HOW:
    - “Tap to stop it.”
    - “Some targets move - stop when the marker and the target line up.”
    - “The counter drops at the right edge from 2 on Watch 1 to 11 on Watch 10.”
    - “Watches 8-10 wrap from the right edge back to the left.”
  - SCORE: “150 at 20 ms average error or closer, −27 per 100 ms more; misses count 500 ms.”

#### Bonk (`whack`)

- **Category / status:** Speed · Active · runs on the arcade engine (`arcadeRun: true`)
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 4×4 holes (`WHACK_COLS`)
- **Revision:** `speedPar: 1` only (no game revision field)
- **Input:** Tap (arcade engine, `arcadeRun: true`)
- **Scoring:** `whackScore()` in `src/lib/arcade/whack.ts`, replayed on the server by `src/lib/duel/whack.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Lifetimes 54→36 ticks (900→600 ms); pop gap 42→13 ticks ±6; max 3 up; bombs (hedgehogs) 10 %, none in first 5 s; 3–5 rule flips, ≥ 6 s apart, none in last 5 s; hit pool 135, wrong −3, bomb −5, empty −3, all-hit +15
- **Intro text:**
  - GOAL: “Tap gophers whose hard hats match the banner.”
  - HOW:
    - “Gophers pop up briefly - the window shrinks as the run goes on.”
    - “The rule flips 3-5 times at unpredictable moments - watch the banner.”
    - “Never tap a hedgehog - hedgehogs cost 5; a wrong-colour hat or an empty burrow costs 3.”
  - SCORE: “Up to 135 for the share of targets hit, −3 per wrong hat, −5 per hedgehog, −3 per empty tap, +15 for hitting every target. Maximum 150.”

#### Don't Break the Chain (`chain`)

- **Category / status:** Speed · Active
- **Time limit:** registry 45,000 ms (45 s); no sim run (not on the arcade clock)
- **Board and items:** 20 nodes per board (`CHAIN_NODES`), 8 boards of 5 links (`CHAIN_BOARDS`), 343×380 px board, 3 shapes × 4 colours
- **Revision:** `rulesVersion: 2` (`CHAIN_RULES_VERSION`); unversioned 25/30-link boards keep 6/5 points per link, no bonus, bands 10/18
- **Input:** Timed taps on charms
- **Scoring:** `scoreChain()` in `src/lib/duel/scoring.ts` → `chainScore()` in `src/lib/duel/chain.ts`
- **Tuning:** 40 links (`CHAIN_LENGTH`); 3.5 per link; finish bonus 10; momentum 3 s (links 1–13), 2.5 s (14–26), 2 s (27–40); warning tick in last 500 ms; cycle length 3
- **Intro text:**
  - GOAL: “Tap 40 charms in order, following the repeating cycle - shape and colour must both match. Each right tap adds a link to the chain.”
  - HOW:
    - “Follow the cycle at the top; the lit item is the one you need next.”
    - “Keep momentum - tap again before the gold ring empties (3 s for links 1-13, 2.5 s for 14-26, 2 s for 27-40). The first tap is untimed.”
    - “One wrong tap or an empty ring breaks the chain and ends the round.”
    - “Every 5 links the board reshuffles with a new cycle and order. Watch for look-alikes: right shape, wrong colour.”
  - SCORE: “Unfinished: floor(3.5 × links). All 40: 140 + up to 10 for speed: the full 10 if you finish with at least half the time left. Maximum 150; round lasts 45 s.”

#### Flash (`reaction`)

- **Category / status:** Speed · Active
- **Time limit:** registry 60,000 ms (60 s); no sim run (not on the arcade clock)
- **Board and items:** 5–8 gold flashes plus coloured decoys
- **Revision:** `speedPar: 1` only
- **Input:** Tap the screen
- **Scoring:** `scoreReaction()` in `src/lib/duel/scoring.ts`
- **Tuning:** Flash shown 1,500 ms; miss counts 1,200 ms; false start window 200 ms; decoys 600 ms; 150 at ≤ 200 ms average, −0.16 per ms; −8 per false start
- **Intro text:**
  - GOAL: “Tap the instant the screen turns gold - five to eight times.”
  - HOW:
    - “Wait.”
    - “Don't tap the other colours, or you'll get a false start.”
  - SCORE: “150 at 200 ms average or faster, −16 per 100 ms slower; misses count 1,200 ms; −8 per false start.”

#### Pull! (`clayshoot`)

- **Category / status:** Speed · Active · runs on the arcade engine (`arcadeRun: true`)
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 360×400 world; 25 clays (22 orange, 3 gold); 10–12 birds (rev 3)
- **Revision:** `clayRev: 3` (`CLAY_REV`); rev 2 = 3–4 birds; unstamped = clay-only sim and score
- **Input:** Tap to shoot (shot lands where tapped; arcade engine, `arcadeRun: true`)
- **Scoring:** `clayScore()` in `src/lib/arcade/clayShoot.ts`, replayed on the server by `src/lib/duel/clayShoot.ts` from `src/lib/duel/grade.ts`
- **Tuning:** 11 singles then 7 pairs; orange 5, gold 10, perfect bonus 10, bird −10; hit radius orange 30 px / gold 24 px; every path ≥ 240 px wide coverage and ≥ 36 ticks (0.6 s) on screen; bird speed 760–1080, gap 300 ± 60 ticks
- **Intro text:**
  - GOAL: “Shoot all 25 clays out of the sky without hitting a bird.”
  - HOW:
    - “Tap a clay to fire - the shot lands exactly where you tap.”
    - “Unlimited shots, no reload.”
    - “Gold clays are faster and harder and worth twice as much.”
    - “Later on, two fly at once - keep watching both edges.”
    - “Don't shoot the birds - each one costs 10.”
  - SCORE: “5 per orange, 10 per gold, −10 per bird. Hit all 25 with zero birds hit for +10. Maximum 150; minimum 0.”

### Attention

#### Double Take (`spotdiff`)

- **Category / status:** Attention · Active
- **Time limit:** registry 30,000 ms (30 s); no sim run (not on the arcade clock)
- **Board and items:** Two 8×6 panels (`SPOT_COLS`×`SPOT_ROWS`), 6 differences
- **Revision:** `speedPar: 1` only
- **Input:** Tap a cell in either panel
- **Scoring:** `scoreSpotDifference()` in `src/lib/duel/scoring.ts`
- **Tuning:** 20 per difference; all six = 130 + up to 20
- **Intro text:**
  - GOAL: “Find all six differences between the two sweet-shop pictures.”
  - HOW:
    - “Compare both panels carefully.”
    - “Tap each difference in either panel.”
  - SCORE: “Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 20 per difference found.”

#### Eagle Eye (`symscan`)

- **Category / status:** Attention · Active
- **Time limit:** registry 30,000 ms (30 s); no sim run (not on the arcade clock)
- **Board and items:** 3 grids of 5×5, 6×6, 7×7 (`SYMSCAN_STAGE_COLS`); 5–9 targets each
- **Revision:** `speedPar: 1` only
- **Input:** Tap matches, Submit per grid
- **Scoring:** `scoreSymbolScanStages()` in `src/lib/duel/stagedRounds.ts`
- **Tuning:** Stage weights 30 / 45 / 55 × found share, −3 per wrong tap (floored at 0 per stage); all perfect + up to 20
- **Intro text:**
  - GOAL: “Find every matching eagle in three growing grids.”
  - HOW:
    - “Tap every match of each grid's target eagle direction.”
    - “Press Submit to lock each grid and move on - 30 seconds for all three.”
  - SCORE: “Stages worth 30 / 45 / 55: share of eagles found, −3 per wrong tap. All three perfect adds up to 20 for speed: the full 20 if you finish with at least half the time left.”

#### Interloper (`intruder`)

- **Category / status:** Attention · Active
- **Time limit:** registry 75,000 ms (75 s); no sim run (not on the arcade clock)
- **Board and items:** 5 boards of 3×3 guests; changes 1, 1, 2, 2, 2; 3/4/4/5/5 colours and 2/3/4/4/4 shapes
- **Revision:** `speedPar: 1` only
- **Input:** Tap changed guests
- **Scoring:** `scoreIntruder()` in `src/lib/duel/scoring.ts`
- **Tuning:** Per board: card 1 s, show 7 s, blank 1 s, pick 5 s, hold 1 s = 15 s (×5 = 75 s); boards 4–5 shift positions (`perm`); 24 per board, 12 for half a two-change board; all = 130 + up to 20
- **Intro text:**
  - GOAL: “Find every party guest who changed.”
  - HOW:
    - “Memorise the guests before the lights dim - head shape and colour.”
    - “Tap every changed guest - later boards contain two.”
    - “Five rounds - 7 s to memorise, 5 s to pick; on the last two the guests swap places around the party.”
  - SCORE: “Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 24 per board right; one of two changes earns 12.”

#### Labyrinth (`maze`)

- **Category / status:** Attention · Active
- **Time limit:** registry 60,000 ms (60 s); no sim run (not on the arcade clock)
- **Board and items:** 19×19 maze (`MAZE_COLS`)
- **Revision:** `speedPar: 1` only
- **Input:** Drag through passages, or the arrow pad
- **Scoring:** `scoreMaze()` in `src/lib/duel/scoring.ts`
- **Tuning:** Route ≥ 70 cells, ≥ 72 turns, ≥ 8 dead ends ≥ 5 long, ≥ 3 dead ends ≥ 11 long, ≥ 14 junctions; partial 110 × progress
- **Intro text:**
  - GOAL: “Draw a path from the start to the exit.”
  - HOW:
    - “Drag through passages one neighbouring cell at a time.”
    - “Follow the corridors without crossing walls.”
    - “Reach the exit to finish.”
  - SCORE: “Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 110 × share of the route reached.”

#### Matchmaker (`pairmatch`)

- **Category / status:** Attention · Active
- **Time limit:** registry 90,000 ms (90 s); no sim run (not on the arcade clock)
- **Board and items:** 30 cards, 15 pairs (`PAIR_PAIRS`)
- **Revision:** `speedPar: 1` only
- **Input:** Tap two cards
- **Scoring:** `scorePairMatch()` in `src/lib/duel/scoring.ts`
- **Tuning:** Flip-back 600 ms; 8 per pair; complete = 130 + up to 20 (`PAIR_CLEAN_BONUS`/`PAIR_CLEAN_FLIPS` defined but not used by the scorer)
- **Intro text:**
  - GOAL: “Find all fifteen matching pairs.”
  - HOW:
    - “Tap two cards to turn them over.”
    - “A match stays up - a miss flips back.”
    - “Remember where everything was.”
  - SCORE: “Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 8 per pair found.”

#### Mixed Signals (`stroop`)

- **Category / status:** Attention · Active · runs on the arcade engine (`arcadeRun: true`)
- **Time limit:** registry 78,000 ms (78 s); sim run 75 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 390×560 world; 52-word queue (`CLASH_QUEUE`); 3 lanes, 4 from 30 s; 8 colour names
- **Revision:** `clashRev: 3` (`CLASH_REV`) + `queue: 52`; variants: 3 = 75 s five phases, 2 = 52 words/60 s, 1 = 18 words, 0 = open stream
- **Input:** ◀ ▶ / joystick / tap lane; swipe down or ▼ to drop (arcade engine, `arcadeRun: true`)
- **Scoring:** `clashQueueScoreOf()` in `src/lib/arcade/colourClash.ts`, replayed on the server by `src/lib/duel/colourClash.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Run 75 s (`CLASH_REV3_RUN_TICKS`); five 15 s phases, word fall 1.8 / 1.6 / 1.4 / 1.2 / 1.0 s; rule flips every 15 s; round(130 × correct ÷ 52) − 2 per wrong + up to 20 when all sorted
- **Intro text:**
  - GOAL: “Steer all 52 falling words into the matching coloured gates.”
  - HOW:
    - “Use ◀ ▶, the joystick, or tap a lane to steer the word.”
    - “Swipe down or press ▼ to drop it quickly.”
    - “Watch the banner - the rule swaps every 15 seconds.”
    - “Sort the last word to finish - the run ends when all 52 are sorted, or at 75 seconds.”
  - SCORE: “round(130 × correct ÷ 52) − 2 per wrong gate; sort all 52 for + up to 20 for speed: the full 20 if you finish with at least half the time left. Minimum 0, maximum 150.”

#### Tally (`countup`)

- **Category / status:** Attention · Active
- **Time limit:** registry 45,000 ms (45 s); no sim run (not on the arcade clock)
- **Board and items:** 3 trays of 50 / 80 / 110 shapes (`COUNTUP_STAGE_SIZES`), placed freely (stored `cols: 10, rows: 10`); answer 6–12 matches
- **Revision:** `speedPar: 1` only
- **Input:** Keypad entry per tray, ENTER moves on
- **Scoring:** `scoreCountUpStages()` in `src/lib/duel/stagedRounds.ts`
- **Tuning:** Stage weights 30 / 45 / 55 (`STAGE_WEIGHTS_3`); off by 1 = 60 %, by 2 = 30 %; all exact + up to 20 speed; 7 colours (stored BROWN is drawn and named white)
- **Intro text:**
  - GOAL: “Count the matching shapes in three crowded display trays.”
  - HOW:
    - “Read the question - each tray asks for a new shape and colour (red, blue, green, purple, pink, orange or white).”
    - “Type the total on the keypad; ENTER moves to the next field.”
    - “Three scenes share 45 seconds.”
  - SCORE: “Stages worth 30 / 45 / 55: exact = full, off by 1 = 60%, off by 2 = 30%. All three exact adds up to 20 for speed: the full 20 if you finish with at least half the time left.”

### Pattern

#### Gridlock (`unblock`)

- **Category / status:** Pattern · Active
- **Time limit:** registry 60,000 ms (60 s); no sim run (not on the arcade clock)
- **Board and items:** 7×7 (`UNBLOCK_COLS`), exit row 2; ~14 vehicles
- **Revision:** `speedPar: 1` only
- **Input:** Drag blocks along their axis
- **Scoring:** `scoreUnblock()` in `src/lib/duel/scoring.ts` (shape B)
- **Tuning:** Bank: 400 layouts (`unblockBank.server.ts`); unfinished round(70 × 0.9 × blocker share) or 10 for fewer blockers, cap 70
- **Intro text:**
  - GOAL: “Slide the gold block through the exit.”
  - HOW:
    - “Drag each block only along its own direction.”
    - “Clear a path for the gold block.”
    - “Slide the gold block out through the opening.”
  - SCORE: “Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed: the full 25 if you finish with at least half the time left. Unfinished: up to 70 for clearing the gold block's lane.”

#### Jumbled (`tiles`)

- **Category / status:** Pattern · Active
- **Time limit:** registry 60,000 ms (60 s); no sim run (not on the arcade clock)
- **Board and items:** 3×3, 8 tiles (`TILES_SIZE`)
- **Revision:** `speedPar: 1` only
- **Input:** Tap a tile next to the gap; Undo, Reset
- **Scoring:** `scoreTiles()` in `src/lib/duel/scoring.ts` (shape B)
- **Tuning:** Minimum 10–16 moves; unfinished 14 per tile in place, cap 90
- **Intro text:**
  - GOAL: “Slide the tiles into order, 1 to 8.”
  - HOW:
    - “Tap a tile next to the gap to slide it in.”
    - “Finish left to right with the gap bottom-right.”
    - “Tap Undo or Reset to take slides back.”
  - SCORE: “Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed: the full 25 if you finish with at least half the time left. Unfinished: 14 per tile in place, up to 90.”

#### Lightbender (`laser`)

- **Category / status:** Pattern · Active
- **Time limit:** registry 60,000 ms (60 s); no sim run (not on the arcade clock)
- **Board and items:** 10×10 (`LASER_COLS`); 7–8 mirrors + 1 splitter; 6 gems (2 directional); 3–4 bombs; 18–26 blocks
- **Revision:** `speedPar: 1` only
- **Input:** Drag pieces onto squares; tap to rotate; FIRE
- **Scoring:** `scoreLaser()` in `src/lib/duel/scoring.ts`
- **Tuning:** 3 shots; fire 1/2/3 = 130/115/100 + up to 20; 15 per gem lit; 7–8 bends; beam 600 ms, fade 1.5 s
- **Intro text:**
  - GOAL: “Place mirrors and a splitter to light all six gems with one shot.”
  - HOW:
    - “Place your pieces - drag mirrors and the splitter onto empty squares.”
    - “Tap a piece to turn it. The splitter forks the beam across its input axis.”
    - “Tap FIRE to shoot - you get three shots and must avoid bombs.”
    - “Follow gem arrows - marked gems only light from that direction.”
  - SCORE: “Every gem on fire 1 / 2 / 3 = 130 / 115 / 100, + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 15 per gem lit; never fired = 0.”

#### Skid (`iceslide`)

- **Category / status:** Pattern · Active
- **Time limit:** registry 90,000 ms (90 s); no sim run (not on the arcade clock)
- **Board and items:** 12×12 (`SLIDE_COLS`); 30–44 walls, 2–4 holes, 1–3 arrows, 1–2 portal pairs, 3–5 thin-ice cells
- **Revision:** `speedPar: 1` only
- **Input:** Swipe or arrow pad
- **Scoring:** `scoreIceSlide()` in `src/lib/duel/scoring.ts` (shape B)
- **Tuning:** Minimum 18–26 moves; ≥ 5 stoppers; unfinished up to 90 × distance closed
- **Intro text:**
  - GOAL: “Slide the ball safely to the exit.”
  - HOW:
    - “Swipe a direction to slide until something stops you.”
    - “Follow one-way arrows that turn the ball; avoid holes or restart.”
    - “Portals carry you across the board. Cracked ice breaks after you cross it once.”
  - SCORE: “Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed: the full 25 if you finish with at least half the time left. Unfinished: up to 90 for the distance closed.”

#### Tessellate (`blockparty`)

- **Category / status:** Pattern · Active
- **Time limit:** registry 60,000 ms (60 s); no sim run (not on the arcade clock)
- **Board and items:** 6×6 board (`BLOCK_COLS`), 7 fixed pegs (`BLOCK_BLOCKERS`), 9 pieces
- **Revision:** `speedPar: 1` only
- **Input:** Tap a piece to rotate; drag its anchor onto the board
- **Scoring:** `scoreBlockParty()` in `src/lib/duel/scoring.ts`
- **Tuning:** 12 per legal piece placed; complete = 130 + up to 20
- **Intro text:**
  - GOAL: “Fill every free board square with all nine pieces.”
  - HOW:
    - “Tap a piece to rotate it.”
    - “Drag its anchor onto a free board square.”
    - “Fit every piece around the fixed pegs.”
  - SCORE: “Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 12 per piece placed.”

#### Topsy-Turvy (`gravity`)

- **Category / status:** Pattern · Active
- **Time limit:** registry 90,000 ms (90 s); no sim run (not on the arcade clock)
- **Board and items:** 9×9 (`GRAV_COLS`), 4 balls, 14–22 walls
- **Revision:** `speedPar: 1` only
- **Input:** Arrow pad ▲ ▼ ◀ ▶ (no swipe handler)
- **Scoring:** `scoreGravity()` in `src/lib/duel/scoring.ts` (shape B)
- **Tuning:** Minimum 8–14 tilts; solver cap 400,000 nodes; 30 per locked ball
- **Intro text:**
  - GOAL: “Tilt the board to park all four balls on their own targets.”
  - HOW:
    - “Every ball slides until it hits something.”
    - “A ball on its target locks and becomes a wall - which can help or hurt the others.”
  - SCORE: “Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed: the full 25 if you finish with at least half the time left. Unfinished: 30 per locked ball.”

#### Turntable (`rings`)

- **Category / status:** Pattern · Active
- **Time limit:** registry 60,000 ms (60 s); no sim run (not on the arcade clock)
- **Board and items:** 5 rings × 8 segments, 4 colours (`RINGS_COUNT`, `RINGS_SEGMENTS`, `RINGS_COLOURS`)
- **Revision:** `speedPar: 1` only (`pattern` index into the shared link bank)
- **Input:** Tap a ring, then arrow buttons
- **Scoring:** `scoreRings()` in `src/lib/duel/scoring.ts` (shape B)
- **Tuning:** Minimum 7–12 turns; scramble 8–14; 12 per aligned spoke; turn animation 150 ms
- **Intro text:**
  - GOAL: “Turn the record's rings so every spoke is one colour.”
  - HOW:
    - “Tap a ring - it glows and the needle touches its edge - then use the arrow buttons to turn it.”
    - “Check the legend - some rings turn others with them, same way or opposite.”
    - “Watch the strobe dots around the platter - one lights for each finished spoke.”
  - SCORE: “Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed: the full 25 if you finish with at least half the time left. Unfinished: 12 per aligned spoke.”

### Logic

#### Blackout (`lightsout`)

- **Category / status:** Logic · Active
- **Time limit:** registry 75,000 ms (75 s); no sim run (not on the arcade clock)
- **Board and items:** 6×6 (`LIGHTS_COLS`)
- **Revision:** `speedPar: 1` only
- **Input:** Tap a light
- **Scoring:** `scoreLightsOut()` in `src/lib/duel/scoring.ts` (shape B)
- **Tuning:** Built from 8–12 presses, ≥ 6 lights on; unfinished 1/2/3/4 left = 85/75/60/50, else 5 per standing solution tap (cap 45)
- **Intro text:**
  - GOAL: “Turn every light off.”
  - HOW:
    - “Tap a light to flip it and its four neighbours.”
    - “Plan each press because nearby lights also change.”
  - SCORE: “Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed: the full 25 if you finish with at least half the time left. Unfinished: 1-4 lights left = 85 / 75 / 60 / 50.”

#### Bomb Defusal (`bomb`)

- **Category / status:** Logic · Active
- **Time limit:** registry 75,000 ms (75 s); no sim run (not on the arcade clock) — stamped v2 puzzles carry their own `timeLimitMs: 90000`, which wins over the registry (`puzzleTimeLimitMs`)
- **Board and items:** 7 wires (`BOMB_WIRES`), 2 buttons, light, serial, switch; v2: 6 rule cards, 6 steps
- **Revision:** `bombVersion: 2` (`BOMB_V2`) + own `timeLimitMs: 90000`; unstamped = 4-step rules, 25 per step, 75 s
- **Input:** Tap wires and buttons, then DEFUSE
- **Scoring:** `scoreBomb()` in `src/lib/duel/scoring.ts`
- **Tuning:** Bank: 300 v2 panels (`bombBank.server.ts`), proved over all 60,480 six-action sequences; unfinished round(75 × correct prefix ÷ 6)
- **Intro text:**
  - GOAL: “Read every rule, work out the six actions and their order, then do them.”
  - HOW:
    - “Only one plan fits the rules together allow exactly one six-action sequence, and every rule is needed. Wires are numbered 1-7 from the left.”
    - “Six steps exactly tap wires and buttons, then tap DEFUSE.”
    - “One wrong step and it explodes.”
  - SCORE: “Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 75 × correct steps before the strike ÷ 6, rounded (up to 75).”

#### Box Six (`sudoku`)

- **Category / status:** Logic · Active
- **Time limit:** registry 90,000 ms (90 s); no sim run (not on the arcade clock)
- **Board and items:** 6×6 with 2×3 boxes, 14–16 givens
- **Revision:** `speedPar: 1` only
- **Input:** Tap a cell, then a number; pencil marks
- **Scoring:** `scoreSudoku()` in `src/lib/duel/scoring.ts`
- **Tuning:** Unfinished round(110 × correct ÷ empty cells)
- **Intro text:**
  - GOAL: “Fill the grid with every row, column, and box valid.”
  - HOW:
    - “Tap an empty cell then choose a number.”
    - “Use 1 to 6 once in each row, column, and box.”
    - “Use pencil marks for optional notes.”
  - SCORE: “Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 110 × correct cells ÷ empty cells.”

#### Chroma Lines (`flow`)

- **Category / status:** Logic · Active
- **Time limit:** registry 75,000 ms (75 s); no sim run (not on the arcade clock)
- **Board and items:** 9×9 (`FLOW_COLS`), 10–12 pairs, 2–4 walls
- **Revision:** `speedPar: 1` only
- **Input:** Drag from a dot to its partner
- **Scoring:** `scoreFlow()` in `src/lib/duel/scoring.ts`
- **Tuning:** Paths ≥ 3 cells, each bends ≥ once; uniqueness proved by exhaustive solver (node budget 60,000), up to 3,000 attempts; 10 per pair joined
- **Intro text:**
  - GOAL: “Connect every colour pair and fill every square.”
  - HOW:
    - “Drag from a dot to its matching partner.”
    - “Avoid dark walls - no path can enter them.”
    - “Fill every square with a coloured path.”
    - “Keep paths separate because they cannot cross.”
  - SCORE: “Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 10 per pair joined.”

#### Colour Flood (`flood`)

- **Category / status:** Logic · Active
- **Time limit:** registry 60,000 ms (60 s); no sim run (not on the arcade clock)
- **Board and items:** 14×14 (`FLOOD_SIZE`), 5 colours
- **Revision:** `speedPar: 1` only
- **Input:** Tap a colour
- **Scoring:** `scoreFlood()` in `src/lib/duel/scoring.ts` (shape C)
- **Tuning:** Bank: 400 boards (`floodBank.server.json`); par 10–15; solved 100 + MOVES(40) + SPEED(10); unfinished 110 × region ÷ 196
- **Intro text:**
  - GOAL: “Flood the whole board with one colour of paint.”
  - HOW:
    - “Tap a colour to repaint your wet region.”
    - “Your region grows into every touching cell of that colour.”
    - “Start from the top-left - that cell is always yours.”
  - SCORE: “Solved = 100 + up to 40 for moves (full at par, 0 at twice par) + up to 10 for speed: the full 10 if you finish with at least half the time left. Otherwise 110 × region ÷ 196.”

#### Hanoi (`tower`)

- **Category / status:** Logic · Active
- **Time limit:** registry 90,000 ms (90 s); no sim run (not on the arcade clock) — stored puzzle also carries `timeLimitMs: 90000`
- **Board and items:** 9 discs (`TOWER_DISCS`) on 3 or 4 pegs (50/50); stored puzzle carries `timeLimitMs: 90000`
- **Revision:** `speedPar: 1` only
- **Input:** Tap a post to lift, another to place
- **Scoring:** `scoreTower()` in `src/lib/duel/scoring.ts` (shape B)
- **Tuning:** Minimum 20–40 moves (`TOWER_MIN_MINIMUM`–`TOWER_MAX_MINIMUM`); unfinished 110 × discs home from the bottom ÷ 9
- **Intro text:**
  - GOAL: “Move the full tower onto the gold-based post.”
  - HOW:
    - “Tap a post to lift its top ring.”
    - “Tap another post to place that ring.”
    - “Keep smaller rings above larger rings at all times - colour shows size.”
    - “Count the posts - each puzzle has 3 or 4.”
  - SCORE: “Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed: the full 25 if you finish with at least half the time left. Unfinished: 110 × rings home from the bottom ÷ rings.”

#### Heave (`push`)

- **Category / status:** Logic · Active
- **Time limit:** registry 120,000 ms (120 s); no sim run (not on the arcade clock)
- **Board and items:** 9×9 (`PUSH_COLS`), 4–5 crates
- **Revision:** `speedPar: 1` only
- **Input:** Swipe or arrow pad, one square a step
- **Scoring:** `scorePush()` in `src/lib/duel/scoring.ts` (shape B)
- **Tuning:** Bank: 120 levels (`PUSH_BANK_SIZE`); 16–30 minimum pushes; unfinished 110 × crates home ÷ crates
- **Intro text:**
  - GOAL: “Push every crate onto a hatched floor marking.”
  - HOW:
    - “Move the worker one square at a time.”
    - “Push one crate by walking into it.”
    - “Plan ahead because crates cannot be pulled.”
  - SCORE: “Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed: the full 25 if you finish with at least half the time left. Unfinished: 110 × crates home ÷ crates.”

#### Lamplighter (`lightup`)

- **Category / status:** Logic · Active
- **Time limit:** registry 90,000 ms (90 s); no sim run (not on the arcade clock)
- **Board and items:** 9×9 (`LIGHTUP_SIZE`), 18–23 walls, about half numbered
- **Revision:** `speedPar: 1` only
- **Input:** Tap to place / remove a bulb
- **Scoring:** `scoreLightUp()` in `src/lib/duel/lightUp.ts`
- **Tuning:** Uniqueness proved; unfinished round(110 × lit ÷ white) − 5 per clashing bulb
- **Intro text:**
  - GOAL: “Place bulbs so every white square is lit.”
  - HOW:
    - “A bulb lights everything in its row and column until it hits a black wall.”
    - “Bulbs must never shine on each other.”
    - “A number on a wall says exactly how many bulbs touch that wall's sides.”
  - SCORE: “Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 110 × lit cells ÷ white cells, −5 per clashing bulb.”

#### Mosaic (`nonogram`)

- **Category / status:** Logic · Active
- **Time limit:** registry 120,000 ms (120 s); no sim run (not on the arcade clock)
- **Board and items:** 7×7 (`NONO_SIZE`), 18–30 filled cells
- **Revision:** `speedPar: 1` only
- **Input:** Tap to fill / mark empty
- **Scoring:** `scoreNonogram()` in `src/lib/duel/scoring.ts`
- **Tuning:** Unfinished round(110 × correct ÷ cells) − 5 per wrong, cap 110
- **Intro text:**
  - GOAL: “Fill the grid so every row and column matches its numbers.”
  - HOW:
    - “Tap to fill a cell, tap again to mark it empty.”
    - “Read the numbers as the lengths of the filled runs, in order.”
    - “A line dims once it matches its numbers.”
  - SCORE: “Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 110 × correct cells ÷ cells, −5 per wrong cell, up to 110.”

#### Pipeline (`pipes`)

- **Category / status:** Logic · Active
- **Time limit:** registry 120,000 ms (120 s); no sim run (not on the arcade clock)
- **Board and items:** 7×7 (`PIPES_COLS`), one source
- **Revision:** `speedPar: 1` only
- **Input:** Tap a tile to rotate
- **Scoring:** `scorePipes()` in `src/lib/duel/scoring.ts`
- **Tuning:** Unfinished steps: 48 = 90, 45–47 = 85, −5 per two tiles to 40 at 27, below 27 = 1.5 each
- **Intro text:**
  - GOAL: “Connect every pipe to the source with no leaks.”
  - HOW:
    - “Tap a tile to rotate its pipe.”
    - “Join every opening to another pipe or the source.”
    - “Leave no leaks at the grid edges.”
  - SCORE: “Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 48 = 90, 47-45 = 85, then 5 less per two tiles down to 40 at 27; fewer score 1.5 each.”

#### Polypotions (`tubes`)

- **Category / status:** Logic · Active
- **Time limit:** registry 90,000 ms (90 s); no sim run (not on the arcade clock)
- **Board and items:** 10 flasks (`TUBES_COUNT`), capacity 5, 8 colours
- **Revision:** `speedPar: 1` only
- **Input:** Tap a flask, then where to pour; Undo, Reset
- **Scoring:** `scoreTubes()` in `src/lib/duel/scoring.ts` (shape B)
- **Tuning:** Scramble 60–90; minimum 16–26 moves; BFS cap 1,000,000; unfinished 22 per sorted flask, cap 110
- **Intro text:**
  - GOAL: “Sort the potions so every flask is one colour.”
  - HOW:
    - “Tap a flask to lift its top layers.”
    - “Tap where to pour - onto the same colour or an empty flask; as many layers move as fit (5 per flask). A full one-colour flask gets a cork.”
    - “Undo or Reset if a pour traps you.”
  - SCORE: “Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed: the full 25 if you finish with at least half the time left. Unfinished: 22 per corked flask.”

#### Safe Cracker (`safe`)

- **Category / status:** Logic · Active
- **Time limit:** registry 75,000 ms (75 s); no sim run (not on the arcade clock)
- **Board and items:** 4 dials 0–9 (`SAFE_DIALS`), 5 clues (`SAFE_CLUE_COUNT`)
- **Revision:** `speedPar: 1` only
- **Input:** Arrow buttons (or swipe) per dial, TRY
- **Scoring:** `scoreSafe()` in `src/lib/duel/scoring.ts`
- **Tuning:** 3 tries; try 1/2/3 = 130/115/100 + up to 20; else 15 per dial right on the last try
- **Intro text:**
  - GOAL: “Find the four-digit combination that fits every clue.”
  - HOW:
    - “Use the arrows to set each dial.”
    - “Tap TRY to test - you get three tries.”
    - “Read every clue because only one combination fits them all.”
  - SCORE: “Opened on try 1 / 2 / 3 = 130 / 115 / 100, + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 15 per dial right on the last try.”

#### Shikaku (`shikaku`)

- **Category / status:** Logic · Active
- **Time limit:** registry 90,000 ms (90 s); no sim run (not on the arcade clock)
- **Board and items:** 10×10 (`SHIKAKU_SIZE`), 18–22 rectangles, ≥ 4 of area 6+
- **Revision:** `speedPar: 1` only
- **Input:** Drag corner to corner
- **Scoring:** `scoreShikaku()` in `src/lib/duel/shikaku.ts`
- **Tuning:** ≥ 3 equal-area adjacent pairs; uniqueness proved; unfinished round(110 × covered ÷ 100)
- **Intro text:**
  - GOAL: “Cut the grid into rectangles, one number each.”
  - HOW:
    - “Drag from corner to corner to draw a rectangle.”
    - “Each rectangle must hold exactly one number, and that number is its size in squares.”
    - “Cover every square.”
  - SCORE: “Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 110 × cells covered ÷ 100.”

#### Tents and Trees (`tents`)

- **Category / status:** Logic · Active
- **Time limit:** registry 90,000 ms (90 s); no sim run (not on the arcade clock)
- **Board and items:** 8×8 (`TENTS_SIZE`), 11–12 trees; 11 of 16 row/column counts hidden (`-1`)
- **Revision:** `speedPar: 1` only
- **Input:** Tap cycles tent → grass → clear
- **Scoring:** `scoreTents()` in `src/lib/duel/tents.ts`
- **Tuning:** Uniqueness proved; full score only when tents match the stored solution exactly with no wrong tents; else 10 per correct tent, cap 110
- **Intro text:**
  - GOAL: “Pitch one tent beside every tree.”
  - HOW:
    - “Tap a cell for a tent, again for a grass tuft, again to clear.”
    - “Tents can't touch, even diagonally.”
    - “The signposts say how many tents are in each row and column.”
  - SCORE: “Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 10 per correct tent; wrong tents cost nothing.”

### Arcade

#### Ball Tracker (`balltrack`)

- **Category / status:** Arcade · Active · runs on the arcade engine (`arcadeRun: true`)
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 7 cols × 9 rows of track (`BT_COLS`×`BT_ROWS`), 30 balls, hopper column 3
- **Revision:** `speedPar: 1` only (no game revision field)
- **Input:** Tap gold tubes to rotate them
- **Scoring:** `btScoreOf()` in `src/lib/arcade/ballTrack.ts`, replayed on the server by `src/lib/duel/ballTrack.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Bank: 400 courses, all tier 3; drop every 103 ticks (last at 49.8 s); step 16 ticks; mid-run re-lay and tray shuffle (seeded ticks); 130 × home ÷ 30; all home = `finishScore()`
- **Intro text:**
  - GOAL: “Steer every ball into the tray of its colour.”
  - HOW:
    - “30 balls drop about every 1.72 seconds - the last is released at about 50 seconds; the run lasts 60 seconds.”
    - “Tap a gold tube to turn it into a drop - the bottom row is fixed, so send each ball down early…”
    - “…the track's bottom row re-lays and the trays swap colours mid-round - watch for both.”
  - SCORE: “round(130 × marbles home ÷ 30), plus round(20 × sim time left ÷ 60 s) only when all 30 are home. Cap 150. Wrong trays have no penalty.”

#### Breaker (`breaker`)

- **Category / status:** Arcade · Active
- **Time limit:** registry 93,000 ms (93 s); sim run 90 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 8×10 bricks = 80 (`BRK_BRICKS`); 10–15 three-hit, 20–30 two-hit bricks
- **Revision:** `speedPar: 1` only
- **Input:** Drag paddle; tap anywhere fires a held laser or ×5
- **Scoring:** `score()` in `src/lib/arcade/breaker.ts`, replayed on the server by `src/lib/duel/breaker.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Run 90 s; power bricks: 1 laser, 1 ×5 (5 shots), 2 ×2; max 8 balls; ball speed 1024 → cap 1920 (+26 per brick, +51 every 10 s); relaunch 3 s; 130 × destroyed ÷ 80; all = `finishScore()`
- **Intro text:**
  - GOAL: “Clear the wall.”
  - HOW:
    - “Drag to move the paddle anywhere on the board.”
    - “Keep the ball up - it gets faster with bricks and with time.”
    - “Darker blue bricks take 2 or 3 hits - each hit cracks them down a tier.”
    - “Four starred power-up bricks drop a capsule gold = laser, silver = ×5 balls, bronze = ×2 balls (works at once).”
    - “Tap anywhere to fire a laser or ×5 you've caught; any other touch moves the paddle.”
  - SCORE: “130 × bricks destroyed ÷ 80; all 80 = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left.”

#### Coral Pop (`bubble`)

- **Category / status:** Arcade · Active
- **Time limit:** registry 93,000 ms (93 s); sim run 90 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 10 columns, up to 18 rows, 7 starting rows; 5 symbols
- **Revision:** `speedPar: 1` only
- **Input:** Drag to aim, release to shoot
- **Scoring:** `score()` in `src/lib/arcade/bubble.ts`, replayed on the server by `src/lib/duel/bubble.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Run 90 s; queue 120 bubbles; field descends every 8 shots; group of 3 pops; 130 × share cleared; cleared = `finishScore()`
- **Intro text:**
  - GOAL: “Pop the bubbles by matching three of a colour.”
  - HOW:
    - “Drag to aim, release to shoot - bounce off the walls.”
    - “Three of a colour pop when they touch.”
    - “Bubbles left hanging fall off the field.”
    - “Ninety seconds on the same field for everyone.”
  - SCORE: “130 × share of starting bubbles cleared; clear the field = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left.”

#### Fission (`burst`)

- **Category / status:** Arcade · Active
- **Time limit:** registry 93,000 ms (93 s); sim run 90 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 390×620 world; atoms in 4 sizes (radius 32/22/14/8)
- **Revision:** `speedPar: 1` only
- **Input:** Hold ◀ ▶ to move; tap arena or FIRE
- **Scoring:** `burstScoreOf()` in `src/lib/arcade/burst.ts`, replayed on the server by `src/lib/duel/burst.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Run 90 s; 3 lives; up to 41 waves; BURST = 3 short shots; shield from a blue atom 1 in 4; 2 per hit, −9 per life; 150 when the run ends with no life lost and ≥ 4 waves cleared
- **Intro text:**
  - GOAL: “Split every atom - big ones split into smaller atoms.”
  - HOW:
    - “Hold ◀ or ▶ to move, tap the arena or FIRE to shoot straight up.”
    - “Split a purple atom and catch the gold icon for triple BURST shots until you lose a life.”
    - “Blue atoms sometimes drop a teal SHIELD - it takes the next hit for you.”
    - “Don't let an atom touch you - three touches and you're out.”
  - SCORE: “2 per atom destroyed or split, −9 per life lost. Clear four waves without losing a life for 150.”

#### Flightpath (`bullseye`)

- **Category / status:** Arcade · Active
- **Time limit:** registry 48,000 ms (48 s); sim run 45 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** Target with 6 rings valued 10/9/8/3/2/1; 10 arrows
- **Revision:** `speedPar: 1`; puzzle stores the 10 seeded `winds`
- **Input:** Touch and drag to aim, release to shoot
- **Scoring:** `bullseyeScoreFor()` in `src/lib/arcade/bullseye.ts`, replayed on the server by `src/lib/duel/bullseye.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Run 45 s; wind −3…+3 rings; sway period 120 ticks; drift from arrow 4 (period 156); value shuffle from arrow 7; scale 100 % → 68 %; clamp(floor(1.7 × total − 20), 0, 150)
- **Intro text:**
  - GOAL: “Hit the centre - ten arrows.”
  - HOW:
    - “Touch and drag to aim the dotted path shows where it will go.”
    - “Your aim sways - watch the ring and release at the right moment. The ring circles once every two seconds.”
    - “The wind moves your arrow by that many rings. Wind 2 to the right? Aim two rings to the left.”
    - “The target gets further away each shot.”
    - “From the fourth arrow the target moves - lead it. It is scored where it is when the arrow lands.”
    - “From the seventh arrow the ring values swap places. Read the numbers - each value keeps its colour.”
  - SCORE: “clamp(floor(1.7 × ring total − 20), 0, 150). Unfired darts add 0 to the ring total.”

#### Gemstone (`matchup`)

- **Category / status:** Arcade · Active
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 7 cols × 8 rows (`MATCHUP_SIZE`×`MATCHUP_ROWS`), 6 symbols
- **Revision:** `speedPar: 1` only
- **Input:** Drag one symbol onto a neighbour
- **Scoring:** `score()` in `src/lib/arcade/matchup.ts`, replayed on the server by `src/lib/duel/matchup.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Line points 3 = 10, 4 = 25, 5+ = 50; par 2,500 raw = 150; refill queue 70 per column; hint after 5 s
- **Intro text:**
  - GOAL: “Make lines of three or more matching symbols.”
  - HOW:
    - “Swap two neighbours by dragging one onto the other.”
    - “Make four, five, or a T / L to create a bomb (nearby blast), white four-point star (row and column) or six-point star (both diagonals), including on cascades.”
    - “Trigger specials to clear nearby symbols and start chain reactions.”
    - “Sixty seconds on the same board for everyone.”
  - SCORE: “3 = 10, 4 = 25, 5 = 50; clamp(floor(150 × match points ÷ 2,500), 0, 150).”

#### Grappler (`swing`)

- **Category / status:** Arcade · Active
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** Course to 500 m (40 px a metre)
- **Revision:** `swingRev: 3` (`SWING_REV`): 3–5 dragons 64×44 px at 350–500 m; rev 2 = 4–6 dragons 40×28
- **Input:** Hold to grab, release to fly; swipe up / down to reel
- **Scoring:** `score()` in `src/lib/arcade/swing.ts`, replayed on the server by `src/lib/duel/swing.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Bank: 504 proved seeds; reach 220 px; 130 × m ÷ 500; 500 m = `finishScore()`
- **Intro text:**
  - GOAL: “Swing the ninja to the 500 m finish.”
  - HOW:
    - “Hold to grab an anchor and swing, let go to fly.”
    - “Stuck? Keep swinging - every pass gets you higher. Swipe up to shorten the rope for speed.”
    - “Don't touch the spikes or fall into the lava.”
    - “Watch out for dragons near the end. Touching one ends the run.”
  - SCORE: “130 × metres ÷ 500; reaching 500 m = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left.”

#### High Rise (`skyline`)

- **Category / status:** Arcade · Active
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 390×560; start block 200 px wide
- **Revision:** `speedPar: 1` only
- **Input:** Tap to drop
- **Scoring:** `score()` in `src/lib/arcade/skyline.ts`, replayed on the server by `src/lib/duel/skyline.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Slide speed 768 → 1536 (+26 per block); perfect tolerance 3 px, grows 6 px; floor(2.5 × blocks + 3 × perfects), cap 150 (`SKYLINE_PAR`, `SKYLINE_POINTS_CAP`, `SKYLINE_SURVIVE_BONUS` are defined but unused by the scorer)
- **Intro text:**
  - GOAL: “Stack the blocks as high as you can.”
  - HOW:
    - “Tap to drop the sliding block onto the tower.”
    - “Overhang is cut so the next block is narrower.”
    - “Line it up exactly and the block grows back a little.”
  - SCORE: “floor(2.5 × blocks stacked + 3 × perfect drops), capped at 150.”

#### Hover (`hover`)

- **Category / status:** Arcade · Active
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 390×560 world; 45 barriers built (`HOVER_GATE_COUNT`, capacity), of which a clean run reaches 42 (`HOVER_REACHABLE_GATES`, the scoring total). hoverRev 2 (Oct 2026) adds 10 gold stars, two-gap barriers from barrier 17 and moving barriers from barrier 24; score 130 × barriers ÷ 42 + 20 × stars ÷ 10
- **Revision:** `speedPar: 1` only
- **Input:** Hold to rise, release to drop
- **Scoring:** `score()` in `src/lib/arcade/hover.ts`, replayed on the server by `src/lib/duel/hover.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Gap 150 → 100 px (−2 px per gate); scroll 666 → 1331; 150 × gates ÷ reachable gates
- **Intro text:**
  - GOAL: “Fly through as many gaps in the energy barriers as you can.”
  - HOW:
    - “Tap anywhere to hover up; let go to drop.”
    - “Hit anything and the run ends.”
    - “Everyone flies the same course for sixty seconds.”
  - SCORE: “150 × barriers passed ÷ total barriers.”

#### Jaywalk (`cross`)

- **Category / status:** Arcade · Active
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 9 lanes (`CROSS_LANES`), 13 columns, 10 courses
- **Revision:** `speedPar: 1` only
- **Input:** Swipe up / down / left / right
- **Scoring:** `score()` in `src/lib/arcade/cross.ts`, replayed on the server by `src/lib/duel/cross.ts` from `src/lib/duel/grade.ts`
- **Tuning:** 3 lives; 1 s kerb pause; hop 6 ticks; speed growth from crossing 3; 2 per lane, 4 per crossing, cap 150
- **Intro text:**
  - GOAL: “Get across the traffic as many times as you can.”
  - HOW:
    - “Swipe up to hop one lane forward; swipe down to step back.”
    - “Swipe left or right to move sideways.”
    - “After each crossing you get a second on the kerb before the next one.”
    - “Three lives a hit costs one and restarts you on the start lane of this crossing after a second.”
  - SCORE: “2 × total lanes crossed + 4 × crossings completed, up to 150. No clean-crossing bonus.”

#### Junction (`junction`)

- **Category / status:** Arcade · Active
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** Four-way junction, 390×620
- **Revision:** `speedPar: 1` only
- **Input:** Tap a corner light
- **Scoring:** `juncScoreOf()` in `src/lib/arcade/junction.ts`, replayed on the server by `src/lib/duel/junction.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Arrivals every 1.4 → 0.5 s; patience 6 → 4 s; turning cars from 30 s (1 s indicator); ambulances from 20 s every 15 s at 1.3× speed; 2 per car, −1 give-up, ±4 ambulance, +40 survive
- **Intro text:**
  - GOAL: “Keep the traffic moving without a crash.”
  - HOW:
    - “Tap the black corner beside a road to switch its light between red (stop) and green (go).”
    - “Cars on red queue up - and they don't wait forever.”
    - “Later, some cars turn - they flash an indicator a second before the line.”
    - “Ambulances (flashing blue) come fast from 20 s - give them green before they reach the line.”
  - SCORE: “2 per car through, −1 per car that gives up, +4 per ambulance waved through, −4 if one has to stop, +40 for surviving the minute. Clamp 0-150.”

#### Meteor (`snake`)

- **Category / status:** Arcade · Active
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 15×20 cells (`SNAKE_COLS`×`SNAKE_ROWS`)
- **Revision:** `speedPar: 1` only
- **Input:** Swipe to turn
- **Scoring:** `score()` in `src/lib/arcade/snake.ts`, replayed on the server by `src/lib/duel/snake.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Start length 3; step 9 → 4 ticks (faster every 5 pellets); pellet queue 200; 5 per pellet, cap 150
- **Intro text:**
  - GOAL: “Eat the pellets and don't hit anything.”
  - HOW:
    - “Swipe to turn up, down, left or right.”
    - “You grow with every pellet and you speed up.”
    - “Everyone gets the same food in the same order.”
  - SCORE: “5 points per star eaten, up to 150.”

#### Orbit (`orbit`)

- **Category / status:** Arcade · Active
- **Time limit:** registry 93,000 ms (93 s); sim run 90 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 40 planets then the sun; rev 3 world 1000 px wide
- **Revision:** `orbitRev: 3` (`ORBIT_REV3`) with stored `planets`, only from the proved bank; otherwise unstamped (rev 1/2 sim)
- **Input:** Tap to let go; Set Checkpoint button once
- **Scoring:** `score()` in `src/lib/arcade/orbitRev3.ts`, replayed on the server by `src/lib/duel/orbitRev3.ts` from `src/lib/duel/grade.ts` (rev 3) or `score()` in `src/lib/arcade/orbit.ts` (older)
- **Tuning:** Run 90 s; bank 504 seeds; ellipses from planet 11, figure-eights from 21, belt from 31 (one turn per 12 s); 3 per planet, cap 130; sun = `finishScore()`
- **Intro text:**
  - GOAL: “Reach the sun, choosing one planet as your checkpoint.”
  - HOW:
    - “You orbit automatically. Tap to let go - you fly straight until the next orbit catches you.”
    - “Set Checkpoint once while orbiting. Your next crash returns you there. Without it, or after using it, a crash ends the run. Orbits are belt-safe. On later planets, time arrival and departure through the opening in the outside asteroid ring - it turns once every 12 seconds.”
    - “Orbits change shape. Ovals speed up near the planet. On a figure-eight, let go only on the outer loops - never at the crossing.”
  - SCORE: “3 per planet; reach the sun (planet 40) = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left.”

#### Rainbow Bridge (`inkbridge`)

- **Category / status:** Arcade · Active
- **Time limit:** registry 123,000 ms (123 s); sim run 120 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 390×620; 10 levels; 3 failed drops allowed
- **Revision:** `inkRev: 3` (`INK_REV3`); rev 2 = birds, unstamped = blocks
- **Input:** Draw strokes, RELEASE, LIFT; Undo / Reset / drop again
- **Scoring:** `inkScoreOf()` in `src/lib/arcade/inkBridge.ts`, replayed on the server by `src/lib/duel/inkBridge.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Run 120 s; rounds 1–4 reuse old levels 3–6 (still pot), 5–8 reuse old levels 7–10 (forced sliding pot), 9–10 live (gravity 54 vs 64, ink ×1.5, pre-line cap 170 px, no-draw ring 14 px); ink budget 500 → 1400 px by level; bird-count table 1–6; 11 per level; all ten = `finishScore()`
- **Intro text:**
  - GOAL: “Draw a path so the coin rolls into the pot.”
  - HOW:
    - “Rounds 1-4 Draw lines around the white birds, then tap RELEASE to drop the coin into a still pot.”
    - “Rounds 5-8 The pot moves! Time your release so the coin rolls into it.”
    - “Rounds 9-10: LIVE Draw one line, RELEASE, then keep drawing as the coin falls. Faded strokes commit when you lift your finger; you can't draw through birds or near the coin.”
    - “Ink is limited Each level has a budget, with a larger shared supply for live rounds.”
    - “Three failed drops and you're out.”
  - SCORE: “11 per level; all ten = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left.”

#### Rally (`rally`)

- **Category / status:** Arcade · Active
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 390×620; paddle at y 560
- **Revision:** `speedPar: 1` only
- **Input:** Drag paddle
- **Scoring:** `score()` in `src/lib/arcade/rally.ts`, replayed on the server by `src/lib/duel/rally.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Paddle 120 → 40 px (−5 per hit); ball speed ×2.2 cap; gold ball every 10 s (5 total); floor(2.5 × gold hits)
- **Intro text:**
  - GOAL: “Keep the rally going.”
  - HOW:
    - “Drag to move the paddle along the bottom.”
    - “Every hit makes the paddle smaller and the ball faster.”
    - “A gold ball drops in every ten seconds - only gold hits score.”
    - “Miss the blue ball and the run is over.”
  - SCORE: “floor(2.5 × gold-ball hits), capped at 150. The blue ball scores nothing.”

#### Roofbound (`flip`)

- **Category / status:** Arcade · Active
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** Corridor floor y 440 / ceiling y 180
- **Revision:** `speedPar: 1` only
- **Input:** Tap to flip gravity
- **Scoring:** `flipScoreOf()` in `src/lib/arcade/flip.ts`, replayed on the server by `src/lib/duel/flip.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Speed 1024 → 2304 (+90 every 3 s); bend from 20 s (5 s ramp, period 2–3 s); 150 × (t ÷ 60 s)²
- **Intro text:**
  - GOAL: “Run the corridor - flip to the other side to dodge.”
  - HOW:
    - “Tap to flip gravity.”
    - “Spikes and gaps on one side mean run on the other.”
    - “From 20 s the corridor bends. Hazards ride the bends with you.”
  - SCORE: “The longer you last, the more you score - the full minute is 150.”

#### Scrumper (`snip`)

- **Category / status:** Arcade · Active
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 1260×560 world, 360 px view; 10 levels from 30 templates
- **Revision:** `snipRev: 2` (`SNIP_REV`): 3 easy + 4 medium + 3 hard drawn from `SNIP_BANDS`; unstamped = fixed legacy order
- **Input:** Swipe to cut ropes
- **Scoring:** `snipScore()` in `src/lib/arcade/snip.ts`, replayed on the server by `src/lib/duel/snip.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Level cap 12 s inside a 60 s run; rest fail after 30 ticks; 10 per apple, 3 per leaf, all ten + up to 20 (par curve); cap 150
- **Intro text:**
  - GOAL: “Drop the apple into the basket.”
  - HOW:
    - “Swipe across a rope to cut it - time it with the swing.”
    - “Cut the last rope and the apple drops; the walls bounce it without losing speed, and the camera follows across the wider arena.”
    - “Don't let it settle on a ledge or fly out the top or bottom - 10 levels, 12 s each.”
  - SCORE: “10 per apple collected, +3 for each level's single leaf; collect all ten for round(20 × time left ÷ 60 s). Cap 150.”

#### Slice (`slice`)

- **Category / status:** Arcade · Active
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 390×620; disc radius 20
- **Revision:** `speedPar: 1` only
- **Input:** Swipe paths (finger down / up recorded)
- **Scoring:** `score()` in `src/lib/arcade/slice.ts`, replayed on the server by `src/lib/duel/slice.ts` from `src/lib/duel/grade.ts`
- **Tuning:** 1 → 4 discs per 1.5 s window; bombs 12 %; specials from 10 s (frenzy 3 s, slow 4 s at 0.4×); combo needs 3 discs, lasts 10 s, max ×3; path cap 465 px; floor(235 × weighted ÷ (3 × discs)) − 10 per bomb
- **Intro text:**
  - GOAL: “Slice the flying discs. Don't hit the bombs.”
  - HOW:
    - “Swipe through the discs to slice them in half.”
    - “Never touch the lit chilli - each one costs ten points.”
    - “Two special bottles - Saucy (ketchup) opens three bomb-free seconds; Simmer (mustard) slows everything for four.”
    - “Cut 3+ discs in one swipe one finger-down-to-up path counts together, even a curve or loop. First combo gives ×2, second gives ×3. Each combo resets 10 seconds; only expiry returns you to ×1.”
    - “Each swipe has a length limit - curve it, but it stops after about three-quarters of the screen.”
  - SCORE: “floor(235 × combo-weighted slices ÷ (3 × foods available)) −10 per chilli; capped at 150.”

#### Swish (`bintoss`)

- **Category / status:** Arcade · Active
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 390×560 world, 10 throws
- **Revision:** `binRev: 2` (`BINTOSS_REV`): opening, narrowed opening and rim inset at 85 %; unstamped = original bin
- **Input:** Touch and drag to aim, release to throw
- **Scoring:** `score()` in `src/lib/arcade/binToss.ts`, replayed on the server by `src/lib/duel/binToss.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Narrow from throw 4, slide from throw 7 (amp 40–70 px, period 120–168 ticks); wind ±4; bin half-width 34 px → 28.9 px (rev 2); 10 per basket; 10/10 = `finishScore()`
- **Intro text:**
  - GOAL: “Throw the ball into the bin - ten throws.”
  - HOW:
    - “Touch and drag to aim the dotted path shows where it will go.”
    - “Each wind point moves the ball a quarter of a bin width. Wind 2 to the left? Aim half a bin width to the right.”
    - “The bin moves further away every throw, and gets narrower from throw 4.”
    - “From throw 7 the bin slides side to side - time your release.”
  - SCORE: “10 per bucket; all ten = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left.”

#### Tempo (`beat`)

- **Category / status:** Arcade · Active
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 4 lanes, 390×620 world
- **Revision:** `speedPar: 1` only
- **Input:** Tap a lane; hold notes need press and release
- **Scoring:** `score()` in `src/lib/arcade/beat.ts`, replayed on the server by `src/lib/duel/beat.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Note fall 90 ticks; windows perfect ±3, good ±7, OK ±12 ticks; holds from tick 1200 at 20 %; combo tiers 10/25/50; quarters 4/3/1/−8 ÷ 4
- **Intro text:**
  - GOAL: “Tap the notes in time.”
  - HOW:
    - “Tap a lane as its note reaches the line.”
    - “Closer is better - perfect, good, or just OK.”
    - “A tap with no note costs nothing.”
    - “Notes with a tail are holds - press as the head reaches the line, release as the tail reaches it. Both ends must be Perfect for Perfect, or within Good for Good; otherwise Miss.”
    - “Keep a combo going to light up the lanes at 10, 25 and 50 - a miss resets it.”
  - SCORE: “Perfect 1, good 0.75, OK 0.25, miss −2, up to 150. Holds score only after both ends are judged; mistimed releases miss the whole note.”

#### Tilt (`tilt`)

- **Category / status:** Arcade · Active
- **Time limit:** registry 93,000 ms (93 s); sim run 90 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** Circular maze; 4 mazes of size 9, 11, 11, 13
- **Revision:** `speedPar: 1` only
- **Input:** Drag left / right to spin
- **Scoring:** `score()` in `src/lib/arcade/tilt.ts`, replayed on the server by `src/lib/duel/tilt.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Run 90 s; red chaser behind a padlocked gate from maze 2; 30 per maze; all four = `finishScore()`
- **Intro text:**
  - GOAL: “Roll the ball into the blue cup.”
  - HOW:
    - “Drag left or right to spin the maze - the ball always rolls down.”
    - “Each escape brings a harder maze. Dark holes end the run.”
    - “From maze 2 the red ball waits behind a silver gate with a padlock. Pass the brass padlock and it's free - it tilts with you. Touch the red ball and the run ends.”
  - SCORE: “Four mazes, 30 each. All four = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left.”

#### Wavefront (`wavefront`)

- **Category / status:** Arcade · Active
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 6×5 formation (30 ships)
- **Revision:** `speedPar: 1` only
- **Input:** Drag to move (auto-fire)
- **Scoring:** `wavScoreOf()` in `src/lib/arcade/wavefront.ts`, replayed on the server by `src/lib/duel/wavefront.ts` from `src/lib/duel/grade.ts`
- **Tuning:** 3 lives; armour from wave 2 (4/6/8/10 cells, 6/8/10/12 hits); saucer every 15 s (5 pts) drops 5 pierce shots × 3 enemies; 15 per wave; par 248 raw = 150
- **Intro text:**
  - GOAL: “Shoot down the formation before it reaches you.”
  - HOW:
    - “Drag to move - you fire automatically.”
    - “Dodge the red bolts. Three hits and you're out.”
    - “From wave 2, a grey armoured block takes 6-12 hits - every hit counts.”
    - “Shoot the saucer and catch its drop: 5 laser shots that pierce up to 3 enemies.”
  - SCORE: “Points for ships, armour hits, saucers and waves. Clearing wave 5 perfectly scores 150.”

## Retired games

### Word

#### Groups (`groups`)

- **Category / status:** Word · Retired (practice only)
- **Time limit:** registry 90,000 ms (90 s); no sim run (not on the arcade clock)
- **Board and items:** 16 words, 4 groups of 4
- **Revision:** `speedPar: 1` only
- **Input:** Tap four words, Submit group (server checks each group live)
- **Scoring:** `scoreGroups()` in `src/lib/duel/scoring.ts`
- **Tuning:** Bank: 80 entries (`GROUPS_BANK`); 1/2/3 groups = 20/40/60; all four = 100 + 0–50 speed against a fixed 90 s
- **Intro text:**
  - GOAL: “Sort all sixteen words into four groups of four.”
  - HOW:
    - “Tap four words that share a hidden link.”
    - “Submit the group to lock it in.”
    - “Choose carefully because some words are red herrings.”
  - SCORE: “More groups = more points. All four = speed bonus (the full bonus if you finish with at least half the time left).”

#### Word Ladder (`ladder`)

- **Category / status:** Word · Retired (practice only)
- **Time limit:** registry 60,000 ms (60 s); no sim run (not on the arcade clock)
- **Board and items:** 4-letter start and target words; shortest path 4–6 changes
- **Revision:** `speedPar: 1` only
- **Input:** Type a word per rung, Enter
- **Scoring:** `scoreWordLadder()` in `src/lib/duel/scoring.ts`
- **Tuning:** Solved = 100 + 0–50 speed (fixed 60 s) + 20 for a minimum-length ladder, cap 150; unsolved: 1/2/3 letters away = 75/50/25
- **Intro text:**
  - GOAL: “Reach the final word by changing one letter at a time.”
  - HOW:
    - “Type a word for each rung.”
    - “Change one letter from the word above.”
    - “Press Enter to add each valid word.”
    - “Words are checked against a standard British English dictionary.”
  - SCORE: “Finish the ladder faster = more points. Getting close still scores.”

#### Word Match (`wordmatch`)

- **Category / status:** Word · Retired (practice only)
- **Time limit:** registry 45,000 ms (45 s); no sim run (not on the arcade clock)
- **Board and items:** 8 prompt items, multiple choice
- **Revision:** `speedPar: 1` only
- **Input:** Tap an option per item
- **Scoring:** `scoreWordMatch()` in `src/lib/duel/scoring.ts`
- **Tuning:** All 8 = 100 + 0–50 speed (45 s); otherwise 13 per correct, cap 90; avoids the host's last ten tournaments' prompts
- **Intro text:**
  - GOAL: “Decide whether each word pair matches the rule.”
  - HOW:
    - “Read the rule SYNONYM or ANTONYM.”
    - “Compare the pair for same or opposite meaning.”
    - “Tap your answer for every pair.”
  - SCORE: “All eight = 100 plus speed. Otherwise 13 per correct pair, up to 90.”

### Number

#### Chain Calculation (`chaincalc`)

- **Category / status:** Number · Retired (practice only)
- **Time limit:** registry 45,000 ms (45 s); no sim run (not on the arcade clock)
- **Board and items:** Start number and 5 operations
- **Revision:** `speedPar: 1` only
- **Input:** Keypad entry, Submit
- **Scoring:** Default `scoreRound()` in `src/lib/duel/scoring.ts` (100 + 0–50 speed, else 0)
- **Tuning:** 45 s limit; long reveal (8 s)
- **Intro text:**
  - GOAL: “Calculate the final number in the chain.”
  - HOW:
    - “Start at the top with the first number.”
    - “Work downward one operation at a time.”
    - “Type the result and press Submit.”
  - SCORE: “Correct and faster = more points.”

#### Number Sequence (`numseq`)

- **Category / status:** Number · Retired (practice only)
- **Time limit:** registry 45,000 ms (45 s); no sim run (not on the arcade clock)
- **Board and items:** 5 sequences, multiple choice (`NUMSEQ_ITEMS`)
- **Revision:** `speedPar: 1` only
- **Input:** Tap an option per sequence (no going back)
- **Scoring:** `scoreNumberSequence()` in `src/lib/duel/scoring.ts`
- **Tuning:** 20 per sequence; all five + 0–50 speed (45 s)
- **Intro text:**
  - GOAL: “Work out the next number in each sequence.”
  - HOW:
    - “Five sequences one after the other, getting harder.”
    - “Tap the answer you can't go back.”
    - “Finish all five inside forty-five seconds.”
  - SCORE: “Twenty a sequence. All five right for the speed bonus (the full bonus if you finish with at least half the time left).”

#### Percent Sprint (`pctsprint`)

- **Category / status:** Number · Retired (practice only)
- **Time limit:** registry 45,000 ms (45 s); no sim run (not on the arcade clock)
- **Board and items:** 5 percentage questions (`PCTSPRINT_ITEMS`)
- **Revision:** `speedPar: 1` only
- **Input:** Tap an option per question
- **Scoring:** `scorePercentSprint()` in `src/lib/duel/scoring.ts`
- **Tuning:** round(100 × correct ÷ 5); all five + 0–50 speed (45 s)
- **Intro text:**
  - GOAL: “Solve all five percentage questions.”
  - HOW:
    - “Work out the percentage shown in the question.”
    - “Tap the answer from the choices.”
    - “Solve all five in the 45 seconds.”
  - SCORE: “More correct = more points. All five = speed bonus (the full bonus if you finish with at least half the time left).”

#### Sum Hunt (`sumhunt`)

- **Category / status:** Number · Retired (practice only)
- **Time limit:** registry 90,000 ms (90 s); no sim run (not on the arcade clock)
- **Board and items:** 4×4 boards (`SH_SIZE`), 6 two-digit cells (`SH_TWO_DIGIT_CELLS`), 9 stages (`SH_STAGES`)
- **Revision:** `speedPar: 1` only
- **Input:** Swipe or tap orthogonally touching cells
- **Scoring:** `sumHuntRoundScore()` in `src/lib/duel/sumHunt.ts`
- **Tuning:** 10 per stage passed, cap 80; finishing = 100 + up to 50 speed against 90 s; 1–3 target paths of 3–6 cells per stage
- **Intro text:**
  - GOAL: “Clear paths of digits that add up to the target - it rises every time.”
  - HOW:
    - “Swipe or tap touching cells Move up, down, left or right; matching the target submits automatically.”
    - “A new board slides in after each of the first eight clears; finish by chaining the whole grid.”
  - SCORE: “10 per stage; clear the whole grid to finish for the time bonus (the full bonus if you finish with at least half the time left).”

### Speed

#### Go / No-Go (`gonogo`)

- **Category / status:** Speed · Retired (practice only)
- **Time limit:** registry 30,000 ms (30 s); no sim run (not on the arcade clock)
- **Board and items:** 12 items, 6 targets (`GONOGO_ITEMS`, `GONOGO_TARGETS`)
- **Revision:** `speedPar: 1` only
- **Input:** Tap on target
- **Scoring:** `scoreGoNoGo()` in `src/lib/duel/scoring.ts`
- **Tuning:** Item 730 ms + 360 ms gap; accuracy round(100 × correct ÷ 12) (90 cap unless perfect) + reaction bonus 0–50 (50 at 150 ms, 0 at 650 ms)
- **Intro text:**
  - GOAL: “Tap every gold circle and ignore every other shape.”
  - HOW:
    - “Watch each shape as it appears.”
    - “Tap gold circles as quickly as you can.”
    - “Ignore everything else without tapping.”
  - SCORE: “More correct choices = more points. Perfect = speed bonus (the full bonus if you finish with at least half the time left).”

### Pattern

#### Mirror Match (`mirmatch`)

- **Category / status:** Pattern · Retired (practice only)
- **Time limit:** registry 60,000 ms (60 s); no sim run (not on the arcade clock)
- **Board and items:** 5 items (`MIRMATCH_ITEMS`), 4 candidates each
- **Revision:** `speedPar: 1` only
- **Input:** Tap a candidate
- **Scoring:** `scoreMirrorMatch()` in `src/lib/duel/scoring.ts`
- **Tuning:** round(100 × correct ÷ 5); all five + 0–50 speed (60 s)
- **Intro text:**
  - GOAL: “Choose the exact mirror image of each shape.”
  - HOW:
    - “Flip the shape across the dashed line in your head.”
    - “Match every colour as well as the outline.”
    - “Tap the result for all five shapes.”
  - SCORE: “More correct = more points. All five = speed bonus (the full bonus if you finish with at least half the time left).”

#### Pattern Completion (`patcomp`)

- **Category / status:** Pattern · Retired (practice only)
- **Time limit:** registry 30,000 ms (30 s); no sim run (not on the arcade clock)
- **Board and items:** 3 pattern boards (`PATCOMP_ITEMS`)
- **Revision:** `speedPar: 1` only
- **Input:** Pickers, Submit or Skip
- **Scoring:** `scorePatternCompletion()` in `src/lib/duel/scoring.ts`
- **Tuning:** round(100 × correct ÷ 3); all three + 0–50 speed (30 s)
- **Intro text:**
  - GOAL: “Complete all three visual patterns.”
  - HOW:
    - “Study each pattern to find its two changing features.”
    - “Build the missing piece with the pickers.”
    - “Submit or skip to move to the next pattern.”
  - SCORE: “Each correct pattern scores. All three = speed bonus (the full bonus if you finish with at least half the time left).”

#### Spin (`spin`)

- **Category / status:** Pattern · Retired (practice only)
- **Time limit:** registry 45,000 ms (45 s); no sim run (not on the arcade clock)
- **Board and items:** 8 items (`SPIN_ITEMS`); transforms cw / half / ccw / flip, max streak 2
- **Revision:** `speedPar: 1` only
- **Input:** Tap a rotation or FLIPPED
- **Scoring:** `scoreSpin()` in `src/lib/duel/scoring.ts`
- **Tuning:** round(100 × correct ÷ 8); all eight + 0–50 speed (45 s)
- **Intro text:**
  - GOAL: “Identify how each shape was turned or flipped.”
  - HOW:
    - “Compare the shapes before and after.”
    - “Tap the rotation shown by the arrows.”
    - “Choose FLIPPED when the shape is mirrored.”
  - SCORE: “More correct = more points. Perfect = speed bonus (the full bonus if you finish with at least half the time left).”

### Logic

#### Dig (`dig`)

- **Category / status:** Logic · Retired (practice only)
- **Time limit:** registry 60,000 ms (60 s); no sim run (not on the arcade clock)
- **Board and items:** 12×16 (`DIG_COLS`×`DIG_ROWS`); one or two drains; acid/lava hazards
- **Revision:** `speedPar: 1` only
- **Input:** Drag across sand to dig
- **Scoring:** `scoreDig()` in `src/lib/duel/dig.ts`
- **Tuning:** Bank: 300 boards (200 standard, 100 hard); 600 sim steps at 10/s; budget = min digs + 2; drain target 80 %; complete = 100 + up to 50 speed (sim steps) + 20 within min digs; else ≤ 90
- **Intro text:**
  - GOAL: “Dig a path for the water to the drain.”
  - HOW:
    - “Limited digs. Drag across gold sand to dig it.”
    - “Sand falls when you dig under it. Fallen sand packs and can't be dug.”
    - “Avoid acid and lava. Still water evaporates.”
  - SCORE: “Fill the drain with clean water: 100 + time bonus (the full bonus if you finish with at least half the time left), +20 within the planned digs. Otherwise points for clean water drained.”

#### One-Stroke (`stroke`)

- **Category / status:** Logic · Retired (practice only)
- **Time limit:** registry 30,000 ms (30 s); no sim run (not on the arcade clock)
- **Board and items:** 6–9 dots, 8–14 edges
- **Revision:** `speedPar: 1` only
- **Input:** Drag along lines
- **Scoring:** `scoreStroke()` in `src/lib/duel/scoring.ts`
- **Tuning:** Solved = 100 + 0–50 speed (30 s) + 20 first try, cap 150; else up to 60 by best share
- **Intro text:**
  - GOAL: “Trace every line in one stroke without lifting your finger.”
  - HOW:
    - “Start on any dot and drag along the lines.”
    - “No line twice - you can't go back over one.”
    - “Lift your finger to start the figure again.”
  - SCORE: “First try earns a bonus.”

### Arcade

#### Bastion (`bastion`)

- **Category / status:** Arcade · Retired (practice only)
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 390×620, turret at base
- **Revision:** `speedPar: 1` only
- **Input:** Touch to aim, or hold ◀ ▶ (Arrows mode)
- **Scoring:** `basScoreOf()` in `src/lib/arcade/bastion.ts`, replayed on the server by `src/lib/duel/bastion.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Base health 5; fires every 10 ticks; spawn 72 → 30 ticks; 1 per shape; +20 untouched, +10 alive
- **Intro text:**
  - GOAL: “Defend the base.”
  - HOW:
    - “Touch where you want to aim - the turret follows and fires all the time.”
    - “Prefer buttons? Turn on Arrows and hold ◀ ▶ to turn the barrel.”
    - “Squares take two hits; triangles split.”
  - SCORE: “1 per shape; keep the base alive for the bonus.”

#### Dual (`dual`)

- **Category / status:** Arcade · Retired (practice only)
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** Two 195 px panels
- **Revision:** `speedPar: 1` only
- **Input:** Left / right thumb tap to jump (double jump)
- **Scoring:** `dualScoreForTicks()` in `src/lib/arcade/dual.ts`, replayed on the server by `src/lib/duel/dual.ts` from `src/lib/duel/grade.ts`
- **Tuning:** 150 × (t ÷ 60 s)²; scroll 512 → 1126 every 10 s
- **Intro text:**
  - GOAL: “Keep both runners alive.”
  - HOW:
    - “Left thumb jumps the left runner.”
    - “Right thumb jumps the right runner. Tap again in the air to double jump.”
    - “Same course for everyone.”
  - SCORE: “The longer both survive, the more you score: all 60 seconds = 150, 45 s ≈ 84, 30 s ≈ 37.”

#### Hot Floor (`hotfloor`)

- **Category / status:** Arcade · Retired (practice only)
- **Time limit:** registry 123,000 ms (123 s); sim run 120 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 7 cols × up to 9 rows; 10 stages
- **Revision:** `speedPar: 1` only
- **Input:** Tap tiles, GO, UNDO, CLEAR
- **Scoring:** `score()` in `src/lib/arcade/hotFloor.ts`, replayed on the server by `src/lib/duel/hotFloor.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Run 120 s; 3 lives; hop 20 ticks; route ≤ 48; 15 per stage
- **Intro text:**
  - GOAL: “Plan a route to the exit before the floor falls.”
  - HOW:
    - “Each number is how many hops that tile lasts after you press GO.”
    - “Tap tiles to draw your route, then GO. Stay within the hop budget. UNDO removes the last tile.”
    - “You have 120 seconds.”
  - SCORE: “15 per stage.”

#### Parry (`parry`)

- **Category / status:** Arcade · Retired (practice only)
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 8 shield positions
- **Revision:** `speedPar: 1` only
- **Input:** Swipe 8 directions or ⟲ ⟳
- **Scoring:** `parryScoreOf()` in `src/lib/arcade/parry.ts`, replayed on the server by `src/lib/duel/parry.ts` from `src/lib/duel/grade.ts`
- **Tuning:** 3 hits; pairs from 20 s, feints from 40 s; 2 per deflect, −10 per hit
- **Intro text:**
  - GOAL: “Block every arrow with the gong shield.”
  - HOW:
    - “Swipe in any of eight directions or use ⟲ ⟳ to move one position.”
    - “A diagonal blocks both neighbours - at 1:30 it covers the top and the right.”
    - “Later they come in pairs and some swerve at the last moment. Three hits and you're out.”
  - SCORE: “2 per arrow deflected, −10 per life lost.”

#### Ricochet (`ricochet`)

- **Category / status:** Arcade · Retired (practice only)
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** Shaft 55–335 px
- **Revision:** `speedPar: 1` only
- **Input:** Tap to leap
- **Scoring:** `score()` in `src/lib/arcade/ricochet.ts`, replayed on the server by `src/lib/duel/ricochet.ts` from `src/lib/duel/grade.ts`
- **Tuning:** 40 px a metre; 2 per metre, cap 150
- **Intro text:**
  - GOAL: “Climb the shaft by leaping wall to wall.”
  - HOW:
    - “Tap to jump across to the opposite wall.”
    - “Don't land on the spikes or the run ends.”
    - “Don't slide all the way back to the bottom.”
  - SCORE: “2 points per metre climbed, up to 150.”

#### Rooftop Run (`rooftop`)

- **Category / status:** Arcade · Retired (practice only)
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 3 lanes
- **Revision:** `speedPar: 1` only
- **Input:** Swipe left / right / up / down
- **Scoring:** `roofScoreOf()` in `src/lib/arcade/rooftop.ts`, replayed on the server by `src/lib/duel/rooftop.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Speed +64 every 3 s from 768; 150 × (t ÷ 60 s)²
- **Intro text:**
  - GOAL: “Survive the rooftops as long as you can.”
  - HOW:
    - “Swipe left or right to change lane, up to jump, down to slide.”
    - “It keeps getting faster.”
  - SCORE: “The longer you last, the more you score - the full minute is 150.”

#### Sort Rush (`sortrush`)

- **Category / status:** Arcade · Retired (practice only)
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 2 gates, 3 from 20 s
- **Revision:** `speedPar: 1` only
- **Input:** Swipe left / right / down
- **Scoring:** `sortScoreOf()` in `src/lib/arcade/sortRush.ts`, replayed on the server by `src/lib/duel/sortRush.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Spawn 1.0 → 0.4 s; swaps every 12–15 s; round(150 × sorted ÷ total) − 2 per wrong
- **Intro text:**
  - GOAL: “Sort every shape into the gate of its colour.”
  - HOW:
    - “Swipe left or right - from 20 seconds there's a middle gate too (swipe down).”
    - “The gate colours swap; watch for the flash.”
  - SCORE: “Points for the share you sort; wrong gates cost 2.”

#### Steady (`steady`)

- **Category / status:** Arcade · Retired (practice only)
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** Track 44 → 18 px wide
- **Revision:** `speedPar: 1` only
- **Input:** Slide finger left / right
- **Scoring:** `score()` in `src/lib/arcade/steady.ts`, replayed on the server by `src/lib/duel/steady.ts` from `src/lib/duel/grade.ts`
- **Tuning:** Narrows every 4 s; touch every 30 ticks off-track; 150 − 5 per touch
- **Intro text:**
  - GOAL: “Stay inside the track.”
  - HOW:
    - “Slide the ball left and right to stay inside the track. It gets narrower and faster.”
    - “Touching an edge costs a touch every half second until you're back inside.”
    - “Keep your finger down - lifting it for more than half a second costs touches too.”
  - SCORE: “150 − 5 per touch.”

#### Swerve (`swerve`)

- **Category / status:** Arcade · Retired (practice only)
- **Time limit:** registry 63,000 ms (63 s); sim run 60 s (registry − 3 s `ARCADE_PHASE_SLACK_MS`)
- **Board and items:** 5 lanes
- **Revision:** `speedPar: 1` only
- **Input:** Tap left / right
- **Scoring:** `score()` in `src/lib/arcade/swerve.ts`, replayed on the server by `src/lib/duel/swerve.ts` from `src/lib/duel/grade.ts`
- **Tuning:** 75 coins; speed 768 → 1536 (+20 per coin); 2 per coin
- **Intro text:**
  - GOAL: “Collect coins while dodging the blocks.”
  - HOW:
    - “Tap left or right to swerve one lane across five lanes.”
    - “Hit a block and the run ends.”
    - “Every coin speeds the course up a little.”
  - SCORE: “75 coins in the run; 2 per coin, so all 75 = 150.”

### Memory

#### Number Climb (`numclimb`)

- **Category / status:** Memory · Retired (practice only)
- **Time limit:** registry 20,000 ms (20 s); no sim run (not on the arcade clock) — plus a memorise/playback prep phase before the clock (`prepMs`)
- **Board and items:** 12 digits (`NUMBER_CLIMB_LENGTH`)
- **Revision:** `speedPar: 1` only
- **Input:** Keypad entry, Submit
- **Scoring:** `scoreNumberClimb()` in `src/lib/duel/scoring.ts`
- **Tuning:** 6 s memorise (prep), 20 s answer; all 12 = 100 + 0–50 speed; else round(100 × span ÷ 12), cap 90
- **Intro text:**
  - GOAL: “Recall all twelve digits in the exact order.”
  - HOW:
    - “Memorise the digits while they are visible.”
    - “Type them back from the beginning.”
    - “Press Submit when you are done.”
  - SCORE: “Each correct digit in a row increases your span.”

#### Reverse Recall (`reverse`)

- **Category / status:** Memory · Retired (practice only)
- **Time limit:** registry 30,000 ms (30 s); no sim run (not on the arcade clock) — plus a memorise/playback prep phase before the clock (`prepMs`)
- **Board and items:** 6-tile sequence on a 4-column grid
- **Revision:** `speedPar: 1` only
- **Input:** Tap tiles
- **Scoring:** Default `scoreRound()` in `src/lib/duel/scoring.ts`
- **Tuning:** Flash 700 ms, gap 350 ms, lead-in 700 ms
- **Intro text:**
  - GOAL: “Repeat the full tile sequence backwards.”
  - HOW:
    - “Watch the tiles light up one by one.”
    - “Tap them back last one first.”
    - “Tap again to undo your latest matching tap.”
  - SCORE: “Complete the sequence faster = more points.”

#### Sequence Recall (`sequence`)

- **Category / status:** Memory · Retired (practice only)
- **Time limit:** registry 30,000 ms (30 s); no sim run (not on the arcade clock) — plus a memorise/playback prep phase before the clock (`prepMs`)
- **Board and items:** 7-tile sequence on a 4-column grid
- **Revision:** `speedPar: 1` only
- **Input:** Tap tiles
- **Scoring:** Default `scoreRound()` in `src/lib/duel/scoring.ts`
- **Tuning:** Flash 700 ms, gap 350 ms, lead-in 700 ms
- **Intro text:**
  - GOAL: “Repeat the full tile sequence in the same order.”
  - HOW:
    - “Watch the tiles light up one by one.”
    - “Tap them back in the same order.”
    - “Tap again to undo your latest matching tap.”
  - SCORE: “Complete the sequence faster = more points.”

#### Spatial Memory (`spatial`)

- **Category / status:** Memory · Retired (practice only)
- **Time limit:** registry 20,000 ms (20 s); no sim run (not on the arcade clock) — plus a memorise/playback prep phase before the clock (`prepMs`)
- **Board and items:** 5×5 grid, 8 tiles in 4 pairs
- **Revision:** `speedPar: 1` only
- **Input:** Tap tiles
- **Scoring:** Default `scoreRound()` in `src/lib/duel/scoring.ts`
- **Tuning:** Groups shown 1,000 ms with 300 ms gaps
- **Intro text:**
  - GOAL: “Find all eight tiles that lit up.”
  - HOW:
    - “Watch four pairs appear on the grid.”
    - “Tap all eight tiles after they vanish.”
    - “Choose any order and tap again to undo.”
  - SCORE: “Find every tile faster = more points.”

## Intro text versus code

Every place where the GOAL / HOW / SCORE copy in `src/lib/duel/instructions.ts` disagrees with what the code does, or leaves out a rule that changes the score. I checked all 94 intros against their scorers and generators. The rest match the code.

### Contradictions (the intro says something the code does not do)

1. **Ball Tracker (`balltrack`), SCORE.** The intro says the bonus is “round(20 × sim time left ÷ 60 s)”, a straight line. The code calls `finishScore()` → `speedBonusCurve()`, and every new puzzle is stamped `speedPar: 1`, so the 50 % par curve applies: round(40 × left ÷ 60 s) up to the full 20. Example: finishing with 6 s left scores 4, not 2. The last ball drops at 49.8 s, so the bonus is always small.
2. **Scrumper (`snip`), SCORE.** Same issue: “round(20 × time left ÷ 60 s)” against `snipScore()` → `speedBonusCurve()` on the par curve (full 20 with ≥ 30 s left).
3. **Swish (`bintoss`), HOW.** “Each wind point moves the ball a quarter of a bin width” (and “Wind 2 … aim half a bin width”). Under the current `binRev: 2` the bin is scaled to 85 % but the wind constants are not (`BINTOSS_WIND_ACC*` use the original half-widths). One wind point is 20 px against a 68 px opening (about 29 %) on throws 1–3, and 17 px against 57.8 px (about 29 %) from throw 4. The quarter-width rule only holds for unstamped (original-bin) rounds.
4. **Tents and Trees (`tents`), HOW.** “The signposts say how many tents are in each row and column.” `generateTents()` hides 11 of the 16 line counts (stored as `-1`, treated as unconstrained), so only 5 rows or columns carry a number.
5. **Fission (`burst`), SCORE.** “Clear four waves without losing a life for 150.” `burstScoreOf()` only pays the 150 when the run has *ended* with no life lost and ≥ 4 waves cleared. A life loss never ends the run on its own (three do), so in practice this means surviving the full 90 s untouched. Before the end, the score is 2 per hit.
6. **Go / No-Go (`gonogo`, retired), SCORE.** “Perfect = speed bonus (the full bonus if you finish with at least half the time left).” `scoreGoNoGo()` pays a reaction-time bonus instead (`reactionBonus()`: 50 at ≤ 150 ms average, falling to 0 at 650 ms). Time left is not used.

### Omissions and imprecision (the intro is incomplete in a way that affects the score)

7. **Blackout (`lightsout`), SCORE.** It lists “1-4 lights left = 85 / 75 / 60 / 50” but leaves out the fallback when five or more lights are left: 5 per solution tap still standing, up to 45 (`scoreLightsOut()`).
8. **Tents and Trees (`tents`), SCORE.** “10 per correct tent” has a cap of 110 that isn’t mentioned (`scoreTents()`). The full score also needs the tents to match the stored solution exactly, with no wrong tents. Because uniqueness is proved, this matches “complete” in practice.
9. **Scrumper (`snip`), HOW.** “10 levels, 12 s each” in a 60 s run: 12 s is a per-level cap (`SNIP_LEVEL_TICKS`). Ten full-length levels would need 120 s, so the run usually ends first.
10. **Hot Floor (`hotfloor`, retired), HOW.** No mention of the 3 lives (`START_LIVES`) that end the run.

## Code comments and design notes versus code

These are not intro text, but they describe gameplay and are out of date. No player sees them.

- **`src/puzzles/AGENTS.md`, Whack-a-Target:** says lifetimes shrink 900 → 450 ms and the pop gap ramps 42 → 10 ticks. In code it's `WHACK_LIFE_START_TICKS` 54 → `WHACK_LIFE_END_TICKS` 36 (900 → 600 ms) and `POP_GAP_START` 42 → `POP_GAP_END` 13.
- **`src/puzzles/AGENTS.md`, Intruder Detection:** says “show 5 s … pick 3 s”. In code it's `INTRUDER_SHOW_MS` 7,000 and `INTRUDER_PLAY_MS` 5,000 (15 s a board, 75 s total). The intro text (7 s / 5 s) matches the code.
- **`src/puzzles/AGENTS.md`, Clay Shoot:** says paths that stay “under 1 s on screen” are rerolled. In code it's `minOnScreenTicks: 36` (0.6 s), which agrees with the `CLAY_CONFIG` comment.
- **`src/lib/duel/registry.ts` (`puzzleTimeLimitMs` comment):** mentions “Tower's five-disc variant”. Tower always generates 9 discs (`TOWER_DISCS`); the stored `timeLimitMs` is 90 s, the same as the registry.
- **`src/lib/arcade/binToss.ts`:** the wind comment says one wind point is “a quarter of the bin opening, 25 px”. The formula gives 20 px (half of `BINTOSS_BIN_HALF`, 40 px).
- **`src/lib/arcade/matchup.ts`:** the `raw` field comment says “the round score is this divided by eight”. The scorer is floor(150 × raw ÷ 2,500).
- **`src/puzzles/stopWatch.tsx`:** a comment says “record a miss after three passes”. Watches allow 2–11 passes (`passes: index + 2`).
- **`src/lib/duel/types.ts`:** `WordsmithPuzzleData.letters` says “Nine letters, row-major 3×3” (boards have 8–11 letters on round tiles). `WordHuntPuzzleData.grid` says “Sixteen tiles” (the grid is 5×5 = 25). `CountUpPuzzleData.stages` says “5×4, 7×6, then the full packed grid” (every stage is generated with `cols: 10, rows: 10` and 50 / 80 / 110 shapes placed freely by percentage).
- **Defined but unused by the scorer:** `SKYLINE_PAR`, `SKYLINE_POINTS_CAP`, `SKYLINE_SURVIVE_BONUS`, `RALLY_PAR`, `RALLY_HIT_POINTS`, `RALLY_POINTS_CAP`, `RALLY_SURVIVE_BONUS`, `PAIR_CLEAN_FLIPS`, `PAIR_CLEAN_BONUS`. These are leftovers from earlier scoring rules.

## Other observations

- **Ascend (`numhunt`)** is graded from the count of numbers reached and wrong taps that the phone reports (`"done,errors,ms"`). The server clamps them but does not replay the taps. That doesn't fit CLAUDE.md rule 7 (“the server grades from moves/inputs”). Go / No-Go (retired) does the same with `correctCount`. Reaction and Bang On are timed on the phone by design.
- **Chroma Lines (`flow`)** generation threw “could not build a unique board” once in my first sample call. 20 further calls all succeeded, at about 4 s each. The failure is rare but possible. A throw at room start would come from `generateFlow()` (3,000 attempts, 60,000-node uniqueness budget).
- **Bomb Defusal (`bomb`):** the registry says 75 s, but every new (v2) panel carries `timeLimitMs: 90000`, which wins. Listings that read only `typeTimeLimitMs("bomb")` will show 75 s.

