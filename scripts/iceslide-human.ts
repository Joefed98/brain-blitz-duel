/**
 * A Skid player who reasons like a person (difficulty levels, 16 Nov 2026; the Expert "humanly possible" rule of the
 * Pattern overhaul's stage 3). Not a check: the levels check and the tuning report use it.
 *
 * The player sees the whole board but plans only a few slides deep, and never searches the whole board:
 *   0. First read the exit's approaches (`studyS`): the spots from which the exit is at most `back` slides away (a
 *      person works backwards from the gold gap: "I need to stop there, then slide down").
 *   1. From where the ball rests, look `depth` slides ahead (every slide, falls included, as a person traces them on
 *      the ice). If an approach (or the exit) is in reach, play that route and on to the exit.
 *   2. Otherwise slide somewhere new: of the slides from here that end on a resting spot not yet visited (square and
 *      the ice broken so far: a person remembers where they have been), take the one that opens up the most unvisited
 *      spots within `depth - 1` further slides, nearer the exit on a tie; a slide into a hole only when nothing else is
 *      new.
 *   3. With nothing new from here, Undo (a real undo: it gives the slide back) and try again from the spot before.
 * Time: every decision costs a look (`thinkS`) plus a little for every resting spot it traced (`perSpotS`), every slide
 * `slideS` (the swipe and the ball's travel), every Undo `undoS`. The play is the steps a phone would send, graded by
 * the server's own code (scripts/standard-lib.ts gradeSteps).
 */
import { SLIDE_DIRS, slideBoard, slideDims, slideOutcome, type SlideBoard, type SlideState } from "../src/lib/duel/slide";
import type { PuzzleData, SlideDir } from "../src/lib/duel/types";
import type { Step } from "./puzzle-fairness/kit";

type Skid = Extract<PuzzleData, { type: "iceslide" }>;

export interface SkidPerson {
  name: string;
  /** Slides a person traces ahead. */
  depth: number;
  /** Slides back from the exit a person reads at the start (its approaches). */
  back: number;
  studyS: number;
  thinkS: number;
  perSpotS: number;
  slideS: number;
  undoS: number;
}

/** A strong player (an elite human): three slides ahead and three back from the exit, quick hands (calibrated so Normal is comfortable: about 80 % finished). */
export const SKID_ELITE_PERSON: SkidPerson = { name: "person (elite)", depth: 3, back: 3, studyS: 4, thinkS: 0.6, perSpotS: 0.03, slideS: 0.8, undoS: 0.5 };
/** A good player: two slides ahead and two back, a little slower. */
export const SKID_GOOD_PERSON: SkidPerson = { name: "person (good)", depth: 2, back: 2, studyS: 5, thinkS: 1.0, perSpotS: 0.05, slideS: 1.0, undoS: 0.7 };

export interface SkidPersonPlay {
  steps: Step[];
  solved: boolean;
  /** Seconds to the exit (or when the player gave up). */
  seconds: number;
  slides: number;
  undos: number;
}

const keyOf = (s: SlideState, cells: number) => s.mask * cells + s.cell;

/** Bounded breadth-first trace from `from`: a route to a spot `goal` accepts within `depth` slides, and the spots traced. */
function traceTo(board: SlideBoard, from: SlideState, depth: number, cells: number, goal: (s: SlideState) => SlideDir[] | null): { route: SlideDir[] | null; traced: number } {
  const here = goal(from);
  if (here) return { route: here, traced: 1 };
  const states: SlideState[] = [from];
  const parent: number[] = [-1];
  const via: SlideDir[] = ["X"];
  const level: number[] = [0];
  const seen = new Set([keyOf(from, cells)]);
  for (let i = 0; i < states.length; i++) {
    if (level[i]! >= depth) continue;
    for (const dir of SLIDE_DIRS) {
      const out = slideOutcome(board, states[i]!.cell, states[i]!.mask, dir);
      if (!out.path.length) continue;
      const next = { cell: out.cell, mask: out.mask };
      const k = keyOf(next, cells);
      if (seen.has(k)) continue;
      seen.add(k);
      states.push(next);
      parent.push(i);
      via.push(dir);
      level.push(level[i]! + 1);
      const tail = goal(next);
      if (tail) {
        const route: SlideDir[] = [];
        for (let w = states.length - 1; w > 0; w = parent[w]!) route.unshift(via[w]!);
        return { route: [...route, ...tail], traced: states.length };
      }
    }
  }
  return { route: null, traced: states.length };
}

/** How many unvisited resting spots lie within `depth` slides of `from` (and how many were traced to see it). */
function openings(board: SlideBoard, from: SlideState, depth: number, cells: number, visited: ReadonlySet<number>): { fresh: number; traced: number } {
  const states: SlideState[] = [from];
  const level = [0];
  const seen = new Set([keyOf(from, cells)]);
  let fresh = 0;
  for (let i = 0; i < states.length; i++) {
    if (level[i]! >= depth) continue;
    for (const dir of SLIDE_DIRS) {
      const out = slideOutcome(board, states[i]!.cell, states[i]!.mask, dir);
      if (!out.path.length) continue;
      const next = { cell: out.cell, mask: out.mask };
      const k = keyOf(next, cells);
      if (seen.has(k)) continue;
      seen.add(k);
      states.push(next);
      level.push(level[i]! + 1);
      if (!visited.has(k) && !out.fell) fresh++;
    }
  }
  return { fresh, traced: states.length };
}

export function playSkidLikeAPerson(puzzle: PuzzleData, who: SkidPerson, limitMs: number): SkidPersonPlay {
  const p = puzzle as Skid;
  const board = slideBoard(p);
  const { cols, cells } = slideDims(p);
  const exitRow = Math.floor(board.exit / cols);
  const exitCol = board.exit % cols;
  const steps: Step[] = [];
  const tokens: string[] = [];
  let at = 0;
  let undos = 0;
  const send = (tok: string, costS: number) => {
    at += costS * 1000;
    tokens.push(tok);
    steps.push({ answer: tokens.join(""), atMs: Math.round(at) });
  };
  let state: SlideState = { cell: board.start, mask: 0 };
  const history: SlideState[] = [state];
  const visited = new Set([keyOf(state, cells)]);
  // The exit's approaches: the slides from a spot to the exit within `back` (memoised per spot; read once at the start).
  const approach = new Map<number, SlideDir[] | null>();
  const toExit = (s: SlideState): SlideDir[] | null => {
    if (s.cell === board.exit) return [];
    const k = keyOf(s, cells);
    if (!approach.has(k)) approach.set(k, traceTo(board, s, who.back, cells, (t) => (t.cell === board.exit ? [] : null)).route);
    return approach.get(k)!;
  };
  at += who.studyS * 1000;
  for (let guard = 0; guard < 600 && state.cell !== board.exit && at < limitMs; guard++) {
    const look = traceTo(board, state, who.depth, cells, toExit);
    at += (who.thinkS + who.perSpotS * look.traced) * 1000;
    if (look.route) {
      for (const dir of look.route) {
        const out = slideOutcome(board, state.cell, state.mask, dir);
        state = { cell: out.cell, mask: out.mask };
        send(dir, who.slideS);
      }
      break;
    }
    let best: { dir: SlideDir; next: SlideState; score: number } | null = null;
    for (const dir of SLIDE_DIRS) {
      const out = slideOutcome(board, state.cell, state.mask, dir);
      if (!out.path.length) continue;
      const next = { cell: out.cell, mask: out.mask };
      if (visited.has(keyOf(next, cells))) continue;
      const view = openings(board, next, who.depth - 1, cells, visited);
      at += who.perSpotS * view.traced * 1000;
      const near = Math.abs(Math.floor(next.cell / cols) - exitRow) + Math.abs((next.cell % cols) - exitCol);
      const score = (out.fell ? -1000 : 0) + view.fresh * 10 - near;
      if (!best || score > best.score) best = { dir, next, score };
    }
    if (best) {
      state = best.next;
      history.push(state);
      visited.add(keyOf(state, cells));
      send(best.dir, who.slideS);
      continue;
    }
    if (history.length <= 1) break;
    history.pop();
    state = history[history.length - 1]!;
    undos++;
    send("X", who.undoS);
  }
  const solved = state.cell === board.exit;
  return { steps, solved, seconds: at / 1000, slides: tokens.filter((t) => t !== "X").length, undos };
}
