# Blockzone: blockfallRev 2 (3 Nov 2026)

Blockfall is shown as **Blockzone** since 3 Nov 2026 (`gameNames.ts`; the id stays `blockfall`). Rooms and practice
deal `blockfallRev` 2; a blockfallRev 1 round (below) replays and scores exactly as before (moon-blockzone-check replays
12 runs recorded on main; blockfall-check keeps proving rev 1's rules and deal).

## What changed (Joe's brief)

- **90 s** (`BF_ZONE_RUN_TICKS`; the definition's clock 93 s, `BLOCKFALL_TIME_MS`, Gemstone's precedent: older 60 s
  rounds still end at 60 s). Gravity a step faster every 15 s over six steps, a row every 48, 42, 36, 31, 27, then 24
  ticks (`BF_ZONE_GRAVITY`: gentler than rev 1's 48 → 16, so slower players don't top out half way).
- **No hold** and **no pads**: the hold input is outside the stamp's input ranges (the server flags and drops it) and
  does nothing in the sim; the HOLD, TURN and DROP pads are gone.
- **Gestures only on a phone:** drag sideways to move (a column per 34 world px), tap to turn, drag down for the soft
  drop (input k6, a 1 while the finger drags down, 0 when it lifts or turns back: the piece falls a row every 2 ticks),
  flick down to hard-drop. **Computer:** ← → move, ↑ turns (Z the other way), ↓ soft-drops while held, Space drops.
- **Lock delay:** a piece that touches down locks after 30 ticks (0.5 s); a move or turn that succeeds while it rests
  starts the wait again, at most 10 times a piece (`BF_ZONE_LOCK_RESETS`; rev 1 counted resets in the air too, up to 15).
  A hard drop still locks at once.
- **A bigger board:** the freed space under the well goes to the well: 34 px squares (340 × 680, was 29 px), the next
  three and the speed in a column on its right, the HUD chips LINES, PIECES and MULTI across the top (`bfLayout`).
- **The look (both revisions, display only):** bevelled blocks (a lit top-left edge, a shaded bottom-right edge, a
  neon rim and an inner highlight), a softly glowing well edge over a faint grid, a clearer ghost (a faint tint inside
  the piece's solid rim, hidden once the piece is on it) and a short white-cyan line-clear flash (12 ticks). Our own
  colours in Retro's cyan family; no borrowed name, word or music.

## Parts (200 in all)

| Part | Max | How it pays |
| --- | ---: | --- |
| Lines (core) | 95 | `stdLine(95, lines, 51)`: a straight line, full at **51** lines |
| Pieces placed | 65 | 1 for every piece placed, up to 65 |
| Multi-line clears | 24 | 4 for two lines at once, 8 for three, 12 for four, up to 24 |
| Low stack | 16 | at the buzzer: 16 with the highest block in the bottom 4 rows, 0 at row 10 or above, a straight line between; 0 after a top-out |

Any played run scores at least 1; no input 0. **Why a pieces part:** on 90 s the lines alone spread the levels far
wider than the targets (weak 6 lines, average 14, elite 50: a straight line on lines can't give weak 30–60 and elite
185–195 at once), and slower players top out; pieces placed (a fixed 1 each, capped) is what a steady player earns
whether or not rows clear, so the bottom of the scale lifts without touching the top. The core's full mark (51 lines)
sits just above the elite median (50) so elite stays under 200 and flawless alone reaches it.

## The deal and the proof of 200

`bun scripts/blockfall-deal.ts --rev=2` builds `src/lib/duel/blockfallDealV2.server.ts`: 300 seeds from the same seed
list, each one the oracle (`scripts/blockfall-oracle.ts`, `rev` 2: no hold, a look one piece ahead, a well for fours
until the multi part is full, then flat play and the last 20 s kept low) takes to exactly 200 through the server
replay (18 dropped). Rooms deal `BLOCKFALL_DEAL_V2[room seed % 300]`. moon-blockzone-check re-proves 24 seeds (all 300
and the file byte for byte with `CHECKS_FULL=1`); arcade-standard-check's entry plays four.

## Medians, weak → flawless, before → after (fresh seeds 10000–10059, the server replay)

| Level | blockfallRev 1 (60 s) | blockfallRev 2 (Blockzone, 90 s) | Target | Lines | Lines part | Pieces | Multi | Low |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| Weak | 24 | **58** (42–73) | 30–60 | 6 | 11 | 43 | 0 | 0 |
| Average | 48 | **91** (68–108) | ~90 | 14 | 26 | 58 | 4 | 0 |
| Good | 92 | **123** (102–143) | 120–140 | 24 | 44 | 65 | 12 | 2 |
| Great | 137 | **148** (125–170) | ~160 | 30 | 55 | 65 | 24 | 5 |
| Near-perfect | 174 | **175** (154–188) | ~175 | 42 | 78 | 65 | 24 | 8 |
| Elite | 195 | **195** (172–200) | 185–195 | 50 | 93 | 65 | 24 | 13 |
| Flawless | 200 | **200** | 200 | 83 | 95 | 65 | 24 | 16 |

Room seeds 0–59: 59 / 88 / 117 / 147 / 171 / 190 / 200. Great sits a little under "about 160" (148): the parts that
would lift it (the multi part) are already full at great, and raising the core's line would push near-perfect and
elite past their targets; left for Joe's call with beta data.

The bots are the skill-band bots (`scripts/arcade-skill-bands/bots/blockfall.ts`), unchanged but for no hold on
blockfallRev 2; flawless is the oracle. `bun scripts/new-arcade-bands.ts blockfall --from=10000` measures it.

## Sounds

Slots `blockfall.move` (new), `.turn`, `.lock`, `.clear`, `.bigClear`, `.topOut` and `music_blockfall`; `blockfall.hold`
removed. Each plays a library sound until Joe's file is set (`docs/sound-cues/moon-climb-blockzone.md`).

## Checks

moon-blockzone-check (~25 s: the legacy runs, the rules, the deal, the bands, names and help), blockfall-check (rev 1),
arcade-standard-check's entry (`scripts/arcade-standard/blockfall.ts`, rev 2), arcade-self-replay-check's entry
`blockfall/zone` (appended), the replay fixture (one blockfallRev 2 run appended to `scripts/fixtures/replay-runs.json`).

---

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
