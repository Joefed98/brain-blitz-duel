/**
 * Player kits for the Number group (scripts/puzzle-fairness/kit.ts): Exact,
 * Operator, Counterweight, Integer Pyramid, Trail, Brimful, Checkout, Ballpark.
 * Every answer is built exactly as the phone's Stage encodes its draft or
 * submit; nothing here scores (run.ts grades through gradeAnswer).
 */
import type {
  BalancePuzzleData,
  CheckoutPuzzleData,
  EquationPuzzleData,
  MeasureBoardData,
  MeasurePuzzleData,
  NumberPyramidPuzzleData,
  NumlinePuzzleData,
  Operator,
  TargetNumberPuzzleData,
  TrailPuzzleData,
} from "../../src/lib/duel/types";
import { applyOperation, encodeSteps, TARGET_OPERATORS } from "../../src/lib/duel/target";
import { equationStageCorrect, joinStages } from "../../src/lib/duel/stagedRounds";
import { BAL_PEGS, encodeBalance, scaleSolved, type Placement } from "../../src/lib/duel/balance";
import { NP_SET_SIZE, npComplete, npEncodeRound, type NpPlacements } from "../../src/lib/duel/numberPyramid";
import { trComplete, trEncode, trSlots, trTapPath, trUndoPlayer, TR_CELLS } from "../../src/lib/duel/trail";
import {
  encodeMeasureRound,
  measureActions,
  measureApply,
  measureSolved,
  type MeasureAction,
} from "../../src/lib/duel/measure";
import {
  CHECKOUT_BULL,
  checkoutOptions,
  checkoutValid,
  decodeCheckoutDarts,
  encodeCheckoutDarts,
  joinCheckoutRound,
  type CheckoutDart,
} from "../../src/lib/duel/checkout";
import { encodeNumline, numlineShare, numlineValue, NUMLINE_SCALE, NUMLINE_TOTAL, NUMLINE_ITEMS } from "../../src/lib/duel/numline";
import { thinkMs, type PuzzleKit, type Rng, type SpamPlay, type Step } from "./kit";

/** The phone's "CORRECT" hold between stages (StageCorrect.tsx STAGE_CORRECT_HOLD_MS). */
const HOLD_MS = 1000;
/** One mindless tap on a phone. */
const TAP_MS = 350;

/** A tiny step recorder: a clock and the answers after each action. */
function recorder() {
  const steps: Step[] = [];
  let t = 0;
  return {
    steps,
    get t() { return t; },
    wait(ms: number) { t += ms; },
    push(answer: string) { steps.push({ answer, atMs: t }); },
  };
}

/* ================================ Exact ================================ */

interface TStep { a: number; b: number; operator: Operator }

function targetPool(tiles: number[], steps: TStep[]): number[] {
  let pool = [...tiles];
  for (const s of steps) {
    const i = pool.indexOf(s.a);
    const rest = pool.filter((_, k) => k !== i);
    const j = rest.indexOf(s.b);
    pool = [...rest.filter((_, k) => k !== j), applyOperation(s.a, s.b, s.operator)!];
  }
  return pool;
}

function randomTargetStep(pool: number[], rng: Rng): TStep | null {
  for (let tries = 0; tries < 40; tries++) {
    const i = rng.below(pool.length);
    let j = rng.below(pool.length - 1);
    if (j >= i) j++;
    const operator = rng.pick(TARGET_OPERATORS);
    if (applyOperation(pool[i]!, pool[j]!, operator) !== null) return { a: pool[i]!, b: pool[j]!, operator };
  }
  return null;
}

const targetKit: PuzzleKit = {
  type: "target",
  nothing: () => encodeSteps([]),
  spam(p, rng, limitMs) {
    const puzzle = p as TargetNumberPuzzleData;
    const out: SpamPlay[] = [];
    // Random legal steps (tile, operator, tile ≈ 1.5 s), Reset at one tile; hitting the target locks.
    {
      let steps: TStep[] = [];
      let t = 0;
      let final: string | null = null;
      while (t < limitMs) {
        const pool = targetPool(puzzle.tiles, steps);
        if (pool.length < 2) { steps = []; t += TAP_MS; continue; }
        const s = randomTargetStep(pool, rng);
        t += 3 * TAP_MS + 400;
        if (!s) { steps = []; continue; }
        if (t > limitMs) break;
        steps.push(s);
        if (applyOperation(s.a, s.b, s.operator) === puzzle.target) { final = encodeSteps(steps); break; }
      }
      out.push({ label: "random-steps", answer: final ?? encodeSteps(steps) });
    }
    // One random chain down to a single tile, left there.
    {
      const steps: TStep[] = [];
      for (;;) {
        const pool = targetPool(puzzle.tiles, steps);
        if (pool.length < 2) break;
        const s = randomTargetStep(pool, rng);
        if (!s) break;
        steps.push(s);
        if (applyOperation(s.a, s.b, s.operator) === puzzle.target) break;
      }
      out.push({ label: "one-random-chain", answer: encodeSteps(steps) });
    }
    // Multiply the two biggest tiles together (the "get big fast" mash).
    {
      const sorted = [...puzzle.tiles].sort((a, b) => b - a);
      out.push({ label: "multiply-biggest", answer: encodeSteps([{ a: sorted[0]!, b: sorted[1]!, operator: "×" }]) });
    }
    return out;
  },
  play(p, rng, skill) {
    // BASE 8 s per step: a good player finds a five-step exact chain in ~40 s.
    const BASE = 8;
    const puzzle = p as TargetNumberPuzzleData;
    const rec = recorder();
    const steps: TStep[] = [];
    for (const want of puzzle.solution) {
      if (rng.chance(skill.err)) {
        // A dead-end step: tried, judged worse, undone.
        const pool = targetPool(puzzle.tiles, steps);
        const wrong = randomTargetStep(pool, rng);
        if (wrong && !(wrong.a === want.a && wrong.b === want.b && wrong.operator === want.operator)) {
          rec.wait(thinkMs(rng, BASE * 0.6, skill));
          steps.push(wrong);
          rec.push(encodeSteps(steps));
          if (applyOperation(wrong.a, wrong.b, wrong.operator) === puzzle.target) return { steps: rec.steps };
          rec.wait(thinkMs(rng, BASE * 0.5, skill));
          steps.pop();
          rec.push(encodeSteps(steps));
        }
      }
      rec.wait(thinkMs(rng, BASE, skill));
      steps.push({ a: want.a, b: want.b, operator: want.operator });
      rec.push(encodeSteps(steps));
    }
    return { steps: rec.steps };
  },
};

/* =============================== Operator =============================== */

function equationOps(stage: { numbers: number[]; target: number }, stored: Operator[] | undefined): Operator[] {
  if (stored && equationStageCorrect(stage.numbers, stage.target, stored.join(","))) return stored;
  // Fallback: exhaustive search (4^(n-1) ≤ 256).
  const n = stage.numbers.length - 1;
  for (let code = 0; code < 4 ** n; code++) {
    const ops = Array.from({ length: n }, (_, i) => TARGET_OPERATORS[Math.floor(code / 4 ** i) % 4]!);
    if (equationStageCorrect(stage.numbers, stage.target, ops.join(","))) return ops;
  }
  return stored ?? [];
}

const equationKit: PuzzleKit = {
  type: "equation",
  nothing: (p) => joinStages(Array.from({ length: (p as EquationPuzzleData).stages.length }, () => ""), (p as EquationPuzzleData).stages.length),
  spam(p, rng, limitMs) {
    const puzzle = p as EquationPuzzleData;
    const total = puzzle.stages.length;
    const out: SpamPlay[] = [];
    // Random operator in every slot, then Next, every stage.
    out.push({
      label: "random-next",
      answer: joinStages(puzzle.stages.map((s) => Array.from({ length: s.numbers.length - 1 }, () => rng.pick(TARGET_OPERATORS)).join(",")), total),
    });
    // The same operator everywhere.
    out.push({ label: "all-plus", answer: joinStages(puzzle.stages.map((s) => Array(s.numbers.length - 1).fill("+").join(",")), total) });
    // Brute force: odometer through every combination (clear + tap per changed slot); a hit auto-advances.
    {
      const answers = Array.from({ length: total }, () => "");
      let t = 0;
      let stage = 0;
      let live = "";
      outer: while (stage < total) {
        const s = puzzle.stages[stage]!;
        const n = s.numbers.length - 1;
        let prev: Operator[] | null = null;
        for (let code = 0; code < 4 ** n; code++) {
          const ops = Array.from({ length: n }, (_, i) => TARGET_OPERATORS[Math.floor(code / 4 ** (n - 1 - i)) % 4]!);
          const changed = prev ? ops.filter((o, i) => o !== prev![i]).length : n;
          t += changed * (prev ? 2 : 1) * TAP_MS;
          if (t > limitMs) break outer;
          prev = ops;
          live = ops.join(",");
          if (equationStageCorrect(s.numbers, s.target, live)) {
            answers[stage] = live;
            live = "";
            t += HOLD_MS;
            stage++;
            continue outer;
          }
        }
        // Nothing found (cannot happen): Next.
        answers[stage] = live;
        live = "";
        stage++;
      }
      if (stage < total) answers[stage] = live;
      out.push({ label: "brute-force", answer: joinStages(answers, total) });
    }
    return out;
  },
  play(p, rng, skill) {
    // BASE 3.5 s per operator slot: a stage of 2–4 slots is read and filled in ~7–14 s.
    const BASE = 3.5;
    const puzzle = p as EquationPuzzleData;
    const total = puzzle.stages.length;
    const rec = recorder();
    const answers = Array.from({ length: total }, () => "");
    for (let st = 0; st < total; st++) {
      const stage = puzzle.stages[st]!;
      const want = equationOps(stage, puzzle.operators?.[st]);
      const slots: (Operator | null)[] = Array(want.length).fill(null);
      const draft = () => joinStages(answers.map((a, i) => (i === st ? slots.filter(Boolean).join(",") : a)), total);
      for (let i = 0; i < want.length; i++) {
        rec.wait(thinkMs(rng, BASE, skill));
        slots[i] = rng.chance(skill.err) ? rng.pick(TARGET_OPERATORS.filter((o) => o !== want[i])) : want[i]!;
        rec.push(draft());
      }
      // No CORRECT flash: find the slip, clear it, tap the right one.
      let guard = 0;
      while (!equationStageCorrect(stage.numbers, stage.target, slots.join(",")) && guard++ < 10) {
        rec.wait(thinkMs(rng, BASE, skill));
        const bad = slots.findIndex((o, i) => o !== want[i]);
        if (bad < 0) break;
        slots[bad] = null;
        rec.wait(TAP_MS + 200);
        rec.push(draft());
        rec.wait(thinkMs(rng, BASE * 0.4, skill));
        slots[bad] = want[bad]!;
        rec.push(draft());
      }
      answers[st] = slots.join(",");
      if (st < total - 1) rec.wait(HOLD_MS);
    }
    return { steps: rec.steps };
  },
};

/* ============================= Counterweight ============================= */

function balanceFreePegs(scale: BalancePuzzleData["scales"][number], placement: Placement, tray: number): number[] {
  return Array.from({ length: BAL_PEGS }, (_, peg) => peg).filter(
    (peg) => !scale.fixed.some((f) => f.peg === peg) && !placement.some((q, i) => i !== tray && q === peg),
  );
}

const balanceKit: PuzzleKit = {
  type: "balance",
  nothing: (p) => encodeBalance((p as BalancePuzzleData).scales.map((s) => s.tray.map(() => null))),
  spam(p, rng, limitMs) {
    const puzzle = p as BalancePuzzleData;
    const out: SpamPlay[] = [];
    const randomHang = (gapMs: number, label: string) => {
      const placements: Placement[] = puzzle.scales.map((s) => s.tray.map(() => null));
      let current = 0;
      let t = 0;
      while (current < puzzle.scales.length) {
        t += gapMs;
        if (t > limitMs) break;
        const scale = puzzle.scales[current]!;
        const pl = placements[current]!;
        const tray = rng.below(scale.tray.length);
        const free = balanceFreePegs(scale, pl, tray);
        pl[tray] = rng.pick(free);
        if (scaleSolved(scale, pl)) { current++; t += HOLD_MS; }
      }
      out.push({ label, answer: encodeBalance(placements) });
    };
    randomHang(2 * TAP_MS + 300, "random-hang");
    randomHang(2 * TAP_MS, "random-hang-fast");
    // Every weight hung once on a random free peg, first scale only.
    {
      const placements: Placement[] = puzzle.scales.map((s) => s.tray.map(() => null));
      const scale = puzzle.scales[0]!;
      for (let i = 0; i < scale.tray.length; i++) placements[0]![i] = rng.pick(balanceFreePegs(scale, placements[0]!, i));
      out.push({ label: "place-once", answer: encodeBalance(placements) });
    }
    return out;
  },
  play(p, rng, skill) {
    // BASE 5 s per weight: work out a torque and hang the weight (two taps).
    const BASE = 5;
    const puzzle = p as BalancePuzzleData;
    const rec = recorder();
    const placements: Placement[] = puzzle.scales.map((s) => s.tray.map(() => null));
    const answer = () => encodeBalance(placements);
    for (let s = 0; s < puzzle.scales.length; s++) {
      const scale = puzzle.scales[s]!;
      const sol = puzzle.solutions?.[s] ?? [];
      const pl = placements[s]!;
      const order = rng.shuffle(scale.tray.map((_, i) => i));
      const wrongs: number[] = [];
      for (const i of order) {
        if (scaleSolved(scale, pl)) break;
        rec.wait(thinkMs(rng, BASE, skill));
        const decoys = balanceFreePegs(scale, pl, i).filter((peg) => !sol.includes(peg));
        if (rng.chance(skill.err) && decoys.length) { pl[i] = rng.pick(decoys); wrongs.push(i); }
        else pl[i] = sol[i]!;
        rec.push(answer());
      }
      // The beam still tips: move each misplaced weight to its peg.
      for (const i of wrongs) {
        if (scaleSolved(scale, pl)) break;
        rec.wait(thinkMs(rng, BASE * 0.7, skill));
        pl[i] = sol[i]!;
        rec.push(answer());
      }
      if (!scaleSolved(scale, pl)) {
        for (let i = 0; i < pl.length; i++) pl[i] = sol[i]!;
        rec.wait(thinkMs(rng, BASE, skill));
        rec.push(answer());
      }
      if (s < puzzle.scales.length - 1) rec.wait(HOLD_MS);
    }
    return { steps: rec.steps };
  },
};

/* ============================ Integer Pyramid ============================ */

/** Cells in an order a person would deduce them: each from a rule with the other two known. */
function pyramidOrder(rows: number, known: boolean[], rng: Rng): number[] {
  const rules: [number, number, number][] = [];
  const idx = (r: number, c: number) => (r * (r + 1)) / 2 + c;
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c <= r; c++) rules.push([idx(r, c), idx(r + 1, c), idx(r + 1, c + 1)]);
  const k = [...known];
  const order: number[] = [];
  for (;;) {
    const open = k.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    if (!open.length) break;
    const ready = open.filter((cell) => rules.some((rule) => rule.includes(cell) && rule.filter((x) => x !== cell).every((x) => k[x])));
    const cell = ready.length ? rng.pick(ready) : rng.pick(open);
    k[cell] = true;
    order.push(cell);
  }
  return order;
}

const numpyramidKit: PuzzleKit = {
  type: "numpyramid",
  nothing: () => npEncodeRound(0, [{}, {}, {}, {}]),
  spam(p, rng, limitMs) {
    const puzzle = p as NumberPyramidPuzzleData;
    const out: SpamPlay[] = [];
    const fillRandom = (board: NumberPyramidPuzzleData["pyramids"][number]): NpPlacements => {
      const empty = board.givens.map((g, i) => (g == null ? i : -1)).filter((i) => i >= 0);
      const trays = rng.shuffle(board.tray.map((_, i) => i));
      const pl: NpPlacements = {};
      empty.forEach((cell, i) => { if (trays[i] !== undefined) pl[cell] = trays[i]!; });
      return pl;
    };
    // Phone-reachable: fill the active board with random tiles, then keep dropping random tiles on random cells.
    {
      const boards: NpPlacements[] = [{}, {}, {}, {}];
      let active = 0;
      let t = 0;
      while (active < NP_SET_SIZE && t < limitMs) {
        const board = puzzle.pyramids[active]!;
        const empty = board.givens.map((g, i) => (g == null ? i : -1)).filter((i) => i >= 0);
        const pl = boards[active]!;
        t += 2 * TAP_MS + 200;
        if (t > limitMs) break;
        const cell = rng.pick(empty);
        const tray = rng.below(board.tray.length);
        // drop(tray, from = its cell or null, cell): a tile moves; the occupant goes back to the tray.
        const from = Object.entries(pl).find(([, v]) => v === tray)?.[0];
        if (from !== undefined) delete pl[Number(from)];
        pl[cell] = tray;
        if (npComplete(board.givens, board.tray, pl, board.rows)) { active++; t += HOLD_MS; }
      }
      out.push({ label: "random-drops", answer: npEncodeRound(Math.min(active, NP_SET_SIZE), boards) });
    }
    // Phone-reachable: fill every empty cell of the first board once at random, stop.
    out.push({ label: "fill-once", answer: npEncodeRound(0, [fillRandom(puzzle.pyramids[0]!), {}, {}, {}]) });
    // Forged (not reachable on the phone, which only edits the active board): random tiles on every pyramid.
    out.push({ label: "forged-all-boards", answer: npEncodeRound(0, puzzle.pyramids.map(fillRandom)) });
    return out;
  },
  play(p, rng, skill) {
    // BASE 4 s per cell: a two-digit sum or difference, then find and drag the tile.
    const BASE = 4;
    const puzzle = p as NumberPyramidPuzzleData;
    const rec = recorder();
    const boards: NpPlacements[] = [{}, {}, {}, {}];
    for (let b = 0; b < puzzle.pyramids.length; b++) {
      const board = puzzle.pyramids[b]!;
      const sol = puzzle.solutions?.[b] ?? [];
      const pl = boards[b]!;
      // Reserve a tray tile for each empty cell's value; the rest are decoys.
      const used = new Set<number>();
      const want: Record<number, number> = {};
      board.givens.forEach((g, cell) => {
        if (g != null) return;
        const t = board.tray.findIndex((v, i) => v === sol[cell] && !used.has(i));
        used.add(t);
        want[cell] = t;
      });
      const decoys = board.tray.map((_, i) => i).filter((i) => !used.has(i));
      const order = pyramidOrder(board.rows, board.givens.map((g) => g != null), rng);
      const wrong: number[] = [];
      for (const cell of order) {
        rec.wait(thinkMs(rng, BASE, skill));
        const free = decoys.filter((d) => !Object.values(pl).includes(d) && board.tray[d] !== sol[cell]);
        if (rng.chance(skill.err) && free.length) { pl[cell] = rng.pick(free); wrong.push(cell); }
        else pl[cell] = want[cell]!;
        rec.push(npEncodeRound(b, boards));
      }
      // Board not done: spot each wrong tile and drop the right one over it.
      for (const cell of wrong) {
        rec.wait(thinkMs(rng, BASE * 0.6, skill));
        pl[cell] = want[cell]!;
        rec.push(npEncodeRound(b, boards));
      }
      if (b < NP_SET_SIZE - 1) {
        rec.wait(HOLD_MS);
        rec.push(npEncodeRound(b + 1, boards));
      } else rec.push(npEncodeRound(NP_SET_SIZE, boards));
    }
    return { steps: rec.steps };
  },
};

/* ================================= Trail ================================= */

function trailLegal(givens: (number | null)[], path: number[]): number[][] {
  const out: number[][] = [];
  for (let cell = 0; cell < TR_CELLS; cell++) {
    if (path.includes(cell)) continue;
    const next = trTapPath(givens, path, cell);
    if (next && next.length > path.length) out.push(next);
  }
  return out;
}

const trailKit: PuzzleKit = {
  type: "trail",
  nothing: (p) => trEncode([(p as TrailPuzzleData).givens.indexOf(1)]),
  spam(p, rng, limitMs) {
    const puzzle = p as TrailPuzzleData;
    const g = puzzle.givens;
    const start = [g.indexOf(1)];
    const out: SpamPlay[] = [];
    const walk = (withUndo: boolean, label: string) => {
      let path = start;
      let t = 0;
      while (t < limitMs) {
        const options = trailLegal(g, path);
        t += TAP_MS + 250;
        if (t > limitMs) break;
        if (options.length) {
          path = rng.pick(options);
          if (trComplete(g, trSlots(g, path))) return out.push({ label, answer: trEncode(trSlots(g, path)) });
        } else if (withUndo) {
          const undos = rng.int(1, 5);
          for (let i = 0; i < undos && path.length > 1; i++) path = trUndoPlayer(g, path);
        } else break;
      }
      out.push({ label, answer: trEncode(path) });
    };
    walk(true, "random-walk-undo");
    walk(false, "random-walk");
    return out;
  },
  play(p, rng, skill) {
    // BASE 3 s per cell: a 6×6 king-move path with 10 givens, ~26 cells to draw.
    const BASE = 3;
    const puzzle = p as TrailPuzzleData;
    const g = puzzle.givens;
    const sol = puzzle.solution ?? [];
    const rec = recorder();
    let path = [g.indexOf(1)];
    let guard = 0;
    while (path.length < g.length && guard++ < 400) {
      // The next square to tap: givens on the way are followed by the phone itself.
      let k = path.length;
      while (k < sol.length && g[sol[k]!] != null) k++;
      if (k >= sol.length) break;
      const want = sol[k]!;
      if (rng.chance(skill.err)) {
        // A wrong turn: one to three legal squares off the solution, then undo back.
        const before = path;
        const off = trailLegal(g, path).filter((n) => n.some((cell, i) => cell !== sol[i]));
        if (off.length) {
          rec.wait(thinkMs(rng, BASE, skill));
          path = rng.pick(off);
          rec.push(trEncode(path));
          const extra = rng.int(0, 2);
          for (let i = 0; i < extra; i++) {
            const more = trailLegal(g, path);
            if (!more.length) break;
            rec.wait(thinkMs(rng, BASE * 0.6, skill));
            path = rng.pick(more);
            rec.push(trEncode(path));
          }
          rec.wait(thinkMs(rng, BASE * 0.7, skill));
          while (path.length > before.length) {
            const undone = trUndoPlayer(g, path);
            if (undone.length >= path.length) break;
            path = undone;
            rec.wait(500);
            rec.push(trEncode(path));
          }
          path = before;
        }
      }
      rec.wait(thinkMs(rng, BASE, skill));
      const next = trTapPath(g, path, want);
      if (!next) throw new Error(`trail: solution cell ${want} refused at step ${path.length + 1}`);
      path = next;
      const slots = trSlots(g, path);
      rec.push(trComplete(g, slots) ? trEncode(slots) : trEncode(path));
    }
    return { steps: rec.steps };
  },
};

/* ================================ Brimful ================================ */

/** Shortest action list from the given amounts (BFS, like measureShortest from a mid-board state). */
function measurePlan(board: MeasureBoardData, from: number[]): MeasureAction[] {
  if (measureSolved(board, from)) return [];
  const actions = measureActions(board);
  const key = (a: readonly number[]) => a.join(",");
  const parent = new Map<string, { prev: string; action: MeasureAction; amounts: number[] }>();
  const seen = new Set([key(from)]);
  let frontier = [from];
  while (frontier.length) {
    const next: number[][] = [];
    for (const amounts of frontier) {
      for (const action of actions) {
        const after = measureApply(board, amounts, action);
        if (!after) continue;
        const id = key(after);
        if (seen.has(id)) continue;
        seen.add(id);
        parent.set(id, { prev: key(amounts), action, amounts: after });
        if (measureSolved(board, after)) {
          const plan: MeasureAction[] = [];
          let cursor = id;
          while (cursor !== key(from)) {
            const step = parent.get(cursor)!;
            plan.unshift(step.action);
            cursor = step.prev;
          }
          return plan;
        }
        next.push(after);
      }
    }
    frontier = next;
  }
  return [];
}

function measureAmounts(board: MeasureBoardData, actions: MeasureAction[]): number[] {
  let amounts = [...board.start];
  for (const a of actions) amounts = measureApply(board, amounts, a) ?? amounts;
  return amounts;
}

const measureKit: PuzzleKit = {
  type: "measure",
  nothing: () => encodeMeasureRound([[], [], [], []]),
  spam(p, rng, limitMs) {
    const puzzle = p as MeasurePuzzleData;
    const out: SpamPlay[] = [];
    const mash = (gapMs: number, label: string, pickAction: (board: MeasureBoardData, legal: MeasureAction[], n: number) => MeasureAction) => {
      const all: MeasureAction[][] = puzzle.boards.map(() => []);
      let stage = 0;
      let t = 0;
      let n = 0;
      while (stage < puzzle.boards.length) {
        t += gapMs;
        if (t > limitMs) break;
        const board = puzzle.boards[stage]!;
        const amounts = measureAmounts(board, all[stage]!);
        const legal = measureActions(board).filter((a) => measureApply(board, amounts, a));
        if (!legal.length) break;
        const action = pickAction(board, legal, n++);
        all[stage]!.push(action);
        if (measureSolved(board, measureApply(board, amounts, action)!)) { stage++; n = 0; t += HOLD_MS; }
      }
      out.push({ label, answer: encodeMeasureRound(all) });
    };
    // Random legal fills, empties and pours (two taps each).
    mash(2 * TAP_MS + 400, "random-actions", (_, legal) => rng.pick(legal));
    mash(2 * TAP_MS, "random-actions-fast", (_, legal) => rng.pick(legal));
    // A mindless sweep: the first legal action after the last one, round and round the buttons.
    {
      let last = -1;
      mash(2 * TAP_MS + 200, "sweep", (board, legal) => {
        const every = measureActions(board).map((a) => JSON.stringify(a));
        const ids = legal.map((a) => every.indexOf(JSON.stringify(a)));
        const pickIdx = ids.find((i) => i > last) ?? ids[0]!;
        last = pickIdx;
        return legal[ids.indexOf(pickIdx)]!;
      });
    }
    return out;
  },
  play(p, rng, skill) {
    // BASE 2.5 s per action: plan the next pour, two taps, watch it settle.
    const BASE = 2.5;
    const puzzle = p as MeasurePuzzleData;
    const rec = recorder();
    const all: MeasureAction[][] = puzzle.boards.map(() => []);
    for (let b = 0; b < puzzle.boards.length; b++) {
      const board = puzzle.boards[b]!;
      let guard = 0;
      while (guard++ < 200) {
        const amounts = measureAmounts(board, all[b]!);
        if (measureSolved(board, amounts)) break;
        const plan = measurePlan(board, amounts);
        let action = plan[0]!;
        if (rng.chance(skill.err)) {
          const legal = measureActions(board).filter((a) => measureApply(board, amounts, a) && JSON.stringify(a) !== JSON.stringify(action));
          if (legal.length) action = rng.pick(legal);
          rec.wait(thinkMs(rng, BASE * 0.5, skill)); // re-planning after the slip
        }
        rec.wait(thinkMs(rng, BASE, skill));
        all[b]!.push(action);
        rec.push(encodeMeasureRound(all));
      }
      if (b < puzzle.boards.length - 1) rec.wait(HOLD_MS);
    }
    return { steps: rec.steps };
  },
};

/* ================================ Checkout ================================ */

const checkoutKit: PuzzleKit = {
  type: "checkout",
  nothing: () => joinCheckoutRound([]),
  spam(p, rng, limitMs) {
    const puzzle = p as CheckoutPuzzleData;
    const out: SpamPlay[] = [];
    // Random darts (wedge + ring each), the last in the finishing ring, Throw; on a refusal Undo them all and move to the next board.
    {
      const solved: string[] = puzzle.stages.map(() => "");
      let t = 0;
      let stage = 0;
      while (t < limitMs && solved.some((s) => !s)) {
        while (solved[stage]) stage = (stage + 1) % puzzle.stages.length;
        const s = puzzle.stages[stage]!;
        const options = checkoutOptions(s);
        const count = s.exactDarts ? s.maxDarts : rng.int(1, s.maxDarts);
        const darts: CheckoutDart[] = Array.from({ length: count - 1 }, () => rng.pick(options));
        darts.push(rng.pick(options.filter((d) => d.ring === s.finish)));
        t += (2 * count + 1) * TAP_MS;
        if (t > limitMs) break;
        if (checkoutValid(s, darts)) { solved[stage] = encodeCheckoutDarts(darts); t += 900; }
        else t += count * TAP_MS + TAP_MS; // Undo each dart, then tap the next board's tab
        stage = (stage + 1) % puzzle.stages.length;
      }
      out.push({ label: "random-darts", answer: joinCheckoutRound(solved) });
    }
    // Every single finishing-ring dart on every board in turn (wedge, ring, Throw, Undo).
    {
      const solved: string[] = puzzle.stages.map(() => "");
      let t = 0;
      outer: for (let i = 0; i < puzzle.stages.length; i++) {
        const s = puzzle.stages[i]!;
        const finishers = checkoutOptions(s).filter((d) => d.ring === s.finish);
        for (const d of finishers) {
          t += 4 * TAP_MS;
          if (t > limitMs) break outer;
          if (checkoutValid(s, [d])) { solved[i] = encodeCheckoutDarts([d]); t += 900; break; }
        }
        t += TAP_MS;
      }
      out.push({ label: "single-finishers", answer: joinCheckoutRound(solved) });
    }
    // Biggest dart that fits, then the finisher if one equals what is left (the greedy mash).
    {
      const solved = puzzle.stages.map((s) => {
        const options = checkoutOptions(s);
        const value = (d: CheckoutDart) => (d.wedge === CHECKOUT_BULL ? 25 : s.wedges[d.wedge]!) * d.ring;
        const darts: CheckoutDart[] = [];
        let left = s.target;
        while (darts.length < s.maxDarts - 1) {
          const fits = options.filter((d) => value(d) <= left && value(d) > 0).sort((a, b) => value(b) - value(a));
          if (!fits.length) break;
          darts.push(fits[0]!);
          left -= value(fits[0]!);
        }
        const fin = options.find((d) => d.ring === s.finish && value(d) === left);
        if (fin) darts.push(fin);
        return checkoutValid(s, darts) ? encodeCheckoutDarts(darts) : "";
      });
      out.push({ label: "greedy", answer: joinCheckoutRound(solved) });
    }
    return out;
  },
  play(p, rng, skill) {
    // BASE 5 s per dart: find a wedge on an odd board and subtract in your head (wedge + ring taps).
    const BASE = 5;
    const puzzle = p as CheckoutPuzzleData;
    const rec = recorder();
    const solved: string[] = puzzle.stages.map(() => "");
    for (let i = 0; i < puzzle.stages.length; i++) {
      const s = puzzle.stages[i]!;
      const route = decodeCheckoutDarts(puzzle.routes?.[i] ?? "", s.maxDarts);
      const options = checkoutOptions(s);
      let guard = 0;
      while (!solved[i] && guard++ < 10) {
        // Enter the darts, sometimes one of them a slip (a wrong wedge or ring).
        const darts = route.map((d) => (rng.chance(skill.err) ? rng.pick(options) : d));
        for (let k = 0; k < darts.length; k++) {
          rec.wait(thinkMs(rng, BASE, skill));
          rec.push(joinCheckoutRound(solved));
        }
        rec.wait(TAP_MS); // Throw
        if (checkoutValid(s, darts)) {
          solved[i] = encodeCheckoutDarts(darts);
          rec.push(joinCheckoutRound(solved));
        } else {
          // Refused: re-check the sums, Undo every dart and try again.
          rec.wait(thinkMs(rng, BASE * 0.6, skill) + darts.length * TAP_MS);
          rec.push(joinCheckoutRound(solved));
        }
      }
      if (!solved[i]) {
        rec.wait(thinkMs(rng, BASE * route.length, skill));
        solved[i] = encodeCheckoutDarts(route);
        rec.push(joinCheckoutRound(solved));
      }
      rec.wait(900);
    }
    return { steps: rec.steps };
  },
};

/* ================================ Ballpark ================================ */

const numlineKit: PuzzleKit = {
  type: "numline",
  nothing: () => encodeNumline([]),
  spam(_p, rng) {
    const all = (v: () => number) => encodeNumline(Array.from({ length: NUMLINE_TOTAL }, v));
    return [
      { label: "random", answer: all(() => rng.int(0, NUMLINE_SCALE)) },
      { label: "all-middle", answer: all(() => NUMLINE_SCALE / 2) },
      { label: "all-left-end", answer: all(() => 0) },
      { label: "all-right-end", answer: all(() => NUMLINE_SCALE) },
    ];
  },
  play(p, rng, skill) {
    // BASE 3.5 s per number: read "√590" or "540 ÷ 12", estimate, drag the marker, Place.
    const BASE = 3.5;
    const puzzle = p as NumlinePuzzleData;
    const rec = recorder();
    // Estimation spread (share of the line): near ≈ 0.8 %, great 1.5 %, good 2.5 %, average 4.5 %.
    const sd = 0.005 + 0.2 * skill.err;
    const placements: number[] = [];
    puzzle.stages.forEach((stage, s) => {
      for (let i = 0; i < NUMLINE_ITEMS; i++) {
        const value = puzzle.values?.[s]?.[i];
        const truth = value ? numlineShare(stage, numlineValue(value)) : 0.5;
        rec.wait(thinkMs(rng, BASE, skill));
        const miss = rng.chance(skill.err) ? rng.normal(0, 0.12) : rng.normal(0, sd);
        const share = Math.max(0, Math.min(1, truth + miss));
        placements.push(Math.round(share * NUMLINE_SCALE));
        rec.push(encodeNumline(placements));
      }
    });
    return { steps: rec.steps };
  },
};

export const KITS_NUMBER: PuzzleKit[] = [
  targetKit,
  equationKit,
  balanceKit,
  numpyramidKit,
  trailKit,
  measureKit,
  checkoutKit,
  numlineKit,
];
