/**
 * Blockfall's placement planner (script-only; the skill-band bots and the oracle share it). Every placement the
 * phone could make from the piece where it stands (hold or not, 0–3 turns, any move, then drop) is played through
 * the sim's own `bfApply`, so a plan is exactly the input sequence the server replays, and scored by a board
 * heuristic. Floats are fine here: the result is an input log.
 */
import {
  BF_INPUT_DROP, BF_INPUT_HOLD, BF_INPUT_MOVE, BF_INPUT_TURN, BF_ROWS, BF_W, bfApply, bfCells, bfGhostY, type BfState,
} from "../../src/lib/arcade/blockfall";

export interface BfMove {
  k: number;
  a: number;
}

export interface BfCandidate {
  moves: BfMove[];
  after: BfState;
  lines: number;
  hold: boolean;
}

const TURNS: readonly BfMove[][] = [[], [{ k: BF_INPUT_TURN, a: 1 }], [{ k: BF_INPUT_TURN, a: 1 }, { k: BF_INPUT_TURN, a: 1 }], [{ k: BF_INPUT_TURN, a: -1 }]];

/** Every distinct landing from `s` (the piece where it is now), each with its inputs. */
export function bfCandidates(s: BfState, allowHold = true): BfCandidate[] {
  const out: BfCandidate[] = [];
  const seen = new Set<string>();
  const starts: { st: BfState; pre: BfMove[]; hold: boolean }[] = [{ st: s, pre: [], hold: false }];
  if (allowHold && !s.held) {
    const h = bfApply(s, { k: BF_INPUT_HOLD, a: 0 });
    if (!h.ended && h.rejects === s.rejects) starts.push({ st: h, pre: [{ k: BF_INPUT_HOLD, a: 0 }], hold: true });
  }
  for (const { st, pre, hold } of starts) {
    for (const turns of TURNS) {
      let t = st;
      let okTurn = true;
      for (const m of turns) {
        const n = bfApply(t, m);
        if (n.rejects !== t.rejects) okTurn = false;
        t = n;
      }
      if (!okTurn) continue;
      for (let dx = -(BF_W - 1); dx <= BF_W - 1; dx++) {
        let m = t;
        const moves = [...pre, ...turns];
        if (dx !== 0) {
          m = bfApply(t, { k: BF_INPUT_MOVE, a: dx });
          if (m.rejects !== t.rejects || m.piece.x - t.piece.x !== dx) continue;
          moves.push({ k: BF_INPUT_MOVE, a: dx });
        }
        const key = `${hold ? 1 : 0}:${m.piece.shape}:${cellsKey(m)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const after = bfApply(m, { k: BF_INPUT_DROP, a: 0 });
        moves.push({ k: BF_INPUT_DROP, a: 0 });
        out.push({ moves, after, lines: after.lines - s.lines, hold });
      }
    }
  }
  return out;
}

function cellsKey(s: BfState): string {
  // Where the piece lands, as its resting cells (two turn counts can land the same way).
  const y = bfGhostY(s.board, s.piece);
  const cells = bfCells(s.piece.shape, s.piece.turn).map(([cx, cy]) => (y + cy) * BF_W + s.piece.x + cx).sort((p, q) => p - q);
  return cells.join(",");
}

export interface BoardFeatures {
  heights: number[];
  agg: number;
  holes: number;
  bump: number;
  maxH: number;
  /** Rows completely full but for the last column (a quad well ready). */
  wellRows: number;
}

export function bfFeatures(board: readonly number[], wellCol = -1): BoardFeatures {
  const heights = new Array<number>(BF_W).fill(0);
  let holes = 0;
  for (let x = 0; x < BF_W; x++) {
    let top = -1;
    for (let y = 0; y < BF_ROWS; y++) {
      if (board[y * BF_W + x]) {
        if (top < 0) top = y;
      } else if (top >= 0) holes++;
    }
    heights[x] = top < 0 ? 0 : BF_ROWS - top;
  }
  let agg = 0;
  let bump = 0;
  let maxH = 0;
  for (let x = 0; x < BF_W; x++) {
    if (x === wellCol) continue;
    agg += heights[x]!;
    maxH = Math.max(maxH, heights[x]!);
    const nx = x + 1 === wellCol ? x + 2 : x + 1;
    if (nx < BF_W) bump += Math.abs(heights[x]! - heights[nx]!);
  }
  let wellRows = 0;
  if (wellCol >= 0) {
    for (let y = BF_ROWS - 1; y >= 0; y--) {
      let full = true;
      for (let x = 0; x < BF_W; x++) if (x !== wellCol && !board[y * BF_W + x]) full = false;
      if (!full || board[y * BF_W + wellCol]) break;
      wellRows++;
    }
  }
  return { heights, agg, holes, bump, maxH: Math.max(maxH, wellCol >= 0 ? heights[wellCol]! : 0), wellRows };
}

export type BfMode = "flat" | "well" | "low";

/** A candidate's value (higher is better) in a mode: flat play clears lines; well play saves them for fours. */
export function bfValue(c: BfCandidate, mode: BfMode): number {
  if (c.after.ended === 2) return -1e6;
  if (mode === "well") {
    const f = bfFeatures(c.after.board, BF_W - 1);
    const lineScore = c.lines === 4 ? 30 : c.lines === 3 ? 6 : c.lines > 0 ? -3 * c.lines : 0;
    const wellFill = f.heights[BF_W - 1]! > 0 ? -6 * f.heights[BF_W - 1]! : 0;
    const danger = f.maxH > 12 ? -4 * (f.maxH - 12) : 0;
    return -0.51 * f.agg - 0.9 * f.holes - 0.25 * f.bump + lineScore + wellFill + danger + 0.4 * Math.min(4, f.wellRows);
  }
  const f = bfFeatures(c.after.board);
  const low = mode === "low" ? -1.2 * Math.max(0, f.maxH - 3) : 0;
  return -0.51 * f.agg + 0.76 * c.lines - 0.36 * 2 * f.holes - 0.18 * f.bump + low;
}

/** The best candidate in a mode (ties to the first), or null with none. */
export function bfBest(s: BfState, mode: BfMode, allowHold = true): BfCandidate | null {
  let best: BfCandidate | null = null;
  let bestV = -Infinity;
  for (const c of bfCandidates(s, allowHold)) {
    const v = bfValue(c, mode);
    if (v > bestV) {
      bestV = v;
      best = c;
    }
  }
  return best;
}
