# Free Cell (`freecell`) on the arcade scoring standard (freecellRev 2, 31 Oct 2026; rev 1 30 Oct 2026)

Shown as **Free Cell** since 31 Oct 2026 (was FreeCell; the id stays `freecell`).

## freecellRev 2 (31 Oct 2026): Undo, Reset and the refused move's note

- **Undo** (input kind 3, the ↶ button in the HUD row left of HOME): back to the position before the last move (or the
  last Reset). Unlimited. Each undo counts as a move for par (the move undone still counts too); the clock runs on.
- **Reset** (kind 4, the ⟲ button right of HOME): back to the deal. It counts as one move, the clock runs on, and it can
  be undone (the position reset from goes on the undo stack). A reset on the deal itself does nothing.
- An Undo with nothing to undo, or a Reset on the deal, is not a move and not a refusal.
- A move refused for want of free cells or empty columns shows a short toast under the free cells for 1.6 s:
  "Need a free cell to move 2 cards" (or "Need 2 free cells to move 3 cards"; `fcCapacityShort`, `fcNoteText`). A tap
  asks of every column the run could build on (or an empty one); a drag of the column named. Display only (state fields
  `note`, `noteNeed`, `noteCells`, `noteTick`, outside the checksum).
- Undo and Reset are in the move log, so the server's replay matches (`freecellGameV2`, its own input ranges; the
  checkpoint adds the undo stack's depth). Rev-1 runs replay on `freecellGameV1` exactly as before: 24 rev-1 runs recorded
  on main replay to the same score and final state (cards-check, `scripts/fixtures/cards-rev1-legacy.json`), and a rev-1
  log's Undo is not an input.
- Scoring is rev 1's parts unchanged (core 140, par 30, speed 30). Every bank deal's par line reaches 200 on rev 2.

Re-measured on rev 2 (`bun scripts/cards-bands.ts freecell --seeds=100`; the bots never undo): speed stays full by
**66 s** (near-perfect median finish 66.2 s).

| Level | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| score, median (p10–p90) | 21 (8–41) | 37 (17–63) | 63 (13–170) | 170 (75–191) | 188 (173–197) | 194 (189–198) | 200 |
| finished | 0/100 | 0/100 | 18/100 | 83/100 | 95/100 | 97/100 | 100/100 |
| finish, median | — | — | 112.7 s | 94.2 s | 66.2 s | 51.4 s | 26.4 s |

# Rev 1 (30 Oct 2026)


A new Arcade game in the Cards & Board group, born on the standard: `freecell`, 120 s run (123 s round clock).

## The stamp and the deal

`freecellRev 1` (`FC_REV`, spec `FC_STD_SPEC`, parts `freecellStdParts`, `src/lib/arcade/cards/freecell.ts`). Rooms deal
a bank index (`generateFreecell`, the room's seeded draw over `FC_DEALS.length`), so every player gets the same deal and
par; nothing random happens after the deal. The bank (`freecellDeals.data.ts`, 300 deals) is built by
`bun scripts/freecell-bank.ts`: deal seeds 1, 2, 3, … dealt round-robin into eight columns by the engine's seeded
shuffle, each solved by weighted A* over the sim's own rules (`scripts/cards/freecellSolver.ts`, weights 4 → 1, 150,000
nodes each) with the shortest line found kept as par (29–60 moves, median 42; no seed had to be dropped). The lines
are `scripts/fixtures/freecell-solutions.json` (checks and bots only, never shipped). `--check` rebuilds both byte for
byte (cards-check runs it at full depth). Par is the fewest moves the solver found, not a proven minimum.

## Rules

Eight columns build down in alternating colours; four free cells hold one card each; home piles build up by suit from
the Ace. A move is one input: a tap (kind 1: pile, index) moves the card and the run on it to its best legal spot (home
for a single card that can go; a column it builds on, the next columns round from its own; an empty column, never a
whole column; a free cell for a single card); a drag (kind 2: pile, index, destination) moves it to the pile named.
Multi-card moves carry up to (free cells + 1) × 2^(empty columns), one empty column fewer when moving into one. After
every move, and at the deal, safe cards go home by themselves (Aces and twos, and a card whose lower cards of the other
colour are home); they are not moves. A tap that can do nothing is refused (counted, no cost).

## Layout (30 Oct 2026 legibility pass)

Free cells (top) and home piles (bottom, faint suit symbols) are the size of the column cards (48 × 68), so the
columns get the room: each column steps 40 px a card and compresses only when it would reach the home piles. Cards
narrower than pip size draw the large index (rank and suit side by side across the top strip, and mirrored at the
bottom), so an overlapped card reads at a glance.

## Parts (200 in all)

| Part | Max | How it pays |
| --- | ---: | --- |
| Cards (core) | 140 | `stdLine(140, 2 × home + sorted, 104)`: two units a card home, one a card in a sorted run (a column's run from its base card up, two cards or more); full with all 52 home |
| Par moves | 30 | finished only: `stdSpeed(30, moves, par, 2 × par)`, full at par, 0 at twice par |
| Speed | 30 | finished only: `stdSpeed(30, finish tick, 66 s, 120 s)`, full by 66 s, 0 at the buzzer |

Score = `stdScore(parts, acted)`: 0 with no input, else the sum held to 1…200.

## Measured

Speed's "full by" is the near-perfect bots' median finish: **66.1 s** on room seeds 0–59 (`bun scripts/cards-bands.ts
freecell`), set to 66 s. The brief's guide was about 75 s. The bots (`scripts/arcade-skill-bands/bots/freecell.ts`)
think about 3 s a move at the average level (× each level's think scale), slip into a move off their plan now and then
and plan again; weaker levels plan with a greedier, smaller search (longer plans). Flawless plays the bank's par line.

| Seeds | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0–59, median (p10–p90) | 22 (10–43) | 41 (17–63) | 63 (16–170) | 170 (95–191) | 188 (174–197) | 194 (189–198) | 200 |
| finished | 0/60 | 0/60 | 9/60 | 51/60 | 58/60 | 59/60 | 60/60 |
| finish median | — | — | 104.6 s | 94.2 s | 66.1 s | 50.0 s | 25.9 s |

Every bank deal reaches 200: cards-check replays all 300 par lines through the server's replay (a move every 20 ticks)
to exactly 200 with the bank's par.

## Assumptions

- No group map on main: FreeCell sits in the Arcade category; its tile keeps the Arcade border (the Cards & Board pink
  waits for the group map).
- "Cards in correct sorted runs" is read as each column's run from its base card up (two or more cards); a run stacked on
  an unsorted card does not count until the cards under it are sorted.
- Weak and average bots rarely finish in two minutes; FreeCell's core is what pays them.
