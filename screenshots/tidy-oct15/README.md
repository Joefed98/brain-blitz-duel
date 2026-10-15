# Tidy-up after the 14 Oct batch (15 Oct 2026)

These are before/after contact sheets from `scripts/shots/capture.ts`. "Before" is `main` at 7819fa0, run from a git worktree; "after" is this branch. Both ran at 375×667 and 390×844, in practice mode, on the same seeded intro example. The sheets are at half scale.

- `<game>-<size>.jpg`: one sheet for each Speed & Attention game (their CSS moved into the new `src/polish-speed/` files), with the intro, mid-play and reveal.
- `balance-<size>.jpg`: Counterweight's completion effect 450 ms after the solve. Before, it drew three level beams on a balanceRev 2 round. After, it draws four. Older rounds keep three.
- `arcade-fixes-375x667-after.jpg`: the tuning-backlog items, checked on this branch. These were already fixed on main by #54:
  - Orbit's SET CHECKPOINT button sits 28 px up from its row's bottom.
  - Tilt's arena drops 40 px, with no arena fill below it.
  - Wavefront's play frame.
  - The Mixed Signals reveal, drawn with its play art.

## Pixel comparison (all intro, mid-play and reveal frames, both sizes)

A pixel counts as different when a channel differs by more than 16 levels.

| Category | Frames | Identical | Under threshold | Over threshold | Largest diff |
|---|---|---|---|---|---|
| Speed | 36 | 15 | 13 | 8 | 2,034 px |
| Attention | 36 | 11 | 14 | 11 | 2,378 px |
| Number | 54 | 14 | 16 | 24 | 3,808 px |
| Logic | 66 | 24 | 21 | 21 | 151 px |
| Pattern | 54 | 10 | 19 | 25 | 8,226 px |

The frames over the threshold were checked by eye, with before, after and a diff mask side by side, the largest frames in each category included. In every one checked, the diff is something that moves or counts with time. Examples:

- the Bang On marker, a Pull! clay in flight, a Bonk mole
- the Mixed Signals falling word, the pulsing Double Take rings, the Labyrinth exit star
- Tenfall's confetti and falling tile, the Checkout dartboard ring
- the Pipeline water ripple, the Skid portal swirls
- clock digits and solve times

In the frames checked, no element moved, resized or changed colour.
