/**
 * Mahjong Solitaire (`mahjong`, Cards & Board, 30 Oct 2026; docs/arcade-standard/mahjong.md): 72 tiles in a
 * four-layer stack, played for 120 s on the deterministic arcade engine.
 *
 * The layout is fixed (MAHJONG_SLOTS: 6 × 7, 4 × 5, 2 × 4 and 1 × 2); the faces are dealt in the sim from the room
 * seed by building the board backwards (`mahjongBuild`): from the full layout, two tiles that are free at that moment
 * are given the next pair's face and taken away, until none are left. Played forwards, that order clears the board,
 * so every deal is fully clearable; everyone in a room gets the identical board and nothing random happens after the
 * deal but a Shuffle, which is seeded too (the state carries its own PRNG, advanced only by a Shuffle).
 *
 * A tile is free when nothing lies on it and its left or right side is open. Tap two free tiles with the same face to
 * take them away (MAHJONG_INPUT_TAP, `a` the slot). Shuffle (MAHJONG_INPUT_SHUFFLE) re-deals the remaining faces onto
 * the remaining tiles by the same backwards build, so the board is clearable again (if no order of the remaining
 * places can be cleared at all, the tiles are first packed onto the lowest places of the layout, where one can).
 *
 * Score (the arcade scoring standard, `mahjongRev` 1): Pairs 150 (a straight line on the 36 pairs), No shuffles 20
 * (on the same line, only while no Shuffle has been used), Speed 30 (board cleared only: full by
 * MAHJONG_SPEED_FULL_TICKS, 0 at the buzzer); −5 a Shuffle. Together 200.
 *
 * Integer maths only; the state is never mutated.
 */
import { type ArcadeGame, type ArcadeInputEvent, type CanvasSize, inputRange, type InputRange, rngBelow, rngStep, TICKS_PER_SECOND, ARCADE_INPUT_BUTTON } from "./engine";
import { stdBandParts, stdFinal, stdLine, stdPart, stdSpeed, type StdPart, type StdSpec } from "./arcadeStandard";
import { bandCurve, type BandParts } from "./scoreBands";

export const MAHJONG_RUN_SECONDS = 120;
export const MAHJONG_RUN_TICKS = MAHJONG_RUN_SECONDS * TICKS_PER_SECOND;
export const MAHJONG_REV_STD = 1;

/* ================================ Layout ================================ */

/** One place in the stack, in half-tile units (a tile spans 2 × 2) and its layer. */
export interface MahjongSlot {
  x2: number;
  y2: number;
  z: number;
}

function layer(z: number, xs: number[], ys: number[]): MahjongSlot[] {
  const out: MahjongSlot[] = [];
  for (const y2 of ys) for (const x2 of xs) out.push({ x2, y2, z });
  return out;
}

/** The 72 places, bottom layer first, each layer row by row. */
export const MAHJONG_SLOTS: readonly MahjongSlot[] = [
  ...layer(0, [0, 2, 4, 6, 8, 10], [0, 2, 4, 6, 8, 10, 12]),
  ...layer(1, [2, 4, 6, 8], [2, 4, 6, 8, 10]),
  ...layer(2, [4, 6], [3, 5, 7, 9]),
  ...layer(3, [5], [5, 7]),
];
export const MAHJONG_TILES = MAHJONG_SLOTS.length;
export const MAHJONG_PAIRS = MAHJONG_TILES / 2;
export const MAHJONG_LAYERS = 4;

/** For each place: the places above it that cover it, and the places beside it on its left and right. */
const COVERERS: readonly (readonly number[])[] = MAHJONG_SLOTS.map((a) =>
  MAHJONG_SLOTS.flatMap((b, j) => (b.z === a.z + 1 && Math.abs(b.x2 - a.x2) < 2 && Math.abs(b.y2 - a.y2) < 2 ? [j] : [])),
);
const LEFTS: readonly (readonly number[])[] = MAHJONG_SLOTS.map((a) =>
  MAHJONG_SLOTS.flatMap((b, j) => (b.z === a.z && b.x2 === a.x2 - 2 && Math.abs(b.y2 - a.y2) < 2 ? [j] : [])),
);
const RIGHTS: readonly (readonly number[])[] = MAHJONG_SLOTS.map((a) =>
  MAHJONG_SLOTS.flatMap((b, j) => (b.z === a.z && b.x2 === a.x2 + 2 && Math.abs(b.y2 - a.y2) < 2 ? [j] : [])),
);

/** True when the place holds a tile with nothing on it and its left or right side open. */
export function mahjongFree(face: readonly number[], slot: number): boolean {
  if ((face[slot] ?? -1) < 0) return false;
  for (const c of COVERERS[slot]!) if (face[c]! >= 0) return false;
  let left = false;
  for (const l of LEFTS[slot]!) if (face[l]! >= 0) left = true;
  if (!left) return true;
  for (const r of RIGHTS[slot]!) if (face[r]! >= 0) return false;
  return true;
}

/* ================================ Faces ================================ */

/** 34 faces: dots 1–9 (0–8), bamboo 1–9 (9–17), characters 1–9 (18–26), winds E S W N (27–30), dragons red, green, white (31–33). */
export const MAHJONG_KINDS = 34;
/** Faces dealt four times (two pairs) and twice (one pair): 6 × 4 + 24 × 2 = 72. */
export const MAHJONG_QUADS = 6;
export const MAHJONG_DOUBLES = 24;

export function mahjongSuit(face: number): "dots" | "bamboo" | "chars" | "wind" | "dragon" {
  if (face < 9) return "dots";
  if (face < 18) return "bamboo";
  if (face < 27) return "chars";
  if (face < 31) return "wind";
  return "dragon";
}

/* ================================ The backwards build ================================ */

/**
 * Pairs of places (each pair free together at its turn) that clear `places` when taken in order, built by taking
 * two free places at random from the remaining ones; null after `tries` dead ends (one free place left).
 */
function buildOrder(places: readonly number[], rng: number, tries: number): { rng: number; order: [number, number][] } | null {
  let r = rng;
  for (let t = 0; t < tries; t++) {
    const face = new Array<number>(MAHJONG_TILES).fill(-1);
    for (const p of places) face[p] = 0;
    const order: [number, number][] = [];
    let left = places.length;
    let dead = false;
    while (left > 0) {
      const free: number[] = [];
      for (const p of places) if (face[p]! >= 0 && mahjongFree(face, p)) free.push(p);
      if (free.length < 2) {
        dead = true;
        break;
      }
      const a = rngBelow(r, free.length);
      const b = rngBelow(a.state, free.length - 1);
      r = b.state;
      const pa = free[a.value]!;
      const pb = free[b.value >= a.value ? b.value + 1 : b.value]!;
      face[pa] = -1;
      face[pb] = -1;
      order.push([pa, pb]);
      left -= 2;
    }
    if (!dead) return { rng: r, order };
  }
  return null;
}

/** Shuffles a list in place with the carried PRNG (Fisher–Yates); returns the advanced state. */
function shuffleList<T>(list: T[], rng: number): number {
  let r = rng;
  for (let i = list.length - 1; i > 0; i--) {
    const pick = rngBelow(r, i + 1);
    r = pick.state;
    const t = list[i]!;
    list[i] = list[pick.value]!;
    list[pick.value] = t;
  }
  return r;
}

function mixSeed(seed: number): number {
  let x = (seed | 0) ^ 0x6d61686a;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) | 0;
}

export interface MahjongDeal {
  /** Each place's face. */
  face: number[];
  /** The build's order (pairs of places), forwards: a clearing that is known to work. */
  order: [number, number][];
  rng: number;
}

/** Tries per build; the layout's builds rarely meet a dead end (mahjong-check counts them). */
export const MAHJONG_BUILD_TRIES = 200;

/** The seed's deal (the same on every device and the server). */
export function mahjongBuild(seed: number): MahjongDeal {
  let rng = mixSeed(seed);
  const kinds = Array.from({ length: MAHJONG_KINDS }, (_, i) => i);
  rng = shuffleList(kinds, rng);
  const pairs: number[] = [];
  for (let i = 0; i < MAHJONG_QUADS; i++) pairs.push(kinds[i]!, kinds[i]!);
  for (let i = MAHJONG_QUADS; i < MAHJONG_QUADS + MAHJONG_DOUBLES; i++) pairs.push(kinds[i]!);
  rng = shuffleList(pairs, rng);
  const places = MAHJONG_SLOTS.map((_, i) => i);
  const built = buildOrder(places, rng, MAHJONG_BUILD_TRIES) ?? buildOrder(places, mixSeed(0x5eed), 100_000)!;
  const face = new Array<number>(MAHJONG_TILES).fill(-1);
  built.order.forEach(([a, b], i) => {
    face[a] = pairs[i]!;
    face[b] = pairs[i]!;
  });
  return { face, order: built.order, rng: built.rng };
}

/** True when the seed's build order, played forwards through the real sim, clears every pair (the deal's proof). */
export function mahjongBuildClears(seed: number): boolean {
  const deal = mahjongBuild(seed);
  let s = mahjongGame.init(seed);
  let t = 0;
  for (const [a, b] of deal.order) {
    s = mahjongGame.step(s, { t: ++t, k: MAHJONG_INPUT_TAP, a, b: 0, c: 0, d: 0 });
    s = mahjongGame.step(s, { t: ++t, k: MAHJONG_INPUT_TAP, a: b, b: 0, c: 0, d: 0 });
  }
  return mahjongCleared(s) && s.shuffles === 0;
}

/** The lowest `count` places of the layout (bottom layer first): the Shuffle's fallback when no order clears the board as it stands. */
function packedPlaces(count: number): number[] {
  return MAHJONG_SLOTS.map((_, i) => i).slice(0, count);
}

/**
 * The Shuffle: the remaining faces re-dealt onto the remaining places by the backwards build, so the board can be
 * cleared again. Returns the new faces and the advanced PRNG.
 */
export function mahjongReshuffle(face: readonly number[], rng: number): { face: number[]; rng: number; packed: boolean; order: [number, number][] } {
  const places: number[] = [];
  const faces: number[] = [];
  face.forEach((f, i) => {
    if (f >= 0) {
      places.push(i);
      faces.push(f);
    }
  });
  if (places.length === 0) return { face: face.slice(), rng, packed: false, order: [] };
  faces.sort((a, b) => a - b);
  const pairs: number[] = [];
  for (let i = 0; i + 1 < faces.length; i += 2) pairs.push(faces[i]!);
  let r = shuffleList(pairs, rngStep(rng));
  let packed = false;
  let built = buildOrder(places, r, 60);
  if (!built) {
    packed = true;
    built = buildOrder(packedPlaces(places.length), r, 100_000)!;
  }
  r = built.rng;
  const out = new Array<number>(MAHJONG_TILES).fill(-1);
  built.order.forEach(([a, b], i) => {
    out[a] = pairs[i]!;
    out[b] = pairs[i]!;
  });
  return { face: out, rng: r, packed, order: built.order };
}

/** Matching pairs of free tiles on the board (0 = stuck: only a Shuffle helps). */
export function mahjongMoves(face: readonly number[]): [number, number][] {
  const free: number[] = [];
  for (let i = 0; i < MAHJONG_TILES; i++) if (mahjongFree(face, i)) free.push(i);
  const out: [number, number][] = [];
  for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) if (face[free[i]!] === face[free[j]!]) out.push([free[i]!, free[j]!]);
  return out;
}

/* ================================ Inputs ================================ */

export const MAHJONG_INPUT_TAP = 1;
export const MAHJONG_INPUT_SHUFFLE = ARCADE_INPUT_BUTTON;
export const MAHJONG_INPUT_RANGES: readonly InputRange[] = [inputRange(MAHJONG_INPUT_TAP, [0, MAHJONG_TILES - 1]), inputRange(MAHJONG_INPUT_SHUFFLE)];

/* ================================ World ================================ */

export const MAHJONG_WORLD_W = 390;
export const MAHJONG_TILE_W = 56;
export const MAHJONG_TILE_H = 74;
/** Each layer is drawn this far up and to the left of the one below (the stack's depth). */
export const MAHJONG_LIFT_X = 5;
export const MAHJONG_LIFT_Y = 6;
export const MAHJONG_HUD_H = 44;
export const MAHJONG_BOARD_W = 6 * MAHJONG_TILE_W;
export const MAHJONG_BOARD_H = 7 * MAHJONG_TILE_H;
export const MAHJONG_BOARD_X = Math.round((MAHJONG_WORLD_W - MAHJONG_BOARD_W) / 2) + 4;
export const MAHJONG_BOARD_Y = MAHJONG_HUD_H + 14 + 3 * MAHJONG_LIFT_Y;
export const MAHJONG_WORLD_H = MAHJONG_BOARD_Y + MAHJONG_BOARD_H + 14;

/** A place's tile face rectangle (top-left) in world units. */
export function mahjongSlotRect(slot: number): { x: number; y: number; w: number; h: number } {
  const s = MAHJONG_SLOTS[slot]!;
  return {
    x: MAHJONG_BOARD_X + (s.x2 * MAHJONG_TILE_W) / 2 - s.z * MAHJONG_LIFT_X,
    y: MAHJONG_BOARD_Y + (s.y2 * MAHJONG_TILE_H) / 2 - s.z * MAHJONG_LIFT_Y,
    w: MAHJONG_TILE_W,
    h: MAHJONG_TILE_H,
  };
}

/** The topmost tile under a world point, or −1. */
export function mahjongSlotAt(face: readonly number[], x: number, y: number): number {
  let best = -1;
  for (let i = 0; i < MAHJONG_TILES; i++) {
    if (face[i]! < 0) continue;
    const r = mahjongSlotRect(i);
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h && (best < 0 || MAHJONG_SLOTS[i]!.z >= MAHJONG_SLOTS[best]!.z)) best = i;
  }
  return best;
}

/* ================================ State ================================ */

export interface MahjongState {
  rev: number;
  tick: number;
  seed: number;
  /** Each place's face, −1 once taken away. */
  face: readonly number[];
  /** The selected tile, or −1. */
  sel: number;
  pairs: number;
  shuffles: number;
  /** Second taps on a free tile that did not match (the selection moves to it). */
  misses: number;
  /** Taps on a covered or hemmed-in tile. */
  blocked: number;
  /** The Shuffle's PRNG (advanced only by a Shuffle). */
  rng: number;
  clearedTick: number;
  /** For the renderer: the last pair taken and when, the last blocked tap, the last Shuffle. */
  lastA: number;
  lastB: number;
  lastPairTick: number;
  lastBlocked: number;
  lastBlockedTick: number;
  lastShuffleTick: number;
  acted: number;
}

function init(seed: number): MahjongState {
  const deal = mahjongBuild(seed);
  return {
    rev: MAHJONG_REV_STD,
    tick: 0,
    seed,
    face: deal.face,
    sel: -1,
    pairs: 0,
    shuffles: 0,
    misses: 0,
    blocked: 0,
    rng: deal.rng,
    clearedTick: 0,
    lastA: -1,
    lastB: -1,
    lastPairTick: 0,
    lastBlocked: -1,
    lastBlockedTick: 0,
    lastShuffleTick: 0,
    acted: 0,
  };
}

function applyTap(s: MahjongState, slot: number, tick: number): MahjongState {
  if (s.face[slot]! < 0) return s;
  if (!mahjongFree(s.face, slot)) return { ...s, blocked: s.blocked + 1, lastBlocked: slot, lastBlockedTick: tick };
  if (s.sel < 0 || s.face[s.sel]! < 0) return { ...s, sel: slot };
  if (s.sel === slot) return { ...s, sel: -1 };
  if (s.face[s.sel] !== s.face[slot]) return { ...s, sel: slot, misses: s.misses + 1 };
  const face = s.face.slice();
  face[s.sel] = -1;
  face[slot] = -1;
  const pairs = s.pairs + 1;
  return {
    ...s,
    face,
    sel: -1,
    pairs,
    clearedTick: pairs >= MAHJONG_PAIRS && s.clearedTick === 0 ? tick : s.clearedTick,
    lastA: s.sel,
    lastB: slot,
    lastPairTick: tick,
  };
}

function applyShuffle(s: MahjongState, tick: number): MahjongState {
  if (s.pairs >= MAHJONG_PAIRS) return s;
  const out = mahjongReshuffle(s.face, s.rng);
  return { ...s, face: out.face, rng: out.rng, sel: -1, shuffles: s.shuffles + 1, lastShuffleTick: tick };
}

function step(s: MahjongState, input: ArcadeInputEvent | null): MahjongState {
  if (isOver(s)) return s;
  const tick = s.tick + 1;
  let next: MahjongState = s;
  if (input) {
    if (input.k === MAHJONG_INPUT_TAP && input.a >= 0 && input.a < MAHJONG_TILES) next = applyTap(s, input.a, tick);
    else if (input.k === MAHJONG_INPUT_SHUFFLE) next = applyShuffle(s, tick);
    if (!next.acted) next = { ...next, acted: 1 };
  }
  return next === s ? { ...s, tick } : { ...next, tick };
}

export function mahjongCleared(s: Pick<MahjongState, "pairs">): boolean {
  return s.pairs >= MAHJONG_PAIRS;
}

function isOver(s: MahjongState): boolean {
  return mahjongCleared(s) || s.tick >= MAHJONG_RUN_TICKS;
}

/* ================================ Score ================================ */

export const MAHJONG_CORE_MAX = 150;
export const MAHJONG_CLEAN_MAX = 20;
export const MAHJONG_SPEED_MAX = 30;
export const MAHJONG_SHUFFLE_COST = 5;
/**
 * Speed is full for a board cleared within this many seconds and falls in a straight line to 0 at the buzzer. Set
 * from the near-perfect skill-band level's median clear time on the tuning seeds (docs/arcade-standard/mahjong.md).
 */
export const MAHJONG_SPEED_FULL_S = 65;
export const MAHJONG_SPEED_FULL_TICKS = MAHJONG_SPEED_FULL_S * TICKS_PER_SECOND;

/** The core's straight line for the help and LIVE_BANDS: pairs cleared → 150 at all 36. */
export const MAHJONG_V1_BAND_CURVE = bandCurve([0, MAHJONG_PAIRS], [0, MAHJONG_CORE_MAX]);

export const MAHJONG_STD_SPEC: StdSpec = {
  field: "mahjongRev",
  rev: MAHJONG_REV_STD,
  parts: [
    { key: "core", label: "Pairs", max: MAHJONG_CORE_MAX, item: "pair", how: `a share of the ${MAHJONG_PAIRS} pairs cleared` },
    { key: "clean", label: "No shuffles", max: MAHJONG_CLEAN_MAX, how: "the same share, while you have not shuffled" },
    { key: "speed", label: "Speed", max: MAHJONG_SPEED_MAX, how: `board cleared only: full by ${MAHJONG_SPEED_FULL_S} s, 0 at the buzzer` },
  ],
};

export function mahjongParts(s: MahjongState): { core: number; clean: number; speed: number; penalty: number; total: number } {
  const core = stdLine(MAHJONG_CORE_MAX, s.pairs, MAHJONG_PAIRS);
  const clean = s.shuffles === 0 ? stdLine(MAHJONG_CLEAN_MAX, s.pairs, MAHJONG_PAIRS) : 0;
  const speed = mahjongCleared(s) && s.clearedTick > 0 ? stdSpeed(MAHJONG_SPEED_MAX, s.clearedTick, MAHJONG_SPEED_FULL_TICKS, MAHJONG_RUN_TICKS) : 0;
  const penalty = MAHJONG_SHUFFLE_COST * s.shuffles;
  return { core, clean, speed, penalty, total: core + clean + speed - penalty };
}

export function mahjongScore(s: MahjongState): number {
  return stdFinal(mahjongParts(s).total, Boolean(s.acted));
}

const secs = (ticks: number) => `${(ticks / TICKS_PER_SECOND).toFixed(1)} s`;

/** The standard's parts list (the reveal's lines and arcade-standard-check). */
export function mahjongStdParts(state: unknown): StdPart[] | null {
  const s = state as Partial<MahjongState> | null;
  if (!s || s.rev !== MAHJONG_REV_STD || !Array.isArray(s.face)) return null;
  const st = s as MahjongState;
  const p = mahjongParts(st);
  return [
    stdPart(MAHJONG_STD_SPEC, "core", p.core, `${st.pairs} of ${MAHJONG_PAIRS} pairs`),
    stdPart(MAHJONG_STD_SPEC, "clean", p.clean, st.shuffles === 0 ? "no shuffle" : `${st.shuffles} ${st.shuffles === 1 ? "shuffle" : "shuffles"} (−${p.penalty})`),
    stdPart(MAHJONG_STD_SPEC, "speed", p.speed, mahjongCleared(st) ? `cleared in ${secs(st.clearedTick)}` : "not cleared"),
  ];
}

export function mahjongBandParts(s: MahjongState): BandParts {
  const p = mahjongParts(s);
  return stdBandParts(MAHJONG_STD_SPEC, { core: p.core, features: { clean: p.clean, speed: p.speed }, penalty: p.penalty }, s.pairs, `${s.pairs} of ${MAHJONG_PAIRS} pairs`, mahjongCleared(s), `${s.shuffles} shuffles`);
}

/* ================================ Checkpoints ================================ */

export const MAHJONG_CHECKPOINT_INTERVAL = 300;

export interface MahjongCheckpoint {
  tick: number;
  pairs: number;
  shuffles: number;
  checksum: number;
}

export function mahjongCheckpoint(s: MahjongState): MahjongCheckpoint {
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < MAHJONG_TILES; i++) h = Math.imul(h ^ (s.face[i]! + 2), 0x01000193);
  h = Math.imul(h ^ (s.sel + 2), 0x01000193);
  h = Math.imul(h ^ s.pairs, 0x01000193);
  h = Math.imul(h ^ s.tick, 0x01000193);
  return { tick: s.tick, pairs: s.pairs, shuffles: s.shuffles, checksum: h >>> 0 };
}

/* ================================ The game ================================ */

export const mahjongGame: ArcadeGame<MahjongState, ArcadeInputEvent | null> = {
  key: "mahjong",
  runTicks: MAHJONG_RUN_TICKS,
  init,
  step,
  isOver,
  score: mahjongScore,
  // The phone draws with mahjong.renderer.ts; the sim never draws.
  draw: (_ctx: CanvasRenderingContext2D, _state: MahjongState, _size: CanvasSize) => {},
  inputRanges: MAHJONG_INPUT_RANGES,
};

export function mahjongGameFor(_rev?: number | null): ArcadeGame<MahjongState, ArcadeInputEvent | null> {
  return mahjongGame;
}
