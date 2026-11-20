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

1. **Counterweight, Brimful, Checkout and Kakuro: a Hard you can see.** On 15 Nov you chose to keep the older game as their Hard. Measured on 20 Nov (96 deals a game, the same seeds at both levels, the repo's four kits through the server's own grade): that Hard's first board is the same as Normal's on all four, so nothing shows in the first seconds. It is not the same difficulty, though, and my first version was wrong to say it "scores like Normal": the good kit drops 24 (Counterweight), 87 (Brimful), 37 (Checkout) and 61 (Kakuro) points, and Counterweight's average kit drops 70. The person-like solver finishes 81 of 96 old-Hard Kakuro boards (my "a quarter cannot be finished" was also wrong: it is 15 of 96). **Recommendation, unchanged in substance: keep the older game's difficulty where it is good and put a visible step on top, as each game's row says.**
2. **Iron Wall: Expert becomes four lanes** (9 tanks a wave), on bastionRev 3's aim settings. That replaces the 15 Nov ruling that Expert is bastionRev 3's game unchanged. Measured on 20 Nov (60 room seeds a level): today's Hard and Expert put the same tanks on the same lanes at the same moments on 60 of 60 seeds, so the first five seconds look alike; the average bot scores 104 and 84, the elite bot under the human limits 161 and 146. A faster pace alone, tried in memory, changes neither the look nor the gap (average 91, elite 148). The fourth lane itself is not measured: it needs sim code. **Recommendation: yes; a lane is a step a player sees at once, and the fourth lane is your own example of a natural mechanic.**
3. **200 must be reachable, and on some games it is not today, at any level.** Under the human limits the scoring itself caps the best possible run: Flash at exactly 130 on every level (measured 20 Nov: a 250 ms tap pays 115 plus 15 for steadiness), Bonk at 156 (153 on Expert) (the quick window closes at 267 ms), Home Run's perfect streak (the exact tick) at 0 % of Hard and Expert innings, Matchmaker's extras (perfect memory still misses about 11 first looks), Tenfall's Easy at 196, and no Hard or Expert Nucleus board (and 7 of 12 Expert Forage boards) holds 200 points of words. Five Hands has no 200 proof at any level. **Recommendation: fix each on the level deals only** (a scoring stamp or a deal rule that Easy, Hard and Expert carry; Normal untouched), as each game's row says. Whether Normal's own curve should follow later is a separate scoring decision (Flash `tapRev 8`, Bonk `whackRev 5`, Pull! `clayRev 11`).
4. **Proofs to build.** My first version said no tool applies `HUMAN_LIMITS` today. That was wrong. `scripts/level-tune.ts --human-limits` measures under them, `scripts/home-run-top-bins-expert-proof.ts` proves under them, and the level checks for the Speed games, Apex, Gemstone, Ball Tracker, Coral Pop, Home Run and Top Bins assert results under them; the Logic levels assert a person-style solver finishes every Expert board. What is true is narrower: most deal and bank builders prove 200 with a frame-exact oracle; most checks under the limits assert "scores well", not "reaches 200"; nothing applies the limits to any Word game; Breaker, Rally, Meteor and Pinball have no oracle at all; the Logic person-style solver has no clock. Each game's row now says what applies the limits to it today. **Recommendation, unchanged: every difficulty session's first job is its proof under the limits, before any number is tuned.**
5. **Minefield's Expert goes back to 10 × 16** (40 mines, dealt from a proved bank): today's 12 × 18 draws squares at about 31 px on a phone, under the 36 px floor. The first version said 36 mines; measured, 36 left the average player only 17 points below Hard, and 40 gives 93 against Hard's 129 with the elite still reaching 200.

## Every game at a glance

What the player sees in the first seconds at each level.

| Game | Group | The lever | Easy | Hard | Expert | Basis (E / H / X) |
|---|---|---|---|---|---|---|
| Nucleus | Word | Shortest word that counts | A 3+ LETTERS badge on a full ring; short words score. | A 5+ LETTERS badge on a bigger ring; four-letter words bounce. | A 6+ LETTERS badge on the biggest ring of eleven letters. | measured / measured / measured |
| Interlock | Word | Tiles in the tray | Ten tiles and a small 6 by 6 board with big squares. | Nineteen tiles in three tray rows; a bigger 8 by 8 board. | Twenty-three tiles, a 9 by 9 board, and no word lights. | not measured / not measured / not measured |
| Slider | Word | Grid size | A small 4 by 4 grid with its four target words listed. | A 6 by 6 grid: 36 tiles and six longer words. | A 7 by 7 grid: 49 tiles and seven 7-letter words. | not measured / not measured / not measured |
| Forage | Word | Shortest word that counts | Goal line says 3+ letters; three-letter traces score at once. | Goal line says 5+ letters; a four-letter trace bounces. | Goal line says 6+ letters; only three free misses shown. | measured / measured / measured |
| Lookout | Word | Words to find | A small 8 by 8 grid, big letters, five words. | A taller 10 by 12 grid and eight word chips. | Ten word chips in three rows under the tall grid. | measured / not measured / not measured |
| Roundabout | Word | Words in the crossword | Six letters on the wheel and a small crossword. | A crossword of 16 to 19 words fills the top half. | Eight letters on the wheel under a 20-word-plus crossword. | measured / measured / not measured |
| Strikeout | Word | Starting letters per word | Four letters of the first word already showing; 14 strike dots. | One letter showing in each word; two vowel dots. | Every tile blank; two vowel dots; a 70-second clock. | measured / measured / measured |
| Cryptogrid | Word | Grid size | A small 5 by 5 grid, half its letters already in. | A bigger 8 by 8 grid with about 20 numbers. | A 9 by 9 grid with only four letters showing. | not measured / not measured / not measured |
| Swapword | Word | Loops of crossing words | Seven to nine of the 21 tiles already gold. | Three loops of words: 30 tiles on a bigger board. | A window of 33 tiles in six 7-letter words. | measured / not measured / not measured |
| Counterweight | Number | Beam length and weights to hang | A short six-notch beam and two light weights | A long ten-notch beam with two weights already hung | Ten notches, three weights to hang, no balance readout | measured / measured / measured |
| Exact | Number | Targets to hit in the round | A two-digit target | "Target 1 of 2" and two stage pips | "Target 1 of 3" and three stage pips | measured / not measured / not measured |
| Operator | Number | Gaps to fill per equation | A short sum with one empty circle | Four numbers and three empty circles | Five numbers, every sign missing, a tray of tiles | measured / measured / measured |
| Integer Pyramid | Number | Rows and empty stones | A tiny three-row pyramid with two gaps | Five rows almost empty, a tray of 14 stones | Six rows almost empty, three-digit stones | not measured / measured / not measured |
| Brimful | Number | Jugs on the bench, tap removed | Two jugs and a tap, "Par 2" | Three jugs on the bench | Three jugs, no tap, the big one full | measured / measured / measured |
| Checkout | Number | How strange the dartboard is | A normal dartboard and three small targets | Odd numbers up to 60 round the board | Odd numbers, red minus wedges, "exactly 3 darts" | measured / measured / measured |
| Ballpark | Number | Marks on the ruler | Every tick on the ruler carries its number | Only three ticks: the quarters | A bare ruler with one middle tick | not measured / not measured / not measured |
| Kakuro | Number | Size of the grid | A small grid with about ten white squares | A wider grid, seven squares across | The full 7 × 7 grid, 27 squares to fill | measured / not measured / measured |
| Flash | Speed | Trap flashes before each gold | A calm dark glass; the first gold arrives within three seconds. | Trap colours fire about once a second from the start. | The glass flickers twice a second, nearly all gold look-alikes. | measured / measured / measured |
| Ascend | Speed | Numbers on the board | Sixteen big discs, 1 to 16, that never move. | Thirty-two discs crowd the board; the clock bar is short. | Forty discs fill the board; the goal says highest first. | measured / measured / measured |
| Eagle Eye | Attention | Eagles in each grid | Sixteen big eagles, and nothing that nearly matches. | Thirty-six eagles in the first grid, sixty-four in the last. | Eighty eagles a grid and two facings to find. | measured / measured / measured |
| Double Take | Attention | Shapes in each picture | Two small pictures of twenty big sweets. | Fifty-six sweets a picture and only three misses allowed. | The lower picture is a mirror image of the upper. | measured / measured / not measured |
| Tally | Attention | Shapes on the tray | Fifteen big shapes; count one colour. | Eighty shapes on the first tray, counts into the twenties. | A packed tray of 110, two colours, no marks. | measured / measured / measured |
| Labyrinth | Attention | Steps to walk | A small maze with wide corridors. | A fine maze with two gold keys and a locked exit. | Four keys in four corners; par above 320. | measured / not measured / not measured |
| Bomb Defusal | Attention | Steps and clues on the card | Five wires and a four-line card. | Eight wires and a card of eight or nine clues. | No Reset button: one wrong step sets it off. | measured / measured / measured |
| Don’t Break the Chain | Speed | Charms in the cycle | Four charms in the strip and a spare-link pip. | Six charms in the strip, and 0 / 48 links. | Seven charms in the strip, and 0 / 56 links. | not measured / measured / measured |
| Matchmaker | Attention | Cards on the board | Sixteen big cards. | Forty-two cards, six across and seven down. | Fifty-six small cards fill the whole screen. | measured / measured / measured |
| Bonk | Speed | Burrows on the lawn | A 3 by 3 lawn of nine big burrows. | A 5 by 5 lawn: 25 burrows, four gophers up. | A 6 by 6 lawn: 36 burrows, five up at once. | measured / measured / measured |
| Tenfall | Speed | Size of the targets | Target 10, slow tiles, only numbers and minus. | Target 40 or more at once; gold ×2 tiles everywhere. | Target 150 or more straight away, climbing to 400. | measured / measured / measured |
| Pull! | Speed | Clays in the air together | One slow clay at a time in a big ring. | Two fast clays cross on the very first pull. | Three clays at once among a sky of birds. | measured / measured / measured |
| Gridlock | Pattern | Lot size and cars | A small, half-empty lot with the gold car nearly out | A bigger 8×8 lot packed with fifteen or more cars | A 9×9 lot, wall to wall with over twenty cars | measured / measured / not measured |
| Tessellate | Pattern | Board size and pieces | A tiny 5×5 board and four little pieces | A bigger 8×8 board with eleven pieces in the tray | A 9×9 board and thirteen pieces, two of them new | measured / measured / not measured |
| Pipeline | Pattern | Tiles on the board | A small 5×5 board with many pipes already joined | A taller board of 72 tiles, nearly all turned | Tiles to the bottom of the screen and no leak marks | not measured / not measured / documented |
| Box Six | Logic | Numbers given at the start | More than half the grid already filled in | Only ten or eleven numbers on the grid | Eight or nine numbers, and a Check button | documented / not measured / not measured |
| Chroma Lines | Pattern | Board height and pairs | A small 6×6 board with five or six pairs | A taller board with more coloured dots than Normal | Dots in fourteen colours fill the screen top to bottom | measured / measured / measured |
| Skid | Pattern | Holes and thin ice | A small rink with rocks only and no holes | Twice Normal's holes dotted across the rink | A taller rink riddled with ten or more holes | not measured / not measured / not measured |
| Heave | Pattern | Crates to push home | Three crates in an open room | Six crates and six marks between tighter walls | Seven crates crowd a walled-in warehouse | documented / not measured / not measured |
| Lightbender | Pattern | Bombs on the board | One or two bombs and five shots | Twice Normal's bombs between the gems | Bombs everywhere, an exact tray and two shots | documented / not measured / not measured |
| Hanoi | Logic | Rings on the posts | Four posts and a short stack of seven | Three posts, ten rings and no spare post | Twelve rings stacked to the top of the posts | documented / not measured / not measured |
| Polypotions | Logic | Flasks and colours | Six short flasks in four colours | Twelve flasks and ten colours, all on show | Fourteen flasks with grey question marks under every top layer | documented / not measured / not measured |
| Safe Cracker | Logic | Dials on the safe | Three dials and five plain clues | Five dials that run to 20 and seven clues | Six dials, nine clues, one try | documented / not measured / not measured |
| Topsy-Turvy | Pattern | Balls on each board | Three balls, three cups, two boards | Eight balls rolling at once | Ten balls and ten cups crowd the board | documented / not measured / not measured |
| Mosaic | Logic | Picture size | A small 6×6 picture with short clues | A taller 9×11 picture, half as big again as Normal | A picture fourteen rows deep, down to the buttons | documented / documented / documented |
| Colour Flood | Logic | Board size and colours | A small board in four colours | A board half as tall again, in six colours | Seven colours, stones in the way, a screen-high board | documented / not measured / not measured |
| Minefield | Logic | Mines on the board | A small board, a third of it already open | Mines 26 on the counter and a small opening | Mines 40 and only a handful of squares open | measured / measured / measured |
| Tents and Trees | Logic | Board height and trees | A short board with every count shown | Two more rows, more trees, half the counts blank | Thirteen rows and over twenty trees | documented / not measured / not measured |
| Shikaku | Logic | Board height and rectangles | A short board with small numbers | Two more rows and numbers up to 16 | Fifteen rows deep, with a 20 on the board | documented / not measured / not measured |
| Lamplighter | Logic | Board height and walls | A short board with most walls numbered | Two more rows and most walls blank | Fourteen rows of dark squares and few numbers | documented / documented / not measured |
| Trail | Logic | Board size | A small board: 1 to 25 | A 7×7 board: 1 to 49 | An 8×8 board: 1 to 64 | not measured / not measured / not measured |
| Loopline | Logic | Board size | A small 5×5 grid, more than half the squares numbered | An 8×8 grid, almost twice Normal's squares | A tall 8×10 grid with wide blank patches | documented / documented / not measured |
| Regions | Logic | Board size | A small grid with half its numbers given | An 8×8 grid, three squares in four blank | A 9×9 grid, four squares in five blank | documented / not measured / not measured |
| Island Link | Logic | Islands to link | Eight islands on a small sea | About twenty islands, nearly twice Normal's | Nearly thirty islands down a taller sea | documented / documented / not measured |
| Hover | Retro | Height of the barrier gaps | Gaps a quarter taller than Normal's from the first barrier | First gap a fifth narrower, the saucer has no shield | A gap two thirds the size, already sliding up and down | not measured / not measured / not measured |
| High Rise | Action | Width of the blocks | A block two thirds of the screen wide, sliding very slowly | A block barely half Normal's width | A block a quarter of Normal's width, the wind flag waving | measured / measured / measured |
| Breaker | Retro | Rows of bricks in the wall | A short six-row wall above a wide paddle | Two more rows, two already sliding, a narrower paddle | Twelve rows, four sliding, a paddle barely a brick wide | measured / measured / measured |
| Pinball | Retro | Flipper length and the drain gap | Long flippers that almost meet, four balls | Shorter flippers, a drain two and a half balls wide | Stubby flippers, a three-ball drain, two balls | not measured / not measured / not measured |
| Blockzone | Retro | How fast the pieces fall | The first piece drifts down, five next pieces shown | The first piece falls four times as fast, two previews | The piece hits the floor in about two seconds, one preview | measured / measured / measured |
| Rally | Retro | Width of the paddle | A paddle 40 % of the court wide, no bumpers | A paddle two fifths narrower, two bumpers already on court | A paddle two fifths of Normal's width, two bumpers, one life | measured / measured / measured |
| Tempo | Retro | Number of lanes | Three wide lanes, notes far apart | Five lanes from the first bar | Six narrow lanes, notes falling in one second | not measured / not measured / not measured |
| Meteor | Retro | Rocks on the field | An open field with no rocks at all | Eight rocks already down, walls round the field | Sixteen rocks, walls, a quicker comet, one life | measured / measured / measured |
| Spacewalk | Retro | Traffic on the first crossing | Half Normal's ships, long empty gaps in every lane | Two thirds more ships than Normal on the first crossing | Over twice Normal's ships, each a quarter faster | not measured / not measured / not measured |
| Moon Climb | Action | Blades on the walls | About one blade on the first screen | Blades on both walls from the first leap | Blades and ice on every stretch, faster shurikens | measured / measured / measured |
| Wavefront | Retro | Enemy bolts in the air | A single slow bolt at a time, four lives | Bolts fall in pairs from the first volley | Triple volleys, a ship diving within seconds, two lives | not measured / not measured / not measured |
| Iron Wall | Action | Tanks in each wave | Four tanks roll in on a quiet three-lane road | A fourth lane, eight tanks in the first wave | Four lanes, nine tanks a wave, rolling in 40 % faster | not measured / not measured / not measured |
| Roofbound | Action | Running speed | The cave scrolls at three quarters of Normal's pace | Over a third faster from the first step | Nearly twice Normal's pace, spikes already moving | not measured / not measured / not measured |
| Fission | Retro | Atoms in each wave | One small atom, drawn a quarter bigger | Two atoms bouncing in the opening wave | Three atoms at once from the start, two lives | not measured / not measured / not measured |
| Orbit | Action | Asteroid belts round the planets | Bare planets, no rock belts, no checkpoint button | A rock belt round the second planet on screen | Every planet ringed with rocks, no checkpoint button | not measured / not measured / not measured |
| Grappler | Action | How soon the pterodactyl chases | No pterodactyl, every vine hanging still, all lit | A pterodactyl warning from the first vine, vines sliding | The pterodactyl warning twice as close and closing faster | not measured / not measured / not measured |
| Gemstone | Strategy | Frozen cells on the board | Five colours, a handful of frozen squares, a hint after three seconds | A seventh gem, the cyan heart, and 18 frozen squares | Ice over 28 squares: two thirds of the lower board | measured / measured / measured |
| Mahjong Solitaire | Cards & Board | Tiles in the stack | A low two-layer stack of big tiles, a Hint button | A wider, taller stack: 104 smaller tiles | The full set: 136 small tiles wall to wall | not measured / not measured / not measured |
| Home Run | Sports | Pitch speed | A slow lob, small catch circles, five outs on the board | A fastball a fifth quicker, catch circles a third bigger | Heat at the human limit, catch circles closing every gap | measured / measured / measured |
| Top Bins | Sports | Players in the wall | Two men in the wall, a calm flag | A five or six man wall and a stiff wind flag | Seven in the wall, wind 8, half the goal hidden | not measured / not measured / not measured |
| Apex | Sports | Road width | A wide road with braking points and a racing line painted | A visibly narrower road, no racing line | A lane under three cars wide between gravel traps | measured / measured / measured |
| Free Cell | Cards & Board | Free cells | Five free cells over four short rows, a Hint button | Three free cells over a full 52-card table | Only two free cells, court cards everywhere, Undo (3) | documented / not measured / not measured |
| Summit | Cards & Board | Seconds on the clock | A slow 90 second bar, glowing cards, an Undo button | The timer bar draining faster, a stock of 18, no glow | 35 seconds, a thin stock of 14, nothing glows | not measured / not measured / not measured |
| Five Hands | Cards & Board | Seconds per card | The next two cards shown, a long 90 second bar | 42 seconds for 20 cards: the bar visibly racing | 30 seconds: a card down every second and a half | measured / measured / measured |
| Thirteen | Cards & Board | Rows in the pyramid | A short six-row pyramid over a thick stock, pairs glowing | A taller eight-row pyramid, a thin stock, no glow | Nine rows edge to edge, seven cards in the stock | not measured / not measured / not measured |
| Crazy Golf | Sports | Hazards on each hole | Clean greens: no sand, no water, slow windmills | Bunkers, a pond and a boulder across the line | Sand and water everywhere, sails at double speed | not measured / not measured / not measured |
| Cue Ball | Sports | Pocket width | Big bucket pockets and a near-empty table | Tighter pockets and a full rack of fifteen balls | Pockets barely wider than a ball, no aim line | measured / measured / measured |
| Curl Champ | Sports | Red stones in the house | One red stone far from the button, the whole path drawn | Five reds crowding the button, no aim line | Seven reds ringing the button, no guides at all | not measured / not measured / not measured |
| Coral Pop | Strategy | Colours in the reef | Three colours: big clusters everywhere | Six colours, the reef two rows deeper | Seven colours speckled through a reef past half way | documented / not measured / not measured |
| Rainbow Bridge | Strategy | Width of the pot | A huge pot under an almost empty sky | A pot two coins wide, birds strung across level one | A pot barely wider than the coin, a sky full of birds | documented / not measured / not measured |
| Tilt | Strategy | Marbles steered at once | One blue marble, wide corridors, no holes on maze one | Two marbles and two cups from the first maze | Two marbles and holes peppered along the path | measured / measured / measured |
| Ball Tracker | Strategy | Marble colours and cups | Three cups, three colours, a marble every three seconds | Five cups along the bottom, a purple marble in the queue | Six cups in seven columns, six colours in the hopper | not measured / not measured / not measured |

## Word (session D1)

### Nucleus (`wordsmith`, Word)

**Lever: Shortest word that counts.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Words of 3+ letters count, and every word scores as two letters longer (3 letters 2 points, 4 letters 4, 5 letters 7, 6 letters 11, 7 or more 15). Ring of 9-10 letters with 45-85 everyday 4+ words, as today. 120 s. A first word inside 10 seconds. | 8-11 letter ring, 17-87 everyday words (median 37), words of 4+ letters, 100 s, wordsmithRev 5 | Words of 5+ letters only. Ring of 10-11 letters holding 20-35 everyday words of 5+ letters and at least 140 word points with the every-tile word. 75 s (Normal 100 s). Normal's points table. | Words of 6+ letters only. Ring of 11 letters holding 12-20 everyday words of 6+ letters and at least 140 word points in 6+ letter words with the every-tile word. 65 s. |
| First seconds | A 3+ LETTERS badge on a full ring; short words score. | | A 5+ LETTERS badge on a bigger ring; four-letter words bounce. | A 6+ LETTERS badge on the biggest ring of eleven letters. |
| Today | 9-10 letter ring, 45-85 everyday words, words of 4+ letters, 120 s | | 8-9 letter ring, 16-24 everyday words, 4+ letters, 65 s | 8 letter ring, 10-14 everyday words, 4+ letters, 50 s |
| **Evidence** | measured: 16 of today's Easy rings, 3-letter everyday words added, scored in memory on the live curve. One letter longer: average kit 87 (Normal 70). Two letters longer: average 131, good 153, near-perfect 180, elite 200 (10 of 16 at 200). | | measured: 24 rings of 10-11 letters in the band (24 of 152 tried), 75 s, list filtered to 5+; kit hunting only 5+ words: average 78, near-perfect 170, elite 194, best 198; kit reading every word, only 5+ counting: average 4, elite 152. | measured: 24 rings of 11 letters in the band (24 of 155 tried), 65 s, list filtered to 6+; hunting only 6+ words: average 107, elite 194, best 199; reading every word: average 0, elite 115. 200 typed at the limits in 22-37 s on all 24, with bonus words. |

- **Why this curve:** Long words are the whole skill of an anagram ring, so raising the shortest word that counts makes each level harder from the first try, while a bigger ring keeps a 200 on the board, which today's sparse Hard and Expert boards cannot hold.
- **Fact-check verdict:** adjusted: Easy's words score as two letters longer, not one (one left the average kit 17 above Normal, two gives 131 against 70); Hard and Expert stay unproven, because the kit has no cost for word length and puts Expert anywhere from 0 to 107 for an average player (re-check: 0 of 24 Hard and 0 of 24 Expert boards dealt today can reach 200).
- **Human limits today:** Nothing. scripts/level-tune.ts:163 sends puzzles to tunePuzzle (:85), which ignores --human-limits; scripts/wordsmith-levels-check.ts:70 pins only the kit's near-perfect mean (the kit takes 5 s a word, kits-word.ts:101), with no 200 witness and no typing time.
- **Proof:** An open word find, so the proof is a witness. To write: scripts/wordsmith-level-bank.ts (or a filter in src/lib/duel/levels/wordsmith.server.ts) keeps a board only when a list of its allowed words reaches 140 points plus the every-tile word, typed inside the clock at 0.25 s a word and 0.15 s a tap (HUMAN_LIMITS). Measured: of 155 sampled 11-letter rings 126 hold 140 or more points in 6+ letter words and 24 also sit in the 12-20 everyday band; on those 24 the witness types in 22-37 s, but it needs bonus words (everyday 6+ words alone reach 200 on none). scripts/wordsmith-levels-check.ts re-proves the witness on every dealt board and that a 4-letter word is refused on Hard.
- **Measured today:** Check bands, near-perfect mean: E 155-182, N 145-168, H 128-155, X 110-138. Kit medians, 12 seeds, read-only run for this plan (average / good / near-perfect): E 75 / 112 / 158, N 54 / 92 / 141, H 30 / 75 / 150, X 22 / 54 / 141. On the same seeds Hard boards hold 40-102 word points in the whole dictionary and Expert boards 36-61; 200 needs 140 points plus the every-tile word, so no Hard or Expert board dealt today can reach 200.
- **Stamp:** Level field plus a stored minLength on the level's puzzle (absent = 4, so Normal and every stored round are unchanged); Easy's 3-letter point and step-up table are read from the same field. No new Normal stamp.
- **Files:** `src/lib/levels/word/wordsmith.ts`, `src/lib/duel/levels/wordsmith.server.ts`, `src/lib/duel/wordsmith.server.ts`, `src/lib/duel/types.ts`, `src/components/puzzles/WordsmithPuzzle.tsx`, `scripts/wordsmith-levels-check.ts`
- **Risk:** measured: when the kit hunts only long words the rich rings outscore Normal at every skill (average 78 on Hard and 107 on Expert against 70), so no clock holds them below it until a length-aware player model exists to tune against

### Interlock (`tilegrid`, Word)

**Lever: Tiles in the tray.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 10 tiles: two crossing everyday words of 5 and 6 letters, on a 6 by 6 board with bigger squares. 120 s. Live word lights and red runs as today. | 15 tiles, an H of three 4-7 letter words, 7 by 7 board, 100 s, tileGridRev 4 | 19 tiles: four crossing words of 5-6 letters, on an 8 by 8 board. 90 s (Normal 100 s). | 23 tiles: five crossing words of 5-6 letters, on a 9 by 9 board (38 px squares at 390 px, close to the 36 px floor). 90 s. Words light and bad runs show only on Done. |
| First seconds | Ten tiles and a small 6 by 6 board with big squares. | | Nineteen tiles in three tray rows; a bigger 8 by 8 board. | Twenty-three tiles, a 9 by 9 board, and no word lights. |
| Today | 15 tiles on the 7 by 7 board, down words start on the across word, 120 s | | 15 tiles, 7-letter across word crossed mid-word, 60 s | 15 tiles, as Hard with crossings off the across word's ends, 50 s |
| **Evidence** | not measured: 10 tiles on 6 by 6 needs a tile count and board the shared rules fix (TG_SIZE 7, TG_TILES 15, src/lib/duel/tileGrid.ts:12-14); the grader, the kit and the level builder all read them. | | not measured: the level builder makes only a three-word H of 15 tiles and layout refuses anything wider than 7 (tileGrid.server.ts:47), so a 19-tile, four-word grid cannot be built or graded in memory. | not measured: 23 tiles on 9 by 9 cannot be built, encoded or graded today. By the kit's own constants (14 s a word, 1.2 s a tile) five words and 23 tiles take a good player about 98 s and the elite about 34 s; an estimate, not a run. |

- **Why this curve:** An anagram crossword gets harder the way Bananagrams does, with every extra tile and word in the rack, and a fuller tray on a bigger board shows that before a tile is touched, where today's crossing rules cannot be seen at all.
- **Fact-check verdict:** unproven: none of the three levels can be dealt or graded without new generator and grader code, so nothing was run.
- **Human limits today:** Nothing. scripts/tilegrid-levels-check.ts:69-74 asserts only kit averages (near-perfect 190+, great stepping down, 14 s a word and 1.2 s a tile, kits-word.ts:287); there is no person-like builder and no timed witness.
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
| **Evidence** | not measured: a 4 by 4 grid cannot be dealt; WS_SIZE 5 is fixed in src/lib/duel/wordSlide.ts:10 and read by the scramble, the par search and the grader. | | not measured: scripts/slider-human.ts cannot take a size. Nearest: today's 7-slide 5 by 5 boards with 100 s set in memory, 8 boards: elite average 123, 4 finished, best 185 (Normal 140.4, today's Hard 108.9). | not measured: 7 by 7 cannot be dealt or played by the person-like solver. Nearest: today's 8-slide 5 by 5 boards with 100 s set in memory, 8 boards: elite average 75, 1 finished, best 189 (today's Expert at 50 s: 89.0, 4 of 24 finished). |

- **Why this curve:** The grid is the only thing a player can see change in a slide puzzle, and each size up adds a row, a column and longer words to hold in mind, so 16, 25, 36 and 49 tiles read as one ladder where today's four levels look the same.
- **Fact-check verdict:** unproven: the person-like solver and every Slider rule are fixed to 5 by 5, so whether bigger grids play harder could not be measured; on 5 by 5 the proposed Hard's depth and clock leave the elite solver only about 17 under Normal, so the grid size would have to do nearly all the work.
- **Human limits today:** scripts/slider-human.ts:29-32 plays under its own limits (elite 2.0 s to plan and 0.35 s a slide, three slides ahead), not HUMAN_LIMITS; wordslide-levels-check.ts:112 asserts the elite solver finishes at least 2 of 24 Expert boards with a best of 180+, and :85 that the stored par line at 0.4 s a slide scores 200.
- **Proof:** Par is proven on every board by the two-way search (wordSlideDistance, src/lib/duel/wordSlideDistance.server.ts) and kept at 7 or under on the bigger grids so a grade costs no more than today's depth 8. Hard and Expert deal from a new bank (scripts/slider-level-bank.ts, to write) holding only boards scripts/slider-human.ts, made size-aware, finishes inside the clock at its elite setting without reading the stored words. Today that solver finishes only 4 of 24 Expert boards, so today's Expert is not proven. Any real words in the rows still count (open by design).
- **Measured today:** Person-like solver (scripts/slider-human.ts), 24 boards a level, average score and finishes, strong / elite: E 114.0 (13) / 200 (24); N 76.3 (4) / 140.4 (15); H 57.7 (2) / 108.9 (9); X 41.0 (0) / 89.0 (4, best 189). The kit follows the stored line and scores about 200 at every level.
- **Stamp:** wordSlideRev 7 on level deals only: the grid size is stored on the puzzle and slide tokens take rows and columns 0-6. Normal stays wordSlideRev 6 on 5 by 5.
- **Files:** `src/lib/levels/word/wordslide.ts`, `src/lib/duel/levels/wordslide.server.ts`, `src/lib/duel/wordSlide.ts`, `src/lib/duel/wordSlide.server.ts`, `src/lib/duel/wordSlideDistance.server.ts`, `src/puzzles/wordSlide.tsx`, `scripts/slider-human.ts`, `scripts/wordslide-levels-check.ts`
- **Risk:** a bigger grid leaves more of each word intact per slide, so 6 by 6 and 7 by 7 must be measured with the size-aware solver first; the fallback is today's depth and clock on 5 by 5 with only Easy changed

### Forage (`wordhunt`, Word)

**Lever: Shortest word that counts.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Words of 3+ letters count, and every word scores as two letters longer (3 letters 2 points, 4 letters 4, 5 letters 7, 6 or more 11). Packed board of 320-700 everyday words, as today. Misses cost nothing. 120 s. | 6 by 6 board, 140-420 everyday words (median about 240), words of 4+ letters, 10 free misses plus 2 a word, 100 s, wordHuntRev 4 | Words of 5+ letters only, on a packed board (320-700 everyday 4+ words, at least 60 of them 5+ letters). Free misses 6 plus 1 a word (Normal 10 plus 2). 80 s. | Words of 6+ letters only, on a packed board with at least 25 everyday words of 6+ letters. Free misses 3 plus 1 a word. 70 s. |
| First seconds | Goal line says 3+ letters; three-letter traces score at once. | | Goal line says 5+ letters; a four-letter trace bounces. | Goal line says 6+ letters; only three free misses shown. |
| Today | 6 by 6 board, 320-700 everyday words, words of 4+ letters, 120 s | | 6 by 6 board, 100-140 everyday words, 4+ letters, 80 s | 6 by 6 board, 50-80 everyday words, 4+ letters, 70 s |
| **Evidence** | measured: 16 packed boards, 3-letter everyday words added, misses free, 120 s, scored in memory on the live curves. One letter longer: average kit 80 (Normal 64). Two letters longer: average 122, good 177, near-perfect and elite 200 on 16 of 16. | | measured: 24 packed boards (each holds 200+ everyday 5+ words), 80 s, list filtered to 5+, 6 plus 1 free misses; kit hunting only 5+ words: average 76, near-perfect 185, elite 200 (19 of 24); kit reading every word: average 0, elite 130. | measured: 24 packed boards (95-241 everyday 6+ words), 70 s, list filtered to 6+, 3 plus 1 free misses; hunting only 6+ words: average 118, near-perfect and elite 200 on all 24; reading every word: 0. Six 8-letter words score 200 in 8.7 s at the limits. |

- **Why this curve:** On a letter grid the short words are the easy ones, so lifting the shortest word that counts (the rule the bigger Boggle sets use) steepens every level, while packed boards keep 200 within reach, which today's sparse Expert boards often cannot.
- **Fact-check verdict:** adjusted: Easy's words score as two letters longer, not one (one left the average kit 16 above Normal, two gives 122 against 64); Hard and Expert stay unproven, because the kit hunting only long words scores Expert above Hard above Normal (118, 76, 64) and the kit reading every word scores 0 (re-check: on 15 of 24 Expert boards dealt today every listed word together scores under 200).
- **Human limits today:** Nothing. scripts/level-tune.ts:163 ignores --human-limits for puzzles; scripts/wordhunt-levels-check.ts:71 pins only the kit's near-perfect mean (5 s a word, kits-word.ts:213), with no 200 witness and no tracing time.
- **Proof:** An open word find, so the proof is a witness. The level deal (src/lib/duel/levels/wordhunt.server.ts) keeps a board only when a list of its allowed words reaches 60 base points and 120 long-word and gold points traced inside the clock at 0.25 s a word and 0.15 s a letter. Measured on 24 packed boards: each holds 95-241 everyday words of 6+ letters, and six 8-letter words, four of them through the golden tile, score 200 through the server's grader in 8.7 s of tracing. scripts/wordhunt-levels-check.ts re-proves the witness on every dealt board and that a short trace is refused.
- **Measured today:** Check bands, near-perfect mean: E 170-195, N 158-184, H 138-164, X 115-142. Kit medians, 12 seeds, read-only run for this plan (average / good / near-perfect): E 67 / 115 / 177, N 64 / 102 / 170, H 29 / 88 / 148, X 29 / 80 / 126. The four boards look the same on screen. On 7 of 12 sampled Expert boards every listed word together scores under 200 (176-198).
- **Stamp:** Level field plus a stored minLength and free-miss allowance on the level's puzzle (absent = 4 letters, 10 plus 2); Easy's 3-letter point and step-up table read from the same field. No new Normal stamp.
- **Files:** `src/lib/levels/word/wordhunt.ts`, `src/lib/duel/levels/wordhunt.server.ts`, `src/lib/duel/wordHunt.server.ts`, `src/lib/duel/wordHunt.ts`, `src/components/puzzles/WordHuntPuzzle.tsx`, `scripts/wordhunt-levels-check.ts`
- **Risk:** the kit cannot place Hard and Expert: hunting only long words it scores Expert above Normal (118 against 64, with 200 on every near-perfect run), reading every word it scores 0, so a length-aware player model is needed before the clock and miss allowance can be tuned

### Lookout (`wordsearch`, Word)

**Lever: Words to find.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 8 by 8 grid, 5 words, across and down only, 120 s. It does the job: the average kit finishes 12 of 12 at 168 and the small grid is plain at a glance. | 10 by 10 grid, 6 words in 8 directions plus a hidden bonus word, 120 s, wordSearchRev 6 | 10 by 12 grid (today's Expert size, two rows taller than Normal), 8 words in all 8 directions, no false starts, 100 s. | 10 by 12 grid, 10 words (Normal 6), 5 false starts, 90 s. |
| First seconds | A small 8 by 8 grid, big letters, five words. | | A taller 10 by 12 grid and eight word chips. | Ten word chips in three rows under the tall grid. |
| Today | 8 by 8 grid, 5 words, across and down only, 120 s | | 10 by 11 grid, 7 words in 8 directions, 90 s | 10 by 12 grid, 8 words, 4 false starts, 90 s |
| **Evidence** | measured: today's Easy kept, 12 room seeds: average kit median 165 with 12 of 12 finished (Normal 152, 8 of 12), elite 200 on 12 of 12. | | not measured: 8 words on 10 by 12 with no false starts needs a rebuilt level bank (scripts/word-search-level-bank.ts writes files). Today's Hard, 12 seeds: average 71, elite 200; today's Expert: average 47, elite 196. | not measured: 10 words and 5 false starts on 10 by 12 need a new bank, and whether they pack for every theme is not known; no run. |

- **Why this curve:** The grid is already at the phone's limit (ten columns of 36 px squares, twelve rows on a short phone), so the honest ladder is more words to find in that space with false starts on top, taking Hard to today's Expert size and Expert to ten words.
- **Fact-check verdict:** unproven: both changed levels deal from a bank that has to be rebuilt, so neither was run; on these 12 seeds today's Hard (71) sits above today's Expert (47), not below it as the earlier pass found, and Easy is only 13 above Normal because Normal already scores 152.
- **Human limits today:** Nothing timed. scripts/wordsearch-levels-check.ts:111 proves each word is hidden once by a full scan with no clock, and :163 pins kit means (9 s a word, kits-word.ts:494); no drag-time witness exists.
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
| **Evidence** | measured: today's Easy kept, 12 room seeds: average kit median 103 with 4 of 12 finished (Normal 59, 0 of 12), elite 200 on 9 of 12. | | measured: today's Expert boards with 75 s set in memory, 12 seeds (the 3 free misses not modelled): average 32, good 63, near-perfect 161, elite 185, best 190. Today's Hard on the same seeds: average 42, elite 190. | not measured: an 8-letter wheel with 20-24 words needs a new bank from a new LW_LEVEL_LIMITS row (scripts/letter-wheel-bank.ts writes files); no run. |

- **Why this curve:** A wheel-and-crossword game grows the way its kind always has, more letters on the wheel and more words to fill, and one more notch each way gives Expert a wheel and a crossword no other level has, where today Hard and Expert differ by a few words and Expert has the longer clock.
- **Fact-check verdict:** unproven: Expert's 8-letter bank does not exist; the proposed Hard measures 32 for the average kit, 27 under Normal and already where Expert should sit, and no run reached 200 on a Normal, Hard or Expert board (elite best 197).
- **Human limits today:** Nothing. scripts/letterwheel-levels-check.ts:116 pins only the kit's near-perfect mean (7 s a word, kits-word.ts:572); no traced witness and no tracing time.
- **Proof:** scripts/letter-wheel-bank.ts --level builds each bank (every slot word a common answer traceable on the wheel, the grid inside the level's limits, rebuilt byte for byte with --check); Expert needs a new 8-letter bank from a new LW_LEVEL_LIMITS row. Open by design (fills are not unique), so 200 is shown by a witness to add to scripts/letterwheel-levels-check.ts: every slot word and a full jar traced inside the 40 s full-speed line at 0.25 s a word and 0.15 s a letter (about 33 s of tracing for 22 slot words plus the 11 or so bonus words that fill the 30-drop jar).
- **Measured today:** Check bands, near-perfect mean: E 170-195, N 162-186, H 155-180, X 148-174. Kit medians, 12 seeds, read-only run for this plan (average / good / great / near-perfect): E 110 / 162 / 170 / 180, N 53 / 108 / 158 / 174, H 38 / 82 / 111 / 167, X 37 / 70 / 103 / 166. No kit run reached 200 at any level (best 194 on Easy, 179 on Normal). Expert's clock is longer than Hard's.
- **Stamp:** Level field plus a stored free-miss allowance on the level's puzzle (absent = 5); the wheel's letters, grid and clock are already stored. New level banks, no new Normal stamp.
- **Files:** `src/lib/levels/word/letterwheel.ts`, `src/lib/duel/letterWheel.ts`, `scripts/letter-wheel-bank.ts`, `src/lib/duel/letterWheelBankHard.server.ts`, `src/lib/duel/letterWheelBankExpert.server.ts`, `src/puzzles/letterWheel.tsx`, `scripts/letterwheel-levels-check.ts`
- **Risk:** an 8-letter wheel's 20-24 word crossword may need more than 10 by 13, and its squares shrink to about 24 px on short phones (display only; letters stay 11 px or more)

### Strikeout (`strikeout`, Word)

**Lever: Starting letters per word.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 4 starting letters on every word (today 3 or 2, the same as Normal's first word), 4 vowel guesses a word, 14 strikes, 120 s. | 3 or 2 starting letters on words 1-3 and one fewer on words 4-5, 3 vowel guesses a word, 12 strikes, 100 s, strikeoutRev 7 | 1 starting letter a word, 2 vowel guesses, 12 strikes and 100 s (both as Normal; today's Hard has 10 strikes and 90 s). | No starting letters, 2 vowel guesses, 12 strikes (as today), 70 s (today 85 s). |
| First seconds | Four letters of the first word already showing; 14 strike dots. | | One letter showing in each word; two vowel dots. | Every tile blank; two vowel dots; a 70-second clock. |
| Today | 3 or 2 starting letters on all five words, 4 vowel guesses a word, 14 strikes, 120 s | | 1 starting letter a word, 2 vowel guesses, 10 strikes, 90 s | no starting letters, 2 vowel guesses, 12 strikes, 85 s |
| **Evidence** | measured: 24 sets built with the repo's deal code at 4 starting letters (the generator accepts them); kit medians average 189 with 24 of 24 finished (today's Easy 177, 15 of 24), elite 200; the person-like line at the limits clears 24 of 24. | | measured: 32 sets built with the repo's deal code at 1 letter, 2 vowels, 12 strikes, 100 s; kit average 61 (median 64; Normal 107, median 101), near-perfect 187, elite 192, best 200. Today's Hard (10 strikes, 90 s) on the same seeds: average 54. | measured: 32 sets at 0 letters, 2 vowels, 12 strikes, 70 s; kit average 32 (median 34), near-perfect 144, elite 181, best 195; the person-like line at the limits: median 190, best 199. At 8 strikes no line can pass 198 (standard/word.ts:59-60). |

- **Why this curve:** Starting letters are what a hangman player sees first and leans on most, so the ladder runs 4, then 3 or 2, then 1, then none, with Hard's strikes and clock left at Normal's so the missing letters alone make its step and a shorter clock keeping Expert clearly below Hard.
- **Fact-check verdict:** adjusted: Expert keeps 12 strikes instead of 8 (8 caps every run at 198) and takes a 70 s clock, and Hard takes Normal's 12 strikes and 100 s, so the average kit steps 189, 107, 61, 32 where Hard and Expert both sat near 40; 200 on Expert was reached on only 1 of 56 sets by the person-like line.
- **Human limits today:** Nothing timed. src/lib/duel/levels/strikeout.server.ts:44 redraws Hard and Expert until solveStrikeoutLikeAPerson clears the set inside the strikes and scripts/strikeout-levels-check.ts:98 asserts it; the solver has no clock and is not held to the 200 line. The bands at :106 are kit means.
- **Proof:** One answer word fits each pattern (scripts/strikeout-levels-check.ts). Hard and Expert deal only sets the person-like guesser (solveStrikeoutLikeAPerson, src/lib/duel/levels/strikeoutSolver.server.ts, never sees the answers) clears inside the level's strikes, redrawing on the room seed up to 40 times. Measured on 56 Expert sets at 12 strikes: its line, timed at 0.25 s a decision and 0.15 s a key, takes 14.5-20.4 s and scores about 190, best 200 (once). The score ceiling is 200 only with 10 or more strikes (the strike bonus pays 1 a strike left, up to 10), which is why Expert keeps 12.
- **Measured today:** Check bands near-perfect / great: E 188-200 / 185-200, N 190-200 / 180-196, H 172-192 / 145-178, X 155-182 / 100-132. Kit medians, 12 seeds, read-only run for this plan (average / good / great / near-perfect): E 178 / 191 / 196 / 196, N 100 / 183 / 191 / 196, H 66 / 107 / 172 / 183, X 39 / 80 / 127 / 172.
- **Stamp:** Level field only: starting letters, vowel guesses, strikes and clock are already stored on the puzzle (givens, maxVowels, maxStrikes, timeLimitMs).
- **Files:** `src/lib/levels/word/strikeout.ts`, `src/lib/duel/levels/strikeout.server.ts`, `src/lib/duel/levels/strikeoutSolver.server.ts`, `scripts/strikeout-levels-check.ts`
- **Risk:** 200 on Expert needs a finish inside 40 s with at most two wrong letters over five blank words; the person-like solver's line did it on 1 of 56 sets, so 200 on every set needs a strike bonus scaled to the level's strikes (a new stamp)

### Cryptogrid (`codeword`, Word)

**Lever: Grid size.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 5 by 5 grid: six 5-letter words on rows and columns 1, 3 and 5 (21 squares, about 12 letters), 6 decoded at the start, 120 s. | 7 by 7 grid of 14-18 letters, 6 numbers decoded at the start, 120 s, codewordRev 7 | 8 by 8 grid (about 17-21 letters, Normal 14-18), 5 decoded at the start, 110 s. | 9 by 9 grid (about 20-24 letters, 40 px squares at 390 px), 4 decoded at the start, 100 s; only boards the person-like solver cracks. |
| First seconds | A small 5 by 5 grid, half its letters already in. | | A bigger 8 by 8 grid with about 20 numbers. | A 9 by 9 grid with only four letters showing. |
| Today | 7 by 7 grid, 8 numbers decoded at the start, 120 s | | 7 by 7 grid, 5 decoded, 75 s | 7 by 7 grid, 4 decoded, 70 s, only the 666 bank boards a person-like solver cracks |
| **Evidence** | not measured: a 5 by 5 grid needs a new template and bank (CW_SIZE 7, src/lib/duel/codeword.ts:25). Today's Easy, 24 boards: average kit 169 with 17 of 24 finished (Normal 99), elite 200. | | not measured: 8 by 8 needs a new bank with a one-answer proof. Nearest, 7 by 7 with 5 letters at the proposed 110 s, 24 boards: average 83, elite 200 on 24 of 24; the person-like solver cracks 785 of 1,000 bank boards from 5 letters. | not measured: 9 by 9 needs a new bank. Nearest, 7 by 7 with 4 letters at 100 s, 24 boards: average 73, elite 200 on 24 of 24; the person-like solver cracks 666 of 1,000 from 4 letters in 1-5 rounds, 5.5-7.7 s of taps at the limits. |

- **Why this curve:** A code-breaker gets harder with more squares and more letters to crack, and only a bigger grid stretches strong players, who score about 200 on every level today because the levels differ by one starting letter and a clock they never run out of.
- **Fact-check verdict:** unproven: no bigger grid can be dealt without new banks; on 7 by 7 the elite kit scores 200 at every level and clock tried, and at its pace (2.1 s a number) a 20-number 9 by 9 would still crack in about 42 s, inside the full-speed line, so size alone may not stretch strong players.
- **Human limits today:** Nothing timed. scripts/codeword-expert-bank.ts:19 and scripts/codeword-levels-check.ts:105 hold Expert to boards solveCodewordLikeAHuman cracks from four letters, with no clock and no tap time; the bands at :113 are kit means (6 s a number, kits-word.ts:836).
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
| **Evidence** | measured: today's Easy kept, 12 room seeds: average kit median 195 with 12 of 12 finished (Normal 172, 8 of 12), elite 200. Today's Hard and Expert on the same seeds: average 41 and 33; the elite kit scores 200 on 12 of 12 at every level. | | not measured: 30 tiles in three loops needs a new lattice; the 21 tile squares are fixed (SW_TILE_CELLS, src/lib/duel/swapword.ts:57) and the generator, minSwaps, the proof and the kit all index them. | not measured: a 33-tile window of six 7-letter words needs the same new lattice, a lattice-aware one-arrangement proof and mark-reading solver; nothing can be dealt or played today. |

- **Why this curve:** Each extra loop adds nine or more tiles to sort and more crossings to hold in mind, a step the player sees at once, where today's Hard and Expert are Normal's board on half the clock.
- **Fact-check verdict:** unproven: Hard and Expert need a lattice the code cannot build, so neither was run; Easy holds as today's (average 195 against Normal's 172).
- **Human limits today:** Nothing timed. src/lib/duel/levels/swapword.server.ts:35 keeps Expert to boards swapwordHumanSolves works out and scripts/swapword-levels-check.ts:37 asserts it; that solver reads the marks with no clock and no swap time, and the kit takes 5 s a swap (kits-word.ts:913).
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
| **Evidence** | measured: today's Easy (kept), puzzle-fairness kits (average / good / great / near-perfect medians, server grade as a phone sends), 48 deals: 198 / 198 / 200 / 200, every run finished; hand-speed oracle 200 on 48 of 48. | | measured: proposed scales stood in for Hard in memory, 48 deals: 62 / 94 / 171 / 189 (finish 0 / 0 / 73 / 100 %), best 199; with the person filter personSolveScale balances 192 of 192 scales; hand-speed oracle 200 on 48 of 48. | measured: today's Expert (kept), 48 deals: 31 / 62 / 93 / 172, near-perfect finishes 83 %, kit best 183; personSolveScale 192 of 192 scales; stored solution played at hand speed (0.4 s an action) scores 200 on 48 of 48. |

- **Why this curve:** Every weight is a torque sum, so a longer beam and more weights multiply the sums, and hiding the readout last makes the player do them in the head.
- **Fact-check verdict:** holds: the average kit steps 198, 165, 62, 31 from Easy to Expert and Expert reaches 200 at hand speed; only measured and risk were reworded (today's Hard is 94 against Normal's 165, not level with it).
- **Human limits today:** Nothing applies the human limits. personSolveScale (balanceLevels.server.ts:26, 40 trial hangs, no clock) filters Expert deals (:72); number-levels-balance-target-check.ts:162 asserts it on 100 Expert boards. level-tune.ts:163 ignores --human-limits for puzzles (kits only, great and near-perfect).
- **Proof:** Each scale is proved balanced with both sides used and, where set, exactly one arrangement (balancedArrangements, exhaustive) when dealt. Expert keeps only scales personSolveScale (balanceLevels.server.ts) balances without the readout inside 40 trial hangs. scripts/number-levels-balance-target-check.ts pins it. New Hard: the same filter with the readout on, and the near-perfect kit finishing 95 % or more inside 120 s.
- **Measured today:** Not documented. Measuring pass, 48 deals, same seeds every level (average / good / great / near-perfect kit medians, server grade as a phone sends): Easy 198 / 198 / 200 / 200; Normal 165 / 193 / 200 / 200 (average finishes 65 %); Hard 94 / 170 / 190 / 200 (average finishes 0 %, good 71 %); Expert 31 / 62 / 93 / 172 (83 % finish). Today's Hard is clearly harder than Normal for the average and good kits, but its first scale is the same shape as Normal's (8 notches, 2 weights to hang, 1 fixed), so the step is not seen in the first seconds.
- **Stamp:** Level field only: balanceRev 5 already stores each deal's scales, hang limits and hideBalance. Hard moves from balanceRev 4 to a balanceRev 5 settings row, so its practice bests restart.
- **Files:** `src/lib/levels/gameLevels.ts`, `src/lib/duel/balanceLevels.ts`, `src/lib/duel/balanceLevels.server.ts`, `scripts/number-levels-balance-target-check.ts`, `scripts/puzzle-fairness/kits-number.ts`
- **Risk:** It retires the old game from Hard, which Joe chose on 15 Nov. The old game does score lower than Normal (average kit 94 against 165, good 170 against 193); what it lacks is a first screen that looks harder.

### Exact (`target`, Number)

**Lever: Targets to hit in the round.** Redesigned. **New mechanic:** Targets in a row: 2 at Hard, 3 at Expert, announced as "Target 1 of 2" with the Number family's stage pips. Arrives at Hard.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 1 target of two digits (20 to 99) that 2 or 3 of the six numbers make, 2 big numbers on the rack, 75 s. | 6 numbers, 1 or 2 big, small ones 1 to 10; target 101 to 999; 75 s; full speed points by 30 s | 2 targets in a row, each on a fresh rack, 100 s: first a Normal-style target, then today's Hard board (1 big number, 300 to 999, needs all six). Points per target; full speed points by 50 s. | 3 targets in a row, 120 s: a Normal-style target, then 1 big number needing five or six, then today's Expert board (small numbers only, 500 to 999, needs all six). Full speed points by 75 s. |
| First seconds | A two-digit target | | "Target 1 of 2" and two stage pips | "Target 1 of 3" and three stage pips |
| Today | 6 numbers, 1 or 2 big (25, 50, 75, 100); target 101 to 300 that 3 or 4 numbers make; 75 s | | Exactly 1 big number; target 300 to 999 that needs all six; 75 s | No big number; target 500 to 999 that needs all six, from a bank of 320 boards a person-like solver cracks; 75 s |
| **Evidence** | measured: proposed Easy (target 20 to 99, 2 or 3 numbers, 2 big) stood in for Easy in memory, kits, 72 deals: 200 / 200 / 200 / 200, every run finished; personSolveTarget finds 72 of 72. Today's Easy: 193 to 197 / 200 / 200 / 200. | | not measured: a 2-target round has no stage, answer format or grader. Boards alone at 75 s, 72 deals: Normal-style 172 / 196 / 200 / 200, today's Hard board 26 / 78 / 106 / 181. Kit time sum: near-perfect both inside 100 s on 97 %; average never both. | not measured: no 3-target round exists. Boards alone, 72 deals: middle 38 / 78 / 169 / 188, Expert bank board 26 / 52 / 104 / 175. Kit time sum 17 + 46 + 64 s: near-perfect all three inside 120 s on 29 to 46 %; hand-speed oracle 200 on every board. |

- **Why this curve:** One deep target is all or nothing and looks the same at every level, so the harder levels chain targets that rise inside the round: the load doubles, then trebles, and an average player still banks the first.
- **Fact-check verdict:** unproven: the chained round cannot be graded today; board by board Hard's time sum fits, Expert's reaches 29 to 46 % and not the 80 % its proof line assumed, so proof and risk now give the measured sum and a lighter middle target as the fallback.
- **Human limits today:** Nothing applies the human limits. personSolveTarget (targetLevels.server.ts:67, 20,000 lines of thought, no clock) filters the Expert bank; number-levels-balance-target-check.ts:163 and :181 assert it on 100 Expert deals and on every bank board.
- **Proof:** Each target is proved by exhaustive search to need its count of numbers (targetLevelRoute, targetLevels.server.ts). Expert's last target comes from the existing proved bank (targetExpertBank.server.ts, scripts/target-expert-bank.ts, personSolveTarget). To write: a bank of whole rounds per level in which every target passes personSolveTarget (today it finds 62 of 72 Normal-style boards and 54 of 72 middle boards), and a check that the near-perfect kit finishes 80 % of Expert rounds inside 120 s. Measured sum of the kit's own solve times: about 17 + 46 + 64 s, which finishes 29 to 46 % of rounds; with a second Normal-style target in the middle (17 + 17 + 64 s) it finishes 94 to 96 %.
- **Measured today:** Not documented. This session's kit run (24 deals; the kit's search time is set by level name): Easy 189 / 200 / 200 / 200; Normal 168 / 194 / 200 / 200; Hard 52 / 78 / 120 / 180; Expert 26 / 52 / 78 / 173 (83 % finish). The scores step, but all four screens look the same.
- **Stamp:** New stamp (for example targetRev 1): the stored puzzle holds 2 or 3 racks and targets and the grader pays per target. Today's one-target rounds grade as before.
- **Files:** `src/lib/duel/targetLevels.server.ts`, `src/lib/duel/target.ts`, `src/lib/duel/standard/number.server.ts`, `src/puzzles/targetNumber.tsx`, `src/lib/levels/gameLevels.ts`, `scripts/target-expert-bank.ts`, `scripts/number-levels-balance-target-check.ts`, `scripts/puzzle-fairness/kits-number.ts`
- **Risk:** The biggest build of the group: a staged screen, answer format, grader and reveal for a game with one board today. On the kit's timings the Expert round as written is finished by the near-perfect kit on about a third of deals, so its middle target may have to be a Normal-style one.

### Operator (`equation`, Number)

**Lever: Gaps to fill per equation.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Keep today's: one gap in the first equations, numbers under 10, no ÷ (average kit 184, 96 % finish). | gapsRev 2: 4 equations of 3, 4, 5, 5 numbers (up to 12, 15, 15, 20); 2, 3, 4, 5 gaps; 2 decoy tiles from line 2; 3 tries; 90 s | Keep today's: three empty circles in the first equation and numbers to 25 are a clear step for good and great play (168 to 99, 199 to 168). | Every sign open on every equation: 4 equations of 5 numbers (2 to 30), 4 sign gaps plus 1, 2, 2, 3 number gaps (24 gaps, today 18), 2, 2, 3, 3 decoy tiles, ÷ needed on lines 3 and 4, 2 tries, 78 s. In-memory kit trial at 90 s: 31 / 65 / 99 / 183. |
| First seconds | A short sum with one empty circle | | Four numbers and three empty circles | Five numbers, every sign missing, a tray of tiles |
| Today | 4 equations of 3, 3, 4, 4 numbers (2 to 9; + - ×); 1, 1, 2, 2 gaps; 3 tries; 90 s | | Numbers 2 to 25; equations of 4, 4, 5, 5 numbers; 3, 4, 5, 6 gaps; ÷ from line 3; 3 tries; 85 s, full speed by 40 s | Numbers 2 to 30; equations of 4, 5, 5, 5 numbers; 3, 4, 5, 6 gaps; 2 decoys a line; ÷ needed on lines 3 and 4; 2 tries; 78 s, full speed by 40 s |
| **Evidence** | measured: today's Easy (kept), kits, 24 deals: 189 / 200 / 200 / 200, every run finished; person-like search inside its 800-line budget on 96 of 96 lines; hand-speed oracle 200 on 24 of 24. | | measured: today's Hard (kept), kits, 24 deals, 85 s: 63 / 99 / 172 / 190 (means 54 / 97 / 166 / 190); Normal 67 / 166 / 200 / 200 (mean 75). A bigger first line (4 gaps) was tried: 31 / 98 / 169 / 188, level with Expert for the average kit, so today's stays. | measured: proposed lines stood in for Expert in memory, 78 s, 150 deals: 31 / 65 / 99 / 175, near-perfect finishes 98 %, best 190; no fallback equation in 600 lines; person-like search inside 800 on 600 of 600; hand-speed oracle 200 on 150 of 150. |

- **Why this curve:** An equation is as hard as its open choices, and five numbers is all a phone line holds at 36 px a gap, so the top level opens every sign and some numbers instead of growing the line.
- **Fact-check verdict:** holds: by kit means the average steps 185, 75, 54, 24 from Easy to Expert (medians 189, 67, 63, 31, which move a whole equation at a time); the proposed Expert finishes for the near-perfect kit on 98 % of 150 deals and reaches 200 at hand speed.
- **Human limits today:** Nothing applies the human limits. operatorPersonSearch (operatorGaps.server.ts:190, 800 partial lines at :244, no clock) filters every level line (:256); number-levels-equation-pyramid-check.ts:177 asserts it on 150 seeds a level. No kit finish rate is asserted.
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
| **Evidence** | not measured: 3-row boards and a 3-pyramid round need new answer, grader and stage code (NP_SET_SIZE is 4; rows are typed 4 to 6). Today's Easy, kits, 24 deals this session: 99 / 180 / 198 / 200, the average kit never finishes. | | measured: today's Hard (kept), kits, 24 deals: 38 / 69 / 99 / 169, near-perfect finishes 100 %, kit best 178 (Normal 55 / 90 / 124 / 187); hand-speed oracle 200 on 24 of 24. | not measured: a 3-pyramid round cannot be dealt or graded, and the kit counts stones, not the size of the sums. Today's Expert, 24 deals: 35 / 64 / 90 / 160, near-perfect finishes 63 %; hand-speed oracle 200 on 24 of 24. |

- **Why this curve:** Six rows is as tall as a phone allows, so above Normal the pyramid empties out and its numbers grow, and Easy shrinks until an average player can finish it.
- **Fact-check verdict:** unproven: Easy and Expert need a 3-pyramid round the answer format and grader do not have; the proposed Expert has fewer stones than Hard, so its step rests on the bigger sums, which no tool measures (risk now says so).
- **Human limits today:** Nothing applies the human limits. npPersonSolve (numberPyramidLevels.ts:99, forced stones only, no clock) filters the level banks (scripts/number-pyramid-levels-bank.ts:55); number-levels-equation-pyramid-check.ts:111 asserts it on every bank board. No kit finish rate is asserted.
- **Proof:** Each level deals from its own bank (scripts/number-pyramid-levels-bank.ts): every board has exactly one tray assignment, decoys included (npCountSolutionsFast, numberPyramidLevels.ts), and the person-like solver completes it; scripts/number-levels-equation-pyramid-check.ts. To add: 3-row boards, the new Expert bank, and a near-perfect kit finish of 60 % or more once the kit is timed on three-digit sums.
- **Measured today:** Documented for Normal only: great 135.4 (35 % finish), near-perfect 188.7 (docs/number-overhaul.md). This session's kit run (24 deals, average / good / great / near-perfect): Easy 98 (0 % finish) / 183 / 198 / 200; Normal 58 / 95 / 125 / 188; Hard 36 / 67 / 95 / 168; Expert 33 / 62 / 93 / 161. Easy fails an average player; Expert scores like Hard.
- **Stamp:** Level field only: boards come from each level's bank and carry their rows. The stage and grader must accept 3-row boards and 3-pyramid rounds.
- **Files:** `src/lib/levels/gameLevels.ts`, `src/lib/duel/numberPyramidLevels.ts`, `scripts/number-pyramid-levels-bank.ts`, `src/lib/duel/numberPyramidLevelsBank.server.ts`, `src/puzzles/numberPyramid.tsx`, `scripts/number-levels-equation-pyramid-check.ts`
- **Risk:** The six-row board already clips the goal line on the Expert contact sheet, and the kit counts stones, not sum size, so Expert's step needs a real playtest. The proposed Expert also has fewer stones than Hard (about 44 against 48), so by the kit's only measure its step rests wholly on the bigger sums.

### Brimful (`measure`, Number)

**Lever: Jugs on the bench, tap removed.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 3 boards, 2 jugs and the tap, fewest pours 2, 2-4, 4, limit 5 ×. In-memory kit trial: 183 (88 % finish) / 193 / 197 / 200. | measureRev 5: 4 boards, jugs 2, 2, 2, 3 with the tap; fewest pours 3-4, 4-6, 6-8, 6-10; limit 4.5 ×; 120 s | 3 jugs on every board, and the tap goes half-way: 3 jugs with tap, 4-6 pours; with tap, 7-10; no tap, 9-12; no tap, split evenly, 12-15; limit 2.5 ×; 120 s. A lighter trial (4-6, 6-8, 7-10, 10-13) gave 63 / 161 / 197 / 200, so these bands sit one notch longer. | No tap or drain on any board, the big jug starts full: 3 jugs, 4-6 pours; 10-13; split evenly, 13-16; split, 15-18; limit 1.5 ×; the one-move pulse off; 120 s. Measured on 24 deals: 32 / 64 / 169 / 197 (88 % finish). |
| First seconds | Two jugs and a tap, "Par 2" | | Three jugs on the bench | Three jugs, no tap, the big one full |
| Today | 3 boards, 2 jugs and the tap; fewest pours 2-4, 3-4, 4-6; move limit 5 × the fewest; 120 s | | The old game (measureRev 4): 2 jugs 4-6 pours; 2 jugs 6-9; 3 jugs 8-11; then 3 jugs, no tap, split evenly, 10-14; limit about 4.5 ×; 120 s | 4 boards: 2 jugs and tap 14-16 pours; 3 jugs and tap 12-15; 3 jugs no tap 11-15; no-tap split 13-16; limit 1.5 ×; 120 s |
| **Evidence** | measured: proposed bands stood in for Easy in memory, kits, 16 deals: 181 / 197 / 199 / 200, average finishes 94 % (today's Easy 174 / 195 / 198 / 200, 88 %); hand-speed oracle 200 on 16 of 16. | | measured: proposed bands dealt through the Expert slot in memory, 24 deals: 47 / 95 / 182 / 200 (means 44 / 104 / 181 / 199; finish 0 / 17 / 100 / 100 %); Normal 63 / 186 / 199 / 200 (mean 71); hand-speed oracle 200 on 24 of 24. | measured: first board cut to 4-6 pours, stood in for Expert in memory, 24 deals: 32 / 64 / 169 / 197, near-perfect finishes 88 %, kit best 200; as first proposed (6-8 pours) the average kit's median was 0 (mean 17); hand-speed oracle 200 on 24 of 24. |

- **Why this curve:** Each extra jug and each lost tap is one more thing to juggle and is seen at once, and a short first board on Expert lets an average player score before the long chains.
- **Fact-check verdict:** adjusted: Expert's first board is 4-6 pours, not 6-8, because at 6-8 the average kit's median was 0 and the short first board did not let it score; at 4-6 it is 32 (near-perfect 197, 88 % finish). Easy and Hard hold as proposed (average 181 and 47 against Normal's 63).
- **Human limits today:** Nothing applies the human limits. personSolve (measureLevels.ts:76, fixed strategies inside the move limit, no clock) filters every level board (measureLevels.server.ts:88); number-levels-measure-numline-check.ts:129 asserts it on 100 seeds a level and :241 asserts the near-perfect kit finishes 80 % of Expert on 40 seeds at the kit's own pace.
- **Proof:** Every board's fewest pours come from a breadth-first search of all jug states, and a board is dealt only if personSolve (the textbook fill-pour-empty and three-jug cycles, measureLevels.ts) reaches the target inside its move limit (measureLevels.server.ts). scripts/number-levels-measure-numline-check.ts pins it and the near-perfect kit's Expert finish rate. Four boards is the ceiling: a five-board trial left the near-perfect kit unfinished on all 16 deals.
- **Measured today:** Documented: only that the near-perfect kit finishes 80 % of Expert. Measuring pass, 96 deals, same seeds (average / good / great / near-perfect kit medians): Normal 63 / 182 / 199 / 200 (good finishes 86 %); Hard 61 / 95 / 191 / 200 (good finishes 38 %; average kit mean 48 against 68). Earlier pass, 24 deals: Easy 168 (67 % finish) / 196 / 200 / 200; Expert 0 / 30 / 94 / 188 (79 % finish). Today's Hard is clearly harder than Normal for the good kit, but its first board looks the same (2 jugs and a tap). An average player scores nothing on Expert.
- **Stamp:** Level field only: measureRev 5 stores the boards and move limits. Hard moves from measureRev 4 to a measureRev 5 row; the pulse is display, read from the stored level.
- **Files:** `src/lib/levels/gameLevels.ts`, `src/lib/duel/measureLevels.ts`, `src/lib/duel/measureLevels.server.ts`, `src/puzzles/measure.tsx`, `scripts/number-levels-measure-numline-check.ts`
- **Risk:** The kit plays the proven shortest plan, so its top scores overstate real experts; it also retires the old game from Hard (Joe's 15 Nov choice).

### Checkout (`checkout`, Number)

**Lever: How strange the dartboard is.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 3 standard boards, any dart finishes, targets 20-50, 40-80, 100-120, and a 120 s clock. In-memory kit trial at 90 s: 190 (63 % finish) / 200 / 200 / 200. One board stays at 100 or more because only that can pay the big-finish 10. | checkoutRev 4: 5 boards, 3 standard then 2 with 1 to 20 shuffled; double finish; 3 darts; targets 40 to 160; 90 s | Odd numbers from the first board: odd values 5 to 60, double finish, 120-200; shuffled 1 to 20, 100-160; odd values, ×4 ring, treble finish, 200-400; shuffled with 2 minus wedges, exactly 4 darts, 80-170; odd values with minus wedges, 200-400; 90 s. Kit trial: 28 / 80 / 185 / 198. | 5 odd-value boards, every one with 2 minus wedges and an exact dart count (3, 3, 4, 4, 4 darts), ×4 ring on three, treble finish on two, targets 80 to 360, 90 s. Measured on 40 deals: 25 / 52 / 78 / 183 (85 % finish). |
| First seconds | A normal dartboard and three small targets | | Odd numbers up to 60 round the board | Odd numbers, red minus wedges, "exactly 3 darts" |
| Today | 3 standard boards, any dart may finish, 3 darts, targets 30-70, 50-100, 100-150; 90 s | | The old game (checkoutRev 3): standard; shuffled; odd values 5 to 60 (targets 200-400); odd values with a ×4 ring and treble finish; shuffled with 2 minus wedges and exactly 4 darts; 90 s | 5 odd boards, an exact dart count on each: odd values; ×4 ring and treble finish; minus wedges, 4 darts; minus and ×4, 4 darts; minus, ×4 and treble finish; targets 80 to 320; 90 s |
| **Evidence** | measured: proposed boards stood in for Easy in memory, kits, 16 deals: 199 / 200 / 200 / 200 at 120 s and 198 / 200 / 200 / 200 at 90 s, average finishes 94 % either way (today's Easy 186, 69 %); checkoutPersonFinds 48 of 48 boards. | | measured: proposed boards stood in for Hard in memory, 16 deals: 40 / 78 / 184 / 196 (finish 0 / 0 / 69 / 100 %); Normal 53 / 107 / 200 / 200, today's Hard 50 / 103 / 179 / 197; checkoutPersonFinds 80 of 80; hand-speed oracle median 196, best 198. | measured: darts 3, 3, 4, 4, 4 stood in for Expert in memory, 40 deals: 25 / 52 / 78 / 183, near-perfect finishes 85 %, kit best 192; as first proposed (3, 4, 4, 4, 4) it finished 78 %; today's Expert 25 / 53 / 79 / 190; fewest-dart routes at hand speed score 190 to 196. |

- **Why this curve:** Darts players lean on checkouts they know by heart, so the fair way to raise the game is to change the board under them, then add minus wedges and exact dart counts.
- **Fact-check verdict:** adjusted: Expert's second board takes exactly 3 darts, not 4, because the near-perfect kit finished 78 % of 40 deals as proposed and the Expert check asks 80 %; now 85 %. Still unproven: 200 on Hard and Expert needs the big-finish points too (proof now asks for that search).
- **Human limits today:** Nothing applies the human limits. checkoutPersonFinds (checkout.server.ts:130, 6,000 dart lists, no clock) filters Easy, Normal and Expert boards (:200); number-levels-checkout-kakuro-check.ts:198 asserts it and :287 asserts the near-perfect kit finishes 80 % of Expert on 40 seeds.
- **Proof:** searchCheckout (exhaustive, checkout.ts) proves every board has a checkout thrown in a bust-free order and stores the fewest darts; Easy and Expert boards are also found by checkoutPersonFinds inside 6,000 dart lists (checkout.server.ts); scripts/number-levels-checkout-kakuro-check.ts runs 100 Expert seeds. Give the new Hard the same person filter. Five boards is the ceiling: a six-board trial left the near-perfect kit unfinished on all 16 deals. To add: a search proving every Hard and Expert round has routes that take the fewest darts and the big finishes together; the stored fewest-dart routes played at hand speed score 190 to 198, not 200.
- **Measured today:** Documented: only that the near-perfect kit finishes 80 % of Expert. Measuring pass, 96 deals, same seeds (average / good / great / near-perfect kit medians): Normal 53 / 140 / 200 / 200 (finish 0 / 50 / 96 / 100 %); Hard 50 / 103 / 182 / 197 (finish 0 / 18 / 74 / 100 %). Earlier pass, 24 deals: Easy 168 (54 % finish) / 200 / 200 / 200; Expert 25 / 53 / 103 / 187 (83 % finish). Today's Hard is level with Normal for the average kit, which finishes neither, and clearly harder for the good and great kits; its first board is the same standard board as Normal's.
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
| **Evidence** | not measured: the kit has no model for labelled ticks (its error is set by level name). Today's Easy lines, kits, 16 deals this session: 152 / 178 / 190 / 198, every run finished. | | not measured: the kit has no model for the number of ticks. Today's Hard lines, 16 deals this session: 69 / 146 / 175 / 186 (Normal 103 / 165 / 184 / 192). | not measured: the bare ruler is not modelled. Clock and shown end labels only, in memory, 16 deals: 75 s gives 52 / 106 / 172 / 185, 65 s 45 / 94 / 172 / 185 (today's Expert 52 / 123 / 158 / 174); hand-speed oracle median 193, best 200. |

- **Why this curve:** Ballpark is judging a place by eye, so thinning the ruler's marks makes the same sums harder to place and is seen before the first drag, where today's hidden end label only turns the first three into a guess.
- **Fact-check verdict:** unproven: no tool models pointing error against the marks shown; without the ruler effect the proposed Expert is 17 under Hard for the average kit and level with it for the near-perfect kit (185 against 186), so the step rests on the bare ruler (risk now says so).
- **Human limits today:** Nothing: no solver (every placing scores by distance), no kit finish rate and no human limits. number-levels-measure-numline-check.ts:201 and :216 assert only that a perfect answer finishes at 180 or more at every level.
- **Proof:** Open by design (every placing scores by distance), so there is no solve to prove: nothing is hidden and every value is exact. scripts/number-levels-measure-numline-check.ts should pin that the near-perfect kit, refitted to measured pointing error on each ruler, still has Expert runs of 185 or more. No such refit exists today; it must be written.
- **Measured today:** Not documented. This session's kit run (24 deals; the kit's error and pace are set by level name, so they are its author's guesses): Easy 151 / 174 / 189 / 198; Normal 92 / 158 / 178 / 192; Hard 63 / 143 / 170 / 187; Expert 46 / 123 / 154 / 175. All four screens look alike.
- **Stamp:** Level field plus a stored marks count on each line (display only, like hideEnd) and Expert's 75 s in timeLimitMs; no grading change, so no new revision. Stored hideEnd rounds draw as before.
- **Files:** `src/lib/duel/numlineLevels.server.ts`, `src/lib/duel/numline.ts`, `src/puzzles/numline.tsx`, `src/lib/levels/gameLevels.ts`, `scripts/number-levels-measure-numline-check.ts`, `scripts/puzzle-fairness/kits-number.ts`
- **Risk:** The drag sound ticks at every tenth, which would give the missing marks away by ear unless it follows the marks shown. No tool models pointing error against the marks shown: with the clock and the shown end labels alone the proposed Expert measures level with Hard for the near-perfect kit (185 against 186).

### Kakuro (`kakuro`, Number)

**Lever: Size of the grid.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 5 × 5 with 9 to 11 white squares (today 12 to 14), grade 0, every square seen within 2 solver passes, 120 s. In-memory kit trial: 179 (every run finished) / 198 / 200 / 200. | kakuroRev 3: 6 × 6, 16 to 19 white squares, grade 0 to 4, at most 3 solver passes; 120 s | A wider board, 7 squares across by 6 down, 20 to 23 white squares, grade 0 to 6, every board finished by the person-like solver, 120 s. Nearest trials: the old 6 × 6 gives 60 / 105 / 172 / 198 and a 7 × 7 with 22 to 25 squares 55 / 100 / 120 / 187. | Keep today's 7 × 7 with 26 to 28 white squares: the clock is the ceiling (a 7 × 7 with 29 to 31 squares halved the near-perfect kit's finishes), and it measures 46 / 78 / 102 / 174. |
| First seconds | A small grid with about ten white squares | | A wider grid, seven squares across | The full 7 × 7 grid, 27 squares to fill |
| Today | 5 × 5 grid (clue row and column included), 12 to 14 white squares, grade 0; 120 s | | The old game (kakuroRev 2): 6 × 6, 19 to 21 white squares, grade up to 10, not filtered by the person-like solver; 120 s | 7 × 7, 26 to 28 white squares, grade 4 to 12, every board finished by the person-like solver; 120 s |
| **Evidence** | measured: proposed settings stood in for Easy in memory, kits, 16 deals: 167 / 197 / 200 / 200, average finishes 94 % (today's Easy 110, 19 %); kakuroPersonSolve 16 of 16 inside 2 passes; hand-speed oracle 200 on 16 of 16. | | not measured: a 7 by 6 board needs rectangular layouts (size is one number). Stand-in, 7 × 7 with 20 to 23 squares, 11 of 16 deals (5 found no layout): 62 / 92 / 163 / 189, person-like solver 11 of 11. Today's Hard: 59 / 99 / 174 / 194. | measured: today's Expert (kept), kits, 16 deals: 52 / 79 / 109 / 175, near-perfect finishes 81 %, kit best 187; kakuroPersonSolve 16 of 16; stored solution at hand speed scores 200 on 16 of 16. |

- **Why this curve:** Kakuro's load is squares to fill times how deep each deduction runs, so the grid grows a row or a column a level until the 120 s clock, not the phone, stops it at 7 × 7.
- **Fact-check verdict:** unproven: the 7 by 6 Hard cannot be dealt today (a 7 × 7 stand-in gives 62 / 92 / 163 / 189); Easy and Expert hold as measured; risk and measured now give the person-like solver's real count on the old Hard (102 of 600 unfinished, a sixth, not a quarter).
- **Human limits today:** Nothing applies the human limits. kakuroPersonSolve (kakuro.server.ts:410, run combinations only, no clock) filters Easy, Normal and Expert deals (:512), not today's Hard; number-levels-checkout-kakuro-check.ts:242 asserts it (100 Expert seeds) and :287 the near-perfect kit's 80 % Expert finish on 40 seeds.
- **Proof:** searchKakuro proves exactly one solution and kakuroPersonSolve (run combinations only, never a guess) completes every Easy, Hard and Expert board (kakuro.server.ts). scripts/number-levels-checkout-kakuro-check.ts runs 100 Expert seeds and the near-perfect kit's 80 % finish. To write: rectangular layouts in generateKakuroLevel and a bank for the 7-wide boards, which take 0.5 to 2 s each to deal.
- **Measured today:** Documented: only that the near-perfect kit finishes 80 % of Expert. Measuring pass, 96 deals, same seeds (average / good / great / near-perfect kit medians): Normal 80 / 167 / 190 / 200 (good finishes 92 %); Hard 65 / 106 / 174 / 195 (good finishes 17 %). Earlier pass, 24 deals: Easy 106 (38 % finish) / 190 / 198 / 200; Expert 46 / 78 / 102 / 174 (83 % finish). Today's Hard is clearly harder than Normal for the good kit, but it is the same 6 × 6 grid with about two more white squares. The person-like solver finishes 498 of 600 of today's Hard boards.
- **Stamp:** New kakuroRev 4 for the 7 × 6 board: the stored puzzle and answer assume a square size. Easy and Expert stay kakuroRev 3 with the level field.
- **Files:** `src/lib/levels/gameLevels.ts`, `src/lib/duel/numberLevels.ts`, `src/lib/duel/kakuro.ts`, `src/lib/duel/kakuro.server.ts`, `src/puzzles/kakuro.tsx`, `scripts/number-levels-checkout-kakuro-check.ts`, `scripts/puzzle-fairness/kits-kakuro.ts`
- **Risk:** It retires the old game from Hard (Joe's 15 Nov choice), about a sixth of whose boards (102 of 600 dealt) cannot be finished by the person-like solver without a guess.


## Speed and Attention (session D3)

### Flash (`reaction`, Speed)

**Lever: Trap flashes before each gold.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 5 golds; the first inside 3 s with no trap before it (today 4–7 s); 0–1 plain trap before the others and no look-alikes (as today); gold up 1.5 s. | 5–8 golds, 1–3 traps before each (half gold look-alikes), traps 0.6 s long, gold up 1.5 s, 60 s | 8 golds; 2–3 traps before each (about 20 a round against Normal's 13), each 0.45 s long and 0.6–1 s apart, the first inside the first second; 75 % gold look-alikes; gold up 0.9 s. | 9 golds; 6–8 traps before each (about 63 a round), each 0.35 s long and 0.5–0.65 s apart (never more than two a second); 90 % look-alikes; gold up 0.6 s. |
| First seconds | A calm dark glass; the first gold arrives within three seconds. | | Trap colours fire about once a second from the start. | The glass flickers twice a second, nearly all gold look-alikes. |
| Today | 5 golds, 0–1 plain traps before each, gold up 1.5 s, 60 s | | 6–8 golds, 2–3 traps, 75 % look-alikes, gold up 1.5 s | 8 golds, 3–5 traps, 75 % look-alikes, gold up 1 s |
| **Evidence** | measured: today's Easy (the first gold inside 3 s needs builder code), speed-levels-tune players, 100 deals: average kit 91, limits 122 (best tenth 131), 140 ms elite 188. A run on exactly 250 ms scores 130. | | measured: adjusted Hard built by hand in memory (8 golds, 2–3 traps, 75 % look-alikes, gold 0.9 s), 100 deals: average kit 35, limits 106 (best 131). As first proposed (3–5 traps) it scored 21 and 99, the same as today's Expert (24 and 100). | measured: built by hand in memory (9 golds, 6–8 traps, 90 % look-alikes, gold 0.6 s), 100 deals: average kit 17 (its floor), limits 69 (best 107), 140 ms elite 180. Exactly 250 ms scores 130, so no run reached 200. |

- **Why this curve:** The only thing Flash can ask beyond a fast finger is not to be fooled, so the traps multiply and quicken while the gold's own window never drops below 0.6 s, more than twice the 0.25 s limit.
- **Fact-check verdict:** adjusted: Hard's traps cut from 3–5 to 2–3 before each gold (about 20 a round) because 3–5 scored the same as today's Expert; the average kit now steps 91, 71, 35, 17, and Expert's 200 stays out of reach under the limits on today's curve (130 at most).
- **Human limits today:** scripts/speed-levels-tune.ts:134 playFlashHuman (250 ± 25 ms reactions plus lure taps) under the tool's own HUMAN_LIMITS (:32); scripts/speed-levels-check.ts:215-220 asserts on 100 deals that Easy is no harder than Normal, Hard and Expert are each 3 lower, and Expert's best tenth is at least min(140, Normal's average), which for Flash is Normal's 114. Nothing asserts 200. level-tune.ts --human-limits plays the plain kits and ignores the flag for puzzles (level-tune.ts:163).
- **Proof:** Open by design (a reaction game). At 0.25 s a gold pays 115 on tapRev 7's curve, so with the 15-point steady hand the limits player tops out at 130 on every level, Normal included (measured through the server's grader: 250 ms 130, 200 ms 135, 170 ms 165, 140 ms 190 at all four levels). Expert's 200 needs I1's tapRev 8 with the curve's full mark at 250 ms (I1 as written, 250 ms = 150, still caps the limits player at 165). With that, playFlashHuman in scripts/speed-levels-tune.ts must reach 200 in its best tenth at Expert, pinned in scripts/speed-levels-check.ts.
- **Measured today:** Elite held to human limits 124 / 114 / 106 / 100 (Expert best tenth 123); 140 ms elite 188 / 186 / 187 / 183 (speed-levels-tune, 100 deals). Average player: not documented.
- **Stamp:** Level field only: the deal stamps flashMs (as today) and a new trapMs that the stage and replayFlash read. Expert's 200 also needs I1's tapRev 8 (Joe's scoring decision).
- **Files:** `src/lib/levels/speedLevels.ts`, `src/puzzles/reaction.tsx`, `src/lib/duel/tapLog.ts`, `src/lib/duel/depth/flash.ts`, `scripts/speed-levels-tune.ts`, `scripts/speed-levels-check.ts`
- **Risk:** The scoring curve, not the level, caps a 0.25 s player at 130 on every level (115 a gold plus the 15-point steady hand). Level design can only change how often a player is fooled; it cannot lift that cap, so no Expert reaches 200 under the limits until a scoring change (I1's tapRev 8, which as written still stops at 165). The average kit is already at its floor (17) on any Expert of 36 traps or more, and fast full-screen flashes must stay under three a second.

### Ascend (`numhunt`, Speed)

**Lever: Numbers on the board.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 16 numbers, 1 to 16 with no gaps (today 16 picked from 1–30), discs never move, 60 s, speed full by 15 s (today 40 s). | 24 numbers 10–99, discs move every 15 s, 60 s, speed full by 40 s | 32 numbers 10–99, discs move every 10 s, 42 s clock, speed full by 34 s. | 40 numbers 10–99, highest first, discs move every 8 s, 55 s clock, speed full by 51 s. 40 is the 390 px ceiling at 44 px discs (a jittered 5 × 8 grid). |
| First seconds | Sixteen big discs, 1 to 16, that never move. | | Thirty-two discs crowd the board; the clock bar is short. | Forty discs fill the board; the goal says highest first. |
| Today | 16 numbers from 1–30, discs never move, 60 s, speed full by 40 s | | 30 numbers 10–99, move every 10 s, 50 s, full by 25 s | 30 numbers, highest first, move every 8 s, 45 s, full by 20 s |
| **Evidence** | measured: proposed settings in memory, playAscend, 100 deals: average kit 171 (every run finishes, median 16 s); limits 199 (21 of 24 at 200). Normal's average kit is 162, so the step is 9 whatever Easy does. | | measured: 32 discs, 42 s, full by 34 s, in memory, playAscend, 100 deals: average kit 77 (12 % finish), limits 196 (57 at 200), finish median 34 s. At the first proposal's 40 s and 32 s: average 64, limits 188, one run at 200. | measured: 40 discs highest first, 55 s, in memory, 100 deals: limits 173 at full by 49 s (best 193, no 200) and 181 at 51 s (best tenth 200, 20 at 200), 94 % finish in a median 52 s. Average kit 49, never finishes. |

- **Why this curve:** Search time grows with the square of the numbers on the board (about 11, 20, 33 and 51 s for the limits player), so eight more discs a level is a steep, even step anyone can see.
- **Fact-check verdict:** adjusted: Hard's clock 40 to 42 s and full by 32 to 34 s (at 40 s the average kit was only 15 above Expert, 64 and 49; now 77), and Expert's full by 49 to 51 s (no run in 100 reached 200 at 49 s); Easy is only 9 above Normal for the average kit (171 and 162), which Easy cannot fix.
- **Human limits today:** scripts/speed-levels-tune.ts:54 playAscend through actionMs (:48-52: 250 ± 25 ms to react, 150 ms to move, 35 ms a disc to search) under the tool's HUMAN_LIMITS (:32); scripts/speed-levels-check.ts:215-220 asserts the step rules on 100 deals (Expert's best tenth at least 140; it is 181). Nothing asserts 200: no limits run reaches it on today's Hard or Expert.
- **Proof:** Open (search and tap). playAscend in scripts/speed-levels-tune.ts under HUMAN_LIMITS (0.25 s to react, 0.15 s to move, 35 ms a disc still to search) finishes Hard in about 34 s and Expert in about 52 s (measured, 100 deals); with speed full by 34 s and 51 s its best tenth scores 200 on both (57 and 20 runs in 100), to be pinned in scripts/speed-levels-check.ts. At the first proposal's 32 s and 49 s one Hard run and no Expert run in 100 reached 200. Today's Expert is full by 20 s against about 33 s for that player (best tenth 181).
- **Measured today:** Elite held to human limits 199 / 199 / 190 / 178 (Expert best tenth 181); 140 ms elite 200 / 199 / 199 / 193. Average player: not documented.
- **Stamp:** Level field only: moveMs, timeLimitMs, fullByS and descending are already stamped on the puzzle, and the count and range are in the dealt board.
- **Files:** `src/lib/levels/speedLevels.ts`, `src/puzzles/numberHunt.tsx`, `scripts/speed-levels-tune.ts`, `scripts/speed-levels-check.ts`
- **Risk:** 40 discs need the jittered grid, which reads more orderly than a free scatter; and Easy can sit only about 9 above Normal for an average player, who already scores about 162 on Normal.

### Eagle Eye (`symscan`, Attention)

**Lever: Eagles in each grid.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Grids 4×4, 4×4, 5×5 (16, 16, 25 eagles); 3–5 targets; one facing; no look-alikes (every other eagle faces at least 90° away); 60 s; speed full by 20 s. | Grids 5×5, 6×6, 7×7; 5–9 targets; two facings on grid 3 (4–6 each); 60 % look-alikes; 60 s; full by 15 s | Grids 6×6, 7×7, 8×8 (36, 49, 64 eagles); 8–12 targets; two facings from grid 2; 75 % look-alikes; 60 s; speed full by 26 s. | Three grids of 8 across by 10 down (80 eagles each at 45 px, the phone's ceiling); 10–14 targets in two facings on every grid; 85 % look-alikes; 60 s; speed full by 40 s. |
| First seconds | Sixteen big eagles, and nothing that nearly matches. | | Thirty-six eagles in the first grid, sixty-four in the last. | Eighty eagles a grid and two facings to find. |
| Today | Grids 4×4, 5×5, 6×6; 4–7 targets; one facing; 30 % look-alikes; 60 s; speed full by 12 s | | Grids 6×6, 7×7, 8×8; 6–10 targets; two facings from grid 2; 75 % look-alikes; full by 8 s | Three 7×7 grids; two facings on every grid (4–6 each); 80 % look-alikes; full by 8 s |
| **Evidence** | measured: row patched in memory (grids 4×4, 4×4, 5×5; no look-alikes; full by 20 s), kits, 24 deals: average kit 170 (every run finishes; today's Easy 138), great 190, near-perfect 197. Normal's average kit: 141. | | measured: row in memory (6×6, 7×7, 8×8; 8–12 targets; full by 26 s), kits, 48 deals: average kit 48, great 155, near-perfect 179 (one run at 200); flawless taps at 0.4 s score 200 (11–14 s). At 7×7, 8×8, 8×8 the average kit scored 41. | measured: stand-in in memory (three 9×9 grids of 81, since 8 by 10 cannot be dealt; 10–14 targets, 85 % look-alikes, full by 40 s), 48 deals: average kit 34, great 89, near-perfect 169 (2 at 200); flawless taps at 0.4 s score 200 (14–17 s). |

- **Why this curve:** A search game is as hard as the crowd is big, so the first grid runs 16, 25, 36, 80 eagles (to the 45 px ceiling) while look-alikes and a second facing slow every judgement.
- **Fact-check verdict:** adjusted: Hard's grids eased from 7×7, 8×8, 8×8 to 6×6, 7×7, 8×8, because the average kit was only 7 above Expert (41 and 34; now 48, still 14 apart as it finishes neither); the great kit steps 190, 187, 155, 89 and Expert reaches 200, measured as 9×9 because 8 by 10 cannot be dealt today.
- **Human limits today:** Nothing applies the human limits. scripts/attention-levels-check.ts:257 plays its flawless run at 40 ms a step (:304 asserts it scores 200 at every level) and :348-351 asserts the near-perfect kit finishes over half of Expert boards. level-tune.ts --human-limits ignores the flag for puzzles (level-tune.ts:163).
- **Proof:** Answers are counted from the dealt board (scripts/attention-levels-check.ts). Only the 10 speed points are timed: a limits run (0.4 s a tap plus the scan; to be added to scripts/attention-levels-lib.ts) sets each full-by so its best tenth scores 200. Today Hard and Expert are full by 8 s, under the 11 and 13 s their taps alone take (best tenth 189); the check's own 200 is a 40 ms-a-step run.
- **Measured today:** Great / near-perfect kit, 40 seeds: E 184 / 193, N 187 / 196, H 159 / 179, X 148 / 175 (Expert best tenth 166 / 189). Easy scores below Normal for the great kit. Average player: not documented.
- **Stamp:** levelRev 2 on level deals: the grader reads full-by from the level table by level name, so new numbers need a stamp to leave stored level rounds alone. Normal untouched.
- **Files:** `src/lib/levels/attentionLevels.data.ts`, `src/puzzles/symbolScan.tsx`, `src/lib/duel/attentionLevels.ts`, `src/lib/duel/attentionLevels.server.ts`, `src/lib/duel/standard/attention.server.ts`, `scripts/attention-levels-lib.ts`, `scripts/attention-levels-check.ts`
- **Risk:** 45° look-alikes must stay readable on 45 px eagles; an 8 by 10 grid needs a rows setting the square-grid builder does not have (measured as 9×9); and the average kit finishes neither Hard nor Expert, so it sits only 14 apart on them (48 and 34).

### Double Take (`spotdiff`, Attention)

**Lever: Shapes in each picture.** Redesigned. **New mechanic:** Mirrored lower picture, at Expert.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 5×4 pictures (20 shapes, about 70 px each); 4 differences a picture, colour and shape only; no hidden one; 8 misses allowed; 60 s; speed full by 25 s. | 8×6 pictures, 6 differences + a hidden 7th, colour, shape and turn, 5 misses allowed, 60 s, full by 40 s | 8×7 pictures (56 shapes, the ceiling: two stacked panels reach the 36 px floor); 8 differences + the hidden one; subtle colours; 3 misses allowed; 75 s; speed full by 45 s. | 8×7; 10 differences + the hidden one; the lower picture is drawn mirrored left to right (new, announced on the divider); subtle colours; 2 misses allowed; 90 s; speed full by 65 s. |
| First seconds | Two small pictures of twenty big sweets. | | Fifty-six sweets a picture and only three misses allowed. | The lower picture is a mirror image of the upper. |
| Today | 6×5 pictures, 5 differences each, colour and shape only, no hidden one, 5 misses allowed, 60 s, speed full by 30 s | | 8×6, 7 + hidden, subtle colours, 60 s, full by 10 s | 8×8, 8 + hidden, turns twice as common, subtle colours, 75 s, full by 12 s |
| **Evidence** | measured: row patched in memory (5×4, 4 differences), kits, 12 deals: average kit 179 (every run finishes; today's Easy 154), great 183, near-perfect 198. The 8-miss allowance is grader code and was not run. | | measured: row in memory (8×7, 8 + hidden, 75 s, full by 45 s), kits, 24 deals: average kit 52, great 165, near-perfect 185 (5 at 200). Normal: 78, 178, 192. The 3-miss limit is grader code and was not run. | not measured: the mirror is not built. Without it (8×7, 10 + hidden, 90 s; 12 deals) the kits score 52, 161, 185, the same as Hard; in 60 s, full by 45 s (24 deals) 35, 96, 171 and no 200. |

- **Why this curve:** The picture grows until two stacked panels hit the 36 px floor at 8 by 7, and past that the fair, visible step is to mirror the copy, which slows every comparison without hiding anything.
- **Fact-check verdict:** unproven: the mirror is not built, and without it the proposed Expert scores the same as Hard (average kit 52 and 52, near-perfect 185 and 185), so the whole Expert step rests on it; the fallback in risk is replaced by a measured one (10 differences in 60 s: average kit 35).
- **Human limits today:** Nothing applies the human limits. scripts/attention-levels-check.ts:257 plays its flawless run at 40 ms a step (:304 asserts it scores 200 at every level) and :348-351 asserts the near-perfect kit finishes over half of Expert boards. level-tune.ts --human-limits ignores the flag for puzzles (level-tune.ts:163).
- **Proof:** A picture is kept only when its panels differ in exactly the dealt ways (scripts/attention-levels-check.ts); the mirror only remaps places, so the answer is unchanged. A limits run (0.4 s a tap plus a row-by-row compare; to be written in scripts/attention-levels-lib.ts) sets each full-by so its best tenth scores 200. Today's full by 10 s and 12 s leave 3 to 4 s of looking after the taps (best tenth 189).
- **Measured today:** Great / near-perfect kit, 40 seeds: E 185 / 196, N 179 / 188, H 162 / 176, X 150 / 173 (Expert best tenth 171 / 189). Average player: not documented.
- **Stamp:** levelRev 2 on level deals (miss limits and full-by are read from the level table) and a stored mirror flag on Expert deals, through which taps are mapped.
- **Files:** `src/lib/levels/attentionLevels.data.ts`, `src/puzzles/spotTheDifference.tsx`, `src/lib/duel/attentionLevels.server.ts`, `src/lib/duel/attentionRev.ts`, `src/lib/duel/standard/attention.server.ts`, `scripts/attention-levels-lib.ts`, `scripts/attention-levels-check.ts`
- **Risk:** Joe may read the mirror as a gimmick, and nothing can measure it until it is built: without it the proposed Expert scores the same as Hard. The measured fallback Expert is the same 8×7 with 10 differences and the hidden one in 60 s, full by about 50 s (average kit 35, great 96, near-perfect 171 at full by 45 s, where no run in 24 reached 200).

### Tally (`countup`, Attention)

**Lever: Shapes on the tray.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 3 trays of 15, 25, 35 shapes; counts 3–9; each tray asks for one colour or one shape alone; no near-miss groups; marks on; 60 s; speed full by 20 s. | 4 trays of 50, 80, 110, 50 (the last compares two colours); counts 3–19; 2 near-miss groups; tap to mark; 60 s; full by 30 s | 4 trays of 80, 95, 110, 80; counts 8–24; 3 near-miss groups; comparison gap 1–5; marks on; 60 s; speed full by 30 s. | 4 trays of 110 (the most a tray holds); counts 12–26; two-colour questions; 3 near-miss groups; no marks; 75 s; speed full by 35 s. |
| First seconds | Fifteen big shapes; count one colour. | | Eighty shapes on the first tray, counts into the twenties. | A packed tray of 110, two colours, no marks. |
| Today | 3 trays of 25, 40, 55 shapes; counts 3–14; 1 near-miss group; 60 s; speed full by 25 s | | Normal's trays; 3 near-miss groups; a closer comparison (gap 1–5); full by 5 s | Trays of 60, 90, 110, 60; counts 5–21; two-colour questions; no marks; 75 s; full by 35 s |
| **Evidence** | measured: row patched in memory, kits, 100 deals: average kit 98 (29 % finish; today's Easy 88), great 169, near-perfect 190; a flawless run at 0.25 s an item scores 200 in 5–9 s. One colour or one shape alone is generator code, not run. | | measured: row in memory at 60 s, full by 30 s, 100 deals: average kit 29, great 128, near-perfect 173; flawless limits run 200 on all 100 (17–26 s). At the first proposal's 75 s and 45 s the near kit scored 183, the same as Normal (12 deals). | measured: row in memory at 75 s, full by 35 s, 100 deals: average kit 6, great 78, near-perfect 147 (best 200, one run); flawless limits run 200 on all 100 (19–28 s). At 90 s and 60 s the near kit scored 181, the same as Hard (12 deals). |

- **Why this curve:** Counting gets harder with the crowd and the size of the count, so both rise every level to the 110-shape ceiling and only Expert loses the marks, where today's Hard is a 5-second speed target nobody can see or meet.
- **Fact-check verdict:** adjusted: Hard's clock and full-by cut from 75 and 45 s to 60 and 30 s and Expert's from 90 and 60 s to 75 and 35 s, because at the proposed times the near-perfect kit scored the same on Normal, Hard and Expert (183, 183, 181); now the average kit steps 98, 59, 29, 6 and the near-perfect kit 190, 184, 173, 147, with 200 reached at Expert.
- **Human limits today:** Nothing applies the human limits. scripts/attention-levels-check.ts:257 plays its flawless run at 40 ms a step (:304 asserts it scores 200 at every level) and :348-351 asserts the near-perfect kit finishes over half of Expert boards. level-tune.ts --human-limits ignores the flag for puzzles (level-tune.ts:163).
- **Proof:** Each answer is counted from the dealt tray (scripts/attention-levels-check.ts). A limits run (about 0.25 s an item counted and 0.4 s a key; to be written in scripts/attention-levels-lib.ts) sets each full-by so its best tenth scores 200: a scratch run at that pace finished every one of 100 Hard deals in 17–26 s and every Expert deal in 19–28 s, inside the 30 s and 35 s full-bys, and scored 200 on all of them. Today's Hard is full by 5 s, under the 12–22 s that run needs (it scores 185–193).
- **Measured today:** Great / near-perfect kit, 40 seeds: E 166 / 192, N 162 / 185, H 125 / 169, X 115 / 160 (Expert best tenth 183 / 200). Average player: not documented. No contact sheet exists for Tally.
- **Stamp:** levelRev 2 on level deals: full-by is read from the level table by level name; the trays themselves are in the dealt board.
- **Files:** `src/lib/levels/attentionLevels.data.ts`, `src/puzzles/countUp.tsx`, `src/lib/duel/attentionLevels.server.ts`, `src/lib/duel/standard/attention.server.ts`, `scripts/attention-levels-lib.ts`, `scripts/attention-levels-check.ts`
- **Risk:** 110-shape trays with counts in the twenties leave few clear colours; the spread already re-deals trays it cannot make legible. The kits' miscount chance does not fall with the size of the tray, so they cannot show Easy's welcome (average kit 98, 29 % finish).

### Labyrinth (`maze`, Attention)

**Lever: Steps to walk.** Redesigned. **New mechanic:** Gold keys to collect before the exit opens: 2 at Hard, 4 at Expert.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today (13×15, route 40–70, 4 dead ends, 60 s, full by 20 s): it already does its job, the great kit averages 196 on 28 px corridors. | 19×23, route 70–147, 8 dead ends (3 long), 60 s, full by 32 s, par points gone at 1.5× par | 21×27 (17 px corridors, the finest a finger can trace); 2 gold keys at the ends of long dead ends, fetched in either order before the exit opens, placed so the shortest walk is 200–250 steps; 75 s; speed full by 55 s; par points gone at 1.5× par (Normal's rule). | 21×27; 4 keys, one in each quarter, placed so the shortest walk is 320–390 steps; the exit shown from the start (today's hidden exit goes); 105 s; speed full by 85 s; par points gone at 1.25× par. |
| First seconds | A small maze with wide corridors. | | A fine maze with two gold keys and a locked exit. | Four keys in four corners; par above 320. |
| Today | 13×15 maze, route 40–70, 4 dead ends, 60 s, speed full by 20 s | | 21×27, route 120–180, 12 dead ends (5 long), 75 s, full by 15 s, par points gone at 1.03× par | 21×27, route 150–240, exit hidden until 4 squares away, 90 s, full by 20 s |
| **Evidence** | measured: today's Easy kept, kits, 12 deals: average kit 162 (83 % finish), great 196, near-perfect 199; a flawless walk at 0.2 s a square scores 200 (14–17 s). Normal's average kit: 63. | | not measured: the keys are not built. Tree distances on 16 of today's Hard mazes: two keys at the two deepest dead ends make the walk 222–372 steps (median 318), 49–79 s at 0.2 s a square, past the 55 s full-by on most. | not measured: the keys are not built. On 16 of today's 21×27 mazes the deepest dead end in each quarter makes the walk 340–541 steps (75–115 s, past the 105 s clock on some); the farthest in each quarter 256–443 (58–96 s). |

- **Why this curve:** The maze is already as fine as a finger can trace at 21 by 27, so the walk is lengthened the way mazes always have been, with keys to fetch, which shows at a glance and hides nothing, unlike today's hidden exit.
- **Fact-check verdict:** unproven: the keys are a new mechanic and no kit can play them; the walk ranges are narrowed from 200–260 and 320–400 to 200–250 and 320–390 steps, with keys placed for the walk length, because keys at the deepest dead ends gave 222–372 and 340–541 steps, past the full-by and the clock.
- **Human limits today:** Nothing applies the 0.25 s and 0.15 s limits. scripts/attention-levels-check.ts:338-340 asserts personMazeSeconds (scripts/attention-levels-lib.ts:77, 0.2 s a square, 3 s to look, 1 s a pick) reaches Expert's hidden exit inside the 90 s clock on 75 % of mazes, not inside the 20 s full-by; :257 plays the flawless run at 40 ms a step (:304 asserts 200); :348-351 asserts the near-perfect kit finishes over half of Expert mazes.
- **Proof:** A perfect maze has one path between any two squares, so the shortest key tour is exact (tree distances over at most 24 orders) and becomes the par. personMazeSeconds in scripts/attention-levels-lib.ts (0.2 s a square, reading the walls) must be extended to tour the keys and finish every dealt Hard and Expert maze inside its full-by, which makes 200 reachable; a maze it cannot is redrawn. At that pace 250 steps take 55 s and 390 steps 85 s. Measured on 16 of today's 21×27 mazes (tree distances only): keys at the two deepest dead ends make the walk 222–372 steps and the deepest dead end in each quarter 340–541, so the keys must be placed for the walk length. Today's full by 15 s and 20 s sit far under that solver's 36–71 s (a flawless walk at 0.2 s a square scores 188–193 on today's Hard and Expert).
- **Measured today:** Great / near-perfect kit, 40 seeds: E 196 / 199, N 184 / 196, H 158 / 176, X 150 / 169 (Expert best tenth 162 / 189); the person-like solver reaches the hidden exit in 36–71 s. Average player: not documented.
- **Stamp:** mazeRev 6 on Hard and Expert deals (the exit counts only once every key is held; par is the key tour); Easy and Normal keep mazeRev 5; levelRev 2 for the new full-by times.
- **Files:** `src/lib/levels/attentionLevels.data.ts`, `src/lib/duel/maze.server.ts`, `src/lib/duel/maze.ts`, `src/lib/duel/depth/labyrinth.ts`, `src/lib/duel/standard/attention.server.ts`, `src/puzzles/mazeDash.tsx`, `scripts/attention-levels-lib.ts`, `scripts/attention-levels-check.ts`
- **Risk:** Where the keys go decides the level: at the deepest dead ends the walk runs past the full-by and, at Expert, past the clock, so the generator must place them for the walk length; and choosing the key order on 17 px corridors may decide the score more than the walking does.

### Bomb Defusal (`bomb`, Attention)

**Lever: Steps and clues on the card.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today (5 wires, 4 steps, 4 clues, 90 s, full by 25 s): it already does its job, the great kit averages 197. | 7 wires, 6 steps, 6–9 clues, 90 s, full by 30 s | 8 wires, 8 steps, 8–9 clues (today's Expert card) with Reset kept and at most two 'Step N' clues; 105 s; speed full by 55 s. | The same 8-wire, 8-step card (a 390 px phone is full at 8 wires and 9 clues); at most one 'Step N' clue, the rest relative; the first wrong step explodes and there is no Reset (as today); 120 s; speed full by 70 s; only cards the person-style solver cracks within 40 orders. |
| First seconds | Five wires and a four-line card. | | Eight wires and a card of eight or nine clues. | No Reset button: one wrong step sets it off. |
| Today | 5 wires, 4 steps, 4 clues, 90 s, speed full by 25 s | | 7 wires, 7 steps, 7–8 clues, 90 s, full by 15 s | 8 wires, 8 steps, 8–9 clues, the first wrong step explodes, no Reset, 120 s, full by 40 s |
| **Evidence** | measured: today's Easy kept, kits, 24 deals: average kit 138 (71 % finish), great 200, near-perfect 194; at a person's pace (2.5 s a clue, 1 s an order tried, 0.4 s a step) 23 of 24 score 200. Normal's average kit: 93. | | measured: today's Expert cards dealt in memory as Hard (Reset kept, 105 s, full by 55 s), kits, 24 deals: average kit 0, great 80, near-perfect 180 (2 at 200); person's pace 200 on 21 of 24. 50 of today's 120 cards have two Step clues or fewer. | measured: 120 s, full by 70 s in memory, 24 deals: average kit 0, great 56, near-perfect 156 (13 at 200). Only 4 of today's 120 Expert cards have at most one Step clue and crack within 40 orders; on those the near kit scores 122 (6 of 17 at 200). |

- **Why this curve:** A bomb is harder with more to read and reason about, so the card grows until the phone is full at 8 wires and 9 clues, and Expert then takes away the safety net and the give-away 'Step N' clues instead of shrinking the type.
- **Fact-check verdict:** unproven: the great and near-perfect kits step down as designed (Normal 178 and 194, Hard 80 and 180, Expert 56 and 156) and Expert reaches 200, but only 4 of today's 120 Expert cards pass the proposed Expert filter, so a full bank of such cards is not shown to exist; the average kit scores 0 on every 7- or 8-step card, today's Hard included, at 105 s and 120 s alike.
- **Human limits today:** Nothing applies the 0.25 s and 0.15 s limits. scripts/attention-levels-check.ts:335-337 asserts personBombTries (scripts/attention-levels-lib.ts:11) cracks every Expert bank card within 400 orders tried, with no clock; :257 plays the flawless run at 40 ms a step (:304 asserts 200); :348-351 asserts the near-perfect kit finishes over half of Expert cards.
- **Proof:** Each level deals from its own bank (scripts/bomb-levels-bank.ts, src/lib/duel/bombLevels.server.ts), every card proved by search over all orders to have one answer with every clue needed. personBombTries in scripts/attention-levels-lib.ts must crack every Hard and Expert card within 40 orders tried in the head, and each full-by is set from that pace (about 2.5 s a clue read, 1 s an order, 0.4 s a step) so 200 is reachable. Today's Hard is full by 15 s, less than the time to read its card.
- **Measured today:** Great / near-perfect kit, 40 seeds: E 197 / 200, N 182 / 194, H 113 / 168, X 72 / 136 (Expert best tenth 176 / 189); the person-like solver cracks every Expert card (median 19 orders, at most 99). Average player: not documented.
- **Stamp:** levelRev 2 on level deals (full-by is read from the level table) and rebuilt Hard and Expert banks; Expert keeps its stored bombInstant flag.
- **Files:** `src/lib/levels/attentionLevels.data.ts`, `src/lib/duel/bombLevels.server.ts`, `scripts/bomb-levels-bank.ts`, `src/lib/duel/bombLevelsBank.server.ts`, `src/lib/duel/standard/logic.server.ts`, `scripts/attention-levels-lib.ts`, `scripts/attention-levels-check.ts`
- **Risk:** Only 4 of today's 120 Expert cards have at most one Step clue and crack within 40 orders (50 have two or fewer), so the rebuilt banks may be slow to fill; Expert's proof already takes about 25 s a card. The average kit scores 0 on every 7- or 8-step card at any clock, so only stronger players can show the Hard and Expert steps.

### Don’t Break the Chain (`chain`, Speed)

**Lever: Charms in the cycle.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 4 charms in the cycle and a new board every 4 links; 24 links; windows 4 / 3.5 / 3 s; no reversed board; one spare link (the first wrong or late tap is forgiven); 45 s; speed full by 25 s. | 40 links, 5-charm cycle, a new board every 5 links, windows 3 / 2.5 / 2 s, links 21–25 reversed, 45 s | 6 charms and a new board every 6 links; 48 links; windows 2.5 / 2 / 1.6 s; two reversed boards; 60 s; speed full by 42 s. The board stays at 20 charms, its ceiling. | 7 charms and a new board every 7 links (needs a fourth charm shape: today's three shapes, two of each at most, stop at six); 56 links; windows 2 / 1.6 / 1.4 s (the human floor); three reversed boards; 70 s; speed full by 50 s. |
| First seconds | Four charms in the strip and a spare-link pip. | | Six charms in the strip, and 0 / 48 links. | Seven charms in the strip, and 0 / 56 links. |
| Today | 30 links, 5-charm cycle, windows 3.5 / 3 / 2.5 s, no reversed run, 45 s | | 40 links, 5 charms, windows 2.5 / 2 / 1.6 s, reversed 21–25 and 31–35, 45 s | 50 links, 6 charms, windows 2 / 1.6 / 1.4 s, reversed 21–25 and 36–40, 60 s |
| **Evidence** | not measured: a 4-charm cycle needs a board every 4 links (CHAIN_BLOCK is a constant 5) and the spare link is new code; on today's 5-link boards every run broke at link 5 (22 points). | | measured: stand-in in memory (6 charms, 48 links, boards every 5 links, full by 42 s), playChain, 400 deals: limits 145–148 (60 % finish, every finisher 200), 140 ms elite 171; Normal 156. Windows 0.3 s tighter moved it under 6 points. | measured: stand-in in memory (6 charms, as 7 cannot be dealt; 56 links, windows 2 / 1.6 / 1.4 s, full by 50 s), 400 deals: limits 121, median 102, best tenth 200, 38 % finish; 140 ms elite 165. Today's Expert: 115, best 184. |

- **Why this curve:** The cycle is what the player has to hold in mind, and four fits in a glance where seven does not, so a charm is added every level while the tap windows only fall to the human floor of 1.4 s.
- **Fact-check verdict:** adjusted: a 7-charm cycle cannot be dealt today (three shapes, two of each, give six), so Expert now names the fourth charm shape and stamp it needs; Hard sits only about 10 below Normal for the limits player and tighter windows do not widen it; the average kit scores about 15 at every level, Normal included, so its steps cannot be judged.
- **Human limits today:** scripts/speed-levels-tune.ts:83 playChain (the same 250 ms and 150 ms action, :48-52, plus 320 ms to find a charm; a link past its window breaks the chain) under the tool's HUMAN_LIMITS (:32); scripts/speed-levels-check.ts:215-220 asserts the step rules on 100 deals (Expert's best tenth at least 140; it is 182). Nothing asserts 200.
- **Proof:** Open (find and tap in time). playChain in scripts/speed-levels-tune.ts under HUMAN_LIMITS (0.4 s a tap, about 0.32 s to find a charm, more on a new or reversed board) must finish Expert's 56 links in its best tenth inside the stamped full-by, which is 200; scripts/speed-levels-check.ts pins it. Measured with 6 charms standing in for 7 (400 deals): 38 % of limits runs finish, in about 47 s, and every finisher scores 200. Today full-by is 30 s at every level, so no limits run reaches 200 at Normal, Hard or Expert (best 197, 196, 184).
- **Measured today:** Elite held to human limits 174 / 160 / 141 / 119 (Expert best tenth 182); 140 ms elite 180 / 175 / 174 / 165. Speed is full by 30 s at every level. Average player: not documented.
- **Stamp:** chainCycleRev 2 on Expert deals for the fourth charm shape and the 7-charm board (7 rule charms and 13 near misses on the 20 charms); level field only for the rest: chainLevel gains cycle, block, spare and fullByS, all stamped on the puzzle and read by the stage, replayChain and the grader.
- **Files:** `src/lib/levels/speedLevels.ts`, `src/lib/duel/chain.ts`, `src/lib/duel/chain.server.ts`, `src/lib/duel/standard/attention.server.ts`, `src/puzzles/chainTap.tsx`, `scripts/speed-levels-tune.ts`, `scripts/speed-levels-check.ts`, `src/lib/duel/types.ts`
- **Risk:** A link slower than its window ends the run, so a tenth of a second on the last window swings Expert from fair to unfinishable. The 7th charm needs a new charm shape and a generator rule (generateChain never returns for 7 today); the fallback Expert is 6 charms with 56 links.

### Matchmaker (`pairmatch`, Attention)

**Lever: Cards on the board.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today (8 pairs, 16 cards in 4 columns, flip-back 0.9 s, 90 s, full by 35 s): it already does its job, the great kit averages 197. | 15 pairs (30 cards, 5 columns), flip-back 0.6 s, 6 shapes, 90 s, full by 60 s, 14 free misses | 21 pairs (42 cards, 6 × 7); flip-back 0.5 s; 5 shapes; 90 s; speed full by 40 s; extras in full with up to 3 memory misses (a miss on a card whose partner was already seen) and none from 9; first looks never count. | 28 pairs (56 cards, 7 × 8, about 47 px wide: the phone's ceiling); flip-back 0.4 s; all 6 shapes (28 of the 30 faces); 90 s; speed full by 48 s; extras in full with up to 2 memory misses and none from 6; gold pair window 45 s. |
| First seconds | Sixteen big cards. | | Forty-two cards, six across and seven down. | Fifty-six small cards fill the whole screen. |
| Today | 8 pairs (16 cards, 4 columns), flip-back 0.9 s, 90 s, speed full by 35 s, 7 free misses | | 18 pairs (36 cards, 6 columns), 0.5 s, 4 shapes, 90 s, extras in full up to 6 misses and none from 14 | 21 pairs (42 cards, 6 × 7), 0.4 s, 5 shapes, 120 s, full by 75 s, extras 6 / 14 |
| **Evidence** | measured: today's Easy kept, kits, 24 deals: average kit 174 (every run finishes), great 197, near-perfect 197; a perfect-memory sweep at 0.4 s a flip scores 195–200. Normal's average kit: 86. | | measured: row in memory (21 pairs, 90 s, full by 40 s; extras in full, as the memory-miss rule is grader code), kits, 48 deals: average kit 39, great 182, near-perfect 193; a perfect-memory sweep at 0.4 s a flip scores 197–200 in 26–29 s. | measured: row in memory (28 pairs in 7 columns, 90 s, full by 48 s; extras in full), 48 deals: average kit 21, great 166 (every run finishes, median 76 s), near-perfect 188 (4 at 200); perfect-memory sweep 183–200 (29 at 200) in 33–38 s. |

- **Why this curve:** Memory load is the number of cards, so the board grows about 1.4 times a level to the phone's ceiling of 56, where today's 30, 36 and 42 are too close to tell apart.
- **Fact-check verdict:** adjusted: clocks and full-bys tightened (Hard 105 and 60 s to 90 and 40 s; Expert 120 and 80 s to 90 and 48 s), because at the proposed times the average kit was only 10 apart on Hard and Expert (41 and 31; now 39 and 21) and strong kits scored about 190 on both; the memory-miss rule is grader code and stays unproven; 56 cards are finishable and 200 is reached at Expert.
- **Human limits today:** Nothing applies the human limits. scripts/attention-levels-check.ts:257 plays its flawless run at 40 ms a step, pairing every card unseen (:304 asserts it scores 200 at every level), and :348-351 asserts the near-perfect kit finishes over half of Expert boards. level-tune.ts --human-limits ignores the flag for puzzles (level-tune.ts:163).
- **Proof:** Every face is dealt twice. A perfect-memory sweep under the limits (0.4 s a flip; to be written in scripts/attention-levels-lib.ts) must finish each dealt Hard and Expert board inside its full-by with no memory miss and the gold pair in its window, or the board is redrawn: that run is 200. A scratch sweep finished 48 Hard boards in 26–29 s and 48 Expert boards in 33–38 s, inside the 40 s and 48 s full-bys, and scored 200 on 32 and 29 of them with extras in full. Today 200 is luck on Hard and Expert: extras need 6 or fewer misses, and the same sweep scores 162–182 and 150–169 there; the check's 200 pairs every card unseen.
- **Measured today:** Great / near-perfect kit, 40 seeds: E 197 / 197, N 192 / 199, H 154 / 165, X 151 / 153 (Expert best tenth 156 / 165). Average player: not documented.
- **Stamp:** levelRev 2 on level deals: the extras rule (memory misses), full-by and gold window are read from the level table.
- **Files:** `src/lib/levels/attentionLevels.data.ts`, `src/lib/duel/attentionLevels.ts`, `src/lib/duel/pairmatch.ts`, `src/lib/duel/standard/attention.server.ts`, `src/lib/duel/attentionLevels.server.ts`, `src/puzzles/pairMatch.tsx`, `scripts/attention-levels-lib.ts`, `scripts/attention-levels-check.ts`
- **Risk:** The memory-miss rule is grader code and was not measured; with extras in full the near-perfect kit still scores about 190 on Hard and Expert alike, so that rule has to carry the step for strong players. 56 cards are finishable: the great kit finished every board in a median 76 s, which leaves about 14 s on the 90 s clock.

### Bonk (`whack`, Speed)

**Lever: Burrows on the lawn.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 3×3 lawn (9 burrows, about 125 px each); up 1.5 to 1.1 s and pops 140 % apart (today 1.1 to 0.8 s and 115 %); 2 up at once, 2 rule flips, 5 % hedgehogs (as today). | 4×4 lawn, up 0.9 to 0.6 s, 3 up at once, 3–5 rule flips, 10 % hedgehogs, 60 s | 5×5 lawn (25 burrows, about 72 px); 4 up at once; up 0.9 to 0.6 s (Normal's own up-time: the bigger, busier lawn is the step); pops 60 % apart (about 110 gophers to bonk); 5–7 flips; 15 % hedgehogs. | 6×6 lawn (36 burrows, about 58 px); 5 up at once; up 0.67 to 0.5 s (the floor: 0.25 s to react, 0.15 s to move, 0.1 s spare); pops 45 % apart (about 140 to bonk); 7–9 flips; 20 % hedgehogs. |
| First seconds | A 3 by 3 lawn of nine big burrows. | | A 5 by 5 lawn: 25 burrows, four gophers up. | A 6 by 6 lawn: 36 burrows, five up at once. |
| Today | 4×4 lawn, up 1.1 to 0.8 s, 2 up at once, 2 rule flips, 5 % hedgehogs, pops 115 % apart, 60 s | | 4×4, up 0.72 to 0.5 s, 3 up, 5–7 flips, 15 % hedgehogs, pops 50 % apart | 4×4, up 0.67 to 0.45 s, 4 up, 7–9 flips, 20 % hedgehogs, pops 50 % apart |
| **Evidence** | measured: pace in memory on today's 4×4 lawn (3×3 needs sim code), kits, 40 deals: average kit 89 at up 1.5–1.1 s and pops 140 % apart (81 at today's Easy pace), limits 148 (best 156). A scratch limits oracle scores 156 on every deal. | | measured: pace and crowd in memory on 4×4 (5×5 needs sim code), 40 deals: average kit 20 at up 0.9–0.6 s (5 at the first proposal's 0.72–0.5 s), limits 142 (best 156). Normal: 71 and 144. Oracle: every gopher in reach on all deals. | measured: proposed pace on 4×4 (6×6 needs sim code), 60 deals: average kit 1, limits 130 (best 154), elite 188; oracle 146–156, every gopher and both diamonds in reach on 19 of 60 deals, median 140 gophers. No run can pass 156. |

- **Why this curve:** A bigger lawn is the classic whack-a-mole step, seen before the first gopher pops, and it is the lever left because up-time is already at the human floor of half a second.
- **Fact-check verdict:** adjusted: Easy's up-time lengthened to 1.5–1.1 s with pops 140 % apart and Hard's set back to Normal's 0.9–0.6 s, so the average kit steps 89, 71, 20, 1 (it was 81, 71, 5, 1); the lawn itself is unproven (it needs sim code and no bot can feel it), Expert's count corrected to about 140 gophers, and no level can pass 156 under the limits.
- **Human limits today:** scripts/speed-levels-tune.ts:162 plays the Bonk kit (scripts/puzzle-fairness/kits-engine.ts:533-571) at the tool's HUMAN_LIMITS skill (:32): 250 ± 25 ms to react plus about 110 ms to check the colour, the finger about 154 ms between taps (kits-engine.ts:552); scripts/speed-levels-check.ts:215-220 asserts the step rules on 100 deals (Expert's best tenth 143 against 140). No oracle exists and nothing asserts 200. level-tune.ts --human-limits throws for Bonk: there is no scripts/arcade-skill-bands/bots/whack.ts.
- **Proof:** Must be written: a limits oracle (a bonk no sooner than 24 ticks after its pop, 15 to react and 9 to move, and 9 after the last bonk, earliest deadline first) plays every dealt schedule through replayWhackRun; the deal keeps a seed only when it clears every gopher and both diamonds (measured with a scratch oracle on the proposed Expert pace: 19 of 60 deals). That proves the 150 base and 6 for diamonds. The 44 combo points need bonks within 150 ms of the pop (none count from 267 ms), so the limits player tops out at exactly 156 on every level, Normal included (166 if moving cost nothing; today's best tenth 143): 200 needs the combo's quick window at the limit (full to 24 ticks, none from 36, the window Pull! was given in clayRev 10), a scoring-review item like I1 that is not in the plan's list.
- **Measured today:** Elite held to human limits 148 / 146 / 140 / 129 (Expert best tenth 143); 140 ms elite 194 / 194 / 191 / 190. The contact sheet's seed deals 47 / 64 / 132 / 126 gophers to bonk, so Expert has fewer than Hard. Average player: not documented.
- **Stamp:** Level field only for the lawn and pace (bonkLevel gains cols, stamped on the puzzle); 200 under the limits also needs whackRev 5 for the combo's quick window (Joe's scoring decision).
- **Files:** `src/lib/levels/speedLevels.ts`, `src/lib/arcade/whack.ts`, `src/lib/arcade/whack.renderer.ts`, `src/puzzles/whack.tsx`, `src/lib/duel/whack.ts`, `scripts/speed-levels-tune.ts`, `scripts/speed-levels-check.ts`
- **Risk:** The combo's quick window, not the level, caps a limited player at 156 on every level (150 base, 6 for diamonds, 0 of the 44 combo points): level design cannot lift that, so 200 at Expert waits on a scoring change (whackRev 5). The bots move in a flat 0.15 s, so they cannot feel a bigger lawn, and the average kit already scores about 1 at today's Hard and Expert up-times.

### Tenfall (`tendrop`, Speed)

**Lever: Size of the targets.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today (8 targets from 10 up to 60, plus and minus tiles only, 80 % speed), but each gold ten pays 2.5 so a flawless run is 200 (today 8 gold tens at 2 make 196). | 10 targets from 19–25 up to 140, ×2, ÷2, ÷3 and minus tiles, fall speeds 288 to 504, 90 s, speed full by 60 s | 10 targets from 40 up to 250 (today's Hard opens below Normal); ×2 on about 30 % of tiles, ÷2 and ÷3 as today's Hard; 115 % speed; speed full by the oracle's finish. | 9 targets from 150 up to 400; every operator; 115 % speed (at 125 % the limits player never finished); gold pays 20 ÷ 9 a ten; speed full by the oracle's finish. |
| First seconds | Target 10, slow tiles, only numbers and minus. | | Target 40 or more at once; gold ×2 tiles everywhere. | Target 150 or more straight away, climbing to 400. |
| Today | 8 targets up to 60 (the first 10–12), plus and minus tiles only, 80 % speed, 90 s | | 10 targets up to 200 (the first 14–20), ÷3 tiles doubled, 115 % speed | 11 targets up to 240 (the first 15–22), every operator evenly, 115 % speed |
| **Evidence** | measured: today's Easy (the 2.5-a-gold pay needs scoring code), kits, 48 deals: average kit 160 (88 % finish), limits 183, 140 ms elite 183, best 190. Today's 8 gold tens allow 196 at most. | | measured: stages overridden in memory (10 targets from 40 to 250, ×2 on 30 % of tiles, 115 %), 48 deals: average kit 72, limits 154 (83 % finish, best 172), 140 ms elite 171. Normal: 101 and 175. | measured: stages in memory (9 targets from 150 to 400, every operator, 115 %), kits, 48 deals: average kit 51, limits 119 (21 % finish, at 87 s of 90; best 158), 140 ms elite 147. From 100: average 56–59, limits 125–129. No run reached 200. |

- **Why this curve:** The target is the whole question the game asks, so bigger targets from the first second (10, 22, 40, 150) are the honest ladder, and tile speed stays at 115 % because that is where the human limit was measured.
- **Fact-check verdict:** adjusted: Expert's first target raised from 100 to 150 so the average kit steps 160, 101, 72, 51 (from 100 Expert scored 56–59, about 14 below Hard); Expert's 200 is unproven: no bot reaches 200 at any level today, the limits kit finishes 21 % of Expert runs at the buzzer, and the oracle and the gold and speed pay are not written.
- **Human limits today:** scripts/speed-levels-tune.ts:162 plays the Tenfall kit (tenDropKit in scripts/puzzle-fairness/kits-engine.ts) at the tool's HUMAN_LIMITS skill (:32); scripts/speed-levels-check.ts:215-220 asserts the step rules on 100 deals (Expert's best tenth 163 against 140). Nothing proves a finish or 200 under the limits. level-tune.ts --human-limits throws for Tenfall: there is no scripts/arcade-skill-bands/bots/tendrop.ts.
- **Proof:** Must be written: the plan's own solver (the fastest gold line, src/lib/arcade/tenDrop.ts) run at the level's spawn gap under the limits (a tile tappable 24 ticks after it enters, taps 9 ticks apart) gives each seed's earliest finish through replayTenDropRun; the deal keeps a seed only when that lands inside the level's full-speed time, so 150 + 30 + 20 is reachable. Today nothing proves it: full speed is by 60 s at every level and Expert's best tenth under the limits is 163.
- **Measured today:** Elite held to human limits 182 / 175 / 168 / 143 (Expert best tenth 163); 140 ms elite 183 / 181 / 181 / 166. Average player: not documented.
- **Stamp:** Level field only: tenLevel.stages already carries each target's range, tiles and speed; add goldEach and fullByTicks to tenLevel, stamped on the puzzle.
- **Files:** `src/lib/levels/speedLevels.ts`, `src/lib/arcade/tenDrop.ts`, `src/lib/duel/tenDrop.ts`, `scripts/speed-levels-tune.ts`, `scripts/speed-levels-check.ts`
- **Risk:** No bot reaches 200 at any level today (best 190), and at the proposed Expert the limits kit finishes 21 % of runs, at 87 s of 90 (31–44 % when the targets start at 100), so 200 there rests wholly on the unwritten oracle and on speed and gold pay that are scoring changes; targets near 400 may be too much mental arithmetic at tile speed even for strong players, so tune the top target first.

### Pull! (`clayshoot`, Speed)

**Lever: Clays in the air together.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today (20 clays, 3 doubles at the end, 6 birds, 80 % speed) plus a bigger hit ring: 38 px against 30. | 25 clays (22 orange, 3 gold): 11 singles then 7 doubles, 14–16 birds, 30 px hit ring, 60 s | 30 clays, all in doubles from the first pull (15 doubles; Normal flies 11 singles first); 145 % speed; 24 birds. | 36 clays, all in triples from the first pull (12 triples, clays at least 0.2 s apart); 160 % speed (the ceiling: a clay must stay 0.6 s on screen); 32 birds. |
| First seconds | One slow clay at a time in a big ring. | | Two fast clays cross on the very first pull. | Three clays at once among a sky of birds. |
| Today | 20 clays, 3 doubles after the singles, 6 birds, 80 % speed, 60 s | | 28 clays, 10 doubles, 24 birds (some together), 145 % speed | 30 clays, 12 groups with 3 triples, 32 birds, 160 % speed |
| **Evidence** | measured: today's Easy with the hit radii patched in memory (38 px for 30, gold 30 for 24), kits, 48 deals: average kit 105 (96 today; 10 % finish), limits 181, 140 ms elite 200. A clean average sweep still scores about 132. | | measured: registry settings overridden in memory (30 clays in 15 doubles, 145 %, 24 birds), 24 deals: average kit 56, limits 164 (79 % finish, best 187), 140 ms elite 198. Normal: 76 and 178. | measured: in memory (36 clays in 12 triples, 160 %, 32 birds), 24 deals: average kit 40, limits 144 (33 % finish, best 183, no 200), 140 ms elite 195 (7 of 24 at 200). Launches inside a group are 25–43 ticks apart. |

- **Why this curve:** Singles, doubles, triples is how clay shooting itself gets harder and it shows on the first pull, which matters because clay speed tops out at 160 %.
- **Fact-check verdict:** unproven: Hard and Expert step down as designed (average kit 76, 56, 40; limits 178, 164, 144), but no limits run reached 200 at Expert (best 183) and the oracle that would prove it is not written; Easy's bigger ring lifts the average kit only from 96 to 105.
- **Human limits today:** scripts/speed-levels-tune.ts:162 plays the Pull! kit (clayKit in scripts/puzzle-fairness/kits-engine.ts) at the tool's HUMAN_LIMITS skill (:32); scripts/speed-levels-check.ts:215-220 asserts the step rules on 100 deals (Expert's best tenth 175 against 140). No oracle exists and nothing asserts 200. level-tune.ts --human-limits throws for Pull!: there is no scripts/arcade-skill-bands/bots/clayshoot.ts.
- **Proof:** Must be written: a limits oracle (a shot no sooner than 24 ticks after its clay's launch, 15 to react and 9 to move, and 9 after the last shot, never through a bird) plays every dealt schedule through replayClayRun; the deal keeps a seed only when it hits every clay inside its quick window with the streak unbroken, which is 200. The quick window is full to 24 ticks (0.4 s), exactly the limit with nothing spare, so today's limits player's best tenth is 175; the oracle fires on tick 24, and a real player needs the window at 27 ticks (a small scoring-review item, clayRev 11).
- **Measured today:** Elite held to human limits 181 / 170 / 162 / 152 (Expert best tenth 175); 140 ms elite 199 / 199 / 198 / 196. Average player: not documented.
- **Stamp:** Level field only: pullLevel already carries clays, singles, groups, birds and speed; add the ring radius (Easy) and the smallest gap inside a group, stamped on the puzzle.
- **Files:** `src/lib/levels/speedLevels.ts`, `src/lib/arcade/clayShoot.ts`, `src/lib/arcade/clayShoot.renderer.ts`, `src/lib/duel/clayShoot.ts`, `scripts/speed-levels-tune.ts`, `scripts/speed-levels-check.ts`
- **Risk:** 32 birds across triples may leave few seeds with a clean shot inside every quick window; the oracle drops the rest. Easy cannot reach 150 for an average player by level settings alone: a clean sweep by the average kit scores about 132, because the quick-shot points need a shot inside 0.4 s.


## Pattern and Logic (session D4)

### Gridlock (`unblock`, Pattern)

**Lever: Lot size and cars.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 6×6 lot, 6–8 cars (today 8–10), 5–9 moves at the minimum (today 6–12), 60 s, full speed by 40 s | 7×7 lot, 10–13 cars, 15–22 moves, 60 s, full speed by 40 s (unblockRev 4) | 8×8 lot (46 px bays), 15–18 cars, 22–30 moves at the minimum, 75 s, full speed by 35 s | 9×9 lot (40 px bays on a 390 px phone), 20–24 cars, 36–44 moves, 110 s, full speed by 45 s. Ceiling: 9 across (10 would be 36.6 px, too small to drag a two-bay car); after it the lever is the line's length |
| First seconds | A small, half-empty lot with the gold car nearly out | | A bigger 8×8 lot packed with fifteen or more cars | A 9×9 lot, wall to wall with over twenty cars |
| Today | 6×6 lot, 8–10 cars, 6–12 moves at the minimum, 60 s, full speed by 40 s | | 7×7 lot, 12–14 cars, 22–30 moves, 60 s, full speed by 28 s | 7×7 lot, 13–15 cars, 40–48 moves, 90 s, full speed by 30 s |
| **Evidence** | measured: 6×6, 6–8 cars, 5–9 moves built by the bank builder with settings patched in memory, 16 boards: average kit 175.8 (15/16 finished; today's Easy 154.2, 10/12), near-perfect under limits 200 on all 16; person-like solver 16/16 in 5–10 s | | measured: 8×8, 15–16 cars, 22–30 moves, 75 s, 3 boards (7–122 s each to build): average kit 28.3, 0/3 finished (Normal 51.2 on 12 deals), near-perfect under limits 200 on 3/3; person-like solver 3/3 in 30–49 s, avg 192 | not measured: src/lib/duel/types.ts:935-938 reads cols 9 as 7, and scripts/unblock-levels-bank.ts:107 packs one base-8 digit a vehicle into a float (17 vehicles at most; 21-25 need 63-75 bits), so a 9x9 lot cannot be built, dealt or graded |

- **Why this curve:** Hard and Expert today are Normal's 7×7 lot with a longer hidden line (par 29 against 40 is the only thing that differs on screen), so the step moves onto what the player sees, the lot and the cars, and the line's length backs it up.
- **Fact-check verdict:** unproven: Easy (175.8) and an 8×8 Hard (28.3 against Normal's 51.2) measure as proposed on few boards, but the 9×9 Expert cannot be built, dealt or graded by today's code, and 17 or more cars break the bank builder's key.
- **Human limits today:** No 0.25 s / 0.15 s limit anywhere. scripts/unblock-human.ts:22-26 has its own time model (0.9 s a slide, thinking calibrated so Normal's median board takes 35 s); it is a tool, and pattern-overhaul-unblock-levels-check.ts never calls it (it proves minimums by BFS). Re-run here: 40 deals Hard 73 %, Expert 70 % finished; whole Expert bank 88/120 (73 %) inside 90 s, a line found on 120/120.
- **Proof:** A bank of 120 per level from scripts/unblock-levels-bank.ts, every minimum proved by BFS over the whole lot (pattern-overhaul-unblock-levels-check). New: Expert keeps only boards scripts/unblock-human.ts finishes inside 110 s at 0.25 s to react and 0.15 s to move; today it finishes 73 % of the Expert bank, so 27 % of today's Expert boards have no proof.
- **Measured today:** level-tune, 60 deals: near-perfect 199.8 / 199.8 / 195.9 / 189.6, great 199.0 / 198.1 / 179.5 / 176.2 (E/N/H/X); person-like solver: Hard 164.3 (73 % finished), Expert 149.0 (70 %)
- **Stamp:** level field; the board already stores cols (raise unblockCols' limit in types.ts from 8 to 9); the new full-by times need a levelRev on level deals, because patternRules.ts reads them from the registry by the stored level
- **Files:** `src/lib/levels/pattern/unblock.levels.ts`, `scripts/unblock-levels-bank.ts`, `src/lib/duel/unblockLevelsBank.server.ts`, `src/lib/duel/types.ts`, `scripts/unblock-human.ts`, `scripts/pattern-overhaul-unblock-levels-check.ts`
- **Risk:** 9×9 lots with a 36–44 move minimum may be rare and slow to prove, and each new lot size needs its own lot render (lot-8, lot-9)

### Tessellate (`blockparty`, Pattern)

**Lever: Board size and pieces.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 5×5 board, four small pieces (Two, Three, Corner, Square), 13 pegs, 10+ ways to finish, 60 s, full speed by 40 s (today a 6×6 with six pieces, which the average kit cannot finish inside 60 s) | 7×7, 9 pieces, 16 pegs, 5–60 ways to finish, 60 s (blockRev 4) | 8×8, 11 pieces (Normal's nine plus U and P), 21 pegs, 3–8 ways to finish, 2–3 held guesses, 70 s, full speed by 36 s | 9×9 (40 px squares), 13 pieces (two more five-square shapes), 28 pegs, 1–2 ways, 3 held guesses, 90 s, full speed by 45 s; tray five to a row. Ceiling: 9 across; after it, fewer ways and less time |
| First seconds | A tiny 5×5 board and four little pieces | | A bigger 8×8 board with eleven pieces in the tray | A 9×9 board and thirteen pieces, two of them new |
| Today | 6×6, 6 small pieces, 19 pegs, 20+ ways to finish, 60 s, full speed by 40 s | | 7×7, Normal's 9 pieces, 2–5 ways, 2–3 held guesses for the person-like solver, 60 s, full speed by 32 s | 8×8, 11 pieces (+U, P), 21 pegs, 1–2 ways, 3 held guesses, 70 s, full speed by 36 s |
| **Evidence** | measured: 5×5, four pieces, 13 pegs, 10+ ways patched in memory, 12 boards: average kit 160.3 (med 180, 10/12 finished), near-perfect under limits 200 on all 12. Today's 6×6 Easy: average 53.6, 0/12 finished (Normal 71.4) | | measured: 8×8, 11 pieces, 21 pegs, 3–8 ways, 70 s, full by 36 s in memory, 10 boards (under 1 s each, person-like solver 10/10): average kit 46.8, 0/10 finished (Normal 71.4), near-perfect under limits 185.7, 10/10, best 198 | not measured: a 9×9 board of 13 pieces needs two five-square shapes that do not exist (BLOCK_SHAPES in src/lib/duel/blockParty.ts has 12: the eleven plus Dot). Today's 8×8 Expert, 12 deals: average 37.3, near-perfect under limits 184.7 |

- **Why this curve:** Hard today is Normal's exact board and tray with fewer hidden solutions, which nobody can see, so every level now adds squares and pieces and the solution count only backs it up.
- **Fact-check verdict:** adjusted: Easy becomes a 5×5 board with four pieces, because today's 6×6 Easy scored below Normal for the average kit (53.6 against 71.4, none finished); Hard holds; the 9×9 Expert is unproven until its two new shapes exist.
- **Human limits today:** No reaction or move limit and no clock. HUMAN_LIMITS in src/lib/duel/blockPartyLevels.server.ts:269 is a thinking limit (4 choices wide, 3 held guesses); scripts/blockparty-levels-bank.ts:99 keeps only boards humanSolveBlock finishes, and pattern-overhaul-blockparty-levels-check.tsx:203 pins the limit's values.
- **Proof:** A bank per level from scripts/blockparty-levels-bank.ts: solution counts by exhaustive count, and every Hard and Expert board finished by the person-like solver humanSolveBlock (forced moves, at most three held guesses); pattern-overhaul-blockparty-levels-check re-counts every board. A time model must be added so Expert's finish is shown inside 90 s.
- **Measured today:** not documented
- **Stamp:** level field; the board's size and tray are stored on the puzzle; the new full-by times need a levelRev on level deals (blockLevelFullByS reads the registry)
- **Files:** `src/lib/levels/pattern/blockparty.levels.ts`, `src/lib/duel/blockParty.ts`, `scripts/blockparty-levels-bank.ts`, `src/lib/duel/blockPartyLevelBank.server.ts`, `scripts/pattern-overhaul-blockparty-levels-check.tsx`
- **Risk:** two new piece renders, a 13-piece tray on short phones, and a slower exhaustive count on 9×9; the dealt puzzle stores no size or tray (the grader reads them from the registry by level), so new boards need a levelRev; Easy rests on the kit's 13 s a piece (today's 6×6 Easy on a 90 s clock also measured well: 161.8, 11 of 12 finished)

### Pipeline (`pipes`, Pattern)

**Lever: Tiles on the board.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 5×5, 15 tiles to turn and 10 already right, spills shown, 120 s (a quarter of Expert's board; does the job) | 7×7 (49 tiles), at least 80 % turned, spills shown, one layout only, 120 s, full speed by 60 s (pipesRev 5) | 8×9 (72 tiles, today 64), at least 90 % turned, spills shown, 105 s (today 120), full speed by 60 s | As today: 8×11 (88 tiles), at least 95 % turned, no spills shown, 120 s, full speed by 90 s. Already at the ceiling: 8 across (45 px), 11 down on a short phone (39 px), and the person-like player needs 106–115 s of the 120 |
| First seconds | A small 5×5 board with many pipes already joined | | A taller board of 72 tiles, nearly all turned | Tiles to the bottom of the screen and no leak marks |
| Today | 5×5 (25 tiles), exactly 60 % turned, spills shown, 120 s | | 8×8 (64 tiles), at least 90 % turned, spills shown, 120 s | 8×11 (88 tiles), at least 95 % turned, no spills shown in play, 120 s, full speed by 90 s |
| **Evidence** | not measured: the narrowed pass ran the redesign rows only | | not measured: the narrowed pass ran the redesign rows only | documented: today's level kept; scripts/pipes-human.ts (levels-research.md): the person-like player finished Expert room seeds 1 and 2 in 115 s and 106 s (166 and 178 points); medians not documented |

- **Why this curve:** Tile count is what a player sees and what sets the work (25, 49, 72, 88), and Expert already fills both the phone and the clock, so only Hard needed to move up to sit midway.
- **Fact-check verdict:** unproven: Hard's 8x9 board and 105 s clock were not run in this pass; Expert is today's level on documented numbers.
- **Human limits today:** No 0.25 s / 0.15 s limit. scripts/pipes-human.ts:32 times a person-like player with its own costs (1.6 s to fix a tile, 0.25 s a turn); it is a tool, and no levels check calls it (grep). The deal's proof, deducePipes in pipesSolve.server.ts, has no clock.
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
| **Evidence** | documented: today's level kept; logic-1-tune under human limits, 20 deals (levels-research.md): great 197.0, near-perfect 198.9 | | not measured: the narrowed pass ran the redesign rows only | not measured: the narrowed pass ran the redesign rows only |

- **Why this curve:** The six-by-six grid is the game, so the visible ladder is how empty it starts, run down to the fewest givens a unique grid can have, with the solver's grade making sure fewer numbers means harder steps and never luck.
- **Fact-check verdict:** unproven: fewer givens with 2 and 3 advanced steps and a 75 s clock need new banks and were not run.
- **Human limits today:** scripts/logic-1-tune.ts:42-50 holds every kit step to 0.4 s (0.25 s react + 0.15 s move) and measures; scripts/logic-1-steps-check.ts:19-24 asserts on 20 deals that the great bot drops at least 5 points a level and the near-perfect bot finishes 75 % of Expert with a best tenth of 185+. The deal's own proof has no clock.
- **Proof:** Banks of 200 per level from scripts/sudoku-level-bank.ts: one solution each, graded by the step solver in sudokuLogic.ts (singles, pairs, pointing, box-line, never a guess), which is the person-style proof; logic-1-levels-check proves every board and logic-1-steps-check the ladder. A time model (0.8 s a digit) must be added to show the Expert solve fits 75 s.
- **Measured today:** great / near-perfect under human limits: E 197.0 / 198.9, N 184.5 / 199.1, H 159.7 (85 % finished) / 193.1, X 129.6 (35 %) / 184.7
- **Stamp:** level field only (the grid and the clock are stored on the puzzle; each level's clash rule is unchanged)
- **Files:** `src/lib/levels/gameLevels.ts`, `scripts/sudoku-level-bank.ts`, `src/lib/duel/sudokuLogic.ts`, `src/lib/duel/logicLevelBanks.server.ts`, `scripts/logic-1-levels-check.tsx`, `scripts/logic-1-steps-check.ts`
- **Risk:** 6×6 grids with 8–9 givens that need three advanced steps may be too rare to bank 200

### Chroma Lines (`flow`, Pattern)

**Lever: Board height and pairs.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 6×6, 5–6 pairs, no walls, 75 s (a small open board; does the job) | 9×9, 10–12 pairs, 2–4 walls, 75 s, full speed by 30 s (flowRev 3) | 9×11, 12–13 pairs, 4–6 walls, at least 3 what-ifs, 75 s (Normal's clock), full speed by 35 s (today's Hard has fewer dots than Normal and reads as easier) | 9×13, 14 pairs, 6–8 walls, at least 4 what-ifs, 75 s (Normal's clock), full speed by 40 s. Ceiling: 9 across (40 px beads), 13 down and the 14 bead colours; after it, longer lines and less time |
| First seconds | A small 6×6 board with five or six pairs | | A taller board with more coloured dots than Normal | Dots in fourteen colours fill the screen top to bottom |
| Today | 6×6, 5–6 pairs, no walls, 75 s, full speed by 15 s | | 9×9, 8–9 pairs with longer lines, 4–6 walls, at least 3 what-ifs, 75 s, full speed by 35 s | 9×12, 12–14 pairs, 4–6 walls, at least 4 what-ifs, 90 s, full speed by 45 s |
| **Evidence** | measured: today's Easy kept, 12 deals: average kit 181.5 (12/12 finished), near-perfect under limits 199.6 (200 on 10); Normal on 12 deals: 73.8 and 198.9 | | measured: 9×11, 12–13 pairs, 75 s, full by 35 s in memory, 12 boards built first try: average kit 71.0, 0/12 finished, near-perfect under limits 195.6, 12/12, 200 on 5, finish med 36 s. At 80 s as first proposed: 77.6 and 191.6 | measured: 9×13, 14 pairs, 75 s, full by 40 s, 12 boards (0.1 s each; person-like solver 8/8, 4–9 what-ifs): average kit 61.9, 0/12, near-perfect under limits 191.5, 12/12, best 200. At 95 s/45: 72.6 and 196.3; at 60 s/35: 52.2 and 171.2 (10/12) |

- **Why this curve:** Today's Hard takes dots off Normal's board and so looks easier; growing the board downwards with more pairs at every level makes one ladder the eye can read (36, 81, 99, 117 squares), with the what-if floor as the guard.
- **Fact-check verdict:** adjusted: Hard's clock 80 to 75 s and Expert's 95 to 75 s with full speed by 40 s, because on the longer clocks the elite scored Expert above Hard and the average kit scored every level alike; the average's steps are still small (73.8, 71.0, 61.9) with the board at the phone's ceiling.
- **Human limits today:** No reaction or move limit and no clock. The person-like solver (src/lib/duel/flowHuman.server.ts) counts what-ifs; pattern-overhaul-flow-levels-check.ts:210 sums them per level. Nothing times a solve.
- **Proof:** Banks of 500 per level (bun scripts/flow-bank.ts --level): exactly one solution by the exhaustive solver, and every board finished by the person-like solver flowHuman.server.ts (forced moves and one what-if at a time); pattern-overhaul-flow-levels-check re-proves them. A time model must be added so Expert is shown inside 75 s (the near-perfect kit under the limits finished 12 of 12 trial boards, 47 s at the median and 58 s at most).
- **Measured today:** not documented
- **Stamp:** level field; the board's size is stored on the puzzle; the new full-by times need a levelRev on level deals (flowFullByS reads the registry)
- **Files:** `src/lib/levels/pattern/flow.levels.ts`, `scripts/flow-bank.ts`, `src/lib/duel/flowHardBank.server.ts`, `src/lib/duel/flowExpertBank.server.ts`, `src/lib/duel/flowHuman.server.ts`, `scripts/pattern-overhaul-flow-levels-check.ts`
- **Risk:** the average kit scores Normal, Hard and Expert within 12 points (unfinished credit is a share of the board), so the step may be seen but not felt in the score; the feared solver rejections did not appear (every 9×13 board built first try)

### Skid (`iceslide`, Pattern)

**Lever: Holes and thin ice.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 8×8, 6–10 slides (today 8–12), rocks only: no holes, thin ice, chevrons or portals, 90 s, full speed by 20 s | 12×12, 18–26 slides, 2–4 holes, every hazard, 90 s, full speed by 30 s (slideRev 5) | 12×12, 26–32 slides, 6–8 holes, 4–6 thin ice, 1–3 chevrons, 1–2 portal pairs, 90 s (today 100), full speed by 40 s | 11×13, 34–42 slides, 10–12 holes (today 3–5, fewer than Hard), 6–8 thin ice, 2–4 chevrons, 2 portal pairs, 120 s, full speed by 45 s. Ceiling: the rink is full size from Normal (30 px squares; 26 px proved unreadable), so the lever is hazards and route length |
| First seconds | A small rink with rocks only and no holes | | Twice Normal's holes dotted across the rink | A taller rink riddled with ten or more holes |
| Today | 8×8, 8–12 slides, no holes or thin ice, at most 1 chevron and 1 portal pair, 90 s, full speed by 20 s | | 12×12, 24–30 slides, 5–8 holes, 3–5 thin ice, 100 s, full speed by 40 s | 11×13, 28–36 slides, 3–5 holes, 3–6 thin ice, 120 s, full speed by 45 s |
| **Evidence** | not measured: the narrowed pass ran the redesign rows only | | not measured: the narrowed pass ran the redesign rows only | not measured: the narrowed pass ran the redesign rows only |

- **Why this curve:** The rink is already as big as a phone can show at Normal, so the ladder has to be what is on the ice, and today Expert has fewer holes than Hard and looks the safer of the two.
- **Fact-check verdict:** unproven: boards with 10-12 holes and a 34-42 slide minimum need a new bank and were not built in this pass.
- **Human limits today:** No 0.25 s / 0.15 s limit. scripts/iceslide-human.ts:40 (SKID_ELITE_PERSON) has its own times (0.6 s a look, 0.8 s a slide, 3 slides ahead); pattern-overhaul-iceslide-levels-check.ts:236 plays it on Expert boards inside 120 s and (header, line 27) wants a finish scoring 150+.
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
| **Evidence** | documented: today's level kept; measurements not documented (the check only asserts that great and near-perfect averages step down) | | not measured: the narrowed pass ran the redesign rows only | not measured: the narrowed pass ran the redesign rows only |

- **Why this curve:** Hard today shows the same five crates as Normal, so the crate count, the one thing a player counts at once, now climbs 3, 5, 6, 7 with the push minimum rising behind it.
- **Fact-check verdict:** unproven: 6 and 7 crate banks were not built, and no person-style push solver exists to prove Expert.
- **Human limits today:** Nothing. No person-style push solver exists (grep: no human player in scripts/push-levels-bank.ts or pattern-overhaul-push-levels-check.ts); the bank's proof is the exact minimum by search, with no clock.
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
| **Evidence** | documented: today's level kept; not documented (only Expert has numbers: near-perfect 183-193 on 12 boards) | | not measured: the narrowed pass ran the redesign rows only | not measured: the narrowed pass ran the redesign rows only |

- **Why this curve:** Normal, Hard and Expert look alike today (one more bomb, one more mirror), so bombs, the hazard a player spots first and the thing that kills the easy routes, double at Hard and triple at Expert.
- **Fact-check verdict:** unproven: boards with 6-7 and 9-10 bombs need new banks and were not built in this pass.
- **Human limits today:** No reaction or move limit and no clock. pattern-overhaul-laser-levels-check.ts:126 and :158 require the person-like solver (laserSolve.server.ts solveLaserLikeAPerson) to light each board inside the level's try band; it counts tries, not seconds.
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
| **Evidence** | documented: today's level kept; logic-1-tune under human limits, 20 deals (levels-research.md): great 199.3, near-perfect 200 | | not measured: the narrowed pass ran the redesign rows only | not measured: the narrowed pass ran the redesign rows only |

- **Why this curve:** Hard today is Normal's nine rings again and the near-perfect bot still scores 192 on Expert, so the ring count now rises at every level and the minimum grows by about half each step.
- **Fact-check verdict:** unproven: 10 and 12 ring boards were not dealt in this pass.
- **Human limits today:** scripts/logic-1-tune.ts:42-50 holds every kit step to 0.4 s (0.25 s react + 0.15 s move) and measures; scripts/logic-1-steps-check.ts:19-24 asserts on 20 deals that the great bot drops at least 5 points a level and the near-perfect bot finishes 75 % of Expert with a best tenth of 185+. The deal's own proof has no clock.
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
| **Evidence** | documented: today's level kept; logic-1-tune under human limits, 20 deals (levels-research.md): great 200, near-perfect 200 | | not measured: the narrowed pass ran the redesign rows only | not measured: the narrowed pass ran the redesign rows only |

- **Why this curve:** A strong player loses nothing until the layers hide (near-perfect 197 on Hard), so the rack itself grows at Hard and the hiding, the genre's own hard mode and already built, stays as Expert's last step.
- **Fact-check verdict:** unproven: the 14 flask, 12 colour rack was not built, and no solver that sees only uncovered layers exists.
- **Human limits today:** scripts/logic-1-tune.ts:42-50 holds every kit step to 0.4 s (0.25 s react + 0.15 s move) and measures; scripts/logic-1-steps-check.ts:19-24 asserts on 20 deals that the great bot drops at least 5 points a level and the near-perfect bot finishes 75 % of Expert with a best tenth of 185+. The deal's own proof has no clock.
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
| **Evidence** | documented: today's level kept; logic-1-tune under human limits, 20 deals (levels-research.md): great 200, near-perfect 200 | | not measured: the narrowed pass ran the redesign rows only | not measured: the narrowed pass ran the redesign rows only |

- **Why this curve:** Hard today keeps Normal's four dials and the bots barely notice Expert (187 near-perfect), so a dial is added at every level and the tries, the game's safety net, shrink 3, 3, 2, 1.
- **Fact-check verdict:** unproven: 5 and 6 dial cards with 2 and 1 tries were not built, and no person-style solver exists for the card.
- **Human limits today:** scripts/logic-1-tune.ts:42-50 holds every kit step to 0.4 s (0.25 s react + 0.15 s move) and measures; scripts/logic-1-steps-check.ts:19-24 asserts on 20 deals that the great bot drops at least 5 points a level and the near-perfect bot finishes 75 % of Expert with a best tenth of 185+. The deal's own proof has no clock.
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
| **Evidence** | documented: today's level kept; not documented | | not measured: the narrowed pass ran the redesign rows only | not measured: the narrowed pass ran the redesign rows only |

- **Why this curve:** Normal and Hard look identical today (six balls on the same board), so the ball count, which multiplies what every tilt does, becomes the ladder: 3, 6, 8, 10.
- **Fact-check verdict:** unproven: 8 and 10 ball boards need new banks and were not built in this pass.
- **Human limits today:** No reaction or move limit and no clock. scripts/topsy-levels-bank.ts:28 and :90 keep an Expert board only when the person-like solver (scripts/topsy-human.ts: 3 tilts ahead, 2 resets) clears it inside the tilt limit; pattern-overhaul-gravity-levels-check.ts:63 re-runs it.
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
| **Evidence** | documented: today's level kept; logic-1-tune under human limits, 20 deals (levels-research.md): great 197.4, near-perfect 199.7 | | documented: today's 9x11 board on a 120 s clock (logic-1-tune, 20 deals): great 158.4 (90 % finished), near-perfect 189.9; the proposed 100 s clock was not run | documented: today's 9x14 board needing one two-line step (logic-1-tune, 20 deals): great 126.0 (30 % finished), near-perfect 182.1; three two-line steps were not run |

- **Why this curve:** Today's ladder (36, 64, 99, 126 squares) already steps up where everyone can see it and ends on the phone's ceiling, so only the clock and the depth of reasoning need tightening for the best players.
- **Fact-check verdict:** unproven: the boards are today's, but the 100 s Hard clock and the three two-line steps on Expert were not run.
- **Human limits today:** scripts/logic-1-tune.ts:42-50 holds every kit step to 0.4 s (0.25 s react + 0.15 s move) and measures; scripts/logic-1-steps-check.ts:19-24 asserts on 20 deals that the great bot drops at least 5 points a level and the near-perfect bot finishes 75 % of Expert with a best tenth of 185+. The deal's own proof has no clock.
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
| **Evidence** | documented: today's level kept; logic-1-tune under human limits, 20 deals (levels-research.md): great 198.8, near-perfect 199.0 | | not measured: the narrowed pass ran the redesign rows only | not measured: the narrowed pass ran the redesign rows only |

- **Why this curve:** A strong player scores within ten points on every level today, so the two things that set a flood's par, area and colours, both rise at each step and the spare moves fall 8, 6, 4, 2.
- **Fact-check verdict:** unproven: the 14x20 Hard and the 7 colour Expert need new banks with an exact par and were not built.
- **Human limits today:** scripts/logic-1-tune.ts:42-50 holds every kit step to 0.4 s (0.25 s react + 0.15 s move) and measures; scripts/logic-1-steps-check.ts:19-24 asserts on 20 deals that the great bot drops at least 5 points a level and the near-perfect bot finishes 75 % of Expert with a best tenth of 185+. The deal's own proof has no clock.
- **Proof:** A bank per level with the exact par by search (scripts/flood-level-bank.ts, scripts/flood-par-proof.ts), proved by logic-1-levels-check; the proof run is the stored par line at 0.4 s a move, about 10 s, well inside 75 s.
- **Measured today:** great / near-perfect under human limits: E 198.8 / 199.0, N 197.4 / 198.3, H 188.3 / 196.7, X 166.3 (75 % finished) / 192.1
- **Stamp:** level field; size, colours, blocked squares, par and clock are stored on the puzzle; stamp the level's spare moves on it too so a later retune never moves a stored round
- **Files:** `src/lib/levels/gameLevels.ts`, `scripts/flood-level-bank.ts`, `src/lib/duel/floodLevels.server.ts`, `scripts/flood-par-proof.ts`, `scripts/logic-1-levels-check.tsx`
- **Risk:** the exact-par search at 7 colours and par 22–26 on 336 squares may be too slow to bank

### Minefield (`minesweeper`, Logic)

**Lever: Mines on the board.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today (minesRev 4): 8×12, 9 mines, about a third of the board already open, 90 s; a mine costs 5 points and never the run | minesRev 3: 10×16, 16 mines, opening 20–60, 90 s, full speed by 37 s | 10×16, 26 mines (today 20, only 4 more than Normal), opening 12–24 squares, 90 s, full speed by 45 s | 10×16, 40 mines (a quarter of the board), opening 6–12, 120 s, full speed by 75 s, dealt from a pre-proved bank; squares stay 37 px (today's 12×18 draws them at about 31 px, under the 36 px floor). Ceiling: 10×16 is Normal's board already, so the lever is mine density and the opening |
| First seconds | A small board, a third of it already open | | Mines 26 on the counter and a small opening | Mines 40 and only a handful of squares open |
| Today | minesRev 4: 8×12, 9 mines, opening 25–40 squares, 90 s, full speed by 22 s | | minesRev 2: 10×16, 20 mines, opening 20–60, 90 s, full speed by 37 s | minesRev 5: 12×18, 34 mines, opening 8–16, 120 s, full speed by 50 s |
| **Evidence** | measured: today's minesRev 4 kept, 24 seeds, skill-band bot graded by the server replay: average 190.0 (23/24 cleared), elite under limits 200 on all 24 | | measured: 10x16, 26 mines, opening 12-24, full by 45 s patched in memory on minesRev 2, 24 seeds: average 128.9 (0/24 cleared), elite under limits avg 195.3, med 198, 200 on 8; the deal took 8 tries a seed and none of 300 seeds failed | measured: 10×16, 40 mines, opening 6–12, 120 s, full by 75 s in memory on minesRev 5, 24 seeds (8 on the stand-in board): average 93.3, 0/24 cleared, elite under limits 197.8, 24/24, 200 on 10. At 36 mines, full by 60 s: average 112.1, elite 196.0 |

- **Why this curve:** The board cannot grow without shrinking the squares under a thumb, so the ladder is the mine count (9, 16, 26, 40) with the free opening shrinking as it climbs, which is how this game gets harder everywhere it is played.
- **Fact-check verdict:** adjusted: Expert's mines 36 to 40 and full speed by 60 to 75 s, because at 36 the average bot was only 17 points below Hard (112 against 129) and at 40 it is 93 with the elite reaching 200 on 10 of 24; Easy stays 14 above Normal (190, 177) under the 200 ceiling.
- **Human limits today:** scripts/logic-1-tune.ts:63-85 holds the bot's taps 0.4 s apart and measures; scripts/logic-1-steps-check.ts:19-24 asserts the level steps and Expert's finish (75 %) and best tenth (185+) on 20 deals; scripts/level-tune.ts:131 passes HUMAN_LIMITS to the bot with --human-limits. The deal's proof (minesSolve, minesweeper.ts:405-420) has no clock.
- **Proof:** Every board is dealt by the existing rule: the logic solver minesSolve clears it from the opening with never a guess (logic-1-levels-check, minefield-logic-check). At 26 and 40 mines deal from a pre-proved bank (at 40, 17 % of seeds find no board inside the live deal's 600 tries), and the oracle (scripts/cards-board-oracles.ts) must reach 200 under HUMAN_LIMITS on every banked seed or the seed is dropped.
- **Measured today:** great / near-perfect under human limits: E 199.1 / 200, N 194.6 (90 % finished) / 200, H 188.9 (95 %) / 196.4, X 174.2 (85 %) / 191.0
- **Stamp:** minesRev 6 (Hard, 26 mines) and minesRev 7 (Expert, 40 mines): each level's geometry and clock ride on its own revision, and stored minesRev 2 and 5 rounds must replay as dealt
- **Files:** `src/lib/arcade/minesweeper.ts`, `src/lib/levels/gameLevels.ts`, `scripts/cards-board-oracles.ts`, `scripts/logic-1-levels-check.tsx`, `scripts/minefield-logic-check.ts`, `docs/arcade-standard/minesweeper.md`
- **Risk:** 40 mines needs the bank (17 % of seeds find no no-guess board in 600 tries; at 38 mines 8 %, average 101.5, elite 200 on 15 of 24); the elite still averages 198, so Expert is very hard for the average player only

### Tents and Trees (`tents`, Logic)

**Lever: Board height and trees.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 8×6, 7–8 trees, every count shown, 90 s | 8×9, 12–13 trees, a third of the counts hidden, 90 s | 8×11 (today 8×10, one row more than Normal), 16–17 trees, half the counts hidden, 2–15 trials, 100 s | 8×13, 21–22 trees, half the counts hidden, 5–50 trials, 120 s. Ceiling: 8 across with the count column (40 px squares) and 13 down; after it, more hidden counts |
| First seconds | A short board with every count shown | | Two more rows, more trees, half the counts blank | Thirteen rows and over twenty trees |
| Today | 8×6, 7–8 trees, every count shown, 90 s | | 8×10, 13–14 trees, half the counts hidden, 2–12 trials, 90 s | 8×12, 17–18 trees, half the counts hidden, 4–40 trials, 120 s |
| **Evidence** | documented: today's level kept; level-tune near-perfect kit, 20 boards, no human limits (levels-research.md): 199.8 | | not measured: the narrowed pass ran the redesign rows only | not measured: the narrowed pass ran the redesign rows only |

- **Why this curve:** Hard today is Normal plus one row, so each level now adds two rows and four or five trees, growing downwards because the width is already at its limit.
- **Fact-check verdict:** unproven: 8x11 and 8x13 boards fit the generator's height setting but were not run in this pass.
- **Human limits today:** No reaction or move limit. src/lib/duel/logicLevelDeal.server.ts:86-90 keeps a level board only when the person-style solver (logicHuman.server.ts solveLikePerson) finishes it inside the trial band, and scripts/logic-levels-check.ts:170 re-runs it; the solver counts trials and has no clock. The kits scale think time by LEVEL_THINK (scripts/puzzle-fairness/kit.ts:167).
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
| **Evidence** | documented: today's level kept; level-tune near-perfect kit, 20 boards, no human limits (levels-research.md): 199.5 | | not measured: the narrowed pass ran the redesign rows only | not measured: the narrowed pass ran the redesign rows only |

- **Why this curve:** Expert today is one row taller than Hard and scores within six points of it, so the board now grows two rows a level and the largest rectangle, the number a player reads first, rises 8, 12, 16, 20.
- **Fact-check verdict:** unproven: 10x13 and 10x15 boards fit the generator's height setting but were not run in this pass.
- **Human limits today:** No reaction or move limit. src/lib/duel/logicLevelDeal.server.ts:86-90 keeps a level board only when the person-style solver (logicHuman.server.ts solveLikePerson) finishes it inside the trial band, and scripts/logic-levels-check.ts:170 re-runs it; the solver counts trials and has no clock. The kits scale think time by LEVEL_THINK (scripts/puzzle-fairness/kit.ts:167).
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
| **Evidence** | documented: today's level kept; level-tune near-perfect kit, 20 boards, no human limits (levels-research.md): 199.3 | | documented: today's Expert board (9x12, 26-30 walls) on a 120 s clock: near-perfect kit 158.9, 80 % finished (levels-research.md); the proposed 100 s clock was not run | not measured: the narrowed pass ran the redesign rows only |

- **Why this curve:** Hard today is Normal's own board with fewer numbers, so the board now grows two rows a level while the numbered share falls 70, 50, 35, 30 per cent.
- **Fact-check verdict:** unproven: Hard is today's Expert board with 20 s less and the 9x14 Expert was not run.
- **Human limits today:** No reaction or move limit. src/lib/duel/logicLevelDeal.server.ts:86-90 keeps a level board only when the person-style solver (logicHuman.server.ts solveLikePerson) finishes it inside the trial band, and scripts/logic-levels-check.ts:170 re-runs it; the solver counts trials and has no clock. The kits scale think time by LEVEL_THINK (scripts/puzzle-fairness/kit.ts:167).
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
| **Evidence** | not measured: the board is fixed at 6x6 (src/lib/duel/trail.ts:8-9 TR_SIZE; generateTrail in trail.server.ts:13 takes no size), so a 5x5 board cannot be generated | | not measured: a 7x7 board needs new generator and solver code (trail.server.ts:34 and the person-style trail model in logicHuman.server.ts read TR_CELLS, 36) | not measured: an 8x8 board cannot be generated, proved or solved by today's code (fixed 6x6, as above); the bank-yield and search-cost risk is untested |

- **Why this curve:** Normal, Hard and Expert are the same 6×6 board with ten numbers today and differ only in a search count no player can see; a path nearly twice as long is a difficulty anyone reads in one look.
- **Fact-check verdict:** unproven: Trail has no size setting today, so none of the three proposed boards can be dealt, solved or timed without new code.
- **Human limits today:** No reaction or move limit. src/lib/duel/logicLevelDeal.server.ts:86-90 keeps a level board only when the person-style solver (logicHuman.server.ts solveLikePerson) finishes it inside the trial band, and scripts/logic-levels-check.ts:170 re-runs it; the solver counts trials and has no clock. The kits scale think time by LEVEL_THINK (scripts/puzzle-fairness/kit.ts:167).
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
| **Evidence** | documented: today's level kept; level-tune near-perfect kit, 20 boards, no human limits (levels-research.md): 199.0 | | documented: today's Expert board (8x8) on a 120 s clock: near-perfect kit 171.1, all finished (levels-research.md); the tighter grade band and 90 s clock were not run | not measured: FencesLevel has only a square size (src/lib/duel/logicOverhaul2Levels.ts:57-64), so an 8x10 board cannot be asked for |

- **Why this curve:** The ladder is already board size, but one square a side per level leaves the near-perfect kit finishing every Expert board, so Hard takes today's Expert board and Expert grows downwards past the width limit.
- **Fact-check verdict:** unproven: Loopline is square-only today, so the 8x10 Expert cannot be dealt until rules, solver and stage take a row count.
- **Human limits today:** No reaction or move limit. src/lib/duel/logicLevelDeal.server.ts:86-90 keeps a level board only when the person-style solver (logicHuman.server.ts solveLikePerson) finishes it inside the trial band, and scripts/logic-levels-check.ts:170 re-runs it; the solver counts trials and has no clock. The kits scale think time by LEVEL_THINK (scripts/puzzle-fairness/kit.ts:167).
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
| **Evidence** | documented: today's level kept; level-tune near-perfect kit, 20 boards, no human limits (levels-research.md): 200.0 | | not measured: the narrowed pass ran the redesign rows only | not measured: the narrowed pass ran the redesign rows only |

- **Why this curve:** Hard today is Normal's 7×7 with fewer numbers, which reads as the same board; a side longer at each level (36, 49, 64, 81 squares) with a thinner spread of numbers is a step the eye and the solver both feel.
- **Fact-check verdict:** unproven: the 8x8 Hard and 9x9 Expert fit the generator's size setting but were not run in this pass.
- **Human limits today:** No reaction or move limit. src/lib/duel/logicLevelDeal.server.ts:86-90 keeps a level board only when the person-style solver (logicHuman.server.ts solveLikePerson) finishes it inside the trial band, and scripts/logic-levels-check.ts:170 re-runs it; the solver counts trials and has no clock. The kits scale think time by LEVEL_THINK (scripts/puzzle-fairness/kit.ts:167).
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
| **Evidence** | documented: today's level kept; level-tune near-perfect kit, 20 boards, no human limits (levels-research.md): 199.6 | | documented: today's Expert board (8x8, 18-22 islands) on a 120 s clock: near-perfect kit 155.5, 85 % finished (levels-research.md); the 105 s clock was not run | not measured: BridgesLevel has only a square size (src/lib/duel/logicOverhaul2Levels.ts:73-80), so an 8x11 board cannot be asked for |

- **Why this curve:** Islands are what a player counts, and the count now climbs by about half at every level (8, 12, 20, 28), with Expert growing downwards because eight across is the phone's limit.
- **Fact-check verdict:** unproven: Island Link is square-only today, so the 8x11 Expert cannot be dealt until rules, solver and stage take a row count.
- **Human limits today:** No reaction or move limit. src/lib/duel/logicLevelDeal.server.ts:86-90 keeps a level board only when the person-style solver (logicHuman.server.ts solveLikePerson) finishes it inside the trial band, and scripts/logic-levels-check.ts:170 re-runs it; the solver counts trials and has no clock. The kits scale think time by LEVEL_THINK (scripts/puzzle-fairness/kit.ts:167).
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
| **Evidence** | not measured: run pending. Today's Easy, scratch harness (level-tune's own loop and HUMAN_LIMITS), 24 seeds, medians: average 67, elite 178 (best 192, 0/24 at 200). | | not measured: run pending (narrowing needs a two-way gap scale; widenGaps only widens, hover.ts:1626). Today's Hard: average 37, elite 153. | not measured: run pending. Today's Expert: average 38, elite 157 (best 182, 0/24 at 200), level with today's Hard. |

- **Why this curve:** A gap flyer is exactly as hard as its gaps are small, so the gap is the one thing every level should change, while today's Hard and Expert leave the gaps alone and only scroll 6 and 12 % faster, which neither a player nor the bots can tell apart.
- **Fact-check verdict:** unproven: the narrowed gaps were not yet played; today's Hard and Expert measure level with each other (average 37 and 38).
- **Human limits today:** scripts/level-tune.ts:187 (--human-limits) builds the bots with HUMAN_LIMITS (human.ts:110, :132: reactions 250 ms, tracking lag 150 ms); it measures, nothing asserts, and no levels check for this game mentions limits. The hover bot reads reaction and lag. scripts/hover-x200-solver.ts and hover-x200-witness.ts are frame-exact and cover Normal only; no level has a deal or proof.
- **Proof:** Today only Normal's courses are proved passable and levels only ever widen gaps. scripts/hover-x200-solver.ts already searches a tap log through every barrier, star, tight gate and chain and scripts/hover-x200-witness.ts keeps it when the server replay scores 200: run both on each level's narrowed course with taps at least 0.15 s apart and no tap sooner than 0.25 s after a barrier scrolls into view, and deal each level only from seeds that have a witness (src/lib/duel/hoverLevelDeals.server.ts and scripts/hover-levels-check.ts, to write).
- **Measured today:** Elite bot under human limits, 20 seeds: 174 / 173 / 140 / 141 (Hard and Expert level with each other: the bot crashes early on both). Average bot at Normal on hoverRev 10, before the starting shield: median 36 to 47.
- **Stamp:** hoverRev 12 on Easy, Hard and Expert deals only (Normal stays hoverRev 11): the sim re-reads the level table at replay, so level rounds stored since 16 Nov must keep today's table.
- **Files:** `src/lib/arcade/retroLevels.ts (HOVER_LEVELS)`, `src/lib/arcade/hover.ts (widenGaps becomes a two-way gap scale, the moving-gap rule per level)`, `scripts/hover-x200-solver.ts`, `scripts/hover-x200-witness.ts`, `src/lib/duel/hoverLevelDeals.server.ts (new)`, `scripts/hover-levels-check.ts (new)`
- **Risk:** a 72 px gap at top scroll may leave too few seeds with a human-paced witness, in which case Expert stops at 80 px

### High Rise (`skyline`, Action)

**Lever: Width of the blocks.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Blocks start 260 px wide (Normal 200); slide 1.25 px a tick rising to 2.5 (today's Easy 1.75 to 3.5) and perfect within 5 px; no wind; the wide rescue block after 3 trims in a row (Normal 5); 3 lives. | skylineRev 11: 200 px blocks, slide 3 px a tick rising to 6, a perfect drop within 3 px, wind from block 20, 3 lives, 60 s | Blocks start 110 px wide; wind from block 8 (Normal 20); slide and perfect window as Normal (today's faster slide dropped); 3 lives. | Blocks start 50 px wide; wind from the first block; slide and perfect window as Normal (today's 7.5 px slide and 2 px window dropped); 3 lives. |
| First seconds | A block two thirds of the screen wide, sliding very slowly | | A block barely half Normal's width | A block a quarter of Normal's width, the wind flag waving |
| Today | Slide 1.75 px a tick rising to 3.5, a perfect drop within 5 px, wind from block 30, 3 lives | | Slide 3.5 px a tick rising to 7, perfect within 3 px, wind from block 15, 3 lives | Slide 3.75 px a tick rising to 7.5, perfect within 2 px, wind from block 10, 3 lives |
| **Evidence** | measured: rules in memory at 200 px (the sim caps a block at 200, so 260 px was not played), 16 seeds: slide 1.25 to 2.5, no wind: average median 143, elite 149, 3/16 at 200. With the 1.75 to 3.5 slide: average 111, elite 162. | | measured: first state and rules in memory, 16 seeds: 110 px, wind from block 8: average 30 (mean 34), elite 135, best 167, 0/16 at 200. As first proposed (150 px): average 40, elite 139. Normal: 50 and 143. | measured: in memory, 16 seeds: 50 px, wind from the first block: average 21, elite 131, best 147, 0/16 at 200, 81 % reach the clock. As first proposed (110 px): average 30, elite 141, best 157. |

- **Why this curve:** Normal's slide already leaves a perfect drop one tick wide at top speed, so going faster stops testing people and starts testing luck, whereas a narrower block and earlier wind raise the cost of every drop in a way the player sees before the first tap.
- **Fact-check verdict:** adjusted: Hard 150 to 110 px and Expert 110 to 50 px (150 and 110 px measured 40 and 30, only 10 apart), Easy's slide slowed to 1.25 to 2.5 px a tick (average 111 to 143); the 260 px block and any 200 under the limits stay unproven.
- **Human limits today:** scripts/flip-skyline-levels-bands.ts plays a `limited` bot (humanLimits.ts:16: reactions 250 ms, lag 150 ms, timing 15 ms, aim 2.5 px) and level-tune.ts:187 the HUMAN_LIMITS bots: both only measure. skyline-oracle.ts is frame-exact and skyline-levels-check asserts its 200 with no limits.
- **Proof:** scripts/skyline-oracle.ts scores 200 on every seed at every level today (skyline-levels-check) and a run of perfect drops never trims, so block width cannot break it. With Normal's slide kept, a perfect drop is never under one tick wide; today's Expert (2 px either side at up to 7.5 px a tick) is, so its 200 is only there for a frame-exact oracle. The build session should also report the elite bot under scripts/arcade-skill-bands/humanLimits.ts.
- **Measured today:** Mean, 40 seeds: average bot 116 / 53 / 46 / 41; elite under human limits 167 / 123 / 114 / 98 (runs reaching the clock 100 / 73 / 38 / 5 %).
- **Stamp:** skylineRev 12 on Easy, Hard and Expert deals only (Normal stays skylineRev 11): SKYLINE_LEVEL_RULES is frozen with the sim and stored level rounds must replay.
- **Files:** `src/lib/arcade/skyline.ts (SKYLINE_LEVEL_RULES gains a start width)`, `src/lib/levels/gameLevels.ts (display copy)`, `scripts/skyline-oracle.ts`, `scripts/skyline-levels-check.ts`, `scripts/flip-skyline-levels-bands.ts`
- **Risk:** Normal already scores 50 for the average bot, so 110 and 50 px blocks only reach 30 and 21, and no elite run under the limits reaches 200 on Normal, Hard or Expert (best 171, 167, 147); a build must also cap regrowth at the level's width (the sim grows a tower back to 200 px)

### Breaker (`breaker`, Retro)

**Lever: Rows of bricks in the wall.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 6 rows (54 bricks), every plain brick one hit; paddle 112 px; no sliding rows; ball as Normal (today's 108 % dropped). | brkRev 12: 9 rows of 9 (81 bricks, 3 gold), paddle 84 px, 2 rows slide from 30 s and 60 s, 90 s | 11 rows (99 bricks); paddle 68 px; 2 rows slide from the first second (Normal from 30 s and 60 s); full speed points if the wall is cleared by 55 s (Normal 45 s, the wall is a fifth bigger); ball and brick hits as dealt. | 12 rows (108 bricks, the whole dealt wall); paddle 52 px; 4 rows slide from the first second; full speed points if cleared by 60 s (the wall is a third bigger); ball and brick hits as dealt (today's extra hit on every row dropped). |
| First seconds | A short six-row wall above a wide paddle | | Two more rows, two already sliding, a narrower paddle | Twelve rows, four sliding, a paddle barely a brick wide |
| Today | 9 rows (81 bricks), paddle 100 px, ball 108 %, no brick over 2 hits | | 9 rows, paddle 76 px, ball 104 %, top 4 rows one hit tougher | 9 rows, paddle 68 px, ball 108 %, every row one hit tougher |
| **Evidence** | measured: wall built in memory from the dealt board, 16 seeds: 6 rows, one hit, 112 px paddle: average median 43 (mean 72), elite 184, best 199, 0/16 at 200. Normal today: average 79, elite 173. | | measured: in memory, 16 seeds: 11 rows, 68 px, 2 rows sliding from the start, speed full by 55 s: average 87, elite 182, 2/16 at 200. Not below Normal (79 and 173). | measured: in memory, 16 seeds: 12 rows, 52 px, 4 sliding rows, speed full by 60 s: average 64, elite 167, best 200, 2/16 at 200; flawless bot 7/16 at 200. |

- **Why this curve:** Bricks to break is the whole game and today every level shows the same 81, so each level adds rows until the 90 s clock can hold no more (12 rows, the wall the stored perfect run clears), and the paddle and sliding rows carry the rest of Expert.
- **Fact-check verdict:** unproven: Expert's 200 is reached under the limits (2 of 16 seeds), but the bots do not respond to paddle width, Hard measures no harder than Normal and Easy measures below Normal for the average bot.
- **Human limits today:** scripts/level-tune.ts:187 (--human-limits) builds the bots with HUMAN_LIMITS (human.ts:110, :132: reactions 250 ms, tracking lag 150 ms); it measures, nothing asserts, and no levels check for this game mentions limits. The breaker bot reads reaction and lag. There is no oracle, level deal or level check for Breaker.
- **Proof:** No level has a proof today. Write scripts/breaker-level-deal.ts: the flawless skill-band bot (scripts/arcade-skill-bands/bots/breaker.ts, run as scripts/breaker-clear-perfect-record.ts runs it) under HUMAN_LIMITS on each level's wall, keeping only seeds whose run scores 200 through replayBreakerRun; deal levels from that list (src/lib/duel/breakerLevelDeals.server.ts) and replay it in a new breaker-levels-check. docs/arcade-standard/breaker.md records a stored perfect run clearing all 108 bricks of the 12-row wall in 35.3 s on brkRev 11.
- **Measured today:** Elite bot under human limits (seeds 20 to 30): 190 / 185 / 177 / 143.
- **Stamp:** brkRev 13 on Easy, Hard and Expert deals only (Normal stays brkRev 12): level rounds stored since 16 Nov must replay on today's table.
- **Files:** `src/lib/arcade/retroLevels.ts (BREAKER_LEVELS)`, `src/lib/arcade/breaker.ts (applyBreakerLv: rows up to 12, slide starts)`, `scripts/arcade-skill-bands/bots/breaker.ts`, `scripts/breaker-level-deal.ts (new)`, `src/lib/duel/breakerLevelDeals.server.ts (new)`, `scripts/breaker-levels-check.ts (new)`
- **Risk:** the skill-band bots' scores do not move with paddle width or rows (average bot: Easy 43, Normal 79, Hard 87, Expert 64; 12 rows at 60, 52, 40 and 32 px: 67, 64, 68, 70), so the steps need a better bot or people to confirm; a human-paced bot clears 108 bricks inside 60 s on few seeds (200 on 2 of 16)

### Pinball (`pinball`, Retro)

**Lever: Flipper length and the drain gap.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Flippers 62 px (the drain shrinks to about 17 px, one ball wide); 4 balls; 10 s ball save; gravity 85 %; core full at 50,000. | pinRev 8: one fixed table, 56 px flippers (about 27 px of drain between them for a 16 px ball), 3 balls, no ball save, multiball 20 s, core full at 61,000, 90 s | Flippers 48 px (drain about 41 px, two and a half balls); gravity 115 %; 3 balls; multiball and core figure as Normal. | Flippers 42 px (drain about 51 px, three balls); gravity 130 %; 2 balls; multiball and core figure as Normal (today's 66,000 dropped). |
| First seconds | Long flippers that almost meet, four balls | | Shorter flippers, a drain two and a half balls wide | Stubby flippers, a three-ball drain, two balls |
| Today | 4 balls, 10 s ball save, gravity 85 %, multiball 25 s, core full at 50,000 | | 3 balls, gravity 110 %, multiball 18 s, core full at 61,000 | 2 balls, gravity 120 %, multiball 15 s, core full at 66,000 |
| **Evidence** | not measured: flipper length is a module constant (PIN_FLIP_LEN, pinball.ts:75; pinball4.ts:340), not a level setting. Today's Easy, scratch harness (level-tune's own loop and HUMAN_LIMITS), 24 seeds, medians: average 86, elite 185, 4/24 at 200. | | not measured: needs sim code for the flipper length. Today's Hard: average 97, elite 185 (above Normal's 90 and 174), 1/24 at 200. | not measured: needs sim code for the flipper length. Today's Expert: average 29, elite median 190, mean 161, 6/24 at 200. |

- **Why this curve:** Every lost ball leaves between or past the flippers, so their reach is the one setting that changes what a player can save, and unlike gravity it shows on the table before the first launch.
- **Fact-check verdict:** unproven: the headline lever (flipper length) cannot be played without sim code; today's Hard measures no harder than Normal and the elite's Expert median is 190.
- **Human limits today:** scripts/level-tune.ts:187 (--human-limits) builds the bots with HUMAN_LIMITS (human.ts:110, :132: reactions 250 ms, tracking lag 150 ms); it measures, nothing asserts, and no levels check for this game mentions limits. The pinball bot reads reaction and lag. The table has no stored witness at any level and no levels check.
- **Proof:** The table is fixed and uses no seed, so each level needs one stored witness and none exists today: search with the skill-band bot (scripts/arcade-skill-bands/bots/pinball.ts) under HUMAN_LIMITS for an input log that scores 200 through the server replay with that level's flippers, gravity and balls (scripts/pinball-level-witness.ts, to write) and replay the three logs in a new pinball-levels-check.
- **Measured today:** Elite bot under human limits, 12 seeds: 196 / 188 / 188 / 164 (Hard is no harder than Normal).
- **Stamp:** pinRev 9 on Easy, Hard and Expert deals only (Normal stays pinRev 8): stored level rounds must replay on today's table.
- **Files:** `src/lib/arcade/retroLevels.ts (PINBALL_LEVELS)`, `src/lib/arcade/pinball.ts (PIN_FLIP_LEN read from the level)`, `src/lib/arcade/pinball4.ts`, `scripts/arcade-skill-bands/bots/pinball.ts`, `scripts/pinball-level-witness.ts (new)`, `scripts/pinball-levels-check.ts (new)`
- **Risk:** the ramps and lock were tuned for 56 px flippers, so a 42 px flipper may not reach a shot the 200 needs

### Blockzone (`blockfall`, Retro)

**Lever: How fast the pieces fall.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | A row every 72 ticks quickening to 36 (150 %); lock delay 45 ticks; 5 previews; lines full at 15 (an average player clears about 14 in 90 s). | blockfallRev 2: a row every 48 ticks quickening to 24 over six steps, lock delay 30 ticks, 3 previews, lines full at 51, 90 s | A row every 12 ticks quickening to 6 (four times Normal's pace); lock delay 15 ticks; 2 previews; lines full at 51 as Normal (today's 57 dropped). | A row every 7 ticks quickening to 4 (15 % of Normal's fall time, nearly seven times the pace); lock delay 12 ticks; 1 preview; lines full at 51 as Normal (today's 62 dropped). |
| First seconds | The first piece drifts down, five next pieces shown | | The first piece falls four times as fast, two previews | The piece hits the floor in about two seconds, one preview |
| Today | A row every 60 ticks at the start (125 %), lock delay 40 ticks, 3 previews, lines full at 40 | | A row every 38 ticks at the start (80 %), lock 24, 2 previews, lines full at 57 | A row every 29 ticks at the start (60 %), lock 18, 1 preview, lines full at 62 |
| **Evidence** | measured: table overridden in memory, 24 seeds: 150 % with lines full at 15: average median 158 (92 % reach the clock), elite 189, 10/24 at 200. As first proposed (full at 30): average 113. | | measured: in memory, 24 seeds: 25 % fall time, lock 15: average 57 (every run tops out), elite median 190, mean 166, 9/24 at 200. As first proposed (50 %): average 86 against Normal's 92. | measured: in memory, 24 seeds: 15 % fall time, lock 12: average 29, elite median 144, best 200, 6/24 at 200, 38 % reach the clock. As first proposed (25 %): average 53, elite 190. |

- **Why this curve:** Fall speed is the genre's own difficulty dial and is felt on the very first piece, but doubling it measured no harder than Normal, so the steps are four and nearly seven times Normal's pace, and Easy lowers the line target to what an average player clears.
- **Fact-check verdict:** adjusted: Hard from twice to four times Normal's pace (twice measured 6 points under Normal), Expert from 25 % to 15 % fall time (elite 190 to 144), Easy's lines full at 30 to 15 (average 113 to 158).
- **Human limits today:** Nothing: --human-limits changes no Blockzone number because the bot reads neither reaction nor lag (bots/blockfall.ts:47-80); its own gesture model gives the elite about 0.13 to 0.17 s a gesture. blockfall-oracle.ts and blockfall-deal.ts are frame-exact, Normal only.
- **Proof:** Normal has a proved deal (scripts/blockfall-oracle.ts through scripts/blockfall-deal.ts: 300 seeds at exactly 200); levels have none, and today's Hard and Expert ask for 57 and 62 lines against Normal's 51. Run the same oracle (it already looks only one piece ahead) under HUMAN_LIMITS with each level's gravity, lock delay and previews and keep a seed list per level (blockfall-deal.ts --level and src/lib/duel/blockfallLevelDeals.server.ts, to write), re-proved by a new blockfall-levels-check.
- **Measured today:** Elite bot under human limits, 20 seeds: 178 / 172 / 166 / 155. Average bot at Normal: 91 (14 lines, 58 pieces).
- **Stamp:** blockfallRev 3 on Easy, Hard and Expert deals only (Normal stays blockfallRev 2): stored level rounds must replay on today's table.
- **Files:** `src/lib/arcade/retroLevels.ts (BLOCKFALL_LEVELS)`, `src/lib/arcade/blockfall.ts`, `scripts/blockfall-oracle.ts`, `scripts/blockfall/planner.ts`, `scripts/blockfall-deal.ts`, `src/lib/duel/blockfallLevelDeals.server.ts (new)`, `scripts/blockfall-levels-check.ts (new)`
- **Risk:** the bot hard-drops and never reads the previews, so the elite's Hard stays near 190 (a third of its runs top out) and only Expert pulls it down to 144

### Rally (`rally`, Retro)

**Lever: Width of the paddle.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Paddle 168 px shrinking to 84; no bumpers at all; 4 lives; ball top speed 86 %; core full at 20 gold hits. | rallyRev 13: 2 lives, paddle 120 px shrinking to 40, bumpers arrive at 30 s and 45 s, core full at 23 gold hits, 60 s | Paddle 72 px shrinking to 28; both bumpers on court from the first serve; 2 lives; top speed 115 %; core full at 23 as Normal (today's 26 dropped). | Paddle 48 px shrinking to 24; both bumpers on court from the first serve; 1 life; top speed 125 %; core full at 23 as Normal (today's 29 dropped). |
| First seconds | A paddle 40 % of the court wide, no bumpers | | A paddle two fifths narrower, two bumpers already on court | A paddle two fifths of Normal's width, two bumpers, one life |
| Today | 3 lives, paddle 140 px shrinking to 60, ball top speed 86 %, bumpers at 45 s and 60 s, core full at 20 gold hits | | 2 lives, paddle 104 px shrinking to 36, top speed 115 %, bumpers at 20 s and 35 s, core full at 26 | 1 life, paddle 96 px shrinking to 32, top speed 125 %, bumpers at 10 s and 25 s, core full at 29 |
| **Evidence** | measured: table overridden in memory, 24 seeds: average median 158, elite 177 (best 196, 0/24 at 200). | | measured: table in memory, 24 seeds: paddle 72 to 28: average median 98, elite 110, best 171 (Normal 123 and 135). As first proposed (88 to 32): average 110, elite 114. | measured: in memory, 24 seeds: paddle 48 to 24, 1 life, 125 %: average 98 (mean 92), elite 114, best 175, 0/24 at 200. With 64 to 28: average 86; with 40 to 20: average 87, elite 108. |

- **Why this curve:** In a paddle game the paddle is the target, so each level takes about two fifths off it, with the bumpers already on court instead of arriving ten seconds sooner, which makes every step visible before the ball is struck.
- **Fact-check verdict:** adjusted: Hard's paddle 88 to 72 px (88 px measured 13 under Normal, 72 px 25 under) and Expert's 64 to 48 px to keep a visible gap; Expert's step and its 200 stay unproven (the bot's score stops falling under 72 px and no bot earns a spin shot).
- **Human limits today:** scripts/level-tune.ts:187 (--human-limits) builds the bots with HUMAN_LIMITS (human.ts:110, :132: reactions 250 ms, tracking lag 150 ms); it measures, nothing asserts, and no levels check for this game mentions limits. The rally bot reads reaction and lag. There is no Rally oracle, level deal or level check.
- **Proof:** No level has a proof, and no bot earns a spin shot, so even Normal's last 10 points are unshown. Write a Rally oracle that plans returns and the swipes for spin shots under HUMAN_LIMITS (scripts/rally-oracle.ts), keep per-level seeds whose run scores 200 through the server replay (src/lib/duel/rallyLevelDeals.server.ts) and replay them in a new rally-levels-check; raise the gold-hit figure above 23 only if the oracle shows it.
- **Measured today:** Elite bot under human limits (seeds 20 to 30): 175 / 159 / 156 / 142 (Hard barely below Normal). Average bot at Normal: 135.
- **Stamp:** rallyRev 14 on Easy, Hard and Expert deals only (Normal stays rallyRev 13): stored level rounds must replay on today's table.
- **Files:** `src/lib/arcade/retroLevels.ts (RALLY_LEVELS)`, `src/lib/arcade/rally.ts`, `scripts/arcade-skill-bands/bots/rally.ts`, `scripts/rally-oracle.ts (new)`, `src/lib/duel/rallyLevelDeals.server.ts (new)`, `scripts/rally-levels-check.ts (new)`
- **Risk:** below about 72 px the bot's score stops falling (48 px: 98, 40 px: 87), so Expert's step is not shown, and a 24 px paddle against a 14 px ball at 125 % speed may be more than a human-paced oracle can hold, in which case the floor is 32

### Tempo (`beat`, Retro)

**Lever: Number of lanes.** Redesigned. **New mechanic:** A sixth lane at Expert (and three at Easy); the game already grows from four lanes to five

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 3 lanes for the whole song (no fourth or fifth); off-beats and chords half of Normal's; windows 5 / 10 / 16 ticks; fall 110 ticks. | beatRev 12: 4 lanes with a fifth from 40 s, hit windows 4 / 8 / 13 ticks (Perfect / Good / OK), fall 90 ticks, 75 s | 5 lanes from the first note (Normal from 40 s); off-beats 170 % and chords 160 % of Normal's; windows 3 / 6 / 11; fall 75 ticks. | 6 lanes from the first note; off-beats 240 % and chords 220 %; windows 3 / 6 / 11 as Hard (today's 2 / 5 / 10 dropped); fall 60 ticks. |
| First seconds | Three wide lanes, notes far apart | | Five lanes from the first bar | Six narrow lanes, notes falling in one second |
| Today | Hit windows 5 / 10 / 16 ticks, fall 110 ticks, Normal's chart and lanes | | Windows 3 / 6 / 11, fall 75 ticks, off-beats 170 % and chords 160 % of Normal's, lanes as Normal | Windows 2 / 5 / 10, fall 60 ticks, off-beats 240 % and chords 220 %, lanes as Normal |
| **Evidence** | not measured: three lanes need sim code. Partial on Normal's lanes, table in memory, 16 seeds (windows 5/10/16, fall 110, half the off-beats and chords): average 121, elite 188. | | not measured: five lanes from the first note needs sim code. Today's Hard carries the proposal's windows, fall and chart shares: 24 seeds, average 88, elite 188 (Normal 106 and 194). | not measured: the sixth lane is a new mechanic, not built. Partial on Normal's lanes, 16 seeds (windows 3/6/11, fall 60, 240 % and 220 %): average 80, elite 180, best 189; today's Expert 73 and 181. |

- **Why this curve:** Lanes are what a rhythm chart is read across and the game already grows from four to five mid-song, so one more lane a level is a step anyone sees before the first note, where today's tighter windows are invisible and the bots sit inside all of them.
- **Fact-check verdict:** unproven: lanes cannot be played without sim code; without them the proposal's other settings measure 121, 106, 88, 80 for the average bot (Hard to Expert only 8 apart) and no elite run reaches 200 at any level (best 199).
- **Human limits today:** scripts/level-tune.ts:187 (--human-limits) builds the bots with HUMAN_LIMITS (human.ts:110, :132: reactions 250 ms, tracking lag 150 ms); it measures, nothing asserts, and no levels check for this game mentions limits. The beat bot reads reaction and timing only. No chart check or oracle applies any limit.
- **Proof:** Timing games are open by design, so the proof is the chart: a static check on every dealt chart that two thumbs can play it with each thumb given 0.15 s (9 ticks) between notes in different lanes and never more than two notes at once (scripts/beat-levels-check.ts, to write), plus the elite bot under HUMAN_LIMITS landing 120 to 150 on Expert. Expert keeps Hard's windows so a Perfect stays 50 ms either side.
- **Measured today:** Elite bot under human limits, 20 seeds: 190 / 191 / 188 / 180 (flat: its timing sits inside every window). Average bot at Normal: 110.
- **Stamp:** beatRev 13 on Easy, Hard and Expert deals only (Normal stays beatRev 12): stored level rounds must replay on today's table and charts.
- **Files:** `src/lib/arcade/retroLevels.ts (BEAT_LEVELS gains lanes)`, `src/lib/arcade/beat.ts (chart plan and judging for 3 and 6 lanes)`, `src/lib/arcade/beat.renderer.ts`, `src/components/puzzles/tapMapping.ts (lane taps; tap-mapping-check)`, `src/lib/desktopKeys.ts (six keys)`, `scripts/arcade-skill-bands/bots/beat.ts`, `scripts/beat-levels-check.ts (new)`
- **Risk:** six lanes of about 60 px for two thumbs on a 390 px phone, and the chart builder and art are written for four and five lanes

### Meteor (`snake`, Retro)

**Lever: Rocks on the field.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | No rocks and no meteor shower; edges wrap; 3 lives; a square every 9 ticks quickening to 5 (today's Easy pace); core full at 20 stars. | snakeRev 15: 19 x 34 field, 2 lives (the first crash forgiven), a square every 9 ticks quickening to 4, edges wrap, up to 11 rocks that only fall once the comet has grown (from 10 s), core full at 36 stars, 60 s | 8 rocks on the field from the first tick, then one more every 3 s from 10 s whatever the comet's length (20 at most); walls; 2 lives; pace as Normal; core full at 36 as Normal (today's 50 dropped). | 16 rocks on the field from the first tick, then one more every 2 s from 5 s (32 at most); walls; 1 life; a square every 7 ticks quickening to 3; core full at 36 as Normal (today's 48 dropped). |
| First seconds | An open field with no rocks at all | | Eight rocks already down, walls round the field | Sixteen rocks, walls, a quicker comet, one life |
| Today | 3 lives, a square every 9 ticks quickening to 5, edges wrap, core full at 27 stars | | 2 lives, a square every 8 ticks quickening to 4, walls instead of wrap, core full at 50 | 1 life, a square every 8 ticks quickening to 3, walls, core full at 48 |
| **Evidence** | measured: table and first state in memory, 16 seeds: no rocks, 9 to 5 ticks, core full at 20: average median 143, elite 174, best 184. As first proposed (10 to 6 ticks, full at 27): average 118, elite 165. | | measured: 8 of the course's own rock squares landed at tick 0 in memory, walls, 2 lives, full at 36, 16 seeds: average 73, elite 175, best 186 (Normal 93 and 175). The rock-every-3-s rule needs sim code and was not played. | measured: about 12 of 16 rocks landed at tick 0 in memory, walls, 1 life, 7 to 3 ticks, 16 seeds: average 33, elite median 150, best 190, 0/16 at 200. The timed rocks up to 32 need sim code and were not played. |

- **Why this curve:** Rocks are Meteor's own hazard, but today they only fall once a comet has grown, so no level can be told from Normal at the start; putting them on the field from the first tick shows the step at once and squeezes every route.
- **Fact-check verdict:** adjusted: Easy's core full at 27 to 20 stars and its pace back to today's 9 to 5 ticks (average 118 to 143, elite 165 to 174); Hard and Expert measure 73 and 33 for the average bot, but no elite run reaches 200 at any level.
- **Human limits today:** scripts/level-tune.ts:187 (--human-limits) builds the bots with HUMAN_LIMITS (human.ts:110, :132: reactions 250 ms, tracking lag 150 ms); it measures, nothing asserts, and no levels check for this game mentions limits. The snake bot reads reaction and think time. There is no Meteor oracle, level deal or level check.
- **Proof:** No level has a proof, and today's Hard and Expert raise the core to 50 and 48 stars with nothing showing a player can reach them. Write a comet planner that takes the stars, gold stars, lanes and warps with turns at least 0.15 s apart and acts on a rock's shadow no sooner than 0.25 s after it shows (scripts/snake-oracle.ts), keep per-level seeds at 200 through the server replay (src/lib/duel/snakeLevelDeals.server.ts) and replay them in a new snake-levels-check.
- **Measured today:** Elite bot under human limits, 20 seeds: 177 / 175 / 167 / 161.
- **Stamp:** snakeRev 16 on Easy, Hard and Expert deals only (Normal stays snakeRev 15): stored level rounds must replay on today's table.
- **Files:** `src/lib/arcade/retroLevels.ts (SNAKE_LEVELS)`, `src/lib/arcade/snake.ts (rock slots that land at tick 0 and on the clock)`, `scripts/arcade-skill-bands/bots/snake.ts`, `scripts/snake-oracle.ts (new)`, `src/lib/duel/snakeLevelDeals.server.ts (new)`, `scripts/snake-levels-check.ts (new)`
- **Risk:** no Meteor oracle exists and no elite run under the limits reaches 200 at any level (best 190; Normal's best 187); at a square every 3 ticks a human-paced comet cannot make a tight U-turn, so Expert's top pace may need to stay at 4

### Spacewalk (`cross`, Retro)

**Lever: Traffic on the first crossing.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Traffic 3 twelfths on the first crossing rising to 8 (half of Normal's start); 4 lives; a hit costs 10; core full at 70. | crossRev 13: 14 rows a crossing, traffic 6 twelfths on the first crossing rising to 12 by the seventh, 3 lives, a hit costs 15, core full at 76, 60 s | Traffic 10 twelfths on the first crossing rising to 15 (Normal starts at 6); 3 lives; a hit costs 15; core full at 76. | Traffic 14 twelfths on the first crossing and 15 from the second (the most that can be proved passable); every ship 25 % faster; 2 lives; a hit costs 20; core full at 76 as Normal (today's 80 dropped). |
| First seconds | Half Normal's ships, long empty gaps in every lane | | Two thirds more ships than Normal on the first crossing | Over twice Normal's ships, each a quarter faster |
| Today | Traffic 5 twelfths on the first crossing rising to 10, 4 lives, a hit costs 10, core full at 70 | | Traffic 8 twelfths rising to 15, 3 lives, a hit costs 15, core full at 76 | Traffic 10 twelfths rising to 18 on paper (a crossing that cannot be proved steps back towards 12), 2 lives, a hit costs 20, core full at 80 |
| **Evidence** | not measured: run pending. Today's Easy, scratch harness (level-tune's own loop and HUMAN_LIMITS), 24 seeds, medians: average 141, elite 200, 16/24 at 200. | | not measured: run pending. Today's Hard: average 84, elite 160, 1/24 at 200. | not measured: ship speed is not a level setting (CrossLv has density, lives, hitCost, fullAt). Today's Expert: average 49, elite 139, best 180, 0/24 at 200. |

- **Why this curve:** Today's steps are the right size for strong players but only open up from the fourth crossing; moving the density to the first crossing makes each level look different at once, and ship speed carries Expert because density cannot be proved much past 15 twelfths and the 14 rows are all a phone can hold.
- **Fact-check verdict:** unproven: the density tables can be played in memory (run pending), the 25 % faster ships cannot without sim code.
- **Human limits today:** scripts/level-tune.ts:187 (--human-limits) builds the bots with HUMAN_LIMITS (human.ts:110, :132: reactions 250 ms, tracking lag 150 ms); it measures, nothing asserts, and no levels check for this game mentions limits. The cross bot reads reaction and lag. The sim's crossing proofs and scripts/cross-std-density.ts use no human timing; there is no level deal or levels check.
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
| **Evidence** | measured: today's Easy, scratch harness (level-tune's own loop and HUMAN_LIMITS), 24 seeds, medians: average 165, elite 194, 8/24 at 200, no run ended early. | | measured: today's Hard, 24 seeds: average 80, elite 142 (best 178); Normal measures 86 and 159, so Hard is 6 under Normal for the average bot. | measured: today's Expert, 24 seeds: average 42, elite 99, best 144, 0/24 at 200 under HUMAN_LIMITS (the earlier pass's 135 used the bot's own limits only). |

- **Why this curve:** It is the one ladder in the group that already climbs on a hazard you can count on the first screen and already measures on target at every level, so changing it would only add risk.
- **Fact-check verdict:** unproven: Easy and Expert measure on target for the average bot, but Hard is only 6 under Normal and the elite under HUMAN_LIMITS never passes 144 on Expert.
- **Human limits today:** scripts/action-levels-bands.ts:29-33 sets `human.limits`, which bots/ricochet.ts reads; level-tune.ts:187 sets the same flag and also raises reactions to 250 ms. Both only measure. The tower's witness is frame-exact and ricochet-levels-check asserts its 200 with no limits.
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
| **Evidence** | not measured: bolts a volley, the bolt cap and the diver wave are module constants (wavefront.ts:70, :163, :1588), not level settings. Today's Easy, scratch harness (level-tune's own loop and HUMAN_LIMITS), 24 seeds, medians: average 175, elite 194. | | not measured: needs sim code for the fire tables. Today's Hard: average 170, elite 194, 2/24 at 200 (Normal 173 and 196). | not measured: needs sim code for the fire tables. Today's Expert: average 140, elite 194, 4/24 at 200. |

- **Why this curve:** The ship fires for you, so the skill is dodging; raising how many bolts fall, not how fast one flies, is a step a person feels in the first second and one the dodge-everything bots can finally show.
- **Fact-check verdict:** unproven: the volley ladder cannot be played without sim code; today's levels measure flat for the elite (194 to 196) and 173, 170, 140 for the average bot.
- **Human limits today:** scripts/level-tune.ts:187 (--human-limits) builds the bots with HUMAN_LIMITS (human.ts:110, :132: reactions 250 ms, tracking lag 150 ms); it measures, nothing asserts, and no levels check for this game mentions limits. The wavefront bot reads reaction and lag. The dealt witnesses (scripts/wavefront-big-deal.ts, wavefront-deal-check) are exact logs with no limits.
- **Proof:** wavRev 15 is already dealt only from seeds with a stored witness at exactly 200 at every level (scripts/wavefront-big-deal.ts, src/lib/duel/wavefrontDeal.server.ts, scripts/wavefront-deal-check.ts). Rebuild that deal on the new fire tables with the witness held to HUMAN_LIMITS (no dodge sooner than 0.25 s after a bolt leaves its ship) and drop seeds without one.
- **Measured today:** Elite bot under human limits, 12 seeds: 193 / 194 / 195 / 196 (flat: the bots dodge every bolt). Average bot at Normal: 155 (wavRev 12).
- **Stamp:** wavRev 16 on Easy, Hard and Expert deals only (17 if the pending wider formation takes 16). The ladder does not need that stamp: the same 36 ships a wave fire more.
- **Files:** `src/lib/arcade/retroLevels.ts (WAVEFRONT_LEVELS: volley, bolt cap, divers from)`, `src/lib/arcade/wavefront.ts`, `scripts/wavefront-big-deal.ts`, `src/lib/duel/wavefrontDeal.server.ts`, `scripts/wavefront-deal-check.ts`, `scripts/arcade-skill-bands/bots/wavefront.ts`
- **Risk:** triple volleys with 18 bolts in the air may leave no hitless path on most seeds, so the cap is the number to tune first

### Iron Wall (`bastion`, Action)

**Lever: Tanks in each wave.** Redesigned. **New mechanic:** A fourth lane, from Hard

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 4 tanks a wave (20 in all, 1 heavy) on 3 lanes; weak-spot part full at 20 hits (20 tanks with 1 heavy allow only 21); today's Easy aids kept: green zone 320 ms, weak spots 260 %, 5 base hits, pace 32 to 74 %. | bastionRev 4: 30 tanks in 5 waves on 3 lanes (5 heavies), pace 36 to 82 %, green zone 160 ms, weak spots 240 %, 4 base hits, 60 s | A fourth lane; 8 tanks a wave (40 in all, 10 heavies); today's Hard aim settings: green zone 120 ms, weak spots 120 %, 3 base hits, pace 40 to 95 %. | Four lanes; 9 tanks a wave (45 in all, 12 heavies); bastionRev 3's aim settings (green zone 90 ms, weak spots 100 %, 3 base hits, drones 4 px a tick); pace 56 % from the first wave (bastionRev 3 reaches that on wave 3), then 80 and 104 %. |
| First seconds | Four tanks roll in on a quiet three-lane road | | A fourth lane, eight tanks in the first wave | Four lanes, nine tanks a wave, rolling in 40 % faster |
| Today | bastionRev 4: 30 tanks (2 heavies), pace 32 to 74 %, green zone 320 ms, weak spots 260 %, 5 base hits | | bastionRev 4: 30 tanks (8 heavies), pace 40 to 95 %, green zone 120 ms, weak spots 120 %, 3 base hits, drones 3 px a tick | bastionRev 3, the old Normal: 30 tanks (8 heavies), pace 44 to 104 %, green zone 90 ms, weak spots 100 %, 3 base hits, drones 4 px a tick |
| **Evidence** | not measured: tanks a wave are fixed in the sim (BT2_WAVES, bastionTank.ts:142). Today's Easy, 60 seeds: average 172, elite under the bot's limits 198, 9/60 at 200. | | not measured: the fourth lane needs sim code (3 lanes at bastionTank.ts:109, :289, :720). Today's Hard, 60 seeds: average 104, elite 161, best 177; oracle paced at 0.25 s and 0.15 s: 200 on 60/60. | not measured: needs sim code. Today's Expert, 60 seeds: average 84, elite 146, best 172; paced oracle 200 on 58/60; same field as Hard for the first 5 s on 60/60 seeds. Pace-only probe (56 56 56 80 104): average 91, elite 148. |

- **Why this curve:** A wall is harder to hold when more comes at it, yet today all four levels send the same 30 tanks down the same three lanes; more tanks a wave, with a fourth lane to carry them (four 96 px lanes is all a 390 px screen holds for a 94 px heavy), is the step the eye catches.
- **Fact-check verdict:** adjusted: Easy's weak-spot part made full at 20 hits (20 tanks cannot give 30); the four-lane Hard and Expert stay unproven, not measured without sim code, though today's Expert already measures 15 to 20 under Hard.
- **Human limits today:** bots/bastion.ts:44 BASTION_HUMAN_LIMITS (0.25 s notice, 0.15 s move, aim 5 px, timing 30 ms) is applied through `fixes` (:66-70) by level-tune and the band tool; --human-limits changes nothing more. bastion-levels-check.ts:239-252 asserts the oracle's 200 with no human.
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
| **Evidence** | not measured: run pending. Today's Easy, scratch harness (level-tune's own loop and HUMAN_LIMITS), 24 seeds, medians: average 133, elite 200, 23/24 at 200. | | not measured: run pending. Today's Hard: average 53, elite 174, 1/24 at 200. | not measured: run pending. Today's Expert: average 28, elite 166, best 186, 0/24 at 200. |

- **Why this curve:** Today's table already measures close to target, but Easy starts at Normal's speed and the harder levels only pull ahead later, so setting the opening pace apart makes the same ladder visible from the first second without raising a top speed that is already near the reaction limit.
- **Fact-check verdict:** unproven: the new opening speeds are level-table values (run pending); today's ladder already measures 133, 109, 53, 28 for the average bot.
- **Human limits today:** scripts/flip-skyline-levels-bands.ts plays a `limited` bot (humanLimits.ts:16) and level-tune.ts:187 the HUMAN_LIMITS bots: both only measure. The level deal's witness (flip-level-deal.ts with flip-x200-plan.ts) is planned to the exact tick and flip-levels-check asserts its 200 with no limits.
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
| **Evidence** | not measured: wave lists are built inside the sim's init (buildWaves, burst.ts:164; initV10, :1702), not a level setting. Today's Easy, scratch harness (level-tune's own loop and HUMAN_LIMITS), 24 seeds, medians: average 151, elite 185 (best 198). | | not measured: needs sim code for per-level wave lists. Today's Hard: average 83, elite 173 (Normal 87 and 180). | not measured: needs sim code for per-level wave lists. Today's Expert: average 61, elite 165, best 179, 0/24 at 200. |

- **Why this curve:** Fission is about how much is bouncing at once, and every level today opens on the same single atom; bigger waves show the step in the opening second and stretch the run towards the clock, which shorter quick-clear timers never showed anyone.
- **Fact-check verdict:** unproven: bigger waves cannot be played without sim code; today no elite run under the limits reaches 200 at any level (best 198, 192, 184, 179) and Hard is 4 under Normal for the average bot.
- **Human limits today:** scripts/level-tune.ts:187 (--human-limits) builds the bots with HUMAN_LIMITS (human.ts:110, :132: reactions 250 ms, tracking lag 150 ms); it measures, nothing asserts, and no levels check for this game mentions limits. The burst bot reads reaction and lag. The oracle in scripts/arcade-standard/burst.ts is frame-exact and covers Normal only; no level has a proof.
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
| **Evidence** | not measured: belts are part of each level's banked courses (scripts/orbit-fuel-bank.ts:53 beltsFrom), so a bank rebuild is needed. Today's Easy, scratch harness (level-tune's own loop and HUMAN_LIMITS), 24 seeds, medians: average 119, elite 185. | | not measured: needs a rebuilt bank and a belt spacing the builder lacks. Today's Hard: average 77, elite 176 (best 189). | not measured: needs a rebuilt bank. Today's Expert: average 88 (above Hard's 77), elite 159, best 183, 0/24 at 200; 42 % of elite runs reach the sun. |

- **Why this curve:** Hop width and fuel already step but are hard to see and leave Expert no harder than Hard for an average player, whereas belts are Orbit's own hazard, sit on screen from the first planet and turn every release into a threaded shot.
- **Fact-check verdict:** unproven: belt settings need a bank rebuild, so none of the three levels was played; today's Expert measures no harder than Hard for the average bot, as the row says.
- **Human limits today:** scripts/orbit-level-bands.ts:26 ORBIT_HUMAN_LIMITS (reactions 250 ms, think scale 0.43, applied at :56-58) and level-tune.ts:187 only measure. The bank witness (orbit-fuel-bank.ts, orbit-xp-lib.ts) is frame-exact and orbit-levels-check asserts its 200 with no limits.
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
| **Evidence** | not measured: today's levels were not re-run this session (the run was cut off); the earlier pass's numbers stand (average 113, elite 199, 6 courses). | | not measured: a chase from the first vine with two paces and a 400 px head start needs sim code (one chasePace a level, swing.ts:3355; fixed gap, :3351). | not measured: needs sim code for the opening pace and head start; only the chase start (state field chaseFrom, swing.ts:532) can be set in memory. |

- **Why this curve:** Reach, sliding vines and swing speed change the route but not the look and leave every bot flat across the levels, whereas the chaser the game already has turns the whole course into a race the moment it appears.
- **Fact-check verdict:** unproven: the early chase could not be played as proposed; a one-pace probe is pending.
- **Human limits today:** scripts/action-levels-bands.ts:29-33 sets `human.limits`, which bots/swingRework.ts reads; level-tune.ts:187 sets the same flag and raises reactions to 250 ms. Both only measure. The deal's oracle (swing-slide-deal.ts) hits exact ticks and swing-levels-check asserts its 200 with no limits.
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
| **Proposed** | As today: 5 ice cells, 5 colours, goals 12 to 36, hint after 3 s (average 163 and a third of runs earn a star, so it does its job). | matchupRev 13: 6 colours, 10 two-hit ice cells on the 7 x 10 board, goals 20 to 60, hint after 5 s, 90 s | 18 ice cells (Normal 10); a 7th colour, the cyan heart; goals 30 to 90 over 7 colours; no hint; parts full at 320 gems, 2 treasures, 3 goals, 12 ice, 3 big lines (today's Expert moved down one level). | 28 ice cells (40 % of the 70 squares; the sim lays ice only in the bottom six rows, so two thirds of them freeze); 7 colours; goals 30 to 90; no hint; parts full at 320 gems, 2 treasures, 3 goals, 18 ice, 3 big lines. |
| First seconds | Five colours, a handful of frozen squares, a hint after three seconds | | A seventh gem, the cyan heart, and 18 frozen squares | Ice over 28 squares: two thirds of the lower board |
| Today | 5 colours, 5 ice cells, goals 12 to 36, hint after 3 s idle | | 6 colours, 14 ice cells, goals 28 to 78, hint after 8 s, core full at 380 gems | 7 colours (cyan heart), 18 ice cells, goals 30 to 90, no hint; parts full well short (320 gems, 2 treasures, 3 goals, 12 ice, 3 big lines) |
| **Evidence** | measured: today's Easy kept; gemstone-levels-bands playLevel, 60 seeds: average 162.6 (19 of 60 at 175+), elite under limits 197.2 (47 at 200), flawless 198.1. | | measured: the proposed Hard is today's Expert table; 60 seeds: average 72.3 (Normal 95.3), elite under limits 137.0 (Normal 158.1; one run at 200), flawless 167.6 with 7 of 60 at 200. | measured: 28 ice set in memory (MATCHUP_V13_LEVELS), 60 seeds: average 70.7, elite under limits 132.4 (best 197, none at 200), flawless 169.4 (7 at 200). With every free cell frozen (40): 69.9 / 129.8 / 158.3. |

- **Why this curve:** Ice is the one thing on a match-three board you can count at a glance, each frozen square takes two clears and blocks free swaps, and the seventh colour thins the matches needed to break it.
- **Fact-check verdict:** unproven: Hard holds (95 to 72), but 28 ice does not separate Expert from Hard (average 72.3 to 70.7, elite 137 to 132) and nor do 40 cells; only the parts' full figures moved scores, and then no run reached 200.
- **Human limits today:** scripts/gemstone-levels-bands.ts:25-29 (limitHuman: elite reactions held at 250 ms; --limits, line 90) measures only; nothing asserts per seed. The witnesses gemstone-levels-check replays are one flawless seed a level and 3 elite Expert seeds.
- **Proof:** No per-seed proof today: scripts/gemstone-levels-record.ts holds a flawless witness on one seed a level and elite-under-limits witnesses on 3 Expert seeds. Write scripts/gemstone-level-deal.ts: a dealt list per level (new src/lib/duel/matchupLevelDeal.server.ts) keeping only seeds where the planner of scripts/arcade-skill-bands/bots/matchup.ts, held to HUMAN_LIMITS (250 ms reactions, 150 ms swipes), replays to exactly 200 through the server; scripts/gemstone-levels-check.ts replays every witness.
- **Measured today:** 60 seeds: average bot 163 / 95 / 82 / 72; elite under human limits 197 / 158 / 146 / 137; flawless 198 / 174 / 167 / 168
- **Stamp:** matchupRev 14 on Hard and Expert deals (Easy and Normal stay matchupRev 13): MATCHUP_V13_LEVELS is frozen with the stamp and stored level rounds must replay.
- **Files:** `src/lib/arcade/matchup.ts (MATCHUP_V13_LEVELS, a rev 14 table)`, `src/lib/levels/gameLevels.ts`, `scripts/gemstone-level-deal.ts (new)`, `src/lib/duel/matchupLevelDeal.server.ts (new)`, `scripts/gemstone-levels-bands.ts`, `scripts/gemstone-levels-check.ts`
- **Risk:** measured: the ice count barely moves scores (average 72 at 18 cells, 71 at 28, 70 at 40), so Expert needs a second lever that bites before it is built; the limited bot also reaches 200 on about 3 Expert seeds in 200 today, so a 60-seed list needs a stronger planner

### Mahjong Solitaire (`mahjong`, Cards & Board)

**Lever: Tiles in the stack.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 48 tiles in 2 layers (the 6 x 7 base plus a 2 x 3 cap); 2 faces dealt four times; Shuffle costs 2; free hints and the idle glow after 8 s; speed full by 70 s. | mahjongRev 2: 72 tiles in 4 layers on a 6 x 7 footprint, 6 faces dealt four times, Shuffle costs 5, no hints, speed full by 65 s, 120 s | 104 tiles in 4 layers on a 7 x 8 footprint (tiles 48 x 63 world px, 53 px wide on a phone); 18 faces dealt four times; Shuffle costs 10; no hints; speed full by 85 s. | 136 tiles in 4 layers on an 8 x 9 footprint (tiles 42 x 55 world px, 46 px wide: the phone ceiling); all 34 faces dealt four times; Shuffle costs 15; no hints; speed full by 100 s. |
| First seconds | A low two-layer stack of big tiles, a Hint button | | A wider, taller stack: 104 smaller tiles | The full set: 136 small tiles wall to wall |
| Today | 56 tiles in 3 layers, 2 faces dealt four times, Shuffle costs 2, free hints and idle glow, speed full by 70 s | | 72 tiles, 10 faces dealt four times, Shuffle costs 8, hints at 5 points each, speed full by 25 s | 88 tiles in 5 layers, 12 faces dealt four times, Shuffle costs 10, one hint, speed full by 30 s |
| **Evidence** | not measured: a 48-tile layout does not exist (the sim tells a layout by its length; only 56, 72 and 88 places are defined in mahjong.ts). | | not measured: needs a new 104-place layout on a 7 x 8 footprint and renderer sizes. | not measured: needs a new 136-place layout on an 8 x 9 footprint; today's 88-tile Expert measured 193.3 for the human-limits player (earlier pass, 40 deals). |

- **Why this curve:** Mahjong Solitaire is a search against the clock, so the number of tiles is the whole load, and the full four-of-each set is the game's own natural summit.
- **Fact-check verdict:** unproven: every proposed level needs a layout the sim does not have, so nothing could be run; today's human-limits player scores 197.5 / 195.1 / 193.3 on Normal / Hard / Expert, so tile count must carry the whole step.
- **Human limits today:** scripts/cards-human-limits.ts:28-30, 175 (one action every 24 ticks, a pair's second tap after 9) plays it for cards-levels-tune.ts:60 (--bots=human) and cards-levels-order-check.ts, which asserts each level is below the one before; the build-order proof has no clock.
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
| **Evidence** | measured: HR_LEVEL_SETTINGS set in memory (not the 5 outs: a new sim rule), 12 dealt seeds, HUMAN_LIMITS, server replay: average 103.3 (today's Easy 89 and Normal 63, earlier pass), elite 194.3, flawless 195.0. | | measured: 12 Hard-deal seeds (unproved on these settings): average 42.7 (median 46), elite under limits 197.8 with 9 of 12 at 200, flawless 200 on 12 of 12; today's Hard 26 / 172 (earlier pass). | measured: 12 Expert-deal seeds: average 13.1 (median 15), elite under limits 163.7 (median 157, one run at 200), flawless under limits 200 on 12 of 12; today's Expert 16 / 149 (earlier pass). |

- **Why this curve:** Batting is timing, so the ball's speed is the honest lever; it reaches the human floor at Expert, where the fielders' reach, already drawn on the grass before the first pitch, takes over as the squeeze.
- **Fact-check verdict:** holds: the average batter steps 103 / 63 / 43 / 13 and the elite reaches 200 at Expert under the limits (1 of 12) with PERFECT at ±1 tick; the elite's Hard (198) is no harder than Normal, the 5 outs were not run and the level deals are not re-proved.
- **Human limits today:** scripts/homerun-innings-bands.ts:17 (--human-limits) measures; scripts/homerun-innings-check.ts:247-257 asserts the elite under HUMAN_LIMITS steps down level by level on the dealt seeds; scripts/home-run-top-bins-expert-proof.ts:44 lists Expert seeds. The deal's oracle (homerun-oracle.ts) is not limited.
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
| **Evidence** | not measured: not reached this session. | | not measured: not reached this session. | not measured: not reached this session. |

- **Why this curve:** The wall is what a free kick is about and the first thing on screen: each extra man hides more of the goal and forces more bend or dip, which the quicker keeper and stronger wind then punish, with no hidden change to what a goal is worth.
- **Fact-check verdict:** unproven: not measured in this session.
- **Human limits today:** scripts/freekick-layered-bands.ts:18 (--human-limits) measures; scripts/freekick-layered-check.ts:264-292 asserts the elite under HUMAN_LIMITS steps down level by level; scripts/home-run-top-bins-expert-proof.ts:44 lists Expert seeds. The deal's oracle is not limited (a kick reacts to nothing in flight).
- **Proof:** Per-level proved deal as today: scripts/freekick-layered-deal.ts (a --rev=7 build) keeps a seed only when the oracle (oracleRunV5, scripts/freekick-oracle.ts) scores exactly 200 through the server replay; the kick reacts to nothing in flight, so the witness is the same under HUMAN_LIMITS. Today Expert dropped 52 of 112 candidates; expect more with a 7 man wall. scripts/freekick-layered-check.ts proves the lists.
- **Measured today:** 30 seeds under human limits, medians: average 131 / 108 / 31 / 15; near-perfect 184 / 190 / 157 / 112; elite 190 / 197 / 168 / 128 (Easy's elite sits below Normal's)
- **Stamp:** freekickRev 7 on level deals (Normal stays freekickRev 6): walls above 5 and new level tables; stored rounds replay on their own rev.
- **Files:** `src/lib/arcade/freekick.ts (FK_LEVEL_SETTINGS_V6, a rev 7 table; walls of 6 and 7)`, `src/lib/arcade/freekick.renderer.ts (shirts for a 7 man wall)`, `scripts/freekick-layered-deal.ts`, `src/lib/duel/freekickDealV6.server.ts (a rev 7 deal beside it)`, `scripts/freekick-layered-bands.ts`, `scripts/freekick-layered-check.ts`
- **Risk:** a seven man wall may leave too few seeds where all ten kicks have a scoring line; a wall of 6 to 7 is the fallback

### Apex (`racing`, Sports)

**Lever: Road width.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | Road 130 % of Normal's width (85,197 units, 5.2 car widths); gravel keeps 80 % of speed; braking points and racing line painted; par pace as today's Easy (192.0 / 205.5 / 175.0 km/h). | racingRev 4: road 65,536 units (four car widths), gravel keeps 65 %, wall at 131,072, racing line shown, par 221.5 / 238.5 / 203.0 km/h, spread 69.5 km/h, 99 s | Road 85 % (55,700 units, 3.4 car widths; the kerb, which is the sim's clean edge, moves in with it); gravel keeps 50 %; no racing line (signs and boards stay); par as Normal's; pace spread 60.0 km/h (Normal 69.5). | Road 72 % (47,200 units, 2.9 car widths; kerb with it); gravel keeps 35 %; signs only; par as Normal's; pace spread 45.0 km/h; the circuits keep their own hairpins. |
| First seconds | A wide road with braking points and a racing line painted | | A visibly narrower road, no racing line | A lane under three cars wide between gravel traps |
| Today | road 115 % wide (75,366 units), gravel keeps 80 % of speed, braking points painted, lower par pace (192.0 / 205.5 / 175.0 km/h) | | same road, gravel keeps 60 %, wall at 108,134, signs and boards only, pace spread 32 km/h | same road, gravel keeps 50 %, hairpins 2 tighter on two circuits, signs only, pace spread 25 km/h |
| **Evidence** | measured: racingLevel patched on 24 dealt puzzles, bots under HUMAN_LIMITS, server grade: average 165.6 (today's Easy 163.4, Normal 89.7), elite 195.4 (7 at 200), oracle 200 on 24 of 24; the average bot finishes both laps on 6 of 24. | | measured: racingLevel patched on 24 dealt puzzles, bots under HUMAN_LIMITS, server grade. Road 85 %, keep 50, spread 60.0: average 69.8 (Normal 89.7), elite 127.9 (Normal 152.5), oracle 200 on 24 of 24. With Normal's spread: 85.2 / 133.7. | measured: 24 seeds, road 72 %, keep 35, spread 45.0: average 32.5, elite under limits 82.5 (best 102, none at 200); frame-exact oracle 200 on 24 of 24, Ridge Loop included. With Normal's spread: 82.6 / 111.2. |

- **Why this curve:** Width is what a driver sees and feels at once: a narrower road turns small errors into gravel, and a tighter pace spread makes the lost speed count, where today's Hard and Expert show the same road as Normal.
- **Fact-check verdict:** adjusted: width alone left the average driver at 90 / 85 / 83 and a still narrower road only sank the elite bot (33 at 50 %), so the pace spread now tightens to 60.0 km/h at Hard and 45.0 at Expert (average 70 and 33); 200 under the limits is unproven at every level, Normal included.
- **Human limits today:** nothing of its own: scripts/racing-levels-bands.ts:30 plays the bots without limits; only scripts/level-tune.ts --human-limits (lines 124-126, 188) measures. The deal's oracle (scripts/racing-oracle.ts) is frame-exact and holds the centre line.
- **Proof:** bun scripts/racing-deal.ts --rev=4 --level=<l> rebuilds each level's 300-seed list: scripts/racing-oracle.ts must replay to exactly 200 through replayRacingRun on the level's road (measured: 24 of 24 at 72 % on Normal's par, Ridge Loop included, because the oracle holds the centre line and its pace does not change with the width). The oracle is frame-exact: under HUMAN_LIMITS no bot reaches 200 even on Normal (elite best 167), so a limited oracle must be written and each par set under its pace before the lists count as proved. scripts/racing-levels-check.ts proves the lists.
- **Measured today:** elite bot 199.9 / 186.7 / 172.1 / 157.4; Normal average bot 93.5; average per level not documented
- **Stamp:** level field only: the settings ride on each puzzle as racingLevel (road, kerb, wall, keep, aids, pace and spread already exist), so stored rounds keep their own copy.
- **Files:** `src/lib/levels/gameLevels.ts (GAME_LEVELS.racing)`, `src/lib/arcade/racing.ts`, `scripts/racing-deal.ts`, `scripts/racing-oracle.ts`, `src/lib/duel/racingDealV4Easy.server.ts, racingDealV4Hard.server.ts, racingDealV4Expert.server.ts`, `scripts/racing-levels-check.ts`, `scripts/racing-levels-bands.ts`, `src/lib/levels/levelNotes.ts`
- **Risk:** the bots do not slow for a narrower road (the elite spends 453 ticks on gravel at 72 % and scores below the average bot at 50 %), so the numbers understate a careful driver and the spreads need a playtest

### Free Cell (`freecell`, Cards & Board)

**Lever: Free cells.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | As today: 5 free cells, 32 cards (Ace to 8), free unlimited undo, free hints with the idle glow, speed full by 60 s (four short rows and a fifth cell already read as easy). | freecellRev 5: 4 free cells, 40 cards (Ace to 10), undo counts as a move, no hints, par 0 at 1.5 x, speed full by 32 s, 120 s | 3 free cells; the full 52 cards from the 120 shortest three-cell solutions (par 32 to 43, today's Expert deals); undo unlimited but a move; no hints; par 0 at 1.25 x; speed full by 30 s. | 2 free cells; 52 cards from a new bank of the shortest two-cell solutions (par 50 or under); 3 undos; no hints; par 0 at 1.25 x; speed full by 40 s. |
| First seconds | Five free cells over four short rows, a Hint button | | Three free cells over a full 52-card table | Only two free cells, court cards everywhere, Undo (3) |
| Today | 5 free cells, 32 cards (Ace to 8), free unlimited undo, free hints and idle glow, par 0 at 2 x, speed full by 60 s | | 4 free cells, 52 cards (par 29 to 41), hints at 5 points each, par 0 at 1.25 x, speed full by 25 s | 3 free cells, 52 cards (par 32 to 43), 3 undos, one hint, par 0 at 1.25 x, speed full by 25 s |
| **Evidence** | documented: today's Easy kept; docs GALLERY (cards-levels-tune, 40 deals): elite 192.8, human-limits player 193.0. | | not measured: not reached this session. | not measured: a two-cell bank does not exist; not reached this session. |

- **Why this curve:** The free cells are Free Cell's own difficulty dial: each one removed roughly halves the room to manoeuvre, and since the deck is already full at Hard, the cells carry the ladder to the top.
- **Fact-check verdict:** unproven: not measured in this session.
- **Human limits today:** scripts/cards-human-limits.ts:28-30, 39-57, 175 (the bank solver's plan at one move every 24 ticks) for cards-levels-tune.ts:60 (--bots=human) and cards-levels-order-check.ts, which asserts the levels step down; the bank's solved lines carry no clock.
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
| **Evidence** | not measured: not reached yet. | | not measured: not reached yet. | not measured: not reached yet. |

- **Why this curve:** Summit is the sixty-second sprint of the card games and its ten-card bottom row is already at the phone's width limit, so time and stock, the two numbers on screen, make the ladder; they replace today's no-wrap rule, which changes how cards connect without showing it.
- **Fact-check verdict:** unproven: not measured yet.
- **Human limits today:** scripts/cards-human-limits.ts:175 (visible cards only, one tap every 24 ticks) for cards-levels-tune.ts:60 (--bots=human) and cards-levels-order-check.ts, which asserts the levels step down; the bank's solver lines carry no clock.
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
| **Evidence** | measured: FH_LEVEL_RULES set in memory, 16 decks, cards-levels-tune reportLevel (server grade): average 144.5 and human-limits 156.5, the same as today's 75 s (the average bot finishes in 54 s); elite 177.0. | | measured: 42 s, no hints, 16 decks: average 60.0 and never places all 20 cards (Normal 121.2, today's Hard 86.2), human-limits 116.4, elite 137.4. | measured: 30 s at x 1.4, 16 decks: average 29.4 (today's Expert 62.7), human-limits 110.7 (best tenth 157.5; today 102.5), elite 131.5 (best tenth 194.5); no run at 200, and no proved deck list exists yet. |

- **Why this curve:** The deck and the five rows cannot grow, so thinking time per card is the lever: halving it turns a poker puzzle into speed poker, and the stricter tables make the rushed safe pair worth less.
- **Fact-check verdict:** holds: the clock gives the average player steps of 61 and 31 points (121 / 60 / 29); Easy's 90 s changes nothing against today's 75 s, and 200 at Expert stays unproven until the deck lists are built (no run reached it).
- **Human limits today:** scripts/cards-human-limits.ts:175 (the hint's rule at one tap every 24 ticks) for cards-levels-tune.ts:60 (--bots=human) and cards-levels-order-check.ts, which asserts the levels step down; no level has a 200 witness.
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
| **Evidence** | not measured: PY_CARDS is fixed at 28 (pyramid.ts:41) and the cover map, deal builder and prover are built on it; a 6-row pyramid needs new sim code. | | not measured: an 8-row pyramid (36 cards) needs new sim code. | not measured: a 9-row pyramid (45 cards) needs new sim code. The arithmetic holds: 45 cards = 21 pairs + 3 Kings, 7 left for the stock, 45 taps = 18 s at 0.4 s a tap. |

- **Why this curve:** A taller pyramid is the same game with more buried cards and a smaller stock to rescue you, which anyone sees before the first tap; today's three levels show the same 28 cards and differ only in a hidden deal filter.
- **Fact-check verdict:** unproven: the headline lever (rows) cannot be set without new sim code, so no level was run.
- **Human limits today:** scripts/cards-human-limits.ts:175 (a five-removal look at one tap every 24 ticks) for cards-levels-tune.ts:60 (--bots=human) and cards-levels-order-check.ts, which asserts the levels step down; each deal's witness is proved in the sim with no clock.
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
| **Evidence** | not measured: a hole with no sand or water is a new build of each template (the level build has only an extras on / off flag, minigolfHolesV3.ts:564). | | not measured: 4 extra hazards a hole and sails 384 need new hole data (extras are hand-drawn per template; sails are slow, normal or fast). | not measured: 8 extra hazards a hole need new hole data and a re-searched bank; today's Expert (2 extras) measured near-perfect 142.9, elite 145.5 (earlier pass, 24 deals). |

- **Why this curve:** Crazy golf is its obstacles: clearing them for Easy and crowding the line for Hard and Expert changes every putt in a way the green shows at once, where today's steps hide in the par rule and the slope strength and Easy looks identical to Normal.
- **Fact-check verdict:** unproven: the hazards are hand-drawn per template behind one flag, so no proposed level could be run.
- **Human limits today:** nothing asserts: scripts/crazy-golf-levels.ts:62 and scripts/level-tune.ts --human-limits (line 188) measure with the minigolfV3 bot; the bank's witnesses (scripts/minigolf-holes-bank.ts) carry no wait rule.
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
| **Evidence** | measured: pockets, jaws and rack set in memory, 10 bank layouts, bots under HUMAN_LIMITS, sim score: average 123.7 (today's Easy 127.4, Normal 90.7), elite 188.0 (today 176.8), clears 1 and 10 of 10. | | measured: 10 layouts (3 extra balls added at seeded free spots): average 71.5 (Normal 90.7, today's Hard 55.8), elite 128.8 (Normal 164.5), elite clears 4 of 10. | measured: 10 layouts: average 23.0, elite 109.1 (best 146, clears 3 of 10, none at 200); the flawless player 199.5 with 200 on 9 of 10 unproved layouts. Pockets alone (rack as today): 47.0 / 122.0. |

- **Why this curve:** Today's four levels are one table with a different guide line; pocket width is pool's own difficulty dial, and a fuller table adds the blocked lines and fouls that make each tight pot a real choice.
- **Fact-check verdict:** holds: average 124 / 91 / 72 / 23 and elite 188 / 165 / 129 / 109 step down at every level and the flawless player reaches 200 on 9 of 10 Expert layouts; the banks and the 200 proof are not built.
- **Human limits today:** nothing of its own: scripts/pool-levels-tune.ts:65 plays the bots without limits; only scripts/level-tune.ts --human-limits (line 188) measures, and the game is turn-based so the limits bind only the pace. The bank witnesses carry no wait rule.
- **Proof:** Today every level reuses src/lib/duel/poolBankV3.server.ts and its 60 witnesses. Build a bank per level with scripts/pool-bank.ts (a --level flag) and the shot search in scripts/pool-oracle.ts on the level's pockets and rack: keep a layout only when a witness pots all seven and the black with no foul for exactly 200 through the server replay, each shot at least 0.4 s after the balls stop, inside the speed line; scripts/pool-levels-check.ts replays every witness.
- **Measured today:** 30 deals: elite 177 / 164 / 156 to 160 / 138 to 140; Normal average bot 84 (median); Easy average 117 (mean, 10 % at 175+); Hard and Expert average not documented
- **Stamp:** poolRev 5 on level deals (Normal stays poolRev 4): pocket geometry and the rack change the physics, and today's level rounds must still replay.
- **Files:** `src/lib/arcade/pool.ts (POOL_POCKETS and the jaws per level, poolLayout's other-set count)`, `src/lib/arcade/pool.renderer.ts (pockets drawn to the collision mouth)`, `scripts/pool-bank.ts`, `scripts/pool-oracle.ts`, `src/lib/duel/poolBankV3.server.ts (level banks beside it)`, `scripts/pool-levels-check.ts`, `scripts/pool-levels-tune.ts`
- **Risk:** narrow jaws did not stop the flawless player (200 on 9 of 10 unproved Expert layouts), but the elite bot clears only 3 of 10 there and the average pots 2 of 7, so 12 px corners are the fallback; the oracle may still clear few 15-ball layouts with no foul

### Curl Champ (`curling`, Sports)

**Lever: Red stones in the house.** Retuned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 1 red, 80 to 140 cm out; the stone's whole path shown; HOUSE zone; Stones full at 60. | curlRev 4: 3 reds 35 to 110 cm from the button, HOUSE zone, aim line for the first third, Stones full at 95, 8 stones, 120 s | 5 reds, 25 to 80 cm from the button; HOUSE zone kept; no aim line. | 7 reds, 15 to 60 cm, a ring round the button at least 35 cm apart; no HOUSE zone, no aim line. |
| First seconds | One red stone far from the button, the whole path drawn | | Five reds crowding the button, no aim line | Seven reds ringing the button, no guides at all |
| Today | 2 reds 60 to 130 cm from the button, the stone's whole path shown, HOUSE zone, Stones full at 60 | | 4 reds 30 to 90 cm, HOUSE zone, aim line for the first third | 5 reds 20 to 70 cm, no HOUSE zone, no aim line |
| **Evidence** | not measured: not reached this session. | | not measured: not reached this session. | not measured: not reached this session. |

- **Why this curve:** A stone only scores when it beats every red in the house, so each extra red is another one to take out or out-draw with the same eight stones, and the count shows in the house before the first throw.
- **Fact-check verdict:** unproven: not measured in this session.
- **Human limits today:** nothing of its own: scripts/curling-levels-bands.ts:27 plays the bots without limits; only scripts/level-tune.ts --human-limits (line 188) measures. The bank's oracle sets up each throw at leisure.
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
| **Evidence** | documented: today's Easy kept; bubble-levels-check witnesses, 12 seeds: average 157, elite under limits 195. | | not measured: not reached yet. | not measured: not reached yet. |

- **Why this curve:** Colours are what make a bubble shooter hard, since each extra one shrinks the clusters and the chance the next bubble fits; the measurements agree: five-colour Hard moved nobody (elite 176 to 174) while six-colour Expert halved the average.
- **Fact-check verdict:** unproven: not measured yet.
- **Human limits today:** scripts/bubble-levels-record.ts:36 records the bots (the bubble bot paces its own shots) and scripts/bubble-levels-check.ts:222, 233 assert the elite clears a reef at every level and that Expert's elite averages 120+ with a best of 170+; no per-seed 200 proof.
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
| **Evidence** | documented: today's Easy kept; ink-levels-bands on the dealt seeds: average 164, elite under limits 200. | | not measured: not reached this session. | not measured: not reached this session. |

- **Why this curve:** The pot is the target every drawn line must end on, so shrinking it is the lever even strong players feel (the 16 Nov tuning found birds and ink alone moved nobody), while extra birds from the first level make the route itself harder and show the level at once.
- **Fact-check verdict:** unproven: not measured in this session.
- **Human limits today:** scripts/ink-levels-bands.ts:38 (--human: elite reactions 250 ms, finger lag 150 ms) measures only; nothing asserts. The deal builder's oracle (scripts/ink-big-deal.ts) is not limited.
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
| **Evidence** | measured: TILT_LEVELS set in memory, 16 unproved dealable seeds, TILT_HUMAN_LIMITS=1, server replay: average 136.2 (median 163.5, finishes 9 of 16; today's Easy 124.1), elite 197.6 with 13 at 200. | | measured: two marbles on mazes 1 to 3 and 5 holes (today's hole rule), 40 seeds: average 45.0 (Normal 61.1, today's Hard 58.3); 16 seeds: elite under limits 136.3 (Normal 159.6), best 185. | measured: two marbles on all four mazes and 8 holes (today's hole rule), 40 seeds: average 50.5 (today's Expert 48.8); 16 seeds: elite under limits 113.9 (best 180), flawless under limits 128.8 with one run at 200. |

- **Why this curve:** One tilt moves every marble, so a second marble doubles what you must watch from the first second, and holes beside the route finally punish a slip; today's extra holes sit in dead ends two cells off the route, where a careful player never meets them.
- **Fact-check verdict:** unproven: two marbles from the first maze take the average player from 61 to 45 and the elite 160 / 136 / 114 down the ladder, and Easy holds (136), but Hard and Expert score alike for the average player (45 v 51); the holes beside the route, the only thing left to split them, need new sim code.
- **Human limits today:** scripts/arcade-skill-bands/bots/tilt.ts:72 (TILT_HUMAN_LIMITS=1: eye-to-hand at least 15 ticks, a new decision every 9 ticks at most; lines 198-201, 539), read by scripts/tilt-levels-bands.ts:11; measures only, never set by a check. The deal's oracle (tilt-oracle.ts) is not limited.
- **Proof:** Per-level proved deals as today: bun scripts/tilt-deal.ts --level=<l> keeps a seed only when scripts/tilt-oracle.ts plays every maze inside par with no fall and replays to exactly 200 through replayTiltRun (src/lib/duel/tiltDealLevels.server.ts; today Hard keeps 119 and Expert 111 of 150). The oracle is not held to the limits today: run it with the bot's TILT_HUMAN_LIMITS rule (0.25 s from eye to hand, a new decision every 0.15 s at most) and drop seeds that fail; scripts/tilt-levels-check.ts replays every witness.
- **Measured today:** 40 deals: average bot 150 / 83 / 77 / 61; elite 199 / 166 / 149 / 142; elite under human limits 193 / 144 / 141 / 121
- **Stamp:** tiltRev 13 on level deals (Normal stays tiltRev 12): the sim reads TILT_LEVELS and the hole placement rule.
- **Files:** `src/lib/arcade/tilt.ts (TILT_LEVELS, buildMazeX's hole rule)`, `scripts/tilt-deal.ts`, `scripts/tilt-oracle.ts`, `src/lib/duel/tiltDealLevels.server.ts`, `src/lib/levels/gameLevels.ts`, `scripts/tilt-levels-check.ts`, `scripts/tilt-levels-bands.ts`
- **Risk:** measured: the average player's run ends on the first two-marble maze, so Hard and Expert score alike (45 and 51) until the holes beside the route exist and are playtested; the bots rarely fall, and Normal's own elite is 160 under the limits

### Ball Tracker (`balltrack`, Strategy)

**Lever: Marble colours and cups.** Redesigned.

| | Easy | Normal (today, fixed) | Hard | Expert |
|---|---|---|---|---|
| **Proposed** | 3 colours and 3 cups; 16 marbles, one every 3.2 s; the cups never move; combos full at 10 (today's Easy with one colour fewer). | btRev 8: 4 colours and 4 cups in 7 columns; 36 marbles, one every 1.4 s; 2 cup moves; 6 gold; 3 boosters; 60 s | 5 colours and 5 cups (a purple star joins); 40 marbles, one every 1.3 s; 4 cup moves; 6 gold; 3 boosters. | 6 colours and 6 cups in the 7 columns (an orange cross joins); 42 marbles, one every 1.2 s; 8 cup moves; 6 gold; 2 boosters. |
| First seconds | Three cups, three colours, a marble every three seconds | | Five cups along the bottom, a purple marble in the queue | Six cups in seven columns, six colours in the hopper |
| Today | 4 colours and cups; 16 marbles, one every 3.2 s; the cups never move; 7 gold; 4 boosters; combos full at 10 | | 4 colours; 42 marbles, one every 1.2 s; 8 cup moves; 7 gold; 3 boosters | 4 colours; 42 marbles, one every 1.1 s; 12 cup moves; 7 gold; 2 boosters |
| **Evidence** | not measured: BT_COLOURS is fixed at 4 (ballTrack.ts:17) and the course builder deals four cups and colours 0 to 3 (balltrack-level-deal.ts:175, 206-207); 3 colours need new builder code. | | not measured: 5 colours and cups need new builder code, a fifth palette entry and bot support. | not measured: 6 colours need new builder code. Read from the builder: cups sit only in columns 1 to 6, so 6 cups fill every legal column and the re-lay kind of cup move cannot happen. |

- **Why this curve:** Today's four levels show the same board and Hard and Expert score the same for an average player (51 and 50); each extra colour is another cup to route to, so the turns per marble grow with a count the queue and the cups show before the first drop.
- **Fact-check verdict:** unproven: the colour count is a constant in the sim and the builder, so no proposed level could be run; with 6 cups only colour shuffles are possible, not re-lays.
- **Human limits today:** scripts/arcade-skill-bands/bots/balltrack.ts:64 (BT_HUMAN_LIMITS, off by default: no tap within 9 ticks, 15 to notice; lines 277, 292, 321), switched on by scripts/balltrack-level-bands.ts:76-77 (--limits); measures only. The boosted oracle is not limited.
- **Proof:** bun scripts/balltrack-level-deal.ts --level=<l> builds 60 courses a level and keeps one only when the boosted oracle (scripts/arcade-standard/balltrack.ts) scores exactly 200 through the server's encode and replay. That oracle is not held to the limits today and no bot reaches 200 on Expert: run it with the bot's BT_HUMAN_LIMITS rule (no tap within 0.15 s of the last, an off-route marble noticed after 0.25 s) and drop courses that fail; scripts/balltrack-levels-check.ts replays each witness.
- **Measured today:** 30 courses under human limits, medians: average bot 164 / 91 / 51 / 50; near-perfect 200 / 190 / 160 / 120; elite 200 / 195 / 177 / 151; no bot reaches 200 on Expert
- **Stamp:** level field only: a level's course is stored whole on the puzzle and can carry its own colours beside drop and moves, so stored level rounds keep their own course.
- **Files:** `src/lib/arcade/ballTrack.ts (colours per course, BT_PALETTE to six)`, `src/lib/arcade/ballTrackArt.renderer.ts (two new marbles and cups, each with its own symbol)`, `scripts/balltrack-level-deal.ts`, `src/lib/duel/ballTrackDealEasy.server.ts, ballTrackDealHard.server.ts, ballTrackDealExpert.server.ts`, `scripts/arcade-standard/balltrack.ts (the oracle)`, `scripts/balltrack-levels-check.ts`, `scripts/balltrack-level-bands.ts`
- **Risk:** the oracle's search grows with six cups (Expert's list took 25 min with four), and a limited oracle may fail many six-colour courses

