/**
 * Sort the Tubes: the pour rules, shared by the phone and the server. The
 * server replays every pour a player sends through exactly this code, so a
 * client-reported "solved" is never trusted.
 */

import { TUBE_CAPACITY, TUBES_COLOURS, TUBES_COUNT } from "./types";

/** One tube per entry, bottom ball first, holding colour indices. */
export type TubeState = number[][];

export interface TubeMove {
  from: number;
  to: number;
}

export function cloneTubes(state: TubeState): TubeState {
  return state.map((tube) => [...tube]);
}

/** The run of same-coloured balls at the top of a tube. */
export function topGroup(tube: number[]): { colour: number; count: number } | null {
  if (!tube.length) return null;
  const colour = tube[tube.length - 1]!;
  let count = 1;
  for (let i = tube.length - 2; i >= 0; i--) {
    if (tube[i] !== colour) break;
    count += 1;
  }
  return { colour, count };
}

/** How many balls a pour would actually move (0 when the pour is illegal). */
export function pourAmount(state: TubeState, from: number, to: number): number {
  if (from === to) return 0;
  const source = state[from];
  const destination = state[to];
  if (!source || !destination) return 0;
  const group = topGroup(source);
  if (!group) return 0;
  const room = TUBE_CAPACITY - destination.length;
  if (room <= 0) return 0;
  const target = topGroup(destination);
  if (target && target.colour !== group.colour) return 0;
  return Math.min(group.count, room);
}

export function canPour(state: TubeState, from: number, to: number): boolean {
  return pourAmount(state, from, to) > 0;
}

export function pour(state: TubeState, from: number, to: number): TubeState {
  const amount = pourAmount(state, from, to);
  if (amount <= 0) return state;
  const next = cloneTubes(state);
  const moved = next[from]!.splice(next[from]!.length - amount, amount);
  next[to]!.push(...moved);
  return next;
}

/** A finished tube: full and all one colour. */
export function tubeSorted(tube: number[]): boolean {
  return tube.length === TUBE_CAPACITY && tube.every((colour) => colour === tube[0]);
}

export function sortedTubeCount(state: TubeState): number {
  return state.filter(tubeSorted).length;
}

/** Solved when every tube is either empty or a full single-colour tube. */
export function tubesSolved(state: TubeState): boolean {
  return state.every((tube) => tube.length === 0 || tubeSorted(tube));
}

/** True when a colour already sits entirely in one tube. */
export function colourAlreadyHome(state: TubeState): boolean {
  for (let colour = 0; colour < TUBES_COLOURS; colour++) {
    const holding = state.filter((tube) => tube.includes(colour));
    if (holding.length === 1) return true;
  }
  return false;
}

export function encodeTubeMoves(moves: TubeMove[]): string {
  return moves.map(({ from, to }) => `${from}>${to}`).join(",");
}

export function decodeTubeMoves(raw: string): TubeMove[] {
  return (raw ?? "")
    .split(",")
    .map((part) => part.split(">").map((value) => Number.parseInt(value, 10)))
    .filter(
      (pair) =>
        pair.length === 2 &&
        pair.every(
          (value) => Number.isInteger(value) && value >= 0 && (value as number) < TUBES_COUNT,
        ),
    )
    .map(([from, to]) => ({ from: from!, to: to! }))
    .slice(0, 200);
}

/** Replays a pour list, skipping anything illegal — the one source of truth. */
export function replayTubes(
  start: TubeState,
  moves: TubeMove[],
): { tubes: TubeState; moves: number; solved: boolean; sorted: number } {
  let state = cloneTubes(start);
  let applied = 0;
  for (const move of moves) {
    if (!canPour(state, move.from, move.to)) continue;
    state = pour(state, move.from, move.to);
    applied += 1;
  }
  return {
    tubes: state,
    moves: applied,
    solved: applied > 0 && tubesSolved(state),
    sorted: sortedTubeCount(state),
  };
}

/** Tube order does not matter, so states are compared with the tubes sorted. */
export function tubesKey(state: TubeState): string {
  return state
    .map((tube) => tube.join(""))
    .sort()
    .join("|");
}

/* ---------------- Pour limit (tubesRev 1, moveLimits.ts, 13 Oct 2026) ---------------- */

/** A pour, or the Undo / Reset buttons: from tubesRev 1 the phone sends all three, so the server sees every pour. */
export type TubeToken = TubeMove | "undo" | "reset";

export function encodeTubeLog(tokens: readonly TubeToken[]): string {
  return tokens.map((t) => (t === "undo" ? "u" : t === "reset" ? "r" : `${t.from}>${t.to}`)).join(",");
}

/** Longest pour log read (Undo and Reset included). */
export const TUBE_LOG_MAX = 300;

export function decodeTubeLog(raw: string): TubeToken[] {
  const out: TubeToken[] = [];
  for (const part of String(raw ?? "").split(",")) {
    if (out.length >= TUBE_LOG_MAX) break;
    const token = part.trim();
    if (token === "u") out.push("undo");
    else if (token === "r") out.push("reset");
    else {
      const pair = token.split(">").map((value) => Number.parseInt(value, 10));
      if (pair.length === 2 && pair.every((v) => Number.isInteger(v) && v >= 0 && v < TUBES_COUNT)) out.push({ from: pair[0]!, to: pair[1]! });
    }
  }
  return out;
}

/**
 * Replays a pour log: illegal pours are skipped, Undo steps back one pour and
 * Reset goes back to the start, but neither gives a pour back. With a limit,
 * nothing after the limit-th pour counts (the board has ended unfinished).
 */
export function replayTubeLog(
  start: TubeState,
  tokens: readonly TubeToken[],
  limit: number | null = null,
): { tubes: TubeState; moves: number; solved: boolean; sorted: number; outOfPours: boolean; depth: number } {
  const history: TubeState[] = [cloneTubes(start)];
  let poured = 0;
  for (const token of tokens) {
    const state = history[history.length - 1]!;
    if (poured > 0 && tubesSolved(state)) break;
    if (limit !== null && poured >= limit) break;
    if (token === "undo") {
      if (history.length > 1) history.pop();
      continue;
    }
    if (token === "reset") {
      history.length = 1;
      continue;
    }
    if (!canPour(state, token.from, token.to)) continue;
    history.push(pour(state, token.from, token.to));
    poured += 1;
  }
  const tubes = history[history.length - 1]!;
  const solved = poured > 0 && tubesSolved(tubes);
  return { tubes, moves: poured, solved, sorted: sortedTubeCount(tubes), outOfPours: limit !== null && poured >= limit && !solved, depth: history.length - 1 };
}
