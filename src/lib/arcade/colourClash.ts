/** Deterministic Colour Clash falling-word lane game. */
import { speedBonusCurve } from "../duel/speedPar";
import { bandCurve, bandMapTotal } from "./scoreBands";
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

export const CLASH_WORLD_W = 390;
export const CLASH_WORLD_H = 560;
export const CLASH_RUN_TICKS = 60 * TICKS_PER_SECOND;
export const CLASH_INITIAL_LANES = 3;
export const CLASH_EXPANDED_LANES = 4;
export const CLASH_LANE_EXPAND_TICK = 30 * TICKS_PER_SECOND;
export const CLASH_INPUT_LANE = 5;
export const CLASH_MOVE_LEFT = 0;
export const CLASH_MOVE_RIGHT = 1;
export const CLASH_DROP = 2;
export const CLASH_SET_LANE = 3;
export const CLASH_FLASH_TICKS = 30;
/** Fixed queue length for current rounds: items the no-drop cadence sorts by about 48 s. 0 = legacy open stream. */
export const CLASH_QUEUE = 52;
/** First fixed-queue revision (stored rounds keep their own length and fall times). */
export const CLASH_QUEUE_V1 = 18;
/**
 * Fixed-queue fall setting per 15 s phase. Integer speed rounding adds one
 * landing tick, so each word takes exactly 96 / 78 / 66 / 42 ticks
 * (1.60 / 1.30 / 1.10 / 0.70 s) from spawn to gate.
 */
export const CLASH_QUEUE_FALL_TICKS = [95, 77, 65, 41] as const;
/**
 * Current revision, stored as puzzle.clashRev. 4 (Oct 2026 puzzle score shape) plays exactly as 3
 * (75 s run, five 15 s phases, 52 words) and changes only the score: all 52 sorted with at most 2 wrong
 * = 120 + PAR(30) − 5 per wrong (never below 120), otherwise round(110 × right ÷ 52) − 2 per wrong gate, at most 110.
 */
export const CLASH_REV = 4;
/** The 75 s, five-phase play revision; clashRev 3 and 4 both play it. */
export const CLASH_REV_PLAY3 = 3;
/** True for a state or stamp on the 75 s, five-phase play (clashRev 3, 4 or 5). */
export function clashPlays3(rev: number | null | undefined): boolean {
  return rev === CLASH_REV_PLAY3 || rev === CLASH_REV || rev === CLASH_REV_TALL;
}
export const CLASH_REV3_RUN_TICKS = 75 * TICKS_PER_SECOND;
/** One tick shorter than 108 / 96 / 84 / 72 / 60 so each word takes exactly 1.80 / 1.60 / 1.40 / 1.20 / 1.00 s. */
export const CLASH_REV3_FALL_TICKS = [107, 95, 83, 71, 59] as const;
/** Variant key: 5 = the taller board (clashRev 5), 4 = rev-3 play with the puzzle score shape, 3 = 75 s rev 3, 2 = 52-word/60 s, 1 = 18-word, 0 = legacy stream. */
export function clashVariantOf(p: { queue?: number | null; clashRev?: number | null } | null | undefined): number {
  if (p?.clashRev === CLASH_REV_BANDS) return 6;
  if (p?.clashRev === CLASH_REV_TALL) return 5;
  if (p?.clashRev === CLASH_REV) return 4;
  if (p?.clashRev === CLASH_REV_PLAY3) return 3;
  return p?.queue === CLASH_QUEUE ? 2 : p?.queue === CLASH_QUEUE_V1 ? 1 : 0;
}
export function clashRunTicksOf(state: Pick<ClashState, "rev">): number { return clashPlays3(state.rev) ? CLASH_REV3_RUN_TICKS : CLASH_RUN_TICKS; }
export const CLASH_COMPLETE_POINTS = 130;
export const CLASH_SPEED_POINTS = 20;
const FP = 256;
const START_Y = 92 * FP;
const BASE_FALL_TICKS = 3 * TICKS_PER_SECOND;

export const CLASH_INPUT_RANGES: readonly InputRange[] = [inputRange(CLASH_INPUT_LANE, [0, 3], [0, CLASH_WORLD_W - 1])];
export const CLASH_NAMES = ["RED", "BLUE", "GREEN", "PURPLE", "PINK", "ORANGE", "BROWN", "YELLOW"] as const;
export const CLASH_COLOURS = ["#FF4D4D", "#4D8CFF", "#3DDC84", "#B26BFF", "#FF6BD6", "#FF8A3D", "#8B5A2B", "#FFE600"] as const;

export interface ClashItem { spawn: number; word: number; ink: number; fallTicks: number }
export interface ClashGateChange { tick: number; gates: number[] }
export interface ClashRuleChange { tick: number; rule: 0 | 1 }
export interface ClashState {
  /** clashRev 6 only (score bands): 1 = the clashRev 5 score mapped through CLASH_BANDS_MAP. Absent on older rounds. */
  sb?: number;
  tick: number;
  rng: number;
  items: ClashItem[];
  gates: ClashGateChange[];
  rules: ClashRuleChange[];
  lane: number;
  itemY: number;
  dropping: number;
  correct: number;
  wrong: number;
  missed: number;
  ended: number;
  /** Queue length (0 = legacy open-ended stream). */
  queue: number;
  /** Tick the last queued item was sorted (0 = not finished). */
  finishTick: number;
  /** Set only on the current 75 s revision (absent keeps older states byte-identical). */
  rev?: number;
  /** clashRev 5 only (taller worlds batch 2): the board's height in px (CLASH_TALL_H). Absent = CLASH_WORLD_H. */
  worldH?: number;
}

export function clashLaneCount(tick: number): number { return tick >= CLASH_LANE_EXPAND_TICK ? CLASH_EXPANDED_LANES : CLASH_INITIAL_LANES; }

function buildGates(seed: number, phases = 4): { gates: ClashGateChange[]; rng: number } {
  let rng = seed | 0;
  const draw = (bound: number) => { const result = rngBelow(rng, bound); rng = result.state; return result.value; };
  const firstPool = Array.from({ length: CLASH_NAMES.length }, (_, index) => index);
  const first: number[] = [];
  while (first.length < CLASH_INITIAL_LANES) {
    const colour = firstPool.splice(draw(firstPool.length), 1)[0];
    if (colour === undefined) throw new Error("Missing Colour Clash gate colour");
    first.push(colour);
  }
  const gates: ClashGateChange[] = [{ tick: 0, gates: first }];
  for (const tick of [15, 30, 45, 60].slice(0, phases - 1).map((seconds) => seconds * TICKS_PER_SECOND)) {
    const count = clashLaneCount(tick);
    const previous = gates.at(-1)?.gates ?? first;
    const kept = [...previous];
    const pool = Array.from({ length: CLASH_NAMES.length }, (_, index) => index).filter((colour) => !kept.includes(colour));
    while (kept.length < count) kept.push(pool.splice(draw(pool.length), 1)[0]!);
    for (let index = kept.length - 1; index > 0; index -= 1) {
      const other = draw(index + 1); [kept[index], kept[other]] = [kept[other]!, kept[index]!];
    }
    gates.push({ tick, gates: kept });
  }
  return { gates, rng };
}

export function clashRuleAt(_state: ClashState, tick: number): 0 | 1 {
  return (Math.floor(tick / (15 * TICKS_PER_SECOND)) % 2) as 0 | 1;
}

export function clashGatesAt(state: ClashState, tick: number): number[] {
  let current = state.gates[0]?.gates ?? [0, 1, 2];
  for (const change of state.gates) { if (change.tick > tick) break; current = change.gates; }
  return current;
}

export function clashFallTicks(tick: number, queue = 0, rev = 0): number {
  if (clashPlays3(rev)) return CLASH_REV3_FALL_TICKS[Math.min(4, Math.floor(tick / (15 * TICKS_PER_SECOND)))]!;
  const phase = Math.min(3, Math.floor(tick / (15 * TICKS_PER_SECOND)));
  if (queue === CLASH_QUEUE) return CLASH_QUEUE_FALL_TICKS[phase]!;
  return Math.round(BASE_FALL_TICKS * (0.88 ** phase));
}

function nextItem(state: ClashState, spawn: number): ClashState {
  let rng = state.rng;
  const draw = (bound: number) => { const result = rngBelow(rng, bound); rng = result.state; return result.value; };
  const gates = clashGatesAt(state, spawn);
  const rule = clashRuleAt(state, spawn);
  // Never three in a row with the same correct gate colour, across rule swaps.
  const answers = state.items.slice(-2).map((prev) => (clashRuleAt(state, prev.spawn) === 0 ? prev.ink : prev.word));
  const banned = answers.length === 2 && answers[0] === answers[1] ? answers[0] : -1;
  const answerPool = gates.filter((colour) => colour !== banned);
  const answer = answerPool[draw(answerPool.length)]!;
  const otherPool = gates.filter((colour) => colour !== answer);
  const other = otherPool[draw(otherPool.length)]!;
  const word = rule === 0 ? other : answer;
  const ink = rule === 0 ? answer : other;
  const item = { spawn, word, ink, fallTicks: clashFallTicks(spawn, state.queue, state.rev) };
  // Draw before storing rng so the spawn lane and future draws replay identically.
  const lane = draw(clashLaneCount(spawn));
  return { ...state, rng, items: [...state.items, item], lane, itemY: START_Y, dropping: 0 };
}

function initWith(seed: number, queue: number, rev = 0): ClashState {
  const phases = clashPlays3(rev) ? 5 : 4;
  const plan = buildGates(seed, phases);
  const base: ClashState = {
    tick: 0, rng: plan.rng, items: [], gates: plan.gates,
    rules: Array.from({ length: phases }, (_, phase) => phase).map((phase) => ({ tick: phase * 15 * TICKS_PER_SECOND, rule: (phase % 2) as 0 | 1 })),
    lane: 1, itemY: START_Y, dropping: 0, correct: 0, wrong: 0, missed: 0, ended: 0, queue, finishTick: 0,
    ...(clashPlays3(rev) ? { rev } : {}),
  };
  return nextItem(base, 0);
}
function init(seed: number): ClashState { return initWith(seed, 0); }
function initQueue(seed: number): ClashState { return initWith(seed, CLASH_QUEUE); }
function initRev3(seed: number): ClashState { return initWith(seed, CLASH_QUEUE, CLASH_REV_PLAY3); }
function initRev4(seed: number): ClashState { return initWith(seed, CLASH_QUEUE, CLASH_REV); }
function initRev5(seed: number): ClashState { return { ...initWith(seed, CLASH_QUEUE, CLASH_REV_TALL), worldH: CLASH_TALL_H }; }
function initQueueV1(seed: number): ClashState { return initWith(seed, CLASH_QUEUE_V1); }

function isOver(state: ClashState): boolean { return state.ended !== 0; }

function land(state: ClashState, tick: number): ClashState {
  const item = state.items.at(-1);
  if (!item) return state;
  const gates = clashGatesAt(state, tick);
  const lane = clampInt(state.lane, 0, gates.length - 1);
  const wanted = clashRuleAt(state, tick) === 0 ? item.ink : item.word;
  const correct = gates[lane] === wanted;
  const landed = { ...state, correct: state.correct + (correct ? 1 : 0), wrong: state.wrong + (correct ? 0 : 1) };
  // Fixed queue: the run ends the moment the last queued item is sorted.
  if (landed.queue > 0 && landed.correct + landed.wrong >= landed.queue) return { ...landed, ended: 1, finishTick: tick };
  return tick < clashRunTicksOf(state) ? nextItem(landed, tick) : landed;
}

function step(state: ClashState, input: ArcadeInputEvent | null): ClashState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  let next: ClashState = { ...state, tick };
  const item = next.items.at(-1);
  if (item && item.spawn <= tick) {
    const lanes = clashLaneCount(tick);
    if (next.lane >= lanes) next.lane = lanes - 1;
    if (input?.k === CLASH_INPUT_LANE) {
      const action = clampInt(input.a, 0, 3);
      if (action === CLASH_MOVE_LEFT) next.lane = Math.max(0, next.lane - 1);
      else if (action === CLASH_MOVE_RIGHT) next.lane = Math.min(lanes - 1, next.lane + 1);
      else if (action === CLASH_SET_LANE) next.lane = clampInt(Math.floor((input.b * lanes) / CLASH_WORLD_W), 0, lanes - 1);
      else if (action === CLASH_DROP) next.dropping = 1;
    }
    // clashRev 5: the gates sit lower, so a word falls (and drops) faster and lands in the same ticks.
    const gate = clashGateYFp(next);
    const speed = next.dropping ? clashDropFp(next) : Math.max(1, Math.trunc((gate - START_Y) / item.fallTicks));
    next.itemY += speed;
    if (next.itemY >= gate) next = land(next, tick);
  }
  if (next.ended === 0 && tick >= clashRunTicksOf(next)) {
    if (next.items.length > next.correct + next.wrong) next.missed += 1;
    next.ended = 1;
  }
  return next;
}

export function clashScoreOf(correct: number, wrong: number, total: number): number {
  return clampInt(Math.round((150 * correct) / Math.max(1, total)) - 2 * wrong, 0, 150);
}
/** Arcade-finish shape: round(130 × correct / N) − 2 per wrong, + round(20 × ticks left / run ticks) only when all N are sorted; clamp 0–150. */
export function clashQueueScoreOf(correct: number, wrong: number, queue: number, finishTick: number, runTicks: number = CLASH_RUN_TICKS): number {
  const base = Math.round((CLASH_COMPLETE_POINTS * correct) / Math.max(1, queue)) - 2 * wrong;
  const done = queue > 0 && correct + wrong >= queue && finishTick > 0;
  const bonus = done ? speedBonusCurve(CLASH_SPEED_POINTS, runTicks - finishTick, runTicks) : 0;
  return clampInt(base + bonus, 0, 150);
}
export function clashTimeBonusOf(state: Pick<ClashState, "queue" | "correct" | "wrong" | "finishTick" | "rev">): number {
  if (!(state.queue > 0 && state.correct + state.wrong >= state.queue && state.finishTick > 0)) return 0;
  const run = clashRunTicksOf(state);
  return Math.round((CLASH_SPEED_POINTS * Math.max(0, run - state.finishTick)) / run);
}
/** clashRev 4: a finish is every word sorted with at most this many wrong gates. */
export const CLASH_REV4_MAX_WRONG = 2;
/** clashRev 4: the queue sorted with at most CLASH_REV4_MAX_WRONG wrong (rev 1 puzzle shape's finish). */
export function clashRev4Finished(correct: number, wrong: number, queue: number, finishTick: number): boolean {
  return queue > 0 && finishTick > 0 && correct + wrong >= queue && wrong <= CLASH_REV4_MAX_WRONG;
}
/**
 * clashRev 4: finished = 120 + PAR(30) over the run − 5 per wrong gate (never below 120);
 * otherwise round(110 × right ÷ N) − 2 per wrong, clamp 0–110.
 */
export function clashRev4ScoreOf(correct: number, wrong: number, queue: number, finishTick: number, runTicks: number = CLASH_REV3_RUN_TICKS): number {
  if (clashRev4Finished(correct, wrong, queue, finishTick)) return clampInt(120 + Math.max(0, speedBonusCurve(30, runTicks - finishTick, runTicks) - 5 * wrong), 0, 150);
  return clampInt(Math.round((110 * correct) / Math.max(1, queue)) - 2 * wrong, 0, 110);
}
function score(state: ClashState): number {
  if (state.sb) return bandMapTotal(CLASH_BANDS_MAP, clashRev5ScoreOf(state.correct, state.wrong, state.queue, state.finishTick, clashRunTicksOf(state)));
  if (state.rev === CLASH_REV_TALL) return clashRev5ScoreOf(state.correct, state.wrong, state.queue, state.finishTick, clashRunTicksOf(state));
  if (state.rev === CLASH_REV) return clashRev4ScoreOf(state.correct, state.wrong, state.queue, state.finishTick, clashRunTicksOf(state));
  return state.queue > 0 ? clashQueueScoreOf(state.correct, state.wrong, state.queue, state.finishTick, clashRunTicksOf(state)) : clashScoreOf(state.correct, state.wrong, state.items.length);
}

export const CLASH_CHECKPOINT_INTERVAL = 300;
export const CLASH_CHECKPOINT_KEYS = ["tick", "lane", "itemY", "dropping", "correct", "wrong", "missed", "ended", "rng", "checksum"] as const;
export interface ClashCheckpoint { tick: number; lane: number; itemY: number; dropping: number; correct: number; wrong: number; missed: number; ended: number; rng: number; checksum: number }
export function clashCheckpoint(state: ClashState): ClashCheckpoint {
  const snap = { tick: state.tick, lane: state.lane, itemY: state.itemY, dropping: state.dropping, correct: state.correct, wrong: state.wrong, missed: state.missed, ended: state.ended, rng: state.rng | 0 };
  let checksum = 0x811c9dc5;
  // clashRev 5 (taller worlds): the board's height, last.
  for (const value of [...Object.values(snap), ...state.items.flatMap((item) => [item.spawn, item.word, item.ink, item.fallTicks]), ...(state.worldH ? [state.worldH] : [])]) { checksum ^= value | 0; checksum = Math.imul(checksum, 0x01000193) >>> 0; }
  return { ...snap, checksum };
}

function draw(ctx: CanvasRenderingContext2D, state: ClashState, size: CanvasSize): void {
  // clashRev 5: the taller board; everything under the banner sits `low` px lower.
  const low = clashDrop(state);
  const scale = Math.min(size.width / CLASH_WORLD_W, size.height / clashWorldH(state));
  const ox = (size.width - CLASH_WORLD_W * scale) / 2;
  const oy = (size.height - clashWorldH(state) * scale) / 2;
  ctx.save(); ctx.fillStyle = "#07070D"; ctx.fillRect(0, 0, size.width, size.height); ctx.translate(ox, oy); ctx.scale(scale, scale);
  const transition = state.tick % (15 * TICKS_PER_SECOND);
  const flash = transition < CLASH_FLASH_TICKS && state.tick > 0;
  const rule = clashRuleAt(state, state.tick);
  ctx.fillStyle = flash && Math.trunc(state.tick / 5) % 2 === 0 ? "#F5B82E" : "#23232C"; ctx.fillRect(65, 10, 260, 44);
  ctx.fillStyle = flash && Math.trunc(state.tick / 5) % 2 === 0 ? "#07070D" : "#F5B82E"; ctx.font = "bold 21px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.fillText(rule === 0 ? "SORT BY INK" : "SORT BY WORD", 195, 39);
  const lanes = clashLaneCount(state.tick); const laneW = 358 / lanes; const left = 16;
  for (let lane = 0; lane < lanes; lane += 1) {
    ctx.fillStyle = lane === state.lane ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.035)"; ctx.fillRect(left + lane * laneW, 66, laneW - 2, 406 + low);
    const colour = clashGatesAt(state, state.tick)[lane]!;
    ctx.save();
    ctx.shadowColor = CLASH_COLOURS[colour]!; ctx.shadowBlur = 14;
    ctx.fillStyle = CLASH_COLOURS[colour]!; ctx.fillRect(left + lane * laneW + 4, 472 + low, laneW - 10, 22);
    ctx.restore();
    ctx.fillStyle = "#FFFFFF"; ctx.font = "bold 12px ui-monospace, monospace"; ctx.fillText(CLASH_NAMES[colour]!, left + (lane + 0.5) * laneW, 512 + low);
  }
  const current = state.items.at(-1);
  if (current) {
    ctx.save();
    ctx.shadowColor = CLASH_COLOURS[current.ink]!; ctx.shadowBlur = 10;
    ctx.fillStyle = CLASH_COLOURS[current.ink]!; ctx.font = "bold 30px ui-sans-serif, sans-serif";
    ctx.fillText(CLASH_NAMES[current.word]!, left + (state.lane + 0.5) * laneW, state.itemY / FP);
    ctx.restore();
  }
  ctx.fillStyle = "#FFFFFF"; ctx.font = "bold 15px ui-monospace, monospace"; ctx.fillText(state.queue > 0 ? `${state.correct} right · ${state.wrong} wrong · ${state.queue - state.correct - state.wrong} left` : `${state.correct} right · ${state.wrong} wrong`, 195, 548 + low);
  ctx.restore();
}

/** Legacy open-ended stream: stored rounds without a queue replay with it unchanged. */
export const colourClashGame: ArcadeGame<ClashState, ArcadeInputEvent | null> = { key: "stroop", runTicks: CLASH_RUN_TICKS, init, step, isOver, score, draw, inputRanges: CLASH_INPUT_RANGES };
/** Current fixed-queue run. */
export const colourClashQueueGame: ArcadeGame<ClashState, ArcadeInputEvent | null> = { ...colourClashGame, init: initQueue };
/** 18-item revision with the legacy fall times. */
export const colourClashQueueV1Game: ArcadeGame<ClashState, ArcadeInputEvent | null> = { ...colourClashGame, init: initQueueV1 };
/** Revision 3: 75 s, five phases, 52 words. */
export const colourClashRev3Game: ArcadeGame<ClashState, ArcadeInputEvent | null> = { ...colourClashGame, runTicks: CLASH_REV3_RUN_TICKS, init: initRev3 };
/** Current revision 4: revision 3's play with the Oct 2026 puzzle score shape. */
export const colourClashRev4Game: ArcadeGame<ClashState, ArcadeInputEvent | null> = { ...colourClashGame, runTicks: CLASH_REV3_RUN_TICKS, init: initRev4 };
/** Takes a clashVariantOf key. */
export function colourClashGameFor(variant: number): ArcadeGame<ClashState, ArcadeInputEvent | null> {
  if (variant === 6) return colourClashBandsGame;
  if (variant === 5) return colourClashRev5Game;
  return variant === 4 ? colourClashRev4Game : variant === 3 ? colourClashRev3Game : variant === 2 ? colourClashQueueGame : variant === 1 ? colourClashQueueV1Game : colourClashGame;
}

/* ================= Taller worlds (clashRev 5, Oct 2026) ================= */

/**
 * clashRev 5 (taller worlds, batch 2): clashRev 4 play (the same 52 words,
 * gates, rule swaps, five 15 s phases and finish) on a taller board, 390 ×
 * CLASH_TALL_H, the same for every player. The rule banner and a word's spawn
 * point stay where they were; the gates sit CLASH_TALL_H − CLASH_WORLD_H lower,
 * so the columns are 90 px longer. A word falls at (gate − spawn) ÷ its fall
 * ticks, so it takes exactly as many ticks to land as before, and a swipe-down
 * drop is faster by the same ratio. The lanes, their widths and the lane
 * mapping are unchanged. States add `worldH`, folded into the checkpoint
 * checksum last.
 *
 * Score (re-fitted with the taller board, Oct 2026): a finish is unchanged (all
 * 52 sorted with at most 2 wrong: 120 + PAR(30) − 5 per wrong). Unfinished
 * credit counts the words sorted right less those sorted wrong, on
 * CLASH_V5_CURVE (0, then 70 at 20, 100 at 40, 110 at 46 or more): good players
 * (all 52 sorted with about six wrong) scored about 85 on clashRev 4 and about
 * 100 now; random or same-gate sorting is net negative and still scores 0.
 */
export const CLASH_REV_TALL = 5;
export const CLASH_TALL_H = 650;
const CLASH_GATE_Y_PX = 454;
const CLASH_START_Y_PX = 92;
/** A swipe-down drop moves this fast on the original board (px a tick). */
const CLASH_DROP_PX = 18;

/** The board height (px) a state plays in: clashRev 5's taller board, or the original 560. */
export function clashWorldH(state: { worldH?: number }): number {
  return state.worldH ?? CLASH_WORLD_H;
}
/** How far (px) a state's board sits lower than the original: everything under the banner moves down by it. */
export function clashDrop(state: { worldH?: number }): number {
  return clashWorldH(state) - CLASH_WORLD_H;
}
/** The gate line a word lands on, in 1/256 px. */
export function clashGateYFp(state: { worldH?: number }): number {
  return (CLASH_GATE_Y_PX + clashDrop(state)) * FP;
}
/** A word's spawn line, in 1/256 px (the same on every board). */
export const CLASH_START_Y_FP = CLASH_START_Y_PX * FP;
/** A dropped word's speed (1/256 px a tick): 18 px on the original board, in proportion on the taller one. */
export function clashDropFp(state: { worldH?: number }): number {
  if (!state.worldH) return CLASH_DROP_PX * FP;
  return Math.trunc((CLASH_DROP_PX * FP * (CLASH_GATE_Y_PX + clashDrop(state) - CLASH_START_Y_PX)) / (CLASH_GATE_Y_PX - CLASH_START_Y_PX));
}

/** clashRev 5 unfinished credit: (words right − words wrong) → points, 0 below 0, 110 at the top. */
export const CLASH_V5_CURVE = { units: [0, 20, 40, 46], points: [0, 70, 100, 110] } as const;
export function clashV5UnfinishedOf(correct: number, wrong: number): number {
  const units = Math.max(0, correct - wrong);
  const { units: u, points: p } = CLASH_V5_CURVE;
  if (units >= u[u.length - 1]!) return p[p.length - 1]!;
  for (let i = 1; i < u.length; i++) {
    if (units <= u[i]!) return Math.round(p[i - 1]! + ((p[i]! - p[i - 1]!) * (units - u[i - 1]!)) / (u[i]! - u[i - 1]!));
  }
  return 0;
}
/** clashRev 5: a finish exactly as clashRev 4; unfinished on CLASH_V5_CURVE (at most 110). */
export function clashRev5ScoreOf(correct: number, wrong: number, queue: number, finishTick: number, runTicks: number = CLASH_REV3_RUN_TICKS): number {
  if (clashRev4Finished(correct, wrong, queue, finishTick)) return clashRev4ScoreOf(correct, wrong, queue, finishTick, runTicks);
  return clampInt(clashV5UnfinishedOf(correct, wrong), 0, 110);
}

/** clashRev 5: the taller board, with the re-fitted unfinished credit. */
export const colourClashRev5Game: ArcadeGame<ClashState, ArcadeInputEvent | null> = { ...colourClashGame, runTicks: CLASH_REV3_RUN_TICKS, init: initRev5 };

/** The board height (px) a stored round plays in, by its clashVariantOf key. */
export function clashWorldHFor(variant: number): number {
  return variant === 5 || variant === 6 ? CLASH_TALL_H : CLASH_WORLD_H;
}

/* ================= Score bands (clashRev 6, 19 Oct 2026) ================= */

/**
 * clashRev 6 (score bands, docs/scoring-targets.md): clashRev 5 play (the state keeps rev 5), its score mapped so
 * the simulated average / good / great / near-perfect players' 70 / 100 / 134 / 144 land about 70 / 100 / 120 /
 * 140; 0 stays 0 and only a finish with the full speed part and no wrong gate (150) is 150.
 */
export const CLASH_REV_BANDS = 6;
export const CLASH_BANDS_MAP = bandCurve([0, 70, 100, 134, 144, 150], [0, 70, 100, 120, 140, 150]);
export const colourClashBandsGame: ArcadeGame<ClashState, ArcadeInputEvent | null> = { ...colourClashRev5Game, init: (seed) => ({ ...initRev5(seed), sb: 1 }) };
