/**
 * Player kits for the LOGIC group (scripts/puzzle-fairness/kit.ts): Blackout,
 * Box Six, Heave, Hanoi, Polypotions, Safe Cracker, Bomb Defusal, Mosaic,
 * Colour Flood, Tents and Trees, Shikaku, Lamplighter. Answers are built with
 * the same encoders the phone Stages use; nothing here scores.
 */
import type {
  BombPuzzleData,
  FloodPuzzleData,
  LightsOutPuzzleData,
  LightUpPuzzleData,
  NonoPuzzleData,
  PushPuzzleData,
  SafePuzzleData,
  ShikakuPuzzleData,
  SudokuPuzzleData,
  TentsPuzzleData,
  TowerPuzzleData,
  TubesPuzzleData,
} from "../../src/lib/duel/types";
import { FLOOD_COLOURS, PUSH_COLS, SAFE_DIALS, SAFE_TRIES } from "../../src/lib/duel/types";
import { encodePresses, encodeSudoku, pressLights, lightsAllOff } from "../../src/lib/duel/logic";
import { decodePushSolution, encodePushMoves, movePusher, pushStep, PUSH_DIRS } from "../../src/lib/duel/push";
import type { SlideDir } from "../../src/lib/duel/types";
import {
  decodeTowerMoves,
  encodeTowerMoves,
  towerApply,
  towerCanMove,
  towerPegCount,
  towerPegsFrom,
  type TowerMove,
  type TowerPegs,
} from "../../src/lib/duel/tower";
import { canPour, decodeTubeMoves, encodeTubeLog, encodeTubeMoves, pour, tubesSolved, type TubeMove, type TubeState, type TubeToken } from "../../src/lib/duel/tubes";
import { floodMoveLimit, tubesPourLimit, tubesSendsUndo } from "../../src/lib/duel/moveLimits";
import { clueHolds, encodeSafeDraft, encodeSafeTries } from "../../src/lib/duel/safe";
import { puzzleScoreRevOf } from "../../src/lib/duel/puzzleScoreRev";
import { canonicalBombOrder, decodeBombActions, decodeBombConstraints, encodeBombActions, bombPredecessors } from "../../src/lib/duel/bomb";
import { encodeNonoCells, type NonoMarks } from "../../src/lib/duel/nonogram";
import { encodeFloodMoves, floodApply, floodSolved } from "../../src/lib/duel/flood";
import { encodeTents, orthNeighbours } from "../../src/lib/duel/tents";
import { encodeShikaku, rectHas, rectValid, rectsOverlap, type ShikakuRect } from "../../src/lib/duel/shikaku";
import { encodeBulbs, sightLine } from "../../src/lib/duel/lightUp";
import { thinkMs, type Play, type PuzzleKit, type Rng, type Skill, type SpamPlay, type Step } from "./kit";

/* ------------------------------------------------------------------------ */
/*  Shared helpers                                                          */
/* ------------------------------------------------------------------------ */

/** How many actions a masher fits into the round at `perSecond`. */
const spamCount = (limitMs: number, perSecond: number, cap = 400) => Math.min(cap, Math.floor((limitMs / 1000) * perSecond));

/**
 * A placement game (cells / rects / digits keyed by a number). Targets are
 * placed in a shuffled order; a mistake places a wrong item that is fixed
 * 1–5 actions later (or before finishing). `blocks` lists keys that must be
 * removed before a target can go in (Shikaku overlaps).
 */
interface PlaceGame<V> {
  targets: [number, V][];
  /** A plausible wrong placement given the current state, or null. */
  wrong(state: Map<number, V>, pendingKeys: number[], rng: Rng): [number, V] | null;
  encode(state: Map<number, V>): string;
  blocks?(state: Map<number, V>, key: number, value: V): number[];
}

function placePlay<V>(game: PlaceGame<V>, rng: Rng, skill: Skill, base: number, order?: [number, V][]): Play {
  const state = new Map<number, V>();
  const pending = new Map<number, V>((order ?? rng.shuffle(game.targets)).map(([k, v]) => [k, v]));
  const wrongs: { key: number; fixAt: number }[] = [];
  const steps: Step[] = [];
  let t = 0;
  let actions = 0;
  const push = () => steps.push({ answer: game.encode(state), atMs: t });
  const placeTarget = (key: number, value: V) => {
    for (const b of game.blocks?.(state, key, value) ?? []) {
      state.delete(b);
      const w = wrongs.findIndex((x) => x.key === b);
      if (w >= 0) wrongs.splice(w, 1);
      t += thinkMs(rng, base * 0.4, skill);
      actions += 1;
      push();
    }
    state.set(key, value);
    pending.delete(key);
    const w = wrongs.findIndex((x) => x.key === key);
    if (w >= 0) wrongs.splice(w, 1);
    actions += 1;
    push();
  };
  let guard = 0;
  while ((pending.size > 0 || wrongs.length > 0) && guard++ < 2000) {
    const due = wrongs.find((w) => w.fixAt <= actions) ?? (pending.size === 0 ? wrongs[0] : undefined);
    if (due) {
      // Spotting and fixing a wrong item.
      t += thinkMs(rng, base * 0.6, skill);
      wrongs.splice(wrongs.indexOf(due), 1);
      if (pending.has(due.key)) placeTarget(due.key, pending.get(due.key)!);
      else {
        state.delete(due.key);
        actions += 1;
        push();
      }
      continue;
    }
    if (rng.chance(skill.err)) {
      const w = game.wrong(state, [...pending.keys()], rng);
      if (w) {
        t += thinkMs(rng, base, skill);
        state.set(w[0], w[1]);
        if (!wrongs.some((x) => x.key === w[0])) wrongs.push({ key: w[0], fixAt: actions + rng.int(1, 5) });
        actions += 1;
        push();
        continue;
      }
    }
    const [key, value] = pending.entries().next().value as [number, V];
    t += thinkMs(rng, base, skill);
    placeTarget(key, value);
  }
  return { steps };
}

/* ------------------------------------------------------------------------ */
/*  Blackout (lightsout)                                                    */
/* ------------------------------------------------------------------------ */

// BASE 6 s per press: a good player works out each press of a 6×6 Lights Out by chasing / looking ahead.
const LIGHTS_BASE = 6;

const lightsKit: PuzzleKit = {
  type: "lightsout",
  nothing: () => encodePresses([]),
  spam(p, rng, limitMs) {
    const pz = p as LightsOutPuzzleData;
    const n = pz.lights.length;
    const out: SpamPlay[] = [];
    // Random presses at 2/s, stopping if the board happens to clear (the phone submits then).
    const randomPresses = (perSecond: number) => {
      const presses: number[] = [];
      let lights = pz.lights;
      for (let i = 0; i < spamCount(limitMs, perSecond); i++) {
        const c = rng.below(n);
        presses.push(c);
        lights = pressLights(lights, c);
        if (lightsAllOff(lights)) break;
      }
      return presses;
    };
    out.push({ label: "random-presses", answer: encodePresses(randomPresses(2)) });
    out.push({ label: "press-every-cell", answer: encodePresses([...Array(n).keys()]) });
    // Press only lit cells, at random (a natural masher instinct).
    const lit: number[] = [];
    let lights = pz.lights;
    for (let i = 0; i < spamCount(limitMs, 1.5); i++) {
      const on = [...lights.keys()].filter((c) => lights[c]);
      if (!on.length) break;
      const c = rng.pick(on);
      lit.push(c);
      lights = pressLights(lights, c);
    }
    out.push({ label: "press-lit", answer: encodePresses(lit) });
    return out;
  },
  play(p, rng, skill) {
    const pz = p as LightsOutPuzzleData;
    const n = pz.lights.length;
    const solution = rng.shuffle(pz.solution ?? []);
    const presses: number[] = [];
    const steps: Step[] = [];
    let t = 0;
    let rePress: { cell: number; at: number }[] = [];
    let i = 0;
    let guard = 0;
    while ((i < solution.length || rePress.length) && guard++ < 500) {
      const due = rePress.find((r) => r.at <= presses.length) ?? (i >= solution.length ? rePress[0] : undefined);
      if (due) {
        // Pressing the wrong cell again later to cancel it out.
        rePress = rePress.filter((r) => r !== due);
        t += thinkMs(rng, LIGHTS_BASE * 0.7, skill);
        presses.push(due.cell);
        steps.push({ answer: encodePresses(presses), atMs: t });
        continue;
      }
      if (rng.chance(skill.err)) {
        const wrongs = [...Array(n).keys()].filter((c) => !solution.includes(c));
        const cell = rng.pick(wrongs);
        t += thinkMs(rng, LIGHTS_BASE, skill);
        presses.push(cell);
        steps.push({ answer: encodePresses(presses), atMs: t });
        if (rng.chance(0.5)) {
          // Sees it straight away and taps Undo.
          t += thinkMs(rng, 1.5, skill);
          presses.push(-1);
          steps.push({ answer: encodePresses(presses), atMs: t });
        } else rePress.push({ cell, at: presses.length + rng.int(1, 4) });
        continue;
      }
      t += thinkMs(rng, LIGHTS_BASE, skill);
      presses.push(solution[i++]!);
      steps.push({ answer: encodePresses(presses), atMs: t });
    }
    return { steps };
  },
};

/* ------------------------------------------------------------------------ */
/*  Box Six (sudoku)                                                        */
/* ------------------------------------------------------------------------ */

// BASE 3.5 s per cell: a good player fills a 6×6 mini sudoku (~20 blanks) in about 70 s.
const SUDOKU_BASE = 3.5;

const sudokuGrid = (givens: number[], state: Map<number, number>) => givens.map((g, c) => (g ? g : (state.get(c) ?? 0)));

const sudokuKit: PuzzleKit = {
  type: "sudoku",
  nothing: (p) => encodeSudoku((p as SudokuPuzzleData).givens),
  spam(p, rng) {
    const { givens } = p as SudokuPuzzleData;
    const random = givens.map((g) => (g ? g : rng.int(1, 6)));
    const one = rng.int(1, 6);
    const same = givens.map((g) => (g ? g : one));
    // Each blank gets a digit missing from its row (a shuffled row fill, ignoring columns and boxes).
    const rowFill = [...givens];
    for (let r = 0; r < 6; r++) {
      const row = [...Array(6).keys()].map((c) => r * 6 + c);
      const missing = rng.shuffle([1, 2, 3, 4, 5, 6].filter((d) => !row.some((c) => givens[c] === d)));
      for (const c of row) if (!givens[c]) rowFill[c] = missing.pop() ?? 1;
    }
    return [
      { label: "random-digits", answer: encodeSudoku(random) },
      { label: "same-digit", answer: encodeSudoku(same) },
      { label: "row-fill", answer: encodeSudoku(rowFill) },
    ];
  },
  play(p, rng, skill) {
    const { givens, solution = [] } = p as SudokuPuzzleData;
    const targets = [...givens.keys()].filter((c) => !givens[c]).map((c) => [c, solution[c]!] as [number, number]);
    return placePlay<number>(
      {
        targets,
        wrong: (_s, pendingKeys, r) => {
          if (!pendingKeys.length) return null;
          const cell = r.pick(pendingKeys);
          const digits = [1, 2, 3, 4, 5, 6].filter((d) => d !== solution[cell]);
          return [cell, r.pick(digits)];
        },
        encode: (s) => encodeSudoku(sudokuGrid(givens, s)),
      },
      rng,
      skill,
      SUDOKU_BASE,
    );
  },
};

/* ------------------------------------------------------------------------ */
/*  Heave (push)                                                            */
/* ------------------------------------------------------------------------ */

// BASE 2.5 s to plan each push, 0.3 s per walking swipe: a good player clears 4–5 crates (~20 pushes) in ~90 s.
const PUSH_THINK = 2.5;
const PUSH_STEP = 0.3;
const OPP: Record<SlideDir, SlideDir> = { U: "D", D: "U", L: "R", R: "L" };

/** Shortest walk for the pusher to `goal` around walls and crates. */
function pushWalk(walls: Set<number>, crates: number[], from: number, goal: number): SlideDir[] | null {
  if (from === goal) return [];
  const blocked = new Set(crates);
  const prev = new Map<number, [number, SlideDir]>();
  const queue = [from];
  const seen = new Set([from]);
  while (queue.length) {
    const cell = queue.shift()!;
    for (const dir of PUSH_DIRS) {
      const next = pushStep(cell, dir);
      if (next === null || walls.has(next) || blocked.has(next) || seen.has(next)) continue;
      seen.add(next);
      prev.set(next, [cell, dir]);
      if (next === goal) {
        const path: SlideDir[] = [];
        let at = goal;
        while (at !== from) {
          const [p, d] = prev.get(at)!;
          path.unshift(d);
          at = p;
        }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

const pushKit: PuzzleKit = {
  type: "push",
  nothing: () => encodePushMoves([]),
  spam(p, rng, limitMs) {
    const pz = p as PushPuzzleData;
    const walls = new Set(pz.walls);
    const random = (perSecond: number) => {
      const moves: SlideDir[] = [];
      let state = { pusher: pz.pusher, crates: [...pz.crates] };
      let tries = 0;
      while (moves.length < spamCount(limitMs, perSecond) && tries++ < 5000) {
        const dir = rng.pick(PUSH_DIRS);
        const r = movePusher(state, dir, walls);
        if (!r.moved) continue; // the phone rejects a blocked swipe
        state = r.state;
        moves.push(dir);
      }
      return moves;
    };
    // Holding one direction then switching (swipe runs of 2–6).
    const runs: SlideDir[] = [];
    {
      let state = { pusher: pz.pusher, crates: [...pz.crates] };
      let tries = 0;
      while (runs.length < spamCount(limitMs, 3) && tries++ < 5000) {
        const dir = rng.pick(PUSH_DIRS);
        for (let k = rng.int(2, 6); k > 0; k--) {
          const r = movePusher(state, dir, walls);
          if (!r.moved) break;
          state = r.state;
          runs.push(dir);
        }
      }
    }
    return [
      { label: "random-swipes-3/s", answer: encodePushMoves(random(3)) },
      { label: "random-swipes-1.5/s", answer: encodePushMoves(random(1.5)) },
      { label: "swipe-runs", answer: encodePushMoves(runs) },
    ];
  },
  play(p, rng, skill) {
    const pz = p as PushPuzzleData;
    const walls = new Set(pz.walls);
    const plan = decodePushSolution(pz.solution ?? "");
    let state = { pusher: pz.pusher, crates: [...pz.crates] };
    const moves: SlideDir[] = [];
    const steps: Step[] = [];
    let t = 0;
    const doMove = (dir: SlideDir, ms: number) => {
      const r = movePusher(state, dir, walls);
      if (!r.moved) return false;
      state = r.state;
      moves.push(dir);
      t += ms;
      steps.push({ answer: encodePushMoves(moves), atMs: t });
      return true;
    };
    for (const push of plan) {
      if (rng.chance(skill.err)) {
        // A wrong push: walk to some other legal push, make it, realise, then undo back.
        const options: { stand: number; dir: SlideDir }[] = [];
        for (const crate of state.crates) {
          for (const dir of PUSH_DIRS) {
            const stand = pushStep(crate, OPP[dir]);
            const beyond = pushStep(crate, dir);
            if (stand === null || beyond === null || walls.has(stand) || walls.has(beyond) || state.crates.includes(beyond)) continue;
            if (crate === push.cell && dir === push.dir) continue;
            if (pushWalk(walls, state.crates, state.pusher, stand)) options.push({ stand, dir });
          }
        }
        if (options.length) {
          const o = rng.pick(options);
          const saved = { pusher: state.pusher, crates: [...state.crates] };
          const before = moves.length;
          t += thinkMs(rng, PUSH_THINK, skill);
          for (const d of pushWalk(walls, state.crates, state.pusher, o.stand)!) doMove(d, thinkMs(rng, PUSH_STEP, skill));
          doMove(o.dir, thinkMs(rng, PUSH_STEP, skill));
          t += thinkMs(rng, 1.5, skill);
          while (moves.length > before) {
            moves.pop();
            t += thinkMs(rng, PUSH_STEP, skill);
            steps.push({ answer: encodePushMoves(moves), atMs: t });
          }
          state = saved;
        }
      }
      const stand = pushStep(push.cell, OPP[push.dir]);
      const walk = stand === null ? null : pushWalk(walls, state.crates, state.pusher, stand);
      if (!walk) break; // should never happen with a stored solution
      t += thinkMs(rng, PUSH_THINK, skill);
      for (const d of walk) doMove(d, thinkMs(rng, PUSH_STEP, skill));
      doMove(push.dir, thinkMs(rng, PUSH_STEP, skill));
    }
    return { steps };
  },
};

/* ------------------------------------------------------------------------ */
/*  Hanoi (tower)                                                           */
/* ------------------------------------------------------------------------ */

// BASE 2 s per move (lift + drop, with thought): a good player plays ~30 moves in about a minute.
const TOWER_BASE = 2;

function towerLegalMoves(pegs: TowerPegs): TowerMove[] {
  const out: TowerMove[] = [];
  for (let from = 0; from < pegs.length; from++) for (let to = 0; to < pegs.length; to++) if (towerCanMove(pegs, from, to)) out.push({ from, to });
  return out;
}

const towerKit: PuzzleKit = {
  type: "tower",
  nothing: () => encodeTowerMoves([]),
  spam(p, rng, limitMs) {
    const pz = p as TowerPuzzleData;
    const random = (perSecond: number) => {
      let pegs = towerPegsFrom(pz.start);
      const moves: TowerMove[] = [];
      for (let i = 0; i < spamCount(limitMs, perSecond); i++) {
        const m = rng.pick(towerLegalMoves(pegs));
        pegs = towerApply(pegs, m.from, m.to);
        moves.push(m);
        if ((pegs[pz.targetPeg] ?? []).length === pz.discs) break;
      }
      return moves;
    };
    // Always move the smallest disc one peg along, alternating with the only other legal move (the classic algorithm, blind).
    const cyc: TowerMove[] = [];
    {
      let pegs = towerPegsFrom(pz.start);
      const n = towerPegCount(pz.start);
      for (let i = 0; i < spamCount(limitMs, 1.5); i++) {
        let m: TowerMove | undefined;
        if (i % 2 === 0) {
          const from = pegs.findIndex((peg) => peg[peg.length - 1] === 1);
          m = { from, to: (from + 1) % n };
        } else m = towerLegalMoves(pegs).find((x) => pegs[x.from]![pegs[x.from]!.length - 1] !== 1);
        if (!m || !towerCanMove(pegs, m.from, m.to)) break;
        pegs = towerApply(pegs, m.from, m.to);
        cyc.push(m);
        if ((pegs[pz.targetPeg] ?? []).length === pz.discs) break;
      }
    }
    return [
      { label: "random-moves-1.5/s", answer: encodeTowerMoves(random(1.5)) },
      { label: "random-moves-3/s", answer: encodeTowerMoves(random(3)) },
      { label: "blind-cycle", answer: encodeTowerMoves(cyc) },
    ];
  },
  play(p, rng, skill) {
    const pz = p as TowerPuzzleData;
    const plan = decodeTowerMoves(pz.solution ?? "");
    let pegs = towerPegsFrom(pz.start);
    const moves: TowerMove[] = [];
    const steps: Step[] = [];
    let t = 0;
    const record = () => steps.push({ answer: encodeTowerMoves(moves), atMs: t });
    for (const m of plan) {
      if (rng.chance(skill.err)) {
        const wrong = towerLegalMoves(pegs).filter((x) => x.from !== m.from || x.to !== m.to);
        if (wrong.length) {
          const w = rng.pick(wrong);
          t += thinkMs(rng, TOWER_BASE, skill);
          moves.push(w);
          record();
          t += thinkMs(rng, TOWER_BASE * 0.6, skill);
          if (rng.chance(0.5)) moves.pop(); // Undo
          else moves.push({ from: w.to, to: w.from }); // moves the disc straight back (two wasted moves)
          record();
        }
      }
      t += thinkMs(rng, TOWER_BASE, skill);
      pegs = towerApply(pegs, m.from, m.to);
      moves.push(m);
      record();
    }
    return { steps };
  },
};

/* ------------------------------------------------------------------------ */
/*  Polypotions (tubes)                                                     */
/* ------------------------------------------------------------------------ */

// BASE 2.5 s per pour: a good player sorts a ~20-pour board in under a minute and a half.
const TUBES_BASE = 2.5;

function tubeLegal(state: TubeState): TubeMove[] {
  const out: TubeMove[] = [];
  for (let from = 0; from < state.length; from++) for (let to = 0; to < state.length; to++) if (canPour(state, from, to)) out.push({ from, to });
  return out;
}

/** tubesRev 1 sends Undo and Reset in the log (every pour counts); stored rounds send only the pours left after Undo. */
const tubesEncode = (pz: TubesPuzzleData, log: TubeToken[]) => {
  if (tubesSendsUndo(pz)) return encodeTubeLog(log);
  const moves: TubeMove[] = [];
  for (const t of log) if (t === "undo") moves.pop(); else if (t === "reset") moves.length = 0; else moves.push(t);
  return encodeTubeMoves(moves);
};

const tubesKit: PuzzleKit = {
  type: "tubes",
  nothing: () => encodeTubeMoves([]),
  spam(p, rng, limitMs) {
    const pz = p as TubesPuzzleData;
    // The phone stops taking pours at the pour limit (tubesRev 1) and submits the board unfinished.
    const cap = tubesPourLimit(pz) ?? Infinity;
    const random = (perSecond: number) => {
      let state = pz.tubes.map((t) => [...t]);
      const moves: TubeMove[] = [];
      for (let i = 0; i < spamCount(limitMs, perSecond) && moves.length < cap; i++) {
        const legal = tubeLegal(state);
        if (!legal.length) break;
        const m = rng.pick(legal);
        state = pour(state, m.from, m.to);
        moves.push(m);
        if (tubesSolved(state)) break;
      }
      return moves;
    };
    return [
      { label: "random-pours-1.5/s", answer: encodeTubeMoves(random(1.5)) },
      { label: "random-pours-3/s", answer: encodeTubeMoves(random(3)) },
    ];
  },
  play(p, rng, skill) {
    const pz = p as TubesPuzzleData;
    const plan = decodeTubeMoves(pz.solution ?? "");
    let state = pz.tubes.map((t) => [...t]);
    const moves: TubeToken[] = [];
    const steps: Step[] = [];
    let t = 0;
    const record = () => steps.push({ answer: tubesEncode(pz, moves), atMs: t });
    for (const m of plan) {
      if (rng.chance(skill.err)) {
        const wrong = tubeLegal(state).filter((x) => x.from !== m.from || x.to !== m.to);
        if (wrong.length) {
          // A wrong pour, then Undo once it looks wrong (sometimes after one more look).
          t += thinkMs(rng, TUBES_BASE, skill);
          moves.push(rng.pick(wrong));
          record();
          t += thinkMs(rng, TUBES_BASE * (rng.chance(0.5) ? 0.5 : 1.2), skill);
          moves.push("undo");
          record();
        }
      }
      t += thinkMs(rng, TUBES_BASE, skill);
      state = pour(state, m.from, m.to);
      moves.push(m);
      record();
    }
    return { steps };
  },
};

/* ------------------------------------------------------------------------ */
/*  Safe Cracker (safe)                                                     */
/* ------------------------------------------------------------------------ */

// BASE 7 s per clue to deduce the combination (five clues ≈ 35 s), 0.25 s per dial click, 1 s for Try.
const SAFE_CLUE = 7;
const SAFE_CLICK = 0.25;

const safeKit: PuzzleKit = {
  type: "safe",
  nothing: () => encodeSafeTries([]),
  spam(p, rng) {
    const pz = p as SafePuzzleData;
    const rand = () => Array.from({ length: SAFE_DIALS }, () => rng.below(10));
    // Spin each dial to satisfy the single-dial clues only (parity, prime, square), random otherwise.
    const easy = () => {
      for (let k = 0; k < 2000; k++) {
        const d = rand();
        const single = pz.clues.filter((c) => ["even", "odd", "prime", "square"].includes(c.kind));
        if (single.every((c) => clueHolds(c, d))) return d;
      }
      return rand();
    };
    return [
      { label: "random-tries", answer: encodeSafeTries([rand(), rand(), rand()]) },
      { label: "try-0000", answer: encodeSafeTries([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]) },
      { label: "single-dial-clues", answer: encodeSafeTries([easy(), easy(), easy()]) },
    ];
  },
  play(p, rng, skill) {
    const pz = p as SafePuzzleData;
    const combo = pz.combination ?? [0, 0, 0, 0];
    const tries: number[][] = [];
    const steps: Step[] = [];
    let dials = [0, 0, 0, 0];
    let t = 0;
    // Near misses: every combination failing exactly one clue (a misread clue).
    let nearMiss: number[][] | null = null;
    const near = () => {
      if (!nearMiss) {
        nearMiss = [];
        for (let v = 0; v < 10000; v++) {
          const d = [Math.floor(v / 1000), Math.floor(v / 100) % 10, Math.floor(v / 10) % 10, v % 10];
          if (pz.clues.filter((c) => !clueHolds(c, d)).length === 1) nearMiss.push(d);
        }
      }
      return nearMiss.length ? rng.pick(nearMiss) : null;
    };
    // puzzleScoreRev 2 drafts carry the dials as they stand (encodeSafeDraft); older rounds only the tries.
    const pending = puzzleScoreRevOf(p) >= 2;
    // The card is read dial by dial: each dial is set once its share of the clues is worked out (a first read
    // of every clue before the first try, half that on a re-read).
    const readMs = () => pz.clues.reduce((sum) => sum + thinkMs(rng, SAFE_CLUE, skill), 0);
    let read = readMs();
    for (let attempt = 0; attempt < SAFE_TRIES; attempt++) {
      const wrong = attempt < SAFE_TRIES - 1 || rng.chance(0.5) ? rng.chance(Math.min(0.5, 2 * skill.err)) : false;
      const goal = (wrong ? near() : null) ?? combo;
      for (let i = 0; i < SAFE_DIALS; i++) {
        t += read / SAFE_DIALS;
        const delta = (goal[i]! - dials[i]! + 10) % 10;
        const clicks = Math.min(delta, 10 - delta);
        for (let k = 0; k < clicks; k++) t += thinkMs(rng, SAFE_CLICK, skill, 0.2);
        dials[i] = goal[i]!;
        if (pending) steps.push({ answer: encodeSafeDraft(tries, dials), atMs: t });
      }
      dials = [...goal];
      t += thinkMs(rng, 1, skill);
      tries.push([...dials]);
      steps.push({ answer: encodeSafeTries(tries), atMs: t });
      if (goal.every((d, i) => d === combo[i])) break;
      // Shaken: re-read the card (half the first read).
      read = readMs() / 2;
    }
    return { steps };
  },
};

/* ------------------------------------------------------------------------ */
/*  Bomb Defusal (bomb)                                                     */
/* ------------------------------------------------------------------------ */

// BASE 5 s to read and apply each rule, 1.2 s per wire cut / button press, 1 s for Defuse.
const BOMB_RULE = 5;
const BOMB_ACT = 1.2;

const bombAll = (pz: BombPuzzleData) => [...pz.wires.map((_, i) => `w${i}`), "bA", "bB"];

const bombKit: PuzzleKit = {
  type: "bomb",
  nothing: () => encodeBombActions([]),
  spam(p, rng) {
    const pz = p as BombPuzzleData;
    const all = bombAll(pz);
    const steps = pz.stepCount || 4;
    return [
      { label: "tap-all-in-order", answer: encodeBombActions(all) },
      { label: "tap-all-shuffled", answer: encodeBombActions(rng.shuffle(all)) },
      { label: "random-steps", answer: encodeBombActions(rng.shuffle(all).slice(0, steps)) },
    ];
  },
  play(p, rng, skill) {
    const pz = p as BombPuzzleData;
    const required = decodeBombActions(pz.required ?? pz.sequence ?? "");
    const constraints = decodeBombConstraints(pz.constraints ?? "");
    const plan = canonicalBombOrder(required, constraints) ?? required;
    const before = bombPredecessors(required, constraints);
    const all = bombAll(pz);
    const steps: Step[] = [];
    let t = pz.rules.reduce((sum) => sum + thinkMs(rng, BOMB_RULE, skill), 0);
    let actions: string[] = [];
    let blown = false;
    let i = 0;
    let resets = 0;
    while (i < plan.length) {
      if (!blown && rng.chance(skill.err)) {
        // A wrong action: an unneeded one, or a needed one too early.
        const done = new Set(actions);
        const wrongs = all.filter((a) => !done.has(a) && (!required.includes(a) || ![...(before.get(a) ?? [])].every((x) => done.has(x))));
        if (wrongs.length) {
          t += thinkMs(rng, BOMB_ACT * 1.5, skill);
          actions.push(rng.pick(wrongs));
          steps.push({ answer: encodeBombActions(actions), atMs: t });
          if (resets < 3 && rng.chance(0.75)) {
            // Re-checks the card, spots it, taps Reset and starts the plan again.
            t += thinkMs(rng, BOMB_RULE, skill);
            actions = [];
            resets += 1;
            i = 0;
            steps.push({ answer: encodeBombActions(actions), atMs: t });
            continue;
          }
          blown = true;
        }
      }
      t += thinkMs(rng, BOMB_ACT, skill);
      actions.push(plan[i++]!);
      steps.push({ answer: encodeBombActions(actions), atMs: t });
    }
    // Defuse tap: the answer as it stands (the runner grades the last step; a wrong plan ends the round here).
    t += thinkMs(rng, 1, skill);
    steps.push({ answer: encodeBombActions(actions), atMs: t });
    return { steps };
  },
};

/* ------------------------------------------------------------------------ */
/*  Mosaic (nonogram)                                                       */
/* ------------------------------------------------------------------------ */

// BASE 2.2 s per filled cell (line logic included): a good player solves a 7×7 picture (~24 cells) in about a minute.
const NONO_BASE = 2.2;

const nonoEncode = (n: number, cells: Iterable<number>) => {
  const marks = new Array(n).fill(0) as NonoMarks;
  for (const c of cells) marks[c] = 1;
  return encodeNonoCells(marks);
};

const nonoKit: PuzzleKit = {
  type: "nonogram",
  nothing: (p) => nonoEncode((p as NonoPuzzleData).rows.length ** 2, []),
  spam(p, rng) {
    const pz = p as NonoPuzzleData;
    const size = pz.rows.length;
    const n = size * size;
    const all = [...Array(n).keys()];
    const k = pz.rows.flat().reduce((a, b) => a + b, 0);
    // Fill only rows/cols whose clue is long (a "looks busy" fill).
    const busy = all.filter((c) => {
      const r = pz.rows[Math.floor(c / size)]!.reduce((a, b) => a + b, 0);
      const col = pz.cols[c % size]!.reduce((a, b) => a + b, 0);
      return r + col > size;
    });
    return [
      { label: "fill-all", answer: nonoEncode(n, all) },
      { label: "random-half", answer: nonoEncode(n, all.filter(() => rng.chance(0.5))) },
      { label: "random-clue-count", answer: nonoEncode(n, rng.shuffle(all).slice(0, k)) },
      { label: "busy-lines", answer: nonoEncode(n, busy) },
    ];
  },
  play(p, rng, skill) {
    const pz = p as NonoPuzzleData;
    const n = pz.rows.length ** 2;
    const pattern = pz.pattern ?? [];
    const targets = [...Array(n).keys()].filter((c) => pattern[c]).map((c) => [c, 1] as [number, number]);
    return placePlay<number>(
      {
        targets,
        wrong: (s, _pk, r) => {
          const free = [...Array(n).keys()].filter((c) => !pattern[c] && !s.has(c));
          return free.length ? [r.pick(free), 1] : null;
        },
        encode: (s) => nonoEncode(n, s.keys()),
      },
      rng,
      skill,
      NONO_BASE,
    );
  },
};

/* ------------------------------------------------------------------------ */
/*  Colour Flood (flood)                                                    */
/* ------------------------------------------------------------------------ */

// BASE 3 s per colour tap: a good player weighs which colour swallows most (~12 taps in 40 s).
const FLOOD_BASE = 3;

const floodKit: PuzzleKit = {
  type: "flood",
  nothing: () => encodeFloodMoves([]),
  spam(p, rng, limitMs) {
    const pz = p as FloodPuzzleData;
    // The phone stops taking taps at the move limit (floodRev 1) and submits the board unfinished.
    const cap = floodMoveLimit(pz) ?? Infinity;
    const run = (pickColour: (grid: number[], i: number) => number, perSecond: number) => {
      let grid = pz.grid;
      const moves: number[] = [];
      for (let i = 0; i < spamCount(limitMs, perSecond) && moves.length < cap; i++) {
        const c = pickColour(grid, i);
        if (c === grid[0]) continue; // the phone ignores the current colour
        grid = floodApply(grid, c);
        moves.push(c);
        if (floodSolved(grid)) break; // the phone submits on the flood
      }
      return moves;
    };
    return [
      { label: "random-colours-2/s", answer: encodeFloodMoves(run(() => rng.below(FLOOD_COLOURS), 2)) },
      { label: "cycle-colours-2/s", answer: encodeFloodMoves(run((_g, i) => i % FLOOD_COLOURS, 2)) },
      { label: "random-colours-0.5/s", answer: encodeFloodMoves(run(() => rng.below(FLOOD_COLOURS), 0.5)) },
    ];
  },
  play(p, rng, skill) {
    const pz = p as FloodPuzzleData;
    let grid = pz.grid;
    const moves: number[] = [];
    const steps: Step[] = [];
    let t = 0;
    for (const colour of pz.solution ?? []) {
      if (floodSolved(grid)) break;
      if (rng.chance(skill.err)) {
        // A colour that swallows less than the plan's (no Undo on the phone).
        const wrongs = [...Array(FLOOD_COLOURS).keys()].filter((c) => c !== colour && c !== grid[0]);
        if (wrongs.length) {
          const c = rng.pick(wrongs);
          t += thinkMs(rng, FLOOD_BASE, skill);
          grid = floodApply(grid, c);
          moves.push(c);
          steps.push({ answer: encodeFloodMoves(moves), atMs: t });
          if (floodSolved(grid)) break;
        }
      }
      if (colour === grid[0]) continue; // already that colour after a slip: the plan's tap is a no-op
      t += thinkMs(rng, FLOOD_BASE, skill);
      grid = floodApply(grid, colour);
      moves.push(colour);
      steps.push({ answer: encodeFloodMoves(moves), atMs: t });
    }
    return { steps };
  },
};

/* ------------------------------------------------------------------------ */
/*  Tents and Trees (tents)                                                 */
/* ------------------------------------------------------------------------ */

// BASE 5 s per tent: a good player places ~12 tents on an 8×8 board in about a minute.
const TENTS_BASE = 5;

const tentsKit: PuzzleKit = {
  type: "tents",
  nothing: () => encodeTents([]),
  spam(p, rng) {
    const pz = p as TentsPuzzleData;
    const trees = new Set(pz.trees);
    const around = [...new Set(pz.trees.flatMap((t) => orthNeighbours(t, pz.size)))].filter((c) => !trees.has(c));
    const free = [...Array(pz.size * pz.size).keys()].filter((c) => !trees.has(c));
    const onePerTree = pz.trees.map((t) => rng.pick(orthNeighbours(t, pz.size).filter((c) => !trees.has(c))));
    return [
      { label: "around-every-tree", answer: encodeTents(around) },
      { label: "one-per-tree", answer: encodeTents(onePerTree) },
      { label: "random-cells", answer: encodeTents(rng.shuffle(free).slice(0, pz.trees.length)) },
      { label: "fill-all", answer: encodeTents(free) },
    ];
  },
  play(p, rng, skill) {
    const pz = p as TentsPuzzleData;
    const trees = new Set(pz.trees);
    const sol = new Set(pz.solution ?? []);
    const around = [...new Set(pz.trees.flatMap((t) => orthNeighbours(t, pz.size)))].filter((c) => !trees.has(c) && !sol.has(c));
    return placePlay<number>(
      {
        targets: [...sol].map((c) => [c, 1]),
        wrong: (s, _pk, r) => {
          const free = around.filter((c) => !s.has(c));
          return free.length ? [r.pick(free), 1] : null;
        },
        encode: (s) => encodeTents([...s.keys()]),
      },
      rng,
      skill,
      TENTS_BASE,
    );
  },
};

/* ------------------------------------------------------------------------ */
/*  Shikaku (shikaku)                                                       */
/* ------------------------------------------------------------------------ */

// BASE 4 s per rectangle (spot it, drag it): a good player splits a 10×10 board (~18 rects) in about 75 s.
const SHIKAKU_BASE = 4;

/** Every rectangle the phone would accept for this clue (one clue inside, right area). */
function clueRects(pz: ShikakuPuzzleData, clue: { cell: number; n: number }): ShikakuRect[] {
  const out: ShikakuRect[] = [];
  const r = Math.floor(clue.cell / pz.size);
  const c = clue.cell % pz.size;
  for (let h = 1; h <= clue.n; h++) {
    if (clue.n % h) continue;
    const w = clue.n / h;
    for (let r0 = r - h + 1; r0 <= r; r0++) {
      for (let c0 = c - w + 1; c0 <= c; c0++) {
        const rect = { r0, c0, r1: r0 + h - 1, c1: c0 + w - 1 };
        if (r0 < 0 || c0 < 0 || rect.r1 >= pz.size || rect.c1 >= pz.size) continue;
        if (rectValid(rect, pz.clues, pz.size)) out.push(rect);
      }
    }
  }
  return out;
}

const shikakuKit: PuzzleKit = {
  type: "shikaku",
  nothing: () => encodeShikaku([]),
  spam(p, rng, limitMs) {
    const pz = p as ShikakuPuzzleData;
    // Random valid rectangle per clue in a random order (the phone rejects invalid or overlapping drags).
    const greedy: ShikakuRect[] = [];
    for (const clue of rng.shuffle(pz.clues)) {
      const options = clueRects(pz, clue).filter((r) => !greedy.some((g) => rectsOverlap(g, r)));
      if (options.length) greedy.push(rng.pick(options));
    }
    // Random drags at 1/s between random cells; only the accepted ones stay.
    const drags: ShikakuRect[] = [];
    for (let i = 0; i < spamCount(limitMs, 1); i++) {
      const a = rng.below(pz.size * pz.size);
      const b = rng.below(pz.size * pz.size);
      const rect = {
        r0: Math.min(Math.floor(a / pz.size), Math.floor(b / pz.size)),
        c0: Math.min(a % pz.size, b % pz.size),
        r1: Math.max(Math.floor(a / pz.size), Math.floor(b / pz.size)),
        c1: Math.max(a % pz.size, b % pz.size),
      };
      if (rectValid(rect, pz.clues, pz.size) && !drags.some((g) => rectsOverlap(g, rect))) drags.push(rect);
    }
    return [
      { label: "random-valid-rects", answer: encodeShikaku(greedy) },
      { label: "random-drags", answer: encodeShikaku(drags) },
    ];
  },
  play(p, rng, skill) {
    const pz = p as ShikakuPuzzleData;
    const sol = pz.solution ?? [];
    const targets = pz.clues.map((clue) => [clue.cell, sol.find((r) => rectHas(r, clue.cell, pz.size))!] as [number, ShikakuRect]);
    const correct = new Map(targets);
    const blocks = (s: Map<number, ShikakuRect>, key: number, rect: ShikakuRect) =>
      [...s.entries()].filter(([k, r]) => k === key || rectsOverlap(r, rect)).map(([k]) => k);
    return placePlay<ShikakuRect>(
      {
        targets,
        wrong: (s, pendingKeys, r) => {
          const options: [number, ShikakuRect][] = [];
          for (const key of pendingKeys) {
            if (s.has(key)) continue;
            const clue = pz.clues.find((c) => c.cell === key)!;
            const good = correct.get(key)!;
            for (const rect of clueRects(pz, clue)) {
              const same = rect.r0 === good.r0 && rect.c0 === good.c0 && rect.r1 === good.r1 && rect.c1 === good.c1;
              if (!same && ![...s.values()].some((o) => rectsOverlap(o, rect))) options.push([key, rect]);
            }
          }
          return options.length ? r.pick(options) : null;
        },
        encode: (s) => encodeShikaku([...s.values()]),
        blocks,
      },
      rng,
      skill,
      SHIKAKU_BASE,
    );
  },
};

/* ------------------------------------------------------------------------ */
/*  Lamplighter (lightup)                                                   */
/* ------------------------------------------------------------------------ */

// BASE 4 s per bulb: a good player lights a 9×9 board (~18 bulbs) in about 70 s.
const LIGHTUP_BASE = 4;

const lightupKit: PuzzleKit = {
  type: "lightup",
  nothing: () => encodeBulbs([]),
  spam(p, rng) {
    const pz = p as LightUpPuzzleData;
    const walls = new Set(pz.walls);
    const whites = [...Array(pz.size * pz.size).keys()].filter((c) => !walls.has(c));
    // Tap random dark cells until everything is lit (ignores the numbers).
    const dark: number[] = [];
    const lit = new Set<number>();
    for (const c of rng.shuffle(whites)) {
      if (lit.has(c)) continue;
      dark.push(c);
      for (const x of sightLine(c, pz.size, walls)) lit.add(x);
    }
    return [
      { label: "bulbs-everywhere", answer: encodeBulbs(whites) },
      { label: "random-30pc", answer: encodeBulbs(whites.filter(() => rng.chance(0.3))) },
      { label: "fill-dark", answer: encodeBulbs(dark) },
    ];
  },
  play(p, rng, skill) {
    const pz = p as LightUpPuzzleData;
    const walls = new Set(pz.walls);
    const sol = new Set(pz.solution ?? []);
    const whites = [...Array(pz.size * pz.size).keys()].filter((c) => !walls.has(c) && !sol.has(c));
    return placePlay<number>(
      {
        targets: [...sol].map((c) => [c, 1]),
        wrong: (s, _pk, r) => {
          const free = whites.filter((c) => !s.has(c));
          return free.length ? [r.pick(free), 1] : null;
        },
        encode: (s) => encodeBulbs([...s.keys()]),
      },
      rng,
      skill,
      LIGHTUP_BASE,
    );
  },
};

export const KITS_LOGIC: PuzzleKit[] = [
  lightsKit,
  sudokuKit,
  pushKit,
  towerKit,
  tubesKit,
  safeKit,
  bombKit,
  nonoKit,
  floodKit,
  tentsKit,
  shikakuKit,
  lightupKit,
];

