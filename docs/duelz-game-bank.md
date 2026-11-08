# Joulz — Game Bank

The reference list of every game: active, retired to practice, and deleted. **Rewritten 7 Nov 2026 from the code on `main` after `cc8e1643` and the text corrections of the same day**, the way the 13 Oct rewrite was done: names from `gameNames.ts`, status from the registry (`RETIRED_TYPES` in `registry.ts`; deleted games in `removedGames.ts`), categories from the registry, arcade groups from `arcadeGroups.ts` and "also in" from `alsoIn.ts`, clocks from the puzzle a new round is dealt (`puzzleTimeLimitMs`, which a stored puzzle's own limit overrides), revisions from what `generatePuzzle()` stamps on a new round today (the same table as `practiceStamps.data.ts`), and play and score parts from each game's intro and "?" help (`instructions.ts`, `introScore.ts`, the arcade `*_STD_SPEC` parts). Where this doc and the code disagree, the code wins. The full history is in `CLAUDE.md`; formulas are in `docs/scoring-standard.md`, `docs/arcade-standard/` and `docs/duelz-scoring-reference.md`.

Legend: **Active** = dealt in rooms · **Retired** = practice only, never dealt in rooms (stored rounds still replay and score on their own rules). Internal ids (in brackets) never change; only display names do. **Clock** is the round's clock; arcade and engine games run 3 s less (the arcade slack), so a 63 s clock is a 60 s run. **Revision** is the game's own stamp on a new round; every new round also carries `puzzleScoreRev 3` and `speedPar 1`, not repeated below. **Score** is the parts as the "?" help lists them; every active game totals 200.

## Totals (7 Nov 2026, from the registry)

| Category | Active in rooms | Retired (practice only) | Total |
|---|---:|---:|---:|
| Word | 9 | 1 | 10 |
| Number | 9 | 0 | 9 |
| Speed | 6 | 0 | 6 |
| Attention | 7 | 0 | 7 |
| Pattern | 10 | 0 | 10 |
| Logic | 14 | 1 | 15 |
| Arcade | 37 | 10 | 47 |
| **Total** | **92** | **12** | **104** |

Arcade's 37 by group: Retro 10, Sports 9, Cards & Board 6, Action 7, Strategy 5. Retired arcade games outside a group: Swerve, Steady, Dual, Rooftop Run, Junction, Hot Floor, Scrumper; retired Cards & Board games: Full House, Golf Solitaire, Muggins. These match the totals in `CLAUDE.md`. Every puzzle category and Arcade keep at least 6 active games (`category-pool-check` pins the counts); the arcade groups run from 5 (Strategy) to 10 (Retro).

Engine games outside Arcade (run on the arcade engine, 3 s slack): Tenfall (Number), Bonk and Pull! (Speed), Mixed Signals (Attention); Letterfall (Word) is retired. "Also in": Pull! (Speed) is also in the Sports pick (`alsoIn.ts`), counted once under Speed.

The 19 games deleted on 14 Oct 2026 (Interloper, Groups, Word Match, Word Ladder, Chain Calculation, Number Sequence, Percent Sprint, Sum Hunt, Sequence Recall, Reverse Recall, Spatial Memory, Number Climb, Go / No-Go, Pattern Completion, Spin, Mirror Match, One-Stroke, Sort Rush, Parry) are not counted: old rooms' rounds of them show only the name and stored score (`removedGames.ts`).

## What changed since 14 Oct

Detail and dates for every item are in `CLAUDE.md`.

- **App name:** Duelz is shown as **Joulz** (22 Oct); storage keys, tables and file names keep the old name.
- **Renames (ids unchanged):** Jumbled → Gradient (27 Oct); Minesweeper → Minefield, FreeCell → Free Cell, TriPeaks → Summit, Poker Squares → Full House, Home Run Derby → Home Run, Free Kick → Top Bins, Racing → Apex, Minigolf → Crazy Golf, Speed Pool → Cue Ball, Curling → Curl Champ (31 Oct); Fences → Loopline, Fillomino → Regions, Bridges → Island Link, Pyramid → Thirteen, Alley Roll → Ringer, Blockfall → Blockzone, Ricochet → Moon Climb, Bastion → Iron Wall, Jaywalk → Spacewalk (3 Nov).
- **Added:** the Cards & Board games (Minefield, Mahjong Solitaire, Free Cell, Summit and Full House 30 Oct; Five Hands 31 Oct; Thirteen, Golf Solitaire and Muggins 1 Nov); the Sports games (Home Run, Top Bins, Apex, Crazy Golf, Cue Ball, Curl Champ 30 Oct; Ringer 1 Nov); Blockzone (1 Nov); Moon Climb and Iron Wall back in rooms as new games under their old ids (1 Nov); Kakuro (Number) and Loopline, Regions, Island Link (Logic), 1 Nov.
- **Retired to practice:** Letterfall (20 Oct), Scrumper (27 Oct), Full House (1 Nov), Muggins (practice only from launch, 2 Nov), Golf Solitaire (3 Nov).
- **Moves:** Trail Number → Logic (27 Oct); Bomb Defusal Logic → Attention (3 Nov); arcade groups for browsing and room picks (30 Oct; Strategy split from Action 1 Nov; High Rise back to Action and Orbit Retro → Action 3 Nov); Pull! also in Sports (3 Nov).
- **Scoring:** every active game scores to 200 on one of two standards (puzzles 27 Oct, arcade 29 Oct); see "Score model". The Oct 2026 150-point bands now describe stored rounds only.
- **Rooms:** room settings (31 Oct: presets, 3–12 rounds, eleven picks), rooms of up to 16 players (31 Oct), and the Placings scoring choice (6 Nov).
- **Totals:** 74 active / 9 retired on 14 Oct → 92 active / 12 retired today.

---

## How rooms use the bank

**Room settings (31 Oct 2026, `roomSettings.ts`).** The host picks from eleven chips: the six puzzle categories (Word, Number, Speed, Attention, Pattern, Logic) and the five arcade groups (Retro, Sports, Cards & Board, Action, Strategy). Presets: **Mixed** (the default: Word, Speed, Attention, Pattern, Logic and all five arcade groups), **Puzzles only** (all six puzzle categories) and **Arcade only** (the five groups). Rounds: 3–12 (quick buttons 3 / 6 / 9 / 12, default 6), capped at the picks' room-eligible games. Settings rooms deal through `dealRoomRounds` from the room seed: shares within 1 per pick, a seeded order with no pick twice running, no game twice in a room, the host's last three rooms avoided. Rooms saved without settings keep the older `pickRoundOrder` (6 rounds, 7 with all seven categories). Up to 16 players (`MAX_PLAYERS`; the migration that lifts the database's 10 is written but not applied). Everything a round needs is derived once from the room seed on the server and stored, so every player gets the same rounds.

**Room scoring (6 Nov 2026, `scoringMode.ts`).** **Total score** (the default; every earlier room) adds each round's score. **Placings** gives points by place each round (2 players 1, 0; 3: 3, 1, 0; 4: 5, 3, 1, 0; 5–8: 10, 7, 5, 4, 3, 2, 1, 0; 9–16: 15, 12, 10, 8, 6, 5, 4, 3, 2, 1, then 0; level scores share the higher points); most points wins, then total score, then the tie-break time. Until migration `20261108120000_room_scoring_mode.sql` is applied, every room reads as Total and the control is hidden.

**Score model.** Every round's maximum is 200 (`ROUND_MAX`).
- **Puzzle standard** (`docs/scoring-standard.md`): a finish scores 150 + speed (full by the game's "full by" time, falling to 0 at the buzzer) + the game's bonus parts (par, clean play, first try and so on), at most 200; unfinished credit is at most 130, with extra for progress made early. Nucleus, Forage, Flash, Bang On, Bonk and Pull! keep their own part lists (still to 200). The new grid puzzles (Kakuro, Loopline, Regions, Island Link) were born on it; wrong entries count against unfinished credit, so guessing never pays.
- **Arcade standard** (`docs/arcade-standard/README.md`): a core measure on a straight line plus fixed-amount features, the parts' maximums summing to exactly 200; speed only on a completed run; any played run scores at least 1. Five Hands is the one named exception: its × 1.4 hand total is capped at 200 and not every deal reaches it.
- The server is the arbiter: phones send moves, answers, tap logs or input logs, never scores; arcade inputs are replayed on the server's deterministic engine. Older stamps replay and score exactly as they were dealt.

**Dictionary.** A SCOWL-based British list on the server (`dictionary.server.ts`); Strikeout, Cryptogrid and Swapword answers from the common-words list. Licensing quotes are a master-plan item.

**Intro demos.** Many games changed rules or look on new stamps; `docs/demo-replay-audit.md` "Re-record list" names every demo still to record. Until then the intro shows the game's still.

---

## Word — 9 active

| Game (id) | Status | Play | Score (200) | Clock | Revision |
|---|---|---|---|---|---|
| Nucleus (wordsmith) | Active | Tap tiles to make 4+ letter words that use the centre letter; Shuffle is free; no plurals. | Words 180 (longer words more word points) + every-tile word 20. | 100 s | wordsmithRev 4 |
| Forage (wordhunt) | Active | Drag or tap through touching letters, diagonals too; 4+ letters, plurals count; 6+ letters and the gold tile multiply. | Words 150 + long words and gold 50; past 10 + 2 a word found, each non-word takes 3 % off. | 100 s | wordHuntRev 4 |
| Interlock (tilegrid) | Active | Place all 15 tiles in one connected mini crossword, every run a real word of 3+ letters. | Finish 150 + speed 20 (full within 33 s) + big words 30; unfinished up to 130. | 100 s | tileGridRev 3 |
| Slider (wordslide) | Active | Swipe rows and columns (letters wrap) until all five rows are words; padlock finished rows; with four locked, swap two tiles in the last row. | Finish 150 + speed 35 (33 s) + moves 15 (par, 0 at twice par); unfinished up to 130. | 100 s | wordSlideRev 4 |
| Lookout (wordsearch) | Active | Find six themed words in a letter grid (any straight line, backwards too); a seventh theme word hides unlisted. | Finish 150 + speed 20 (40 s) + bonus word 30; unfinished up to 130; wrong drags past 5 cost 2. | 120 s | wordSearchRev 4 |
| Roundabout (letterwheel) | Active | Drag across a letter wheel to fill a crossword; other real words fill a bonus jar. | Finish 150 + speed 20 (40 s) + bonus jar 30; unfinished up to 130; misses past 5 cost 3. | 100 s | wheelRev 4 |
| Strikeout (strikeout) | Active | Reveal five long words one at a time on a letter keypad (three vowel guesses a word) or Solve; twelve strikes in all. | Finish 150 + speed 20 (40 s) + early solves 20 + strikes left 10; unfinished up to 130. | 100 s | strikeoutRev 7 |
| Cryptogrid (codeword) | Active | A crossword in numbers: give each number its letter; six start decoded. | Finish 150 + speed 40 (60 s) + clean crack 10; unfinished up to 130; wrong letters left cost 5. | 120 s | codewordRev 5 |
| Swapword (swapword) | Active | Swap tiles until six crossing words read (gold in place, teal belongs elsewhere); swaps are limited. | Finish 150 + speed 20 (60 s) + swaps 30 (par, 0 at twice par); unfinished up to 130. | 120 s | swapwordRev 7 |
| Letterfall (wordfall) | Retired (engine) | Tap touching tiles in a falling well to spell words; an overflowing column ends the run. | Word points on its older 150 curve. | 93 s | wordfallRev 3 |

## Number — 9 active (in Puzzles only; not in Mixed)

| Game (id) | Status | Play | Score (200) | Clock | Revision |
|---|---|---|---|---|---|
| Exact (target) | Active | Combine six numbers with + − × ÷ (whole steps only) to make the target. | Finish 150 + speed 35 (30 s) + elegance 15 (fewest numbers); not exact up to 130: the share of a solution built or closeness, whichever is more. | 75 s | depthRev 4 |
| Operator (equation) | Active | Four equations worked left to right: gold circles take a sign, teal squares a number from the tray; any true fill counts. | Finish 150 + speed 40 (60 s) + first try 10; unfinished up to 130 (30 an equation). | 90 s | gapsRev 1 (with equationRev 1, depthRev 2) |
| Counterweight (balance) | Active | Hang kettlebells on notches until each of four scales balances; hangs are limited. | Finish 150 + speed 35 (60 s) + hangs 15; unfinished up to 130 (30 a scale). | 120 s | balanceRev 3, depthRev 2 |
| Integer Pyramid (numpyramid) | Active | Four pyramids: drag tiles in so each cell is the sum of the two below; two decoys each. | Finish 150 + speed 40 (75 s) + clean pyramids 10; unfinished up to 130. | 120 s | depthRev 2 |
| Brimful (measure) | Active | Four pouring puzzles: measure the target with jugs, tap and drain; every action is a move. | Finish 150 + speed 35 (60 s) + pours 15 (par, 0 at twice par); unfinished up to 130 (30 a puzzle). | 120 s | measureRev 3, depthRev 3 |
| Checkout (checkout) | Active | Darts maths on five boards: hit zero exactly and finish in the ring shown. | Finish 150 + speed 30 (60 s) + darts 10 + big finishes 10; unfinished up to 130 (24 a board). | 90 s | checkoutRev 2, depthRev 3 |
| Ballpark (numline) | Active | Drag a marker to place 15 numbers on lines labelled only at the ends. | Accuracy 150 (full within 2 %, 0 at 15 %) + speed 20 (60 s, times accuracy) + bullseyes 30; unfinished up to 130; 25 % off costs 1. | 90 s | numlineRev 2, depthRev 2 |
| Tenfall (tendrop) | Active (engine) | Tap falling tiles (×2, ÷2, ÷3, −N) so a running total hits ten targets; overshooting resets it to 0. | Finish 150 + speed 30 (60 s) + gold tiles 20; unfinished up to 130 (12 a target); resets past 4 cost 5. | 93 s | tenRev 5 |
| Kakuro (kakuro) | Active (since 1 Nov) | Fill white squares 1–9 so every run adds to its clue, no digit twice in a run. | Finish 150 + speed 40 (60 s) + clean grid 10; unfinished up to 130. | 120 s | kakuroRev 1 |

## Speed — 6 active

| Game (id) | Status | Play | Score (200) | Clock | Revision |
|---|---|---|---|---|---|
| Flash (reaction) | Active | Tap the instant the screen turns fully gold, 5 to 8 times among decoys; early taps are false starts. | Reactions 186 (full at 120 ms average) + steady hand 15, total capped at 200; false starts cost 8, then 11. | 60 s | tapRev 6 |
| Bang On (stopwatch) | Active | Stop the sweeping marker in the gold zone on ten watches, some with blind spots. | Closeness 150 + dead centre and zone streak together up to 50. | 60 s | tapRev 6 |
| Ascend (numhunt) | Active | Tap 24 numbers smallest to largest; untapped ones move every 15 s. | Finish 150 + speed 40 (40 s) + flow 10; unfinished up to 130; wrong taps cost 5. | 60 s | tapRev 6 |
| Don’t Break the Chain (chain) | Active | Tap 40 charms following a five-charm cycle before the gold ring empties; five links run backwards after link 20. | Finish 150 + speed 50 (30 s); unfinished up to 130. | 45 s | chainDepthRev 3 (with chainCycleRev 1, chainTimeRev 1, rulesVersion 2) |
| Bonk (whack) | Active (engine) | Bonk gophers in the banner’s hat colour as the rule flips 3 to 5 times; never a hedgehog. | Hits 150 + combo 44 + diamonds 6; a wrong hat or empty tap costs 3, a hedgehog 5. | 63 s | whackRev 4 |
| Pull! (clayshoot) | Active (engine; also in Sports) | Shoot 25 clays where you tap (gold faster, worth double); avoid the 14–16 birds. | Clays 110 + quick hits 40 + doubles 14 + streak 36; a bird costs 10. | 63 s | clayRev 9 |

## Attention — 7 active

| Game (id) | Status | Play | Score (200) | Clock | Revision |
|---|---|---|---|---|---|
| Mixed Signals (stroop) | Active (engine) | Steer 52 falling colour words into gates by ink or meaning as the rule swaps every 15 s; let grey words fall. | Finish 150 + speed 15 + streak 20 + gold words 15; unfinished up to 130. | 78 s | clashRev 10 |
| Eagle Eye (symscan) | Active | Three growing grids of eagles: tap every one facing the target’s way, then Submit. | Finish 150 + speed 10 (20 s) + clean grids 40; unfinished up to 130; wrong eagles left cost 3. | 30 s | scanRev 4 |
| Double Take (spotdiff) | Active | Find six differences in each of two pictures; one hides a subtle seventh. | Finish 150 + speed 20 (40 s) + no wrong taps 10 + hidden difference 20; unfinished up to 130; wrong taps cost 4. | 60 s | spotRev 3 |
| Tally (countup) | Active | Count what each of four trays asks for (a shape, a colour or both; tray 4 compares two colours). | Finish 150 + speed 50 (30 s); unfinished up to 130 (30 a tray). | 60 s | countRev 6 |
| Labyrinth (maze) | Active | Drag a path through the maze from start to exit; par shown. | Finish 150 + speed 30 (32 s) + moves 20 (par, 0 at 1.5 × par); unfinished up to 130. | 60 s | mazeRev 5 |
| Matchmaker (pairmatch) | Active | Turn two cards at a time to find 15 pairs. | Finish 150 + speed 30 (60 s) + streak 5 + gold pair 15 (first 30 s); unfinished up to 130. | 90 s | pairRev 3 |
| Bomb Defusal (bomb) | Active (from Logic, 3 Nov) | Read every clue to fix six steps in one order, do them and DEFUSE; one wrong step and it explodes. | Defuse 150 + speed 50 (30 s); unfinished up to 130. | 90 s | bombVersion 3, depthRev 2 |

## Pattern — 10 active

| Game (id) | Status | Play | Score (200) | Clock | Revision |
|---|---|---|---|---|---|
| Gridlock (unblock) | Active | Slide blocks along their own direction to free the gold block. | Finish 150 + speed 30 (40 s) + moves 20 (par); unfinished up to 130 by the solver distance closed. | 60 s | unblockRev 3 |
| Tessellate (blockparty) | Active | Rotate and drag pieces to fill the free squares round fixed pegs. | Finish 150 + speed 40 (40 s) + first time 10; unfinished up to 130. | 60 s | blockRev 3 |
| Skid (iceslide) | Active | Swipe to slide until something stops you; arrows, holes and portals; reach the gold exit. | Finish 150 + speed 30 (30 s) + slides 20 (par, 0 at 1.5 × par); unfinished up to 130. | 90 s | slideRev 4 |
| Topsy-Turvy (gravity) | Active | Three boards: tilt so every ball rolls into its own colour’s hole. | Finish 150 + speed 30 (32 s) + tilts 20 (par, 0 at 1.5 × par); unfinished up to 130. | 120 s | gravityRev 7 |
| Gradient (tiles) | Active | Swap tiles to rebuild a colour gradient; a tile home locks. | Finish 150 + speed 35 (30 s) + swaps 15 (par, 0 at twice par); swap limit 1½ × par rounded up; unfinished up to 130 by the swap-minimum share, less half a swap for each wasted one. | 120 s | tilesRev 7 |
| Turntable (rings) | Active | Turn linked rings until every spoke is one colour. | Finish 150 + speed 35 (40 s) + turns 15 (par); unfinished up to 130 by the solver distance closed. | 60 s | ringsRev 4 |
| Lightbender (laser) | Active | Place mirrors and a splitter so one beam lights six gems, avoiding bombs; three FIRE shots. | Finish 150 + speed 40 (15 s) + mirrors 5 + first shot 5; unfinished up to 130 (20 a gem). | 60 s | laserRev 3 (with alogRev 1) |
| Chroma Lines (flow) | Active | Join every colour pair with paths that fill every square and never cross. | Finish 150 + speed 40 (20 s) + clean lines 10; unfinished up to 130. | 75 s | flowRev 2 |
| Pipeline (pipes) | Active | Rotate pipe tiles until every pipe joins the source with no leaks. | Finish 150 + speed 40 (60 s) + taps 10 (par); unfinished up to 130. | 120 s | pipesRev 3 |
| Heave (push) | Active | Push every crate onto a mark, the gold crate on the gold mark; crates can’t be pulled. | Finish 150 + speed 25 (45 s) + gold crate 10 + pushes 15 (par); unfinished up to 130. | 120 s | pushRev 3 |

## Logic — 14 active

| Game (id) | Status | Play | Score (200) | Clock | Revision |
|---|---|---|---|---|---|
| Blackout (lightsout) | Active | A press flips a light and its neighbours; turn every light off. | Finish 150 + speed 30 (20 s) + par 20; unfinished up to 130 by the solver distance closed. | 75 s | depthRev 3 |
| Box Six (sudoku) | Active | 6 × 6 sudoku with 2 × 3 boxes and pencil marks. | Finish 150 + speed 40 (45 s) + clean grid 10; unfinished up to 130; wrong digits left cost 5. | 90 s | sudokuRev 1, depthRev 3 |
| Hanoi (tower) | Active | Move the ring tower onto the gold post, never a ring on a smaller one. | Finish 150 + speed 40 (45 s) + par 10; unfinished up to 130 by the solver distance closed. | 90 s | depthRev 3 |
| Polypotions (tubes) | Active | Pour layers until every flask is one colour; pours are limited. | Finish 150 + speed 35 (45 s) + par 15; unfinished up to 130 by the solver distance closed. | 90 s | tubesRev 2, depthRev 3 |
| Safe Cracker (safe) | Active | Set four dials to the one code that fits every clue; three tries. | Open 150 + speed 40 (30 s) + first try 10; unfinished up to 130. | 75 s | depthRev 3 |
| Mosaic (nonogram) | Active | Fill cells so every line matches its runs. | Finish 150 + speed 40 (60 s) + clean picture 10; unfinished up to 130; wrong cells left cost 5. | 120 s | depthRev 2 |
| Colour Flood (flood) | Active | Repaint your region from the top-left until the board is one colour; moves are limited. | Finish 150 + speed 10 (30 s) + par 40 (6.7 less a move over); unfinished up to 130, 0 out of moves. | 60 s | depthRev 4, floodRev 3 |
| Tents and Trees (tents) | Active | Pitch one tent beside every tree; tents never touch; signposts give row and column counts. | Finish 150 + speed 40 (45 s) + clean camp 10; unfinished up to 130; wrong tents left cost 10. | 90 s | depthRev 2 |
| Shikaku (shikaku) | Active | Cut the grid into rectangles, each holding one number equal to its size. | Finish 150 + speed 40 (45 s) + clean cuts 10; unfinished up to 130. | 90 s | depthRev 3 |
| Lamplighter (lightup) | Active | Place bulbs to light every white square without two bulbs seeing each other; numbered walls. | Finish 150 + speed 40 (45 s) + clean board 10; unfinished up to 130; wrong bulbs left cost 5. | 90 s | depthRev 2 |
| Trail (trail) | Active (from Number, 27 Oct) | Draw one path from 1 to 36 through every square, diagonals allowed, passing each fixed number at its step. | Finish 150 + speed 40 (60 s) + clean path 10; unfinished up to 130. | 120 s | depthRev 2 |
| Loopline (fences) | Active (since 1 Nov) | Draw one closed loop along the grid lines; each number is how many of its sides the loop uses. | Finish 150 + speed 40 (45 s) + clean loop 10; unfinished up to 130. | 90 s | fencesRev 1 |
| Regions (fillomino) | Active (since 1 Nov) | Number the grid so every region of N squares holds N; same-size regions never touch. | Finish 150 + speed 40 (45 s) + clean fill 10; unfinished up to 130. | 90 s | fillominoRev 1 |
| Island Link (bridges) | Active (since 1 Nov) | Join islands with straight bridges (at most two a pair, never crossing) to match each island’s number, all connected. | Finish 150 + speed 40 (45 s) + clean build 10; unfinished up to 130. | 90 s | bridgesRev 1 |
| Dig (dig) | Retired | Dig a path so the water reaches the drain. | Its older shape. | 60 s | — |

## Arcade — 37 active

All run on the deterministic engine: 60 ticks a second, integer physics, seeded content identical for everyone in a room, the server replaying the input log. Every active game scores on the arcade standard (parts below). Groups are for browsing, tile borders and room picks only; arcade rounds, the daily and scoring treat Arcade as one category. **Clock** includes the 3 s slack.

### Retro — 10 active

| Game (id) | Play | Score (200) | Clock | Revision |
|---|---|---|---|---|
| Hover (hover) | Tap to rise through 42 barrier gaps; gold gates, star chains, shields; a crash ends the run. | Barriers 120 + star chains 30 + gold stars 20 + tight gates 20 + centre lines 10. | 63 s | hoverRev 10 |
| Breaker (breaker) | Drag the paddle, tap to fire power-ups; gold bricks take 4 hits. | Bricks 140 + clear 10 + speed 20 + gold bricks 30. | 93 s | brkRev 11 |
| Rally (rally) | Keep the blue ball in play (losing it ends the run) and hit gold balls back; pink pads and gold targets. | Gold-ball hits 140 (full at 23) + pink pads 30 + gold targets 30. | 63 s | rallyRev 12 |
| Wavefront (wavefront) | Drag to move, firing on your own, through five waves and two bosses. | Ships, hits and waves 150 + boss destroyed 10 + boss speed 10 + saucers 20 + cannons and weak points 10; a life but the last costs 5, lives at most half the ships, hits and waves points. | 93 s | wavRev 13 |
| Fission (burst) | ◀ ▶ to move, tap to shoot atoms that split, five fixed waves. | Atoms 140 + wave clears 35 + golden atoms 25; a life but the last costs 5; wasted shots beyond one per atom popped (at least 20 free) cost 2; mistakes at most half the atoms points. | 93 s | burstRev 11 |
| Tempo (beat) | Four-lane rhythm chart: taps, holds, swipes, double taps and FEVER. | Accuracy 130 + fever 25 + golden notes 15 + double taps 15 + perfect streak 15. | 78 s | beatRev 11 |
| Meteor (snake) | Swipe to steer, eat stars, dodge rocks that land where red shadows warn. | Stars 120 (full at 28) + gold stars 40 + combos 20 + lane rides 10 + warp stars 10. | 63 s | snakeRev 12 |
| Spacewalk (cross) | Hop across lanes of space traffic, again and again; after a hit you restart at the docking platform. | Rows and crossings 150 + no-stop streak 40 + close calls 10; a hit but the last costs 15, hits at most half the rows and crossings points. | 63 s | crossRev 12 |
| Pinball (pinball) | One fixed table: hold left or right to flip, tap to plunge; ramps, J-O-U-L-Z, locks and multiball. | Table points 130 (full at 61,000) + J-O-U-L-Z 20 + multiball 20 + jackpots 15 + ramp combos 15. | 93 s | pinRev 6 |
| Blockzone (blockfall) | Falling four-square pieces in a well: drag, tap to turn, drag down to drop faster, flick to drop. | Lines 95 (full at 51) + pieces placed 65 + multi-line clears 24 + low stack 16. | 93 s | blockfallRev 2 |

### Sports — 9 active (and Pull! from Speed)

| Game (id) | Play | Score (200) | Clock | Revision |
|---|---|---|---|---|
| Flightpath (bullseye) | Drag and release ten darts at a drifting board in a darts stall. | Dart total 150 (full at 112) + bull streaks 30 + dead-centre darts 20. | 48 s | bullRev 9 |
| Swish (bintoss) | Drag and release ten throws into a boardwalk bucket, aiming into the wind. | Buckets 130 + far buckets 36 + hoops 24 + all ten in 10. | 63 s | binRev 9 |
| Crazy Golf (minigolf) | Five obstacle holes (windmills, tunnels, sand); pull back to putt. | Holes 120 + par 40 + under par 20 + speed 20 (53 s). | 123 s | golfRev 2 |
| Cue Ball (pool) | Pot your seven (spots or stripes, the same for everyone), then the black; drag to aim, pull the meter to shoot, set spin. | Your balls 140 (full at 5 of 7) + black 10 + pots in a row 30 + speed 20 (69 s); a foul costs 10. | 93 s | poolRev 4 |
| Curl Champ (curling) | Eight stones against three seeded red stones: aim, turn, set the weight on the power bar, sweep. | Stones 150 + takeouts 20 + red ring 20 + holding shot 10. | 123 s | curlRev 4 |
| Home Run (homerun) | Ten pitches: tap a spot on the field, then tap to swing as the ring closes; fielders catch. | Distance 120 + home runs 40 + bonus signs 20 + perfect streak 20. | 63 s | homerunRev 4 |
| Top Bins (freekick) | Ten free kicks: draw the shot (bend it round the wall), then release the power bar in the gold. | Goals 120 + targets 40 + round the wall 10 + curl bonus 20 + five in a row 10. | 93 s | freekickRev 4 |
| Apex (racing) | Two laps from a five-light start with a one-thumb joystick; corner speed signs. | Pace 160 (average speed, 0 at 152 km/h, full at 221.5 km/h) + clean sectors 40. | 99 s | racingRev 3 |
| Ringer (alleyroll) | Swipe nine balls up a funfair lane into tiered cups; a gold cup glides along the top. | Ring points 140 (full at 550) + gold cup 30 + roll streak 20 + pocket hits 10. | 63 s | alleyRollRev 2 |

### Cards & Board — 6 active, 3 retired

| Game (id) | Status | Play | Score (200) | Clock | Revision |
|---|---|---|---|---|---|
| Minefield (minesweeper) | Active | Reveal every safe square from a dealt opening; flag with the switch or a long press; no guessing needed. | Safe squares 150 + no mines hit 20 + speed 30 (50 s); a mine hit costs 5. | 93 s | minesRev 1 |
| Mahjong Solitaire (mahjong) | Active | Clear the stack in matching pairs of free tiles; Shuffle, free Undo, Reset. | Pairs 150 + no shuffles 20 + speed 30 (65 s); a Shuffle costs 5. | 123 s | mahjongRev 2 |
| Free Cell (freecell) | Active | 40 cards (Ace to 10) in eight columns of five; build down in alternating colours, home by suit; Undo and Reset. | Cards 105 (all 40 home) + par moves 50 (0 at 1.5 × par) + speed 45 (32 s). | 123 s | freecellRev 5 |
| Summit (tripeaks) | Active | Clear three peaks with cards one higher or lower than the discard (Ace and King wrap); stock par shown. | Cards 105 + peak tops 30 + longest run 10 + clear 10 + stock par 20 + speed 25 (20 s). | 63 s | tripeaksRev 3 |
| Five Hands (fivehands) | Active | Twenty turns placing your card in five poker-hand rows that fill evenly, then pick one bonus column. | Hand points: rows plus the picked column, × 1.4, capped at 200 (not every deal reaches 200). | 63 s | fiveHandsRev 3 |
| Thirteen (pyramid) | Active | Remove uncovered pairs adding to 13 (a King alone); one pass through the stock. | Pyramid cards 140 + cleared 15 + speed 25 (20 s) + pyramid pairs 20. | 93 s | pyramidRev 2 |
| Full House (pokersquares) | Retired (1 Nov) | Place 25 cards one at a time so every row and column scores as a poker hand. | Hand points 160 + made hands 40. | 63 s | pokerSquaresRev 2 |
| Golf Solitaire (golfsol) | Retired (3 Nov) | Play column cards one higher or lower onto the foundation, no wrapping. | Cards cleared 140 + all cleared 20 + speed 20 + runs 20. | 78 s | golfSolRev 1 |
| Muggins (muggins) | Retired (practice only from launch) | Solo dominoes: score when the open ends add to 5, 10, 15 or 20; a draw is final. | Muggins points 150 + hand cleared 20 + speed 20 + big plays 10. | 93 s | mugginsRev 1 |

### Action — 7 active

| Game (id) | Play | Score (200) | Clock | Revision |
|---|---|---|---|---|
| Slice (slice) | Swipe through flying food; never cut a chilli. | Food 120 + combos 40 + golden fruit 20 + bread tickets 10 + dodges 10; a chilli costs 10; food and combos count from the first. | 63 s | sliceRev 13 |
| Roofbound (flip) | Tap to flip between roof and floor of a cave run, dodging spikes; sweet-spot landings and double flips. | Clean time 100 + perfect landings 60 + double flips 20 + flow streak 20. | 63 s | flipRev 12 |
| Grappler (swing) | Hold to grab the nearest jungle vine (some slide on rails), let go to fly; dark ledge runs; a pterodactyl chases. | Course 110 (full at 70 % of the way) + pars 40 + gates 10 + clean-swing streak 40. | 93 s | swingRev 17 |
| Moon Climb (ricochet) | Tap to leap between temple walls, one double jump a leap; ride sky lanterns up. | Height 125 (full at 245 m) + flow 30 + lantern rides 30 + scrolls 15. | 63 s | ricoRev 3 |
| Iron Wall (bastion) | Drag to aim (the crosshair floats above your thumb), lift to fire at five waves of tanks; reload; shoot three drones. | Armour 110 + weak spots 30 + fast reloads 20 + drones 30 + base intact 10; three base hits end the run. | 63 s | bastionRev 3 |
| High Rise (skyline) | Tap to drop the sliding block on the tower; perfect drops grow it back. | Floors 140 (full at 61) + perfect drops 30 (all 30 at 61) + perfect streak 10 + gold blocks 20. | 63 s | skylineRev 10 |
| Orbit (orbit) | Tap to leave an orbit and fly planet to planet to the sun; fuel drains in flight; one checkpoint. | Planets 130 + speed 20 + stardust 15 + slingshots 12 + asteroid fields 12 + perfect orbits 11. | 93 s | orbitRev 14 |

### Strategy — 5 active

| Game (id) | Play | Score (200) | Clock | Revision |
|---|---|---|---|---|
| Tilt (tilt) | Drag to spin four wooden mazes so marbles roll into their own cups; keys open gates. | Mazes 140 + par times 24 + clean run 12 + speed 24 (60 s). | 93 s | tiltRev 12 |
| Gemstone (matchup) | Match-3: swap neighbours to meet six colour goals, break ice and bring treasure down. | Gems 108 + treasure 36 + goals 36 + ice 10 + big lines 10. | 93 s | matchupRev 12 |
| Coral Pop (bubble) | Bubble shooter: aim and bank shots to clear the reef and drop chests. | Bubbles cleared 120 + reef cleared 10 + speed 10 + chests 30 + bank shots 15 + combos 15. | 93 s | bubbleRev 11 |
| Rainbow Bridge (inkbridge) | Draw lines, then release a coin to roll into the pot over ten levels; ink par a level. | Levels 120 + ink par 30 + trick shots 20 + clovers 10 + speed 20. | 123 s | inkRev 14 |
| Ball Tracker (balltrack) | Turn gold tubes and switch drops to route marbles into cups of their colour. | Marbles home 140 + gold marbles 25 + combos 20 + boosted marbles 15. | 63 s | btRev 8 |

### Retired arcade games (no group)

| Game (id) | Since | Clock | Revision |
|---|---|---|---|
| Swerve (swerve), Steady (steady), Dual (dual), Rooftop Run (rooftop) | before 14 Oct | 63 s | — |
| Hot Floor (hotfloor) | before 14 Oct | 123 s | — |
| Junction (junction) | 12 Oct (Tuning C) | 63 s | junctionRev 3 |
| Scrumper (snip) | 27 Oct (Joe’s decision) | 63 s | snipRev 11 |

These keep their own older score shapes (most on the 150 scale) in practice and for stored rounds.

---

## The 1v1 strategy mode (designed 24 Sept, to build after accounts)

Joe’s turn-based tactics concept (designed under the name Duelz; the name is to follow the app rename) for two players on their own phones: secret deployment, then full information. Identical armies of 10 (Main Healer as the objective piece, Field Medics, Snipers, Brawlers, Specialist, Bulwark, Vanguard); one action per turn; three win conditions. Review notes before building: shrink the board to 12×12 or 14×14, match the turn budget to the board, limit healing charges, no draws (a tie-break ladder), deterministic first mover, sniper range shorter than the neutral zone, three passes per game. Positioned as the flagship 1v1 mode and a future knockout final, not a room tie-breaker.

## Held back and candidates

**Knowledge & recall** and **strategy mini-duels** stay held back (skill-based design, and a live shared board). New-game candidates and the bank of ideas are in `docs/duelz-master-plan.md`. The per-category "To build" and "Bank" rows of the 14 Oct version are dropped here: several are now built (Minefield, Island Link, the solitaire and sports games), and the master plan holds the rest.
