/**
 * pattern-logic-pictures-check (D4, 22 Nov 2026): the Pattern and Logic games' lever pictures
 * (src/lib/levels/pictures/pattern-logic.tsx), the small drawings of what each level changes.
 *
 *  1. LEVER_PICTURES holds one picture for each of the 22 Pattern and Logic games and no other; each draws one labelled
 *     svg at every level its game offers.
 *  2. Normal's numbers (NORMAL_NUMBERS, the only ones the level registry has no row for) are what Normal deals: 40
 *     Normal deals of each game as a room deals them, the board's size exactly, each fixed count exactly, and each
 *     "or more" count at most the fewest Normal dealt and within a little of it. So a picture can't drift from its game.
 *  3. A level's picture reads its own settings: its board size and its count are the level's (no level falls back to
 *     Normal's numbers while its settings name its own). A level whose picture is Normal's is printed as a NOTE.
 *
 * Fast (no browser): bun scripts/pattern-logic-pictures-check.tsx
 */
import { renderToStaticMarkup } from "react-dom/server";

import { minesGeoFor } from "../src/lib/arcade/minesweeper";
import { blockGeometry } from "../src/lib/duel/blockParty";
import { floodColoursOf, floodColsOf } from "../src/lib/duel/flood";
import { flowGrid } from "../src/lib/duel/flow";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { laserShotsOf } from "../src/lib/duel/laser";
import { withSeededRandom } from "../src/lib/duel/random";
import { safeShapeOf } from "../src/lib/duel/safe";
import { trSide } from "../src/lib/duel/trail";
import { tubesCapacity } from "../src/lib/duel/tubes";
import { SLIDE_COLS, UNBLOCK_COLS, type PuzzleType } from "../src/lib/duel/types";
import { gameLevelSettings, levelsOf } from "../src/lib/levels/gameLevels";
import type { Level } from "../src/lib/levels/levels";
import { LEVER_NUMBERS, LEVER_PICTURES, NORMAL_NUMBERS, type LeverNumbers } from "../src/lib/levels/pictures/pattern-logic";
import { LOGIC_GAMES, PATTERN_GAMES } from "./pattern-logic-human";

let passes = 0;
const failures: string[] = [];
const notes: string[] = [];
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else failures.push(message);
};

const GAMES: readonly string[] = [...PATTERN_GAMES, ...LOGIC_GAMES];
const DEALS = 40;

/* 1. One picture a game, one labelled svg at every level. */
{
  check(GAMES.length === 22, `22 Pattern and Logic games (${GAMES.length})`);
  check(JSON.stringify(Object.keys(LEVER_PICTURES).sort()) === JSON.stringify([...GAMES].sort()), `LEVER_PICTURES is exactly the 22 games (${Object.keys(LEVER_PICTURES).join(", ")})`);
  for (const game of GAMES) {
    const levels = levelsOf(game);
    check(levels.length === 4, `${game}: four levels (${levels.join(", ")})`);
    for (const level of levels) {
      const Picture = LEVER_PICTURES[game];
      if (!Picture) continue;
      const html = renderToStaticMarkup(<Picture level={level} size={64} />);
      check((html.match(/<svg /g) ?? []).length === 1 && html.includes("data-lever-picture") && /aria-label="[^"]{6,}"/.test(html), `${game} ${level}: not one labelled svg`);
      check(/width="64"/.test(html) && /<rect /.test(html), `${game} ${level}: the svg isn't 64 px or draws nothing`);
    }
  }
}

/* 2. Normal's numbers are what Normal deals. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const nonZero = (xs: readonly unknown[]) => xs.filter((x) => x !== 0 && x !== null && x !== undefined && x !== -1).length;
/** What one Normal deal shows, in the picture's terms. */
const DEALT: Record<string, (p: Any) => Record<string, number>> = {
  unblock: (p) => ({ cols: p.cols ?? UNBLOCK_COLS, cars: p.vehicles.length - 1 }),
  blockparty: (p) => ({ cols: blockGeometry(p).cols, pieces: blockGeometry(p).pieces.length, pegs: p.blockers.length }),
  pipes: (p) => ({ cols: Math.round(Math.sqrt(p.tiles.length)), rows: Math.round(Math.sqrt(p.tiles.length)) }),
  flow: (p) => ({ cols: flowGrid(p).cols, rows: flowGrid(p).rows, pairs: p.pairs.length }),
  iceslide: (p) => ({ cols: p.cols ?? SLIDE_COLS, rows: p.rows ?? SLIDE_COLS, holes: p.holes.length }),
  push: (p) => ({ crates: p.crates.length }),
  laser: (p) => ({ bombs: p.bombs.length, shots: laserShotsOf(p) }),
  gravity: (p) => ({ boards: p.boards.length, balls: p.boards[0].starts.length }),
  sudoku: (p) => ({ givens: nonZero(p.givens) }),
  tower: (p) => ({ pegs: p.start.length, discs: p.discs }),
  tubes: (p) => ({ flasks: p.tubes.length, capacity: tubesCapacity(p.tubes), colours: new Set(p.tubes.flat()).size }),
  safe: (p) => ({ dials: safeShapeOf(p).dials, tries: safeShapeOf(p).tries }),
  nonogram: (p) => ({ cols: p.cols.length, rows: p.rows.length }),
  flood: (p) => ({ cols: floodColsOf(p), rows: p.grid.length / floodColsOf(p), colours: floodColoursOf(p) }),
  minesweeper: (p) => ({ cols: minesGeoFor(p.minesRev).cols, rows: minesGeoFor(p.minesRev).rows, mines: minesGeoFor(p.minesRev).count }),
  tents: (p) => ({ rows: p.height, trees: p.trees.length }),
  shikaku: (p) => ({ rows: p.height, rects: p.clues.length }),
  lightup: (p) => ({ rows: p.height, walls: p.walls.length }),
  trail: (p) => ({ size: trSide(p.givens.length), givens: nonZero(p.givens) }),
  fences: (p) => ({ size: p.size, clues: p.clues.filter((c: unknown) => c !== null && c !== -1).length }),
  fillomino: (p) => ({ size: p.size, givens: nonZero(p.givens) }),
  bridges: (p) => ({ size: p.size, islands: p.islands.length }),
};
/** NORMAL_NUMBERS' "or more" counts: the fewest a level deals, drawn as the low end. The rest must match exactly. */
const AT_LEAST: Record<string, readonly string[]> = {
  unblock: ["cars"], flow: ["pairs"], iceslide: ["holes"], sudoku: ["givens"], tents: ["trees"], shikaku: ["rects"],
  lightup: ["walls"], fillomino: ["givens"], bridges: ["islands"], fences: ["clues"], trail: ["givens"],
};
/** Ranges the picture draws from both ends (Normal deals either). */
const RANGE: Record<string, Readonly<Record<string, readonly [string, string]>>> = {
  laser: { bombs: ["bombs", "maxBombs"] },
  tower: { pegs: ["pegs", "maxPegs"] },
};
{
  check(JSON.stringify(Object.keys(NORMAL_NUMBERS).sort()) === JSON.stringify([...GAMES].sort()), "NORMAL_NUMBERS has a row for each game");
  for (const game of GAMES) {
    const seen: Record<string, number[]> = {};
    for (let i = 0; i < DEALS; i++) {
      const p = withSeededRandom(0x5eed + i, () => generatePuzzle(game as PuzzleType, { bankSeed: 0x9e3779b1 + i * 7919 } as Any));
      for (const [k, v] of Object.entries(DEALT[game]!(p))) (seen[k] ??= []).push(v);
    }
    const normal = (NORMAL_NUMBERS as Record<string, Record<string, number>>)[game]!;
    for (const [k, values] of Object.entries(seen)) {
      const lo = Math.min(...values);
      const hi = Math.max(...values);
      const range = RANGE[game]?.[k];
      if (range) {
        check(normal[range[0]] === lo && normal[range[1]] === hi, `${game}: Normal's ${k} drawn ${normal[range[0]]}–${normal[range[1]]}, dealt ${lo}–${hi}`);
      } else if (AT_LEAST[game]?.includes(k)) {
        const v = normal[k]!;
        check(v <= lo && v >= lo - Math.max(2, Math.round(lo * 0.15)), `${game}: Normal's ${k} drawn "${v} or more", dealt ${lo}–${hi}`);
      } else if (k in normal) {
        check(lo === hi && normal[k] === lo, `${game}: Normal's ${k} drawn ${normal[k]}, dealt ${lo}–${hi}`);
      }
    }
    // The picture's own numbers at Normal are NORMAL_NUMBERS' (the fallback is read, not a second copy).
    const n = LEVER_NUMBERS[game]!("normal");
    const flat = JSON.stringify(n);
    for (const [k, v] of Object.entries(normal)) {
      if (k === "scrambled") continue;
      if (typeof v === "number" && ["cols", "rows", "size"].includes(k)) check(n.kind === "board" && (n.cols === v || n.rows === v), `${game}: the Normal picture's ${k} isn't ${v} (${flat})`);
    }
  }
}

/* 3. A level's picture reads its own settings. */
const SIZE_KEYS = ["cols", "rows", "size", "height"] as const;
{
  for (const game of GAMES) {
    const normal = JSON.stringify(LEVER_NUMBERS[game]!("normal"));
    for (const level of levelsOf(game).filter((l): l is Exclude<Level, "normal"> => l !== "normal")) {
      const n: LeverNumbers = LEVER_NUMBERS[game]!(level);
      const s = (gameLevelSettings<Any>(game, level) ?? {}) as Any;
      if (n.kind === "board") {
        for (const key of SIZE_KEYS) {
          const v = s[key];
          if (typeof v !== "number") continue;
          const drawn = key === "cols" ? n.cols : key === "rows" || key === "height" ? n.rows : n.cols;
          check(drawn === v || (key === "size" && n.rows === v), `${game} ${level}: settings' ${key} ${v}, picture ${n.cols} × ${n.rows}`);
        }
      }
      if (JSON.stringify(n) === normal) notes.push(`${game} ${level}: the picture is Normal's (its lever doesn't move at this level)`);
    }
  }
}

for (const n of notes) console.log(`NOTE ${n}`);
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`pattern-logic-pictures-check: ${passes} passed, ${failures.length} failed`);
  console.log("FAIL");
  process.exit(1);
}
console.log(`PASS pattern-logic-pictures-check: ${passes} checks (22 pictures, Normal's numbers as dealt, each level's own settings)`);
