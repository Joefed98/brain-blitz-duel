# Ball Tracker on the arcade scoring standard (btRev 8)

29 Oct 2026, batch C of the arcade scoring standard (`src/lib/arcade/arcadeStandard.ts`). Rooms deal **btRev 8**
(`BT_REV_STD`). Play is btRev 7's exactly: the same 300-course bank (`ballTrackBankV7.server.ts`), the same deal less course 56 (see "The deal"), the
same rules, boosters, crossovers, gold marbles and combos, so a btRev 7 log replays tick for tick on btRev 8 (60 of 60
skill-band bot logs, weak to elite, gave the same checkpoint checksum every tick and the same final state but the
`std` mark). Only the scoring changes. States add `std: 1`, outside the checkpoint checksum. btRev 1–7 replay and score
exactly as before (their scoring code is untouched; e6-check, balltrack-check, arcade-tuning-g3-check, arcade-score-bands-check,
scoring-targets-check, scoring-bands-check).

## The parts (sum 200)

| Part | Max | How it counts |
|---|---|---|
| Marbles home (core) | 140 | straight line: floor(140 × home ÷ 36). A fixed maximum: all 36 home = 140 (about 3.9 a marble). |
| Gold marbles | 25 | an equal share of 25 for each of the course's 6 gold marbles that goes home (floor(25 × golds ÷ 6): 4, 8, 12, 16, 20, 25). |
| Combos | 20 | 1 for each combo landing, up to 20. |
| Boosted marbles | 15 | an equal share of 15 for each marble home after a speed booster, over all 36 marbles (floor(15 × boosted ÷ 36)). |
| All-home bonus, speed | 0 | gone on btRev 8 (btRev 7's "all home adds up to 10 for speed" stays on btRev 7). |

- **No input scores 0; any input scores at least 1** (`stdTotal`). Wrong cups, lost marbles and crossover crashes cost
  nothing beyond what they don't earn (the row lists no mistake cost), and they end the combo streak.
- **"In a row"** is the sim's existing streak (`btV7Home`, `BT_V7_COMBO_FROM` = 3): each marble that lands in its own
  cup adds 1 to the streak; a wrong cup, a marble lost off the board or a crash at a crossover sets it to 0. A combo
  landing is a correct landing at a streak of 3 or more, so the first combo is the third marble home in a row and
  22 home in a row fill the part (36 in a row give 34 combo landings).
- **Counts confirmed:** every bank course has exactly 6 gold marbles (one in each block of six, never the first two;
  the bank builder rejects a course with fewer, and all 300 have 6) and three speed boosters.
- **The boosted count is not fixed per run** (assumption): whether a marble passes a booster depends on the route its
  player sets. Every one of the 36 marbles can be routed through one, so the part is shared over all 36 marbles home
  (15 ÷ 36 each; `BT_V8_BOOSTS_FULL` = 36). A fixed 15 boosted (1 each) was considered and dropped: the good bot
  already boosts 18 marbles at the median, so the part would be full for most players and measure nothing.
- **Every dealt course reaches 200** (second pass, 30 Oct 2026; see "The deal" below).
- **Earning a feature never costs core:** each feature counts only marbles that went home (a gold marble home, a combo
  landing, a boosted marble home), so no feature asks a player to give up a marble; routing through a booster is a choice
  of tubes, and the oracle shows all 36 home with every marble boosted.
- Everyone in a room plays the identical stored course (bank course from the server's deal list, stored in the puzzle as before).

## The deal (second pass, 30 Oct 2026)

Joe's note: every course btRev 8 deals must be able to reach 200. btRev 8 deals from `BT_V8_DEAL`
(`src/lib/duel/ballTrackDealV8.server.ts`): the 300-course bank less `BT_V8_EXCLUDED` = **[56]**, 299 courses. The
generator draws one of them with the same single draw as before (`seed` = bank index + 1, the course copied into the
puzzle), so a room's course is fixed on the server and stored; older stamps keep their stored courses (btRev 7 dealt
from the whole bank, and nothing deals it now). `btV8DealIndex(seed)` maps a seed for tools (the skill-band tool): bank
index seed mod 300 as on btRev 7, an excluded course moved to the next listed one.

The list was computed with the boosted oracle (`scripts/arcade-standard/balltrack.ts`) on btRev 8's rules (unchanged
from the first pass) over all 300 courses through the server replay (~4.5 min). The first pass's measurement oracle
reported 11 short courses (9 at 35 boosted, course 115 at 32, course 237 at 28); the checked-in oracle of the first pass
scored 200 on only 271. The oracle now adds a greedy local search: while a marble misses its cup or its boost, it and the
two marbles before it try other boosted routes (the shortest through each booster, then up to 8 more of other lengths)
aimed at its colour's cup in each of the three tray layouts (start, relay, shuffle), keeping a change only when more
marbles go home or home boosted. With it **299 courses reach 200**, 115 and 237 included; on course 56 the best found is
195 (35 home, all boosted, 6 gold: marble 29 lands in the wrong cup as the cups swap), also with a wider search (the
four marbles round it), so 56 is the one course left out. A better router might still bring it home; leaving it out
keeps the rule "every dealt seed can reach 200" proved, not assumed.

balltrack-deal-check proves: the list is the bank less the excluded courses; Math.random swept over every slot of the
list plus 2,000 pseudo-random draws never deals an excluded course (each draw's stored course is the bank's, on btRev
8) and deals every listed one; and every listed course reaches 200 with the oracle through the server replay, unflagged
(all 299 at full depth, `CHECKS_FULL=1` or `--full`, ~4.5 min; an evenly spread 24 at quick depth, ~40 s; CI runs it in
halves, `@1/2` in shard a and `@2/2` in b).

## Core target

A fixed maximum: all 36 marbles home is 140 (`BT_V8_BAND_CURVE` = `bandCurve([0, 36], [0, 140])`, LIVE_BANDS'
curve). For reference the near-perfect level's median is 35 home (32–36), elite and flawless 36.

## Medians after (btRev 8)

Second pass (30 Oct 2026, the deal list): the same 30 room seeds give exactly the first pass's medians and p10–p90 below
(none of them picks course 56; the scoring is unchanged). Fresh seeds (`--from=10000 --seeds=30`): weak 46 (33–55),
average 87 (52–111), good 127 (95–167), great 176 (150–191), near-perfect 191 (181–199), elite 198 (190–200), flawless
200 (195–200).


`bun scripts/arcade-skill-bands.ts balltrack --rev=now --levels=all --seeds=30 --jobs=1` (server replay, fixed bots):

| Level | Median | p10–p90 | Home (median) | Gold | Combos | Boosted |
|---|---|---|---|---|---|---|
| Weak | 52 | 31–61 | 11 | 1 | 0 | 8 |
| Average | 75 | 51–95 | 15 | 2 | 2 | 13 |
| Good | 137 | 100–172 | 26 | 4 | 15 | 18 |
| Great | 172 | 147–188 | 32 | 5 | 23 | 26 |
| Near-perfect | 193 | 177–197 | 35 | 6 | 31 | 34 |
| Elite | 198 | 190–200 | 36 | 6 | 34 | 36 |
| Flawless | 200 | 195–200 | 36 | 6 | 34 | 36 |

The medians rise at every level. The top is close (193 / 198 / 200) because the game's units are capped: near-perfect
bots already bring 35 of 36 home, and the elite and flawless bots play almost the same run (36 home, every gold, every
marble boosted). No bot ignores a feature on btRev 8 (the fixed bots seek boosters, keep streaks and route gold
marbles like any other), so no bot was changed. Before (btRev 7, e6 doc): average 71, good 108, great 137, near 150.

## Where it lives

- Sim: `src/lib/arcade/ballTrack.ts` (`BT_REV_STD`, `BT_STD`, `btStdScore`, `btStdParts`, `BT_V8_BAND_CURVE`,
  `btIsV7Play`); `btBandParts` hands a `std` state to `btStdParts`, so the reveal's lines are the standard's
  ("36 / 36 marbles home → 140", "Gold marbles 25 · Combos 20 · Boosted marbles 15 +60"); the reveal, round summary and
  final moment count 36 marbles (the state's `r7`, the course's balls).
- Deal: `src/lib/duel/ballTrack.server.ts`; `LIVE_BANDS.balltrack` (rev 8, the straight core line, `strictRev` 6 kept).
- Help `instructions.ts` (parts and maximums, "the parts total 200"), intro `introScore.ts`.
- Intro demo: a demo recorded on btRev 7 or 8 plays (same play; the board shows no score).
- Checks: balltrack-deal-check (the deal list, above), arcade-standard-check (`scripts/arcade-standard/balltrack.ts`: two boosted-oracle runs on dealt courses through the server
  replay score 200, a built full state 200, one tap ≥ 1, no input 0), arcade-self-replay-check's appended
  `balltrack/std`, `playRevOf` maps btRev 8 to 7 (`LIFT_REVS`).

## 3 Nov 2026 polish (display only, no stamp)

- The tubes you turn are raised gold (`strokeChannels(…, movable)` in `ballTrackArt.renderer.ts`: a gold body, a
  bright lip and a deeper shadow cast down), the fixed track plain wood; the same widths and paths, so every marble
  still rides inside its drawn channel.
- A HUD strip of the shared pills (`btDrawHud`, `BT_HUD_H` 36 px, above the arena in `src/puzzles/ballTrack.tsx`):
  "Home n/36" (the main count, top left), "Gold n" (btRev 7+; "Wrong n" on earlier revisions) and, from two home in
  a row, "Combo ×n" (gold from 3, when it scores), and "Switch up Ns" on the right (gold in the last five seconds; "Left n" after both
  switch-ups). It replaced the 28 px status line under the board, so the arena's slot is as tall as before; the
  combo no longer draws on the queue shelf. Taps, the sim and its inputs are unchanged.

## Levels (stage 3, 15 Nov 2026)

The Strategy overhaul's difficulty levels (`docs/design/difficulty/README.md`): Ball Tracker offers Easy, Normal, Hard
and Expert, all on **btRev 8** (the stamp, the parts and their 200 unchanged). The level rides on the dealt puzzle
(`level`, only when it isn't Normal) and, more to the point for the sim, in the stored course: a level course carries
its release interval (`drop`) and its cup moves (`moves`); its marble count is its `balls`' length. The sim, the server
replay and every display read those from the stored course, so a room's players and the server build the identical run.
Normal courses carry neither field and play, score and draw exactly as before.

| Level | Marbles | Release | Cup moves | Gold | Boosters | Crossovers | Clock |
|---|---|---|---|---|---|---|---|
| Easy (16 Nov 2026) | 16 | every 190 ticks (3.2 s), last at 47.5 s | none | 7 | 4 | 2 | 60 s |
| **Normal** (today's btRev 8) | 36 | every 84 ticks (1.4 s), last at 49 s | 2 (a re-lay at 20–30 s, a colour shuffle at 40–45 s) | 6 | 3 | 2 | 60 s |
| Hard | 42 | every 72 ticks (1.2 s), last at 49.2 s | 8 | 7 | 3 | 2 | 60 s |
| Expert | 42 | every 66 ticks (1.1 s), last at 45.1 s | 12 | 7 | 2 | 2 | 60 s |

- **Cup moves** alternate a re-lay (four new drop columns, each cup moving with its drop) and a colour shuffle (a
  derangement over the same columns), one in each equal window between 10 s and 48 s (seeded, fixed in the stored
  course). Every move keeps the 5 s countdown, the cup pulse in the second before it and the slide; on Easy the cups
  never move (`relay` and `shuffle` hold a tick no run reaches, `BT_NEVER_TICK`).
- **Scoring**: the same four parts and maximums (marbles home 140, gold 25, combos 20, boosted 15), shared over the
  course's own counts (`btStdSpecOf`: the core and boosted parts over its marbles, the gold part over its gold marbles;
  combos full at 20, except on Easy, below). The state carries the counts as `nb` / `ng` (outside the checkpoint checksum).
- **Easy's combos** (16 Nov 2026): an Easy course also carries `combo: 10`, the combo landings that fill the combos part
  (its 16 marbles make at most 14), held in the state as `nc` (outside the checksum) and read by `btStdSpecOf`; the
  level settings' `comboFull`. Hard and Expert courses carry no `combo` and keep 20, as Normal. The reveal's
  axis, its part lines, the HUD's "Home n/N", the "ALL N HOME!" banner, the round summary and the Strategy summary's meter
  all read the course's count; the intro adds a line on the level's courses ("42 marbles, one every 1.1 s · the cups move
  12 times", `btLevelIntroLine`), and the help names every level's pace.
- **The deal**: each level draws one course from its own proved list with the same single draw as Normal
  (`ballTrackLevels.server.ts`: `ballTrackDealEasy.server.ts`, `…Hard…`, `…Expert…`, 60 courses each). Normal deals
  `BT_V8_DEAL` exactly as before. Rated play and the Daily are always Normal (the framework's `modeLevel`).
- **Building and proving the lists**: `bun scripts/balltrack-level-deal.ts --level=<l> [--count=N] [--check]` builds
  candidates on the level's own PRNG stream with the bank's rules (the 13-row board, the seeded fixed straights,
  crossovers under rotatable tubes, boosters on other upper fixed straights, a balanced marble queue with no three of a
  colour running, gold marbles one per equal block), re-drawing each cup layout until every cup is reachable with an
  early route, then keeps a course only when the boosted oracle (`scripts/arcade-standard/balltrack.ts`) scores **200
  through the server's encode + replay** (every marble home boosted, every gold). The oracle's local search tries, on a
  level course, the layouts next to the one live at a marble's landing (Normal's bank courses keep trying all three).
  Each kept course's oracle log is its witness (`scripts/fixtures/balltrack-level-witness-<level>.json`). Build times
  here: Easy 4 s (60 of 60 shaped, 163 candidates), Hard 14 min (60 of 62 shaped, 384 candidates), Expert 25 min (60 of 72 shaped, 396 candidates). `--check` rebuilds byte
  for byte.

### Measured (btRev 8, server replay)

`bun scripts/balltrack-level-bands.ts <level> --seeds=30 --limits` (the skill-band bot, fixed bots, under Joe's human
limits: no tap within 0.15 s of the last, an off-route marble noticed no sooner than 0.25 s, a new marble's route no
sooner than 0.25 s; `BT_HUMAN_LIMITS` in the bot, off by default). Normal on fresh deal seeds (10000+), each level on the
first 30 courses of its list (Expert on all 60). Median (average):

| Level | Weak | Average | Good | Great | Near-perfect | Elite | Flawless | Elite at 200 | Average bot 175+ |
|---|---|---|---|---|---|---|---|---|---|
| Easy | 96 (93) | 164 (164) | 189 (186) | 196 (194) | 200 (199) | 200 (198) | 200 (200) | 27 of 30 | 13 of 30 |
| Normal | 46 (46) | 91 (96) | 145 (145) | 177 (173) | 190 (187) | 195 (196) | 200 (197) | 14 of 30 | 0 of 30 |
| Hard | 40 (41) | 51 (54) | 74 (77) | 115 (116) | 160 (156) | 177 (178) | 188 (188) | 0 of 30 | 0 |
| Expert | 39 (41) | 50 (49) | 58 (59) | 79 (81) | 120 (120) | 151 (150) | 177 (177) | 0 of 60 | 0 |

The oracle reaches 200 on every listed course (that is the list's rule). Without the limits the numbers barely move (Hard
elite 180, the stock tool's). The shared tool, `bun scripts/level-tune.ts balltrack --level=all --seeds=60` (stock bots):

| Level | Near-perfect avg (median) | Elite avg (median) |
|---|---|---|
| Easy | 198.1 (200) | 198.3 (200) |
| Normal | 189.5 (191) | 196.3 (199) |
| Hard | 165.8 (169) | 180.6 (180) |
| Expert | 124.3 (122) | 158.1 (158) |

A clear step at every level for every player; Normal stays comfortable for a strong player (elite ~196); Expert's elite
player scores well (p10–p90 132–169 under the limits, best 177 on list entry 21) but never 200 (all-home-and-boosted on 42
marbles with 12 cup moves asks for no slip at all); 200 there is the oracle's.

**Easy made easier (16 Nov 2026, Joe: an average player should have a real shot at a star).** Before: 28 marbles every
108 ticks, 8 gold, 4 boosters, combos full at 20; the average bot starred (175+) on 3 of 60 courses (5 %), averaging
122.8 (elite 198.6). The average bot misroutes a share of its marbles at any pace (misread cups and stray taps, re-planned
too late), so a slower release alone stalled near 150 (24 every 2.1 s: 144.6, 7 of 60; 20 every 2.5 s: 149.5, 6 of
60), and a lower combo figure alone moved little (28 marbles: about +6). Fewer, slower marbles with the combos part
filling at 10 did it: 16 marbles every 3.2 s, 7 gold, 4 boosters, combos full at 10. Under the human limits, on the
rebuilt list (the course list re-proved at 200 by the oracle, every witness replayed):

| Easy | Average avg (median) | Average 175+ | Good 175+ | Elite avg (median) |
|---|---|---|---|---|
| Before, 60 courses | 122.8 (119) | 3 of 60 (5 %) | 28 of 60 | 198.6 (200) |
| After, 60 courses | 161.0 (165) | 22 of 60 (37 %) | 49 of 60 | 198.4 (200) |
| After, first 40 courses | 160.6 (164) | 17 of 40 (43 %) | | 198.8 (200) |
| After, first 30 courses | 163.9 (164) | 13 of 30 (43 %) | 24 of 30 | 198.4 (200) |

Easy stays well clear of Normal (average 161 against 90, under the same limits on 60 courses). Tried and dropped (60 courses, combos at 10 unless
said): 15 every 3.4 s with 7 gold (55 %, the top of the aim), 14 every 3.6 s with 6 gold (42 %), 16 every 3.2 s with 6
gold and combos at 8 (37 %).

### Where it lives

- Sim `src/lib/arcade/ballTrack.ts` (`drop`, `moves`, `combo`, `btMovesOf`, `btDropTicksOf`, `btBallsOf`, `btLatestMove`,
  `btStdSpecOf`, `btStateBalls`, `BT_NEVER_TICK`); deal `src/lib/duel/ballTrack.server.ts` (`generateBallTrack(level)`);
  registry `GAME_LEVELS.balltrack` (`src/lib/levels/gameLevels.ts`); skill-band spec `gameForPuzzle`.
- Checks: **balltrack-levels-check** (~70 s: Normal unchanged (the deal, the state, 75 bot runs on every btRev recorded on
  the code before levels, `scripts/fixtures/balltrack-levels-legacy.json` by `scripts/balltrack-levels-legacy-record.ts`),
  each list's shape and moves, the deal and its stamp, the clock, every witness at 200 through the server replay, the
  oracle re-run on 2 courses a level (all at `CHECKS_FULL=1` / `--full`), scoring and display, and the step between levels
  under the human limits); arcade-self-replay-check's appended `balltrack/easy`, `/hard`, `/expert`.
- Decisions for Joe: Expert's elite never reaching 200 (the guide asks only to score well);
  the shared elite profile reacts in 145 ms, a little past the 0.25 s limit (the limits are applied in this bot only).

## D6 levels (27 Nov 2026)

Measured with the ladder tool (`scripts/d6-ladder.ts`: the average player, and the realistic elite held to HUMAN_LIMITS,
on 96 room deals a level). The figures are a report, not a target: a person playtests the levels and Joe tunes them in
a later scoring session (Joe, 27 Nov 2026). What the checks prove is that every deal at every level can be completed.

- **Normal stamp:** btRev 9 (Normal: btRev 8's bank and play, its parts full at 28 marbles home, 5 gold, 18 combos, 28 boosted).
- **The lever:** marble colours and cups: 3 / 4 (Normal) / 5 (a purple star) / 5 with a faster release and 6 cup moves (the board holds five cups at most).
- **Average player, Easy / Normal / Hard / Expert:** 178.8 / 110.5 / 78.8 / 58.2.
- **The elite at 200:** 58 / 40 / 33 / 28 %.

Every older stamp, and every level round dealt before D6 (the era pin `d6PreLevels`), replays and scores exactly as
before. The level settings live in the sim and are mirrored in `src/lib/levels/gameLevels.ts`; D6's checks
(`d6-normal-stamps-check`, `d6-cards-levels-check`, `d6-sports-levels-check`, `d6-strategy-levels-check`) prove the
deals, the proofs and the mirror.
