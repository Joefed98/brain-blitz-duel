# Puzzle score bands and fairness audit (13 Oct 2026)

The Oct 2026 puzzle score shape (`puzzleScoreRev: 1`; `docs/duelz-scoring-reference.md` sections 1–9) measured with simulated players, plus the five fairness rules every puzzle now has to pass. Produced by `scripts/puzzle-fairness.ts` (30 room seeds per game, 5001–5030); the quick guard on every PR is `scripts/puzzle-score-rev-check.ts`.

## Method

- **Games.** All 45 non-arcade games with a finish state (the engine games Tenfall and Mixed Signals and the Speed games Ascend and Don't Break the Chain included), plus the seven no-finish games (Nucleus, Forage, Letterfall, Flash, Bang On, Bonk, Pull!), which keep their formulas and are only audited. Interloper is retiring and Lightbender's shot count is moving to a server log, so Interloper is left out and Lightbender's shots are taken as the kits send them.
- **Player kits** (`scripts/puzzle-fairness/kits-*.ts`). For each game a kit builds the real answer string the phone submits (the same encodings, tap logs and engine input logs) for: doing nothing (the Stage's empty draft); 2–4 spam strategies; and a simulated solver that plays toward the stored solution or the game's own solver one action at a time, with human-like time per action and mistakes that cost what they cost a person (a wasted move and its undo, a wrong guess, a wrong cell fixed later, a wrong tap). Every answer is graded by the server's own `gradeAnswer`; the kits never score anything.
- **Before / after.** The same seeded room puzzle is graded twice: "before" with the score stamp removed (exactly how a stored round grades), "after" with it.
- **Levels** (`scripts/puzzle-fairness/kit.ts SKILLS`, the same for every game): think time per action × 1.7 / 1.0 / 0.72 / 0.5 of a good player's, mistakes 20 / 10 / 5 / 1.5 % of decisions, reactions 300 / 230 / 190 / 160 ms (the arcade humans' figures). Each kit sets a good player's seconds per action for its game (for example a Box Six cell 3.5 s, a Jumbled slide 1.5 s, a Lookout word 9 s, a Hanoi move 2 s); those choices are in a comment on each kit.
- **Submitting.** A solve goes in the moment it happens (time left = limit − its time); otherwise the draft at the buzzer (0 ms). Spam is graded at the buzzer.

## The five rules (after)

| Rule | Result |
|---|---|
| a. No input scores 0 | **Pass, every game** (the empty draft at the buzzer and on an instant Done). Before: Exact up to 59, Hanoi 49, Jumbled 42, Bang On 20, Pipeline 14, Colour Flood 5, Labyrinth 1. |
| b. Random or spam input scores about 0 (median ≤ 5) | **Pass for blanket and random input** in every finish game, with the exceptions below. |
| c. Every finish beats every unfinished run | **Pass, every finish game**: over every play, every intermediate state and every spam run, the lowest finish is ≥ 120 and the highest unfinished ≤ 110. (Ballpark has no clean finish: "all placed" scales with accuracy.) |
| d. Partial credit counts only the player's progress | **Pass**: the starting state scores 0 everywhere (rule a); start-state credit is subtracted in Pipeline, Hanoi, Colour Flood, Jumbled, Turntable, Topsy-Turvy, Polypotions, Heave, Labyrinth, Slider (and Slider no longer deals word rows); Exact counts only numbers the player made. |
| e. Intro and "?" help state the real numbers | **Pass**: every in-scope SCORE line says 120 and the help states the finish, the speed part with the half-time rule and the game's own unfinished numbers (`intro-score-text-check` also passes). |

### Rule b exceptions (flags, with the reason)

| Game | Strategy | Median / max | Why it stays |
|---|---|---|---|
| Colour Flood | random or cycling colours | 0 / 135 since the move limit (the 135 is cycling's one real finish); was 126 / 135 | **Move limit par + 2 and a waste factor reaching 0 at the limit (`floodRev 1`, 13–14 Oct)**: below 5, no longer a flag. Random play no longer floods the board (0 of 30; cycling 1 of 30), and a board that runs out of moves scores 0. |
| Polypotions | random legal pours | 41–42 / 132 since the pour limit; was 120 / 128 | **Pour limit (13 Oct, `tubesRev 1`)**: random pours no longer solve (0–1 of 30); they keep the unfinished credit for flasks corked by the limit. |
| Topsy-Turvy | random tilts | 0–31 / 131 since the tilt limit; was 0 / 131 | **Tilt limit (13 Oct, `gravityRev 1`)**: random tilting solves 1 board in 30 (was one in five), but stopping at the limit keeps wasteFactor above 0, so 3 tilts a second now keeps some unfinished credit (median 31). |
| Counterweight | random hanging | 0 / 75 since the hang limit; was 55 / 120 | **Hang limit and unique small scales (13 Oct, `balanceRev 1`)**: below 5, no longer a flag. The limit is the phone's count; with no limit at all the harder scales alone give random hanging a median of 20. |
| Operator | trying every operator order | 20 / 65 since 3 tries; was 68 / 120 | **3 tries per equation (13 Oct, `equationRev 1`)**: brute force reaches stage 1 on about half the boards, stage 2 rarely. The try count is the phone's word. |
| Tally | guessing in range | 53 / 79 (random 44 / 100) since `countRev 1`; was 66 / 79 | **Seven count values per tray (13 Oct)**: 5–11, 7–13, 9–15, so a blind guess is less often exact or one off. Near misses still score by design (60 % / 30 %). |
| Roundabout | random traces | 16 / 47 | The phone keeps only words that fill a slot, so a scoring trace is a real find; costing misses needs an attempt log. |
| Strikeout | letters in frequency order | 83 / 126 | That is how the game is played (a weak but real strategy). Random letters and A–Z score 0. |
| Swapword | swapping non-green / amber tiles | 30 / 66 | Uses the tile marks: real play. Random swaps score 0. |
| Checkout | biggest dart, then a finisher | 22 / 46 | A real (weak) strategy. Random darts score 0. |
| Labyrinth | wall-following every dead end at 6 cells a second | 100 / 120 | A real strategy that doesn't read the whole maze. A random scribble scores 0. |
| Chroma Lines | each dot drawn straight to its twin | 26 / 80 | Many shortest routes are the solution; credit is only for pairs on their solution route. Random lines score 0. |
| Mosaic | filling the rows and columns with long clues | 45 / 69 | Partial logic. Filling everything or at random scores 0. |
| No-finish games | Bang On random taps 92 → **72**; Flash tapping every colour 75 → **54**; Pull! mashing 30 → **16**; Letterfall random chains 25; Forage 8; Nucleus 5 | — | Bang On, Flash and Pull! took light-touch careless-play costs later on 13 Oct (next section; `tapRev: 2`, `clayRev: 4`): lower, not zero, so honest players keep their bands. Letterfall waits on real play to set its par; Forage and Nucleus are already near 0. |

## Careless-play costs (13 Oct 2026): Flash, Bang On, Pull!

A light-touch fix for scoring reference open item 16: careless play earns less, honest players' bands move by at most 3 (they moved by at most 2). New puzzles are stamped `tapRev: 2` (Flash, Bang On) and `clayRev: 4` (Pull!); older stamps score exactly as before.

- **Flash:** false starts cost 8 each for the first two, 11 each after that (was 8 each). Honest players make 0–2 (median), tapping every colour about 9.
- **Bang On:** the same line to 101 at 200 ms, then an even fall to 0 at 325 ms (was 74 at 300 ms, 0 at 500 ms). Random taps average about 230 ms off; every simulated honest median is under 200 ms (average player about 145 ms).
- **Pull!:** the first 30 shots that hit nothing (no clay, no bird) are free, then every 20 more cost 1. Honest runs miss 0–15; mashing fires over 300 empty shots.
- The reveals read the stored breakdown (`extra.falseStartCost`; `extra.averageMs`, `kneeMs`, `zeroMs`; `extra.emptyShots`, `emptyShotCost`).

Measured by `scripts/careless-play-check.ts` on the same 30 room seeds (5001–5030) and kits as above, each run graded under the old stamp (before) and the new one (after); medians:

| Game | Line | Before | After | Change |
|---|---|---|---|---|
| Flash | average | 112 | 110 | −2 |
| Flash | good | 135 | 135 | 0 |
| Flash | great | 150 | 150 | 0 |
| Flash | near-perfect | 150 | 150 | 0 |
| Flash | **tap every colour (careless)** | 75 | **54** | −21 |
| Flash | tap every 150–300 ms / every 1 s | 0 / 0 | 0 / 0 | 0 |
| Bang On | average | 116 | 116 | 0 |
| Bang On | good | 136 | 136 | 0 |
| Bang On | great | 144 | 144 | 0 |
| Bang On | near-perfect | 148 | 148 | 0 |
| Bang On | **tap at a random time (careless)** | 92 | **72** | −20 |
| Bang On | tap at the start / every 150–300 ms | 36 / 21 | 0 / 0 | −36 / −21 |
| Pull! | average | 95 | 95 | 0 |
| Pull! | good | 130 | 130 | 0 |
| Pull! | great | 150 | 150 | 0 |
| Pull! | near-perfect | 150 | 150 | 0 |
| Pull! | **mash on whatever flies (careless)** | 30 | **16** | −14 |
| Pull! | random shots 6 / 3 a second | 15 / 5 | 0 / 0 | −15 / −5 |

No run scores more after. Within a band a few seeds move more than the median: a Flash average player with 3–4 false starts loses 3–6, and a Bang On average player whose run averages over 200 ms off (the worst of 30 is about 224 ms) loses up to about 13.

## Bands: median score per level, before → after (finish rate after)

Last two columns: doing nothing (max over 30 seeds) and the worst spam strategy's median, before → after. Colour Flood, Polypotions, Topsy-Turvy, Counterweight, Operator, Brimful and Tally changed again later on 13 Oct (move limits and Tally's counts): their current numbers are in "Move limits" at the end.

| Game | Average | Good | Great | Near-perfect | Nothing | Worst spam median |
|---|---|---|---|---|---|---|
| Interlock | 56 → **51** (2/30) | 141 → **137** (30/30) | 150 → **150** (30/30) | 150 → **150** (30/30) | 0 → 0 | 0 → 0 |
| Slider | 142 → **144** (30/30) | 144 → **146** (30/30) | 150 → **150** (30/30) | 150 → **150** (30/30) | 0 → 0 | 22 → 0 |
| Lookout | 131 → **121** (16/30) | 148 → **147** (30/30) | 150 → **150** (30/30) | 150 → **150** (30/30) | 0 → 0 | 20 → 0 |
| Roundabout | 78 → **83** (0/30) | 138 → **132** (30/30) | 150 → **150** (30/30) | 150 → **150** (30/30) | 0 → 0 | 15 → 16 |
| Strikeout | 70 → **83** (0/30) | 136 → **134** (28/30) | 140 → **141** (28/30) | 142 → **144** (29/30) | 0 → 0 | 72 → 83 |
| Cryptogrid | 76 → **83** (5/30) | 142 → **140** (30/30) | 150 → **150** (30/30) | 150 → **150** (30/30) | 0 → 0 | 9 → 0 |
| Swapword | 120 → **132** (18/30) | 148 → **149** (30/30) | 150 → **150** (30/30) | 150 → **150** (30/30) | 0 → 0 | 20 → 30 |
| Exact | 57 → **47** (9/30) | 146 → **143** (30/30) | 150 → **150** (30/30) | 150 → **150** (30/30) | 59 → 0 | 0 → 0 |
| Operator | 90 → **85** (2/30) | 145 → **142** (30/30) | 150 → **150** (30/30) | 150 → **150** (30/30) | 0 → 0 | 72 → 68 |
| Counterweight | 60 → **55** (13/30) | 144 → **144** (30/30) | 150 → **150** (30/30) | 150 → **150** (30/30) | 0 → 0 | 60 → 55 |
| Integer Pyramid | 56 → **52** (0/30) | 87 → **80** (0/30) | 115 → **106** (10/30) | 136 → **136** (30/30) | 0 → 0 | 4 → 4 |
| Trail | 78 → **66** (0/30) | 137 → **130** (30/30) | 147 → **146** (30/30) | 150 → **150** (30/30) | 0 → 0 | 15 → 0 |
| Brimful | 40 → **48** (0/30) | 90 → **110** (14/30) | 140 → **144** (30/30) | 150 → **150** (30/30) | 0 → 0 | 0 → 0 |
| Checkout | 42 → **46** (0/30) | 92 → **100** (8/30) | 136 → **144** (27/30) | 150 → **150** (30/30) | 0 → 0 | 20 → 22 |
| Ballpark | 72 → **58** (0/30) | 123 → **116** (30/30) | 146 → **144** (30/30) | 150 → **150** (30/30) | 0 → 0 | 20 → 4 |
| Tenfall | 104 → **97** (3/30) | 135 → **128** (29/30) | 140 → **135** (30/30) | 141 → **137** (30/30) | 0 → 0 | 26 → 5 |
| Ascend | 65 → **61** (0/30) | 130 → **126** (30/30) | 145 → **145** (30/30) | 150 → **150** (30/30) | 0 → 0 | 0 → 0 |
| Don't Break the Chain | 19 → **15** (0/30) | 100 → **80** (10/30) | 147 → **141** (19/30) | 150 → **150** (25/30) | 0 → 0 | 0 → 0 |
| Mixed Signals | 62 → **44** (0/30) | 115 → **85** (1/30) | 137 → **134** (17/30) | 145 → **144** (30/30) | 0 → 0 | 0 → 0 |
| Eagle Eye | 60 → **51** (0/30) | 133 → **124** (17/30) | 146 → **144** (27/30) | 150 → **150** (28/30) | 0 → 0 | 0 → 0 |
| Double Take | 80 → **86** (7/30) | 144 → **142** (30/30) | 150 → **150** (30/30) | 150 → **150** (30/30) | 0 → 0 | 130 → 0 |
| Tally | 74 → **63** (2/30) | 115 → **97** (14/30) | 150 → **150** (26/30) | 150 → **150** (29/30) | 0 → 0 | 78 → 66 |
| Labyrinth | 60 → **56** (0/30) | 108 → **106** (14/30) | 140 → **136** (30/30) | 147 → **146** (30/30) | 1 → 0 | 102 → 100 |
| Matchmaker | 80 → **79** (3/30) | 147 → **146** (30/30) | 150 → **150** (30/30) | 150 → **150** (30/30) | 0 → 0 | 24 → 0 |
| Gridlock | 28 → **50** (0/30) | 134 → **140** (26/30) | 147 → **148** (30/30) | 150 → **150** (30/30) | 0 → 0 | 8 → 0 |
| Tessellate | 60 → **69** (0/30) | 133 → **125** (23/30) | 145 → **142** (30/30) | 150 → **150** (30/30) | 0 → 0 | 96 → 0 |
| Skid | 47 → **61** (0/30) | 130 → **138** (25/30) | 144 → **146** (29/30) | 150 → **150** (30/30) | 0 → 0 | 30 → 0 |
| Topsy-Turvy | 30 → **37** (1/30) | 128 → **136** (23/30) | 146 → **148** (30/30) | 150 → **150** (30/30) | 0 → 0 | 90 → 0 |
| Jumbled | 128 → **137** (26/30) | 145 → **147** (30/30) | 150 → **150** (30/30) | 150 → **150** (30/30) | 42 → 0 | 14 → 0 |
| Turntable | 12 → **15** (9/30) | 142 → **146** (29/30) | 150 → **150** (30/30) | 150 → **150** (30/30) | 0 → 0 | 0 → 0 |
| Lightbender | 15 → **22** (0/30) | 121 → **133** (24/30) | 146 → **147** (30/30) | 150 → **150** (30/30) | 0 → 0 | 0 → 0 |
| Pipeline | 55 → **50** (0/30) | 133 → **124** (28/30) | 142 → **138** (30/30) | 149 → **149** (30/30) | 14 → 0 | 10 → 0 |
| Blackout | 25 → **22** (1/30) | 121 → **132** (16/30) | 142 → **146** (30/30) | 150 → **150** (30/30) | 0 → 0 | 45 → 0 |
| Box Six | 66 → **65** (0/30) | 132 → **123** (23/30) | 145 → **142** (30/30) | 150 → **150** (30/30) | 0 → 0 | 29 → 0 |
| Chroma Lines | 70 → **70** (0/30) | 140 → **134** (30/30) | 148 → **147** (30/30) | 150 → **150** (30/30) | 0 → 0 | 90 → 26 |
| Heave | 55 → **73** (1/30) | 140 → **144** (30/30) | 150 → **150** (30/30) | 150 → **150** (30/30) | 0 → 0 | 0 → 0 |
| Hanoi | 49 → **36** (1/30) | 132 → **140** (26/30) | 148 → **149** (30/30) | 150 → **150** (30/30) | 49 → 0 | 37 → 0 |
| Polypotions | 33 → **24** (0/30) | 133 → **140** (27/30) | 148 → **149** (30/30) | 150 → **150** (30/30) | 0 → 0 | 100 → 120 |
| Safe Cracker | 0 → **0** (6/30) | 147 → **147** (28/30) | 150 → **150** (30/30) | 150 → **150** (30/30) | 0 → 0 | 0 → 0 |
| Bomb Defusal | 98 → **117** (15/30) | 150 → **150** (25/30) | 150 → **150** (28/30) | 150 → **150** (29/30) | 0 → 0 | 0 → 0 |
| Mosaic | 91 → **91** (10/30) | 148 → **146** (30/30) | 150 → **150** (30/30) | 150 → **150** (30/30) | 0 → 0 | 45 → 45 |
| Colour Flood | 98 → **98** (1/30) | 145 → **146** (30/30) | 150 → **150** (30/30) | 150 → **150** (30/30) | 5 → 0 | 116 → 126 |
| Tents and Trees | 65 → **60** (0/30) | 137 → **130** (26/30) | 150 → **149** (30/30) | 150 → **150** (30/30) | 0 → 0 | 110 → 0 |
| Shikaku | 57 → **51** (0/30) | 131 → **122** (19/30) | 144 → **141** (30/30) | 150 → **150** (30/30) | 0 → 0 | 78 → 0 |
| Lamplighter | 78 → **62** (0/30) | 138 → **130** (25/30) | 148 → **148** (30/30) | 150 → **150** (30/30) | 0 → 0 | 110 → 0 |
| Nucleus | 22 → **22** (0/30) | 57 → **57** (2/30) | 85 → **85** (7/30) | 137 → **137** (11/30) | 0 → 0 | 5 → 5 |
| Forage | 16 → **16** (0/30) | 30 → **30** (0/30) | 48 → **48** (0/30) | 72 → **72** (1/30) | 0 → 0 | 8 → 8 |
| Letterfall | 85 → **85** (1/30) | 150 → **150** (21/30) | 150 → **150** (29/30) | 150 → **150** (29/30) | 0 → 0 | 25 → 25 |
| Flash | 112 → **112** (30/30) | 134 → **134** (30/30) | 150 → **150** (30/30) | 150 → **150** (30/30) | 0 → 0 | 75 → 75 (54 with `tapRev: 2`) |
| Bang On | 116 → **116** (30/30) | 136 → **136** (30/30) | 144 → **144** (30/30) | 148 → **148** (30/30) | 20 → 0 | 92 → 92 (72 with `tapRev: 2`) |
| Bonk | 62 → **62** (0/30) | 102 → **102** (1/30) | 118 → **118** (0/30) | 133 → **133** (12/30) | 0 → 0 | 0 → 0 |
| Pull! | 95 → **95** (0/30) | 130 → **130** (6/30) | 150 → **150** (21/30) | 150 → **150** (30/30) | 0 → 0 | 30 → 30 (16 with `clayRev: 4`) |

### Summary

| Level | Median of the 45 finish games' medians (after) | Before | Range after |
|---|---|---|---|
| Average | 61 | 62 | 0–144 |
| Good | 134 | 136 | 80–150 |
| Great | 148 | 148 | 106–150 |
| Near-perfect | 150 | 150 | 136–150 |

The shape barely moves the bands as a whole: a good solve now scores 120 + the speed and efficiency it earns (most good players finish with time left, so they still land in the 130s–140s), and unfinished runs lose at most a little. The changes that matter are at the edges: nothing and spam now score 0, and no unfinished run can pass a finish.

### Games well outside the band, and why

- **Low for average players (≤ 25): Safe Cracker 0, Turntable 15, Don't Break the Chain 15, Lightbender 22, Blackout 23, Polypotions 24.** These are all-or-little games: an average player who doesn't open the safe, line up the rings or keep the chain going gets little partial credit by design (a dial or a spoke is not progress you can bank). Safe Cracker's average player finishes 6 boards in 30 and scores 120+ there; on the rest only dials beyond the first on the last try count.
- **High for average players (≥ 130): Slider 144, Jumbled 137, Swapword 132.** Short puzzles a simulated average player finishes inside the limit; the 120 floor puts them high. If Joe finds them easy in play, a harder generator band is the lever, not the score.
- **Low for good players: Don't Break the Chain 80, Integer Pyramid 80, Mixed Signals 85, Tally 97, Checkout 100.** Long, strict runs: the chain breaks on one slow tap; four pyramids in 120 s are a lot (good players finish none in 30); Mixed Signals needs 52 sorted with at most 2 wrong (good players average 3–5 wrong, and the unfinished cap of 110 sits below the old 130 × share); Tally needs three exact counts. Each of these lost 10–30 at the good level because the old unfinished credit reached 120–136 and is now capped at 110. That is the rule working (an unfinished run can't pass a finish), but these games may want a gentler finish (Mixed Signals) or more time (Integer Pyramid).
- **Exact average 57 → 47**: only numbers the player made count now, and an average player's intermediate products are often far from the target.

### Caveats

The kits are scripted players, not people: think times per action are estimates (noted per kit), mistakes are modelled, and a few solvers are stronger than a person (Tenfall's reads the whole screen). The before/after differences are reliable (same puzzle, same play); the absolute band per game is a starting point for Joe's phone testing.

## Move limits (13 Oct 2026)

Random or brute-force play used to pay in six puzzles (rule b flags above). Each now has a visible limit on the board ("Moves 7 / 12", "pours", "tilts", "hangs", "tries"); running out ends that board as unfinished, scored on the game's existing unfinished rules (Colour Flood's waste factor now reaches 0 at the limit, so running out there scores 0). Tally's trays take wider counts. Every change is gated on the game's own stamp (`floodRev`, `tubesRev`, `gravityRev`, `balanceRev`, `equationRev`, `measureRev 2`, `countRev`; `src/lib/duel/moveLimits.ts`), so stored rounds and the other games are unchanged (`scripts/move-limits-check.ts`: 1,973 stored answers grade identically).

| Game | Limit (new rounds) | How it was set |
|---|---|---|
| Colour Flood | par + 2 taps | Over 120 seeds good players finish 117 (par + 2) or 118 (par + 3) boards of 120, great and near-perfect all 120; random colours 58 vs 64, cycling 88 vs 91. par + 1 cut good finishes to 23 / 30. |
| Polypotions | minimum + 6 pours, rounded up to a 5 (shown; the minimum stays private); Undo and Reset never give a pour back | Good players' finishes unchanged (27 / 30) from minimum + 4 up; random pours 41–42. |
| Topsy-Turvy | minimum + 6 tilts, rounded up to a 5 | Good and great finishes unchanged (23 / 30, 30 / 30); + 2 cost great players two boards. |
| Counterweight | 6 / 8 / 10 hangs (weights + 4 / 5 / 6); scales 1–2 with exactly one balanced arrangement | Random hanging 0 at 5 / 7 / 9 to 7 / 9 / 11 alike; solver bands identical. |
| Operator | 3 full tries per equation | 2 tries cost good players 7 finishes in 60, 3 tries 1, 4 tries none; brute force 0 / 20 / 20. |
| Brimful | 3 × the minimum per puzzle, rounded up to a 5 | For consistency: random play already scored 0 and no level comes near it; scores unchanged. |
| Tally | counts 5–11, 7–13, 9–15 (was 6–10, 8–12, 10–14) | Same middles. The kit's honest scores do not depend on the count (120 seeds: 65 / 136 / 150 / 150 with either range). |

**Bands, median per level, 30 room seeds (5001–5030), before → after the limits** (both on the `puzzleScoreRev 1` shape; finish rate after in brackets), and every spam strategy's median / max:

| Game | Average | Good | Great | Near-perfect | Random / brute-force median / max |
|---|---|---|---|---|---|
| Colour Flood | 98 → **96** (1/30) | 146 → **146** (29/30) | 150 → **150** (30/30) | 150 → **150** (30/30) | random 2 / s 120 / 130 → **0 / 0**; cycling 126 / 135 → **0 / 135** (1 finish); random 0.5 / s 99 / 125 → **0 / 0** |
| Polypotions | 24 → **24** (0/30) | 140 → **139** (27/30) | 149 → **148** (30/30) | 150 → **150** (30/30) | random 1.5 / s 120 / 128 → **41 / 93**; 3 / s 120 / 126 → **42 / 132** |
| Topsy-Turvy | 37 → **37** (1/30) | 137 → **137** (23/30) | 148 → **148** (30/30) | 150 → **150** (30/30) | random 1.5 / s 0 / 120 → **0 / 63**; 3 / s 0 / 131 → **31 / 131** |
| Counterweight | 55 → **55** (13/30) | 145 → **145** (30/30) | 150 → **150** (30/30) | 150 → **150** (30/30) | random hanging 38 / 120 → **0 / 75**; fast 55 / 120 → **0 / 20**; place once 0 → 0 |
| Operator | 85 → **85** (2/30) | 143 → **143** (30/30) | 150 → **150** (30/30) | 150 → **150** (30/30) | brute force 68 / 120 → **20 / 65**; random 0 / 35 → 0 / 35; all plus 0 / 55 → 0 / 55 |
| Brimful | 48 → **48** (0/30) | 110 → **110** (14/30) | 144 → **144** (30/30) | 150 → **150** (30/30) | random 0 / 30 → **0 / 0**; fast 0 / 30 → 0 / 30; sweep 0 → 0 |
| Tally | 63 → **55** (2/30) | 97 → **97** (14/30) | 150 → **150** (26/30) | 150 → **150** (29/30) | guess the middle 66 / 79 → **53 / 79**; random in range 39 / 70 → **44 / 100** |

Every honest band moves by at most 1 except Colour Flood's average (98 → 96: an average player who times out a move or two past par now keeps half or none of the credit) and Tally's average (63 → 55 on these 30 seeds): the wider counts redraw every scene, and on 120 seeds the average is 65 with either range, so the 30-seed difference is which boards were drawn, not the rule. Rules a, c and e still pass for all seven (finishes ≥ 121, unfinished ≤ 110).

**What the server verifies.** Colour Flood, Polypotions (Undo and Reset now in the log), Topsy-Turvy and Brimful send every move, and the server replays only the moves inside the stored limit. Counterweight and Operator send the final placement / operators plus the phone's hang / try counts; the server refuses a count over the limit, but the count is the phone's word (a modified phone could send fewer). Counterweight's harder small scales are verifiable: with no limit at all, random hanging scores a median of 20 (was 38–55).

**Colour Flood's unfinished rule (Joe's ruling, 14 Oct).** With the limit alone, colour cycling kept 85 and random colours 54–59 on the existing unfinished credit (cycling floods most of the board within par + 2). On `floodRev 1` the waste factor is now 1 up to par, ½ at par + 1 and 0 at the limit (it was 0 at 4× par), so a board that runs out of moves scores 0. Three steps on the same 30 seeds, before the limits → limit only → limit and the new waste factor: average 98 → 98 → **96**, good 146 → 146 → **146**, great 150 → 150 → **150**, near-perfect 150 → 150 → **150**; random colours 2 / s 120 → 54 → **0**, colour cycling 126 → 85 → **0**, random colours 0.5 / s 99 → 59 → **0**. Stored rounds keep the old factor (`move-limits-check`).

## Attention rework (14 Oct 2026): Eagle Eye, Double Take, Tally

Each game gained a harder part and was re-weighted on the puzzle score shape (a finish = 120 + PAR(30), unfinished credit at most 110). Every change is gated on its own stamp, so stored rounds grade as before (`scripts/attention-rework-check.ts`: 770 answers on main's puzzles and 841 on the new stamps grade identically). Formulas: `docs/duelz-scoring-reference.md` section 7; code `src/lib/duel/attentionRev.ts`.

| Game | Change | Stage scores |
|---|---|---|
| Eagle Eye (`scanRev 1`) | Grid 3 has two target directions, at least 90° apart, 4–6 eagles each; tap every eagle facing either. Still 30 s. | Grids 40 / 40 / 30 (was 25 / 40 / 45), −3 per wrong tap |
| Double Take (`spotRev 1`) | Two pictures with their own six differences: the sweet shop, then a new rock pool (pufferfish, crab, seahorse, starfish, shell, fish). 30 s → 60 s, stored on the puzzle. **Next picture** moves on early, no way back. | 10 per difference (was 22), −4 per wrong tap (was 5); a finish needs all 12 with at most 5 wrong taps **in each picture** |
| Tally (`countRev 2`) | A fourth, 50-shape tray asks "How many more A than B?" (every shape of each colour counts; B 3–6, the answer 1–13). 45 s → 60 s, stored on the puzzle. Each tray now has 13 possible answers: 3–15, 5–17, 7–19 (#55's 5–11, 7–13, 9–15 widened around nearly the same middles), placed with spacing so every counted shape stays at least half visible. | Trays 40 / 30 / 25 / 15 (was 25 / 40 / 45); one off = 15 %, two or more off = 0 (was 60 % / 30 %) |

Measured with the fairness kits (`scripts/puzzle-fairness.ts symscan spotdiff countup --seeds=30`, seeds 5001–5030). Before = main (`1c0deac`) as rooms deal it today; after = the new stamps. Median score per level (finishes out of 30); random = the spam strategies' medians.

| Game | Average | Good | Great | Near-perfect | Random (median) | Highest unfinished / lowest finish |
|---|---|---|---|---|---|---|
| Eagle Eye | 51 → **66** (0/30) | 125 → **103** (9/30) | 144 → **135** (28/30) | 150 → **150** (28/30) | tap-all 0, random half 0, random quarter 0 → **0 / 0 / 0** | 107 / 122 → **108 / 120** |
| Double Take | 86 → **73** (0/30) | 142 → **136** (30/30) | 150 → **148** (30/30) | 150 → **150** (30/30) | 0 / 0 / 0 → **0 / 0 / 0**, skip-then-tap-all **0** | 110 / 120 → **110 / 127** |
| Tally | 55 → **49** (0/30) | 97 → **92** (8/30) | 150 → **150** (25/30) | 150 → **150** (27/30) | guess the middle 53 → **5**, random guess 44 → **4** | 100 / 124 → **97 / 128** |

Target bands were about 70 / 100 / 125 / 140–150 with random at or below about 60.

- **Eagle Eye** lands close: the two-target grid costs good players their finish about half as often as before (17 → 9 of 30), and the front-loaded grid weights lift the average player, who rarely reaches grid 3 (51 → 66). Great is 135 (target 125): great players still finish 28 of 30 with time to spare. A −2 wrong-tap cost was tried and rejected: tapping every eagle then scored a median of 6.
- **Double Take** stays high for good and great players (136 / 148, target 100 / 125). Twelve differences in 60 s is the old pace (six in 30 s); the kit gives the rock pool 3.5 s a difference against the shop's 3 s, and a good player still finishes with about 18 s left. Reaching about 100 would need a shorter clock than the 60 s asked for, or a harder picture than a fair one. The average falls 86 → 73 because nobody can finish on a strong first half alone any more. Random play scores 0 in every strategy (the per-picture allowance and −4 cost make blanket tapping worthless).
- **Tally** (revised before merge): guessing paid too well with one off at 60 % and two off at 30 % (guess the middle 51, a random guess 45 on the first version of this change). Two off now scores nothing, one off 15 % of the tray, and every tray has 13 possible answers, so a blind guess lands within one of the answer on about one tray in four and earns a few points (median 5 / 4, at most 70–74). On 120 seeds (30 are noisy for Tally's average): first version 72 / 98 / 149 / 150 with guesses 48 / 39 → now **70 / 95 / 147 / 150** with guesses **5 / 4**. One off at 30 % (as first suggested) left the guess median at 9 and 20 % at 6, so 15 % was taken; the weights moved to the early trays (40 / 30 / 25 / 15), which good players miss least, to keep good players near 100 (88 at 30 / 30 / 30 / 20). Great and near-perfect players still count all four exactly with half the time left (150).
- **Kit assumptions** (`scripts/puzzle-fairness/kits-speed.ts`): Eagle Eye grid 3 takes 1.2 s to read two targets and 1.05 s per eagle (grids 1–2: 0.8 s and 0.85 s); Double Take 3 s a difference in the shop, 3.5 s in the rock pool and 1.2 s for the picture change; Tally's comparison tray takes 2 s + 0.55 s per counted shape (both colours) + 1.2 s + 1 s to subtract; Tally's guessers guess each tray's middle (9 / 11 / 13 / 7 on countRev 2) or a random count in range.

## Number tuning (14 Oct 2026)

Counterweight and Ballpark were re-tuned towards the target bands **about 70 / 100 / 125 / 140–150** (average / good / great / near-perfect), with random play at or below about 60. Both changes are stamped and both clocks are stored on the puzzle, so stored rounds keep their 90 s / 75 s and their rules (`move-limits-check`, `number-batch-check`).

| Game | Change (new rounds) | Stamp |
|---|---|---|
| Counterweight | A fourth scale, slightly harder: 10 notches (5 each side, distances 1–5), three fixed and five tray weights, 12 hangs (limits 6 / 8 / 10 / 12). 120 s (was 90). Scales 15 / 25 / 30 / 55 in any order (any three ≤ 110); all four = 120 + PAR(30). | `balanceRev 2`, `timeLimitMs` 120,000 |
| Ballpark | 90 s (was 75). Full 8 within 1 % (was 2 %), falling evenly to 0 at 10 % (was 8 % under the 13 Oct score shape; 15 % on rounds dealt before it); a wild placement (25 % or more) still costs 1. The speed part is PAR(30) × the share of numbers placed within 1 % (was × accuracy ÷ 120). | `numlineRev 2`, `timeLimitMs` 90,000 |

**Bands, median per level, 30 room seeds (5001–5030), before (main, 14 Oct) → after** (finish rate after in brackets), and the spam strategies' median / max. Measured with `bun scripts/puzzle-fairness.ts balance numline --seeds=30` on main and on this change.

| Game | Average | Good | Great | Near-perfect | Random / spam median / max |
|---|---|---|---|---|---|
| Counterweight | 55 → **70** (0/30) | 145 → **126** (23/30) | 150 → **142** (30/30) | 150 → **150** (30/30) | random hanging 0 / 75 → **0 / 80**; fast 0 / 20 → **0 / 30**; place once 0 → 0 |
| Ballpark | 59 → **72** (6/30) | 116 → **105** (30/30) | 144 → **126** (30/30) | 150 → **142** (30/30) | random 2 / 24 → **5 / 27**; all middle 4 / 12 → **5 / 12**; either end 0 → 0 |

**How they were set.**

- **Counterweight.** The kit keeps its 5 s per weight on the 8-notch scales; the wide scale takes 10 s a weight (five weights over seven free notches at distances to 5 is a search, not a sum). At 6.5 s good players finished every round (good 135), at 8 s 131, at 10 s 126 (23 finishes in 30) and at 12 s half finished (median 70 or 120 either side). Good players either finish (121–138) or stop on the wide scale with 70, so their band is two-humped: median 126, mean 115. Average players balance the three 8-notch scales and run out of time on the fourth, which the points put at 15 + 25 + 30 = **70**. Reaching the good target of 100 would need a fourth scale that good players fail in about half their rounds, which is more than "slightly harder". Random hanging stays at a median of 0: the hang limits hold and the wide scale has many arrangements but 12 hangs over five weights rarely land one.
- **Ballpark.** At 90 s with the rev-1 curve the bands were 70 / 122 / 146 / 150: the longer clock lets everyone finish, and the speed part scaled by accuracy lets rough finishes keep most of it. Linear curves alone could not separate good from average (full within 0.5–1 %, zero at 8–15 %: good 107–126 whenever average reached 70). Scaling the speed part by the share placed within 1 % does: good players (about 2.5 % typical error) keep 10–15 of the 30, near-perfect players nearly all of it. Full within 1 % and zero at 10 % gave 72 / 105 / 126 / 142 (60 seeds: 70 / 104 / 125 / 142, random 5 / 37). Spam stays at a median of 5 or less.

Rules a, c and e still pass for both (nothing scores 0; Counterweight's lowest finish 121 against its highest unfinished 80; every intro SCORE line and "?" help states the numbers).

## Speed tuning (14 Oct 2026): Flash, Bang On, Don't Break the Chain, Pull!

Aimed at the shared targets (average about 70, good 100, great 125, near-perfect 140–150), without pushing Chain's good players (about 80) any lower. Each change rides its own stamp; stored rounds grade exactly as before (`scripts/speed-oct14-check.ts`: 700 answers recorded on main before the change, plus 698 on the new stamps).

- **Flash (`tapRev: 3`).** Gold-like decoys join teal, red and blue: near-gold amber, a gold border only, the word GOLD on a dark screen and the top half of the screen gold (each at least once a round; the first decoy is always plain). Curve: 150 at ≤ 150 ms average, 128 at 200, 100 at 300, 0 at 800 (straight lines between; was 150 at ≤ 200 ms, −16 per 100 ms). False starts cost as `tapRev: 2`. "Wait for gold…" is larger.
- **Bang On (`tapRev: 3`).** From watch 2: black blind spots where the marker vanishes (0.05 of the bar on watch 2, growing to 0.13 on watch 10; two from watch 6; never over the target), watches 2, 4 and 7 sweep 40 % slower, watches 6 and 9 run corner to corner. Full marks need ≤ 5 ms (was 20 ms); 20 ms scores 137; then a straight line to the 13 Oct knee (101 at 200 ms) and its fall to 0 at 325 ms, kept as decided. Ten watches on the fixed schedule: a player stopping at each first crossing is done by about 14 s.
- **Don't Break the Chain (`chainCycleRev: 1`).** Each board's cycle is five different charms (no shape or colour more than twice; neighbours share neither), all shown in the preview and each needed once per board, so nothing repeats inside a board. The board for links 21–25 runs last to first: a banner warns from link 17 ("Reverse after link 20!"), a "← REVERSE" flash marks link 20, and the preview's arrows point back. Unfinished credit (`CHAIN_CYCLE_REV_CREDIT`) pays 4 a link up to five links (20), then about 4 a link to 79 at 19 links, then flattens to 110 one short (floor(79 + 31 × ((links − 19) ÷ 20)^0.7)), so a chain that breaks at the reversal keeps most of its credit while a few early links earn little; a finish is still 120 + up to 30. (The first draft, floor(110 × (links ÷ 39)^0.45), paid 21 for one link and lifted average players to 43; revised 14 Oct before merging.)
- **Pull! (`clayRev: 5`).** 14–16 birds instead of 10–12, on the same cadence rules (the gap shrinks to fit), the same clays and the same scoring and empty-shot cost.
- **Ascend** (display only): the count-up timer sits centred above the board, 0 to 15 s, back to 0 when the untapped discs move. **Bonk** (display only): the "TAP GOLD / TAP RED" box is bigger and outlined in the rule colour.

**Kit modelling added for the new rules** (`scripts/puzzle-fairness/kits-speed.ts`, `kits-engine.ts`; script-only assumptions, applied to before and after alike where they apply): a gold-like decoy pulls a reflex tap 1.3–2.2 times as often as a plain one (amber 2.2, half 2, border 1.5, word 1.3); Bang On's timing spread grows 25 % per 0.1 of bar blacked out before the target, 15 % on a diagonal face and by √1.4 on a slower sweep; chain players read five charms 6 % slower, take 25 % longer per link on the reversed board, slip 1.5 times as often there, and on its first link sometimes tap forwards (1.5 × the slip rate); a Pull! player now and then takes a flying bird for a clay on the first look (a quarter of the slip rate, every revision).

Medians on 30 room seeds (5001–5030), `bun scripts/speed-bands-oct14.ts --md`; "before" is the same seed dealt by main's generators (Flash and Bang On `tapRev: 2`, three-symbol chains, Pull! `clayRev: 4`), "after" today's room puzzle:

| Game | Player | Before | After |
|---|---|---|---|
| Flash | average | 110 | **70** |
| Flash | good | 135 | **104** |
| Flash | great | 150 | **127** |
| Flash | near-perfect | 150 | **144** |
| Flash | **tap every colour (careless)** | 54 | **30** |
| Flash | tap every 150–300 ms / every 1 s | 0 / 0 | 0 / 0 |
| Bang On | average | 116 | **109** |
| Bang On | good | 136 | **119** |
| Bang On | great | 144 | **129** |
| Bang On | near-perfect | 148 | **133** |
| Bang On | **tap at a random time (careless)** | 72 | **49** |
| Bang On | tap at the start / every 150–300 ms | 0 / 0 | 0 / 0 |
| Don't Break the Chain | average | 15 | **20** |
| Don't Break the Chain | good | 80 | **82** |
| Don't Break the Chain | great | 141 | **135** |
| Don't Break the Chain | near-perfect | 150 | **150** |
| Don't Break the Chain | tap at random / in screen order (careless) | 0 / 0 (max 2) | 0 / 0 (max 4: one lucky link) |
| Pull! | average | 90 | **90** |
| Pull! | good | 125 | **130** |
| Pull! | great | 150 | **150** |
| Pull! | near-perfect | 150 | **150** |
| Pull! | **mash on whatever flies (careless)** | 16 | **0** |
| Pull! | random shots 6 / 3 a second | 0 / 0 | 0 / 0 |

**Where the targets were not reached, and why.**
- **Bang On** stays above 70 / 100 for average and good players: the ask kept the 13 Oct curve from 200 ms down (101 at 200 ms), and simulated average players are about 165 ms off (good about 110 ms), so they cannot fall below about 101–110 without moving that knee. The top tightened as asked (near-perfect 148 → 133; 20 ms now scores 137). Lowering the knee would be a new decision.
- **Pull!** honest bands do not move: kit players aim at clays and rarely hit a bird (about 0.1–0.2 per run before and after), so more birds mainly hurt careless mashing (16 → 0). Pull!'s 5 / 10 per clay was kept; reaching the targets would need a scoring change or real-play evidence that players shoot more birds.
- **Chain** average players stay low (15 → 20): their chains break within the first few links, which now pay 4 each. Good players held (80 → 82); great players fell slightly (141 → 135) from breaks at the reversal.

## Word batch 2 (14 Oct 2026)

Six Word games changed on 14 Oct (each behind its own stamp; stored rounds grade exactly as before). Medians from `scripts/puzzle-fairness.ts <game>` run on the unmodified tree (before) and the batch (after), same seeds (30 room seeds unless noted), finish rate after in brackets. Targets for average / good / great / near-perfect: about 70 / 100 / 125 / 140–150; random and careless play near 0.

| Game (stamp) | Average | Good | Great | Near-perfect | Random / careless (median) |
|---|---|---|---|---|---|
| Strikeout (`strikeoutRev 2`) | 83 → **66** (0/30) | 135 → **110** (13/30) | 141 → **135** (21/30) | 144 → **141** (23/30) | frequency-order letters 83 → **6**; A–Z 0 → 4; random letters 0 → 2 |
| Roundabout (`wheelRev 1`) | 83 → **72** (0/30) | 132 → **102** (5/30) | 150 → **143** (30/30) | 150 → **150** (30/30) | random traces 16 → **0**; random 3–5 letter traces 14 → **0**; 3-letter sweep (new) 0 |
| Lookout (`wordSearchRev 1`) | 131 → **121** (16/30) | 148 → **147** | 150 → **150** | 150 → **150** | random drags 0, sweeping every cell 0 |
| Cryptogrid (`codewordRev 2`, 100 seeds) | 84 → **91** (16/100) | 139 → **142** | 150 → **150** | 150 → **150** | spam medians 0 (random reassign max 29 on one seed) |
| Swapword (`swapwordRev 2`, 100 seeds) | 136 → **136** (67/100) | 148 → **148** | 150 → **150** | 150 → **150** | random swaps 0; mark-reading swap-non-green 24 → 28, swap-amber 28 → 31 (flagged, real play) |
| Letterfall (`wordfallRev 2`, kit bots) | 105 → **105** (p10 50 → 70) | 150 → **150** | 150 → **150** | 150 → **150** | random taps + Enter 0 (max 5); random 3–4 tile chains 25 → 25 (open game, flagged) |

- **Strikeout** lands near the targets (66 / 110 / 135 / 141). Good sits at 110 because its four-word runs hit the unfinished cap; strikes, not time, stop the strong solvers, so near-perfect finishes about four boards in five. The old rule-b flag (frequency-order guessing 83) is closed.
- **Roundabout** lands near the targets apart from great (143): the kit's great player finishes every board with about a quarter of the time left, and pulling great to 125 would sink average well below 70. Unfinished credit is front-loaded (12 a word for the first 6, then 5) so average lands near 70 while good stays near 100. The rule-b flag (random traces 16) is closed by the attempt log.
- **Lookout, Cryptogrid and Swapword** were already above the targets for good and great before the batch, and the requested changes (a bigger bank and counted chips, a fifth given, a budget of at least 16) do not pull them down: the kits play at a flat speed with perfect deduction (Lookout 9 s a word, Cryptogrid 6 s a number, Swapword the optimal swap every 5 s), so theme, word length and deduction difficulty don't show. Bringing them to the band needs harder formats (more words per grid, fewer givens, a tighter budget) or timings measured from real play; left for Joe.
- **Letterfall** keeps par 30, so good and better still reach 150; the slower, less vowel-heavy drops bury the good bot far less (15/30 → 3/30) while its raw points fall (40 → 34). On these bots a par of about 40–45 would hit the band; **par needs setting from real play**.

## Pattern / Logic batch (14 Oct 2026)

Jumbled `tilesRev 1` (the 3 × 3 grid plus one extra cell, minimum 18–24), Colour Flood `floodRev 2` (raised colours; the limit stays par + 2 after measuring a flat 15 and par + 3), Box Six `sudokuRev 1` (13–15 givens) and Bomb Defusal `bombVersion 3` (plain clues) change difficulty, not formulas; Polypotions (look and buttons only) and Topsy-Turvy are unchanged. Measured with `scripts/puzzle-fairness.ts tiles flood sudoku bomb tubes --seeds=30` on main (before) and on the branch (after), the same 30 room seeds (5001–5030) and kits. Median score (finishes of 30); the target is about 70 / 100 / 125 / 140–150 with random play at or below about 60.

| Game | Average | Good | Great | Near-perfect | Nothing | Random / spam median (max) |
|---|---|---|---|---|---|---|
| Jumbled | 137 (26) → **30** (0) | 147 (30) → **138** (27) | 150 (30) → **148** (30) | 150 → **150** (30) | 0 → 0 | random slides 1.5 / 3 a second 0 (120) → **0 (2)** |
| Box Six | 65 (0) → **58** (0) | 123 (23) → **113** (15) | 142 (30) → **140** (30) | 150 → **150** (30) | 0 → 0 | random digits, one digit, row fill 0 (38) → **0 (28)** |
| Bomb Defusal | 117 (15) → **125** (16) | 150 (25) → **150** (25) | 150 (28) → **150** (28) | 150 (29) → **150** (29) | 0 → 0 | tapping everything, random steps 0 (44) → **0 (44)** |
| Colour Flood (par + 2, shipped) | 96 (1) → **96** (1) | 146 (29) → **146** (29) | 150 → **150** (30) | 150 → **150** (30) | 0 → 0 | random colours 2 / s 0 (0) → **0 (0)**; cycling 0 (135) → **0 (135)**; random 0.5 / s 0 → **0** |
| Colour Flood (par + 3, measured) | 96 → 96 (1) | 146 → 146 (29) | 150 → 150 (30) | 150 → 150 (30) | 0 → 0 | random colours 2 / s 0 (0); cycling 0 (135); random 0.5 / s 0 |
| Polypotions | 24 → 24 | 139 → 139 | 148 → 148 | 150 → 150 | 0 → 0 | random pours 41–42 (132), unchanged (pour limit) |

Rules a–e still pass for all five (finishes ≥ 120, unfinished ≤ 110, nothing 0, the intro and help state 120 and the game's own numbers).

**Jumbled.** The kits play the stored shortest route with each level's think time and mistakes; a slide on the extra-cell board is taken as 1.8 s for a good player (1.5 s on the 3 × 3: nine tiles and a line of four need a longer look ahead; an assumption, as every kit's base is). With 1.5 s the after bands are 55 (1) / 142 (30) / 149 / 150. Either way the average player now rarely finishes inside 60 s (it finished 26 of 30 on the 3 × 3) and good, great and near-perfect move by at most 9. The fewest-moves shape can't put a median between 70 and 120 for long: a finish is 120 or more and a slide puzzle's unfinished credit (tiles placed × waste) is small mid-solve, so the average band lands low and the good band high. Tried: minimum 14–20 (average 37–56, good 139–142), 16–22 (34–49, 138–141), 18–24 kept.

**Box Six.** One fewer given moves every band down a little (good 123 → 113, half the good players now finish). The kit counts seconds per blank cell, not the harder deduction a sparser grid needs, so real play likely drops a little more.

**Bomb Defusal.** The kit reads each clue for a fixed 5 s (good player) and makes the same share of slips on any wording, so it cannot see clearer clues: the bands move only with card size (version 3 cards are mostly 6 clues). By the kit Bomb stays above the target (average 125, good 150); Joe's device testing should say whether the plain card plays easier. A shorter clock would be the lever if so (not changed tonight).

**Colour Flood.** Three limits were measured for `floodRev 2`; the batch ships par + 2, the rule `floodRev 1` already used, because good players' median stays at 146 (the bar was 140). The stamp now marks the batch's boards (raised colours, moves line above them). Honest medians are the same under all three (average 96, good 146, great and near-perfect 150). Random play, 120 room seeds (5001–5120), boards flooded / median / mean:

| Limit | Colour cycling 2 / s | Random colours 2 / s | Random colours 0.5 / s |
|---|---|---|---|
| **par + 2 (shipped)** | **11 / 0 / 12.2** | **0 / 0 / 0.0** | **0 / 0 / 0.0** |
| par + 3 | 14 / 0 / 15.5 | 4 / 0 / 4.4 | 0 / 0 / 0.0 |
| flat 15 (first version of this batch) | 24 / 0 / 26 | 2 / 0 / 2 | 0 / 0 / 0 |