# Duelz — Game Bank

The reference list of every game: built, retired, still to build, and held back. **Rewritten 10 Oct 2026** under the new game names, folding in the 6, 7 and 8 Oct handovers and the October tuning pass (Game Tuning Prompt Pack, Prompts 1–18b). Scoring formulas live in the scoring reference; this doc notes what the score is based on.

Legend: **Built** = live and drawn in rooms · **Retired** = practice only, never drawn in rooms · **To build** = agreed candidate · **Bank** = in the pool, not yet chosen · **Held** = deliberately parked. Internal ids (in brackets) never change; only display names did.

---

## How rooms use the bank

**Rotation (decided 10 Oct; being built in Prompts 24 and 24b).** The host selects categories. Every room has 6 rounds (7 when all seven categories are selected), shared equally between the selected categories: 1 category → 6 rounds from it; 2 → 3 each; 3 → 2 each; 4 → 1 each plus two extra rounds to two different categories (25% per category per extra); 5 → 1 each plus one extra (20% per category); 6 → 1 each; 7 → 7 rounds, 1 each. The rounds are then put in a random order from the room seed, with the same category never in two rounds in a row (2-category rooms alternate; 1-category rooms are the only exception), and Arcade (or any category) can land in any round, including round 1. No game repeats within a room; within a category the game is drawn from the active games with recent-avoidance weighting. (12 Oct: the game draw also runs on the room seed, so the same seed and history deal an identical room; scripts/room-rounds-check.ts proves 1, 2, 4 and 7 categories.) The old round-6 weighted draw, the "never round 1" arcade rule and the add_maths / add_arcade toggles are being removed. Memory is dormant (no active games).

**Scoring model (all games, see the scoring reference).**
- Standard puzzles: complete = 130 + up to 20 for speed; unfinished = flat per-item credit.
- Fewest-moves puzzles: 100 + up to 25 for moves + up to 25 for speed.
- **Speed par (10 Oct):** every speed bonus pays in full if you finish with at least half the time left, then scales down evenly to 0 at the buzzer. Stamped per puzzle (`speedPar: 1`); older rounds keep the old linear curve.
- Arcade: each game's own counters, cap 150; games with a finish pay 130 + up to 20 for run time left.
- Maximum 150 per round. Ties break on lower total answer time.

**Shared feel features (Oct 2026).** Red pulsing timer and ticks in the final 10 s; consistent wrong-answer shake and red outline; solve flourishes on 54 puzzles' reveal boards; near-miss lines on 15 arcade results; arcade success effects and streak milestones; personal bests in practice (stored on the device).

**Dictionary.** Free SCOWL-based British list; help text says "standard British English dictionary". Oxford Languages and Collins Scrabble Words quotes to request (master plan step 8b).

**Intro demos.** Every demo was reset to its game's fixed example by the tuning work; all need re-recording (master plan step 8).

---

## Word (core) — 7 active

| Game (id) | Status | Description | Time |
|---|---|---|---|
| Nucleus (wordsmith) | Built | Atom board: a glowing centre letter (must be in every word) with 7–10 round letter tiles on an orbit ring; 8–11 letters in all. Tap to build, tap again to remove, Clear / Enter, Shuffle. 4+ letters, no plurals. Score from word points. | 100 s |
| Forage (wordhunt) | Built | 5×5 letter grid; drag through adjacent letters (a line follows the drag); plurals allowed. Score = 2 × word points. | 100 s |
| Interlock (tilegrid) | Built | Place all 15 letter tiles into a valid crossword grid. Unfinished credit counts only tiles in a valid word. | 100 s |
| Slider (wordslide) | Built | Slide letters so all five rows are words; a padlock locks a solved row. 100 + 30 speed + 20 moves; 22 per valid row otherwise. | 100 s |
| Lookout (wordsearch) | Built | Find the themed hidden words in a 10×10 grid; found words get a strike-through and fill a chip below. 20 per word; wrong picks cost nothing. | 120 s |
| Roundabout (letterwheel) | Built | Drag across a letter wheel to fill a small crossword; Shuffle rearranges the wheel. Per-word credit plus speed. | 100 s |
| Letterfall (wordfall) | Built (engine) | Arcade-engine word game in the toybox world: a 6×9 well starts with 3 rows of letter tiles; seeded tiles drop into seeded columns (1.6 s → 0.8 s over five 18 s phases). Tap touching tiles (8 directions) to chain a word, tap the last again or Enter; a real word of 3+ letters clears and tiles above fall, a non-word shakes at no cost; a tile that can't enter a full column ends the run. Word points 1/2/4/7/11 for 3/4/5/6/7+ letters; floor(150 × min(points, 45) ÷ 45). The phone loads an exact copy of the SCOWL list (own chunk) when Letterfall starts. | 90 s |
| Word Ladder (ladder) | Retired | One letter at a time between two words (retired 6 Oct). | |
| Groups (groups) / Word Match (wordmatch) | Retired | | |
| Compound Words, Swapword, Word Drop | To build (high) | See the master plan's new-games table. | |
| Fill-In, Cryptex, Unscramble Ladder, Mini Crossword | To build (medium/low) | | |
| Longest Word / Word Association Chain / Reverse Definitions / Homophone Match / Speed Typing / Crossword Sprint | Bank | | |

## Number — 6 active

| Game (id) | Status | Description | Time |
|---|---|---|---|
| Exact (target) | Built | Six tiles and a target; combine with + − × ÷ to hit it exactly; history of steps shown. Smooth near-miss curve. | 75 s |
| Operator (equation) | Built | Four equations, left to right; fill the operator slots. Stage points 25 / 30 / 35 / 40 + speed (confirm in the scoring audit). 1 s CORRECT hold between stages. | 90 s |
| Counterweight (balance) | Built | Three scales: hang kettlebells on numbered notches on a brass beam so it balances; fixed weights are dark iron with a lock; the beam tilts toward the heavier side. 120 + up to 30 speed. | 90 s |
| Integer Pyramid (numpyramid) | Built | Four pyramids; fill each cell so it's the sum of the two below. All four + up to 30 speed. | 120 s |
| Trail (trail) | Built | 10 fixed numbers; place the other 26 to make a continuous number trail (tap an empty cell next to the trail's end). 5 per correct tile, any position. | 120 s |
| Tenfall (tendrop) | Built (engine) | Arcade-engine game: make tens to clear ten targets; ×2 / −2 modifier tiles; gold freeze on each target. 13 per target + early-clear bonus. | 90 s |
| Sum Hunt (sumhunt), Number Sequence (numseq), Percent Sprint (pctsprint), Chain Calculation (chaincalc) | Retired | | |
| Equation Fill, Checkout, Merge Target | To build (high) | | |
| Change Up, Cages, Magic Square, Prime Rush | To build (medium/low) | | |
| Calc-grid / Mental Math Sprint | Bank | | |

## Memory (dormant) — 0 active

| Game (id) | Status | Description |
|---|---|---|
| Spatial Memory (spatial), Sequence Recall (sequence), Reverse Recall (reverse), Number Climb (numclimb) | Retired | Testers' least favourites. |
| Route Memory / Maze Memory | To build | Only if the category is revived. |
| Story Recall / Face-Name Pairing / Digit-Symbol Substitution | Bank | |

Decision still open: revive Memory with new games or drop it.

## Speed, reaction & precision (core) — 6 active

| Game (id) | Status | Description | Time |
|---|---|---|---|
| Flash (reaction) | Built | Gold flashes at seeded moments among decoy pulses; tap on gold; a ring ripples at each tap. 150 at ≤ 200 ms average, falling with slower reactions; −8 per false start. | 60 s |
| Bang On (stopwatch) | Built | Stop the sweeping marker in the gold zone across 10 watches (moving targets, hidden final third, accelerating sweeps); big timing bar with the last three results. Score from average error. | per watch |
| Ascend (numhunt) | Built | 24 two-digit discs; tap smallest to largest. 5 per number, −5 per error; 130 + 20 on all 24. | 60 s |
| Don't Break the Chain (chain) | Built | Tap glossy charms following the shape/colour cycle; a gold chain grows across the top. A wrong tap or a momentum lapse ends the run. Seeded reshuffle every 5 links. 140 + up to 10 speed for all 40 links. | 45 s |
| Bonk (whack) | Built (engine) | Gophers in gold or red hard hats pop from burrows; tap the colour the banner says; avoid the hedgehog. 135 × share of hits, penalties for wrong colour / hedgehog / empty taps, +15 for all targets. | 60 s |
| Pull! (clayshoot) | Built (engine) | 22 orange and 3 gold clays; tap to shoot. 10–12 white birds cross the sky (clayRev 3): −10 per bird hit, floor 0. 5 per orange, 10 per gold, +10 for all 25 with no birds hit. A shot overlapping a clay and a bird always hits the clay. | 60 s |
| Go/No-Go (gonogo) | Retired | | |
| Target Tracking, Stop at 11 | To build | | |
| Aim Precision / Rhythm Tapping / Simon-Says Pattern Speed | Bank | | |

## Attention & perception (core) — 7 active

| Game (id) | Status | Description | Time |
|---|---|---|---|
| Mixed Signals (stroop) | Built (engine) | Lane sorter: 3 lanes then 4, sort each word by ink or by meaning as the rule swaps; speed-ups. Time bonus for sorting all 52. | 75 s |
| Eagle Eye (symscan) | Built | Three grids of top-down eagles (8 directions); tap every eagle matching the target. Speed bonus only when all three grids are perfect. | 30 s |
| Double Take (spotdiff) | Built | Two grids of sweet-shop icons; find six differences (colour swaps, item swaps, flips). | 30 s |
| Tally (countup) | Built | Three crowded display trays of outlined shapes in six named colours; count the ones the question asks for. Stage weights 30 / 45 / 55. | 45 s |
| Labyrinth (maze) | Built | Branching maze; steer the gold player to the star. Share of path as points. | 60 s |
| Interloper (intruder) | Built | Five parties: memorise the guests (head shape + colour) in spotlights; the lights dim; tap every guest who changed. Two changes on parties 3–5, guests swap places on 4–5. | 75 s |
| Matchmaker (pairmatch) | Built | 15 pairs of cards with patterned backs; fewest flips earns a bonus. | 90 s |
| Crowd Sort | To build (arcade) | | |
| Hidden Object Search / Focus Filter / Sequence Spotting | Bank | | |

## Pattern & spatial (core) — 7 active

| Game (id) | Status | Description | Time |
|---|---|---|---|
| Gridlock (unblock) | Built | Slide grey blocks to free the gold block through the marked exit; 7×7 from a bank of 400. Fewest-moves scoring. | 60 s |
| Tessellate (blockparty) | Built | Fit nine polyomino pieces around seven gold studs on a 6×6 grid; tap to rotate. | 60 s |
| Skid (iceslide) | Built | On an ice board, swipe to slide until you hit a black block; magenta and orange portals, thin ice; gold exit. Fewest-moves scoring. | 90 s |
| Topsy-Turvy (gravity) | Built | Four balls tilt together and lock on their sockets; stone walls; 9×9. 25 per locked ball. | 90 s |
| Jumbled (tiles) | Built | 3×3 slide puzzle; tiles coloured on a ramp from 1 to 8. Every slide counts, including undone ones. Fewest-moves scoring. | 60 s |
| Turntable (rings) | Built | DJ deck: five linked vinyl rings with a link legend; turn rings until every spoke is one colour; strobe dots light per solved spoke. | 60 s |
| Lightbender (laser) | Built | Place mirrors and a splitter so one beam lights every gem; three FIRE shots; 130 / 115 / 100 for 1 / 2 / 3 tries. | 60 s |
| Pattern Completion (patcomp), Spin (spin), Mirror Match (mirmatch) | Retired | | |
| Pattern Shift / Shape Assembly / Shape Rotation (3D) / Shadow Match / Matrix Reasoning / Complete the Reflection / Mirror or Turn? | To build | | |
| Shape Folding / Block Stacking / Jigsaw Assembly / Grid Pathfinding | Bank | | |

## Logic (core) — 14 active

| Game (id) | Status | Description | Time |
|---|---|---|---|
| Pipeline (pipes) | Built | 7×7; rotate pipe tiles to connect the source to every tile; water flows through on a solve. Stepped credit. | 120 s |
| Blackout (lightsout) | Built | 6×6 lights with bulb outlines; turn them all off in the minimum presses (8–12). | 75 s |
| Box Six (sudoku) | Built | 6×6 sudoku with 3×2 boxes and pencil marks; unique solution. | 90 s |
| Chroma Lines (flow) | Built | 9×9, 10–12 colour pairs, 2–4 striped wall cells; non-crossing paths filling every cell. 10 per pair unfinished. | 75 s |
| Heave (push) | Built | Warehouse Sokoban: push wooden crates onto hatched floor markings; fewest pushes. | 120 s |
| Hanoi (tower) | Built | Tower of Hanoi, 9 size-coloured rings, 3 or 4 posts per seed. Minimum moves shown on the reveal. | 90 s |
| Polypotions (tubes) | Built | Sort liquid layers so every flask is one colour (5 per colour, capacity 5, partial pours); a full flask gets a cork. | 90 s |
| Safe Cracker (safe) | Built | Four metal dial drums, five clues, unique combination; three tries (130 / 115 / 100). | 75 s |
| Bomb Defusal (bomb) | Built | Six-step bomb (bombRev 2): a rule card of 6 rules (ordering, conditional, counting) with exactly one valid 6-action sequence; each rule is needed. Wire references show colour chips. Partial = round(75 × correct steps ÷ 6). Server-only bank of 300 pre-built bombs (to grow to thousands, step 11). | 90 s |
| Mosaic (nonogram) | Built | 7×7 picture logic; −5 per wrong cell. | 120 s |
| Colour Flood (flood) | Built | 14×14 wet-paint board in five colours (magenta, blue, mint, yellow, orange); flood from the top-left in par moves. 100 + 40 moves + 10 speed. | 60 s |
| Tents and Trees (tents) | Built | Campsite: place a striped tent beside every tree, none touching, matching the signposted row/column counts. | 90 s |
| Shikaku (shikaku) | Built | Divide a 10×10 grid into rectangles each containing one number equal to its area. | 90 s |
| Lamplighter (lightup) | Built | Place lamps to light every cell without two lamps seeing each other; numbered walls. −5 per clashing lamp. | 90 s |
| One-Stroke (stroke), Dig (dig) | Retired | | |
| Robot Instructions / Circuit Builder / Minefield / Magnetic Maze / Domino Logic / Escape Room / Find the Rule / Bridges | To build | | |
| Logic Grid / Odd-One-Out / Syllogism Check / Truth-Teller / Weighing Puzzle / Cryptic Clues / Elimination Grid | Bank | | |

## Arcade (core) — 22 active

All run on the deterministic engine: 60 ticks/s, integer physics, seeded courses identical for everyone in a room, the server replays the input log. Every gameplay change is version-stamped so old rounds replay and score as they were. Cap 150.

| Game (id) | World | Input | Description | Run |
|---|---|---|---|---|
| Hover (hover) | Retro | tap | Fly a saucer through gaps in energy barriers; barrier colour changes every 7 (six colours); each barrier lights up as you pass. hoverRev 2: gold stars in tight gaps, two-gap and moving barriers; 130 barriers + 20 stars. | 60 s |
| High Rise (skyline) | Real World | tap | Drop swinging blocks onto a night-time tower; perfect drops restore width; windows light floor by floor. | 60 s |
| Swish (bintoss) | Fairground | drag-aim | Ten throws into a tin bucket that moves back each throw; wind shown by a pennant (one point = a quarter of the bucket's width); catch zone 15% smaller since Oct. binRev 3: a bonus hoop above the bucket on three of throws 2–5 (+3 through it and in), a spinning paddle in front of the bucket on three of throws 6–10. | 10 throws / 60 s |
| Flightpath (bullseye) | Fairground | drag-aim | Ten darts at a drifting board; rings worth 10, 9, 8, 3, 2, 1; score = 1.7 × dart total − 20. bullRev 2: a tiny inner bull worth 12, and a drifting balloon on three of darts 3–10 (pop it for 12; the dart is used up). | 10 darts / 45 s |
| Gemstone (matchup) | Own | swap | 7×8 match-3 with fixed refill queues; specials; gems glow with occasional glints. matchupRev 2: Jackpot gem (5 + L/T in one swap), constant play, par 5,000; matchupRev 3: original fall speed, par 5,500. | 60 s |
| Breaker (breaker) | Retro | drag | 80 bricks in rainbow rows; gold power-up bricks (multi-ball, spam, laser); ball trail. | 90 s |
| Rally (rally) | Retro | drag | Keep the rally going; paddle shrinks per hit; a gold ball joins every 10 s; the ball glows hotter as the rally grows. rallyRev 2: two pink target pads on the far wall (+3 when a gold ball hits one; it moves on), a mirror bumper mid-court from 30 s, and a full Retro arena. | 60 s |
| Slice (slice) | Kitchen | swipe | Chop flying foods on a chopping board, avoid chillies; combo multiplier up to ×3; Saucy (ketchup, bomb-free) and Simmer (mustard, slow-mo). | 60 s |
| Coral Pop (bubble) | Underwater | drag-aim | Hex bubble shooter, five colours with sea-creature symbols, fixed queue. bubbleRev 2: Joker, mine and torpedo bubbles in the queue; part-clear credit up to 100. | 90 s |
| Tempo (beat) | Retro | tap lanes | Four-lane rhythm chart at 120 BPM with hold notes and combo. beatRev 2: swipe notes (left/right arrows) from 30 s. | 60 s |
| Meteor (snake) | Retro | swipe | Snake-style meteor with a fixed star queue; the tail glows as it grows. snakeRev 2: seeded asteroids (2 s shadow, head-only hits) from length 10; snakeRev 3: a 3-rock meteor shower at 20 stars (cap 11 rocks). | 60 s |
| Jaywalk (cross) | Real World | swipe 4-way | Cross nine lanes of traffic, faster each crossing; 3 lives. Score = 2 × lanes + 4 × crossings. | 60 s |
| Wavefront (wavefront) | Space | tap/drag | Shoot rows of geometric ships, armoured ships and saucers through five waves; 3 lives. | 60 s |
| Roofbound (flip) | Cave & Lava | tap | Gravity-flip runner through a lava tube; bends ramp up in the last 15 s; score rises with survival time. | 60 s |
| Junction (junction) | Real World | tap | Traffic controller at a crossroads; prioritise ambulances; confirm turning cars; survival bonus. | 60 s |
| Rainbow Bridge (inkbridge) | Real World | draw | Draw rainbow lines to guide a falling coin into the pot of gold past white birds (inkRev 3): levels 1–4 the pot stands still, 5–8 the pot moves, 9–10 live (one line before release, then draw as it falls, with a no-draw ring, shared ink and a shield row). 11 per level. inkRev 4: an optional gold star on four of levels 1–8, on a harder proved route (+2). | 120 s |
| Fission (burst) | Retro | drag (1:1 follow) | Shoot glowing atoms that split into smaller atoms; shield power-up; 3 lives; 150 for a flawless run of 4+ waves. | 90 s |
| Orbit (orbit) | Space | tap | Hop between orbits across 40 planets in a wide zig-zag world (orbitRev 3; 504-layout bank); the camera holds still while orbiting and pans after each capture; one player-set checkpoint; a shooting star every 10 planets. orbitRev 4: three black holes (about every 10 planets, proved offline in a hole bank) that throw a well-timed rocket 5 or 6 planets on; skipped planets count. | 90 s |
| Grappler (swing) | Cave & Lava | tap/hold | A ninja swings from anchors across a lava cave to 500 m; 3–5 large red dragons hover in the last 150 m (touching one ends the run, like a stalactite); 504-course bank. | 60 s |
| Scrumper (snip) | Orchard | swipe | Cut ropes to drop the apple into the basket across ten levels, collecting golden leaves; levels drawn from 30 templates by difficulty band (snipRev 2). | 60 s |
| Tilt (tilt) | Toybox | drag/tilt | Steer a glass marble through four wooden mazes, avoiding dark holes and the red ball, into the blue cup. | 90 s |
| Ball Tracker (balltrack) | Toybox | tap/drag | Route marbles into the right trays on a marble run; wrong trays cost nothing. | 60 s |
| Swerve / Steady / Dual / Ricochet / Rooftop Run / Bastion / Sort Rush / Parry / Hot Floor | Retired | | | |

**Arcade gameplay features planned for Claude Code (master plan step 10a):** Wavefront wave breaks, divers and a boss; High Rise accuracy changes block size, plus gusts; Pull! doubles; Slice combos; Junction ambulances (timed bonus/penalty). More ideas in the master plan's "Later" sections.

**Arcade candidates still in the bank:** Crowd Sort, Balance the Tower, asteroid dodge. New-content ideas (sports, action games, solitaire) are in the master plan.

## Duelz — the 1v1 strategy mode (designed 24 Sept, to build after accounts)

Joe's turn-based tactics concept for two players on their own phones: secret deployment, then full information. Identical armies of 10 (Main Healer as the objective piece, Field Medics, Snipers, Brawlers, Specialist, Bulwark, Vanguard); one action per turn; three win conditions. Review notes before building: shrink the board to 12×12 or 14×14, match the turn budget to the board, limit healing charges, no draws (a tie-break ladder), deterministic first mover, sniper range shorter than the neutral zone, three passes per game. Positioned as the flagship 1v1 mode and a future knockout final, not a room tie-breaker. (Name to follow the app rename.)

## Held back

**Knowledge & recall (6)**: needs careful design to stay clearly skill-based. **Strategy mini-duels (8)**: the 1v1 mode above is the first; the rest need the same live shared board.

---

## Totals (10 Oct 2026)

| Category | Active in rooms | Retired |
|---|---|---|
| Word | 6 | 3 |
| Number | 6 | 4 |
| Memory (dormant) | 0 | 4 |
| Speed | 6 | 1 |
| Attention | 7 | 0 |
| Pattern | 7 | 3 |
| Logic | 14 | 2 |
| Arcade | 22 | 9 |
| **Total** | **68** | **26** |

94 built. Target: at least six strong games per category (Word and Number are at six; Memory is empty). Guiding rule: aim for around 40 outstanding games with radically different skill profiles rather than 100 variations.

**To confirm in the Claude Code scoring audit:** Operator stage points, the arcade 130 / 150 split, tries rewards (Lightbender, Safe Cracker), changed values (Forage 2× word points, Tally 30 / 45 / 55), and the "rest are checks" items in scoring reference section 16. Free mistakes in Lookout, Tents and Trees, Trail, Matchmaker, Interloper and Ball Tracker stay unpenalised by design (ruled 10 Oct).
