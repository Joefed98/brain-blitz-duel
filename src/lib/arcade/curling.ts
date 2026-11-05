/**
 * Curling (`curling`, Sports group, 30 Oct 2026; docs/arcade-standard/curling.md): eight stones in 120 s, thrown down
 * the whole sheet to the far house, seen from behind the thrower. Drag the gold broom target in the house, tap In or
 * Out for the turn, swipe up the lane for the weight; rub ahead of a moving stone to sweep it.
 *
 * Deterministic (engine.ts): the seed places the opponent's stones (red handles) in the house at init and nothing
 * random happens after. Stones slide in 1/4096 cm (finer than the other Sports games' 1/256: a curl's sideways pull is
 * a few thousandths of a cm a tick) with a constant slowing, curl across their travel that grows as they slow, and
 * equal-mass collisions (a hit and roll: the thrower keeps a fifth of its speed through a full hit). Real sheet
 * proportions; a draw takes about 6 s from the near hog line to the far tee.
 *
 * Rules: a stone that stops short of the far hog line is removed; a stone touching a side board or fully past the
 * back line is out of play. Sweeping fills a meter that decays: while it is up the stone slows less and curls less.
 * Stone k "comes to rest when thrown" when everything stops after throw k; that is where it is judged.
 *
 * Rooms deal seeds from the proven bank (src/lib/duel/curlingBank.server.ts, scripts/curling-bank.ts): every opponent
 * stone there can be hit out of the house leaving the thrower on the button, so a perfect run reaches 200.
 *
 * Scoring (curlRev 1, the arcade standard; arcadeStandard.ts): Stones up to 120 (up to 15 a stone by its closeness to
 * the button where it comes to rest when thrown: a straight line from 0 at the house's edge to 15 on the button),
 * (a stone counts as on the button, in the 4-foot or in the house when any of it is over that circle, as curlers judge it),
 * Takeouts up to 30 (the opponent's stones out of the house at the end, shared evenly), Red ring up to 30 (3.75 a stone
 * finishing in the 4-foot when thrown), Holding shot 20 (your stone nearest the button at the end). Together 200; any
 * throw scores at least 1, no input 0.
 *
 * curlRev 2 (31 Oct 2026, Joe's notes; the same parts): the throw carries its start x on the near hog line (input d),
 * and a brush stroke its side (input b: −1 left of the stone, +1 right). Brushing pushes the stone across the sheet
 * towards the brushed side and eases its slowing a little (BEND_*, BRUSH_CARRY_PCT, CARRY_MAX); it no longer halves the
 * curl. With no stroke a curlRev 2 stone slides exactly as a curlRev 1 one. Rooms deal curlRev 2 sheets from their own
 * proven bank (src/lib/duel/curlingBankV2.server.ts).
 *
 * curlRev 3 (1 Nov 2026, Joe's "prepare the shot"; docs/arcade-standard/curling.md): curlRev 2's sheet, brushing and
 * controls, with the weight on a gentler line (1…1000 → CURL_VMIN_V3…CURL_VMAX_V3, so the meter's draw zone is wider)
 * and the stone's closeness core re-fitted (curlStonePointsFor). The phone shows a weight meter with the draw zone
 * (curlDrawZone: the weights that stop an unswept stone from this start, broom and turn inside the house on an empty
 * sheet) and a faint aim line (curlAimPath: the first third of the stone's path at the zone's tee weight, stepped
 * through curlMotionTick on a copy of the sheet); both are pure helpers here that only read, never the sim's state.
 * Rooms deal curlRev 3 sheets from their own proven bank (src/lib/duel/curlingBankV3.server.ts).
 *
 * curlRev 4 (3 Nov 2026, Joe's sports batch; docs/arcade-standard/curling.md "curlRev 4"): curlRev 3's sheet, weight
 * line, brushing and aids, with the weight set on the power bar and a Throw button on the phone (the same kind-1
 * throw). Every end starts with three red stones in seeded places in or around the house (curlingOpponentsV4), and
 * the core follows curling's count: a stone scores its closeness points only when it comes to rest closer to the button
 * than every red stone in the house at that moment (curlCounts). Rooms deal curlRev 4 sheets from their own proven
 * bank (src/lib/duel/curlingBankV4.server.ts).
 */
import { clampInt, inputRange, isqrt, type ArcadeGame, type ArcadeInputEvent, type CanvasSize } from "./engine";
import { stdFinal, stdLine, stdPart, type StdPart, type StdSpec } from "./arcadeStandard";
import { collideEqual, idiv, ilen, sumInts, type SportsCheckpoint } from "./sportsKit";

/* ================================ Constants ================================ */

/**
 * The dealt stamp. curlRev 2 (31 Oct 2026, Joe's notes): the stone slides along the near hog line to its start, and a
 * brush stroke has a side (left or right of the stone) that bends the stone that way and carries it a little further.
 * curlRev 1 (every stone from the centre line; a sweep runs further and curls less) replays and scores as before.
 */
export const CURLING_REV = 4;
/** curlRev 3 (1 Nov 2026): the weight meter's draw zone, the aim line, the gentler weight line. */
export const CURLING_REV_V3 = 3;
/** The first revision (30 Oct 2026). */
export const CURLING_REV_V1 = 1;
/** curlRev 2 (31 Oct 2026): the start along the near hog line and side brushing. */
export const CURLING_REV_V2 = 2;
export const CURLING_RUN_S = 120;
export const CURLING_RUN_TICKS = CURLING_RUN_S * 60;
export const CURLING_STONES = 8;

/** The world the canvas draws (the broadcast view), world px. */
export const CURLING_W = 390;
export const CURLING_H = 720;
/** curlRev 2's world (display only): the same width, shorter, so the world fills the width on a 375 × 667 phone. */
export const CURLING_H_V2 = 540;
/** The world's height for a revision (display only). */
/** curlRev 4's play view's height (3 Nov 2026, display only: the renderer's CURL_VIEW_V4; the sim never reads it). */
export const CURLING_H_V4 = 640;
export function curlingWorldHFor(rev: number | null | undefined): number {
  const r = rev ?? CURLING_REV_V1;
  return r >= 4 ? CURLING_H_V4 : r >= 2 ? CURLING_H_V2 : CURLING_H;
}

/** Sheet units: 1 cm = CU. */
export const CU = 4096;
export const cm = (v: number): number => Math.round(v * CU);

/** The sheet, in cm: x across (0 on the centre line), y along it (0 on the far tee line, growing towards the thrower). */
export const SHEET_HALF_W = 237.5;
export const HOUSE_R = 183;
export const FOUR_FOOT_R = 61;
export const EIGHT_FOOT_R = 122;
export const BUTTON_R = 15;
export const STONE_R = 14.5;
export const BACK_FAR = -183;
export const HOG_FAR = 640;
/** The thrower lets go on the near hog line. */
export const HOG_NEAR = 2835;
export const TEE_NEAR = 3475;
export const BACK_NEAR = 3658;

/** Release speeds (cm a tick) at weight 1 and 1000; a draw to the button is about 15.75 (6 s). */
export const CURL_VMIN = 13;
export const CURL_VMAX = 22;
/**
 * curlRev 3's release speeds (cm a tick) at weight 0 and 1000: a gentler line over the band a game uses (a draw to the
 * tee is weight about 316, the house's depth about 200 weights wide, rev 2's heaviest witness takeout 18.9 cm a tick).
 */
export const CURL_VMIN_V3 = 14;
export const CURL_VMAX_V3 = 19.5;
/** The slowing a tick (units a tick²) and the speed below which a stone stops. */
export const CURL_DECEL = 179;
export const CURL_STOP_V = 60;
/** Curl: sideways pull CURL_A × CURL_VS ÷ (speed + CURL_VS), units a tick², across the travel. */
export const CURL_A = 48;
export const CURL_VS = 4 * CU;
/**
 * Stone on stone restitution (256ths): 0.6, so a stone struck full on takes 80 % of the speed and the thrower keeps 20 %
 * and rolls on (a hit and roll): a takeout of a stone near the button can leave the thrower on it.
 */
export const CURL_E = 154;
/** Sweeping: the meter's cap and decay a tick; at full effect the slowing falls 30 % and the curl halves. */
export const SWEEP_MAX = 600;
export const SWEEP_FULL = 240;
export const SWEEP_DECAY = 4;
/** A throw that has not settled by this many ticks is stopped where it is. */
export const CURL_TRAVEL_CAP = 900;
/** Substeps a tick (a stone moves at most about 6 cm a substep). */
const SUB = 4;

/**
 * curlRev 2's brushing (a stroke on one side of the moving stone): each stroke adds 3 × its strength to the carry
 * meter (the sweep meter, capped at CARRY_MAX, draining SWEEP_DECAY a tick; at SWEEP_FULL and above the stone slows
 * BRUSH_CARRY_PCT % less; the curl is untouched) and ± 3 × its strength to the bend meter (capped at ± BEND_MAX,
 * draining BEND_DECAY a tick towards 0), which pushes the stone sideways (across the sheet, towards the brushed side)
 * by up to BEND_A units a tick² at BEND_FULL. The low caps make both fade within about a second of the last stroke.
 */
export const BRUSH_CARRY_PCT = 8;
export const CARRY_MAX = 300;
export const BEND_MAX = 260;
export const BEND_FULL = 200;
export const BEND_DECAY = 5;
export const BEND_A = 20;
/** curlRev 2: how far (cm) either side of the centre line the stone may start on the near hog line. */
export const CURL_START_MAX = 100;

/**
 * Input kind 1: a throw. a = broom x (cm), b = broom y (cm from the far tee), c = weight × 2 + turn (0 In, 1 Out);
 * curlRev 2 adds d = the start x on the near hog line (cm, ± CURL_START_MAX; curlRev 1 starts on the centre line).
 */
export const CURL_INPUT_THROW = 1;
/**
 * Input kind 2: a sweep stroke, a = its strength 1…100; curlRev 2 adds b = the side brushed (−1 left of the stone,
 * +1 right of it, as the player sees it: −1 bends it left, towards −x; 0 carries only).
 */
export const CURL_INPUT_SWEEP = 2;
export const CURL_WEIGHT_MAX = 1000;
export const CURLING_INPUT_RANGES = [
  inputRange(CURL_INPUT_THROW, [-200, 200], [-183, 183], [2, CURL_WEIGHT_MAX * 2 + 1]),
  inputRange(CURL_INPUT_SWEEP, [1, 100]),
] as const;
/** curlRev 2's ranges: the throw's start x and the stroke's side. */
export const CURLING_INPUT_RANGES_V2 = [
  inputRange(CURL_INPUT_THROW, [-200, 200], [-183, 183], [2, CURL_WEIGHT_MAX * 2 + 1], [-CURL_START_MAX, CURL_START_MAX]),
  inputRange(CURL_INPUT_SWEEP, [1, 100], [-1, 1]),
] as const;

export const CURL_AIM = 0;
export const CURL_TRAVEL = 1;
export const CURL_DONE = 2;

export const TEAM_MINE = 0;
export const TEAM_THEIRS = 1;

/* ============================== The standard ============================== */

export const CURL_STONE_PTS = 15;
export const CURL_TAKEOUT_PTS = 30;
export const CURL_RED_PTS = 30;
export const CURL_HOLD_PTS = 20;

/** curlRev 1 and 2's spec (the same parts as curlRev 3's). */
export const CURLING_STD_SPEC_V2: StdSpec = {
  field: "curlRev",
  rev: CURLING_REV_V2,
  parts: [
    { key: "core", label: "Stones", max: 120, of: CURLING_STONES, item: "stone", how: `up to ${CURL_STONE_PTS} a stone by how close to the button it comes to rest` },
    { key: "takeouts", label: "Takeouts", max: CURL_TAKEOUT_PTS, of: 1, item: "takeout", how: "the opponent's stones knocked out of the house, shared evenly" },
    { key: "redring", label: "Red ring", max: CURL_RED_PTS, of: CURLING_STONES, item: "stone", how: "3.75 a stone finishing in the 4-foot" },
    { key: "hold", label: "Holding shot", max: CURL_HOLD_PTS, of: 1, item: "shot", how: "finish with your stone nearest the button" },
  ],
};

/** curlRev 3's spec: the same parts and maximums, the core's line running out to 3.2 m from the button. */
export const CURLING_STD_SPEC_V3: StdSpec = {
  field: "curlRev",
  rev: CURLING_REV_V3,
  parts: [
    { key: "core", label: "Stones", max: 120, of: CURLING_STONES, item: "stone", how: `up to ${CURL_STONE_PTS} a stone by how close to the button it comes to rest (none from 3.2 m away)` },
    { key: "takeouts", label: "Takeouts", max: CURL_TAKEOUT_PTS, of: 1, item: "takeout", how: "the opponent's stones knocked out of the house, shared evenly" },
    { key: "redring", label: "Red ring", max: CURL_RED_PTS, of: CURLING_STONES, item: "stone", how: "3.75 a stone finishing in the 4-foot" },
    { key: "hold", label: "Holding shot", max: CURL_HOLD_PTS, of: 1, item: "shot", how: "finish with your stone nearest the button" },
  ],
};

/**
 * curlRev 4's parts (re-fitted on the skill bands, docs/arcade-standard/curling.md "curlRev 4"): the core is the larger
 * share (the measure the count makes harder), on a straight line of closeness points full at CURL_V4_CORE_FULL (about
 * six and a third stones' worth on the button), and the three features are smaller (a weak player knocked the reds
 * about and held shot often enough that 30 / 30 / 20 left too little between the levels).
 */
export const CURL_V4_CORE_MAX = 150;
export const CURL_V4_CORE_FULL = 95;
export const CURL_V4_TAKEOUT_PTS = 20;
export const CURL_V4_RED_PTS = 20;
export const CURL_V4_HOLD_PTS = 10;

/** curlRev 4's spec: only stones nearer the button than every red in the house count towards the core. */
export const CURLING_STD_SPEC: StdSpec = {
  field: "curlRev",
  rev: CURLING_REV,
  parts: [
    { key: "core", label: "Stones", max: CURL_V4_CORE_MAX, of: CURLING_STONES, item: "stone", how: `${CURL_STONE_PTS} for a stone on the button, less further out, if it stops nearer than every red` },
    { key: "takeouts", label: "Takeouts", max: CURL_V4_TAKEOUT_PTS, of: 1, item: "takeout", how: "knock the red stones out of the house" },
    { key: "redring", label: "Red ring", max: CURL_V4_RED_PTS, of: CURLING_STONES, item: "stone", how: "2.5 for each stone that stops in the red ring" },
    { key: "hold", label: "Holding shot", max: CURL_V4_HOLD_PTS, of: 1, item: "shot", how: "finish with your stone nearest the button" },
  ],
};

/* ================================= State ================================= */

export interface CurlingState {
  tick: number;
  rev: number;
  seed: number;
  phase: number;
  /** Stones in play order: the opponent's first (placed at init), then each thrown one. Positions in units. */
  x: number[];
  y: number[];
  vx: number[];
  vy: number[];
  team: number[];
  /** 1 while in play. */
  live: number[];
  /** The thrown stone's turn (+1 In, −1 Out); 0 for the opponent's. */
  curl: number[];
  /** How many opponent stones the seed placed. */
  theirs: number;
  /** Stones thrown so far. */
  thrown: number;
  /** The stone in travel (index), or −1. */
  active: number;
  travelTicks: number;
  sweep: number;
  /** curlRev 2: the bend meter (signed, − bends left); 0 on curlRev 1. */
  bend: number;
  /** Per throw: closeness points (0–15) and whether it came to rest in the 4-foot, when thrown. */
  pts: number[];
  four: number[];
  acted: number;
  over: number;
  /** Effects (display only): hits so far and the last hit's tick; the last throw's settle tick. */
  hits: number;
  hitTick: number;
  restTick: number;
  sweeps: number;
}

/** A tiny integer PRNG for the deal only (mulberry32); play never draws. */
function dealRng(seed: number): (n: number) => number {
  let a = seed >>> 0;
  return (n: number) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return n <= 1 ? 0 : ((t ^ (t >>> 14)) >>> 0) % n;
  };
}

/** The opponent's stones for a seed: 2 or 3 in the house, 25–85 cm from the button, clear of each other (cm). */
export function curlingOpponents(seed: number): { x: number; y: number }[] {
  const rnd = dealRng(seed ^ 0xc0e11e);
  const n = 2 + rnd(2);
  const out: { x: number; y: number }[] = [];
  for (let tries = 0; out.length < n && tries < 400; tries++) {
    const x = rnd(171) - 85;
    const y = rnd(171) - 85;
    const d2 = x * x + y * y;
    if (d2 < 25 * 25 || d2 > 85 * 85) continue;
    if (out.some((o) => (o.x - x) * (o.x - x) + (o.y - y) * (o.y - y) < 40 * 40)) continue;
    out.push({ x, y });
  }
  return out;
}

/**
 * curlRev 4's opponents for a seed: exactly three red stones, their centres OPP_V4_MIN…OPP_V4_MAX cm from the button
 * (in the 4-foot and 8-foot, one of them out towards the 8-foot's edge), at least 40 cm apart: one within 70 cm and
 * one beyond it, so every sheet has a stone to beat near the button and one further out.
 */
export const OPP_V4_MIN = 35;
export const OPP_V4_MAX = 110;
export function curlingOpponentsV4(seed: number): { x: number; y: number }[] {
  const rnd = dealRng(seed ^ 0x4ed5c4);
  const out: { x: number; y: number }[] = [];
  for (let tries = 0; out.length < 3 && tries < 2000; tries++) {
    const x = rnd(2 * OPP_V4_MAX + 1) - OPP_V4_MAX;
    const y = rnd(2 * OPP_V4_MAX + 1) - OPP_V4_MAX;
    const d2 = x * x + y * y;
    if (d2 < OPP_V4_MIN * OPP_V4_MIN || d2 > OPP_V4_MAX * OPP_V4_MAX) continue;
    // The first stone close (within 70 cm), the second further out (beyond 70 cm), the third anywhere.
    if (out.length === 0 && d2 > 70 * 70) continue;
    if (out.length === 1 && d2 <= 70 * 70) continue;
    if (out.some((o) => (o.x - x) * (o.x - x) + (o.y - y) * (o.y - y) < 40 * 40)) continue;
    out.push({ x, y });
  }
  return out;
}

function initState(seed: number, rev: number): CurlingState {
  const opp = rev >= 4 ? curlingOpponentsV4(seed) : curlingOpponents(seed);
  return {
    tick: 0,
    rev,
    seed,
    phase: CURL_AIM,
    x: opp.map((o) => o.x * CU),
    y: opp.map((o) => o.y * CU),
    vx: opp.map(() => 0),
    vy: opp.map(() => 0),
    team: opp.map(() => TEAM_THEIRS),
    live: opp.map(() => 1),
    curl: opp.map(() => 0),
    theirs: opp.length,
    thrown: 0,
    active: -1,
    travelTicks: 0,
    sweep: 0,
    bend: 0,
    pts: [],
    four: [],
    acted: 0,
    over: 0,
    hits: 0,
    hitTick: 0,
    restTick: 0,
    sweeps: 0,
  };
}

/**
 * A throw's release velocity (units a tick) towards the broom (cm) at a weight 1…1000, from `startX` cm across on the
 * near hog line (curlRev 2; 0, the centre line, on curlRev 1).
 */
export function curlRelease(broomX: number, broomY: number, weight: number, startX = 0, rev = CURLING_REV_V1): { vx: number; vy: number } {
  const w = clampInt(Math.trunc(weight), 1, CURL_WEIGHT_MAX);
  const speed = rev >= 3 ? cm(CURL_VMIN_V3) + idiv(cm(CURL_VMAX_V3 - CURL_VMIN_V3) * w, CURL_WEIGHT_MAX) : CURL_VMIN * CU + idiv((CURL_VMAX - CURL_VMIN) * CU * w, CURL_WEIGHT_MAX);
  const dx = (broomX - startX) * CU;
  const dy = (broomY - HOG_NEAR) * CU;
  const l = ilen(dx, dy);
  return { vx: idiv(dx * speed, l), vy: idiv(dy * speed, l) };
}

/** A stone centre's distance from the button (units). */
export function curlDist(x: number, y: number): number {
  return isqrt(x * x + y * y);
}

/**
 * A stone is judged as curlers see it, by the circles it touches: "on the button" when any of it is over the button,
 * "in the 4-foot" or "in the house" likewise (its centre within the circle's radius plus its own).
 */
export const ON_BUTTON = BUTTON_R + STONE_R;
export const IN_FOUR_FOOT = FOUR_FOOT_R + STONE_R;
export const IN_HOUSE = HOUSE_R + STONE_R;

/** Closeness points for a stone resting at (x, y): 15 on the button, falling evenly to 0 where it leaves the house. */
export function curlStonePoints(x: number, y: number): number {
  const d = curlDist(x, y);
  return stdLine(CURL_STONE_PTS, Math.max(0, cm(IN_HOUSE) - d), cm(IN_HOUSE - ON_BUTTON));
}

/**
 * curlRev 3's core line (re-fitted, 1 Nov 2026): full CURL_STONE_PTS while the stone touches the button (as before),
 * falling evenly to 0 at CORE_EDGE_V3 cm from the button (3.2 m: about 1.2 m past the house, where curlRev 1 and 2 hit
 * 0 at its edge), so a near miss scores a little. Fitted on the skill bands (docs/arcade-standard/curling.md).
 */
export const CORE_FULL_V3 = ON_BUTTON;
export const CORE_EDGE_V3 = 320;

/** Closeness points on a revision's line (curlRev 1 and 2: curlStonePoints; curlRev 3: the re-fitted line). */
export function curlStonePointsFor(rev: number, x: number, y: number): number {
  if (rev < 3) return curlStonePoints(x, y);
  const edge = rev >= 4 ? CORE_EDGE_V4 : CORE_EDGE_V3;
  const d = curlDist(x, y);
  return stdLine(CURL_STONE_PTS, Math.max(0, cm(edge) - d), cm(edge - CORE_FULL_V3));
}

/** curlRev 4's core line: full on the button, 0 at CORE_EDGE_V4 cm from it (1.2 m, about the 8-foot's edge: fitted on the skill bands). */
export const CORE_EDGE_V4 = 120;

/**
 * curlRev 4's count (curling's rule): stone i, at rest, counts when it is nearer the button than every opponent stone
 * in the house (touching counts as in). With no red in the house every stone counts.
 */
export function curlCounts(s: Pick<CurlingState, "x" | "y" | "live" | "team">, i: number): boolean {
  const d = curlDist(s.x[i]!, s.y[i]!);
  for (let j = 0; j < s.x.length; j++) {
    if (j === i || s.team[j] !== TEAM_THEIRS || !s.live[j] || !curlInHouse(s.x[j]!, s.y[j]!)) continue;
    if (curlDist(s.x[j]!, s.y[j]!) <= d) return false;
  }
  return true;
}

/** True when a stone at (x, y) is in the house (touching it counts). */
export function curlInHouse(x: number, y: number): boolean {
  return curlDist(x, y) <= cm(IN_HOUSE);
}

/**
 * The sheet's motion for one tick (mutates the stone arrays): substeps of travel and collisions, then each moving
 * stone's curl, slowing, stop and out-of-play checks. The sim and every script that searches throws
 * (scripts/curling-oracle.ts) move stones through this one function. Returns hits this tick and whether anything moves.
 */
/**
 * curlRev 2's brushing for one stone (index i): the carry meter (0…CARRY_MAX) and the bend meter (± BEND_MAX). Without
 * it (curlRev 1, or nobody brushing) the motion is curlRev 1's exactly.
 */
export interface CurlBrush {
  i: number;
  carry: number;
  bend: number;
}

export function curlMotionTick(s: Pick<CurlingState, "x" | "y" | "vx" | "vy" | "live" | "curl">, sweep: number, brush?: CurlBrush | null): { hits: number; moving: boolean } {
  const n = s.x.length;
  const reach = cm(STONE_R * 2);
  let hits = 0;
  const a = { x: 0, y: 0, vx: 0, vy: 0 };
  const b = { x: 0, y: 0, vx: 0, vy: 0 };
  for (let sub = 0; sub < SUB; sub++) {
    for (let i = 0; i < n; i++) {
      if (!s.live[i] || (s.vx[i] === 0 && s.vy[i] === 0)) continue;
      s.x[i] = s.x[i]! + idiv(s.vx[i]!, SUB);
      s.y[i] = s.y[i]! + idiv(s.vy[i]!, SUB);
    }
    for (let i = 0; i < n; i++) {
      if (!s.live[i]) continue;
      for (let j = i + 1; j < n; j++) {
        if (!s.live[j]) continue;
        if (s.vx[i] === 0 && s.vy[i] === 0 && s.vx[j] === 0 && s.vy[j] === 0) continue;
        const dx = s.x[j]! - s.x[i]!;
        const dy = s.y[j]! - s.y[i]!;
        if (dx > reach || dx < -reach || dy > reach || dy < -reach) continue;
        a.x = s.x[i]!; a.y = s.y[i]!; a.vx = s.vx[i]!; a.vy = s.vy[i]!;
        b.x = s.x[j]!; b.y = s.y[j]!; b.vx = s.vx[j]!; b.vy = s.vy[j]!;
        if (collideEqual(a, b, reach, CURL_E)) {
          if (a.vx !== s.vx[i] || a.vy !== s.vy[i]) hits++;
          s.x[i] = a.x; s.y[i] = a.y; s.vx[i] = a.vx; s.vy[i] = a.vy;
          s.x[j] = b.x; s.y[j] = b.y; s.vx[j] = b.vx; s.vy[j] = b.vy;
        }
      }
    }
  }
  const eff = Math.min(sweep, SWEEP_FULL);
  const decel = CURL_DECEL - idiv(CURL_DECEL * 3 * eff, SWEEP_FULL * 10);
  let moving = false;
  const edge = cm(SHEET_HALF_W - STONE_R);
  const back = cm(BACK_FAR - STONE_R);
  for (let i = 0; i < n; i++) {
    if (!s.live[i]) continue;
    let vx = s.vx[i]!;
    let vy = s.vy[i]!;
    if (vx === 0 && vy === 0) continue;
    const sp = ilen(vx, vy);
    if (s.curl[i]) {
      // Across the travel (right of it for an in-turn), stronger as the stone slows; sweeping halves it at full effect.
      let pull = idiv(CURL_A * CURL_VS, sp + CURL_VS);
      pull -= idiv(pull * eff, SWEEP_FULL * 2);
      const ox = vx;
      vx += idiv(-vy * pull * s.curl[i]!, sp);
      vy += idiv(ox * pull * s.curl[i]!, sp);
    }
    let slow = decel;
    if (brush && brush.i === i) {
      // curlRev 2: the brushed side pulls the stone across the sheet; the carry eases the slowing a little.
      const bend = clampInt(brush.bend, -BEND_FULL, BEND_FULL);
      vx += idiv(bend * BEND_A, BEND_FULL);
      slow = CURL_DECEL - idiv(CURL_DECEL * BRUSH_CARRY_PCT * Math.min(Math.max(0, brush.carry), SWEEP_FULL), SWEEP_FULL * 100);
    }
    const sp2 = ilen(vx, vy);
    const ns = sp2 - slow;
    if (ns <= CURL_STOP_V) {
      vx = 0;
      vy = 0;
    } else {
      vx = idiv(vx * ns, sp2);
      vy = idiv(vy * ns, sp2);
      moving = true;
    }
    s.vx[i] = vx;
    s.vy[i] = vy;
    if (s.x[i]! > edge || s.x[i]! < -edge || s.y[i]! < back) {
      s.live[i] = 0;
      s.vx[i] = 0;
      s.vy[i] = 0;
    }
  }
  return { hits, moving };
}

/** Judges the stone just thrown once everything has stopped (the hog line first). */
function settle(s: CurlingState): void {
  const i = s.active;
  if (s.live[i] && s.y[i]! > cm(HOG_FAR)) s.live[i] = 0;
  const inPlay = s.live[i] === 1;
  // A stone at rest has stopped turning: if it is struck later it slides straight.
  s.curl[i] = 0;
  // curlRev 4: only a stone nearer the button than every red in the house scores its closeness.
  s.pts.push(inPlay && (s.rev < 4 || curlCounts(s, i)) ? curlStonePointsFor(s.rev, s.x[i]!, s.y[i]!) : 0);
  s.four.push(inPlay && curlDist(s.x[i]!, s.y[i]!) <= cm(IN_FOUR_FOOT) ? 1 : 0);
  s.active = -1;
  s.sweep = 0;
  s.bend = 0;
  s.restTick = s.tick;
  if (s.thrown >= CURLING_STONES) {
    s.over = 1;
    s.phase = CURL_DONE;
  } else s.phase = CURL_AIM;
}

function copy(p: CurlingState): CurlingState {
  return { ...p, x: p.x.slice(), y: p.y.slice(), vx: p.vx.slice(), vy: p.vy.slice(), live: p.live.slice(), team: p.team, curl: p.curl.slice(), pts: p.pts.slice(), four: p.four.slice() };
}

function stepState(prev: CurlingState, input: ArcadeInputEvent | null): CurlingState {
  if (prev.over) return prev;
  const s = copy(prev);
  s.tick += 1;
  if (s.phase === CURL_AIM) {
    if (input && input.k === CURL_INPUT_THROW) {
      const weight = input.c >> 1;
      const turn = input.c & 1;
      const startX = s.rev >= 2 ? clampInt(Math.trunc(input.d), -CURL_START_MAX, CURL_START_MAX) : 0;
      const v = curlRelease(input.a, input.b, weight, startX, s.rev);
      s.x.push(startX * CU);
      s.y.push(HOG_NEAR * CU);
      s.vx.push(v.vx);
      s.vy.push(v.vy);
      s.team = [...s.team, TEAM_MINE];
      s.live.push(1);
      s.curl.push(turn === 0 ? 1 : -1);
      s.active = s.x.length - 1;
      s.thrown += 1;
      s.travelTicks = 0;
      s.sweep = 0;
      s.bend = 0;
      s.phase = CURL_TRAVEL;
      s.acted = 1;
    }
  } else if (s.phase === CURL_TRAVEL) {
    if (input && input.k === CURL_INPUT_SWEEP && s.live[s.active]) {
      const add = clampInt(input.a, 1, 100) * 3;
      s.sweep = Math.min(s.rev >= 2 ? CARRY_MAX : SWEEP_MAX, s.sweep + add);
      if (s.rev >= 2) s.bend = clampInt(s.bend + Math.sign(Math.trunc(input.b)) * add, -BEND_MAX, BEND_MAX);
      s.sweeps += 1;
    }
    s.travelTicks += 1;
    const r = s.rev >= 2 ? curlMotionTick(s, 0, { i: s.active, carry: s.sweep, bend: s.bend }) : curlMotionTick(s, s.sweep);
    s.sweep = Math.max(0, s.sweep - SWEEP_DECAY);
    if (s.bend > 0) s.bend = Math.max(0, s.bend - BEND_DECAY);
    else if (s.bend < 0) s.bend = Math.min(0, s.bend + BEND_DECAY);
    if (r.hits > 0) {
      s.hits += r.hits;
      s.hitTick = s.tick;
    }
    if (!r.moving || s.travelTicks >= CURL_TRAVEL_CAP) {
      for (let i = 0; i < s.x.length; i++) {
        s.vx[i] = 0;
        s.vy[i] = 0;
      }
      settle(s);
    }
  }
  if (!s.over && s.tick >= CURLING_RUN_TICKS) {
    // The buzzer: a stone still sliding is judged where it is.
    if (s.phase === CURL_TRAVEL) settle(s);
    s.over = 1;
    s.phase = CURL_DONE;
  }
  return s;
}

/* ================================= Score ================================= */

/** The opponent's stones out of the house now. */
export function curlTakeouts(s: CurlingState): number {
  let out = 0;
  for (let i = 0; i < s.theirs; i++) if (!s.live[i] || !curlInHouse(s.x[i]!, s.y[i]!)) out++;
  return out;
}

/** The team holding shot (the in-house stone nearest the button), or −1 with the house empty. */
export function curlShotTeam(s: CurlingState): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < s.x.length; i++) {
    if (!s.live[i] || !curlInHouse(s.x[i]!, s.y[i]!)) continue;
    const d = curlDist(s.x[i]!, s.y[i]!);
    if (d < bestD) {
      bestD = d;
      best = s.team[i]!;
    }
  }
  return best;
}

/** The standard's parts on curlRev 1, 2 and 3 (the same parts and maximums); null for any other revision. */
export function curlingStdParts(s: CurlingState): StdPart[] | null {
  if (s.rev !== CURLING_REV_V1 && s.rev !== CURLING_REV_V2 && s.rev !== CURLING_REV_V3 && s.rev !== CURLING_REV) return null;
  const core = s.pts.reduce((a, p) => a + p, 0);
  const onButton = s.pts.filter((p) => p === CURL_STONE_PTS).length;
  const out = curlTakeouts(s);
  const red = s.four.reduce((a, p) => a + p, 0);
  const holding = s.acted === 1 && curlShotTeam(s) === TEAM_MINE;
  const spec = s.rev >= 4 ? CURLING_STD_SPEC : s.rev >= 3 ? CURLING_STD_SPEC_V3 : CURLING_STD_SPEC_V2;
  const counted = s.pts.filter((p) => p > 0).length;
  if (s.rev >= 4)
    return [
      stdPart(spec, "core", stdLine(CURL_V4_CORE_MAX, core, CURL_V4_CORE_FULL), `${s.pts.length} thrown, ${counted} counting, ${onButton} on the button`),
      stdPart(spec, "takeouts", stdLine(CURL_V4_TAKEOUT_PTS, out, Math.max(1, s.theirs)), `${out} of ${s.theirs} out of the house`),
      stdPart(spec, "redring", stdLine(CURL_V4_RED_PTS, red, CURLING_STONES), `${red} in the 4-foot`),
      stdPart(spec, "hold", holding ? CURL_V4_HOLD_PTS : 0, holding ? "yours is shot stone" : "not holding shot"),
    ];
  return [
    stdPart(spec, "core", core, `${s.pts.length} thrown, ${onButton} on the button`),
    stdPart(spec, "takeouts", stdLine(CURL_TAKEOUT_PTS, out, Math.max(1, s.theirs)), `${out} of ${s.theirs} out of the house`),
    stdPart(spec, "redring", stdLine(CURL_RED_PTS, red, CURLING_STONES), `${red} in the 4-foot`),
    stdPart(spec, "hold", holding ? CURL_HOLD_PTS : 0, holding ? "yours is shot stone" : "not holding shot"),
  ];
}

export function curlingScore(s: CurlingState): number {
  const parts = curlingStdParts(s);
  if (!parts) return 0;
  return stdFinal(parts.reduce((a, p) => a + p.points, 0), s.acted === 1);
}

export function curlingCheckpoint(s: CurlingState): SportsCheckpoint & { thrown: number } {
  return {
    tick: s.tick,
    thrown: s.thrown,
    // curlRev 2 adds the bend meter (curlRev 1's checksum is unchanged).
    checksum: sumInts(s.rev >= 2 ? [s.tick, s.phase, s.thrown, s.active, s.sweep, ...s.x, ...s.y, ...s.vx, ...s.vy, ...s.live, ...s.pts, ...s.four, s.bend] : [s.tick, s.phase, s.thrown, s.active, s.sweep, ...s.x, ...s.y, ...s.vx, ...s.vy, ...s.live, ...s.pts, ...s.four]),
  };
}

const noDraw = (_ctx: CanvasRenderingContext2D, _s: CurlingState, _size: CanvasSize) => {};

/** The game for a stored curlRev (1–4; anything else plays curlRev 1; the default is the dealt stamp). */
export function curlingGameFor(rev: number | null | undefined = CURLING_REV): ArcadeGame<CurlingState, ArcadeInputEvent | null> {
  const r = rev === CURLING_REV || rev === CURLING_REV_V3 || rev === CURLING_REV_V2 ? rev : CURLING_REV_V1;
  return {
    key: "curling",
    runTicks: CURLING_RUN_TICKS,
    init: (seed: number) => initState(seed, r),
    step: stepState,
    isOver: (s) => s.over === 1,
    score: curlingScore,
    draw: noDraw,
    inputRanges: r >= 2 ? CURLING_INPUT_RANGES_V2 : CURLING_INPUT_RANGES,
  };
}

/* ======================= curlRev 3's preparation aids ======================= */
/*
 * Pure helpers the stage draws from (and the skill-band bot reads); they copy what they need and never write to a
 * state. Both slide the stone through curlMotionTick with no brushing, exactly as the sim moves an unswept stone.
 */

/**
 * Where an unswept stone thrown on an empty sheet comes to rest: its y (units; past the back line, where it left play).
 * A stone lost to a side board never reaches the house: Number.MAX_SAFE_INTEGER.
 */
export function curlRestY(startX: number, broomX: number, broomY: number, weight: number, turn: number, rev = CURLING_REV): number {
  const v = curlRelease(broomX, broomY, weight, startX, rev);
  const s = { x: [startX * CU], y: [HOG_NEAR * CU], vx: [v.vx], vy: [v.vy], live: [1], curl: [turn === 0 ? 1 : -1] };
  for (let t = 0; t < CURL_TRAVEL_CAP; t++) {
    if (!curlMotionTick(s, 0).moving || !s.live[0]) break;
  }
  if (!s.live[0] && s.y[0]! >= cm(BACK_FAR - STONE_R)) return Number.MAX_SAFE_INTEGER;
  return s.y[0]!;
}

/**
 * The weight meter's draw zone for a throw (curlRev 3, display only): the weights (1…1000) that bring an unswept stone
 * from this start, broom and turn to rest inside the house's depth (between its front and back edges, touching
 * counting) on an empty sheet, and the weight that stops it nearest the tee line. Null when no weight does.
 */
export function curlDrawZone(startX: number, broomX: number, broomY: number, turn: number, rev = CURLING_REV): { lo: number; hi: number; tee: number } | null {
  const y = (w: number) => curlRestY(startX, broomX, broomY, w, turn, rev);
  // The least weight whose stone comes to rest at or beyond `edge` (y falls as the weight grows).
  const least = (edge: number): number => {
    let lo = 1;
    let hi = CURL_WEIGHT_MAX;
    if (y(hi) > edge) return CURL_WEIGHT_MAX + 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (y(mid) <= edge) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  };
  const lo = least(cm(IN_HOUSE));
  const past = least(-cm(IN_HOUSE) - 1);
  if (lo > CURL_WEIGHT_MAX) return null;
  const hi = Math.min(CURL_WEIGHT_MAX, past - 1);
  if (hi < lo || Math.abs(y(lo)) > cm(IN_HOUSE) || Math.abs(y(hi)) > cm(IN_HOUSE)) return null;
  const t0 = Math.min(hi, Math.max(lo, least(0)));
  // The nearer of the two weights either side of the tee line.
  const tee = t0 > lo && Math.abs(y(t0 - 1)) < Math.abs(y(t0)) ? t0 - 1 : t0;
  return { lo, hi, tee };
}

/**
 * The aim line (curlRev 3, display only): the first third (by distance) of the path a throw at `weight` would slide,
 * stepped through curlMotionTick on a copy of the sheet's stones with no brushing; points in cm, from the near hog line.
 */
export function curlAimPath(s: Pick<CurlingState, "x" | "y" | "live" | "rev">, startX: number, broomX: number, broomY: number, weight: number, turn: number, part = 3): { x: number; y: number }[] {
  const v = curlRelease(broomX, broomY, weight, startX, s.rev);
  const n = s.x.length;
  const sheet = {
    x: [...s.x, startX * CU],
    y: [...s.y, HOG_NEAR * CU],
    vx: [...s.x.map(() => 0), v.vx],
    vy: [...s.x.map(() => 0), v.vy],
    live: [...s.live, 1],
    curl: [...s.x.map(() => 0), turn === 0 ? 1 : -1],
  };
  // In sheet units (integers) until the very end; the points come back in cm for drawing.
  const path: { x: number; y: number }[] = [{ x: startX * CU, y: HOG_NEAR * CU }];
  for (let t = 0; t < CURL_TRAVEL_CAP; t++) {
    const r = curlMotionTick(sheet, 0);
    if (!sheet.live[n]) break;
    path.push({ x: sheet.x[n]!, y: sheet.y[n]! });
    if (!r.moving || (sheet.vx[n] === 0 && sheet.vy[n] === 0)) break;
  }
  let total = 0;
  for (let k = 1; k < path.length; k++) total += ilen(path[k]!.x - path[k - 1]!.x, path[k]!.y - path[k - 1]!.y);
  const out = [path[0]!];
  let run = 0;
  for (let k = 1; k < path.length && run * part < total; k++) {
    run += ilen(path[k]!.x - path[k - 1]!.x, path[k]!.y - path[k - 1]!.y);
    out.push(path[k]!);
  }
  return out.map((p) => ({ x: p.x / CU, y: p.y / CU }));
}

/**
 * The phone's swipe → weight line (input only, never the sim's): a swipe up the lane at `pxPerMs` world px a ms gives
 * weight 1…1000 on a straight line from CURL_SWIPE_V0 (weight 0) to CURL_SWIPE_V0 + CURL_SWIPE_SPAN (1000). Every
 * revision uses it; on curlRev 3 the weight → speed line is gentler, so the same swipe error moves the stone less
 * (a draw to the tee is about 0.96 px a ms, the house's depth about ± 0.22 of it).
 */
export const CURL_SWIPE_V0 = 0.25;
export const CURL_SWIPE_SPAN = 2.25;
export function curlWeightFromSwipeV3(pxPerMs: number): number {
  return Math.max(1, Math.min(CURL_WEIGHT_MAX, Math.round(((pxPerMs - CURL_SWIPE_V0) / CURL_SWIPE_SPAN) * CURL_WEIGHT_MAX)));
}
/** The swipe speed (world px a ms) that gives a weight (the inverse of curlWeightFromSwipeV3). */
export function swipeForWeightV3(weight: number): number {
  return CURL_SWIPE_V0 + (weight / CURL_WEIGHT_MAX) * CURL_SWIPE_SPAN;
}
