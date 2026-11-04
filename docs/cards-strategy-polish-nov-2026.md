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

See the sections below (Ball Tracker, Gemstone, Coral Pop display only; Tilt and Rainbow Bridge on new stamps).
