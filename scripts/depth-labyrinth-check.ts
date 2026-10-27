/**
 * Labyrinth depth to 200 check (25 Oct 2026, `mazeRev: 1`; src/lib/duel/depth/labyrinth.ts,
 * docs/depth/d3-speed-attention.md).
 *
 *   1. Legacy identity: 576 grades of 12 room mazes as main dealt them (puzzleScoreRev 3, re-stamped 2, 1 and
 *      unstamped; nothing, spam, kit players, half-way drafts), recorded on unmodified main by
 *      depth-labyrinth-record.ts, regrade exactly (score, finish, stored detail).
 *   2. Dealt stamp and generation on 30 room seeds: mazeRev 1, 19 × 23, the route as long as before (≤ 147 cells,
 *      ≥ MAZE_MIN_PATH), three stars, each off the route, 3–6 cells into its own side branch, one per third of
 *      the route; the stars reach the phone, the route does not.
 *   3. Rules: the trail answer round-trips; a step through a wall ends the walk; the drawn route folds backtracks;
 *      stars count only when rolled over and only with a finish; no stars caps a finish at 150; all three stars
 *      with a fast finish is 200; an unfinished trail never beats a finish; nothing and scribbling stay near 0.
 *   4. Distribution: a simulated player (the puzzle-fairness kit's model: 0.4 s a route cell × pace, wrong turns
 *      followed into the branch and back, plus star detours taken by level) at five skill levels on 30 seeds,
 *      the old stamp (19 × 19, path answer, no stars) beside the new one: median, top 10 % and best.
 *
 *   bun scripts/depth-labyrinth-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { encodeMazePath, mazeColsOf, mazeCorridorNeighbours, mazeRoute } from "../src/lib/duel/maze";
import { generateMazeClassic } from "../src/lib/duel/maze.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { SPEED_PAR_VERSION } from "../src/lib/duel/speedPar";
import { MAZE_MIN_PATH, type MazePuzzleData, type PuzzleData } from "../src/lib/duel/types";
import {
  LAB_COLS,
  LAB_ROUTE_MAX,
  LAB_ROWS,
  LAB_STARS,
  LAB_STAR_DEPTH_MAX,
  LAB_STAR_DEPTH_MIN,
  MAZE_REV_DEPTH,
  decodeMazeTrail,
  encodeMazeTrail,
  mazeTrailRoute,
  mazeTrailWalk,
} from "../src/lib/duel/depth/labyrinth";
import { makeRng, hashText, type Rng } from "./puzzle-fairness/kit";
import { pinPrePhoneNotes } from "../src/lib/duel/phoneNotes";

// Written for the stamps before Joe's phone notes (27 Oct 2026): new deals stay on them here; phone-notes-check proves
// the stamps rooms deal now.
pinPrePhoneNotes(true);

let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, msg: string) => {
  checks++;
  if (!cond) failures.push(msg);
};

/* ------------------------------------------------------------------ 1. legacy identity */
{
  const entries = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/depth-labyrinth-legacy.json.gz")).toString()) as {
    puzzle: PuzzleData; answer: string; ms: number; score: number; isCorrect: boolean; extra: unknown;
  }[];
  let same = 0;
  for (const e of entries) {
    const g = gradeAnswer(e.puzzle, e.answer, e.ms);
    if (g.score === e.score && g.isCorrect === e.isCorrect && JSON.stringify(g.extra) === JSON.stringify(e.extra)) same++;
    else if (failures.length < 20) failures.push(`legacy: ${e.score} → ${g.score} (${JSON.stringify(e.extra)} → ${JSON.stringify(g.extra)})`);
  }
  checks++;
  console.log(`1. legacy: ${same} / ${entries.length} stored grades identical`);
  ok(entries.length >= 500, "legacy fixture holds the recorded grades");
}

/* ------------------------------------------------------------------ helpers */
const roomMaze = (seed: number) => withSeededRandom(seed, () => generatePuzzle("maze", { bankSeed: seed })) as MazePuzzleData;
const classicMaze = (seed: number) =>
  withSeededRandom(seed, () => ({ ...generateMazeClassic(), speedPar: SPEED_PAR_VERSION, puzzleScoreRev: 3 })) as unknown as MazePuzzleData;
const LIMIT = 60_000;

/** The branch cells from the route to a star (exclusive of the route cell), and the route cell it leaves from. */
function starBranch(m: MazePuzzleData, star: number): { root: number; cells: number[] } {
  const cols = mazeColsOf(m);
  const onRoute = new Set(m.solution ?? []);
  const from = new Map<number, number>([[star, -1]]);
  const queue = [star];
  while (queue.length) {
    const cell = queue.shift()!;
    if (onRoute.has(cell)) {
      const cells: number[] = [];
      let c = from.get(cell)!;
      while (c !== -1) {
        cells.push(c);
        c = from.get(c)!;
      }
      return { root: cell, cells };
    }
    for (const n of mazeCorridorNeighbours(m.cells, cell, cols)) if (!from.has(n)) (from.set(n, cell), queue.push(n));
  }
  return { root: -1, cells: [] };
}

interface Level { name: string; pace: number; err: number; star: number; sd: number }
// The kit's four (scripts/puzzle-fairness/kit.ts) plus an elite player; `star` is the chance of taking each star.
const LEVELS: Level[] = [
  { name: "average", pace: 1.7, err: 0.2, star: 0.25, sd: 0.25 },
  { name: "good", pace: 1.0, err: 0.1, star: 0.5, sd: 0.2 },
  { name: "great", pace: 0.72, err: 0.05, star: 0.8, sd: 0.15 },
  { name: "near-perfect", pace: 0.5, err: 0.015, star: 1, sd: 0.1 },
  { name: "elite", pace: 0.4, err: 0, star: 1, sd: 0.06 },
];
const think = (rng: Rng, base: number, l: Level) => Math.max(0.05, base * l.pace * (1 + rng.normal(0, l.sd))) * 1000;

/** One run: the trail (backtracks included) and the time of each step. */
function play(m: MazePuzzleData, rng: Rng, l: Level, withStars: boolean): { trail: number[]; at: number[] } {
  const cols = mazeColsOf(m);
  const route = m.solution ?? [];
  const branches = withStars ? (m.stars ?? []).map((s) => ({ ...starBranch(m, s), take: rng.chance(l.star) })) : [];
  const trail = [m.start];
  const at = [0];
  let t = think(rng, 2, l);
  const step = (cell: number, base: number) => {
    t += think(rng, base, l);
    trail.push(cell);
    at.push(t);
  };
  const walkInOut = (cells: number[], here: number) => {
    for (const c of cells) step(c, 0.25);
    for (let k = cells.length - 2; k >= 0; k--) step(cells[k]!, 0.2);
    step(here, 0.2);
  };
  for (let i = 1; i < route.length; i++) {
    const here = route[i - 1]!;
    for (const b of branches) if (b.take && b.root === here) walkInOut(b.cells, here);
    const side = mazeCorridorNeighbours(m.cells, here, cols).filter((n) => n !== route[i] && n !== route[i - 2]);
    if (side.length && rng.chance(l.err)) {
      const walk: number[] = [];
      let cell = rng.pick(side);
      let prev = here;
      const len = rng.int(3, 12);
      while (walk.length < len) {
        walk.push(cell);
        const next = mazeCorridorNeighbours(m.cells, cell, cols).filter((n) => n !== prev);
        if (!next.length) break;
        prev = cell;
        cell = rng.pick(next);
      }
      walkInOut(walk, here);
    }
    step(route[i]!, 0.4);
  }
  return { trail, at };
}

function gradeRun(m: MazePuzzleData, run: { trail: number[]; at: number[] }) {
  const depth = m.mazeRev === MAZE_REV_DEPTH;
  let n = run.at.findIndex((t) => t > LIMIT);
  if (n < 0) n = run.trail.length;
  const trail = run.trail.slice(0, n);
  const done = trail[trail.length - 1] === m.exit;
  const answer = depth ? encodeMazeTrail(trail, mazeColsOf(m)) : encodeMazePath(mazeTrailRoute(trail));
  return gradeAnswer(m, answer, done ? Math.max(0, LIMIT - run.at[n - 1]!) : 0);
}

/* ------------------------------------------------------------------ 2. stamp and generation */
const SEEDS = Array.from({ length: 30 }, (_, i) => 41_000 + i * 7);
const mazes = SEEDS.map(roomMaze);
for (const m of mazes) {
  const cols = mazeColsOf(m);
  const route = m.solution ?? [];
  ok(m.mazeRev === MAZE_REV_DEPTH && m.cols === LAB_COLS && m.rows === LAB_ROWS && m.cells.length === LAB_COLS * LAB_ROWS, "dealt maze is mazeRev 1, 19 × 23");
  ok(route.length >= MAZE_MIN_PATH && route.length <= LAB_ROUTE_MAX, `route length ${route.length}`);
  ok(mazeRoute(m.cells, m.start, m.exit, cols).join() === route.join(), "stored route is the maze's own");
  const stars = m.stars ?? [];
  ok(stars.length === LAB_STARS && new Set(stars).size === LAB_STARS, "three distinct stars");
  const roots = new Set<number>();
  stars.forEach((s, i) => {
    const b = starBranch(m, s);
    ok(!route.includes(s), "a star is off the route");
    ok(b.cells.length >= LAB_STAR_DEPTH_MIN && b.cells.length <= LAB_STAR_DEPTH_MAX, `star ${i} is ${b.cells.length} cells in`);
    const third = Math.min(2, Math.floor((3 * route.indexOf(b.root)) / route.length));
    ok(third === i, `star ${i} leaves the route in third ${third}`);
    roots.add(`${b.root}:${b.cells[0]}` as unknown as number);
  });
  ok(roots.size === LAB_STARS, "each star on its own branch");
  const publicPuzzle = splitPuzzle(m).pub as MazePuzzleData;
  ok(publicPuzzle.solution === undefined && (publicPuzzle.stars ?? []).join() === stars.join(), "stars public, route secret");
}
console.log(`2. ${mazes.length} dealt mazes: 19 × 23, route ≤ ${LAB_ROUTE_MAX}, ${LAB_STARS} detour stars`);

/* ------------------------------------------------------------------ 3. rules */
{
  ok(roundMaxFor("maze") === 200, "Labyrinth's round maximum is 200");
  const m = mazes[0]!;
  const cols = mazeColsOf(m);
  const route = m.solution ?? [];
  ok(decodeMazeTrail(encodeMazeTrail(route, cols), m.start, cols, m.cells.length).join() === route.join(), "trail round-trips");
  const stars = m.stars ?? [];
  const tour = (take: boolean[]) => {
    const trail = [m.start];
    for (let i = 1; i < route.length; i++) {
      stars.forEach((s, k) => {
        if (!take[k]) return;
        const b = starBranch(m, s);
        if (b.root !== route[i - 1]) return;
        trail.push(...b.cells, ...b.cells.slice(0, -1).reverse(), b.root);
      });
      trail.push(route[i]!);
    }
    return trail;
  };
  const g = (trail: number[], ms: number) => gradeAnswer(m, encodeMazeTrail(trail, cols), ms);
  const plain = g(route, 40_000);
  const all = g(tour([true, true, true]), 42_000);
  const allSlow = g(tour([true, true, true]), 30_000);
  ok(plain.isCorrect && plain.score === 150, `no stars, fast: 150 (${plain.score})`);
  ok(all.score === 200, `all stars, fast: 200 (${all.score})`);
  ok(g(tour([true, false, true]), 42_000).score === 183, "two stars, fast: 183");
  ok(allSlow.score > g(route, 30_000).score && allSlow.score < 175, `a slower finish keeps some of the stars (${allSlow.score})`);
  ok(g(tour([true, true, true]), 20_000).score === g(route, 20_000).score, "stars are worth nothing past the zero point (20 s left)");
  ok(g(route, 0).score === 120, "a finish at the buzzer is 120");
  const walk = mazeTrailWalk(m.cells, m.start, m.exit, tour([true, true, true]), cols);
  ok(mazeTrailRoute(walk).join() === route.join(), "the drawn route folds every backtrack");
  // Stars without a finish count nothing; an unfinished trail stays ≤ 110.
  const half = tour([true, true, true]).slice(0, Math.floor(tour([true, true, true]).length * 0.95));
  const unfinished = g(half, 0);
  ok(!unfinished.isCorrect && unfinished.score <= 110, `unfinished with stars ≤ 110 (${unfinished.score})`);
  ok(JSON.stringify(unfinished.extra?.["stars"]) !== "[]", "unfinished run still lists the stars it reached");
  // A step through a wall ends the walk: a jump to the exit is not a finish.
  const jump = g([m.start, m.exit], 50_000);
  ok(!jump.isCorrect && jump.score === 0, "a jump through walls scores 0");
  ok(g([m.start], 0).score === 0, "nothing scores 0");
  // Old answers on a new maze (a path string) are not a trail: nothing.
  ok(gradeAnswer(m, encodeMazePath(route), 40_000).score === 0, "a path answer on a mazeRev 1 maze is not read");
  // Scribbling (6 cells a second at random) stays near 0.
  const rng = makeRng(77);
  const scribble = [m.start];
  for (let i = 0; i < 360; i++) scribble.push(rng.pick(mazeCorridorNeighbours(m.cells, scribble[scribble.length - 1]!, cols)));
  ok(g(scribble, 0).score <= 20, `scribble ≤ 20 (${g(scribble, 0).score})`);
  // Classic mazes keep the 150 top and their path answer.
  const c = classicMaze(5);
  ok(gradeAnswer(c, encodeMazePath(c.solution ?? []), 40_000).score === 150, "an older maze still tops out at 150");
  ok(puzzleTimeLimitMs(m) === LIMIT, "the round is still 60 s");
}

/* ------------------------------------------------------------------ 4. distribution */
const pct = (a: number[], q: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
};
const table: string[] = ["| Level | Old median | Old top 10 % | Old best | New median | New top 10 % | New best | Stars (new, median) |", "| --- | --- | --- | --- | --- | --- | --- | --- |"];
const medians: Record<string, [number, number]> = {};
const best: Record<string, number> = {};
for (const l of LEVELS) {
  const olds: number[] = [];
  const news: number[] = [];
  const starsTaken: number[] = [];
  SEEDS.forEach((seed, i) => {
    const old = classicMaze(seed + 1);
    olds.push(gradeRun(old, play(old, makeRng(hashText(`old:${seed}:${l.name}`)), l, false)).score);
    const g = gradeRun(mazes[i]!, play(mazes[i]!, makeRng(hashText(`new:${seed}:${l.name}`)), l, true));
    news.push(g.score);
    starsTaken.push(g.isCorrect ? ((g.extra?.["stars"] as number[]) ?? []).length : 0);
  });
  medians[l.name] = [pct(olds, 0.5), pct(news, 0.5)];
  best[l.name] = Math.max(...news);
  table.push(`| ${l.name} | ${pct(olds, 0.5)} | ${pct(olds, 0.9)} | ${Math.max(...olds)} | ${pct(news, 0.5)} | ${pct(news, 0.9)} | ${Math.max(...news)} | ${pct(starsTaken, 0.5)} |`);
}
console.log("4. distribution (30 seeds each)\n" + table.join("\n"));
for (const name of ["average", "good"]) {
  const [o, n] = medians[name]!;
  ok(Math.abs(n - o) <= Math.max(8, 0.1 * o), `${name}: new median ${n} within about 10 % of old ${o}`);
}
ok(medians["near-perfect"]![1] >= 165 && medians["near-perfect"]![1] <= 175, `near-perfect median ${medians["near-perfect"]![1]} in 165–175`);
ok(medians["elite"]![1] >= 190, `elite median ${medians["elite"]![1]} ≥ 190`);
ok(best["good"]! < 190, `a good player never reaches 190 (${best["good"]})`);

console.log(`\n${checks} checks`);
if (failures.length) {
  console.log(`FAIL: ${failures.length}\n  ${failures.slice(0, 30).join("\n  ")}`);
  process.exit(1);
}
console.log("PASS: depth-labyrinth-check");
