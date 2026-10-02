/**
 * Ball Track rules, shared by the phone (animation), the server (replay and
 * grading) and the bank script (search). Gravity is deterministic: each step
 * the ball falls if the cell below is empty; if the cell below is a ramp tile
 * it rolls one cell the way the arrow points (if that cell is empty); otherwise
 * it stops. Removed blockers become empty cells and never come back.
 */

export const BT_COLS = 7;
export const BT_ROWS = 11;
/** Steps a single GO may take before the ball is treated as stopped. */
const MAX_STEPS = 200;
const MAX_EVENTS = 200;

export interface BtBoard {
  cols: number;
  rows: number;
  tiles: string;
  start: number;
  exit: number;
}

export function btIsBlockerTile(t: string | undefined): boolean {
  return t === "b" || t === "l" || t === "r";
}

/** -1 left, 1 right, 0 none. */
export function btRampDir(t: string | undefined): number {
  if (t === "<" || t === "l") return -1;
  if (t === ">" || t === "r") return 1;
  return 0;
}

function tileAt(board: BtBoard, removed: ReadonlySet<number>, cell: number): string {
  const t = board.tiles[cell] ?? "#";
  return btIsBlockerTile(t) && removed.has(cell) ? "." : t;
}

export function btExitCell(board: BtBoard): number {
  return (board.rows - 1) * board.cols + board.exit;
}

/** Runs the ball from `from` until it stops or exits. `path` starts with `from`. */
export function btRun(
  board: BtBoard,
  removed: ReadonlySet<number>,
  from: number,
): { path: number[]; exited: boolean } {
  const { cols, rows } = board;
  const exitCell = btExitCell(board);
  const path = [from];
  let cell = from;
  for (let i = 0; i < MAX_STEPS && cell !== exitCell; i++) {
    const r = Math.floor(cell / cols);
    const c = cell % cols;
    if (r >= rows - 1) break;
    const below = cell + cols;
    const t = tileAt(board, removed, below);
    if (t === ".") {
      cell = below;
      path.push(cell);
      continue;
    }
    const d = btRampDir(t);
    const nc = c + d;
    if (d !== 0 && nc >= 0 && nc < cols && tileAt(board, removed, cell + d) === ".") {
      cell += d;
      path.push(cell);
      continue;
    }
    break;
  }
  return { path, exited: cell === exitCell };
}

export type BtEvent = { k: "r"; cell: number } | { k: "g" };

export function btEncode(events: readonly BtEvent[]): string {
  return events.map((e) => (e.k === "g" ? "g" : `r${e.cell}`)).join(",");
}

export function btDecode(answer: string): BtEvent[] {
  const out: BtEvent[] = [];
  for (const part of String(answer ?? "").split(",").slice(0, MAX_EVENTS)) {
    if (part === "g") out.push({ k: "g" });
    else if (/^r\d{1,3}$/.test(part)) out.push({ k: "r", cell: Number(part.slice(1)) });
  }
  return out;
}

export interface BtReplay {
  ball: number;
  removed: number[];
  exited: boolean;
  /** Deepest row the ball has been on (0 = top). */
  maxRow: number;
  /** The path of each GO, in order. */
  runs: number[][];
}

/** Replays removals and GOs against the stored board. Invalid events are ignored. */
export function btReplay(board: BtBoard, events: readonly BtEvent[]): BtReplay {
  const removed = new Set<number>();
  const order: number[] = [];
  let ball = board.start;
  let exited = false;
  let maxRow = 0;
  const runs: number[][] = [];
  for (const e of events) {
    if (exited) break;
    if (e.k === "r") {
      if (btIsBlockerTile(board.tiles[e.cell]) && !removed.has(e.cell)) {
        removed.add(e.cell);
        order.push(e.cell);
      }
      continue;
    }
    const run = btRun(board, removed, ball);
    runs.push(run.path);
    ball = run.path[run.path.length - 1]!;
    for (const cell of run.path) maxRow = Math.max(maxRow, Math.floor(cell / board.cols));
    exited = run.exited;
  }
  return { ball, removed: order, exited, maxRow, runs };
}
