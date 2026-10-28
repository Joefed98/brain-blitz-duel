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
  if (p?.clashRev === CLASH_REV_STANDARD) return 10;
  if (p?.clashRev === CLASH_REV_TOPUP) return 9;
  if (p?.clashRev === CLASH_REV_DEPTH) return 8;
  if (p?.clashRev === CLASH_REV_GREAT) return 7;
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

export interface ClashItem {
  spawn: number; word: number; ink: number; fallTicks: number;
  /** clashRev 8 only: 1 = a "don't sort" word (grey ink, dashed border: let it fall), 2 = a gold word. Absent = a plain word. */
  kind?: 1 | 2;
}
export interface ClashGateChange { tick: number; gates: number[] }
export interface ClashRuleChange { tick: number; rule: 0 | 1 }
export interface ClashState {
  /** clashRev 6 (score bands): 1 = the clashRev 5 score mapped through CLASH_BANDS_MAP; clashRev 7: 2 = through CLASH_GREAT_MAP. Absent on older rounds. */
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
  /** clashRev 8 only (depth to 200): the depth play's own counters (ClashDepth). Absent on every older round. */
  depth?: ClashDepth;
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
  const kind = state.depth ? clashDepthKindAt(state.depth, state.items.length) : 0;
  const item: ClashItem = kind ? { spawn, word, ink, fallTicks: clashFallTicks(spawn, state.queue, state.rev), kind } : { spawn, word, ink, fallTicks: clashFallTicks(spawn, state.queue, state.rev) };
  // Draw before storing rng so the spawn lane and future draws replay identically.
  const lane = draw(clashLaneCount(spawn));
  const next: ClashState = { ...state, rng, items: [...state.items, item], lane, itemY: START_Y, dropping: 0 };
  // clashRev 8: a new word starts untouched.
  if (state.depth?.spoiled) next.depth = { ...state.depth, spoiled: 0 };
  return next;
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
  if (state.depth) landed.depth = clashDepthAfter(state.depth, correct, item.kind === 2);
  return settled(landed, tick);
}

/** After a word is judged: the fixed queue ends on its last word, otherwise the next word spawns. */
function settled(landed: ClashState, tick: number): ClashState {
  // Fixed queue: the run ends the moment the last queued item is sorted.
  if (landed.queue > 0 && landed.correct + landed.wrong >= landed.queue) return { ...landed, ended: 1, finishTick: tick };
  return tick < clashRunTicksOf(landed) ? nextItem(landed, tick) : landed;
}

function step(state: ClashState, input: ArcadeInputEvent | null): ClashState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  let next: ClashState = { ...state, tick };
  const item = next.items.at(-1);
  if (item && item.spawn <= tick) {
    const lanes = clashLaneCount(tick);
    if (next.lane >= lanes) next.lane = lanes - 1;
    if (item.kind === 1 && next.depth) {
      // clashRev 8: a "don't sort" word falls at its own pace whatever the player does. Any input after the first
      // CLASH_SKIP_GRACE_TICKS touches it (it falls on, spoiled, and lands as a wrong word); inputs before that, or
      // once it is touched, are ignored.
      if (input?.k === CLASH_INPUT_LANE && tick - item.spawn > CLASH_SKIP_GRACE_TICKS && !next.depth.spoiled) next.depth = { ...next.depth, spoiled: 1 };
      next.itemY += Math.max(1, Math.trunc((clashGateYFp(next) - START_Y) / item.fallTicks));
      if (next.itemY >= clashGateYFp(next)) {
        // Let fall: it passes the gates without being judged by them and counts as sorted right.
        next = next.depth!.spoiled
          ? settled({ ...next, wrong: next.wrong + 1, depth: clashDepthAfter(next.depth!, false, false, true) }, tick)
          : settled({ ...next, correct: next.correct + 1, depth: { ...clashDepthAfter(next.depth!, true, false), passed: next.depth!.passed + 1 } }, tick);
      }
    } else {
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
  if (state.depth) return clashDepthScoreOf(state).total;
  if (state.sb) return bandMapTotal(state.sb === CLASH_SB_GREAT ? CLASH_GREAT_MAP : CLASH_BANDS_MAP, clashRev5ScoreOf(state.correct, state.wrong, state.queue, state.finishTick, clashRunTicksOf(state)));
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
  // clashRev 8 (depth): each word's kind and the depth counters, after everything else.
  const depth = state.depth ? [...state.items.map((item) => item.kind ?? 0), state.depth.streak, state.depth.best, state.depth.golds, state.depth.goldPts, state.depth.touched, state.depth.passed, state.depth.spoiled] : [];
  for (const value of [...Object.values(snap), ...state.items.flatMap((item) => [item.spawn, item.word, item.ink, item.fallTicks]), ...(state.worldH ? [state.worldH] : []), ...depth]) { checksum ^= value | 0; checksum = Math.imul(checksum, 0x01000193) >>> 0; }
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
  if (variant === 10) return colourClashStandardGame;
  if (variant === 9) return colourClashTopupGame;
  if (variant === 8) return colourClashDepthGame;
  if (variant === 7) return colourClashGreatGame;
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
  return variant >= 5 && variant <= 10 ? CLASH_TALL_H : CLASH_WORLD_H;
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

/* ================= Re-fit (clashRev 7, 20 Oct 2026) ================= */

/**
 * clashRev 7 (scoring report batch 2, docs/scoring-targets.md): clashRev 5 play (the state keeps rev 5), its score
 * mapped through CLASH_GREAT_MAP instead of clashRev 6's. As in every other game, an unfinished run scores at most
 * 110 (clashRev 5's best unfinished credit, every word but the last, maps to exactly 110) and a finish at least 120
 * (a finish as time runs out), so every finish clearly beats every unfinished run. Below that the curve stays smooth:
 * the simulated average player's 70 stays 70, good's 103 is 100; near-perfect's 144 is 140. 0 stays 0 and only a
 * finish with the full speed part and no wrong gate (150) is 150. The simulated great player times out a word or two
 * short on about half its runs (107–110), so its median sits at 110, the foot of "great".
 */
export const CLASH_REV_GREAT = 7;
export const CLASH_SB_GREAT = 2;
export const CLASH_GREAT_MAP = bandCurve([0, 70, 103, 110, 120, 144, 150], [0, 70, 100, 110, 120, 140, 150]);
export const colourClashGreatGame: ArcadeGame<ClashState, ArcadeInputEvent | null> = { ...colourClashRev5Game, init: (seed) => ({ ...initRev5(seed), sb: CLASH_SB_GREAT }) };

/* ================= Depth to 200 (clashRev 8, 25 Oct 2026) ================= */

/**
 * clashRev 8 (depth to 200, docs/depth/d3-speed-attention.md): clashRev 5 play on the taller board (the state keeps
 * rev 5: the same 52-word queue, gates, rule swaps, lane shuffles, 75 s and fall-speed ramp) with three new kinds of
 * play, planned once from the seed at the start (the same for every player):
 *   - a sort streak: words sorted right in a row (a wrong gate or a touched "don't sort" word resets it);
 *   - "don't sort" words (CLASH_SKIPS): grey ink in a dashed frame, falling at the phase's own pace whatever the
 *     player does. Let it fall: it slides through the gates and counts as sorted right. Any input on it after
 *     CLASH_SKIP_GRACE_TICKS touches it: it falls on, spoiled, and lands as a wrong word;
 *   - gold words (CLASH_GOLDS): gold-bordered; sorted right they add CLASH_GOLD_POINTS, doubled while the streak
 *     before it is CLASH_GOLD_STREAK or more.
 * Score (to 200, fitted on the puzzle-fairness kit's players: average / good / great / near-perfect stay within a few
 * points of clashRev 7's medians, the elite player reaches about 190): clashRev 7's score of the run (CLASH_GREAT_MAP
 * over the clashRev 5 shape; a touch counts as a wrong gate; a finish allows CLASH_DEPTH_MAX_WRONG wrong, one more
 * than before for the five traps; each word let fall is timed as a quick sort, CLASH_SKIP_PACE_TICKS), and on a
 * finish:
 *   - gold: 2 a gold word, 4 on a streak of 5+ (20 for all five), × pace;
 *   - streak: CLASH_STREAK_POINTS × share² × pace, share = (longest streak − 12) ÷ 40 (20 for all 52 in a row);
 *   - stretch: a clean finish (no wrong word) quicker than par, CLASH_STRETCH_POINTS × (par − finish) ÷ (par −
 *     CLASH_ELITE_TICK), par = half the run (where clashRev 7's speed part tops out);
 *   pace = 1 by par, falling evenly to 0 at CLASH_PACE_ZERO_TICK. A word lands about 0.7 s after it appears at best,
 *   so the game's pace barely goes below par: the extra 50 is mostly clean, quick play through the new words.
 * An unfinished run scores clashRev 7's (at most 110), a finish at least 120.
 */
export const CLASH_REV_DEPTH = 8;
export const CLASH_SKIPS = 5;
export const CLASH_GOLDS = 5;
/**
 * A "don't sort" word falls at its phase's own pace (1.8 s down to 1.0 s); the speed parts measure a finish with
 * each one counted at 42 ticks (0.7 s, a quick sort), so waiting for it never costs speed points.
 */
export const CLASH_SKIP_PACE_TICKS = 42;
/** Inputs on a "don't sort" word in its first 0.1 s are ignored, never a touch. */
export const CLASH_SKIP_GRACE_TICKS = 6;
export const CLASH_GOLD_POINTS = 2;
export const CLASH_GOLD_STREAK = 5;
/** The streak bonus: CLASH_STREAK_POINTS × (longest streak − CLASH_STREAK_FROM) ÷ (queue − CLASH_STREAK_FROM), all at a whole run without a slip. */
export const CLASH_STREAK_POINTS = 20;
export const CLASH_STREAK_FROM = 12;
export const CLASH_STRETCH_POINTS = 10;
/** A finish's pace share for the gold and streak points: 1 by par (37.5 s), falling evenly to 0 at 40 s. */
export const CLASH_PACE_ZERO_TICK = 40 * TICKS_PER_SECOND;
/** The clean finish that earns the whole speed stretch (36.5 s into the run; clashRev 7's speed part tops out at 37.5 s). */
export const CLASH_ELITE_TICK = 2190;
export const CLASH_UNFINISHED_TOP = 110;
/** The first word that can be special, and the size of the blocks the specials are spread over (one of each per block). */
const CLASH_SPECIAL_FROM = 4;

export interface ClashDepth {
  /** Item indices of the "don't sort" words and of the gold words, ascending. */
  skips: number[];
  goldAt: number[];
  /** Words right in a row now, and the longest such run. */
  streak: number;
  best: number;
  /** Gold words sorted right, and the points they earned. */
  golds: number;
  goldPts: number;
  /** "Don't sort" words touched, and let fall. */
  touched: number;
  passed: number;
  /** 1 while the falling "don't sort" word has been touched (it lands as a wrong word). */
  spoiled: number;
  /** clashRev 9 (the puzzle top-up): the score revision the run is scored on. Absent on clashRev 8 (never in the checkpoint). */
  scoreRev?: number;
}

/** The plan: one "don't sort" and one gold word in each of five blocks of the queue from word 5, never side by side. */
function clashDepthPlan(rng: number): { depth: ClashDepth; rng: number } {
  let state = rng | 0;
  const drawN = (bound: number) => { const r = rngBelow(state, bound); state = r.state; return r.value; };
  const block = Math.floor((CLASH_QUEUE - CLASH_SPECIAL_FROM) / CLASH_SKIPS);
  const skips: number[] = [];
  const goldAt: number[] = [];
  for (let b = 0; b < CLASH_SKIPS; b += 1) {
    const from = CLASH_SPECIAL_FROM + b * block;
    // Two slots, at least two apart, from offsets 1–7 of the 9-word block (so specials never sit side by side).
    const a = 1 + drawN(block - 2);
    const options = Array.from({ length: block - 2 }, (_, i) => i + 1).filter((o) => Math.abs(o - a) >= 2);
    const g = options[drawN(options.length)]!;
    if (drawN(2) === 0) { skips.push(from + a); goldAt.push(from + g); } else { skips.push(from + g); goldAt.push(from + a); }
  }
  skips.sort((x, y) => x - y);
  goldAt.sort((x, y) => x - y);
  return { depth: { skips, goldAt, streak: 0, best: 0, golds: 0, goldPts: 0, touched: 0, passed: 0, spoiled: 0 }, rng: state };
}

/** The kind of the item at queue index `index` on a depth plan (0 plain, 1 "don't sort", 2 gold). */
export function clashDepthKindAt(depth: ClashDepth, index: number): 0 | 1 | 2 {
  return depth.skips.includes(index) ? 1 : depth.goldAt.includes(index) ? 2 : 0;
}

/** The counters after one word is judged: right or wrong, a gold word, a touched "don't sort" word. */
function clashDepthAfter(d: ClashDepth, right: boolean, gold: boolean, touched = false): ClashDepth {
  const streak = right ? d.streak + 1 : 0;
  const goldPts = right && gold ? CLASH_GOLD_POINTS * (d.streak >= CLASH_GOLD_STREAK ? 2 : 1) : 0;
  return {
    ...d,
    streak,
    best: Math.max(d.best, streak),
    golds: d.golds + (right && gold ? 1 : 0),
    goldPts: d.goldPts + goldPts,
    touched: d.touched + (touched ? 1 : 0),
    passed: d.passed,
  };
}

export interface ClashDepthScore {
  /** clashRev 7's score of the same run (a touch counts as a wrong gate). */
  base: number;
  gold: number;
  streak: number;
  stretch: number;
  total: number;
  finished: boolean;
}

/** clashRev 8: a finish is every word sorted (or let fall) with at most CLASH_DEPTH_MAX_WRONG wrong. */
export const CLASH_DEPTH_MAX_WRONG = 3;
export function clashDepthFinished(correct: number, wrong: number, queue: number, finishTick: number): boolean {
  return queue > 0 && finishTick > 0 && correct + wrong >= queue && wrong <= CLASH_DEPTH_MAX_WRONG;
}

/** The finish tick the speed parts measure (CLASH_SKIP_PACE_TICKS); 0 for a run that did not finish. */
export function clashDepthPaceTick(state: ClashState): number {
  if (!(state.finishTick > 0)) return state.finishTick;
  let credit = 0;
  for (const item of state.items) if (item.kind === 1) credit += Math.max(0, item.fallTicks + 1 - CLASH_SKIP_PACE_TICKS);
  return Math.max(1, state.finishTick - credit);
}

/** clashRev 8's score and its parts (clashRev 10: the scoring standard's, clashStandardScoreOf). */
export function clashDepthScoreOf(state: ClashState): ClashDepthScore {
  if (state.depth?.scoreRev === CLASH_REV_STANDARD) return clashStandardScoreOf(state);
  const run = clashRunTicksOf(state);
  const finished = clashDepthFinished(state.correct, state.wrong, state.queue, state.finishTick);
  const finishTick = clashDepthPaceTick(state);
  // clashRev 7's score with the depth finish (one more wrong word allowed, for the five "don't sort" words).
  const rev5 = finished
    ? clampInt(120 + Math.max(0, speedBonusCurve(30, run - finishTick, run) - 5 * state.wrong), 0, 150)
    : clampInt(clashV5UnfinishedOf(state.correct, state.wrong), 0, 110);
  const base = bandMapTotal(CLASH_GREAT_MAP, rev5);
  const par = Math.floor(run / 2);
  // The pace share (finishes only): gold and streak points are worth the most on a quick run.
  const topup = state.depth?.scoreRev === CLASH_REV_TOPUP;
  const zero = topup ? CLASH_TOPUP_PACE_ZERO_TICK : CLASH_PACE_ZERO_TICK;
  const quick = finished ? clampInt(zero - Math.max(par, finishTick), 0, zero - par) / (zero - par) : 0;
  const pace = finished && topup ? CLASH_TOPUP_PACE_FLOOR + (1 - CLASH_TOPUP_PACE_FLOOR) * quick : quick;
  const gold = Math.round((state.depth?.goldPts ?? 0) * pace);
  const span = Math.max(1, state.queue - CLASH_STREAK_FROM);
  const share = clampInt((state.depth?.best ?? 0) - CLASH_STREAK_FROM, 0, span) / span;
  const streak = finished ? Math.round(CLASH_STREAK_POINTS * share * share * pace) : 0;
  if (!finished) {
    // Unfinished: clashRev 7's score alone (at most 110), so every finish still scores more.
    return { base, gold: 0, streak: 0, stretch: 0, total: clampInt(base, 0, CLASH_UNFINISHED_TOP), finished };
  }
  const clean = state.wrong === 0;
  const stretch = clean ? Math.round((CLASH_STRETCH_POINTS * clampInt(par - finishTick, 0, par - CLASH_ELITE_TICK)) / (par - CLASH_ELITE_TICK)) : 0;
  return { base, gold, streak, stretch, total: clampInt(base + gold + streak + stretch, 0, 200), finished };
}

function initDepth(seed: number): ClashState {
  // The gates as clashRev 5, then the depth plan from the same stream, then the first word.
  const phases = 5;
  const plan = buildGates(seed, phases);
  const depth = clashDepthPlan(plan.rng);
  const base: ClashState = {
    tick: 0, rng: depth.rng, items: [], gates: plan.gates,
    rules: Array.from({ length: phases }, (_, phase) => phase).map((phase) => ({ tick: phase * 15 * TICKS_PER_SECOND, rule: (phase % 2) as 0 | 1 })),
    lane: 1, itemY: START_Y, dropping: 0, correct: 0, wrong: 0, missed: 0, ended: 0, queue: CLASH_QUEUE, finishTick: 0,
    rev: CLASH_REV_TALL, worldH: CLASH_TALL_H, depth: depth.depth,
  };
  return nextItem(base, 0);
}

/** clashRev 8: depth to 200 on the taller board. */
export const colourClashDepthGame: ArcadeGame<ClashState, ArcadeInputEvent | null> = { ...colourClashRev5Game, init: initDepth };

/**
 * clashRev 9 (the puzzle top-up, 26 Oct 2026, docs/depth/topup-oct-2026.md): clashRev 8's play exactly (the same plan,
 * words and checkpoints); a finish's gold and streak points keep CLASH_TOPUP_PACE_FLOOR of their value at any finishing
 * time and the rest falls to nothing at CLASH_TOPUP_PACE_ZERO_TICK (clashRev 8: all of it by 40 s), so today's
 * near-perfect run lands about 165–175.
 */
export const CLASH_REV_TOPUP = 9;
export const CLASH_TOPUP_PACE_ZERO_TICK = 45 * TICKS_PER_SECOND;
export const CLASH_TOPUP_PACE_FLOOR = 0.3;
function initTopup(seed: number): ClashState {
  const s = initDepth(seed);
  return { ...s, depth: { ...s.depth!, scoreRev: CLASH_REV_TOPUP } };
}
export const colourClashTopupGame: ArcadeGame<ClashState, ArcadeInputEvent | null> = { ...colourClashRev5Game, init: initTopup };

/* ================= The scoring standard (clashRev 10, 27 Oct 2026) ================= */

/**
 * clashRev 10 (the puzzle scoring standard, docs/scoring-standard.md "Speed and Attention decisions"): clashRev 9's
 * play exactly (the same plan, words, specials and checkpoints; only `depth.scoreRev` differs, and it is never in the
 * checkpoint), scored on the standard's shape. Integer arithmetic on the sim's own counters:
 *   - a finish (clashDepthFinished: all 52 sorted or let fall, at most CLASH_DEPTH_MAX_WRONG wrong) = 150
 *     + speed: CLASH_STD_SPEED in full by CLASH_STD_FULL_BY_TICK (50 s, words let fall timed as quick sorts,
 *       clashDepthPaceTick), falling evenly to 0 at the end of the run (75 s), less a sixth for each wrong word
 *       (today's 5 off the 30 speed points)
 *     + streak: CLASH_STD_STREAK × (longest streak − CLASH_STREAK_FROM) ÷ (queue − CLASH_STREAK_FROM)
 *     + gold: CLASH_STD_GOLD for each gold word sorted right (five of them);
 *   - unfinished: CLASH_STD_SHARE × (words right − words wrong) ÷ the queue, plus the streak and gold points (both are
 *     earned mid-run), at most CLASH_STD_UNFINISHED_TOP; nothing at all while the words right do not outnumber the
 *     words wrong (an idle or random run).
 * The breakdown's `base` is 150 on a finish (the share on an unfinished run), `stretch` the speed points.
 */
export const CLASH_REV_STANDARD = 10;
export const CLASH_STD_SHARE = 130;
export const CLASH_STD_SPEED = 15;
export const CLASH_STD_FULL_BY_TICK = 50 * TICKS_PER_SECOND;
export const CLASH_STD_STREAK = 20;
export const CLASH_STD_GOLD = 3;
export const CLASH_STD_FINISH = 150;
export const CLASH_STD_UNFINISHED_TOP = 130;
/** Wrong words take this share each (in sixths) off the speed points: today's 5 of 30. */
const CLASH_STD_WRONG_SIXTHS = 6;

/** Rounds num ÷ den (both whole, den > 0) to the nearest whole number, halves up. */
function roundDiv(num: number, den: number): number {
  return Math.floor((2 * num + den) / (2 * den));
}

export function clashStandardScoreOf(state: ClashState): ClashDepthScore {
  const run = clashRunTicksOf(state);
  const finished = clashDepthFinished(state.correct, state.wrong, state.queue, state.finishTick);
  const span = Math.max(1, state.queue - CLASH_STREAK_FROM);
  const streak = roundDiv(CLASH_STD_STREAK * clampInt((state.depth?.best ?? 0) - CLASH_STREAK_FROM, 0, span), span);
  const gold = CLASH_STD_GOLD * (state.depth?.golds ?? 0);
  if (!finished) {
    const share = roundDiv(CLASH_STD_SHARE * Math.max(0, state.correct - state.wrong), Math.max(1, state.queue));
    // The extras count only on a run that sorted more right than wrong: an idle or random run (words landing in the lane
    // they fall to) earns nothing, though a gold word may land right by chance.
    return { base: share, gold, streak, stretch: 0, total: share > 0 ? clampInt(share + streak + gold, 0, CLASH_STD_UNFINISHED_TOP) : 0, finished };
  }
  const window = run - CLASH_STD_FULL_BY_TICK;
  const left = clampInt(run - clashDepthPaceTick(state), 0, window);
  const keep = Math.max(0, CLASH_STD_WRONG_SIXTHS - state.wrong);
  const speed = roundDiv(CLASH_STD_SPEED * left * keep, window * CLASH_STD_WRONG_SIXTHS);
  return { base: CLASH_STD_FINISH, gold, streak, stretch: speed, total: clampInt(CLASH_STD_FINISH + speed + streak + gold, 0, 200), finished };
}

function initStandard(seed: number): ClashState {
  const s = initDepth(seed);
  return { ...s, depth: { ...s.depth!, scoreRev: CLASH_REV_STANDARD } };
}
/** clashRev 10: clashRev 9's play, scored on the standard. */
export const colourClashStandardGame: ArcadeGame<ClashState, ArcadeInputEvent | null> = { ...colourClashRev5Game, init: initStandard };
