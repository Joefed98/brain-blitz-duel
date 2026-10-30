/**
 * Tilt tiltRev 8: the oracle, a player that knows the whole maze and plays it through the real sim (and so
 * through the server's replay): for every maze it walks the par tour's waypoints in order (the two quick stars,
 * then the gold star and key as the tour meets them, then the blue cup, then in maze 3 the amber cup), and
 * reaches each one by a beam search over held tilts turned at a finger's speed (`ORACLE_FINGER` px a tick,
 * re-gripping at the screen's edges as a hand does). It never lets the marble it is steering fall in.
 *
 *   bun scripts/tilt-oracle.ts [--from=0] [--seeds=260] [--rev=8|10] [--write=<file>]   # per seed: the oracle's score
 *
 * tilt-expand-check replays stored oracle runs; this script proves every seed can be played to 200.
 */
import { appendFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { tiltCellCentre, tiltCheckpoint, tiltExpandGame, tiltFieldX, tiltParWalksX, tiltStdGame, tiltWalkTurnsX, TILT_CHECKPOINT_INTERVAL, TILT_INPUT_DRAG, TILT_REV_EXPAND, TILT_REV_STD, type Maze, type TiltState } from "../src/lib/arcade/tilt";
import { decodeTiltRun, encodeTiltRun, replayTiltRun } from "../src/lib/duel/tilt";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";

/** The game the oracle plays: tiltRev 8's (the bank's proofs), or tiltRev 10's (`oracleRun(seed, TILT_REV_STD)`: four mazes, no quick stars). */
let game = tiltExpandGame;
const TURN = 65536;
const ANG_PER_PX = 91;
/** Finger speed (world px a tick, ≈ 12 phone px: a quick, controlled spin). */
export const ORACLE_FINGER = 12;
/** Search sizes: a quick one first, then a wider, deeper one for a leg the first cannot solve. */
const SEARCHES = [
  { angles: 16, holds: [2, 8, 16, 28], beam: 10, depth: 60 },
  { angles: 24, holds: [1, 4, 8, 14, 22, 34], beam: 30, depth: 120 },
];
/** What a tick is worth against distance in the beam (FP; a cell is 7,680). */
/** The time weights tried for each leg (the quickest plan found is kept). */
const ORACLE_TICKS = (process.env.OT ?? "150,400,900").split(",").map(Number);

type Ev = ArcadeInputEvent;
const wrap = (d: number) => ((((d + TURN / 2) % TURN) + TURN) % TURN) - TURN / 2;

/** The drag that turns the disc toward `target` this tick (a re-grip at the edges), or null when there. */
function dragToward(s: TiltState, target: number): Omit<Ev, "t"> | null {
  const need = wrap(target - s.angle);
  const px = Math.round(need / ANG_PER_PX);
  if (px === 0) return null;
  const step = Math.max(-ORACLE_FINGER, Math.min(ORACLE_FINGER, px));
  const gripped = s.lastC >= 0;
  const next = s.lastA + step;
  if (!gripped || next < 8 || next > 432) return { k: TILT_INPUT_DRAG, a: step > 0 ? 40 : 400, b: 0, c: (s.lastC + 1 + 256) % 256, d: 0 };
  return { k: TILT_INPUT_DRAG, a: next, b: 0, c: s.lastC, d: 0 };
}

interface Node {
  s: TiltState;
  log: Ev[];
}

type Goal = { kind: "quick" | "star" | "key" | "cup"; cell: number; which: 0 | 1 };

function body(s: TiltState, which: 0 | 1) {
  if (which === 0) return s.aHome ? null : { x: s.x, y: s.y };
  return s.b && !s.bHome ? { x: s.b.x, y: s.b.y } : null;
}

function reached(s: TiltState, s0: TiltState, g: Goal): boolean {
  if (s.level !== s0.level || s.mazes > s0.mazes) return g.kind === "cup";
  if (g.kind === "quick") return (s.quickTaken ?? 0) > (s0.quickTaken ?? 0);
  if (g.kind === "star") return (s.stars ?? 0) > (s0.stars ?? 0);
  if (g.kind === "key") return (s.keysTaken ?? 0) > (s0.keysTaken ?? 0);
  return g.which === 0 ? !!s.aHome : !!s.bHome;
}

/** How far the steered marble is from the goal (FP): cells along the maze times a cell, and its place in the cell. */
function distance(m: Maze, s: TiltState, g: Goal, field: number[]): number {
  const b = body(s, g.which);
  if (!b) return 0;
  const i = Math.floor(b.x / m.cs);
  const j = Math.floor(b.y / m.cs);
  const c = i >= 0 && j >= 0 && i < m.n && j < m.n ? j * m.n + i : -1;
  const d = c >= 0 ? field[c]! : -1;
  if (d < 0) return 1e9;
  const t = tiltCellCentre(m, g.cell);
  if (d === 0) return Math.abs(b.x - t.x) + Math.abs(b.y - t.y);
  return d * m.cs + Math.abs(b.x - ((c % m.n) * m.cs + m.cs / 2)) / 2 + Math.abs(b.y - (Math.trunc(c / m.n) * m.cs + m.cs / 2)) / 2;
}

/** Steps a node by one held tilt (turn there, then hold), stopping early once the goal is reached. */
function macro(n: Node, target: number, hold: number, g: Goal): { node: Node; done: boolean; fell: boolean } {
  let s = n.s;
  const log = n.log.slice();
  const s0 = n.s;
  let held = 0;
  for (let k = 0; k < 400 && !game.isOver(s); k++) {
    const drag = dragToward(s, target);
    if (!drag && held++ >= hold) break;
    const t = s.tick + 1;
    let ev: Ev | null = null;
    if (drag) {
      ev = { ...drag, t };
      log.push(ev);
    }
    const next = game.step(s, ev);
    const fell = g.which === 0 ? (next.holdA ?? 0) !== (s.holdA ?? 0) : (next.holdB ?? 0) !== (s.holdB ?? 0);
    s = next;
    if (fell && s.level === s0.level) return { node: { s, log }, done: false, fell: true };
    if (reached(s, s0, g)) return { node: { s, log }, done: true, fell: false };
  }
  return { node: { s, log }, done: false, fell: false };
}

/** Beam search from `start` to the goal; null when no plan is found in the depth. */
function solveLeg(start: Node, g: Goal, search = SEARCHES[0]!, tickWeight = ORACLE_TICKS[0]!): Node | null {
  const { angles: ANGLES, holds: HOLDS, beam: BEAM, depth: DEPTH } = search;
  const m = start.s.list[start.s.level]!;
  const field = tiltFieldX(m, g.kind === "cup" ? (g.which === 0 ? m.exit : m.exit2!) : g.cell, start.s.keysGot ?? 0);
  let beam: Node[] = [start];
  const seen = new Set<string>();
  for (let depth = 0; depth < DEPTH && beam.length; depth++) {
    const next: { node: Node; v: number }[] = [];
    for (const n of beam) {
      for (let a = 0; a < ANGLES; a++) {
        const target = Math.round((a * TURN) / ANGLES);
        for (const hold of HOLDS) {
          const r = macro(n, target, hold, g);
          if (r.fell || game.isOver(r.node.s) && !r.done) continue;
          if (r.done) return r.node;
          const s = r.node.s;
          const b = body(s, g.which);
          // The steered marble went home, or the maze ended, before the goal: a dead branch.
          if (!b || s.level !== start.s.level) continue;
          const key = `${Math.floor(b.x / 640)},${Math.floor(b.y / 640)},${Math.sign(s.vx)}${Math.sign(s.vy)},${(s.angle >> 12) & 15}`;
          if (seen.has(key)) continue;
          seen.add(key);
          next.push({ node: r.node, v: distance(m, s, g, field) + tickWeight * (s.tick - start.s.tick) });
        }
      }
    }
    next.sort((x, y) => x.v - y.v);
    beam = next.slice(0, BEAM).map((x) => x.node);
  }
  return null;
}

/** The waypoints of the maze being played, in the par tour's order. */
function waypoints(m: Maze): Goal[] {
  const walks = tiltParWalksX(m);
  const out: Goal[] = walks.quick.map((q) => ({ kind: "quick" as const, cell: q.star, which: 0 as const }));
  const seen = new Set<number>();
  for (const c of walks.tour) {
    if (seen.has(c)) continue;
    seen.add(c);
    if ((m.stars ?? []).includes(c)) out.push({ kind: "star", cell: c, which: 0 });
    if ((m.keys ?? []).includes(c)) out.push({ kind: "key", cell: c, which: 0 });
  }
  out.push({ kind: "cup", cell: m.exit, which: 0 });
  if ((m.start2 ?? -1) >= 0) out.push({ kind: "cup", cell: m.exit2!, which: 1 });
  return out;
}

/** Plays a seed; returns the log and the server's score for it. */
/** Plays the goals in order from `node`; null when a leg finds no plan. */
function playGoals(node: Node, m: Maze, level: number, goals: Goal[]): Node | null {
  for (const g of goals) {
    if (game.isOver(node.s)) return node;
    // Already taken on the way (either marble may take an item), or the marble is home.
    if (g.kind === "quick" && node.s.quickGot?.[(m.quick ?? []).indexOf(g.cell)]) continue;
    if (g.kind === "star" && node.s.starGot?.[(m.stars ?? []).indexOf(g.cell)]) continue;
    if (g.kind === "key" && (node.s.keysGot ?? 0) & (1 << (m.keys ?? []).indexOf(g.cell))) continue;
    if (g.kind === "cup" && (node.s.level !== level || (g.which === 0 ? node.s.aHome : node.s.bHome))) continue;
    let r: Node | null = null;
    for (const w of ORACLE_TICKS) {
      const x = solveLeg(node, g, SEARCHES[0], w);
      if (x && (!r || x.s.tick < r.s.tick)) r = x;
    }
    r ??= solveLeg(node, g, SEARCHES[1]);
    if (!r) {
      if (process.env.ODBG) console.error(`level ${level}: no plan to ${g.kind} ${g.cell} at tick ${node.s.tick}`);
      return null;
    }
    node = r;
  }
  return node;
}

/** Plays a seed; returns the log and the server's score for it. */
export function oracleRun(seed: number, rev: number = TILT_REV_EXPAND): { raw: string; score: number; state: TiltState } {
  game = rev === TILT_REV_STD ? tiltStdGame : tiltExpandGame;
  let node: Node = { s: game.init(seed), log: [] };
  for (let level = 0; level < node.s.list.length && !game.isOver(node.s); level++) {
    const m = node.s.list[level]!;
    const goals = waypoints(m);
    const cups = goals.filter((g) => g.kind === "cup");
    const taken = playGoals(node, m, level, goals.filter((g) => g.kind !== "cup"));
    if (!taken) break;
    // The cups in the quicker order (in maze 3 either marble may go home first).
    let best: Node | null = null;
    for (const order of cups.length === 2 ? [cups, [cups[1]!, cups[0]!]] : [cups]) {
      const r = playGoals(taken, m, level, order);
      if (r && (r.s.level !== level || game.isOver(r.s)) && (!best || r.s.tick < best.s.tick)) best = r;
    }
    if (!best) break;
    node = best;
  }
  // Replay the log from the start exactly as the phone records it, then through the server.
  const checkpoints: unknown[] = [];
  const byTick = new Map(node.log.map((e) => [e.t, e]));
  let s = game.init(seed);
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.tick % TILT_CHECKPOINT_INTERVAL === 0) checkpoints.push(tiltCheckpoint(s));
  }
  const raw = encodeTiltRun({ seed, claimedScore: game.score(s), events: node.log, endTick: s.tick, checkpoints: checkpoints as never });
  const r = replayTiltRun(seed, raw, rev);
  game = tiltExpandGame;
  return { raw, score: r.flagged ? -1 : r.score, state: r.state };
}

/** Per maze: its par walks (cells, turns) and when the run took each quick star and finished (ticks into the maze). */
function mazeStats(seed: number, raw: string) {
  const events = (JSON.parse(JSON.stringify(decodeTiltRun(raw)!.events)) as Ev[]);
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const out: Record<string, unknown>[] = s.list.map((m) => {
    const w = tiltParWalksX(m);
    let joined: number[] = [];
    for (const leg of w.quick) joined = joined.length ? [...joined, ...leg.walk.slice(1)] : leg.walk;
    const quickLegs = w.quick.map((leg, i) => {
      const upTo = w.quick.slice(0, i + 1).reduce<number[]>((a, l) => (a.length ? [...a, ...l.walk.slice(1)] : l.walk), []);
      return { star: leg.star, cells: upTo.length - 1, turns: tiltWalkTurnsX(m, upTo) };
    });
    const all = joined.length ? [...joined, ...w.tour.slice(1)] : w.tour;
    return { quickLegs, cells: all.length - 1, turns: tiltWalkTurnsX(m, all), amberCells: Math.max(0, w.amber.length - 1), amberTurns: tiltWalkTurnsX(m, w.amber), par: m.par, quickAt: m.quickAt, taken: {} as Record<number, number>, t: -1 };
  });
  let at = 0;
  while (!game.isOver(s) && s.tick < game.runTicks) {
    const prev = s;
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    const m = prev.list[prev.level]!;
    (m.quick ?? []).forEach((c, k) => {
      if (s.quickGot?.[k] && !prev.quickGot?.[k] && s.level === prev.level) (out[prev.level]!.taken as Record<number, number>)[c] = s.tick - at;
    });
    if (s.mazes > prev.mazes) {
      out[prev.level]!.t = s.tick - at;
      at = s.tick;
    }
  }
  return out;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  const from = Number(opt("from") ?? 0);
  const seeds = Number(opt("seeds") ?? 260);
  const spec = GAME_BY_TYPE.get("tilt" as never)!;
  const out = opt("out");
  const keep: { seed: number; raw: string; score: number }[] = [];
  for (let n = from; n < from + seeds; n++) {
    const seed = spec.seedFor(n);
    const t0 = performance.now();
    const r = oracleRun(seed, Number(opt("rev") ?? TILT_REV_EXPAND));
    const s = r.state;
    const line: Record<string, unknown> = { n, seed, score: r.score, mazes: s.mazes, stars: s.stars, quick: s.quickTaken, quickPts: s.quickPts, pace: s.pace, end: s.endedTick, ms: Math.round(performance.now() - t0) };
    if (opt("stats")) line.mazeStats = mazeStats(seed, r.raw);
    console.log(JSON.stringify(line));
    if (out) appendFileSync(out, JSON.stringify(line) + "\n");
    if (r.score === 200 && keep.length < 3) keep.push({ seed, raw: r.raw, score: r.score });
  }
  const w = opt("write");
  if (w && keep.length) writeFileSync(w, gzipSync(JSON.stringify({ runs: keep })));
}
