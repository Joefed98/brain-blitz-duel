# Cards & Board and Strategy polish (3–4 Nov 2026)

From Joe's audit (iPhone 11, 414×896; also checked at 375×667). Screenshots: `screenshots/cards-strategy-nov-2026/`
(`<game>-414x896-before.jpg` / `-after.jpg`, `375x667` for Free Cell, Five Hands and Ball Tracker, and
`court-cards.png`, drawn by `bun scripts/shots/court-cards-sheet.ts`). Review shots:
`bun scripts/shots/cards-strategy-shots.ts --url=<origin> --tag=before|after [games…]`.

## Shared

- **HUD pill chips** (`src/lib/arcade/hudPill.renderer.ts`: `drawHudPill`, `drawHudPillRow`): a dark rounded pill
  with a quiet label and a bold value in Archivo, the main count top left, at most two rows, at most one "·" a line.
  The Cards & Board games on the felt keep `drawChip` (cards.renderer.ts), the same shape.
- **Court cards** (`drawCourtPortrait` in `src/lib/arcade/cards/cards.renderer.ts`): one shared set for every card
  game, our own flat drawings: a framed double-ended half figure, the robe in the suit's colour (deep red or deep
  navy) with a gold collar and placket, the panel a pale tint, a small suit in each half's free corner. K: five-point
  gold crown, beard, sword; Q: tiara with a centre jewel, long hair, rose; J: soft cap with a gold band and plume,
  short hair, halberd. Large faces put the panel between the corner indexes; small faces (under 56 wide) put it
  between the two index strips, so the large index still reads in an overlapped column. The four tiles that show a
  court card (Five Hands, Thirteen, Golf Solitaire, Full House) were re-exported; the reveal palette is unchanged.

## Cards & Board (display only, no stamps: the sims take piles, places, rows and squares, never points)

1. **Free Cell**: one top row of eight outlined places on the columns' grid, the four free cells left (light frames)
   and the four home piles right (gold frames, faint suits); cards 48 × 76 (were 48 × 68) stepping up to 70 down (were
   40), so the columns run down the table; the "FREE CELL" watermark is gone. Taps and drags follow the new layout
   (`fcHit`, `fcDropPile`); auto moves fly to the new home places. A 40-card deal (freecellRev 4) still starts with
   five cards a column, so the lower table fills as columns grow: the cards can't be wider with eight columns on the
   world's 414 width.
2. **Five Hands**: the discards in one compact row of up to twenty 34 × 48 cards ("Taken 13"); rows 84 tall (were 80);
   an empty or handless row's badge says "No hand" faintly (was "—"); when it is time to pick (fiveHandsRev 3), every
   column is outlined, washed gold and tagged "TAP".
3. **Mahjong Solitaire**: the world 356 wide (was 390), so the stack scales up into the space below it; blocked tiles
   dimmed to 0.46 (were 0.24), so free ones stand out; HUD "Pairs 0/36 · Moves 12 · Shuffles 0" as pills (was
   "SHUF"); the button already reads "Shuffle −5".
4. **Minefield**: the world 380 wide with an 8 px frame and 8 px under it (was 390, 12, 18), so the board grows to
   the screen's edges; pills "Safe · Mines · Hits". The board is ten squares wide and now edge to edge, so the gap
   above Reveal / Flag shrinks but can't close without a taller board (a new stamp; not done).
5. **Summit**: "Run 0 (best 2)" as one chip (gold from a run of five); the row of ten flames is gone.
6. **Thirteen**: the rules line is gone from the table ("One pass" is now in the intro's How to play, not just the
   help); the "13 / TAP TWO" label is gone; "Need 4" shows between the piles only while a card is selected.

## Strategy

8. **Ball Tracker** (display only): turnable tubes raised gold (gold bed, bright lip, deeper shadow), the fixed track
   plain wood; a 36 px pill strip above the arena (`btDrawHud`: Home n/36, Gold / Wrong, Combo ×n from 2, Switch up
   Ns) replaces the near-invisible status line under the board (the arena slot keeps its height).
9. **Gemstone** (display only, matchupRev 12): "Score n" on the 0–200 scale from the sim's own standard parts
   (`matchupStdScore`) and "Goals n/6" in place of the raw "pts" counter; the gem row above the board is the next
   drop into each column, labelled "Next drops ↓"; the goals panel's top line as pills (Ice, Treasure n/6, Big
   lines); everything under the HUD drawn 5.5 % larger (`SIX_ZOOM`, taps through `matchupCellAtShown`).
10. **Rainbow Bridge** (`inkRev 14`, `docs/arcade-standard/inkbridge.md` "inkRev 14"): coin radius 10 (was 7),
    clovers 12 (9), birds 10 px thick (6.5), every level built and proved at those sizes; parts unchanged (levels 120 +
    ink par 30 + trick shots 20 + clovers 10 + speed 20); dealt from `inkBigDeal.server.ts` (100 seeds, the oracle at
    200 through the server replay, none dropped). Pills "Level 1 / 10", "Ink 18 · par 54", "Left" (every revision);
    Drop again shows only while a drop is under way (a failed drop resets the level and the button does nothing
    outside a drop, so "after a failed drop" would be a dead button).
11. **Tilt** (`tiltRev 12`, `docs/arcade-standard/tilt.md` "tiltRev 12"): marbles 41 % of a cell (45 % in maze 4; were
    28 % / 34 %), key reach 45 % of a cell (was a third), cups drawn 160 % of the marble; mazes, pars and parts
    unchanged (core 140 + par 24 + clean 12 + speed 24); dealt from `tiltDealV12.server.ts` (347 of the 389 bank seeds,
    each replayed to exactly 200 by the oracle; 42 dropped); walnut and brass in place of the light wood; pills "Maze
    1 / 4", "Par 13 s" counting down, "Clean"; "Over par" only once the par has passed (`tiltOverParT`: the old HUD
    showed it on the tick exactly at par, which still meets it).
12. **Coral Pop** (display only): pills "Popped n", "Treasure n/6" and a gold "Combo ×n" while a streak runs.

### Medians weak → near → elite → flawless, before → after

| Game | weak | average | good | great | near | elite | flawless |
|---|---|---|---|---|---|---|---|
| Tilt 11 (bank seeds) → 12 (deal seeds) | 53.5 → 43 | 87 → 89 | 135 → 130 | 139.5 → 161 | 183.5 → 181.5 | 185 → 185.5 | 194 → 189 |
| Rainbow Bridge 13 → 14 (fresh seeds) | 56 → 59 | 88 → 83 | 119 → 122 | 162 → 159 | 181 → 183 | 195 → 193 | 200 → 200 |

Tilt's flawless bot stays under 200 (189; it was 194 on tiltRev 11): the oracle reaches 200 on every dealt seed, but
the band tool's flawless level misses a par now and then. Retunes of the par and speed parts moved elite and flawless
together (at best 192 / 193.5) without separating them, so the parts were kept. Rainbow Bridge's near-perfect sits a
little over "about 175", as on inkRev 13.

Not done: the five intro demos stay as they were (Tilt and Rainbow Bridge stopped until recorded on their new
stamps); Tilt's tile still shows light wood (its scene draws its own still, unchanged by the stamp).
