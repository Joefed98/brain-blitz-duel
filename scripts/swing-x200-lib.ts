/**
 * Grappler's 200 expansion (swingRev 13): the perfect-play ceiling of a course, shared by swing-x200-check and its
 * recorder (scripts/swing-x200-ceiling.ts, which writes scripts/fixtures/swing-x200-ceiling.json for every room-bank
 * course).
 *
 * A course's ceiling is what a perfect player can score on it: the base (500 m with all ten stars: 140, + 10 for
 * 500 m) plus the skill pay of the raw skill points the course guarantees (no combos counted): a point a gem
 * (SWING_GEMS), a point a speed gate (SWING_GATES), SWING_LEDGE_POINTS for landing every ledge and the full
 * SWING_PAR_POINTS for finishing every section under par by SWING_PAR_FULL ticks or more. Each part is reachable:
 *  - 500 m with every star: the bank's own witness (scripts/swing-bank.ts --expand) on this course and revision;
 *  - gems and gates: placed by generation on proved flights and proved fast swings (initV13);
 *  - every ledge and every par: `sectionRoute` below plays each section in the real sim from its start ledge's
 *    centre (each press the tick after a landing, each let-go the earliest that lands on the next ledge) and the
 *    route must reach the flag at least SWING_PAR_FULL ticks under par.
 */
import {
  swingGameFor,
  swingSectionPar,
  SWING_FEATURE_CAP,
  SWING_GATES,
  SWING_GEMS,
  SWING_INPUT_HOLD,
  SWING_LEDGE_POINTS,
  SWING_PAR_FULL,
  SWING_PAR_POINTS,
  SWING_REV_EXPAND,
  SWING_SKILL_PAY,
  SWING_STARS,
  SWING_V13_BAND_CURVE,
  type SwingState,
} from "../src/lib/arcade/swing";
import { bandPoints, BAND_FINISH_BONUS } from "../src/lib/arcade/scoreBands";

const FP = 256;
const RADIUS = 10 * FP;
const game = swingGameFor(SWING_REV_EXPAND);
const hold = (s: SwingState, a: number) => ({ t: s.tick + 1, k: SWING_INPUT_HOLD, a, b: 0, c: 0, d: 0 });

/** Plays section k of a course's start state from its start ledge's centre (landed on tick 1): the route's time to the flag, or -1. */
export function sectionRoute(s0: SwingState, k: number): number {
  const ledges = s0.ledges ?? [];
  const start = ledges.findIndex((l) => l.section === k && l.kind === 0);
  if (start < 0) return -1;
  const l0 = ledges[start]!;
  let s: SwingState = { ...s0, x: l0.x, y: l0.top - RADIUS, rope: -1, vx: 0, vy: 0, ledgeOn: start, acted: 1, maxX: l0.x, tick: 1, ledgeTicks: ledges.map((_, i) => (i === start ? 1 : 0)) };
  for (;;) {
    const on = s.ledgeOn ?? -1;
    const here = ledges[on]!;
    if (here.kind === 2) return swingSectionPar(s, k).time;
    const next = ledges.findIndex((q) => q.section === k && q.order === here.order + 1);
    // Press on the next tick (held until the hero reaches the centre), then the earliest let-go that lands on `next`.
    let rope = game.step(s, hold(s, 1));
    for (let g = 0; g < 30 && rope.rope < 0 && !rope.ended; g++) rope = game.step(rope, null);
    if (rope.rope < 0 || rope.ended) return -1;
    let landed: SwingState | null = null;
    for (let r = 0; r < 420 && !landed && !rope.ended; r++) {
      let fly = game.step(rope, hold(rope, 0));
      for (let t = 0; t < 110 && !fly.ended && (fly.ledgeOn ?? -1) < 0; t++) fly = game.step(fly, null);
      if (!fly.ended && fly.ledgeOn === next) landed = fly;
      else rope = game.step(rope, null);
    }
    if (!landed) return -1;
    s = landed;
  }
}

export interface SwingCeiling {
  seed: number;
  stars: number;
  gems: number;
  gates: number;
  ledges: number;
  sections: number;
  pars: number[];
  /** Each section's route time (sectionRoute) in ticks; its par must be at least SWING_PAR_FULL more. */
  routes: number[];
  /** The raw skill points the course guarantees and the perfect-play ceiling (capped at 200). */
  raw: number;
  ceiling: number;
}

/** The ceiling of one course (its start state on swingRev 13). */
export function swingCeiling(seed: number): SwingCeiling {
  const s0 = game.init(seed);
  const ids = [...new Set((s0.ledges ?? []).map((l) => l.section))].sort((a, b) => a - b);
  const pars = ids.map((k) => s0.pars?.[k] ?? 0);
  const routes = ids.map((k) => sectionRoute(s0, k));
  const stars = (s0.starSpots ?? []).length;
  const gems = Math.min(SWING_GEMS, (s0.gems ?? []).length);
  const gates = Math.min(SWING_GATES, (s0.gates ?? []).length);
  const ledgesOk = ids.length >= 2 && routes.every((t) => t > 0);
  const parsOk = ledgesOk && routes.every((t, i) => pars[i]! > 0 && pars[i]! - t >= SWING_PAR_FULL);
  const raw = gems + gates + (ledgesOk ? SWING_LEDGE_POINTS : 0) + (parsOk ? SWING_PAR_POINTS : 0);
  const base = stars === SWING_STARS ? bandPoints(SWING_V13_BAND_CURVE, 500 + 5 * SWING_STARS) + BAND_FINISH_BONUS : 0;
  const ceiling = Math.min(200, base + Math.min(SWING_FEATURE_CAP, bandPoints(SWING_SKILL_PAY, raw)));
  return { seed, stars, gems, gates, ledges: (s0.ledges ?? []).length, sections: ids.length, pars, routes, raw, ceiling };
}
