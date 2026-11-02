/**
 * The Bridges player kit (scripts/puzzle-fairness/kit.ts): nothing, spam and a simulated solver that builds the
 * solution's bridges one at a time (a bridge built by mistake is removed a few actions later), with human-like seconds
 * per bridge: a good player finishes a 10–14 island board in about a minute.
 */
import { bridgePairs, crossingTable, encodeBridges } from "../../src/lib/duel/bridges";
import type { BridgesPuzzleData } from "../../src/lib/duel/types";
import { thinkMs, type Play, type PuzzleKit, type SpamPlay, type Step } from "./kit";

/** Seconds per bridge for a good player (spot the deduction, drag it). */
const BRIDGES_BASE = 3.4;

export const bridgesKit: PuzzleKit = {
  type: "bridges",
  nothing: () => "",
  spam(p, rng) {
    const pz = p as BridgesPuzzleData;
    const pairs = bridgePairs(pz.islands, pz.size);
    const crosses = crossingTable(pairs);
    const out: SpamPlay[] = [];
    // Every pair doubled where the phone allows it (crossings refused).
    const all = new Array<number>(pairs.length).fill(0);
    for (const i of rng.shuffle(pairs.map((_, j) => j))) if (!crosses[i]!.some((j) => all[j])) all[i] = 2;
    out.push({ label: "every pair doubled", answer: encodeBridges(all) });
    // Random drags (1–2 bridges on random pairs).
    for (let run = 0; run < 2; run++) {
      const counts = new Array<number>(pairs.length).fill(0);
      for (let k = 0; k < 40; k++) {
        const i = rng.below(pairs.length);
        if (!counts[i] && crosses[i]!.some((j) => counts[j])) continue;
        counts[i] = (counts[i]! + 1) % 3;
      }
      out.push({ label: "random drags", answer: encodeBridges(counts) });
    }
    return out;
  },
  play(p, rng, skill): Play {
    const pz = p as BridgesPuzzleData;
    const pairs = bridgePairs(pz.islands, pz.size);
    const crosses = crossingTable(pairs);
    const sol = pz.solution ?? [];
    const targets: number[] = [];
    sol.forEach((k, i) => {
      for (let n = 0; n < k; n++) targets.push(i);
    });
    const order = rng.shuffle(targets);
    const counts = new Array<number>(pairs.length).fill(0);
    const steps: Step[] = [];
    const wrongs: { pair: number; fixAt: number }[] = [];
    let t = 0;
    let actions = 0;
    const push = () => steps.push({ answer: encodeBridges(counts), atMs: t });
    let guard = 0;
    while ((order.length || wrongs.length) && guard++ < 500) {
      const due = wrongs.find((w) => w.fixAt <= actions) ?? (order.length === 0 ? wrongs[0] : undefined);
      if (due) {
        // Spotting it and dragging the pair round to its right count (two drags on the cycle 0 → 1 → 2 → 0).
        t += thinkMs(rng, BRIDGES_BASE * 0.7, skill) + thinkMs(rng, BRIDGES_BASE * 0.4, skill);
        wrongs.splice(wrongs.indexOf(due), 1);
        counts[due.pair] = sol[due.pair] ?? 0;
        actions += 2;
        push();
        continue;
      }
      if (rng.chance(skill.err)) {
        const options = pairs
          .map((_, i) => i)
          .filter((i) => counts[i]! < 2 && counts[i]! >= (sol[i] ?? 0) && !(counts[i] === 0 && crosses[i]!.some((j) => counts[j])));
        if (options.length) {
          const i = rng.pick(options);
          t += thinkMs(rng, BRIDGES_BASE, skill);
          counts[i] = counts[i]! + 1;
          wrongs.push({ pair: i, fixAt: actions + rng.int(1, 5) });
          actions += 1;
          push();
          continue;
        }
      }
      // The next planned bridge whose crossings are clear (wrong bridges in the way are fixed first).
      const k = order.findIndex((i) => !(counts[i] === 0 && crosses[i]!.some((j) => counts[j])));
      if (k < 0) {
        if (wrongs.length) {
          wrongs[0]!.fixAt = actions;
          continue;
        }
        break;
      }
      const i = order.splice(k, 1)[0]!;
      t += thinkMs(rng, BRIDGES_BASE, skill);
      counts[i] = Math.min(2, counts[i]! + 1);
      actions += 1;
      push();
    }
    return { steps };
  },
};
