/** Shared helpers for the Scrumper 200-point expansion scripts (snipRev 11). */
import { createHash } from "node:crypto";
import { inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  snipCourseTestLevel,
  snipExpandGame,
  SNIP_COURSES,
  SNIP_INPUT_CUT,
  SNIP_X_FED,
  SNIP_X_LEVEL_TICKS,
  SNIP_X_PAN_TICKS,
  SNIP_X_WOBBLES,
  type SnipCourse,
  type SnipState,
  SNIP_REV_EXPAND,
  SNIP_REV_PROVEN,
  SNIP_CHECKPOINT_INTERVAL,
  snipCheckpoint,
  type SnipCheckpoint,
} from "../src/lib/arcade/snip";
import { encodeSnipRun } from "../src/lib/duel/snip";
import { playRevOf } from "./scoring-targets-revs";

/** A stable digest of a whole sim state (every field, sorted keys). */
export function snipStateDigest(state: unknown): string {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === "object") return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, norm((v as Record<string, unknown>)[k])]));
    return v;
  };
  return createHash("sha256").update(JSON.stringify(norm(state))).digest("hex").slice(0, 24);
}

/** Human pace: the first cut no sooner than this level tick (the pan, then a moment), strokes this far apart. */
export const X_FIRST_CUT = SNIP_X_PAN_TICKS + 24;
export const X_STROKE_GAP = 12;
/** Cuts on consecutive ticks (one stroke) may move at most this far between them, px. */
export const X_STROKE_REACH = 70;

/** [rope index, level tick]: cuts on consecutive ticks are one stroke. */
export type XPlan = [number, number][];

/** The ideal swipe the checks use: short, across the rope next to its pin. */
export function xCutFor(s: SnipState, i: number): Omit<ArcadeInputEvent, "t"> {
  const r = s.ropes[i]!;
  const x = (r.x[0]! + r.x[1]!) / 512;
  const y = (r.y[0]! + r.y[1]!) / 512;
  const dx = (r.y[1]! - r.y[0]!) / 256;
  const dy = (r.x[0]! - r.x[1]!) / 256;
  const L = Math.max(1, Math.hypot(dx, dy));
  return { k: SNIP_INPUT_CUT, a: Math.round(x - (dx / L) * 15), b: Math.round(y - (dy / L) * 15), c: Math.round(x + (dx / L) * 15), d: Math.round(y + (dy / L) * 15) };
}

/** Whether a plan keeps human pace (first cut, stroke gaps, a stroke's reach is checked when played). */
export function xPaced(plan: XPlan): boolean {
  if (!plan.length) return false;
  const p = [...plan].sort((a, b) => a[1] - b[1]);
  if (p[0]![1] < X_FIRST_CUT) return false;
  let strokeEnd = p[0]![1];
  for (let i = 1; i < p.length; i++) {
    const t = p[i]![1];
    if (t === p[i - 1]![1]) return false;
    if (t === strokeEnd + 1) strokeEnd = t;
    else {
      if (t - strokeEnd < X_STROKE_GAP) return false;
      strokeEnd = t;
    }
  }
  return true;
}

export function xStrokes(plan: XPlan): number {
  const p = [...plan].sort((a, b) => a[1] - b[1]);
  let n = 0;
  for (let i = 0; i < p.length; i++) if (i === 0 || p[i]![1] !== p[i - 1]![1] + 1) n++;
  return n;
}

export interface XPlay {
  /** Every planned cut found its rope alive, and a stroke's cuts stayed within X_STROKE_REACH. */
  valid: boolean;
  fed: number;
  fruits: number;
  all: boolean;
  stars: number;
  strokes: number;
  /** Level tick the level ended. */
  tick: number;
  par: boolean;
  perfect: boolean;
  golden: number;
  /** Each fruit's centre every 4 ticks (design). */
  paths?: [number, number][][];
  /** Vines a peg or ring hung: [rope index, level tick, fruit]. */
  vines: [number, number, number][];
  /** Level tick each fruit was fed (−1 if not). */
  fedAt: number[];
}

/** Plays one level of a course (an index, or a candidate put in the spare slot) on a deal. */
export function xPlayLevel(course: number | SnipCourse, wob: number, wind: number, gold: number, plan: XPlan, trace = false): XPlay {
  let index = typeof course === "number" ? course : SNIP_COURSES.length;
  if (typeof course !== "number") (SNIP_COURSES as SnipCourse[])[index] = course;
  try {
    let s = snipCourseTestLevel(index, wob, wind, gold);
    const log: ArcadeInputEvent[] = [];
    let valid = true;
    let lastCut: { t: number; x: number; y: number } | null = null;
    const paths: [number, number][][] = (s.fruits ?? []).map(() => []);
    const vines: [number, number, number][] = [];
    const fedAt: number[] = (s.fruits ?? []).map(() => -1);
    for (let k = 0; k < SNIP_X_LEVEL_TICKS + 2; k++) {
      const at = s.levelTick + 1;
      const due = plan.find(([, t]) => t === at);
      if (due) {
        if (!s.ropes[due[0]]?.alive) valid = false;
        else {
          const cut = xCutFor(s, due[0]);
          const cx = (cut.a + cut.c) / 2;
          const cy = (cut.b + cut.d) / 2;
          if (lastCut && lastCut.t === at - 1 && Math.hypot(cx - lastCut.x, cy - lastCut.y) > X_STROKE_REACH) valid = false;
          lastCut = { t: at, x: cx, y: cy };
          recordInput(log, { ...cut, t: s.tick + 1 }, snipExpandGame.inputRanges);
        }
      }
      const prev = s;
      s = snipExpandGame.step(s, inputAt(log, s.tick + 1));
      if (s.level === prev.level && s.ropes.length > prev.ropes.length) vines.push([s.ropes.length - 1, at, s.ropes.at(-1)!.f ?? 0]);
      (s.fruits ?? []).forEach((f, i) => { if (f.st === SNIP_X_FED && fedAt[i]! < 0) fedAt[i] = at; });
      if (trace && s.level === 0) (s.fruits ?? []).forEach((f, i) => { if (s.levelTick % 4 === 0 && f.st === 0) paths[i]!.push([f.x / 256, f.y / 256]); });
      if (s.level !== prev.level) {
        const fruits = s.fruits ?? [];
        const fed = fruits.filter((f) => f.st === SNIP_X_FED).length;
        return {
          valid,
          fed,
          fruits: fruits.length,
          all: fed === fruits.length,
          stars: s.starGot.reduce((n, g) => n + g, 0),
          strokes: s.lvlStrokes ?? 0,
          tick: at,
          par: (s.parLevels ?? 0) > 0,
          perfect: (s.perfect ?? 0) > 0,
          golden: s.golden ?? 0,
          vines,
          fedAt,
          ...(trace ? { paths } : {}),
        };
      }
    }
    throw new Error("level did not end");
  } finally {
    if (typeof course !== "number") (SNIP_COURSES as SnipCourse[]).length = index;
  }
}

/** Every deal of a course: [wobble px, wind preset]. The golden fruit changes no physics. */
export function xDeals(course: SnipCourse): [number, number][] {
  return SNIP_X_WOBBLES.flatMap((w) => course.winds.map((_, k) => [w, k] as [number, number]));
}

/**
 * The stored proofs (scripts/fixtures/snip-x200-proofs.json): per course, per deal "wob:wind", a win plan
 * and, per fruit that may be golden, a best (perfect: every fruit, par, both leaves, that fruit golden) plan.
 */
export type XProofs = Record<string, { name: string; deals: Record<string, { win: XPlan; best: Record<string, XPlan> }> }>;

/** A level's stored plan: its win plan, or the perfect plan for its golden fruit (any, on a level with none). */
export function xPlanFor(proofs: XProofs, s: SnipState, which: "best" | "win"): XPlan | undefined {
  const d = proofs[String(s.template)]?.deals[xDealKey(s)];
  if (!d) return undefined;
  if (which === "win") return d.win;
  const gold = (s.fruits ?? []).findIndex((f) => f.gold === 1);
  return d.best[String(gold)] ?? Object.values(d.best)[0];
}

/** The deal key of the level a state is on. */
export function xDealKey(s: SnipState): string {
  const course = SNIP_COURSES[s.template]!;
  const wind = course.winds.findIndex(([a, p, ph]) => a === (s.windA ?? 0) && p === (s.windP ?? 0) && ph === (s.windPh ?? 0));
  return `${s.wob ?? 0}:${Math.max(0, wind)}`;
}

/** A whole run played with each level's stored plan (`best` or `win`), the ideal swipes at the plan's ticks. */
export function xPlannedRun(seed: number, proofs: XProofs, which: "best" | "win"): { events: ArcadeInputEvent[]; state: SnipState; raw: string } {
  const game = snipExpandGame;
  let s = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: SnipCheckpoint[] = [];
  let plan: XPlan = [];
  let level = -1;
  while (!game.isOver(s)) {
    if (s.level !== level) {
      level = s.level;
      plan = xPlanFor(proofs, s, which) ?? [];
    }
    const due = plan.find(([, t]) => t === s.levelTick + 1);
    if (due && s.ropes[due[0]]?.alive) recordInput(events, { ...xCutFor(s, due[0]), t: s.tick + 1 }, game.inputRanges);
    s = game.step(s, inputAt(events, s.tick + 1));
    if (s.tick % SNIP_CHECKPOINT_INTERVAL === 0) checkpoints.push(snipCheckpoint(s));
  }
  return { events, state: s, raw: encodeSnipRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints }) };
}

/**
 * The play a check written before the 200-point expansion proves rooms deal: rooms deal snipRev 11 since then
 * (proved by snip-x200-check); until it they dealt snipRev 9, snipRev 7's play (playRevOf).
 */
export function snipPlayBeforeExpand(rev: number | undefined | null): number | undefined | null {
  return rev === SNIP_REV_EXPAND ? SNIP_REV_PROVEN : playRevOf("snip", rev);
}
