/**
 * Pipeline's person-like player (Joe, 16 Nov 2026: prove Expert humanly possible to SCORE well on, not just to finish).
 *
 * Unlike the puzzle-fairness kit (which knows the stored solution and only pays think time per tile), this player
 * knows nothing but the dealt tiles and reasons them out one tile at a time, the way a person plays Net:
 *
 * - local: a tile's turns that fit its known neighbours and the walls (the edges every remaining turn agrees on are
 *   then known too). A person looks at one tile and its four sides;
 * - loop: a pipe that would join two tiles already joined is ruled out (the network is a tree);
 * - seal: a turn that would close a group of joined pipes off from the rest of the board is ruled out.
 *
 * No search, no guessing: it does only what those three rules give, always the cheapest first (a person looks for an
 * easy local fix before holding a whole group in mind), and turns a tile the moment it is fixed (the fewest turns,
 * either way, as pipesRev 5 lets a long press turn back). The deductions are exactly deducePipes'
 * (pipesSolve.server.ts), done one at a time, so it fixes a board exactly when deducePipes does.
 *
 * Time, at a skill's pace (the kit's SKILLS paces: near-perfect 0.5, great 0.72, good 1.0):
 *   a local deduction that fixes a tile     1.6 s × pace (the kit's PIPE_BASE, its time to find one tile's fit)
 *   a local deduction that only narrows it  0.8 s × pace
 *   a loop or seal deduction                3.2 s × pace (holding a group in mind: twice a tile)
 *   each turn                               250 ms (the kit's)
 * The finish time is played through the real grader (gradeAnswer) with the round's own clock.
 *
 *   bun scripts/pipes-human.ts [--seeds=60] [--levels=easy,normal,hard,expert] [--skills=near,great,good] [--list]
 */
import { PIPE_E, PIPE_N, PIPE_S, PIPE_W, rotateMask, tileOpenings, pipesDims } from "../src/lib/duel/logic";
import type { PipesTurn } from "../src/lib/duel/depth4/pipesTaps";
import type { PuzzleData } from "../src/lib/duel/types";

type Pipes = Extract<PuzzleData, { type: "pipes" }>;
const DIRS = [PIPE_N, PIPE_E, PIPE_S, PIPE_W] as const;

export const HUMAN_PIPES_COST = { fixS: 1.6, narrowS: 0.8, globalS: 3.2, turnMs: 250 } as const;

export interface PipesHumanRun {
  /** Every tile fixed (and so turned to the board's one layout). */
  solved: boolean;
  /** Ms of the round clock used when the last tile was turned (or when it got stuck). */
  ms: number;
  turns: PipesTurn[];
  /** Each turn's round-clock time (ms), in order. */
  at: number[];
  local: number;
  global: number;
  /** The final side-sets. */
  sides: number[];
}

const turnsOf = (mask: number): number[] => {
  const out: number[] = [];
  for (let t = 0; t < 4; t++) {
    const m = rotateMask(mask & 15, t);
    if (!out.includes(m)) out.push(m);
  }
  return out;
};

/** Plays a dealt board like a person at `pace` (SKILLS pace multiplier). */
export function pipesHumanPlay(p: Pipes, pace: number): PipesHumanRun {
  const { cols, rows, cells: n } = pipesDims(p);
  // Edges: per cell its edge id in N, E, S, W (or -1 at a wall), per edge its two cells.
  const edgeOf = new Int32Array(n * 4).fill(-1);
  const ends: number[] = [];
  for (let cell = 0, id = 0; cell < n; cell++) {
    const r = Math.floor(cell / cols);
    const c = cell % cols;
    if (c < cols - 1) {
      edgeOf[cell * 4 + 1] = id;
      edgeOf[(cell + 1) * 4 + 3] = id;
      ends.push(cell, cell + 1);
      id++;
    }
    if (r < rows - 1) {
      edgeOf[cell * 4 + 2] = id;
      edgeOf[(cell + cols) * 4] = id;
      ends.push(cell, cell + cols);
      id++;
    }
  }
  const edges = ends.length / 2;
  const sides = p.tiles.map(tileOpenings);
  const cand = sides.map(turnsOf);
  const edge = new Int8Array(edges).fill(-1);
  const turns: PipesTurn[] = [];
  const at: number[] = [];
  let ms = 0;
  let local = 0;
  let global = 0;
  const other = (e: number, cell: number) => (ends[e * 2] === cell ? ends[e * 2 + 1]! : ends[e * 2]!);

  /** Turn a fixed tile to its one remaining side-set, the shorter way round. */
  const settle = (cell: number) => {
    const want = cand[cell]![0]!;
    let t = 0;
    while (rotateMask(sides[cell]!, t) !== want) t++;
    const step = (turn: 1 | 3) => {
      ms += HUMAN_PIPES_COST.turnMs;
      turns.push({ cell, turn });
      at.push(ms);
    };
    if (t === 3) step(3);
    else for (let i = 0; i < t; i++) step(1);
    sides[cell] = want;
  };
  /** Narrow a cell to `keep`, learning the edges its turns agree on; charges the given think time. */
  const narrow = (cell: number, keep: number[], thinkS: number) => {
    cand[cell] = keep;
    ms += thinkS * 1000 * pace;
    for (let d = 0; d < 4; d++) {
      const e = edgeOf[cell * 4 + d]!;
      if (e < 0 || edge[e] !== -1) continue;
      const opens = keep.filter((m) => m & DIRS[d]!).length;
      if (opens === 0) edge[e] = 0;
      else if (opens === keep.length) edge[e] = 1;
    }
    if (keep.length === 1) settle(cell);
  };
  // Tiles that look the same every way round (a cross) are known from the start.
  for (let cell = 0; cell < n; cell++) if (cand[cell]!.length === 1) narrow(cell, cand[cell]!, 0);

  const localStep = (): boolean => {
    for (let cell = 0; cell < n; cell++) {
      const cs = cand[cell]!;
      if (cs.length < 2) continue;
      const fits = cs.filter((m) =>
        DIRS.every((bit, d) => {
          const e = edgeOf[cell * 4 + d]!;
          const open = (m & bit) !== 0;
          if (e < 0) return !open;
          return edge[e] === -1 || (edge[e] === 1) === open;
        }),
      );
      if (fits.length && fits.length < cs.length) {
        local++;
        narrow(cell, fits, fits.length === 1 ? HUMAN_PIPES_COST.fixS : HUMAN_PIPES_COST.narrowS);
        return true;
      }
    }
    // An edge every turn of a tile already agrees on, but not yet noted (from a neighbour's narrowing): free.
    return false;
  };
  const groupsNow = () => {
    const parent = new Int32Array(n).map((_, i) => i);
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x]!)));
    for (let e = 0; e < edges; e++) if (edge[e] === 1) parent[find(ends[e * 2]!)] = find(ends[e * 2 + 1]!);
    return Array.from({ length: n }, (_, i) => find(i));
  };
  const globalStep = (): boolean => {
    const g = groupsNow();
    // Loop: a pipe between two tiles already joined.
    for (let e = 0; e < edges; e++) {
      if (edge[e] !== -1 || g[ends[e * 2]!] !== g[ends[e * 2 + 1]!]) continue;
      global++;
      edge[e] = 0;
      ms += HUMAN_PIPES_COST.globalS * 1000 * pace;
      return true;
    }
    // Seal: a turn that closes its group (with whatever it joins) off from the rest of the board.
    const size = new Map<number, number>();
    const exits = new Map<number, number>();
    for (const root of g) size.set(root, (size.get(root) ?? 0) + 1);
    for (let e = 0; e < edges; e++) {
      if (edge[e] !== -1) continue;
      const a = g[ends[e * 2]!]!;
      const c = g[ends[e * 2 + 1]!]!;
      exits.set(a, (exits.get(a) ?? 0) + 1);
      exits.set(c, (exits.get(c) ?? 0) + 1);
    }
    for (let cell = 0; cell < n; cell++) {
      const cs = cand[cell]!;
      if (cs.length < 2) continue;
      const root = g[cell]!;
      const keep = cs.filter((m) => {
        let merged = size.get(root)!;
        let out = exits.get(root) ?? 0;
        const joined = new Set([root]);
        for (let d = 0; d < 4; d++) {
          const e = edgeOf[cell * 4 + d]!;
          if (e < 0 || edge[e] !== -1) continue;
          const og = g[other(e, cell)]!;
          if (m & DIRS[d]!) {
            if (joined.has(og)) return false;
            joined.add(og);
            merged += size.get(og)!;
            out += (exits.get(og) ?? 0) - 2;
          } else out -= 1;
        }
        return merged === n || out > 0;
      });
      if (keep.length && keep.length < cs.length) {
        global++;
        narrow(cell, keep, HUMAN_PIPES_COST.globalS);
        return true;
      }
    }
    return false;
  };
  for (let guard = 0; guard < 100_000; guard++) if (!localStep() && !globalStep()) break;
  return { solved: cand.every((c) => c.length === 1), ms, turns, at, local, global, sides };
}

if (import.meta.main) {
  const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
  const seeds = Number(arg("seeds", "60"));
  const levels = arg("levels", "easy,normal,hard,expert").split(",");
  const skills = arg("skills", "near,great,good").split(",");
  const list = process.argv.includes("--list");
  const { generatePuzzle, gradeAnswer } = await import("../src/lib/duel/generate.server");
  const { withSeededRandom } = await import("../src/lib/duel/random");
  const { puzzleTimeLimitMs } = await import("../src/lib/duel/registry");
  const { encodePipesTurnAnswer, pipesAfterTurns } = await import("../src/lib/duel/depth4/pipesTaps");
  const { SKILLS } = await import("./puzzle-fairness/kit");
  for (const level of levels) {
    const boards = Array.from({ length: seeds }, (_, i) => {
      const seed = 160_000 + 13 * i;
      return { seed, p: withSeededRandom(seed, () => generatePuzzle("pipes", { bankSeed: seed, ...(level === "normal" ? {} : { level: level as never }) })) as Pipes };
    });
    for (const skill of skills) {
      const pace = SKILLS[skill as keyof typeof SKILLS].pace;
      const scores: number[] = [];
      const times: number[] = [];
      let finished = 0;
      let fixed = 0;
      for (const { seed, p } of boards) {
        const run = pipesHumanPlay(p, pace);
        const limit = puzzleTimeLimitMs(p);
        if (run.solved) fixed++;
        const inTime = run.solved && run.ms <= limit;
        // Out of time: the board as it stood at the buzzer (the turns made by then).
        const log = inTime ? run.turns : run.turns.filter((_, i) => run.at[i]! <= limit);
        const board = pipesAfterTurns(p.tiles, log);
        const gr = gradeAnswer(p, encodePipesTurnAnswer(board, log), inTime ? limit - run.ms : 0);
        if (gr.isCorrect) finished++;
        scores.push(gr.score);
        if (inTime) times.push(run.ms / 1000);
        if (list && skill === skills[0]) console.log(`  ${level} seed ${seed}: ${run.solved ? "fixed" : "stuck"} in ${(run.ms / 1000).toFixed(1)} s, local ${run.local}, loop/seal ${run.global}, turns ${run.turns.length} (par ${p.par}), score ${gr.score}`);
      }
      scores.sort((a, b) => a - b);
      times.sort((a, b) => a - b);
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
      console.log(
        `pipes-human ${level.padEnd(6)} ${skill.padEnd(5)} avg ${avg.toFixed(1).padStart(5)}  median ${scores[Math.floor(scores.length / 2)]}  finished ${Math.round((100 * finished) / boards.length)}%  fixed ${Math.round((100 * fixed) / boards.length)}%  median finish ${times.length ? times[Math.floor(times.length / 2)]!.toFixed(1) : "-"} s`,
      );
    }
  }
}

