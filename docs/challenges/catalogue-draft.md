# Practice challenges: catalogue draft

Draft, 9 Nov 2026, for Joe's review. Docs only: nothing here changes a game, a score or the app. 261 challenges over all 92 active games, 39 of them marked as coin candidates.

## The rules this draft follows

These are the rules agreed with Joe for mastery stars, crowns and challenges. The master plan (`docs/duelz-master-plan.md`) doesn't have that section on `main` yet, so they are written out here; when the section lands, it wins over this list.

- **Never on Easy.** Every challenge names its level: Classic, Hard or Expert. Difficulty levels arrive in wave 3.5; until then only the Classic ones can be done, and the Hard and Expert ones wait.
- **Varied, not a fixed number a game.** Two to four a game, in different styles, so no two categories read the same.
- **Checked on the server.** Every goal is read from what the server stores with a graded run (the score, its stored parts and facts, the arcade reveal's lines and tiles) or from the server's own replay of the stored answer or input log. Never from what the phone says.
- **Doable in Practice.** Practice runs are graded by the same server code as rooms (`gradeAnswer`, `gradeRoomAnswer`), so every check below works on a practice run, an offline run once it's confirmed, and a room run alike.
- **Fair.** Every goal is something the game's scoring actually detects, and something a real player can do on every deal: arcade games on the scoring standard reach 200 on every deal (Five Hands excepted, so it has no 200 goal), and the targets below come from each game's own parts and maximums.

Scoring parts, maximums and “full by” times are read from `main` today: the arcade specs (`src/lib/arcade/standard/`, `revealStdParts.ts` and each sim’s `*_STD`), the puzzle standard’s graders (`src/lib/duel/standard/`) and `docs/duelz-game-bank.md`. Names in the Goal column follow DESIGN.md section 10: short, dry, British, no exclamation marks.

## How to read the tables

| Column | Meaning |
|---|---|
| Name | Short and fun. Unique across the catalogue. |
| Goal | One plain sentence, as the player sees it. |
| Level | Classic, Hard or Expert. A Hard or Expert challenge counts only a run dealt at that level. |
| Style | What it asks for (below). |
| Check | The stored field or replay fact the server reads (below). |
| Tier | Easy win, Medium or Hard: a guide for rewards. |
| Coin | ● marks a coin-paying candidate: the hardest ~15 %. |
| Today | For the 20 games that have challenges now: keep, revise or replace, with the existing id. “new” otherwise. |

**Styles.**

| Style | Means |
|---|---|
| Finish | Solve it, clear it, reach the end. |
| Clean | No mistakes, misses, fouls, hits or wasted moves. |
| Par | The fewest moves, pours, presses, darts or strokes (or par time). |
| Speed | Finished by the game's own “full by” time, so its speed part is full. |
| Streak | A run of good things in a row. |
| Combo | The game's combo or multi part. |
| Full set | Every one of a set: every gold brick, every hoop, every clover. |
| Target | A count to reach that isn't the part's maximum. |
| Max-out | One scoring part at its maximum. |
| Big score | A score line, for games whose skill shows best in the total. |
| Perfect | 200. Hard and Expert only. |

**Checks.** Field names are as stored today (`round_results`, `practice_plays` and `async_results` share the shape).

| Written as | Reads |
|---|---|
| `score` | The stored score. |
| `isCorrect`, `reactionAvgMs` | The result's own columns. |
| finish, `parts.kind` finish | A puzzle on the scoring standard (`extra.standard` = 1) that finished: `extra.parts.kind` = "finish". |
| `parts.speed`, `parts.efficiency` | That finish's speed points and bonus points (`extra.parts`). The bonus is the sum of a game's bonuses, so “= max” means every bonus full. |
| `facts.<name>` | A fact the standard grader stores on `extra` beside the parts (`src/lib/duel/standard/*.server.ts`), e.g. `facts.mistakes`, `facts.used` and `facts.par`. |
| `extra.<name>` | A field the game's own grader stores (Flash's `extra.depth`, Forage's `extra.longWords`, Bonk's and Pull!'s `extra.depth`, Tenfall's `extra.resets`). |
| line “Label” = n of m | An arcade standard part's stored reveal line, `extra.reveal.lines` “Label: … → n of m”, as `challengeValueOf` reads it today. “≥ n” reads the points. |
| tile “Label” | An arcade reveal tile, `extra.reveal.tiles` (games whose reveal draws tiles rather than part lines: Breaker, Fission, Spacewalk, Hover, Meteor, Wavefront, Slice). |
| `level` | The dealt puzzle's level (wave 3.5). A run with no level is Classic. |
| replay … † | Known to the server's replay of the stored log but not stored today. Building it means storing one more fact on the result (a line in the grader, display data only, no stamp). |

6 challenges need a new stored fact (†); every other one can be checked from what is stored now.

## Summary

### By category

| Category | Games | Challenges | Classic | Hard | Expert | Easy win | Medium | Hard tier | Coin |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Logic | 14 | 35 | 25 | 6 | 4 | 3 | 15 | 17 | 6 |
| Pattern | 10 | 26 | 21 | 3 | 2 | 2 | 12 | 12 | 2 |
| Speed | 6 | 19 | 16 | 3 | 0 | 2 | 10 | 7 | 3 |
| Attention | 7 | 18 | 15 | 2 | 1 | 2 | 8 | 8 | 3 |
| Word | 9 | 25 | 22 | 2 | 1 | 3 | 11 | 11 | 3 |
| Number | 9 | 24 | 21 | 2 | 1 | 4 | 10 | 10 | 2 |
| Action | 7 | 23 | 19 | 2 | 2 | 1 | 12 | 10 | 3 |
| Retro | 10 | 30 | 27 | 3 | 0 | 0 | 15 | 15 | 5 |
| Sports | 9 | 28 | 25 | 2 | 1 | 3 | 9 | 16 | 5 |
| Cards and Board | 6 | 18 | 14 | 3 | 1 | 0 | 7 | 11 | 4 |
| Strategy | 5 | 15 | 12 | 2 | 1 | 0 | 6 | 9 | 3 |
| **Total** | **92** | **261** | **217** | **30** | **14** | **20** | **115** | **126** | **39** |

Coin candidates are 15 % of the catalogue. Until wave 3.5, 217 challenges (the Classic ones) can be done.

### By style

| Style | Logic | Pattern | Speed | Attention | Word | Number | Action | Retro | Sports | Cards and Board | Strategy | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Finish | 3 | 3 | 2 | 4 | 2 | 5 | 1 | 4 | 1 | 3 | 1 | 29 |
| Clean | 11 | 3 | 4 | 2 | 4 | 5 | 2 | 5 | 4 | 2 | 1 | 43 |
| Par | 6 | 9 | 0 | 1 | 2 | 4 | 0 | 0 | 3 | 3 | 2 | 30 |
| Speed | 11 | 8 | 4 | 4 | 5 | 5 | 0 | 0 | 2 | 5 | 1 | 45 |
| Streak | 0 | 0 | 3 | 2 | 0 | 0 | 3 | 1 | 5 | 1 | 0 | 15 |
| Combo | 0 | 0 | 1 | 0 | 0 | 0 | 2 | 1 | 0 | 1 | 1 | 6 |
| Full set | 0 | 0 | 3 | 2 | 1 | 0 | 9 | 9 | 6 | 1 | 6 | 37 |
| Target | 0 | 1 | 1 | 1 | 4 | 1 | 1 | 5 | 3 | 0 | 0 | 17 |
| Max-out | 0 | 0 | 1 | 0 | 4 | 3 | 5 | 3 | 4 | 0 | 3 | 23 |
| Big score | 1 | 0 | 0 | 0 | 2 | 0 | 0 | 2 | 0 | 2 | 0 | 7 |
| Perfect | 3 | 2 | 0 | 2 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 9 |

### Games by number of challenges

- **2** (21): Hanoi, Polypotions, Mosaic, Tents and Trees, Shikaku, Trail, Regions, Tessellate, Skid, Topsy-Turvy, Turntable, Eagle Eye, Tally, Labyrinth, Interlock, Slider, Swapword, Operator, Counterweight, Integer Pyramid, Mahjong Solitaire.
- **3** (65): Blackout, Box Six, Safe Cracker, Colour Flood, Lamplighter, Loopline, Island Link, Gridlock, Gradient, Lightbender, Chroma Lines, Pipeline, Heave, Bang On, Ascend, Don’t Break the Chain, Bonk, Pull!, Mixed Signals, Double Take, Matchmaker, Bomb Defusal, Nucleus, Lookout, Roundabout, Strikeout, Cryptogrid, Exact, Brimful, Checkout, Ballpark, Tenfall, Kakuro, Roofbound, Grappler, Moon Climb, Slice, Orbit, Tempo, Blockzone, Breaker, Fission, Spacewalk, Hover, Pinball, Rally, Meteor, Wavefront, Ringer, Swish, Flightpath, Cue Ball, Curl Champ, Home Run, Top Bins, Apex, Five Hands, Free Cell, Minefield, Thirteen, Ball Tracker, Coral Pop, Rainbow Bridge, Gemstone, Tilt.
- **4** (6): Flash, Forage, Iron Wall, High Rise, Crazy Golf, Summit.

## The 40 challenges today

The 20 games in `src/lib/duel/practiceChallenges.ts`: 37 kept, 2 revised, 1 replaced. A kept challenge keeps its id and check, so progress carries over; its text may read differently. A revised one keeps its id with a new text or target (progress made towards the old target should be re-read from the stored runs, not carried). A replaced one gets a new id; its old progress is dropped.

| Today's id | Today's text | Decision | New name | Why |
|---|---|---|---|---|
| `unblock.par` | Solve it at par | Keep | Clear road | the game's own part, fair as it stands; renamed only |
| `unblock.speed` | Solve it within 40 s | Keep | Rush hour | the game's own part, fair as it stands; renamed only |
| `lightsout.par` | Solve it in par presses | Keep | Lights out, on par | the game's own part, fair as it stands; renamed only |
| `lightsout.speed` | Solve it within 20 s | Keep | Blink | the game's own part, fair as it stands; renamed only |
| `sudoku.clean` | Solve it with no mistakes | Keep | Ink, not pencil | the game's own part, fair as it stands; renamed only |
| `sudoku.speed` | Solve it within 45 s | Keep | Six by six by speed | the game's own part, fair as it stands; renamed only |
| `flood.par` | Solve it at par | Keep | High tide | the game's own part, fair as it stands; renamed only |
| `flood.speed` | Solve it within 30 s | Keep | Flash flood | the game's own part, fair as it stands; renamed only |
| `tower.par` | Solve it at par | Keep | Monk’s patience | the game's own part, fair as it stands; renamed only |
| `tower.speed` | Solve it within 45 s | Keep | Tower sprint | the game's own part, fair as it stands; renamed only |
| `safe.clean` | Crack it with no mistakes | Revise | First turn | same check; the text said “no mistakes”, but the bonus is the first try |
| `safe.speed` | Solve it within 30 s | Keep | Light fingers | the game's own part, fair as it stands; renamed only |
| `tiles.par` | Solve it at par | Keep | Smooth blend | the game's own part, fair as it stands; renamed only |
| `tiles.speed` | Solve it within 30 s | Keep | Colour rush | the game's own part, fair as it stands; renamed only |
| `codeword.clean` | Crack it with no mistakes | Keep | Clean crack | the game's own part, fair as it stands; renamed only |
| `codeword.speed` | Solve it within 60 s | Keep | Codebreaker | the game's own part, fair as it stands; renamed only |
| `swapword.par` | Solve it at par | Keep | Swap shop | the game's own part, fair as it stands; renamed only |
| `swapword.speed` | Solve it within 60 s | Keep | Quick swap | the game's own part, fair as it stands; renamed only |
| `wordslide.par` | Solve it at par | Keep | Slick | the game's own part, fair as it stands; renamed only |
| `wordslide.speed` | Solve it within 33 s | Keep | Slide rule | the game's own part, fair as it stands; renamed only |
| `pinball.joulz` | Max out J-O-U-L-Z | Keep | Spell it out | the game's own part, fair as it stands; renamed only |
| `pinball.multiball` | Max out Multiball | Keep | Multiball madness | the game's own part, fair as it stands; renamed only |
| `skyline.perfects` | Max out Perfect drops | Revise | Thirty perfect | the old goal, the part's maximum, needs 61 perfect drops in a run; halved so it can be done |
| `skyline.gold` | Max out Gold blocks | Keep | Gold top | the game's own part, fair as it stands; renamed only |
| `beat.gold` | Max out Golden notes | Keep | Golden ear | the game's own part, fair as it stands; renamed only |
| `beat.score180` | Score 180 or more | Keep | Encore | the game's own part, fair as it stands; renamed only |
| `bubble.clear` | Clear the reef | Keep | Reef raider | the game's own part, fair as it stands; renamed only |
| `bubble.chests` | Max out Chests | Keep | Treasure chest | the game's own part, fair as it stands; renamed only |
| `bintoss.finish` | Get all ten in | Keep | Nothing but bucket | the game's own part, fair as it stands; renamed only |
| `bintoss.hoops` | Max out Hoops | Keep | Hoop dreams | the game's own part, fair as it stands; renamed only |
| `bullseye.dead` | Max out Dead-centre darts | Keep | Dead centre | the game's own part, fair as it stands; renamed only |
| `bullseye.score180` | Score 180 or more | Replace | On a roll | a score target told nothing; the streak is the game's own skill |
| `homerun.homers` | Max out Home runs | Keep | Out of the park | the game's own part, fair as it stands; renamed only |
| `homerun.streak` | Max out Perfect streak | Keep | Perfect ten | the game's own part, fair as it stands; renamed only |
| `pool.black` | Pot the black | Keep | Behind the eight | the game's own part, fair as it stands; renamed only |
| `pool.streak` | Max out Pots in a row | Keep | Run out | the game's own part, fair as it stands; renamed only |
| `blockfall.multi` | Max out Multi-line clears | Keep | Multi-tasker | the game's own part, fair as it stands; renamed only |
| `blockfall.low` | Max out Low stack | Keep | Low rider | the game's own part, fair as it stands; renamed only |
| `bastion.drones` | Down all three drones | Keep | Drone strike | the game's own part, fair as it stands; renamed only |
| `bastion.base` | Keep the base untouched | Keep | Hold the wall | the game's own part, fair as it stands; renamed only |

## The catalogue

### Logic

14 games, 35 challenges.

#### Blackout (`lightsout`)

Scores: 150 + speed 30 (full by 20 s) + par 20.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Lights out, on par | Turn every light off in par presses. | Classic | Par | `parts.kind` finish, `parts.efficiency` = 20 (`facts.used` ≤ `facts.par`) | Medium |  | keep (`lightsout.par`) |
| Blink | Turn every light off within 20 s. | Classic | Speed | finish, `parts.speed` = 30 | Hard |  | keep (`lightsout.speed`) |
| Power cut | Clear an Expert board in par presses. | Expert | Par | `level` expert, finish, `parts.efficiency` = 20 | Hard | ● | new |

#### Box Six (`sudoku`)

Scores: 150 + speed 40 (45 s) + clean grid 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Ink, not pencil | Fill the grid without a single wrong digit. | Classic | Clean | finish, `facts.mistakes` = 0 (`parts.efficiency` = 10) | Medium |  | keep (`sudoku.clean`) |
| Six by six by speed | Solve it within 45 s. | Classic | Speed | finish, `parts.speed` = 40 | Hard |  | keep (`sudoku.speed`) |
| Box clever | Score 200 on a Hard grid: no mistakes, within 45 s. | Hard | Perfect | `level` hard, `score` = 200 | Hard | ● | new |

#### Hanoi (`tower`)

Scores: 150 + speed 40 (45 s) + par 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Monk’s patience | Move the tower in the fewest possible moves. | Classic | Par | finish, `facts.used` = `facts.par` (`parts.efficiency` = 10) | Medium |  | keep (`tower.par`) |
| Tower sprint | Move the tower within 45 s. | Classic | Speed | finish, `parts.speed` = 40 | Hard |  | keep (`tower.speed`) |

#### Polypotions (`tubes`)

Scores: 150 + speed 35 (45 s) + par 15.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Measured pour | Sort every flask in par pours. | Classic | Par | finish, `facts.used` ≤ `facts.par` (`parts.efficiency` = 15) | Medium |  | new |
| Potion master | Sort a Hard set within 45 s. | Hard | Speed | `level` hard, finish, `parts.speed` = 35 | Hard |  | new |

#### Safe Cracker (`safe`)

Scores: open 150 + speed 40 (30 s) + first try 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| First turn | Open the safe on your first try. | Classic | Clean | finish, `facts.openedOn` = 1 (`parts.efficiency` = 10) | Medium |  | revise (`safe.clean`) |
| Light fingers | Open the safe within 30 s. | Classic | Speed | finish, `parts.speed` = 40 | Hard |  | keep (`safe.speed`) |
| Safe hands | Open an Expert safe on your first try. | Expert | Clean | `level` expert, finish, `facts.openedOn` = 1 | Hard | ● | new |

#### Mosaic (`nonogram`)

Scores: 150 + speed 40 (60 s) + clean picture 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Steady brush | Finish the picture with no wrong cells. | Classic | Clean | finish, `facts.mistakes` = 0 | Medium |  | new |
| Quick sketch | Finish the picture within 60 s. | Classic | Speed | finish, `parts.speed` = 40 | Medium |  | new |

#### Colour Flood (`flood`)

Scores: 150 + speed 10 (30 s) + par 40.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| High tide | Flood the board in par moves. | Classic | Par | finish, `parts.efficiency` = 40 (`facts.used` ≤ `facts.par`) | Medium |  | keep (`flood.par`) |
| Flash flood | Flood the board within 30 s. | Classic | Speed | finish, `parts.speed` = 10 | Medium |  | keep (`flood.speed`) |
| Flood warning | Flood a Hard board in par moves. | Hard | Par | `level` hard, finish, `parts.efficiency` = 40 | Hard |  | new |

#### Tents and Trees (`tents`)

Scores: 150 + speed 40 (45 s) + clean camp 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Happy campers | Pitch every tent with none in the wrong place. | Classic | Clean | finish, `facts.mistakes` = 0 | Medium |  | new |
| Glamping | Score 200 on a Hard camp. | Hard | Perfect | `level` hard, `score` = 200 | Hard | ● | new |

#### Shikaku (`shikaku`)

Scores: 150 + speed 40 (45 s) + clean cuts 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Clean cuts | Cut the grid with no wrong rectangles. | Classic | Clean | finish, `facts.mistakes` = 0 | Medium |  | new |
| Sharp knife | Cut the grid within 45 s. | Classic | Speed | finish, `parts.speed` = 40 | Hard |  | new |

#### Lamplighter (`lightup`)

Scores: 150 + speed 40 (45 s) + clean board 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| No dark corners | Light every square. | Classic | Finish | `parts.kind` finish | Easy win |  | new |
| Bright spark | Score 190 or more. | Classic | Big score | `score` ≥ 190 | Hard |  | new |
| Lighthouse keeper | Light an Expert board with no wrong bulbs. | Expert | Clean | `level` expert, finish, `facts.mistakes` = 0 | Hard |  | new |

#### Trail (`trail`)

Scores: 150 + speed 40 (60 s) + clean path 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| No backtracking | Draw the whole path without undoing a step. | Classic | Clean | finish, `facts.cleanPath` = true | Medium |  | new |
| Trailblazer | Finish the path within 60 s. | Classic | Speed | finish, `parts.speed` = 40 | Hard |  | new |

#### Loopline (`fences`)

Scores: 150 + speed 40 (45 s) + clean loop 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Closed loop | Close the loop. | Classic | Finish | `parts.kind` finish | Easy win |  | new |
| Clean loop | Close the loop with no wrong edges. | Classic | Clean | finish, `facts.mistakes` = 0 | Medium |  | new |
| Loop the loop | Score 200 on a Hard loop. | Hard | Perfect | `level` hard, `score` = 200 | Hard | ● | new |

#### Regions (`fillomino`)

Scores: 150 + speed 40 (45 s) + clean fill 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Right sizes | Fill the grid with no wrong numbers. | Classic | Clean | finish, `facts.mistakes` = 0 | Medium |  | new |
| Quick fill | Fill the grid within 45 s. | Classic | Speed | finish, `parts.speed` = 40 | Hard |  | new |

#### Island Link (`bridges`)

Scores: 150 + speed 40 (45 s) + clean build 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Bridge builder | Link every island. | Classic | Finish | `parts.kind` finish | Easy win |  | new |
| Chartered engineer | Link a Hard chain with no wrong bridges. | Hard | Clean | `level` hard, finish, `facts.mistakes` = 0 | Medium |  | new |
| Iron bridge | Link an Expert chain within 45 s. | Expert | Speed | `level` expert, finish, `parts.speed` = 40 | Hard | ● | new |

### Pattern

10 games, 26 challenges.

#### Gridlock (`unblock`)

Scores: 150 + speed 30 (40 s) + moves 20 (par).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Clear road | Free the gold block in par moves. | Classic | Par | finish, `parts.efficiency` = 20 | Medium |  | keep (`unblock.par`) |
| Rush hour | Free the gold block within 40 s. | Classic | Speed | finish, `parts.speed` = 30 | Hard |  | keep (`unblock.speed`) |
| Green wave | Score 200 on an Expert jam. | Expert | Perfect | `level` expert, `score` = 200 | Hard | ● | new |

#### Tessellate (`blockparty`)

Scores: 150 + speed 40 (40 s) + first time 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| No second thoughts | Fill the board without moving a piece twice. | Classic | Clean | finish, `parts.efficiency` = 10 (`facts.rightFirstTime` all pieces) | Medium |  | new |
| Snap fit | Fill the board within 40 s. | Classic | Speed | finish, `parts.speed` = 40 | Hard |  | new |

#### Skid (`iceslide`)

Scores: 150 + speed 30 (30 s) + slides 20 (par).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Ice cool | Reach the exit in par slides. | Classic | Par | finish, `facts.slides` ≤ `facts.parSlides` | Medium |  | new |
| Black ice | Score 200 on a Hard rink. | Hard | Perfect | `level` hard, `score` = 200 | Hard |  | new |

#### Topsy-Turvy (`gravity`)

Scores: 150 + speed 30 (32 s) + tilts 20 (par).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Right way up | Sink every ball in par tilts. | Classic | Par | finish, `parts.efficiency` = 20 | Medium |  | new |
| Head rush | Sink every ball within 32 s. | Classic | Speed | finish, `parts.speed` = 30 | Hard |  | new |

#### Gradient (`tiles`)

Scores: 150 + speed 35 (30 s) + swaps 15 (par).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Smooth blend | Rebuild the gradient in par swaps. | Classic | Par | finish, `parts.efficiency` = 15 | Medium |  | keep (`tiles.par`) |
| Colour rush | Rebuild the gradient within 30 s. | Classic | Speed | finish, `parts.speed` = 35 | Hard |  | keep (`tiles.speed`) |
| Spectrum | Rebuild an Expert gradient in par swaps. | Expert | Par | `level` expert, finish, `parts.efficiency` = 15 | Hard |  | new |

#### Turntable (`rings`)

Scores: 150 + speed 35 (40 s) + turns 15 (par).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Full circle | Match every spoke. | Classic | Finish | `parts.kind` finish | Easy win |  | new |
| Spin doctor | Match every spoke in par turns. | Classic | Par | finish, `parts.efficiency` = 15 | Medium |  | new |

#### Lightbender (`laser`)

Scores: 150 + speed 40 (15 s) + mirrors 5 + first shot 5.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| One shot | Light all six gems with your first FIRE. | Classic | Clean | finish, `extra.fires` = 1 | Medium |  | new |
| Hall of mirrors | Light all six on the first shot with par mirrors. | Classic | Par | finish, `parts.efficiency` = 10 | Hard |  | new |
| Speed of light | Light all six within 15 s. | Classic | Speed | finish, `parts.speed` = 40 | Hard | ● | new |

#### Chroma Lines (`flow`)

Scores: 150 + speed 40 (20 s) + clean lines 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| No redraws | Join every pair without redrawing a line. | Classic | Clean | finish, `facts.redraws` = 0 | Medium |  | new |
| Paint stripper | Join every pair within 20 s. | Classic | Speed | finish, `parts.speed` = 40 | Hard |  | new |
| Spaghetti junction | Fill a Hard board. | Hard | Finish | `level` hard, `parts.kind` finish | Medium |  | new |

#### Pipeline (`pipes`)

Scores: 150 + speed 40 (60 s) + taps 10 (par).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| No leaks | Connect every pipe. | Classic | Finish | `parts.kind` finish | Easy win |  | new |
| Plumber’s par | Connect every pipe in par turns. | Classic | Par | finish, `parts.efficiency` = 10 | Medium |  | new |
| Mains pressure | Connect a Hard network within 60 s. | Hard | Speed | `level` hard, finish, `parts.speed` = 40 | Hard |  | new |

#### Heave (`push`)

Scores: 150 + speed 25 (45 s) + gold crate 10 + pushes 15 (par).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Gold standard | Finish with the gold crate on the gold mark. | Classic | Target | finish, replay of the stored pushes: gold crate on the gold mark (its 10 points) † | Medium |  | new |
| Heavy lifting | Gold crate home and par pushes. | Classic | Par | finish, `parts.efficiency` = 25 | Hard |  | new |
| Crate expectations | Place every crate within 45 s. | Classic | Speed | finish, `parts.speed` = 25 | Medium |  | new |

### Speed

6 games, 19 challenges.

#### Flash (`reaction`)

Scores: reactions 186 (full at 120 ms average) + steady hand 15, capped at 200; false starts cost.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Clean start | Catch every flash with no false starts. | Classic | Clean | `extra.depth.falseStartCost` = 0, every flash tapped (`extra.depth.each` has no miss) | Easy win |  | new |
| Quarter second | Average under 250 ms. | Classic | Speed | `reactionAvgMs` < 250 | Medium |  | new |
| Steady hand | Max out the steady-hand bonus. | Classic | Max-out | `extra.depth.steady` = 15 | Medium |  | new |
| Greased lightning | Average under 180 ms with no false starts on Hard. | Hard | Speed | `level` hard, `reactionAvgMs` < 180, `extra.depth.falseStartCost` = 0 | Hard | ● | new |

#### Bang On (`stopwatch`)

Scores: closeness 150 + dead centre and zone streak up to 50.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| In the zone | Stop all ten watches in the gold zone. | Classic | Full set | every `extra.depth.zone` entry true | Medium |  | new |
| Bang on | Hit dead centre five times. | Classic | Target | `extra.depth.centreHits` ≥ 5 | Medium |  | new |
| Ten in a row | Stop all ten in the zone without a break. | Hard | Streak | `level` hard, `extra.depth.bestStreak` = 10 | Hard |  | new |

#### Ascend (`numhunt`)

Scores: 150 + speed 40 (40 s) + flow 10; wrong taps cost.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| No slips | Tap all 24 without a wrong tap. | Classic | Clean | finish, `facts.wrongTaps` = 0 | Medium |  | new |
| In the flow | Max out flow. | Classic | Streak | finish, `facts.flowPoints` = 10 | Medium |  | new |
| Stairway | Tap all 24 within 40 s. | Classic | Speed | finish, `parts.speed` = 40 | Hard |  | new |

#### Don’t Break the Chain (`chain`)

Scores: 150 + speed 50 (30 s).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Unbroken | Tap all 40 charms. | Classic | Finish | `parts.kind` finish | Medium |  | new |
| Chain reaction | Tap all 40 within 30 s. | Classic | Speed | finish, `parts.speed` = 50 | Hard |  | new |
| Iron links | Tap all 40 on Hard. | Hard | Finish | `level` hard, `parts.kind` finish | Hard |  | new |

#### Bonk (`whack`)

Scores: hits 150 + combo 44 + diamonds 6; wrong hats and hedgehogs cost.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Hedgehog friendly | Bonk 30 or more without a wrong hat or a hedgehog. | Classic | Clean | `extra.hits` ≥ 30, `extra.wrong` = 0, `extra.bombs` = 0 | Medium |  | new |
| Diamond geezer | Bonk every diamond. | Classic | Full set | `extra.depth.diamondHits` = `extra.depth.diamondTotal` | Medium |  | new |
| Combo king | Max out the gold combo. | Classic | Combo | `extra.depth.combo` = 44 | Hard | ● | new |

#### Pull! (`clayshoot`)

Scores: clays 110 + quick hits 40 + doubles 14 + streak 36; a bird costs 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Bird lover | Hit 15 clays without hitting a bird. | Classic | Clean | `extra.orangeHits` + `extra.goldHits` ≥ 15, `extra.birdHits` = 0 | Easy win |  | new |
| Double trouble | Hit both clays of every double. | Classic | Full set | `extra.depth.doublesHit` = `extra.depth.doublesTotal` | Medium |  | new |
| Dead eye | Max out the hit streak. | Classic | Streak | `extra.depth.streak` = 36 | Hard | ● | new |

### Attention

7 games, 18 challenges.

#### Mixed Signals (`stroop`)

Scores: finish 150 + speed 15 + streak 20 + gold words 15.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Sorted | Sort all 52 words. | Classic | Finish | `isCorrect` (the run finished, `extra.depth.standard`) | Medium |  | new |
| All that glitters | Sort every gold word. | Classic | Full set | `extra.depth.golds` = `extra.depth.goldWords` | Medium |  | new |
| Colour blind | Max out the sort streak. | Classic | Streak | `extra.depth.streak` = 20 | Hard |  | new |

#### Eagle Eye (`symscan`)

Scores: 150 + speed 10 (20 s) + clean grids 40.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Sharp eyes | Finish all three grids clean. | Classic | Clean | finish, `facts.cleanGrids` = 3 | Medium |  | new |
| Bird of prey | Score 200 on Hard. | Hard | Perfect | `level` hard, `score` = 200 | Hard | ● | new |

#### Double Take (`spotdiff`)

Scores: 150 + speed 20 (40 s) + no wrong taps 10 + hidden difference 20.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Seventh sense | Find the hidden seventh difference. | Classic | Full set | finish, `facts.hiddenPoints` = 20 | Medium |  | new |
| No guesswork | Find them all without a wrong tap. | Classic | Clean | finish, `facts.wrongTaps` = 0 | Medium |  | new |
| Spot on | Find them all within 40 s. | Classic | Speed | finish, `parts.speed` = 20 | Hard |  | new |

#### Tally (`countup`)

Scores: 150 + speed 50 (30 s).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Head count | Get all four trays right. | Classic | Finish | finish, `facts.exactTrays` = 4 | Easy win |  | new |
| Quick count | Get all four right within 30 s. | Classic | Speed | finish, `parts.speed` = 50 | Hard |  | new |

#### Labyrinth (`maze`)

Scores: 150 + speed 30 (32 s) + moves 20 (par, 0 at 1.5 × par).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Shortest way out | Reach the exit in par moves. | Classic | Par | finish, `facts.steps` ≤ `facts.parSteps` | Medium |  | new |
| Minotaur | Score 200 on a Hard maze. | Hard | Perfect | `level` hard, `score` = 200 | Hard | ● | new |

#### Matchmaker (`pairmatch`)

Scores: 150 + speed 30 (60 s) + streak 5 + gold pair 15 (first 30 s).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Golden couple | Find the gold pair in the first 30 s. | Classic | Target | `facts.goldPoints` = 15 | Medium |  | new |
| Total recall | Max out the match streak. | Classic | Streak | `facts.streakPoints` = 5 | Medium |  | new |
| Speed dating | Find all 15 pairs within 60 s. | Classic | Speed | finish, `parts.speed` = 30 | Hard |  | new |

#### Bomb Defusal (`bomb`)

Scores: defuse 150 + speed 50 (30 s).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Cool head | Defuse the bomb. | Classic | Finish | `parts.kind` finish | Easy win |  | new |
| Snip snip | Defuse it within 30 s. | Classic | Speed | finish, `parts.speed` = 50 | Hard |  | new |
| Bomb squad | Defuse an Expert bomb. | Expert | Finish | `level` expert, `parts.kind` finish | Hard | ● | new |

### Word

9 games, 25 challenges.

#### Nucleus (`wordsmith`)

Scores: words 180 (longer words more) + every-tile word 20.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Every last letter | Make a word that uses every tile. | Classic | Max-out | `extra.pangramBonus` > 0 | Medium |  | new |
| Fifteen and counting | Make 15 words. | Classic | Target | `extra.words` length ≥ 15 | Medium |  | new |
| Nuclear | Score 180 or more. | Classic | Big score | `score` ≥ 180 | Hard |  | new |

#### Forage (`wordhunt`)

Scores: words 150 + long words and gold 50; misses past 10 + 2 a word cost.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Gold digger | Find a word through the gold tile. | Classic | Target | `extra.goldWords` length ≥ 1 | Easy win |  | new |
| Long haul | Find three words of six letters or more. | Classic | Target | `extra.longWords` ≥ 3 | Medium |  | new |
| Clean forage | Find 10 words without a single miss. | Classic | Clean | `extra.words` length ≥ 10, `extra.misses` = 0 | Medium |  | new |
| Forager supreme | Score 170 or more on Hard. | Hard | Big score | `level` hard, `score` ≥ 170 | Hard | ● | new |

#### Interlock (`tilegrid`)

Scores: 150 + speed 20 (33 s) + big words 30.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Locked in | Place all 15 tiles. | Classic | Finish | `parts.kind` finish | Easy win |  | new |
| Big words | Max out big words. | Classic | Max-out | finish, `parts.efficiency` = 30 (`facts.bigWordPoints`) | Hard |  | new |

#### Slider (`wordslide`)

Scores: 150 + speed 35 (33 s) + moves 15 (par).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Slick | Make all five words in par moves. | Classic | Par | finish, `parts.efficiency` = 15 | Medium |  | keep (`wordslide.par`) |
| Slide rule | Make all five words within 33 s. | Classic | Speed | finish, `parts.speed` = 35 | Hard |  | keep (`wordslide.speed`) |

#### Lookout (`wordsearch`)

Scores: 150 + speed 20 (40 s) + bonus word 30.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Hidden gem | Find the unlisted seventh word. | Classic | Full set | finish, `parts.efficiency` = 30 | Medium |  | new |
| Eagle-eyed | Find all six within 40 s. | Classic | Speed | finish, `parts.speed` = 20 | Medium |  | new |
| Crow’s nest | Score 200 on Hard. | Hard | Perfect | `level` hard, `score` = 200 | Hard | ● | new |

#### Roundabout (`letterwheel`)

Scores: 150 + speed 20 (40 s) + bonus jar 30.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Jar of five | Drop five bonus words in the jar. | Classic | Target | `facts.bonusWords` ≥ 5 | Medium |  | new |
| Jar full | Max out the bonus jar. | Classic | Max-out | finish, `facts.jarPoints` = 30 | Hard |  | new |
| Dizzy | Fill the crossword within 40 s. | Classic | Speed | finish, `parts.speed` = 20 | Hard |  | new |

#### Strikeout (`strikeout`)

Scores: 150 + speed 20 (40 s) + early solves 20 + strikes left 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Five for five | Solve all five words. | Classic | Finish | `parts.kind` finish | Easy win |  | new |
| Strike light | Solve all five with two strikes or fewer. | Classic | Clean | finish, `facts.strikePoints` = 10 | Medium |  | new |
| Early bird | Max out early solves. | Classic | Max-out | finish, `facts.earlySolvePoints` = 20 | Hard |  | new |

#### Cryptogrid (`codeword`)

Scores: 150 + speed 40 (60 s) + clean crack 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Clean crack | Crack it without a wrong letter. | Classic | Clean | finish, `facts.wrongEntered` = 0 | Medium |  | keep (`codeword.clean`) |
| Codebreaker | Crack it within 60 s. | Classic | Speed | finish, `parts.speed` = 40 | Hard |  | keep (`codeword.speed`) |
| Enigma | Crack an Expert grid without a wrong letter. | Expert | Clean | `level` expert, finish, `facts.wrongEntered` = 0 | Hard | ● | new |

#### Swapword (`swapword`)

Scores: 150 + speed 20 (60 s) + swaps 30 (par).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Swap shop | Finish in par swaps. | Classic | Par | finish, `parts.efficiency` = 30 | Medium |  | keep (`swapword.par`) |
| Quick swap | Finish within 60 s. | Classic | Speed | finish, `parts.speed` = 20 | Hard |  | keep (`swapword.speed`) |

### Number

9 games, 24 challenges.

#### Exact (`target`)

Scores: 150 + speed 35 (30 s) + elegance 15 (fewest numbers).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Bang on target | Make the target exactly. | Classic | Finish | `parts.kind` finish | Easy win |  | new |
| Elegant | Make it with the fewest numbers possible. | Classic | Par | finish, `facts.tilesUsed` = `facts.minTiles` | Medium |  | new |
| Countdown | Make it within 30 s. | Classic | Speed | finish, `parts.speed` = 35 | Hard |  | new |

#### Operator (`equation`)

Scores: 150 + speed 40 (60 s) + first try 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| First time right | Get all four equations right first time. | Classic | Clean | finish, `facts.cleanEquations` = 4 | Medium |  | new |
| Smooth operator | Fill a Hard set within 60 s. | Hard | Speed | `level` hard, finish, `parts.speed` = 40 | Hard |  | new |

#### Counterweight (`balance`)

Scores: 150 + speed 35 (60 s) + hangs 15 (par).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Perfectly balanced | Balance all four scales in par hangs. | Classic | Par | finish, `facts.hangsUsed` ≤ `facts.parHangs` | Medium |  | new |
| Heavyweight | Balance all four within 60 s. | Classic | Speed | finish, `parts.speed` = 35 | Hard |  | new |

#### Integer Pyramid (`numpyramid`)

Scores: 150 + speed 40 (75 s) + clean pyramids 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Solid base | Build all four pyramids clean. | Classic | Clean | finish, `facts.cleanPyramids` = 4 | Medium |  | new |
| Pharaoh | Score 200 on Expert. | Expert | Perfect | `level` expert, `score` = 200 | Hard | ● | new |

#### Brimful (`measure`)

Scores: 150 + speed 35 (60 s) + pours 15 (par).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Fill her up | Measure all four targets. | Classic | Finish | `parts.kind` finish | Easy win |  | new |
| Not a drop spilt | Measure all four in par pours. | Classic | Par | finish, `facts.pours` ≤ `facts.parPours` | Medium |  | new |
| Quick pint | Measure all four within 60 s. | Classic | Speed | finish, `parts.speed` = 35 | Hard |  | new |

#### Checkout (`checkout`)

Scores: 150 + speed 30 (60 s) + darts 10 + big finishes 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Game shot | Check out all five boards. | Classic | Finish | `parts.kind` finish | Easy win |  | new |
| Fewest darts | Check out all five in the fewest darts. | Classic | Par | finish, `facts.darts` = `facts.fewestDarts` | Medium |  | new |
| Big fish | Take every big finish on offer. | Classic | Max-out | finish, `facts.bigFinishes` = `facts.bigBoards` | Hard |  | new |

#### Ballpark (`numline`)

Scores: accuracy 150 + speed 20 (60 s) + bullseyes 30 (2 each).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| In the ballpark | Place all 15 with none wildly off. | Classic | Clean | finish, `facts.wild` = 0 | Easy win |  | new |
| Bullseye | Land eight bullseyes. | Classic | Target | `facts.bullseyes` ≥ 8 | Medium |  | new |
| Fifteen bulls | Land a bullseye with every number. | Classic | Max-out | `facts.bullseyes` = 15 | Hard | ● | new |

#### Tenfall (`tendrop`)

Scores: 150 + speed 30 (60 s) + gold tiles 20; resets past 4 cost.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Ten out of ten | Hit all ten targets. | Classic | Finish | `parts.kind` finish (`extra.cleared` = 10) | Medium |  | new |
| No overshoot | Hit all ten without a reset. | Classic | Clean | finish, `extra.resets` = 0 | Hard |  | new |
| Gold tens | Max out the gold tiles. | Classic | Max-out | finish, `parts.efficiency` = 20 (`extra.goldTens`) | Hard |  | new |

#### Kakuro (`kakuro`)

Scores: 150 + speed 40 (60 s) + clean grid 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Sum total | Fill the grid with no wrong digits. | Classic | Clean | finish, `facts.mistakes` = 0 | Medium |  | new |
| Mental arithmetic | Fill a Hard grid. | Hard | Finish | `level` hard, `parts.kind` finish | Medium |  | new |
| Human calculator | Fill the grid within 60 s. | Classic | Speed | finish, `parts.speed` = 40 | Hard |  | new |

### Action

7 games, 23 challenges.

#### Iron Wall (`bastion`)

Scores: armour 110 + weak spots 30 + fast reloads 20 + drones 30 + base intact 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Drone strike | Down all three drones. | Classic | Full set | line “Drones” = 30 of 30 | Medium |  | keep (`bastion.drones`) |
| Hold the wall | Keep the base untouched. | Classic | Clean | line “Base intact” = 10 of 10 | Medium |  | keep (`bastion.base`) |
| Quick hands | Max out fast reloads. | Classic | Max-out | line “Fast reloads” = 20 of 20 | Hard |  | new |
| Weak at the knees | Max out weak spots. | Classic | Max-out | line “Weak spots” = 30 of 30 | Hard | ● | new |

#### Roofbound (`flip`)

Scores: clean time 100 + perfect landings 60 + double flips 20 + flow streak 20.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Double or nothing | Max out double flips. | Classic | Combo | line “Double flips” = 20 of 20 | Medium |  | new |
| Sweet spot | Land every sweet spot. | Classic | Full set | line “Perfect landings” = 60 of 60 | Hard |  | new |
| Flow rider | Max out the flow streak. | Classic | Streak | line “Flow streak” = 20 of 20 | Hard | ● | new |

#### Grappler (`swing`)

Scores: course 110 + pars 40 + gates 10 + clean-swing streak 40.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Gatecrasher | Fly through every gate. | Classic | Full set | line “Gates” = 10 of 10 | Medium |  | new |
| Vine time | Score half the clean-swing streak. | Classic | Streak | line “Clean-swing streak” ≥ 20 | Medium |  | new |
| King of the swingers | Max out the course on Expert. | Expert | Max-out | `level` expert, line “Course” = 110 of 110 | Hard |  | new |

#### Moon Climb (`ricochet`)

Scores: height 125 + flow 30 + lantern rides 30 + scrolls 15.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Scroll keeper | Grab all three scrolls. | Classic | Full set | line “Scrolls” = 15 of 15 | Medium |  | new |
| Lantern lift | Ride all six sky lanterns. | Classic | Full set | line “Lantern rides” = 30 of 30 | Hard |  | new |
| Moonwalker | Climb 245 m on Hard. | Hard | Max-out | `level` hard, line “Height” = 125 of 125 | Hard |  | new |

#### High Rise (`skyline`)

Scores: floors 140 + perfect drops 30 + perfect streak 10 + gold blocks 20.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Gold top | Land all five gold blocks perfectly. | Classic | Full set | line “Gold blocks” = 20 of 20 | Medium |  | keep (`skyline.gold`) |
| Thirty perfect | Make 30 perfect drops in one run. | Classic | Target | line “Perfect drops” ≥ 15 | Medium |  | revise (`skyline.perfects`) |
| Steady crane | Max out the perfect streak. | Classic | Streak | line “Perfect streak” = 10 of 10 | Medium |  | new |
| Skyscraper | Build 61 floors on Expert. | Expert | Max-out | `level` expert, line “Floors” = 140 of 140 | Hard | ● | new |

#### Slice (`slice`)

Scores: food 120 + combos 40 + golden fruit 20 + bread tickets 10 + dodges 10; a chilli costs 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Mild | Score 100 without cutting a chilli. | Classic | Clean | `score` ≥ 100, tile “Chillies” = 0 | Easy win |  | new |
| Golden delicious | Slice every golden fruit. | Classic | Full set | replay of the stored log: golden fruit sliced = dealt (the golden-fruit part at 20) † | Medium |  | new |
| Combo chef | Max out combos. | Classic | Combo | tile “Combo foods” ≥ 110 (the combo part's full figure) | Hard |  | new |

#### Orbit (`orbit`)

Scores: planets 130 + speed 20 + stardust 15 + slingshots 12 + asteroid fields 12 + perfect orbits 11.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Sun seeker | Reach the sun. | Classic | Finish | line “Speed” > 0 (speed only pays on reaching the sun) | Medium |  | new |
| Slingshot | Pull all four slingshots. | Classic | Full set | line “Slingshots” = 12 of 12 | Medium |  | new |
| Stargazer | Collect all the stardust on Hard. | Hard | Full set | `level` hard, line “Stardust” = 15 of 15 | Hard |  | new |

### Retro

10 games, 30 challenges.

#### Tempo (`beat`)

Scores: accuracy 130 + fever 25 + golden notes 15 + double taps 15 + perfect streak 15.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Fever pitch | Start all four fevers. | Classic | Full set | line “Fever” = 25 of 25 | Medium |  | new |
| Golden ear | Hit every golden note dead on. | Classic | Max-out | line “Golden notes” = 15 of 15 | Hard |  | keep (`beat.gold`) |
| Encore | Score 180 or more. | Classic | Big score | `score` ≥ 180 | Hard | ● | keep (`beat.score180`) |

#### Blockzone (`blockfall`)

Scores: lines 95 + pieces placed 65 + multi-line clears 24 + low stack 16.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Thirty lines | Clear 30 lines in one run. | Classic | Target | line “Lines” detail ≥ 30 lines | Medium |  | new |
| Low rider | Finish with the stack in the bottom four rows. | Classic | Clean | line “Low stack” = 16 of 16 | Medium |  | keep (`blockfall.low`) |
| Multi-tasker | Max out multi-line clears. | Classic | Combo | line “Multi-line clears” = 24 of 24 | Hard |  | keep (`blockfall.multi`) |

#### Breaker (`breaker`)

Scores: bricks 140 + clear 10 + speed 20 + gold bricks 30.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Gold rush | Break every gold brick. | Classic | Full set | tile “Gold bricks” n / n | Medium |  | new |
| No drops | Score 100 without losing a ball. | Classic | Clean | `score` ≥ 100, tile “Balls lost” = 0 | Medium |  | new |
| Wall breaker | Clear the whole wall on Hard. | Hard | Finish | `level` hard, the replay's `breakerStdParts` cleared (reveal outcome “finish”) | Hard |  | new |

#### Fission (`burst`)

Scores: atoms 140 + wave clears 35 + golden atoms 25; lives and wasted shots cost.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Golden touch | Pop all five golden atoms. | Classic | Full set | tile “Golden atoms” = 5 / 5 | Medium |  | new |
| Sharpshooter | Pop 40 atoms without a wasted-shot cost. | Classic | Clean | tile “Atoms” ≥ 40, no “wasted beams” term in the stored line | Medium |  | new |
| Meltdown | Clear all five waves. | Classic | Finish | tile “Waves cleared” = 5 / 5 | Hard |  | new |

#### Spacewalk (`cross`)

Scores: rows and crossings 150 + no-stop streak 40 + close calls 10; hits cost.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Unscathed | Make four crossings without a hit. | Classic | Clean | tile “Crossings completed” ≥ 4, tile “Lives lost” = 0 | Medium |  | new |
| Near miss | Max out close calls. | Classic | Target | replay of the stored log: close-call part at 10 † | Medium |  | new |
| Keep moving | Max out the no-stop streak. | Classic | Streak | replay of the stored log: no-stop streak part at 40 † | Hard | ● | new |

#### Hover (`hover`)

Scores: barriers 120 + star chains 30 + gold stars 20 + tight gates 20 + centre lines 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Tight squeeze | Thread all five tight gates. | Classic | Full set | tile “Tight gates” = 5 / 5 | Medium |  | new |
| Chain gang | Complete all five star chains. | Classic | Full set | tile “Star chains” = 5 / 5 | Hard |  | new |
| All the way | Pass every barrier. | Classic | Finish | tile “Barriers” = the run's barrier count (`extra.reveal.axis` value = max) | Hard | ● | new |

#### Pinball (`pinball`)

Scores: table points 130 + J-O-U-L-Z 20 + multiball 20 + jackpots 15 + ramp combos 15.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Multiball madness | Start multiball. | Classic | Target | line “Multiball” = 20 of 20 | Medium |  | keep (`pinball.multiball`) |
| Spell it out | Spell J-O-U-L-Z twice. | Classic | Max-out | line “J-O-U-L-Z” = 20 of 20 | Hard |  | keep (`pinball.joulz`) |
| Jackpot | Hit three jackpots. | Classic | Full set | line “Jackpots” = 15 of 15 | Hard | ● | new |

#### Rally (`rally`)

Scores: gold-ball hits 140 + pink pads 30 + gold targets 30.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Pink pong | Strike pink pads five times. | Classic | Target | line “Pink pads” ≥ 15 | Medium |  | new |
| Target practice | Hit all six gold targets. | Classic | Full set | line “Gold targets” = 30 of 30 | Hard |  | new |
| Rally king | Return 23 gold balls on Hard. | Hard | Max-out | `level` hard, line “Gold-ball hits” = 140 of 140 | Hard |  | new |

#### Meteor (`snake`)

Scores: stars 120 (full at 28) + gold stars 40 + combos 20 + lane rides 10 + warp stars 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Star eater | Eat 28 stars. | Classic | Target | `extra.reveal.axis` value ≥ 28 (stars eaten) | Medium |  | new |
| Comet tail | Score 150 or more. | Classic | Big score | `score` ≥ 150 | Medium |  | new |
| Golden comet | Max out gold stars. | Classic | Full set | replay of the stored log: gold-star part at 40 † | Hard |  | new |

#### Wavefront (`wavefront`)

Scores: ships 150 + boss destroyed 10 + boss speed 10 + saucers 20 + cannons and weak points 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Boss fight | Destroy the boss. | Classic | Finish | tile “Boss” = Destroyed | Medium |  | new |
| Saucer spotter | Shoot all five saucers. | Classic | Full set | tile “Saucers” = 5 | Hard |  | new |
| Not a scratch | Destroy the boss without losing a life. | Hard | Clean | `level` hard, tile “Boss” = Destroyed, tile “Lives left” = the starting lives | Hard | ● | new |

### Sports

9 games, 28 challenges.

#### Ringer (`alleyroll`)

Scores: ring points 140 + gold cup 30 + roll streak 20 + pocket hits 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Pocket rocket | Land in both 100 pockets. | Classic | Full set | line “Pocket hits” = 10 of 10 | Medium |  | new |
| Hot hand | Max out the roll streak. | Classic | Streak | line “Roll streak” = 20 of 20 | Hard |  | new |
| Gold cup final | Land in the gold cup three times on Hard. | Hard | Full set | `level` hard, line “Gold cup” = 30 of 30 | Hard |  | new |

#### Swish (`bintoss`)

Scores: buckets 130 + far buckets 36 + hoops 24 + all ten in 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Hoop dreams | Throw through all three hoops. | Classic | Full set | line “Hoops” = 24 of 24 | Hard |  | keep (`bintoss.hoops`) |
| Nothing but bucket | Get all ten in. | Classic | Clean | line “All ten in” = 10 of 10 | Hard |  | keep (`bintoss.finish`) |
| Long range | Hit the far bucket on all six chances. | Classic | Max-out | line “Far buckets” = 36 of 36 | Hard | ● | new |

#### Flightpath (`bullseye`)

Scores: dart total 150 (full at 112) + bull streaks 30 + dead-centre darts 20.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| On a roll | Throw four golds in a row. | Classic | Streak | line “Bull streaks” ≥ 6 | Medium |  | replace (`bullseye.score180`) |
| Dead centre | Max out dead-centre darts. | Classic | Max-out | line “Dead-centre darts” = 20 of 20 | Hard |  | keep (`bullseye.dead`) |
| One hundred and twelve | Max out the dart total. | Classic | Max-out | line “Dart total” = 150 of 150 | Hard |  | new |

#### Crazy Golf (`minigolf`)

Scores: holes 120 + par 40 + under par 20 + speed 20 (53 s).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Birdie | Hole one under par. | Classic | Par | line “Under par” ≥ 4 | Easy win |  | new |
| Par for the course | Hole all five in par or better. | Classic | Par | line “Par” = 40 of 40 | Medium |  | new |
| Quick round | Hole all five within 53 s. | Classic | Speed | line “Speed” = 20 of 20 | Hard |  | new |
| Under, under | Hole all five under par on Hard. | Hard | Par | `level` hard, line “Under par” = 20 of 20 | Hard | ● | new |

#### Cue Ball (`pool`)

Scores: your balls 140 + black 10 + pots in a row 30 + speed 20 (69 s); a foul costs 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Behind the eight | Pot the black. | Classic | Finish | line “Black” = 10 of 10 | Medium |  | keep (`pool.black`) |
| Clean break | Pot the black without a foul. | Classic | Clean | line “Black” = 10 of 10, total line reads “Total → N of 200” (no foul cost) | Medium |  | new |
| Run out | Max out pots in a row. | Classic | Streak | line “Pots in a row” = 30 of 30 | Hard |  | keep (`pool.streak`) |

#### Curl Champ (`curling`)

Scores: stones 150 + takeouts 20 + red ring 20 + holding shot 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Shot stone | Finish holding shot. | Classic | Target | line “Holding shot” = 10 of 10 | Easy win |  | new |
| House clearance | Knock every red out of the house. | Classic | Max-out | line “Takeouts” = 20 of 20 | Medium |  | new |
| Red ring circus | Stop all eight stones in the red ring. | Classic | Full set | line “Red ring” = 20 of 20 | Hard | ● | new |

#### Home Run (`homerun`)

Scores: distance 120 + home runs 40 + bonus signs 20 + perfect streak 20.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Sign here | Hit the lit sign five times. | Classic | Target | line “Bonus signs” ≥ 10 | Medium |  | new |
| Out of the park | Hit ten home runs. | Classic | Full set | line “Home runs” = 40 of 40 | Hard |  | keep (`homerun.homers`) |
| Perfect ten | Max out the perfect streak. | Classic | Streak | line “Perfect streak” = 20 of 20 | Hard | ● | keep (`homerun.streak`) |

#### Top Bins (`freekick`)

Scores: goals 120 + targets 40 + round the wall 10 + curl bonus 20 + five in a row 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Five alive | Score five in a row. | Classic | Streak | line “Five in a row” = 10 of 10 | Medium |  | new |
| Bend it | Score five well-bent goals. | Classic | Target | line “Curl bonus” ≥ 10 | Medium |  | new |
| Top bins | Score through all four hoops. | Classic | Full set | line “Targets” = 40 of 40 | Hard | ● | new |

#### Apex (`racing`)

Scores: pace 160 (0 at 152 km/h, full at 221.5 km/h) + clean sectors 40.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Clean half | Drive four sectors clean. | Classic | Clean | line “Clean sectors” ≥ 20 | Easy win |  | new |
| Two hundred club | Average 200 km/h. | Classic | Speed | line “Pace” ≥ 110 (200 km/h on the pace line) | Hard |  | new |
| Grand slam | Drive all eight sectors clean on Expert. | Expert | Clean | `level` expert, line “Clean sectors” = 40 of 40 | Hard |  | new |

### Cards and Board

6 games, 18 challenges.

#### Five Hands (`fivehands`)

Scores: hand points: rows plus the picked column, × 1.4, capped at 200 (not every deal reaches 200).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Full house | Score 150 or more. | Classic | Big score | `score` ≥ 150 | Medium |  | new |
| Pick of the bunch | Pick the best bonus column on the table. | Classic | Par | replay of the stored moves: picked column scores the most of the five † | Medium |  | new |
| High roller | Score 170 or more on Hard. | Hard | Big score | `level` hard, `score` ≥ 170 | Hard | ● | new |

#### Free Cell (`freecell`)

Scores: cards 105 + par moves 50 + speed 45 (32 s).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| All home | Get all 40 cards home. | Classic | Finish | line “Cards” = 105 of 105 | Medium |  | new |
| By the book | Finish in par moves. | Classic | Par | line “Par moves” = 50 of 50 | Hard |  | new |
| Card sharp | Finish within 32 s. | Classic | Speed | line “Speed” = 45 of 45 | Hard | ● | new |

#### Mahjong Solitaire (`mahjong`)

Scores: pairs 150 + no shuffles 20 + speed 30 (65 s).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| No shuffle | Clear the stack without a Shuffle. | Classic | Clean | line “Pairs” = 150 of 150, line “No shuffles” = 20 of 20 | Medium |  | new |
| Tile rush | Clear a Hard stack within 65 s. | Hard | Speed | `level` hard, line “Speed” = 30 of 30 | Hard |  | new |

#### Minefield (`minesweeper`)

Scores: safe squares 150 + no mines hit 20 + speed 30 (50 s).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Light feet | Clear the board without hitting a mine. | Classic | Clean | line “Safe squares” = 150 of 150, line “No mines hit” = 20 of 20 | Medium |  | new |
| Sweep | Clear the board within 50 s. | Classic | Speed | line “Speed” = 30 of 30 | Hard |  | new |
| Bomb disposal | Clear an Expert field. | Expert | Finish | `level` expert, line “Safe squares” = 150 of 150 | Hard | ● | new |

#### Thirteen (`pyramid`)

Scores: pyramid cards 140 + cleared 15 + speed 25 (20 s) + pyramid pairs 20.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Lucky thirteen | Clear the pyramid. | Classic | Finish | line “Cleared” = 15 of 15 | Medium |  | new |
| Paired up | Make ten pairs from two pyramid cards. | Classic | Combo | line “Pyramid pairs” = 20 of 20 | Hard |  | new |
| Unlucky for some | Clear the pyramid within 20 s. | Classic | Speed | line “Speed” = 25 of 25 | Hard |  | new |

#### Summit (`tripeaks`)

Scores: cards 105 + peak tops 30 + longest run 10 + clear 10 + stock par 20 + speed 25 (20 s).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Peak bagger | Clear all three peak tops. | Classic | Full set | line “Peak tops” = 30 of 30 | Medium |  | new |
| Up and down | Make a run of ten cards. | Classic | Streak | line “Longest run” = 10 of 10 | Hard |  | new |
| Base camp | Clear it within stock par. | Classic | Par | line “Stock par” = 20 of 20 | Hard |  | new |
| Summit sprint | Clear a Hard deal within 20 s. | Hard | Speed | `level` hard, line “Speed” = 25 of 25 | Hard | ● | new |

### Strategy

5 games, 15 challenges.

#### Ball Tracker (`balltrack`)

Scores: marbles home 140 + gold marbles 25 + combos 20 + boosted marbles 15.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Combo breaker | Score half the combos part. | Classic | Combo | line “Combos” ≥ 10 | Medium |  | new |
| Golden marbles | Send all six gold marbles home. | Classic | Full set | line “Gold marbles” = 25 of 25 | Hard |  | new |
| Lost no marbles | Send all 36 marbles home. | Classic | Max-out | line “Marbles home” = 140 of 140 | Hard | ● | new |

#### Coral Pop (`bubble`)

Scores: bubbles 120 + reef cleared 10 + speed 10 + chests 30 + bank shots 15 + combos 15.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Reef raider | Clear the whole reef. | Classic | Finish | line “Reef cleared” = 10 of 10 | Medium |  | keep (`bubble.clear`) |
| Treasure chest | Drop all six chests. | Classic | Full set | line “Chests” = 30 of 30 | Hard |  | keep (`bubble.chests`) |
| Off the wall | Max out bank shots on Hard. | Hard | Max-out | `level` hard, line “Bank shots” = 15 of 15 | Hard |  | new |

#### Rainbow Bridge (`inkbridge`)

Scores: levels 120 + ink par 30 + trick shots 20 + clovers 10 + speed 20.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Lucky clover | Collect both clovers. | Classic | Full set | line “Clovers” = 10 of 10 | Medium |  | new |
| Ink saver | Finish every level within ink par. | Classic | Par | line “Ink par” = 30 of 30 | Hard |  | new |
| Show-off | Land all four trick shots. | Classic | Full set | line “Trick shots” = 20 of 20 | Hard | ● | new |

#### Gemstone (`matchup`)

Scores: gems 108 + treasure 36 + goals 36 + ice 10 + big lines 10.

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| Ice breaker | Max out ice. | Classic | Max-out | line “Ice” = 10 of 10 | Medium |  | new |
| Goal getter | Meet all six colour goals. | Classic | Full set | line “Colour goals” = 36 of 36 | Medium |  | new |
| Treasure hunter | Bring all six treasures down on Expert. | Expert | Full set | `level` expert, line “Treasure” = 36 of 36 | Hard |  | new |

#### Tilt (`tilt`)

Scores: mazes 140 + par times 24 + clean run 12 + speed 24 (60 s).

| Name | Goal | Level | Style | Check | Tier | Coin | Today |
|---|---|---|---|---|---|:-:|---|
| No falls | Max out the clean run. | Classic | Clean | line “Clean run” = 12 of 12 | Medium |  | new |
| Par four | Beat par time in all four mazes. | Classic | Par | line “Par” = 24 of 24 | Hard |  | new |
| Marble madness | Finish all four Hard mazes within 60 s. | Hard | Speed | `level` hard, line “Speed” = 24 of 24 | Hard | ● | new |

## Open questions for Joe

1. **Levels.** The Hard and Expert challenges assume the dealt puzzle will carry its level (`level`). If levels are stored another way, only the check's first term changes.
2. **New stored facts (†).** Heave's gold crate, Slice's golden fruit, Spacewalk's close calls and no-stop streak, Meteor's gold stars and Five Hands' best column are each known to the replay but not stored. Store them, or swap those challenges for ones read from what's stored now.
3. **Coins.** The ● marks are candidates by difficulty alone. The coin amounts and whether a coin challenge also gives a badge are still to set.
4. **Revised progress.** High Rise's “Thirty perfect” and Safe Cracker's “First turn” keep their ids; Flightpath's old score challenge is replaced. Say if a revised challenge should start fresh instead.
5. **Numbers.** Every target is taken from the game's live scoring today. A later stamp that moves a part's maximum or its “full by” time moves the challenge with it; `practice-goals-check` proves today's 40 against the live specs and would need to cover these too when they are built.
