# Speed Pool (`pool`, `poolRev` 1)

The Sports group (30 Oct 2026). A full-width table, top down, 120 s: pot all seven spots, then the black. Sim
`src/lib/arcade/pool.ts`, art `pool.renderer.ts`, stage `src/puzzles/pool.tsx`, plumbing `src/lib/duel/pool.ts` on
the Sports kit.

## Play

- Walnut rails, mother-of-pearl sights, lamp pools on green cloth, corner pockets with chrome caps and angled jaws,
  half-round middle pockets with a chrome plate, a baulk line (no D), a blue chalk cube on the rail.
- Each seed deals a layout (no break): spots 1–7, four stripes as obstacles and the black, the cue ball on a seeded
  spot. Rooms deal layouts from the bank (`src/lib/duel/poolBank.server.ts`, 60, built by `bun scripts/pool-bank.ts`):
  each one cleared by the shot search (`scripts/pool-oracle.ts`) without a miss or a foul.
- Aim by dragging on the table (the line to a ghost ball, the object ball's short line, the cue ball's faint path);
  power on the cue panel at the bottom (red full power on the left → green soft on the right; pull the cue back,
  let go to shoot); a spin button beside it (centre, top, back, left and right side).
- Fouls −10: a stripe (or the black before the spots are down) hit first, or a stripe potted. Cue ball potted: 5 s off
  the clock and it comes back to a seeded spot. The black early ends the run with no black or speed points.

## Parts (together 200)

| Part | Max | How |
| --- | --- | --- |
| Spots (core) | 140 | 20 a spot potted |
| Black | 10 | the black after every spot (ends the run) |
| Pots in a row | 30 | 5 for each pot straight after another pot, full at 6 |
| Speed | 20 | the black potted: full by **67 s**, 0 at the buzzer |

Fouls cost 10 each; any played run scores at least 1, no input 0.

## Measured (30 bank layouts)

Speed's full-by time is the near-perfect median finish (66.6 s).

| Level | Median (min–max) | Cleared | Median finish |
| --- | --- | --- | --- |
| Weak | 42.5 (1–135) | 0/30 | – |
| Average | 90 (20–135) | 0/30 | – |
| Good | 123.5 (40–166) | 9/30 | 98.4 s |
| Great | 140.5 (90–185) | 23/30 | 96.3 s |
| Near-perfect | 171 (129–200) | 30/30 | 66.6 s |
| Elite | 175 (130–200) | 28/30 | 52.4 s |
| Flawless | 200 (175–200) | 30/30 | 22.9 s |

## Proofs

pool-check, arcade-standard-check's entry (every bank witness 200 with no foul through the server replay),
arcade-self-replay's `pool` entry.
