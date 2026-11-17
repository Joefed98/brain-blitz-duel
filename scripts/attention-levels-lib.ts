/** attention-levels-check's person-like solvers (a script library, not a check). */
import { bombActionsOf } from "../src/lib/duel/bombLevels.server";
import { mazeCorridorNeighbours } from "../src/lib/duel/maze";
import type { BombPuzzleData, MazePuzzleData } from "../src/lib/duel/types";

/**
 * A person working out the bomb: crosses out what the card forbids, writes in the steps it fixes, then fills the rest a
 * step at a time with the actions the card needs first, giving up an order as soon as a clue rules it out. Returns the
 * orders tried before the answer (Infinity past `patience`).
 */
export function personBombTries(p: BombPuzzleData, patience: number): number {
  const actions = bombActionsOf(p.wires.length);
  const steps = p.stepCount;
  const ids = p.rules.map((r) => r.id);
  const colours = (c: string) => p.wires.flatMap((w, i) => (w === c ? [`w${i}`] : []));
  const banned = new Set<string>();
  const needed = new Set<string>();
  const fixed: (string | null)[] = Array.from({ length: steps }, () => null);
  for (const id of ids) {
    const [k, a, b] = id.split(":");
    if (k === "no") banned.add(a!);
    else if (k === "none") colours(a!).forEach((w) => banned.add(w));
    else if (k === "every") colours(a!).forEach((w) => needed.add(w));
    else if (k === "both-buttons") (needed.add("bA"), needed.add("bB"));
    else if (k === "step") (fixed[Number(a) - 1] = b!, needed.add(b!));
    else if (k === "before" || k === "next") (needed.add(a!), needed.add(b!));
  }
  const ok = (prefix: string[]): boolean => {
    const left = steps - prefix.length;
    if ([...needed].filter((x) => !prefix.includes(x)).length > left) return false;
    for (const id of ids) {
      const [k, a, b] = id.split(":");
      if (k === "step") {
        const at = Number(a) - 1;
        if (prefix.indexOf(b!) >= 0 && prefix.indexOf(b!) !== at) return false;
      } else if (k === "before") {
        if (prefix.indexOf(b!) >= 0 && prefix.indexOf(a!) < 0) return false;
      } else if (k === "next") {
        const x = prefix.indexOf(a!);
        if (x >= 0 && x + 1 < prefix.length && prefix[x + 1] !== b) return false;
        const y = prefix.indexOf(b!);
        if (y >= 0 && (y === 0 || prefix[y - 1] !== a)) return false;
      } else if (k === "cuts") {
        const cuts = prefix.filter((x) => x.startsWith("w")).length;
        if (cuts > Number(a) || cuts + left < Number(a)) return false;
      }
    }
    return true;
  };
  let tries = 0;
  let found: string | null = null;
  const order = [...actions].filter((a) => !banned.has(a)).sort((x, y) => Number(needed.has(y)) - Number(needed.has(x)));
  const walk = (prefix: string[]) => {
    if (found || tries > patience) return;
    tries++;
    if (!ok(prefix)) return;
    if (prefix.length === steps) {
      found = prefix.join(",");
      return;
    }
    const at = fixed[prefix.length];
    // A step the card fixes takes its action; elsewhere any action not used and not fixed to another step.
    for (const a of at ? [at] : order) if (!prefix.includes(a) && (a === at || !fixed.includes(a))) walk([...prefix, a]);
  };
  walk([]);
  return found === p.sequence ? tries : Infinity;
}


/**
 * A person in Expert's maze, who can read the walls but not see the exit: they know it is on the far edges (the bottom
 * row's right half or the right column's lower half, as the deal puts it), trace by eye the way to the nearest such edge
 * square, walk it, and check the edge squares nearest first (walking the maze between them) until the exit shows
 * (within `reveal` squares), then walk to it. Their time: 3 s to look the maze over, 1 s each time they pick the next
 * square to check, 0.2 s a square drawn (a little slower than Normal's elite).
 */
export function personMazeSeconds(p: MazePuzzleData, reveal: number): number {
  const cols = p.cols!;
  const rows = p.rows!;
  const dist = (from: number): Map<number, number> => {
    const d = new Map([[from, 0]]);
    const q = [from];
    while (q.length) {
      const c = q.shift()!;
      for (const n of mazeCorridorNeighbours(p.cells, c, cols)) if (!d.has(n)) (d.set(n, d.get(c)! + 1), q.push(n));
    }
    return d;
  };
  const near = (c: number) => Math.abs((c % cols) - (p.exit % cols)) + Math.abs(Math.floor(c / cols) - Math.floor(p.exit / cols)) <= reveal;
  const candidates: number[] = [];
  for (let c = Math.ceil(cols / 2); c < cols - 1; c++) candidates.push((rows - 1) * cols + c);
  for (let r = Math.ceil(rows / 2); r < rows - 1; r++) candidates.push(r * cols + cols - 1);
  let here = p.start;
  let steps = 0;
  let picks = 0;
  const left = new Set(candidates);
  while (!near(here) && left.size) {
    const d = dist(here);
    const next = [...left].sort((a, b) => d.get(a)! - d.get(b)!)[0]!;
    left.delete(next);
    picks++;
    // Walk towards it, stopping as soon as the exit shows.
    const back = dist(next);
    while (here !== next && !near(here)) {
      here = mazeCorridorNeighbours(p.cells, here, cols).sort((a, b) => back.get(a)! - back.get(b)!)[0]!;
      steps++;
    }
    for (const c of [...left]) if (dist(here).get(c)! === 0) left.delete(c);
  }
  steps += dist(here).get(p.exit) ?? 0;
  return 3 + picks + 0.2 * steps;
}
