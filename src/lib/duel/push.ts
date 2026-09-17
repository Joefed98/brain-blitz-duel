/**
 * Push rules. One step function used by the phone (to move the pusher live)
 * and by the server (to replay the moves a phone sends). No layouts and no
 * solutions live here.
 */

import { PUSH_COLS as N, type SlideDir } from "./types";

export const PUSH_DIRS: SlideDir[] = ["U", "D", "L", "R"];

export function pushStep(cell: number, dir: SlideDir): number | null {
  const row = Math.floor(cell / N);
  const col = cell % N;
  if (dir === "U") return row > 0 ? cell - N : null;
  if (dir === "D") return row < N - 1 ? cell + N : null;
  if (dir === "L") return col > 0 ? cell - 1 : null;
  return col < N - 1 ? cell + 1 : null;
}

export function decodePushMoves(raw: string): SlideDir[] {
  return String(raw ?? "")
    .toUpperCase()
    .split("")
    .filter((char): char is SlideDir => (PUSH_DIRS as string[]).includes(char))
    .slice(0, 400);
}

export function encodePushMoves(moves: SlideDir[]): string {
  return moves.join("");
}

export interface PushState {
  pusher: number;
  crates: number[];
}

/**
 * One step of the pusher. Walking into a crate pushes it when the cell beyond
 * is free — never into a wall and never into a second crate.
 */
export function movePusher(
  state: PushState,
  dir: SlideDir,
  walls: Set<number>,
): { state: PushState; moved: boolean; pushed: boolean } {
  const ahead = pushStep(state.pusher, dir);
  if (ahead === null || walls.has(ahead)) return { state, moved: false, pushed: false };

  const crateIndex = state.crates.indexOf(ahead);
  if (crateIndex === -1) {
    return { state: { pusher: ahead, crates: state.crates }, moved: true, pushed: false };
  }

  const beyond = pushStep(ahead, dir);
  if (beyond === null || walls.has(beyond) || state.crates.includes(beyond)) {
    return { state, moved: false, pushed: false };
  }
  const crates = [...state.crates];
  crates[crateIndex] = beyond;
  return { state: { pusher: ahead, crates }, moved: true, pushed: true };
}

export interface PushReplay {
  state: PushState;
  /** Steps that actually moved the pusher. */
  moves: number;
  pushes: number;
  cratesOnTargets: number;
  solved: boolean;
}

export function cratesOnTargets(crates: number[], targets: number[]): number {
  return crates.filter((crate) => targets.includes(crate)).length;
}

/** Replays a move list on the stored layout. Illegal steps are simply ignored. */
export function replayPush(
  walls: number[],
  targets: number[],
  pusher: number,
  crates: number[],
  moves: SlideDir[],
): PushReplay {
  const blocked = new Set(walls);
  let state: PushState = { pusher, crates: [...crates] };
  let count = 0;
  let pushes = 0;

  for (const dir of moves) {
    const result = movePusher(state, dir, blocked);
    if (!result.moved) continue;
    state = result.state;
    count += 1;
    if (result.pushed) pushes += 1;
    if (cratesOnTargets(state.crates, targets) === targets.length) break;
  }

  const on = cratesOnTargets(state.crates, targets);
  return {
    state,
    moves: count,
    pushes,
    cratesOnTargets: on,
    solved: on === targets.length,
  };
}

/** One stored push: which crate cell moved, and in which direction. */
export interface PushMove {
  cell: number;
  dir: SlideDir;
}

export function decodePushSolution(raw: string): PushMove[] {
  return String(raw ?? "")
    .split(",")
    .map((part) => {
      const [cell, dir] = part.split(":");
      return { cell: Number.parseInt(cell ?? "", 10), dir: (dir ?? "") as SlideDir };
    })
    .filter((move) => Number.isInteger(move.cell) && (PUSH_DIRS as string[]).includes(move.dir));
}

export function encodePushSolution(moves: PushMove[]): string {
  return moves.map((move) => `${move.cell}:${move.dir}`).join(",");
}

/** Crate positions after each stored push, for the reveal playback. */
export function pushSolutionFrames(crates: number[], solution: PushMove[]): number[][] {
  const frames: number[][] = [[...crates]];
  let current = [...crates];
  for (const move of solution) {
    const index = current.indexOf(move.cell);
    const to = pushStep(move.cell, move.dir);
    if (index === -1 || to === null) continue;
    current = [...current];
    current[index] = to;
    frames.push(current);
  }
  return frames;
}
