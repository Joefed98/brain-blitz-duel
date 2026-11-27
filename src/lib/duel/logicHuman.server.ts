/**
 * A solver that reasons like a person (Logic overhaul 2, stage 3, 16 Nov 2026; Joe, 15 Nov 2026: an Expert board is
 * allowed only if such a solver completes it). Server and checks only; nothing here is dealt or graded.
 *
 * One engine for the seven games: apply the game's rules of deduction until nothing changes; if the board isn't
 * finished, try each open choice once ("if this square were a tent…"), apply the rules again and, when that runs into a
 * contradiction, rule the choice out. That one-step trial is as far as it looks: it never guesses, never tries two
 * things at once and never searches. A board it can't finish needs guessing, so it isn't fair for a person in a timed
 * round. Its counts (`rounds`, `trials`, the one-step eliminations it needed) are a difficulty measure too.
 *
 * The rules per game are a person's: Tents (line counts, tents never touch, every tree needs its own tent), Lamplighter
 * (bulbs never see each other, wall numbers, every square must be lit), Shikaku (each number's rectangle can't overlap
 * another's, every square belongs to one), Trail (each number next to the one before and after, every square used
 * once), and for Loopline, Regions and Island Link the deductions their own solvers already make before branching.
 */
import { bridgesDeductions } from "./bridges.server";
import { fencesDeductions } from "./fences.server";
import { fillominoDeductions } from "./fillomino.server";
import { fillominoSolvedGrid } from "./fillomino";
import { orth, sightLine, lightUpHeightOf } from "./lightUp";
import { rectArea, rectHas, rectValid, shikakuHeightOf, type ShikakuRect } from "./shikaku";
import { orthNeighbours, tentsHeightOf, tentsMatchTrees } from "./tents";
import { trNeighbours, trSide } from "./trail";
import type {
  BridgesPuzzleData,
  FencesPuzzleData,
  FillominoPuzzleData,
  LightUpPuzzleData,
  PuzzleData,
  ShikakuPuzzleData,
  TentsPuzzleData,
  TrailPuzzleData,
} from "./types";

export interface HumanSolve {
  /** Finished by deduction and one-step trials alone. */
  solved: boolean;
  /** One-step trials that ruled a choice out (0: rules of deduction alone). */
  eliminations: number;
  /** Trials made in all. */
  trials: number;
}

/** A game's model: a copyable state, its rules of deduction, its open choices and when it's finished. */
interface Model<S> {
  init: S;
  copy(s: S): S;
  /** The rules of deduction to a fixed point, in place; false on a contradiction. */
  deduce(s: S): boolean;
  /** Each open choice: `take` applies it to a copy; `refuse` rules it out in place. */
  choices(s: S): { take(s: S): void; refuse(s: S): void }[];
  finished(s: S): boolean;
}

function solveLikeAPerson<S>(m: Model<S>, trialCap = 200_000): HumanSolve {
  const s = m.copy(m.init);
  const out: HumanSolve = { solved: false, eliminations: 0, trials: 0 };
  if (!m.deduce(s)) return out;
  for (;;) {
    if (m.finished(s)) return { ...out, solved: true };
    let progress = false;
    for (const choice of m.choices(s)) {
      if (out.trials++ > trialCap) return out;
      const t = m.copy(s);
      choice.take(t);
      if (m.deduce(t)) continue;
      choice.refuse(s);
      out.eliminations++;
      if (!m.deduce(s)) return out;
      progress = true;
      break;
    }
    if (!progress) return out;
  }
}

/* ---------------------------------------------------------------------------------------------------------------- */
/* Tents and Trees: −1 unknown, 0 grass, 1 tent, per square.                                                         */

function tentsModel(p: TentsPuzzleData): Model<Int8Array> {
  const w = p.size;
  const h = tentsHeightOf(p);
  const n = w * h;
  const trees = new Set(p.trees);
  const init = new Int8Array(n).fill(0);
  const treeNbs = p.trees.map((t) => orthNeighbours(t, w, h).filter((c) => !trees.has(c)));
  for (const list of treeNbs) for (const c of list) init[c] = -1;
  const king = (c: number) => {
    const r = Math.floor(c / w);
    const col = c % w;
    const out: number[] = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr;
        const cc = col + dc;
        if (rr >= 0 && rr < h && cc >= 0 && cc < w) out.push(rr * w + cc);
      }
    return out;
  };
  const lines: { cells: number[]; count: number }[] = [];
  for (let r = 0; r < h; r++) if ((p.rowCounts[r] ?? -1) >= 0) lines.push({ cells: Array.from({ length: w }, (_, c) => r * w + c), count: p.rowCounts[r]! });
  for (let c = 0; c < w; c++) if ((p.colCounts[c] ?? -1) >= 0) lines.push({ cells: Array.from({ length: h }, (_, r) => r * w + c), count: p.colCounts[c]! });
  /** Can every tree still have its own tent, and every tent its own tree? (bipartite matching both ways) */
  const matchable = (s: Int8Array): boolean => {
    const owner = new Map<number, number>();
    const tryTree = (t: number, seen: Set<number>): boolean => {
      for (const c of treeNbs[t]!) {
        if (s[c] === 0 || seen.has(c)) continue;
        seen.add(c);
        const o = owner.get(c);
        if (o === undefined || tryTree(o, seen)) {
          owner.set(c, t);
          return true;
        }
      }
      return false;
    };
    for (let t = 0; t < treeNbs.length; t++) if (!tryTree(t, new Set())) return false;
    // Every tent must be one of the matched cells for some matching: a tent beside no tree can't be.
    for (let c = 0; c < n; c++) if (s[c] === 1 && !treeNbs.some((list) => list.includes(c))) return false;
    return true;
  };
  const deduce = (s: Int8Array): boolean => {
    for (let changed = true; changed; ) {
      changed = false;
      for (let c = 0; c < n; c++) {
        if (s[c] !== 1) continue;
        for (const k of king(c)) {
          if (s[k] === 1) return false;
          if (s[k] === -1) (s[k] = 0), (changed = true);
        }
      }
      for (const line of lines) {
        let tents = 0;
        let open = 0;
        for (const c of line.cells) (s[c] === 1 ? tents++ : s[c] === -1 ? open++ : 0);
        if (tents > line.count || tents + open < line.count) return false;
        if (open && tents === line.count) for (const c of line.cells) if (s[c] === -1) (s[c] = 0), (changed = true);
        if (open && tents + open === line.count) for (const c of line.cells) if (s[c] === -1) (s[c] = 1), (changed = true);
      }
      let tents = 0;
      let open = 0;
      for (let c = 0; c < n; c++) (s[c] === 1 ? tents++ : s[c] === -1 ? open++ : 0);
      if (tents > p.trees.length || tents + open < p.trees.length) return false;
      // A tree with one place left for a tent, and no tent beside it yet, has its tent there.
      for (const list of treeNbs) {
        const open1 = list.filter((c) => s[c] !== 0);
        if (!open1.length) return false;
        if (open1.length === 1 && s[open1[0]!] === -1) (s[open1[0]!] = 1), (changed = true);
      }
      if (!matchable(s)) return false;
    }
    return true;
  };
  return {
    init,
    copy: (s) => s.slice(),
    deduce,
    choices: (s) =>
      [...s.keys()].filter((c) => s[c] === -1).flatMap((c) => [
        { take: (t: Int8Array) => void (t[c] = 1), refuse: (t: Int8Array) => void (t[c] = 0) },
        { take: (t: Int8Array) => void (t[c] = 0), refuse: (t: Int8Array) => void (t[c] = 1) },
      ]),
    finished: (s) => !s.includes(-1) && tentsMatchTrees(p.trees, [...s.keys()].filter((c) => s[c] === 1), w, h),
  };
}

/* ---------------------------------------------------------------------------------------------------------------- */
/* Lamplighter: −1 unknown, 0 empty, 1 bulb, per white square (walls stay 0 and are never chosen).                   */

function lightUpModel(p: LightUpPuzzleData): Model<Int8Array> {
  const w = p.size;
  const h = lightUpHeightOf(p);
  const n = w * h;
  const walls = new Set(p.walls);
  const sight = Array.from({ length: n }, (_, c) => (walls.has(c) ? [] : sightLine(c, w, walls, h)));
  const numbered = p.walls.flatMap((wall, i) => (p.wallNumbers[i]! >= 0 ? [{ cells: orth(wall, w, h).filter((c) => !walls.has(c)), n: p.wallNumbers[i]! }] : []));
  const init = new Int8Array(n).fill(0);
  for (let c = 0; c < n; c++) if (!walls.has(c)) init[c] = -1;
  const deduce = (s: Int8Array): boolean => {
    for (let changed = true; changed; ) {
      changed = false;
      for (let c = 0; c < n; c++) {
        if (s[c] !== 1) continue;
        for (const x of sight[c]!) {
          if (x === c) continue;
          if (s[x] === 1) return false;
          if (s[x] === -1) (s[x] = 0), (changed = true);
        }
      }
      for (const wall of numbered) {
        let bulbs = 0;
        let open = 0;
        for (const c of wall.cells) (s[c] === 1 ? bulbs++ : s[c] === -1 ? open++ : 0);
        if (bulbs > wall.n || bulbs + open < wall.n) return false;
        if (open && bulbs === wall.n) for (const c of wall.cells) if (s[c] === -1) (s[c] = 0), (changed = true);
        if (open && bulbs + open === wall.n) for (const c of wall.cells) if (s[c] === -1) (s[c] = 1), (changed = true);
      }
      // Every white square must be lit: by a bulb it sees, or one of the squares that could still hold one.
      for (let c = 0; c < n; c++) {
        if (walls.has(c)) continue;
        let lit = false;
        let only = -1;
        let ways = 0;
        for (const x of sight[c]!) {
          if (s[x] === 1) lit = true;
          else if (s[x] === -1) (ways++, (only = x));
        }
        if (lit) continue;
        if (!ways) return false;
        if (ways === 1) (s[only] = 1), (changed = true);
      }
    }
    return true;
  };
  return {
    init,
    copy: (s) => s.slice(),
    deduce,
    choices: (s) =>
      [...s.keys()].filter((c) => s[c] === -1).flatMap((c) => [
        { take: (t: Int8Array) => void (t[c] = 1), refuse: (t: Int8Array) => void (t[c] = 0) },
        { take: (t: Int8Array) => void (t[c] = 0), refuse: (t: Int8Array) => void (t[c] = 1) },
      ]),
    finished: (s) => !s.includes(-1),
  };
}

/* ---------------------------------------------------------------------------------------------------------------- */
/* Shikaku: for each number, the rectangles it could still have.                                                     */

function shikakuModel(p: ShikakuPuzzleData): Model<ShikakuRect[][]> {
  const w = p.size;
  const h = shikakuHeightOf(p);
  const init = p.clues.map((clue) => {
    const out: ShikakuRect[] = [];
    const r = Math.floor(clue.cell / w);
    const c = clue.cell % w;
    for (let rh = 1; rh <= clue.n; rh++) {
      if (clue.n % rh) continue;
      const rw = clue.n / rh;
      for (let r0 = r - rh + 1; r0 <= r; r0++)
        for (let c0 = c - rw + 1; c0 <= c; c0++) {
          const rect = { r0, c0, r1: r0 + rh - 1, c1: c0 + rw - 1 };
          if (r0 < 0 || c0 < 0 || rect.r1 >= h || rect.c1 >= w) continue;
          if (rectValid(rect, p.clues, w)) out.push(rect);
        }
    }
    return out;
  });
  const overlap = (a: ShikakuRect, b: ShikakuRect) => a.r0 <= b.r1 && b.r0 <= a.r1 && a.c0 <= b.c1 && b.c0 <= a.c1;
  const deduce = (s: ShikakuRect[][]): boolean => {
    for (let changed = true; changed; ) {
      changed = false;
      for (let i = 0; i < s.length; i++) {
        if (!s[i]!.length) return false;
        // Squares every one of a number's rectangles covers are its own: no other number's rectangle may use them.
        let sure: ShikakuRect | null = { ...s[i]![0]! };
        for (const r of s[i]!) {
          if (!sure) break;
          const box: ShikakuRect = { r0: Math.max(sure.r0, r.r0), c0: Math.max(sure.c0, r.c0), r1: Math.min(sure.r1, r.r1), c1: Math.min(sure.c1, r.c1) };
          sure = box.r0 <= box.r1 && box.c0 <= box.c1 ? box : null;
        }
        if (!sure) continue;
        const own = sure;
        for (let j = 0; j < s.length; j++) {
          if (j === i) continue;
          const kept = s[j]!.filter((rect) => !overlap(rect, own));
          if (kept.length !== s[j]!.length) (s[j] = kept), (changed = true);
          if (!kept.length) return false;
        }
      }
      // Every square belongs to some number: one that only one number's rectangles can reach is that number's.
      for (let cell = 0; cell < w * h; cell++) {
        let by = -1;
        let ways = 0;
        for (let i = 0; i < s.length && ways < 2; i++) if (s[i]!.some((rect) => rectHas(rect, cell, w))) (ways++, (by = i));
        if (!ways) return false;
        if (ways === 1) {
          const kept = s[by]!.filter((rect) => rectHas(rect, cell, w));
          if (kept.length !== s[by]!.length) (s[by] = kept), (changed = true);
        }
      }
    }
    return true;
  };
  return {
    init,
    copy: (s) => s.map((list) => [...list]),
    deduce,
    choices: (s) =>
      s.flatMap((list, i) =>
        list.length < 2
          ? []
          : list.map((rect) => ({
              take: (t: ShikakuRect[][]) => void (t[i] = [rect]),
              refuse: (t: ShikakuRect[][]) => void (t[i] = t[i]!.filter((r) => r !== rect && !(r.r0 === rect.r0 && r.c0 === rect.c0 && r.r1 === rect.r1 && r.c1 === rect.c1))),
            })),
      ),
    finished: (s) => s.every((list) => list.length === 1) && s.reduce((sum, list) => sum + rectArea(list[0]!), 0) === w * h,
  };
}

/* ---------------------------------------------------------------------------------------------------------------- */
/* Trail: for each step 1…N, the squares it could still be on (bit flags).                                           */

function trailModel(p: TrailPuzzleData): Model<Uint8Array[]> {
  // The board's own size (a level's 5 × 5, 7 × 7 or 8 × 8; Normal's 6 × 6, 36 squares, as before).
  const cells = p.givens.length;
  const side = trSide(cells);
  const nbs = Array.from({ length: cells }, (_, c) => trNeighbours(c, side));
  const givenAt = new Map<number, number>();
  p.givens.forEach((g, cell) => {
    if (g != null) givenAt.set(g, cell);
  });
  const init = Array.from({ length: cells }, (_, k) => {
    const d = new Uint8Array(cells);
    const at = givenAt.get(k + 1);
    if (at !== undefined) d[at] = 1;
    else for (let c = 0; c < cells; c++) if (p.givens[c] == null) d[c] = 1;
    return d;
  });
  const deduce = (s: Uint8Array[]): boolean => {
    for (let changed = true; changed; ) {
      changed = false;
      for (let k = 0; k < cells; k++) {
        const d = s[k]!;
        let count = 0;
        let only = -1;
        for (let c = 0; c < cells; c++) if (d[c]) (count++, (only = c));
        if (!count) return false;
        // A step settled on a square: no other step can use it.
        if (count === 1)
          for (let j = 0; j < cells; j++) if (j !== k && s[j]![only]) (s[j]![only] = 0), (changed = true);
        // Next to the steps before and after: a square with no neighbour the step before (or after) could be on is out.
        for (let c = 0; c < cells; c++) {
          if (!d[c]) continue;
          const fits = (j: number) => j < 0 || j >= cells || nbs[c]!.some((x) => s[j]![x]);
          if (!fits(k - 1) || !fits(k + 1)) (d[c] = 0), (changed = true);
        }
      }
      // Every square is used once: a square only one step can still be on is that step's.
      for (let c = 0; c < cells; c++) {
        let by = -1;
        let ways = 0;
        for (let k = 0; k < cells && ways < 2; k++) if (s[k]![c]) (ways++, (by = k));
        if (!ways) return false;
        if (ways === 1) {
          const d = s[by]!;
          for (let x = 0; x < cells; x++) if (x !== c && d[x]) (d[x] = 0), (changed = true);
        }
      }
    }
    return true;
  };
  return {
    init,
    copy: (s) => s.map((d) => d.slice()),
    deduce,
    choices: (s) =>
      s.flatMap((d, k) => {
        let count = 0;
        for (let c = 0; c < cells; c++) count += d[c]!;
        if (count < 2) return [];
        return [...d.keys()].filter((c) => d[c]).map((c) => ({
          take: (t: Uint8Array[]) => {
            t[k]!.fill(0);
            t[k]![c] = 1;
          },
          refuse: (t: Uint8Array[]) => void (t[k]![c] = 0),
        }));
      }),
    finished: (s) => s.every((d) => d.reduce((a, b) => a + b, 0) === 1),
  };
}

/* ---------------------------------------------------------------------------------------------------------------- */
/* Loopline, Regions, Island Link: their own solvers' deductions.                                                    */

function fencesModel(p: FencesPuzzleData): Model<Int8Array> {
  const d = fencesDeductions(p.size, p.clues);
  return {
    init: d.init(),
    copy: (s) => s.slice(),
    deduce: d.propagate,
    choices: (s) =>
      [...s.keys()].filter((e) => s[e] === -1).flatMap((e) => [
        { take: (t: Int8Array) => void (t[e] = 1), refuse: (t: Int8Array) => void (t[e] = 0) },
        { take: (t: Int8Array) => void (t[e] = 0), refuse: (t: Int8Array) => void (t[e] = 1) },
      ]),
    finished: d.solved,
  };
}

function bridgesModel(p: BridgesPuzzleData): Model<number[]> {
  const d = bridgesDeductions(p.size, p.islands);
  const bits = (m: number) => ((m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1));
  return {
    init: d.pairs.map(() => 7),
    copy: (s) => [...s],
    deduce: d.propagate,
    choices: (s) =>
      s.flatMap((m, i) =>
        bits(m) < 2
          ? []
          : [0, 1, 2].filter((v) => m & (1 << v)).map((v) => ({
              take: (t: number[]) => void (t[i] = 1 << v),
              refuse: (t: number[]) => void (t[i] = t[i]! & ~(1 << v)),
            })),
      ),
    finished: (s) => s.every((m) => bits(m) === 1),
  };
}

function fillominoModel(p: FillominoPuzzleData): Model<{ vals: number[]; excl: Int32Array }> {
  const d = fillominoDeductions(p.size);
  const n = p.size * p.size;
  return {
    init: { vals: p.givens.map((v) => (v > 0 && v <= 9 ? v : 0)), excl: new Int32Array(n) },
    copy: (s) => ({ vals: [...s.vals], excl: Int32Array.from(s.excl) }),
    deduce: (s) => Boolean(d.propagate(s.vals, s.excl)),
    choices: (s) => {
      const r = d.propagate([...s.vals], Int32Array.from(s.excl));
      if (!r) return [];
      const out: { take(t: { vals: number[]; excl: Int32Array }): void; refuse(t: { vals: number[]; excl: Int32Array }): void }[] = [];
      for (let c = 0; c < n; c++) {
        if (s.vals[c]) continue;
        for (let v = 1; v <= 9; v++)
          if (r.cand[c]! & (1 << v))
            out.push({
              take: (t) => void (t.vals[c] = v),
              refuse: (t) => void (t.excl[c] = t.excl[c]! | (1 << v)),
            });
      }
      return out;
    },
    finished: (s) => !s.vals.includes(0) && fillominoSolvedGrid(p.size, s.vals),
  };
}

/** Solves a dealt board (its public half is enough) the way a person would; see the file's head. */
export function solveLikePerson(puzzle: PuzzleData): HumanSolve {
  switch (puzzle.type) {
    case "tents":
      return solveLikeAPerson(tentsModel(puzzle));
    case "lightup":
      return solveLikeAPerson(lightUpModel(puzzle));
    case "shikaku":
      return solveLikeAPerson(shikakuModel(puzzle));
    case "trail":
      return solveLikeAPerson(trailModel(puzzle));
    case "fences":
      return solveLikeAPerson(fencesModel(puzzle));
    case "bridges":
      return solveLikeAPerson(bridgesModel(puzzle));
    case "fillomino":
      return solveLikeAPerson(fillominoModel(puzzle));
    default:
      throw new Error(`no person-style solver for ${puzzle.type}`);
  }
}

/* ---------------------------------------------------------------------------------------------------------------- */
/* The person's clock (D4, 22 Nov 2026; Joe's answer of 20 Nov: the proof first, with a clock).                     */

/** Seconds a person needs for one one-step trial that rules a choice out (the spec's figure). */
export const PERSON_TRIAL_S = 1.5;
/** The human limits (scripts/arcade-skill-bands/human.ts HUMAN_LIMITS): 0.25 s to react, 0.15 s a tap after it. */
const REACT_S = 0.25;
const TAP_S = 0.15;
const action = (taps: number) => REACT_S + taps * TAP_S;

/**
 * What a person enters to finish the board, in seconds at the human limits: a tent, bulb, Trail square or Loopline
 * line is a tap; a Shikaku rectangle or an Island Link bridge a drag (a tap and a drop); a Regions stroke one tap for
 * every two squares it paints.
 */
export function personEntrySeconds(puzzle: PuzzleData): number {
  switch (puzzle.type) {
    case "tents":
      return (puzzle as TentsPuzzleData).trees.length * action(1);
    case "lightup":
      return ((puzzle as LightUpPuzzleData).solution?.length ?? 0) * action(1);
    case "shikaku":
      return (puzzle as ShikakuPuzzleData).clues.length * action(2);
    case "trail":
      return (puzzle as TrailPuzzleData).givens.filter((g) => g == null).length * action(1);
    case "fences":
      return ((puzzle as FencesPuzzleData).solution?.length ?? 0) * action(1);
    case "bridges":
      return ((puzzle as BridgesPuzzleData).solution ?? []).reduce((n, b) => n + (b > 0 ? 1 : 0), 0) * action(2);
    case "fillomino": {
      const blanks = (puzzle as FillominoPuzzleData).givens.filter((g) => !(g > 0)).length;
      // A stroke a region (about four squares), each one decided and then painted a tap for every two squares.
      return Math.ceil(blanks / 4) * REACT_S + Math.ceil(blanks / 2) * TAP_S;
    }
    default:
      return 0;
  }
}

/**
 * The person-style solver's clock: the board's entries at the human limits plus PERSON_TRIAL_S for every one-step
 * trial that ruled a choice out. A level board is fair for a person in a timed round only when this fits its clock.
 */
export function personSeconds(puzzle: PuzzleData, solve: HumanSolve = solveLikePerson(puzzle)): number {
  return personEntrySeconds(puzzle) + solve.eliminations * PERSON_TRIAL_S;
}
