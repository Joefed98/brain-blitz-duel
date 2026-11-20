# Joulz difficulty spec: Easy, Hard and Expert for every game

Fable, 20 Nov 2026 (the design-direction session). This replaces the spec of the same name written earlier that day. Every one of the 83 active games has its own ladder below, with a one-line reason and a proof route. The numbers behind "Today" and "Measured" were read from the code and the research (`levels-research.md`) or measured read-only in this session, and are labelled where they are a trial rather than a documented figure. The same content as data: `difficulty/*.json` (one file per build session).

## The rule

1. **Normal is today's game, exactly.** Rated play and the Daily deal it. Nothing here retunes Normal.
2. **One headline lever per game, visible in the first three seconds.** A player who opens Hard after Normal sees the difference before touching anything: a bigger board, more pieces, more enemies, another lane, a narrower gap, a shorter paddle. The four levels sit on that one lever as a ladder (Easy < Normal < Hard < Expert), with at most two supporting levers (time, aids, tolerance). A step whose only change is invisible (a tighter par, a refitted curve) is not a level.
3. **Steep and even.** Each step is roughly 1.4 to 1.7 times the load of the one before. Targets for an average player: Easy 150–180 with a finish nearly every time; Normal about 100 (today, fixed); Hard 55–75; Expert 25–45. For the elite bot under `HUMAN_LIMITS`: Easy 195+, Hard 150–175, Expert 120–150. These are tuning targets for the build session, not promises; Joe's playtest decides.
4. **Easy is welcoming.** A first-time player finishes or scores well on the first try, gets a first success inside ten seconds, and never loses the run to one slip. Aids live here.
5. **Hard and Expert never add an aid.** Expert takes aids away. Where today's Hard or Expert carries an aid Normal lacks (the card games' Hint button), it goes.
6. **Expert is super hard for an average player and proven reachable at 200 by the best humans under `HUMAN_LIMITS`** (0.25 s to react, 0.15 s to move). Arcade: the oracle or witness reaches 200 under the limits on every dealt seed, or the seed is dropped from that level's deal. Puzzles: the person-style solver (deduction plus one-step trials, never a guess) finishes every Expert board inside its clock.
7. **A new mechanic only where it is the natural way.** Five games get one (listed below); every other ladder is numbers and aids.
8. **Stored rounds keep their worlds.** A level that changes a deal or a rule is gated on the stored `level` field or a new revision stamp on level deals only; where a level table is re-read at replay or grading today, the level's values are stamped on the puzzle.

## What changed against today, in short

- 83 games: **1 kept** as it is (Moon Climb), **48 retuned** (same levers, new numbers) and **34 redesigned** (a different lever). Many Easy levels are kept where they already do the job; each says so.
- The commonest fault found: **Hard looks the same as Normal** in the first seconds (same board, same counts) on about thirty games, and on a handful Hard or Expert reads as *easier* (Chroma Lines' Hard has fewer dots, Skid's Expert fewer holes, Tenfall's Hard opens on smaller targets, Lookout's Expert outscores Hard).
- **New mechanics (5):** Exact plays targets in a row (2 at Hard, 3 at Expert); Double Take mirrors the lower picture at Expert; Labyrinth swaps its hidden exit (partly a guess) for gold keys to fetch; Tempo's lane count becomes the ladder (3 / 4–5 / 5 / 6); Iron Wall gains a fourth lane from Hard.

## Decisions for Joe

1. **Counterweight, Brimful, Checkout and Kakuro: a new Hard.** On 15 Nov you chose to keep the older game as their Hard. Measured now, that Hard looks like Normal in the first seconds and scores like it (Counterweight average 94 against 95; Checkout 52 against 50), and a quarter of old-Hard Kakuro boards cannot be finished without a guess. **Recommendation: replace it with the visible step in each game's row.** If you say no, those four Hards stay and only Easy and Expert change.
2. **Iron Wall: Expert becomes four lanes** (9 tanks a wave), on bastionRev 3's aim settings. That replaces the 15 Nov ruling that Expert is bastionRev 3's game unchanged. **Recommendation: yes; the fourth lane is your own example of a natural mechanic.**
3. **200 must be reachable, and on some games it is not today, at any level.** Under the human limits the scoring itself caps the best possible run: Flash at about 130 (a 250 ms tap pays 115), Bonk at about 160 (the quick window closes at 267 ms), Home Run's perfect streak (the exact tick) at 0 % of Hard and Expert innings, Matchmaker's extras (perfect memory still misses about 11 first looks), Tenfall's Easy at 196, and no Hard or Expert Nucleus board (and 7 of 12 Expert Forage boards) holds 200 points of words. Five Hands has no 200 proof at any level. **Recommendation: fix each on the level deals only** (a scoring stamp or a deal rule that Easy, Hard and Expert carry; Normal untouched), as each game's row says. Whether Normal's own curve should follow later is a separate scoring decision (Flash `tapRev 8`, Bonk `whackRev 5`, Pull! `clayRev 11`).
4. **Proofs to build.** No oracle or deal builder applies `HUMAN_LIMITS` today; they are frame-exact. Breaker, Rally, Meteor and Pinball have no oracle at all; the Logic person-style solver counts trials but has no clock; the Attention "200 at every level" run knows the answer. Each row names what to write. **Recommendation: every difficulty session's first job is its proof tool, before any number is tuned.**
5. **Minefield's Expert goes back to 10 × 16** (36 mines): today's 12 × 18 draws squares at about 31 px on a phone, under the 36 px floor.

## Every game at a glance

What the player sees in the first seconds at each level.

| Game | Group | The lever | Easy | Hard | Expert |
|---|---|---|---|---|---|
| Nucleus | Word | Shortest word that counts | A 3+ LETTERS badge on a full ring; short words score. | A 5+ LETTERS badge on a bigger ring; four-letter words bounce. | A 6+ LETTERS badge on the biggest ring of eleven letters. |
| Interlock | Word | Tiles in the tray | Ten tiles and a small 6 by 6 board with big squares. | Nineteen tiles in three tray rows; a bigger 8 by 8 board. | Twenty-three tiles, a 9 by 9 board, and no word lights. |
| Slider | Word | Grid size | A small 4 by 4 grid with its four target words listed. | A 6 by 6 grid: 36 tiles and six longer words. | A 7 by 7 grid: 49 tiles and seven 7-letter words. |
| Forage | Word | Shortest word that counts | Goal line says 3+ letters; three-letter traces score at once. | Goal line says 5+ letters; a four-letter trace bounces. | Goal line says 6+ letters; only three free misses shown. |
| Lookout | Word | Words to find | A small 8 by 8 grid, big letters, five words. | A taller 10 by 12 grid and eight word chips. | Ten word chips in three rows under the tall grid. |
| Roundabout | Word | Words in the crossword | Six letters on the wheel and a small crossword. | A crossword of 16 to 19 words fills the top half. | Eight letters on the wheel under a 20-word-plus crossword. |
| Strikeout | Word | Starting letters per word | Four letters of the first word already showing; 14 strike dots. | One letter showing; 10 strike dots; two vowel dots. | Every tile blank and only 8 strike dots. |
| Cryptogrid | Word | Grid size | A small 5 by 5 grid, half its letters already in. | A bigger 8 by 8 grid with about 20 numbers. | A 9 by 9 grid with only four letters showing. |
| Swapword | Word | Loops of crossing words | Seven to nine of the 21 tiles already gold. | Three loops of words: 30 tiles on a bigger board. | A window of 33 tiles in six 7-letter words. |
| Counterweight | Number | Beam length and weights to hang | A short six-notch beam and two light weights | A long ten-notch beam with two weights already hung | Ten notches, three weights to hang, no balance readout |
| Exact | Number | Targets to hit in the round | A two-digit target | "Target 1 of 2" and two stage pips | "Target 1 of 3" and three stage pips |
| Operator | Number | Gaps to fill per equation | A short sum with one empty circle | Four numbers and three empty circles | Five numbers, every sign missing, a tray of tiles |
| Integer Pyramid | Number | Rows and empty stones | A tiny three-row pyramid with two gaps | Five rows almost empty, a tray of 14 stones | Six rows almost empty, three-digit stones |
| Brimful | Number | Jugs on the bench, tap removed | Two jugs and a tap, "Par 2" | Three jugs on the bench | Three jugs, no tap, the big one full |
| Checkout | Number | How strange the dartboard is | A normal dartboard and three small targets | Odd numbers up to 60 round the board | Odd numbers, red minus wedges, "exactly 3 darts" |
| Ballpark | Number | Marks on the ruler | Every tick on the ruler carries its number | Only three ticks: the quarters | A bare ruler with one middle tick |
| Kakuro | Number | Size of the grid | A small grid with about ten white squares | A wider grid, seven squares across | The full 7 × 7 grid, 27 squares to fill |
| Flash | Speed | Trap flashes before each gold | A calm dark glass; the first gold arrives within three seconds. | Trap colours fire about once a second from the start. | The glass flickers twice a second, nearly all gold look-alikes. |
| Ascend | Speed | Numbers on the board | Sixteen big discs, 1 to 16, that never move. | Thirty-two discs crowd the board; the clock bar is short. | Forty discs fill the board; the goal says highest first. |
| Eagle Eye | Attention | Eagles in each grid | Sixteen big eagles, and nothing that nearly matches. | Forty-nine small eagles in the very first grid. | Eighty eagles a grid and two facings to find. |
| Double Take | Attention | Shapes in each picture | Two small pictures of twenty big sweets. | Fifty-six sweets a picture and only three misses allowed. | The lower picture is a mirror image of the upper. |
| Tally | Attention | Shapes on the tray | Fifteen big shapes; count one colour. | Eighty shapes on the first tray, counts into the twenties. | A packed tray of 110, two colours, no marks. |
| Labyrinth | Attention | Steps to walk | A small maze with wide corridors. | A fine maze with two gold keys and a locked exit. | Four keys in four corners; par above 320. |
| Bomb Defusal | Attention | Steps and clues on the card | Five wires and a four-line card. | Eight wires and a card of eight or nine clues. | No Reset button: one wrong step sets it off. |
| Don’t Break the Chain | Speed | Charms in the cycle | Four charms in the strip and a spare-link pip. | Six charms in the strip, and 0 / 48 links. | Seven charms in the strip, and 0 / 56 links. |
| Matchmaker | Attention | Cards on the board | Sixteen big cards. | Forty-two cards, six across and seven down. | Fifty-six small cards fill the whole screen. |
| Bonk | Speed | Burrows on the lawn | A 3 by 3 lawn of nine big burrows. | A 5 by 5 lawn: 25 burrows, four gophers up. | A 6 by 6 lawn: 36 burrows, five up at once. |
| Tenfall | Speed | Size of the targets | Target 10, slow tiles, only numbers and minus. | Target 40 or more at once; gold ×2 tiles everywhere. | Target 100 or more straight away, climbing to 400. |
| Pull! | Speed | Clays in the air together | One slow clay at a time in a big ring. | Two fast clays cross on the very first pull. | Three clays at once among a sky of birds. |
| Gridlock | Pattern | Lot size and cars | A small, half-empty lot with the gold car nearly out | A bigger 8×8 lot packed with fifteen or more cars | A 9×9 lot, wall to wall with over twenty cars |
| Tessellate | Pattern | Board size and pieces | A small board and six little pieces | A bigger 8×8 board with eleven pieces in the tray | A 9×9 board and thirteen pieces, two of them new |
| Pipeline | Pattern | Tiles on the board | A small 5×5 board with many pipes already joined | A taller board of 72 tiles, nearly all turned | Tiles to the bottom of the screen and no leak marks |
| Box Six | Logic | Numbers given at the start | More than half the grid already filled in | Only ten or eleven numbers on the grid | Eight or nine numbers, and a Check button |
| Chroma Lines | Pattern | Board height and pairs | A small 6×6 board with five or six pairs | A taller board with more coloured dots than Normal | Dots in fourteen colours fill the screen top to bottom |
| Skid | Pattern | Holes and thin ice | A small rink with rocks only and no holes | Twice Normal's holes dotted across the rink | A taller rink riddled with ten or more holes |
| Heave | Pattern | Crates to push home | Three crates in an open room | Six crates and six marks between tighter walls | Seven crates crowd a walled-in warehouse |
| Lightbender | Pattern | Bombs on the board | One or two bombs and five shots | Twice Normal's bombs between the gems | Bombs everywhere, an exact tray and two shots |
| Hanoi | Logic | Rings on the posts | Four posts and a short stack of seven | Three posts, ten rings and no spare post | Twelve rings stacked to the top of the posts |
| Polypotions | Logic | Flasks and colours | Six short flasks in four colours | Twelve flasks and ten colours, all on show | Fourteen flasks with grey question marks under every top layer |
| Safe Cracker | Logic | Dials on the safe | Three dials and five plain clues | Five dials that run to 20 and seven clues | Six dials, nine clues, one try |
| Topsy-Turvy | Pattern | Balls on each board | Three balls, three cups, two boards | Eight balls rolling at once | Ten balls and ten cups crowd the board |
| Mosaic | Logic | Picture size | A small 6×6 picture with short clues | A taller 9×11 picture, half as big again as Normal | A picture fourteen rows deep, down to the buttons |
| Colour Flood | Logic | Board size and colours | A small board in four colours | A board half as tall again, in six colours | Seven colours, stones in the way, a screen-high board |
| Minefield | Logic | Mines on the board | A small board, a third of it already open | Mines 26 on the counter and a small opening | Mines 36 and only a handful of squares open |
| Tents and Trees | Logic | Board height and trees | A short board with every count shown | Two more rows, more trees, half the counts blank | Thirteen rows and over twenty trees |
| Shikaku | Logic | Board height and rectangles | A short board with small numbers | Two more rows and numbers up to 16 | Fifteen rows deep, with a 20 on the board |
| Lamplighter | Logic | Board height and walls | A short board with most walls numbered | Two more rows and most walls blank | Fourteen rows of dark squares and few numbers |
| Trail | Logic | Board size | A small board: 1 to 25 | A 7×7 board: 1 to 49 | An 8×8 board: 1 to 64 |
| Loopline | Logic | Board size | A small 5×5 grid, more than half the squares numbered | An 8×8 grid, almost twice Normal's squares | A tall 8×10 grid with wide blank patches |
| Regions | Logic | Board size | A small grid with half its numbers given | An 8×8 grid, three squares in four blank | A 9×9 grid, four squares in five blank |
| Island Link | Logic | Islands to link | Eight islands on a small sea | About twenty islands, nearly twice Normal's | Nearly thirty islands down a taller sea |
| Hover | Retro | Height of the barrier gaps | Gaps a quarter taller than Normal's from the first barrier | First gap a fifth narrower, the saucer has no shield | A gap two thirds the size, already sliding up and down |
| High Rise | Action | Width of the blocks | A block two thirds of the screen wide, sliding slowly | A block a quarter narrower than Normal's | A block barely half Normal's width, the wind flag waving |
| Breaker | Retro | Rows of bricks in the wall | A short six-row wall above a wide paddle | Two more rows, two already sliding, a narrower paddle | Twelve rows, four sliding, a paddle barely a brick wide |
| Pinball | Retro | Flipper length and the drain gap | Long flippers that almost meet, four balls | Shorter flippers, a drain two and a half balls wide | Stubby flippers, a three-ball drain, two balls |
| Blockzone | Retro | How fast the pieces fall | The first piece drifts down, five next pieces shown | The first piece falls twice as fast, two previews | The piece hits the floor in four seconds, one preview |
| Rally | Retro | Width of the paddle | A paddle 40 % of the court wide, no bumpers | A paddle a quarter narrower, two bumpers already on court | A paddle half Normal's width, two bumpers, one life |
| Tempo | Retro | Number of lanes | Three wide lanes, notes far apart | Five lanes from the first bar | Six narrow lanes, notes falling in one second |
| Meteor | Retro | Rocks on the field | An open field with no rocks at all | Eight rocks already down, walls round the field | Sixteen rocks, walls, a quicker comet, one life |
| Spacewalk | Retro | Traffic on the first crossing | Half Normal's ships, long empty gaps in every lane | Two thirds more ships than Normal on the first crossing | Over twice Normal's ships, each a quarter faster |
| Moon Climb | Action | Blades on the walls | About one blade on the first screen | Blades on both walls from the first leap | Blades and ice on every stretch, faster shurikens |
| Wavefront | Retro | Enemy bolts in the air | A single slow bolt at a time, four lives | Bolts fall in pairs from the first volley | Triple volleys, a ship diving within seconds, two lives |
| Iron Wall | Action | Tanks in each wave | Four tanks roll in on a quiet three-lane road | A fourth lane, eight tanks in the first wave | Four lanes, nine tanks a wave, rolling in 40 % faster |
| Roofbound | Action | Running speed | The cave scrolls at three quarters of Normal's pace | Over a third faster from the first step | Nearly twice Normal's pace, spikes already moving |
| Fission | Retro | Atoms in each wave | One small atom, drawn a quarter bigger | Two atoms bouncing in the opening wave | Three atoms at once from the start, two lives |
| Orbit | Action | Asteroid belts round the planets | Bare planets, no rock belts, no checkpoint button | A rock belt round the second planet on screen | Every planet ringed with rocks, no checkpoint button |
| Grappler | Action | How soon the pterodactyl chases | No pterodactyl, every vine hanging still, all lit | A pterodactyl warning from the first vine, vines sliding | The pterodactyl warning twice as close and closing faster |
| Gemstone | Strategy | Frozen cells on the board | Five colours, a handful of frozen squares, a hint after three seconds | A seventh gem, the cyan heart, and 18 frozen squares | Ice over 28 squares: the bottom rows nearly solid |
| Mahjong Solitaire | Cards & Board | Tiles in the stack | A low two-layer stack of big tiles, a Hint button | A wider, taller stack: 104 smaller tiles | The full set: 136 small tiles wall to wall |
| Home Run | Sports | Pitch speed | A slow lob, small catch circles, five outs on the board | A fastball a fifth quicker, catch circles a third bigger | Heat at the human limit, catch circles closing every gap |
| Top Bins | Sports | Players in the wall | Two men in the wall, a calm flag | A five or six man wall and a stiff wind flag | Seven in the wall, wind 8, half the goal hidden |
| Apex | Sports | Road width | A wide road with braking points and a racing line painted | A visibly narrower road, no racing line | A lane under three cars wide between gravel traps |
| Free Cell | Cards & Board | Free cells | Five free cells over four short rows, a Hint button | Three free cells over a full 52-card table | Only two free cells, court cards everywhere, Undo (3) |
| Summit | Cards & Board | Seconds on the clock | A slow 90 second bar, glowing cards, an Undo button | The timer bar draining faster, a stock of 18, no glow | 35 seconds, a thin stock of 14, nothing glows |
| Five Hands | Cards & Board | Seconds per card | The next two cards shown, a long 90 second bar | 42 seconds for 20 cards: the bar visibly racing | 30 seconds: a card down every second and a half |
| Thirteen | Cards & Board | Rows in the pyramid | A short six-row pyramid over a thick stock, pairs glowing | A taller eight-row pyramid, a thin stock, no glow | Nine rows edge to edge, seven cards in the stock |
| Crazy Golf | Sports | Hazards on each hole | Clean greens: no sand, no water, slow windmills | Bunkers, a pond and a boulder across the line | Sand and water everywhere, sails at double speed |
| Cue Ball | Sports | Pocket width | Big bucket pockets and a near-empty table | Tighter pockets and a full rack of fifteen balls | Pockets barely wider than a ball, no aim line |
| Curl Champ | Sports | Red stones in the house | One red stone far from the button, the whole path drawn | Five reds crowding the button, no aim line | Seven reds ringing the button, no guides at all |
| Coral Pop | Strategy | Colours in the reef | Three colours: big clusters everywhere | Six colours, the reef two rows deeper | Seven colours speckled through a reef past half way |
| Rainbow Bridge | Strategy | Width of the pot | A huge pot under an almost empty sky | A pot two coins wide, birds strung across level one | A pot barely wider than the coin, a sky full of birds |
| Tilt | Strategy | Marbles steered at once | One blue marble, wide corridors, no holes on maze one | Two marbles and two cups from the first maze | Two marbles and holes peppered along the path |
| Ball Tracker | Strategy | Marble colours and cups | Three cups, three colours, a marble every three seconds | Five cups along the bottom, a purple marble in the queue | Six cups in seven columns, six colours in the hopper |

## Word (session D1)

### Nucleus (`wordsmith`, Word)

**Lever: Shortest word that counts.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Words of 3+ letters count, and every word scores as one letter longer (3 letters 1 point, 4 letters 2, 5 letters 4, 6 letters 7, 7 letters 11, 8 or more 15). Ring of 9-10 letters with 45-85 everyday 4+ words, as today. 120 s. A first word inside 10 seconds. | 8-11 letter ring, 17-87 everyday words (median 37), words of 4+ letters, 100 s, wordsmithRev 5 | Words of 5+ letters only. Ring of 10-11 letters holding 20-35 everyday words of 5+ letters and at least 140 word points with the every-tile word. 75 s (Normal 100 s). Normal's points table. | Words of 6+ letters only. Ring of 11 letters holding 12-20 everyday words of 6+ letters and at least 140 word points in 6+ letter words with the every-tile word. 65 s. |
| First seconds | A 3+ LETTERS badge on a full ring; short words score. | | A 5+ LETTERS badge on a bigger ring; four-letter words bounce. | A 6+ LETTERS badge on the biggest ring of eleven letters. |
| Today | 9-10 letter ring, 45-85 everyday words, words of 4+ letters, 120 s | | 8-9 letter ring, 16-24 everyday words, 4+ letters, 65 s | 8 letter ring, 10-14 everyday words, 4+ letters, 50 s |

- **Why this curve:** Long words are the whole skill of an anagram ring, so raising the shortest word that counts makes each level harder from the first try, while a bigger ring keeps a 200 on the board, which today's sparse Hard and Expert boards cannot hold.
- **Proof:** An open word find, so the proof is a witness. To write: scripts/wordsmith-level-bank.ts (or a filter in src/lib/duel/levels/wordsmith.server.ts) keeps a board only when a list of its allowed words reaches 140 points plus the every-tile word, typed inside the clock at 0.25 s a word and 0.15 s a tap (HUMAN_LIMITS); six-letter words alone pay about 3 points a second, so 140 fits in about 45 s. All 14 sampled 11-letter rings hold 147 or more points in 6+ letter words. scripts/wordsmith-levels-check.ts re-proves the witness on every dealt board and that a 4-letter word is refused on Hard.
- **Measured today:** Check bands, near-perfect mean: E 155-182, N 145-168, H 128-155, X 110-138. Kit medians, 12 seeds, read-only run for this plan (average / good / near-perfect): E 75 / 112 / 158, N 54 / 92 / 141, H 30 / 75 / 150, X 22 / 54 / 141. On the same seeds Hard boards hold 40-102 word points in the whole dictionary and Expert boards 36-61; 200 needs 140 points plus the every-tile word, so no Hard or Expert board dealt today can reach 200.
- **Stamp:** Level field plus a stored minLength on the level's puzzle (absent = 4, so Normal and every stored round are unchanged); Easy's 3-letter point and step-up table are read from the same field. No new Normal stamp.
- **Files:** `src/lib/levels/word/wordsmith.ts`, `src/lib/duel/levels/wordsmith.server.ts`, `src/lib/duel/wordsmith.server.ts`, `src/lib/duel/types.ts`, `src/components/puzzles/WordsmithPuzzle.tsx`, `scripts/wordsmith-levels-check.ts`
- **Risk:** rich rings can let strong players outscore Normal (near-perfect 141), so the word band and clock must be tuned to hold Hard and Expert below it

### Interlock (`tilegrid`, Word)

**Lever: Tiles in the tray.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 10 tiles: two crossing everyday words of 5 and 6 letters, on a 6 by 6 board with bigger squares. 120 s. Live word lights and red runs as today. | 15 tiles, an H of three 4-7 letter words, 7 by 7 board, 100 s, tileGridRev 4 | 19 tiles: four crossing words of 5-6 letters, on an 8 by 8 board. 90 s (Normal 100 s). | 23 tiles: five crossing words of 5-6 letters, on a 9 by 9 board (38 px squares at 390 px, close to the 36 px floor). 90 s. Words light and bad runs show only on Done. |
| First seconds | Ten tiles and a small 6 by 6 board with big squares. | | Nineteen tiles in three tray rows; a bigger 8 by 8 board. | Twenty-three tiles, a 9 by 9 board, and no word lights. |
| Today | 15 tiles on the 7 by 7 board, down words start on the across word, 120 s | | 15 tiles, 7-letter across word crossed mid-word, 60 s | 15 tiles, as Hard with crossings off the across word's ends, 50 s |

- **Why this curve:** An anagram crossword gets harder the way Bananagrams does, with every extra tile and word in the rack, and a fuller tray on a bigger board shows that before a tile is touched, where today's crossing rules cannot be seen at all.
- **Proof:** Every rack comes from a real crossword built in the deal (tileGridValid, src/lib/duel/tileGrid.server.ts), and placing it at 0.25 s to react and 0.3 s a tile takes under 8 s, inside the 33 s full-speed line, so the dealt grid scores 200. To write: scripts/tilegrid-human.ts, a person-like builder (everyday words only, longest word first, one-step take-backs, never sees the answer) and scripts/tilegrid-level-bank.ts keeping only Hard and Expert racks it finishes inside the clock; scripts/tilegrid-levels-check.ts re-proves each. Any grid of real words still counts, so the game stays open by design.
- **Measured today:** No band pinned by the check. Kit medians, 12 seeds, read-only run for this plan (average / good / great): E 130 / 193 / 197, N 111 / 191 / 196, H 76 / 130 / 189, X 41 / 117 / 182; near-perfect 200 at every level. The four levels look identical on screen and the kit thinks per word, so the whole step is the clock.
- **Stamp:** tileGridRev 5 on level deals only: the board size and tile count are stored on the puzzle, the answer string follows the stored size, and unfinished credit is 120 x tiles in words / tiles. Normal stays tileGridRev 4 on the 49-square board.
- **Files:** `src/lib/levels/word/tilegrid.ts`, `src/lib/duel/levels/tilegrid.server.ts`, `src/lib/duel/tileGrid.ts`, `src/lib/duel/tileGrid.server.ts`, `src/lib/duel/standard/word.server.ts`, `src/puzzles/tileGrid.tsx`, `scripts/tilegrid-levels-check.ts`
- **Risk:** board size and tile count are constants in the shared rules, grader and reveal today, and 23 tiles in 90 s may be beyond the person-like builder, in which case Expert drops to 21

### Slider (`wordslide`, Word)

**Lever: Grid size.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 4 by 4 grid of four 4-letter everyday words, 2-3 slides away, with the four target words listed above the grid. 100 s. | 5 by 5 grid, five common words 5-8 slides away, par the proven fewest slides, 100 s, wordSlideRev 6 | 6 by 6 grid of six 6-letter words (36 tiles, Normal 25), 6-7 slides away, 100 s. | 7 by 7 grid of seven 7-letter words (49 tiles, about 41 px at 390 px), 7 slides away, 100 s; only boards the elite person-like solver finishes. |
| First seconds | A small 4 by 4 grid with its four target words listed. | | A 6 by 6 grid: 36 tiles and six longer words. | A 7 by 7 grid: 49 tiles and seven 7-letter words. |
| Today | 5 by 5 grid, 2-3 slides from the words, 100 s | | 5 by 5 grid, 7 slides away, 60 s | 5 by 5 grid, 8 slides away, 50 s |

- **Why this curve:** The grid is the only thing a player can see change in a slide puzzle, and each size up adds a row, a column and longer words to hold in mind, so 16, 25, 36 and 49 tiles read as one ladder where today's four levels look the same.
- **Proof:** Par is proven on every board by the two-way search (wordSlideDistance, src/lib/duel/wordSlideDistance.server.ts) and kept at 7 or under on the bigger grids so a grade costs no more than today's depth 8. Hard and Expert deal from a new bank (scripts/slider-level-bank.ts, to write) holding only boards scripts/slider-human.ts, made size-aware, finishes inside the clock at its elite setting without reading the stored words. Today that solver finishes only 4 of 24 Expert boards, so today's Expert is not proven. Any real words in the rows still count (open by design).
- **Measured today:** Person-like solver (scripts/slider-human.ts), 24 boards a level, average score and finishes, strong / elite: E 114.0 (13) / 200 (24); N 76.3 (4) / 140.4 (15); H 57.7 (2) / 108.9 (9); X 41.0 (0) / 89.0 (4, best 189). The kit follows the stored line and scores about 200 at every level.
- **Stamp:** wordSlideRev 7 on level deals only: the grid size is stored on the puzzle and slide tokens take rows and columns 0-6. Normal stays wordSlideRev 6 on 5 by 5.
- **Files:** `src/lib/levels/word/wordslide.ts`, `src/lib/duel/levels/wordslide.server.ts`, `src/lib/duel/wordSlide.ts`, `src/lib/duel/wordSlide.server.ts`, `src/lib/duel/wordSlideDistance.server.ts`, `src/puzzles/wordSlide.tsx`, `scripts/slider-human.ts`, `scripts/wordslide-levels-check.ts`
- **Risk:** a bigger grid leaves more of each word intact per slide, so 6 by 6 and 7 by 7 must be measured with the size-aware solver first; the fallback is today's depth and clock on 5 by 5 with only Easy changed

### Forage (`wordhunt`, Word)

**Lever: Shortest word that counts.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Words of 3+ letters count, and every word scores as one letter longer (3 letters 1 point, 4 letters 2, 5 letters 4, 6 letters 7, 7 or more 11). Packed board of 320-700 everyday words, as today. Misses cost nothing. 120 s. | 6 by 6 board, 140-420 everyday words (median about 240), words of 4+ letters, 10 free misses plus 2 a word, 100 s, wordHuntRev 4 | Words of 5+ letters only, on a packed board (320-700 everyday 4+ words, at least 60 of them 5+ letters). Free misses 6 plus 1 a word (Normal 10 plus 2). 80 s. | Words of 6+ letters only, on a packed board with at least 25 everyday words of 6+ letters. Free misses 3 plus 1 a word. 70 s. |
| First seconds | Goal line says 3+ letters; three-letter traces score at once. | | Goal line says 5+ letters; a four-letter trace bounces. | Goal line says 6+ letters; only three free misses shown. |
| Today | 6 by 6 board, 320-700 everyday words, words of 4+ letters, 120 s | | 6 by 6 board, 100-140 everyday words, 4+ letters, 80 s | 6 by 6 board, 50-80 everyday words, 4+ letters, 70 s |

- **Why this curve:** On a letter grid the short words are the easy ones, so lifting the shortest word that counts (the rule the bigger Boggle sets use) steepens every level, while packed boards keep 200 within reach, which today's sparse Expert boards often cannot.
- **Proof:** An open word find, so the proof is a witness. The level deal (src/lib/duel/levels/wordhunt.server.ts) keeps a board only when a list of its allowed words reaches 60 base points and 120 long-word and gold points traced inside the clock at 0.25 s a word and 0.15 s a letter; packed boards hold 74-236 words of 6+ letters on the sampled seeds, and for example 18 seven-letter words (126 base and 126 extra points) trace in about 23 s. scripts/wordhunt-levels-check.ts re-proves the witness on every dealt board and that a short trace is refused.
- **Measured today:** Check bands, near-perfect mean: E 170-195, N 158-184, H 138-164, X 115-142. Kit medians, 12 seeds, read-only run for this plan (average / good / near-perfect): E 67 / 115 / 177, N 64 / 102 / 170, H 29 / 88 / 148, X 29 / 80 / 126. The four boards look the same on screen. On 7 of 12 sampled Expert boards every listed word together scores under 200 (176-198).
- **Stamp:** Level field plus a stored minLength and free-miss allowance on the level's puzzle (absent = 4 letters, 10 plus 2); Easy's 3-letter point and step-up table read from the same field. No new Normal stamp.
- **Files:** `src/lib/levels/word/wordhunt.ts`, `src/lib/duel/levels/wordhunt.server.ts`, `src/lib/duel/wordHunt.server.ts`, `src/lib/duel/wordHunt.ts`, `src/components/puzzles/WordHuntPuzzle.tsx`, `scripts/wordhunt-levels-check.ts`
- **Risk:** five- and six-letter paths are rarer finds for people than the kit models, so Expert may sit near 0 for average players until the clock is tuned

### Lookout (`wordsearch`, Word)

**Lever: Words to find.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 8 by 8 grid, 5 words, across and down only, 120 s. It does the job: the average kit finishes 12 of 12 at 168 and the small grid is plain at a glance. | 10 by 10 grid, 6 words in 8 directions plus a hidden bonus word, 120 s, wordSearchRev 6 | 10 by 12 grid (today's Expert size, two rows taller than Normal), 8 words in all 8 directions, no false starts, 100 s. | 10 by 12 grid, 10 words (Normal 6), 5 false starts, 90 s. |
| First seconds | A small 8 by 8 grid, big letters, five words. | | A taller 10 by 12 grid and eight word chips. | Ten word chips in three rows under the tall grid. |
| Today | 8 by 8 grid, 5 words, across and down only, 120 s | | 10 by 11 grid, 7 words in 8 directions, 90 s | 10 by 12 grid, 8 words, 4 false starts, 90 s |

- **Why this curve:** The grid is already at the phone's limit (ten columns of 36 px squares, twelve rows on a short phone), so the honest ladder is more words to find in that space with false starts on top, taking Hard to today's Expert size and Expert to ten words.
- **Proof:** scripts/word-search-level-bank.ts rebuilds each level's bank byte for byte (--check) and proves every listed word is hidden exactly once in all 8 directions with no other word of the theme on the grid; scripts/wordsearch-levels-check.ts checks the bank, the rules and the bands. To add to the bank script: a reading witness, every word and the bonus dragged inside the full-speed time at 0.55 s a drag (about 6 s of hand time for 11 drags), so 200 is shown reachable on each Expert board.
- **Measured today:** Check bands near-perfect / great: E 185-200 / 165-195, N 180-200 / 165-190, H 174-196 / 150-175, X 152-178 / 132-158. Kit medians, 12 seeds, read-only run for this plan (average / good / near-perfect): E 168 / 170 / 200, N 151 / 164 / 170, H 53 / 152 / 193, X 62 / 94 / 162; the average kit scores higher on Expert than on Hard.
- **Stamp:** Level field only: new numbers in src/lib/levels/word/wordsearch.ts and a rebuilt level bank; the grid, words and clock are already stored on the puzzle.
- **Files:** `src/lib/levels/word/wordsearch.ts`, `scripts/word-search-level-bank.ts`, `src/lib/duel/wordSearchLevelBank.server.ts`, `scripts/wordsearch-levels-check.ts`
- **Risk:** ten words, a bonus word and five false starts may not pack into 120 squares for every theme; 9 words is the fallback

### Roundabout (`letterwheel`, Word)

**Lever: Words in the crossword.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 6-letter wheel, 7-9 words, 120 s. It does the job: the good kit finishes 12 of 12 at 162 and the small wheel and crossword are plain at a glance. | 7-letter wheel, 11-14 words, grid up to 11 by 9, 5 free misses, 100 s, wheelRev 5 | 7-letter wheel, 16-19 words (today's Expert bank, grid up to 9 by 12), 75 s, 3 free misses (Normal 5). | 8-letter wheel, 20-24 words in a grid up to 10 by 13, 70 s, 2 free misses. |
| First seconds | Six letters on the wheel and a small crossword. | | A crossword of 16 to 19 words fills the top half. | Eight letters on the wheel under a 20-word-plus crossword. |
| Today | 6-letter wheel, 7-9 words, 120 s | | 7-letter wheel, 12-15 words, grid up to 9 by 11, 75 s | 7-letter wheel, 16-19 words, grid up to 9 by 12, 80 s |

- **Why this curve:** A wheel-and-crossword game grows the way its kind always has, more letters on the wheel and more words to fill, and one more notch each way gives Expert a wheel and a crossword no other level has, where today Hard and Expert differ by a few words and Expert has the longer clock.
- **Proof:** scripts/letter-wheel-bank.ts --level builds each bank (every slot word a common answer traceable on the wheel, the grid inside the level's limits, rebuilt byte for byte with --check); Expert needs a new 8-letter bank from a new LW_LEVEL_LIMITS row. Open by design (fills are not unique), so 200 is shown by a witness to add to scripts/letterwheel-levels-check.ts: every slot word and a full jar traced inside the 40 s full-speed line at 0.25 s a word and 0.15 s a letter (about 33 s of tracing for 22 slot words plus the 11 or so bonus words that fill the 30-drop jar).
- **Measured today:** Check bands, near-perfect mean: E 170-195, N 162-186, H 155-180, X 148-174. Kit medians, 12 seeds, read-only run for this plan (average / good / great / near-perfect): E 110 / 162 / 170 / 180, N 53 / 108 / 158 / 174, H 38 / 82 / 111 / 167, X 37 / 70 / 103 / 166. No kit run reached 200 at any level (best 194 on Easy, 179 on Normal). Expert's clock is longer than Hard's.
- **Stamp:** Level field plus a stored free-miss allowance on the level's puzzle (absent = 5); the wheel's letters, grid and clock are already stored. New level banks, no new Normal stamp.
- **Files:** `src/lib/levels/word/letterwheel.ts`, `src/lib/duel/letterWheel.ts`, `scripts/letter-wheel-bank.ts`, `src/lib/duel/letterWheelBankHard.server.ts`, `src/lib/duel/letterWheelBankExpert.server.ts`, `src/puzzles/letterWheel.tsx`, `scripts/letterwheel-levels-check.ts`
- **Risk:** an 8-letter wheel's 20-24 word crossword may need more than 10 by 13, and its squares shrink to about 24 px on short phones (display only; letters stay 11 px or more)

### Strikeout (`strikeout`, Word)

**Lever: Starting letters per word.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 4 starting letters on every word (today 3 or 2, the same as Normal's first word), 4 vowel guesses a word, 14 strikes, 120 s. | 3 or 2 starting letters on words 1-3 and one fewer on words 4-5, 3 vowel guesses a word, 12 strikes, 100 s, strikeoutRev 7 | As today: 1 starting letter a word, 2 vowel guesses, 10 strikes, 90 s. It does the job: one letter showing is plain at a glance and the average kit lands at 66. | No starting letters, 2 vowel guesses, 8 strikes (today 12, more than Hard's 10), 85 s. |
| First seconds | Four letters of the first word already showing; 14 strike dots. | | One letter showing; 10 strike dots; two vowel dots. | Every tile blank and only 8 strike dots. |
| Today | 3 or 2 starting letters on all five words, 4 vowel guesses a word, 14 strikes, 120 s | | 1 starting letter a word, 2 vowel guesses, 10 strikes, 90 s | no starting letters, 2 vowel guesses, 12 strikes, 85 s |

- **Why this curve:** Starting letters are what a hangman player sees first and leans on most, and today's 1 and 0 at Hard and Expert already land the average kit at 66 and 39, so only Easy's letters and Expert's strike row need to join the same ladder.
- **Proof:** One answer word fits each pattern (scripts/strikeout-levels-check.ts). Hard and Expert deal only sets the person-like guesser (solveStrikeoutLikeAPerson, src/lib/duel/levels/strikeoutSolver.server.ts, never sees the answers) clears inside the level's strikes, redrawing on the room seed up to 40 times; on 60 blind first draws it cleared 25 inside 8 strikes and 47 inside 12 (this plan's read-only run). To add: time its line at 0.25 s a decision and 0.15 s a key against the 85 s clock.
- **Measured today:** Check bands near-perfect / great: E 188-200 / 185-200, N 190-200 / 180-196, H 172-192 / 145-178, X 155-182 / 100-132. Kit medians, 12 seeds, read-only run for this plan (average / good / great / near-perfect): E 178 / 191 / 196 / 196, N 100 / 183 / 191 / 196, H 66 / 107 / 172 / 183, X 39 / 80 / 127 / 172.
- **Stamp:** Level field only: starting letters, vowel guesses, strikes and clock are already stored on the puzzle (givens, maxVowels, maxStrikes, timeLimitMs).
- **Files:** `src/lib/levels/word/strikeout.ts`, `src/lib/duel/levels/strikeout.server.ts`, `src/lib/duel/levels/strikeoutSolver.server.ts`, `scripts/strikeout-levels-check.ts`
- **Risk:** 8 strikes with no letters showing may end most average runs inside the first two words; 10 strikes is the fallback

### Cryptogrid (`codeword`, Word)

**Lever: Grid size.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 5 by 5 grid: six 5-letter words on rows and columns 1, 3 and 5 (21 squares, about 12 letters), 6 decoded at the start, 120 s. | 7 by 7 grid of 14-18 letters, 6 numbers decoded at the start, 120 s, codewordRev 7 | 8 by 8 grid (about 17-21 letters, Normal 14-18), 5 decoded at the start, 110 s. | 9 by 9 grid (about 20-24 letters, 40 px squares at 390 px), 4 decoded at the start, 100 s; only boards the person-like solver cracks. |
| First seconds | A small 5 by 5 grid, half its letters already in. | | A bigger 8 by 8 grid with about 20 numbers. | A 9 by 9 grid with only four letters showing. |
| Today | 7 by 7 grid, 8 numbers decoded at the start, 120 s | | 7 by 7 grid, 5 decoded, 75 s | 7 by 7 grid, 4 decoded, 70 s, only the 666 bank boards a person-like solver cracks |

- **Why this curve:** A code-breaker gets harder with more squares and more letters to crack, and only a bigger grid stretches strong players, who score about 200 on every level today because the levels differ by one starting letter and a clock they never run out of.
- **Proof:** Each size needs its own bank from scripts/codeword-bank.ts made size-aware, every board proven to have exactly one decoding from its givens by the full-dictionary solver (as scripts/codeword-check.ts proves today's 1,000 boards from four and five givens). Expert keeps only boards solveCodewordLikeAHuman (src/lib/duel/levels/codewordHuman.server.ts) cracks from the four givens by reasoning alone, its steps timed at 0.25 s to react and 0.15 s a tap inside the clock (scripts/codeword-expert-bank.ts); scripts/codeword-levels-check.ts re-proves both.
- **Measured today:** Check bands near-perfect / great: E and N 190-200 / 185-200, H 185-200 / 175-198, X 185-200 / 130-190. Kit medians, 12 seeds, read-only run for this plan (average / good / great): E 151 / 190 / 200, N 91 / 183 / 200, H 56 / 100 / 198, X 48 / 100 / 200. Speed is full for any finish inside 60 s and Hard and Expert last 75 and 70 s, so strong players score about 200 on every level.
- **Stamp:** Level field plus a stored grid size on level deals (absent = 7); cells, numbers and givens are already stored. On level deals the full-speed time scales with the level's clock, as Lookout's does. No new Normal stamp.
- **Files:** `src/lib/levels/word/codeword.ts`, `src/lib/duel/levels/codeword.server.ts`, `src/lib/duel/codeword.ts`, `src/lib/duel/codeword.server.ts`, `scripts/codeword-bank.ts`, `src/lib/duel/levels/codewordHuman.server.ts`, `src/puzzles/codeword.tsx`, `scripts/codeword-levels-check.ts`
- **Risk:** three new banks with a one-answer proof are the biggest build in the group, and on 667 px tall phones the 9 by 9 squares fall to about 35 px unless the number strip folds away

### Swapword (`swapword`, Word)

**Lever: Loops of crossing words.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: the 21-tile board with 7-9 tiles already gold, 5-7 swaps away, 16 spare swaps, 120 s. It does the job: the average kit finishes 12 of 12 at 186 and the gold tiles are plain at a glance. | 21 tiles in two loops of six words, 9-12 swaps away, 3-5 tiles in place, 12 spare swaps, 120 s, swapwordRev 7 | A three-loop board: 30 tiles and 8 words (four of 6 letters, four of 4) on an 8 by 8 with 45 px tiles, 3-4 in place, 8 spare swaps (Normal 12), 110 s. | A four-loop window: 33 tiles in six 7-letter words on a 7 by 7 (rows and columns 1, 4 and 7), 3 in place, 6 spare swaps, 110 s; only boards the mark-reading solver works out. |
| First seconds | Seven to nine of the 21 tiles already gold. | | Three loops of words: 30 tiles on a bigger board. | A window of 33 tiles in six 7-letter words. |
| Today | 21 tiles in two loops, 5-7 swaps from the answer, 7-9 tiles in place, 16 spare swaps, 120 s | | 21 tiles, 13-15 swaps away, 3-4 in place, 6 spare swaps, 55 s | 21 tiles, 15-17 swaps away, 2-3 in place, 4 spare swaps, 60 s, human-solvable boards only |

- **Why this curve:** Each extra loop adds nine or more tiles to sort and more crossings to hold in mind, a step the player sees at once, where today's Hard and Expert are Normal's board on half the clock.
- **Proof:** src/lib/duel/levels/swapwordProof.server.ts made lattice-aware: swapwordOneArrangement proves only one arrangement of answer words keeps the start's gold tiles, and swapwordHumanSolves (reads only the marks the phone shows) must work out every Hard and Expert board, its swaps timed at 0.25 s to react and 0.3 s a swap inside the clock. The fewest swaps are proven by minSwaps (src/lib/duel/swapword.server.ts); scripts/swapword-levels-check.ts re-proves all three on every dealt board.
- **Measured today:** No band pinned by the check. Kit medians, 12 seeds, read-only run for this plan (average / good / great / near-perfect): E 186 / 200 / 196 / 200, N 175 / 200 / 194 / 200, H 35 / 73 / 110 / 200, X 32 / 66 / 196 / 200: a cliff at Hard, no step to Expert, and Expert's clock is longer than Hard's.
- **Stamp:** swapwordRev 8 on Hard and Expert deals only: the lattice (tile squares and word slots) is stored on the puzzle and the swap list indexes its tiles. Easy and Normal stay on the 21-tile board and their stamps.
- **Files:** `src/lib/levels/word/swapword.ts`, `src/lib/duel/levels/swapword.server.ts`, `src/lib/duel/swapword.ts`, `src/lib/duel/swapword.server.ts`, `src/lib/duel/levels/swapwordProof.server.ts`, `src/puzzles/swapword.tsx`, `scripts/swapword-levels-check.ts`
- **Risk:** the exact fewest-swaps search and the one-arrangement proof may be slow on 30 and 33 tiles, and the mark-reading solver may reject most 7-letter windows


## Number (session D2)

### Counterweight (`balance`, Number)

**Lever: Beam length and weights to hang.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Keep today's: 3 short scales with 2, 2, 3 light weights already do the job (average kit 197, every run finished). | balanceRev 5: 4 scales of 8 notches; 2, 2, 3, 4 weights to hang (1, 2, 2, 2 fixed); 8, 9, 10, 11 spare hangs; 120 s | All 4 scales on 10-notch beams from the first one: 2, 3, 4, 5 weights to hang with 2, 2, 2, 3 fixed, the first scale with one arrangement, 6, 7, 8, 9 spare hangs, readout shown, 120 s. In-memory kit trial: 62 / 94 / 168 / 190. | Keep today's: 10-notch beams, 3, 4, 5, 6 weights, 5 to 7 spare hangs, readout hidden. The kit already puts it at 31 / 62 / 94 / 171. |
| First seconds | A short six-notch beam and two light weights | | A long ten-notch beam with two weights already hung | Ten notches, three weights to hang, no balance readout |
| Today | 3 scales of 6 notches; 2, 2, 3 weights to hang (1, 1, 2 fixed); 8, 8, 10 spare hangs; readout shown; 120 s | | The old game (balanceRev 4): 2, 3, 4, 5 weights to hang (1, 2, 3, 3 fixed) on 8, 8, 8, 10 notches; hang limits 9, 12, 15, 18; 120 s | 4 scales of 10 notches; 3, 4, 5, 6 weights to hang (1, 2, 2, 2 fixed); 5, 6, 6, 7 spare hangs; balance readout hidden; 120 s |

- **Why this curve:** Every weight is a torque sum, so a longer beam and more weights multiply the sums, and hiding the readout last makes the player do them in the head.
- **Proof:** Each scale is proved balanced with both sides used and, where set, exactly one arrangement (balancedArrangements, exhaustive) when dealt. Expert keeps only scales personSolveScale (balanceLevels.server.ts) balances without the readout inside 40 trial hangs. scripts/number-levels-balance-target-check.ts pins it. New Hard: the same filter with the readout on, and the near-perfect kit finishing 95 % or more inside 120 s.
- **Measured today:** Not documented. This session's read-only kit run (24 deals, medians for the average / good / great / near-perfect kit): Easy 197 / 200 / 200 / 200; Normal 95 / 194 / 200 / 200; Hard 94 / 170 / 189 / 200; Expert 31 / 62 / 94 / 171 (79 % finish). Hard scores like Normal.
- **Stamp:** Level field only: balanceRev 5 already stores each deal's scales, hang limits and hideBalance. Hard moves from balanceRev 4 to a balanceRev 5 settings row, so its practice bests restart.
- **Files:** `src/lib/levels/gameLevels.ts`, `src/lib/duel/balanceLevels.ts`, `src/lib/duel/balanceLevels.server.ts`, `scripts/number-levels-balance-target-check.ts`, `scripts/puzzle-fairness/kits-number.ts`
- **Risk:** It retires the old game from Hard, which Joe chose on 15 Nov; the kits show that Hard scoring like Normal (average 94 against 95).

### Exact (`target`, Number)

**Lever: Targets to hit in the round.** Redesigned. **New mechanic:** Targets in a row: 2 at Hard, 3 at Expert, announced as "Target 1 of 2" with the Number family's stage pips. Arrives at Hard.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 1 target of two digits (20 to 99) that 2 or 3 of the six numbers make, 2 big numbers on the rack, 75 s. | 6 numbers, 1 or 2 big, small ones 1 to 10; target 101 to 999; 75 s; full speed points by 30 s | 2 targets in a row, each on a fresh rack, 100 s: first a Normal-style target, then today's Hard board (1 big number, 300 to 999, needs all six). Points per target; full speed points by 50 s. | 3 targets in a row, 120 s: a Normal-style target, then 1 big number needing five or six, then today's Expert board (small numbers only, 500 to 999, needs all six). Full speed points by 75 s. |
| First seconds | A two-digit target | | "Target 1 of 2" and two stage pips | "Target 1 of 3" and three stage pips |
| Today | 6 numbers, 1 or 2 big (25, 50, 75, 100); target 101 to 300 that 3 or 4 numbers make; 75 s | | Exactly 1 big number; target 300 to 999 that needs all six; 75 s | No big number; target 500 to 999 that needs all six, from a bank of 320 boards a person-like solver cracks; 75 s |

- **Why this curve:** One deep target is all or nothing and looks the same at every level, so the harder levels chain targets that rise inside the round: the load doubles, then trebles, and an average player still banks the first.
- **Proof:** Each target is proved by exhaustive search to need its count of numbers (targetLevelRoute, targetLevels.server.ts). Expert's last target comes from the existing proved bank (targetExpertBank.server.ts, scripts/target-expert-bank.ts, personSolveTarget). To write: a bank of whole rounds per level, and a check that the near-perfect kit finishes 80 % of Expert rounds inside 120 s (my estimate from today's times: about 16 + 35 + 60 s).
- **Measured today:** Not documented. This session's kit run (24 deals; the kit's search time is set by level name): Easy 189 / 200 / 200 / 200; Normal 168 / 194 / 200 / 200; Hard 52 / 78 / 120 / 180; Expert 26 / 52 / 78 / 173 (83 % finish). The scores step, but all four screens look the same.
- **Stamp:** New stamp (for example targetRev 1): the stored puzzle holds 2 or 3 racks and targets and the grader pays per target. Today's one-target rounds grade as before.
- **Files:** `src/lib/duel/targetLevels.server.ts`, `src/lib/duel/target.ts`, `src/lib/duel/standard/number.server.ts`, `src/puzzles/targetNumber.tsx`, `src/lib/levels/gameLevels.ts`, `scripts/target-expert-bank.ts`, `scripts/number-levels-balance-target-check.ts`, `scripts/puzzle-fairness/kits-number.ts`
- **Risk:** The biggest build of the group: a staged screen, answer format, grader and reveal for a game with one board today.

### Operator (`equation`, Number)

**Lever: Gaps to fill per equation.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Keep today's: one gap in the first equations, numbers under 10, no ÷ (average kit 184, 96 % finish). | gapsRev 2: 4 equations of 3, 4, 5, 5 numbers (up to 12, 15, 15, 20); 2, 3, 4, 5 gaps; 2 decoy tiles from line 2; 3 tries; 90 s | Keep today's: three empty circles in the first equation and numbers to 25 are a clear step for good and great play (168 to 99, 199 to 168). | Every sign open on every equation: 4 equations of 5 numbers (2 to 30), 4 sign gaps plus 1, 2, 2, 3 number gaps (24 gaps, today 18), 2, 2, 3, 3 decoy tiles, ÷ needed on lines 3 and 4, 2 tries, 78 s. In-memory kit trial at 90 s: 31 / 65 / 99 / 183. |
| First seconds | A short sum with one empty circle | | Four numbers and three empty circles | Five numbers, every sign missing, a tray of tiles |
| Today | 4 equations of 3, 3, 4, 4 numbers (2 to 9; + - ×); 1, 1, 2, 2 gaps; 3 tries; 90 s | | Numbers 2 to 25; equations of 4, 4, 5, 5 numbers; 3, 4, 5, 6 gaps; ÷ from line 3; 3 tries; 85 s, full speed by 40 s | Numbers 2 to 30; equations of 4, 5, 5, 5 numbers; 3, 4, 5, 6 gaps; 2 decoys a line; ÷ needed on lines 3 and 4; 2 tries; 78 s, full speed by 40 s |

- **Why this curve:** An equation is as hard as its open choices, and five numbers is all a phone line holds at 36 px a gap, so the top level opens every sign and some numbers instead of growing the line.
- **Proof:** Each line is counted to have 1 to 3 true fills (countGapAnswers) and is found by the person-like left-to-right search inside 800 partial lines (operatorPersonSearch, OPERATOR_PERSON_BUDGET, operatorGaps.server.ts); the Expert trial's hardest line took 783. scripts/number-levels-equation-pyramid-check.ts pins it. Add an assertion that no level ever deals a fallback equation.
- **Measured today:** Not documented. This session's kit run (24 deals): Easy 184 / 200 / 200 / 200; Normal 66 / 168 / 199 / 200; Hard 64 / 99 / 168 / 190; Expert 34 / 98 / 165 / 189. Expert scores the same as Hard for good, great and near-perfect play.
- **Stamp:** Level field only: the deal already stores each equation, its tray, tryLimit, timeLimitMs and speedFullByS.
- **Files:** `src/lib/levels/gameLevels.ts`, `src/lib/duel/operatorGaps.server.ts`, `scripts/number-levels-equation-pyramid-check.ts`, `scripts/puzzle-fairness/kits-number.ts`
- **Risk:** A line the builder cannot make in 50 attempts silently deals a fixed fallback equation; all-open lines must be proved never to.

### Integer Pyramid (`numpyramid`, Number)

**Lever: Rows and empty stones.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 3 pyramids: one of 3 rows (6 stones, 2 or 3 empty), then two of 4 rows (3-4 and 4-5 empty); bottom row 1 to 9; no decoys; 120 s. About 11 stones to place (today about 21). | 4 pyramids of 5 rows (15 stones); 6-7, 8-10, 10-12, 12-13 empty; bottom row 1-9 rising to 6-20; 2 decoys; 120 s | Keep today's: 5 rows with only 2 to 4 stones given and a 14-stone tray is a visible step and measures 36 / 67 / 95 / 168. | 3 pyramids of 6 rows, 14 or 15 of the 21 stones empty (6 or 7 given), bottom row 6 to 30 so the upper rows run to three digits, 3 decoys, 120 s. About 44 stones, each a longer sum. |
| First seconds | A tiny three-row pyramid with two gaps | | Five rows almost empty, a tray of 14 stones | Six rows almost empty, three-digit stones |
| Today | 4 pyramids of 4 rows (10 stones), 4 to 6 empty, bottom row 1 to 9, 1 decoy; 120 s | | 4 pyramids of 5 rows, 11 to 13 empty, bottom row 4 to 20, 3 decoys; 120 s | 4 pyramids of 6 rows (21 stones), 12 to 14 empty, bottom row 4 to 25, 3 decoys; 120 s |

- **Why this curve:** Six rows is as tall as a phone allows, so above Normal the pyramid empties out and its numbers grow, and Easy shrinks until an average player can finish it.
- **Proof:** Each level deals from its own bank (scripts/number-pyramid-levels-bank.ts): every board has exactly one tray assignment, decoys included (npCountSolutionsFast, numberPyramidLevels.ts), and the person-like solver completes it; scripts/number-levels-equation-pyramid-check.ts. To add: 3-row boards, the new Expert bank, and a near-perfect kit finish of 60 % or more once the kit is timed on three-digit sums.
- **Measured today:** Documented for Normal only: great 135.4 (35 % finish), near-perfect 188.7 (docs/number-overhaul.md). This session's kit run (24 deals, average / good / great / near-perfect): Easy 98 (0 % finish) / 183 / 198 / 200; Normal 58 / 95 / 125 / 188; Hard 36 / 67 / 95 / 168; Expert 33 / 62 / 93 / 161. Easy fails an average player; Expert scores like Hard.
- **Stamp:** Level field only: boards come from each level's bank and carry their rows. The stage and grader must accept 3-row boards and 3-pyramid rounds.
- **Files:** `src/lib/levels/gameLevels.ts`, `src/lib/duel/numberPyramidLevels.ts`, `scripts/number-pyramid-levels-bank.ts`, `src/lib/duel/numberPyramidLevelsBank.server.ts`, `src/puzzles/numberPyramid.tsx`, `scripts/number-levels-equation-pyramid-check.ts`
- **Risk:** The six-row board already clips the goal line on the Expert contact sheet, and the kit counts stones, not sum size, so Expert's step needs a real playtest.

### Brimful (`measure`, Number)

**Lever: Jugs on the bench, tap removed.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 3 boards, 2 jugs and the tap, fewest pours 2, 2-4, 4, limit 5 ×. In-memory kit trial: 183 (88 % finish) / 193 / 197 / 200. | measureRev 5: 4 boards, jugs 2, 2, 2, 3 with the tap; fewest pours 3-4, 4-6, 6-8, 6-10; limit 4.5 ×; 120 s | 3 jugs on every board, and the tap goes half-way: 3 jugs with tap, 4-6 pours; with tap, 7-10; no tap, 9-12; no tap, split evenly, 12-15; limit 2.5 ×; 120 s. A lighter trial (4-6, 6-8, 7-10, 10-13) gave 63 / 161 / 197 / 200, so these bands sit one notch longer. | No tap or drain on any board, the big jug starts full: 3 jugs, 6-8 pours; 10-13; split evenly, 13-16; split, 15-18; limit 1.5 ×; the one-move pulse off; 120 s. Kit trials either side: 31 / 62 / 169 / 198 and 31 / 63 / 93 / 189. |
| First seconds | Two jugs and a tap, "Par 2" | | Three jugs on the bench | Three jugs, no tap, the big one full |
| Today | 3 boards, 2 jugs and the tap; fewest pours 2-4, 3-4, 4-6; move limit 5 × the fewest; 120 s | | The old game (measureRev 4): 2 jugs 4-6 pours; 2 jugs 6-9; 3 jugs 8-11; then 3 jugs, no tap, split evenly, 10-14; limit about 4.5 ×; 120 s | 4 boards: 2 jugs and tap 14-16 pours; 3 jugs and tap 12-15; 3 jugs no tap 11-15; no-tap split 13-16; limit 1.5 ×; 120 s |

- **Why this curve:** Each extra jug and each lost tap is one more thing to juggle and is seen at once, and a short first board on Expert lets an average player score before the long chains.
- **Proof:** Every board's fewest pours come from a breadth-first search of all jug states, and a board is dealt only if personSolve (the textbook fill-pour-empty and three-jug cycles, measureLevels.ts) reaches the target inside its move limit (measureLevels.server.ts). scripts/number-levels-measure-numline-check.ts pins it and the near-perfect kit's Expert finish rate. Four boards is the ceiling: a five-board trial left the near-perfect kit unfinished on all 16 deals.
- **Measured today:** Documented: only that the near-perfect kit finishes 80 % of Expert. This session's kit run (24 deals): Easy 168 (67 % finish) / 196 / 200 / 200; Normal 64 / 184 / 199 / 200; Hard 32 / 95 / 189 / 200; Expert 0 / 30 / 94 / 188 (79 % finish). An average player scores nothing on Expert.
- **Stamp:** Level field only: measureRev 5 stores the boards and move limits. Hard moves from measureRev 4 to a measureRev 5 row; the pulse is display, read from the stored level.
- **Files:** `src/lib/levels/gameLevels.ts`, `src/lib/duel/measureLevels.ts`, `src/lib/duel/measureLevels.server.ts`, `src/puzzles/measure.tsx`, `scripts/number-levels-measure-numline-check.ts`
- **Risk:** The kit plays the proven shortest plan, so its top scores overstate real experts; it also retires the old game from Hard (Joe's 15 Nov choice).

### Checkout (`checkout`, Number)

**Lever: How strange the dartboard is.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 3 standard boards, any dart finishes, targets 20-50, 40-80, 100-120, and a 120 s clock. In-memory kit trial at 90 s: 190 (63 % finish) / 200 / 200 / 200. One board stays at 100 or more because only that can pay the big-finish 10. | checkoutRev 4: 5 boards, 3 standard then 2 with 1 to 20 shuffled; double finish; 3 darts; targets 40 to 160; 90 s | Odd numbers from the first board: odd values 5 to 60, double finish, 120-200; shuffled 1 to 20, 100-160; odd values, ×4 ring, treble finish, 200-400; shuffled with 2 minus wedges, exactly 4 darts, 80-170; odd values with minus wedges, 200-400; 90 s. Kit trial: 28 / 80 / 185 / 198. | 5 odd-value boards, every one with 2 minus wedges and an exact dart count (3, 4, 4, 4, 4 darts), ×4 ring on three, treble finish on two, targets 80 to 360, 90 s. Kit trial: 25 / 50 / 79 / 180 (81 % finish). |
| First seconds | A normal dartboard and three small targets | | Odd numbers up to 60 round the board | Odd numbers, red minus wedges, "exactly 3 darts" |
| Today | 3 standard boards, any dart may finish, 3 darts, targets 30-70, 50-100, 100-150; 90 s | | The old game (checkoutRev 3): standard; shuffled; odd values 5 to 60 (targets 200-400); odd values with a ×4 ring and treble finish; shuffled with 2 minus wedges and exactly 4 darts; 90 s | 5 odd boards, an exact dart count on each: odd values; ×4 ring and treble finish; minus wedges, 4 darts; minus and ×4, 4 darts; minus, ×4 and treble finish; targets 80 to 320; 90 s |

- **Why this curve:** Darts players lean on checkouts they know by heart, so the fair way to raise the game is to change the board under them, then add minus wedges and exact dart counts.
- **Proof:** searchCheckout (exhaustive, checkout.ts) proves every board has a checkout thrown in a bust-free order and stores the fewest darts; Easy and Expert boards are also found by checkoutPersonFinds inside 6,000 dart lists (checkout.server.ts); scripts/number-levels-checkout-kakuro-check.ts runs 100 Expert seeds. Give the new Hard the same person filter. Five boards is the ceiling: a six-board trial left the near-perfect kit unfinished on all 16 deals.
- **Measured today:** Documented: only that the near-perfect kit finishes 80 % of Expert. This session's kit run (24 deals): Easy 168 (54 % finish) / 200 / 200 / 200; Normal 50 / 105 / 198 / 200; Hard 52 / 104 / 188 / 197; Expert 25 / 53 / 103 / 187 (83 % finish). Hard scores like Normal.
- **Stamp:** Level field only: checkoutRev 4 stores every board's wedges, ring, darts and target, and timeLimitMs can carry Easy's clock. Hard moves from checkoutRev 3 to checkoutRev 4 rows.
- **Files:** `src/lib/levels/gameLevels.ts`, `src/lib/duel/numberLevels.ts`, `src/lib/duel/checkout.server.ts`, `scripts/number-levels-checkout-kakuro-check.ts`, `scripts/puzzle-fairness/kits-number.ts`
- **Risk:** The kit rates an odd board only 1.25 times slower than a standard one, so Hard's real step is unproven until played; it also retires the old game from Hard.

### Ballpark (`numline`, Number)

**Lever: Marks on the ruler.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Today's three easy lines, with every tenth tick labelled (0, 1, 2 to 10; 0, 10 to 100; 0, 0.1 to 1), 90 s. | numlineRev 2: 0-1 (fractions, decimals, per cents), 0-100 (products, per cent of, squares, divisions), then -50 to 50 or 0-1,000; 15 numbers; unlabelled tenth ticks; 90 s | Today's Hard lines on a ruler marked only at the quarters (3 ticks, Normal has 9), 90 s. | A bare ruler with one middle tick; lines 0-100, then -50 to 50 or 0-1,000, then 0-10,000, every end label shown from the start (the hidden end goes); 75 s for the 15 numbers. |
| First seconds | Every tick on the ruler carries its number | | Only three ticks: the quarters | A bare ruler with one middle tick |
| Today | Lines 0-10, 0-100, 0-1 (whole numbers, halves, simple fractions, tens per cents); 3 lines of 5 numbers; unlabelled tenth ticks; 90 s | | 0-1 (fractions over 11 to 19, thousandths), -100 to 100 (negatives, powers, roots), 0-1,000 (powers, roots, n/d of 1,000); tenth ticks; 90 s | 0-100, then -50 to 50 or 0-1,000, then 0-10,000 (two-digit products, powers, 1,000 × roots); each line's top label hidden until 3 of 5 are placed; tenth ticks; 90 s |

- **Why this curve:** Ballpark is judging a place by eye, so thinning the ruler's marks makes the same sums harder to place and is seen before the first drag, where today's hidden end label only turns the first three into a guess.
- **Proof:** Open by design (every placing scores by distance), so there is no solve to prove: nothing is hidden and every value is exact. scripts/number-levels-measure-numline-check.ts should pin that the near-perfect kit, refitted to measured pointing error on each ruler, still has Expert runs of 185 or more. No such refit exists today; it must be written.
- **Measured today:** Not documented. This session's kit run (24 deals; the kit's error and pace are set by level name, so they are its author's guesses): Easy 151 / 174 / 189 / 198; Normal 92 / 158 / 178 / 192; Hard 63 / 143 / 170 / 187; Expert 46 / 123 / 154 / 175. All four screens look alike.
- **Stamp:** Level field plus a stored marks count on each line (display only, like hideEnd) and Expert's 75 s in timeLimitMs; no grading change, so no new revision. Stored hideEnd rounds draw as before.
- **Files:** `src/lib/duel/numlineLevels.server.ts`, `src/lib/duel/numline.ts`, `src/puzzles/numline.tsx`, `src/lib/levels/gameLevels.ts`, `scripts/number-levels-measure-numline-check.ts`, `scripts/puzzle-fairness/kits-number.ts`
- **Risk:** The drag sound ticks at every tenth, which would give the missing marks away by ear unless it follows the marks shown.

### Kakuro (`kakuro`, Number)

**Lever: Size of the grid.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 5 × 5 with 9 to 11 white squares (today 12 to 14), grade 0, every square seen within 2 solver passes, 120 s. In-memory kit trial: 179 (every run finished) / 198 / 200 / 200. | kakuroRev 3: 6 × 6, 16 to 19 white squares, grade 0 to 4, at most 3 solver passes; 120 s | A wider board, 7 squares across by 6 down, 20 to 23 white squares, grade 0 to 6, every board finished by the person-like solver, 120 s. Nearest trials: the old 6 × 6 gives 60 / 105 / 172 / 198 and a 7 × 7 with 22 to 25 squares 55 / 100 / 120 / 187. | Keep today's 7 × 7 with 26 to 28 white squares: the clock is the ceiling (a 7 × 7 with 29 to 31 squares halved the near-perfect kit's finishes), and it measures 46 / 78 / 102 / 174. |
| First seconds | A small grid with about ten white squares | | A wider grid, seven squares across | The full 7 × 7 grid, 27 squares to fill |
| Today | 5 × 5 grid (clue row and column included), 12 to 14 white squares, grade 0; 120 s | | The old game (kakuroRev 2): 6 × 6, 19 to 21 white squares, grade up to 10, not filtered by the person-like solver; 120 s | 7 × 7, 26 to 28 white squares, grade 4 to 12, every board finished by the person-like solver; 120 s |

- **Why this curve:** Kakuro's load is squares to fill times how deep each deduction runs, so the grid grows a row or a column a level until the 120 s clock, not the phone, stops it at 7 × 7.
- **Proof:** searchKakuro proves exactly one solution and kakuroPersonSolve (run combinations only, never a guess) completes every Easy, Hard and Expert board (kakuro.server.ts). scripts/number-levels-checkout-kakuro-check.ts runs 100 Expert seeds and the near-perfect kit's 80 % finish. To write: rectangular layouts in generateKakuroLevel and a bank for the 7-wide boards, which take 0.5 to 2 s each to deal.
- **Measured today:** Documented: only that the near-perfect kit finishes 80 % of Expert. This session's kit run (24 deals): Easy 106 (38 % finish) / 190 / 198 / 200; Normal 80 / 163 / 187 / 200; Hard 60 / 105 / 172 / 198; Expert 46 / 78 / 102 / 174 (83 % finish). The person-like solver finishes only 30 of 40 of today's Hard boards.
- **Stamp:** New kakuroRev 4 for the 7 × 6 board: the stored puzzle and answer assume a square size. Easy and Expert stay kakuroRev 3 with the level field.
- **Files:** `src/lib/levels/gameLevels.ts`, `src/lib/duel/numberLevels.ts`, `src/lib/duel/kakuro.ts`, `src/lib/duel/kakuro.server.ts`, `src/puzzles/kakuro.tsx`, `scripts/number-levels-checkout-kakuro-check.ts`, `scripts/puzzle-fairness/kits-kakuro.ts`
- **Risk:** It retires the old game from Hard (Joe's 15 Nov choice), a quarter of whose boards cannot be finished by deduction alone.


## Speed and Attention (session D3)

### Flash (`reaction`, Speed)

**Lever: Trap flashes before each gold.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 5 golds; the first inside 3 s with no trap before it (today 4–7 s); 0–1 plain trap before the others and no look-alikes (as today); gold up 1.5 s. | 5–8 golds, 1–3 traps before each (half gold look-alikes), traps 0.6 s long, gold up 1.5 s, 60 s | 8 golds; 3–5 traps before each (about 32 a round against Normal's 13), each 0.45 s long and 0.6–1 s apart, the first inside the first second; 75 % gold look-alikes; gold up 0.9 s. | 9 golds; 6–8 traps before each (about 63 a round), each 0.35 s long and 0.5–0.65 s apart (never more than two a second); 90 % look-alikes; gold up 0.6 s. |
| First seconds | A calm dark glass; the first gold arrives within three seconds. | | Trap colours fire about once a second from the start. | The glass flickers twice a second, nearly all gold look-alikes. |
| Today | 5 golds, 0–1 plain traps before each, gold up 1.5 s, 60 s | | 6–8 golds, 2–3 traps, 75 % look-alikes, gold up 1.5 s | 8 golds, 3–5 traps, 75 % look-alikes, gold up 1 s |

- **Why this curve:** The only thing Flash can ask beyond a fast finger is not to be fooled, so the traps multiply and quicken while the gold's own window never drops below 0.6 s, more than twice the 0.25 s limit.
- **Proof:** Open by design (a reaction game). At 0.25 s a gold pays 115 on tapRev 7's curve, so with the 15-point steady hand the limits player tops out at 130 on every level, Normal included. Expert's 200 needs I1's tapRev 8 with the curve's full mark at 250 ms (I1 as written, 250 ms = 150, still caps the limits player at 165). With that, playFlashHuman in scripts/speed-levels-tune.ts must reach 200 in its best tenth at Expert, pinned in scripts/speed-levels-check.ts.
- **Measured today:** Elite held to human limits 124 / 114 / 106 / 100 (Expert best tenth 123); 140 ms elite 188 / 186 / 187 / 183 (speed-levels-tune, 100 deals). Average player: not documented.
- **Stamp:** Level field only: the deal stamps flashMs (as today) and a new trapMs that the stage and replayFlash read. Expert's 200 also needs I1's tapRev 8 (Joe's scoring decision).
- **Files:** `src/lib/levels/speedLevels.ts`, `src/puzzles/reaction.tsx`, `src/lib/duel/tapLog.ts`, `src/lib/duel/depth/flash.ts`, `scripts/speed-levels-tune.ts`, `scripts/speed-levels-check.ts`
- **Risk:** Until I1 moves the curve no level can pass 130 under the limits, and fast full-screen flashes must stay under three a second.

### Ascend (`numhunt`, Speed)

**Lever: Numbers on the board.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 16 numbers, 1 to 16 with no gaps (today 16 picked from 1–30), discs never move, 60 s, speed full by 15 s (today 40 s). | 24 numbers 10–99, discs move every 15 s, 60 s, speed full by 40 s | 32 numbers 10–99, discs move every 10 s, 40 s clock, speed full by 32 s. | 40 numbers 10–99, highest first, discs move every 8 s, 55 s clock, speed full by 49 s. 40 is the 390 px ceiling at 44 px discs (a jittered 5 × 8 grid). |
| First seconds | Sixteen big discs, 1 to 16, that never move. | | Thirty-two discs crowd the board; the clock bar is short. | Forty discs fill the board; the goal says highest first. |
| Today | 16 numbers from 1–30, discs never move, 60 s, speed full by 40 s | | 30 numbers 10–99, move every 10 s, 50 s, full by 25 s | 30 numbers, highest first, move every 8 s, 45 s, full by 20 s |

- **Why this curve:** Search time grows with the square of the numbers on the board (about 11, 20, 33 and 51 s for the limits player), so eight more discs a level is a steep, even step anyone can see.
- **Proof:** Open (search and tap). playAscend in scripts/speed-levels-tune.ts under HUMAN_LIMITS (0.25 s to react, 0.15 s to move, 35 ms a disc still to search) finishes Hard in about 33 s and Expert in about 51 s; each clock and full-by is set from that run so its best tenth scores 200, pinned in scripts/speed-levels-check.ts. Today's Expert is full by 20 s against about 31 s for that player (best tenth 181).
- **Measured today:** Elite held to human limits 199 / 199 / 190 / 178 (Expert best tenth 181); 140 ms elite 200 / 199 / 199 / 193. Average player: not documented.
- **Stamp:** Level field only: moveMs, timeLimitMs, fullByS and descending are already stamped on the puzzle, and the count and range are in the dealt board.
- **Files:** `src/lib/levels/speedLevels.ts`, `src/puzzles/numberHunt.tsx`, `scripts/speed-levels-tune.ts`, `scripts/speed-levels-check.ts`
- **Risk:** 40 discs need the jittered grid, which reads more orderly than a free scatter.

### Eagle Eye (`symscan`, Attention)

**Lever: Eagles in each grid.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Grids 4×4, 4×4, 5×5 (16, 16, 25 eagles); 3–5 targets; one facing; no look-alikes (every other eagle faces at least 90° away); 60 s; speed full by 20 s. | Grids 5×5, 6×6, 7×7; 5–9 targets; two facings on grid 3 (4–6 each); 60 % look-alikes; 60 s; full by 15 s | Grids 7×7, 8×8, 8×8 (49, 64, 64 eagles); 8–12 targets; two facings from grid 2; 75 % look-alikes; 60 s; speed full by 26 s. | Three grids of 8 across by 10 down (80 eagles each at 45 px, the phone's ceiling); 10–14 targets in two facings on every grid; 85 % look-alikes; 60 s; speed full by 40 s. |
| First seconds | Sixteen big eagles, and nothing that nearly matches. | | Forty-nine small eagles in the very first grid. | Eighty eagles a grid and two facings to find. |
| Today | Grids 4×4, 5×5, 6×6; 4–7 targets; one facing; 30 % look-alikes; 60 s; speed full by 12 s | | Grids 6×6, 7×7, 8×8; 6–10 targets; two facings from grid 2; 75 % look-alikes; full by 8 s | Three 7×7 grids; two facings on every grid (4–6 each); 80 % look-alikes; full by 8 s |

- **Why this curve:** A search game is as hard as the crowd is big, so the first grid runs 16, 25, 49, 80 eagles (to the 45 px ceiling) while look-alikes and a second facing slow every judgement.
- **Proof:** Answers are counted from the dealt board (scripts/attention-levels-check.ts). Only the 10 speed points are timed: a limits run (0.4 s a tap plus the scan; to be added to scripts/attention-levels-lib.ts) sets each full-by so its best tenth scores 200. Today Hard and Expert are full by 8 s, under the 11 and 13 s their taps alone take (best tenth 189); the check's own 200 is a 40 ms-a-step run.
- **Measured today:** Great / near-perfect kit, 40 seeds: E 184 / 193, N 187 / 196, H 159 / 179, X 148 / 175 (Expert best tenth 166 / 189). Easy scores below Normal for the great kit. Average player: not documented.
- **Stamp:** levelRev 2 on level deals: the grader reads full-by from the level table by level name, so new numbers need a stamp to leave stored level rounds alone. Normal untouched.
- **Files:** `src/lib/levels/attentionLevels.data.ts`, `src/puzzles/symbolScan.tsx`, `src/lib/duel/attentionLevels.ts`, `src/lib/duel/attentionLevels.server.ts`, `src/lib/duel/standard/attention.server.ts`, `scripts/attention-levels-lib.ts`, `scripts/attention-levels-check.ts`
- **Risk:** 45° look-alikes must stay readable on 45 px eagles.

### Double Take (`spotdiff`, Attention)

**Lever: Shapes in each picture.** Redesigned. **New mechanic:** Mirrored lower picture, at Expert.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 5×4 pictures (20 shapes, about 70 px each); 4 differences a picture, colour and shape only; no hidden one; 8 misses allowed; 60 s; speed full by 25 s. | 8×6 pictures, 6 differences + a hidden 7th, colour, shape and turn, 5 misses allowed, 60 s, full by 40 s | 8×7 pictures (56 shapes, the ceiling: two stacked panels reach the 36 px floor); 8 differences + the hidden one; subtle colours; 3 misses allowed; 75 s; speed full by 45 s. | 8×7; 10 differences + the hidden one; the lower picture is drawn mirrored left to right (new, announced on the divider); subtle colours; 2 misses allowed; 90 s; speed full by 65 s. |
| First seconds | Two small pictures of twenty big sweets. | | Fifty-six sweets a picture and only three misses allowed. | The lower picture is a mirror image of the upper. |
| Today | 6×5 pictures, 5 differences each, colour and shape only, no hidden one, 5 misses allowed, 60 s, speed full by 30 s | | 8×6, 7 + hidden, subtle colours, 60 s, full by 10 s | 8×8, 8 + hidden, turns twice as common, subtle colours, 75 s, full by 12 s |

- **Why this curve:** The picture grows until two stacked panels hit the 36 px floor at 8 by 7, and past that the fair, visible step is to mirror the copy, which slows every comparison without hiding anything.
- **Proof:** A picture is kept only when its panels differ in exactly the dealt ways (scripts/attention-levels-check.ts); the mirror only remaps places, so the answer is unchanged. A limits run (0.4 s a tap plus a row-by-row compare; to be written in scripts/attention-levels-lib.ts) sets each full-by so its best tenth scores 200. Today's full by 10 s and 12 s leave 3 to 4 s of looking after the taps (best tenth 189).
- **Measured today:** Great / near-perfect kit, 40 seeds: E 185 / 196, N 179 / 188, H 162 / 176, X 150 / 173 (Expert best tenth 171 / 189). Average player: not documented.
- **Stamp:** levelRev 2 on level deals (miss limits and full-by are read from the level table) and a stored mirror flag on Expert deals, through which taps are mapped.
- **Files:** `src/lib/levels/attentionLevels.data.ts`, `src/puzzles/spotTheDifference.tsx`, `src/lib/duel/attentionLevels.server.ts`, `src/lib/duel/attentionRev.ts`, `src/lib/duel/standard/attention.server.ts`, `scripts/attention-levels-lib.ts`, `scripts/attention-levels-check.ts`
- **Risk:** Joe may read the mirror as a gimmick; the fallback Expert is a third 8×7 picture in 90 s.

### Tally (`countup`, Attention)

**Lever: Shapes on the tray.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 3 trays of 15, 25, 35 shapes; counts 3–9; each tray asks for one colour or one shape alone; no near-miss groups; marks on; 60 s; speed full by 20 s. | 4 trays of 50, 80, 110, 50 (the last compares two colours); counts 3–19; 2 near-miss groups; tap to mark; 60 s; full by 30 s | 4 trays of 80, 95, 110, 80; counts 8–24; 3 near-miss groups; comparison gap 1–5; marks on; 75 s; speed full by 45 s. | 4 trays of 110 (the most a tray holds); counts 12–26; two-colour questions; 3 near-miss groups; no marks; 90 s; speed full by 60 s. |
| First seconds | Fifteen big shapes; count one colour. | | Eighty shapes on the first tray, counts into the twenties. | A packed tray of 110, two colours, no marks. |
| Today | 3 trays of 25, 40, 55 shapes; counts 3–14; 1 near-miss group; 60 s; speed full by 25 s | | Normal's trays; 3 near-miss groups; a closer comparison (gap 1–5); full by 5 s | Trays of 60, 90, 110, 60; counts 5–21; two-colour questions; no marks; 75 s; full by 35 s |

- **Why this curve:** Counting gets harder with the crowd and the size of the count, so both rise every level to the 110-shape ceiling and only Expert loses the marks, where today's Hard is a 5-second speed target nobody can see or meet.
- **Proof:** Each answer is counted from the dealt tray (scripts/attention-levels-check.ts). A limits run (about 0.25 s an item counted and 0.4 s a key; to be written in scripts/attention-levels-lib.ts) sets each full-by so its best tenth scores 200. Today's Hard is full by 5 s, about the time it takes just to key four answers.
- **Measured today:** Great / near-perfect kit, 40 seeds: E 166 / 192, N 162 / 185, H 125 / 169, X 115 / 160 (Expert best tenth 183 / 200). Average player: not documented. No contact sheet exists for Tally.
- **Stamp:** levelRev 2 on level deals: full-by is read from the level table by level name; the trays themselves are in the dealt board.
- **Files:** `src/lib/levels/attentionLevels.data.ts`, `src/puzzles/countUp.tsx`, `src/lib/duel/attentionLevels.server.ts`, `src/lib/duel/standard/attention.server.ts`, `scripts/attention-levels-lib.ts`, `scripts/attention-levels-check.ts`
- **Risk:** 110-shape trays with counts in the twenties leave few clear colours; the spread already re-deals trays it cannot make legible.

### Labyrinth (`maze`, Attention)

**Lever: Steps to walk.** Redesigned. **New mechanic:** Gold keys to collect before the exit opens: 2 at Hard, 4 at Expert.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today (13×15, route 40–70, 4 dead ends, 60 s, full by 20 s): it already does its job, the great kit averages 196 on 28 px corridors. | 19×23, route 70–147, 8 dead ends (3 long), 60 s, full by 32 s, par points gone at 1.5× par | 21×27 (17 px corridors, the finest a finger can trace); 2 gold keys at the ends of long dead ends, fetched in either order before the exit opens; shortest walk 200–260 steps; 75 s; speed full by 55 s; par points gone at 1.5× par (Normal's rule). | 21×27; 4 keys, one in each quarter; the exit shown from the start (today's hidden exit goes); shortest walk 320–400 steps; 105 s; speed full by 85 s; par points gone at 1.25× par. |
| First seconds | A small maze with wide corridors. | | A fine maze with two gold keys and a locked exit. | Four keys in four corners; par above 320. |
| Today | 13×15 maze, route 40–70, 4 dead ends, 60 s, speed full by 20 s | | 21×27, route 120–180, 12 dead ends (5 long), 75 s, full by 15 s, par points gone at 1.03× par | 21×27, route 150–240, exit hidden until 4 squares away, 90 s, full by 20 s |

- **Why this curve:** The maze is already as fine as a finger can trace at 21 by 27, so the walk is lengthened the way mazes always have been, with keys to fetch, which shows at a glance and hides nothing, unlike today's hidden exit.
- **Proof:** A perfect maze has one path between any two squares, so the shortest key tour is exact (tree distances over at most 24 orders) and becomes the par. personMazeSeconds in scripts/attention-levels-lib.ts (0.2 s a square, reading the walls) must be extended to tour the keys and finish every dealt Hard and Expert maze inside its full-by, which makes 200 reachable; a maze it cannot is redrawn. Today's full by 15 s and 20 s sit far under that solver's 36–71 s.
- **Measured today:** Great / near-perfect kit, 40 seeds: E 196 / 199, N 184 / 196, H 158 / 176, X 150 / 169 (Expert best tenth 162 / 189); the person-like solver reaches the hidden exit in 36–71 s. Average player: not documented.
- **Stamp:** mazeRev 6 on Hard and Expert deals (the exit counts only once every key is held; par is the key tour); Easy and Normal keep mazeRev 5; levelRev 2 for the new full-by times.
- **Files:** `src/lib/levels/attentionLevels.data.ts`, `src/lib/duel/maze.server.ts`, `src/lib/duel/maze.ts`, `src/lib/duel/depth/labyrinth.ts`, `src/lib/duel/standard/attention.server.ts`, `src/puzzles/mazeDash.tsx`, `scripts/attention-levels-lib.ts`, `scripts/attention-levels-check.ts`
- **Risk:** Choosing the key order on 17 px corridors may decide the score more than the walking does.

### Bomb Defusal (`bomb`, Attention)

**Lever: Steps and clues on the card.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today (5 wires, 4 steps, 4 clues, 90 s, full by 25 s): it already does its job, the great kit averages 197. | 7 wires, 6 steps, 6–9 clues, 90 s, full by 30 s | 8 wires, 8 steps, 8–9 clues (today's Expert card) with Reset kept and at most two 'Step N' clues; 105 s; speed full by 55 s. | The same 8-wire, 8-step card (a 390 px phone is full at 8 wires and 9 clues); at most one 'Step N' clue, the rest relative; the first wrong step explodes and there is no Reset (as today); 120 s; speed full by 70 s; only cards the person-style solver cracks within 40 orders. |
| First seconds | Five wires and a four-line card. | | Eight wires and a card of eight or nine clues. | No Reset button: one wrong step sets it off. |
| Today | 5 wires, 4 steps, 4 clues, 90 s, speed full by 25 s | | 7 wires, 7 steps, 7–8 clues, 90 s, full by 15 s | 8 wires, 8 steps, 8–9 clues, the first wrong step explodes, no Reset, 120 s, full by 40 s |

- **Why this curve:** A bomb is harder with more to read and reason about, so the card grows until the phone is full at 8 wires and 9 clues, and Expert then takes away the safety net and the give-away 'Step N' clues instead of shrinking the type.
- **Proof:** Each level deals from its own bank (scripts/bomb-levels-bank.ts, src/lib/duel/bombLevels.server.ts), every card proved by search over all orders to have one answer with every clue needed. personBombTries in scripts/attention-levels-lib.ts must crack every Hard and Expert card within 40 orders tried in the head, and each full-by is set from that pace (about 2.5 s a clue read, 1 s an order, 0.4 s a step) so 200 is reachable. Today's Hard is full by 15 s, less than the time to read its card.
- **Measured today:** Great / near-perfect kit, 40 seeds: E 197 / 200, N 182 / 194, H 113 / 168, X 72 / 136 (Expert best tenth 176 / 189); the person-like solver cracks every Expert card (median 19 orders, at most 99). Average player: not documented.
- **Stamp:** levelRev 2 on level deals (full-by is read from the level table) and rebuilt Hard and Expert banks; Expert keeps its stored bombInstant flag.
- **Files:** `src/lib/levels/attentionLevels.data.ts`, `src/lib/duel/bombLevels.server.ts`, `scripts/bomb-levels-bank.ts`, `src/lib/duel/bombLevelsBank.server.ts`, `src/lib/duel/standard/logic.server.ts`, `scripts/attention-levels-lib.ts`, `scripts/attention-levels-check.ts`
- **Risk:** Cards with one anchor clue that crack within 40 orders may be rare; Expert's proof already takes about 25 s a card.

### Don’t Break the Chain (`chain`, Speed)

**Lever: Charms in the cycle.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 4 charms in the cycle and a new board every 4 links; 24 links; windows 4 / 3.5 / 3 s; no reversed board; one spare link (the first wrong or late tap is forgiven); 45 s; speed full by 25 s. | 40 links, 5-charm cycle, a new board every 5 links, windows 3 / 2.5 / 2 s, links 21–25 reversed, 45 s | 6 charms and a new board every 6 links; 48 links; windows 2.5 / 2 / 1.6 s; two reversed boards; 60 s; speed full by 42 s. The board stays at 20 charms, its ceiling. | 7 charms and a new board every 7 links; 56 links; windows 2 / 1.6 / 1.4 s (the human floor); three reversed boards; 70 s; speed full by 50 s. |
| First seconds | Four charms in the strip and a spare-link pip. | | Six charms in the strip, and 0 / 48 links. | Seven charms in the strip, and 0 / 56 links. |
| Today | 30 links, 5-charm cycle, windows 3.5 / 3 / 2.5 s, no reversed run, 45 s | | 40 links, 5 charms, windows 2.5 / 2 / 1.6 s, reversed 21–25 and 31–35, 45 s | 50 links, 6 charms, windows 2 / 1.6 / 1.4 s, reversed 21–25 and 36–40, 60 s |

- **Why this curve:** The cycle is what the player has to hold in mind, and four fits in a glance where seven does not, so a charm is added every level while the tap windows only fall to the human floor of 1.4 s.
- **Proof:** Open (find and tap in time). playChain in scripts/speed-levels-tune.ts under HUMAN_LIMITS (0.4 s a tap, about 0.32 s to find a charm, more on a new or reversed board) must finish Expert's 56 links in its best tenth inside the stamped full-by, which is 200; scripts/speed-levels-check.ts pins it. Today full-by is 30 s at every level: 0.6 s a link over Expert's 50 links, under that player's 0.72 s (best tenth 182).
- **Measured today:** Elite held to human limits 174 / 160 / 141 / 119 (Expert best tenth 182); 140 ms elite 180 / 175 / 174 / 165. Speed is full by 30 s at every level. Average player: not documented.
- **Stamp:** Level field only: chainLevel gains cycle (4 to 7), block, spare and fullByS, all stamped on the puzzle and read by the stage, replayChain and the grader.
- **Files:** `src/lib/levels/speedLevels.ts`, `src/lib/duel/chain.ts`, `src/lib/duel/chain.server.ts`, `src/lib/duel/standard/attention.server.ts`, `src/puzzles/chainTap.tsx`, `scripts/speed-levels-tune.ts`, `scripts/speed-levels-check.ts`
- **Risk:** A link slower than its window ends the run, so a tenth of a second on the last window swings Expert from fair to unfinishable.

### Matchmaker (`pairmatch`, Attention)

**Lever: Cards on the board.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today (8 pairs, 16 cards in 4 columns, flip-back 0.9 s, 90 s, full by 35 s): it already does its job, the great kit averages 197. | 15 pairs (30 cards, 5 columns), flip-back 0.6 s, 6 shapes, 90 s, full by 60 s, 14 free misses | 21 pairs (42 cards, 6 × 7); flip-back 0.5 s; 5 shapes; 105 s; speed full by 60 s; extras in full with up to 3 memory misses (a miss on a card whose partner was already seen) and none from 9; first looks never count. | 28 pairs (56 cards, 7 × 8, about 47 px wide: the phone's ceiling); flip-back 0.4 s; all 6 shapes (28 of the 30 faces); 120 s; speed full by 80 s; extras in full with up to 2 memory misses and none from 6; gold pair window 45 s. |
| First seconds | Sixteen big cards. | | Forty-two cards, six across and seven down. | Fifty-six small cards fill the whole screen. |
| Today | 8 pairs (16 cards, 4 columns), flip-back 0.9 s, 90 s, speed full by 35 s, 7 free misses | | 18 pairs (36 cards, 6 columns), 0.5 s, 4 shapes, 90 s, extras in full up to 6 misses and none from 14 | 21 pairs (42 cards, 6 × 7), 0.4 s, 5 shapes, 120 s, full by 75 s, extras 6 / 14 |

- **Why this curve:** Memory load is the number of cards, so the board grows about 1.4 times a level to the phone's ceiling of 56, where today's 30, 36 and 42 are too close to tell apart.
- **Proof:** Every face is dealt twice. A perfect-memory sweep under the limits (0.4 s a flip; to be written in scripts/attention-levels-lib.ts) must finish each dealt Hard and Expert board inside its full-by with no memory miss and the gold pair in its window, or the board is redrawn: that run is 200. Today 200 is luck on Hard and Expert: extras need 6 or fewer misses, but perfect memory still averages about 11 first-look misses on 18 pairs and 13 on 21 (best tenth 165), and the check's 200 pairs every card unseen.
- **Measured today:** Great / near-perfect kit, 40 seeds: E 197 / 197, N 192 / 199, H 154 / 165, X 151 / 153 (Expert best tenth 156 / 165). Average player: not documented.
- **Stamp:** levelRev 2 on level deals: the extras rule (memory misses), full-by and gold window are read from the level table.
- **Files:** `src/lib/levels/attentionLevels.data.ts`, `src/lib/duel/attentionLevels.ts`, `src/lib/duel/pairmatch.ts`, `src/lib/duel/standard/attention.server.ts`, `src/lib/duel/attentionLevels.server.ts`, `src/puzzles/pairMatch.tsx`, `scripts/attention-levels-lib.ts`, `scripts/attention-levels-check.ts`
- **Risk:** 56 cards in 120 s may be past anyone's memory; if the great kit never finishes, Expert steps back to 24 pairs (6 × 8).

### Bonk (`whack`, Speed)

**Lever: Burrows on the lawn.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 3×3 lawn (9 burrows, about 125 px each); up 1.1 to 0.8 s, 2 up at once, 2 rule flips, 5 % hedgehogs, pops 115 % apart (all as today). | 4×4 lawn, up 0.9 to 0.6 s, 3 up at once, 3–5 rule flips, 10 % hedgehogs, 60 s | 5×5 lawn (25 burrows, about 72 px); 4 up at once; up 0.72 to 0.5 s; pops 60 % apart (about 110 gophers to bonk); 5–7 flips; 15 % hedgehogs. | 6×6 lawn (36 burrows, about 58 px); 5 up at once; up 0.67 to 0.5 s (the floor: 0.25 s to react, 0.15 s to move, 0.1 s spare); pops 45 % apart (about 150 to bonk); 7–9 flips; 20 % hedgehogs. |
| First seconds | A 3 by 3 lawn of nine big burrows. | | A 5 by 5 lawn: 25 burrows, four gophers up. | A 6 by 6 lawn: 36 burrows, five up at once. |
| Today | 4×4 lawn, up 1.1 to 0.8 s, 2 up at once, 2 rule flips, 5 % hedgehogs, pops 115 % apart, 60 s | | 4×4, up 0.72 to 0.5 s, 3 up, 5–7 flips, 15 % hedgehogs, pops 50 % apart | 4×4, up 0.67 to 0.45 s, 4 up, 7–9 flips, 20 % hedgehogs, pops 50 % apart |

- **Why this curve:** A bigger lawn is the classic whack-a-mole step, seen before the first gopher pops, and it is the lever left because up-time is already at the human floor of half a second.
- **Proof:** Must be written: a limits oracle (a bonk no sooner than 24 ticks after its pop, 15 to react and 9 to move, and 9 after the last bonk, earliest deadline first) plays every dealt schedule through replayWhackRun; the deal keeps a seed only when it clears every gopher and both diamonds. That proves the 150 base and 6 for diamonds. The 44 combo points need bonks within 150 ms of the pop (none count from 267 ms), so the limits player tops out near 160 on every level, Normal included (today's best tenth 143): 200 needs the combo's quick window at the limit (full to 24 ticks, none from 36, the window Pull! was given in clayRev 10), a scoring-review item like I1 that is not in the plan's list.
- **Measured today:** Elite held to human limits 148 / 146 / 140 / 129 (Expert best tenth 143); 140 ms elite 194 / 194 / 191 / 190. The contact sheet's seed deals 47 / 64 / 132 / 126 gophers to bonk, so Expert has fewer than Hard. Average player: not documented.
- **Stamp:** Level field only for the lawn and pace (bonkLevel gains cols, stamped on the puzzle); 200 under the limits also needs whackRev 5 for the combo's quick window (Joe's scoring decision).
- **Files:** `src/lib/levels/speedLevels.ts`, `src/lib/arcade/whack.ts`, `src/lib/arcade/whack.renderer.ts`, `src/puzzles/whack.tsx`, `src/lib/duel/whack.ts`, `scripts/speed-levels-tune.ts`, `scripts/speed-levels-check.ts`
- **Risk:** The bots move in a flat 0.15 s, so they cannot feel a bigger lawn; the crowd and the pace have to carry the measured step.

### Tenfall (`tendrop`, Speed)

**Lever: Size of the targets.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today (8 targets from 10 up to 60, plus and minus tiles only, 80 % speed), but each gold ten pays 2.5 so a flawless run is 200 (today 8 gold tens at 2 make 196). | 10 targets from 19–25 up to 140, ×2, ÷2, ÷3 and minus tiles, fall speeds 288 to 504, 90 s, speed full by 60 s | 10 targets from 40 up to 250 (today's Hard opens below Normal); ×2 on about 30 % of tiles, ÷2 and ÷3 as today's Hard; 115 % speed; speed full by the oracle's finish. | 9 targets from 100 up to 400; every operator; 115 % speed (at 125 % the limits player never finished); gold pays 20 ÷ 9 a ten; speed full by the oracle's finish. |
| First seconds | Target 10, slow tiles, only numbers and minus. | | Target 40 or more at once; gold ×2 tiles everywhere. | Target 100 or more straight away, climbing to 400. |
| Today | 8 targets up to 60 (the first 10–12), plus and minus tiles only, 80 % speed, 90 s | | 10 targets up to 200 (the first 14–20), ÷3 tiles doubled, 115 % speed | 11 targets up to 240 (the first 15–22), every operator evenly, 115 % speed |

- **Why this curve:** The target is the whole question the game asks, so bigger targets from the first second (10, 22, 40, 100) are the honest ladder, and tile speed stays at 115 % because that is where the human limit was measured.
- **Proof:** Must be written: the plan's own solver (the fastest gold line, src/lib/arcade/tenDrop.ts) run at the level's spawn gap under the limits (a tile tappable 24 ticks after it enters, taps 9 ticks apart) gives each seed's earliest finish through replayTenDropRun; the deal keeps a seed only when that lands inside the level's full-speed time, so 150 + 30 + 20 is reachable. Today nothing proves it: full speed is by 60 s at every level and Expert's best tenth under the limits is 163.
- **Measured today:** Elite held to human limits 182 / 175 / 168 / 143 (Expert best tenth 163); 140 ms elite 183 / 181 / 181 / 166. Average player: not documented.
- **Stamp:** Level field only: tenLevel.stages already carries each target's range, tiles and speed; add goldEach and fullByTicks to tenLevel, stamped on the puzzle.
- **Files:** `src/lib/levels/speedLevels.ts`, `src/lib/arcade/tenDrop.ts`, `src/lib/duel/tenDrop.ts`, `scripts/speed-levels-tune.ts`, `scripts/speed-levels-check.ts`
- **Risk:** Targets near 400 may be too much mental arithmetic at tile speed even for strong players; tune the top target first.

### Pull! (`clayshoot`, Speed)

**Lever: Clays in the air together.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today (20 clays, 3 doubles at the end, 6 birds, 80 % speed) plus a bigger hit ring: 38 px against 30. | 25 clays (22 orange, 3 gold): 11 singles then 7 doubles, 14–16 birds, 30 px hit ring, 60 s | 30 clays, all in doubles from the first pull (15 doubles; Normal flies 11 singles first); 145 % speed; 24 birds. | 36 clays, all in triples from the first pull (12 triples, clays at least 0.2 s apart); 160 % speed (the ceiling: a clay must stay 0.6 s on screen); 32 birds. |
| First seconds | One slow clay at a time in a big ring. | | Two fast clays cross on the very first pull. | Three clays at once among a sky of birds. |
| Today | 20 clays, 3 doubles after the singles, 6 birds, 80 % speed, 60 s | | 28 clays, 10 doubles, 24 birds (some together), 145 % speed | 30 clays, 12 groups with 3 triples, 32 birds, 160 % speed |

- **Why this curve:** Singles, doubles, triples is how clay shooting itself gets harder and it shows on the first pull, which matters because clay speed tops out at 160 %.
- **Proof:** Must be written: a limits oracle (a shot no sooner than 24 ticks after its clay's launch, 15 to react and 9 to move, and 9 after the last shot, never through a bird) plays every dealt schedule through replayClayRun; the deal keeps a seed only when it hits every clay inside its quick window with the streak unbroken, which is 200. The quick window is full to 24 ticks (0.4 s), exactly the limit with nothing spare, so today's limits player's best tenth is 175; the oracle fires on tick 24, and a real player needs the window at 27 ticks (a small scoring-review item, clayRev 11).
- **Measured today:** Elite held to human limits 181 / 170 / 162 / 152 (Expert best tenth 175); 140 ms elite 199 / 199 / 198 / 196. Average player: not documented.
- **Stamp:** Level field only: pullLevel already carries clays, singles, groups, birds and speed; add the ring radius (Easy) and the smallest gap inside a group, stamped on the puzzle.
- **Files:** `src/lib/levels/speedLevels.ts`, `src/lib/arcade/clayShoot.ts`, `src/lib/arcade/clayShoot.renderer.ts`, `src/lib/duel/clayShoot.ts`, `scripts/speed-levels-tune.ts`, `scripts/speed-levels-check.ts`
- **Risk:** 32 birds across triples may leave few seeds with a clean shot inside every quick window; the oracle drops the rest.


## Pattern and Logic (session D4)

### Gridlock (`unblock`, Pattern)

**Lever: Lot size and cars.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 6×6 lot, 6–8 cars (today 8–10), 5–9 moves at the minimum (today 6–12), 60 s, full speed by 40 s | 7×7 lot, 10–13 cars, 15–22 moves, 60 s, full speed by 40 s (unblockRev 4) | 8×8 lot (46 px bays), 15–18 cars, 22–30 moves at the minimum, 75 s, full speed by 35 s | 9×9 lot (40 px bays on a 390 px phone), 20–24 cars, 36–44 moves, 110 s, full speed by 45 s. Ceiling: 9 across (10 would be 36.6 px, too small to drag a two-bay car); after it the lever is the line's length |
| First seconds | A small, half-empty lot with the gold car nearly out | | A bigger 8×8 lot packed with fifteen or more cars | A 9×9 lot, wall to wall with over twenty cars |
| Today | 6×6 lot, 8–10 cars, 6–12 moves at the minimum, 60 s, full speed by 40 s | | 7×7 lot, 12–14 cars, 22–30 moves, 60 s, full speed by 28 s | 7×7 lot, 13–15 cars, 40–48 moves, 90 s, full speed by 30 s |

- **Why this curve:** Hard and Expert today are Normal's 7×7 lot with a longer hidden line (par 29 against 40 is the only thing that differs on screen), so the step moves onto what the player sees, the lot and the cars, and the line's length backs it up.
- **Proof:** A bank of 120 per level from scripts/unblock-levels-bank.ts, every minimum proved by BFS over the whole lot (pattern-overhaul-unblock-levels-check). New: Expert keeps only boards scripts/unblock-human.ts finishes inside 110 s at 0.25 s to react and 0.15 s to move; today it finishes 73 % of the Expert bank, so 27 % of today's Expert boards have no proof.
- **Measured today:** level-tune, 60 deals: near-perfect 199.8 / 199.8 / 195.9 / 189.6, great 199.0 / 198.1 / 179.5 / 176.2 (E/N/H/X); person-like solver: Hard 164.3 (73 % finished), Expert 149.0 (70 %)
- **Stamp:** level field; the board already stores cols (raise unblockCols' limit in types.ts from 8 to 9); the new full-by times need a levelRev on level deals, because patternRules.ts reads them from the registry by the stored level
- **Files:** `src/lib/levels/pattern/unblock.levels.ts`, `scripts/unblock-levels-bank.ts`, `src/lib/duel/unblockLevelsBank.server.ts`, `src/lib/duel/types.ts`, `scripts/unblock-human.ts`, `scripts/pattern-overhaul-unblock-levels-check.ts`
- **Risk:** 9×9 lots with a 36–44 move minimum may be rare and slow to prove, and each new lot size needs its own lot render (lot-8, lot-9)

### Tessellate (`blockparty`, Pattern)

**Lever: Board size and pieces.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 6×6, six small pieces grown into one patch, 20+ ways to finish, 60 s (a smaller board and forgiving pieces already do the job) | 7×7, 9 pieces, 16 pegs, 5–60 ways to finish, 60 s (blockRev 4) | 8×8, 11 pieces (Normal's nine plus U and P), 21 pegs, 3–8 ways to finish, 2–3 held guesses, 70 s, full speed by 36 s | 9×9 (40 px squares), 13 pieces (two more five-square shapes), 28 pegs, 1–2 ways, 3 held guesses, 90 s, full speed by 45 s; tray five to a row. Ceiling: 9 across; after it, fewer ways and less time |
| First seconds | A small board and six little pieces | | A bigger 8×8 board with eleven pieces in the tray | A 9×9 board and thirteen pieces, two of them new |
| Today | 6×6, 6 small pieces, 19 pegs, 20+ ways to finish, 60 s, full speed by 40 s | | 7×7, Normal's 9 pieces, 2–5 ways, 2–3 held guesses for the person-like solver, 60 s, full speed by 32 s | 8×8, 11 pieces (+U, P), 21 pegs, 1–2 ways, 3 held guesses, 70 s, full speed by 36 s |

- **Why this curve:** Hard today is Normal's exact board and tray with fewer hidden solutions, which nobody can see, so every level now adds squares and pieces and the solution count only backs it up.
- **Proof:** A bank per level from scripts/blockparty-levels-bank.ts: solution counts by exhaustive count, and every Hard and Expert board finished by the person-like solver humanSolveBlock (forced moves, at most three held guesses); pattern-overhaul-blockparty-levels-check re-counts every board. A time model must be added so Expert's finish is shown inside 90 s.
- **Measured today:** not documented
- **Stamp:** level field; the board's size and tray are stored on the puzzle; the new full-by times need a levelRev on level deals (blockLevelFullByS reads the registry)
- **Files:** `src/lib/levels/pattern/blockparty.levels.ts`, `src/lib/duel/blockParty.ts`, `scripts/blockparty-levels-bank.ts`, `src/lib/duel/blockPartyLevelBank.server.ts`, `scripts/pattern-overhaul-blockparty-levels-check.tsx`
- **Risk:** two new piece renders, a 13-piece tray on short phones, and a slower exhaustive count on 9×9

### Pipeline (`pipes`, Pattern)

**Lever: Tiles on the board.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 5×5, 15 tiles to turn and 10 already right, spills shown, 120 s (a quarter of Expert's board; does the job) | 7×7 (49 tiles), at least 80 % turned, spills shown, one layout only, 120 s, full speed by 60 s (pipesRev 5) | 8×9 (72 tiles, today 64), at least 90 % turned, spills shown, 105 s (today 120), full speed by 60 s | As today: 8×11 (88 tiles), at least 95 % turned, no spills shown, 120 s, full speed by 90 s. Already at the ceiling: 8 across (45 px), 11 down on a short phone (39 px), and the person-like player needs 106–115 s of the 120 |
| First seconds | A small 5×5 board with many pipes already joined | | A taller board of 72 tiles, nearly all turned | Tiles to the bottom of the screen and no leak marks |
| Today | 5×5 (25 tiles), exactly 60 % turned, spills shown, 120 s | | 8×8 (64 tiles), at least 90 % turned, spills shown, 120 s | 8×11 (88 tiles), at least 95 % turned, no spills shown in play, 120 s, full speed by 90 s |

- **Why this curve:** Tile count is what a player sees and what sets the work (25, 49, 72, 88), and Expert already fills both the phone and the clock, so only Hard needed to move up to sit midway.
- **Proof:** Every level board is proved one-solution at the deal by the person-like solver deducePipes (pipesSolve.server.ts: matching sides, no loops, no sealed group, never a guess) and re-proved by search in pattern-overhaul-pipes-levels-check; scripts/pipes-human.ts times it, and Expert finishes inside 120 s at 0.25 s a turn.
- **Measured today:** medians not documented; the person-like player finished Expert room seeds 1 and 2 in 115 s and 106 s (166 and 178 points)
- **Stamp:** level field only: cols and rows ride on the board and Hard's new clock is the puzzle's own timeLimitMs, stamped at the deal
- **Files:** `src/lib/levels/pattern/pipes.levels.ts`, `src/lib/duel/logic.server.ts`, `scripts/pipes-human.ts`, `scripts/pattern-overhaul-pipes-levels-check.ts`
- **Risk:** low; Hard at 72 tiles in 105 s may sit close to Expert for the best players

### Box Six (`sudoku`, Logic)

**Lever: Numbers given at the start.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 19–21 of the 36 squares given, singles only, live clashes, used-up digits leave the keypad, 90 s | 13–15 givens, 90 s (depthRev 3) | 10–11 givens, needs 2 advanced steps (a pair, pointing or box-line), live clashes, 75 s (today 90) | 8–9 givens (8 is the fewest a 6×6 can have), needs 3 advanced steps, clashes only on Check, 75 s. The grid cannot grow (the game is six by six), so after the givens floor the lever is the deduction grade and the clock |
| First seconds | More than half the grid already filled in | | Only ten or eleven numbers on the grid | Eight or nine numbers, and a Check button |
| Today | 19–21 givens, singles only, live clashes, used-up digits leave the keypad, 90 s | | 10–12 givens, needs 1 advanced step, live clashes, 90 s, bank of 200 | 9–10 givens, needs 2 advanced steps, clashes only on Check, 90 s, bank of 200 |

- **Why this curve:** The six-by-six grid is the game, so the visible ladder is how empty it starts, run down to the fewest givens a unique grid can have, with the solver's grade making sure fewer numbers means harder steps and never luck.
- **Proof:** Banks of 200 per level from scripts/sudoku-level-bank.ts: one solution each, graded by the step solver in sudokuLogic.ts (singles, pairs, pointing, box-line, never a guess), which is the person-style proof; logic-1-levels-check proves every board and logic-1-steps-check the ladder. A time model (0.8 s a digit) must be added to show the Expert solve fits 75 s.
- **Measured today:** great / near-perfect under human limits: E 197.0 / 198.9, N 184.5 / 199.1, H 159.7 (85 % finished) / 193.1, X 129.6 (35 %) / 184.7
- **Stamp:** level field only (the grid and the clock are stored on the puzzle; each level's clash rule is unchanged)
- **Files:** `src/lib/levels/gameLevels.ts`, `scripts/sudoku-level-bank.ts`, `src/lib/duel/sudokuLogic.ts`, `src/lib/duel/logicLevelBanks.server.ts`, `scripts/logic-1-levels-check.tsx`, `scripts/logic-1-steps-check.ts`
- **Risk:** 6×6 grids with 8–9 givens that need three advanced steps may be too rare to bank 200

### Chroma Lines (`flow`, Pattern)

**Lever: Board height and pairs.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 6×6, 5–6 pairs, no walls, 75 s (a small open board; does the job) | 9×9, 10–12 pairs, 2–4 walls, 75 s, full speed by 30 s (flowRev 3) | 9×11, 12–13 pairs, 4–6 walls, at least 3 what-ifs, 80 s, full speed by 35 s (today's Hard has fewer dots than Normal and reads as easier) | 9×13, 14 pairs, 6–8 walls, at least 4 what-ifs, 95 s, full speed by 45 s. Ceiling: 9 across (40 px beads), 13 down and the 14 bead colours; after it, longer lines and less time |
| First seconds | A small 6×6 board with five or six pairs | | A taller board with more coloured dots than Normal | Dots in fourteen colours fill the screen top to bottom |
| Today | 6×6, 5–6 pairs, no walls, 75 s, full speed by 15 s | | 9×9, 8–9 pairs with longer lines, 4–6 walls, at least 3 what-ifs, 75 s, full speed by 35 s | 9×12, 12–14 pairs, 4–6 walls, at least 4 what-ifs, 90 s, full speed by 45 s |

- **Why this curve:** Today's Hard takes dots off Normal's board and so looks easier; growing the board downwards with more pairs at every level makes one ladder the eye can read (36, 81, 99, 117 squares), with the what-if floor as the guard.
- **Proof:** Banks of 500 per level (bun scripts/flow-bank.ts --level): exactly one solution by the exhaustive solver, and every board finished by the person-like solver flowHuman.server.ts (forced moves and one what-if at a time); pattern-overhaul-flow-levels-check re-proves them. A time model must be added so Expert is shown inside 95 s.
- **Measured today:** not documented
- **Stamp:** level field; the board's size is stored on the puzzle; the new full-by times need a levelRev on level deals (flowFullByS reads the registry)
- **Files:** `src/lib/levels/pattern/flow.levels.ts`, `scripts/flow-bank.ts`, `src/lib/duel/flowHardBank.server.ts`, `src/lib/duel/flowExpertBank.server.ts`, `src/lib/duel/flowHuman.server.ts`, `scripts/pattern-overhaul-flow-levels-check.ts`
- **Risk:** the uniqueness solver's node budget may reject most 9×13 boards with 14 pairs

### Skid (`iceslide`, Pattern)

**Lever: Holes and thin ice.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 8×8, 6–10 slides (today 8–12), rocks only: no holes, thin ice, chevrons or portals, 90 s, full speed by 20 s | 12×12, 18–26 slides, 2–4 holes, every hazard, 90 s, full speed by 30 s (slideRev 5) | 12×12, 26–32 slides, 6–8 holes, 4–6 thin ice, 1–3 chevrons, 1–2 portal pairs, 90 s (today 100), full speed by 40 s | 11×13, 34–42 slides, 10–12 holes (today 3–5, fewer than Hard), 6–8 thin ice, 2–4 chevrons, 2 portal pairs, 120 s, full speed by 45 s. Ceiling: the rink is full size from Normal (30 px squares; 26 px proved unreadable), so the lever is hazards and route length |
| First seconds | A small rink with rocks only and no holes | | Twice Normal's holes dotted across the rink | A taller rink riddled with ten or more holes |
| Today | 8×8, 8–12 slides, no holes or thin ice, at most 1 chevron and 1 portal pair, 90 s, full speed by 20 s | | 12×12, 24–30 slides, 5–8 holes, 3–5 thin ice, 100 s, full speed by 40 s | 11×13, 28–36 slides, 3–5 holes, 3–6 thin ice, 120 s, full speed by 45 s |

- **Why this curve:** The rink is already as big as a phone can show at Normal, so the ladder has to be what is on the ice, and today Expert has fewer holes than Hard and looks the safer of the two.
- **Proof:** Banks of 300 per level (bun scripts/iceslide-levels-bank.ts): each minimum proved by BFS over the ball's square and the broken ice; Expert keeps only boards the person-like player scripts/iceslide-human.ts finishes inside 120 s under the limits; pattern-overhaul-iceslide-levels-check re-proves every board.
- **Measured today:** medians not documented; on the best Expert bank boards the person-like player scores 197 in 52–54 s
- **Stamp:** level field; hazards and par ride on the board and Hard's clock is the puzzle's timeLimitMs; stamp the level's full-by time on the puzzle too, or add a levelRev
- **Files:** `src/lib/levels/pattern/iceslide.levels.ts`, `scripts/iceslide-levels-bank.ts`, `src/lib/duel/iceSlideLevelBank.server.ts`, `scripts/iceslide-human.ts`, `scripts/pattern-overhaul-iceslide-levels-check.ts`
- **Risk:** boards with 10–12 holes and a 34–42 slide minimum may be too rare to fill a bank of 300

### Heave (`push`, Pattern)

**Lever: Crates to push home.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 3 crates, 8–14 pushes, an open warehouse, the stuck hint on, 120 s | 5 crates, 18–27 pushes, stuck hint, 120 s, full speed by 45 s (pushRev 3) | 6 crates (today 5, the same as Normal), 28–36 pushes, 6–12 inner walls, a detour, no stuck hint, 120 s, full speed by 45 s | 7 crates, 38–48 pushes, 8–14 inner walls, a detour, no stuck hint, 120 s, full speed by 50 s. Ceiling: the 9×9 warehouse and the 120 s clock are both fixed, so crates and pushes are the levers |
| First seconds | Three crates in an open room | | Six crates and six marks between tighter walls | Seven crates crowd a walled-in warehouse |
| Today | 3 crates, 8–14 pushes, open warehouse, stuck hint, 120 s, full speed by 30 s | | 5 crates, 25–32 pushes, a detour, no stuck hint, 120 s, full speed by 45 s | 6 crates, 30–40 pushes, a detour, no stuck hint, 120 s, full speed by 45 s |

- **Why this curve:** Hard today shows the same five crates as Normal, so the crate count, the one thing a player counts at once, now climbs 3, 5, 6, 7 with the push minimum rising behind it.
- **Proof:** A bank per level grown backwards from the solved warehouse (scripts/push-levels-bank.ts), so its depth is the exact minimum, re-solved forwards by the optimal solver in pattern-overhaul-push-levels-check. No person-style push solver exists today: one must be written (for example scripts/push-human.ts) to prove every Expert board inside 120 s.
- **Measured today:** not documented (the check only asserts that great and near-perfect averages step down)
- **Stamp:** level field; crates and par ride on the board; Expert's new full-by time needs a levelRev on level deals (pushLevelFullByS reads the registry)
- **Files:** `src/lib/levels/pattern/push.levels.ts`, `scripts/push-levels-bank.ts`, `src/lib/duel/pushLevelBank.server.ts`, `src/lib/duel/pushLevels.server.ts`, `scripts/pattern-overhaul-push-levels-check.ts`
- **Risk:** exact minimums for 7 crates may cost too much search; fall back to 6 crates with 40–48 pushes

### Lightbender (`laser`, Pattern)

**Lever: Bombs on the board.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 4–5 mirrors with 3 spare, 1–2 bombs, 5 shots, 60 s (a short beam and five tries already forgive a wrong read) | 7–8 mirrors + 2 spare, 3–4 bombs, 3 shots, 60 s, full speed by 30 s (laserRev 4) | 9–10 mirrors + 1 spare, 6–7 bombs (today 4–5), 3 shots, 75 s, full speed by 35 s, at least 100 tries for the person-like solver | 10–12 mirrors with no spare, 9–10 bombs (today 5–6), 2 shots, 90 s, full speed by 35 s, 750–1,000 tries for the person-like solver. Ceiling: the 10×10 board is 36.6 px a square from Normal up, so the lever is what stands on it |
| First seconds | One or two bombs and five shots | | Twice Normal's bombs between the gems | Bombs everywhere, an exact tray and two shots |
| Today | 4–5 mirrors + 3 spare, 1–2 bombs, 5 shots, 60 s, full speed by 20 s | | 8–9 mirrors + 1 spare, 4–5 bombs, 3 shots, 75 s, full speed by 35 s | 9–10 mirrors + 1 spare, 5–6 bombs, 2 shots, 90 s, full speed by 30 s |

- **Why this curve:** Normal, Hard and Expert look alike today (one more bomb, one more mirror), so bombs, the hazard a player spots first and the thing that kills the easy routes, double at Hard and triple at Expert.
- **Proof:** Hard and Expert banks (bun scripts/laser-bank.ts --level): the stored layout lights all six gems and needs every piece, and the person-like solver solveLaserLikeAPerson (laserSolve.server.ts) lights it from the level's own tray inside the try band; pattern-overhaul-laser-levels-check. A time model must be added for the 90 s.
- **Measured today:** Expert only: near-perfect 183–193 on 12 boards; the other levels not documented
- **Stamp:** level field; shots, tray and clock are stamped on the puzzle; the new full-by time needs a levelRev on level deals (laserFullByS reads the registry)
- **Files:** `src/lib/levels/pattern/laser.levels.ts`, `scripts/laser-bank.ts`, `src/lib/duel/laserHardBank.server.ts`, `src/lib/duel/laserExpertBank.server.ts`, `src/lib/duel/laserSolve.server.ts`, `scripts/pattern-overhaul-laser-levels-check.ts`
- **Risk:** with nine or more bombs the generator may find too few boards the person-like solver lights in 1,000 tries

### Hanoi (`tower`, Logic)

**Lever: Rings on the posts.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 4 posts, 7 rings, 10–18 moves, 90 s (the spare post forgives a wrong move) | 3 or 4 posts, 9 rings, 20–40 moves, 90 s | 3 posts, 10 rings (today 9, the same as Normal), 40–55 moves, 90 s | 3 posts, 12 rings, 70–90 moves, 105 s. Ceiling: 12 rings (the smallest 36 px wide, about 7 px a step across three posts); after it, a longer minimum |
| First seconds | Four posts and a short stack of seven | | Three posts, ten rings and no spare post | Twelve rings stacked to the top of the posts |
| Today | 4 posts, 7 rings, 10–18 moves at the minimum, 90 s | | 3 posts, 9 rings, 34–45 moves, 90 s | 3 posts, 10 rings, 45–60 moves, 105 s |

- **Why this curve:** Hard today is Normal's nine rings again and the near-perfect bot still scores 192 on Expert, so the ring count now rises at every level and the minimum grows by about half each step.
- **Proof:** The exact minimum by search over every state in tower.server.ts (3 posts and 12 rings is 531,441 states), proved per board by logic-1-levels-check; the proof run is the minimum line played at 0.4 s a move (36 s for 90 moves), inside 105 s.
- **Measured today:** great / near-perfect under human limits: E 199.3 / 200, N 195.3 / 199.8, H 181.2 / 199.3, X 169.2 (95 % finished) / 192.1
- **Stamp:** level field only (level deals already carry towerRev 1; posts, rings, par and clock are stored on the puzzle)
- **Files:** `src/lib/levels/gameLevels.ts`, `src/lib/duel/tower.server.ts`, `src/lib/duel/logicLevels.ts`, `scripts/logic-1-levels-check.tsx`, `scripts/logic-1-steps-check.ts`
- **Risk:** twelve ring widths may be hard to tell apart on a 390 px phone

### Polypotions (`tubes`, Logic)

**Lever: Flasks and colours.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 6 flasks, 4 colours, 4 layers, 8–12 pours, 90 s | 10 flasks, 8 colours, 5 layers, minimum + 6 pours allowed, 90 s | 12 flasks (two empty), 10 colours, 6 layers, minimum 28–38 pours, every layer shown, 90 s (today's Expert rack without the hiding, 30 s less) | 14 flasks in two rows of seven (52 px each), 12 colours, 6 layers, minimum 36–46, hidden layers (only the top shows until uncovered; Undo gives the pour back), 120 s. Ceiling: 7 flasks a row; after it, deeper minimums |
| First seconds | Six short flasks in four colours | | Twelve flasks and ten colours, all on show | Fourteen flasks with grey question marks under every top layer |
| Today | 6 flasks, 4 colours, 4 layers, 8–12 pours at the minimum, 90 s | | 10 flasks, 8 colours, 7 layers, minimum 26–34, 120 s | 12 flasks, 10 colours, 6 layers, minimum 28–38, hidden layers, 120 s |

- **Why this curve:** A strong player loses nothing until the layers hide (near-perfect 197 on Hard), so the rack itself grows at Hard and the hiding, the genre's own hard mode and already built, stays as Expert's last step.
- **Proof:** Each level board is built with its exact minimum by search (generateTubesLevel and tubesLevelMinimum in tubes.server.ts; logic-1-levels-check); 14 flasks will want a pre-built bank. Must be written: a solver that sees only uncovered layers and still finishes inside 120 s using refunded Undos, so the hiding is never a guess.
- **Measured today:** great / near-perfect under human limits: E 200 / 200, N 195.0 / 200, H 185.6 / 197.3, X 129.1 (25 % finished) / 181.9
- **Stamp:** level field only (flasks, layers, the hidden flag, the minimum and the clock are stored on the puzzle)
- **Files:** `src/lib/levels/gameLevels.ts`, `src/lib/duel/tubes.server.ts`, `src/lib/duel/logicLevelBanks.server.ts`, `scripts/logic-1-levels-check.tsx`, `scripts/logic-1-steps-check.ts`
- **Risk:** the exact-minimum search for 12 colours may be too slow and 12 colours hard to tell apart; fall back to 13 flasks and 11 colours

### Safe Cracker (`safe`, Logic)

**Lever: Dials on the safe.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 3 dials of 0–9, 5 simple clues (odd or even, more or less, a sum), 3 tries, 75 s | 4 dials of 0–9, 5 clues, 3 tries, 75 s | 5 dials of 0–20 (today 4 dials of 0–15), 7 clues with primes, squares and differences, 2 tries, 90 s | 6 dials of 0–20 (61 px each), 9 clues, 1 try, 105 s. Ceiling: six dials and a nine-line card fill the screen; after it, harder clue kinds |
| First seconds | Three dials and five plain clues | | Five dials that run to 20 and seven clues | Six dials, nine clues, one try |
| Today | 3 dials of 0–9, 5 simple clues, 3 tries, 75 s | | 4 dials of 0–15, 6 number clues, 3 tries, 75 s | 5 dials of 0–20, 7 clues, 2 tries, 105 s, bank of 200 |

- **Why this curve:** Hard today keeps Normal's four dials and the bots barely notice Expert (187 near-perfect), so a dial is added at every level and the tries, the game's safety net, shrink 3, 3, 2, 1.
- **Proof:** A bank of 200 one-solution cards per level (scripts/safe-level-bank.ts, logic-1-levels-check). Must be written: a person-style solver (narrow each dial's range clue by clue, one-step trials, never a guess) that cracks every Expert card inside 105 s.
- **Measured today:** great / near-perfect under human limits: E 200 / 200, N 193.9 / 200, H 182.0 (95 % finished) / 194.5, X 173.6 (95 %) / 186.8
- **Stamp:** level field only (dialCount, dialMax, tries and the clock are stored on the puzzle); a sixth dial needs a sixth mark in DIAL_MARKS
- **Files:** `src/lib/levels/gameLevels.ts`, `scripts/safe-level-bank.ts`, `src/lib/duel/safe.ts`, `src/lib/duel/safe.server.ts`, `scripts/logic-1-levels-check.tsx`
- **Risk:** nine clues on six dials may read as a wall of text on a phone

### Topsy-Turvy (`gravity`, Pattern)

**Lever: Balls on each board.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 2 boards of 3 balls, 2–4 tilts each, a limit of the fewest + 12, 120 s | 3 boards of 6 balls, 4–7 tilts, fewest + 8, 120 s, full speed by 32 s (gravityRev 8) | 3 boards of 8 balls (today 6, the same as Normal), 7–10 tilts, fewest + 6, 120 s, full speed by 32 s | 3 boards of 10 balls (two new colours), 9–12 tilts, fewest + 4, 120 s, full speed by 36 s, person-solvable only. Ceiling: the 10×10 board and the 120 s clock are fixed, and ten balls with ten cups is the most the board shows clearly |
| First seconds | Three balls, three cups, two boards | | Eight balls rolling at once | Ten balls and ten cups crowd the board |
| Today | 2 boards of 3 balls, 2–4 tilts each, a limit of the fewest + 12, 120 s, full speed by 20 s | | 3 boards of 6 balls, 6–9 tilts, fewest + 6, 120 s, full speed by 30 s | 3 boards of 8 balls, 7–10 tilts, fewest + 5, 120 s, full speed by 30 s, person-solvable only |

- **Why this curve:** Normal and Hard look identical today (six balls on the same board), so the ball count, which multiplies what every tilt does, becomes the ladder: 3, 6, 8, 10.
- **Proof:** A bank per level (bun scripts/topsy-levels-bank.ts): each board's fewest tilts by BFS over every ball's square; Hard and Expert keep only boards the person-like solver scripts/topsy-human.ts clears inside the tilt limit; pattern-overhaul-gravity-levels-check re-proves every board.
- **Measured today:** not documented
- **Stamp:** level field; balls, limits and par ride on the boards; stamp the level's full-by time on the puzzle, or add a levelRev
- **Files:** `src/lib/levels/pattern/gravity.levels.ts`, `scripts/topsy-levels-bank.ts`, `src/lib/duel/topsyLevelsBank.server.ts`, `scripts/topsy-human.ts`, `scripts/pattern-overhaul-gravity-levels-check.ts`
- **Risk:** ten-ball boards the person-like solver clears within the fewest + 4 may be rare, and two more ball renders are needed

### Mosaic (`nonogram`, Logic)

**Lever: Picture size.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 6×6, every line solvable alone, right lines lock, 90 s | 8×8, 120 s (depthRev 2) | Today's board, 9×11 with single-line logic, in 100 s (today 120) | Today's board, 9×14, but two lines must be read together at least 3 times (today once), 120 s. Already at the ceiling: 9 across with the clue column is 36 px a square and 14 rows fill the height, so the lever is the reasoning and the clock |
| First seconds | A small 6×6 picture with short clues | | A taller 9×11 picture, half as big again as Normal | A picture fourteen rows deep, down to the buttons |
| Today | 6×6, single-line logic, right lines lock, 90 s | | 9×11, single-line logic, 120 s | 9×14, needs two lines read together at least once, 120 s |

- **Why this curve:** Today's ladder (36, 64, 99, 126 squares) already steps up where everyone can see it and ends on the phone's ceiling, so only the clock and the depth of reasoning need tightening for the best players.
- **Proof:** One solution per board from the generator (generateNonogramLevel in nonogram.server.ts), solved without a guess by the line solver nonoLogicSolve (single lines for Hard, two lines together for Expert) and proved by logic-1-levels-check. A time model must be added for the 120 s.
- **Measured today:** great / near-perfect under human limits: E 197.4 / 199.7, N 193.4 / 198.8, H 158.4 (90 % finished) / 189.9, X 126.0 (30 %) / 182.1
- **Stamp:** level field only (the picture, its clues and the clock are stored on the puzzle)
- **Files:** `src/lib/levels/gameLevels.ts`, `src/lib/duel/nonogram.server.ts`, `src/lib/duel/logicLevels.ts`, `scripts/logic-1-levels-check.tsx`, `scripts/logic-1-steps-check.ts`
- **Risk:** low; pictures needing three two-line steps may be slow to build live and want a bank

### Colour Flood (`flood`, Logic)

**Lever: Board size and colours.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 10×10, 4 colours, par 6–8, par + 8 moves, 60 s | 14×14, 5 colours, par 10–14, par + 6 moves, 60 s (floodRev 3) | 14×20, 6 colours, par 16–20, par + 4 moves, 60 s (today's 12×17 is no bigger than Normal's 196 squares) | 14×24, 7 colours (52 px buttons), 20 blocked squares, par 22–26, par + 2 moves, 75 s. Ceiling: 14×24 fills the screen (squares are never tapped, only the colour buttons); after it, colours and spare moves |
| First seconds | A small board in four colours | | A board half as tall again, in six colours | Seven colours, stones in the way, a screen-high board |
| Today | 10×10, 4 colours, par 6–8, par + 8 moves, 60 s | | 12×17, 6 colours, par 14–18, par + 4 moves, 60 s | 14×24, 6 colours, 14 blocked squares, par 18–22, par + 3 moves, 75 s |

- **Why this curve:** A strong player scores within ten points on every level today, so the two things that set a flood's par, area and colours, both rise at each step and the spare moves fall 8, 6, 4, 2.
- **Proof:** A bank per level with the exact par by search (scripts/flood-level-bank.ts, scripts/flood-par-proof.ts), proved by logic-1-levels-check; the proof run is the stored par line at 0.4 s a move, about 10 s, well inside 75 s.
- **Measured today:** great / near-perfect under human limits: E 198.8 / 199.0, N 197.4 / 198.3, H 188.3 / 196.7, X 166.3 (75 % finished) / 192.1
- **Stamp:** level field; size, colours, blocked squares, par and clock are stored on the puzzle; stamp the level's spare moves on it too so a later retune never moves a stored round
- **Files:** `src/lib/levels/gameLevels.ts`, `scripts/flood-level-bank.ts`, `src/lib/duel/floodLevels.server.ts`, `scripts/flood-par-proof.ts`, `scripts/logic-1-levels-check.tsx`
- **Risk:** the exact-par search at 7 colours and par 22–26 on 336 squares may be too slow to bank

### Minefield (`minesweeper`, Logic)

**Lever: Mines on the board.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today (minesRev 4): 8×12, 9 mines, about a third of the board already open, 90 s; a mine costs 5 points and never the run | minesRev 3: 10×16, 16 mines, opening 20–60, 90 s, full speed by 37 s | 10×16, 26 mines (today 20, only 4 more than Normal), opening 12–24 squares, 90 s, full speed by 45 s | 10×16, 36 mines (22 % of the board), opening 6–12, 120 s, full speed by 60 s; squares stay 37 px (today's 12×18 draws them at about 31 px, under the 36 px floor). Ceiling: 10×16 is Normal's board already, so the lever is mine density and the opening |
| First seconds | A small board, a third of it already open | | Mines 26 on the counter and a small opening | Mines 36 and only a handful of squares open |
| Today | minesRev 4: 8×12, 9 mines, opening 25–40 squares, 90 s, full speed by 22 s | | minesRev 2: 10×16, 20 mines, opening 20–60, 90 s, full speed by 37 s | minesRev 5: 12×18, 34 mines, opening 8–16, 120 s, full speed by 50 s |

- **Why this curve:** The board cannot grow without shrinking the squares under a thumb, so the ladder is the mine count (9, 16, 26, 36) with the free opening shrinking as it climbs, which is how this game gets harder everywhere it is played.
- **Proof:** Every board is dealt by the existing rule: the logic solver minesSolve clears it from the opening with never a guess (logic-1-levels-check, minefield-logic-check). At 26 and 36 mines deal from a pre-proved bank, and the oracle (scripts/cards-board-oracles.ts) must reach 200 under HUMAN_LIMITS on every banked seed or the seed is dropped.
- **Measured today:** great / near-perfect under human limits: E 199.1 / 200, N 194.6 (90 % finished) / 200, H 188.9 (95 %) / 196.4, X 174.2 (85 %) / 191.0
- **Stamp:** minesRev 6 (Hard, 26 mines) and minesRev 7 (Expert, 36 mines): each level's geometry and clock ride on its own revision, and stored minesRev 2 and 5 rounds must replay as dealt
- **Files:** `src/lib/arcade/minesweeper.ts`, `src/lib/levels/gameLevels.ts`, `scripts/cards-board-oracles.ts`, `scripts/logic-1-levels-check.tsx`, `scripts/minefield-logic-check.ts`, `docs/arcade-standard/minesweeper.md`
- **Risk:** no-guess boards at 22 % mines from a 6–12 square opening may be too rare; fall back to 32 mines

### Tents and Trees (`tents`, Logic)

**Lever: Board height and trees.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 8×6, 7–8 trees, every count shown, 90 s | 8×9, 12–13 trees, a third of the counts hidden, 90 s | 8×11 (today 8×10, one row more than Normal), 16–17 trees, half the counts hidden, 2–15 trials, 100 s | 8×13, 21–22 trees, half the counts hidden, 5–50 trials, 120 s. Ceiling: 8 across with the count column (40 px squares) and 13 down; after it, more hidden counts |
| First seconds | A short board with every count shown | | Two more rows, more trees, half the counts blank | Thirteen rows and over twenty trees |
| Today | 8×6, 7–8 trees, every count shown, 90 s | | 8×10, 13–14 trees, half the counts hidden, 2–12 trials, 90 s | 8×12, 17–18 trees, half the counts hidden, 4–40 trials, 120 s |

- **Why this curve:** Hard today is Normal plus one row, so each level now adds two rows and four or five trees, growing downwards because the width is already at its limit.
- **Proof:** One solution by the game's solver, and every board finished by the person-style solver in logicHuman.server.ts (the rules plus one-step trials, never a guess) inside the level's trial band (logicLevelDeal.server.ts, scripts/logic-levels-check.ts). It counts trials but has no clock: add a time model (0.4 s a tent, about 1.5 s a trial) so Expert is proved inside 120 s.
- **Measured today:** near-perfect kit, 20 boards, no human limits: 199.8 / 199.7 / 177.8 / 163.2 (95 % finished) (E/N/H/X)
- **Stamp:** level field only (height, counts and clock are stored on the board)
- **Files:** `src/lib/duel/logicOverhaul2Levels.ts`, `src/lib/duel/logicLevelDeal.server.ts`, `src/lib/duel/logicHuman.server.ts`, `scripts/logic-levels-check.ts`
- **Risk:** 13 rows draw under 36 px on a 667 px tall phone

### Shikaku (`shikaku`, Logic)

**Lever: Board height and rectangles.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 10×7, 9–11 rectangles, none over 8 squares, 90 s | 10×11, 17–21 rectangles, largest 12, 90 s | 10×13 (today 10×12), 19–22 rectangles, largest 16, at least 6 of six squares or more, 0–15 trials, 100 s | 10×15, 22–26 rectangles, largest 20, at least 8 of six squares or more, 5–40 trials (never a walk-through), 120 s. Ceiling: 10 across is Normal's width (36.6 px) and 15 down fills the height; after it, bigger rectangles |
| First seconds | A short board with small numbers | | Two more rows and numbers up to 16 | Fifteen rows deep, with a 20 on the board |
| Today | 10×7, 9–11 rectangles, largest 8, 90 s | | 10×12, 15–17 rectangles, largest 16, 0–10 trials, 90 s | 10×13, 18–21 rectangles, largest 16, 0–30 trials, 120 s |

- **Why this curve:** Expert today is one row taller than Hard and scores within six points of it, so the board now grows two rows a level and the largest rectangle, the number a player reads first, rises 8, 12, 16, 20.
- **Proof:** One solution by the game's solver, and every board finished by the person-style solver in logicHuman.server.ts inside the level's trial band (logicLevelDeal.server.ts, scripts/logic-levels-check.ts); add a time model (0.6 s a rectangle, about 1.5 s a trial) so Expert is proved inside 120 s.
- **Measured today:** near-perfect kit, 20 boards, no human limits: 199.5 / 198.9 / 176.6 / 171.2 (all finished) (E/N/H/X)
- **Stamp:** level field only (height, numbers and clock are stored on the board)
- **Files:** `src/lib/duel/logicOverhaul2Levels.ts`, `src/lib/duel/logicLevelDeal.server.ts`, `src/lib/duel/logicHuman.server.ts`, `scripts/logic-levels-check.ts`
- **Risk:** low; 15 rows of 36 px leave no spare height on a short phone

### Lamplighter (`lightup`, Logic)

**Lever: Board height and walls.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 9×7, 15–19 walls, 70 % of them numbered, 90 s | 9×10, 20–25 walls, half numbered, 90 s | 9×12 (today Normal's own 9×10), 26–30 walls, 35 % numbered, 3–40 trials, 100 s (today's Expert board with 20 s less) | 9×14, 32–38 walls, 30 % numbered, 6–60 trials, 120 s. Ceiling: 9 across (40 px squares) and 14 down; after it, fewer numbered walls |
| First seconds | A short board with most walls numbered | | Two more rows and most walls blank | Fourteen rows of dark squares and few numbers |
| Today | 9×7, 15–19 walls, 70 % numbered, 90 s | | 9×10, 18–22 walls, 35 % numbered, 1–15 trials, 90 s | 9×12, 26–30 walls, 35 % numbered, 3–40 trials, 120 s |

- **Why this curve:** Hard today is Normal's own board with fewer numbers, so the board now grows two rows a level while the numbered share falls 70, 50, 35, 30 per cent.
- **Proof:** One solution by the game's solver, and every board finished by the person-style solver in logicHuman.server.ts inside the level's trial band (logicLevelDeal.server.ts, scripts/logic-levels-check.ts); add a time model (0.4 s a bulb, about 1.5 s a trial) so Expert is proved inside 120 s.
- **Measured today:** near-perfect kit, 20 boards, no human limits: 199.3 / 199.7 / 178.7 / 158.9 (80 % finished) (E/N/H/X)
- **Stamp:** level field only (height, walls and clock are stored on the board)
- **Files:** `src/lib/duel/logicOverhaul2Levels.ts`, `src/lib/duel/logicLevelDeal.server.ts`, `src/lib/duel/logicHuman.server.ts`, `scripts/logic-levels-check.ts`
- **Risk:** 14 rows draw under 36 px on a 667 px tall phone

### Trail (`trail`, Logic)

**Lever: Board size.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 5×5 board, 1 to 25, 9 numbers shown, 0–20 trials, 120 s (today a 6×6 with 14 numbers) | 6×6, 10 numbers shown, from the bank (median about 13,000 solver steps), 120 s | 7×7 board, 1 to 49, 13 numbers shown, 20–150 trials, 120 s | 8×8 board, 1 to 64, 16 numbers shown, 40–250 trials, 120 s. The clock, not the phone, is the ceiling (8 across is 45 px): 48 squares to place in 120 s; after it, fewer numbers |
| First seconds | A small board: 1 to 25 | | A 7×7 board: 1 to 49 | An 8×8 board: 1 to 64 |
| Today | 6×6, 14 numbers shown, easy search (up to 2,000 solver steps), 120 s | | 6×6, 10 numbers shown, 35,000+ solver steps, 40–400 trials, bank of 120, 120 s | 6×6, 10 numbers shown, 70,000+ solver steps, 80–1,000 trials, bank of 120, 120 s |

- **Why this curve:** Normal, Hard and Expert are the same 6×6 board with ten numbers today and differ only in a search count no player can see; a path nearly twice as long is a difficulty anyone reads in one look.
- **Proof:** Banks of 120 per level (scripts/logic-level-bank.ts): one path by the game's solver, and every board finished by the person-style solver's trail model (logicHuman.server.ts) inside the trial band. Today's Expert band runs to 1,000 trials, more than 120 s allows, so add a time model and cap the band.
- **Measured today:** near-perfect kit, 20 boards, no human limits: 199.9 / 199.2 / 166.4 (95 % finished) / 154.0 (75 %) (E/N/H/X)
- **Stamp:** level field plus a stored board size (absent = 6×6); trail.ts's helpers already take a size and the goal line must read the board's own last number
- **Files:** `src/lib/duel/trail.ts`, `src/lib/duel/trail.server.ts`, `src/lib/duel/logicOverhaul2Levels.ts`, `src/lib/duel/logicHuman.server.ts`, `scripts/logic-level-bank.ts`, `scripts/logic-levels-check.ts`, `src/puzzles/trail.tsx`
- **Risk:** proving one path on 8×8 may be too slow to bank 120 boards; fall back to 7×7 with 11 numbers for Expert

### Loopline (`fences`, Logic)

**Lever: Board size.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 5×5, 14 or more numbers, no branching, 90 s | 6×6, 15+ numbers, grade 0–6, 90 s (fencesRev 1) | 8×8 (today 7×7), 22 or more numbers, grade 3–10, 3–20 trials, 90 s | 8×10 (rows added below), 26 or more numbers, grade 6–40, 10–60 trials, 110 s. Ceiling: 8 across (the lines between dots are the targets, 45 px squares); after it the board grows downwards, then fewer numbers |
| First seconds | A small 5×5 grid, more than half the squares numbered | | An 8×8 grid, almost twice Normal's squares | A tall 8×10 grid with wide blank patches |
| Today | 5×5, 14+ numbers, grade 0–1, 90 s | | 7×7, 18+ numbers, grade 3–8, 3–15 trials, 90 s | 8×8, 19+ numbers, grade 4–30, 8–40 trials, 120 s |

- **Why this curve:** The ladder is already board size, but one square a side per level leaves the near-perfect kit finishing every Expert board, so Hard takes today's Expert board and Expert grows downwards past the width limit.
- **Proof:** One loop by the game's solver, and every board finished by the person-style solver (fencesDeductions plus one-step trials, logicHuman.server.ts) inside the level's trial band; scripts/logic-levels-check.ts; add a time model (0.15 s a line drawn, about 1.5 s a trial) so Expert is proved inside 110 s.
- **Measured today:** near-perfect kit, 20 boards, no human limits: 199.0 / 199.2 / 183.6 / 171.1 (all finished) (E/N/H/X)
- **Stamp:** level field plus a stored row count (absent = square); no rule changes, so fencesRev stays 1
- **Files:** `src/lib/duel/fences.ts`, `src/lib/duel/fences.server.ts`, `src/lib/duel/logicOverhaul2Levels.ts`, `src/lib/duel/logicLevelDeal.server.ts`, `src/lib/duel/logicHuman.server.ts`, `scripts/logic-levels-check.ts`, `src/puzzles/fences.tsx`
- **Risk:** Loopline is square-only today: rules, solver, stage and reveal all need a row count

### Regions (`fillomino`, Logic)

**Lever: Board size.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 6×6, 16–22 numbers shown, 90 s | 7×7, 14–26 numbers shown, grade 8–120, 90 s (fillominoRev 2) | 8×8 (today Normal's 7×7 with fewer numbers), 16–20 numbers shown, grade 30–400, 20–120 trials, 100 s | 9×9, 16–20 numbers shown (about a fifth of the board), grade 40+, 40–300 trials, bank of 120, 120 s. Ceiling: 9 across (40 px with a digit in every square and the number pad below); after it, fewer numbers |
| First seconds | A small grid with half its numbers given | | An 8×8 grid, three squares in four blank | A 9×9 grid, four squares in five blank |
| Today | 6×6, 16–22 numbers shown, grade 0–20, 90 s | | 7×7, 10–15 numbers shown, grade 30–400, 20–120 trials, 90 s | 8×8, 10–14 numbers shown, grade 40+, 40–400 trials, bank of 120, 120 s |

- **Why this curve:** Hard today is Normal's 7×7 with fewer numbers, which reads as the same board; a side longer at each level (36, 49, 64, 81 squares) with a thinner spread of numbers is a step the eye and the solver both feel.
- **Proof:** One solution by the game's solver, and every board finished by the person-style solver (fillominoDeductions plus one-step trials, logicHuman.server.ts) inside the trial band; Hard and Expert from banks (scripts/logic-level-bank.ts), proved by scripts/logic-levels-check.ts; add a time model so Expert is proved inside 120 s.
- **Measured today:** near-perfect kit, 20 boards, no human limits: 200.0 / 199.5 / 169.1 (95 % finished) / 154.7 (80 %) (E/N/H/X)
- **Stamp:** level field only (size, numbers and clock are stored on the board)
- **Files:** `src/lib/duel/logicOverhaul2Levels.ts`, `src/lib/duel/fillomino.server.ts`, `src/lib/duel/logicLevelBank.server.ts`, `scripts/logic-level-bank.ts`, `src/lib/duel/logicHuman.server.ts`, `scripts/logic-levels-check.ts`
- **Risk:** 9×9 boards inside a 300-trial band may be slow to find (the 8×8 bank already takes seconds a board)

### Island Link (`bridges`, Logic)

**Lever: Islands to link.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 6×6, 7–9 islands, no branching, 90 s | 7×7, 10–14 islands, grade 0–4, 90 s (bridgesRev 1) | 8×8, 18–22 islands (today 13–16), grade 2–8, 2–12 trials, 105 s | 8×11 (rows added below), 26–30 islands, grade 3–20, 4–25 trials, 120 s. Ceiling: 8 across (islands are the targets, 46 px apart); after it the board grows downwards |
| First seconds | Eight islands on a small sea | | About twenty islands, nearly twice Normal's | Nearly thirty islands down a taller sea |
| Today | 6×6, 7–9 islands, no branching, 90 s | | 8×8, 13–16 islands, grade 2–6, 1–8 trials, 90 s | 8×8, 18–22 islands, grade 2–20, 3–20 trials, 120 s |

- **Why this curve:** Islands are what a player counts, and the count now climbs by about half at every level (8, 12, 20, 28), with Expert growing downwards because eight across is the phone's limit.
- **Proof:** One solution by the game's solver, and every board finished by the person-style solver (bridgesDeductions plus one-step trials, logicHuman.server.ts) inside the trial band; scripts/logic-levels-check.ts; add a time model (0.4 s a bridge, about 1.5 s a trial) so Expert is proved inside 120 s.
- **Measured today:** near-perfect kit, 20 boards, no human limits: 199.6 / 199.9 / 180.3 / 155.5 (85 % finished) (E/N/H/X)
- **Stamp:** level field plus a stored row count (absent = square); no rule changes, so bridgesRev stays 1
- **Files:** `src/lib/duel/bridges.ts`, `src/lib/duel/bridges.server.ts`, `src/lib/duel/logicOverhaul2Levels.ts`, `src/lib/duel/logicLevelDeal.server.ts`, `src/lib/duel/logicHuman.server.ts`, `scripts/logic-levels-check.ts`, `src/puzzles/bridges.tsx`
- **Risk:** Island Link is square-only today: rules, solver, stage and reveal all need a row count


## Retro and Action (session D5)

### Hover (`hover`, Retro)

**Lever: Height of the barrier gaps.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Gaps 190 px narrowing to 140 (127 % of Normal's); starts with 3 shields (Normal 1); no sliding gaps; scroll as Normal. | hoverRev 11: 42 barriers, gaps 150 px narrowing to 100, every third gap slides from barrier 23, starts with one shield (the first crash forgiven), 60 s | Gaps 120 px narrowing to 84 (80 % of Normal's); every third gap slides from the third barrier (Normal from barrier 23); no starting shield; scroll as Normal (today's 106 % dropped). | Gaps 100 px narrowing to 72 (two thirds of Normal's, a little under Normal's own 80 px tight gates); every second gap slides, starting with the first barrier; no starting shield; scroll as Normal (today's 112 % dropped). |
| First seconds | Gaps a quarter taller than Normal's from the first barrier | | First gap a fifth narrower, the saucer has no shield | A gap two thirds the size, already sliding up and down |
| Today | Starts with a shield, gaps 115 % of Normal's, scroll 100 % | | No starting shield, gaps as Normal, scroll 106 % | No starting shield, gaps as Normal, scroll 112 % |

- **Why this curve:** A gap flyer is exactly as hard as its gaps are small, so the gap is the one thing every level should change, while today's Hard and Expert leave the gaps alone and only scroll 6 and 12 % faster, which neither a player nor the bots can tell apart.
- **Proof:** Today only Normal's courses are proved passable and levels only ever widen gaps. scripts/hover-x200-solver.ts already searches a tap log through every barrier, star, tight gate and chain and scripts/hover-x200-witness.ts keeps it when the server replay scores 200: run both on each level's narrowed course with taps at least 0.15 s apart and no tap sooner than 0.25 s after a barrier scrolls into view, and deal each level only from seeds that have a witness (src/lib/duel/hoverLevelDeals.server.ts and scripts/hover-levels-check.ts, to write).
- **Measured today:** Elite bot under human limits, 20 seeds: 174 / 173 / 140 / 141 (Hard and Expert level with each other: the bot crashes early on both). Average bot at Normal on hoverRev 10, before the starting shield: median 36 to 47.
- **Stamp:** hoverRev 12 on Easy, Hard and Expert deals only (Normal stays hoverRev 11): the sim re-reads the level table at replay, so level rounds stored since 16 Nov must keep today's table.
- **Files:** `src/lib/arcade/retroLevels.ts (HOVER_LEVELS)`, `src/lib/arcade/hover.ts (widenGaps becomes a two-way gap scale, the moving-gap rule per level)`, `scripts/hover-x200-solver.ts`, `scripts/hover-x200-witness.ts`, `src/lib/duel/hoverLevelDeals.server.ts (new)`, `scripts/hover-levels-check.ts (new)`
- **Risk:** a 72 px gap at top scroll may leave too few seeds with a human-paced witness, in which case Expert stops at 80 px

### High Rise (`skyline`, Action)

**Lever: Width of the blocks.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Blocks start 260 px wide (Normal 200); slide 1.75 px a tick rising to 3.5 and perfect within 5 px (today's Easy); no wind; the wide rescue block after 3 trims in a row (Normal 5); 3 lives. | skylineRev 11: 200 px blocks, slide 3 px a tick rising to 6, a perfect drop within 3 px, wind from block 20, 3 lives, 60 s | Blocks start 150 px wide; wind from block 8 (Normal 20); slide and perfect window as Normal (today's faster slide dropped); 3 lives. | Blocks start 110 px wide; wind from the first block; slide and perfect window as Normal (today's 7.5 px slide and 2 px window dropped); 3 lives. |
| First seconds | A block two thirds of the screen wide, sliding slowly | | A block a quarter narrower than Normal's | A block barely half Normal's width, the wind flag waving |
| Today | Slide 1.75 px a tick rising to 3.5, a perfect drop within 5 px, wind from block 30, 3 lives | | Slide 3.5 px a tick rising to 7, perfect within 3 px, wind from block 15, 3 lives | Slide 3.75 px a tick rising to 7.5, perfect within 2 px, wind from block 10, 3 lives |

- **Why this curve:** Normal's slide already leaves a perfect drop one tick wide at top speed, so going faster stops testing people and starts testing luck, whereas a narrower block and earlier wind raise the cost of every drop in a way the player sees before the first tap.
- **Proof:** scripts/skyline-oracle.ts scores 200 on every seed at every level today (skyline-levels-check) and a run of perfect drops never trims, so block width cannot break it. With Normal's slide kept, a perfect drop is never under one tick wide; today's Expert (2 px either side at up to 7.5 px a tick) is, so its 200 is only there for a frame-exact oracle. The build session should also report the elite bot under scripts/arcade-skill-bands/humanLimits.ts.
- **Measured today:** Mean, 40 seeds: average bot 116 / 53 / 46 / 41; elite under human limits 167 / 123 / 114 / 98 (runs reaching the clock 100 / 73 / 38 / 5 %).
- **Stamp:** skylineRev 12 on Easy, Hard and Expert deals only (Normal stays skylineRev 11): SKYLINE_LEVEL_RULES is frozen with the sim and stored level rounds must replay.
- **Files:** `src/lib/arcade/skyline.ts (SKYLINE_LEVEL_RULES gains a start width)`, `src/lib/levels/gameLevels.ts (display copy)`, `scripts/skyline-oracle.ts`, `scripts/skyline-levels-check.ts`, `scripts/flip-skyline-levels-bands.ts`
- **Risk:** Normal already scores 53 for the average bot and 123 for the limited elite, so Hard and Expert have little room below it until Joe's scoring review of Normal

### Breaker (`breaker`, Retro)

**Lever: Rows of bricks in the wall.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 6 rows (54 bricks), every plain brick one hit; paddle 112 px; no sliding rows; ball as Normal (today's 108 % dropped). | brkRev 12: 9 rows of 9 (81 bricks, 3 gold), paddle 84 px, 2 rows slide from 30 s and 60 s, 90 s | 11 rows (99 bricks); paddle 68 px; 2 rows slide from the first second (Normal from 30 s and 60 s); full speed points if the wall is cleared by 55 s (Normal 45 s, the wall is a fifth bigger); ball and brick hits as dealt. | 12 rows (108 bricks, the whole dealt wall); paddle 52 px; 4 rows slide from the first second; full speed points if cleared by 60 s (the wall is a third bigger); ball and brick hits as dealt (today's extra hit on every row dropped). |
| First seconds | A short six-row wall above a wide paddle | | Two more rows, two already sliding, a narrower paddle | Twelve rows, four sliding, a paddle barely a brick wide |
| Today | 9 rows (81 bricks), paddle 100 px, ball 108 %, no brick over 2 hits | | 9 rows, paddle 76 px, ball 104 %, top 4 rows one hit tougher | 9 rows, paddle 68 px, ball 108 %, every row one hit tougher |

- **Why this curve:** Bricks to break is the whole game and today every level shows the same 81, so each level adds rows until the 90 s clock can hold no more (12 rows, the wall the stored perfect run clears), and the paddle and sliding rows carry the rest of Expert.
- **Proof:** No level has a proof today. Write scripts/breaker-level-deal.ts: the flawless skill-band bot (scripts/arcade-skill-bands/bots/breaker.ts, run as scripts/breaker-clear-perfect-record.ts runs it) under HUMAN_LIMITS on each level's wall, keeping only seeds whose run scores 200 through replayBreakerRun; deal levels from that list (src/lib/duel/breakerLevelDeals.server.ts) and replay it in a new breaker-levels-check. docs/arcade-standard/breaker.md records a stored perfect run clearing all 108 bricks of the 12-row wall in 35.3 s on brkRev 11.
- **Measured today:** Elite bot under human limits (seeds 20 to 30): 190 / 185 / 177 / 143.
- **Stamp:** brkRev 13 on Easy, Hard and Expert deals only (Normal stays brkRev 12): level rounds stored since 16 Nov must replay on today's table.
- **Files:** `src/lib/arcade/retroLevels.ts (BREAKER_LEVELS)`, `src/lib/arcade/breaker.ts (applyBreakerLv: rows up to 12, slide starts)`, `scripts/arcade-skill-bands/bots/breaker.ts`, `scripts/breaker-level-deal.ts (new)`, `src/lib/duel/breakerLevelDeals.server.ts (new)`, `scripts/breaker-levels-check.ts (new)`
- **Risk:** a human-paced bot may clear 108 bricks inside 60 s on too few seeds, in which case Expert keeps 11 rows and leans on the paddle

### Pinball (`pinball`, Retro)

**Lever: Flipper length and the drain gap.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Flippers 62 px (the drain shrinks to about 17 px, one ball wide); 4 balls; 10 s ball save; gravity 85 %; core full at 50,000. | pinRev 8: one fixed table, 56 px flippers (about 27 px of drain between them for a 16 px ball), 3 balls, no ball save, multiball 20 s, core full at 61,000, 90 s | Flippers 48 px (drain about 41 px, two and a half balls); gravity 115 %; 3 balls; multiball and core figure as Normal. | Flippers 42 px (drain about 51 px, three balls); gravity 130 %; 2 balls; multiball and core figure as Normal (today's 66,000 dropped). |
| First seconds | Long flippers that almost meet, four balls | | Shorter flippers, a drain two and a half balls wide | Stubby flippers, a three-ball drain, two balls |
| Today | 4 balls, 10 s ball save, gravity 85 %, multiball 25 s, core full at 50,000 | | 3 balls, gravity 110 %, multiball 18 s, core full at 61,000 | 2 balls, gravity 120 %, multiball 15 s, core full at 66,000 |

- **Why this curve:** Every lost ball leaves between or past the flippers, so their reach is the one setting that changes what a player can save, and unlike gravity it shows on the table before the first launch.
- **Proof:** The table is fixed and uses no seed, so each level needs one stored witness and none exists today: search with the skill-band bot (scripts/arcade-skill-bands/bots/pinball.ts) under HUMAN_LIMITS for an input log that scores 200 through the server replay with that level's flippers, gravity and balls (scripts/pinball-level-witness.ts, to write) and replay the three logs in a new pinball-levels-check.
- **Measured today:** Elite bot under human limits, 12 seeds: 196 / 188 / 188 / 164 (Hard is no harder than Normal).
- **Stamp:** pinRev 9 on Easy, Hard and Expert deals only (Normal stays pinRev 8): stored level rounds must replay on today's table.
- **Files:** `src/lib/arcade/retroLevels.ts (PINBALL_LEVELS)`, `src/lib/arcade/pinball.ts (PIN_FLIP_LEN read from the level)`, `src/lib/arcade/pinball4.ts`, `scripts/arcade-skill-bands/bots/pinball.ts`, `scripts/pinball-level-witness.ts (new)`, `scripts/pinball-levels-check.ts (new)`
- **Risk:** the ramps and lock were tuned for 56 px flippers, so a 42 px flipper may not reach a shot the 200 needs

### Blockzone (`blockfall`, Retro)

**Lever: How fast the pieces fall.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | A row every 72 ticks quickening to 36 (150 %); lock delay 45 ticks; 5 previews; lines full at 30. | blockfallRev 2: a row every 48 ticks quickening to 24 over six steps, lock delay 30 ticks, 3 previews, lines full at 51, 90 s | A row every 24 ticks quickening to 12 (twice Normal's pace); lock delay 20 ticks; 2 previews; lines full at 51 as Normal (today's 57 dropped). | A row every 12 ticks quickening to 6 (four times Normal's pace); lock delay 12 ticks; 1 preview; lines full at 51 as Normal (today's 62 dropped). |
| First seconds | The first piece drifts down, five next pieces shown | | The first piece falls twice as fast, two previews | The piece hits the floor in four seconds, one preview |
| Today | A row every 60 ticks at the start (125 %), lock delay 40 ticks, 3 previews, lines full at 40 | | A row every 38 ticks at the start (80 %), lock 24, 2 previews, lines full at 57 | A row every 29 ticks at the start (60 %), lock 18, 1 preview, lines full at 62 |

- **Why this curve:** Fall speed is the genre's own difficulty dial and is felt on the very first piece, so doubling it at each step reads at once, while the line target stops rising because a human-paced player cannot place pieces any faster than Normal already asks.
- **Proof:** Normal has a proved deal (scripts/blockfall-oracle.ts through scripts/blockfall-deal.ts: 300 seeds at exactly 200); levels have none, and today's Hard and Expert ask for 57 and 62 lines against Normal's 51. Run the same oracle (it already looks only one piece ahead) under HUMAN_LIMITS with each level's gravity, lock delay and previews and keep a seed list per level (blockfall-deal.ts --level and src/lib/duel/blockfallLevelDeals.server.ts, to write), re-proved by a new blockfall-levels-check.
- **Measured today:** Elite bot under human limits, 20 seeds: 178 / 172 / 166 / 155. Average bot at Normal: 91 (14 lines, 58 pieces).
- **Stamp:** blockfallRev 3 on Easy, Hard and Expert deals only (Normal stays blockfallRev 2): stored level rounds must replay on today's table.
- **Files:** `src/lib/arcade/retroLevels.ts (BLOCKFALL_LEVELS)`, `src/lib/arcade/blockfall.ts`, `scripts/blockfall-oracle.ts`, `scripts/blockfall/planner.ts`, `scripts/blockfall-deal.ts`, `src/lib/duel/blockfallLevelDeals.server.ts (new)`, `scripts/blockfall-levels-check.ts (new)`
- **Risk:** a 12-tick lock delay leaves room for one 0.15 s correction after landing, so Expert may need 15

### Rally (`rally`, Retro)

**Lever: Width of the paddle.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Paddle 168 px shrinking to 84; no bumpers at all; 4 lives; ball top speed 86 %; core full at 20 gold hits. | rallyRev 13: 2 lives, paddle 120 px shrinking to 40, bumpers arrive at 30 s and 45 s, core full at 23 gold hits, 60 s | Paddle 88 px shrinking to 32; both bumpers on court from the first serve; 2 lives; top speed 115 %; core full at 23 as Normal (today's 26 dropped). | Paddle 64 px shrinking to 28; both bumpers on court from the first serve; 1 life; top speed 125 %; core full at 23 as Normal (today's 29 dropped). |
| First seconds | A paddle 40 % of the court wide, no bumpers | | A paddle a quarter narrower, two bumpers already on court | A paddle half Normal's width, two bumpers, one life |
| Today | 3 lives, paddle 140 px shrinking to 60, ball top speed 86 %, bumpers at 45 s and 60 s, core full at 20 gold hits | | 2 lives, paddle 104 px shrinking to 36, top speed 115 %, bumpers at 20 s and 35 s, core full at 26 | 1 life, paddle 96 px shrinking to 32, top speed 125 %, bumpers at 10 s and 25 s, core full at 29 |

- **Why this curve:** In a paddle game the paddle is the target, so taking about a quarter off it at each level, with the bumpers already on court instead of arriving ten seconds sooner, makes every step visible before the ball is struck.
- **Proof:** No level has a proof, and no bot earns a spin shot, so even Normal's last 10 points are unshown. Write a Rally oracle that plans returns and the swipes for spin shots under HUMAN_LIMITS (scripts/rally-oracle.ts), keep per-level seeds whose run scores 200 through the server replay (src/lib/duel/rallyLevelDeals.server.ts) and replay them in a new rally-levels-check; raise the gold-hit figure above 23 only if the oracle shows it.
- **Measured today:** Elite bot under human limits (seeds 20 to 30): 175 / 159 / 156 / 142 (Hard barely below Normal). Average bot at Normal: 135.
- **Stamp:** rallyRev 14 on Easy, Hard and Expert deals only (Normal stays rallyRev 13): stored level rounds must replay on today's table.
- **Files:** `src/lib/arcade/retroLevels.ts (RALLY_LEVELS)`, `src/lib/arcade/rally.ts`, `scripts/arcade-skill-bands/bots/rally.ts`, `scripts/rally-oracle.ts (new)`, `src/lib/duel/rallyLevelDeals.server.ts (new)`, `scripts/rally-levels-check.ts (new)`
- **Risk:** a 28 px paddle against a 14 px ball at 125 % speed may be more than a human-paced oracle can hold for a minute, in which case the floor is 32

### Tempo (`beat`, Retro)

**Lever: Number of lanes.** Redesigned. **New mechanic:** A sixth lane at Expert (and three at Easy); the game already grows from four lanes to five

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 3 lanes for the whole song (no fourth or fifth); off-beats and chords half of Normal's; windows 5 / 10 / 16 ticks; fall 110 ticks. | beatRev 12: 4 lanes with a fifth from 40 s, hit windows 4 / 8 / 13 ticks (Perfect / Good / OK), fall 90 ticks, 75 s | 5 lanes from the first note (Normal from 40 s); off-beats 170 % and chords 160 % of Normal's; windows 3 / 6 / 11; fall 75 ticks. | 6 lanes from the first note; off-beats 240 % and chords 220 %; windows 3 / 6 / 11 as Hard (today's 2 / 5 / 10 dropped); fall 60 ticks. |
| First seconds | Three wide lanes, notes far apart | | Five lanes from the first bar | Six narrow lanes, notes falling in one second |
| Today | Hit windows 5 / 10 / 16 ticks, fall 110 ticks, Normal's chart and lanes | | Windows 3 / 6 / 11, fall 75 ticks, off-beats 170 % and chords 160 % of Normal's, lanes as Normal | Windows 2 / 5 / 10, fall 60 ticks, off-beats 240 % and chords 220 %, lanes as Normal |

- **Why this curve:** Lanes are what a rhythm chart is read across and the game already grows from four to five mid-song, so one more lane a level is a step anyone sees before the first note, where today's tighter windows are invisible and the bots sit inside all of them.
- **Proof:** Timing games are open by design, so the proof is the chart: a static check on every dealt chart that two thumbs can play it with each thumb given 0.15 s (9 ticks) between notes in different lanes and never more than two notes at once (scripts/beat-levels-check.ts, to write), plus the elite bot under HUMAN_LIMITS landing 120 to 150 on Expert. Expert keeps Hard's windows so a Perfect stays 50 ms either side.
- **Measured today:** Elite bot under human limits, 20 seeds: 190 / 191 / 188 / 180 (flat: its timing sits inside every window). Average bot at Normal: 110.
- **Stamp:** beatRev 13 on Easy, Hard and Expert deals only (Normal stays beatRev 12): stored level rounds must replay on today's table and charts.
- **Files:** `src/lib/arcade/retroLevels.ts (BEAT_LEVELS gains lanes)`, `src/lib/arcade/beat.ts (chart plan and judging for 3 and 6 lanes)`, `src/lib/arcade/beat.renderer.ts`, `src/components/puzzles/tapMapping.ts (lane taps; tap-mapping-check)`, `src/lib/desktopKeys.ts (six keys)`, `scripts/arcade-skill-bands/bots/beat.ts`, `scripts/beat-levels-check.ts (new)`
- **Risk:** six lanes of about 60 px for two thumbs on a 390 px phone, and the chart builder and art are written for four and five lanes

### Meteor (`snake`, Retro)

**Lever: Rocks on the field.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | No rocks and no meteor shower; edges wrap; 3 lives; a square every 10 ticks quickening to 6; core full at 27 stars. | snakeRev 15: 19 x 34 field, 2 lives (the first crash forgiven), a square every 9 ticks quickening to 4, edges wrap, up to 11 rocks that only fall once the comet has grown (from 10 s), core full at 36 stars, 60 s | 8 rocks on the field from the first tick, then one more every 3 s from 10 s whatever the comet's length (20 at most); walls; 2 lives; pace as Normal; core full at 36 as Normal (today's 50 dropped). | 16 rocks on the field from the first tick, then one more every 2 s from 5 s (32 at most); walls; 1 life; a square every 7 ticks quickening to 3; core full at 36 as Normal (today's 48 dropped). |
| First seconds | An open field with no rocks at all | | Eight rocks already down, walls round the field | Sixteen rocks, walls, a quicker comet, one life |
| Today | 3 lives, a square every 9 ticks quickening to 5, edges wrap, core full at 27 stars | | 2 lives, a square every 8 ticks quickening to 4, walls instead of wrap, core full at 50 | 1 life, a square every 8 ticks quickening to 3, walls, core full at 48 |

- **Why this curve:** Rocks are Meteor's own hazard, but today they only fall once a comet has grown, so no level can be told from Normal at the start; putting them on the field from the first tick shows the step at once and squeezes every route.
- **Proof:** No level has a proof, and today's Hard and Expert raise the core to 50 and 48 stars with nothing showing a player can reach them. Write a comet planner that takes the stars, gold stars, lanes and warps with turns at least 0.15 s apart and acts on a rock's shadow no sooner than 0.25 s after it shows (scripts/snake-oracle.ts), keep per-level seeds at 200 through the server replay (src/lib/duel/snakeLevelDeals.server.ts) and replay them in a new snake-levels-check.
- **Measured today:** Elite bot under human limits, 20 seeds: 177 / 175 / 167 / 161.
- **Stamp:** snakeRev 16 on Easy, Hard and Expert deals only (Normal stays snakeRev 15): stored level rounds must replay on today's table.
- **Files:** `src/lib/arcade/retroLevels.ts (SNAKE_LEVELS)`, `src/lib/arcade/snake.ts (rock slots that land at tick 0 and on the clock)`, `scripts/arcade-skill-bands/bots/snake.ts`, `scripts/snake-oracle.ts (new)`, `src/lib/duel/snakeLevelDeals.server.ts (new)`, `scripts/snake-levels-check.ts (new)`
- **Risk:** no Meteor oracle exists, and at a square every 3 ticks a human-paced comet cannot make a tight U-turn, so Expert's top pace may need to stay at 4

### Spacewalk (`cross`, Retro)

**Lever: Traffic on the first crossing.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Traffic 3 twelfths on the first crossing rising to 8 (half of Normal's start); 4 lives; a hit costs 10; core full at 70. | crossRev 13: 14 rows a crossing, traffic 6 twelfths on the first crossing rising to 12 by the seventh, 3 lives, a hit costs 15, core full at 76, 60 s | Traffic 10 twelfths on the first crossing rising to 15 (Normal starts at 6); 3 lives; a hit costs 15; core full at 76. | Traffic 14 twelfths on the first crossing and 15 from the second (the most that can be proved passable); every ship 25 % faster; 2 lives; a hit costs 20; core full at 76 as Normal (today's 80 dropped). |
| First seconds | Half Normal's ships, long empty gaps in every lane | | Two thirds more ships than Normal on the first crossing | Over twice Normal's ships, each a quarter faster |
| Today | Traffic 5 twelfths on the first crossing rising to 10, 4 lives, a hit costs 10, core full at 70 | | Traffic 8 twelfths rising to 15, 3 lives, a hit costs 15, core full at 76 | Traffic 10 twelfths rising to 18 on paper (a crossing that cannot be proved steps back towards 12), 2 lives, a hit costs 20, core full at 80 |

- **Why this curve:** Today's steps are the right size for strong players but only open up from the fourth crossing; moving the density to the first crossing makes each level look different at once, and ship speed carries Expert because density cannot be proved much past 15 twelfths and the 14 rows are all a phone can hold.
- **Proof:** Every crossing is proved passable in the sim (crossPassable and crossFairPassable in src/lib/arcade/cross.ts; scripts/cross-std-density.ts reports how far each density reaches). Change the level deal so a seed whose crossing cannot be proved at the level's table is dropped instead of thinned, and add a walker witness at 200 with hops at least 0.15 s apart (scripts/cross-level-deal.ts, src/lib/duel/crossLevelDeals.server.ts and scripts/cross-levels-check.ts, to write).
- **Measured today:** Elite bot under human limits, 20 seeds: 197 / 193 / 164 / 139.
- **Stamp:** crossRev 14 on Easy, Hard and Expert deals only (Normal stays crossRev 13): stored level rounds must replay on today's tables.
- **Files:** `src/lib/arcade/retroLevels.ts (CROSS_LEVELS gains a ship speed)`, `src/lib/arcade/cross.ts (rollCourseV13: no step back at a level)`, `scripts/cross-std-density.ts`, `scripts/arcade-skill-bands/bots/cross.ts`, `scripts/cross-level-deal.ts (new)`, `scripts/cross-levels-check.ts (new)`
- **Risk:** the fairness proof kept for crossings 1 and 2 may reject 14 twelfths on most seeds, leaving a small Expert deal

### Moon Climb (`ricochet`, Action)

**Lever: Blades on the walls.** Kept as today.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: half the blades, slower lanterns and a 2 m knock-down already land the average bot at 162 with no run ever ended. | ricoRev 4: about 160 blades a tower, 40 % ice, 6 lanterns at 0.75 px a tick, knock-down 3 m, height full at 245 m, 60 s | As today: blades at 1.3 times and 65 % ice put the average bot at 75 and the elite at 159, inside the targets. | As today: blades at 1.6 times, faster shurikens, 88 % ice and 4 lanterns put the average bot at 41 and the elite at 135. |
| First seconds | About one blade on the first screen | | Blades on both walls from the first leap | Blades and ice on every stretch, faster shurikens |
| Today | Half the blades (about 81 a tower), 30 % of patches ice, 6 lanterns at 0.56 px a tick, knock-down 2 m, height full at 200 m | | Blades 1.3 times Normal's (about 208), 65 % ice, knock-down 3 m, height full at 245 m | Blades 1.6 times (about 247), shurikens cross 25 % faster, 88 % ice, 4 lanterns at 1 px a tick, knock-down 4 m, height full at 260 m |

- **Why this curve:** It is the one ladder in the group that already climbs on a hazard you can count on the first screen and already measures on target at every level, so changing it would only add risk.
- **Proof:** Each level's tower is built in the sim and kept only when its witness takes every part with no hit through the real step (moonBuildDeal(seed, 4, level) in src/lib/arcade/ricochetNinja.ts); scripts/ricochet-levels-check.ts grades sampled witnesses at exactly 200. The witness leaps on exact ticks, so the build session should re-time it under HUMAN_LIMITS once.
- **Measured today:** Bots under human limits, 12 towers, mean: average 162 / 86 / 75 / 41; elite 190 / 173 / 159 / 135.
- **Stamp:** level field only: no table change. The pending ricoRev 5 (smaller ninja) is not needed; if it ships the towers re-prove in the sim with the new body.
- **Files:** `src/lib/arcade/ricochetNinja.ts (MOON_LEVELS, unchanged)`, `scripts/ricochet-levels-check.ts`, `scripts/action-levels-bands.ts`
- **Risk:** low

### Wavefront (`wavefront`, Retro)

**Lever: Enemy bolts in the air.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | One bolt a volley for the whole run, 4 in the air at most; no divers; 4 lives; bolts 80 % speed; boss 80 %, kill by 24 s. | wavRev 15: 3 lives, 5 waves of 36 ships, one bolt a volley (two from wave 3, one volley in three), 10 bolts in the air at most, divers from wave 3, boss kill by 20 s, 90 s | Two bolts a volley from wave 1 (three from wave 3), 14 in the air at most; divers from wave 2; 3 lives; bolt speed, boss and kill time as Normal. | Three bolts a volley from wave 1 (four from wave 3), 18 in the air at most; divers from wave 1, two at a time from wave 2; 2 lives; bolt speed, boss and kill time as Normal. |
| First seconds | A single slow bolt at a time, four lives | | Bolts fall in pairs from the first volley | Triple volleys, a ship diving within seconds, two lives |
| Today | 4 lives, enemy bolts 80 % speed, final boss 80 % hit points, kill by 24 s | | 3 lives, bolts 120 % speed, boss 130 %, kill by 16 s | 2 lives, bolts 140 % speed, boss 160 %, kill by 16 s |

- **Why this curve:** The ship fires for you, so the skill is dodging; raising how many bolts fall, not how fast one flies, is a step a person feels in the first second and one the dodge-everything bots can finally show.
- **Proof:** wavRev 15 is already dealt only from seeds with a stored witness at exactly 200 at every level (scripts/wavefront-big-deal.ts, src/lib/duel/wavefrontDeal.server.ts, scripts/wavefront-deal-check.ts). Rebuild that deal on the new fire tables with the witness held to HUMAN_LIMITS (no dodge sooner than 0.25 s after a bolt leaves its ship) and drop seeds without one.
- **Measured today:** Elite bot under human limits, 12 seeds: 193 / 194 / 195 / 196 (flat: the bots dodge every bolt). Average bot at Normal: 155 (wavRev 12).
- **Stamp:** wavRev 16 on Easy, Hard and Expert deals only (17 if the pending wider formation takes 16). The ladder does not need that stamp: the same 36 ships a wave fire more.
- **Files:** `src/lib/arcade/retroLevels.ts (WAVEFRONT_LEVELS: volley, bolt cap, divers from)`, `src/lib/arcade/wavefront.ts`, `scripts/wavefront-big-deal.ts`, `src/lib/duel/wavefrontDeal.server.ts`, `scripts/wavefront-deal-check.ts`, `scripts/arcade-skill-bands/bots/wavefront.ts`
- **Risk:** triple volleys with 18 bolts in the air may leave no hitless path on most seeds, so the cap is the number to tune first

### Iron Wall (`bastion`, Action)

**Lever: Tanks in each wave.** Redesigned. **New mechanic:** A fourth lane, from Hard

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 4 tanks a wave (20 in all, 1 heavy) on 3 lanes; today's Easy aids kept: green zone 320 ms, weak spots 260 %, 5 base hits, pace 32 to 74 %. | bastionRev 4: 30 tanks in 5 waves on 3 lanes (5 heavies), pace 36 to 82 %, green zone 160 ms, weak spots 240 %, 4 base hits, 60 s | A fourth lane; 8 tanks a wave (40 in all, 10 heavies); today's Hard aim settings: green zone 120 ms, weak spots 120 %, 3 base hits, pace 40 to 95 %. | Four lanes; 9 tanks a wave (45 in all, 12 heavies); bastionRev 3's aim settings (green zone 90 ms, weak spots 100 %, 3 base hits, drones 4 px a tick); pace 56 % from the first wave (bastionRev 3 reaches that on wave 3), then 80 and 104 %. |
| First seconds | Four tanks roll in on a quiet three-lane road | | A fourth lane, eight tanks in the first wave | Four lanes, nine tanks a wave, rolling in 40 % faster |
| Today | bastionRev 4: 30 tanks (2 heavies), pace 32 to 74 %, green zone 320 ms, weak spots 260 %, 5 base hits | | bastionRev 4: 30 tanks (8 heavies), pace 40 to 95 %, green zone 120 ms, weak spots 120 %, 3 base hits, drones 3 px a tick | bastionRev 3, the old Normal: 30 tanks (8 heavies), pace 44 to 104 %, green zone 90 ms, weak spots 100 %, 3 base hits, drones 4 px a tick |

- **Why this curve:** A wall is harder to hold when more comes at it, yet today all four levels send the same 30 tanks down the same three lanes; more tanks a wave, with a fourth lane to carry them (four 96 px lanes is all a 390 px screen holds for a 94 px heavy), is the step the eye catches.
- **Proof:** scripts/bastion-oracle.ts scores exactly 200 on every tuning and fresh seed at every level today (scripts/bastion-levels-check.ts). Extend the plan and the oracle to four lanes, hold the oracle to BASTION_HUMAN_LIMITS (0.25 s to notice a tank, 0.15 s between targets) and deal Hard and Expert only from seeds where it still scores 200 (a proved deal, to write).
- **Measured today:** Bots under human limits, 60 seeds, mean: average 172 / 153 / 104 / 89; elite 198 / 197 / 162 / 146.
- **Stamp:** bastionRev 5 on Easy, Hard and Expert deals (Normal stays bastionRev 4; stored Expert rounds stay bastionRev 3): BT4_LEVELS is frozen under its stamp.
- **Files:** `src/lib/arcade/bastionTank.ts (plan, BT2_LANE_X, a rev 5 level table)`, `src/lib/arcade/bastionTank.renderer.ts`, `src/lib/arcade/bastionView.ts`, `src/puzzles/bastion.tsx`, `scripts/bastion-oracle.ts`, `scripts/arcade-skill-bands/bots/bastion.ts`, `scripts/bastion-levels-check.ts`
- **Risk:** it replaces Joe's 15 Nov ruling that Expert is bastionRev 3's game, and 45 tanks need about 60 well-aimed shells in 60 s

### Roofbound (`flip`, Action)

**Lever: Running speed.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Starts at 3 px a tick (Normal 4), top 7; no moving spikes; sweet spots 6 ticks wide; a crash costs 5 s. | flipRev 13: starts at 4 px a tick, 0.35 faster every 3 s to a top of 10, moving spikes from 12 s, 8 one-tick sweet spots, a crash costs 10 s, 60 s | Starts at 5.5 px a tick, top 12; moving spikes from 4 s; a crash costs 20 s; perfect landings full at 7. | Starts at 7 px a tick, top 13 as today; moving spikes from the first second; 10 sweet spots; a crash costs 25 s; perfect landings full at 9. |
| First seconds | The cave scrolls at three quarters of Normal's pace | | Over a third faster from the first step | Nearly twice Normal's pace, spikes already moving |
| Today | Starts at 4 px a tick, top 8, no moving spikes, sweet spots 6 ticks wide, a crash costs 5 s of clean time | | Starts at 5 px a tick, top 12, moving spikes from 8 s, a crash costs 20 s, perfect landings full at 7 | Starts at 5.5 px a tick, top 13, moving spikes from 5 s, 10 sweet spots, a crash costs 25 s, perfect landings full at 9 |

- **Why this curve:** Today's table already measures close to target, but Easy starts at Normal's speed and the harder levels only pull ahead later, so setting the opening pace apart makes the same ladder visible from the first second without raising a top speed that is already near the reaction limit.
- **Proof:** Each level deals only courses whose planned witness scores exactly 200 (scripts/flip-level-deal.ts with scripts/flip-x200-plan.ts, src/lib/duel/flipLevelDeals.server.ts, scripts/flip-levels-check.ts): 258 / 257 / 254 of 260 today. Rebuild on the new speed tables with the planner's flips held to HUMAN_LIMITS (it plans every window to the exact tick today).
- **Measured today:** Mean, 24 seeds: average bot 137 / 107 / 62 / 47; elite under human limits 200 / 183 / 163 / 159.
- **Stamp:** flipRev 14 on Easy, Hard and Expert deals only (Normal stays flipRev 13): FLIP_LEVEL_RULES is frozen with the sim.
- **Files:** `src/lib/arcade/flip.ts (FLIP_LEVEL_RULES)`, `src/lib/levels/gameLevels.ts (display copy)`, `scripts/flip-level-deal.ts`, `scripts/flip-x200-plan.ts`, `src/lib/duel/flipLevelDeals.server.ts`, `scripts/flip-levels-check.ts`
- **Risk:** moving spikes from the first second at 7 px a tick may cut the share of courses with a witness (three Expert witnesses stop at 140 today)

### Fission (`burst`, Retro)

**Lever: Atoms in each wave.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Waves S; M; M; M S; L (42 atoms, half of Normal's); atoms 125 % size; 4 lives; quick-clear time 150 %; 40 free wasted beams. | burstRev 13: 3 lives, five waves of 87 atoms (M; L; M M; L S S; L L, counting every split), quick clear 1 s plus 0.6 s an atom, 20 free wasted beams, 90 s | Waves M M; L; L M; L M; L L (103 atoms); 3 lives; quick-clear time and free beams as Normal (today's 75 % and 12 dropped). | Waves M M M; L M; L M; L L; L L (125 atoms, three bouncing from the first second); 2 lives; quick-clear time and free beams as Normal (today's 60 % and 8 dropped). |
| First seconds | One small atom, drawn a quarter bigger | | Two atoms bouncing in the opening wave | Three atoms at once from the start, two lives |
| Today | 4 lives, atoms 125 % size, quick-clear time 150 %, 40 free wasted beams | | 3 lives, quick-clear time 75 %, 12 free wasted beams | 2 lives, quick-clear time 60 %, 8 free wasted beams |

- **Why this curve:** Fission is about how much is bouncing at once, and every level today opens on the same single atom; bigger waves show the step in the opening second and stretch the run towards the clock, which shorter quick-clear timers never showed anyone.
- **Proof:** The oracle in scripts/arcade-standard/burst.ts searches the real sim with the phone's own moves and taps and reaches 200 on Normal (a perfect run in 43.5 s). Run it at each level under HUMAN_LIMITS, keep seeds at 200 in a per-level deal (src/lib/duel/burstLevelDeals.server.ts, to write) and replay them in a new burst-levels-check. Today's Hard and Expert cut the quick-clear time to 75 % and 60 % with no proof that 200 is still there.
- **Measured today:** Elite bot under human limits (seeds 20 to 30): 191 / 179 / 172 / 158. Average bot at Normal: 82 (burstRev 12).
- **Stamp:** burstRev 14 on Easy, Hard and Expert deals only (15 if the pending atom-size stamp takes 14). The ladder does not need that stamp: wave lists carry over to any atom size.
- **Files:** `src/lib/arcade/retroLevels.ts (BURST_LEVELS gains wave lists)`, `src/lib/arcade/burst.ts (initV10 waves per level)`, `scripts/arcade-standard/burst.ts (the oracle)`, `scripts/arcade-skill-bands/bots/burst.ts`, `src/lib/duel/burstLevelDeals.server.ts (new)`, `scripts/burst-levels-check.ts (new)`
- **Risk:** the oracle's own pace is 87 atoms in 43.5 s, so 125 atoms leaves under half a minute of slack before human limits are applied

### Orbit (`orbit`, Action)

**Lever: Asteroid belts round the planets.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | No asteroid belts at all (today from planet 25, earlier than Normal's 31); tank 240 ticks, automatic checkpoints and hops 30 to 150 px as today. | orbitRev 16: 40 planets, tank 160 ticks, one SET CHECKPOINT, hops 60 to 220 px sideways, 4-tick release windows, belts from planet 31, 90 s | A belt round every second planet from the second (Normal only from planet 31); tank 140, one checkpoint, hops 110 to 270 px and 3-tick windows as today. | A belt round every planet from the first; tank 120, no checkpoint and hops 140 to 300 px as today; narrowest release window 3 ticks (today 2, which is 33 ms). |
| First seconds | Bare planets, no rock belts, no checkpoint button | | A rock belt round the second planet on screen | Every planet ringed with rocks, no checkpoint button |
| Today | Tank 240 ticks, automatic checkpoints at planets 10, 20 and 30, hops 30 to 150 px sideways, belts from planet 25 | | Tank 140, one checkpoint, hops 110 to 270 px, 3-tick windows, belts from planet 25 | Tank 120, no checkpoint, hops 140 to 300 px, 2-tick windows, belts from planet 21 |

- **Why this curve:** Hop width and fuel already step but are hard to see and leave Expert no harder than Hard for an average player, whereas belts are Orbit's own hazard, sit on screen from the first planet and turn every release into a threaded shot.
- **Proof:** Each level deals from its own bank whose witness takes every feature and the sun with half the run left for exactly 200 (bun scripts/orbit-fuel-bank.ts --level, src/lib/duel/orbitFuelBank{Easy,Hard,Expert}.server.ts, scripts/orbit-levels-check.ts, witness in scripts/orbit-xp-lib.ts). Rebuild the three banks with the new belt settings and re-time the witness under ORBIT_HUMAN_LIMITS.
- **Measured today:** 16 deals, mean: average bot 116 / 107 / 79 / 82 (Expert no harder than Hard); elite under human limits 185 / 184 / 170 / 160 (sun reached 100 / 94 / 75 / 44 %).
- **Stamp:** orbitRev 17 on Easy, Hard and Expert deals only (Normal stays orbitRev 16): the level rules are read at replay and the banks are rebuilt.
- **Files:** `src/lib/arcade/orbitRev3.ts (ORBIT_LEVEL_RULES)`, `src/lib/levels/gameLevels.ts (beltsFrom, a belt spacing)`, `scripts/orbit-fuel-bank.ts`, `scripts/orbit-xp-lib.ts`, `src/lib/duel/orbitFuelBankEasy.server.ts, orbitFuelBankHard.server.ts, orbitFuelBankExpert.server.ts`, `scripts/orbit-levels-check.ts`, `scripts/orbit-level-bands.ts`
- **Risk:** belts on the opening planets may cut how many courses the builder can prove (31 or 32 a level today)

### Grappler (`swing`, Action)

**Lever: How soon the pterodactyl chases.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | No pterodactyl; reach 250 px; no sliding vines (today 5); no dark runs; course part full at 40 % of the way (today 50 %). | swingRev 18: reach 220 px, 18 sliding vines, pterodactyl over the last quarter at 2.4 px a tick, 6 dark ledge runs, course part full at 70 %, 90 s | The pterodactyl chases from the first vine (Normal only the last quarter), starting 400 px behind at 2.0 px a tick and 3.2 over the last quarter, its distance warning shown from the start; 26 sliding vines, vine swing 125 % and stall 55 ticks as today. | The pterodactyl starts 200 px behind at the first vine, 2.6 px a tick and 3.4 over the last quarter; reach 205 px, 30 sliding vines, 7 dark runs and vine swing 145 % as today. |
| First seconds | No pterodactyl, every vine hanging still, all lit | | A pterodactyl warning from the first vine, vines sliding | The pterodactyl warning twice as close and closing faster |
| Today | Reach 250 px, 5 sliding vines, no pterodactyl, no dark runs, course part full at 50 % of the way | | 26 sliding vines, pterodactyl 3.2 px a tick over the last quarter, streak stall 55 ticks, vine swing 125 % | Reach 205 px, 30 sliding vines, pterodactyl 3.4 px a tick over the last quarter, 7 dark runs, vine swing 145 % |

- **Why this curve:** Reach, sliding vines and swing speed change the route but not the look and leave every bot flat across the levels, whereas the chaser the game already has turns the whole course into a race the moment it appears.
- **Proof:** Each level deals 24 courses whose flawless oracle replays to exactly 200 (bun scripts/swing-slide-deal.ts --rev=18 --level, src/lib/duel/swingLevelDeal.server.ts, scripts/swing-levels-check.ts). Rebuild with the chase from the first vine: the oracle must stay ahead on every stretch, ledge runs included, and its releases need re-timing under HUMAN_LIMITS (it hits exact ticks today).
- **Measured today:** 6 courses, bots under human limits, mean: average 113 / 86 / 89 / 79 (Hard no harder than Normal); elite 199 / 199 / 200 / 198 (flat).
- **Stamp:** swingRev 19 on Easy, Hard and Expert deals only (Normal stays swingRev 18): SWING_LEVELS says a changed value needs a new stamp.
- **Files:** `src/lib/arcade/swing.ts (SWING_LEVELS gains a chase start and opening pace)`, `src/lib/levels/gameLevels.ts (display copy)`, `scripts/swing-slide-deal.ts`, `src/lib/duel/swingLevelDeal.server.ts`, `scripts/swing-levels-check.ts`, `scripts/arcade-skill-bands/bots/swingRework.ts`, `scripts/action-levels-bands.ts`
- **Risk:** swing.md records that tightening the pterodactyl broke the proof before, so the opening pace may have to fall under 2.0 px a tick


## Strategy, Sports and Cards & Board (session D6)

### Gemstone (`matchup`, Strategy)

**Lever: Frozen cells on the board.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 5 ice cells, 5 colours, goals 12 to 36, hint after 3 s (average 163 and a third of runs earn a star, so it does its job). | matchupRev 13: 6 colours, 10 two-hit ice cells on the 7 x 10 board, goals 20 to 60, hint after 5 s, 90 s | 18 ice cells (Normal 10); a 7th colour, the cyan heart; goals 30 to 90 over 7 colours; no hint; parts full at 320 gems, 2 treasures, 3 goals, 12 ice, 3 big lines (today's Expert moved down one level). | 28 ice cells (40 % of the 70 squares, the bottom four rows nearly solid); 7 colours; goals 30 to 90; no hint; parts full at 320 gems, 2 treasures, 3 goals, 18 ice, 3 big lines. |
| First seconds | Five colours, a handful of frozen squares, a hint after three seconds | | A seventh gem, the cyan heart, and 18 frozen squares | Ice over 28 squares: the bottom rows nearly solid |
| Today | 5 colours, 5 ice cells, goals 12 to 36, hint after 3 s idle | | 6 colours, 14 ice cells, goals 28 to 78, hint after 8 s, core full at 380 gems | 7 colours (cyan heart), 18 ice cells, goals 30 to 90, no hint; parts full well short (320 gems, 2 treasures, 3 goals, 12 ice, 3 big lines) |

- **Why this curve:** Ice is the one thing on a match-three board you can count at a glance, each frozen square takes two clears and blocks free swaps, and the seventh colour thins the matches needed to break it.
- **Proof:** No per-seed proof today: scripts/gemstone-levels-record.ts holds a flawless witness on one seed a level and elite-under-limits witnesses on 3 Expert seeds. Write scripts/gemstone-level-deal.ts: a dealt list per level (new src/lib/duel/matchupLevelDeal.server.ts) keeping only seeds where the planner of scripts/arcade-skill-bands/bots/matchup.ts, held to HUMAN_LIMITS (250 ms reactions, 150 ms swipes), replays to exactly 200 through the server; scripts/gemstone-levels-check.ts replays every witness.
- **Measured today:** 60 seeds: average bot 163 / 95 / 82 / 72; elite under human limits 197 / 158 / 146 / 137; flawless 198 / 174 / 167 / 168
- **Stamp:** matchupRev 14 on Hard and Expert deals (Easy and Normal stay matchupRev 13): MATCHUP_V13_LEVELS is frozen with the stamp and stored level rounds must replay.
- **Files:** `src/lib/arcade/matchup.ts (MATCHUP_V13_LEVELS, a rev 14 table)`, `src/lib/levels/gameLevels.ts`, `scripts/gemstone-level-deal.ts (new)`, `src/lib/duel/matchupLevelDeal.server.ts (new)`, `scripts/gemstone-levels-bands.ts`, `scripts/gemstone-levels-check.ts`
- **Risk:** the limited bot reaches 200 on about 3 Expert seeds in 200 today, so a 60-seed list needs a stronger planner or thousands of candidates

### Mahjong Solitaire (`mahjong`, Cards & Board)

**Lever: Tiles in the stack.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 48 tiles in 2 layers (the 6 x 7 base plus a 2 x 3 cap); 2 faces dealt four times; Shuffle costs 2; free hints and the idle glow after 8 s; speed full by 70 s. | mahjongRev 2: 72 tiles in 4 layers on a 6 x 7 footprint, 6 faces dealt four times, Shuffle costs 5, no hints, speed full by 65 s, 120 s | 104 tiles in 4 layers on a 7 x 8 footprint (tiles 48 x 63 world px, 53 px wide on a phone); 18 faces dealt four times; Shuffle costs 10; no hints; speed full by 85 s. | 136 tiles in 4 layers on an 8 x 9 footprint (tiles 42 x 55 world px, 46 px wide: the phone ceiling); all 34 faces dealt four times; Shuffle costs 15; no hints; speed full by 100 s. |
| First seconds | A low two-layer stack of big tiles, a Hint button | | A wider, taller stack: 104 smaller tiles | The full set: 136 small tiles wall to wall |
| Today | 56 tiles in 3 layers, 2 faces dealt four times, Shuffle costs 2, free hints and idle glow, speed full by 70 s | | 72 tiles, 10 faces dealt four times, Shuffle costs 8, hints at 5 points each, speed full by 25 s | 88 tiles in 5 layers, 12 faces dealt four times, Shuffle costs 10, one hint, speed full by 30 s |

- **Why this curve:** Mahjong Solitaire is a search against the clock, so the number of tiles is the whole load, and the full four-of-each set is the game's own natural summit.
- **Proof:** Built backwards as today (mahjongBuild and mahjongBuildClears in src/lib/arcade/mahjong.ts), so the build order clears every deal. scripts/cards-levels-check.ts replays each level's build order, two taps a pair at 0.4 s a tap (HUMAN_LIMITS), through replayMahjongRun to exactly 200: Expert's 136 taps take 55 s, inside its 100 s speed line.
- **Measured today:** 40 deals: elite 200.0 / 197.5 / 183.1 / 171.4; human limits 199.5 / 197.5 / 195.1 / 193.3; Normal average bot 136 with 0 of 60 cleared; average per level not documented
- **Stamp:** mahjongRev 3 on level deals (Normal stays mahjongRev 2): two new layouts, and today's Hard and Expert rounds with hints must still replay.
- **Files:** `src/lib/arcade/mahjong.ts (MAHJONG_LEVEL_RULES, layouts of 48, 104 and 136 places)`, `src/lib/arcade/mahjong.renderer.ts (tile size per layout)`, `src/lib/levels/gameLevels.ts`, `scripts/cards-levels-check.ts`, `scripts/cards-levels-order-check.ts`, `scripts/cards-levels-tune.ts`
- **Risk:** tile faces must stay readable at 46 px, and a wrong pick among four-of-a-kind faces under hidden tiles still needs the Shuffle

### Home Run (`homerun`, Sports)

**Lever: Pitch speed.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Fastball 52 to 58 ticks (about 0.9 s), curveball 64 to 70, changeup 76 to 84; 5 outs instead of 3; only 3 balls off the zone in the first 24; windows ±9 / ±6, PERFECT ±2; movement 30 %; catch areas 60 %. | homerunRev 5: fastball 36 to 41 ticks, curveball 48 to 54, changeup 62 to 70, 7 balls, windows ±5 / ±3, PERFECT ±1, catch areas 100 %, three outs, 117 s | Fastball 31 to 34 ticks, curveball 42 to 46, changeup 56 to 61; catch areas 135 %; three outs; PERFECT stays ±1 tick; windows, movement and close balls as today's Hard (±4 / ±3, 130 %, 8 balls). | Fastball 27 to 29 ticks (today's, the human floor: 15 ticks to react, 9 to swipe, 6 for the swing), curveball 37 to 40, changeup 51 to 55; catch areas 165 %; PERFECT ±1 tick; windows, movement and close balls as today's Expert (±4 / ±2, 160 %, 9 balls). |
| First seconds | A slow lob, small catch circles, five outs on the board | | A fastball a fifth quicker, catch circles a third bigger | Heat at the human limit, catch circles closing every gap |
| Today | fastball 42 to 47 ticks to the plate, 6 balls off the zone in the first 24, windows ±7 / ±5 ticks, PERFECT ±2, movement 45 %, catch areas 80 %, three outs | | fastball 28 to 31 ticks, 8 balls 8 to 24 px off the zone, windows ±4 / ±3, PERFECT the exact tick, movement 130 %, catch areas 110 % | fastball 27 to 29 ticks, 9 balls 5 to 17 px off the zone, windows ±4 / ±2, exact tick, movement 160 %, catch areas 120 % |

- **Why this curve:** Batting is timing, so the ball's speed is the honest lever; it reaches the human floor at Expert, where the fielders' reach, already drawn on the grass before the first pitch, takes over as the squeeze.
- **Proof:** Each level's 120-seed deal (src/lib/duel/homerunDealV5.server.ts, scripts/homerun-innings-deal.ts) is proved today by the flawless batter (oracleRunV5 in scripts/homerun-oracle.ts), which is not held to HUMAN_LIMITS, and docs/arcade-standard/homerun.md says the elite under limits fills the perfect streak on 0 % of Hard and Expert innings. Re-prove with the flawless batter under the limits (swing no sooner than the wind-up tell + 0.25 s + 0.15 s) and PERFECT at ±1 tick so ten in a row is humanly possible; drop any seed short of 200 through replayHomerunRun; scripts/homerun-innings-check.ts replays the lists.
- **Measured today:** 30 seeds under human limits, medians: average 89 / 63 / 26 / 16; near-perfect 200 / 192 / 162 / 139; elite 200 / 200 / 172 / 149
- **Stamp:** homerunRev 6 on level deals (Normal stays homerunRev 5): the plan, outs and windows per level change, and stored level rounds must replay.
- **Files:** `src/lib/arcade/homerunInnings.ts (HR_LEVEL_SETTINGS, outs per level)`, `src/lib/arcade/homerun.renderer.ts (the radar board shows the level's real speed, today it shows the pitch type's)`, `scripts/homerun-innings-deal.ts`, `src/lib/duel/homerunDealV5.server.ts (a rev 6 deal beside it)`, `scripts/homerun-innings-bands.ts`, `scripts/homerun-innings-check.ts`
- **Risk:** Normal's average is already 63, so Hard and Expert land near 35 and 15 for an average player, under the guide numbers

### Top Bins (`freekick`, Sports)

**Lever: Players in the wall.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Wall of 2 that never jumps; keeper waits 18 ticks at 70 % speed; no wind; gold zone 660 to 840; scoring ease kept (hoop 1.35 x, open side from 0.6 m). | freekickRev 6: wall of 3 to 5, keeper 14 ticks at 85 %, wind up to 2, gold zone 720 to 800, hoop to 80 %, 4 jumping walls, scoring ease on, Goals full at 800, ten kicks, 90 s | Wall of 5 or 6, jumping on 6 of the 10 kicks; keeper 8 ticks at 115 %; wind up to 5; gold zone, hoop, scoring ease and Goals full at 800 stay Normal's. | Wall of 7, jumping on 8 of the 10 kicks; keeper 5 ticks at 140 % (today's Expert); wind up to 8; gold zone, hoop, scoring ease and Goals full at 800 stay Normal's. |
| First seconds | Two men in the wall, a calm flag | | A five or six man wall and a stiff wind flag | Seven in the wall, wind 8, half the goal hidden |
| Today | wall of 3, keeper waits 14 ticks at 85 % speed, wind up to 1, gold zone 680 to 820, hoop shrinks to 85 %, 3 jumping walls, scoring ease on | | wall of 4 to 5, keeper 6 ticks at 130 %, wind up to 6, zone 735 to 790, hoop to 60 %, 5 jumps, no scoring ease, Goals full at 1,200 | wall of 5, keeper 5 ticks at 140 %, wind up to 7, zone 745 to 780, hoop to 50 %, 6 jumps, no scoring ease, Goals full at 1,250 |

- **Why this curve:** The wall is what a free kick is about and the first thing on screen: each extra man hides more of the goal and forces more bend or dip, which the quicker keeper and stronger wind then punish, with no hidden change to what a goal is worth.
- **Proof:** Per-level proved deal as today: scripts/freekick-layered-deal.ts (a --rev=7 build) keeps a seed only when the oracle (oracleRunV5, scripts/freekick-oracle.ts) scores exactly 200 through the server replay; the kick reacts to nothing in flight, so the witness is the same under HUMAN_LIMITS. Today Expert dropped 52 of 112 candidates; expect more with a 7 man wall. scripts/freekick-layered-check.ts proves the lists.
- **Measured today:** 30 seeds under human limits, medians: average 131 / 108 / 31 / 15; near-perfect 184 / 190 / 157 / 112; elite 190 / 197 / 168 / 128 (Easy's elite sits below Normal's)
- **Stamp:** freekickRev 7 on level deals (Normal stays freekickRev 6): walls above 5 and new level tables; stored rounds replay on their own rev.
- **Files:** `src/lib/arcade/freekick.ts (FK_LEVEL_SETTINGS_V6, a rev 7 table; walls of 6 and 7)`, `src/lib/arcade/freekick.renderer.ts (shirts for a 7 man wall)`, `scripts/freekick-layered-deal.ts`, `src/lib/duel/freekickDealV6.server.ts (a rev 7 deal beside it)`, `scripts/freekick-layered-bands.ts`, `scripts/freekick-layered-check.ts`
- **Risk:** a seven man wall may leave too few seeds where all ten kicks have a scoring line; a wall of 6 to 7 is the fallback

### Apex (`racing`, Sports)

**Lever: Road width.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Road 130 % of Normal's width (85,197 units, 5.2 car widths); gravel keeps 80 % of speed; braking points and racing line painted; par pace as today's Easy (192.0 / 205.5 / 175.0 km/h). | racingRev 4: road 65,536 units (four car widths), gravel keeps 65 %, wall at 131,072, racing line shown, par 221.5 / 238.5 / 203.0 km/h, spread 69.5 km/h, 99 s | Road 85 % (55,700 units, 3.4 car widths); gravel keeps 50 %; no racing line (signs and boards stay); par set just under the oracle's pace on the narrower road; spread 69.5 km/h as Normal. | Road 72 % (47,200 units, 2.9 car widths); gravel keeps 35 %; signs only; par from the oracle on this road; spread 69.5 km/h; the circuits keep their own hairpins. |
| First seconds | A wide road with braking points and a racing line painted | | A visibly narrower road, no racing line | A lane under three cars wide between gravel traps |
| Today | road 115 % wide (75,366 units), gravel keeps 80 % of speed, braking points painted, lower par pace (192.0 / 205.5 / 175.0 km/h) | | same road, gravel keeps 60 %, wall at 108,134, signs and boards only, pace spread 32 km/h | same road, gravel keeps 50 %, hairpins 2 tighter on two circuits, signs only, pace spread 25 km/h |

- **Why this curve:** Width is what a driver sees and feels at once: a narrower road cuts every corner's speed and turns small errors into gravel, where today's levels only change what happens after you have left the tarmac or how the pace is scored.
- **Proof:** bun scripts/racing-deal.ts --rev=4 --level=<l> rebuilds each level's 300-seed list (100 a circuit): scripts/racing-oracle.ts must replay to exactly 200 through replayRacingRun on the level's road. The oracle is not held to HUMAN_LIMITS today; hold its stick changes to one every 0.15 s and set each circuit's par just under that limited oracle's average, as Expert's par is set today. scripts/racing-levels-check.ts proves the lists.
- **Measured today:** elite bot 199.9 / 186.7 / 172.1 / 157.4; Normal average bot 93.5; average per level not documented
- **Stamp:** level field only: the settings ride on each puzzle as racingLevel (road, kerb, wall, keep, aids, pace and spread already exist), so stored rounds keep their own copy.
- **Files:** `src/lib/levels/gameLevels.ts (GAME_LEVELS.racing)`, `src/lib/arcade/racing.ts`, `scripts/racing-deal.ts`, `scripts/racing-oracle.ts`, `src/lib/duel/racingDealV4Easy.server.ts, racingDealV4Hard.server.ts, racingDealV4Expert.server.ts`, `scripts/racing-levels-check.ts`, `scripts/racing-levels-bands.ts`, `src/lib/levels/levelNotes.ts`
- **Risk:** Ridge Loop's hairpins may be undriveable at 72 % width, as its tightened hairpins were on today's Expert; it may need its own width

### Free Cell (`freecell`, Cards & Board)

**Lever: Free cells.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 5 free cells, 32 cards (Ace to 8), free unlimited undo, free hints with the idle glow, speed full by 60 s (four short rows and a fifth cell already read as easy). | freecellRev 5: 4 free cells, 40 cards (Ace to 10), undo counts as a move, no hints, par 0 at 1.5 x, speed full by 32 s, 120 s | 3 free cells; the full 52 cards from the 120 shortest three-cell solutions (par 32 to 43, today's Expert deals); undo unlimited but a move; no hints; par 0 at 1.25 x; speed full by 30 s. | 2 free cells; 52 cards from a new bank of the shortest two-cell solutions (par 50 or under); 3 undos; no hints; par 0 at 1.25 x; speed full by 40 s. |
| First seconds | Five free cells over four short rows, a Hint button | | Three free cells over a full 52-card table | Only two free cells, court cards everywhere, Undo (3) |
| Today | 5 free cells, 32 cards (Ace to 8), free unlimited undo, free hints and idle glow, par 0 at 2 x, speed full by 60 s | | 4 free cells, 52 cards (par 29 to 41), hints at 5 points each, par 0 at 1.25 x, speed full by 25 s | 3 free cells, 52 cards (par 32 to 43), 3 undos, one hint, par 0 at 1.25 x, speed full by 25 s |

- **Why this curve:** The free cells are Free Cell's own difficulty dial: each one removed roughly halves the room to manoeuvre, and since the deck is already full at Hard, the cells carry the ladder to the top.
- **Proof:** scripts/freecell-level-bank.ts re-solves candidate deals with the level's cell count using the bank solver (src/lib/arcade/cards/freecellSolver.ts) and keeps the 120 shortest (src/lib/arcade/cards/freecellDealsLevels.data.ts, lines in scripts/fixtures/freecell-solutions-levels.json). scripts/cards-levels-check.ts replays every line to exactly 200 through the server at one move every 0.4 s (HUMAN_LIMITS), which must finish inside the speed line; deals the solver cannot clear with two cells are dropped.
- **Measured today:** 40 deals: elite 192.8 / 184.1 / 156.2 / 145.5; human limits 193.0 / 185.1 / 166.7 / 163.5 (Expert best tenth 189.8); Normal average bot 123; average per level not documented
- **Stamp:** freecellRev 6 on Hard and Expert deals (Easy and Normal stay freecellRev 5): today's Hard and Expert rounds with hints must still replay.
- **Files:** `src/lib/arcade/cards/freecell.ts (FC_LEVEL_RULES)`, `scripts/freecell-level-bank.ts`, `src/lib/arcade/cards/freecellDealsLevels.data.ts`, `src/lib/arcade/cards/freecellSolver.ts`, `src/lib/levels/gameLevels.ts`, `scripts/cards-levels-check.ts`, `scripts/cards-levels-order-check.ts`
- **Risk:** two-cell solutions may be too long to play inside 120 s, so the bank may need thousands of candidates to find 120 short ones

### Summit (`tripeaks`, Cards & Board)

**Lever: Seconds on the clock.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 90 s; 23 stock turns; deals with stock par 12 or less (11 turns to spare); playable glow, wrap, 3 undos, free hints with the idle glow; speed full by 30 s. | tripeaksRev 3: 60 s, 28 peak cards, 23 stock turns, playable glow, wrap, no undo, no hints, speed full by 20 s | 45 s; the stock cut to 18 turns, on deals with stock par 13 or less (5 to spare); no glow; wrap kept; no undo, no hints; speed full by 20 s. | 35 s; the stock cut to 14 turns, on deals with stock par 11 or less (3 to spare); no glow; wrap kept; no undo, no hints; speed full by 18 s. |
| First seconds | A slow 90 second bar, glowing cards, an Undo button | | The timer bar draining faster, a stock of 18, no glow | 35 seconds, a thin stock of 14, nothing glows |
| Today | 60 s; bank deals with stock par 12 or less; playable glow; Ace to King wrap; 3 undos; free hints; speed full by 25 s | | 60 s; the no-wrap bank's 108 easier deals (stock par 8 to 18); no glow, no wrap; hints at 5 points each | 60 s; the no-wrap bank's 100 hardest deals (stock par 18 to 23); no glow, no wrap; one hint; speed full by 16 s |

- **Why this curve:** Summit is the sixty-second sprint of the card games and its ten-card bottom row is already at the phone's width limit, so time and stock, the two numbers on screen, make the ladder; they replace today's no-wrap rule, which changes how cards connect without showing it.
- **Proof:** Every bank deal already has a proved clearing line and a stock par (src/lib/arcade/cards/tripeaksDeals.data.ts and tripeaksStockPar.data.ts, built by scripts/tripeaks-bank.ts and scripts/tripeaks-stock-par.ts with src/lib/arcade/cards/tripeaksSolver.ts). A level's list is the deals whose par fits its stock; scripts/cards-levels-check.ts replays each par line at one tap every 0.4 s (28 cards and 11 turns take 16 s) to exactly 200 inside the level's clock.
- **Measured today:** 40 deals: elite 183.3 / 181.3 / 173.6 / 171.3; human limits 164.9 / 159.1 / 144.9 / 128.5 (Expert best tenth 197.5); Normal average bot 110 with 9 of 60 cleared; average per level not documented
- **Stamp:** tripeaksRev 4 on level deals (Normal stays tripeaksRev 3): a level clock and a shorter stock are new sim rules, and today's no-wrap rounds must still replay.
- **Files:** `src/lib/arcade/cards/tripeaks.ts (TP_LEVEL_RULES: clock and stock turns per level)`, `src/lib/arcade/cards/tripeaksStockPar.data.ts`, `scripts/tripeaks-stock-par.ts`, `scripts/tripeaks-bank.ts`, `src/lib/levels/gameLevels.ts`, `scripts/cards-levels-check.ts`, `scripts/cards-levels-order-check.ts`
- **Risk:** the 300-deal bank may hold too few deals with stock par 11 or less, and extending it costs about 25 min of par search a pass

### Five Hands (`fivehands`, Cards & Board)

**Lever: Seconds per card.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 90 s (4.3 s a card); score x 1.6; today's hand table; the next two cards and each column's value shown; free hints with the idle glow. | fiveHandsRev 3: 60 s for 20 cards and the column pick, score x 1.4, pair 15, two pair 20, no hints, the seed's first shuffle as dealt | 42 s (2 s a card); the Hard table (a pair pays 10); score x 1.4; no hints; decks from a proved list. | 30 s (1.4 s a card); the Expert table (a pair 10, two pair 15); score x 1.4; no hints; decks from a proved list. |
| First seconds | The next two cards shown, a long 90 second bar | | 42 seconds for 20 cards: the bar visibly racing | 30 seconds: a card down every second and a half |
| Today | 75 s, score x 1.6, today's hand table, next two cards and column values shown, free hints | | 50 s, x 1.4, a pair pays 10, hints at 5 points each | 45 s, x 1.3, a pair pays 10 and two pair 15, one hint |

- **Why this curve:** The deck and the five rows cannot grow, so thinking time per card is the lever: halving it turns a poker puzzle into speed poker, and the stricter tables make the rushed safe pair worth less.
- **Proof:** Five Hands is the arcade standard's one named exception (NOT_200_ON_EVERY_DEAL in scripts/arcade-standard-check.ts): Normal deals the seed's first shuffle and only 165 of 200 decks can reach 200, so today no level has a 200 proof. A level need not inherit that: build a deck list per level with scripts/cards/fiveHandsBest.ts (the exact best rows plus best column, about 1 s a deck, run on the level's table) and keep only decks whose best reaches the level's full figure (143 hand points at x 1.4, 125 at x 1.6); the witness is 21 taps, 8.4 s at 0.4 s a tap. The exception then covers Normal alone.
- **Measured today:** 40 deals: elite 171.6 / 153.8 / 130.6 / 114.9; human limits 154.4 / 136.0 / 115.2 / 101.3 (Expert best tenth 149.3); Normal average bot 112; flawless reaches 200 on 165 of 200 Normal decks
- **Stamp:** fiveHandsRev 4 on level deals (Normal stays fiveHandsRev 3): proved deck lists replace the first shuffle, and today's hint rounds must still replay.
- **Files:** `src/lib/arcade/cards/fiveHands.ts (FH_LEVEL_RULES)`, `scripts/cards/fiveHandsBest.ts (take the level's table)`, `scripts/fivehands-level-decks.ts (new)`, `src/lib/arcade/cards/fiveHandsLevelDecks.data.ts (new)`, `scripts/arcade-standard-check.ts (the exception narrowed to Normal)`, `scripts/cards-levels-check.ts`, `scripts/cards-levels-order-check.ts`
- **Risk:** at 30 s the game may read as a reflex test, not poker; 35 s is the fallback

### Thirteen (`pyramid`, Cards & Board)

**Lever: Rows in the pyramid.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 6 rows (21 cards, 31 in the stock); 3 passes through the stock; partner glow; free hints with the idle glow; 1 or 3 Kings; speed full by 20 s. | pyramidRev 3: 7 rows (28 cards), 24 stock cards, one pass, 2 to 4 Kings, partner glow, no hints, speed full by 20 s, 90 s | 8 rows (36 cards, 16 in the stock); one pass; no glow; no hints; 2 or 4 Kings; speed full by 26 s. | 9 rows (45 cards, only 7 in the stock; cards about 43 px wide, the phone ceiling); one pass; no glow; no hints; 3 Kings; speed full by 32 s. |
| First seconds | A short six-row pyramid over a thick stock, pairs glowing | | A taller eight-row pyramid, a thin stock, no glow | Nine rows edge to edge, seven cards in the stock |
| Today | 7 rows (28 cards), 3 passes through the stock, 3 or 4 Kings, partner glow, free hints, any proved deal | | 7 rows, one pass, 2 or 3 Kings, no glow, a stricter deal filter (a three-removal look fails), hints at 5 points each | 7 rows, one pass, exactly 3 Kings, no glow, a four-removal deal filter, one hint |

- **Why this curve:** A taller pyramid is the same game with more buried cards and a smaller stock to rescue you, which anyone sees before the first tap; today's three levels show the same 28 cards and differ only in a hidden deal filter.
- **Proof:** Each deal is built with a witness in the sim as today (pyBuildLevelDeal and proveDeal in src/lib/arcade/cards/pyramid.ts, generalised from 7 rows to the level's rows, every pyramid card paired inside the pyramid so the face-down stock never decides a clear). The witness replays to exactly 200 through the server at 0.4 s a tap (45 cards take about 20 s), scripts/cards/pyramidSolver.ts re-proves samples, and scripts/cards-levels-check.ts runs both.
- **Measured today:** 40 deals: elite 195.5 / 180.3 / 159.1 / 139.6; human limits 196.2 / 176.6 / 143.2 / 133.8 (Expert best tenth 200); Normal average bot 131 with 14 of 60 cleared; average per level not documented
- **Stamp:** pyramidRev 4 on level deals (Normal stays pyramidRev 3): new pyramid sizes, and today's level rounds must still replay.
- **Files:** `src/lib/arcade/cards/pyramid.ts (PY_LEVEL_RULES, rows per level, pyBuildLevelDeal)`, `src/lib/arcade/cards/pyramid.renderer.ts (layouts for 6, 8 and 9 rows)`, `scripts/cards/pyramidSolver.ts`, `src/lib/levels/gameLevels.ts`, `scripts/cards-levels-check.ts`, `scripts/cards-levels-order-check.ts`
- **Risk:** nine rows leave 7 stock cards, so the builder may find few deals with a witness that a no-plan player cannot also clear

### Crazy Golf (`minigolf`, Sports)

**Lever: Hazards on each hole.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | No sand or water on any hole (the windmills, castles, tunnels and ramps stay); slow sails (128); aim line shows the first bounce; par = best route + 2; limit par + 4; speed full by 60 s. | golfRev 3: 5 holes, par = best route + 2, stroke limit par + 3, sails 256, slopes 1 x, full aim line, speed full by 53 s, 90 s | 4 extra hazards a hole in the line of play (two bunkers, a pond and a boulder; today 2); sails 384; aim line 35 %; slopes back to 1 x; par = best route and limit par + 3 as today's Hard. | 8 extra hazards a hole (a second pond and three more boulders); fast sails (512); aim line 20 %; slopes 1 x; par = best route and limit par + 2 as today's Expert. |
| First seconds | Clean greens: no sand, no water, slow windmills | | Bunkers, a pond and a boulder across the line | Sand and water everywhere, sails at double speed |
| Today | Normal's holes; slow sails (128); aim line shows the first bounce; par = best route + 2; stroke limit par + 4; speed full by 60 s | | 2 extra hazards a hole (a rock and a small bunker); par = best route; slopes 1.4 x; aim line 35 %; speed full by 24 s | the same 2 extras; par = best route; limit par + 2; fast sails (512); slopes 1.8 x; aim line 20 %; speed full by 22 s |

- **Why this curve:** Crazy golf is its obstacles: clearing them for Easy and crowding the line for Hard and Expert changes every putt in a way the green shows at once, where today's steps hide in the par rule and the slope strength and Easy looks identical to Normal.
- **Proof:** scripts/minigolf-holes-bank.ts re-searches all 360 holes at each level with the shot oracle (bestRouteV3 in scripts/minigolf-oracle.ts) and keeps a hole only if a route of par 2 to 5 exists on the level's build (src/lib/duel/minigolfHolesBank.server.ts); any five composed must score exactly 200 through the server replay (scripts/crazy-golf-v3-check.ts, 600 courses a level). The witness waits at least 0.4 s after the ball rests before each stroke and must hole all five inside the speed line.
- **Measured today:** 24 deals, human-limited bot: near-perfect 188.8 / 185.1 / 151.0 / 142.9; elite 191.6 / 191.7 / 163.0 / 145.5; average not documented
- **Stamp:** golfRev 4 on level deals (Normal stays golfRev 3): a hole is built from its id and level, so today's level builds must stay for stored rounds.
- **Files:** `src/lib/arcade/minigolfHolesV3.ts (two extra tiers per template, V3_LEVEL_BUILD)`, `src/lib/arcade/minigolf.ts (MG_LEVELS)`, `scripts/minigolf-holes-bank.ts`, `src/lib/duel/minigolfHolesBank.server.ts`, `scripts/minigolf-oracle.ts`, `scripts/crazy-golf-v3-check.ts`, `src/lib/levels/gameLevels.ts (the minigolf entry holds empty settings today)`
- **Risk:** two hazard tiers must be drawn by hand for 20 templates, and some of the 360 holes will lose their route at Expert and drop out

### Cue Ball (`pool`, Sports)

**Lever: Pocket width.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Corner pockets 20 px and middles 17 px (mouths about 38 px for a 16 px ball); only 2 of the other set on the table; long preview; a foul costs 5; the black opens at 5 of your 7. | poolRev 4: corner pockets 16 px and middles 14 px (balls 8 px), your 7 plus 4 of the other set and the black, preview 0.6 of the reach, a foul costs 10, 90 s | Corner pockets 13 px and middles 12 px (mouths about 25 px); all 7 of the other set on the table, 15 object balls; preview a quarter of the reach; a foul costs 10. | Corner pockets 11 px and middles 10 px (mouths about 21 px, 5 px wider than the ball); all 7 of the other set; ghost ball only; a foul costs 10. |
| First seconds | Big bucket pockets and a near-empty table | | Tighter pockets and a full rack of fifteen balls | Pockets barely wider than a ball, no aim line |
| Today | the same table; long aim preview; a foul costs 5; the black opens at 5 of your 7 | | the same table; preview a quarter of the reach; a foul costs 10 | the same table; ghost ball only; a foul costs 15 |

- **Why this curve:** Today's four levels are one table with a different guide line; pocket width is pool's own difficulty dial, and a fuller table adds the blocked lines and fouls that make each tight pot a real choice.
- **Proof:** Today every level reuses src/lib/duel/poolBankV3.server.ts and its 60 witnesses. Build a bank per level with scripts/pool-bank.ts (a --level flag) and the shot search in scripts/pool-oracle.ts on the level's pockets and rack: keep a layout only when a witness pots all seven and the black with no foul for exactly 200 through the server replay, each shot at least 0.4 s after the balls stop, inside the speed line; scripts/pool-levels-check.ts replays every witness.
- **Measured today:** 30 deals: elite 177 / 164 / 156 to 160 / 138 to 140; Normal average bot 84 (median); Easy average 117 (mean, 10 % at 175+); Hard and Expert average not documented
- **Stamp:** poolRev 5 on level deals (Normal stays poolRev 4): pocket geometry and the rack change the physics, and today's level rounds must still replay.
- **Files:** `src/lib/arcade/pool.ts (POOL_POCKETS and the jaws per level, poolLayout's other-set count)`, `src/lib/arcade/pool.renderer.ts (pockets drawn to the collision mouth)`, `scripts/pool-bank.ts`, `scripts/pool-oracle.ts`, `src/lib/duel/poolBankV3.server.ts (level banks beside it)`, `scripts/pool-levels-check.ts`, `scripts/pool-levels-tune.ts`
- **Risk:** narrow jaws in integer physics may rattle balls out, and the oracle may clear few 15-ball layouts with no foul

### Curl Champ (`curling`, Sports)

**Lever: Red stones in the house.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 1 red, 80 to 140 cm out; the stone's whole path shown; HOUSE zone; Stones full at 60. | curlRev 4: 3 reds 35 to 110 cm from the button, HOUSE zone, aim line for the first third, Stones full at 95, 8 stones, 120 s | 5 reds, 25 to 80 cm from the button; HOUSE zone kept; no aim line. | 7 reds, 15 to 60 cm, a ring round the button at least 35 cm apart; no HOUSE zone, no aim line. |
| First seconds | One red stone far from the button, the whole path drawn | | Five reds crowding the button, no aim line | Seven reds ringing the button, no guides at all |
| Today | 2 reds 60 to 130 cm from the button, the stone's whole path shown, HOUSE zone, Stones full at 60 | | 4 reds 30 to 90 cm, HOUSE zone, aim line for the first third | 5 reds 20 to 70 cm, no HOUSE zone, no aim line |

- **Why this curve:** A stone only scores when it beats every red in the house, so each extra red is another one to take out or out-draw with the same eight stones, and the count shows in the house before the first throw.
- **Proof:** bun scripts/curling-bank.ts --level=<l> with scripts/curling-oracle.ts: a sheet is kept only when the oracle clears every red and scores exactly 200 through the server replay at its level (src/lib/duel/curlingLevelBanks.server.ts, 30 sheets a level; with 5 reds Expert proved 56 of 90). Throws are set up at leisure, so HUMAN_LIMITS only bound the brushing (no tap within 0.15 s of the last); scripts/curling-levels-check.ts replays every witness.
- **Measured today:** each level's 30 sheets played twice: average 132 / 80 / 76 / 70; near-perfect 195 / 176 / 168 / 141; elite 196 / 188 / 183 / 146
- **Stamp:** curlRev 5 on level deals (Normal stays curlRev 4): the sim reads CURL_LEVEL_REDS from the level, so new counts need a stamp for stored rounds.
- **Files:** `src/lib/arcade/curling.ts (CURL_LEVEL_REDS, CURL_LEVEL_AIDS)`, `scripts/curling-bank.ts`, `scripts/curling-oracle.ts`, `src/lib/duel/curlingLevelBanks.server.ts`, `src/lib/levels/gameLevels.ts`, `scripts/curling-levels-check.ts`, `scripts/curling-levels-bands.ts`
- **Risk:** seven takeouts with eight stones may prove on too few sheets; six reds is the fallback

### Coral Pop (`bubble`, Strategy)

**Lever: Colours in the reef.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 3 colours, 75 bubbles, a descent every 10 shots, core full at 50 (average 157 to 164 and a third of runs earn a star). | bubbleRev 12: 5 colours, 86 bubbles in 9 rows, a descent every 8 shots, aim trail to the top, 90 s | 6 colours (the orange seahorse joins); 100 bubbles; one-bounce aim trail; a descent every 8 shots as Normal; parts full at the reef, 20 bank shots, a clear with 30 s left. | 7 colours (a new pink starfish with its own symbol); 110 bubbles; short 120 px trail; a descent every 8 shots; parts full at the reef, 10 bank shots, a clear with 30 s left. |
| First seconds | Three colours: big clusters everywhere | | Six colours, the reef two rows deeper | Seven colours speckled through a reef past half way |
| Today | 3 colours, 75 bubbles, a descent every 10 shots, two-bounce aim trail, core full at 50 | | 5 colours, 110 bubbles, a descent every 5 shots, one-bounce aim trail | 6 colours (orange seahorse), 110 bubbles, a descent every 7 shots, short 120 px trail |

- **Why this curve:** Colours are what make a bubble shooter hard, since each extra one shrinks the clusters and the chance the next bubble fits; the measurements agree: five-colour Hard moved nobody (elite 176 to 174) while six-colour Expert halved the average.
- **Proof:** No per-seed proof today: 200 is reached on some seeds only (Expert: elite 1 of 12). Write scripts/bubble-level-deal.ts: a dealt list per level (new src/lib/duel/bubbleLevelDeal.server.ts) keeping only seeds where a planning oracle that knows the seeded queue, firing no faster than one shot every 0.4 s (HUMAN_LIMITS), clears the reef and replays to exactly 200 through replayBubbleRun; scripts/bubble-levels-check.ts replays every witness.
- **Measured today:** 12 seeds under human limits: average bot 157 / 64 / 53 / 26; elite 195 / 176 / 174 / 159; flawless 196 / 184 / 183 / 171; elite clears 12 / 8 / 4 / 1 of 12
- **Stamp:** bubbleRev 13 on Hard and Expert deals (Easy and Normal stay bubbleRev 12): BUB_LEVELS is frozen with the stamp.
- **Files:** `src/lib/arcade/bubble.ts (BUB_LEVELS, a seventh colour value)`, `src/lib/arcade/bubble.renderer.ts (the seventh bubble)`, `scripts/bubble-level-deal.ts (new)`, `src/lib/duel/bubbleLevelDeal.server.ts (new)`, `scripts/arcade-skill-bands/bots/bubble.ts`, `scripts/bubble-levels-check.ts`
- **Risk:** a seven-colour reef may be clearable with 30 s left on very few seeds, so the planner and the speed line may both need work

### Rainbow Bridge (`inkbridge`, Strategy)

**Lever: Width of the pot.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: pot 110 px, a quarter of the birds, ink 150 %, nothing moves, clovers on the easy line (average 163 and 48 % of runs earn a star). | inkRev 15: pot 64 px, ink 125 %, today's birds, the pot moves from level 5, live levels 9 and 10, par margin 10 %, ten levels, 120 s | Pot 46 px; 3 extra birds on every level from level 1; ink 110 %; live levels, par margin and speed line as today's Hard. | Pot 34 px (the coin is 20 px); 5 extra birds on every level from level 1, 3 of them swaying on moving-pot levels; ink 100 %; live levels, par margin and speed line as today's Expert. |
| First seconds | A huge pot under an almost empty sky | | A pot two coins wide, birds strung across level one | A pot barely wider than the coin, a sky full of birds |
| Today | pot 110 px, a quarter of the birds, ink 150 %, nothing moves, par margin 25 %, speed full with 10 s left | | pot 48 px, 2 extra birds on levels 2 to 10, ink 110 %, live from level 8, speed full with 70 s left | pot 42 px, 2 to 3 extra birds, 3 swaying birds on levels 5 and 6, ink 100 %, live from level 7, par margin 0 % |

- **Why this curve:** The pot is the target every drawn line must end on, so shrinking it is the lever even strong players feel (the 16 Nov tuning found birds and ink alone moved nobody), while extra birds from the first level make the route itself harder and show the level at once.
- **Proof:** Per-level proved deals as today: bun scripts/ink-big-deal.ts --rev=16 --level=<l> keeps 60 seeds a level where every level is drawable within its ink and the oracle's run is exactly 200 through the server replay (src/lib/duel/inkHillsDealHard.server.ts and inkHillsDealExpert.server.ts). The builder does not apply HUMAN_LIMITS today: hold the witness to one input every 0.15 s and releases no sooner than 0.25 s after a level appears; scripts/ink-levels-check.ts replays the lists. Expert dropped 7 of 67 seeds at 42 px; expect more at 34 px.
- **Measured today:** dealt seeds: average bot 164 / 91 / 75 / 69; elite under human limits 200 / 190 / 183 / 166; oracle 200 on every entry
- **Stamp:** inkRev 16 on Hard and Expert deals (Easy and Normal stay inkRev 15): the sim reads INK_LEVEL_SETS, so stored level rounds need their old table.
- **Files:** `src/lib/arcade/inkBridge.ts (INK_LEVEL_SETS)`, `scripts/ink-big-deal.ts`, `src/lib/duel/inkHillsDealHard.server.ts, inkHillsDealExpert.server.ts`, `src/lib/levels/gameLevels.ts`, `scripts/ink-levels-check.ts`, `scripts/ink-levels-bands.ts`
- **Risk:** a 34 px pot that also moves may fail the drawable proof on the live levels

### Tilt (`tilt`, Strategy)

**Lever: Marbles steered at once.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | One marble on every maze (no amber marble); 3 mazes of 11, 13, 13 cells; holes 0, 1, 1; no ice; par 240 % (today's Easy without its two-marble maze). | tiltRev 12: 4 mazes of 13, 15, 17, 19 cells; holes 2, 3, 3, 0; ice 2, 3, 3, 0; two marbles on maze 3 only; par 150 %; 90 s | Two marbles from the first second on mazes 1, 2 and 3 (maze 4 single); 5 holes a maze, now allowed in pockets one cell off the route; ice and par as today's Hard (3 to 4 patches, 135 %). | Two marbles on all four mazes; 8 holes a maze, pockets beside the route included; ice and par as today's Expert (5 patches, 115 %). |
| First seconds | One blue marble, wide corridors, no holes on maze one | | Two marbles and two cups from the first maze | Two marbles and holes peppered along the path |
| Today | 3 mazes of 11, 13, 13 cells; holes 0, 1, 1; no ice; two marbles on maze 3; par 240 % | | 4 mazes of 15, 15, 17, 19; holes 3, 4, 4, 4; ice 3, 3, 4, 4; two marbles on 2 of mazes 2 to 4; par 135 % | 4 mazes of 15, 17, 19, 19; 4 holes and 5 ice patches each; two marbles on 2 or 3 of mazes 2 to 4; par 115 % |

- **Why this curve:** One tilt moves every marble, so a second marble doubles what you must watch from the first second, and holes beside the route finally punish a slip; today's extra holes sit in dead ends two cells off the route, where a careful player never meets them.
- **Proof:** Per-level proved deals as today: bun scripts/tilt-deal.ts --level=<l> keeps a seed only when scripts/tilt-oracle.ts plays every maze inside par with no fall and replays to exactly 200 through replayTiltRun (src/lib/duel/tiltDealLevels.server.ts; today Hard keeps 119 and Expert 111 of 150). The oracle is not held to the limits today: run it with the bot's TILT_HUMAN_LIMITS rule (0.25 s from eye to hand, a new decision every 0.15 s at most) and drop seeds that fail; scripts/tilt-levels-check.ts replays every witness.
- **Measured today:** 40 deals: average bot 150 / 83 / 77 / 61; elite 199 / 166 / 149 / 142; elite under human limits 193 / 144 / 141 / 121
- **Stamp:** tiltRev 13 on level deals (Normal stays tiltRev 12): the sim reads TILT_LEVELS and the hole placement rule.
- **Files:** `src/lib/arcade/tilt.ts (TILT_LEVELS, buildMazeX's hole rule)`, `scripts/tilt-deal.ts`, `scripts/tilt-oracle.ts`, `src/lib/duel/tiltDealLevels.server.ts`, `src/lib/levels/gameLevels.ts`, `scripts/tilt-levels-check.ts`, `scripts/tilt-levels-bands.ts`
- **Risk:** Normal's own elite is 144 under human limits, so Hard and Expert will sit near 120 and 95, under the guide; the bots never fall, so the holes need a playtest

### Ball Tracker (`balltrack`, Strategy)

**Lever: Marble colours and cups.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 3 colours and 3 cups; 16 marbles, one every 3.2 s; the cups never move; combos full at 10 (today's Easy with one colour fewer). | btRev 8: 4 colours and 4 cups in 7 columns; 36 marbles, one every 1.4 s; 2 cup moves; 6 gold; 3 boosters; 60 s | 5 colours and 5 cups (a purple star joins); 40 marbles, one every 1.3 s; 4 cup moves; 6 gold; 3 boosters. | 6 colours and 6 cups in the 7 columns (an orange cross joins); 42 marbles, one every 1.2 s; 8 cup moves; 6 gold; 2 boosters. |
| First seconds | Three cups, three colours, a marble every three seconds | | Five cups along the bottom, a purple marble in the queue | Six cups in seven columns, six colours in the hopper |
| Today | 4 colours and cups; 16 marbles, one every 3.2 s; the cups never move; 7 gold; 4 boosters; combos full at 10 | | 4 colours; 42 marbles, one every 1.2 s; 8 cup moves; 7 gold; 3 boosters | 4 colours; 42 marbles, one every 1.1 s; 12 cup moves; 7 gold; 2 boosters |

- **Why this curve:** Today's four levels show the same board and Hard and Expert score the same for an average player (51 and 50); each extra colour is another cup to route to, so the turns per marble grow with a count the queue and the cups show before the first drop.
- **Proof:** bun scripts/balltrack-level-deal.ts --level=<l> builds 60 courses a level and keeps one only when the boosted oracle (scripts/arcade-standard/balltrack.ts) scores exactly 200 through the server's encode and replay. That oracle is not held to the limits today and no bot reaches 200 on Expert: run it with the bot's BT_HUMAN_LIMITS rule (no tap within 0.15 s of the last, an off-route marble noticed after 0.25 s) and drop courses that fail; scripts/balltrack-levels-check.ts replays each witness.
- **Measured today:** 30 courses under human limits, medians: average bot 164 / 91 / 51 / 50; near-perfect 200 / 190 / 160 / 120; elite 200 / 195 / 177 / 151; no bot reaches 200 on Expert
- **Stamp:** level field only: a level's course is stored whole on the puzzle and can carry its own colours beside drop and moves, so stored level rounds keep their own course.
- **Files:** `src/lib/arcade/ballTrack.ts (colours per course, BT_PALETTE to six)`, `src/lib/arcade/ballTrackArt.renderer.ts (two new marbles and cups, each with its own symbol)`, `scripts/balltrack-level-deal.ts`, `src/lib/duel/ballTrackDealEasy.server.ts, ballTrackDealHard.server.ts, ballTrackDealExpert.server.ts`, `scripts/arcade-standard/balltrack.ts (the oracle)`, `scripts/balltrack-levels-check.ts`, `scripts/balltrack-level-bands.ts`
- **Risk:** the oracle's search grows with six cups (Expert's list took 25 min with four), and a limited oracle may fail many six-colour courses

