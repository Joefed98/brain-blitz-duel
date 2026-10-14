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
| No-finish games | Bang On random taps 92; Flash tapping every colour 75; Pull! mashing 30; Letterfall random chains 25; Forage 8; Nucleus 5 | — | Out of scope tonight (their formulas stay); only Bang On's all-miss bottom changed (20 → 0). Bang On's random tap averages about 226 ms off against an average player's 138 ms, so a curve that zeroes random taps would also cut average players hard: Joe's call (scoring reference open item 16). |

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
| Flash | 112 → **112** (30/30) | 134 → **134** (30/30) | 150 → **150** (30/30) | 150 → **150** (30/30) | 0 → 0 | 75 → 75 |
| Bang On | 116 → **116** (30/30) | 136 → **136** (30/30) | 144 → **144** (30/30) | 148 → **148** (30/30) | 20 → 0 | 92 → 92 |
| Bonk | 62 → **62** (0/30) | 102 → **102** (1/30) | 118 → **118** (0/30) | 133 → **133** (12/30) | 0 → 0 | 0 → 0 |
| Pull! | 95 → **95** (0/30) | 130 → **130** (6/30) | 150 → **150** (21/30) | 150 → **150** (30/30) | 0 → 0 | 30 → 30 |

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
