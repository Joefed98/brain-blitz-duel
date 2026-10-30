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
