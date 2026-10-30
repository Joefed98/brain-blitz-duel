# TriPeaks on the arcade scoring standard (tripeaksRev 1, 30 Oct 2026)

A new Arcade game in the Cards & Board group, born on the standard: `tripeaks`, 90 s run (93 s round clock).

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
| Speed | 20 | all 28 cleared: `stdSpeed(20, finish tick, 27 s, 90 s)`, full by 27 s, 0 at the buzzer |

## Measured

Speed's "full by" is the near-perfect bots' median clear: **26.9 s** on room seeds 0–59, set to 27 s (the brief's guide
was about 45 s). The bots think about 1.3 s a tap at the average level; they value each playable card by the chain it
starts and the cards it uncovers (looking 1–4 plays ahead by level); near-perfect and elite also search the deal.

| Seeds | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0–59, median (p10–p90) | 143 (112–177) | 149 (127–182) | 183 (125–191) | 187 (131–194) | 192 (188–197) | 192 (188–198) | 200 |
| cleared | 12/60 | 26/60 | 33/60 | 31/60 | 59/60 | 59/60 | 60/60 |
| clear median | 85.8 s | 68.0 s | 48.1 s | 35.8 s | 26.9 s | 20.9 s | 13.1 s |

Every bank deal reaches 200: cards-check replays all 300 lines through the server's replay (a tap every 15 ticks).

## Assumptions

- The brief's "24-card stock" counts the card that starts the discard (23 left to turn).
- Peak cards clear fast for every level (the bank holds only clearable deals), so the core pays well even for weak play;
  the features and speed separate the levels.
