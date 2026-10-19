/**
 * Letterfall — a Word round on the shared arcade engine.
 *
 * Letter tiles stack in a well 6 columns wide and 9 rows tall. The run starts
 * with the bottom three rows filled; then tiles drop one at a time into seeded
 * columns from a fixed seeded queue, faster in each of five 18 s phases. Tap
 * adjacent tiles (8 directions, each once) to build a chain; tap the last tile
 * again or Enter to submit. A dictionary word of 3+ letters clears its tiles
 * and the tiles above fall; anything else shakes and clears the chain at no
 * cost. A tile that cannot enter a full column ends the run.
 *
 * Everything gameplay is integer: tile tops in 1/256 px, letters as codes
 * 0-25 (16 is the "Qu" tile), the whole letter queue and column order drawn
 * from the seed at init with mulberry32 (rng carried in the state). A word's
 * verdict comes from `isWordfallWord`, a pure function of the string shared by
 * the phone and the server replay. A tap is kind 12, `a`/`b` = world px; the
 * sim finds the tile itself. Enter is kind 13.
 *
 * wordfallRev 2 (14 Oct 2026): slower drops (2.0 s → 1.1 s) and a slower fall,
 * fewer vowels with no vowel-heavy runs (at most 2 in a row, 3 in any 6, and
 * never more than 3 consonants in a row), and the Enter box in the world under
 * the well (a taller world, WF_H_V2; a tap inside WF_ENTER_V2 submits). The
 * state keeps the same fields; `rev` picks the rules. Rev-1 states never take
 * a rev-2 branch, so stored rounds and demos replay exactly as before.
 */

import {
  clampInt,
  inputRange,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";
import { isWordfallWord } from "./wordfallDict";
import { bandCurve, bandMapTotal } from "./scoreBands";

/* ============================== Config ============================== */

/** Gameplay revision stamped on new puzzles (`wordfallRev`). */
export const WORDFALL_REV = 2;
/** The original rules (stored rounds stamped 1). */
export const WORDFALL_REV1 = 1;

export const WF_COLS = 6;
export const WF_ROWS = 9;
export const WF_START_ROWS = 3;
export const WF_START_TILES = WF_COLS * WF_START_ROWS;
/** One cell, world px. */
export const WF_CELL = 60;
export const WF_W = 390;
export const WF_H = 624;
/** The well's top-left corner, world px; the word line sits above it. */
export const WF_WELL_X = 15;
export const WF_WELL_Y = 72;
export const WF_WELL_W = WF_COLS * WF_CELL;
export const WF_WELL_H = WF_ROWS * WF_CELL;

export const WF_RUN_SECONDS = 90;
export const WF_RUN_TICKS = WF_RUN_SECONDS * TICKS_PER_SECOND;
/** Five 18 s phases; the drop interval falls 1.6 s → 0.8 s across them. */
export const WF_PHASE_TICKS = 18 * TICKS_PER_SECOND;
export const WF_DROP_INTERVALS = [96, 84, 72, 60, 48] as const;
/** The first drop lands one full interval after the start. */
export const WF_FIRST_DROP = WF_DROP_INTERVALS[0];
/** Fall speed, 1/256 px a tick (10 px: one row in 6 ticks). */
export const WF_FALL = 10 * 256;
/** wordfallRev 2: the drop interval falls 2.0 s → 1.1 s across the same five phases. */
export const WF_DROP_INTERVALS_V2 = [120, 105, 90, 78, 66] as const;
export const WF_FIRST_DROP_V2 = WF_DROP_INTERVALS_V2[0];
/** wordfallRev 2 fall speed: 6 px a tick (one row in 10 ticks). */
export const WF_FALL_V2 = 6 * 256;
/** wordfallRev 2 world: the well as before plus the Enter box beneath it. */
export const WF_H_V2 = 700;
/** wordfallRev 2 Enter box, world px: drawn exactly here, and a tap inside it submits. */
export const WF_ENTER_V2 = { x: 65, y: 630, w: 260, h: 60 } as const;

export const WF_MIN_WORD = 3;
/** Longest chain in tiles (the dictionary stops at 12 letters). */
export const WF_MAX_CHAIN = 12;
/** Word points by letters: 3 = 1, 4 = 2, 5 = 4, 6 = 7, 7+ = 11. */
export const WF_WORD_POINTS = [0, 0, 0, 1, 2, 4, 7, 11] as const;
/** First guess; ?dev=1 shows points and par so it can be set from real sessions. */
export const WF_PAR = 30;
export const WF_SHAKE_TICKS = 24;
/** Best words kept for the reveal. */
export const WF_BEST_KEEP = 5;

/** Queue length: 18 start tiles plus more drops than 90 s can hold (81). */
export const WF_QUEUE_LEN = 128;
/** At least 8 vowels (38 %) in every 20 consecutive queue tiles. */
export const WF_VOWEL_WINDOW = 20;
export const WF_VOWEL_MIN = 8;

/** Letter codes: 0 = A … 25 = Z; 16 is drawn and spelt "Qu". */
export const WF_Q = 16;
const VOWELS = new Set([0, 4, 8, 14, 20]);
/** wordfallRev 2 weights: fewer vowels (A 7, E 10, I 6, O 6, U 3; 32 of 89), consonants unchanged. */
export const WF_LETTER_WEIGHTS_V2 = [
  7, 2, 2, 4, 10, 2, 3, 2, 6, 1, 1, 4, 2, 6, 6, 2, 1, 6, 5, 6, 3, 2, 2, 1, 2, 1,
] as const;
/** wordfallRev 2 queue rules: at most 2 vowels in a row, 3 in any 6 tiles, 3 consonants in a row. */
export const WF_V2_VOWEL_RUN = 2;
export const WF_V2_VOWEL_SPAN = 6;
export const WF_V2_VOWEL_SPAN_MAX = 3;
export const WF_V2_CONSONANT_RUN = 3;
/** Tile weights by letter (A-Z), from tile-game letter frequencies (98 in all, 41 vowels). */
export const WF_LETTER_WEIGHTS = [
  9, 2, 2, 4, 12, 2, 3, 2, 8, 1, 1, 4, 2, 6, 8, 2, 1, 6, 5, 6, 4, 2, 2, 1, 2, 1,
] as const;
const WEIGHT_TOTAL = WF_LETTER_WEIGHTS.reduce((a, b) => a + b, 0);
const VOWEL_TOTAL = [...VOWELS].reduce((a, v) => a + WF_LETTER_WEIGHTS[v]!, 0);
const WEIGHT_TOTAL_V2 = WF_LETTER_WEIGHTS_V2.reduce((a, b) => a + b, 0);
const VOWEL_TOTAL_V2 = [...VOWELS].reduce((a, v) => a + WF_LETTER_WEIGHTS_V2[v]!, 0);

export const WF_INPUT_TAP = 12;
export const WF_INPUT_ENTER = 13;
export const WF_INPUT_RANGES: readonly InputRange[] = [
  inputRange(WF_INPUT_TAP, [0, WF_W], [0, WF_H]),
  inputRange(WF_INPUT_ENTER),
];
export const WF_INPUT_RANGES_V2: readonly InputRange[] = [
  inputRange(WF_INPUT_TAP, [0, WF_W], [0, WF_H_V2]),
  inputRange(WF_INPUT_ENTER),
];

/** World height for a stored revision (rev 2 adds the Enter box under the well). */
export function wfWorldHFor(rev?: number): number {
  return rev === 2 || rev === WORDFALL_REV_BANDS ? WF_H_V2 : WF_H;
}

/** World height for a state. */
export function wfWorldH(state: { rev: number }): number {
  return wfWorldHFor(state.rev);
}

/** True when a world point is inside the rev-2 Enter box. */
export function wfInEnterV2(x: number, y: number): boolean {
  const e = WF_ENTER_V2;
  return x >= e.x && x < e.x + e.w && y >= e.y && y < e.y + e.h;
}

/** Log codes. */
export const WF_LOG_PICK = 1;
export const WF_LOG_MISS = 2;
export const WF_LOG_WORD = 3;
export const WF_LOG_BAD = 4;
export const WF_LOG_DROP = 5;
export const WF_LOG_FULL = 6;
const LOG_KEEP = 16;

/* ============================== Letters ============================== */

export function wfIsVowel(letter: number): boolean {
  return VOWELS.has(letter);
}

/** The letters a tile spells, lowercase ("qu" for the Q tile). */
export function wfSpelling(letter: number): string {
  return letter === WF_Q ? "qu" : String.fromCharCode(97 + letter);
}

/** The label drawn on a tile ("Qu" for the Q tile). */
export function wfLabel(letter: number): string {
  return letter === WF_Q ? "Qu" : String.fromCharCode(65 + letter);
}

export function wfWord(letters: readonly number[]): string {
  return letters.map(wfSpelling).join("");
}

export function wfWordPoints(length: number): number {
  if (length < WF_MIN_WORD) return 0;
  return WF_WORD_POINTS[Math.min(length, WF_WORD_POINTS.length - 1)]!;
}

/** The drop interval in ticks at this tick. */
export function wfDropInterval(tick: number, rev?: number): number {
  const table = rev === 2 ? WF_DROP_INTERVALS_V2 : WF_DROP_INTERVALS;
  const phase = clampInt(Math.floor(tick / WF_PHASE_TICKS), 0, table.length - 1);
  return table[phase]!;
}

/* =============================== Plan =============================== */

export interface WordfallPlan {
  /** The letter queue: the first 18 fill the start rows, the rest drop in order. */
  letters: number[];
  /** The column of each drop (a shuffled bag of all six, no column twice in a row). */
  cols: number[];
}

function pickLetter(roll: number, vowelOnly: boolean): number {
  let left = roll;
  for (let letter = 0; letter < 26; letter++) {
    if (vowelOnly && !VOWELS.has(letter)) continue;
    left -= WF_LETTER_WEIGHTS[letter]!;
    if (left < 0) return letter;
  }
  return 4;
}

/** wordfallRev 2: a letter from the rev-2 weights, limited to vowels or to consonants when `only` says so. */
function pickLetterV2(roll: number, only: "vowel" | "consonant" | null): number {
  let left = roll;
  for (let letter = 0; letter < 26; letter++) {
    if (only === "vowel" && !VOWELS.has(letter)) continue;
    if (only === "consonant" && VOWELS.has(letter)) continue;
    left -= WF_LETTER_WEIGHTS_V2[letter]!;
    if (left < 0) return letter;
  }
  return only === "vowel" ? 4 : 19;
}

/**
 * wordfallRev 2 letters: rev-2 weights under three run rules. A vowel is forced
 * after 3 consonants in a row; a consonant after 2 vowels in a row or when the
 * last 5 tiles already hold 3 vowels. The rules never clash (3 trailing
 * consonants leave room for a vowel on both counts), so at least one tile in
 * every 4 is a vowel and at most 3 in every 6 are.
 */
function lettersV2(draw: (bound: number) => number): number[] {
  const letters: number[] = [];
  for (let i = 0; i < WF_QUEUE_LEN; i++) {
    let vowelRun = 0;
    while (vowelRun < i && VOWELS.has(letters[i - 1 - vowelRun]!)) vowelRun++;
    let consonantRun = 0;
    while (consonantRun < i && !VOWELS.has(letters[i - 1 - consonantRun]!)) consonantRun++;
    let recent = 0;
    for (let j = Math.max(0, i - (WF_V2_VOWEL_SPAN - 1)); j < i; j++) if (VOWELS.has(letters[j]!)) recent++;
    const only = consonantRun >= WF_V2_CONSONANT_RUN
      ? "vowel"
      : vowelRun >= WF_V2_VOWEL_RUN || recent >= WF_V2_VOWEL_SPAN_MAX
        ? "consonant"
        : null;
    const bound = only === "vowel" ? VOWEL_TOTAL_V2 : only === "consonant" ? WEIGHT_TOTAL_V2 - VOWEL_TOTAL_V2 : WEIGHT_TOTAL_V2;
    letters.push(pickLetterV2(draw(bound), only));
  }
  return letters;
}

/** The whole queue and column order from the seed; the rng is carried on in the state. */
export function wordfallPlan(seed: number, rev?: number): { rng: number; plan: WordfallPlan } {
  let rng = seed | 0;
  const draw = (bound: number): number => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const letters: number[] = rev === 2 ? lettersV2(draw) : [];
  for (let i = 0; i < WF_QUEUE_LEN && rev !== 2; i++) {
    // The earliest window this tile belongs to that is not yet complete.
    const end = Math.max(i, WF_VOWEL_WINDOW - 1);
    let vowels = 0;
    for (let j = end - WF_VOWEL_WINDOW + 1; j < i; j++) if (VOWELS.has(letters[j]!)) vowels++;
    // A consonant here would leave too few slots to reach the minimum.
    const mustVowel = vowels + (end - i) < WF_VOWEL_MIN;
    letters.push(pickLetter(draw(mustVowel ? VOWEL_TOTAL : WEIGHT_TOTAL), mustVowel));
  }
  const cols: number[] = [];
  let last = -1;
  while (cols.length < WF_QUEUE_LEN) {
    const bag = [0, 1, 2, 3, 4, 5];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = draw(i + 1);
      const t = bag[i]!;
      bag[i] = bag[j]!;
      bag[j] = t;
    }
    if (bag[0] === last) {
      const t = bag[0]!;
      bag[0] = bag[1]!;
      bag[1] = t;
    }
    cols.push(...bag);
    last = bag[bag.length - 1]!;
  }
  return { rng, plan: { letters, cols: cols.slice(0, WF_QUEUE_LEN) } };
}

/* ================================ State ================================ */

export interface WordfallTile {
  id: number;
  /** Letter code. */
  l: number;
  /** Top edge relative to the well's top, 1/256 px. */
  y: number;
}

export interface WordfallState {
  /** wordfallRev 3 only (score bands): 1 = the score maps points through WORDFALL_BANDS_MAP. Absent on older rounds. */
  sb?: number;
  rev: number;
  tick: number;
  rng: number;
  plan: WordfallPlan;
  /** Six columns, bottom tile first. */
  well: WordfallTile[][];
  nextId: number;
  /** Drops made so far (the next uses queue tile 18 + drops). */
  drops: number;
  nextDrop: number;
  /** Tile ids in chain order. */
  chain: number[];
  points: number;
  words: number;
  /** Tiles cleared by words. */
  cleared: number;
  invalid: number;
  submits: number;
  taps: number;
  /** Longest word found, in letters. */
  longest: number;
  /** Up to five best words (most points, then longest, then earliest), as letter codes. */
  best: number[][];
  lastWord: number[];
  lastWordTick: number;
  /** Ids of the last refused chain, shaking until shakeTick + WF_SHAKE_TICKS. */
  shake: number[];
  shakeTick: number;
  /** 1 once a tile could not enter a full column. */
  over: number;
  overTick: number;
  overCol: number;
  /** Recent events, packed tick·64 + code·8 + extra (0-7). */
  log: number[];
}

/** Resting top of the tile at stack index `index` (0 = bottom), 1/256 px. */
export function wfRestY(index: number): number {
  return (WF_ROWS - 1 - index) * WF_CELL * 256;
}

export function wfSettled(tile: WordfallTile, index: number): boolean {
  return tile.y === wfRestY(index);
}

function init(seed: number): WordfallState {
  return initRev(seed, WORDFALL_REV1);
}

function initV2(seed: number): WordfallState {
  return initRev(seed, 2);
}

function initRev(seed: number, rev: number): WordfallState {
  const built = wordfallPlan(seed, rev);
  const well: WordfallTile[][] = Array.from({ length: WF_COLS }, () => []);
  let nextId = 0;
  for (let row = 0; row < WF_START_ROWS; row++) {
    for (let col = 0; col < WF_COLS; col++) {
      well[col]!.push({ id: nextId, l: built.plan.letters[nextId]!, y: wfRestY(row) });
      nextId++;
    }
  }
  return {
    rev,
    tick: 0,
    rng: built.rng,
    plan: built.plan,
    well,
    nextId,
    drops: 0,
    nextDrop: rev === 2 ? WF_FIRST_DROP_V2 : WF_FIRST_DROP,
    chain: [],
    points: 0,
    words: 0,
    cleared: 0,
    invalid: 0,
    submits: 0,
    taps: 0,
    longest: 0,
    best: [],
    lastWord: [],
    lastWordTick: -100,
    shake: [],
    shakeTick: -100,
    over: 0,
    overTick: 0,
    overCol: -1,
    log: [],
  };
}

function isOver(state: WordfallState): boolean {
  return state.over === 1 || state.tick >= WF_RUN_TICKS;
}

function pushLog(log: number[], tick: number, code: number, extra: number): number[] {
  const out = [...log, tick * 64 + code * 8 + clampInt(extra, 0, 7)];
  return out.length > LOG_KEEP ? out.slice(out.length - LOG_KEEP) : out;
}

export function unpackWfLog(entry: number): { tick: number; code: number; extra: number } {
  return { tick: Math.floor(entry / 64), code: Math.floor(entry / 8) % 8, extra: entry % 8 };
}

/** Where a tile is: column and stack index (0 = bottom), or null. */
export function wfFind(well: readonly WordfallTile[][], id: number): { col: number; index: number; tile: WordfallTile } | null {
  for (let col = 0; col < well.length; col++) {
    const stack = well[col]!;
    for (let index = 0; index < stack.length; index++) {
      if (stack[index]!.id === id) return { col, index, tile: stack[index]! };
    }
  }
  return null;
}

/** The settled tile under a world point, or null (falling tiles can't be picked). */
export function wfTileAt(well: readonly WordfallTile[][], x: number, y: number): { col: number; index: number; tile: WordfallTile } | null {
  const dx = x - WF_WELL_X;
  const dy = (y - WF_WELL_Y) * 256;
  if (dx < 0 || dx >= WF_WELL_W) return null;
  const col = Math.floor(dx / WF_CELL);
  const stack = well[col]!;
  for (let index = 0; index < stack.length; index++) {
    const tile = stack[index]!;
    if (dy >= tile.y && dy < tile.y + WF_CELL * 256) return wfSettled(tile, index) ? { col, index, tile } : null;
  }
  return null;
}

/** Rank for the best-words list: points, then length, earlier words first on ties. */
function better(a: readonly number[], b: readonly number[]): boolean {
  const la = wfWord(a).length;
  const lb = wfWord(b).length;
  const pa = wfWordPoints(la);
  const pb = wfWordPoints(lb);
  return pa !== pb ? pa > pb : la > lb;
}

function submit(state: WordfallState, next: WordfallState, tick: number): void {
  if (state.chain.length === 0) return;
  next.submits = state.submits + 1;
  const found = state.chain.map((id) => wfFind(next.well, id));
  const letters = found.map((f) => f?.tile.l ?? 0);
  const word = wfWord(letters);
  const ok = found.every(Boolean) && word.length >= WF_MIN_WORD && isWordfallWord(word);
  next.chain = [];
  if (!ok) {
    next.invalid = state.invalid + 1;
    next.shake = [...state.chain];
    next.shakeTick = tick;
    next.log = pushLog(next.log, tick, WF_LOG_BAD, Math.min(7, state.chain.length));
    return;
  }
  const gone = new Set(state.chain);
  next.well = next.well.map((stack) => (stack.some((t) => gone.has(t.id)) ? stack.filter((t) => !gone.has(t.id)) : stack));
  next.points = state.points + wfWordPoints(word.length);
  next.words = state.words + 1;
  next.cleared = state.cleared + state.chain.length;
  next.longest = Math.max(state.longest, word.length);
  next.lastWord = letters;
  next.lastWordTick = tick;
  const best = [...state.best];
  let at = best.length;
  while (at > 0 && better(letters, best[at - 1]!)) at--;
  best.splice(at, 0, letters);
  next.best = best.slice(0, WF_BEST_KEEP);
  next.log = pushLog(next.log, tick, WF_LOG_WORD, Math.min(7, word.length));
}

function tap(state: WordfallState, next: WordfallState, x: number, y: number, tick: number): void {
  if (state.rev === 2 && wfInEnterV2(x, y)) {
    submit(state, next, tick);
    return;
  }
  const hit = wfTileAt(next.well, x, y);
  if (!hit) {
    next.log = pushLog(next.log, tick, WF_LOG_MISS, 0);
    return;
  }
  const chain = state.chain;
  const at = chain.indexOf(hit.tile.id);
  if (at >= 0 && at === chain.length - 1) {
    submit(state, next, tick);
    return;
  }
  if (at >= 0) {
    // Back along the chain: keep it up to the tapped tile.
    next.chain = chain.slice(0, at + 1);
  } else if (chain.length > 0) {
    const last = wfFind(next.well, chain[chain.length - 1]!);
    const adjacent = last !== null &&
      Math.abs(last.col - hit.col) <= 1 &&
      Math.abs(last.index - hit.index) <= 1;
    if (adjacent && chain.length < WF_MAX_CHAIN) next.chain = [...chain, hit.tile.id];
    else if (!adjacent) next.chain = [hit.tile.id];
  } else {
    next.chain = [hit.tile.id];
  }
  next.log = pushLog(next.log, tick, WF_LOG_PICK, hit.col);
}

function step(state: WordfallState, input: ArcadeInputEvent | null): WordfallState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const next: WordfallState = { ...state, tick };

  // Fall: every tile above its resting place drops, never past it.
  let falling = false;
  for (let col = 0; col < WF_COLS && !falling; col++) {
    const stack = state.well[col]!;
    for (let index = 0; index < stack.length; index++) {
      if (stack[index]!.y < wfRestY(index)) {
        falling = true;
        break;
      }
    }
  }
  if (falling) {
    const fall = state.rev === 2 ? WF_FALL_V2 : WF_FALL;
    next.well = state.well.map((stack) =>
      stack.map((tile, index) => {
        const rest = wfRestY(index);
        return tile.y < rest ? { ...tile, y: Math.min(rest, tile.y + fall) } : tile;
      }),
    );
  }

  // Drop: the next queue tile enters its seeded column, or the run ends.
  if (tick >= state.nextDrop) {
    const col = state.plan.cols[state.drops % WF_QUEUE_LEN]!;
    const letter = state.plan.letters[(WF_START_TILES + state.drops) % WF_QUEUE_LEN]!;
    if (next.well[col]!.length >= WF_ROWS) {
      next.over = 1;
      next.overTick = tick;
      next.overCol = col;
      next.chain = [];
      next.log = pushLog(next.log, tick, WF_LOG_FULL, col);
      return next;
    }
    next.well = next.well.map((stack, c) =>
      c === col ? [...stack, { id: state.nextId, l: letter, y: -WF_CELL * 256 }] : stack,
    );
    next.nextId = state.nextId + 1;
    next.drops = state.drops + 1;
    next.nextDrop = tick + wfDropInterval(tick, state.rev);
    next.log = pushLog(next.log, tick, WF_LOG_DROP, col);
  }

  if (input && input.k === WF_INPUT_TAP) {
    next.taps = state.taps + 1;
    tap(state, next, clampInt(input.a, 0, WF_W), clampInt(input.b, 0, wfWorldH(state)), tick);
  } else if (input && input.k === WF_INPUT_ENTER) {
    submit(state, next, tick);
  }
  return next;
}

/** floor(150 × min(points, par) ÷ par). */
export function wordfallScore(points: number, par = WF_PAR): number {
  if (par <= 0) return 0;
  return Math.floor((150 * clampInt(Math.trunc(points), 0, par)) / par);
}

function score(state: WordfallState): number {
  return state.sb ? bandMapTotal(WORDFALL_BANDS_MAP, state.points) : wordfallScore(state.points);
}

/** The word currently chained, for display. */
export function wordfallChainWord(state: WordfallState): string {
  return wfWord(state.chain.map((id) => wfFind(state.well, id)?.tile.l ?? 0));
}

/* ============================= Checkpoints ============================= */

export const WF_CHECKPOINT_INTERVAL = 300;

export const WF_CHECKPOINT_KEYS = [
  "tick", "points", "words", "cleared", "invalid", "taps", "drops", "chainLen", "wellHash", "over", "rng", "checksum",
] as const;

export interface WordfallCheckpoint {
  tick: number;
  points: number;
  words: number;
  cleared: number;
  invalid: number;
  taps: number;
  drops: number;
  chainLen: number;
  wellHash: number;
  over: number;
  rng: number;
  checksum: number;
}

export function wordfallCheckpoint(state: WordfallState): WordfallCheckpoint {
  let wellHash = 0;
  state.well.forEach((stack, col) => {
    for (const t of stack) wellHash = (Math.imul(wellHash, 31) + t.id * 7 + col + Math.imul(t.y, 3) + t.l) | 0;
  });
  for (const id of state.chain) wellHash = (Math.imul(wellHash, 17) + id) | 0;
  const snapshot = {
    tick: state.tick,
    points: state.points,
    words: state.words,
    cleared: state.cleared,
    invalid: state.invalid,
    taps: state.taps,
    drops: state.drops,
    chainLen: state.chain.length,
    wellHash,
    over: state.over,
    rng: state.rng,
  };
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snapshot)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* =============================== Drawing =============================== */

/** Plain fallback drawing; the toybox art lives in wordfall.renderer.ts. */
function draw(ctx: CanvasRenderingContext2D, state: WordfallState, size: CanvasSize): void {
  ctx.save();
  const worldH = wfWorldH(state);
  ctx.scale(size.width / WF_W, size.height / worldH);
  ctx.fillStyle = "#2A1C14";
  ctx.fillRect(0, 0, WF_W, worldH);
  ctx.fillStyle = "#C99A62";
  ctx.fillRect(WF_WELL_X, WF_WELL_Y, WF_WELL_W, WF_WELL_H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 28px ui-monospace, monospace";
  state.well.forEach((stack, col) => {
    for (const t of stack) {
      const x = WF_WELL_X + col * WF_CELL;
      const y = WF_WELL_Y + t.y / 256;
      ctx.fillStyle = state.chain.includes(t.id) ? "#D4A84A" : "#F3E2C0";
      ctx.fillRect(x + 2, y + 2, WF_CELL - 4, WF_CELL - 4);
      ctx.fillStyle = "#2B1A0E";
      ctx.fillText(wfLabel(t.l), x + WF_CELL / 2, y + WF_CELL / 2);
    }
  });
  ctx.restore();
}

export const wordfallGame: ArcadeGame<WordfallState, ArcadeInputEvent | null> = {
  key: "wordfall",
  runTicks: WF_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: WF_INPUT_RANGES,
};

/** wordfallRev 2: slower drops, fewer vowels, the Enter box in the world (same step; `rev` picks the rules). */
export const wordfallGameV2: ArcadeGame<WordfallState, ArcadeInputEvent | null> = {
  ...wordfallGame,
  init: initV2,
  inputRanges: WF_INPUT_RANGES_V2,
};

/** The sim for a stored revision: 2 is today's rules; 1 (and unstamped, which never existed) the original. */
export function wordfallGameFor(rev?: number): typeof wordfallGame {
  if (rev === WORDFALL_REV_BANDS) return wordfallGameV3;
  return rev === 2 ? wordfallGameV2 : wordfallGame;
}

/* ================= Score bands (wordfallRev 3, 19 Oct 2026) ================= */

/**
 * wordfallRev 3 (score bands, docs/scoring-targets.md): wordfallRev 2 play (the state keeps rev 2), scored on
 * points through WORDFALL_BANDS_MAP instead of 150 at par (30 points): the simulated average / good / great /
 * near-perfect players make about 21 / 31 / 34 / 35 points, so par alone no longer makes 150.
 */
export const WORDFALL_REV_BANDS = 3;
/** wordfallRev 3: the word points that score 150 (the band map's top knot). */
export const WORDFALL_BANDS_FULL_POINTS = 46;
export const WORDFALL_BANDS_MAP = bandCurve([0, 21, 31, 35, 40, WORDFALL_BANDS_FULL_POINTS], [0, 70, 100, 120, 140, 150]);
export const wordfallGameV3: ArcadeGame<WordfallState, ArcadeInputEvent | null> = { ...wordfallGameV2, init: (seed) => ({ ...wordfallGameV2.init(seed), sb: 1 }) };
/** The rules a stored revision plays (rev 3 plays rev 2). */
export function wordfallPlayRev(rev?: number): number | undefined {
  return rev === WORDFALL_REV_BANDS ? 2 : rev;
}
