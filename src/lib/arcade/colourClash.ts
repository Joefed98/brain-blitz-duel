/** Deterministic Colour Clash falling-word lane game. */
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
export const CLASH_COMPLETE_POINTS = 130;
export const CLASH_SPEED_POINTS = 20;
const FP = 256;
const START_Y = 92 * FP;
const GATE_Y = 454 * FP;
const BASE_FALL_TICKS = 3 * TICKS_PER_SECOND;

export const CLASH_INPUT_RANGES: readonly InputRange[] = [inputRange(CLASH_INPUT_LANE, [0, 3], [0, CLASH_WORLD_W - 1])];
export const CLASH_NAMES = ["RED", "BLUE", "GREEN", "PURPLE", "PINK", "ORANGE", "BROWN", "YELLOW"] as const;
export const CLASH_COLOURS = ["#FF4D4D", "#4D8CFF", "#3DDC84", "#B26BFF", "#FF6BD6", "#FF8A3D", "#8B5A2B", "#FFE600"] as const;

export interface ClashItem { spawn: number; word: number; ink: number; fallTicks: number }
export interface ClashGateChange { tick: number; gates: number[] }
export interface ClashRuleChange { tick: number; rule: 0 | 1 }
export interface ClashState {
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
}

export function clashLaneCount(tick: number): number { return tick >= CLASH_LANE_EXPAND_TICK ? CLASH_EXPANDED_LANES : CLASH_INITIAL_LANES; }

function buildGates(seed: number): { gates: ClashGateChange[]; rng: number } {
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
  for (const tick of [15, 30, 45].map((seconds) => seconds * TICKS_PER_SECOND)) {
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

export function clashFallTicks(tick: number, queue = 0): number {
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
  const item = { spawn, word, ink, fallTicks: clashFallTicks(spawn, state.queue) };
  // Draw before storing rng so the spawn lane and future draws replay identically.
  const lane = draw(clashLaneCount(spawn));
  return { ...state, rng, items: [...state.items, item], lane, itemY: START_Y, dropping: 0 };
}

function initWith(seed: number, queue: number): ClashState {
  const plan = buildGates(seed);
  const base: ClashState = {
    tick: 0, rng: plan.rng, items: [], gates: plan.gates,
    rules: [0, 1, 2, 3].map((phase) => ({ tick: phase * 15 * TICKS_PER_SECOND, rule: (phase % 2) as 0 | 1 })),
    lane: 1, itemY: START_Y, dropping: 0, correct: 0, wrong: 0, missed: 0, ended: 0, queue, finishTick: 0,
  };
  return nextItem(base, 0);
}
function init(seed: number): ClashState { return initWith(seed, 0); }
function initQueue(seed: number): ClashState { return initWith(seed, CLASH_QUEUE); }
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
  return tick < CLASH_RUN_TICKS ? nextItem(landed, tick) : landed;
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
    const speed = next.dropping ? 18 * FP : Math.max(1, Math.trunc((GATE_Y - START_Y) / item.fallTicks));
    next.itemY += speed;
    if (next.itemY >= GATE_Y) next = land(next, tick);
  }
  if (next.ended === 0 && tick >= CLASH_RUN_TICKS) {
    if (next.items.length > next.correct + next.wrong) next.missed += 1;
    next.ended = 1;
  }
  return next;
}

export function clashScoreOf(correct: number, wrong: number, total: number): number {
  return clampInt(Math.round((150 * correct) / Math.max(1, total)) - 2 * wrong, 0, 150);
}
/** Arcade-finish shape: round(130 × correct / N) − 2 per wrong, + round(20 × ticks left / run ticks) only when all N are sorted; clamp 0–150. */
export function clashQueueScoreOf(correct: number, wrong: number, queue: number, finishTick: number): number {
  const base = Math.round((CLASH_COMPLETE_POINTS * correct) / Math.max(1, queue)) - 2 * wrong;
  const done = queue > 0 && correct + wrong >= queue && finishTick > 0;
  const bonus = done ? Math.round((CLASH_SPEED_POINTS * Math.max(0, CLASH_RUN_TICKS - finishTick)) / CLASH_RUN_TICKS) : 0;
  return clampInt(base + bonus, 0, 150);
}
export function clashTimeBonusOf(state: Pick<ClashState, "queue" | "correct" | "wrong" | "finishTick">): number {
  if (!(state.queue > 0 && state.correct + state.wrong >= state.queue && state.finishTick > 0)) return 0;
  return Math.round((CLASH_SPEED_POINTS * Math.max(0, CLASH_RUN_TICKS - state.finishTick)) / CLASH_RUN_TICKS);
}
function score(state: ClashState): number {
  return state.queue > 0 ? clashQueueScoreOf(state.correct, state.wrong, state.queue, state.finishTick) : clashScoreOf(state.correct, state.wrong, state.items.length);
}

export const CLASH_CHECKPOINT_INTERVAL = 300;
export const CLASH_CHECKPOINT_KEYS = ["tick", "lane", "itemY", "dropping", "correct", "wrong", "missed", "ended", "rng", "checksum"] as const;
export interface ClashCheckpoint { tick: number; lane: number; itemY: number; dropping: number; correct: number; wrong: number; missed: number; ended: number; rng: number; checksum: number }
export function clashCheckpoint(state: ClashState): ClashCheckpoint {
  const snap = { tick: state.tick, lane: state.lane, itemY: state.itemY, dropping: state.dropping, correct: state.correct, wrong: state.wrong, missed: state.missed, ended: state.ended, rng: state.rng | 0 };
  let checksum = 0x811c9dc5;
  for (const value of [...Object.values(snap), ...state.items.flatMap((item) => [item.spawn, item.word, item.ink, item.fallTicks])]) { checksum ^= value | 0; checksum = Math.imul(checksum, 0x01000193) >>> 0; }
  return { ...snap, checksum };
}

function draw(ctx: CanvasRenderingContext2D, state: ClashState, size: CanvasSize): void {
  const scale = Math.min(size.width / CLASH_WORLD_W, size.height / CLASH_WORLD_H);
  const ox = (size.width - CLASH_WORLD_W * scale) / 2;
  const oy = (size.height - CLASH_WORLD_H * scale) / 2;
  ctx.save(); ctx.fillStyle = "#07070D"; ctx.fillRect(0, 0, size.width, size.height); ctx.translate(ox, oy); ctx.scale(scale, scale);
  const transition = state.tick % (15 * TICKS_PER_SECOND);
  const flash = transition < CLASH_FLASH_TICKS && state.tick > 0;
  const rule = clashRuleAt(state, state.tick);
  ctx.fillStyle = flash && Math.trunc(state.tick / 5) % 2 === 0 ? "#F5B82E" : "#23232C"; ctx.fillRect(65, 10, 260, 44);
  ctx.fillStyle = flash && Math.trunc(state.tick / 5) % 2 === 0 ? "#07070D" : "#F5B82E"; ctx.font = "bold 21px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.fillText(rule === 0 ? "SORT BY INK" : "SORT BY WORD", 195, 39);
  const lanes = clashLaneCount(state.tick); const laneW = 358 / lanes; const left = 16;
  for (let lane = 0; lane < lanes; lane += 1) {
    ctx.fillStyle = lane === state.lane ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.035)"; ctx.fillRect(left + lane * laneW, 66, laneW - 2, 406);
    const colour = clashGatesAt(state, state.tick)[lane]!;
    ctx.fillStyle = CLASH_COLOURS[colour]!; ctx.fillRect(left + lane * laneW + 4, 472, laneW - 10, 22);
    ctx.fillStyle = "#E9E9EF"; ctx.font = "bold 10px ui-monospace, monospace"; ctx.fillText(CLASH_NAMES[colour]!, left + (lane + 0.5) * laneW, 512);
  }
  const current = state.items.at(-1);
  if (current) {
    ctx.fillStyle = CLASH_COLOURS[current.ink]!; ctx.font = "bold 27px ui-sans-serif, sans-serif";
    ctx.fillText(CLASH_NAMES[current.word]!, left + (state.lane + 0.5) * laneW, state.itemY / FP);
  }
  ctx.fillStyle = "#E9E9EF"; ctx.font = "bold 13px ui-monospace, monospace"; ctx.fillText(state.queue > 0 ? `${state.correct} right · ${state.wrong} wrong · ${state.queue - state.correct - state.wrong} left` : `${state.correct} right · ${state.wrong} wrong`, 195, 548);
  ctx.restore();
}

/** Legacy open-ended stream: stored rounds without a queue replay with it unchanged. */
export const colourClashGame: ArcadeGame<ClashState, ArcadeInputEvent | null> = { key: "stroop", runTicks: CLASH_RUN_TICKS, init, step, isOver, score, draw, inputRanges: CLASH_INPUT_RANGES };
/** Current fixed-queue run. */
export const colourClashQueueGame: ArcadeGame<ClashState, ArcadeInputEvent | null> = { ...colourClashGame, init: initQueue };
/** 18-item revision with the legacy fall times. */
export const colourClashQueueV1Game: ArcadeGame<ClashState, ArcadeInputEvent | null> = { ...colourClashGame, init: initQueueV1 };
export function colourClashGameFor(queue: number | null | undefined): ArcadeGame<ClashState, ArcadeInputEvent | null> {
  return queue === CLASH_QUEUE ? colourClashQueueGame : queue === CLASH_QUEUE_V1 ? colourClashQueueV1Game : colourClashGame;
}