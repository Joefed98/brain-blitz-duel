# Duelz — Game Bank

The reference list of every game: active, retired to practice, still to build, and held back. **Rewritten 13 Oct 2026 from the code on `main` (commit `2874c3e`, after Tuning E)**, the way the 10–11 Oct rewrite was done: names from `gameNames.ts`, status from the registry (`RETIRED_TYPES`), time limits from each game's `timeLimitMs`, revisions from what `generatePuzzle()` stamps on a new round today, and descriptions from the code and the game's own intro and "?" help. Where this doc and the code disagree, the code wins. Scoring formulas are in `docs/duelz-scoring-reference.md`; this doc says what the score is based on.

Legend: **Active** = dealt in rooms · **Retired** = practice only, never dealt in rooms (stored rounds still replay and score on their own rules) · **To build** = agreed candidate · **Bank** = in the pool, not yet chosen · **Held** = deliberately parked. Internal ids (in brackets) never change; only display names do. **Time** is the registry limit; engine games run 3 s less (the arcade slack). **Revision** is the stamp a new round carries besides `speedPar: 1`, which every new puzzle has; "—" means no game-specific stamp.

## What changed since the 11 Oct version

- **Rotation (13 Oct, later the same day):** Interloper (`intruder`) is retired to practice, so **Attention: 7 → 6 active**. Chroma Lines (`flow`), Pipeline (`pipes`) and Heave (`push`) move from Logic to Pattern: **Logic 14 → 11, Pattern 7 → 10**. A game's category is read only when a room is dealt and for labels, colours, music and practice lists; stored rounds keep their puzzle types and the host's chosen categories, so stored rounds and room history are unchanged. `category-pool-check` fails if any category the lobby offers drops below 6 active games. **Totals: 73 active, 28 retired.**
- **Word: 6 → 10 active.** Strikeout, Cryptogrid and Swapword (word batch, 12 Oct) and Letterfall (an arcade-engine word game, 12 Oct) added.
- **Number: 6 → 9 active.** Brimful, Checkout and Ballpark (number batch, 12 Oct) added.
- **Speed:** Flash, Bang On and Ascend send raw tap logs that the server scores (`tapRev: 1`, 12 Oct). Careless play costs more since 13 Oct (Flash and Bang On `tapRev: 2`, Pull! `clayRev: 4`): random Bang On taps about 72, tapping every Flash colour about 54, mashing Pull! about 16; honest bands within 2.
- **Arcade: 22 → 21 active.** Junction is retired to practice (Tuning C, 12 Oct). Every arcade game moved on: Batches 1–5 (11–12 Oct) added new rules to all 21 plus Junction; the Oct 2026 score bands (12 Oct) put every arcade game on one scoring shape; Tunings A, B, C and E (12–13 Oct) changed play or curves for 17 of them; Polish F and G and Tuning D (12–13 Oct) changed drawing and effects only. Each game's line in the Arcade table gives its current play and stamp; the revision history is in the scoring reference, section 11.2.
- **Rotation** (decided 10 Oct) is built and seeded (11–12 Oct): see "How rooms use the bank".
- **Scoring model:** arcade now scores on the bands (curve to 140 + up to 10 for a finish, or to 150 on open games); the 130 / 150 split describes stored rounds only.
- **Corrections from the code:** Bomb Defusal is 90 s (stored on the puzzle; the registry default 75 s applies to old version-1 bombs); Mixed Signals is 78 s (75 s run); Gridlock draws from a database bank with a 400-row fallback; Hanoi always 90 s.
- **Totals:** 73 active, 28 retired, 101 in all after the 13 Oct rotation (74 / 27 before it; 71 / 27 on 12 Oct, 68 / 26 in the 11 Oct game facts).

---

## How rooms use the bank

**Rotation (as coded, 11–12 Oct).** The host picks categories in the lobby (presets: Standard = Logic, Pattern, Speed, Attention, Word and Arcade; Puzzles only = the same without Arcade; Number is selectable; Memory is never offered). Every room has 6 rounds (7 when all seven playable categories are selected), shared equally: each category gets floor(6 ÷ n) rounds, and the remainder go one each to different categories picked by the seeded draw (4 categories → 2 extras, 5 → 1). The rounds are shuffled on the room seed until no category sits next to itself (a one-category room is the only exception); Arcade is an ordinary category and can land in any round, including round 1, and an arcade-only room plays six different arcade games. No game repeats within a room; within a category the game is drawn on the room seed with recent-avoidance weights over the host's last three rooms (0.25 / 0.5 / 0.75), and a game from the host's previous room is skipped while its category still has three or more others. The same seed and history deal an identical room (`room-rounds-check`). Everything a round needs (puzzles, order, arcade seeds, banked boards, word answers) is derived once from the room seed on the server and stored, so every player gets the same rounds.

**Scoring model (all games; formulas in the scoring reference).**
- Standard puzzles: complete = 130 + up to 20 for speed; unfinished = per-item credit below 130.
- Fewest-moves puzzles: 100 + up to 25 for moves + up to 25 for speed (Colour Flood 40 / 10).
- **Speed par (10 Oct):** every speed bonus pays in full with at least half the time left, then falls evenly to 0 at the buzzer (`speedPar: 1` on every new puzzle; older rounds keep the old linear curve).
- **Arcade score bands (12 Oct):** each game counts its achievement in units on a curve fitted so the same skill lands in a similar band in every game (average about 70, good 100, great 125, near-perfect 140–150). Finish games: curve to 140 plus up to 10 for finishing; open games: curve to 150. A run with no input scores 0.
- Maximum 150 per round. Ties on total break on lower total answer time.
- The server is the arbiter: phones send moves, answers, input logs or tap logs, never scores; arcade inputs are replayed on the server's deterministic engine.

**Shared feel features (Oct 2026).** Red pulsing timer and ticks in the final 10 s; consistent wrong-answer shake and red outline; solve flourishes on puzzle reveal boards; near-miss lines on arcade results; the shared arcade success layer (bursts, lights, arena glow, streak banners, Retro border lights) and one success-text colour per game; personal bests in practice (stored on the device). **Added 13 Oct (rotation):** the shared signature beat (a gold flash and app-logo burst, 0.6 s, 1.0 s after a solve or finish; a bigger "fast" tier with at least half the time left; a gold burst on a stored 150 on the reveal; `src/lib/fx/signature.ts`); "?" help sheets that scroll inside the sheet with the close button always on screen; one-page intros (GOAL one sentence, HOW at most three short lines, detail in "?" help); named sound cues for every new moment (`docs/sound-cues/`).

**Dictionary.** Free SCOWL-based British list on the server (`dictionary.server.ts`); help text says "standard British English dictionary". Strikeout, Cryptogrid and Swapword answers come from the common-words list (SCOWL sizes ≤ 35). Letterfall alone ships an exact packed copy to the phone. Oxford Languages and Collins Scrabble Words quotes to request (master plan step 8b).

**Intro demos.** Demos replay a saved practice run per game (`intro_demos`); revisions that changed a game's look or rules need their demo re-recorded (master plan step 8).

---

## Word (core) — 10 active

| Game (id) | Status | Description | Time | Revision |
|---|---|---|---|---|
| Nucleus (wordsmith) | Active | Atom board: a glowing centre letter (in every word) and 7–10 outer tiles, 8–11 letters in all; there is always a word using every tile. Tap tiles to build, tap again to remove, Clear / Enter, free Shuffle. 4+ letters, no plurals or -s verb forms. Score from word points (8 letters 11, 9+ letters 15). | 100 s | — |
| Forage (wordhunt) | Active | 5 × 5 letter grid; drag or tap through touching letters, diagonals included; 4+ letters, plurals allowed. Score = 2 × word points. | 100 s | — |
| Interlock (tilegrid) | Active | Build a mini crossword from 15 letter tiles on a 7 × 7 board; every run must be a word of 3+ letters and all tiles must connect. Unfinished credit counts tiles inside real words. | 100 s | — |
| Slider (wordslide) | Active | Five rows of five letters; swipe rows sideways or columns up and down (letters wrap) until every row is a word; a padlock holds a finished row. Score = solved + speed + moves against par; 22 per word row otherwise. | 100 s | — |
| Lookout (wordsearch) | Active | Find six themed words hidden in a 10 × 10 grid (any straight line, backwards too); a found word is struck through and fills a chip. 20 per word; wrong picks cost nothing. | 120 s | — |
| Roundabout (letterwheel) | Active | Drag across a letter wheel to fill a small crossword of 8 or 9 words; free Shuffle. Per-word credit; all found = 130 + speed. | 100 s | — |
| Strikeout (strikeout) | Active | Five hidden five-letter words. Guess letters on the shared QWERTY keypad (each fills every matching tile; gold keys are in the puzzle, red ones strikes) or tap a word and Solve it; five strikes end the round. Per word and letter credit; all five = 120 + 4 per strike left + speed. | 100 s | strikeoutRev 1 |
| Cryptogrid (codeword) | Active | A 7 × 7 filled crossword with a number in every white square; four numbers start decoded; assign a letter to each number to crack the code. 1,000-board bank, each proven unique against the full dictionary. Credit per number; cracked = 130 + speed. | 120 s | codewordRev 1 |
| Swapword (swapword) | Active | 21 tiles in a 6 × 6 figure-eight of six crossing words; swap tiles until every word reads (gold = in place, teal = belongs elsewhere in a crossing word, grey = fits neither); the swap budget is the proven minimum + 5. 5 per tile placed; solved = 100 + swaps + speed. | 120 s | swapwordRev 1 |
| Letterfall (wordfall) | Active (engine) | Arcade-engine word game in the Toybox world: a 6 × 9 well starts with 3 rows of tiles and seeded tiles drop into seeded columns, faster every 18 s. Tap touching tiles (8 directions) to chain a word and tap the last again or Enter; a real word of 3+ letters clears and tiles above fall, a non-word shakes at no cost; a tile that can't enter a full column ends the run. Word points 1 / 2 / 4 / 7 / 11 for 3 / 4 / 5 / 6 / 7+ letters (Qu = 2); 150 at par 30. The phone fetches and caches an exact copy of the word list when Letterfall is in the round order. | 93 s (90 s run) | wordfallRev 1 |
| Word Ladder (ladder) | Retired | One letter at a time between two words (retired 6 Oct). | 60 s | — |
| Groups (groups) | Retired | Sort sixteen words into four linked groups. | 90 s | — |
| Word Match (wordmatch) | Retired | Synonym / antonym pairs. | 45 s | — |
| Compound Words, Word Drop | To build (high) | See the master plan's new-games table. | | |
| Fill-In, Cryptex, Unscramble Ladder, Mini Crossword | To build (medium / low) | | | |
| Longest Word / Word Association Chain / Reverse Definitions / Homophone Match / Speed Typing / Crossword Sprint | Bank | | | |

## Number — 9 active (selectable; not in the default presets)

| Game (id) | Status | Description | Time | Revision |
|---|---|---|---|---|
| Exact (target) | Active | Six tiles and a target (101–999); combine pairs with + − × ÷ (whole numbers only) to hit it exactly; history of steps shown. Smooth near-miss curve on the closest number made. | 75 s | — |
| Operator (equation) | Active | Four equations, worked left to right, each harder (the last uses division); fill the operator gaps. Stages 25 / 30 / 35 / 40; all four = 130 + speed. A true equation holds for 1 s, then moves on. | 90 s | — |
| Counterweight (balance) | Active | Three scales: hang kettlebells on numbered notches of a brass beam until it balances (fixed weights are dark iron with a lock). 20 for the first scale, 60 for two in order, all three = 120 + speed. | 90 s | — |
| Integer Pyramid (numpyramid) | Active | Four five-row pyramids; drag tiles in so every cell is the sum of the two below (two decoy tiles each). 30 per pyramid + partial credit on the current one; all four = 120 + speed. | 120 s | — |
| Trail (trail) | Active | 6 × 6 board with 10 fixed numbers; place the other 26 to make one continuous path from 1 to 36 (diagonals allowed). 5 per tile in its correct square; complete = 130 + speed. | 120 s | — |
| Brimful (measure) | Active | Four pouring puzzles: get exactly the target in one jug using the tap and drain, or (puzzle 4, no tap) make the split shown. True minimums by breadth-first search. 25 per puzzle + up to 5 for moves; all four adds up to 30 for speed. | 120 s | measureRev 1 |
| Checkout (checkout) | Active | Darts maths on five changing boards (standard, shuffled, uneven values, an x4 ring with a treble finish, two negative wedges with exactly four darts); hit zero exactly and finish in the ring shown. Routes and fewest darts proved by exhaustive search. Boards 18 / 20 / 22 / 24 / 26, +2 each in the fewest darts; all five adds up to 30 for speed. | 90 s | checkoutRev 1 |
| Ballpark (numline) | Active | Three number lines (0–1, 0–100, then −50–50 or 0–1,000), five numbers or expressions each; drag a marker (with a magnifier) and Place. Up to 8 per number by accuracy (full within 2 %, none at 15 %); the speed part scales with accuracy. | 75 s | numlineRev 1 |
| Tenfall (tendrop) | Active (engine) | Arcade-engine game: tap falling tiles to make a running total hit each of ten targets exactly; ×2, ÷2, ÷3 and −N tiles work on the total, overshooting resets it to 0. 13 per target; all ten adds up to 20 for clearing early. | 93 s (90 s run) | — |
| Sum Hunt (sumhunt) | Retired | Clear digit paths that add up to a rising target. | 90 s | — |
| Number Sequence (numseq), Percent Sprint (pctsprint), Chain Calculation (chaincalc) | Retired | | 45 s each | — |
| Equation Fill, Merge Target | To build (high) | | | |
| Change Up, Cages, Magic Square, Prime Rush | To build (medium / low) | | | |
| Calc-grid / Mental Math Sprint | Bank | | | |

## Memory (dormant) — 0 active

| Game (id) | Status | Description | Time |
|---|---|---|---|
| Spatial Memory (spatial), Number Climb (numclimb) | Retired | Testers' least favourites. | 20 s each |
| Sequence Recall (sequence), Reverse Recall (reverse) | Retired | | 30 s each |
| Route Memory / Maze Memory | To build | Only if the category is revived. | |
| Story Recall / Face-Name Pairing / Digit-Symbol Substitution | Bank | | |

Decision still open: revive Memory with new games or drop it. The category is never offered or drawn.

## Speed, reaction & precision (core) — 6 active

| Game (id) | Status | Description | Time | Revision |
|---|---|---|---|---|
| Flash (reaction) | Active | The screen turns gold 5–8 times at seeded moments among decoy pulses; tap the instant it does. 150 at ≤ 200 ms average, −16 per 100 ms slower; a miss counts 1,200 ms; false starts (a decoy, a dark-screen tap, or a tap within 0.1 s of the gold) cost 8 each for the first two and 11 each after that (tapRev 2; tapRev 1: 8 each). The server works it out from the raw tap log. | 60 s | tapRev 2 |
| Bang On (stopwatch) | Active | Stop the sweeping marker in the gold zone on 10 watches (moving targets, a hidden final third, accelerating and wrapping sweeps); big timing bar with the last three results. 150 at ≤ 20 ms average error, −27 per 100 ms more to 101 at 200 ms, then an even fall to 0 at 325 ms (tapRev 2; tapRev 1: to 74 at 300 ms, 0 at 500 ms); a miss counts 500 ms. Server-scored from the tap log on a fixed watch schedule. | 60 s | tapRev 2 |
| Ascend (numhunt) | Active | 24 two-digit discs; tap them smallest to largest; untapped discs move every 15 s. 5 per number, −5 per wrong tap; all 24 = 130 + speed. Server-scored from the tap log (an unfinished run now scores). | 60 s | tapRev 1 |
| Don't Break the Chain (chain) | Active | Tap glossy charms following the shape-and-colour cycle; a gold chain grows across the top. Momentum windows 3 / 2.5 / 2 s; a wrong tap or a lapse ends the run; the board reshuffles every 5 links. 3.5 per link; all 40 = 140 + speed. | 45 s | rulesVersion 2 |
| Bonk (whack) | Active (engine) | Gophers in gold or red hard hats pop from burrows (the window shrinks); tap the colour the banner says as the rule flips 3–5 times; avoid hedgehogs. Up to 135 for the share of targets hit, −3 wrong hat or empty burrow, −5 hedgehog, +15 for every target. | 63 s (60 s run) | — |
| Pull! (clayshoot) | Active (engine) | 22 orange and 3 gold clays (later two at once); tap to shoot exactly where you tap. 10–12 white birds cross the sky: −10 per bird hit. 5 per orange, 10 per gold, +10 for all 25 with no bird hit; the first 30 shots that hit nothing are free, then every 20 more cost 1 (clayRev 4). A shot on a clay and a bird always hits the clay. | 63 s (60 s run) | clayRev 4 |
| Go / No-Go (gonogo) | Retired | Tap gold circles, ignore everything else. | 30 s | — |
| Target Tracking, Stop at 11 | To build | | | |
| Aim Precision / Rhythm Tapping / Simon-Says Pattern Speed | Bank | | | |

## Attention & perception (core) — 6 active

| Game (id) | Status | Description | Time | Revision |
|---|---|---|---|---|
| Mixed Signals (stroop) | Active (engine) | Lane sorter: steer 52 falling colour words into the matching gates, by ink or by meaning as the banner's rule swaps every 15 s; 3 lanes, then 4 from 30 s; five 15 s phases, each faster. round(130 × correct ÷ 52) − 2 per wrong gate; sorting all 52 adds up to 20 for speed. | 78 s (75 s run) | clashRev 3, queue 52 |
| Eagle Eye (symscan) | Active | Three growing grids (5 / 6 / 7 columns) of top-down eagles facing 8 directions; tap every eagle matching the target, then Submit. Stages 30 / 45 / 55, −3 per wrong tap; speed bonus only when all three grids are perfect. | 30 s | — |
| Double Take (spotdiff) | Active | Two sweet-shop pictures; find six differences (colour swaps, item swaps, flips). 20 per difference; all six = 130 + speed. | 30 s | — |
| Tally (countup) | Active | Three crowded display trays of outlined shapes in named colours; count the ones each question asks for and type the total. Stages 30 / 45 / 55 (off by 1 = 60 %, off by 2 = 30 %); all exact adds speed. | 45 s | — |
| Labyrinth (maze) | Active | 19 × 19 branching maze; drag the gold player cell by cell from the start to the exit. 110 × share of the route reached; solved = 130 + speed. | 60 s | — |
| Interloper (intruder) | Retired | Retired to practice 13 Oct (rotation); stored rounds replay and score on their own rules. Five parties: memorise the guests (head shape + colour) in spotlights for 7 s; the lights dim; tap every guest who changed within 5 s. Two changes on parties 3–5; guests swap places on 4–5. 24 per party right. | 75 s | — |
| Matchmaker (pairmatch) | Active | 15 pairs of cards with patterned backs; turn two at a time. 8 per pair; all 15 = 130 + speed. | 90 s | — |
| Crowd Sort | To build (arcade) | | | |
| Hidden Object Search / Focus Filter / Sequence Spotting | Bank | | | |

## Pattern & spatial (core) — 10 active

| Game (id) | Status | Description | Time | Revision |
|---|---|---|---|---|
| Gridlock (unblock) | Active | Slide blocks along their own direction to free the gold block through the marked exit; 7 × 7 lot, 11–14 vehicles, 15–22-move minimum, drawn from a database bank (400-row built-in fallback). Fewest-moves scoring. | 60 s | — |
| Tessellate (blockparty) | Active | Fit nine polyomino pieces into the 29 free squares of a 6 × 6 board around seven fixed pegs; tap to rotate. 1,000-board bank. 12 per piece; complete = 130 + speed. | 60 s | — |
| Skid (iceslide) | Active | 12 × 12 ice: swipe to slide until something stops you; holes, one-way arrows, portals and cracked ice; gold exit. 1,000-board bank. Fewest-moves scoring. | 90 s | — |
| Topsy-Turvy (gravity) | Active | 9 × 9 board: tilt so four balls slide together and lock on their own targets (a locked ball becomes a wall). 1,000-board bank. 30 per locked ball; fewest-moves scoring when solved. | 90 s | — |
| Jumbled (tiles) | Active | 3 × 3 slide puzzle, tiles coloured on a ramp from 1 to 8; every slide counts, undone ones too. Fewest-moves scoring. | 60 s | — |
| Turntable (rings) | Active | DJ deck: five linked vinyl rings of eight segments with a link legend; turn rings until every spoke is one colour; a strobe dot lights per solved spoke. Fewest-moves scoring. | 60 s | — |
| Lightbender (laser) | Active | 10 × 10: place mirrors and a movable splitter so one beam lights all six gems (two only from a marked direction) while avoiding bombs; three FIRE shots: 130 / 115 / 100 + speed for shot 1 / 2 / 3. | 60 s | — |
| Chroma Lines (flow) | Active (from Logic, 13 Oct) | 9 × 9, 10–12 colour pairs, 2–4 striped wall cells; join every pair with non-crossing paths that fill every square. 1,000-board bank. 10 per pair unfinished. | 75 s | — |
| Pipeline (pipes) | Active (from Logic, 13 Oct) | 7 × 7: rotate pipe tiles to connect every tile to the source with no leaks; water flows through on a solve. Stepped credit by tiles connected. | 120 s | — |
| Heave (push) | Active (from Logic, 13 Oct) | Warehouse Sokoban on 9 × 9: push 4–5 wooden crates onto hatched floor markings in the fewest pushes. 120-board bank. | 120 s | — |
| Pattern Completion (patcomp), Spin (spin), Mirror Match (mirmatch) | Retired | | 30 / 45 / 60 s | — |
| Pattern Shift / Shape Assembly / Shape Rotation (3D) / Shadow Match / Matrix Reasoning / Complete the Reflection / Mirror or Turn? | To build | | | |
| Shape Folding / Block Stacking / Jigsaw Assembly / Grid Pathfinding | Bank | | | |

## Logic (core) — 11 active

| Game (id) | Status | Description | Time | Revision |
|---|---|---|---|---|
| Blackout (lightsout) | Active | 6 × 6 lights with bulb outlines; a press flips a light and its four neighbours; turn them all off in the minimum (8–12 presses, unique). Fewest-moves scoring. | 75 s | — |
| Box Six (sudoku) | Active | 6 × 6 sudoku with 2 × 3 boxes, 14–16 givens and pencil marks; unique solution. | 90 s | — |
| Hanoi (tower) | Active | Tower of Hanoi: nine size-coloured rings from a random legal start onto the gold post, 3 or 4 posts. Minimum moves shown on the reveal. | 90 s | — |
| Polypotions (tubes) | Active | Sort liquid layers so every flask is one colour (10 flasks, capacity 5, 8 colours, partial pours); a full flask gets a cork. 1,000-board bank. | 90 s | — |
| Safe Cracker (safe) | Active | Four dial drums, five clues, one combination; three tries: 130 / 115 / 100 + speed. | 75 s | — |
| Bomb Defusal (bomb) | Active | Six-step bomb: a rule card (ordering, conditional and counting rules, every one needed) allows exactly one six-action sequence on 7 wires, 2 buttons, a light, a serial and a switch; one wrong step and it explodes. Partial = round(75 × correct steps ÷ 6). 300-bomb bank. | 90 s (stored on the puzzle) | bombVersion 2 |
| Mosaic (nonogram) | Active | 7 × 7 picture logic from 48 pictograms; −5 per wrong cell. | 120 s | — |
| Colour Flood (flood) | Active | 14 × 14 wet-paint board in five colours; flood from the top-left within par (10–14 moves). 400-board bank. 100 + 40 moves + 10 speed. | 60 s | — |
| Tents and Trees (tents) | Active | 8 × 8 campsite: pitch a striped tent beside every tree (11–12), none touching, matching the signposted row and column counts. | 90 s | — |
| Shikaku (shikaku) | Active | Cut a 10 × 10 grid into rectangles, each holding one number equal to its area. | 90 s | — |
| Lamplighter (lightup) | Active | 9 × 9: place lamps to light every white square without two lamps seeing each other; numbered walls. 1,000-board bank. −5 per clashing lamp. | 90 s | — |
| One-Stroke (stroke), Dig (dig) | Retired | | 30 / 60 s | — |
| Robot Instructions / Circuit Builder / Minefield / Magnetic Maze / Domino Logic / Escape Room / Find the Rule / Bridges | To build | | | |
| Logic Grid / Odd-One-Out / Syllogism Check / Truth-Teller / Weighing Puzzle / Cryptic Clues / Elimination Grid | Bank | | | |

## Arcade (core) — 21 active

All run on the deterministic engine: 60 ticks a second, integer physics, seeded courses identical for everyone in a room, and the server replays the input log. Every gameplay change is version-stamped so stored rounds replay and score as they were (history per game in the scoring reference, section 11.2). Every game scores on the Oct 2026 bands (cap 150); the unit and finish rule are given below. **Run** = the sim's run; the registry limit is 3 s more. Worlds share one art style each (`ARCADE_GAME_WORLDS`).

**Batches and tunings since 11 Oct.** Batch 1 (11 Oct): Jaywalk, Roofbound, Ball Tracker, Slice. Batch 2 (11–12 Oct): Gemstone, Coral Pop, Meteor, Hover. Batch 3 (12 Oct): Wavefront, Grappler, Breaker, Fission. Batch 4 (12 Oct): Scrumper, Junction, Tilt, High Rise. Batch 5 (12 Oct): Swish, Flightpath, Rally, Tempo, Rainbow Bridge, Orbit. Score bands (12 Oct): all 22. Tuning A (12 Oct): Wavefront shapes, Orbit fly-in, Grappler touch stars, High Rise flag and Tilt cups (art and generator only). Tuning B (12 Oct): Flightpath balloons, Breaker Fireball, Rally pads; display changes to Coral Pop, Fission, Junction and the Retro games. Tuning C (12 Oct): Gemstone wait-for-fall and 2,500 par, Grappler and Hover about 10 % lower, Rainbow Bridge refitted, Roofbound earlier bend and 10 % higher, Tempo 10 % higher, Wavefront slower waves 3–4 and timed boss kill, Tilt hole stars, Slice blade; Junction retired. Tuning D (12 Oct, display only): success lights and arena glow. Polish F (12 Oct, display only): Ball Tracker, Coral Pop, Flightpath, Jaywalk (daylight palette), Swish. Polish G (13 Oct, display only): Gemstone, Grappler, Roofbound, Tempo, Wavefront, Tilt, Slice art; Retro border lights for Rally, Breaker and Hover. Tuning E (13 Oct): taller worlds for High Rise, Meteor, Scrumper and Hover; deeper Scrumper with picker's crooks; Hover star field.

| Game (id) | World | Input | Description (current revision) | Run | Revision |
|---|---|---|---|---|---|
| Hover (hover) | Retro | tap / hold | Fly a saucer through 42 barrier gaps in a 390 × 735 sky; later barriers have two gaps or slide; 10 gold stars in tight gaps; the course drifts over the taller world; a hit ends the run. Border lights step colour at every barrier. 3 per barrier + 2 per star on the curve; +10 for lasting the minute. | 60 s | hoverRev 5 |
| Breaker (breaker) | Retro | drag, tap | Clear 80 bricks in rainbow rows (cracked bricks take 2–3 hits); capsules give a 4-brick laser, ×3 shots, double balls and a 3.5 s Fireball; two rows slide from 30 s and 60 s. 1 per brick; clearing all 80 adds up to 10 for speed. | 90 s | brkRev 4 |
| Rally (rally) | Retro | drag | Keep the blue ball in play (miss it and the run ends); the paddle shrinks per hit; a gold ball joins every 10 s and scores on each hit; two pink pads, one per half of the far wall, give +3 to a gold ball; a mirror bumper from 30 s. 5 per gold hit, 6 per pad (open curve). | 60 s | rallyRev 4 |
| Tempo (beat) | Retro | tap lanes, hold, swipe | Four-lane rhythm chart with hold notes and, from 30 s, swipe (arrow) notes; combo lights at 10 / 25 / 50. Perfect 4, Good 3, OK 1, miss −2 per note, as a share of the chart (open curve). | 60 s | beatRev 4 |
| Meteor (snake) | Retro | swipe | Snake-style meteor on a 15 × 28 grid: eat stars to grow and speed up; red shadows warn 2 s before a rock lands (from length 10, up to 8); a 3-rock shower at 20 stars; only the head collides. 1 per star (150 at 34). | 60 s | snakeRev 5 |
| Fission (burst) | Retro | ◀ ▶, tap to fire | Shoot glowing atoms that split until they pop; BURST, SHIELD and FREEZE drops; 3 lives. 1 per atom hit, −5 units per life lost; +10 for lasting 90 s. | 90 s | burstRev 3 |
| Wavefront (wavefront) | Space | drag (auto-fire) | Five 30-ship waves (a grid, then triangle, circle, pentagon and octagon shapes), an armoured core from wave 2, divers from wave 3, waves 3–4 coming down more slowly, saucer drops, then a 36-hit boss; 3 lives. Ships, armour hits, boss hits and saucers 1 each, waves 15; killing the boss adds up to 10 by how fast it falls. | 90 s | wavRev 5 |
| Orbit (orbit) | Space | tap | Hop between orbits across 40 planets to the sun on a wide zig-zag course from a proved bank; one player-set checkpoint; rotating asteroid belts; three black holes throw a well-timed rocket 5–6 planets on (skipped planets count), with a fly-in after. 1 per planet; reaching the sun adds up to 10 for speed. | 90 s | orbitRev 6 |
| High Rise (skyline) | Real World | tap | Drop swinging blocks onto a night-time tower in a taller 390 × 735 view; overhang is cut, perfect drops grow the block back; streak points from the 3rd perfect in a row; from block 20 a flag warns of identical wind gusts. Blocks and perfects 5, streak points 2 (open curve). | 60 s | skylineRev 4 |
| Jaywalk (cross) | Real World | swipe 4-way | Cross nine lanes of traffic in daylight, faster each crossing; wide gaps on crossings 1–2, cyclist lanes from 3, roadworks from 4; 3 lives. 1 per lane + 2 per crossing (open curve). | 60 s | crossRev 4 |
| Rainbow Bridge (inkbridge) | Real World | draw | Draw rainbow lines to roll a coin into the pot of gold past white birds: levels 1–4 still pot, 5–8 moving pot, 9–10 live (draw as it falls); shared ink; optional gold stars on four of levels 1–8; three failed drops end the run. 10 per level + 2 per star (fitted low on purpose); all ten adds up to 10 for speed. | 120 s | inkRev 6 |
| Slice (slice) | Kitchen | swipe | Chop flying foods on a chopping board; 3+ in one swipe for ×2 then ×3; chillies cost 10 and end the combo; Saucy (ketchup), Simmer (mustard) and Squeeze (mayo) bottles; a slightly wider, longer blade. Combo-weighted share of the most the run offers (open curve). | 60 s | sliceRev 4 |
| Swish (bintoss) | Fairground | drag-aim | Ten throws into a tin bucket that moves back (narrower from throw 4, sliding from 7); wind on a pennant (one point = a quarter bucket); a bonus hoop on three of throws 2–5 (+3), a spinning paddle on three of throws 6–10. 10 per bucket + 3 per hoop; +10 for all ten in. | 60 s (10 throws) | binRev 4 |
| Flightpath (bullseye) | Fairground | drag-aim | Ten darts at a drifting board (moving from dart 4, ring values swapping from dart 7); rings 10 / 9 / 8 / 3 / 2 / 1, inner bull 12; on three of darts 3–10 a +1 / +2 / +3 balloon flies across the board. Dart total on an open curve (150 at 112). | 45 s (10 darts) | bullRev 4 |
| Coral Pop (bubble) | Underwater | drag-aim | Hex bubble shooter on a fixed 67-bubble field with sea-creature symbols and a fixed queue; a crowned Joker about every 22 shots, one mine or torpedo in the first 60; big hits send bubbles up the screen. 1 per bubble cleared; clearing the field adds up to 10 for speed. | 90 s | bubbleRev 3 |
| Roofbound (flip) | Cave & Lava | tap | Gravity-flip runner through a lava tube: crumbling tiles, ten gold stars, the corridor bending from 10 s. 1 per half second + 3 per star; +10 for lasting the minute. | 60 s | flipRev 4 |
| Grappler (swing) | Cave & Lava | hold / swipe | A ninja swings from anchors across a lava cave to 500 m; a dragon chases from 200 m; stalactites crumble for 2 s before falling; lava jets; ten optional touch stars. 1 per metre + 5 per star; +10 for 500 m. | 60 s | swingRev 7 |
| Scrumper (snip) | Orchard | swipe | Cut ropes to drop the apple into the basket across ten tall levels (2 easy, 3 medium, 5 hard, up to 12 s each): springy branches, planks, gutters, wasp nests, sliding baskets, and picker's crooks that catch a falling apple on a vine to cut again; golden leaves optional. 10 per apple + 2 per leaf; all ten adds up to 10 for speed. | 60 s | snipRev 5 |
| Tilt (tilt) | Toybox | drag | Spin four wooden mazes so marbles roll into their own cups (an amber marble from maze 3, starting well away from its cup; a red chaser behind a padlock gate on maze 2); two stars per maze at black-hole mouths; a hole ends the run. 30 per maze + progress + 5 per star; all four adds up to 10 (full by 75 s). | 90 s | tiltRev 4 |
| Ball Tracker (balltrack) | Toybox | tap | Turn gold tubes (marbles inside roll out the new end) and switch bottom-row drops to route 30 marbles into cups of their colour; mid-round the bottom row moves and the cups swap. 1 per marble home; all 30 adds up to 10 for speed. | 60 s | btRev 3 |
| Gemstone (matchup) | Gem | swap | 7 × 8 match-3 with fixed refill queues; bombs, stars and a Jackpot gem; each swap waits for the board to settle. Match points on an open curve (150 at 2,500). | 60 s | matchupRev 5 |
| Junction (junction) | Real World | tap | Traffic lights at a crossroads with diagonal roads joining every 12 s, buses, turning cars and ambulances; a crash ends the run. Kept for practice and stored rounds. | 60 s | junctionRev 3 |
| Swerve / Steady / Dual / Ricochet / Rooftop Run / Bastion / Sort Rush / Parry / Hot Floor | Retired | | | 60 s each (Hot Floor 120 s) | — |

Junction's status: **practice only** (retired 12 Oct in Tuning C); rooms deal the other 21.

**Arcade gameplay ideas still to come:** Pull! doubles and more in the master plan's "Later" sections. **Arcade candidates still in the bank:** Crowd Sort, Balance the Tower, asteroid dodge. New-content ideas (sports, action games, solitaire) are in the master plan.

## Duelz — the 1v1 strategy mode (designed 24 Sept, to build after accounts)

Joe's turn-based tactics concept for two players on their own phones: secret deployment, then full information. Identical armies of 10 (Main Healer as the objective piece, Field Medics, Snipers, Brawlers, Specialist, Bulwark, Vanguard); one action per turn; three win conditions. Review notes before building: shrink the board to 12×12 or 14×14, match the turn budget to the board, limit healing charges, no draws (a tie-break ladder), deterministic first mover, sniper range shorter than the neutral zone, three passes per game. Positioned as the flagship 1v1 mode and a future knockout final, not a room tie-breaker. (Name to follow the app rename.)

## Held back

**Knowledge & recall (6)**: needs careful design to stay clearly skill-based. **Strategy mini-duels (8)**: the 1v1 mode above is the first; the rest need the same live shared board.

---

## Totals (13 Oct 2026 after the rotation, from the registry)

| Category | Active in rooms | Retired (practice only) | Total |
|---|---:|---:|---:|
| Word | 10 | 3 | 13 |
| Number | 9 | 4 | 13 |
| Memory (dormant) | 0 | 4 | 4 |
| Speed | 6 | 1 | 7 |
| Attention | 6 | 1 | 7 |
| Pattern | 10 | 3 | 13 |
| Logic | 11 | 2 | 13 |
| Arcade | 21 | 10 | 31 |
| **Total** | **73** | **28** | **101** |

Engine games outside Arcade: Letterfall (Word), Tenfall (Number), Bonk and Pull! (Speed), Mixed Signals (Attention). Target: at least six strong games per category (every core category is there; Memory is empty). Guiding rule: aim for around 40 outstanding games with radically different skill profiles rather than 100 variations.

**Still to rule on** (scoring reference, section 16): start-state scores in a few games, the free mistakes list, the 30 s tie-break divisor, Lightbender's client-side shot count, and arcade calibration after phone testing.
