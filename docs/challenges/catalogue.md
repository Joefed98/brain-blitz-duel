# Practice challenges: the live catalogue

**Live.** Written by `bun scripts/challenge-catalogue-doc.ts` from `src/lib/duel/practiceChallenges.data.ts`, the one
data file the phone and the server read; practice-goals-check proves it matches the code and every number in every goal
against the live game (`scripts/practice-challenge-numbers.ts`). It replaces the draft Joe reviewed on 10 Nov 2026
(`catalogue-draft.md`, in the git history), with his renames (Five Hands' Full house is Handsome, Breaker's Gold rush
is Twenty-four carat) and the goals written in scoring language rewritten as the real action.

261 challenges over 92 games. 26 of them, on the 9 retired games, are
kept but hidden and count for nothing until their game returns (`RETIRED_TYPES`, 13 Nov 2026). Of the rest,
195 Classic ones are live in wave 2; the Hard and Expert ones are in the catalogue but switched off until wave 3.5
deals those levels (`LIVE_CHALLENGE_LEVELS`). Counts below are for live games.

Coins (● in the table): 16 Classic pay 100 (live), 13 Hard pay 100 and 8 Expert pay 250 once
their level is live; through the coin ledger (reason `challenge_reward`), once per challenge per account. A guest's
completions are kept and paid when that guest becomes an account.

A challenge is complete only when the server's own grade of a Practice run meets its check (`evaluateChallenge` in
`src/lib/duel/practiceChallenges.ts`, run by `src/lib/challenges/challenges.server.ts`). Rooms, the Daily and friend
challenges never count. How the checks read a run:

| Written as | Reads |
|---|---|
| finish | a puzzle on the scoring standard that finished (`extra.parts.kind` "finish") |
| `parts.speed`, `parts.efficiency` | that finish's speed and bonus points |
| `a.b` | a number (or true / false) the server stores in the run's `extra` |
| line “Label” | an arcade standard part's points, from its stored reveal line “Label: … → n of m” |
| tile “Label” | an arcade reveal tile's number |
| `score`, `isCorrect`, `reactionAvgMs` | the result's own columns |

#### Blackout (`lightsout`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Lights out, on par | Turn every light off in par presses. | Classic | Par | finish, `parts.efficiency` ≥ 20 |  | `lightsout.par` |
| Blink | Turn every light off within 20 s. | Classic | Speed | finish, `parts.speed` ≥ 30 (by 20 s) |  | `lightsout.speed` |
| Power cut | Clear an Expert board in par presses. | Expert | Par | finish, `parts.efficiency` ≥ 20 | ● | `lightsout.power-cut` |

#### Box Six (`sudoku`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Ink, not pencil | Fill the grid without a single wrong digit. | Classic | Clean | finish, `parts.efficiency` ≥ 10 |  | `sudoku.clean` |
| Six by six by speed | Solve it within 45 s. | Classic | Speed | finish, `parts.speed` ≥ 40 (by 45 s) |  | `sudoku.speed` |
| Box clever | Score 200 on a Hard grid: no mistakes, within 45 s. | Hard | Perfect | `score` ≥ 200 | ● | `sudoku.box-clever` |

#### Hanoi (`tower`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Monk’s patience | Move the tower in the fewest possible moves. | Classic | Par | finish, `parts.efficiency` ≥ 10 |  | `tower.par` |
| Tower sprint | Move the tower within 45 s. | Classic | Speed | finish, `parts.speed` ≥ 40 (by 45 s) |  | `tower.speed` |

#### Polypotions (`tubes`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Measured pour | Sort every flask in par pours. | Classic | Par | finish, `parts.efficiency` ≥ 15 |  | `tubes.measured-pour` |
| Potion master | Sort a Hard set within 45 s. | Hard | Speed | finish, `parts.speed` ≥ 35 (by 45 s) |  | `tubes.potion-master` |

#### Safe Cracker (`safe`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| First turn | Open the safe on your first try. | Classic | Clean | finish, `openedOn` = 1 |  | `safe.clean` |
| Light fingers | Open the safe within 30 s. | Classic | Speed | finish, `parts.speed` ≥ 40 (by 30 s) |  | `safe.speed` |
| Safe hands | Open an Expert safe on your first try. | Expert | Clean | finish, `openedOn` = 1 | ● | `safe.safe-hands` |

#### Mosaic (`nonogram`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Steady brush | Finish the picture with no wrong cells. | Classic | Clean | finish, `mistakes` = 0 |  | `nonogram.steady-brush` |
| Quick sketch | Finish the picture within 60 s. | Classic | Speed | finish, `parts.speed` ≥ 40 (by 60 s) |  | `nonogram.quick-sketch` |

#### Colour Flood (`flood`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| High tide | Flood the board in par moves. | Classic | Par | finish, `parts.efficiency` ≥ 40 |  | `flood.par` |
| Flash flood | Flood the board within 30 s. | Classic | Speed | finish, `parts.speed` ≥ 10 (by 30 s) |  | `flood.speed` |
| Flood warning | Flood a Hard board in par moves. | Hard | Par | finish, `parts.efficiency` ≥ 40 |  | `flood.flood-warning` |

#### Tents and Trees (`tents`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Happy campers | Pitch every tent with none in the wrong place. | Classic | Clean | finish, `mistakes` = 0 |  | `tents.happy-campers` |
| Glamping | Score 200 on a Hard camp. | Hard | Perfect | `score` ≥ 200 | ● | `tents.glamping` |

#### Shikaku (`shikaku`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Clean cuts | Cut the grid with no wrong rectangles. | Classic | Clean | finish, `mistakes` = 0 |  | `shikaku.clean-cuts` |
| Sharp knife | Cut the grid within 45 s. | Classic | Speed | finish, `parts.speed` ≥ 40 (by 45 s) |  | `shikaku.sharp-knife` |

#### Lamplighter (`lightup`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| No dark corners | Light every square. | Classic | Finish | finish |  | `lightup.no-dark-corners` |
| Bright spark | Score 190 or more. | Classic | Big score | `score` ≥ 190 |  | `lightup.bright-spark` |
| Lighthouse keeper | Light an Expert board with no wrong bulbs. | Expert | Clean | finish, `mistakes` = 0 |  | `lightup.lighthouse-keeper` |

#### Trail (`trail`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| No backtracking | Draw the whole path without undoing a step. | Classic | Clean | finish, `cleanPath` = 1 |  | `trail.no-backtracking` |
| Trailblazer | Finish the path within 60 s. | Classic | Speed | finish, `parts.speed` ≥ 40 (by 60 s) |  | `trail.trailblazer` |

#### Loopline (`fences`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Closed loop | Close the loop. | Classic | Finish | finish |  | `fences.closed-loop` |
| Clean loop | Close the loop with no wrong edges. | Classic | Clean | finish, `mistakes` = 0 |  | `fences.clean-loop` |
| Loop the loop | Score 200 on a Hard loop. | Hard | Perfect | `score` ≥ 200 | ● | `fences.loop-the-loop` |

#### Regions (`fillomino`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Right sizes | Fill the grid with no wrong numbers. | Classic | Clean | finish, `mistakes` = 0 |  | `fillomino.right-sizes` |
| Quick fill | Fill the grid within 45 s. | Classic | Speed | finish, `parts.speed` ≥ 40 (by 45 s) |  | `fillomino.quick-fill` |

#### Island Link (`bridges`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Bridge builder | Link every island. | Classic | Finish | finish |  | `bridges.bridge-builder` |
| Chartered engineer | Link a Hard chain with no wrong bridges. | Hard | Clean | finish, `mistakes` = 0 |  | `bridges.chartered-engineer` |
| Iron bridge | Link an Expert chain within 45 s. | Expert | Speed | finish, `parts.speed` ≥ 40 (by 45 s) | ● | `bridges.iron-bridge` |

#### Gridlock (`unblock`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Clear road | Free the gold block in par moves. | Classic | Par | finish, `parts.efficiency` ≥ 20 |  | `unblock.par` |
| Rush hour | Free the gold block within 40 s. | Classic | Speed | finish, `parts.speed` ≥ 30 (by 40 s) |  | `unblock.speed` |
| Green wave | Score 200 on an Expert jam. | Expert | Perfect | `score` ≥ 200 | ● | `unblock.green-wave` |

#### Tessellate (`blockparty`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| No second thoughts | Fill the board without moving a piece twice. | Classic | Clean | finish, `parts.efficiency` ≥ 10 |  | `blockparty.no-second-thoughts` |
| Snap fit | Fill the board within 40 s. | Classic | Speed | finish, `parts.speed` ≥ 40 (by 40 s) |  | `blockparty.snap-fit` |

#### Skid (`iceslide`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Ice cool | Reach the exit in par slides. | Classic | Par | finish, `slides` ≤ `parSlides` |  | `iceslide.ice-cool` |
| Black ice | Score 200 on a Hard rink. | Hard | Perfect | `score` ≥ 200 |  | `iceslide.black-ice` |

#### Topsy-Turvy (`gravity`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Right way up | Sink every ball in par tilts. | Classic | Par | finish, `parts.efficiency` ≥ 20 |  | `gravity.right-way-up` |
| Head rush | Sink every ball within 32 s. | Classic | Speed | finish, `parts.speed` ≥ 30 (by 32 s) |  | `gravity.head-rush` |

#### Gradient (`tiles`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Smooth blend | Rebuild the gradient in par swaps. | Classic | Par | finish, `parts.efficiency` ≥ 15 |  | `tiles.par` |
| Colour rush | Rebuild the gradient within 30 s. | Classic | Speed | finish, `parts.speed` ≥ 35 (by 30 s) |  | `tiles.speed` |
| Spectrum | Rebuild an Expert gradient in par swaps. | Expert | Par | finish, `parts.efficiency` ≥ 15 |  | `tiles.spectrum` |

#### Turntable (`rings`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Full circle | Match every spoke. | Classic | Finish | finish |  | `rings.full-circle` |
| Spin doctor | Match every spoke in par turns. | Classic | Par | finish, `parts.efficiency` ≥ 15 |  | `rings.spin-doctor` |

#### Lightbender (`laser`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| One shot | Light all six gems with your first FIRE. | Classic | Clean | finish, `fires` = 1 |  | `laser.one-shot` |
| Hall of mirrors | Light all six on the first shot with par mirrors. | Classic | Par | finish, `parts.efficiency` ≥ 10 |  | `laser.hall-of-mirrors` |
| Speed of light | Light all six within 15 s. | Classic | Speed | finish, `parts.speed` ≥ 40 (by 15 s) | ● | `laser.speed-of-light` |

#### Chroma Lines (`flow`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| No redraws | Join every pair without redrawing a line. | Classic | Clean | finish, `redraws` = 0 |  | `flow.no-redraws` |
| Paint stripper | Join every pair within 20 s. | Classic | Speed | finish, `parts.speed` ≥ 40 (by 20 s) |  | `flow.paint-stripper` |
| Spaghetti junction | Fill a Hard board. | Hard | Finish | finish |  | `flow.spaghetti-junction` |

#### Pipeline (`pipes`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| No leaks | Connect every pipe. | Classic | Finish | finish |  | `pipes.no-leaks` |
| Plumber’s par | Connect every pipe in par turns. | Classic | Par | finish, `parts.efficiency` ≥ 10 |  | `pipes.plumbers-par` |
| Mains pressure | Connect a Hard network within 60 s. | Hard | Speed | finish, `parts.speed` ≥ 40 (by 60 s) |  | `pipes.mains-pressure` |

#### Heave (`push`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Gold standard | Finish with the gold crate on the gold mark. | Classic | Target | finish, `goldHome` = 1 |  | `push.gold-standard` |
| Heavy lifting | Gold crate home and par pushes. | Classic | Par | finish, `parts.efficiency` ≥ 25 |  | `push.heavy-lifting` |
| Crate expectations | Place every crate within 45 s. | Classic | Speed | finish, `parts.speed` ≥ 25 (by 45 s) |  | `push.crate-expectations` |

#### Flash (`reaction`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Clean start | Catch every flash with no false starts. | Classic | Clean | `falseStarts` = 0, `misses` = 0, `taps` ≥ 1 |  | `reaction.clean-start` |
| Quarter second | Average under 250 ms. | Classic | Speed | `reactionAvgMs` < 250 |  | `reaction.quarter-second` |
| Steady hand | Catch all, no false starts, slowest within 50 ms of fastest. | Classic | Max-out | `depth.steady` ≥ 15 |  | `reaction.steady-hand` |
| Greased lightning | Average under 180 ms with no false starts on Hard. | Hard | Speed | `reactionAvgMs` < 180, `falseStarts` = 0, `misses` = 0 | ● | `reaction.greased-lightning` |

#### Bang On (`stopwatch`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| In the zone | Stop all ten watches in the gold zone. | Classic | Full set | every `depth.zone` true, `depth.zone` count = 10 |  | `stopwatch.in-the-zone` |
| Bang on | Hit dead centre five times. | Classic | Target | `depth.centreHits` ≥ 5 |  | `stopwatch.bang-on` |
| Ten in a row | Stop all ten in the zone without a break. | Hard | Streak | `depth.bestStreak` ≥ 10 |  | `stopwatch.ten-in-a-row` |

#### Ascend (`numhunt`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| No slips | Tap all 24 without a wrong tap. | Classic | Clean | finish, `wrongTaps` = 0 |  | `numhunt.no-slips` |
| In the flow | Tap all 24 in one unbroken run of right taps. | Classic | Streak | finish, `bestRun` ≥ 24 |  | `numhunt.in-the-flow` |
| Stairway | Tap all 24 within 40 s. | Classic | Speed | finish, `parts.speed` ≥ 40 (by 40 s) |  | `numhunt.stairway` |

#### Don’t Break the Chain (`chain`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Unbroken | Tap all 40 charms. | Classic | Finish | finish |  | `chain.unbroken` |
| Chain reaction | Tap all 40 within 30 s. | Classic | Speed | finish, `parts.speed` ≥ 50 (by 30 s) |  | `chain.chain-reaction` |
| Iron links | Tap all 40 on Hard. | Hard | Finish | finish |  | `chain.iron-links` |

#### Bonk (`whack`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Hedgehog friendly | Bonk 30 or more without a wrong hat or a hedgehog. | Classic | Clean | `hits` ≥ 30, `wrong` = 0, `bombs` = 0 |  | `whack.hedgehog-friendly` |
| Diamond geezer | Bonk every diamond. | Classic | Full set | `depth.diamondHits` ≥ `depth.diamondTotal`, `depth.diamondTotal` ≥ 1 |  | `whack.diamond-geezer` |
| Combo king | Bonk 47 in a row, each within 150 ms of rising. | Classic | Combo | `depth.combo` ≥ 44 | ● | `whack.combo-king` |

#### Pull! (`clayshoot`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Bird lover | Hit 15 clays without hitting a bird. | Classic | Clean | `hits` ≥ 15, `birdHits` = 0 |  | `clayshoot.bird-lover` |
| Double trouble | Hit both clays of every double. | Classic | Full set | `depth.doublesHit` ≥ `depth.doublesTotal`, `depth.doublesTotal` ≥ 1 |  | `clayshoot.double-trouble` |
| Dead eye | Hit all 25 clays in a row, each within a quarter second. | Classic | Streak | `depth.streak` ≥ 36 | ● | `clayshoot.dead-eye` |

#### Mixed Signals (`stroop`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Sorted | Sort all 52 words. | Classic | Finish | `isCorrect`, `depth.standard` = 1 |  | `stroop.sorted` |
| All that glitters | Sort every gold word. | Classic | Full set | `depth.golds` ≥ `depth.goldWords`, `depth.goldWords` ≥ 1 |  | `stroop.all-that-glitters` |
| Colour blind | Sort all 52 words right in a row. | Classic | Streak | `depth.streak` ≥ 20 |  | `stroop.colour-blind` |

#### Eagle Eye (`symscan`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Sharp eyes | Finish all three grids clean. | Classic | Clean | finish, `cleanGrids` ≥ 3 |  | `symscan.sharp-eyes` |
| Bird of prey | Score 200 on Hard. | Hard | Perfect | `score` ≥ 200 | ● | `symscan.bird-of-prey` |

#### Double Take (`spotdiff`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Seventh sense | Find the hidden seventh difference. | Classic | Full set | finish, `hiddenPoints` ≥ 20 |  | `spotdiff.seventh-sense` |
| No guesswork | Find them all without a wrong tap. | Classic | Clean | finish, `wrongTaps` = 0 |  | `spotdiff.no-guesswork` |
| Spot on | Find them all within 40 s. | Classic | Speed | finish, `parts.speed` ≥ 20 (by 40 s) |  | `spotdiff.spot-on` |

#### Tally (`countup`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Head count | Get all four trays right. | Classic | Finish | finish, `exactTrays` ≥ 4 |  | `countup.head-count` |
| Quick count | Get all four right within 30 s. | Classic | Speed | finish, `parts.speed` ≥ 50 (by 30 s) |  | `countup.quick-count` |

#### Labyrinth (`maze`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Shortest way out | Reach the exit in par moves. | Classic | Par | finish, `steps` ≤ `parSteps` |  | `maze.shortest-way-out` |
| Minotaur | Score 200 on a Hard maze. | Hard | Perfect | `score` ≥ 200 | ● | `maze.minotaur` |

#### Matchmaker (`pairmatch`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Golden couple | Find the gold pair in the first 30 s. | Classic | Target | `goldPoints` ≥ 15 |  | `pairmatch.golden-couple` |
| Total recall | Match eight pairs in a row without a miss. | Classic | Streak | `streakPoints` ≥ 5 |  | `pairmatch.total-recall` |
| Speed dating | Find all 15 pairs within 60 s. | Classic | Speed | finish, `parts.speed` ≥ 30 (by 60 s) |  | `pairmatch.speed-dating` |

#### Bomb Defusal (`bomb`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Cool head | Defuse the bomb. | Classic | Finish | finish |  | `bomb.cool-head` |
| Snip snip | Defuse it within 30 s. | Classic | Speed | finish, `parts.speed` ≥ 50 (by 30 s) |  | `bomb.snip-snip` |
| Bomb squad | Defuse an Expert bomb. | Expert | Finish | finish | ● | `bomb.bomb-squad` |

#### Nucleus (`wordsmith`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Every last letter | Make a word that uses every tile. | Classic | Max-out | `pangramBonus` > 0 |  | `wordsmith.every-last-letter` |
| Fifteen and counting | Make 15 words. | Classic | Target | `words` count ≥ 15 |  | `wordsmith.fifteen-and-counting` |
| Nuclear | Score 180 or more. | Classic | Big score | `score` ≥ 180 |  | `wordsmith.nuclear` |

#### Forage (`wordhunt`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Gold digger | Find a word through the gold tile. | Classic | Target | `goldWords` count ≥ 1 |  | `wordhunt.gold-digger` |
| Long haul | Find three words of six letters or more. | Classic | Target | `longWords` ≥ 3 |  | `wordhunt.long-haul` |
| Clean forage | Find 10 words without a single miss. | Classic | Clean | `words` count ≥ 10, `misses` = 0 |  | `wordhunt.clean-forage` |
| Forager supreme | Score 170 or more on Hard. | Hard | Big score | `score` ≥ 170 | ● | `wordhunt.forager-supreme` |

#### Interlock (`tilegrid`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Locked in | Place all 15 tiles. | Classic | Finish | finish |  | `tilegrid.locked-in` |
| Big words | Finish with 5+ letter words scoring at least the solution’s. | Classic | Max-out | finish, `bigWordPoints` ≥ 30 |  | `tilegrid.big-words` |

#### Slider (`wordslide`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Slick | Make all five words in par moves. | Classic | Par | finish, `parts.efficiency` ≥ 15 |  | `wordslide.par` |
| Slide rule | Make all five words within 33 s. | Classic | Speed | finish, `parts.speed` ≥ 35 (by 33 s) |  | `wordslide.speed` |

#### Lookout (`wordsearch`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Hidden gem | Find the unlisted seventh word. | Classic | Full set | finish, `parts.efficiency` ≥ 30 |  | `wordsearch.hidden-gem` |
| Eagle-eyed | Find all six within 40 s. | Classic | Speed | finish, `parts.speed` ≥ 20 (by 40 s) |  | `wordsearch.eagle-eyed` |
| Crow’s nest | Score 200 on Hard. | Hard | Perfect | `score` ≥ 200 | ● | `wordsearch.crows-nest` |

#### Roundabout (`letterwheel`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Jar of five | Drop five bonus words in the jar. | Classic | Target | `bonusWords` ≥ 5 |  | `letterwheel.jar-of-five` |
| Jar full | Finish with the jar full; a bonus word adds 1 to 4 drops. | Classic | Max-out | finish, `jarPoints` ≥ 30 |  | `letterwheel.jar-full` |
| Dizzy | Fill the crossword within 40 s. | Classic | Speed | finish, `parts.speed` ≥ 20 (by 40 s) |  | `letterwheel.dizzy` |

#### Strikeout (`strikeout`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Five for five | Solve all five words. | Classic | Finish | finish |  | `strikeout.five-for-five` |
| Strike light | Solve all five with two strikes or fewer. | Classic | Clean | finish, `strikePoints` ≥ 10 |  | `strikeout.strike-light` |
| Early bird | Solve all five, each with 3 letters or more still hidden. | Classic | Max-out | finish, `earlySolvePoints` ≥ 20 |  | `strikeout.early-bird` |

#### Cryptogrid (`codeword`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Clean crack | Crack it without a wrong letter. | Classic | Clean | finish, `parts.efficiency` ≥ 10 |  | `codeword.clean` |
| Codebreaker | Crack it within 60 s. | Classic | Speed | finish, `parts.speed` ≥ 40 (by 60 s) |  | `codeword.speed` |
| Enigma | Crack an Expert grid without a wrong letter. | Expert | Clean | finish, `wrongEntered` = 0 | ● | `codeword.enigma` |

#### Swapword (`swapword`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Swap shop | Finish in par swaps. | Classic | Par | finish, `parts.efficiency` ≥ 30 |  | `swapword.par` |
| Quick swap | Finish within 60 s. | Classic | Speed | finish, `parts.speed` ≥ 20 (by 60 s) |  | `swapword.speed` |

#### Exact (`target`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Bang on target | Make the target exactly. | Classic | Finish | finish |  | `target.bang-on-target` |
| Elegant | Make it with the fewest numbers possible. | Classic | Par | finish, `tilesUsed` ≤ `minTiles` |  | `target.elegant` |
| Countdown | Make it within 30 s. | Classic | Speed | finish, `parts.speed` ≥ 35 (by 30 s) |  | `target.countdown` |

#### Operator (`equation`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| First time right | Get all four equations right first time. | Classic | Clean | finish, `cleanEquations` ≥ 4 |  | `equation.first-time-right` |
| Smooth operator | Fill a Hard set within 60 s. | Hard | Speed | finish, `parts.speed` ≥ 40 (by 60 s) |  | `equation.smooth-operator` |

#### Counterweight (`balance`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Perfectly balanced | Balance all four scales in par hangs. | Classic | Par | finish, `hangsUsed` ≤ `parHangs` |  | `balance.perfectly-balanced` |
| Heavyweight | Balance all four within 60 s. | Classic | Speed | finish, `parts.speed` ≥ 35 (by 60 s) |  | `balance.heavyweight` |

#### Integer Pyramid (`numpyramid`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Solid base | Build all four pyramids clean. | Classic | Clean | finish, `cleanPyramids` ≥ 4 |  | `numpyramid.solid-base` |
| Pharaoh | Score 200 on Expert. | Expert | Perfect | `score` ≥ 200 | ● | `numpyramid.pharaoh` |

#### Brimful (`measure`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Fill her up | Measure all four targets. | Classic | Finish | finish |  | `measure.fill-her-up` |
| Not a drop spilt | Measure all four in par pours. | Classic | Par | finish, `pours` ≤ `parPours` |  | `measure.not-a-drop-spilt` |
| Quick pint | Measure all four within 60 s. | Classic | Speed | finish, `parts.speed` ≥ 35 (by 60 s) |  | `measure.quick-pint` |

#### Checkout (`checkout`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Game shot | Check out all five boards. | Classic | Finish | finish |  | `checkout.game-shot` |
| Fewest darts | Check out all five in the fewest darts. | Classic | Par | finish, `darts` ≤ `fewestDarts` |  | `checkout.fewest-darts` |
| Big fish | Take every big finish on offer. | Classic | Max-out | finish, `bigFinishes` ≥ `bigBoards`, `bigBoards` ≥ 1 |  | `checkout.big-fish` |

#### Ballpark (`numline`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| In the ballpark | Place all 15 with none wildly off. | Classic | Clean | finish, `wild` = 0 |  | `numline.in-the-ballpark` |
| Bullseye | Land eight bullseyes. | Classic | Target | `bullseyes` ≥ 8 |  | `numline.bullseye` |
| Fifteen bulls | Land a bullseye with every number. | Classic | Max-out | `bullseyes` ≥ 15 | ● | `numline.fifteen-bulls` |

#### Tenfall (`tendrop`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Ten out of ten | Hit all ten targets. | Classic | Finish | `cleared` ≥ 10 |  | `tendrop.ten-out-of-ten` |
| No overshoot | Hit all ten without a reset. | Classic | Clean | `cleared` ≥ 10, `resets` = 0 |  | `tendrop.no-overshoot` |
| Gold tens | Hit all ten targets with a gold tile. | Classic | Max-out | `cleared` ≥ 10, `goldTens` ≥ 10 |  | `tendrop.gold-tens` |

#### Kakuro (`kakuro`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Sum total | Fill the grid with no wrong digits. | Classic | Clean | finish, `mistakes` = 0 |  | `kakuro.sum-total` |
| Mental arithmetic | Fill a Hard grid. | Hard | Finish | finish |  | `kakuro.mental-arithmetic` |
| Human calculator | Fill the grid within 60 s. | Classic | Speed | finish, `parts.speed` ≥ 40 (by 60 s) |  | `kakuro.human-calculator` |

#### Iron Wall (`bastion`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Drone strike | Down all three drones. | Classic | Full set | line “Drones” = 30 of 30 |  | `bastion.drones` |
| Hold the wall | Keep the base untouched. | Classic | Clean | line “Base intact” = 10 of 10 |  | `bastion.base` |
| Quick hands | Make ten fast reloads. | Classic | Max-out | line “Fast reloads” = 20 of 20 |  | `bastion.quick-hands` |
| Weak at the knees | Land 30 hits on glowing weak spots. | Classic | Max-out | line “Weak spots” = 30 of 30 | ● | `bastion.weak-at-the-knees` |

#### Roofbound (`flip`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Double or nothing | Land eight double flips. | Classic | Combo | line “Double flips” = 20 of 20 |  | `flip.double-or-nothing` |
| Sweet spot | Land every sweet spot. | Classic | Full set | line “Perfect landings” = 60 of 60 |  | `flip.sweet-spot` |
| Flow rider | Make 50 clean jumps in a row. | Classic | Streak | line “Flow streak” = 20 of 20 | ● | `flip.flow-rider` |

#### Grappler (`swing`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Gatecrasher | Fly through every gate. | Classic | Full set | line “Gates” = 10 of 10 |  | `swing.gatecrasher` |
| Vine time | Make ten runs of eight clean swings. | Classic | Streak | line “Clean-swing streak” ≥ 20 |  | `swing.vine-time` |
| King of the swingers | Get 70 % of the way on Expert. | Expert | Max-out | line “Course” = 110 of 110 |  | `swing.king-of-the-swingers` |

#### Moon Climb (`ricochet`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Scroll keeper | Grab all three scrolls. | Classic | Full set | line “Scrolls” = 15 of 15 |  | `ricochet.scroll-keeper` |
| Lantern lift | Ride all six sky lanterns. | Classic | Full set | line “Lantern rides” = 30 of 30 |  | `ricochet.lantern-lift` |
| Moonwalker | Climb 245 m on Hard. | Hard | Max-out | line “Height” = 125 of 125 |  | `ricochet.moonwalker` |

#### High Rise (`skyline`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Gold top | Land all five gold blocks perfectly. | Classic | Full set | line “Gold blocks” = 20 of 20 |  | `skyline.gold` |
| Thirty perfect | Make 30 perfect drops. | Classic | Target | `perfects` ≥ 30 |  | `skyline.perfects` |
| Steady crane | Make ten perfect drops in a row. | Classic | Streak | line “Perfect streak” = 10 of 10 |  | `skyline.steady-crane` |
| Skyscraper | Build 61 floors on Expert. | Expert | Max-out | line “Floors” = 140 of 140 | ● | `skyline.skyscraper` |

#### Slice (`slice`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Mild | Score 100 without cutting a chilli. | Classic | Clean | `score` ≥ 100, `bombsHit` = 0 |  | `slice.mild` |
| Golden delicious | Slice every golden fruit. | Classic | Full set | `goldenSliced` ≥ `goldenDealt`, `goldenDealt` ≥ 1 |  | `slice.golden-delicious` |
| Combo chef | Slice 110 foods in combos. | Classic | Combo | tile “Combo foods” ≥ 110 |  | `slice.combo-chef` |

#### Orbit (`orbit`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Sun seeker | Reach the sun. | Classic | Finish | `finished` = 1 |  | `orbit.sun-seeker` |
| Slingshot | Pull all four slingshots. | Classic | Full set | line “Slingshots” = 12 of 12 |  | `orbit.slingshot` |
| Stargazer | Collect all the stardust on Hard. | Hard | Full set | line “Stardust” = 15 of 15 |  | `orbit.stargazer` |

#### Tempo (`beat`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Fever pitch | Start all four fevers. | Classic | Full set | line “Fever” = 25 of 25 |  | `beat.fever-pitch` |
| Golden ear | Hit every golden note dead on. | Classic | Max-out | line “Golden notes” = 15 of 15 |  | `beat.gold` |
| Encore | Score 180 or more. | Classic | Big score | `score` ≥ 180 | ● | `beat.score180` |

#### Blockzone (`blockfall`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Thirty lines | Clear 30 lines. | Classic | Target | `lines` ≥ 30 |  | `blockfall.thirty-lines` |
| Low rider | Finish with the stack in the bottom four rows. | Classic | Clean | line “Low stack” = 16 of 16 |  | `blockfall.low` |
| Multi-tasker | Clear four lines at once twice (or six doubles). | Classic | Combo | line “Multi-line clears” = 24 of 24 |  | `blockfall.multi` |

#### Breaker (`breaker`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Twenty-four carat | Break every gold brick. | Classic | Full set | `goldBroken` ≥ `goldDealt`, `goldDealt` ≥ 1 |  | `breaker.twenty-four-carat` |
| No drops | Score 100 without losing a ball. | Classic | Clean | `score` ≥ 100, `losses` = 0 |  | `breaker.no-drops` |
| Wall breaker | Clear the whole wall on Hard. | Hard | Finish | `cleared` = 1 |  | `breaker.wall-breaker` |

#### Fission (`burst`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Golden touch | Pop all five golden atoms. | Classic | Full set | `goldens` ≥ `goldensDealt`, `goldensDealt` ≥ 5 |  | `burst.golden-touch` |
| Sharpshooter | Pop 40 atoms without a wasted-shot cost. | Classic | Clean | `atoms` ≥ 40, `missCost` = 0 |  | `burst.sharpshooter` |
| Meltdown | Clear all five waves. | Classic | Finish | `done` = 1 |  | `burst.meltdown` |

#### Spacewalk (`cross`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Unscathed | Make four crossings without a hit. | Classic | Clean | `crossings` ≥ 4, `livesLost` = 0 |  | `cross.unscathed` |
| Near miss | Make ten close calls. | Classic | Target | `closeCalls` ≥ 10 |  | `cross.near-miss` |
| Keep moving | Make four no-stop crossings, each after a no-stop one. | Classic | Streak | `streakPts` ≥ 40 | ● | `cross.keep-moving` |

#### Hover (`hover`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Tight squeeze | Thread all five tight gates. | Classic | Full set | `tightGates` ≥ 5 |  | `hover.tight-squeeze` |
| Chain gang | Complete all five star chains. | Classic | Full set | `chainPts` ≥ 30 |  | `hover.chain-gang` |
| All the way | Pass every barrier. | Classic | Finish | `gates` ≥ `totalGates`, `totalGates` ≥ 1 | ● | `hover.all-the-way` |

#### Pinball (`pinball`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Multiball madness | Start multiball. | Classic | Target | line “Multiball” = 20 of 20 |  | `pinball.multiball` |
| Spell it out | Spell J-O-U-L-Z twice. | Classic | Max-out | line “J-O-U-L-Z” = 20 of 20 |  | `pinball.joulz` |
| Jackpot | Hit three jackpots. | Classic | Full set | line “Jackpots” = 15 of 15 | ● | `pinball.jackpot` |

#### Rally (`rally`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Pink pong | Strike pink pads five times. | Classic | Target | line “Pink pads” ≥ 15 |  | `rally.pink-pong` |
| Target practice | Hit all six gold targets. | Classic | Full set | line “Gold targets” = 30 of 30 |  | `rally.target-practice` |
| Rally king | Return 23 gold balls on Hard. | Hard | Max-out | line “Gold-ball hits” = 140 of 140 |  | `rally.rally-king` |

#### Meteor (`snake`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Star eater | Eat 28 stars; a gold star counts as two. | Classic | Target | `meteorParts.core` ≥ 120 |  | `snake.star-eater` |
| Comet tail | Score 150 or more. | Classic | Big score | `score` ≥ 150 |  | `snake.comet-tail` |
| Golden comet | Eat all seven gold stars. | Classic | Full set | `goldStars` ≥ `goldStarsDealt`, `goldStarsDealt` ≥ 7 |  | `snake.golden-comet` |

#### Wavefront (`wavefront`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Boss fight | Destroy the boss. | Classic | Finish | `bossKilled` ≥ 1 |  | `wavefront.boss-fight` |
| Saucer spotter | Shoot all five saucers. | Classic | Full set | `saucers` ≥ 5 |  | `wavefront.saucer-spotter` |
| Not a scratch | Destroy the boss without losing a life. | Hard | Clean | `bossKilled` ≥ 1, `lives` ≥ 3 | ● | `wavefront.not-a-scratch` |

#### Ringer (`alleyroll`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Pocket rocket | Land in both 100 pockets. | Classic | Full set | line “Pocket hits” = 10 of 10 |  | `alleyroll.pocket-rocket` |
| Hot hand | Roll five 30+ balls, each straight after another 30+ ball. | Classic | Streak | line “Roll streak” = 20 of 20 |  | `alleyroll.hot-hand` |
| Gold cup final | Land in the gold cup three times on Hard. | Hard | Full set | line “Gold cup” = 30 of 30 |  | `alleyroll.gold-cup-final` |

#### Swish (`bintoss`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Hoop dreams | Throw through all three hoops. | Classic | Full set | line “Hoops” = 24 of 24 |  | `bintoss.hoops` |
| Nothing but bucket | Get all ten in. | Classic | Clean | line “All ten in” = 10 of 10 |  | `bintoss.finish` |
| Long range | Hit the far bucket on all six chances. | Classic | Max-out | line “Far buckets” = 36 of 36 | ● | `bintoss.long-range` |

#### Flightpath (`bullseye`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| On a roll | Throw four golds in a row. | Classic | Streak | line “Bull streaks” ≥ 6 |  | `bullseye.on-a-roll` |
| Dead centre | Hit the dead-centre ring on every board with a 10 in the middle. | Classic | Max-out | line “Dead-centre darts” = 20 of 20 |  | `bullseye.dead` |
| One hundred and twelve | Score 112 with your ten darts. | Classic | Max-out | line “Dart total” = 150 of 150 |  | `bullseye.one-hundred-and-twelve` |

#### Crazy Golf (`minigolf`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Birdie | Hole one under par. | Classic | Par | line “Under par” ≥ 4 |  | `minigolf.birdie` |
| Par for the course | Hole all five in par or better. | Classic | Par | line “Par” = 40 of 40 |  | `minigolf.par-for-the-course` |
| Quick round | Hole all five within 53 s. | Classic | Speed | line “Speed” = 20 of 20 |  | `minigolf.quick-round` |
| Under, under | Hole all five under par on Hard. | Hard | Par | line “Under par” = 20 of 20 | ● | `minigolf.under-under` |

#### Cue Ball (`pool`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Behind the eight | Pot the black. | Classic | Finish | line “Black” = 10 of 10 |  | `pool.black` |
| Clean break | Pot the black without a foul. | Classic | Clean | line “Black” = 10 of 10, `fouls` = 0 |  | `pool.clean-break` |
| Run out | Pot a ball straight after another, six times. | Classic | Streak | line “Pots in a row” = 30 of 30 |  | `pool.streak` |

#### Curl Champ (`curling`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Shot stone | Finish holding shot. | Classic | Target | line “Holding shot” = 10 of 10 |  | `curling.shot-stone` |
| House clearance | Knock every red out of the house. | Classic | Max-out | line “Takeouts” = 20 of 20 |  | `curling.house-clearance` |
| Red ring circus | Stop all eight stones in the red ring. | Classic | Full set | line “Red ring” = 20 of 20 | ● | `curling.red-ring-circus` |

#### Home Run (`homerun`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Sign here | Hit the lit sign five times. | Classic | Target | line “Bonus signs” ≥ 10 |  | `homerun.sign-here` |
| Out of the park | Hit ten home runs. | Classic | Full set | line “Home runs” = 40 of 40 |  | `homerun.homers` |
| Perfect ten | Make ten perfect swings in a row. | Classic | Streak | line “Perfect streak” = 20 of 20 | ● | `homerun.streak` |

#### Top Bins (`freekick`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Five alive | Score five in a row. | Classic | Streak | line “Five in a row” = 10 of 10 |  | `freekick.five-alive` |
| Bend it | Score five well-bent goals. | Classic | Target | line “Curl bonus” ≥ 10 |  | `freekick.bend-it` |
| Top bins | Score through all four hoops. | Classic | Full set | line “Targets” = 40 of 40 | ● | `freekick.top-bins` |

#### Apex (`racing`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Clean half | Drive four sectors clean. | Classic | Clean | line “Clean sectors” ≥ 20 |  | `racing.clean-half` |
| Two hundred club | Average 200 km/h. | Classic | Speed | line “Pace” ≥ 110 |  | `racing.two-hundred-club` |
| Grand slam | Drive all eight sectors clean on Expert. | Expert | Clean | line “Clean sectors” = 40 of 40 |  | `racing.grand-slam` |

#### Five Hands (`fivehands`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Handsome | Score 150 or more. | Classic | Big score | `score` ≥ 150 |  | `fivehands.handsome` |
| Pick of the bunch | Pick the best bonus column on the table. | Classic | Par | `column` ≥ 0, `columnPoints` ≥ `bestColumnPoints` |  | `fivehands.pick-of-the-bunch` |
| High roller | Score 170 or more on Hard. | Hard | Big score | `score` ≥ 170 | ● | `fivehands.high-roller` |

#### Free Cell (`freecell`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| All home | Get all 40 cards home. | Classic | Finish | line “Cards” = 105 of 105 |  | `freecell.all-home` |
| By the book | Finish in par moves. | Classic | Par | line “Par moves” = 50 of 50 |  | `freecell.by-the-book` |
| Card sharp | Finish within 32 s. | Classic | Speed | line “Speed” = 45 of 45 | ● | `freecell.card-sharp` |

#### Mahjong Solitaire (`mahjong`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| No shuffle | Clear the stack without a Shuffle. | Classic | Clean | line “Pairs” = 150 of 150, line “No shuffles” = 20 of 20 |  | `mahjong.no-shuffle` |
| Tile rush | Clear a Hard stack within 65 s. | Hard | Speed | line “Speed” = 30 of 30 |  | `mahjong.tile-rush` |

#### Minefield (`minesweeper`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Light feet | Clear the board without hitting a mine. | Classic | Clean | line “Safe squares” = 150 of 150, line “No mines hit” = 20 of 20 |  | `minesweeper.light-feet` |
| Sweep | Clear the board within 37 s. | Classic | Speed | line “Speed” = 30 of 30 |  | `minesweeper.sweep` |
| Bomb disposal | Clear an Expert field. | Expert | Finish | line “Safe squares” = 150 of 150 | ● | `minesweeper.bomb-disposal` |

#### Thirteen (`pyramid`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Lucky thirteen | Clear the pyramid. | Classic | Finish | line “Cleared” = 15 of 15 |  | `pyramid.lucky-thirteen` |
| Paired up | Make ten pairs from two pyramid cards. | Classic | Combo | line “Pyramid pairs” = 20 of 20 |  | `pyramid.paired-up` |
| Unlucky for some | Clear the pyramid within 20 s. | Classic | Speed | line “Speed” = 25 of 25 |  | `pyramid.unlucky-for-some` |

#### Summit (`tripeaks`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Peak bagger | Clear all three peak tops. | Classic | Full set | line “Peak tops” = 30 of 30 |  | `tripeaks.peak-bagger` |
| Up and down | Make a run of ten cards. | Classic | Streak | line “Longest run” = 10 of 10 |  | `tripeaks.up-and-down` |
| Base camp | Clear it within stock par. | Classic | Par | line “Stock par” = 20 of 20 |  | `tripeaks.base-camp` |
| Summit sprint | Clear a Hard deal within 20 s. | Hard | Speed | line “Speed” = 25 of 25 | ● | `tripeaks.summit-sprint` |

#### Ball Tracker (`balltrack`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Combo breaker | Get ten combos: marbles home from the third in a row onwards. | Classic | Combo | line “Combos” ≥ 10 |  | `balltrack.combo-breaker` |
| Golden marbles | Send all six gold marbles home. | Classic | Full set | line “Gold marbles” = 25 of 25 |  | `balltrack.golden-marbles` |
| Lost no marbles | Send all 36 marbles home. | Classic | Max-out | line “Marbles home” = 140 of 140 | ● | `balltrack.lost-no-marbles` |

#### Coral Pop (`bubble`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Reef raider | Clear the whole reef. | Classic | Finish | line “Reef cleared” = 10 of 10 |  | `bubble.clear` |
| Treasure chest | Drop all six chests. | Classic | Full set | line “Chests” = 30 of 30 |  | `bubble.chests` |
| Off the wall | Make 30 bank shots on Hard. | Hard | Max-out | line “Bank shots” = 15 of 15 |  | `bubble.off-the-wall` |

#### Rainbow Bridge (`inkbridge`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Lucky clover | Collect both clovers. | Classic | Full set | line “Clovers” = 10 of 10 |  | `inkbridge.lucky-clover` |
| Ink saver | Finish every level within ink par. | Classic | Par | line “Ink par” = 30 of 30 |  | `inkbridge.ink-saver` |
| Show-off | Land all four trick shots. | Classic | Full set | line “Trick shots” = 20 of 20 | ● | `inkbridge.show-off` |

#### Gemstone (`matchup`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| Ice breaker | Break all ten frozen cells. | Classic | Max-out | line “Ice” = 10 of 10 |  | `matchup.ice-breaker` |
| Goal getter | Meet all six colour goals. | Classic | Full set | line “Colour goals” = 36 of 36 |  | `matchup.goal-getter` |
| Treasure hunter | Bring all six treasures down on Expert. | Expert | Full set | line “Treasure” = 36 of 36 |  | `matchup.treasure-hunter` |

#### Tilt (`tilt`)

| Name | Goal | Level | Style | Check | Coin | Id |
|---|---|---|---|---|:-:|---|
| No falls | Finish all four mazes without a marble falling. | Classic | Clean | line “Clean run” = 12 of 12 |  | `tilt.no-falls` |
| Par four | Beat par time in all four mazes. | Classic | Par | line “Par” = 24 of 24 |  | `tilt.par-four` |
| Marble madness | Finish all four Hard mazes within 60 s. | Hard | Speed | line “Speed” = 24 of 24 | ● | `tilt.marble-madness` |
