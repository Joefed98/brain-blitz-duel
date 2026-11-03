/**
 * Curling's throw search (script only; floats are fine here, the result is an input log the sim replays):
 *
 *  - `simThrow`: one throw slid through the sim's own curlMotionTick (no sweeping) to rest, the hog rule applied;
 *  - `searchThrows`: broom x, turn and weight swept coarse then fine, ranked by where the thrown stone stops and how
 *    many of the opponent's stones stay in the house;
 *  - `perfectPlan`: eight throws that each end on the button with every opponent stone out at the end and shot stone
 *    held (= 200), searched depth first; null when none is found (the bank drops that seed);
 *  - `planEvents`: a plan as the event log a phone would record (each throw on the first tick it can be thrown).
 *
 * curlRev 2 (31 Oct 2026): a throw also has its start x on the near hog line (`sx`); the search tries the centre line
 * first and, where that leaves fewer than `branch` button throws, starts either side of it (STARTS_V2). Brushing is
 * never needed for a plan (with no brush stroke curlRev 2 slides exactly as curlRev 1 does).
 *
 * curlRev 3 (1 Nov 2026): the same search on curlRev 3's gentler weight line (`rev` on simThrow and searchThrows; the
 * weight band and steps are scaled so the speeds searched match curlRev 2's, WEIGHTS_FOR).
 *
 * curlRev 4 (3 Nov 2026): three red stones a sheet, and a throw only counts when it comes to rest nearer the button
 * than every red in the house (curlCounts): the search's cost adds a stone's worth for one that does not count, and a
 * plan's button throws must count.
 *
 * Used by scripts/curling-bank.ts, the skill-band bot and the checks.
 */
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  curlCounts,
  curlDist,
  curlingGameFor,
  curlInHouse,
  curlMotionTick,
  curlRelease,
  cm,
  ON_BUTTON,
  CU,
  CURL_AIM,
  CURL_INPUT_THROW,
  CURL_TRAVEL_CAP,
  CURLING_STONES,
  HOG_FAR,
  HOG_NEAR,
  TEAM_MINE,
  TEAM_THEIRS,
  type CurlingState,
} from "../src/lib/arcade/curling";

export interface Throw {
  bx: number;
  by: number;
  weight: number;
  /** 0 In, 1 Out. */
  turn: number;
  /** curlRev 2: the start x on the near hog line (cm; 0 the centre line). */
  sx?: number;
}

/** curlRev 2's extra starts (cm across the near hog line), tried where the centre line leaves too few button throws. */
export const STARTS_V2 = [-50, 50] as const;

/** The stones on the sheet (units), as the search sees them. */
export interface Sheet {
  x: number[];
  y: number[];
  team: number[];
  live: number[];
}

export function sheetOf(s: CurlingState): Sheet {
  return { x: s.x.slice(), y: s.y.slice(), team: s.team.slice(), live: s.live.slice() };
}

/** The weight band a search sweeps by default, its coarse step and the refine half-window, per revision. */
export function weightsFor(rev: number): { band: [number, number]; step: number; refine: number } {
  // curlRev 3: 1…1000 spans 5.5 cm a tick (curlRev 1 and 2: 9), so the same speeds take 9 ÷ 5.5 as many weights.
  return rev >= 3 ? { band: [250, 890], step: 13, refine: 13 } : { band: [270, 650], step: 8, refine: 8 };
}

/** Slides one throw from the near hog line to rest (no sweeping), exactly as the sim does. */
export function simThrow(sheet: Sheet, t: Throw, sweepAt?: (tick: number, s: Sheet & { vx: number[]; vy: number[] }) => number, rev = 1): Sheet & { active: number; ticks: number; hits: number } {
  const v = curlRelease(t.bx, t.by, t.weight, t.sx ?? 0, rev);
  const s = {
    x: [...sheet.x, (t.sx ?? 0) * CU],
    y: [...sheet.y, HOG_NEAR * CU],
    vx: [...sheet.x.map(() => 0), v.vx],
    vy: [...sheet.x.map(() => 0), v.vy],
    live: [...sheet.live, 1],
    curl: [...sheet.x.map(() => 0), t.turn === 0 ? 1 : -1],
  };
  const active = s.x.length - 1;
  let ticks = 0;
  let hits = 0;
  let sweep = 0;
  for (;;) {
    ticks++;
    if (sweepAt) sweep = sweepAt(ticks, { ...s, team: [...sheet.team, TEAM_MINE] });
    const r = curlMotionTick(s, sweep);
    hits += r.hits;
    if (!r.moving || ticks >= CURL_TRAVEL_CAP) break;
  }
  if (s.live[active] && s.y[active]! > cm(HOG_FAR)) s.live[active] = 0;
  return { x: s.x, y: s.y, team: [...sheet.team, TEAM_MINE], live: s.live, active, ticks, hits };
}

/** Opponent stones still in the house. */
export function theirsIn(s: Sheet): number {
  let n = 0;
  for (let i = 0; i < s.x.length; i++) if (s.team[i] === TEAM_THEIRS && s.live[i] && curlInHouse(s.x[i]!, s.y[i]!)) n++;
  return n;
}

export interface Candidate {
  t: Throw;
  /** The thrown stone's distance from the button (cm; Infinity when out of play). */
  d: number;
  theirs: number;
  /** curlRev 4: whether the stone counts (nearer the button than every red in the house); always true before. */
  counts: boolean;
  after: Sheet;
}

function judge(sheet: Sheet, t: Throw, rev = 1): Candidate {
  const r = simThrow(sheet, t, undefined, rev);
  const i = r.active;
  const d = r.live[i] ? curlDist(r.x[i]!, r.y[i]!) / CU : Infinity;
  const counts = rev < 4 || (r.live[i] === 1 && curlCounts(r, i));
  return { t, d, theirs: theirsIn(r), counts, after: { x: r.x, y: r.y, team: r.team, live: r.live } };
}

/** A throw's cost (lower is better); curlRev 4 adds a stone's worth for one that does not count. */
const cost = (c: Candidate) => (Number.isFinite(c.d) ? c.d : 400) + 60 * c.theirs + (c.counts ? 0 : 150);

/**
 * Throws from a sheet, best first: a coarse sweep (broom x every 3 cm, both turns, weight every 8), then the best
 * `refine` refined to 1 cm and 1 weight unit. `weights` bounds the sweep (the draw-to-takeout band by default).
 */
export function searchThrows(sheet: Sheet, opts: { refine?: number; weights?: [number, number]; xs?: [number, number]; xStep?: number; wStep?: number; sx?: number; rev?: number } = {}): Candidate[] {
  const rev = opts.rev ?? 1;
  const wf = weightsFor(rev);
  const [w0, w1] = opts.weights ?? wf.band;
  const [x0, x1] = opts.xs ?? [-132, 132];
  // A throw from the centre line keeps curlRev 1's shape ({bx, by, weight, turn}); another start carries sx.
  const sxs = opts.sx ? { sx: opts.sx } : {};
  const coarse: Candidate[] = [];
  for (let turn = 0; turn < 2; turn++)
    for (let bx = x0; bx <= x1; bx += opts.xStep ?? 3)
      for (let w = w0; w <= w1; w += opts.wStep ?? wf.step) coarse.push(judge(sheet, { bx, by: 0, weight: w, turn, ...sxs }, rev));
  coarse.sort((a, b) => cost(a) - cost(b));
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const c of coarse.slice(0, opts.refine ?? 30)) {
    for (let bx = c.t.bx - 5; bx <= c.t.bx + 5; bx++)
      for (let w = c.t.weight - wf.refine; w <= c.t.weight + wf.refine; w++) {
        const key = `${c.t.turn}:${bx}:${w}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(judge(sheet, { bx, by: 0, weight: w, turn: c.t.turn, ...sxs }, rev));
      }
  }
  out.push(...coarse);
  out.sort((a, b) => cost(a) - cost(b));
  return out;
}

const onButton = (c: Candidate) => c.d <= ON_BUTTON - 0.5 && c.counts;

/**
 * Eight throws that each come to rest on the button, every opponent stone out of the house at the end and shot stone
 * held: a depth-first search taking up to `branch` distinct button throws at each step (fewest opponents left first).
 * Null when none is found within `budget` throw searches.
 */
export function perfectPlan(seed: number, branch = 3, budget = 40, rev = 1): Throw[] | null {
  const start = sheetOf(curlingGameFor(rev).init(seed));
  let searches = 0;
  const go = (sheet: Sheet, k: number): Throw[] | null => {
    if (k === CURLING_STONES) return theirsIn(sheet) === 0 ? [] : null;
    if (searches++ >= budget) return null;
    const left = CURLING_STONES - k;
    // A later throw can still clear what is left only if there are throws for it.
    const usableOf = (list: Candidate[]) => list.filter(onButton).filter((c) => c.theirs <= left - 1 || c.theirs === 0);
    const usable = usableOf(searchThrows(sheet, { rev }));
    usable.sort((a, b) => a.theirs - b.theirs || a.d - b.d);
    if (rev >= 2 && new Set(usable.map((c) => `${c.theirs}:${Math.round(c.d)}:${c.t.turn}`)).size < branch) {
      // curlRev 2: too few from the centre line; slide the stone along the hog line and look again.
      const more = STARTS_V2.flatMap((sx) => usableOf(searchThrows(sheet, { sx, refine: 15, xStep: 4, wStep: rev >= 3 ? 16 : 10, rev })));
      more.sort((a, b) => a.theirs - b.theirs || a.d - b.d);
      usable.push(...more);
    }
    const tried = new Set<string>();
    for (const c of usable) {
      const key = `${c.theirs}:${Math.round(c.d)}:${c.t.turn}:${c.t.sx ?? 0}`;
      if (tried.has(key)) continue;
      tried.add(key);
      if (tried.size > branch) break;
      const rest = go(c.after, k + 1);
      if (rest) return [c.t, ...rest];
    }
    return null;
  };
  return go(start, 0);
}

/** A throw as its event payload (curlRev 2 carries the start x in d). */
export function throwEvent(t: Throw): Omit<ArcadeInputEvent, "t"> {
  return { k: CURL_INPUT_THROW, a: t.bx, b: t.by, c: t.weight * 2 + t.turn, d: t.sx ?? 0 };
}

/** A plan as the phone's log: each throw on the first tick the sheet is ready for it. */
export function planEvents(seed: number, plan: readonly Throw[], waitTicks = 0, rev = 1): { events: ArcadeInputEvent[]; state: CurlingState } {
  const game = curlingGameFor(rev);
  let s = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  let next = 0;
  let readyAt = -1;
  while (!game.isOver(s)) {
    let ev: ArcadeInputEvent | null = null;
    if (s.phase === CURL_AIM && next < plan.length) {
      if (readyAt < 0) readyAt = s.tick;
      if (s.tick - readyAt >= waitTicks) {
        ev = { t: s.tick + 1, ...throwEvent(plan[next]!) };
        events.push(ev);
        next++;
        readyAt = -1;
      }
    }
    s = game.step(s, ev);
  }
  return { events, state: s };
}

export { TEAM_MINE, TEAM_THEIRS };
