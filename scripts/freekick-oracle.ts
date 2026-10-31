/**
 * Free Kick's oracle (a perfect player): for every kick of a seed it searches for a shot that scores everything the
 * kick offers (a goal placed in full away from the keeper, curled round the wall, through the kick's target if it has
 * one) and plays the run through freekickGame, kicking on the first tick each kick can be taken. Script-only
 * (floats are fine here: the result is an input log the sim replays).
 *
 *   bun scripts/freekick-oracle.ts [--rev=2] [seed…]   prints each seed's score and parts (the dealt revision by default)
 */
import { inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  FK_AIM,
  FK_BAR_Y,
  FK_BALL_R,
  FK_GOAL_HALF_W,
  FK_HOOP_X,
  FK_HOOP_Y,
  FK_M,
  FK_OUT_GOAL,
  FK_OUT_NONE,
  FK_TARGET_BAR,
  FK_TARGET_LEFT,
  FK_TARGET_NONE,
  FK_TARGET_RIGHT,
  FREEKICK_CURL_MAX,
  FREEKICK_INPUT_KICK,
  FREEKICK_PLACE_UNITS,
  FREEKICK_POWER_MAX,
  FREEKICK_AIM_MAX,
  fkFlightStep,
  fkJudge,
  fkLaunch,
  fkLocal,
  fkSeedPlan,
  freekickGameFor,
  freekickStdParts,
  FREEKICK_REV_DEALT,
  FREEKICK_REV_STD,
  type FkFlight,
  type FkKick,
  type FreekickState,
} from "../src/lib/arcade/freekick";

export interface FkShot {
  a: number;
  b: number;
  c: number;
}

/** Runs a flight to its outcome (or `extra` ticks past it). */
export function fkFly(k: FkKick, shot: FkShot): FkFlight {
  const f = fkLaunch(k, shot.a, shot.b, shot.c);
  while (f.out === FK_OUT_NONE) fkFlightStep(k, f);
  return f;
}

/** The kick with no wall and no keeper: where a shot crosses the goal plane, for aiming. */
function ghostOf(k: FkKick): FkKick {
  return { ...k, wallL: 1e12, wallR: -1e12, keeperX: 1e12 };
}

function ghostCross(g: FkKick, shot: FkShot): { x: number; y: number } | null {
  const f = fkLaunch(g, shot.a, shot.b, shot.c);
  while (f.out === FK_OUT_NONE) fkFlightStep(g, f, false);
  if (f.crossX === 0 && f.crossY === 0) return null;
  return { x: f.crossX, y: f.crossY };
}

/** Finds a, c so that the ghost flight with curl b crosses the goal plane at (tx, ty) (world units), or null (2-D Newton). */
export function fkAimAt(k: FkKick, b: number, tx: number, ty: number): FkShot | null {
  const g = ghostOf(k);
  const loc = fkLocal(k, tx, 0);
  let a = Math.max(-FREEKICK_AIM_MAX, Math.min(FREEKICK_AIM_MAX, Math.round(Math.atan2(loc.u, loc.w) * 1000)));
  let c = 450;
  const tol = FK_M * 0.012;
  for (let i = 0; i < 14; i++) {
    const hit = ghostCross(g, { a, b, c });
    if (!hit) {
      c = Math.min(FREEKICK_POWER_MAX, c + 70);
      continue;
    }
    const ex = tx - hit.x;
    const ey = ty - hit.y;
    if (Math.abs(ex) < tol && Math.abs(ey) < tol) return { a, b, c };
    const ha = ghostCross(g, { a: a + 6, b, c });
    const hc = ghostCross(g, { a, b, c: c + 12 });
    if (!ha || !hc) {
      c = Math.min(FREEKICK_POWER_MAX, c + 40);
      continue;
    }
    const xa = (ha.x - hit.x) / 6;
    const ya = (ha.y - hit.y) / 6;
    const xc = (hc.x - hit.x) / 12;
    const yc = (hc.y - hit.y) / 12;
    const det = xa * yc - xc * ya;
    if (Math.abs(det) < 1e-6) return null;
    let da = (ex * yc - xc * ey) / det;
    let dc = (xa * ey - ex * ya) / det;
    const sc = Math.max(1, Math.abs(da) / 120, Math.abs(dc) / 200);
    da /= sc;
    dc /= sc;
    a = Math.round(Math.max(-FREEKICK_AIM_MAX, Math.min(FREEKICK_AIM_MAX, a + da)));
    c = Math.round(Math.max(0, Math.min(FREEKICK_POWER_MAX, c + dc)));
  }
  const hit = ghostCross(g, { a, b, c });
  if (hit && Math.abs(tx - hit.x) < FK_M * 0.03 && Math.abs(ty - hit.y) < FK_M * 0.03) return { a, b, c };
  return null;
}

export interface FkCandidate {
  shot: FkShot;
  /** Everything the kick offers. */
  full: boolean;
  goal: boolean;
  place: number;
  target: boolean;
  curled: boolean;
  distCm: number;
  /** How many of the shot's neighbours (±aim, ±power, ±curl) also score in full: a robustness measure. */
  margin: number;
}

function judgeShot(k: FkKick, shot: FkShot) {
  const f = fkFly(k, shot);
  const j = fkJudge(k, f);
  const full = j.goal && j.place >= FREEKICK_PLACE_UNITS && j.curled && (k.target === FK_TARGET_NONE || j.target);
  return { ...j, full };
}

/** Goal-plane points worth trying for a kick (world metres), most promising first. */
function aimPoints(k: FkKick): [number, number][] {
  const pts: [number, number][] = [];
  const M = FK_M;
  if (k.target === FK_TARGET_LEFT || k.target === FK_TARGET_RIGHT) {
    const sx = k.target === FK_TARGET_LEFT ? -1 : 1;
    for (const dx of [0, -0.15, 0.15, -0.3, 0.3]) for (const dy of [0, 0.15, -0.15, 0.3, -0.3]) pts.push([sx * (FK_HOOP_X / M + dx), FK_HOOP_Y / M + dy]);
    for (const dx of [-0.42, -0.21, 0.21, 0.42]) for (const dy of [-0.42, -0.21, 0.21, 0.42]) if (Math.hypot(dx, dy) < 0.5) pts.push([sx * (FK_HOOP_X / M + dx), FK_HOOP_Y / M + dy]);
    return pts;
  }
  if (k.target === FK_TARGET_BAR) {
    const xs = [3.0, 2.5, 2.0, 3.3].map((x) => k.side * x).concat([3.0, 2.5, 2.0, 3.3].map((x) => -k.side * x));
    for (const x of xs) for (let d = 0.04; d <= 0.17; d += 0.01) pts.push([x, (FK_BAR_Y - FK_BALL_R) / M - 0.06 + d]);
    for (const x of [2.8, 2.25, 1.75, 1.5, 1.2, 3.15]) for (let d = 0.05; d <= 0.17; d += 0.02) for (const sx of [k.side, -k.side]) pts.push([sx * x, (FK_BAR_Y - FK_BALL_R) / M - 0.06 + d]);
    return pts;
  }
  const half = FK_GOAL_HALF_W / M;
  for (const x of [half - 0.35, half - 0.55, half - 0.8, half - 1.1]) for (const y of [2.15, 1.95, 0.25, 1.7, 0.5]) pts.push([k.side * x, y]);
  for (const x of [half - 0.35, half - 0.6]) for (const y of [2.15, 0.25, 1.9]) pts.push([-k.side * x, y]);
  // freekickRev 2 kicks (they carry `yards`): the tightest corners too, both sides, for the long and wide spots.
  if (k.yards !== undefined) for (const x of [half - 0.2, half - 0.27]) for (const y of [2.25, 2.3, 0.18, 2.05, 0.35]) for (const sx of [k.side, -k.side]) pts.push([sx * x, y]);
  return pts;
}

const CURLS = [60, 75, 45, 90, 100, 35, 25, 15];
const NEIGHBOURS = [[5, 0, 0], [-5, 0, 0], [0, 0, 8], [0, 0, -8], [0, 6, 0], [0, -6, 0], [10, 0, 0], [-10, 0, 0], [0, 0, 16], [0, 0, -16]] as const;

/** How many of a shot's neighbours (±aim, ±power, ±curl) still pass `ok`: a robustness measure (0…10). */
function marginOf(k: FkKick, shot: FkShot, ok: (j: ReturnType<typeof judgeShot>) => boolean): number {
  let n = 0;
  for (const [da, db, dc] of NEIGHBOURS) {
    const s = { a: shot.a + da, b: Math.max(-FREEKICK_CURL_MAX, Math.min(FREEKICK_CURL_MAX, shot.b + db)), c: Math.max(0, Math.min(FREEKICK_POWER_MAX, shot.c + dc)) };
    if (ok(judgeShot(k, s))) n++;
  }
  return n;
}

export interface FkPlans {
  /** A shot scoring everything the kick offers (null when the search found none). */
  full: FkCandidate | null;
  /** The best shot found by rank when no full one was (the oracle falls back to it). */
  best: FkCandidate | null;
  /** A safe goal: the goal (any kind) whose neighbours most often score too. */
  goal: FkCandidate | null;
}

const rankOf = (c: { full: boolean; goal: boolean; place: number; curled: boolean; target: boolean }) =>
  (c.full ? 1000 : 0) + (c.goal ? 100 : 0) + c.place + (c.curled ? 20 : 0) + (c.target ? 40 : 0);

/**
 * Searches a kick's shots. `quick`: stop at the first full shot (the oracle and the deal). Otherwise also rank the
 * full and safe-goal shots by their margins (the bots' plans).
 */
export function fkPlanKick(k: FkKick, quick = true): FkPlans {
  let best: FkCandidate | null = null;
  const fulls: FkCandidate[] = [];
  const goals: FkCandidate[] = [];
  for (const [tx, ty] of aimPoints(k)) {
    for (const mag of CURLS) {
      for (const sign of [1, -1]) {
        const shot = fkAimAt(k, sign * mag, Math.round(tx * FK_M), Math.round(ty * FK_M));
        if (!shot) continue;
        const j = judgeShot(k, shot);
        const cand: FkCandidate = { shot, ...j, margin: 0 };
        if (!best || rankOf(cand) > rankOf(best)) best = cand;
        if (j.full) {
          fulls.push(cand);
          if (quick) return { full: cand, best: cand, goal: null };
        } else if (j.goal) goals.push(cand);
      }
    }
    if (!quick && fulls.length >= 10) break;
  }
  let full: FkCandidate | null = null;
  for (const c of fulls.slice(0, 10)) {
    c.margin = marginOf(k, c.shot, (j) => j.full);
    if (!full || c.margin > full.margin) full = c;
  }
  let goal: FkCandidate | null = null;
  const pool = [...goals.sort((p, q) => q.place - p.place).slice(0, 12), ...fulls.slice(0, 4)];
  for (const c of pool) {
    const m = marginOf(k, c.shot, (j) => j.goal);
    if (!goal || m > goal.margin) goal = { ...c, margin: m };
  }
  return { full, best, goal };
}

/** The best full-scoring shot for a kick, or the best partial one when none scores in full. */
export function fkSolveKick(k: FkKick): FkCandidate | null {
  const p = fkPlanKick(k, true);
  return p.full ?? p.best;
}

const solvedCache = new Map<string, FkShot[]>();

/** The oracle's shot for each kick of a seed on a revision (cached; rev 1 when unnamed, as the rev-1 deal built it). */
export function oracleShots(seed: number, rev: number = FREEKICK_REV_STD): FkShot[] {
  const key = `${rev}:${seed}`;
  const hit = solvedCache.get(key);
  if (hit) return hit;
  const shots = fkSeedPlan(seed, rev).kicks.map((k) => fkSolveKick(k)?.shot ?? { a: 0, b: 0, c: 500 });
  if (solvedCache.size > 400) solvedCache.clear();
  solvedCache.set(key, shots);
  return shots;
}

/** Plays a list of shots through the real game (of `rev`), each on the first tick its kick can be taken (plus its delay). */
export function playShots(seed: number, shots: (FkShot | null)[], delays: number[] = [], rev: number = FREEKICK_REV_STD): { events: ArcadeInputEvent[]; state: FreekickState } {
  const game = freekickGameFor(rev);
  let state = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  let aimFrom = -1;
  while (!game.isOver(state)) {
    const t = state.tick + 1;
    if (state.phase === FK_AIM) {
      if (aimFrom < 0) aimFrom = state.tick;
      const shot = shots[state.k];
      if (shot && state.tick - aimFrom >= (delays[state.k] ?? 0)) recordInput(events, { t, k: FREEKICK_INPUT_KICK, a: shot.a, b: shot.b, c: shot.c, d: 0 }, game.inputRanges ?? []);
    } else aimFrom = -1;
    state = game.step(state, inputAt(events, t));
  }
  return { events, state };
}

/** The oracle's input log for a seed (rev 1 when unnamed). */
export function oracleRun(seed: number, rev: number = FREEKICK_REV_STD): ArcadeInputEvent[] {
  return playShots(seed, oracleShots(seed, rev), [], rev).events;
}

if (import.meta.main) {
  const revArg = process.argv.find((a) => a.startsWith("--rev="));
  const rev = revArg ? Number(revArg.split("=")[1]) : FREEKICK_REV_DEALT;
  const seeds = process.argv.slice(2).filter((a) => !a.startsWith("--")).map(Number).filter(Number.isFinite);
  for (const seed of seeds.length ? seeds : [1, 2, 3, 4, 5]) {
    const t0 = performance.now();
    const { state } = playShots(seed, oracleShots(seed, rev), [], rev);
    const parts = freekickStdParts(state)!;
    console.log(seed, freekickGameFor(rev).score(state), parts.map((p) => `${p.key}=${p.points}`).join(" "), `${Math.round(performance.now() - t0)} ms`);
    fkSeedPlan(seed, rev).kicks.forEach((k, i) => {
      const c = fkSolveKick(k);
      if (!c?.full) console.log(`  kick ${i} target ${k.target} side ${k.side} d=${(Math.hypot(k.bx, k.bz) / FK_M).toFixed(1)} bx=${(k.bx / FK_M).toFixed(1)} wall ${k.wallN}: best goal=${c?.goal} place=${c?.place} curled=${c?.curled} target=${c?.target}`);
    });
  }
  void FK_OUT_GOAL;
}
