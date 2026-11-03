# Free Cell (`freecell`) on the arcade scoring standard (freecellRev 4, 3 Nov 2026; rev 3 1 Nov 2026; rev 2 31 Oct 2026; rev 1 30 Oct 2026)

## freecellRev 4 (3 Nov 2026, Joe's Cards & Board batch: what rooms deal)

- **A smaller deal so a whole game fits the 2-minute round:** Ace to 10 in each suit (40 cards), eight columns of five,
  the same four free cells and four home piles. The deal is the same seeded shuffle as before with the Jacks, Queens and
  Kings taken out (`fcDealCols(seed, 4)`), dealt five to a column. Rev 3's play otherwise (Undo, Reset, the flying safe
  auto moves) and the same 120 s run.
- **Every deal proven solvable:** its own bank, `src/lib/arcade/cards/freecellDealsV4.data.ts` (300 deals, none left
  out), built by `bun scripts/freecell-bank.ts --rev=4` with the bank's solver; par is the shortest line found (13–36
  moves, median 25); the lines are `scripts/fixtures/freecell-solutions-v4.json` (checks and bots only).
  `--rev=4 --check` rebuilds both byte for byte (cards-check at full depth). cards-check replays all 300 par lines
  through the server's replay to all 40 home and exactly 200.
- **Re-fitted parts** (to the skill-band targets on room seeds 0–99 and fresh seeds 10000–10099): on 40 cards even
  average players often finish, so finishing well pays.

| Part | Max | How it pays |
| --- | ---: | --- |
| Cards (core) | 60 | `stdLine(60, 2 × home + sorted, 50)`: full at 50 units (25 of the 40 home) |
| Par moves | 50 | finished only: full at par, 0 at 1.5 × par (rev 3: 30, 0 at twice par) |
| Speed | 90 | finished only: full by 32 s, 0 at the buzzer (rev 3: 30, full by 66 s) |

Measured (`bun scripts/cards-bands.ts freecell --seeds=100`, room seeds 0–99; fresh 10000–10099 in brackets):

| Level | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rev 3 median (before) | 41 | 72 | 121 | 170 | 188 | 194 | 200 |
| **rev 4 median** | **43** (42) | **96** (85) | **134** (131) | **156** (152) | **176** (176) | **188** (185) | **200** (200) |
| rev 4 p10–p90 | 27–90 | 37–134 | 93–165 | 126–181 | 148–199 | 163–200 | 200 |
| finished | 16/100 | 73/100 | 99/100 | 100/100 | 100/100 | 100/100 | 100/100 |
| finish, median | 112.7 s | 94.5 s | 71.7 s | 52.7 s | 36.7 s | 27.9 s | 16.1 s |

Speed's "full by" (32 s) sits between the near-perfect (37 s) and elite (28 s) median finishes: chosen by the fit, not
one level's median. Rev 3 runs replay unchanged: 20 rev-3 runs recorded on main (`scripts/fixtures/cards-nov3-legacy.json`)
replay to the same score and final state (cards-check).


Shown as **Free Cell** since 31 Oct 2026 (was FreeCell; the id stays `freecell`).

## freecellRev 3 (1 Nov 2026, Joe's tuning: what rooms deal)

- **The same play and round length** as rev 2 (120 s run, Undo and Reset, the same bank deals and pars).
- **More scoring room:** the core (cards home two units each, cards in sorted runs one unit each) is full at
  **54 units** (`FC_CORE_UNITS_V3`, about 20 cards home and a dozen sorted) instead of all 52 home (104 units). 54 is the
  near-perfect bots' median core units **60 s into the run** (`bun scripts/cards-bands.ts freecell --seeds=100 --at=60`),
  before the final run of cards home.
  *Assumption (noted in the PR):* the brief asked for the core to be full "at the near-flawless median within the time".
  Read literally that is unchanged (the near-perfect median finishes, so its median at the buzzer is the full 104), so the
  figure is that level's median at the half-way mark, where its run is still building. Joe will measure on the phone.
- Par (30) and speed (30, full by 66 s) unchanged, finished runs only. Parts total 200; every bank deal's par line
  reaches 200 on rev 3 (cards-check).
- **Auto-move home:** the standard safe auto-move was already there on every revision (aces and twos, and a card whose
  lower cards of the other colour are home, after every move and at the deal; not counted as moves). On rev 3 the sim
  keeps each auto move's card and where it came from (`fly`, `flyTick`; display only, outside the checksum) and the art
  flies the cards home: each leaves 2 ticks after the one before and lands in 8 (`fcFlights`), the home pile showing the
  card under the first still in the air. Nothing flies once the run is over (the clock stops).
- Rev 2 runs replay unchanged: 16 rev-2 bot runs recorded on main (`scripts/fixtures/tuning-nov1-legacy.json`,
  `scripts/tuning-nov1-legacy-record.ts`) replay to the same score and final state (cards-check).

Measured (`bun scripts/cards-bands.ts freecell --seeds=100 --at=60`; the bots never undo):

| Level | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rev 2 median (p10–p90) | 21 (8–41) | 37 (17–63) | 63 (13–170) | 170 (75–191) | 188 (173–197) | 194 (189–198) | 200 |
| **rev 3 median (p10–p90)** | **41** (15–80) | **72** (33–121) | **121** (25–170) | **170** (140–191) | **188** (173–197) | **194** (189–198) | **200** |
| core units at 60 s | 10 | 14 | 21 | 32 | **54** | 104 | 104 |
| finished | 0/100 | 0/100 | 18/100 | 83/100 | 95/100 | 97/100 | 100/100 |

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
