# Blockfall on the arcade scoring standard (blockfallRev 1, 1 Nov 2026)

A new Arcade game in the **Retro** group (`src/lib/duel/arcadeGroups.ts`), born on the standard: `blockfall` (working
name; Joe may rename it in `gameNames.ts`), a 60 s run (63 s round clock). Sim `src/lib/arcade/blockfall.ts`, art
`blockfall.renderer.ts`, stage `src/puzzles/blockfall.tsx`, replay `replayBlockfallRun` (`src/lib/duel/blockfall.ts`),
deal `src/lib/duel/blockfallDeal.server.ts`.

## Rules

- A 10 × 20 well, two hidden rows above it where pieces appear. Pieces of four squares in the seven shapes.
- **The order is seeded:** shuffled bags of seven, drawn with the engine's PRNG from the stored seed, so every player
  in a room gets the identical sequence. The next three pieces show on the right; one piece can be held (once per
  piece); a dashed ghost shows where the falling piece lands.
- **Controls (phone):** drag sideways to move (one column per 29 world px), tap to turn clockwise, flick down to drop
  (at least 40 px and 0.7 px/ms), a slow drag down steps a row at a time. Under the well, within thumb reach, three
  pads send the same inputs: HOLD, TURN, DROP (the held piece's box also holds). **Computer:** ← → move, ↑ (or X) turns,
  Z turns the other way, ↓ steps down, Space drops, C holds (`DESKTOP_KEYS`).
- **Speed rises every 15 s:** gravity is a row every 48, 34, 24, then 16 ticks (`BF_GRAVITY`). A piece that can no
  longer fall locks after 30 ticks; a move or turn that succeeds restarts that wait, at most 15 times a piece.
- A turn that's blocked tries small kicks (one or two columns either way, one row up).
- Full rows clear at once (the band flashes white-cyan).
- **Topping out** (a new piece overlapping the stack, or a piece locking wholly in the hidden rows) ends the run
  early; its score is kept (the low-stack part is 0).
- Inputs (k1 move by `a` columns, k2 turn, k3 drop, k4 hold, k5 one row down), one per tick, are the phone's log; the
  server replays it on the stored seed and keeps its own score.

## The look

Our own block style in Retro's neon cyan family: each square a glass tile, a dark tinted core inside a bright neon rim
with a small corner glint and a faint inner glow line; the ghost is the rim alone, dashed. The shapes' colours are our
own set (pale lilac, cyan, sky, mint, violet-blue, aqua, cobalt), not the classic one. The cabinet is deep navy fading
to black, a faint cyan grid in the well, a dashed gold line at the top of the bottom four rows (the low-stack mark).
No borrowed name, word or music: the game is called Blockfall in every string, and its bed is Fission's Retro track.

## The deal and the proof of 200

`bun scripts/blockfall-deal.ts` keeps 300 seeds (from the skill-band tool's room-seed hash of 0, 1, 2, …) that the
oracle (`scripts/blockfall-oracle.ts`) plays to exactly 200 through the server replay (8 dropped). The oracle sees only
what the screen shows (the piece, the next three, the hold), plays a piece about every 0.5 s through the shared
planner (`scripts/blockfall/planner.ts`): a well down the right edge for fours until the multi-line part is full, then
flat play, and over the last 12 s play that keeps the stack low (a piece that would leave it above four rows in the
last 200 ticks is left in the air). Rooms deal `BLOCKFALL_DEAL[room seed % 300]`. blockfall-check re-proves 24 deal
seeds at quick depth and all 300 (and the file byte for byte) with `CHECKS_FULL=1`.

## Parts (200 in all)

| Part | Max | How it pays |
| --- | ---: | --- |
| Lines (core) | 140 | `stdLine(140, lines, 33)`: a straight line, full at 33 lines |
| Multi-line clears | 40 | 4 for two lines at once, 8 for three, 12 for four, up to 40 |
| Low stack | 20 | at the buzzer: 20 with the highest block in the bottom 4 rows, 0 at row 10 or above, a straight line between (`stdLine(20, 10 − height, 6)`); 0 after a top-out |

Any played run scores at least 1; no input 0.

## The core's target

The brief asked for the core to be full at the "near-flawless" median. Measured first at the near-perfect median (27
lines), near-perfect, elite and flawless all had a median of 200 (no gap at the top). Read as the **elite** level (the
band just below Flawless), the core is full at the elite median, **33 lines**, which keeps clear gaps at the top.

## Medians, weak → flawless (`bun scripts/new-arcade-bands.ts blockfall`, deal seeds for room seeds 0–59, server replay)

| Level | Score, median (p10–p90) | Lines | Lines part | Multi | Low |
| --- | --- | ---: | ---: | ---: | ---: |
| Weak | 21 (8–50) | 5 | 21 | 0 | 0 |
| Average | 40 (25–70) | 8 | 33 | 4 | 0 |
| Good | 91 (71–104) | 16 | 67 | 4 | 20 |
| Great | 137 (106–145) | 22 | 93 | 24 | 20 |
| Near-perfect | 174 (134–183) | 27 | 114 | 40 | 20 |
| Elite | 200 (191–200) | **33** | 140 | 40 | 20 |
| Flawless | 200 | 53 | 140 | 40 | 20 |

Fresh room seeds (10000–10059): 24 / 48 / 92 / 137 / 174 / 195 / 200.

The bots (`scripts/arcade-skill-bands/bots/blockfall.ts`) think a base 1.1 s a piece (the level's think scale), then
make the phone's gestures, each with its own hand time (taps about 200 ms, the drag 230 ms, the flick 180 ms; only
part of it shrinks with skill), pick among the planner's best few landings blurred by the level's judgement, and slip
a column now and then. Weak and average players play flat and never hold; good players hold; great and better keep a
well for fours and play the last 10 s low.

## Checks

blockfall-check (~3 s): the bags, the rules (moves, kicks, drop, hold once, gravity steps, lock wait, clears,
top-out, the buzzer), replay determinism and tampering, the deal's proof, the bands rising and the help.
arcade-standard-check's entry (`scripts/arcade-standard/blockfall.ts`), arcade-self-replay-check's entry, the replay
fixture (`scripts/fixtures/replay-runs.json`, one run appended). The intro demo is on the later list (the intro shows
its still).
