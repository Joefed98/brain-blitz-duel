/**
 * D3's level-aware Attention players for the ladder (d3-ladder-lib.ts): a game listed here is played by its own player.
 * Every other Attention game is the kit (average) or the kit held to the limits (elite), as d3-ladder-lib.ts says.
 *
 *  - Labyrinth: a maze without keys is the kit's trace (its average; its elite at near-perfect pace, about 0.25 s a
 *    square, with no 0.4 s hold between squares: a trace is one continuous drag, not a tap a square; the spec's
 *    person-like solver draws at 0.2 s a square). A keyed maze (D3's Hard and Expert) is traced the same way along the
 *    shortest walk through every key to the exit: the kit's 2 s look plus 1.2 s to plan each key, 0.4 s a square forward
 *    and 0.2 s a square back out of a key's dead end (each × the skill's pace, with spread), and the kit's wrong turns at
 *    junctions (followed, then retraced) at the kit's level rate. A step a draft every four squares (the grader reads
 *    the drafts for its early extras; the last answer is the whole trail).
 *  - Double Take on a mirrored picture (D3's Expert): the kit's play with every comparison 45 % slower and its wrong
 *    taps half as likely again, since each shape has to be matched across the mirror.
 */
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, thinkMs, type Play, type Rng, type Skill, type Step } from "./puzzle-fairness/kit";
import { ATTENTION_ELITE, heldToLimits, type D3Players } from "./d3-ladder-lib";
import { encodeMazeTrail } from "../src/lib/duel/depth/labyrinth";
import { mazeColsOf, mazeCorridorNeighbours } from "../src/lib/duel/maze";
import { mazeBestKeyOrder, mazeKeysOf, mazePathBetween } from "../src/lib/duel/mazeKeys";
import { mazeLevel, leveled, spotMirrored } from "../src/lib/duel/attentionLevels";
import type { MazePuzzleData, PuzzleData } from "../src/lib/duel/types";

/** The kit's wrong-turn rate and depth at a level (kits-speed.ts mazeKitLost, for a level's maze). */
function lostAt(m: MazePuzzleData): { turns: number; depth: number } {
  if (!leveled(m)) return { turns: 1, depth: 12 };
  const lv = mazeLevel(m);
  const scale = (lv.cols * lv.rows) / (19 * 23);
  return { turns: Math.max(0.6, scale * scale) * 1.5, depth: 16 };
}

/** A walk down a side branch from `from` (leaving `parent`), up to `max` squares (the kit's branchWalk). */
function branchWalk(m: MazePuzzleData, from: number, parent: number, max: number, rng: Rng): number[] {
  const walk: number[] = [];
  let cell = from;
  let prev = parent;
  while (walk.length < max) {
    walk.push(cell);
    const next = mazeCorridorNeighbours(m.cells, cell, mazeColsOf(m)).filter((n) => n !== prev);
    if (next.length === 0) break;
    prev = cell;
    cell = rng.pick(next);
  }
  return walk;
}

/** A keyed maze traced along the shortest walk through every key to the exit, as the kit traces a route. */
export function mazeKeysPlay(m: MazePuzzleData, rng: Rng, skill: Skill): Play {
  const cols = mazeColsOf(m);
  const keys = mazeKeysOf(m);
  const order = mazeBestKeyOrder(m.cells, cols, m.start, keys, m.exit);
  const tour = [m.start];
  for (const target of [...order, m.exit]) tour.push(...mazePathBetween(m.cells, cols, tour[tour.length - 1]!, target).slice(1));
  const trail = [m.start];
  const steps: Step[] = [];
  let t = thinkMs(rng, 2 + 1.2 * keys.length, skill);
  const lost = lostAt(m);
  const push = (cell: number, ms: number) => {
    t += ms;
    trail.push(cell);
    if (trail.length % 4 === 0) steps.push({ answer: encodeMazeTrail(trail, cols), atMs: t });
  };
  for (let i = 1; i < tour.length; i++) {
    const here = tour[i - 1]!;
    const next = tour[i]!;
    const back = i >= 2 && tour[i - 2] === next;
    if (!back) {
      const side = mazeCorridorNeighbours(m.cells, here, cols).filter((n) => n !== next && n !== tour[i - 2]);
      if (side.length && rng.chance(Math.min(0.9, skill.err * lost.turns))) {
        const walk = branchWalk(m, rng.pick(side), here, rng.int(3, lost.depth), rng);
        for (const cell of walk) push(cell, thinkMs(rng, 0.25, skill));
        for (let k = walk.length - 2; k >= 0; k--) push(walk[k]!, thinkMs(rng, 0.2, skill));
        push(here, thinkMs(rng, 0.2, skill));
      }
    }
    push(next, thinkMs(rng, back ? 0.2 : 0.4, skill));
  }
  steps.push({ answer: encodeMazeTrail(trail, cols), atMs: t });
  return { steps };
}

/** Double Take on a mirrored picture: the kit's play, comparisons slower and wrong taps likelier across the mirror. */
function spotPlay(p: PuzzleData, rng: Rng, skill: Skill, limit: number): Play {
  if (p.type !== "spotdiff" || !spotMirrored(p)) return KITS.spotdiff!.play(p, rng, skill, limit);
  const play = KITS.spotdiff!.play(p, rng, { ...skill, err: Math.min(0.5, skill.err * 1.5) }, limit);
  return { ...play, steps: play.steps.map((s) => ({ ...s, atMs: s.atMs * 1.45 })) };
}

const keyed = (p: PuzzleData) => p.type === "maze" && mazeKeysOf(p).length > 0;

// The skills are read when a play starts (never at load: d3-ladder-lib imports this file before it defines them).
export const ATTENTION_PLAYERS: D3Players = {
  maze: {
    average: (p, rng, limit) => (keyed(p) ? mazeKeysPlay(p as MazePuzzleData, rng, SKILLS.average) : KITS.maze!.play(p, rng, SKILLS.average, limit)),
    elite: (p, rng, limit) => (keyed(p) ? mazeKeysPlay(p as MazePuzzleData, rng, ATTENTION_ELITE) : KITS.maze!.play(p, rng, ATTENTION_ELITE, limit)),
  },
  spotdiff: {
    average: (p, rng, limit) => spotPlay(p, rng, SKILLS.average, limit),
    elite: (p, rng, limit) => heldToLimits(spotPlay(p, rng, ATTENTION_ELITE, limit)),
  },
};
