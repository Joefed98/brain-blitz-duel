/**
 * Cue Ball (`pool`, was Speed Pool; Sports group, 30 Oct 2026; docs/arcade-standard/pool.md): clear seven spots and
 * then the black in 120 s on a full-width table, top down. Drag on the table to turn the cue round the cue ball, pull
 * the cue back in the power meter and let go.
 *
 * poolRev 2 (31 Oct 2026, what rooms deal; its own bank, poolBankV2.server.ts): the shot's c is the power alone
 * (1…1000) and d the spin dot placed anywhere on the cue ball's face (poolSpin2Code: x side and y top/back, −100…100
 * each inside the safe circle); follow, draw and side scale continuously with the dot (POOL_V2_FOLLOW_MAX and
 * POOL_V2_SIDE_MAX at the edge, the same as poolRev 1's strongest), and each potted ball keeps its drop tick
 * (`downAt`, outside the checksum) so the art rolls it into the hole. Speed's full-by time is the revision's own
 * (poolFullByS). poolRev 1 (c = power × 25 + a 5 × 5 spin code) plays, scores and replays exactly as before.
 *
 * poolRev 3 (1 Nov 2026, Joe's tuning; its own bank, poolBankV3.server.ts): poolRev 2's input and rules with a harder
 * top speed (POOL_MAX_V_V3, +25 %), 1.75× the follow, draw and side (POOL_V3_FOLLOW_MAX, POOL_V3_SIDE_MAX) and one more
 * foul: a shot whose cue ball touches no ball at all (the first-ball and stripe fouls are as before, 10 each). Speed's
 * full-by time is its own (poolFullByS(3)). poolRev 1 and 2 play, score and replay exactly as before.
 *
 * poolRev 4 (3 Nov 2026; its own bank, poolBankV4.server.ts): poolRev 3's table, input and physics in 90 s
 * (POOL_RUN_S_V4), and the seed decides the player's set, spots or stripes (poolSetFor; the same for everyone in a room).
 * The sim keeps its ball ids (1–7 are the player's seven, 9–15 the other set): on a stripes deal the art and the words
 * swap them (poolShownId), so the player's seven are drawn as stripes 9–15 and the other four as spots. Fouls follow
 * the set (the other set hit first, or potted, or the black before the seven). Speed's full-by time is its own
 * (poolFullByS(4)). poolRev 1, 2 and 3 play, score and replay exactly as before.
 *
 * Deterministic (engine.ts): the seed deals the layout at init (no break: 7 spots, 4 stripes left as obstacles, the
 * black and the cue ball on a seeded spot at the baulk line) and nothing random happens after. Balls roll in 1/256 px
 * with integer friction, equal-mass collisions and cushions with angled jaws at the pockets; eight substeps a tick, so
 * nothing tunnels. Every layout rooms deal was cleared without a miss or a foul by the shot search
 * (scripts/pool-oracle.ts, the bank in src/lib/duel/poolBank.server.ts).
 *
 * Rules: pot the seven spots (1–7) in any order, then the black. A foul costs 10: the first ball hit is a stripe (or
 * the black while spots remain), or a stripe goes down (it stays down). The cue ball potted costs 5 s of the clock and
 * comes back on the first free seeded spot. The black potted early (or with the cue ball) ends the run with no black
 * or speed points. Spin: top or back (follow or draw after the first contact) and side (a cushion bounce bends).
 *
 * Scoring (poolRev 1 and 2, the arcade standard; arcadeStandard.ts): Spots up to 140 (20 a spot), Black 10 (after every
 * spot; ends the run), Pots in a row up to 30 (5 for each pot straight after another pot), Speed up to 20 (the black
 * potted: full by POOL_FULL_BY_S, 0 at the buzzer), less 10 a foul. Together 200; any shot scores at least 1, no
 * input 0.
 */
import { clampInt, fp, inputRange, isqrt, type ArcadeGame, type ArcadeInputEvent, type CanvasSize } from "./engine";
import { STD_MAX, stdEach, stdFinal, stdLine, stdPart, stdSpeed, type StdPart, type StdSpec } from "./arcadeStandard";
import { bounceSeg, collideEqual, idiv, ilen, rollFriction, sumInts, type Seg, type SportsCheckpoint } from "./sportsKit";

/* ================================ Constants ================================ */

/** The revision rooms deal: poolRev 4 (3 Nov 2026; a seeded set, spots or stripes, and 90 s). */
export const POOL_REV = 4;
/** poolRev 3 (1 Nov 2026; more power and spin, a miss is a foul): kept for stored rounds. */
export const POOL_REV_V3 = 3;
/** poolRev 2 (31 Oct 2026; the cue round the ball, the meter, spin anywhere on the face): kept for stored rounds. */
export const POOL_REV_V2 = 2;
/** The first revision (30 Oct 2026): its encoding, physics and bank are kept exactly for stored rounds. */
export const POOL_REV_V1 = 1;
/** A stored revision as the sim reads it: 3 or 2 as stored, else 1 (unstamped rounds were dealt as 1). */
export const poolRevOf = (rev?: number | null): number => (rev === 4 ? 4 : rev === 3 ? 3 : rev === 2 ? 2 : 1);
export const POOL_RUN_S = 120;
export const POOL_RUN_TICKS = POOL_RUN_S * 60;
/** poolRev 4's run: 90 s. */
export const POOL_RUN_S_V4 = 90;
export const POOL_RUN_TICKS_V4 = POOL_RUN_S_V4 * 60;
/** A revision's run length in ticks (scratches take their 5 s off it). */
export const poolRunTicksFor = (rev?: number | null): number => (poolRevOf(rev) >= 4 ? POOL_RUN_TICKS_V4 : POOL_RUN_TICKS);

/** The player's set: spots (POOL_SET_SPOTS) or stripes (POOL_SET_STRIPES). */
export const POOL_SET_SPOTS = 0;
export const POOL_SET_STRIPES = 1;
/** poolRev 4: the seed's set (a fixed hash of the seed: everyone in a room has the same). Earlier revisions: spots. */
export function poolSetFor(seed: number, rev?: number | null): number {
  if (poolRevOf(rev) < 4) return POOL_SET_SPOTS;
  let x = Math.imul((seed | 0) ^ 0x5e75_7b1e, 0x9e3779b1);
  x ^= x >>> 15;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  return (x >>> 7) & 1;
}
/** The ball a sim id is shown as for a set: on stripes the player's seven (1–7) are 9–15 and the other set's 9–15 are 1–7. */
export function poolShownId(id: number, set: number): number {
  if (set !== POOL_SET_STRIPES) return id;
  return id >= 1 && id <= 7 ? id + 8 : id >= 9 && id <= 15 ? id - 8 : id;
}
/** A set's name: "spots" or "stripes". */
export const poolSetName = (set: number): string => (set === POOL_SET_STRIPES ? "stripes" : "spots");

/** The world (world px): a HUD band on top, then the table (rails and cloth). */
export const POOL_W = 390;
export const POOL_H = 740;
/** The cloth (the cushion line), world px. */
export const POOL_CL = 32;
export const POOL_CR = 358;
export const POOL_CT = 58;
export const POOL_CB = 698;
export const POOL_MID_Y = (POOL_CT + POOL_CB) / 2;
/** The baulk line (a fifth of the table from the bottom cushion). */
export const POOL_BAULK_Y = POOL_CB - 128;
/** The rails' outer edge. */
export const POOL_RAIL = 24;

export const POOL_BALL_R = 8;
/** A shot's speed from the softest to the hardest pull (units a tick). */
export const POOL_MIN_V = fp(1);
export const POOL_MAX_V = fp(16);
/** poolRev 3: the hardest pull, 25 % faster (the softest is unchanged). */
export const POOL_MAX_V_V3 = fp(20);
/** The hardest pull's speed on a revision. */
export const poolMaxVFor = (rev: number): number => (rev >= 3 ? POOL_MAX_V_V3 : POOL_MAX_V);
/** Rolling friction: drag in 4096ths a tick and a constant slowing (units a tick). */
export const POOL_DRAG = 44;
export const POOL_DECEL = 4;
export const POOL_STOP_V = 10;
/** Restitution (256ths): cushions and jaws, ball on ball. */
export const POOL_E_CUSHION = 196;
export const POOL_E_BALL = 240;
/** A shot that has not settled by this many ticks is stopped where it is. */
export const POOL_SHOT_CAP = 900;
/** The cue ball potted: this many ticks come off the clock. */
export const POOL_SCRATCH_TICKS = 300;
const SUB = 8;

/** Input kind 1: a shot. a, b = the aim direction (any length); poolRev 1: c = power × 25 + spin (spin 0…24). */
export const POOL_INPUT_SHOT = 1;
export const POOL_POWER_MAX = 1000;
export const POOL_INPUT_RANGES = [inputRange(POOL_INPUT_SHOT, [-4096, 4096], [-4096, 4096], [25, POOL_POWER_MAX * 25 + 24])] as const;

/**
 * poolRev 2's spin: the dot anywhere on the cue ball's face, x (side, right +) and y (top +, back −) each −100…100,
 * held inside the safe circle of radius POOL_SPIN_SAFE (100 = the edge the tip may strike). Sent as one code in the
 * event's `d`: (x + 100) × 201 + (y + 100); c is the power (1…1000) alone.
 */
export const POOL_SPIN_SAFE = 100;
export const POOL_SPIN_SPAN = 2 * POOL_SPIN_SAFE + 1;
export const POOL_SPIN2_MAX = POOL_SPIN_SPAN * POOL_SPIN_SPAN - 1;
export const POOL_SPIN2_CENTRE = POOL_SPIN_SAFE * POOL_SPIN_SPAN + POOL_SPIN_SAFE;
export const POOL_INPUT_RANGES_V2 = [inputRange(POOL_INPUT_SHOT, [-4096, 4096], [-4096, 4096], [1, POOL_POWER_MAX], [0, POOL_SPIN2_MAX])] as const;
/** poolRev 2: follow or draw at the safe edge (256ths of the cue ball's pre-impact speed) and side's cushion bend there. */
export const POOL_V2_FOLLOW_MAX = 52;
export const POOL_V2_SIDE_MAX = 44;
/** poolRev 3: 1.75× poolRev 2's follow / draw and side at the safe edge. */
export const POOL_V3_FOLLOW_MAX = 91;
export const POOL_V3_SIDE_MAX = 77;

/** A spin point held inside the safe circle (integer maths: scaled back onto the edge when outside). */
export function poolSpinClamp(x: number, y: number): { x: number; y: number } {
  let sx = clampInt(Math.trunc(x), -POOL_SPIN_SAFE, POOL_SPIN_SAFE);
  let sy = clampInt(Math.trunc(y), -POOL_SPIN_SAFE, POOL_SPIN_SAFE);
  const lim = POOL_SPIN_SAFE * POOL_SPIN_SAFE;
  const d2 = sx * sx + sy * sy;
  if (d2 > lim) {
    const l = isqrt(d2);
    sx = Math.trunc((sx * POOL_SPIN_SAFE) / l);
    sy = Math.trunc((sy * POOL_SPIN_SAFE) / l);
    // isqrt rounds down, so the scaled point can sit a unit out: step the larger part in until it is inside.
    while (sx * sx + sy * sy > lim) {
      if (Math.abs(sx) >= Math.abs(sy)) sx -= Math.sign(sx);
      else sy -= Math.sign(sy);
    }
  }
  return { x: sx, y: sy };
}
/** poolRev 2's spin code (the event's d) for a dot at (x side, y top/back), held in the safe circle. */
export function poolSpin2Code(x: number, y: number): number {
  const p = poolSpinClamp(x, y);
  return (p.x + POOL_SPIN_SAFE) * POOL_SPIN_SPAN + (p.y + POOL_SPIN_SAFE);
}
/** The dot a poolRev 2 code stands for (any code in range; a point outside the circle is held on its edge). */
export function poolSpin2Of(code: number): { x: number; y: number } {
  const c = clampInt(Math.trunc(code), 0, POOL_SPIN2_MAX);
  return poolSpinClamp(Math.floor(c / POOL_SPIN_SPAN) - POOL_SPIN_SAFE, (c % POOL_SPIN_SPAN) - POOL_SPIN_SAFE);
}
/** A poolRev 2 shot's payload: c the power, d the spin code. */
export function poolShot2(power: number, spinX: number, spinY: number): { c: number; d: number } {
  return { c: clampInt(Math.trunc(power), 1, POOL_POWER_MAX), d: poolSpin2Code(spinX, spinY) };
}

/** The spin code for top/back and side (each −2…2): (topback + 2) × 5 + (side + 2). */
export function poolSpinCode(topBack: number, side: number): number {
  return (clampInt(topBack, -2, 2) + 2) * 5 + (clampInt(side, -2, 2) + 2);
}
export function poolSpinOf(code: number): { topBack: number; side: number } {
  const c = clampInt(code, 0, 24);
  return { topBack: Math.floor(c / 5) - 2, side: (c % 5) - 2 };
}
export function poolShotC(power: number, spin: number): number {
  return clampInt(Math.trunc(power), 1, POOL_POWER_MAX) * 25 + clampInt(spin, 0, 24);
}

export const POOL_AIM = 0;
export const POOL_ROLL = 1;
export const POOL_DONE = 2;

/** Ball ids: 0 the cue ball, 1–7 spots, 8 the black, 9–15 stripes. */
export const POOL_CUE = 0;
export const POOL_BLACK = 8;
export const poolIsSpot = (id: number) => id >= 1 && id <= 7;
export const poolIsStripe = (id: number) => id >= 9 && id <= 15;
export const POOL_SPOTS = 7;
export const POOL_STRIPES = 4;

/* ============================== The standard ============================== */

export const POOL_SPOT_PTS = 20;
export const POOL_BLACK_PTS = 10;
export const POOL_FOLLOW_PTS = 5;
export const POOL_STREAK_MAX = 30;
export const POOL_SPEED_PTS = 20;
export const POOL_FOUL_PTS = 10;
/**
 * Speed: full when the black goes down by this many seconds (the near-perfect skill-band median finish, measured with
 * scripts/arcade-skill-bands.ts pool --levels=near: 66.6 s over 30 bank layouts), 0 at the buzzer.
 */
export const POOL_FULL_BY_S = 67;
/** poolRev 2's full-by time: the near-perfect skill-band median finish on the poolRev 2 bank (57.6 s over 30 layouts, docs/arcade-standard/pool.md). */
export const POOL_FULL_BY_S_V2 = 58;
/** poolRev 3's full-by time: the near-perfect skill-band median finish on the poolRev 3 bank (72.9 s over 30 layouts, docs/arcade-standard/pool.md). */
export const POOL_FULL_BY_S_V3 = 73;
/** poolRev 4's full-by time: the near-perfect skill-band median finish on the poolRev 4 bank in 90 s (69.2 s over 30 layouts, docs/arcade-standard/pool.md). */
export const POOL_FULL_BY_S_V4 = 69;
/**
 * poolRev 4's core is full at five of your seven (28 a ball): in 90 s the middle levels pot fewer, and the 6th and 7th
 * still open the black, its speed and the run of pots (docs/arcade-standard/pool.md "poolRev 4"). Earlier revisions: 7.
 */
export const POOL_CORE_FULL_V4 = 5;
export const poolCoreFullFor = (rev: number): number => (rev >= 4 ? POOL_CORE_FULL_V4 : POOL_SPOTS);
export const poolFullByS = (rev: number): number => (rev >= 4 ? POOL_FULL_BY_S_V4 : rev >= 3 ? POOL_FULL_BY_S_V3 : rev === 2 ? POOL_FULL_BY_S_V2 : POOL_FULL_BY_S);

/** A revision's spec: the same parts on both; Speed's full-by time is the revision's own. */
export function poolStdSpecFor(rev?: number | null): StdSpec {
  const r = poolRevOf(rev);
  return {
    field: "poolRev",
    rev: r,
    parts: [
      r >= 4
        ? { key: "core", label: "Your balls", max: 140, of: POOL_CORE_FULL_V4, item: "ball", how: `${140 / POOL_CORE_FULL_V4} for each of your balls (spots or stripes) potted, all of it at ${POOL_CORE_FULL_V4} of your 7` }
        : { key: "core", label: "Spots", max: 140, of: POOL_SPOTS, item: "spot", how: `${POOL_SPOT_PTS} a spot potted` },
      { key: "black", label: "Black", max: POOL_BLACK_PTS, of: 1, item: "black", how: r >= 4 ? "pot the black after all seven of yours" : "pot the black after every spot" },
      { key: "streak", label: "Pots in a row", max: POOL_STREAK_MAX, of: 6, item: "pot", how: `${POOL_FOLLOW_PTS} for each pot straight after another` },
      { key: "speed", label: "Speed", max: POOL_SPEED_PTS, of: 1, item: "finish", how: `pot the black within ${poolFullByS(r)} s for all of it, falling to 0 at the buzzer` },
    ],
  };
}

/** The dealt revision's spec (poolRev 4). */
export const POOL_STD_SPEC: StdSpec = poolStdSpecFor(POOL_REV);

/* ================================ The table ================================ */

export interface PoolPocket {
  /** Capture centre and radius (units): a ball whose centre enters it drops. */
  x: number;
  y: number;
  r: number;
  corner: boolean;
}

const P = (x: number, y: number) => ({ x: fp(x), y: fp(y) });
const CL = POOL_CL;
const CR = POOL_CR;
const CT = POOL_CT;
const CB = POOL_CB;
const MY = POOL_MID_Y;
/** Corner cushions end this far along each side from the corner; middle pockets leave this half gap. */
const CORNER_GAP = 22;
const MID_GAP = 15;

export const POOL_POCKETS: readonly PoolPocket[] = [
  { ...P(CL - 4, CT - 4), r: fp(16), corner: true },
  { ...P(CR + 4, CT - 4), r: fp(16), corner: true },
  { ...P(CL - 7, MY), r: fp(14), corner: false },
  { ...P(CR + 7, MY), r: fp(14), corner: false },
  { ...P(CL - 4, CB + 4), r: fp(16), corner: true },
  { ...P(CR + 4, CB + 4), r: fp(16), corner: true },
];

const seg = (ax: number, ay: number, bx: number, by: number): Seg => ({ ax: fp(ax), ay: fp(ay), bx: fp(bx), by: fp(by), r: 0 });

/** The cushions (the cloth's edge between the pockets) and the jaws angled into each pocket. */
export const POOL_CUSHIONS: readonly Seg[] = [
  // Top and bottom cushions.
  seg(CL + CORNER_GAP, CT, CR - CORNER_GAP, CT),
  seg(CL + CORNER_GAP, CB, CR - CORNER_GAP, CB),
  // Side cushions, each split by its middle pocket.
  seg(CL, CT + CORNER_GAP, CL, MY - MID_GAP),
  seg(CL, MY + MID_GAP, CL, CB - CORNER_GAP),
  seg(CR, CT + CORNER_GAP, CR, MY - MID_GAP),
  seg(CR, MY + MID_GAP, CR, CB - CORNER_GAP),
];
export const POOL_JAWS: readonly Seg[] = [
  // Corner jaws: from each cushion end, angled out into the pocket.
  seg(CL + CORNER_GAP, CT, CL + CORNER_GAP - 12, CT - 14),
  seg(CL, CT + CORNER_GAP, CL - 14, CT + CORNER_GAP - 12),
  seg(CR - CORNER_GAP, CT, CR - CORNER_GAP + 12, CT - 14),
  seg(CR, CT + CORNER_GAP, CR + 14, CT + CORNER_GAP - 12),
  seg(CL + CORNER_GAP, CB, CL + CORNER_GAP - 12, CB + 14),
  seg(CL, CB - CORNER_GAP, CL - 14, CB - CORNER_GAP + 12),
  seg(CR - CORNER_GAP, CB, CR - CORNER_GAP + 12, CB + 14),
  seg(CR, CB - CORNER_GAP, CR + 14, CB - CORNER_GAP + 12),
  // Middle jaws: short and steep.
  seg(CL, MY - MID_GAP, CL - 10, MY - MID_GAP + 3),
  seg(CL, MY + MID_GAP, CL - 10, MY + MID_GAP - 3),
  seg(CR, MY - MID_GAP, CR + 10, MY - MID_GAP + 3),
  seg(CR, MY + MID_GAP, CR + 10, MY + MID_GAP - 3),
];
const ALL_SEGS: readonly Seg[] = [...POOL_CUSHIONS, ...POOL_JAWS];

/* ================================== Deal ================================== */

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

export interface PoolBall {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  down: number;
  /** poolRev 2 only (outside the checksum; the art reads it): the tick the ball dropped, to roll it into the hole. */
  downAt?: number;
}

export interface PoolLayout {
  balls: PoolBall[];
  /** The cue ball's seeded return spots (first free is used after a scratch), units. */
  cueSpots: { x: number; y: number }[];
}

const clearOf = (list: { x: number; y: number }[], x: number, y: number, gap: number) =>
  list.every((b) => (b.x - x) * (b.x - x) + (b.y - y) * (b.y - y) >= gap * gap);

/** The layout for a seed: 7 spots, 4 stripes and the black on the upper table, the cue ball on the baulk line. */
export function poolLayout(seed: number): PoolLayout {
  const rnd = dealRng(seed ^ 0x9001ba11);
  const R = POOL_BALL_R;
  const cueSpots: { x: number; y: number }[] = [];
  const baseX = CL + 50 + rnd(CR - CL - 100);
  cueSpots.push(P(baseX, POOL_BAULK_Y + 20));
  for (let i = 0; i < 5; i++) cueSpots.push(P(CL + 40 + rnd(CR - CL - 80), POOL_BAULK_Y + 10 + rnd(90)));
  const placed: { x: number; y: number }[] = [cueSpots[0]!];
  const pocketGap = fp(30);
  const free = (x: number, y: number) =>
    clearOf(placed, x, y, fp(2 * R + 6)) && POOL_POCKETS.every((p) => (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) >= pocketGap * pocketGap);
  const stripeIds = [9, 10, 11, 12, 13, 14, 15];
  // Four of the seven stripes, by the seed.
  for (let i = stripeIds.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [stripeIds[i], stripeIds[j]] = [stripeIds[j]!, stripeIds[i]!];
  }
  const ids = [1, 2, 3, 4, 5, 6, 7, POOL_BLACK, ...stripeIds.slice(0, POOL_STRIPES).sort((a, b) => a - b)];
  const balls: PoolBall[] = [{ id: POOL_CUE, ...cueSpots[0]!, vx: 0, vy: 0, down: 0 }];
  for (const id of ids) {
    for (let tries = 0; tries < 400; tries++) {
      const x = fp(CL + R + 6 + rnd(CR - CL - 2 * R - 12));
      const y = fp(CT + R + 6 + rnd(POOL_BAULK_Y - 30 - CT - R - 6));
      if (!free(x, y)) continue;
      placed.push({ x, y });
      balls.push({ id, x, y, vx: 0, vy: 0, down: 0 });
      break;
    }
  }
  return { balls, cueSpots };
}

/* ================================= State ================================= */

export interface PoolState {
  tick: number;
  rev: number;
  seed: number;
  /** poolRev 4: the player's set (POOL_SET_*; the seed's, display and words only: the sim's 1–7 are always the player's). */
  set?: number;
  cueSpots: { x: number; y: number }[];
  balls: PoolBall[];
  phase: number;
  /** Ticks taken off the clock by scratches; the run ends when tick + lost reaches the run. */
  lost: number;
  shots: number;
  shotTicks: number;
  /** The shot in play: the first ball the cue ball touched (−1 none), its spin and whether the spin's follow/draw applied. */
  firstHit: number;
  topBack: number;
  side: number;
  sideLeft: number;
  /** Spots, stripes and the cue ball down this shot; the black down this shot (1/0). */
  shotSpots: number;
  shotStripes: number;
  shotCue: number;
  shotBlack: number;
  spotsDown: number;
  fouls: number;
  /** Consecutive legal pots, the pots that came straight after another, and the best run. */
  streak: number;
  follows: number;
  streakBest: number;
  /** 1 once the black is potted after every spot (legal); 2 when it went down early. */
  black: number;
  /** The clock (tick + lost) the black went down legally; 0 until then. */
  finishAt: number;
  acted: number;
  over: number;
  /** Effects (display only reads these): counts that rise on each event, and the last event's tick. */
  pots: number;
  potTick: number;
  foulTick: number;
  scratches: number;
  scratchTick: number;
  hits: number;
  hitTick: number;
  cushionTick: number;
}

function cloneBalls(balls: readonly PoolBall[]): PoolBall[] {
  return balls.map((b) => ({ ...b }));
}

function initState(seed: number, rev: number, set?: number): PoolState {
  const layout = poolLayout(seed);
  return {
    tick: 0,
    rev,
    seed,
    ...(rev >= 4 ? { set: set ?? poolSetFor(seed, rev) } : {}),
    cueSpots: layout.cueSpots,
    balls: layout.balls,
    phase: POOL_AIM,
    lost: 0,
    shots: 0,
    shotTicks: 0,
    firstHit: -1,
    topBack: 0,
    side: 0,
    sideLeft: 0,
    shotSpots: 0,
    shotStripes: 0,
    shotCue: 0,
    shotBlack: 0,
    spotsDown: 0,
    fouls: 0,
    streak: 0,
    follows: 0,
    streakBest: 0,
    black: 0,
    finishAt: 0,
    acted: 0,
    over: 0,
    pots: 0,
    potTick: 0,
    foulTick: 0,
    scratches: 0,
    scratchTick: 0,
    hits: 0,
    hitTick: 0,
    cushionTick: 0,
  };
}

/** A shot's velocity for an aim direction and a power (units a tick); poolRev 3's hardest pull is POOL_MAX_V_V3. */
export function poolShotVelocity(dx: number, dy: number, power: number, rev = 1): { vx: number; vy: number } {
  const p = clampInt(Math.trunc(power), 1, POOL_POWER_MAX);
  const speed = POOL_MIN_V + idiv((poolMaxVFor(rev) - POOL_MIN_V) * p, POOL_POWER_MAX);
  const l = ilen(dx, dy);
  if (l <= 0) return { vx: 0, vy: -speed };
  return { vx: idiv(dx * speed, l), vy: idiv(dy * speed, l) };
}

/** What happened during one rolling tick (the oracle and the sim both read it). */
export interface PoolTickEvents {
  /** Ball ids that dropped this tick. */
  dropped: number[];
  /** The first ball the cue ball touched this tick (−1 none). */
  firstHit: number;
  ballHits: number;
  cushionHits: number;
  /** Every ball at rest after this tick. */
  still: boolean;
}

/** The shot in play's spin, carried through the roll (mutated by poolRollTick). */
export interface PoolSpin {
  firstHit: number;
  /** poolRev 1: −2…2 each; poolRev 2 (`fine`): the dot's y and x, −100…100 each. */
  topBack: number;
  side: number;
  sideLeft: number;
  /** 1 on poolRev 2 and 3: topBack and side are continuous (−100…100). */
  fine?: number;
  /** poolRev 3: the stronger follow / draw and side (POOL_V3_*). */
  strong?: number;
}

/**
 * One tick of the balls rolling (mutates `balls` and `spin`): eight substeps of movement, ball-on-ball, cushions and
 * jaws and the pockets, then the friction. The sim and every script that searches shots (scripts/pool-oracle.ts) roll
 * through this one function.
 */
export function poolRollTick(balls: PoolBall[], spin: PoolSpin, shotTicks: number): PoolTickEvents {
  const out: PoolTickEvents = { dropped: [], firstHit: -1, ballHits: 0, cushionHits: 0, still: false };
  const R = fp(POOL_BALL_R);
  const reach = 2 * R;
  const n = balls.length;
  for (let sub = 0; sub < SUB; sub++) {
    for (const b of balls) {
      if (b.down || (b.vx === 0 && b.vy === 0)) continue;
      b.x += idiv(b.vx, SUB);
      b.y += idiv(b.vy, SUB);
    }
    for (let i = 0; i < n; i++) {
      const a = balls[i]!;
      if (a.down) continue;
      for (let j = i + 1; j < n; j++) {
        const b = balls[j]!;
        if (b.down) continue;
        if (a.vx === 0 && a.vy === 0 && b.vx === 0 && b.vy === 0) continue;
        const cueA = a.id === POOL_CUE;
        const cueB = b.id === POOL_CUE;
        const pre = cueA || cueB ? (cueA ? { vx: a.vx, vy: a.vy } : { vx: b.vx, vy: b.vy }) : null;
        if (!collideEqual(a, b, reach, POOL_E_BALL)) continue;
        out.ballHits++;
        if (pre && spin.firstHit < 0) {
          const other = cueA ? b : a;
          const cue = cueA ? a : b;
          spin.firstHit = other.id;
          out.firstHit = other.id;
          // Follow or draw: the cue ball takes on a share of its pre-impact speed along the shot's line.
          if (spin.topBack !== 0 && spin.fine) {
            // poolRev 2: in proportion to the dot's height, POOL_V2_FOLLOW_MAX at the safe edge.
            const follow = spin.strong ? POOL_V3_FOLLOW_MAX : POOL_V2_FOLLOW_MAX;
            cue.vx += idiv(pre.vx * spin.topBack * follow, 256 * POOL_SPIN_SAFE);
            cue.vy += idiv(pre.vy * spin.topBack * follow, 256 * POOL_SPIN_SAFE);
          } else if (spin.topBack !== 0) {
            cue.vx += idiv(pre.vx * spin.topBack * 26, 256);
            cue.vy += idiv(pre.vy * spin.topBack * 26, 256);
          }
        }
      }
    }
    for (const b of balls) {
      if (b.down) continue;
      for (const s of ALL_SEGS) {
        const hit = bounceSeg(b, s, R, POOL_E_CUSHION);
        if (!hit) continue;
        b.x = hit.x;
        b.y = hit.y;
        b.vx = hit.vx;
        b.vy = hit.vy;
        if (hit.impact > 30) {
          out.cushionHits++;
          // Side: the cue ball's first two cushions after the shot bend by the side it carries.
          if (b.id === POOL_CUE && spin.side !== 0 && spin.sideLeft > 0) {
            spin.sideLeft -= 1;
            const k = spin.fine ? idiv(spin.side * (spin.strong ? POOL_V3_SIDE_MAX : POOL_V2_SIDE_MAX), POOL_SPIN_SAFE) : spin.side * 22;
            const vx = b.vx;
            b.vx += idiv(-b.vy * k, 256);
            b.vy += idiv(vx * k, 256);
          }
        }
      }
      for (const p of POOL_POCKETS) {
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        if (dx * dx + dy * dy < p.r * p.r) {
          b.down = 1;
          b.vx = 0;
          b.vy = 0;
          out.dropped.push(b.id);
          break;
        }
      }
      // A ball that got past every cushion is in a pocket's mouth: it drops.
      if (!b.down && (b.x < fp(CL - 10) || b.x > fp(CR + 10) || b.y < fp(CT - 10) || b.y > fp(CB + 10))) {
        b.down = 1;
        b.vx = 0;
        b.vy = 0;
        out.dropped.push(b.id);
      }
    }
  }
  let moving = 0;
  for (const b of balls) {
    if (b.down || (b.vx === 0 && b.vy === 0)) continue;
    const f = rollFriction(b.vx, b.vy, POOL_DRAG, POOL_DECEL);
    if (ilen(f.vx, f.vy) <= POOL_STOP_V || shotTicks >= POOL_SHOT_CAP) {
      b.vx = 0;
      b.vy = 0;
    } else {
      b.vx = f.vx;
      b.vy = f.vy;
      moving++;
    }
  }
  out.still = moving === 0;
  return out;
}

/** The first free cue spot (seeded list; the last one nudged sideways until free). */
function cueReturn(s: PoolState): { x: number; y: number } {
  const live = s.balls.filter((b) => !b.down && b.id !== POOL_CUE);
  const gap = fp(2 * POOL_BALL_R + 2);
  for (const p of s.cueSpots) if (clearOf(live, p.x, p.y, gap)) return p;
  const last = s.cueSpots[s.cueSpots.length - 1]!;
  for (let dx = 0; dx < 300; dx += 4)
    for (const sign of [1, -1]) {
      const x = clampInt(last.x + fp(dx * sign), fp(CL + POOL_BALL_R + 2), fp(CR - POOL_BALL_R - 2));
      if (clearOf(live, x, last.y, gap)) return { x, y: last.y };
    }
  return last;
}

/** Settles a shot once every ball is still: fouls, the streak, a scratch's return, the black. */
function resolveShot(s: PoolState): void {
  const spotsBefore = POOL_SPOTS - (s.spotsDown - s.shotSpots);
  // poolRev 3: a shot that touches no ball at all is a foul too.
  const missed = s.rev >= 3 && s.firstHit < 0;
  const foul = (s.firstHit >= 0 && (poolIsStripe(s.firstHit) || (s.firstHit === POOL_BLACK && spotsBefore > 0))) || s.shotStripes > 0 || missed;
  if (foul) {
    s.fouls += 1;
    s.foulTick = s.tick;
  }
  let legal = s.shotSpots;
  if (s.shotBlack) {
    if (spotsBefore === 0 && !s.shotCue && !foul) {
      s.black = 1;
      s.finishAt = s.tick + s.lost;
      legal += 1;
    } else s.black = 2;
  }
  if (legal > 0 && !foul) {
    for (let i = 0; i < legal; i++) {
      if (s.streak > 0) s.follows += 1;
      s.streak += 1;
    }
    s.streakBest = Math.max(s.streakBest, s.streak);
  }
  if (legal === 0 || foul || s.shotCue) s.streak = 0;
  if (s.shotCue) {
    s.scratches += 1;
    s.scratchTick = s.tick;
    s.lost += POOL_SCRATCH_TICKS;
    const cue = s.balls.find((b) => b.id === POOL_CUE)!;
    const at = cueReturn(s);
    cue.x = at.x;
    cue.y = at.y;
    cue.vx = 0;
    cue.vy = 0;
    cue.down = 0;
    delete cue.downAt;
  }
  s.phase = POOL_AIM;
  if (s.black) {
    s.over = 1;
    s.phase = POOL_DONE;
  }
}

function stepState(prev: PoolState, input: ArcadeInputEvent | null): PoolState {
  if (prev.over) return prev;
  const s: PoolState = { ...prev };
  s.tick += 1;
  if (s.phase === POOL_AIM) {
    if (input && input.k === POOL_INPUT_SHOT && (input.a !== 0 || input.b !== 0)) {
      const fine = s.rev >= 2;
      const power = fine ? input.c : Math.floor(input.c / 25);
      const dot = fine ? poolSpin2Of(input.d) : null;
      const spin = dot ? { topBack: dot.y, side: dot.x } : poolSpinOf(input.c % 25);
      s.balls = cloneBalls(s.balls);
      const cue = s.balls.find((b) => b.id === POOL_CUE)!;
      const v = poolShotVelocity(input.a, input.b, power, s.rev);
      cue.vx = v.vx;
      cue.vy = v.vy;
      s.phase = POOL_ROLL;
      s.shots += 1;
      s.shotTicks = 0;
      s.firstHit = -1;
      s.topBack = spin.topBack;
      s.side = spin.side;
      s.sideLeft = spin.side !== 0 ? 2 : 0;
      s.shotSpots = 0;
      s.shotStripes = 0;
      s.shotCue = 0;
      s.shotBlack = 0;
      s.acted = 1;
    }
  } else if (s.phase === POOL_ROLL) {
    s.balls = cloneBalls(s.balls);
    s.shotTicks += 1;
    const spin: PoolSpin = { firstHit: s.firstHit, topBack: s.topBack, side: s.side, sideLeft: s.sideLeft };
    if (s.rev >= 2) spin.fine = 1;
    if (s.rev >= 3) spin.strong = 1;
    const ev = poolRollTick(s.balls, spin, s.shotTicks);
    s.firstHit = spin.firstHit;
    s.sideLeft = spin.sideLeft;
    if (ev.ballHits > 0) {
      s.hits += 1;
      s.hitTick = s.tick;
    }
    if (ev.cushionHits > 0) s.cushionTick = s.tick;
    for (const id of ev.dropped) {
      if (s.rev >= 2) s.balls.find((b) => b.id === id)!.downAt = s.tick;
      if (id === POOL_CUE) s.shotCue = 1;
      else if (id === POOL_BLACK) s.shotBlack = 1;
      else if (poolIsSpot(id)) {
        s.shotSpots += 1;
        s.spotsDown += 1;
      } else s.shotStripes += 1;
      if (id !== POOL_CUE) {
        s.pots += 1;
        s.potTick = s.tick;
      }
    }
    if (ev.still) resolveShot(s);
  }
  if (!s.over && s.tick + s.lost >= poolRunTicksFor(s.rev)) {
    s.over = 1;
    s.phase = POOL_DONE;
  }
  return s;
}

/* ================================= Score ================================= */

/** Each part of a state, the core first (fouls are the penalty, outside the parts). */
export function poolStdParts(s: PoolState): StdPart[] | null {
  if (s.rev !== 1 && s.rev !== 2 && s.rev !== 3 && s.rev !== 4) return null;
  const spec = poolStdSpecFor(s.rev);
  const legal = s.black === 1;
  const speed = legal ? stdSpeed(POOL_SPEED_PTS, s.finishAt, poolFullByS(s.rev) * 60, poolRunTicksFor(s.rev)) : 0;
  const balls = s.rev >= 4 ? poolSetName(s.set ?? POOL_SET_SPOTS) : "spots";
  return [
    stdPart(spec, "core", stdLine(140, s.spotsDown, poolCoreFullFor(s.rev)), `${s.spotsDown} of ${POOL_SPOTS} ${balls}`),
    stdPart(spec, "black", legal ? POOL_BLACK_PTS : 0, legal ? "potted last" : s.black === 2 ? "potted too soon" : "still up"),
    stdPart(spec, "streak", stdEach(s.follows, POOL_FOLLOW_PTS, POOL_STREAK_MAX), `${s.follows} after another pot (best run ${s.streakBest})`),
    stdPart(spec, "speed", speed, legal ? `cleared in ${Math.round(s.finishAt / 6) / 10} s` : "not cleared"),
  ];
}

/** Fouls' cost (positive). */
export function poolPenalty(s: PoolState): number {
  return s.fouls * POOL_FOUL_PTS;
}

export function poolScore(s: PoolState): number {
  const parts = poolStdParts(s);
  if (!parts) return 0;
  return stdFinal(parts.reduce((a, p) => a + p.points, 0) - poolPenalty(s), s.acted === 1);
}

export function poolCheckpoint(s: PoolState): SportsCheckpoint & { spots: number; fouls: number } {
  const ints: number[] = [s.tick, s.phase, s.lost, s.shots, s.spotsDown, s.fouls, s.follows, s.black];
  for (const b of s.balls) ints.push(b.id, b.x, b.y, b.vx, b.vy, b.down);
  return { tick: s.tick, spots: s.spotsDown, fouls: s.fouls, checksum: sumInts(ints) };
}

/** Seconds left on the run's clock (scratches included). */
export function poolSecondsLeft(s: PoolState): number {
  return Math.max(0, Math.ceil((poolRunTicksFor(s.rev) - s.tick - s.lost) / 60));
}

const noDraw = (_ctx: CanvasRenderingContext2D, _s: PoolState, _size: CanvasSize) => {};

/**
 * The game for a stored revision: poolRev 4 as rooms deal it today, 3 and 2 as stored; 1 or unstamped plays poolRev 1
 * exactly. `set` (checks only) deals a poolRev 4 table with the other set than its seed's: the sim plays it identically.
 */
export function poolGameFor(rev?: number | null, set?: number): ArcadeGame<PoolState, ArcadeInputEvent | null> {
  const r = poolRevOf(rev);
  return {
    key: "pool",
    runTicks: poolRunTicksFor(r),
    init: (seed: number) => initState(seed, r, set),
    step: stepState,
    isOver: (s) => s.over === 1,
    score: poolScore,
    draw: noDraw,
    inputRanges: r >= 2 ? POOL_INPUT_RANGES_V2 : POOL_INPUT_RANGES,
  };
}

export { STD_MAX as POOL_MAX };
