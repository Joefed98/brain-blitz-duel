# Minesweeper on the arcade scoring standard (minesRev 1, 30 Oct 2026)

Shown as **Minefield** since 31 Oct 2026 (`gameNames.ts`; the id `minesweeper` and every stamp unchanged).

Arcade, **Cards & Board** group (`src/lib/duel/arcadeGroups.ts`; its tiles take the group's `--group-cards` border). Dealt in rooms from the start. A 90 s run on a
93 s clock.

## The game

- A 10 × 16 board with 25 mines (135 safe squares). The board is dealt **in the sim** from the room seed
  (`minesBoard` in `src/lib/arcade/minesweeper.ts`): a seeded start square in the middle six rows and columns, no mine
  on it or its eight neighbours (so the opening is a cascade, revealed for you), and 25 mines placed from the seed, try
  after try, until the logic solver (`minesSolve`) clears every safe square from the opening. The solver never guesses:
  a single number (all its mines found → the rest are safe; as many hidden as mines left → all mines), two overlapping
  numbers (the difference of their mines left equals the hidden squares only one sees → those are mines, the other's
  own squares safe), and the mine total. So every board is solvable by logic alone (no 50/50s). A deal is also
  dealt again unless its opening reveals 20–60 squares (left free, openings ran from 9 to 96 squares, so rooms would
  have felt very different); the median opening is 42. A board takes about 1 ms to deal; the most tries any of the
  1,760 checked seeds needed is 17 of 600.
- Everyone in a room plays the identical board; nothing random happens after the deal.
- Input (one event a tick, kind 1): `a` the square, `b` 0 reveal or 1 flag. On the phone: tap reveals (or flags, with
  the switch on Flag); the **Reveal / Flag switch** sits at the bottom within thumb reach; a **long press** (380 ms)
  flags whatever the switch says. Tapping a revealed number whose flags (and mines already hit) are all placed reveals
  its other hidden neighbours (a chord, in either mode). A flag protects its square from a reveal tap. Desktop: click,
  and F toggles the switch.
- A mine hit costs 5, the mine is marked (red square) and play goes on. The run ends when every safe square is open or
  the 90 s are up; at the buzzer the hidden mines show faintly.

## Parts (200 in all)

| Part | Max | How it pays |
| --- | ---: | --- |
| Safe squares (core) | 150 | `stdLine(150, revealed beyond the opening, safe squares beyond the opening)`: a straight line, full at all of them |
| No mines hit | 20 | the same share of 20, only while no mine has been hit |
| Speed | 30 | board cleared only: `stdSpeed(30, clear tick, 50 s, 90 s)`, full by 50 s, 0 at the buzzer |

A mine hit costs 5 (`MINES_HIT_COST`). Score = `stdFinal(core + clean + speed − 5 × hits, acted)`: 0 with no input,
else held to 1…200. The help (`liveStdHelp`) lists every part with its maximum and ends "Together 200 points.".

### Assumptions (decisions for Joe)

- **The opening doesn't count.** "Share of safe squares revealed" is read as the squares *you* reveal: the opening is
  free (20–60 of the 135, median 42), so it would otherwise give every player who taps once a third of the core.
- **No mines hit pays on the core's line** (20 × the same share), not a flat 20, so one tap and quitting can't take it.
  It is a fixed share of a cap, like High Rise's perfect drops.
- **Full by 50 s**, not "about 45 s": the near-perfect skill-band median clear time on the tuning seeds is 49.7 s
  (fresh seeds 49.5 s).
- **The opening is held to 20–60 squares** (a deal outside is dealt again): not in the brief; it keeps rooms alike.

## Proof that every dealt seed reaches 200

The deal is its own proof: the solver's order (each step's first square, one tap a tick: `minesOracle` in
`scripts/cards-board-oracles.ts`) clears the board with no hit in well under 50 s. The room generator
(`generateMinesweeper`) deals only seeds whose own tries found a board (a seed whose 600 tries all failed would fall
back to `MINES_FALLBACK_SEED`'s board; it is dropped instead, and none of the checked seeds needed it).
cards-board-check replays the oracle through the server (`replayMinesweeperRun`) to exactly 200 on the 60 tuning and
200 fresh seeds and proves solvability on 1,500 more (3,000 with `--full`); arcade-standard-check replays it on 40.

## Skill bands (`bun scripts/cards-board-bands.ts`, the bots in `scripts/arcade-skill-bands/bots/minesweeper.ts`)

The bots read only what the screen shows (numbers, their flags, mines hit), find single-number deductions after a short
scan and pair deductions after a longer one (weaker players often miss them and guess after a few fruitless looks),
chord by skill, and slip onto a neighbouring square now and then. Every run goes through the server's replay.

Tuning seeds 0–59 (median, p10–p90; cleared runs; their median clear time):

| Level | Score | Cleared | Clear time | Core / clean / speed / cost |
| --- | --- | ---: | --- | --- |
| Weak | 115 (73–150) | 0/60 | — | 111 / 12 / 0 / 0 |
| Average | 140.5 (111–166) | 3/60 | 86.3 s | 136 / 16 / 0 / 0 |
| Good | 173.5 (138–185) | 41/60 | 78.5 s | 150 / 20 / 4 / 0 |
| Great | 190.5 (182–197) | 58/60 | 61.5 s | 150 / 20 / 20.5 / 0 |
| Near-perfect | 200 (195–200) | 59/60 | **49.7 s** | 150 / 20 / 30 / 0 |
| Elite | 200 (200–200) | 59/60 | 43.2 s | 150 / 20 / 30 / 0 |
| Flawless | 200 (200–200) | 60/60 | 28.3 s | 150 / 20 / 30 / 0 |

Fresh seeds 10000–10099: weak 104 (74–144), average 135.5, good 171, great 189, near-perfect 200 (clear 49.5 s),
elite 200, flawless 200. Medians rise level by level; the top three meet at 200 because the full-by time is the
near-perfect median clear time (the p10s still separate them: 195 / 200 / 200).

## Look

A slate board in a dark metal frame with four corner screws over a faint hexagon background; covered squares bevelled
(light top and left, shadow bottom and right), revealed squares recessed; numbers 1–8 in distinct colours with a soft
glow; red pennant flags; a gold ripple on the last square revealed (a wide one when the board clears); a hit flashes
white. HUD chips across the top (MINES left, SAFE n/135, HITS); no instruction text at the bottom. The board is painted
into a device layer keyed on the squares (`deviceLayer`), so a frame is one blit plus the effects. Tile icon:
`public/tiles/minesweeper.webp` (bevelled squares, a flag and a mine on the hex background).

## Checks

cards-board-check (the deal, solvability, the oracle's 200s, the rules, the deal digest), arcade-standard-check (entry
`scripts/arcade-standard/minesweeper.ts`), arcade-room-identity-check (`scripts/room-identity/minesweeper.ts`: the deal
is the same whatever is tapped), arcade-self-replay-check (entry `minesweeper`), replay-check (a great-bot run in
`replay-runs.json`), arcade-fx-check, tile-scenes-check, round-max-check, category-pool-check. The intro shows a still
(no demo recorded).
