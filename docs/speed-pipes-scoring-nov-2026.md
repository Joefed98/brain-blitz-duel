# Flash, Bang On and Pipeline partial credit (7 Nov 2026)

From the scoring audit (`docs/audit-nov-2026/scoring.md`, issues 9, 18 and 23h). New stamps only; every older stamp
deals, grades and reads exactly as before. Code: `src/lib/duel/speedPipesNov7.ts` (stamps, deal, pin),
`src/lib/duel/depth/flash.ts`, `depth/bangOn.ts`, `src/lib/duel/standard/pattern.server.ts` (Pipeline).
Check: `bun scripts/speed-pipes-nov7-check.ts` (~5 s). Report: `bun scripts/speed-pipes-nov7-bands.ts [--old]`.

## What changed

**Flash (`reaction`) and Bang On (`stopwatch`): `tapRev 7`** (`TAP_REV_PER_ITEM`). On tapRev 6 a miss was averaged in
as 1,200 ms (Flash) or 500 ms (Bang On) before the curve, so one or two misses dragged the average past the curve's
steep part and half a run scored almost nothing. On tapRev 7 each flash and each watch scores on its own on tapRev 6's
curve (Flash `FLASH_REV6_CURVE`, Bang On `STOPWATCH_REV4_CURVE`), a missed flash or watch scores 0, and the curve part
is the average of those points. Everything else is tapRev 6's: the tap logs, schedules and replay (the decoy cut, false
starts), Flash's steady hand (+15 / +8, all flashes hit) and false-start costs, Bang On's dead centre and zone streak
(together at most 50), and the partial floor. A run with every reaction or stop equal scores exactly what it scored on
tapRev 6, and a flawless run is 200 on both. The server stores each item's points (`extra.depth.each`), so the
breakdown adds up: Flash `max(floor, curve + steady − false starts)`, Bang On `max(floor, curve + min(50, centre +
streak))`, with `curve` the rounded average of `each`.

Ascend (`numhunt`) shares the `tapRev` field but never deals tapRev 7: it keeps tapRev 5, which the standard deals as
6 (`STANDARD_STAMPS.numhunt`), and grades as before (the legacy fixture covers its tapRev 5 and 6).

**Pipeline (`pipes`): `pipesRev 4`** (`PIPES_REV_PLACED`, dealt over the standard's pipesRev 3 by `dealPipesPlaced` in
`generatePuzzle`). The unfinished credit counted only tiles joined to the source, so a player who fixed tiles away
from the source, or in index order, scored 0 until the flow reached them. On pipesRev 4 it counts the tiles turned into
their solved orientation (the stored solution's side-set) wherever they are, out of the tiles not in it at the deal.
So that random turning pays about nothing: a tile turned out of its solved orientation costs 1, and a tile turned but
left wrong costs 1 ÷ (its other orientations − 1), a half for most tiles (of a tile's three other orientations one is
right, two wrong: a random turn is worth 0 on average). A straight has one other orientation, its solved one, so
turning a straight is always progress. A finish is unchanged (150 + up to 40 speed + up to 10 par; 200 for a fast
solve at par). The same count feeds the standard's "how early" extra.

**23h: Pipeline's band kit.** The pattern kit sends side-sets; from pipesRev 1 the server reads only the tap log, so
`scripts/standard-bands.ts` graded every Pipeline answer as the dealt board (every level 0). `kitBands` in
`scripts/standard-lib.ts` now turns each step into the clockwise taps it takes (`asPhoneSends`, as
standard-pattern-check already did), so the band numbers are real.

## Bands (kit players, 30 room seeds from 6100, `bun scripts/standard-bands.ts reaction stopwatch pipes --seeds=30`)

Medians (p10 / p90 in brackets).

| Game | Level | Before (tapRev 6 / pipesRev 3) | After (tapRev 7 / pipesRev 4) |
| --- | --- | --- | --- |
| Flash | nothing | 0 | 0 |
| Flash | spam | 0 (0 / 10) | 0 (0 / 10) |
| Flash | average | 72 (8 / 94) | 75 (20 / 93) |
| Flash | good | 103 (79 / 118) | 108 (83 / 127) |
| Flash | great | 128 (111 / 158) | 135 (117 / 158) |
| Flash | near-perfect | 170 (149 / 182) | 168 (147 / 181) |
| Bang On | nothing | 0 | 0 |
| Bang On | spam | 0 (0 / 6) | 7 (0 / 54) |
| Bang On | average | 79 (9 / 122) | 94 (68 / 129) |
| Bang On | good | 108 (74 / 133) | 113 (97 / 139) |
| Bang On | great | 128 (114 / 165) | 139 (120 / 163) |
| Bang On | near-perfect | 169 (144 / 193) | 164 (145 / 192) |
| Pipeline | nothing | 0 | 0 |
| Pipeline | spam | 8 (0 / 29) | 19 (0 / 36) |
| Pipeline | average | 83 (73 / 94) | 80 (74 / 90) |
| Pipeline | good | 164 (161 / 172) | 164 (161 / 172) |
| Pipeline | great | 184 (180 / 187) | 184 (180 / 187) |
| Pipeline | near-perfect | 198 (197 / 200) | 198 (197 / 200) |

The Pipeline "before" column is graded with the fixed kit; with the kit as it was (no tap log) every level scored 0.
The near-perfect Flash and Bang On medians fall a few points because the average of the points is a little below the
points of the average when the times vary (the curves bend); a perfect run is unchanged.

Spam by kind (30 seeds, median): Flash tap-every-1s 8 → 8, the other two 0 → 0. Bang On tap-at-start 0 → 0,
tap-150-300ms 0 → 0, **tap-random-time 4 → 39** (one tap at a random moment on each watch: about one stop in five
lands within 100 ms by chance, and each now counts for itself). Steeper per-stop curves were tried and barely helped
(34 at 106 ms → 60; 25 at 100 ms → 30, which took the good median to 92): it is the price of scoring each stop on its
own. It stays well under average play (94). depth-topup-check's own measure (40 fresh seeds, its random player) shows the
same: Bang On random median / top 10 % 0 / 2 → 5 / 62, near-perfect median 162, so that check stays pinned to
tapRev 6. Pipeline random-taps-2/s 6 → 18, tap-all-once 15 → 26, random-turns 5 → 13,
mostly straights turned right by chance (a straight's only other orientation is its solved one); against average play
80.

## The audit's half-run examples (`bun scripts/speed-pipes-nov7-bands.ts [--old]`)

Flash, seed 7001 (8 flashes), every hit at 160 ms, the rest missed:

| Hit | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1 | 0 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tapRev 6 | 174 | 111 | 86 | 40 | 12 | 6 | 4 | 2 | 0 |
| tapRev 7 | 174 | 139 | 119 | 99 | 80 | 60 | 40 | 20 | 0 |

(All eight hit keeps the steady-hand 15; one miss loses it, as before.)

Bang On, seed 7001, the stopped watches dead on, the rest left to run out:

| Stopped | 10 | 8 | 5 (first five) | 5 (every other) | 3 | 1 |
| --- | --- | --- | --- | --- | --- | --- |
| tapRev 6 | 200 | 152 | 29 | 15 | 14 | 3 |
| tapRev 7 | 200 | 170 | 104 | 90 | 59 | 18 |

Pipeline, the fewest taps to the solution tile by tile in index order, unfinished at the buzzer (100 % is the finish
at the buzzer, 160):

| Seed | 25 % | 50 % | 75 % | 100 % |
| --- | --- | --- | --- | --- |
| 11 | 13 → 26 | 0 → 54 | 85 → 89 | 160 → 160 |
| 33 | 0 → 20 | 0 → 58 | 71 → 86 | 160 → 160 |
| 44 | 0 → 25 | 0 → 55 | 74 → 91 | 160 → 160 |

## Texts

The "?" help states the stamps dealt (and the older wording while `pinPreNov7(true)` is on): Flash "each flash scores
by how fast you react … a missed flash nothing; your points are the average over the flashes", Bang On "each watch
scores by how close you stop it, a missed watch nothing; your points are the average over the ten", Pipeline's
unfinished line "the share of the tiles you turn to fit, more for doing it early; turning a tile wrong takes it down".
The intro SCORE lines were already true of the new stamps and are unchanged. The reveals say "a missed flash scores 0"
/ "A missed watch scores 0" on tapRev 7 (was "counts 1,200 ms" / "500 ms off").

## Checks

- `speed-pipes-nov7-check` (new): the legacy fixture `scripts/fixtures/speed-pipes-nov7-legacy.json.gz` (4,059 cases
  recorded on unmodified main by `scripts/speed-pipes-nov7-record.ts`: Flash and Bang On tapRev 4–6, Ascend tapRev 5–6,
  Pipeline pipesRev 1–3, kit play at four levels cut at quarters, spam, nothing, three times left) grades identically;
  the deals and the pin; k of n items; no inversions; 200; the breakdown; kit medians; Pipeline's proportion, monotony,
  200 and spam; the texts.
- Checks written for tapRev 6 / pipesRev 3 pin them with `pinPreNov7(true)`: standard-attention-check,
  standard-pattern-check, depth-topup-check.
