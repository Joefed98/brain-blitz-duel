/**
 * Brimful rules shared by the phone (live play), the server (replaying the
 * action list a phone sends) and the generator (breadth-first minimums).
 *
 * Actions: "F<i>" fill jug i from the tap, "E<i>" empty it down the drain,
 * "P<i>-<j>" pour i into j until i is empty or j is full, "R" reset to the
 * start. Every fill, empty or pour that changes a jug counts as a move; Reset
 * itself is not a move, and moves made before it keep counting. An action that
 * would change nothing (or is not available on this board) is ignored.
 */
import { speedBonusCurve } from "./speedPar";
import type { MeasureBoardData } from "./types";

export const MEASURE_REV = 1;
export const MEASURE_BOARDS = 4;
export const MEASURE_SOLVE_POINTS = 25;
export const MEASURE_MOVE_POINTS = 5;
export const MEASURE_SPEED_POINTS = 30;
/** Longest action list read per board. */
export const MEASURE_MAX_ACTIONS = 300;

export type MeasureAction =
  | { kind: "fill"; jug: number }
  | { kind: "empty"; jug: number }
  | { kind: "pour"; from: number; to: number }
  | { kind: "reset" };

export function encodeMeasureAction(action: MeasureAction): string {
  if (action.kind === "fill") return `F${action.jug}`;
  if (action.kind === "empty") return `E${action.jug}`;
  if (action.kind === "pour") return `P${action.from}-${action.to}`;
  return "R";
}

export function decodeMeasureActions(raw: string, jugs: number): MeasureAction[] {
  const out: MeasureAction[] = [];
  for (const part of String(raw ?? "").split(",")) {
    if (out.length >= MEASURE_MAX_ACTIONS) break;
    const token = part.trim();
    let match: RegExpExecArray | null;
    if (token === "R") out.push({ kind: "reset" });
    else if ((match = /^([FE])(\d)$/.exec(token))) {
      const jug = Number(match[2]);
      if (jug < jugs) out.push({ kind: match[1] === "F" ? "fill" : "empty", jug });
    } else if ((match = /^P(\d)-(\d)$/.exec(token))) {
      const from = Number(match[1]);
      const to = Number(match[2]);
      if (from < jugs && to < jugs && from !== to) out.push({ kind: "pour", from, to });
    }
  }
  return out;
}

/** The jugs after one action, or null when the action would change nothing. */
export function measureApply(
  board: MeasureBoardData,
  amounts: readonly number[],
  action: MeasureAction,
): number[] | null {
  const caps = board.caps;
  if (action.kind === "reset") return [...board.start];
  if (action.kind === "fill") {
    if (!board.tap || amounts[action.jug]! >= caps[action.jug]!) return null;
    const next = [...amounts];
    next[action.jug] = caps[action.jug]!;
    return next;
  }
  if (action.kind === "empty") {
    if (!board.tap || amounts[action.jug]! <= 0) return null;
    const next = [...amounts];
    next[action.jug] = 0;
    return next;
  }
  const { from, to } = action;
  const room = caps[to]! - amounts[to]!;
  const moved = Math.min(amounts[from]!, room);
  if (moved <= 0) return null;
  const next = [...amounts];
  next[from] = amounts[from]! - moved;
  next[to] = amounts[to]! + moved;
  return next;
}

export function measureSolved(board: MeasureBoardData, amounts: readonly number[]): boolean {
  if (board.goal === "split")
    return (board.split ?? []).every((want, jug) => amounts[jug] === want);
  return amounts.some((litres) => litres === board.target);
}

export interface MeasureReplay {
  amounts: number[];
  /** Counted moves up to the solve (or the end of the list). */
  moves: number;
  solved: boolean;
}

/** Replays one board's actions from its start; play stops at the solve. */
export function replayMeasure(
  board: MeasureBoardData,
  actions: readonly MeasureAction[],
): MeasureReplay {
  let amounts = [...board.start];
  let moves = 0;
  if (measureSolved(board, amounts)) return { amounts, moves, solved: true };
  for (const action of actions) {
    const next = measureApply(board, amounts, action);
    if (!next) continue;
    if (action.kind !== "reset") moves += 1;
    amounts = next;
    if (measureSolved(board, amounts)) return { amounts, moves, solved: true };
  }
  return { amounts, moves, solved: false };
}

/** Every move-counting action available on a board, in a fixed order. */
export function measureActions(board: MeasureBoardData): MeasureAction[] {
  const n = board.caps.length;
  const out: MeasureAction[] = [];
  if (board.tap)
    for (let jug = 0; jug < n; jug++) out.push({ kind: "fill", jug }, { kind: "empty", jug });
  for (let from = 0; from < n; from++)
    for (let to = 0; to < n; to++) if (from !== to) out.push({ kind: "pour", from, to });
  return out;
}

/** Breadth-first search from the start: the exact minimum and one shortest action list. */
export function measureShortest(
  board: MeasureBoardData,
): { minMoves: number; solution: MeasureAction[] } | null {
  const key = (amounts: readonly number[]) => amounts.join(",");
  const start = [...board.start];
  if (measureSolved(board, start)) return { minMoves: 0, solution: [] };
  const actions = measureActions(board);
  const parent = new Map<string, { prev: string | null; action: MeasureAction | null }>();
  parent.set(key(start), { prev: null, action: null });
  let frontier = [start];
  let depth = 0;
  while (frontier.length) {
    depth += 1;
    const next: number[][] = [];
    for (const amounts of frontier) {
      for (const action of actions) {
        const after = measureApply(board, amounts, action);
        if (!after) continue;
        const id = key(after);
        if (parent.has(id)) continue;
        parent.set(id, { prev: key(amounts), action });
        if (measureSolved(board, after)) {
          const solution: MeasureAction[] = [];
          let cursor: string | null = id;
          while (cursor) {
            const step: { prev: string | null; action: MeasureAction | null } = parent.get(cursor)!;
            if (!step.action) break;
            solution.unshift(step.action);
            cursor = step.prev;
          }
          return { minMoves: depth, solution };
        }
        next.push(after);
      }
    }
    frontier = next;
  }
  return null;
}

/** Round answer: one comma-separated action list per board, joined by "|". */
export function encodeMeasureRound(boards: readonly MeasureAction[][]): string {
  return boards.map((actions) => actions.map(encodeMeasureAction).join(",")).join("|");
}

export function splitMeasureRound(raw: string | null | undefined): string[] {
  const parts = String(raw ?? "").split("|");
  return Array.from({ length: MEASURE_BOARDS }, (_, i) => parts[i] ?? "");
}

export interface MeasureBoardResult {
  solved: boolean;
  moves: number;
  minMoves: number;
  /** 0–5: full at the minimum, none at twice it. */
  movePoints: number;
}

/** Move points: 5 at or under the minimum, falling evenly to 0 at twice it. */
export function measureMovePoints(moves: number, minMoves: number): number {
  if (!(minMoves > 0)) return MEASURE_MOVE_POINTS;
  if (moves <= minMoves) return MEASURE_MOVE_POINTS;
  if (moves >= 2 * minMoves) return 0;
  return Math.round((MEASURE_MOVE_POINTS * (2 * minMoves - moves)) / minMoves);
}

/**
 * Replays the boards in order. Boards are played one after another, so the
 * first unsolved board ends the run: it and any later segment score nothing.
 */
export function gradeMeasureBoards(
  boards: readonly MeasureBoardData[],
  minMoves: readonly number[],
  raw: string,
): MeasureBoardResult[] {
  const parts = splitMeasureRound(raw);
  const out: MeasureBoardResult[] = [];
  let open = true;
  boards.forEach((board, index) => {
    const min = minMoves[index] ?? 0;
    if (!open) {
      out.push({ solved: false, moves: 0, minMoves: min, movePoints: 0 });
      return;
    }
    const replay = replayMeasure(
      board,
      decodeMeasureActions(parts[index] ?? "", board.caps.length),
    );
    if (!replay.solved) open = false;
    out.push({
      solved: replay.solved,
      moves: replay.moves,
      minMoves: min,
      movePoints: replay.solved ? measureMovePoints(replay.moves, min) : 0,
    });
  });
  return out;
}

/** 25 per solved board + its move points; all four solved adds up to 30 for speed (par curve). Max 150. */
export function scoreMeasure(
  results: readonly MeasureBoardResult[],
  msRemaining: number,
  timeLimitMs: number,
): number {
  const base = results.reduce(
    (sum, r) => sum + (r.solved ? MEASURE_SOLVE_POINTS + r.movePoints : 0),
    0,
  );
  const all = results.length === MEASURE_BOARDS && results.every((r) => r.solved);
  const bonus =
    all && timeLimitMs > 0 ? speedBonusCurve(MEASURE_SPEED_POINTS, msRemaining, timeLimitMs) : 0;
  return Math.max(0, Math.min(150, base + bonus));
}
