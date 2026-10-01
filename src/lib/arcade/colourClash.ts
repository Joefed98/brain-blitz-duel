/** Deterministic Colour Clash sorting stream. */
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
export const CLASH_WORLD_H = 620;
export const CLASH_RUN_TICKS = 45 * TICKS_PER_SECOND;
export const CLASH_INPUT_SWIPE = 4;
export const CLASH_LEFT = 0;
export const CLASH_RIGHT = 1;
export const CLASH_DOWN = 2;
export const CLASH_UP = 3;
export const CLASH_SWIPE_PX = 24;
export const CLASH_MIDDLE_TICK = 20 * TICKS_PER_SECOND;
export const CLASH_FLASH_TICKS = 30;
export const CLASH_TOTAL_ITEMS = 36;
const FALL_TICKS = 210;
const FIRST_SPAWN = 30;
const GATE_CHANGE = 8 * TICKS_PER_SECOND;
const RULE_MIN = 10 * TICKS_PER_SECOND;
const RULE_MAX = 12 * TICKS_PER_SECOND;
const FP = 256;
const START_Y = 82 * FP;
const GATE_Y = 520 * FP;
const GATE_X = [72, 318, 195] as const;

export const CLASH_INPUT_RANGES: readonly InputRange[] = [inputRange(CLASH_INPUT_SWIPE, [0, 3])];
export const CLASH_NAMES = ["RED", "BLUE", "GREEN", "PURPLE", "PINK", "ORANGE", "BROWN", "YELLOW"] as const;
export const CLASH_COLOURS = ["#FF4D4D", "#4D8CFF", "#3DDC84", "#B26BFF", "#FF6BD6", "#FF8A3D", "#8B5A2B", "#FFE600"] as const;

export interface ClashItem { spawn: number; word: number; ink: number }
export interface ClashGateChange { tick: number; gates: number[] }
export interface ClashRuleChange { tick: number; rule: 0 | 1 }
export interface ClashState {
  tick: number;
  rng: number;
  items: ClashItem[];
  gates: ClashGateChange[];
  rules: ClashRuleChange[];
  status: number[];
  sortedTick: number[];
  lowest: number;
  correct: number;
  wrong: number;
  missed: number;
  ended: number;
}

function gateColoursAt(gates: ClashGateChange[], tick: number): number[] {
  let current = gates[0]?.gates ?? [0, 1, 2];
  for (const change of gates) {
    if (change.tick > tick) break;
    current = change.gates;
  }
  return current;
}

export function clashRuleAt(state: ClashState, tick: number): 0 | 1 {
  let rule: 0 | 1 = 0;
  for (const change of state.rules) {
    if (change.tick > tick) break;
    rule = change.rule;
  }
  return rule;
}

export function clashGatesAt(state: ClashState, tick: number): number[] {
  return gateColoursAt(state.gates, tick);
}

function buildSchedule(seed: number) {
  let rng = seed | 0;
  const draw = (bound: number) => {
    const result = rngBelow(rng, bound);
    rng = result.state;
    return result.value;
  };
  const gates: ClashGateChange[] = [];
  for (let tick = 0; tick < CLASH_RUN_TICKS; tick += GATE_CHANGE) {
    const count = tick >= CLASH_MIDDLE_TICK ? 3 : 2;
    const pool = Array.from({ length: CLASH_NAMES.length }, (_, index) => index);
    const chosen: number[] = [];
    while (chosen.length < count) chosen.push(pool.splice(draw(pool.length), 1)[0]!);
    gates.push({ tick, gates: chosen });
  }
  const rules: ClashRuleChange[] = [{ tick: 0, rule: draw(2) as 0 | 1 }];
  let ruleTick = RULE_MIN + draw(RULE_MAX - RULE_MIN + 1);
  while (ruleTick < CLASH_RUN_TICKS) {
    rules.push({ tick: ruleTick, rule: rules.at(-1)?.rule === 0 ? 1 : 0 });
    ruleTick += RULE_MIN + draw(RULE_MAX - RULE_MIN + 1);
  }
  const items: ClashItem[] = [];
  for (let index = 0; index < CLASH_TOTAL_ITEMS; index += 1) {
    const progress = index / (CLASH_TOTAL_ITEMS - 1);
    const spawn = Math.round(FIRST_SPAWN + index * (84 - 36 * progress));
    const decisionTick = Math.min(CLASH_RUN_TICKS - 1, spawn + Math.trunc(FALL_TICKS * 0.55));
    const active = gateColoursAt(gates, decisionTick);
    let rule: 0 | 1 = 0;
    for (const change of rules) if (change.tick <= decisionTick) rule = change.rule;
    const wanted = active[draw(active.length)]!;
    const other = draw(CLASH_NAMES.length - 1);
    const different = other >= wanted ? other + 1 : other;
    items.push({ spawn, word: rule === 1 ? wanted : different, ink: rule === 0 ? wanted : different });
  }
  return { items, gates, rules, rng };
}

function init(seed: number): ClashState {
  const plan = buildSchedule(seed);
  return { tick: 0, rng: plan.rng, items: plan.items, gates: plan.gates, rules: plan.rules, status: Array(CLASH_TOTAL_ITEMS).fill(0), sortedTick: Array(CLASH_TOTAL_ITEMS).fill(0), lowest: 0, correct: 0, wrong: 0, missed: 0, ended: 0 };
}

export function clashItemY(item: ClashItem, tick: number): number {
  return START_Y + Math.trunc(((GATE_Y - START_Y) * clampInt(tick - item.spawn, 0, FALL_TICKS)) / FALL_TICKS);
}

function isOver(state: ClashState): boolean { return state.ended !== 0 }

function step(state: ClashState, input: ArcadeInputEvent | null): ClashState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const next: ClashState = { ...state, tick };
  let lowest = next.lowest;
  while (lowest < next.items.length && next.status[lowest] !== 0) lowest += 1;
  const item = next.items[lowest];
  if (input?.k === CLASH_INPUT_SWIPE && item && item.spawn <= tick) {
    const direction = clampInt(input.a, 0, 3);
    const gate = direction === CLASH_LEFT ? 0 : direction === CLASH_RIGHT ? 1 : direction === CLASH_DOWN && tick >= CLASH_MIDDLE_TICK ? 2 : -1;
    if (gate >= 0) {
      next.status = next.status.slice();
      next.sortedTick = next.sortedTick.slice();
      next.status[lowest] = gate + 1;
      next.sortedTick[lowest] = tick;
      const wanted = clashRuleAt(next, tick) === 0 ? item.ink : item.word;
      if (clashGatesAt(next, tick)[gate] === wanted) next.correct += 1;
      else next.wrong += 1;
      lowest += 1;
    }
  }
  while (lowest < next.items.length) {
    const pending = next.items[lowest]!;
    if (next.status[lowest] !== 0) { lowest += 1; continue; }
    if (tick < pending.spawn + FALL_TICKS) break;
    next.status = next.status.slice();
    next.status[lowest] = -1;
    next.missed += 1;
    lowest += 1;
  }
  next.lowest = lowest;
  if (tick >= CLASH_RUN_TICKS) next.ended = 1;
  return next;
}

export function clashScoreOf(correct: number, wrong: number, total = CLASH_TOTAL_ITEMS): number {
  return clampInt(Math.round((150 * correct) / Math.max(1, total)) - 2 * wrong, 0, 150);
}

function score(state: ClashState): number { return clashScoreOf(state.correct, state.wrong, state.items.length) }

export const CLASH_CHECKPOINT_INTERVAL = 300;
export const CLASH_CHECKPOINT_KEYS = ["tick", "lowest", "correct", "wrong", "missed", "ended", "rng", "checksum"] as const;
export interface ClashCheckpoint { tick: number; lowest: number; correct: number; wrong: number; missed: number; ended: number; rng: number; checksum: number }
export function clashCheckpoint(state: ClashState): ClashCheckpoint {
  const snap = { tick: state.tick, lowest: state.lowest, correct: state.correct, wrong: state.wrong, missed: state.missed, ended: state.ended, rng: state.rng | 0 };
  let checksum = 0x811c9dc5;
  for (const value of [...Object.values(snap), ...state.status]) { checksum ^= value | 0; checksum = Math.imul(checksum, 0x01000193) >>> 0; }
  return { ...snap, checksum };
}

function draw(ctx: CanvasRenderingContext2D, state: ClashState, size: CanvasSize): void {
  const scale = Math.min(size.width / CLASH_WORLD_W, size.height / CLASH_WORLD_H);
  const ox = (size.width - CLASH_WORLD_W * scale) / 2;
  const oy = (size.height - CLASH_WORLD_H * scale) / 2;
  ctx.save(); ctx.fillStyle = "#07070D"; ctx.fillRect(0, 0, size.width, size.height); ctx.translate(ox, oy); ctx.scale(scale, scale);
  const rule = clashRuleAt(state, state.tick);
  const lastRule = [...state.rules].reverse().find((change) => change.tick <= state.tick);
  const flash = lastRule && state.tick - lastRule.tick < CLASH_FLASH_TICKS;
  ctx.fillStyle = flash && Math.trunc(state.tick / 5) % 2 === 0 ? "#F5B82E" : "#23232C"; ctx.fillRect(72, 10, 246, 46);
  ctx.fillStyle = flash && Math.trunc(state.tick / 5) % 2 === 0 ? "#07070D" : "#F5B82E"; ctx.font = "bold 22px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.fillText(rule === 0 ? "SORT BY INK" : "SORT BY WORD", 195, 41);
  ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.fillRect(132, 66, 126, 454);
  const gates = clashGatesAt(state, state.tick); const count = state.tick >= CLASH_MIDDLE_TICK ? 3 : 2;
  for (let gate = 0; gate < count; gate += 1) { const x = GATE_X[gate]!; const colour = gates[gate]!; ctx.fillStyle = CLASH_COLOURS[colour]!; ctx.fillRect(x - 38, 548, 76, 14); ctx.fillStyle = "#E9E9EF"; ctx.font = "bold 11px ui-monospace, monospace"; ctx.fillText(CLASH_NAMES[colour]!, x, 580); }
  for (let index = state.lowest; index < state.items.length; index += 1) { const item = state.items[index]!; if (item.spawn > state.tick) break; if (state.status[index] !== 0) continue; ctx.fillStyle = CLASH_COLOURS[item.ink]!; ctx.font = "bold 25px ui-sans-serif, sans-serif"; ctx.fillText(CLASH_NAMES[item.word]!, 195, clashItemY(item, state.tick) / FP); }
  ctx.fillStyle = "#E9E9EF"; ctx.font = "bold 14px ui-monospace, monospace"; ctx.fillText(`${state.correct} right · ${state.wrong} wrong · ${state.missed} missed`, 195, 608);
  ctx.restore();
}

export const colourClashGame: ArcadeGame<ClashState, ArcadeInputEvent | null> = { key: "stroop", runTicks: CLASH_RUN_TICKS, init, step, isOver, score, draw, inputRanges: CLASH_INPUT_RANGES };