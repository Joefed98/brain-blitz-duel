# Code audit 5: scoring and fairness (7 Nov 2026)

Read-only audit of `main` at 11d81047. **No code, stamp, bank or fixture was changed.** It covers the 92 active games
(`ACTIVE_PUZZLE_TYPES` in `src/lib/duel/registry.ts:360`), each on the stamp new rooms deal today, against five
questions:

1. **Same scoring everywhere:** practice, rooms, the Daily, challenges and async runs use the same code and give the
   same score for the same run.
2. **Partial credit:** a partly done, timed-out or abandoned-but-played run scores in proportion to what was done.
3. **Correct, monotonic, 200:**
   - a correct finish scores well;
   - a better run never scores lower;
   - 200 is reachable;
   - the breakdown adds up to the total;
   - the bands spread from weak to flawless.
4. **Determinism:** the same seed and inputs give the same score on the phone and the server.
5. **Fair deals:**
   - every dealt seed is solvable and can reach 200;
   - no deal is impossible or trivially easy;
   - time limits are consistent.

It builds on `docs/scoring-standard.md`, `docs/scoring-200.md`, `docs/arcade-standard/` and the November tuning notes
(`docs/puzzle-batch-nov-2026.md`, `docs/puzzle-polish-nov-2026.md`, `docs/cards-strategy-polish-nov-2026.md`,
`docs/retro-polish-nov-2026.md`). It also cross-references Code audit 1, `docs/audit-nov-2026/security.md`, for the
trust findings.

**How it was done:**

- Read the graders and sims cited below.
- Ran the existing non-browser checks (listed at the end, with results).
- Ran the band tools at small seed counts:
  - `scripts/standard-bands.ts` on 12 seeds;
  - `scripts/puzzle-polish-bands.ts --seeds=30`;
  - `scripts/depth-topup-bands.ts --fresh=20`;
  - `scripts/arcade-skill-bands.ts <game> --rev=now --seeds=12 --levels=all`;
  - the cards and sports band scripts on 8–20 seeds.
- Wrote a few throwaway probes. They were not committed. They:
  - graded each prefix of a near-perfect kit's moves as a buzzer draft;
  - replayed the stored optimal solution partway;
  - ran scripted lazy players (fire-spam, blind hops, random swaps);
  - replayed 204 bot logs under both Bun (JavaScriptCore, as on iPhone Safari) and Node (V8);
  - scanned each sim's state for non-integers.
- **No browser or phone tests.** Joe does device testing.

**Numbers are small samples.**
- Medians on 12 seeds move by 5–15 points between runs, so a single "good above great" is not proof of an inversion.
- Each finding below was traced to the cited lines. Where a number rests on bots alone, it says so.
- The machine was heavily loaded (four agents at once), so wall-clock times in the check list are inflated.

**Band notation:**
- Puzzles: nothing / spam / average / good / great / near-perfect.
- Arcade and the puzzles measured with `puzzle-polish-bands`: weak / average / good / great / near / elite / flawless.

**Effort:** **S** is under a day, **M** is one to three days, **L** is a project.

**Stamp:** "new stamp" means the fix changes a game's rules or scoring, so it needs a new revision with older rounds
replaying exactly as before (CLAUDE.md rule 2).

## Summary

**Point 1 holds for all 92 games.** There is one grader:
- `gradeAnswer` (`src/lib/duel/generate.server.ts:330`) serves practice and the offline queue
  (`practice.functions.ts:162`, `:283`).
- Rooms go through `gradeRoomAnswer` (`duel.functions.ts:888`, `roomGrade.server.ts:37`).
- The Daily and challenges go through `gradeAsyncAnswer` (`asyncRoom.server.ts:570`), which calls `gradeRoomAnswer`.
- Challenge copies of room results are stored, never regraded.

The checks that compare the paths pass:
- room-practice-grade-check: 26,248 on-time answers;
- daily-check: 3,457 async grades;
- challenge-check: 2,467 grades.

**Point 4 holds as far as can be shown without a phone:**
- No sim or grader uses `Math.random`, `Date`, `performance.now`, `Intl` or locale maths.
- 204 bot logs over all 22 Retro/Action/Strategy arcade games replayed to identical scores and final-state hashes on
  JavaScriptCore and V8.
- No sim state held a non-integer number.
- One latent risk: Rainbow Bridge's sim uses `Math.hypot`, `Math.cos` and `Math.sin` (issue 21).

**Points 2, 3 and 5 are where the problems are:**
- seven played-run cliffs that score 0 or 1 for real progress (issues 2–4, 6, 8, 9, 12);
- three no-skill strategies that match or beat real players (issues 1, 7, 17);
- one true inversion (High Rise, issue 5);
- four games where 200 or the band spread is off (issues 10, 11, 14, 15).

## 1. The 92 games

How to read the table:
- ✅ means it passes.
- ⚠️ *n* means an issue, numbered in section 2.
- "nv" means not verified.

Point 1 is ✅ for every game (same grader, above). The only path difference is the time-claim bound (issue 16e). It
is shown once here rather than repeated in every row.

The point 3 bands come from the tools above, so read them as small samples:
- puzzles: average / good / near;
- arcade: weak / good / flawless.

### Word (9)

| Game | Stamp | 2 Partial | 3 Correct, monotonic, 200, bands | 4 Determinism | 5 Deals |
|---|---|---|---|---|---|
| Nucleus | wordsmithRev 4 | ✅ (38/87/118/132 at 25/45/75/90 %) | ✅ (70/112/170, elite 184) | ✅ | ✅ |
| Interlock | tileGridRev 3 | ⚠️ 10 | ⚠️ 10 (200 not reachable on the dealt solution) | ✅ | ✅ |
| Slider | wordSlideRev 4 | ⚠️ 10 | ⚠️ 14 (190/196/200, compressed) | ✅ | ✅ |
| Forage | wordHuntRev 4 | ✅ | ✅ (64/103/164, elite 185) | ✅ | ⚠️ 16 (misses phone-reported) |
| Lookout | wordSearchRev 4 | ✅ | ⚠️ 17 (random drags earn the bonus) | ✅ | ✅ |
| Roundabout | wheelRev 4 | ✅ | ✅ (55/110/174) | ✅ | ✅ |
| Strikeout | strikeoutRev 7 | ⚠️ 14 (130 cap reached at 75 %) | ✅ (97/182/192) | ✅ | ✅ |
| Cryptogrid | codewordRev 5 | ✅ | ✅ (111/187/200) | ✅ | ✅ |
| Swapword | swapwordRev 7 | ✅ | ✅ (97/199/200) | ✅ | ✅ |

### Number (9)

| Game | Stamp | 2 Partial | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Counterweight | balanceRev 3, depthRev 2 | ⚠️ 14 (flat inside a step) | ✅ (94/167/200) | ✅ | ⚠️ 16 (hang counts phone-reported) |
| Exact | depthRev 3 | ⚠️ 4 (unfinished often 0) | ✅ (170/197/200) | ✅ | ✅ (min tiles = help's 5 on 40/40) |
| Operator | gapsRev 1, depthRev 2 | ✅ | ⚠️ 14 (weak ≈ average; great = near = 200) | ✅ | ⚠️ 16 (tries phone-reported) |
| Tenfall | tenRev 5 | ✅ | ⚠️ 14 (great 180 ≈ near 181) | ✅ | ✅ |
| Integer Pyramid | depthRev 2 | ✅ | ✅ (56/92/186) | ✅ | ✅ |
| Brimful | measureRev 3, depthRev 3 | ⚠️ 14 (flat inside a step) | ✅ (32/95/199) | ✅ | ✅ |
| Checkout | checkoutRev 2, depthRev 3 | ⚠️ 14 | ✅ (52/106/195) | ✅ | ✅ |
| Ballpark | numlineRev 2, depthRev 2 | ✅ | ✅ (93/166/192) | ✅ | ✅ |
| Kakuro | kakuroRev 1 | ✅ (guessing nets 0) | ✅ (86/179/198) | ✅ | ✅ unique solution proved; 7/240 deals difficulty grade 0 (nv whether trivial) |

### Speed (6)

| Game | Stamp | 2 Partial | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Flash | tapRev 6 | ⚠️ 9 | ⚠️ 15 (200 needs about a 120 ms average) | ✅ (tap times trusted, ruling D) | ⚠️ 16 (schedule public) |
| Ascend | tapRev 6 | ✅ | ✅ (79/165/200) | ✅ (ruling D) | ✅ |
| Bang On | tapRev 6 | ⚠️ 9 | ⚠️ 15 | ✅ (ruling D) | ⚠️ 16 (schedule public) |
| Don't Break the Chain | chainDepthRev 3 | ✅ (links before the break) | ✅ (13/60/200, cliff-shaped but monotonic) | ✅ | ✅ |
| Bonk | whackRev 4 | ✅ | ⚠️ 15 (near 158); nv (the band kit desyncs, issue 23) | ✅ | ✅ |
| Pull! | clayRev 9 | ✅ | ✅ (70/98/169) | ✅ | ✅ |

### Attention (7)

| Game | Stamp | 2 Partial | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Mixed Signals | clashRev 10 | ✅ | ✅ (57/113/196) | ✅ | ✅ |
| Eagle Eye | scanRev 4 | ✅ | ✅ (68/107/187) | ✅ | ⚠️ 16 (clean 40 rests on the timeline) |
| Double Take | spotRev 3 | ✅ | ✅ (79/164/200) | ✅ | ✅ |
| Tally | countRev 6 | ✅ | ✅ (63/98/200) | ✅ | ✅ |
| Labyrinth | mazeRev 5 | ✅ | ⚠️ 17 (a blind depth-first search finishes, spam p90 114) | ✅ | ✅ |
| Bomb Defusal | bombVersion 3, depthRev 2 | ✅ (correct prefix; a wrong first cut is 0, by design) | ✅ (82/187/200) | ✅ | ✅ (300 cards, one sequence each) |
| Matchmaker | pairRev 3 | ✅ | ✅ (72/185/198) | ✅ | ⚠️ 16 (whole layout sent to the phone) |

### Pattern (10)

| Game | Stamp | 2 Partial | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Gridlock | unblockRev 2 | ⚠️ 3 | ✅ (25/189/200) | ✅ | ✅ |
| Tessellate | blockRev 3 | ✅ | ✅ (60/167/200) | ✅ | nv (bank: puzzle-bank-check not run) |
| Pipeline | pipesRev 3 | ⚠️ 18 | ✅; nv (band kit sends no tap log, issue 23) | ✅ | ✅ |
| Chroma Lines | flowRev 2 | ✅ | ✅ (79/168/191) | ✅ | nv (bank) |
| Skid | slideRev 4 | ✅ | ✅ (63/168/197, flawless 200) | ✅ | nv (bank) |
| Heave | pushRev 3 | ✅ | ✅ (50/182/197) | ✅ | ✅ |
| Lightbender | laserRev 3 | ✅ | ✅ (20/164/191) | ✅ | ✅ |
| Topsy-Turvy | gravityRev 7 | ✅ | ✅ (43/151/197, flawless 200) | ✅ | nv (bank) |
| Gradient | tilesRev 6 | ✅ | ⚠️ 1 (random swaps 182 against good 168) | ✅ | ⚠️ 1 (every deal is finished by random swaps) |
| Turntable | ringsRev 3 | ⚠️ 3 (dips on the optimal line) | ✅ (31/198/200) | ✅ | ✅ |

### Logic (14)

| Game | Stamp | 2 Partial | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Blackout | depthRev 2 | ⚠️ 3 (dips on the optimal line) | ✅ (41/84/194) | ✅ | ✅ |
| Box Six | depthRev 3 | ✅ | ✅ (66/114/200) | ✅ | ✅ |
| Hanoi | depthRev 2 | ⚠️ 3 (optimal 25 % scores 0) | ✅ (41/175/200) | ✅ | ✅ |
| Polypotions | depthRev 2 | ⚠️ 3 | ✅ (30/177/199) | ✅ | nv (bank) |
| Safe Cracker | depthRev 3 | ✅ | ✅ (84/186/200) | ✅ | ✅ |
| Mosaic | depthRev 2 | ✅ | ✅ (76/165/200) | ✅ | ✅ |
| Colour Flood | depthRev 4 | ✅ | ✅ (100/192/200); 1 of 24 blind colour cycles finishes | ✅ | ✅ (flood-cycle-check) |
| Tents and Trees | depthRev 2 | ✅ | ✅ (63/167/200) | ✅ | ✅ |
| Shikaku | depthRev 3 | ✅ | ✅ (60/159/200) | ✅ | ✅ |
| Lamplighter | depthRev 2 | ✅ | ✅ (57/119/200) | ✅ | nv (bank) |
| Trail | depthRev 2 | nv (code not read) | ✅ (72/161/200) | ✅ | nv |
| Loopline | fencesRev 1 | ✅ (right − wrong items) | ✅ (93/174/200) | ✅ | ✅ (fences-check) |
| Regions | fillominoRev 1 | ✅ | ✅ (103/179/200) | ✅ | ✅ (fillomino-check) |
| Island Link | bridgesRev 1 | ✅ | ✅ (44/186/200) | ✅ | ✅ (bridges-check) |

### Arcade: Retro (10)

| Game | Stamp | 2 Partial | 3 (weak / good / flawless) | 4 | 5 |
|---|---|---|---|---|---|
| Hover | hoverRev 10 | ⚠️ 13 (a crash ends the run; 6/12 weak runs ≤ 5) | ✅ (8/41/199; average 51 > good 41 is 12-seed noise) | ✅ | ✅ (200 proved on 260 seeds) |
| Breaker | brkRev 11 | ✅ | ✅ (42/112/174) | ✅ | ⚠️ 20 |
| Pinball | pinRev 6 | ✅ | ✅ (51/86/188) | ✅ | ⚠️ 20 |
| Rally | rallyRev 12 | ✅ | ⚠️ 11 (weak 73, top compressed 174–184) | ✅ | ⚠️ 20 |
| Tempo | beatRev 11 | ⚠️ 12 (misses can floor the core) | ✅ (46/133/198) | ✅ | ⚠️ 20 |
| Meteor | snakeRev 12 | ⚠️ 13 (death ends the run) | ⚠️ 14 (165/171/181/180 at the top) | ✅ | ⚠️ 20 |
| Spacewalk | crossRev 11 | ⚠️ 2 | ✅ (60/130/200) | ✅ | ✅ (oracle) |
| Wavefront | wavRev 12 | ⚠️ 2 | ⚠️ 11 (weak 144; 52 points weak → flawless) | ✅ | ✅ |
| Fission | burstRev 10 | ⚠️ 2 | ⚠️ 7 (fire-spam 98 ≈ average 96) | ✅ | ⚠️ 20, 23 |
| Blockzone | blockfallRev 2 | ✅ (a top-out keeps lines and pieces) | ✅ (59/116/200) | ✅ | ✅ (blockfallDealV2) |

### Arcade: Action (7)

| Game | Stamp | 2 Partial | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Slice | sliceRev 12 | ⚠️ 8 (0 below 480 ‰ of the food) | ✅ (33/147/200) | ✅ | ✅ (1,260 seeds at 200) |
| Roofbound | flipRev 12 | ✅ | ✅ (49/130/200) | ✅ | ✅ (FLIP_DEAL) |
| Grappler | swingRev 17 | ✅ (no game over) | ✅ (63/123/200) | ✅ | ✅ (swingSlideDeal, 120) |
| Moon Climb | ricoRev 3 | ✅ | ✅ (57/132/200) | ✅ | ✅ (witness per tower) |
| Iron Wall | bastionRev 3 | ✅ | ✅ (37/144/200) | ✅ | ✅ (260 seeds) |
| High Rise | skylineRev 9 | ✅ | ⚠️ 5 (more floors past 61 can lower the score) | ✅ | ⚠️ 20 |
| Orbit | orbitRev 14 | ⚠️ 13 (fuel empty or a crash ends the run) | ✅ (20/88/195) | ✅ | ✅ (fuel bank) |

### Arcade: Strategy (5)

| Game | Stamp | 2 Partial | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Tilt | tiltRev 12 | ✅ | ✅ (67/146/191) | ✅ | ⚠️ 19 (two hard seeds) |
| Gemstone | matchupRev 12 | ✅ | ✅ (71/114/176) | ✅ | ⚠️ 20 |
| Coral Pop | bubbleRev 11 | ✅ | ⚠️ 11 (39/46/74 bunched at the bottom) | ✅ | ⚠️ 20 |
| Rainbow Bridge | inkRev 14 | ✅ | ✅ (54/120/200) | ⚠️ 21 | ✅ (inkBigDeal, 100) |
| Ball Tracker | btRev 8 | ✅ | ✅ (55/142/200) | ✅ | ✅ (BT_V8_DEAL, 299) |

### Arcade: Sports (9)

| Game | Stamp | 2 Partial | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Home Run | homerunRev 4 | ✅ (a caught ball is 0, by design) | ⚠️ 14 (distance full at Great; near 180 vs elite 182) | ✅ | ✅ (deal V4, 300) |
| Top Bins | freekickRev 4 | ⚠️ 12 (weak p10 1) | ⚠️ 14 (goals full at about 6 of 10) | ✅ | ✅ (deal V4, 300) |
| Apex | racingRev 3 | ⚠️ 13 (0 pace below 152 km/h) | ✅ (34.5/144/200) | ✅ | ✅ (deal V3, 300) |
| Crazy Golf | golfRev 2 | ✅ | ⚠️ 11 (weak 129) | ✅ | ⚠️ 19 (60 courses) |
| Cue Ball | poolRev 4 | ⚠️ 12 (fouls −10; weak 18, p10 1) | ⚠️ 14 (core full at 5 of 7) | ✅ | ⚠️ 19, 23 |
| Curl Champ | curlRev 4 | ✅ | ✅ (doc: 53/125/200) | ✅ | ⚠️ 19 (66 sheets) |
| Ringer | alleyRollRev 2 | ✅ | ✅ (56/134/200) | ✅ | ⚠️ 19 (the same lane in every room) |
| Swish | binRev 9 | ✅ | ⚠️ 11 (67/78/94 bunched at the bottom) | ✅ | ✅ (200 on every seed) |
| Flightpath | bullRev 9 | ✅ | ✅ (63/111/200) | ✅ | ✅ (200 on every seed) |

### Arcade: Cards & Board (6)

| Game | Stamp | 2 Partial | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Minefield | minesRev 1 | ✅ | ⚠️ 11 (great = near = flawless = 200); ⚠️ 23 (help text) | ✅ | ✅ (solver-proved per seed) |
| Mahjong Solitaire | mahjongRev 2 | ⚠️ 12 (−5 a shuffle; random 1) | ✅ (103/173/200); ⚠️ 23 (help text) | ✅ | ✅ |
| Free Cell | freecellRev 4 | ⚠️ 6 (unfinished capped at 60) | ✅ (49/122/200) | ⚠️ 22 | ✅ (300-deal V4 bank) |
| Summit | tripeaksRev 2 | ⚠️ 6 (80 clear-only) | ✅ on 100 seeds (doc: great 138 < good 157 on 20 is noise) | ⚠️ 22 | ✅ (300 deals and pars) |
| Five Hands | fiveHandsRev 3 | ✅ | ⚠️ 15 (random 63; good = great = 140) | ✅ | ✅ (the named exception: 200 on 165/200 seeds) |
| Thirteen | pyramidRev 1 | ⚠️ 6 (60 clear-only) | ✅ (84/186/199) | ⚠️ 22 | ✅ (460 seeds at 200) |

## 2. Issues ranked by how much they would hurt ratings

The ranking considers how often the case comes up in rooms, how wrong the score is, and whether a player could
exploit it on purpose.

| # | Issue | Games | Fix | Stamp | Effort |
|---|---|---|---|---|---|
| 1 | A no-skill strategy beats real players | Gradient | Swap limit (e.g. twice par), or a waste factor past k × par | tilesRev 7 | M |
| 2 | The life that ends the run is also charged, wiping progress to 1 | Spacewalk, Wavefront, Fission | Don't charge the last life, or cap penalties at about half the core | crossRev 12, wavRev 13, burstRev 11 | M |
| 3 | The standard's partial credit is worse than the stamp before, and dips on the optimal line | Hanoi, Polypotions, Gridlock, Turntable, Blackout | Feed the solver-distance share (`puzzleProgress.ts`) into `shareCredit` | one per game | M |
| 4 | A played, unfinished run often scores 0 | Exact | Credit from the start's closeness, or a slower curve, or a small per-step floor | depthRev 4 | M |
| 5 | Inversion: more floors can lower the score | High Rise | `stdLine(30, min(perfects, 61), 61)`, or count the first 61 drops | skylineRev 10 | S |
| 6 | Points locked behind a clear split scores in two | Thirteen, Summit, Free Cell | Move about half the speed part onto cards removed; raise Free Cell's unfinished cap | pyramidRev 2, tripeaksRev 3, freecellRev 5 | M each |
| 7 | Fire-spam matches an average player | Fission | A cost for missed beams, or a cooldown | burstRev 11 (with 2) | M–L |
| 8 | Dead zone below a threshold | Slice | A straight line from 0 for core and combo | sliceRev 13 | M |
| 9 | Half a run scores almost nothing | Flash, Bang On | Score each flash or watch separately and average the points | tapRev 7 | S–M |
| 10 | 200 out of reach, and progress can lower the score | Interlock, Slider | Interlock: cap big words at the deal's own maximum, credit tiles matching the solution. Slider: credit rows matching the solution | tileGridRev 4, wordSlideRev 5 | S–M |
| 11 | Bands off target | Crazy Golf, Wavefront, Rally, Coral Pop, Swish, Minefield | Retune; re-measure at 60 seeds first | one per game | M each |
| 12 | Penalties push played runs to the floor of 1 | Cue Ball, Top Bins, Mahjong, Tempo | Smaller or capped penalties; some credit for near misses or hits | one per game | S–M |
| 13 | Runs that end early are scored harshly | Hover, Meteor, Orbit, Apex | Respawns, or a softer pace line (Apex) | one per game | L (M for Apex) |
| 14 | A part maxes out too early, so later play earns nothing | Top Bins, Home Run, Cue Ball, Meteor, Spacewalk, Strikeout, Counterweight, Brimful, Checkout, Operator, Tenfall, Slider | Raise the full figure, or credit inside the current step | one per game | M |
| 15 | Compressed top, or 200 for the elite only | Five Hands, Flash, Bang On, Bonk | Five Hands: a straight line with no ×1.4 cap. Speed games: Joe's call | fiveHandsRev 4 | M |
| 16 | Trust gaps (see Code audit 1) | Matchmaker, Flash, Bang On, Counterweight, Operator, Forage, Eagle Eye and the timeline bonuses | 16a–16e below | some | S–L |
| 17 | No-skill play that pays something | Lookout, Labyrinth, Colour Flood | Lookout: take the penalty off after adding the bonus. The others are arguably fair | wordSearchRev 5 | S |
| 18 | Progress not counted | Pipeline | Count tiles in their solved orientation, not only those connected to the source | pipesRev 4 | S |
| 19 | Deals | Tilt, Cue Ball, Crazy Golf, Curl Champ, Ringer | Drop Tilt's two hard seeds; grow the small banks | none (deal lists only) | S / L |
| 20 | 200 on every dealt seed not proved | Breaker, Pinball, Rally, Tempo, Meteor, High Rise, Gemstone, Coral Pop, Fission | An oracle sweep over the tuning and fresh seeds | none | M |
| 21 | Floating-point maths in a sim | Rainbow Bridge | `isqrt` and integer trig in the sim and the generator | inkRev 15 | M |
| 22 | `stdSpeed` floors a float share and can pay 1 point less than exact maths | Thirteen, Summit, Free Cell (max 50 or 90) | Integer `floor(max × (v − z) ÷ (f − z))` | one per game | S |
| 23 | Text and hygiene | various | 23a–23i below | none | S |

### Notes on each issue

**1. Gradient.**
- tilesRev 4+ locks a tile once it is home, so random swaps always finish, in 15–50 s, and score 150 plus full speed:
  a median of 182 on the current board, against good 168 and average 42 (standard-pattern-check's players).
- In a room this is the one case where pressing buttons blindly beats trying.
- It is already listed as a known exception for Joe in `docs/scoring-standard.md:339`; this audit raises its priority.

**2. The last life is charged twice.**
- Spacewalk: `crossFlowScore` charges −15 a hit (`src/lib/arcade/cross.ts:1653`). Blind forward hops reached a core of
  35–43, and three hits (−45) took it to 1.
- Wavefront: the life penalty is at `wavefront.ts:2443-2455`. A slow sweep shot 30 ships (core 15) against −15 and
  scored 1.
- Fission: lives cost −5 each (`burstStdParts`, `burst.ts:1688`); weak runs score 1–4.
- In each game, losing the last life already ends the run, so charging it as a penalty as well erases real progress.

**3. Partial credit on five Logic and Pattern games.**
- The standard replaced the older stamp's solver-distance progress with rough counts:
  - `standard/logic.server.ts:117` (Hanoi), `:141` (Polypotions), `:76` (Blackout);
  - `standard/pattern.server.ts:146` (Gridlock), `:272` (Turntable).
- Playing the stored optimal solution partway gives these scores at 25 / 50 / 75 %:

  | Game | Today | Before the standard |
  |---|---|---|
  | Hanoi | 0 / 24–40 / 24–60 | 27 / 59 / 86 |
  | Polypotions | 0–15 / 0–30 / 30–60 | 29 / 58 / 86 |
  | Gridlock | 0–51 / 0–69 / 60–69 | 31 / 60 / 88 |
  | Turntable | 0–40 / 0–40 / 22–80 | 32 / 68 / 96 |
  | Blackout | 0–32 / 24–75 / 56–95 | 33 / 61 / 92 |

- Following the optimal line can lose points: Blackout on seed 33 goes 32 → 24, Turntable on seed 33 goes 40 → 10.

**4. Exact.**
- Unfinished credit is closeness only: 129 × 0.93^distance (`standard/number.ts:53-58`, `standard/number.server.ts:116`).
  That gives about 7 points 40 away and nothing from about 70 away.
- Of 60 average-kit runs, 22 did not finish; of those, 9 scored 0 and 4 scored 1, after 4–10 steps.
- The code comment shows this is intended, but it fails point 2.

**5. High Rise.**
- The perfects part is `stdLine(30, perfects, max(placed, 61))` (`src/lib/arcade/skyline.ts:897`), while the core caps
  at 61 floors.
- Past 61, every drop that isn't perfect lowers the score. Elite runs of 117 and 123 floors scored 176 and 162,
  against 173 for a 60-floor run.
- This rewards stalling: the only true inversion found.

**6. Points locked behind a clear.** A missed clear loses a large fixed share of the 200:
- Thirteen: 60 for clear and speed. Elite bots clear 12 of 20 seeds, so elite p10 is 108 against a median of 198.
- Summit: 80 for clear, par and speed.
- Free Cell: 140 for par and speed. Its core tops out at 25 of 40 cards home, so 39 home scores the same 60 as 25.

**7. Fission fire-spam.** Standing still and firing every 5 ticks scored a median of 98 (35–135) on 20 seeds, against
an average player's 96.

**8. Slice.** The core starts at 480 ‰ of the food and the combo at 40 foods (`slice.ts:1893-1897`). A weak run that
sliced 50 of 128 objects scored 1.

**9. Flash and Bang On.**
- Misses are averaged in at 1,200 ms (Flash) or 500 ms (Bang On) before the curve, and the partial floor is 2 points a
  hit (`src/lib/duel/depth/flash.ts`, `depth/bangOn.ts`).
- Flash, 7 flashes at 160 ms: all 7 hit scores 174, 5 hit 77, 4 hit 19.
- Bang On: 5 of 10 perfect stops scores about 10.

**10. Interlock and Slider.**
- Interlock's big-word bonus is capped at 30 (`standard/word.ts:19-20`), but the dealt solution's words give 25–27 on
  40/40 seeds, so the solution itself scores 195–197.
- Interlock: only tiles inside a finished word count, so a correct tile that runs into a non-word drops the score by up
  to 50.
- Slider: a par line's middle moves break rows (seed 7217 goes 78 → 0 → 0 → 0 before the finish).
- Slider matters less in practice, since nearly every player finishes it.

**11. Bands off target.**
- Crazy Golf: weak 129 against a 30–60 target. Closeness credit is `MG_CLOSE_PTS` 20 (`minigolf.ts:94`), plus 24 for
  each hole holed.
- Wavefront: weak 144, only 52 points from weak to flawless. Ships fire on their own, so one drag then idle scores
  15–37.
- Rally: weak 73, top compressed.
- Coral Pop and Swish: the bottom three levels are bunched.
- Minefield: the top three levels all score 200.
- All of these rest on bots; re-measure at 60 seeds before acting.

**12. Penalties to the floor.**
- Cue Ball: −10 a foul, a miss included (`pool.ts:206`, `:619`).
- Top Bins: nothing for a near miss.
- Mahjong: −5 a shuffle.
- Tempo: a miss costs −2 against a Perfect's 4 (`beat.ts:1283-1285`). A third of the notes hit perfectly gives a core of
  0, and every note hit "OK" gives 32 of 130. The bots were not hurt by it (weak median 46).

**13. Early endings.**
- Hover: weak median 8.
- Orbit: some runs end at about 4 s with 3 points.
- Meteor: weak min 4.
- Apex: an average under 152 km/h earns 0 of the 160 pace points (`racing.ts:627`), so a careful slow driver can only
  earn the 40 for clean sectors.

**14. Parts that max out too early.**
- Arcade cores:
  - Top Bins full at 750 units, about 6 goals (`freekick.ts:260`);
  - Home Run at 300 ft a pitch (`homerun.ts:845`);
  - Cue Ball at 5 of 7 balls (`POOL_CORE_FULL_V4`);
  - Meteor at 28 stars;
  - Spacewalk at 76 units against a near-perfect median of 96.
- Puzzles:
  - Strikeout reaches its 130 unfinished cap at 75 % of the steps;
  - Counterweight, Brimful and Checkout give no credit inside the current step (97 → 97 from 75 % to 90 %);
  - Operator's weak (64) and average (68) barely differ;
  - Tenfall's great and near tie (180 / 181);
  - Slider's average is already 190.

**15. Compressed top.**
- Five Hands: the ×1.4 multiplier and the 200 cap (`fhScoreV3`, `cards/fiveHands.ts:113`) tie everything at 143+ hand
  points. Random play scores 63.
- The speed and engine games reach 200 only at elite level. Near-perfect medians: Flash 163, Bang On 160, Bonk 158,
  Pull! 169. Flash needs about a 120 ms average, near the 100 ms floor for a valid tap.

**16. Trust gaps.** These overlap Code audit 1 (`security.md`, around line 218).
- a. **Matchmaker** sends its whole card layout to the phone (`src/lib/duel/secrets.ts:49`, `pairmatch: []`), so a
  modified phone defeats the memory game. Its gold-match time is also the phone's word (`attention.server.ts:208`).
  Capping that time by the draft timeline is S; server-side flips are L.
- b. **Flash and Bang On** schedules are public (`secrets.ts:25,29`), so a scripted client can score 200. This is
  ruling D, already accepted; server-timed taps are L.
- c. **Counterweight and Operator** read their hang and try counts from the `#` suffix the phone sends
  (`standard/number.server.ts:124, 137, 149, 164`; noted at `grade.ts:402`). A modified phone could claim Operator's
  clean 10 and Counterweight's par 15, and dodge both limits. Not in `docs/security-audit-oct-2026.md`. Effort M.
- d. **Timeline bonuses.** The clean, first-time and early bonuses rest on the draft timeline the phone sends: up to 40
  on Eagle Eye, 10 on most other games. Forage's misses are phone-reported (already documented).
- e. **Time claims.** Rooms and async runs bound the phone's time claim to the server's receipt plus 1.5 s
  (`grade.ts:271-288`, `roomGrade.server.ts:44-46`). Practice clamps it only to the round's length (`grade.ts:377`).
  This is the only difference between the paths. Same honest run, same score, unless the network lag exceeds 1.5 s.
  It touches practice bests only, never room ratings.
  - Async rounds start their clock when the server stores READY, before the puzzle reaches the phone. The phone's own
    measurement stands within the 1.5 s tolerance, so a slow download costs nothing below that.

**17. No-skill play that pays something.**
- Lookout: credit is `max(0, words − penalty) + bonus` (`standard/word.server.ts:109, 116`). Random drags found the
  bonus word in 3 of 24 runs.
- Labyrinth: a blind depth-first search finishes (spam p90 114).
- Colour Flood: 1 of 24 blind colour cycles finishes within par + 6.
- Smaller, and arguably fair, cases: Checkout's greedy darts (24–51), Strikeout in letter-frequency order (up to 64),
  Operator's random tries (p90 33).

**18. Pipeline.** Optimal taps in index order score 0 at 50 % on seeds 11, 33 and 44, because unconnected tiles that
are already correct count for nothing.

**19. Deals.**
- Tilt: two `TILT_DEAL_V12` seeds (291005263 and 1065007826) kept weak-to-great bots in maze 1 for 90 s (1–12 points),
  where other seeds gave 80–190 at the same levels. This may be partly a bot artifact.
- The small banks help memorisation:
  - Cue Ball: 60 layouts;
  - Crazy Golf: 60 courses;
  - Curl Champ: 66 sheets;
  - Ringer: one lane for every room.

**20. 200 not proved on every seed.** For these nine any-seed games, arcade-standard-check proves 200 on one stored
perfect run each. Their flawless-bot medians are 174–188.

**21. Rainbow Bridge.**
- The sim uses `Math.hypot`, which ECMAScript leaves implementation-approximated:
  - in the physics (`inkBridge.ts:507, 661, 964, 1003, 1067, 1619, 1651, 3184, 3261`);
  - in level generation (`1266-1267, 2406, 2761-2766`).
- `Math.cos` and `Math.sin` choose the dealt levels (`anyPreAloneWins`, `1176-1177`).
- `Math.sqrt` is correctly rounded, so it is safe.
- Nothing diverged under JavaScriptCore and V8, so this is a latent risk on a future engine, not an observed bug.
- Every other float trig call in the 92 games is inside draw, camera or gesture code:
  - `engine.ts:459-470` (`dragLaunch`) and `alleyrollSwipe.ts:48` turn a gesture into integer inputs on the phone;
  - `isqrt` (`engine.ts:494`) corrects its float guess with integer steps.

**22. `stdSpeed`.** `stdSpeed` (`src/lib/arcade/arcadeStandard.ts:90-96`) floors `max × share` with `share` a float.
For example, max 50 with value 348 of 600 gives 28 where exact maths gives 29. It is deterministic on every engine,
since only basic IEEE operations are used, so it is a fairness rounding, not a desync.

**23. Text and hygiene (no stamp).**
- a. Minefield and Mahjong help say the clean bonus is "the same again for each safe square / pair, until you hit a
  mine / shuffle" (`minesweeper.ts:490`, `mahjong.ts:465`), but the code sets the whole bonus to 0 on the first hit or
  shuffle (`minesweeper.ts:503`, `mahjong.ts:472`). Fix the wording, or keep the bonus earned so far (that needs a
  stamp).
- b. `generatePool` deals `POOL_BANK_V3` under `poolRev: 4` (`src/lib/duel/sports.server.ts:50`). Harmless today
  because the arrays hold the same layouts, but it should name V4.
- c. Stale comments in `homerun.ts:843, 867` ("330 ft") against the constant 300.
- d. In `freekick.ts:268`, the core part's `of: 10` should read 750.
- e. arcade-self-replay-check has no entry for Fission's dealt burstRev 10. Append one at the end of the list.
- f. room-practice-grade-check compares only empty or junk answers for games added after 18 Oct
  (`scripts/room-practice-grade-check.ts:213`). The grader is shared, so this is a coverage gap, not a known bug. Add
  real runs per game.
- g. kakuro-check (400 ms) and fillomino-check (2 s) fail their wall-clock budgets under load; both pass run alone.
  Use a CPU-time budget.
- h. The band tool misleads for four games:
  - Pipeline's kit sends no tap log;
  - Topsy-Turvy and Gradient are dealt the older boards (`D5_REMODELLED`);
  - Bonk's kit desyncs on whackRev 4.
- i. `scripts/arcade-self-replay-check.ts:32, 34` imports `racingCheckpoint` twice.

## 3. Checks run (non-browser)

All passed except the two load flakes noted (`standard-shape-check` and `standard-timeline-check` were run twice, once
each by two agents, and passed both times):

| Check | Result |
|---|---|
| room-practice-grade-check | pass (26,248 on-time answers equal) |
| daily-check | pass (95 checks, 3,457 async grades equal practice) |
| challenge-check | pass (114 checks, 2,467 grades equal practice) |
| room-late-run-check | pass (4,044 checks) |
| standard-timeline-check | pass |
| no-side-effect-imports-check | pass |
| standard-word-check | pass |
| standard-number-check | pass |
| standard-attention-check | pass |
| standard-pattern-check | pass |
| standard-logic-check | pass |
| standard-shape-check | pass |
| standard-scoring-check | pass |
| standard-legacy-check | pass (5,400 regraded, 0 differ) |
| puzzle-polish-nov-check | pass (989) |
| puzzle-batch-nov-check | pass |
| puzzle-notes-check | pass |
| phone-notes-check | pass |
| depth-topup-check | pass |
| intro-score-text-check | pass |
| scoring-batch2-check | pass |
| tap-log-check | pass |
| careless-play-check | pass |
| tubes-safe-bomb-check | pass |
| bomb-v3-check | pass |
| flood-cycle-check | pass |
| tendrop-check | pass |
| codeword-check | pass |
| strikeout-check | pass |
| swapword-check | pass |
| letterwheel-check | pass |
| wordsearch-check | pass |
| number-batch-check | pass |
| kakuro-check | fail once (generation 684 ms over its 400 ms budget under load), pass run alone (232 ms) |
| fences-check | pass |
| bridges-check | pass |
| fillomino-check | fail once (2,085 ms over its 2 s budget under load), pass on rerun |
| arcade-standard-check | pass (6,074 checks, 40 rostered games) |
| arcade-self-replay-check @1/2 | pass (112 entries) |
| arcade-self-replay-check @2/2 | pass (110 entries) |
| blockzone-soft-check | pass |
| breaker-standard-check | pass |
| beat-standard-check | pass |
| burst-standard-check | pass |
| cross-rev11-check | pass |
| fission-carry-check | pass |
| hover-standard-check | pass |
| moon-blockzone-check | pass (quick depth) |
| pinball-90-check | pass |
| rally-standard-check | pass |
| snake-rev12-check | pass |
| wavefront-phone-check | pass |
| bastion-check | pass |
| flip-deal-check | pass |
| flip-rev11-check | pass |
| iron-wall-view-check | pass |
| orbit-fuel-check | pass |
| skyline-standard-check | pass |
| slice-food-check | pass |
| swing-slide-check | pass |
| balltrack-deal-check | pass |
| bubble-standard-check | pass |
| gemstone-rev12-check | pass |
| ink-v14-check | pass |
| tilt-rev11-check | pass |
| tilt-rev12-check | pass |
| cards-check | pass |
| cards-board-check | pass |
| cards-solitaire-check | pass |
| homerun-check | pass |
| freekick-check | pass (quick depth) |
| racing-check | pass (quick depth) |
| minigolf-check | pass |
| pool-check | pass |
| curling-check | pass |
| ringer-check | pass |
| alleyroll-check | pass |
| bintoss-standard-check | pass |
| bullseye-standard-check | pass |

**Not run:**
- every browser check;
- puzzle-bank-check (the banks for Chroma Lines, Tessellate, Polypotions, Topsy-Turvy, Lamplighter and Skid are marked
  nv above);
- full-depth runs of freekick-check, racing-check and moon-blockzone-check.

**Not verified:**
- human-level difficulty (bots and kits are proxies);
- a proof that every move improves the score (sampled only);
- Trail's grader code;
- whether Kakuro's grade-0 boards are trivial;
- anything on a real device.
