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
| Colour Flood | random or cycling colours | 120 / 135 | Any colour sequence floods the board (random play in 1.5–3.4× par). A solve must stay a finish (rule c), so only a move limit in the game (with a moves-left counter) can stop it. |
| Polypotions | random legal pours | 120 / 128 | Random pours solve about two boards in three (1.4–2.7× the minimum); same as Colour Flood: needs a pour limit. |
| Topsy-Turvy | random tilts | 0 / 131 | Partial credit is 0 (wasteFactor), but a parked ball never moves, so random tilting solves about one board in five. Needs a tilt limit. |
| Counterweight | random hanging | 55 / 120 | The two small scales balance by chance and only the final placement is sent. Weights 20 / 35 / 75 keep it at 55; needs harder small scales or a placement log. |
| Operator | trying every operator order | 68 / 120 | Each stage flashes CORRECT live and stages 1–2 have 16 and 64 orders; needs a try limit. |
| Tally | guessing in range | 66 / 79 | Every tray's count is one of five values (6–10, 8–12, 10–14), so a blind guess is often exact or one off; needs wider count ranges. |
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

Last two columns: doing nothing (max over 30 seeds) and the worst spam strategy's median, before → after.

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
