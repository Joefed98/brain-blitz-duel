/**
 * The Fences player kit (scripts/puzzle-fairness/kit.ts): nothing, spam and a simulated solver that draws the stored
 * loop's edges in a shuffled order, sometimes drawing a wrong line next to the work and erasing it 1–5 actions later.
 * BASE 2.3 s an edge (spot it from the numbers, drag it): a good player closes a ~24-edge 6 × 6 loop in about 55–65 s.
 * Script-only: floats and Math are fine; every answer is graded by gradeAnswer.
 */
import type { FencesPuzzleData } from "../../src/lib/duel/types";
import { FENCES_EMPTY, FENCES_LINE, dotEdges, edgeDots, encodeFences, fencesEdgeCount } from "../../src/lib/duel/fences";
import { thinkMs, type PuzzleKit, type Step } from "./kit";

const BASE = 2.3;

export const fencesKit: PuzzleKit = {
  type: "fences",
  nothing: (p) => encodeFences(new Array<number>(fencesEdgeCount((p as FencesPuzzleData).size)).fill(FENCES_EMPTY)),
  spam(p, rng, limitMs) {
    const pz = p as FencesPuzzleData;
    const n = fencesEdgeCount(pz.size);
    // Every edge drawn.
    const all = encodeFences(new Array<number>(n).fill(FENCES_LINE));
    // Random taps at 2 a second (each tap cycles empty → line → ✕ → empty).
    const taps = new Array<number>(n).fill(FENCES_EMPTY);
    for (let i = 0; i < Math.floor((limitMs / 1000) * 2); i++) {
      const e = rng.below(n);
      taps[e] = (taps[e]! + 1) % 3;
    }
    // Half the edges drawn at random.
    const half = new Array<number>(n).fill(FENCES_EMPTY).map(() => (rng.chance(0.5) ? FENCES_LINE : FENCES_EMPTY));
    return [
      { label: "every edge", answer: all },
      { label: "random taps", answer: encodeFences(taps) },
      { label: "random half", answer: encodeFences(half) },
    ];
  },
  play(p, rng, skill) {
    const pz = p as FencesPuzzleData;
    const size = pz.size;
    const sol = new Set(pz.solution ?? []);
    const states = new Array<number>(fencesEdgeCount(size)).fill(FENCES_EMPTY);
    const pending = rng.shuffle([...sol]);
    const wrongs: { edge: number; fixAt: number }[] = [];
    const steps: Step[] = [];
    let t = 0;
    let actions = 0;
    const push = () => steps.push({ answer: encodeFences(states), atMs: t });
    let guard = 0;
    while ((pending.length || wrongs.length) && guard++ < 1000) {
      const due = wrongs.find((w) => w.fixAt <= actions) ?? (pending.length ? undefined : wrongs[0]);
      if (due) {
        t += thinkMs(rng, BASE * 0.7, skill);
        states[due.edge] = FENCES_EMPTY;
        wrongs.splice(wrongs.indexOf(due), 1);
        actions++;
        push();
        continue;
      }
      if (rng.chance(skill.err)) {
        // A wrong line touching a drawn one (or anywhere at the start).
        const drawn = states.flatMap((s, e) => (s === FENCES_LINE ? [e] : []));
        const near = drawn.length
          ? drawn.flatMap((e) => edgeDots(size, e).flatMap((d) => dotEdges(size, d)))
          : Array.from({ length: states.length }, (_, e) => e);
        const options = near.filter((e) => !sol.has(e) && states[e] === FENCES_EMPTY);
        if (options.length) {
          const e = rng.pick(options);
          t += thinkMs(rng, BASE, skill);
          states[e] = FENCES_LINE;
          wrongs.push({ edge: e, fixAt: actions + rng.int(1, 5) });
          actions++;
          push();
          continue;
        }
      }
      const e = pending.shift()!;
      t += thinkMs(rng, BASE, skill);
      states[e] = FENCES_LINE;
      actions++;
      push();
    }
    return { steps };
  },
};
