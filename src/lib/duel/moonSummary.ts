/**
 * Moon Climb's run summary for the answer reveal (the Action overhaul, stage 2, 15 Nov 2026; display only).
 *
 * The stored log replayed through the real sim exactly as `replayMoonRun` does (the same events, checked the same way,
 * the same end), noting the climb as it goes: the ninja's place every few ticks (the route up the shaft), each hit (the
 * height it was knocked from and the metres lost), each lantern ridden and scroll taken (where), and the longest Flow
 * streak's stretch of the route. Nothing here grades or scores: the reveal's score is the stored one.
 */
import { checkInputEvents, type ArcadeInputEvent } from "@/lib/arcade/engine";
import {
  moonGameFor,
  MOON_CORE_FULL_M,
  MOON_REV,
  MOON_SCROLLS,
  MOON_SKY,
  ninjaBodyFor,
  ninjaMetres,
  NINJA_PX_PER_M,
  NINJA_RUN_TICKS,
  type MoonState,
} from "@/lib/arcade/ricochetNinja";
import { decodeMoonRun } from "./ricochet";

/** The route is sampled every this many ticks. */
export const MOON_SUMMARY_STEP = 6;

export interface MoonSummary {
  /** The route: world x and height above the floor's standing height (px), every MOON_SUMMARY_STEP ticks. */
  route: { x: number; y: number }[];
  /** Each hit: where (x, height px) and the metres it knocked the ninja down. */
  hits: { x: number; y: number; lostM: number }[];
  rides: { x: number; y: number }[];
  scrolls: { x: number; y: number }[];
  /** Indices into `route` of the longest Flow streak's stretch, or null without one. */
  bestRun: { from: number; to: number } | null;
  bestStreak: number;
  metres: number;
  /** The best height reached (px above the standing height). */
  bestPx: number;
  flowSteps: number;
  rideCount: number;
  scrollCount: number;
  hitCount: number;
  rideTotal: number;
  scrollTotal: number;
  fullM: number;
}

export function moonRunSummary(seed: number, raw: string, rev?: number | null): MoonSummary {
  const game = moonGameFor(rev ?? MOON_REV);
  const run = decodeMoonRun(raw);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, NINJA_RUN_TICKS) : 0;
  const lastTick = endTick > 0 && endTick < NINJA_RUN_TICKS ? endTick : NINJA_RUN_TICKS;
  const check = checkInputEvents(run.events, NINJA_RUN_TICKS, game.inputRanges ?? []);
  const events = new Map<number, ArcadeInputEvent>();
  for (const e of check.events) events.set(e.t, e);
  let state: MoonState = game.init(seed);
  const start = ninjaBodyFor(state.rev).start;
  const h = (s: MoonState) => Math.max(0, Math.trunc((s.y - start) / 256));
  const route: MoonSummary["route"] = [{ x: state.x, y: h(state) }];
  const hits: MoonSummary["hits"] = [];
  const rides: MoonSummary["rides"] = [];
  const scrolls: MoonSummary["scrolls"] = [];
  let runFrom = -1;
  let bestRun: MoonSummary["bestRun"] = null;
  let bestLen = 0;
  for (let tick = 1; tick <= lastTick; tick++) {
    const before = state;
    state = game.step(state, events.get(tick) ?? null);
    if (tick % MOON_SUMMARY_STEP === 0 || state.hits > before.hits) route.push({ x: state.x, y: h(state) });
    const at = route.length - 1;
    if (state.hits > before.hits) {
      const lost = Math.max(0, Math.round((before.y - state.knockTo) / 256 / NINJA_PX_PER_M));
      hits.push({ x: before.x, y: h(before), lostM: lost });
    }
    if (state.rides > before.rides) rides.push({ x: state.x, y: h(state) });
    if (state.scrolls > before.scrolls) scrolls.push({ x: state.x, y: h(state) });
    if (state.streak > 0 && before.streak === 0) runFrom = at;
    if (state.streak > 0 && runFrom >= 0 && state.streak > bestLen) {
      bestLen = state.streak;
      bestRun = { from: runFrom, to: at };
    } else if (state.streak > 0 && bestRun && bestRun.from === runFrom) bestRun = { from: runFrom, to: at };
    if (state.streak === 0) runFrom = -1;
    if (game.isOver(state)) break;
  }
  return {
    route,
    hits,
    rides,
    scrolls,
    bestRun,
    bestStreak: state.bestStreak,
    metres: ninjaMetres(state),
    bestPx: Math.max(0, Math.trunc((state.best - start) / 256)),
    flowSteps: state.flow,
    rideCount: state.rides,
    scrollCount: state.scrolls,
    hitCount: state.hits,
    rideTotal: MOON_SKY,
    scrollTotal: MOON_SCROLLS,
    fullM: MOON_CORE_FULL_M,
  };
}
