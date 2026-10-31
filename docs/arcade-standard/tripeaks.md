# Summit (`tripeaks`) on the arcade scoring standard (tripeaksRev 1, 30 Oct 2026)

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
