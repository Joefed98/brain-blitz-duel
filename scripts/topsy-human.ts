/**
 * A person-like Topsy-Turvy solver (the difficulty levels, 16 Nov 2026): it never sees the stored route or any board's
 * exact fewest tilts. A person reads where each ball would go on its own ("the pink one drops if I tilt left, then
 * down") and imagines a few tilts ahead with every ball rolling, but cannot search the whole board. Modelled as:
 *
 *  - each ball's own distance home on the board with only the blocks (and the cups already filled), as if it were
 *    alone (a single ball's breadth-first search over at most 100 squares: what a person sees by tracing its line);
 *  - a look-ahead of LOOKAHEAD tilts with every ball rolling together (4^3 = 64 imagined boards at most), picking the
 *    tilt whose best line leaves the fewest of those single-ball tilts home added up (most balls home first), never
 *    a board already stood on (the person remembers where they have been);
 *  - stuck (every tilt goes somewhere already seen): Reset and try again from the start with that line remembered,
 *    at most RESETS times.
 *
 * A board counts as cleared when every ball is home within the board's tilt limit (its fewest + the level's spare;
 * Undo and Reset give the tilts back on gravityRev 8, so a reset starts the count again, as the phone does).
 *
 *   bun scripts/topsy-human.ts [--level=all|easy|normal|hard|expert] [--boards=240]
 *
 * Reports, per level, the share of boards the solver clears and its tilts against the fewest. Normal's boards are
 * drawn by the live generator (seeded); the other levels' are every entry of their bank.
 */
import { TOPSY_HOME, topsyCleared, topsyStart, topsyTilt, type TopsyBoard, type TopsyState } from "../src/lib/duel/topsy";
import { TOPSY_SIZE } from "../src/lib/duel/topsy";
import type { GravityDir, GravityPuzzleData } from "../src/lib/duel/types";

export const LOOKAHEAD = 3;
export const RESETS = 2;
const DIRS: GravityDir[] = ["U", "D", "L", "R"];
const keyOf = (s: TopsyState) => s.balls.join(",");

function step(cell: number, dir: GravityDir): number | null {
  const r = Math.floor(cell / TOPSY_SIZE);
  const c = cell % TOPSY_SIZE;
  if (dir === "U") return r > 0 ? cell - TOPSY_SIZE : null;
  if (dir === "D") return r < TOPSY_SIZE - 1 ? cell + TOPSY_SIZE : null;
  if (dir === "L") return c > 0 ? cell - 1 : null;
  return c < TOPSY_SIZE - 1 ? cell + 1 : null;
}

/** One ball alone: tilts from every square to its own cup (blocks and filled cups block it), 9 when it can't get home. */
function aloneDistances(board: TopsyBoard, ball: number, filled: ReadonlySet<number>): Int8Array {
  const block = (c: number) => board.walls.includes(c) || filled.has(c);
  const hole = board.holes[ball]!;
  const roll = (from: number, dir: GravityDir): number => {
    let at = from;
    for (;;) {
      const next = step(at, dir);
      if (next === null || block(next)) return at;
      at = next;
      if (at === hole) return -1;
    }
  };
  const dist = new Int8Array(TOPSY_SIZE * TOPSY_SIZE).fill(9);
  // Backward search is awkward with rolls; a forward search from every square is cheap (100 squares × 4 tilts).
  for (let start = 0; start < dist.length; start++) {
    if (block(start)) continue;
    const seen = new Map<number, number>([[start, 0]]);
    const queue = [start];
    let found = 9;
    for (let i = 0; i < queue.length && found === 9; i++) {
      const at = queue[i]!;
      const d = seen.get(at)!;
      if (d >= 4) break;
      for (const dir of DIRS) {
        const to = roll(at, dir);
        if (to === -1) {
          found = d + 1;
          break;
        }
        if (!seen.has(to)) {
          seen.set(to, d + 1);
          queue.push(to);
        }
      }
    }
    dist[start] = found;
  }
  return dist;
}

/** The person's read of a board: balls not home weigh 100, plus each one's tilts home as if alone. */
function makeScore(board: TopsyBoard) {
  const cache = new Map<string, Int8Array[]>();
  return (s: TopsyState): number => {
    const filled = new Set(board.holes.filter((_, j) => s.balls[j] === TOPSY_HOME));
    const fk = [...filled].sort((a, b) => a - b).join(".");
    let tables = cache.get(fk);
    if (!tables) {
      tables = board.starts.map((_, i) => aloneDistances(board, i, filled));
      cache.set(fk, tables);
    }
    let score = 0;
    s.balls.forEach((cell, i) => {
      if (cell !== TOPSY_HOME) score += 100 + tables![i]![cell]!;
    });
    return score;
  };
}

export interface HumanBoard {
  cleared: boolean;
  /** Tilts on the board at the end (the attempt that cleared it, or the last). */
  tilts: number;
  /** Every tilt made, resets included (the time it takes). */
  allTilts: number;
  resets: number;
}

/** Plays one board as the person would, within `limit` tilts an attempt. */
export function humanBoard(board: TopsyBoard, limit: number): HumanBoard {
  const walls = new Set(board.walls);
  const score = makeScore(board);
  const avoid = new Set<string>();
  let allTilts = 0;
  for (let attempt = 0; attempt <= RESETS; attempt++) {
    let state = topsyStart(board);
    const seen = new Set<string>([keyOf(state)]);
    let tilts = 0;
    while (tilts < limit && !topsyCleared(state)) {
      const best = { value: Infinity, dir: null as GravityDir | null, next: null as TopsyState | null };
      for (const dir of DIRS) {
        const out = topsyTilt(board, walls, state, dir);
        if (!out.moved || seen.has(keyOf(out.state)) || avoid.has(keyOf(out.state))) continue;
        // The best this line can reach within the look-ahead (fewer tilts breaks ties).
        let value = score(out.state) * 10;
        const walk = (s: TopsyState, depth: number) => {
          if (depth >= LOOKAHEAD || topsyCleared(s)) return;
          for (const d of DIRS) {
            const o = topsyTilt(board, walls, s, d);
            if (!o.moved) continue;
            value = Math.min(value, score(o.state) * 10 + depth);
            walk(o.state, depth + 1);
          }
        };
        walk(out.state, 1);
        if (value < best.value) Object.assign(best, { value, dir, next: out.state });
      }
      if (!best.next) break;
      state = best.next;
      seen.add(keyOf(state));
      tilts++;
      allTilts++;
    }
    if (topsyCleared(state)) return { cleared: true, tilts, allTilts, resets: attempt };
    // Stuck or out of tilts: remember where this attempt went first, then start the board again.
    for (const k of seen) if (k !== keyOf(topsyStart(board))) avoid.add(k);
  }
  return { cleared: false, tilts: limit, allTilts, resets: RESETS };
}

/** A whole round: each board in turn with its stored limit. */
export function humanRound(p: GravityPuzzleData & { boards: TopsyBoard[] }): HumanBoard[] {
  return p.boards.map((b, i) => humanBoard(b, p.tiltLimits?.[i] ?? 99));
}

if (import.meta.main) {
  const { TOPSY_LEVEL_BANK } = await import("../src/lib/duel/topsyLevelsBank.server");
  const { parseTopsyBankEntry } = await import("../src/lib/duel/topsy.server");
  const { generatePuzzle } = await import("../src/lib/duel/generate.server");
  const { withSeededRandom } = await import("../src/lib/duel/random");
  const { LEVELS_GRAVITY } = await import("../src/lib/levels/pattern/gravity.levels");
  const args = process.argv.slice(2);
  const arg = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
  const only = arg("level") ?? "all";
  const count = Number(arg("boards") ?? 240);
  const levels = only === "all" ? ["easy", "normal", "hard", "expert"] : [only];
  for (const level of levels) {
    const boards: { board: TopsyBoard; min: number; limit: number }[] = [];
    if (level === "normal") {
      for (let n = 0; boards.length < count; n++) {
        const p = withSeededRandom(9100 + n, () => generatePuzzle("gravity", {})) as GravityPuzzleData & { boards: TopsyBoard[] };
        p.boards.forEach((b, i) => boards.push({ board: b, min: p.boardMins![i]!, limit: p.tiltLimits![i]! }));
      }
    } else {
      const spare = LEVELS_GRAVITY.levels[level as "easy"]!.settings.spare;
      for (const line of TOPSY_LEVEL_BANK[level as "easy"].slice(0, count)) {
        const e = parseTopsyBankEntry(line);
        boards.push({ board: e.board, min: e.min, limit: e.min + spare });
      }
    }
    const runs = boards.slice(0, count).map((b) => ({ ...humanBoard(b.board, b.limit), min: b.min }));
    const cleared = runs.filter((r) => r.cleared);
    const over = cleared.reduce((n, r) => n + (r.tilts - r.min), 0) / Math.max(1, cleared.length);
    const first = runs.filter((r) => r.cleared && r.resets === 0).length;
    console.log(
      `${level.padEnd(7)} boards ${runs.length}  cleared ${((100 * cleared.length) / runs.length).toFixed(1)} %  (first try ${((100 * first) / runs.length).toFixed(1)} %)  tilts over the fewest ${over.toFixed(2)} a cleared board`,
    );
  }
}
