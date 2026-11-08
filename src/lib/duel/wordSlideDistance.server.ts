/**
 * Slider's solver distance (wordSlideRev 5, 7 Nov 2026, wordNov7.ts; docs/word-scoring-nov-2026.md), server only: the
 * fewest row and column shifts (every row and column free, both ways, with wrap-around) from a grid to the dealt
 * words' grid. Along a shortest line every shift brings the grid one closer, so the progress it gives never falls on
 * the way, even where the middle moves break rows.
 *
 * A bidirectional breadth-first search, always growing the smaller side, stopped at `limit` (deals are 5 to 8 shifts
 * deep, so the searches stay within about four levels a side). The start's distance is cached per board.
 */
import { WS_SIZE } from "./wordSlide";

/** The 20 free shifts as index maps: next[k] = grid[from[k]]. */
const SHIFTS: readonly Int8Array[] = (() => {
  const out: Int8Array[] = [];
  for (const axis of ["r", "c"] as const) {
    for (let index = 0; index < WS_SIZE; index++) {
      for (const dir of [1, -1]) {
        const from = new Int8Array(WS_SIZE * WS_SIZE);
        for (let i = 0; i < from.length; i++) from[i] = i;
        for (let k = 0; k < WS_SIZE; k++) {
          const src = (k - dir + WS_SIZE) % WS_SIZE;
          if (axis === "r") from[index * WS_SIZE + k] = index * WS_SIZE + src;
          else from[k * WS_SIZE + index] = src * WS_SIZE + index;
        }
        out.push(from);
      }
    }
  }
  return out;
})();

function shifted(state: string, from: Int8Array): string {
  let s = "";
  for (let i = 0; i < from.length; i++) s += state[from[i]!]!;
  return s;
}

/**
 * The fewest free shifts from `grid` to `goal` when it is at most `limit`, else null. Grids of other sizes or letters
 * (none from a replay) are null.
 */
export function wordSlideDistance(grid: readonly string[], goal: readonly string[], limit: number): number | null {
  const n = WS_SIZE * WS_SIZE;
  if (grid.length !== n || goal.length !== n || !(limit >= 0)) return null;
  const a = grid.join("");
  const b = goal.join("");
  if (a.length !== n || b.length !== n) return null;
  if (a === b) return 0;
  if ([...a].sort().join("") !== [...b].sort().join("")) return null;
  // Each side's distances; a level of the smaller side is grown at a time.
  const da = new Map<string, number>([[a, 0]]);
  const db = new Map<string, number>([[b, 0]]);
  let fa = [a];
  let fb = [b];
  let depthA = 0;
  let depthB = 0;
  while (depthA + depthB < limit && fa.length && fb.length) {
    const growA = fa.length <= fb.length;
    const [mine, other, front] = growA ? [da, db, fa] : [db, da, fb];
    const depth = (growA ? depthA : depthB) + 1;
    const next: string[] = [];
    let best = Infinity;
    for (const s of front) {
      for (const m of SHIFTS) {
        const t = shifted(s, m);
        if (mine.has(t)) continue;
        mine.set(t, depth);
        const o = other.get(t);
        if (o !== undefined) best = Math.min(best, depth + o);
        next.push(t);
      }
    }
    // The first level that meets the other side holds the shortest line (the other side's frontier is its deepest level,
    // and a shorter meeting would have shown a level sooner).
    if (best < Infinity) return best <= limit ? best : null;
    if (growA) {
      fa = next;
      depthA = depth;
    } else {
      fb = next;
      depthB = depth;
    }
  }
  return null;
}

const startCache = new Map<string, number | null>();

/** The board's start distance to its words (at most its par, the deal's scramble length), cached per board. */
export function wordSlideStartDistance(start: readonly string[], goal: readonly string[], par: number): number | null {
  const key = `${start.join("")}|${goal.join("")}|${par}`;
  if (startCache.has(key)) return startCache.get(key)!;
  const d = wordSlideDistance(start, goal, Math.max(0, Math.min(12, par)));
  if (startCache.size >= 64) startCache.delete(startCache.keys().next().value!);
  startCache.set(key, d);
  return d;
}
