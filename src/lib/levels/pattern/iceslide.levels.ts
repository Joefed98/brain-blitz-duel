/**
 * Skid's levels beyond Normal (the Pattern overhaul, stage 3, 16 Nov 2026; docs/design/difficulty/README.md). Plain
 * data only: the phone reads it to draw the level selector, the server's deal (depth4/deal.server.ts, through the level
 * banks in iceSlideLevelBank.server.ts) reads the settings. Normal has no entry: today's game exactly (12 × 12, the
 * fewest slides 18–26, every hazard, 90 s, slideRev 5, dealt from the 1,000-board bank).
 *
 * Each level deals from its own seeded bank, rebuilt byte for byte by `bun scripts/iceslide-levels-bank.ts [--check]`;
 * every board in it is proved by breadth-first search over (ball square, broken thin ice): the stored fewest slides is
 * the board's minimum and inside the level's band, and the stored route reaches the exit in exactly that many. Skid
 * takes any route to the exit, so there is no single answer to prove (`open`); the par a level board is graded against
 * is that proved minimum, as on Normal.
 */
import type { GameLevels } from "../gameLevels";

export type IceSlideLevelSettings = {
  /** Board width in squares (never more than Normal's 12 across: a 375 px phone keeps its squares). */
  cols: number;
  /** Board height in squares (Expert grows downwards instead of wider). */
  rows: number;
  /** The fewest slides a board needs, [lowest, highest]: the BFS-proved minimum must land in it (the par). */
  minMoves: [number, number];
  /** Rock blocks the ball stops against, [lowest, highest]. */
  walls: [number, number];
  /** Holes (drop the ball back on the start), [lowest, highest]. */
  holes: [number, number];
  /** One-way chevrons, [lowest, highest]. */
  arrows: [number, number];
  /** Portal pairs, [lowest, highest]. */
  portals: [number, number];
  /** Thin-ice squares (break after one crossing), [lowest, highest]. */
  thin: [number, number];
  /** The shortest route must go through a portal and over thin ice (Normal's rule), so every hazard is in play. */
  routeUsesHazards: boolean;
  /** The round's clock (ms). */
  timeLimitMs: number;
  /** Speed points are full when the board is finished within this many seconds (Normal: 30). */
  fullByS: number;
  /** Boards in the level's bank. */
  bank: number;
  /** Keep only boards the elite person-like player (scripts/iceslide-human.ts) finishes inside the clock (D4: Expert). */
  personSolvable?: boolean;
};

const OPEN = { open: "any route to the exit counts; the minimum is proved by BFS" };

export const LEVELS_ICESLIDE: GameLevels<IceSlideLevelSettings> = {
  levels: {
    // Easy: an 8 × 8 rink (squares about 44 px on a 375 px phone), 8–12 slides, no holes or thin ice (so no fall and
    // nothing breaks); a chevron and a portal pair at most; 90 s, speed full by 20 s.
    // D4 (22 Nov 2026; the spec's Skid row): the lever is what is on the ice. Easy: rocks only (no holes, thin ice,
    // chevrons or portals) and 6–10 slides.
    easy: {
      settings: { cols: 8, rows: 8, minMoves: [6, 10], walls: [12, 20], holes: [0, 0], arrows: [0, 0], portals: [0, 0], thin: [0, 0], routeUsesHazards: false, timeLimitMs: 90_000, fullByS: 20, bank: 300 },
      oneSolution: OPEN,
    },
    // Hard: Normal's 12 × 12 with more holes (5–8, Normal 2–4) and a longer route (24–30 slides); every hazard, the
    // route through a portal and over thin ice; 100 s (Joe asked 90: at 90 s Hard scored below Expert for every bot, see
    // the report), speed full by 40 s.
    hard: {
      // D4: twice Normal's holes (6–8) and more thin ice (4–6).
      settings: { cols: 12, rows: 12, minMoves: [24, 30], walls: [30, 44], holes: [6, 8], arrows: [1, 3], portals: [1, 2], thin: [4, 6], routeUsesHazards: true, timeLimitMs: 100_000, fullByS: 41, bank: 300 },
      oneSolution: OPEN,
    },
    // Expert: 11 across × 13 down (143 squares, Normal's 144 less one; Joe, 16 Nov 2026: 12 × 14's 25.9 px squares at
    // 375 × 667 were too small to read the ice, holes and portals). The rink grows downwards and narrower: on a 375 × 667
    // phone the height above the pad holds 13 rows at Hard's square size (28.1 px, Hard 27.4; 31.5 px at 390 × 844, Hard
    // 28.7), where a 14th row would shrink every square to 25.9 px again. 28–36 slides, every hazard at Normal's density
    // (rocks 30–43), the route through a portal and over thin ice; 120 s, speed full by 45 s.
    expert: {
      // D4: a longer route (34–42 slides) through 10–12 holes (today's Expert had fewer than Hard), 6–8 thin ice, 2–4
      // chevrons and two portal pairs, on 100 s; the bank keeps only boards the elite person-like player
      // (scripts/iceslide-human.ts) finishes inside the clock.
      settings: { cols: 11, rows: 13, minMoves: [34, 42], walls: [30, 43], holes: [10, 12], arrows: [2, 4], portals: [2, 2], thin: [6, 8], routeUsesHazards: true, timeLimitMs: 100_000, fullByS: 50, bank: 300, personSolvable: true },
      oneSolution: OPEN,
    },
  },
};
