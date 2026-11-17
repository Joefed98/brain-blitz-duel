/**
 * The Kakuro player kit (scripts/puzzle-fairness/kit.ts): nothing, spam (random digits, all nines, every across run
 * filled with a set of distinct digits that makes its sum) and a simulated solver that places the solution's digits in a
 * human order with mistakes fixed a few actions later, as Box Six's kit does. Script-only.
 */
import type { KakuroPuzzleData } from "../../src/lib/duel/types";
import { encodeKakuro, kakuroRuns } from "../../src/lib/duel/kakuro";
import { kakuroPersonSolve } from "../../src/lib/duel/kakuro.server";
import { kakuroLevelsBoard } from "../../src/lib/duel/numberLevels";
import { puzzleLevel } from "../../src/lib/levels/levels";
import { thinkMs, type Play, type PuzzleKit, type Rng, type Skill, type Step } from "./kit";

/**
 * Levels (kakuroRev 3, numberLevels.ts): a square a person only sees after k passes over the runs
 * (kakuro.server.ts `kakuroPersonSolve`) takes KAKURO_PASS_COST more of the base per pass after the first, and the
 * squares are filled in the order a person deduces them. Boards dealt at Hard (today's, stamped `level`) are played
 * the same way; every board dealt without a level on an earlier stamp plays exactly as before.
 */
export const KAKURO_PASS_COST = 0.3;

// BASE 4 s per square: a good player fills a 19–21-square Kakuro (sums, combinations, crossings) in about 80 s.
const KAKURO_BASE = 4;

/** Places targets in `order`; at skill.err a wrong digit goes in and is fixed 1–5 actions later (or before the end). */
function placePlay(p: KakuroPuzzleData, order: [number, number][], rng: Rng, skill: Skill, cost: (cell: number) => number = () => 1): Play {
  const values = new Array<number>(p.size * p.size).fill(0);
  const pending = new Map(order);
  const wrongs: { cell: number; fixAt: number }[] = [];
  const steps: Step[] = [];
  let t = 0;
  let actions = 0;
  const push = () => steps.push({ answer: encodeKakuro(values), atMs: t });
  let guard = 0;
  while ((pending.size || wrongs.length) && guard++ < 2000) {
    const due = wrongs.find((w) => w.fixAt <= actions) ?? (pending.size === 0 ? wrongs[0] : undefined);
    if (due) {
      t += thinkMs(rng, KAKURO_BASE * 0.6, skill);
      wrongs.splice(wrongs.indexOf(due), 1);
      values[due.cell] = pending.get(due.cell) ?? 0;
      pending.delete(due.cell);
      actions++;
      push();
      continue;
    }
    // A wrong digit waiting to be fixed is left until it falls due.
    const next = [...pending.entries()].find(([c]) => !wrongs.some((w) => w.cell === c));
    if (!next) {
      wrongs.sort((a, b) => a.fixAt - b.fixAt);
      wrongs[0]!.fixAt = actions;
      continue;
    }
    const [cell, digit] = next;
    t += thinkMs(rng, KAKURO_BASE * cost(cell), skill);
    if (rng.chance(skill.err)) {
      const options = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d !== digit);
      values[cell] = rng.pick(options);
      wrongs.push({ cell, fixAt: actions + rng.int(1, 5) });
    } else {
      values[cell] = digit;
      pending.delete(cell);
      const w = wrongs.findIndex((x) => x.cell === cell);
      if (w >= 0) wrongs.splice(w, 1);
    }
    actions++;
    push();
  }
  return { steps };
}

/** A human order: run by run (shortest first, the forced ones), each run's squares in turn. */
function humanOrder(p: KakuroPuzzleData, rng: Rng): [number, number][] {
  const runs = rng.shuffle(kakuroRuns(p)).sort((a, b) => a.cells.length - b.cells.length);
  const seen = new Set<number>();
  const out: [number, number][] = [];
  for (const run of runs)
    for (const c of run.cells)
      if (!seen.has(c)) {
        seen.add(c);
        out.push([c, p.solution?.[c] ?? 0]);
      }
  return out;
}

export const kakuroKit: PuzzleKit = {
  type: "kakuro",
  nothing: (p) => encodeKakuro(new Array<number>((p as KakuroPuzzleData).size ** 2).fill(0)),
  spam(p, rng) {
    const pz = p as KakuroPuzzleData;
    const n = pz.size * pz.size;
    const random = new Array<number>(n).fill(0);
    const nines = new Array<number>(n).fill(0);
    for (const c of pz.white) {
      random[c] = rng.int(1, 9);
      nines[c] = 9;
    }
    // Each across run gets distinct digits adding to its sum (ignoring the down runs).
    const runFill = new Array<number>(n).fill(0);
    for (const run of kakuroRuns(pz).filter((r) => r.across)) {
      for (let tries = 0; tries < 400; tries++) {
        const digits = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, run.cells.length);
        if (digits.reduce((a, b) => a + b, 0) !== run.sum) continue;
        run.cells.forEach((c, i) => (runFill[c] = digits[i]!));
        break;
      }
    }
    return [
      { label: "random-digits", answer: encodeKakuro(random) },
      { label: "all-nines", answer: encodeKakuro(nines) },
      { label: "across-sums", answer: encodeKakuro(runFill) },
    ];
  },
  play(p, rng, skill) {
    const pz = p as KakuroPuzzleData;
    // Every board dealt with the levels, Hard (today's board, stamped `level`) included, so the levels compare fairly.
    if (!kakuroLevelsBoard(pz) && puzzleLevel(pz) === "normal") return placePlay(pz, humanOrder(pz, rng), rng, skill);
    const person = kakuroPersonSolve(pz);
    // A square the person-like solver never reaches (some of today's Hard boards) is the slowest of all: two passes
    // past the last it took.
    const last = Math.max(1, ...pz.white.map((c) => person.round[c] ?? 0));
    const round = pz.white.reduce((r, c) => ((r[c] = person.round[c] || last + 2), r), [...person.round]);
    const order = humanOrder(pz, rng).sort((a, b) => (round[a[0]] ?? 0) - (round[b[0]] ?? 0));
    return placePlay(pz, order, rng, skill, (cell) => 1 + KAKURO_PASS_COST * Math.max(0, (round[cell] ?? 1) - 1));
  },
};
