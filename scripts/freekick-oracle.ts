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
  FREEKICK_REV_3,
  FREEKICK_REV_4,
  FREEKICK_INPUT_SHOT,
  FK_V4_BENT,
  FK_GOAL_H,
  fkHoopRFor,
  FREEKICK_INPUT_AIM,
  FREEKICK_INPUT_CURL,
  FREEKICK_INPUT_POWER,
  FREEKICK_INPUT_STRIKE,
  FK_V3_AIM_X_MAX,
  FK_V3_AIM_Y_MAX,
  FK_V3_AIM_Y_MIN,
  FK_V3_METER_PERIOD,
  FK_V3_ZONE_HI,
  FK_V3_ZONE_LO,
  fkV3Launch,
  fkV3Meter,
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

/**
 * Goal-plane points worth trying for a kick (world metres), most promising first. `hoopR` (freekickRev 4's shrinking
 * hoop, world units) scales the corner search to the hoop; rev 1–3 search the full hoop exactly as before.
 */
function aimPoints(k: FkKick, hoopR?: number): [number, number][] {
  const pts: [number, number][] = [];
  const M = FK_M;
  if (k.target === FK_TARGET_LEFT || k.target === FK_TARGET_RIGHT) {
    const sx = k.target === FK_TARGET_LEFT ? -1 : 1;
    if (hoopR !== undefined) {
      const f = hoopR / (0.55 * M);
      const hx = (FK_GOAL_HALF_W - hoopR) / M;
      const hy = (FK_GOAL_H - hoopR) / M;
      for (const dx of [0, -0.15, 0.15, -0.3, 0.3]) for (const dy of [0, 0.15, -0.15, 0.3, -0.3]) pts.push([sx * (hx + dx * f), hy + dy * f]);
      for (const dx of [-0.42, -0.21, 0.21, 0.42]) for (const dy of [-0.42, -0.21, 0.21, 0.42]) if (Math.hypot(dx, dy) < 0.5) pts.push([sx * (hx + dx * f), hy + dy * f]);
      return pts;
    }
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
  if (rev >= FREEKICK_REV_4) return playShotsV4(seed, oracleShotsV4(seed)).events;
  if (rev >= FREEKICK_REV_3) return playShotsV3(seed, oracleShotsV3(seed)).events;
  return playShots(seed, oracleShots(seed, rev), [], rev).events;
}

/* ================================ freekickRev 3: the prepared shot ================================ */

/** A prepared shot: the target on the goal plane (cm) and the curl. */
export interface FkShot3 {
  x: number;
  y: number;
  b: number;
}

/** Ticks from POWER to STRIKE that land the meter in the middle of the sweet zone, and the meter there. */
export const FK_V3_CLEAN_TICKS = Math.round(((FK_V3_ZONE_LO + FK_V3_ZONE_HI) / 2 / 1000) * (FK_V3_METER_PERIOD / 2));
export const FK_V3_CLEAN_METER = fkV3Meter(FK_V3_CLEAN_TICKS);

/** A prepared shot's flight, struck at `meter` (clean by default), to its outcome. */
export function fkFly3(k: FkKick, shot: FkShot3, meter = FK_V3_CLEAN_METER): FkFlight {
  const f = fkV3Launch(k, shot.x, shot.y, shot.b, meter);
  while (f.out === FK_OUT_NONE) fkFlightStep(k, f);
  return f;
}

const clampShot3 = (s: FkShot3): FkShot3 => ({
  x: Math.round(Math.max(-FK_V3_AIM_X_MAX, Math.min(FK_V3_AIM_X_MAX, s.x))),
  y: Math.round(Math.max(FK_V3_AIM_Y_MIN, Math.min(FK_V3_AIM_Y_MAX, s.y))),
  b: Math.round(Math.max(-FREEKICK_CURL_MAX, Math.min(FREEKICK_CURL_MAX, s.b))),
});

function judgeShot3(k: FkKick, shot: FkShot3) {
  const j = fkJudge(k, fkFly3(k, shot));
  const full = j.goal && j.place >= FREEKICK_PLACE_UNITS && j.curled && (k.target === FK_TARGET_NONE || j.target);
  return { ...j, full };
}

export interface FkCandidate3 {
  shot: FkShot3;
  full: boolean;
  goal: boolean;
  place: number;
  target: boolean;
  curled: boolean;
  distCm: number;
  margin: number;
}
export interface FkPlans3 {
  full: FkCandidate3 | null;
  best: FkCandidate3 | null;
  goal: FkCandidate3 | null;
}

/** ±target (cm) and ±curl neighbours: the prepared shot's robustness measure (0…8). */
const NEIGHBOURS3 = [[12, 0, 0], [-12, 0, 0], [0, 12, 0], [0, -12, 0], [0, 0, 8], [0, 0, -8], [25, 0, 0], [-25, 0, 0]] as const;
function marginOf3(k: FkKick, shot: FkShot3, ok: (j: ReturnType<typeof judgeShot3>) => boolean): number {
  let n = 0;
  for (const [dx, dy, db] of NEIGHBOURS3) if (ok(judgeShot3(k, clampShot3({ x: shot.x + dx, y: shot.y + dy, b: shot.b + db })))) n++;
  return n;
}

/**
 * Searches a kick's prepared shots (rev 2's goal-plane points and curls, through the sim's own solver, struck clean).
 * `quick`: stop at the first full shot (the oracle and the deal); otherwise rank the full and safe-goal shots by their
 * margins (the bots' plans).
 */
export function fkPlanKickV3(k: FkKick, quick = true): FkPlans3 {
  let best: FkCandidate3 | null = null;
  const fulls: FkCandidate3[] = [];
  const goals: FkCandidate3[] = [];
  for (const [tx, ty] of aimPoints(k)) {
    for (const mag of CURLS) {
      for (const sign of [1, -1]) {
        const shot = clampShot3({ x: tx * 100, y: ty * 100, b: sign * mag });
        const j = judgeShot3(k, shot);
        const cand: FkCandidate3 = { shot, ...j, margin: 0 };
        if (!best || rankOf(cand) > rankOf(best)) best = cand;
        if (j.full) {
          fulls.push(cand);
          if (quick) return { full: cand, best: cand, goal: null };
        } else if (j.goal) goals.push(cand);
      }
    }
    if (!quick && fulls.length >= 10) break;
  }
  let full: FkCandidate3 | null = null;
  for (const c of fulls.slice(0, 10)) {
    c.margin = marginOf3(k, c.shot, (j) => j.full);
    if (!full || c.margin > full.margin) full = c;
  }
  let goal: FkCandidate3 | null = null;
  const pool = [...goals.sort((p, q) => q.place - p.place).slice(0, 12), ...fulls.slice(0, 4)];
  for (const c of pool) {
    const m = marginOf3(k, c.shot, (j) => j.goal);
    if (!goal || m > goal.margin) goal = { ...c, margin: m };
  }
  return { full, best, goal };
}

const solved3 = new Map<number, FkShot3[]>();
/** The oracle's prepared shot for each kick of a seed (freekickRev 3; cached). */
export function oracleShotsV3(seed: number): FkShot3[] {
  const hit = solved3.get(seed);
  if (hit) return hit;
  const shots = fkSeedPlan(seed, FREEKICK_REV_3).kicks.map((k) => {
    const p = fkPlanKickV3(k, true);
    return (p.full ?? p.best)?.shot ?? { x: 0, y: 120, b: 0 };
  });
  if (solved3.size > 400) solved3.clear();
  solved3.set(seed, shots);
  return shots;
}

/** How a prepared shot is played: the wait before the tap, the gaps between the steps, the meter's ticks at the strike. */
export interface FkTiming3 {
  think?: number;
  curlGap?: number;
  powerGap?: number;
  strike?: number;
}

/**
 * Plays prepared shots through the real freekickRev 3 game: for each kick (once it can be taken, plus `think`) AIM,
 * then CURL `curlGap` ticks later, POWER `powerGap` later, STRIKE `strike` meter ticks after that (clean by default).
 */
export function playShotsV3(seed: number, shots: (FkShot3 | null)[], timing: FkTiming3[] = []): { events: ArcadeInputEvent[]; state: FreekickState } {
  const game = freekickGameFor(FREEKICK_REV_3);
  const ranges = game.inputRanges ?? [];
  let state = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  let aimFrom = -1;
  while (!game.isOver(state)) {
    const t = state.tick + 1;
    if (state.phase === FK_AIM) {
      if (aimFrom < 0) aimFrom = state.tick;
      const shot = shots[state.k];
      const tm = timing[state.k] ?? {};
      const t0 = aimFrom + (tm.think ?? 0) + 1;
      const t1 = t0 + Math.max(1, tm.curlGap ?? 1);
      const t2 = t1 + Math.max(1, tm.powerGap ?? 1);
      const t3 = t2 + Math.max(1, tm.strike ?? FK_V3_CLEAN_TICKS);
      if (shot) {
        if (t === t0) recordInput(events, { t, k: FREEKICK_INPUT_AIM, a: shot.x, b: shot.y, c: 0, d: 0 }, ranges);
        else if (t === t1) recordInput(events, { t, k: FREEKICK_INPUT_CURL, a: 0, b: shot.b, c: 0, d: 0 }, ranges);
        else if (t === t2) recordInput(events, { t, k: FREEKICK_INPUT_POWER, a: 0, b: 0, c: 0, d: 0 }, ranges);
        else if (t === t3) recordInput(events, { t, k: FREEKICK_INPUT_STRIKE, a: 0, b: 0, c: 0, d: 0 }, ranges);
      }
    } else aimFrom = -1;
    state = game.step(state, inputAt(events, t));
  }
  return { events, state };
}

/* ================================ freekickRev 4: the drawn shot ================================ */

/** Curls the rev-4 oracle tries: strongly bent first (the Curl bonus needs |curl| ≥ FK_V4_BENT), then gentler. */
const CURLS4 = [75, 80, 70, 85, 90, 100, 95];

function judgeShot4(k: FkKick, i: number, shot: FkShot3, meter = FK_V3_CLEAN_METER) {
  const j = fkJudge(k, fkFly3(k, shot, meter), fkHoopRFor(FREEKICK_REV_4, i));
  const bent = Math.abs(shot.b) >= FK_V4_BENT;
  const full = j.goal && j.place >= FREEKICK_PLACE_UNITS && j.curled && bent && (k.target === FK_TARGET_NONE || j.target);
  return { ...j, bent, full };
}

export interface FkCandidate4 extends FkCandidate3 {
  bent: boolean;
}
export interface FkPlans4 {
  full: FkCandidate4 | null;
  best: FkCandidate4 | null;
  goal: FkCandidate4 | null;
}

const rank4 = (c: FkCandidate4) => (c.goal ? 1000 : 0) + (c.target ? 200 : 0) + (c.bent ? 120 : 0) + (c.curled ? 60 : 0) + c.place;

/** ±target (cm) and ±curl neighbours for rev 4's drawn shot (0…8). */
function marginOf4(k: FkKick, i: number, shot: FkShot3, ok: (j: ReturnType<typeof judgeShot4>) => boolean): number {
  let n = 0;
  for (const [dx, dy, db] of NEIGHBOURS3) if (ok(judgeShot4(k, i, clampShot3({ x: shot.x + dx, y: shot.y + dy, b: shot.b + db })))) n++;
  return n;
}

/**
 * Searches kick `i`'s drawn shots on freekickRev 4 (rev 3's goal-plane points with the corner search on the kick's
 * shrunk hoop, strong curls first, through the sim's own solver, struck clean). `quick` stops at the first full shot.
 */
export function fkPlanKickV4(k: FkKick, i: number, quick = true): FkPlans4 {
  let best: FkCandidate4 | null = null;
  const fulls: FkCandidate4[] = [];
  const goals: FkCandidate4[] = [];
  const pts = aimPoints(k, k.target === FK_TARGET_LEFT || k.target === FK_TARGET_RIGHT ? fkHoopRFor(FREEKICK_REV_4, i) : undefined);
  for (const [tx, ty] of pts) {
    for (const mag of CURLS4) {
      for (const sign of [1, -1]) {
        const shot = clampShot3({ x: tx * 100, y: ty * 100, b: sign * mag });
        const j = judgeShot4(k, i, shot);
        const cand: FkCandidate4 = { shot, ...j, margin: 0 };
        if (!best || rank4(cand) > rank4(best)) best = cand;
        if (j.full) {
          fulls.push(cand);
          if (quick) return { full: cand, best: cand, goal: null };
        } else if (j.goal) goals.push(cand);
      }
    }
    if (!quick && fulls.length >= 10) break;
  }
  let full: FkCandidate4 | null = null;
  for (const c of fulls.slice(0, 10)) {
    c.margin = marginOf4(k, i, c.shot, (j) => j.full);
    if (!full || c.margin > full.margin) full = c;
  }
  // The safe goal: the most robust goal among the best-placed (a bent one preferred on ties).
  let goal: FkCandidate4 | null = null;
  const pool = [...goals.sort((p, q) => q.place - p.place).slice(0, 12), ...fulls.slice(0, 4)];
  for (const c of pool) {
    const mg = marginOf4(k, i, c.shot, (j) => j.goal);
    if (!goal || mg > goal.margin || (mg === goal.margin && c.bent && !goal.bent)) goal = { ...c, margin: mg };
  }
  return { full, best, goal };
}

const solved4 = new Map<number, FkShot3[]>();
/** The oracle's drawn shot for each kick of a seed (freekickRev 4; cached). */
export function oracleShotsV4(seed: number): FkShot3[] {
  const hit = solved4.get(seed);
  if (hit) return hit;
  const shots = fkSeedPlan(seed, FREEKICK_REV_4).kicks.map((k, i) => {
    const p = fkPlanKickV4(k, i, true);
    return (p.full ?? p.best)?.shot ?? { x: 0, y: 120, b: 0 };
  });
  if (solved4.size > 400) solved4.clear();
  solved4.set(seed, shots);
  return shots;
}

/** How a drawn shot is played: the wait before the stroke lands, the gap to POWER, the meter's ticks at the strike. */
export interface FkTiming4 {
  think?: number;
  powerGap?: number;
  strike?: number;
}

/**
 * Plays drawn shots through the real freekickRev 4 game: for each kick (once it can be taken, plus `think`) SHOT, then
 * POWER `powerGap` ticks later, STRIKE `strike` meter ticks after that (clean by default).
 */
export function playShotsV4(seed: number, shots: (FkShot3 | null)[], timing: FkTiming4[] = []): { events: ArcadeInputEvent[]; state: FreekickState } {
  const game = freekickGameFor(FREEKICK_REV_4);
  const ranges = game.inputRanges ?? [];
  let state = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  let aimFrom = -1;
  while (!game.isOver(state)) {
    const t = state.tick + 1;
    if (state.phase === FK_AIM) {
      if (aimFrom < 0) aimFrom = state.tick;
      const shot = shots[state.k];
      const tm = timing[state.k] ?? {};
      const t0 = aimFrom + (tm.think ?? 0) + 1;
      const t2 = t0 + Math.max(1, tm.powerGap ?? 1);
      const t3 = t2 + Math.max(1, tm.strike ?? FK_V3_CLEAN_TICKS);
      if (shot) {
        if (t === t0) recordInput(events, { t, k: FREEKICK_INPUT_SHOT, a: shot.x, b: shot.y, c: shot.b, d: 0 }, ranges);
        else if (t === t2) recordInput(events, { t, k: FREEKICK_INPUT_POWER, a: 0, b: 0, c: 0, d: 0 }, ranges);
        else if (t === t3) recordInput(events, { t, k: FREEKICK_INPUT_STRIKE, a: 0, b: 0, c: 0, d: 0 }, ranges);
      }
    } else aimFrom = -1;
    state = game.step(state, inputAt(events, t));
  }
  return { events, state };
}

if (import.meta.main) {
  const revArg = process.argv.find((a) => a.startsWith("--rev="));
  const rev = revArg ? Number(revArg.split("=")[1]) : FREEKICK_REV_DEALT;
  const seeds = process.argv.slice(2).filter((a) => !a.startsWith("--")).map(Number).filter(Number.isFinite);
  for (const seed of seeds.length ? seeds : [1, 2, 3, 4, 5]) {
    const t0 = performance.now();
    const { state } = rev >= FREEKICK_REV_4 ? playShotsV4(seed, oracleShotsV4(seed)) : rev >= FREEKICK_REV_3 ? playShotsV3(seed, oracleShotsV3(seed)) : playShots(seed, oracleShots(seed, rev), [], rev);
    const parts = freekickStdParts(state)!;
    console.log(seed, freekickGameFor(rev).score(state), parts.map((p) => `${p.key}=${p.points}`).join(" "), `${Math.round(performance.now() - t0)} ms`);
    fkSeedPlan(seed, rev).kicks.forEach((k, i) => {
      const c = rev >= FREEKICK_REV_4 ? (() => { const p = fkPlanKickV4(k, i, true); return p.full ?? p.best; })() : rev >= FREEKICK_REV_3 ? (() => { const p = fkPlanKickV3(k, true); return p.full ?? p.best; })() : fkSolveKick(k);
      if (!c?.full) console.log(`  kick ${i} target ${k.target} side ${k.side} d=${(Math.hypot(k.bx, k.bz) / FK_M).toFixed(1)} bx=${(k.bx / FK_M).toFixed(1)} wall ${k.wallN}: best goal=${c?.goal} place=${c?.place} curled=${c?.curled} target=${c?.target}${"bent" in (c ?? {}) ? ` bent=${(c as FkCandidate4).bent}` : ""}`);
    });
  }
  void FK_OUT_GOAL;
}
