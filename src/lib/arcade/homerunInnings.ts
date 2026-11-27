/**
 * Home Run's innings (homerunRev 5, 15 Nov 2026; docs/arcade-standard/homerun.md "homerunRev 5"): real batting with
 * consequences. One innings, three outs or the clock (117 s), against a seeded run of pitches (the same for everyone in
 * a room). Each at-bat:
 *
 * - read the pitch: some land outside the strike zone (a fixed count a plan, seeded order). Swinging at a ball outside
 *   the zone makes weak contact; taking a strike is a strike; four balls are a walk; three strikes an out; a foul with
 *   two strikes changes nothing;
 * - pick Contact (a wider window, shorter hits) or Power (a tight window, further) before the release (kind 2, locked
 *   at the release, carried from pitch to pitch);
 * - aim with the swipe's direction (kind 5: a = the angle, tenths of a degree, + = pulled to left field) into the gaps
 *   between the seven fielders, who shift every pitch;
 * - time it: the bat meets the plate HOMERUN_SWING_TICKS after the swipe; early pulls the ball, late pushes it, and the
 *   timing sets the carry.
 *
 * A ball in a fielder's area is caught (an out); otherwise it is a single, double or triple by distance (an outfielder
 * near its line holds it to one base less), or a home run over the fence. Runners advance by the hit's bases (a runner
 * on second scores on a single); a short single with a runner forced at second may be a fielder's choice (the lead
 * runner thrown out). Pitch types (fastball, curveball, changeup) show in the wind-up (display).
 *
 * Integer maths only; the plan comes from the seed and the level at init (homerunInningsPlan). This module imports
 * nothing from homerun.ts (it imports this), so its own copies of the shared field numbers are here.
 */
import { clampInt, rngBelow } from "./engine";

export const HOMERUN_REV_5 = 5;
/**
 * homerunRev 6 (D6, 23 Nov 2026; level deals only, Normal stays homerunRev 5): D6's levels, their settings under their
 * own keys ("easy6", "hard6", "expert6") in HR_LEVEL_SETTINGS, so every reader of a level's settings reads them as it
 * reads the levels before (a rev-5 level round keeps "easy" / "hard" / "expert" exactly). The lever is pitch speed.
 */
export const HOMERUN_REV_6 = 6;

/* ------------------------------------------------------------------ levels */

/** The four levels (the difficulty framework's ids; Normal is the rated level). */
export type HrLevel = "easy" | "normal" | "hard" | "expert";
export const HR_LEVELS: readonly HrLevel[] = ["easy", "normal", "hard", "expert"];
/** A settings key: a level, or a D6 level on homerunRev 6 (its own settings). */
export type HrPlayLevel = HrLevel | "easy6" | "hard6" | "expert6";

/** The settings key a round plays: homerunRev 6's levels their D6 keys, anything else its level (Normal by default). */
export function hrPlayLevel(level: unknown, rev: number | null | undefined): HrPlayLevel {
  const l = hrLevelOf(level);
  return (rev ?? 0) >= HOMERUN_REV_6 && l !== "normal" ? `${l}6` : l;
}
/** The level a settings key belongs to. */
export function hrBaseLevel(level: HrPlayLevel): HrLevel {
  return level === "easy6" ? "easy" : level === "hard6" ? "hard" : level === "expert6" ? "expert" : level;
}

export interface HrLevelSettings {
  /** Flight ticks (release to plate) per pitch kind: [lo, hi]. */
  flight: Readonly<Record<number, readonly [number, number]>>;
  /** Pitches outside the zone in the plan's first HR5_BALL_WINDOW pitches (a fixed count, seeded places). */
  balls: number;
  /** The timing window (ticks either side of the ball's arrival) for Contact and Power; past it the swing misses. */
  winContact: number;
  winPower: number;
  /** A swing within this many ticks of the arrival is PERFECT (full carry, on the aim, the streak). */
  perfect: number;
  /** Curveball and changeup movement, per mille of Normal's. */
  bend: number;
  /** Fielder catch areas, per mille of Normal's. */
  reach: number;
  /** How far outside the zone a ball finishes (px, [lo, hi]): nearer the edge is a closer call to take or swing at. */
  ballOff: readonly [number, number];
  /** D6's levels (homerunRev 6): the outs an innings lasts (unset 3) and the parts' figures (unset: rev 5's). */
  outs?: number;
  /** Runs, home runs, the longest perfect streak and good eye's count that fill each part (straight lines). */
  runsFull?: number;
  homersFull?: number;
  streakFull?: number;
  eyeFull?: number;
}

export const HR_LEVEL_SETTINGS: Readonly<Record<HrPlayLevel, HrLevelSettings>> = {
  easy: { flight: { 0: [42, 47], 1: [54, 60], 3: [66, 74] }, balls: 6, winContact: 7, winPower: 5, perfect: 2, bend: 450, reach: 800, ballOff: [14, 34] },
  normal: { flight: { 0: [36, 41], 1: [48, 54], 3: [62, 70] }, balls: 7, winContact: 5, winPower: 3, perfect: 1, bend: 1000, reach: 1000, ballOff: [14, 34] },
  // Hard and Expert retuned (16 Nov 2026, Joe: a clear step up, measured on the elite bot under human limits): the
  // fastball near a person's limit (0.25 s to see it, 0.15 s to move: no swing lands before about 30 ticks), balls
  // finishing nearer the zone's edge.
  hard: { flight: { 0: [28, 31], 1: [40, 44], 3: [54, 59] }, balls: 8, winContact: 4, winPower: 3, perfect: 0, bend: 1300, reach: 1100, ballOff: [8, 24] },
  expert: { flight: { 0: [27, 29], 1: [37, 40], 3: [51, 55] }, balls: 9, winContact: 4, winPower: 2, perfect: 0, bend: 1600, reach: 1200, ballOff: [5, 17] },
  // D6's levels (homerunRev 6, 23 Nov 2026; the polish plan's difficulty spec: the lever is pitch speed): Easy's
  // slow pitches, 3 balls, wide windows, 5 outs and small catch areas; Hard's and Expert's fast ones, PERFECT within a
  // tick (was the exact tick) and wide catch areas. The parts' figures per level from 96 room deals (scripts/d6-ladder.ts,
  // the skill-band bots under HUMAN_LIMITS): the average player 122 / 65 (Normal) / 30 / 21, the elite at 200
  // 91 % / 71 % / 36 % / 27 %.
  easy6: { flight: { 0: [52, 58], 1: [64, 70], 3: [76, 84] }, balls: 3, winContact: 9, winPower: 6, perfect: 2, bend: 300, reach: 600, ballOff: [14, 34], outs: 5, runsFull: 12, homersFull: 10, streakFull: 10, eyeFull: 2 },
  hard6: { flight: { 0: [31, 34], 1: [42, 46], 3: [56, 61] }, balls: 8, winContact: 4, winPower: 3, perfect: 1, bend: 1300, reach: 1350, ballOff: [8, 24], runsFull: 18, homersFull: 10, streakFull: 16, eyeFull: 5 },
  expert6: { flight: { 0: [27, 29], 1: [37, 40], 3: [51, 55] }, balls: 9, winContact: 4, winPower: 2, perfect: 1, bend: 1600, reach: 1650, ballOff: [5, 17], runsFull: 10, homersFull: 10, streakFull: 6, eyeFull: 5 },
};

export function hrLevelOf(value: unknown): HrLevel {
  return value === "easy" || value === "hard" || value === "expert" ? value : "normal";
}

/* ------------------------------------------------------------------- world */

/** Shared with homerun.ts (copied, not imported: homerun.ts imports this module). */
const ZONE_X0 = 212;
const ZONE_X1 = 304;
const ZONE_Y0 = 446;
const ZONE_Y1 = 566;
const FOUL_LINE = 450;
const SWING_TICKS = 6;
const TAKE_TICKS = 6;
const FIRST_RELEASE = 96;
const PITCH_FASTBALL = 0;
const PITCH_CURVE = 1;
const PITCH_CHANGEUP = 3;

/** The innings' clock: 117 s (with the round's slack, 120). */
export const HR5_RUN_SECONDS = 117;
export const HR5_RUN_TICKS = HR5_RUN_SECONDS * 60;
/** Ticks from a pitch being decided to the next release (the play, the runners, the next wind-up). */
export const HR5_GAP = 200;
/** The plan's length: more pitches than any innings can see (a pitch takes at least HR5_GAP + 29 ticks). */
export const HR5_PLAN_PITCHES = 40;
/** The window the fixed ball count is spread over (the first pitches, so every innings sees them). */
export const HR5_BALL_WINDOW = 24;
/** The run holds this long after the third out (or the clock) so the last play is seen. */
export const HR5_END_HOLD = 120;
/** A swipe is a swing from this many ticks before the release until the pitch is decided. */
export const HR5_SWING_EARLY = 12;

/** Input kinds: the swing choice (rev 3's kind 2, a = 0 Contact / 1 Power) and the swing (a = the aim angle). */
export const HR5_INPUT_MODE = 2;
export const HR5_INPUT_SWING = 5;
export const HR5_MODE_CONTACT = 0;
export const HR5_MODE_POWER = 1;
/** The aim's range (tenths of a degree of swipe, + = up and left = pulled to left field). */
export const HR5_AIM_MAX = 900;

/** Outcomes of a pitch. */
export const HR5_BALL = 1;
export const HR5_STRIKE_CALLED = 2;
export const HR5_WHIFF = 3;
export const HR5_FOUL = 4;
export const HR5_OUT_CAUGHT = 5;
export const HR5_SINGLE = 6;
export const HR5_DOUBLE = 7;
export const HR5_TRIPLE = 8;
export const HR5_HOMER = 9;
/** A short single where the lead runner was thrown out at second (the batter safe at first). */
export const HR5_CHOICE = 10;

export const HR5_OUTCOME_NAMES: Readonly<Record<number, string>> = {
  [HR5_BALL]: "Ball",
  [HR5_STRIKE_CALLED]: "Strike",
  [HR5_WHIFF]: "Swing and miss",
  [HR5_FOUL]: "Foul",
  [HR5_OUT_CAUGHT]: "Caught",
  [HR5_SINGLE]: "Single",
  [HR5_DOUBLE]: "Double",
  [HR5_TRIPLE]: "Triple",
  [HR5_HOMER]: "Home run",
  [HR5_CHOICE]: "Fielder's choice",
};

export interface Hr5Pitch {
  kind: number;
  /** Ticks from the release to the plate. */
  flight: number;
  plateX: number;
  plateY: number;
  breakX: number;
  breakY: number;
  mph: number;
  /** Inside the strike zone (where it crosses the plate). */
  zone: boolean;
}

export interface Hr5Fielder {
  spray: number;
  feet: number;
  half: number;
  depth: number;
  /** 1 an outfielder. */
  out: number;
}

export interface Hr5Plan {
  pitches: Hr5Pitch[];
  /** The seven fielders' places for each pitch (they shift between pitches). */
  fielders: Hr5Fielder[][];
}

/** The base places: LF, CF, RF, then third, short, second, first (spray tenths, + left; feet). */
const FIELDERS: readonly { spray: number; feet: number; ds: number; df: number; out: number }[] = [
  { spray: 270, feet: 280, ds: 60, df: 25, out: 1 },
  { spray: 0, feet: 305, ds: 60, df: 25, out: 1 },
  { spray: -270, feet: 280, ds: 60, df: 25, out: 1 },
  { spray: 340, feet: 105, ds: 30, df: 10, out: 0 },
  { spray: 130, feet: 135, ds: 40, df: 12, out: 0 },
  { spray: -130, feet: 135, ds: 40, df: 12, out: 0 },
  { spray: -340, feet: 100, ds: 30, df: 10, out: 0 },
];
const CATCH = { outHalf: 75, outDepth: 48, inHalf: 60, inDepth: 30 } as const;
const SHIFT = { spray: 30, feet: 14 } as const;
/** Lanes across the zone's columns (world x), shared with rev 4's. */
const LANES = [232, 258, 284] as const;

const planCache = new Map<string, Hr5Plan>();

/** homerunRev 5's plan from the seed and level: the pitches (a fixed count outside the zone) and the fielders a pitch. */
export function homerunInningsPlan(seed: number, level: HrPlayLevel = "normal"): Hr5Plan {
  const key = `${seed | 0}:${level}`;
  const hit = planCache.get(key);
  if (hit) return hit;
  const L = HR_LEVEL_SETTINGS[level];
  let rng = (seed ^ 0x5a17_3c05) | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  // Which of the first HR5_BALL_WINDOW pitches are balls (a fixed count), then 1 in 4 after that.
  const ballAt = new Array<boolean>(HR5_PLAN_PITCHES).fill(false);
  const order = Array.from({ length: HR5_BALL_WINDOW }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = draw(i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  for (let i = 0; i < L.balls; i++) ballAt[order[i]!] = true;
  for (let i = HR5_BALL_WINDOW; i < HR5_PLAN_PITCHES; i++) ballAt[i] = draw(4) === 0;
  // Easy leans on fastballs and changeups (straighter); the rest mix all three.
  const kindsEasy = [PITCH_FASTBALL, PITCH_FASTBALL, PITCH_CHANGEUP, PITCH_CURVE];
  const kindsMix = [PITCH_FASTBALL, PITCH_FASTBALL, PITCH_CURVE, PITCH_CHANGEUP];
  const pitches: Hr5Pitch[] = [];
  for (let i = 0; i < HR5_PLAN_PITCHES; i++) {
    const kind = (level === "easy" ? kindsEasy : kindsMix)[draw(4)]!;
    const [lo, hi] = L.flight[kind]!;
    const flight = lo + draw(hi - lo + 1);
    let plateX = LANES[draw(3)]! + draw(9) - 4;
    let plateY = ZONE_Y0 + 18 + draw(ZONE_Y1 - ZONE_Y0 - 35);
    if (ballAt[i]) {
      // Outside: off one side, or high, or low (by 14–34 px).
      const side = draw(4);
      const by = L.ballOff[0] + draw(L.ballOff[1] - L.ballOff[0] + 1);
      if (side === 0) plateX = ZONE_X0 - by;
      else if (side === 1) plateX = ZONE_X1 + by;
      else if (side === 2) plateY = ZONE_Y0 - by;
      else plateY = ZONE_Y1 + by;
    }
    const sign = draw(2) ? 1 : -1;
    const breakX = kind === PITCH_CURVE ? Math.trunc((sign * (30 + draw(15)) * L.bend) / 1000) : 0;
    const breakY = kind === PITCH_CURVE ? Math.trunc(((10 + draw(7)) * L.bend) / 1000) : kind === PITCH_CHANGEUP ? Math.trunc(((8 + draw(7)) * L.bend) / 1000) : 0;
    const base = kind === PITCH_FASTBALL ? 90 : kind === PITCH_CHANGEUP ? 75 : 78;
    const mph = base + Math.trunc((60 - flight) / 3) + draw(4);
    const zone = plateX >= ZONE_X0 && plateX <= ZONE_X1 && plateY >= ZONE_Y0 && plateY <= ZONE_Y1;
    pitches.push({ kind, flight, plateX, plateY, breakX, breakY, mph, zone });
  }
  const fielders: Hr5Fielder[][] = pitches.map(() =>
    FIELDERS.map((f) => ({
      spray: clampInt(f.spray + draw(2 * (f.ds + SHIFT.spray) + 1) - f.ds - SHIFT.spray, -430, 430),
      feet: f.feet + draw(2 * (f.df + SHIFT.feet) + 1) - f.df - SHIFT.feet,
      half: Math.trunc(((f.out ? CATCH.outHalf : CATCH.inHalf) * L.reach) / 1000),
      depth: Math.trunc(((f.out ? CATCH.outDepth : CATCH.inDepth) * L.reach) / 1000),
      out: f.out,
    })),
  );
  const plan: Hr5Plan = { pitches, fielders };
  if (planCache.size > 32) planCache.clear();
  planCache.set(key, plan);
  return plan;
}

/* ------------------------------------------------------------------ contact */

/** The fence's depth at a spray (rev 1's park: 330 ft down the lines, 400 in centre). */
export function hr5Fence(spray: number): number {
  const a = Math.min(FOUL_LINE, Math.abs(spray));
  return 400 - Math.trunc((70 * a * a) / (FOUL_LINE * FOUL_LINE));
}

/** Carry by swing: Contact 90 + 250 × quality (at most 340 ft), Power 80 + 370 (at most 450). */
const CARRY = { contact: [90, 250], power: [80, 370] } as const;
/** Quality lost a tick past PERFECT, per swing. */
const FALL = { contact: 110, power: 180 } as const;
/** A ball outside the zone hit at all is weak contact (per mille of the quality). */
export const HR5_CHASE_Q = 520;
/** Under this quality the ball is hit on the ground (its carry cut to 40 %). */
export const HR5_GROUND_Q = 380;
/** Aim drift a tick past PERFECT (tenths of a degree; early pulls, late pushes). */
export const HR5_DRIFT = 30;
/** An outfielder within this spray of a hit's line holds it to one base less. */
export const HR5_CUTOFF = 110;

export interface Hr5Hit {
  /** The pitch's index in the plan. */
  i: number;
  out: number;
  /** The swing's tick (-1 taken), its aim and mode, and the bat's tick less the ball's arrival. */
  st: number;
  aim: number;
  m: number;
  dt: number;
  q: number;
  feet: number;
  spray: number;
  /** The tick the pitch was decided, and its release. */
  at: number;
  rel: number;
  /** The fielder who caught it or threw the runner out (-1 none). */
  c: number;
  /** Runs this pitch scored, and the bases after it (bit 0 first). */
  runs: number;
  bases: number;
  perfect: boolean;
}

/** A swing's result against pitch `i`, before the count and the runners. */
export function hr5Contact(plan: Hr5Plan, level: HrPlayLevel, i: number, release: number, swingTick: number, aim: number, mode: number): Omit<Hr5Hit, "runs" | "bases" | "at" | "rel"> & { at: number } {
  const L = HR_LEVEL_SETTINGS[level];
  const p = plan.pitches[i]!;
  const arrive = release + p.flight;
  const contact = swingTick + SWING_TICKS;
  const at = Math.max(contact, arrive);
  const dt = contact - arrive;
  const off = Math.abs(dt);
  const power = mode === HR5_MODE_POWER;
  const win = power ? L.winPower : L.winContact;
  const base = { i, st: swingTick, aim, m: mode, dt, at, c: -1 };
  if (off > win) return { ...base, out: HR5_WHIFF, q: 0, feet: 0, spray: 0, perfect: false };
  const past = Math.max(0, off - L.perfect);
  let q = 1000 - past * (power ? FALL.power : FALL.contact);
  if (!p.zone) q = Math.trunc((q * HR5_CHASE_Q) / 1000);
  const perfect = past === 0 && p.zone;
  const spray = clampInt(aim, -HR5_AIM_MAX, HR5_AIM_MAX) - Math.sign(dt) * past * HR5_DRIFT;
  const carry = power ? CARRY.power : CARRY.contact;
  let feet = carry[0] + Math.trunc((carry[1] * q) / 1000);
  if (q < HR5_GROUND_Q) feet = Math.trunc((feet * 40) / 100);
  if (Math.abs(spray) > FOUL_LINE) return { ...base, out: HR5_FOUL, q, feet: 0, spray, perfect: false };
  if (feet > hr5Fence(spray)) return { ...base, out: HR5_HOMER, q, feet, spray, perfect };
  const fielders = plan.fielders[i]!;
  const caught = fielders.findIndex((f) => Math.abs(spray - f.spray) <= f.half && Math.abs(feet - f.feet) <= f.depth);
  if (caught >= 0) return { ...base, out: HR5_OUT_CAUGHT, q, feet, spray, perfect, c: caught };
  // A single short of 170 ft; a double; a triple only off the wall (within 30 ft of it). An outfielder near the ball's
  // line holds it to one base less.
  let bases = feet < 170 ? 1 : feet < hr5Fence(spray) - 30 ? 2 : 3;
  if (feet >= 170 && fielders.some((f) => f.out && Math.abs(spray - f.spray) <= HR5_CUTOFF)) bases = Math.max(1, bases - 1);
  const out = bases === 1 ? HR5_SINGLE : bases === 2 ? HR5_DOUBLE : HR5_TRIPLE;
  return { ...base, out, q, feet, spray, perfect };
}

/* -------------------------------------------------------------------- state */

export interface Hr5Inn {
  level: HrPlayLevel;
  /** The current pitch's index in the plan and its release tick (or the next one's). */
  i: number;
  release: number;
  /** Swing choice now, and the one locked at the release. */
  mode: number;
  pmode: number;
  /** The current pitch's swing (tick -1 none) and aim. */
  st: number;
  aim: number;
  balls: number;
  strikes: number;
  outs: number;
  /** Runners (bit 0 first, 1 second, 2 third). */
  bases: number;
  runs: number;
  /** Extra-base hits, balls taken, balls chased (swung at outside the zone), perfect swings now in a row, the best run and all of them. */
  big: number;
  eye: number;
  chased: number;
  streak: number;
  best: number;
  perfects: number;
  hits: Hr5Hit[];
  /** The tick the innings ended (third out or the clock), 0 before. */
  endAt: number;
}

export function hr5InitInn(level: HrPlayLevel): Hr5Inn {
  return { level, i: 0, release: FIRST_RELEASE, mode: HR5_MODE_CONTACT, pmode: HR5_MODE_CONTACT, st: -1, aim: 0, balls: 0, strikes: 0, outs: 0, bases: 0, runs: 0, big: 0, eye: 0, chased: 0, streak: 0, best: 0, perfects: 0, hits: [], endAt: 0 };
}

/** Advance the runners by `n` bases with the batter to base n (a runner on second scores on a single); runs and the new bases. */
export function hr5Advance(bases: number, n: number): { runs: number; bases: number } {
  let runs = 0;
  let b = 0;
  for (let base = 2; base >= 0; base--) {
    if (!(bases & (1 << base))) continue;
    const to = base + n + (n === 1 && base === 1 ? 1 : 0);
    if (to >= 3) runs += 1;
    else b |= 1 << to;
  }
  if (n >= 4) runs += 1;
  else b |= 1 << (n - 1);
  return { runs, bases: b };
}

/** A walk: the batter to first, forced runners up a base. */
function walk(bases: number): { runs: number; bases: number } {
  if (!(bases & 1)) return { runs: 0, bases: bases | 1 };
  if (!(bases & 2)) return { runs: 0, bases: bases | 3 };
  if (!(bases & 4)) return { runs: 0, bases: 7 };
  return { runs: 1, bases: 7 };
}

/** The pitch's result applied to the count, the runners and the totals. */
function settle(inn: Hr5Inn, hit: Omit<Hr5Hit, "runs" | "bases" | "rel">, tick: number, plan: Hr5Plan): Hr5Inn {
  const n: Hr5Inn = { ...inn, st: -1, aim: 0, hits: inn.hits };
  let runs = 0;
  let endAt = false;
  let out = hit.out;
  let c = hit.c;
  const nextBatter = () => {
    n.balls = 0;
    n.strikes = 0;
  };
  const outsMax = HR_LEVEL_SETTINGS[n.level].outs ?? 3;
  const addOut = () => {
    n.outs += 1;
    nextBatter();
    if (n.outs >= outsMax) endAt = true;
  };
  if (out === HR5_BALL) {
    n.balls += 1;
    n.eye += 1;
    if (n.balls >= 4) {
      const w = walk(n.bases);
      runs = w.runs;
      n.bases = w.bases;
      nextBatter();
    }
  } else if (out === HR5_STRIKE_CALLED || out === HR5_WHIFF) {
    n.strikes += 1;
    if (n.strikes >= 3) addOut();
  } else if (out === HR5_FOUL) {
    if (n.strikes < 2) n.strikes += 1;
  } else if (out === HR5_OUT_CAUGHT) {
    addOut();
  } else {
    const bases = out === HR5_SINGLE ? 1 : out === HR5_DOUBLE ? 2 : out === HR5_TRIPLE ? 3 : 4;
    // A short single with a runner forced at second and an infielder near its line: the lead runner thrown out.
    if (bases === 1 && hit.feet < 120 && n.bases & 1) {
      const f = plan.fielders[hit.i]!.findIndex((x) => !x.out && Math.abs(hit.spray - x.spray) <= 2 * x.half);
      if (f >= 0) {
        out = HR5_CHOICE;
        c = f;
        // The runner from first is forced out at second; a runner on second (forced) goes to third, pushing a runner
        // on third home; a runner on third alone stays; the batter is safe at first.
        n.outs += 1;
        // A run never scores on a force for the third out.
        runs = n.outs < outsMax && n.bases & 2 && n.bases & 4 ? 1 : 0;
        n.bases = 1 | (n.bases & 2 ? 4 : n.bases & 4);
        nextBatter();
        if (n.outs >= outsMax) endAt = true;
      }
    }
    if (out !== HR5_CHOICE) {
      const a = hr5Advance(n.bases, bases);
      runs = a.runs;
      n.bases = a.bases;
      if (bases >= 2) n.big += 1;
      nextBatter();
    }
  }
  if (endAt) n.bases = 0;
  n.runs += runs;
  const swung = hit.st >= 0;
  if (swung && !plan.pitches[hit.i]!.zone) n.chased += 1;
  if (hit.perfect) {
    n.streak += 1;
    n.perfects += 1;
    if (n.streak > n.best) n.best = n.streak;
  } else if (swung || out === HR5_STRIKE_CALLED) n.streak = 0;
  n.hits = [...inn.hits, { ...hit, out, c, runs, bases: n.bases, at: tick, rel: inn.release }];
  n.i += 1;
  n.release = tick + HR5_GAP;
  if (endAt) n.endAt = tick;
  return n;
}

/** One tick of the innings (the caller has already moved `tick` on). Returns the new innings. */
export function hr5Step(inn: Hr5Inn, tick: number, seed: number, input: { k: number; a: number } | null): { inn: Hr5Inn; acted: boolean } {
  let n = inn;
  let acted = false;
  if (n.endAt > 0 || tick >= HR5_RUN_TICKS) {
    if (n.endAt === 0) n = { ...n, endAt: tick, bases: n.bases };
    return { inn: n, acted: input !== null };
  }
  const plan = homerunInningsPlan(seed, n.level);
  // No new pitch in the clock's last HR5_END_HOLD ticks: the innings ends there (a pitch already thrown plays out), so
  // the end is always seen.
  if (n.st < 0 && tick < n.release - HR5_SWING_EARLY && tick >= HR5_RUN_TICKS - HR5_END_HOLD) return { inn: { ...n, endAt: tick }, acted: input !== null };
  if (input && input.k === HR5_INPUT_MODE) {
    acted = true;
    n = { ...n, mode: input.a === HR5_MODE_POWER ? HR5_MODE_POWER : HR5_MODE_CONTACT };
  }
  if (tick === n.release) n = { ...n, pmode: n.mode };
  if (input && input.k === HR5_INPUT_SWING) {
    acted = true;
    if (n.st < 0 && tick >= n.release - HR5_SWING_EARLY && n.i < HR5_PLAN_PITCHES) n = { ...n, st: tick, aim: clampInt(Math.trunc(input.a), -HR5_AIM_MAX, HR5_AIM_MAX) };
  }
  if (n.i >= HR5_PLAN_PITCHES) return { inn: n, acted };
  const p = plan.pitches[n.i]!;
  const arrive = n.release + p.flight;
  if (n.st >= 0) {
    const hit = hr5Contact(plan, n.level, n.i, n.release, n.st, n.aim, n.pmode);
    if (tick >= hit.at) n = settle(n, hit, tick, plan);
  } else if (tick >= arrive + TAKE_TICKS) {
    const taken = { i: n.i, st: -1, aim: 0, m: n.pmode, dt: 0, q: 0, feet: 0, spray: 0, c: -1, perfect: false, at: tick, out: p.zone ? HR5_STRIKE_CALLED : HR5_BALL };
    n = settle(n, taken, tick, plan);
  }
  return { inn: n, acted };
}

/** The arrival tick of the pitch being faced (display). */
export function hr5Arrive(inn: Hr5Inn, seed: number): number {
  const p = homerunInningsPlan(seed, inn.level).pitches[inn.i];
  return p ? inn.release + p.flight : -1;
}

/* ------------------------------------------------------------------ display */

/** A runner's move on a decided pitch (display): from and to on the base path (0 home, 1 first … 4 home again), out = thrown out. */
export interface Hr5Move {
  from: number;
  to: number;
  out: boolean;
  batter: boolean;
}

/** The bases before pitch `n` of the innings (display). */
export function hr5BasesBefore(inn: Pick<Hr5Inn, "hits">, n: number): number {
  for (let k = n - 1; k >= 0; k--) {
    const h = inn.hits[k]!;
    // A pitch that ended the innings clears the bases.
    return h.bases;
  }
  return 0;
}

/** How each runner (and the batter) moved on a decided pitch, from the rules above (display only; never read by the sim). */
export function hr5Moves(before: number, hit: Pick<Hr5Hit, "out">): Hr5Move[] {
  const moves: Hr5Move[] = [];
  const on = [0, 1, 2].filter((b) => before & (1 << b));
  const out = hit.out;
  const n = out === HR5_SINGLE ? 1 : out === HR5_DOUBLE ? 2 : out === HR5_TRIPLE ? 3 : out === HR5_HOMER ? 4 : 0;
  if (n > 0) {
    for (const b of on) moves.push({ from: b + 1, to: Math.min(4, b + 1 + n + (n === 1 && b === 1 ? 1 : 0)), out: false, batter: false });
    moves.push({ from: 0, to: n, out: false, batter: true });
  } else if (out === HR5_CHOICE) {
    for (const b of on) {
      if (b === 0) moves.push({ from: 1, to: 2, out: true, batter: false });
      else if (b === 1) moves.push({ from: 2, to: 3, out: false, batter: false });
      else moves.push({ from: 3, to: before & 2 ? 4 : 3, out: false, batter: false });
    }
    moves.push({ from: 0, to: 1, out: false, batter: true });
  } else {
    for (const b of on) moves.push({ from: b + 1, to: b + 1, out: false, batter: false });
  }
  return moves;
}

/* ------------------------------------------------------------------ scoring */

/** Good eye's count: balls taken less balls chased (never below 0). */
export function hr5EyeCount(inn: Pick<Hr5Inn, "eye" | "chased">): number {
  return Math.max(0, inn.eye - inn.chased);
}

/**
 * Runs 100 (a straight line, full at HR5_RUNS_FULL), home runs 40 (4 each), perfect streak 40 (4 for each swing in the
 * longest run of perfect swings) and good eye 20 (4 for each ball taken beyond the balls chased).
 */
export const HR5_RUNS_MAX = 100;
export const HR5_RUNS_FULL = 18;
export const HR5_HOMER_EACH = 4;
export const HR5_HOMERS_MAX = 40;
export const HR5_STREAK_EACH = 4;
export const HR5_STREAK_MAX = 40;
export const HR5_EYE_EACH = 4;
export const HR5_EYE_MAX = 20;
