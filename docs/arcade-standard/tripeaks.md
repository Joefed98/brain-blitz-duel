# Summit (`tripeaks`) on the arcade scoring standard (tripeaksRev 3, 7 Nov 2026; tripeaksRev 2, 3 Nov 2026; tripeaksRev 1, 30 Oct 2026)

## The stuck end (15 Nov 2026, display only, every revision)

When the stock is gone and no face-up card plays, the run ends (`ended = 3`, unchanged). Summit has no Undo or Reset,
so that end is truly over; it used to end with no message. The board now says "NO PLAYS / LEFT" between the stock and
the discard (`tpStuckLines`). No stamp: nothing the sim does changed.

## tripeaksRev 3 (7 Nov 2026, scoring audit issue 6: what rooms deal)

The audit (`docs/audit-nov-2026/scoring.md`, issues 6 and 22) found 80 of rev 2's 200 locked behind a clear (clear 10,
stock par 20, speed 50). Rev 3 keeps rev 2's deals, stock pars and play and moves half the speed onto the cards:

| Part | Max | How |
| --- | --- | --- |
| Cards cleared | 105 | a straight line over the 28 peak cards (rev 2: 80) |
| Peak tops | 30 | 10 for each peak top cleared (unchanged) |
| Longest run | 10 | 1 for each card in the longest run, up to 10 (unchanged) |
| Clear | 10 | all 28 cleared (unchanged) |
| Stock par | 20 | cleared only: full at par or fewer stock turns, 0 with the whole stock turned (unchanged, now in whole numbers) |
| Speed | 25 | cleared only: full by 20 s, 0 at the buzzer, in whole numbers (`stdSpeedInt`; rev 2: 50 with `stdSpeed`) |

- **Proportional:** 55 points (was 80) wait for the clear; each card cleared is worth 105 ÷ 28.
- **No inversions:** a card cleared never lowers the score; the poorest clear (every card and top, a run of 1, no par
  or speed: 105 + 30 + 1 + 10 = 146) scores above the best run that misses one (27 cleared, every top, a run of 10:
  101 + 30 + 10 = 141).
- **Whole-number lines (issue 22):** speed `floor(25 × (3600 − t) ÷ 2400)` and stock par `floor(20 × (23 − turns) ÷ (23 − par))`.
- **200 on every deal:** all 300 bank deals' stock-par lines replay to exactly 200 on rev 3 through the server replay
  (cards-nov7-check).

Skill bands (`bun scripts/cards-bands.ts tripeaks --seeds=60 --from=10000`, fresh seeds; the same runs on both stamps):

| Level | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rev 2 median (before) | 62 | 88 | 128 | 157 | 173 | 181 | 200 |
| **rev 3 median** | **77** | **110** | **151** | **167** | **177** | **182** | **200** |
| rev 2 p10–p90 | 50–79 | 70–140 | 85–160 | 87–178 | 165–188 | 172–192 | 200 |
| rev 3 p10–p90 | 65–99 | 91–163 | 107–177 | 109–187 | 170–192 | 174–194 | 200 |
| cleared | 0/60 | 9/60 | 30/60 | 37/60 | 57/60 | 57/60 | 60/60 |

Older stamps replay and score exactly as before: 70 runs recorded on main before the change (Free Cell rev 4, Summit
rev 2, Thirteen rev 1; `scripts/fixtures/cards-nov7-legacy.json`, `scripts/cards-nov7-legacy-record.ts`) replay to the
same score, final-state checksum and tick (cards-nov7-check). Checks written for the older stamps can deal them with
`pinCardsPreShare(true)` (`src/lib/duel/arcade.server.ts`).

## tripeaksRev 2 (3 Nov 2026, Joe's Cards & Board batch)

- **Speed was already there** (rev 1: 20 points on a clear, full by 27 s, 0 at the buzzer); rev 2 keeps it, re-weighted.
- **New feature, Stock par:** each bank deal's par is the fewest stock cards turned by any line that clears all 28 with
  a run of ten (so a flawless run fills every part at once): `src/lib/arcade/cards/tripeaksStockPar.data.ts`, built by
  `bun scripts/tripeaks-stock-par.ts` (the bank's depth-first search with the stock capped, the cap raised a turn at a
  time, each cap searched to 2 million positions, so it is the fewest the search found; about 25 minutes on one core, so it runs in parts: `--from --to --part`, then `--merge`; `--check` re-proves
  every par). Pars 5–23, median 15. The lines are `scripts/fixtures/tripeaks-par-solutions.json` (checks and bots only).
  The state carries the deal's `stockPar`; the HUD shows **STOCK PAR turned/par** at the top centre (gold while within
  par); the reveal shows a Stock par tile and line.
- A clear that turned the stock at most par times earns Stock par in full, falling evenly to 0 when the whole stock (23
  turns) is turned; nothing without a clear. Same deals, play and 60 s run as rev 1.

| Part | Max | How it pays |
| --- | ---: | --- |
| Cards cleared (core) | 80 | `stdLine(80, cleared, 28)` (rev 1: 120) |
| Peak tops | 30 | 10 each |
| Longest run | 10 | 1 a card, full at 10 (rev 1: 20, 2 a card) |
| Clear | 10 | all 28 cleared |
| Stock par | 20 | all 28 cleared: full at or under par, 0 with all 23 stock cards turned |
| Speed | 50 | all 28 cleared: full by 20 s, 0 at the buzzer (rev 1: 20, full by 27 s) |

Every bank deal reaches 200: cards-check replays all 300 stock-par lines through the server's replay (a clear, a run of
ten, the stock turned exactly par times) to exactly 200, and re-proves on eight deals that no such line turns fewer.

Measured (`bun scripts/cards-bands.ts tripeaks --seeds=100`, room seeds 0–99; fresh 10000–10099 in brackets):

| Level | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rev 1 median (before) | 99 | 131 | 177 | 184 | 192 | 192 | 200 |
| **rev 2 median** | **65** (64) | **89** (88) | **138** (107) | **157** (157) | **176** (173) | **182** (181) | **200** (200) |
| rev 2 p10–p90 | 53–77 | 72–106 | 85–167 | 97–180 | 164–189 | 171–194 | 200 |
| cleared | 0/100 | 7/100 | 56/100 | 54/100 | 97/100 | 97/100 | 100/100 |
| clear, median | — | 56.6 s | 48.3 s | 34.9 s | 27.0 s | 21.2 s | 11.9 s |

**Against the targets:** average, great and near-perfect land on them; weak is 5 over the 30–60 range (every bank deal
is clearable, so weak play still clears about 20 of the 28 cards, and the core pays cards on a straight line); good is
bimodal (it clears about half the time: 138 on room seeds, 107 on fresh); elite is 182, just under 185 (the elite and
near-perfect bots plan with the same search, which doesn't aim for the stock par; speed, full by the elite median clear,
is what separates them). Rev 1 runs replay unchanged: 25 runs recorded on main (`scripts/fixtures/cards-nov3-legacy.json`)
replay to the same score and final state (cards-check).


Shown as **Summit** since 31 Oct 2026 (was TriPeaks; the id stays `tripeaks`). No gameplay change: the 60 s run from the
30 Oct review is in (`TP_RUN_TICKS` = 3,600, `TRIPEAKS_TIME_MS` 63 s). Re-measured 31 Oct 2026 on room seeds 0–99:

| Level | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| score, median (p10–p90) | 99 (82–114) | 131 (112–153) | 177 (125–186) | 184 (137–192) | 192 (187–196) | 192 (188–198) | 200 |
| cleared | 0/100 | 7/100 | 56/100 | 54/100 | 97/100 | 97/100 | 100/100 |
| finish, median | — | 56.6 s | 48.3 s | 34.9 s | 27.0 s | 21.2 s | 13.3 s |

Speed stays full by **27 s** (the near-perfect median, 27.0 s).


A new Arcade game in the Cards & Board group, born on the standard: `tripeaks`, 60 s run (63 s round clock; 90 s until
the 30 Oct 2026 review, before rooms dealt it: near-perfect play cleared in about 27 s of 90).

## The stamp and the deal

`tripeaksRev 1` (`TP_REV`, spec `TP_STD_SPEC`, parts `tripeaksStdParts`, `src/lib/arcade/cards/tripeaks.ts`). Rooms deal
a bank index (`generateTripeaks`). The bank (`tripeaksDeals.data.ts`, 300 deals) is built by
`bun scripts/tripeaks-bank.ts`: deal seeds 1, 2, 3, … kept only when a depth-first search over the sim's own rules
(`scripts/cards/tripeaksSolver.ts`) finds a line that clears all 28 peak cards with a run of at least ten (39 seeds were
left out), so perfect play reaches 200 on every deal. The lines are `scripts/fixtures/tripeaks-solutions.json`.

## Rules

Three peaks of 28 cards (rows of 3, 6, 9 and 10; the bottom ten face up, the rest face down until both cards over them
are cleared) and a 24-card stock whose first card starts the discard. Tap a face-up card one higher or lower than the
discard (Ace and King wrap) to play it; tap the stock to turn a new discard (the run resets). Dragging a card onto the
discard plays it too. The run ends when all 28 are cleared, at the buzzer, or when the stock is empty and no card plays.

## Parts (200 in all)

| Part | Max | How it pays |
| --- | ---: | --- |
| Cards cleared (core) | 120 | `stdLine(120, cleared, 28)` |
| Peak tops | 30 | 10 for each of the three top cards cleared |
| Longest run | 20 | 2 a card of the longest run without a stock turn, full at 10 |
| Clear | 10 | all 28 cleared |
| Speed | 20 | all 28 cleared: `stdSpeed(20, finish tick, 27 s, 60 s)`, full by 27 s, 0 at the buzzer |

## Measured

Speed's "full by" is the near-perfect bots' median clear: **26.9 s** on room seeds 0–59 (26.8 s on fresh seeds
10000–10059), set to 27 s; the 60 s run did not move it. The bots think about 1.3 s a tap at the average level; they
value each playable card by the chain it starts and the cards it uncovers (looking 1–4 plays ahead by level);
near-perfect and elite also search the deal.

| Seeds | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0–59, median (p10–p90) | 100 (82–114) | 131 (112–151) | 177 (125–186) | 184 (131–192) | 192 (188–197) | 192 (188–198) | 200 |
| cleared | 0/60 | 4/60 | 33/60 | 31/60 | 59/60 | 59/60 | 60/60 |
| clear median | — | 56.6 s | 48.1 s | 35.8 s | 26.9 s | 20.9 s | 13.1 s |
| 10000–10059, median | 93 | 132 | 170 | 186 | 191 | 192 | 200 |

On 90 s the weak and average medians were 143 and 149: the shorter run separates the lower levels.

Every bank deal reaches 200: cards-check replays all 300 lines through the server's replay (a tap every 15 ticks).

## Assumptions

- The brief's "24-card stock" counts the card that starts the discard (23 left to turn).
- The bank holds only clearable deals, so the core pays well even for weak play; the 60 s run, the features and speed
  separate the levels.

## Levels (the Cards & Board overhaul, stage 3, 15 Nov 2026)

Normal is tripeaksRev 3 exactly. A level deal carries `level` and tripeaksRev 3; its game is `tripeaksLevelGame(level)`
(`TP_LEVEL_RULES`). All 60 s.

| Level | Deals | Glow | Ace–King wrap | Undo | Hints | Speed full by |
|---|---|---|---|---|---|---|
| Easy | the bank's deals with a stock par of 12 or less (`TP_EASY_DEALS`) | on | yes | 3 | free; the glow shows by itself after 8 s idle | 25 s |
| Normal | today | on | yes | none | none | 20 s |
| Hard | the no-wrap bank's 108 easier deals (`TP_HARD_NOWRAP_DEALS`, no-wrap stock par 8–18) | off | no | none | −5 each | 20 s |
| Expert | the no-wrap bank's 100 hardest deals (`TP_EXPERT_DEALS`, no-wrap stock par 18–23) | off | no | none | one | 16 s |

The no-wrap bank (`tripeaksExpert.data.ts`, `bun scripts/tripeaks-expert-bank.ts [--check]`): deal seeds 1–700 the solver
clears without the Ace–King wrap with a run of ten (208 clear), each with its no-wrap stock par; the 100 with the highest
par are Expert's, the rest Hard's (16 Nov 2026, Joe: Hard and Expert step up through the deal itself). Every deal's line
is in `scripts/fixtures/tripeaks-expert-lines.json` (`{ expert, hard }`), replayed by cards-levels-check.

On Easy a dead end waits while an undo is left. The glow is display only; the skill-band bots model its absence as
1.6 × the search time (human limits; `NO_GLOW_SCAN` in the bot).

## D6 levels (27 Nov 2026)

Measured with the ladder tool (`scripts/d6-ladder.ts`: the average player, and the realistic elite held to HUMAN_LIMITS,
on 96 room deals a level). The figures are a report, not a target: a person playtests the levels and Joe tunes them in
a later scoring session (Joe, 27 Nov 2026). What the checks prove is that every deal at every level can be completed.

- **Normal stamp:** tripeaksRev 4 (Normal: run full at 6, stock par within par + 8, speed by 25 s).
- **The lever:** time and the stock: 90 s and 23 turns / Normal / 45 s and 18 / 32 s and 14.
- **Average player, Easy / Normal / Hard / Expert:** 153 / 119 / 61 / 46.
- **The elite at 200:** 65 / 44 / 32 / 21 %.

Every older stamp, and every level round dealt before D6 (the era pin `d6PreLevels`), replays and scores exactly as
before. The level settings live in the sim and are mirrored in `src/lib/levels/gameLevels.ts`; D6's checks
(`d6-normal-stamps-check`, `d6-cards-levels-check`, `d6-sports-levels-check`, `d6-strategy-levels-check`) prove the
deals, the proofs and the mirror.
