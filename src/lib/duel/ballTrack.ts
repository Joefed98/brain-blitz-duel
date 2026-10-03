/** Shared pipe rules. 0 = |, 1 = \\, 2 = shallow-right, 3 = /, 4 = shallow-left. */
export const BT_COLS = 8;
export const BT_ROWS = 8;
const MAX_EVENTS = 400;

export interface BtBoard {
  cols: number;
  rows: number;
  tiles: string;
  /** bucket column -> ball colour index */
  buckets: number[];
  /** Cell indices with no pipe. */
  blocks?: number[];
  /** Two linked pairs; tapping either member drops both. */
  pairs?: [number, number][];
  /** Cell index and permitted ball colour. */
  gates?: { cell: number; colour: number }[];
}

export type BtEvent = { k: "r"; cell: number } | { k: "d"; ball: number };

export interface BtPathPoint {
  /** Coordinates in tile units from the grid's top-left corner. */
  x: number;
  y: number;
  angle: number;
}

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
export function btRun(board: BtBoard, tiles: string, ball: number): { path: number[]; points: BtPathPoint[]; bucket: number | null; home: boolean } {
  let column = ball;
  const path: number[] = [];
  const points: BtPathPoint[] = [{ x: ball + 0.5, y: -0.15, angle: 0 }];
  const blocks = new Set(board.blocks ?? []);
  const gates = new Map((board.gates ?? []).map((gate) => [gate.cell, gate.colour]));
  const visited = new Set<string>();
  for (let row = 0, steps = 0; row < board.rows && steps < board.rows * board.cols; steps++) {
    const cell = row * board.cols + column;
    const stateKey = `${cell}:${tiles[cell]}`;
    if (visited.has(stateKey)) return { path, points, bucket: null, home: false };
    visited.add(stateKey);
    path.push(cell);
    if (blocks.has(cell) || (gates.has(cell) && gates.get(cell) !== ball)) return { path, points, bucket: null, home: false };
    const orientation = Number(tiles[cell]);
    if (orientation === 2 || orientation === 4) {
      const direction = orientation === 2 ? 1 : -1;
      points.push({ x: column + 0.5, y: row + 0.32, angle: direction * 25 });
      points.push({ x: column + 0.5 + direction, y: row + 0.68, angle: direction * 105 });
      const nextColumn = column + direction;
      if (nextColumn < 0 || nextColumn >= board.cols) return { path, points, bucket: null, home: false };
      const nextCell = row * board.cols + nextColumn;
      if (blocks.has(nextCell) || (gates.has(nextCell) && gates.get(nextCell) !== ball)) return { path, points, bucket: null, home: false };
      const nextOrientation = Number(tiles[nextCell]);
      if (nextOrientation === (direction === 1 ? 4 : 2)) return { path, points, bucket: null, home: false };
      column = nextColumn;
      continue;
    }
    const direction = orientation === 1 ? 1 : orientation === 3 ? -1 : 0;
    points.push({ x: column + 0.5, y: row, angle: direction * 15 });
    column += direction;
    points.push({ x: column + 0.5, y: row + 1, angle: direction * 105 });
    row++;
    if (column < 0 || column >= board.cols) return { path, points, bucket: null, home: false };
  }
  if (points.at(-1)?.y !== board.rows) return { path, points, bucket: null, home: false };
  points.push({ x: column + 0.5, y: board.rows + 0.28, angle: 145 });
  return { path, points, bucket: column, home: board.buckets[column] === ball };
}

export interface BtReplay {
  tiles: string;
  dropped: number[];
  home: number;
  rotations: number;
  runs: { ball: number; path: number[]; points: BtPathPoint[]; bucket: number | null; home: boolean }[];
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
      if (event.cell < board.cols || board.blocks?.includes(event.cell)) continue;
      tiles[event.cell] = String((Number(tiles[event.cell]) + 1) % 5);
      rotations++;
    } else if (Number.isInteger(event.ball) && event.ball >= 0 && event.ball < board.cols && !dropped.has(event.ball)) {
      const pair = board.pairs?.find(([a, b]) => a === event.ball || b === event.ball);
      const balls = pair ?? [event.ball];
      for (const ball of balls) {
        if (dropped.has(ball)) continue;
        const run = btRun(board, tiles.join(""), ball);
        runs.push({ ball, ...run });
        dropped.add(ball);
        if (run.home) home++;
      }
    }
  }
  return { tiles: tiles.join(""), dropped: [...dropped], home, rotations, runs };
}

export function scoreBallTrack(home: number, msRemaining: number, timeLimitMs: number, rotations: number, minimum?: number): number {
  if (home < BT_COLS) return Math.round(70 * Math.max(0, home) / BT_COLS);
  const speed = Math.round(30 * Math.max(0, Math.min(msRemaining, timeLimitMs)) / timeLimitMs);
  return Math.min(150, 100 + speed + (minimum !== undefined && rotations <= minimum ? 20 : 0));
}