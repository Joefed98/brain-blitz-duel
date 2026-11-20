# Joulz difficulty spec: Easy, Hard and Expert for every game

Fable, 20 Nov 2026, rewritten on Joe's rule of 20 Nov 2026. Companion to `docs/polish-plan-final.md` section D. The "Today" column comes from `levels-research.md` in this folder (every setting, measurement and proof, read from the code on main 774e5ddb). Ringer is retired and is not in this spec.

## The rule (Joe, 20 Nov 2026)

1. **A level makes 200 clearly harder to reach, with big, obvious steps.** More bricks, more enemies, more lanes, tighter targets, less time, bigger boards, more pieces: whatever fits the game. The numbers below are proposals; Joe's playtest fixes them.
2. **A new mechanic only where it is the natural way to make that game harder** (Iron Wall's extra lane). Nothing is added for its own sake.
3. **Normal stays today's game.** Rated play and the Daily deal it.
4. **No level adds an aid at Hard or Expert.** Aids (previews, hints, glows, a wider zone) are for Easy only; Hard and Expert keep Normal's aids or lose them.
5. **Expert is super hard for an average player and still proven reachable at 200 by the very best humans under `HUMAN_LIMITS`** (0.25 s to react, 0.15 s to move; `scripts/arcade-skill-bands/human.ts` and each game's own copy). For an arcade game that means a witness or the oracle at 200 under the limits on every dealt seed (a seed with none is dropped from the level's deal); for a puzzle, every Expert board finished by the person-style solver inside its clock with no guess. Guide numbers for the elite bot under the limits: Easy 190+, Hard 150–175, Expert 110–140; the "great" bot should finish most Hard boards and few Expert boards.
6. Every level is proved where it is dealt (a bank per level, or a witness in the sim) and pinned by the game's own `<game>-levels-check` (the step exists, never at Normal, the proof holds), run ten times before the PR.

Measurement columns quote the elite bot under human limits where it exists (E / N / H / X), else the kit or the near-perfect bot.

## Word (session D1)

| Game | Today (E / H / X) | Measured | Proposed Easy | Proposed Hard | Proposed Expert | Expert proof |
|---|---|---|---|---|---|---|
| Nucleus | wheel 9–10 / 8–9 / 8 letters; everyday words 45–85 / 16–24 / 10–14; 120 / 65 / 50 s | near-perfect 155–182 / 145–168 / 128–155 / 110–138 | as today | 8-letter wheel, 12–18 everyday words, **the core full at 80 % of them**, 60 s | 8 letters, 8–12 everyday words, the core full at **all of them**, 45 s | open by design; the near-perfect kit at 120+ inside 45 s |
| Interlock | crossing rules; 120 / 60 / 50 s | none pinned | as today | 18 tiles on a 6×6 (today 15 on 5×5), across word 8 letters, 60 s | 21 tiles on a 7×7, across word 9 letters, 50 s | open; a proved grid exists for every deal |
| Slider | shifts 3 / 7 / 8, par 2–3 / 7 / 8; 100 / 60 / 50 s | solver finishes E 24 / N 15 / H 9 / X 4 of 24 | as today | 6 rows (today 5), shifts 7, par 7, 60 s | 6 rows, shifts 9, par 9, 50 s | the slider solver (`scripts/slider-human.ts`) finds the dealt line within par + 2 on every Expert board; elite finishes ≥ 50 % |
| Forage | words 320–700 / 100–140 / 50–80; 120 / 80 / 70 s | near 170–195 / 158–184 / 138–164 / 115–142 | as today | 7×7, 100–140 words, 75 s | 8×8, 50–80 words, 60 s | open; near-perfect kit at 120+ |
| Lookout | 8×8 5 words / 10×11 7 words / 10×12 8 words + 4 decoys | near 185–200 / 180–200 / 174–196 / 152–178 | as today | 10×12, 9 words, 8 directions, no theme shown, 80 s | 10×14, 11 words, 6 decoys, 75 s | the bank's boards hold every word once (`word-search-level-bank.ts`) |
| Roundabout | 6 letters 7–9 words / 7 letters 12–15 / 16–19; 120 / 75 / 80 s | near 170–195 / 162–186 / 155–180 / 148–174 | as today | 7 letters, 16–19 words, ≤ 9×12, **70 s** | 8 letters, 20–24 words, ≤ 10×13, 70 s | the bank's words each have exactly one common answer (`letter-wheel-bank.ts`) |
| Strikeout | givens 3/2 … 0, strikes 14 / 10 / 12; 120 / 90 / 85 s | near 188–200 / 190–200 / 172–192 / 155–182 | as today | 6 words of 8, givens 1/1, 8 strikes, 85 s | 7 words of 8, 0 givens, 8 strikes, 80 s | the person-like solver (`strikeoutSolver.server.ts`) solves every board under the strike limit |
| Cryptogrid | givens 8 / 5 / 4; 120 / 75 / 70 s | near 190–200 at every level | as today | 8×8 grid (today 7×7), 4 givens, 75 s | 9×9 grid, 3 givens, 70 s, only bank boards the person-like solver cracks from three | `codewordHuman.server.ts` cracks every Expert bank board from three givens |
| Swapword | min + 16 / + 6 / + 4; 120 / 55 / 60 s | none pinned | as today | 7 crossing words (today 6), min swaps 15–18, + 4, 60 s | 8 words, min 18–22, + 2, 55 s | one arrangement proved per deal; Expert by the mark-reading solver (`swapwordProof.server.ts`) |

## Number (session D2)

Joe's 15 Nov decision stands: Counterweight, Brimful, Checkout and Kakuro keep today's game as Hard; their Normal is the gentler stamp.

| Game | Today | Measured | Proposed Easy | Proposed Hard | Proposed Expert | Expert proof |
|---|---|---|---|---|---|---|
| Counterweight | E 3 scales of 6; H today's 4 scales; X 4 scales of 10, readout hidden | none | as today | as today (the 15 Nov decision) | 5 scales of 10, loose/fixed up to 7/2, spare 5, readout hidden, 120 s | BFS proof per board; person-like solver finishes |
| Exact | large tiles 1–2 / 1 / 0; targets 101–300 / 300–999 / 500–999 | none | as today | as today | no large tiles, 7 small tiles, target 700–999 needing all seven, 60 s | exhaustive search per deal; the Expert bank person-solvable |
| Operator | gaps 0–1 / up to 4 / mixed + 2 decoys; tries 3 / 3 / 2; 90 / 85 / 78 s | none | as today | 5 equations of 5 (today 4 of 4), numbers 2–25, 3 tries, 80 s | 5 equations of 6, numbers 2–30, 3 decoys, 1 try, 70 s | the person-like search finds a true fill per line |
| Integer Pyramid | 4 / 5 / 6 rows, decoys 1 / 3 / 3 | N: great 135, near 189 | as today | 6 rows, 4 decoys, bottom 4–25, 120 s | 7 rows, 5 decoys, bottom 4–30, 120 s | the exhaustive proof per board; person-like completes |
| Brimful | E 3 boards; H today's; X no tap, split goal, 1.5× limit | near finishes ≥ 80 % of X | as today | as today | 5 boards (today 4), min bands up to [16, 20], limit 1.3×, 120 s | BFS proof per board |
| Checkout | E anyRing; H today's; X exact darts, negatives, quad | near ≥ 80 % | as today | as today | 6 strange boards, 2 darts a visit on two of them, targets 100–360, 120 s | exhaustive search per board |
| Ballpark | easy lines / hard lines / today's + hidden end | none | as today | as today | 4 lines (today 3), the fourth 0–10,000 with a hidden end, 75 s | estimation is open; the kit's best tenth at 160+ |
| Kakuro | E 5×5; H today's 6×6; X 7×7 26–28 white | near ≥ 80 % | as today | as today | 8×8, 32–36 white, grade 6–14, 120 s, person-solvable | the one-solution solver per board; person-like finishes |

## Speed and Attention (session D3)

| Game | Today | Measured (human / elite) | Proposed Easy | Proposed Hard | Proposed Expert | Expert proof |
|---|---|---|---|---|---|---|
| Flash | flashes 5 / 6–8 / 8; decoys 0–1 / 2–3 / 3–5 | 124 / 114 / 106 / 100; elite 188 / 186 / 187 / 183 | as today | 9 flashes, 3–4 decoys each, gold-like 0.85, flashes 900 ms | 10 flashes, 4–6 decoys, gold-like 0.9, flashes 750 ms | open; after I1's curve the human-limited player reaches 120+ |
| Ascend | 16 / 30 moving / 30 descending; 60 / 50 / 45 s | 199 / 199 / 190 / 178 | as today | 36 numbers, move every 8 s, 50 s | 40 numbers, descending, move every 6 s, 45 s | open; limited player at 120+ |
| Chain | 30 / 40 / 50 links; windows down to 1.4 s | 174 / 160 / 141 / 119 | as today | 50 links, 2.2 / 1.8 / 1.5 s, two reversed stretches, 50 s | 60 links, 1.8 / 1.5 / 1.3 s, three reversed stretches, cycle 6, 60 s | open; limited player at 120+ |
| Bonk | up 66→48 / 43→30 / 40→27 ticks, hedgehogs 5 / 15 / 20 % | 148 / 146 / 140 / 129 | as today | up 38→26 ticks, 4 up at once, hedgehogs 20 % | up 34→22 ticks, 5 up, hedgehogs 25 %, gap 40 % | open; limited player at 120+ |
| Tenfall | 8 / 10 / 11 targets, ops plusMinus / more / all | 182 / 175 / 168 / 143 | as today | 12 targets to 240, ops all, speed 125 % | 14 targets to 300, ops all, speed 140 % | the stage plan per deal |
| Pull! | 20 / 28 / 30 clays; birds 6 / 24 / 32 | 181 / 170 / 162 / 152 | as today | 30 clays with 10 pairs, 32 birds, 150 % | 34 clays with 12 groups and 4 triples, 40 birds, 170 % | open; limited player at 120+ |
| Eagle Eye | grids 4–6 / 6–8 / 7; look-alikes 30 / 75 / 80 % | 184 / 187 / 159 / 148 | as today | grids 7, 8, 8; 8–12 targets; look-alikes 85 % | grids 8, 8, 9; 10–14 targets; look-alikes 90 %; full by 8 s | one answer per grid (`attention-levels-check`) |
| Double Take | 5 / 7 + hidden subtle / 8 + hidden on 8×8 | 185 / 179 / 162 / 150 | as today | 8×8, 9 + hidden, subtle colours, 60 s | 9×9, 11 + hidden, subtle colours, 60 s | one answer per board |
| Tally | trays 25–55 / today's fast / 60–110 two-colour | 166 / 162 / 125 / 115 | as today | trays 70 / 100 / 130 / 70, 3 groups, full by 5 s | trays 80 / 120 / 150 / 80, two-colour, no marks, 60 s | counted from the dealt tray |
| Labyrinth | 13×15 / 21×27 / 21×27 hidden exit | 196 / 184 / 158 / 150 | as today | 23×29, route 150–220, 75 s | 25×31, route 190–280, hidden exit, 90 s | the maze's single route; the person-like solver reaches the hidden exit in time |
| Bomb Defusal | 5 / 7 / 8 wires; instant explosion at Expert | great 197 / 182 / 113 / 72 | as today | 8 wires, 8 steps, 8–9 clues, 90 s | 9 wires, 9 steps, 9–10 clues, instant, 120 s | every card proved from its clue text; the person-like solver cracks every Expert card |
| Matchmaker | 8 / 18 / 21 pairs, flip-back 900 / 500 / 400 ms | 197 / 192 / 154 / 151 | as today | 21 pairs, 6 columns, 450 ms, 4 shapes, 90 s | 28 pairs, 7 columns, 350 ms, 4 shapes, 120 s | one answer per layout |

## Pattern and Logic (session D4)

| Game | Today | Measured | Proposed Easy | Proposed Hard | Proposed Expert | Expert proof |
|---|---|---|---|---|---|---|
| Gridlock | moves 6–12 / 22–30 / 40–48 | near 200 / 200 / 196 / 190; human H 164, X 149 | as today | 7×7, moves 30–38, cars 13–15, 60 s | 8×8 lot, moves 48–60, cars 16–18, 90 s | the bank's minimum by BFS |
| Tessellate | 6 / 9 / 11 pieces, solutions ≥ 20 / 2–5 / 1–2 | none | as today | 8×8, 11 pieces, 1–3 solutions, 60 s | 9×9, 13 pieces (+U, P, W), exactly 1 solution, 70 s | the exact tiling proved; the person-like solver finishes |
| Pipeline | 5×5 / 8×8 / 8×11 no spills | none | as today | 8×10, ≥ 92 % scrambled, 120 s | 9×12, ≥ 97 %, no spills, 120 s | one solution per board (the person-like solver at deal) |
| Chroma Lines | 6×6 / 9×9 / 9×12 | none | as today | 9×11, 11–13 pairs, 5–7 walls, 75 s | 10×14, 14–17 pairs, 6–8 walls, 90 s | one solution; person-like finishes |
| Skid | 8×8 / 12×12 / 11×13 | none | as today | 12×13, 30–36 slides, holes 6–9, 100 s | 13×15, 38–46 slides, holes 8–11, 120 s | BFS proof |
| Heave | 3 / 5 / 6 crates | none | as today | 6 crates, 30–38 pushes, no hint, 120 s | 8 crates, 42–54 pushes, 120 s | the push bound and exact minimum |
| Lightbender | 4–5 / 8–9 / 9–10 mirrors; shots 5 / 3 / 2 | near ≥ 180 at X | as today | 11×11, 10–11 mirrors, 5–6 bombs, 3 shots, 75 s | 12×12, 12–13 mirrors, 7–8 bombs, 2 shots, 90 s | one layout proved; person-like finishes |
| Topsy-Turvy | 3 / 6 / 8 balls, tilts 2–4 / 6–9 / 7–10 | none | as today | 3 boards of 8 balls, 8–11 tilts, + 5, 120 s | 3 boards of 10 balls on 11×11, 10–14 tilts, + 4, 120 s | shortest route by BFS; person-like finishes |
| Box Six | givens 19–21 / 10–12 / 9–10 | 197 / 185 / 160 / 130 | as today | 10–11 givens, advanced steps ≥ 2, 90 s | 8–9 givens, advanced ≥ 3, clashes on Check only, 90 s | one solution (bank) |
| Polypotions | 6 / 10 cap 7 / 12 hidden | 200 / 195 / 186 / 129 | as today | 12 flasks, 10 colours, capacity 7, min 34–44, 120 s | 14 flasks, 12 colours, capacity 6, hidden layers, min 40–52, 120 s | exact minimum by search |
| Hanoi | 4 posts 7 / 3 posts 9 / 3 posts 10 | 199 / 195 / 181 / 169 | as today | 3 posts, 10 rings, 45–60 moves, 90 s | 3 posts, 11 rings, 60–80 moves, 105 s | exact minimum by search |
| Safe Cracker | 3 / 4 / 5 dials, tries 3 / 3 / 2 | 200 / 194 / 182 / 174 | as today | 5 dials 0–20, 7 clues, 3 tries, 90 s | 6 dials 0–25, 8 clues, 2 tries, 105 s | one solution (bank) |
| Mosaic | 6×6 / 9×11 / 9×14 two-line | 197 / 193 / 158 / 126 | as today | 10×13, line logic, 120 s | 10×16, two-line logic, 120 s | one solution (generator) |
| Colour Flood | 10×10 / 12×17 / 14×24 blocked | 199 / 197 / 188 / 166 | as today | 14×20, 6 colours, par 18–22, spare 3, 60 s | 14×28, 7 colours, par 24–30, 20 blocked, spare 2, 75 s | par by search |
| Minefield | 8×12 9 / 10×16 20 / 12×18 34 | 199 / 195 / 189 / 174 | as today | 12×18, 30 mines, 90 s | 14×22, 48 mines, opening 6–12, 120 s | the no-guess solver clears every board |
| Tents and Trees | heights 6 / 10 / 12 | 200 / 200 / 178 / 163 | as today | height 12, pairs 17–18, 90 s | height 14, pairs 21–23, half the counts hidden, 120 s | one solution + the person-style band |
| Shikaku | heights 7 / 12 / 13 | 200 / 199 / 177 / 171 | as today | height 13, rects 18–21, 90 s | height 15, rects 24–28, max area 20, 120 s | one solution |
| Lamplighter | heights 7 / 10 / 12 | 199 / 200 / 179 / 159 | as today | height 12, walls 26–30, 90 s | height 14, walls 32–38, numbered 0.3, 120 s | one solution |
| Trail | givens 14 / 10 / 10 harder | 200 / 199 / 166 / 154 | as today | 7×7 board, 12 givens, 120 s | 7×7, 10 givens, the hardest bank band, 120 s | the bank's proof |
| Loopline | 5×5 / 7×7 / 8×8 | 199 / 199 / 184 / 171 | as today | 8×8, grade 4–30, 90 s | 9×9, grade 6–40, 120 s | one solution |
| Regions | 6×6 / 7×7 / 8×8 | 200 / 200 / 169 / 155 | as today | 8×8, givens 10–14, 90 s | 9×9, givens 9–12, 120 s | one solution |
| Island Link | 6×6 / 8×8 / 8×8 | 200 / 200 / 180 / 156 | as today | 8×8, 18–22 islands, 90 s | 9×9, 24–28 islands, 120 s | one solution |

## Retro and Action (session D5)

Retro's levels today are table rows with no per-level proof except Wavefront; the session adds a witness under human limits for every dealt seed at every level (the deal drops a seed with none), as Wavefront's `wavefront-big-deal.ts` does.

| Game | Today | Measured (elite, human limits) | Proposed Easy | Proposed Hard | Proposed Expert | Expert proof |
|---|---|---|---|---|---|---|
| Breaker | ball 108 / 104 / 108 %, paddle 100 / 76 / 68 px, tough rows 0 / 4 / 9 | 190 / 185 / 177 / 143 | as today | **11 rows (99 bricks)**, ball 108 %, paddle 76 px, 90 s | **12 rows (108 bricks)**, every row +1 hit, ball 115 %, paddle 68 px, 90 s | a witness under human limits at 200 per dealt seed |
| Rally | lives 3 / 2 / 1, paddle 140 / 104 / 96, bumpers from 45 / 20 / 10 s | 175 / 159 / 156 / 142 | as today | 2 lives, **two bumpers from 15 s**, paddle 100 → 34, cap 120 %, core full 28 | 1 life, two bumpers from 5 s and a third from 30 s, paddle 90 → 30, cap 135 %, full 32 | the rally oracle at 200 on every seed under the limits |
| Wavefront | lives 4 / 3 / 2, bolts 80 / 120 / 140 %, boss 80 / 130 / 160 % | 193 / 194 / 195 / 196 (flat) | as today | **7 columns** (today 6, the wider formation of wavRev 16, C1.6), bolts 140 %, boss 150 %, 2 lives | 8 columns, bolts 170 %, boss 190 %, 1 life, kill by 14 s | the deal's witness at 200 at every level under the limits (`wavefront-big-deal.ts`) |
| Fission | lives 4 / 3 / 2, quick 150 / 75 / 60 %, free whiffs 40 / 12 / 8 | 191 / 179 / 172 / 158 | as today | **6 waves, 105 atoms** (today 5 / 87), 2 lives, quick 70 %, 8 free | 7 waves, 125 atoms, smaller atoms (burstRev 14, C1.8), 1 life, quick 55 %, 4 free | the perfect seed and the limited bot at 200 |
| Hover | shield 1 / 0 / 0, gaps 115 / 100 / 100 %, scroll 100 / 106 / 112 % | 174 / 173 / 140 / 141 | as today | gaps 85 %, scroll 115 %, 42 barriers → **52**, 2 chains more | gaps 72 %, scroll 130 %, 62 barriers, no shield | a hover witness under the limits per seed (the deal rejects an unclearable course) |
| Tempo | windows 5/10/16 … 2/5/10 ticks, fall 110 / 75 / 60 | 190 / 191 / 188 / 180 | as today | **a fifth lane**, the chart 130 % dense, windows 3 / 6 / 11 | five lanes, chart 170 %, windows 2 / 5 / 9, fall 55 | the chart's windows reachable by a 0.15 s mover (static proof per chart) |
| Meteor | lives 3 / 2 / 1, walls at H / X, core full 27 / 36 / 50 / 48 | 177 / 175 / 167 / 161 | as today | walls, **8 seeded rocks** (today 5), step 8 → 3.5, core full 50 | walls, 12 rocks, step 7 → 3, 1 life, core full 56 | the snake bot under the limits at 200 per seed |
| Spacewalk | density 5–10 / 8–15 / 10–18 twelfths, lives 4 / 3 / 2 | 197 / 193 / 164 / 139 | as today | density 12–20, **14 lanes** (today 12), 2 lives | density 14–24, 16 lanes, 1 life, hit cost 25 | each crossing proved passable at the density (`cross-std-density.ts`), a witness under the limits |
| Pinball | balls 4 / 3 / 2, gravity 85 / 110 / 120 % | 196 / 188 / 188 / 164 | as today | 2 balls, gravity 120 %, multiball 15 s, core full 70,000 | 1 ball, gravity 130 %, outlanes 20 % wider, core full 80,000 | the pinball bot at 200 under the limits |
| Blockzone | gravity 125 / 80 / 60 %, lock 40 / 24 / 18, previews 3 / 2 / 1 | 178 / 172 / 166 / 154 | as today | gravity 60 %, lock 20, 2 previews, lines full at 60 | gravity 40 %, lock 14, 1 preview, **a garbage row every 20 s** (natural for the genre), lines full at 66 | the planner at 200 under the limits per bag seed |
| Roofbound | movers none / 8 s / 5 s, crash 5 / 20 / 25 s | 200 / 183 / 163 / 159 | as today | speed 1,408 + 90 / 2.5 s, movers from 5 s, 10 sweet spots, crash 25 s | speed 1,536 + 110 / 2 s, cap 3,584, movers from 3 s, 12 sweet spots, crash 30 s | each course's witness at 200 under the limits (`flip-level-deal.ts`) |
| High Rise | slide 448 / 896 / 960, tolerance 5 / 3 / 2 px, wind from 30 / 15 / 10 | 167 / 123 / 114 / 98 (Normal 123 is I5) | as today | slide 1,024 + 36, tolerance 2 px, wind from 8, 3 lives | slide 1,152 + 40, tolerance 1.5 px, wind from 4, 2 lives | the skyline oracle at 200 at every level under the limits |
| Grappler | reach 250 / 220 / 205, sliders up to 10 / 11, pterodactyl 3.2 / 3.4, dark 6 / 7 | 199 / 199 / 200 / 198 (flat) | as today | reach 200, sliders 4/8/10/12, pterodactyl 3.6 over the last third, 7 dark runs | reach 185, sliders 6/10/12/14, pterodactyl 4.0 over the last half, 9 dark runs | each course's witness at 200 under the limits (`swing-slide-deal.ts --level`) |
| Moon Climb | blades 0.5 / 1.3 / 1.6, ice 30 / 65 / 88 %, lanterns 6 / 6 / 4 | 190 / 173 / 159 / 135 | as today | blades 1.8, ice 90 %, 3 lanterns, knock 4 m, full 260 m | blades 2.2, pace 650, ice 100 %, 2 lanterns, knock 5 m, full 280 m | towers proved in the sim with the level's body (after ricoRev 5) under the limits |
| Iron Wall | pace 32–74 / 40–95 / 44–104 %, zone 320 / 120 / 90 ms, heavies 2 / 8 / 8 | 198 / 197 / 162 / 146 | as today | **a fourth lane** (the natural step), pace 44–104, zone 90 ms, 10 heavies | four lanes, pace 50–120, zone 70 ms, 14 heavies, 5 drones, base 2 | the bastion oracle at 200 at every level under the limits |
| Orbit | tank 240 / 140 / 120, checkpoints auto / one / none | 185 / 184 / 170 / 160 | as today | tank 120, one checkpoint, steps 140–300, window 2, holes from 11 | tank 100, no checkpoint, steps 160–330, window 2, holes from 8, belts from 18 | each level's bank re-proved under the limits (`orbit-fuel-bank.ts --level`) |

## Strategy, Sports and Cards & Board (session D6)

| Game | Today | Measured (elite, human limits) | Proposed Easy | Proposed Hard | Proposed Expert | Expert proof |
|---|---|---|---|---|---|---|
| Tilt | 3 mazes / 4 mazes pits 3–4 / 4 mazes pits 4 ice 5 | 193 / 144 / 141 / 121 (Normal is I8) | as today | 5 mazes (15 / 17 / 19 / 19 / 21), pits 4, ice 5, par 115 % | 5 mazes, pits 6, ice 7, two-marble mazes 3, par 105 % | the tilt deal at 200 under the limits (`tilt-deal.ts`) |
| Gemstone | colours 5 / 6 / 7, ice 5 / 14 / 18, hint 3 s / 8 s / none | 197 / 158 / 146 / 137 | as today | 7 colours, 18 ice, no hint, goals 30 … 90 | 7 colours, 24 ice, no hint, goals 36 … 108, 7 treasures | witnesses at 200 on every dealt seed under the limits |
| Coral Pop | colours 3 / 5 / 6, reef 75 / 110 / 110 | 195 / 176 / 174 / 159 | as today | 6 colours, reef 120, descent every 5 shots, trail 0 | 7 colours, reef 135, descent every 4, trail 0, 75 s | the bubble bot under the limits at 200 on every dealt seed |
| Rainbow Bridge | ink 150 / 110 / 100 %, birds 25 % / +2 / +3 | 197 / 190 / 183 / 166 | as today | ink 95 %, +4 birds, live from level 6, margin 0 %, pot 42 px | ink 85 %, +6 birds swaying, live from 4, pot 36 px, speed full with 90 s left | each level's deal at 200 under the limits |
| Ball Tracker | 16 / 42 / 42 marbles, cup moves 0 / 8 / 12 | 200 / 195 / 177 / 151 | as today | 48 marbles every 60 ticks, 12 cup moves, 2 boosters | 54 marbles every 54 ticks, 16 cup moves, 1 booster, 7 gold | each level's proved list under the limits |
| Home Run | pitch flights 42–74 / 28–59 / 27–55 ticks, zone ±7 / ±4 / ±4 | 200 / 200 / 172 / 149 | as today | flights 26–50, 10 balls, zone ±3 / ±2, movement 170 %, catch 125 % | flights 24–46, 11 balls, zone ±2 / ±1, movement 200 %, catch 135 % | the deal's oracle at 200 under the limits (`homerun-innings-deal.ts`) |
| Top Bins | keeper 14 / 6 / 5 ticks, wind 1 / 6 / 7, hoop 85 / 60 / 50 % | 190 / 197 / 168 / 128 | as today | keeper 5 / 140 %, wall 5, wind 8, hoop 50 %, 6 jumps | keeper 4 / 150 %, wall 5–6, wind 10, hoop 40 %, every wall jumps, Goals full 1,300 | the deal's oracle at 200 under the limits (`freekick-layered-deal.ts --rev=6`) |
| Apex | gravel keep 80 / 60 / 50 %, aids 2 / 1 / 0 | 200 / 187 / 172 / 157 | as today | keep 50 %, no aids, tight hairpins on every circuit, pace spread 250 | keep 40 %, no aids, tight hairpins, 3 laps in 99 s, wall 96,000 | the level's deal at 200 under the limits (`racing-deal.ts --rev=4 --level`) |
| Crazy Golf | sails 128 / 256 / 512, slopes 1 / 1.4 / 1.8×, preview full / 35 / 20 % | 192 / 192 / 163 / 146 | as today | limit par + 2, sails 512, slopes 1.8×, preview 20 % | limit par + 1, sails 640, slopes 2.2×, 6 holes, no preview | the hole bank proved at the level under the limits |
| Cue Ball | preview long / short / ghost, foul −5 / −10 / −15, black at 5 / 7 / 7 | 177 / 164 / 158 / 139 | as today | ghost-ball preview only, foul −15, 75 s | no preview, foul −20, 8 of your balls, 60 s | the bank re-proved at the level under the limits (`pool-bank.ts`) |
| Curl Champ | reds 2 / 4 / 5, aids whole path / zone + third / none | 196 / 188 / 183 / 146 | as today | 5 reds 25–75 cm, no aim line, zone kept | 6 reds 15–60 cm, no aids, Stones full at 110 | the level bank's witnesses at 200 under the limits |
| Free Cell | 32 / 52 / 52 cards, cells 5 / 4 / 3, undos free / unlimited / 3 | 193 / 184 / 156 / 146 | as today | 52 cards, 3 cells, unlimited undo, par 0 at 1.25× | 52 cards, 2 cells, 3 undos, par 0 at 1.2×, 120 s | every bank deal solved by the solver with that many cells |
| Mahjong | 56 / 72 10 quads / 88 12 quads | 200 / 198 / 183 / 171 | as today | 88 tiles, 12 quads, Shuffle −10 | 104 tiles / 6 layers, 14 quads, no Shuffle, 120 s | the backwards build clears every deal |
| Summit | easy subset / no-wrap easier / no-wrap hardest | 183 / 181 / 174 / 171 | as today | the no-wrap bank's hardest 100 (par 18–23), no glow | a 32-card peak (today 28), no wrap, no glow, par ≥ 22, 60 s | the stock-par solver at the level |
| Five Hands | tables ×1.6 / ×1.4 hard / ×1.3 expert | 172 / 154 / 131 / 115 | as today | the expert table, ×1.3, 50 s | the expert table, ×1.2, 40 s | the exact-best search per deck (the standard's named exception stays) |
| Thirteen | passes 3 / 1 / 1, Kings 3–4 / 2–3 / 3, glow on / off / off | 196 / 180 / 159 / 140 | as today | 1 pass, exactly 3 Kings, no glow, filters 0–5 | 1 pass, 4 Kings, no glow, filters 0–6, 75 s | the solver's witness on every deal |

## Measurement and proof plan (every D session)

1. Change the level's numbers in the settings or the sim's level row (carried on the state and in the checksum; Normal carries nothing). A new mechanic (Iron Wall's lane, Wavefront's columns, Tempo's lane, Blockzone's garbage) goes behind the same row.
2. Re-run the game's tuning tool at every level under the human limits (`level-tune.ts --human-limits`, or the family tool) and tune to the guide; record the table in the game's doc page.
3. Rebuild and re-prove the level's bank or deal; drop any seed without a witness at 200 under the limits.
4. Extend the game's `<game>-levels-check` with the step (the numbers hold at the level, never at Normal, the proof holds); run it ten times (`repeat-check.ts`).
5. Normal's intro demo is unchanged; level intros show the still with the level line (`levelAbout`).
