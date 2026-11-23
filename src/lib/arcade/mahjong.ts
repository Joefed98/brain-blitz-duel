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
 * mahjongRev 2 (31 Oct 2026, Joe's notes; docs/arcade-standard/mahjong.md): the same deal and score, plus Undo and Reset,
 * two more button presses in the move log (MAHJONG_INPUT_BUTTON with `a` MAHJONG_BUTTON_UNDO / MAHJONG_BUTTON_RESET;
 * on rev 1 every button press is a Shuffle, its `a` clamped to 0). Undo is free and unlimited: it puts back the board
 * as it was before the last pair taken or the last Shuffle (a Shuffle undone still counts). Reset puts back the
 * original deal (no undo history after it); Shuffles already used still count. The clock runs on through both.
 *
 * Integer maths only; the state is never mutated.
 */
import { type ArcadeGame, type ArcadeInputEvent, type CanvasSize, inputRange, type InputRange, rngBelow, rngStep, TICKS_PER_SECOND, ARCADE_INPUT_BUTTON } from "./engine";
import { stdBandParts, stdFinal, stdLine, stdPart, stdSpeed, type StdPart, type StdSpec } from "./arcadeStandard";
import { bandCurve, type BandParts } from "./scoreBands";

export const MAHJONG_RUN_SECONDS = 120;
export const MAHJONG_RUN_TICKS = MAHJONG_RUN_SECONDS * TICKS_PER_SECOND;
export const MAHJONG_REV_STD = 1;
/** Undo and Reset (31 Oct 2026); the revision rooms deal. */
export const MAHJONG_REV_UNDO = 2;
export const MAHJONG_REV_DEALT = MAHJONG_REV_UNDO;
/**
 * mahjongRev 3 (D6, 23 Nov 2026; level deals only, Normal stays mahjongRev 2): D6's levels, MAHJONG_LEVEL_RULES_V3 (the
 * lever is tiles in the stack: 48 / 72 / 104 / 136) on three new layouts, each told by its length as the others are.
 */
export const MAHJONG_REV_LEVELS = 3;

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

/**
 * A layout: its places and, for each, the places above it that cover it and the places beside it on its left and right.
 * Normal and Hard play MAHJONG_SLOTS (72); the difficulty levels (15 Nov 2026) add Easy's 56 in three layers and
 * Expert's 88 in five, on the same 6 × 7 footprint so the world and the table are unchanged. A board's layout is told by
 * its length (56, 72 or 88 places), so every rule below reads the face list alone.
 */
export interface MahjongLayout {
  slots: readonly MahjongSlot[];
  tiles: number;
  pairs: number;
  layers: number;
  coverers: readonly (readonly number[])[];
  lefts: readonly (readonly number[])[];
  rights: readonly (readonly number[])[];
  /** D6's bigger stacks: their own tile size and board corner in world units (the others use MAHJONG_TILE_W …). */
  tileW?: number;
  tileH?: number;
  boardX?: number;
  boardY?: number;
}

function makeLayout(slots: readonly MahjongSlot[], size?: { tileW: number; tileH: number; cols: number }): MahjongLayout {
  return {
    ...(size ? { tileW: size.tileW, tileH: size.tileH, boardX: Math.round((356 - size.cols * size.tileW) / 2), boardY: 44 + 14 + 3 * 6 } : {}),
    slots,
    tiles: slots.length,
    pairs: slots.length / 2,
    layers: 1 + Math.max(...slots.map((s) => s.z)),
    coverers: slots.map((a) => slots.flatMap((b, j) => (b.z === a.z + 1 && Math.abs(b.x2 - a.x2) < 2 && Math.abs(b.y2 - a.y2) < 2 ? [j] : []))),
    lefts: slots.map((a) => slots.flatMap((b, j) => (b.z === a.z && b.x2 === a.x2 - 2 && Math.abs(b.y2 - a.y2) < 2 ? [j] : []))),
    rights: slots.map((a) => slots.flatMap((b, j) => (b.z === a.z && b.x2 === a.x2 + 2 && Math.abs(b.y2 - a.y2) < 2 ? [j] : []))),
  };
}

export const MAHJONG_LAYOUT: MahjongLayout = makeLayout(MAHJONG_SLOTS);
/** Easy: 56 places in three layers (6 × 7, 3 × 4 on the gaps, 1 × 2). */
export const MAHJONG_LAYOUT_EASY: MahjongLayout = makeLayout([
  ...layer(0, [0, 2, 4, 6, 8, 10], [0, 2, 4, 6, 8, 10, 12]),
  ...layer(1, [3, 5, 7], [3, 5, 7, 9]),
  ...layer(2, [5], [5, 7]),
]);
/** Expert: 88 places in five layers (6 × 7, 5 × 6 on the gaps, 2 × 5, 2 × 2, 1 × 2). */
export const MAHJONG_LAYOUT_EXPERT: MahjongLayout = makeLayout([
  ...layer(0, [0, 2, 4, 6, 8, 10], [0, 2, 4, 6, 8, 10, 12]),
  ...layer(1, [1, 3, 5, 7, 9], [1, 3, 5, 7, 9, 11]),
  ...layer(2, [4, 6], [2, 4, 6, 8, 10]),
  ...layer(3, [4, 6], [5, 7]),
  ...layer(4, [5], [5, 7]),
]);

/*
 * D6's stacks (mahjongRev 3, 23 Nov 2026). Easy: 48 places in two layers (the 6 × 7 base, a 2 × 3 cap on its gaps).
 * Hard: 104 in four layers on a 7 × 8 footprint of 48 × 63 tiles (7 × 8, 6 × 5 on the gaps, 4 × 3, 3 × 2). Expert: 136
 * in four layers on an 8 × 9 footprint of 42 × 55 tiles (8 × 9, 7 × 6 on the gaps, 4 × 4, 3 × 2). The same 356-wide
 * world: the board is the footprint centred (7 × 48 and 8 × 42 are both 336 wide).
 */
export const MAHJONG_LAYOUT_48: MahjongLayout = makeLayout([
  ...layer(0, [0, 2, 4, 6, 8, 10], [0, 2, 4, 6, 8, 10, 12]),
  ...layer(1, [3, 5, 7], [5, 7]),
]);
export const MAHJONG_LAYOUT_104: MahjongLayout = makeLayout(
  [
    ...layer(0, [0, 2, 4, 6, 8, 10, 12], [0, 2, 4, 6, 8, 10, 12, 14]),
    ...layer(1, [1, 3, 5, 7, 9, 11], [3, 5, 7, 9, 11]),
    ...layer(2, [3, 5, 7, 9], [5, 7, 9]),
    ...layer(3, [4, 6, 8], [6, 8]),
  ],
  { tileW: 48, tileH: 63, cols: 7 },
);
export const MAHJONG_LAYOUT_136: MahjongLayout = makeLayout(
  [
    ...layer(0, [0, 2, 4, 6, 8, 10, 12, 14], [0, 2, 4, 6, 8, 10, 12, 14, 16]),
    ...layer(1, [1, 3, 5, 7, 9, 11, 13], [3, 5, 7, 9, 11, 13]),
    ...layer(2, [4, 6, 8, 10], [5, 7, 9, 11]),
    ...layer(3, [5, 7, 9], [7, 9]),
  ],
  { tileW: 42, tileH: 55, cols: 8 },
);
const LAYOUTS_BY_LENGTH = new Map<number, MahjongLayout>([MAHJONG_LAYOUT_EASY, MAHJONG_LAYOUT_EXPERT, MAHJONG_LAYOUT_48, MAHJONG_LAYOUT_104, MAHJONG_LAYOUT_136].map((l) => [l.tiles, l]));

/** The layout a board (its face list) is on (each layout has its own length). */
export function mahjongLayoutOf(face: readonly unknown[]): MahjongLayout {
  return LAYOUTS_BY_LENGTH.get(face.length) ?? MAHJONG_LAYOUT;
}

const COVERERS = MAHJONG_LAYOUT.coverers;
const LEFTS = MAHJONG_LAYOUT.lefts;
const RIGHTS = MAHJONG_LAYOUT.rights;

/** True when the place holds a tile with nothing on it and its left or right side open. */
export function mahjongFree(face: readonly number[], slot: number): boolean {
  if ((face[slot] ?? -1) < 0) return false;
  const lay = face.length === MAHJONG_TILES ? MAHJONG_LAYOUT : mahjongLayoutOf(face);
  for (const c of lay.coverers[slot]!) if (face[c]! >= 0) return false;
  let left = false;
  for (const l of lay.lefts[slot]!) if (face[l]! >= 0) left = true;
  if (!left) return true;
  for (const r of lay.rights[slot]!) if (face[r]! >= 0) return false;
  return true;
}

/**
 * The tiles keeping a place from being free (display only: the overhaul's stage 2 flashes them when a blocked tile is
 * tapped): the tiles lying on it, or else the tiles both sides of it. Empty when the place is free or taken.
 */
export function mahjongBlockers(face: readonly number[], slot: number): number[] {
  if ((face[slot] ?? -1) < 0) return [];
  const lay = mahjongLayoutOf(face);
  const on = lay.coverers[slot]!.filter((c) => face[c]! >= 0);
  if (on.length) return on;
  const left = lay.lefts[slot]!.filter((l) => face[l]! >= 0);
  const right = lay.rights[slot]!.filter((r) => face[r]! >= 0);
  return left.length && right.length ? [...left, ...right] : [];
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
function buildOrder(places: readonly number[], rng: number, tries: number, tiles = MAHJONG_TILES): { rng: number; order: [number, number][] } | null {
  let r = rng;
  for (let t = 0; t < tries; t++) {
    const face = new Array<number>(tiles).fill(-1);
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

/** The seed's deal (the same on every device and the server); a level's on its layout and face mix. */
export function mahjongBuild(seed: number, level?: MahjongLevelName | null, rev: number = MAHJONG_REV_DEALT): MahjongDeal {
  const rules = level ? mahjongLevelRulesFor(rev, level) : null;
  const lay = rules ? rules.layout : MAHJONG_LAYOUT;
  const quads = rules ? rules.quads : MAHJONG_QUADS;
  const doubles = lay.pairs - 2 * quads;
  // A level's deal draws from its own stream of the seed, so it never repeats a Normal deal's (D6's levels: their own
  // stream again, so they never repeat the levels before).
  let rng = rules ? mixSeed(seed ^ (0x1e5e1 * rules.lv) ^ (rev >= MAHJONG_REV_LEVELS ? 0x3d6 : 0)) : mixSeed(seed);
  const kinds = Array.from({ length: MAHJONG_KINDS }, (_, i) => i);
  rng = shuffleList(kinds, rng);
  const pairs: number[] = [];
  for (let i = 0; i < quads; i++) pairs.push(kinds[i]!, kinds[i]!);
  for (let i = quads; i < quads + doubles; i++) pairs.push(kinds[i]!);
  rng = shuffleList(pairs, rng);
  const places = lay.slots.map((_, i) => i);
  const built = buildOrder(places, rng, MAHJONG_BUILD_TRIES, lay.tiles) ?? buildOrder(places, mixSeed(0x5eed), 100_000, lay.tiles)!;
  const face = new Array<number>(lay.tiles).fill(-1);
  built.order.forEach(([a, b], i) => {
    face[a] = pairs[i]!;
    face[b] = pairs[i]!;
  });
  return { face, order: built.order, rng: built.rng };
}

/** True when the seed's build order, played forwards through the real sim, clears every pair (the deal's proof). */
export function mahjongBuildClears(seed: number, level?: MahjongLevelName | null, rev: number = MAHJONG_REV_DEALT): boolean {
  const deal = mahjongBuild(seed, level, rev);
  const game = level ? mahjongLevelGame(level, rev) : mahjongGame;
  let s = game.init(seed);
  let t = 0;
  for (const [a, b] of deal.order) {
    s = game.step(s, { t: ++t, k: MAHJONG_INPUT_TAP, a, b: 0, c: 0, d: 0 });
    s = game.step(s, { t: ++t, k: MAHJONG_INPUT_TAP, a: b, b: 0, c: 0, d: 0 });
  }
  return mahjongCleared(s) && s.shuffles === 0;
}

/** The lowest `count` places of the layout (bottom layer first): the Shuffle's fallback when no order clears the board as it stands. */
function packedPlaces(count: number, lay: MahjongLayout = MAHJONG_LAYOUT): number[] {
  return lay.slots.map((_, i) => i).slice(0, count);
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
  const lay = mahjongLayoutOf(face);
  let built = buildOrder(places, r, 60, lay.tiles);
  if (!built) {
    packed = true;
    built = buildOrder(packedPlaces(places.length, lay), r, 100_000, lay.tiles)!;
  }
  r = built.rng;
  const out = new Array<number>(lay.tiles).fill(-1);
  built.order.forEach(([a, b], i) => {
    out[a] = pairs[i]!;
    out[b] = pairs[i]!;
  });
  return { face: out, rng: r, packed, order: built.order };
}

/** Matching pairs of free tiles on the board (0 = stuck: only a Shuffle helps). */
export function mahjongMoves(face: readonly number[]): [number, number][] {
  const free: number[] = [];
  for (let i = 0; i < face.length; i++) if (mahjongFree(face, i)) free.push(i);
  const out: [number, number][] = [];
  for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) if (face[free[i]!] === face[free[j]!]) out.push([free[i]!, free[j]!]);
  return out;
}

/* ================================ Inputs ================================ */

export const MAHJONG_INPUT_TAP = 1;
export const MAHJONG_INPUT_SHUFFLE = ARCADE_INPUT_BUTTON;
/** The button kind's `a` on mahjongRev 2: 0 Shuffle, 1 Undo, 2 Reset. */
export const MAHJONG_INPUT_BUTTON = ARCADE_INPUT_BUTTON;
export const MAHJONG_BUTTON_SHUFFLE = 0;
export const MAHJONG_BUTTON_UNDO = 1;
export const MAHJONG_BUTTON_RESET = 2;
export const MAHJONG_INPUT_RANGES: readonly InputRange[] = [inputRange(MAHJONG_INPUT_TAP, [0, MAHJONG_TILES - 1]), inputRange(MAHJONG_INPUT_SHUFFLE)];
export const MAHJONG_V2_INPUT_RANGES: readonly InputRange[] = [inputRange(MAHJONG_INPUT_TAP, [0, MAHJONG_TILES - 1]), inputRange(MAHJONG_INPUT_BUTTON, [0, MAHJONG_BUTTON_RESET])];

/** The input ranges a revision's runs are validated against. */
export function mahjongInputRanges(rev?: number | null): readonly InputRange[] {
  return (rev ?? MAHJONG_REV_STD) >= MAHJONG_REV_UNDO ? MAHJONG_V2_INPUT_RANGES : MAHJONG_INPUT_RANGES;
}

/* ================================ World ================================ */

/** 356 wide since 3 Nov 2026 (display only: the sim never reads the world's size; taps reach it as places), so the
 *  stack, at the largest scale that fits the play screen's width, grows into the space that was empty below it (390
 *  until then). */
export const MAHJONG_WORLD_W = 356;
export const MAHJONG_TILE_W = 56;
export const MAHJONG_TILE_H = 74;
/** Each layer is drawn this far up and to the left of the one below (the stack's depth). */
export const MAHJONG_LIFT_X = 5;
export const MAHJONG_LIFT_Y = 6;
export const MAHJONG_HUD_H = 44;
export const MAHJONG_BOARD_W = 6 * MAHJONG_TILE_W;
export const MAHJONG_BOARD_H = 7 * MAHJONG_TILE_H;
export const MAHJONG_BOARD_X = Math.round((MAHJONG_WORLD_W - MAHJONG_BOARD_W) / 2);
export const MAHJONG_BOARD_Y = MAHJONG_HUD_H + 14 + 3 * MAHJONG_LIFT_Y;
export const MAHJONG_WORLD_H = MAHJONG_BOARD_Y + MAHJONG_BOARD_H + 14;

/** A place's tile face rectangle (top-left) in world units (on a level's layout when given). */
export function mahjongSlotRect(slot: number, lay: MahjongLayout = MAHJONG_LAYOUT): { x: number; y: number; w: number; h: number } {
  const s = lay.slots[slot]!;
  const w = lay.tileW ?? MAHJONG_TILE_W;
  const h = lay.tileH ?? MAHJONG_TILE_H;
  return {
    x: (lay.boardX ?? MAHJONG_BOARD_X) + (s.x2 * w) / 2 - s.z * MAHJONG_LIFT_X,
    y: (lay.boardY ?? MAHJONG_BOARD_Y) + (s.y2 * h) / 2 - s.z * MAHJONG_LIFT_Y,
    w,
    h,
  };
}

/** The topmost tile under a world point, or −1. */
export function mahjongSlotAt(face: readonly number[], x: number, y: number): number {
  let best = -1;
  const lay = mahjongLayoutOf(face);
  for (let i = 0; i < face.length; i++) {
    if (face[i]! < 0) continue;
    const r = mahjongSlotRect(i, lay);
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h && (best < 0 || lay.slots[i]!.z >= lay.slots[best]!.z)) best = i;
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
  /** mahjongRev 2 only: the original deal (Reset), the boards before each pair taken or Shuffle (Undo), the counts and the last one's tick. */
  start?: readonly number[];
  history?: readonly (readonly number[])[];
  undos?: number;
  resets?: number;
  lastUndoTick?: number;
  lastResetTick?: number;
  /** The difficulty levels (level deals only): the level (MAHJONG_LV_*), hints asked for and the last one's tick. */
  lv?: number;
  hints?: number;
  hintTick?: number;
  /** D6's levels: the tick the run ends on when the level has its own clock (Normal: MAHJONG_RUN_TICKS). */
  endAt?: number;
}

function init(seed: number): MahjongState {
  return initRev(seed, MAHJONG_REV_STD);
}

function initRev(seed: number, rev: number, level?: MahjongLevelName | null): MahjongState {
  const deal = mahjongBuild(seed, level, rev);
  const base: MahjongState = {
    rev,
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
  const undo = rev >= MAHJONG_REV_UNDO ? { ...base, start: deal.face, history: [], undos: 0, resets: 0, lastUndoTick: 0, lastResetTick: 0 } : base;
  if (!level) return undo;
  const rules = mahjongLevelRulesFor(rev, level);
  return { ...undo, lv: rules.lv, hints: 0, hintTick: 0, ...(rules.seconds ? { endAt: rules.seconds * TICKS_PER_SECOND } : {}) };
}

/** On mahjongRev 2, the board before a change goes on the undo history. */
function remember(s: MahjongState): Partial<MahjongState> {
  return s.history ? { history: [...s.history, s.face] } : {};
}

function pairsOn(face: readonly number[]): number {
  let gone = 0;
  for (const f of face) if (f < 0) gone++;
  return gone / 2;
}

function applyUndo(s: MahjongState, tick: number): MahjongState {
  const history = s.history ?? [];
  if (mahjongCleared(s) || history.length === 0) return s;
  const face = history[history.length - 1]!;
  return { ...s, face, pairs: pairsOn(face), sel: -1, history: history.slice(0, -1), undos: (s.undos ?? 0) + 1, lastUndoTick: tick };
}

function applyReset(s: MahjongState, tick: number): MahjongState {
  if (mahjongCleared(s) || !s.start) return s;
  return { ...s, face: s.start, pairs: 0, sel: -1, history: [], resets: (s.resets ?? 0) + 1, lastResetTick: tick };
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
  const all = s.face.length / 2;
  return {
    ...s,
    ...remember(s),
    face,
    sel: -1,
    pairs,
    clearedTick: pairs >= all && s.clearedTick === 0 ? tick : s.clearedTick,
    lastA: s.sel,
    lastB: slot,
    lastPairTick: tick,
  };
}

function applyShuffle(s: MahjongState, tick: number): MahjongState {
  if (mahjongCleared(s)) return s;
  const out = mahjongReshuffle(s.face, s.rng);
  return { ...s, ...remember(s), face: out.face, rng: out.rng, sel: -1, shuffles: s.shuffles + 1, lastShuffleTick: tick };
}

function step(s: MahjongState, input: ArcadeInputEvent | null): MahjongState {
  if (isOver(s)) return s;
  const tick = s.tick + 1;
  let next: MahjongState = s;
  if (input) {
    if (input.k === MAHJONG_INPUT_TAP && input.a >= 0 && input.a < s.face.length) next = applyTap(s, input.a, tick);
    else if (input.k === MAHJONG_INPUT_BUTTON && s.lv && input.a === MAHJONG_BUTTON_HINT) next = applyHint(s, tick);
    else if (input.k === MAHJONG_INPUT_BUTTON && s.rev >= MAHJONG_REV_UNDO && input.a === MAHJONG_BUTTON_UNDO) next = applyUndo(s, tick);
    else if (input.k === MAHJONG_INPUT_BUTTON && s.rev >= MAHJONG_REV_UNDO && input.a === MAHJONG_BUTTON_RESET) next = applyReset(s, tick);
    else if (input.k === MAHJONG_INPUT_SHUFFLE) next = applyShuffle(s, tick);
    if (!next.acted) next = { ...next, acted: 1 };
  }
  return next === s ? { ...s, tick } : { ...next, tick };
}

export function mahjongCleared(s: Pick<MahjongState, "pairs"> & { face?: readonly number[] }): boolean {
  return s.pairs >= (s.face ? s.face.length / 2 : MAHJONG_PAIRS);
}

function isOver(s: MahjongState): boolean {
  return mahjongCleared(s) || s.tick >= (s.endAt ?? MAHJONG_RUN_TICKS);
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
  rev: MAHJONG_REV_DEALT,
  parts: [
    { key: "core", label: "Pairs", max: MAHJONG_CORE_MAX, item: "pair", how: `clear the ${MAHJONG_PAIRS} pairs, each worth the same` },
    { key: "clean", label: "No shuffles", max: MAHJONG_CLEAN_MAX, how: "the same again for each pair, all of it lost on your first shuffle" },
    { key: "speed", label: "Speed", max: MAHJONG_SPEED_MAX, how: `clear the board within ${MAHJONG_SPEED_FULL_S} s for all of it, falling to 0 at the buzzer` },
  ],
};

export function mahjongParts(s: MahjongState): { core: number; clean: number; speed: number; penalty: number; total: number } {
  if (s.lv) return mahjongLevelParts(s);
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
  if (!s || (s.rev !== MAHJONG_REV_STD && s.rev !== MAHJONG_REV_UNDO) || !Array.isArray(s.face)) return null;
  const st = s as MahjongState;
  const p = mahjongParts(st);
  if (st.lv) return mahjongLevelStdParts(st, p);
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
  // The levels: the board's own length and the hints asked for (level states only).
  if (s.lv) {
    for (let i = MAHJONG_TILES; i < s.face.length; i++) h = Math.imul(h ^ (s.face[i]! + 2), 0x01000193);
    h = Math.imul(h ^ (300 + (s.hints ?? 0)), 0x01000193);
  }
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

/** mahjongRev 2: the same deal and score with Undo and Reset. */
export const mahjongUndoGame: ArcadeGame<MahjongState, ArcadeInputEvent | null> = {
  ...mahjongGame,
  init: (seed: number) => initRev(seed, MAHJONG_REV_UNDO),
  inputRanges: MAHJONG_V2_INPUT_RANGES,
};

export function mahjongGameFor(rev?: number | null): ArcadeGame<MahjongState, ArcadeInputEvent | null> {
  return (rev ?? MAHJONG_REV_STD) >= MAHJONG_REV_UNDO ? mahjongUndoGame : mahjongGame;
}

/* ================================ Difficulty levels (15 Nov 2026) ================================ */

/*
 * The levels (docs/design/difficulty/README.md; docs/arcade-standard/mahjong.md "Levels"): Normal is mahjongRev 2
 * exactly (no `level` on the puzzle, none of this code runs). A level deal carries `level` and mahjongRev 2; its game is
 * rev 2's play (Undo and Reset) on the level's layout and face mix, with hints:
 *
 *   Easy    56 tiles in three layers, 2 faces dealt four times, a Shuffle costs 2, hints free.
 *   Hard    the 72-tile stack, 10 faces dealt four times (more look-alike choices), a Shuffle costs 8, a hint 5.
 *   Expert  88 tiles in five layers, 12 faces dealt four times, a Shuffle costs 10, one hint.
 *
 * A face dealt four times is the hard kind to pair: either pair can be taken first, and the wrong one can bury the
 * other. Every level's board is built backwards as Normal's is (`mahjongBuild`), so every deal clears; a Shuffle builds
 * again on the board's own layout. Parts: Pairs 150, No shuffles 20, Speed 30 (full by the level's seconds); the
 * Shuffles' and hints' costs come off the total.
 */
export const MAHJONG_BUTTON_HINT = 3;
export const MAHJONG_LV_EASY = 1;
export const MAHJONG_LV_HARD = 3;
export const MAHJONG_LV_EXPERT = 4;
export type MahjongLevelName = "easy" | "hard" | "expert";

export interface MahjongLevelRules {
  lv: number;
  layout: MahjongLayout;
  quads: number;
  shuffleCost: number;
  hintCost: number;
  hintLimit: number;
  speedFullS: number;
  /** D6's levels: the level's own clock in seconds (unset: Normal's 120). */
  seconds?: number;
}

export const MAHJONG_LEVEL_RULES: Readonly<Record<MahjongLevelName, MahjongLevelRules>> = {
  easy: { lv: MAHJONG_LV_EASY, layout: MAHJONG_LAYOUT_EASY, quads: 2, shuffleCost: 2, hintCost: 0, hintLimit: -1, speedFullS: 70 },
  hard: { lv: MAHJONG_LV_HARD, layout: MAHJONG_LAYOUT, quads: 10, shuffleCost: 8, hintCost: 5, hintLimit: -1, speedFullS: 25 },
  expert: { lv: MAHJONG_LV_EXPERT, layout: MAHJONG_LAYOUT_EXPERT, quads: 12, shuffleCost: 10, hintCost: 0, hintLimit: 1, speedFullS: 30 },
};

/**
 * D6's levels (mahjongRev 3, 23 Nov 2026, the polish plan's difficulty spec: the lever is tiles in the stack; Joe's
 * ladder test). Hard and Expert carry no hints (the spec's rule 5). Each deal is built backwards from the seed and its
 * build order replayed through the sim before it is dealt (mahjongBuildClears), as every Mahjong deal is.
 *
 *   Easy    48 tiles in 2 layers, 2 faces dealt four times, Shuffle 2, free hints with the idle glow.
 *   Hard    104 tiles in 4 layers (48 × 63 tiles), 18 faces dealt four times, Shuffle 10, no hints.
 *   Expert  136 tiles in 4 layers (42 × 55 tiles), all 34 faces dealt four times, Shuffle 15, no hints.
 */
export const MAHJONG_LEVEL_RULES_V3: Readonly<Record<MahjongLevelName, MahjongLevelRules>> = {
  easy: { lv: MAHJONG_LV_EASY, layout: MAHJONG_LAYOUT_48, quads: 2, shuffleCost: 2, hintCost: 0, hintLimit: -1, speedFullS: 70 },
  hard: { lv: MAHJONG_LV_HARD, layout: MAHJONG_LAYOUT_104, quads: 18, shuffleCost: 10, hintCost: 0, hintLimit: 0, speedFullS: 80 },
  expert: { lv: MAHJONG_LV_EXPERT, layout: MAHJONG_LAYOUT_136, quads: 34, shuffleCost: 15, hintCost: 0, hintLimit: 0, speedFullS: 98, seconds: 110 },
};

function levelNameOf(lv: number | undefined): MahjongLevelName | null {
  return lv === MAHJONG_LV_EASY ? "easy" : lv === MAHJONG_LV_HARD ? "hard" : lv === MAHJONG_LV_EXPERT ? "expert" : null;
}

/** A level's rules on a revision (mahjongRev 3: D6's; earlier: the levels before). */
export function mahjongLevelRulesFor(rev: number | null | undefined, level: MahjongLevelName): MahjongLevelRules {
  return (rev ?? 0) >= MAHJONG_REV_LEVELS ? MAHJONG_LEVEL_RULES_V3[level] : MAHJONG_LEVEL_RULES[level];
}

export function mahjongLevelRulesOf(s: Pick<MahjongState, "lv"> & { rev?: number }): MahjongLevelRules | null {
  const name = levelNameOf(s.lv);
  return name ? mahjongLevelRulesFor(s.rev, name) : null;
}

export function mahjongHintsLeft(s: MahjongState): number {
  const rules = mahjongLevelRulesOf(s);
  if (!rules) return 0;
  return rules.hintLimit < 0 ? Infinity : Math.max(0, rules.hintLimit - (s.hints ?? 0));
}

function applyHint(s: MahjongState, tick: number): MahjongState {
  if (mahjongCleared(s) || mahjongHintsLeft(s) <= 0) return s;
  return { ...s, hints: (s.hints ?? 0) + 1, hintTick: tick };
}

/** A level's spec (the help and the reveal). */
export function mahjongLevelSpec(level: MahjongLevelName, rev: number | null = MAHJONG_REV_DEALT): StdSpec {
  const rules = mahjongLevelRulesFor(rev, level);
  const pairs = rules.layout.pairs;
  return {
    field: "mahjongRev",
    rev: (rev ?? 0) >= MAHJONG_REV_LEVELS ? MAHJONG_REV_LEVELS : MAHJONG_REV_DEALT,
    parts: [
      { key: "core", label: "Pairs", max: MAHJONG_CORE_MAX, item: "pair", how: `clear the ${pairs} pairs, each worth the same` },
      { key: "clean", label: "No shuffles", max: MAHJONG_CLEAN_MAX, how: `the same again for each pair, all of it lost on your first shuffle; each shuffle costs ${rules.shuffleCost}${rules.hintCost ? `, each hint ${rules.hintCost}` : ""}` },
      { key: "speed", label: "Speed", max: MAHJONG_SPEED_MAX, how: `clear the board within ${rules.speedFullS} s for all of it, falling to 0 at the buzzer` },
    ],
  };
}

function mahjongLevelParts(s: MahjongState): { core: number; clean: number; speed: number; penalty: number; total: number } {
  const rules = mahjongLevelRulesOf(s)!;
  const pairsAll = s.face.length / 2;
  const core = stdLine(MAHJONG_CORE_MAX, s.pairs, pairsAll);
  const clean = s.shuffles === 0 ? stdLine(MAHJONG_CLEAN_MAX, s.pairs, pairsAll) : 0;
  const speed = mahjongCleared(s) && s.clearedTick > 0 ? stdSpeed(MAHJONG_SPEED_MAX, s.clearedTick, rules.speedFullS * TICKS_PER_SECOND, s.endAt ?? MAHJONG_RUN_TICKS) : 0;
  const penalty = rules.shuffleCost * s.shuffles + rules.hintCost * (s.hints ?? 0);
  return { core, clean, speed, penalty, total: core + clean + speed - penalty };
}

function mahjongLevelStdParts(st: MahjongState, p: { core: number; clean: number; speed: number; penalty: number }): StdPart[] {
  const rules = mahjongLevelRulesOf(st)!;
  const level = levelNameOf(st.lv)!;
  const spec = mahjongLevelSpec(level, st.rev);
  const pairsAll = st.face.length / 2;
  const hints = st.hints ?? 0;
  const costs: string[] = [];
  if (st.shuffles) costs.push(`${st.shuffles} ${st.shuffles === 1 ? "shuffle" : "shuffles"} (−${rules.shuffleCost * st.shuffles})`);
  if (hints && rules.hintCost) costs.push(`${hints} ${hints === 1 ? "hint" : "hints"} (−${rules.hintCost * hints})`);
  return [
    stdPart(spec, "core", p.core, `${st.pairs} of ${pairsAll} pairs`),
    stdPart(spec, "clean", p.clean, costs.length ? costs.join(", ") : "no shuffle"),
    stdPart(spec, "speed", p.speed, mahjongCleared(st) ? `cleared in ${secs(st.clearedTick)}` : "not cleared"),
  ];
}

/**
 * The hint's pair (display only, never read by the sim): a free matching pair after which the board can still be
 * cleared (a short search over the free pairs), else the first free pair, else null (only a Shuffle helps).
 */
export function mahjongHintPair(face: readonly number[], budget = 3000): [number, number] | null {
  const moves = mahjongMoves(face);
  if (!moves.length) return null;
  let left = budget;
  const seen = new Set<string>();
  const clears = (f: number[]): boolean => {
    if (f.every((x) => x < 0)) return true;
    if (--left <= 0) return false;
    const key = f.join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    for (const [a, b] of mahjongMoves(f)) {
      const g = f.slice();
      g[a] = -1;
      g[b] = -1;
      if (clears(g)) return true;
      if (left <= 0) return false;
    }
    return false;
  };
  for (const [a, b] of moves) {
    const g = face.slice();
    g[a] = -1;
    g[b] = -1;
    if (clears(g)) return [a, b];
    if (left <= 0) break;
  }
  return moves[0]!;
}

const MAHJONG_LEVEL_GAMES = new Map<string, ArcadeGame<MahjongState, ArcadeInputEvent | null>>();

/** A level's game: mahjongRev 2's play on the level's layout and faces, plus hints (`rev` 3: D6's levels). */
export function mahjongLevelGame(level: MahjongLevelName, rev: number | null = MAHJONG_REV_UNDO): ArcadeGame<MahjongState, ArcadeInputEvent | null> {
  const r = (rev ?? 0) >= MAHJONG_REV_LEVELS ? MAHJONG_REV_LEVELS : MAHJONG_REV_UNDO;
  const key = `${level}:${r}`;
  let g = MAHJONG_LEVEL_GAMES.get(key);
  if (!g) {
    const lr = mahjongLevelRulesFor(r, level);
    const tiles = lr.layout.tiles;
    g = {
      ...mahjongUndoGame,
      ...(lr.seconds ? { runTicks: lr.seconds * TICKS_PER_SECOND } : {}),
      init: (seed: number) => initRev(seed, r, level),
      inputRanges: [inputRange(MAHJONG_INPUT_TAP, [0, tiles - 1]), inputRange(MAHJONG_INPUT_BUTTON, [0, MAHJONG_BUTTON_HINT])],
    };
    MAHJONG_LEVEL_GAMES.set(key, g);
  }
  return g;
}

/** The game a puzzle plays: its level's (a level deal) or its revision's (Normal). */
export function mahjongGameAt(rev: number | null | undefined, level: string | null | undefined): ArcadeGame<MahjongState, ArcadeInputEvent | null> {
  return level === "easy" || level === "hard" || level === "expert" ? mahjongLevelGame(level, rev ?? null) : mahjongGameFor(rev);
}
