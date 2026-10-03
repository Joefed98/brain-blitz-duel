/** Shared three-orientation pipe and seeded bomb rules: 0 = |, 1 = \\, 2 = /. */
export const BT_COLS = 8;
export const BT_ROWS = 8;
const MAX_EVENTS = 400;
export interface BtBomb { cell: number; neighbour: number }
export interface BtBoard {
  cols: number; rows: number; tiles: string;
  buckets: number[];
  bombs?: BtBomb[];
  /** Compatibility with already-started rooms; new puzzles contain bombs only. */
  blocks?: number[];
  pairs?: [number, number][];
  gates?: { cell: number; colour: number }[];
}
export type BtEvent = { k: "r"; cell: number } | { k: "d"; ball: number };
export interface BtPathPoint { x: number; y: number; angle: number }
export interface BtExplosion { cell: number; neighbour: number; step: number }
export interface BtRun {
  ball: number; path: number[]; points: BtPathPoint[];
  bucket: number | null; home: boolean; explosions: BtExplosion[];
}
export function btEncode(events: readonly BtEvent[]): string {
  return events.map(e => e.k === "r" ? `r${e.cell}` : `d${e.ball}`).join(",");
}
export function btDecode(answer: string): BtEvent[] {
  const events: BtEvent[] = [];
  for (const part of String(answer ?? "").split(",").slice(0, MAX_EVENTS)) {
    if (/^r\d{1,2}$/.test(part)) events.push({ k: "r", cell: Number(part.slice(1)) });
    else if (/^d[0-7]$/.test(part)) events.push({ k: "d", ball: Number(part.slice(1)) });
  }
  return events;
}
/** Linked balls advance together. Blasts at a row are resolved before either ball enters it. */
export function btDrop(board: BtBoard, tiles: string, balls: readonly number[], priorDestroyed: readonly number[] = [], priorExploded: readonly number[] = []) {
  const destroyed = new Set(priorDestroyed), exploded = new Set(priorExploded);
  const blocks = new Set(board.blocks ?? []);
  const bombs = new Map((board.bombs ?? []).map(b => [b.cell, b]));
  const gates = new Map((board.gates ?? []).map(g => [g.cell, g.colour]));
  const states = balls.map(ball => ({ column: ball, live: true, run: { ball, path: [], points: [{ x: ball + .5, y: -.15, angle: 0 }], bucket: null, home: false, explosions: [] } as BtRun }));
  for (let row = 0; row < board.rows; row++) {
    for (const state of states) {
      if (!state.live) continue;
      const cell = row * board.cols + state.column;
      const bomb = bombs.get(cell);
      if (!bomb || destroyed.has(cell) || exploded.has(cell)) continue;
      exploded.add(cell); destroyed.add(cell); destroyed.add(bomb.neighbour);
      state.run.explosions.push({ cell, neighbour: bomb.neighbour, step: state.run.points.length });
    }
    for (const state of states) {
      if (!state.live) continue;
      const { run } = state;
      const cell = row * board.cols + state.column;
      run.path.push(cell);
      if (destroyed.has(cell) || blocks.has(cell) || (gates.has(cell) && gates.get(cell) !== run.ball)) {
        run.points.push({ x: state.column + .5, y: row + .35, angle: row * 120 });
        state.live = false; continue;
      }
      const orientation = Number(tiles[cell]);
      const direction = orientation === 1 ? 1 : orientation === 2 ? -1 : 0;
      run.points.push({ x: state.column + .5, y: row, angle: row * 120 });
      // Clip a side exit at the arena edge rather than teleporting to an off-board column.
      if (state.column + direction < 0 || state.column + direction >= board.cols) {
        run.points.push({ x: direction < 0 ? 0 : board.cols, y: row + .5, angle: row * 120 + 60 });
        state.live = false; continue;
      }
      state.column += direction;
      run.points.push({ x: state.column + .5, y: row + 1, angle: (row + 1) * 120 });
    }
  }
  for (const state of states) {
    if (!state.live) continue;
    state.run.bucket = state.column;
    state.run.home = board.buckets[state.column] === state.run.ball;
    state.run.points.push({ x: state.column + .5, y: board.rows + .28, angle: board.rows * 120 + 45 });
  }
  return { runs: states.map(s => s.run), destroyed: [...destroyed], exploded: [...exploded] };
}
export function btRun(board: BtBoard, tiles: string, ball: number, destroyed: readonly number[] = [], exploded: readonly number[] = []) {
  const result = btDrop(board, tiles, [ball], destroyed, exploded);
  return result.runs[0] ?? { ball, path: [], points: [], bucket: null, home: false, explosions: [] };
}
export interface BtReplay {
  tiles: string; dropped: number[]; home: number; rotations: number;
  runs: BtRun[]; destroyed: number[]; exploded: number[];
}
export function btReplay(board: BtBoard, events: readonly BtEvent[]): BtReplay {
  const tiles = board.tiles.split(""), dropped = new Set<number>();
  const runs: BtRun[] = [];
  let home = 0, rotations = 0, destroyed: number[] = [], exploded: number[] = [];
  for (const event of events.slice(0, MAX_EVENTS)) {
    if (dropped.size === board.cols) break;
    if (event.k === "r") {
      if (!Number.isInteger(event.cell) || event.cell < board.cols || event.cell >= board.cols * board.rows) continue;
      if (destroyed.includes(event.cell) || board.blocks?.includes(event.cell) || board.bombs?.some(b => b.cell === event.cell)) continue;
      tiles[event.cell] = String((Number(tiles[event.cell]) + 1) % 3); rotations++;
    } else if (Number.isInteger(event.ball) && event.ball >= 0 && event.ball < board.cols && !dropped.has(event.ball)) {
      const pair = board.pairs?.find(([a, b]) => a === event.ball || b === event.ball);
      const balls = (pair ?? [event.ball]).filter(ball => !dropped.has(ball));
      const result = btDrop(board, tiles.join(""), balls, destroyed, exploded);
      destroyed = result.destroyed; exploded = result.exploded;
      for (const run of result.runs) { runs.push(run); dropped.add(run.ball); if (run.home) home++; }
    }
  }
  return { tiles: tiles.join(""), dropped: [...dropped], home, rotations, runs, destroyed, exploded };
}
export function scoreBallTrack(home: number, msRemaining: number, timeLimitMs: number, rotations: number, minimum?: number): number {
  if (home < BT_COLS) return Math.round(70 * Math.max(0, home) / BT_COLS);
  const speed = Math.round(30 * Math.max(0, Math.min(msRemaining, timeLimitMs)) / timeLimitMs);
  return Math.min(150, 100 + speed + (minimum !== undefined && rotations <= minimum ? 20 : 0));
}
