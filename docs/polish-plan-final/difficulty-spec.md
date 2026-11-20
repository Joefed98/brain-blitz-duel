# Joulz difficulty spec: Easy, Hard and Expert for every game

Fable, 20 Nov 2026. Companion to `docs/polish-plan-final.md` section D. The inventory behind the "Today" column is `levels-research.md` in this folder (every setting, measurement and proof, read from the code on main 774e5ddb).

## The rule (section D of the plan)

1. Every level changes a **mechanic**, not only a number. Easy removes a hazard or adds an aid. Hard adds one new hazard, rule or shape. Expert adds a second and takes an aid away. "Faster and shorter" alone is never a level.
2. Normal is today's game and never moves here (rated play and the Daily deal it).
3. Expert is proven playable by the best humans: arcade games prove a witness at 200 **under the human limits** (0.25 s to react, 0.15 s to move) on every dealt seed, or the seed is not dealt; puzzles prove every Expert board finishable by the person-style solver (deduction plus one-step trials, never a guess) inside the clock. The guide numbers (elite under human limits: Expert 120–150, Hard 150–175, Easy 190+) steer the tuning; Joe's playtest decides.
4. A level is proved where it is dealt: banked games get a bank per level; sim-dealt games prove the witness in the sim.
5. Where a step is already a mechanic today (marked **keep** below) only the numbers are re-tuned to the guide; where it is parametric or timid (marked **new**) the mechanic named is added. Every new mechanic is a new field on the level's settings or the sim's level row, carried on the state and folded into the checksum, so stored rounds replay as dealt. Where the level is dealt from a bank, the bank is rebuilt with the mechanic and re-proved.

Measured columns quote the elite bot under human limits where it exists (E / N / H / X), else the near-perfect kit.

## Word

| Game | Today (E / H / X) | Measured | Step verdict | Proposed change | Why it is a clear step | Expert proof |
|---|---|---|---|---|---|---|
| Nucleus | wheel sizes 9–10 / 8–9 / 8, everyday words 45–85 / 16–24 / 10–14, 120 / 65 / 50 s | near-perfect 155–182 / 145–168 / 128–155 / 110–138 | parametric | **Hard**: a required letter pair (every word must hold the two centre letters; the wheel shows two centres). **Expert**: the pair, and only everyday words score (obscure words 0, not bonus). Easy: the pangram's first three letters shown | a word find with a constraint is a different search, not a shorter list | open by design; the kit's near-perfect at 120+ under the clock |
| Interlock | crossing geometry and the clock 120 / 60 / 50 s | none pinned | TIMID | **Hard**: two tiles start on the grid in the wrong place and must be moved. **Expert**: tray tiles face down until lifted (one lift a second). Easy as today | planning around wrong tiles and memory of the tray are new skills | open; the proved grid exists per deal |
| Slider | shifts 3 / 7 / 8, par 2–3 / 7 / 8, 100 / 60 / 50 s | solver: strong / elite finished E 13 / 24, N 4 / 15, H 2 / 9, X 0 / 4 of 24 | TIMID, and Expert is too hard (elite finishes 4 of 24) | **Hard**: 6 shifts and one locked column (its letters never move; the words must be built round it). **Expert**: 7 shifts, the locked column, and a row that locks when right stays; a wrong row unlocks after 5 s. Easy as today | the lock changes which slides are legal; the timed lock rewards planning | the slider solver (`scripts/slider-human.ts`) finds the dealt line on every Expert board under par + 2; elite finishes ≥ 50 % |
| Forage | words 320–700 / 100–140 / 50–80, seeds 4 / 3 / 1–2, 120 / 80 / 70 s | near-perfect 170–195 / 158–184 / 138–164 / 115–142 | parametric | **Hard**: every word must bend (no straight lines). **Expert**: bends, and letters fade 20 s after the start unless used (a faded letter can't be traced) | a path rule and a decaying board are new, not fewer words | open; near-perfect kit at 120+ |
| Lookout | 8×8 5 words across/down / 10×11 7 words / 10×12 8 words + 4 decoys | near 185–200 / 180–200 / 174–196 / 152–178 | X keep (decoys), H parametric | **Hard**: diagonals both ways and no theme shown. Expert as today | a theme removed turns a scan into a search | the bank's boards hold every word once |
| Roundabout | 6 letters 7–9 words / 7 letters 12–15 / 7 letters 16–19 | near 170–195 / 162–186 / 155–180 / 148–174 | parametric; Expert's clock (80 s) is longer than Hard's (75 s) | **Hard**: one slot reads backwards (shown by an arrow); 75 s. **Expert**: backwards slots and one crossing letter hidden (shown as ?); 70 s | reading direction and a hidden crossing are new deductions | the bank's slots each have exactly one common answer (`letter-wheel-bank.ts --expert`) |
| Strikeout | givens 3/2 … 0, vowels 4 / 2 / 2, strikes 14 / 10 / 12 | near 188–200 / 190–200 / 172–192 / 155–182 | X keep (blind start) | **Hard**: adjacent words share a letter (the shared cell shown). Expert as today | a shared-letter rule links the words into one puzzle | the person-like solver (`strikeoutSolver.server.ts`) solves every Expert board under the strike limit |
| Cryptogrid | givens 8 / 5 / 4, 120 / 75 / 70 s | near 190–200 at every level | TIMID | **Hard**: 5 givens and one false given (shown as a hint, wrong, to find; the Check reveals it). **Expert**: 4 givens, the false given, and non-words flash only on Check | a false hint is a new deduction; delayed feedback changes the strategy | the person-like solver (`codewordHuman.server.ts`) cracks every bank board with the false given |
| Swapword | min + 16 / + 6 / + 4 swaps, 120 / 55 / 60 s | none pinned | parametric; Expert's clock longer than Hard's | **Hard**: one locked letter per word; 60 s. **Expert**: locks, and swaps only between touching words; 55 s | a locked letter and an adjacency rule change the move graph | one arrangement proved per deal; Expert by the mark-reading solver (`swapwordProof.server.ts`) |

## Number

Joe's 15 Nov decision stands: Counterweight, Brimful, Checkout and Kakuro keep today's game as Hard; their Normal is the new gentler stamp.

| Game | Today | Measured | Verdict | Proposed change | Why | Expert proof |
|---|---|---|---|---|---|---|
| Counterweight | E 3 scales of 6; H today's; X 4 scales of 10, readout hidden | none | X keep | **Hard**: one kettlebell's mass shown as ? (one hidden weight). Expert as today plus a scale left unbalanced 10 s dumps its hangs | a hidden mass turns balancing into deduction | the BFS proof on every board; person-like solver at Expert |
| Exact | large tiles 1–2 / 1 / 0, targets 101–300 / 300–999 / 500–999 | none | parametric | **Hard**: one tile locked out (shown struck through). **Expert**: no large tiles, the lock-out, and the target hidden until two steps are made (a range is shown) | a forbidden tile and a hidden target change the search | exhaustive search per deal; the Expert bank (`targetExpertBank`) person-solvable |
| Operator | gaps 0–1 / up to 4 / mixed + 2 decoys, tries 3 / 3 / 2 | none | parametric | **Hard**: one equation's shown result is wrong on purpose (a decoy equals to spot and correct). **Expert**: the decoy, 2 tries, and a bracket pair to place | spotting a wrong result is a new skill | the person-like search finds a true fill per line |
| Integer Pyramid | 4 / 5 / 6 rows, decoys 1 / 3 / 3 | N: great 135 (35 % finish), near 189 | parametric; Normal's cliff is a scoring item (I3) | **Hard**: 5 rows, one negative stone. **Expert**: 6 rows, negatives, one row's stones hidden until the row below is right | negatives and a hidden row change the arithmetic | the exhaustive proof per board |
| Brimful | E 3 boards 2 jugs; H today's; X no tap, split goal, 1.5× limit | near finishes ≥ 80 % of X | X keep | **Hard**: today's boards plus one leaky jug (loses 1 unit each pour while held). Expert as today | a leak is a new constraint on the route | BFS proof per board |
| Checkout | E anyRing; H today's; X exact darts, negatives, quad | near ≥ 80 % | X keep | **Hard**: today's plus one dead segment per board (scores 0). Expert as today | a dead segment changes the finishes | exhaustive search per board |
| Ballpark | easy lines / hard lines / today's lines + hidden end | none | X keep (hidden end) | **Hard**: one label on the line is wrong (to spot before placing). Expert as today, plus the marker drifts 1 % a second while held still | a wrong label makes the player check, not assume | estimation is open; the kit's best tenth at 160+ |
| Kakuro | E 5×5; H today's 6×6 19–21; X 7×7 26–28 | near ≥ 80 % | parametric | **Hard**: today's plus one pre-filled wrong digit. **Expert**: the wrong digit and half the run sums hidden (deduced from the others) | a planted error and missing sums are new deductions | the one-solution solver per board; person-like finishes |

## Speed

| Game | Today | Measured (human / elite) | Verdict | Proposed change | Why | Expert proof |
|---|---|---|---|---|---|---|
| Flash | flashes 5 / 6–8 / 8, decoys 0–1 / 2–3 / 3–5, gold-like 0 / 0.75 / 0.75 | 124 / 114 / 106 / 100; 188 / 186 / 187 / 183 | TIMID; the ladder sits low because of the curve (I1) | **Hard**: two decoy colours (only the gold counts). **Expert**: decoys and the flash drifts 60 px during its life | tracking a moving flash is a different reaction | open; after I1's curve the human-limited player at 120+ |
| Ascend | E 16 numbers; H 30 moving; X descending | 199 / 199 / 190 / 178 | X keep | **Hard**: two colours, gold ascending and blue descending, tapped in turn. **Expert**: as today plus two discs swap places every second | mixed order is a new rule, not a faster one | open; limited player at 120+ |
| Chain | 30 / 40 / 50 links, reversed stretches, cycle 5 / 5 / 6 | 174 / 160 / 141 / 119 | X keep (six-charm cycle) | **Hard**: a decoy chain crosses the real one (grey links). Expert as today | a crossing chain forces reading, not reflex | open; limited player at 120+ |
| Bonk | up time, flips, hedgehogs 5 / 15 / 20 % | 148 / 146 / 140 / 129 | TIMID | **Hard**: a bomb mole (−10, 15 %). **Expert**: bombs and moles that move one cell while up | a moving target changes the aim | open |
| Tenfall | ops plusMinus / more / all, speed 80 / 115 / 115 % | 182 / 175 / 168 / 143 | parametric | **Hard**: negative tiles. **Expert**: negatives and a tile that splits (a 10 falls as two 5s) | new arithmetic objects | the stage plan per deal |
| Pull! | 20 / 28 / 30 clays, pairs / triples | 181 / 170 / 162 / 152 | X keep (triples) | **Hard**: a grey decoy bird (−5 if shot). Expert as today plus wind (a flag shows the drift) | a decoy and wind are new judgements | open |

## Attention

| Game | Today | Measured (great / near) | Verdict | Proposed change | Why | Expert proof |
|---|---|---|---|---|---|---|
| Eagle Eye | grids 4–6 / 6–8 / 7, two facings from grid 3 / 2 / 0, look-alikes 30 / 75 / 80 % | 184 / 187 / 159 / 148 | parametric | **Hard**: one mirrored decoy per grid (the target flipped). **Expert**: mirrors and the target symbol changes halfway through each grid | spotting a flip and a changed target are new | one answer per grid (`attention-levels-check`) |
| Double Take | 5 / 7 + hidden, subtle colours / 8 + hidden on 8×8 | 185 / 179 / 162 / 150 | H MECHANIC-lite | **Hard**: as today plus one false difference (a region that looks changed but is identical; a tap costs). Expert as today plus the two pictures swap sides every 15 s | a false difference punishes guessing | one answer per board |
| Tally | 3 trays 1 group / 3 groups fast / two-colour questions no marks | 166 / 162 / 125 / 115 | H TIMID (speed only) | **Hard**: a decoy shape (counted by nothing). Expert as today plus a tray that scrolls | a decoy changes the count, not the clock | counted from the dealt tray |
| Labyrinth | 13×15 / 21×27 / 21×27 hidden exit | 196 / 184 / 158 / 150 | X keep | **Hard**: one-way doors (an arrow cell). Expert as today plus fog (walls shown within 3 cells) | doors and fog change route finding | the maze's single route |
| Bomb Defusal | 5 / 7 / 8 wires, instant at Expert | 197 / 182 / 113 / 72 (Expert great 72: too hard for a good player) | X keep; too steep | **Hard**: a rule that changes after a cut (announced). **Expert**: 8 wires, the changing rule, no instant explosion but 10 s per cut | the changing rule is the mechanic; the per-cut timer keeps pressure without the one-mistake cliff | every card proved from its clue text; the person-like solver cracks every Expert card |
| Matchmaker | 8 / 18 / 21 pairs, flip-back 900 / 500 / 400 ms | 197 / 192 / 154 / 151 (X ≈ H) | X TIMID | **Hard**: a card swaps place after a miss. **Expert**: swaps and the gold pair moves every 10 s | memory with a moving board is a new game | one answer per layout |

## Pattern

| Game | Today | Measured | Verdict | Proposed change | Why | Expert proof |
|---|---|---|---|---|---|---|
| Gridlock | moves 6–12 / 22–30 / 40–48 | near 200 / 200 / 196 / 190; human H 164, X 149 | parametric | **Hard**: a locked car (moves only once another has moved past it). **Expert**: locks and a second exit (the gold car must leave by the marked one) | new blocking rules | the bank's minimum by BFS with the rules |
| Tessellate | 6 / 9 / 11 pieces, solutions ≥ 20 / 2–5 / 1–2 | none | parametric | **Hard**: one piece must be rotated to fit (outlines hidden). **Expert**: rotations and one mirror piece | rotation and reflection are new moves | the exact tiling proved; the person-like solver finishes |
| Pipeline | 5×5 60 % / 8×8 90 % / 8×11 95 % no spills | none | X keep | **Hard**: as today plus one locked tile (shown) that must be routed round. Expert as today plus two sources that must not mix | locks and colours change the routing | one solution per board (the person-like solver at deal) |
| Chroma Lines | 6×6 / 9×9 walls / 9×12 | none | parametric | **Hard**: as today plus a bridge cell (two lines may cross there). Expert as today plus a bridge and one pair whose colour is hidden until a line touches an end | a bridge changes planarity; a hidden colour is deduction | one solution; person-like finishes |
| Skid | 8×8 / 12×12 hazards / 11×13 | none | parametric | **Hard**: a sticky tile (the puck stops on it). **Expert**: sticky tiles and a teleport pair | new tile kinds change the slide graph | BFS proof |
| Heave | 3 / 5 / 6 crates, detour | none | H TIMID | **Hard**: a pushable wall segment. **Expert**: walls and ice (a push slides until a wall) | new pushables | the push bound and exact minimum |
| Lightbender | 4–5 / 8–9 / 9–10 mirrors, shots 5 / 3 / 2 | near ≥ 180 at X | parametric | **Hard**: a splitter (one beam in, two out). **Expert**: splitters and a colour filter (the beam must be the right colour at the target) | new optics | one layout proved; person-like finishes |
| Topsy-Turvy | 3 / 6 / 8 balls, tilts 2–4 / 6–9 / 7–10 | none | H TIMID | **Hard**: a blocked hole (opens after another ball homes). **Expert**: blocked holes and a magnet (one tilt direction is weaker, shown) | ordering and asymmetry are new | shortest route by BFS; person-like finishes |

## Logic

| Game | Today | Measured (great / near) | Verdict | Proposed change | Why | Expert proof |
|---|---|---|---|---|---|---|
| Box Six | givens 19–21 / 10–12 / 9–10, clashes live / live / on Check | 197 / 185 / 160 / 130 | X MECHANIC-lite | **Hard**: as today plus no live clashes. **Expert**: as today plus one killer cage (a cage with a sum) | a cage is a new constraint type | one solution (bank) |
| Polypotions | 6 / 10 cap 7 / 12 hidden layers | 200 / 195 / 186 / 129 | X keep | **Hard**: as today plus a capped flask (one colour only). Expert as today plus a cracked flask (pours only into it) | new flask kinds | exact minimum by search |
| Hanoi | 4 posts 7 / 3 posts 9 / 3 posts 10 | 199 / 195 / 181 / 169 | H TIMID | **Hard**: 3 posts, 9 rings and a colour rule (no two of a colour touching). **Expert**: 10 rings, the colour rule and one post locked for the first 20 moves | a colour rule changes the classic solution | exact minimum by search with the rule |
| Safe Cracker | 3 / 4 / 5 dials, tries 3 / 3 / 2 | 200 / 194 / 182 / 174 | parametric | **Hard**: one clue is false (marked "one of these lies"). **Expert**: the lie and a dial that resets after a wrong try | a liar clue is a new deduction | one solution (bank) |
| Mosaic | 6×6 / 9×11 / 9×14 two-line | 197 / 193 / 158 / 126 | X MECHANIC-lite | **Hard**: as today plus one two-colour row (clues in two colours). Expert as today plus clues that hide once their line is complete | colour clues are a new reading | one solution (generator) |
| Colour Flood | 10×10 / 12×17 / 14×24 blocked | 199 / 197 / 188 / 166 | X keep | **Hard**: as today plus a second source corner (floods alternate). Expert as today plus a colour never offered twice running | two sources change the plan | par by search |
| Minefield | 8×12 9 / 10×16 20 (today's) / 12×18 34 | 199 / 195 / 189 / 174 | parametric | Expert: as today plus one mine that moves once (a flag marks the moment; the board is re-proved after the move) | a moving mine is a second deduction pass | the no-guess solver clears both halves |
| Tents and Trees | heights 6 / 10 / 12 | 200 / 200 / 178 / 163 | parametric | **Hard**: one decoy tree (no tent). **Expert**: decoys and tents in two sizes (a large tent takes two cells) | new constraints | one solution + the person-style band |
| Shikaku | heights 7 / 12 / 13 | 200 / 199 / 177 / 171 (X ≈ H) | X TIMID | **Hard**: one number hidden. **Expert**: hidden numbers and one L-shaped region allowed | new region rules | one solution |
| Lamplighter | heights 7 / 10 / 12 | 199 / 200 / 179 / 159 | parametric | **Hard**: a dim lamp (lights 2 cells). **Expert**: dim lamps and a mirror wall (light turns a corner) | new light rules | one solution |
| Trail | givens 14 / 10 hard / 10 expert | 200 / 199 / 166 / 154 | parametric | **Hard**: a must-visit star cell. **Expert**: stars and a one-way cell | path constraints | the bank's proof |
| Loopline | 5×5 / 7×7 / 8×8 | 199 / 199 / 184 / 171 | parametric | **Hard**: a grey clue (counts inner edges). **Expert**: grey clues and a forced corner | new clue kinds | one solution |
| Regions | 6×6 / 7×7 / 8×8 | 200 / 200 / 169 / 155 | parametric | **Hard**: a region size shown as a range (3–4). **Expert**: ranges and one size hidden | new clue kinds | one solution |
| Island Link | 6×6 / 8×8 / 8×8 | 200 / 200 / 180 / 156 | parametric | **Hard**: one island allows a diagonal bridge. **Expert**: diagonals and an island that takes exactly double bridges | new bridge rules | one solution |

## Arcade: Retro (today's levels are table rows with no per-level proof except Wavefront)

| Game | Today | Measured (elite, human limits) | Verdict | Proposed change | Why | Expert proof |
|---|---|---|---|---|---|---|
| Hover | shield 1 / 0 / 0, gaps 115 / 100 / 100 %, scroll 100 / 106 / 112 % | 174 / 173 / 140 / 141 (X not harder than H) | TIMID | **Hard**: gates that close 0.5 s after they are passed (a stall costs a life). **Expert**: closing gates and inverted-gravity stretches (announced, 10 s each) | closing gates and inverted gravity are new hazards | a hover witness under human limits on every seed (the deal rejects a course the limited bot can't clear) |
| Breaker | ball 108 / 104 / 108 %, paddle 100 / 76 / 68 px, tough rows 0 / 4 / 9 | 190 / 185 / 177 / 143 | H TIMID | **Easy**: the paddle 1.3× and no gold. **Hard**: two more rows and steel bricks (unbreakable) shielding the gold. **Expert**: steel plus the wall shifts one column every 5 s and the paddle shrinks 10 % after each gold | new brick kinds and a moving wall | the breaker oracle at 200 under human limits on every dealt seed; the deal checks the gold is reachable round the steel |
| Rally | lives 3 / 2 / 1, paddle 140 / 104 / 96, bumpers from 45 / 20 / 10 s | 175 / 159 / 156 / 142 | H TIMID | **Hard**: a second bumper and pads that swap halves every 20 s. **Expert**: bumpers, swapping pads, a net that rises every other return (lob over it), spin reversed in the last 30 s | new court features | the rally oracle at 200 on every seed |
| Wavefront | lives 4 / 3 / 2, bolts 80 / 120 / 140 %, boss 80 / 130 / 160 % | 193 / 194 / 195 / 196 (flat: bots dodge everything) | parametric; bots can't show it | **Hard**: ships fire slow bolts back (from the front rank, dodgeable) and the wider formation (wavRev 16, C1.6). **Expert**: return fire, the formation drops a row when a column empties, the mothership from wave 4 | return fire changes the game from a shoot to a dodge-and-shoot | the deal's witness at 200 at every level (`wavefront-big-deal.ts`), and a human-limited witness |
| Fission | lives 4 / 3 / 2, quick-clear 150 / 75 / 60 %, free whiffs 40 / 12 / 8 | 191 / 179 / 172 / 158 | H TIMID | **Hard**: smaller atoms (burstRev 14, C1.8) and one shielded atom per wave (two hits). **Expert**: shields and a ceiling that lowers over each wave | new atom kinds and a shrinking arena | the perfect seed and the limited bot at 200 / 140+ |
| Tempo | windows 5/10/16 … 2/5/10 ticks, fall 110 / 75 / 60 | 190 / 191 / 188 / 180 (flat) | parametric; bots can't show it | **Hard**: a fifth lane and notes that slide between lanes. **Expert**: five lanes, sliders and a mirror section (lanes flip for 8 bars) | new note kinds | the chart's windows reachable by a 0.15 s mover (static proof per chart) |
| Meteor | lives 3 / 2 / 1, walls at H and X | 177 / 175 / 167 / 161 | H/X keep (walls) | **Hard**: walls and a second comet (an AI snake that takes stars). **Expert**: two comets and a board that shrinks (a border row closes every 15 s) | a rival and a shrinking board | the snake bot under limits at 200 on every seed |
| Spacewalk | density 5–10 / 8–15 / 10–18 twelfths, lives 4 / 3 / 2 | 197 / 193 / 164 / 139 | parametric | **Hard**: an asteroid lane (moves both ways). **Expert**: asteroid lanes and a rotating station (the safe deck moves) | new lane kinds | each crossing proved passable at the level's density (`cross-std-density.ts`) |
| Pinball | balls 4 / 3 / 2, gravity 85 / 110 / 120 % | 196 / 188 / 188 / 164 | H TIMID | **Hard**: a third flipper (upper right) and narrower outlanes. **Expert**: the third flipper and a tilt meter (over-nudging tilts and drains) | new table features | the pinball bot at 200 on the table |
| Blockzone | gravity 125 / 80 / 60 %, lock 40 / 24 / 18, previews 3 / 2 / 1 | 178 / 172 / 166 / 155 | parametric | **Hard**: a garbage row every 20 s. **Expert**: garbage rows and invisible pieces (0.5 s preview, then the piece fades; the ghost stays) | garbage and invisibility are the classic steps | the planner at 200 under human limits on every bag seed |

## Arcade: Action

| Game | Today | Measured (elite, human limits) | Verdict | Proposed change | Why | Expert proof |
|---|---|---|---|---|---|---|
| Roofbound | movers none / 8 s / 5 s, sweet spots 6 ticks / 1 / 1, crash 5 / 20 / 25 s | 200 / 183 / 163 / 159 | E keep; H/X parametric | **Hard**: movers and collapsing roofs (a roof falls 1 s after landing). **Expert**: collapsing roofs and a chasing fire behind the runner | new hazards | each course's witness at 200 (`flip-level-deal.ts`) |
| High Rise | slide 448 / 896 / 960, tolerance 5 / 3 / 2 px, wind from 30 / 15 / 10 | 167 / 123 / 114 / 98 (Normal 123: I5) | parametric | **Hard**: wind and a crane that reverses direction every 10 floors. **Expert**: wind, the reversing crane and a second crane dropping alternate floors | new crane rules | the skyline oracle at 200 at every level |
| Grappler | reach 250 / 220 / 205, sliders 0 / 2–10 / 3–11, pterodactyl none / 3.2 / 3.4, dark 0 / 6 / 7 | 199 / 199 / 200 / 198 (flat: planned releases) | E keep; H/X unmeasurable | **Hard**: sliding vines and a swinging gap (a ledge that moves). **Expert**: dark runs, swinging gaps and vines that snap 1.5 s after a grab | new hazards; the snap limits the planned-release bot too | each course's witness at 200 (`swing-slide-deal.ts --level`) under human limits |
| Moon Climb | blades 0.5 / 1.3 / 1.6, ice 30 / 65 / 88 %, lanterns 6 / 6 / 4 | 190 / 173 / 159 / 135 | parametric | **Hard**: falling rocks down the shaft. **Expert**: rocks, crumbling cling surfaces (give way after 0.5 s) and no lanterns | new hazards | towers proved in the sim with the level's body (after ricoRev 5) |
| Iron Wall | pace 32–74 / 40–95 / 44–104 %, zone 320 / 120 / 90 ms, heavies 2 / 8 / 8 | 198 / 197 / 162 / 146 | parametric | **Hard**: a fourth lane and heavies from wave 2. **Expert**: four lanes, night (tanks lit only by their own lights, seen from z 400) and drones that drop smoke | a lane and darkness are new | the bastion oracle at 200 at every level |
| Orbit | tank 240 / 140 / 120, checkpoints auto / one / none | 185 / 184 / 170 / 160 | E/X keep | **Hard**: moving planets (two bodies orbit each other). **Expert**: moving planets, respawn only, a solar wind (a steady drift shown by the stardust) | moving targets and drift are new flight problems | each level's bank re-proved (`orbit-fuel-bank.ts --level`) |

## Arcade: Strategy

| Game | Today | Measured (elite, human limits) | Verdict | Proposed change | Why | Expert proof |
|---|---|---|---|---|---|---|
| Tilt | 3 mazes no ice / 4 mazes pits 3–4 / 4 mazes pits 4 ice 5 | 193 / 144 / 141 / 121 (Normal 144: I8) | parametric | **Hard**: a second marble to home at once on two mazes (keep) and rotating wall segments (one turns every 4 s). **Expert**: two marbles, rotating walls and a trapdoor (a pit that opens after 20 s) | moving geometry | the tilt deal at 200 at every level (`tilt-deal.ts`) |
| Gemstone | colours 5 / 6 / 7, ice 5 / 14 / 18, hint 3 s / 8 s / none | 197 / 158 / 146 / 137 | X keep; H TIMID | **Hard**: 14 ice and stone gems (only a cascade clears them). **Expert**: seven colours, stone, no hint and a column that locks every 15 s | new gem kinds and a shrinking board | witnesses at 200 on every dealt seed (today: one per level) |
| Coral Pop | colours 3 / 5 / 6, trail 2 bounces / 1 / 0 | 195 / 176 / 174 / 159 | X keep; H TIMID | **Hard**: anchored bubbles (pop only from below). **Expert**: six colours, anchors and a current (every shot drifts 1 px a tick) | new bubble kinds | the bubble bot under limits at 200 on every dealt seed (today: some) |
| Rainbow Bridge | ink 150 / 110 / 100 %, birds 25 % / +2 / +3 swaying | 197 / 190 / 183 / 166 | X keep | **Hard**: as today plus gusts (an announced wind that bends the arc on two levels). Expert as today plus a moving pot on the last three levels | new flight physics | each level's deal at 200 |
| Ball Tracker | 16 / 42 / 42 marbles, cup moves 0 / 8 / 12 | 200 / 195 / 177 / 151 | E keep | **Hard**: a fork tube (one in, two out, alternating). **Expert**: forks and blind marbles (grey halfway down) | new tube kind and hidden information | each level's proved list |

## Arcade: Sports

| Game | Today | Measured (elite, human limits) | Verdict | Proposed change | Why | Expert proof |
|---|---|---|---|---|---|---|
| Home Run | pitch flights 42–74 / 28–59 / 27–55 ticks, zone ±7 / ±4 / ±4 | 200 / 200 / 172 / 149 | parametric | **Hard**: curveballs and changeups with a smaller zone (keep) plus a pitcher who varies the release point. **Expert**: a knuckleball (a late seeded dip) and night (the ball visible from 60 % of its flight) | new pitch kinds and hidden flight | the deal's oracle at 200 (`homerun-innings-deal.ts`) |
| Top Bins | keeper 14 / 6 / 5 ticks, wind 1 / 6 / 7, hoop 85 / 60 / 50 %, ease off at H/X | 190 / 197 / 168 / 128 | H/X keep (ease removed) | **Hard**: as today plus a jumping wall on every kick. **Expert**: as today plus a second keeper on the line for the last three kicks | a second keeper changes the target | the deal's oracle at 200 (`freekick-layered-deal.ts --rev=6`) |
| Apex | gravel keep 80 / 60 / 50 %, aids 2 / 1 / 0, tight hairpins at X | 200 / 187 / 172 / 157 | parametric | **Hard**: hairpins and rain (grip 85 %, a wet line). **Expert**: rain, night with headlights, and damage (steering 70 % for 3 s after a wall hit) | weather and damage are new driving problems | the level's deal at 200 (`racing-deal.ts --rev=4 --level`) |
| Crazy Golf | sails 128 / 256 / 512, extras at H/X, slopes 1 / 1.4 / 1.8×, preview full / 35 / 20 % | 192 / 192 / 163 / 146 | H/X keep | **Hard**: as today plus moving sails on every hole. **Expert**: as today plus a water hazard that costs a stroke on two holes | more hazards of the kinds that exist | the hole bank proved at the level |
| Cue Ball | preview long / short / ghost, foul −5 / −10 / −15, black at 5 / 7 / 7 | 177 / 164 / 158 / 139 | TIMID (display aids only) | **Hard**: potting an opponent's ball costs 10 (they block the table) and 75 s. **Expert**: one cushion deadens (announced), 60 s | the opponent's balls become hazards; a dead cushion changes every bank shot | the bank re-proved at the level (`pool-bank.ts`) |
| Curl Champ | reds 2 / 4 / 5, aids whole path / zone + third / none | 196 / 188 / 183 / 146 | H TIMID; X keep | **Hard**: four reds and a guard stone that must be curled round (placed on the line). **Expert**: five reds, no aids and a swept fast lane (announced) | a guard and swept ice are curling's real difficulties | the level bank's witnesses at 200 |
| Ringer | no levels documented beyond the registry | none | – | **Easy**: wide cups, a still gold cup. **Hard**: a faster gold cup and a bumper on the lane. **Expert**: the bumper, a swinging cup tower and 7 balls | new lane features | the swipe bot at 200 |

## Arcade: Cards & Board

| Game | Today | Measured (elite / human) | Verdict | Proposed change | Why | Expert proof |
|---|---|---|---|---|---|---|
| Free Cell | 32 / 52 / 52 cards, cells 5 / 4 / 3, undos free / unlimited / 3 | 193 / 184 / 156 / 146; human 193 / 185 / 167 / 164 | X MECHANIC-lite | **Hard**: 52 cards and 3 cells (keep 4 for Normal). **Expert**: 2 cells and one column dealt face down (turned as cards leave it) | fewer cells and hidden cards are the classic steps | every bank deal solved by the solver with that many cells |
| Mahjong | 56 / 72 10 quads / 88 12 quads | 200 / 198 / 183 / 171; human 200 / 198 / 195 / 193 | H TIMID | **Hard**: a sealed top layer (unlocks after ten pairs). **Expert**: 88 tiles, the sealed layer and no Shuffle | new ordering rule | the backwards build with the rule applied |
| Summit | easy subset / no-wrap easier / no-wrap hardest | 183 / 181 / 174 / 171; human 165 / 159 / 145 / 129 | H/X keep | **Hard**: as today plus two stocks (alternate turns). **Expert**: as today plus a hidden peak (the top row face down until a run of five) | new stock and hidden cards | the stock-par solver at the level |
| Five Hands | tables ×1.6 / ×1.4 hard / ×1.3 expert | 172 / 154 / 131 / 115; human 154 / 136 / 115 / 101 | H/X keep | **Hard**: the hard table and one wild card per deck. **Expert**: the strict table, no wild, a dead column chosen by the seed | a wild card and a dead column change the planning | the exact-best search per deck (the standard's named exception stays) |
| Thirteen | passes 3 / 1 / 1, Kings 3–4 / 2–3 / 3, glow on / off / off | 196 / 180 / 159 / 140; human 196 / 177 / 143 / 134 | H/X keep | **Hard**: as today plus a locked pair (two pyramid cards that must go together). **Expert**: as today plus a timed stock (the stock card changes every 5 s) | new pairing rule and time pressure | the solver's witness on every deal |

## Measurement and proof plan (for S6 and S7)

1. For each game, add the new mechanic behind the level's settings (puzzles) or the sim's level row (arcade), carried on the state and in the checksum; Normal carries nothing.
2. Re-run the game's tuning tool at every level (`level-tune.ts --human-limits`, or the family tool) and tune the numbers to the guide; record the table in the game's `docs/arcade-standard/<game>.md` or the family review doc.
3. Rebuild and re-prove the level's bank or deal with the mechanic; a seed with no witness under human limits is dropped.
4. Extend the game's `<game>-levels-check` with the mechanic's rule (one assertion per mechanic: it exists at the level, never at Normal, the proof holds) and run it 10 times (`repeat-check.ts`).
5. Record each game's intro demo on Normal only (unchanged); the level intros show the still with the level line (`levelAbout`).
