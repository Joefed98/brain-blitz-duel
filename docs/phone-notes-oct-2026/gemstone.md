# Gemstone: Joe's phone-test notes (27 Oct 2026)

Gameplay change on a new stamp, **`matchupRev 10`** (rooms dealt `matchupRev 9` before). Every older stamp replays and
scores exactly as before (e6-check's 48 legacy and 24 rev-9 runs, matchup-check, replay-check, arcade-self-replay-check).

## What changed

| Note | Change | Stamp |
|---|---|---|
| Make it a 90-second game | `matchupRev 10` runs 90 s (`MATCHUP_V10_RUN_TICKS`, 5,400 ticks); every older revision keeps 60 s. The server replay reads the run length from the stored revision's game; the round's clock is the definition's 90 s + 3 s, as Tempo's 75 s (an older 60 s round ends at 60 s and its clock reads 0 from there). | rev 10 |
| Swap into and out of ice when it makes a match of 3 | A swap that touches an iced cell goes through exactly when it makes a line of three (a special swapped with an iced gem needs a line too); the ice stays on its cell and breaks when the gem there is cleared. Treasure still never moves. The hint, the reshuffle and the "no move left" test use the same rule (`matchupFindSwapV10`). | rev 10 |
| Ice doesn't refresh | The ice is laid once, at the start (the plan's largest seeded set, `MATCHUP_V10_ICE` = 10 cells in rows 4–9); a level met brings new goals but no new ice. | rev 10 |
| Retune the score for 90 s | Base curve `MATCHUP_V10_BAND_CURVE` (150 at 4,200 match points, was 3,200) and feature curve `MATCHUP_V10_FEATURE_CURVE` (the same feature points as rev 9), fitted with the skill-band bots so each level's median stays where rev 9 put it. | rev 10 |
| Remove the counter at the top (gems destroyed per colour) | The collection bar is gone on every revision (look only). | none |
| Treasure becomes a shiny bronze | The treasure gem is a bronze octagon medallion round a polished bronze boss, with a copper rim and a white glint (was gold round a ruby); every revision (look only). | none |

Also: the "?" help says "Ninety seconds", that a frozen gem can be swapped into or out of the ice only by a swap that makes
a line of three and that the ice never comes back, and drops "with more ice" from the level line; the intro's score line
is unchanged (it quotes no figures). The intro demo stays stopped until one is recorded on `matchupRev 10`
(`introDemo.functions.ts`). `scripts/room-identity/matchup.ts` (arcade-room-identity-check) proves the ice, the k-th
level's goal and the k-th treasure's column are the same for weak, good and elite logs on every seed.

New check: **gemstone-rev10-check** (~20 s): rooms deal rev 10; older revisions run 60 s with no new field; 90 s exactly;
10 frozen cells in rows 4–9; every ice swap on 60 first boards goes through exactly when it makes a line; the treasure
never moves; ice never comes back in real play; the hint is always a swap the sim accepts; 24 bot runs replay through the
server (90 s, no desync, score = breakdown, above 0) and the medians rise weak < good < elite; no gem counter, bronze
treasure, the help's text. e6-check, arcade-tuning-c-check, arcade-tuning-f2-check and six-game-scoring-check now
expect rooms to deal rev 10 and the help to quote the dealt curve's 4,200.

## Medians by level, before (`matchupRev 9`) and after (`matchupRev 10`)

`bun scripts/arcade-skill-bands.ts matchup --rev=now --levels=all --seeds=60` (tuning, room seeds 0–59) and
`--from=10000 --seeds=200` (fresh), fixed bots, every run scored by the server's replay. Before = main's `matchupRev 9`
(tuning identical to docs/arcade-200-remeasure.md; fresh near-perfect, elite and flawless re-played with the same bots).

| Seeds | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---|---|---|---|---|---|---|
| Tuning, before | 56 | 66 | 81 | 100 | 123 | 150 | 170 |
| Tuning, after | 52 | 67 | 81 | 98 | 122 | 145 | 162 |
| Fresh, before | 51 | 68 | 85 | 109 | 131 | 147 | 168 |
| Fresh, after | 51 | 64 | 83 | 98 | 130 | 142 | 170 |

No played run scores 0 at any level (lowest: 24 tuning, 13 fresh, both weak). The ladder rises weak → flawless on both
seed sets; the good player's median moves by 0 / −2.

## Choices and assumptions

- **"Ice doesn't refresh"** read as: no new ice once the run has started (rev 9 laid more ice on every level met, which
  could re-freeze broken cells). To keep ice in play over 90 s, rev 10 lays the plan's largest set (10 cells) at the start
  rather than rev 9's 4; the cells are seeded, the same for everyone.
- **A gem in ice** keeps the ice on its cell: swapping a gem out of an iced cell leaves the incoming gem frozen unless the
  match clears it. Ice is per cell, as on rev 9 (gems already fell through it).
- **Scoring held level, not lifted:** Joe didn't ask Gemstone to score higher, so the curves map the longer run's match
  points back onto rev 9's medians (good unchanged). Great's fresh median moves 109 → 98 (the 90 s run separates near-perfect
  from great more); everything else is within ±5.
- **Treasure** still rarely reaches the bottom in bot play (median 0–1 a run, as on rev 9); unchanged, out of scope.
- The round clock uses the definition's single limit (Tempo's precedent), so a stored 60 s round's clock starts at 90 s and
  reads 0 from 60 s on. `MATCHUP_TIME_MS` (63 s, the round summaries' fallback) is unchanged; round-time-check passes.
