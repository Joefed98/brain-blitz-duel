/**
 * The Fillomino player kit (scripts/puzzle-fairness/kit.ts): doing nothing, spam (one number everywhere, random
 * numbers, every blank as a 1) and a simulated solver that numbers the blanks toward the stored solution, region by
 * region in a shuffled order, with wrong numbers that are spotted and fixed 1–5 actions later. Script-only.
 *
 * BASE 1.8 s per square (read the clues, count the region, tap or paint): a good player numbers the ~31 blanks of a
 * 7 × 7 board in about 55–65 s; drags paint several squares at once, which the per-square time already averages in.
 */
import { encodeFillomino, fillominoGroups } from "../../src/lib/duel/fillomino";
import type { FillominoPuzzleData } from "../../src/lib/duel/types";
import { thinkMs, type Play, type PuzzleKit, type Rng, type Skill, type Step } from "./kit";

const FILLOMINO_BASE = 1.8;

function grid(givens: readonly number[], state: ReadonlyMap<number, number>): number[] {
  return givens.map((g, c) => (g ? g : (state.get(c) ?? 0)));
}

/** Numbers the blanks toward the solution with mistakes (the placement player of kits-logic.ts, per square). */
function fillPlay(p: FillominoPuzzleData, rng: Rng, skill: Skill): Play {
  const solution = p.solution ?? [];
  // Regions in a shuffled order, squares in each region in order: how people fill one region at a time.
  const regions = rng.shuffle(fillominoGroups(p.size, solution).cells);
  const order: number[] = [];
  for (const members of regions) for (const c of members) if (!p.givens[c]) order.push(c);
  const state = new Map<number, number>();
  const wrongs: { cell: number; fixAt: number }[] = [];
  const steps: Step[] = [];
  let t = 0;
  let actions = 0;
  const push = () => steps.push({ answer: encodeFillomino(grid(p.givens, state)), atMs: t });
  let i = 0;
  let guard = 0;
  while ((i < order.length || wrongs.length) && guard++ < 2000) {
    const due = wrongs.find((w) => w.fixAt <= actions) ?? (i >= order.length ? wrongs[0] : undefined);
    if (due) {
      t += thinkMs(rng, FILLOMINO_BASE * 0.6, skill);
      wrongs.splice(wrongs.indexOf(due), 1);
      state.set(due.cell, solution[due.cell]!);
      actions++;
      push();
      continue;
    }
    const cell = order[i]!;
    t += thinkMs(rng, FILLOMINO_BASE, skill);
    if (rng.chance(skill.err)) {
      const wrong = rng.pick([1, 2, 3, 4, 5, 6, 7].filter((v) => v !== solution[cell]));
      state.set(cell, wrong);
      wrongs.push({ cell, fixAt: actions + rng.int(1, 5) });
    } else state.set(cell, solution[cell]!);
    i++;
    actions++;
    push();
  }
  return { steps };
}

export const fillominoKit: PuzzleKit = {
  type: "fillomino",
  nothing: (p) => encodeFillomino((p as FillominoPuzzleData).givens),
  spam(p, rng) {
    const { givens } = p as FillominoPuzzleData;
    const one = rng.int(1, 6);
    return [
      { label: "same-number", answer: encodeFillomino(givens.map((g) => g || one)) },
      { label: "random-numbers", answer: encodeFillomino(givens.map((g) => g || rng.int(1, 7))) },
      { label: "all-ones", answer: encodeFillomino(givens.map((g) => g || 1)) },
    ];
  },
  play: (p, rng, skill) => fillPlay(p as FillominoPuzzleData, rng, skill),
};
