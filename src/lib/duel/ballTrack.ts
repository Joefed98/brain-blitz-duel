/** Shared, deterministic pipe rules. 0 = |, 1 = \\, 2 = /. */
export const BT_COLS = 8;
export const BT_ROWS = 6;
const MAX_EVENTS = 400;

export interface BtBoard {
  cols: number;
  rows: number;
  tiles: string;
  /** bucket column -> ball colour index */
  buckets: number[];
}

export type BtEvent = { k: "r"; cell: number } | { k: "d"; ball: number };

export function btEncode(events: readonly BtEvent[]): string {
  return events.map((e) => e.k === "r" ? `r${e.cell}` : `d${e.ball}`).join(",");
}

export function btDecode(answer: string): BtEvent[] {
  const events: BtEvent[] = [];
  for (const part of String(answer ?? "").split(",").slice(0, MAX_EVENTS)) {
    if (/^r\d{1,2}$/.test(part)) events.push({ k: "r", cell: Number(part.slice(1)) });
    else if (/^d[0-7]$/.test(part)) events.push({ k: "d", ball: Number(part.slice(1)) });
  }
  return events;
}

/** Each path begins above its source column and ends in a bucket, or outside a side. */
export function btRun(board: BtBoard, tiles: string, ball: number): { path: number[]; bucket: number | null; home: boolean } {
  let column = ball;
  const path: number[] = [];
  for (let row = 0; row < board.rows; row++) {
    path.push(row * board.cols + column);
    const orientation = tiles[row * board.cols + column];
    column += orientation === "1" ? 1 : orientation === "2" ? -1 : 0;
    if (column < 0 || column >= board.cols) return { path, bucket: null, home: false };
  }
  return { path, bucket: column, home: board.buckets[column] === ball };
}

export interface BtReplay {
  tiles: string;
  dropped: number[];
  home: number;
  rotations: number;
  runs: { ball: number; path: number[]; bucket: number | null; home: boolean }[];
}

/** Replays only legal taps and drops, ignoring extra or malformed actions. */
export function btReplay(board: BtBoard, events: readonly BtEvent[]): BtReplay {
  const tiles = board.tiles.split("");
  const dropped = new Set<number>();
  const runs: BtReplay["runs"] = [];
  let home = 0;
  let rotations = 0;
  for (const event of events.slice(0, MAX_EVENTS)) {
    if (dropped.size === board.cols) break;
    if (event.k === "r") {
      if (!Number.isInteger(event.cell) || event.cell < 0 || event.cell >= board.cols * board.rows) continue;
      tiles[event.cell] = String((Number(tiles[event.cell]) + 1) % 3);
      rotations++;
    } else if (Number.isInteger(event.ball) && event.ball >= 0 && event.ball < board.cols && !dropped.has(event.ball)) {
      const run = btRun(board, tiles.join(""), event.ball);
      runs.push({ ball: event.ball, ...run });
      dropped.add(event.ball);
      if (run.home) home++;
    }
  }
  return { tiles: tiles.join(""), dropped: [...dropped], home, rotations, runs };
}

export function scoreBallTrack(home: number, msRemaining: number, timeLimitMs: number, rotations: number, minimum?: number): number {
  if (home < BT_COLS) return Math.round(70 * Math.max(0, home) / BT_COLS);
  const speed = Math.round(30 * Math.max(0, Math.min(msRemaining, timeLimitMs)) / timeLimitMs);
  return Math.min(150, 100 + speed + (minimum !== undefined && rotations <= minimum ? 20 : 0));
}