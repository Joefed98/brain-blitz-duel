/**
 * Server-only generation for Bomb Defusal.
 *
 * The panel is built so that ambiguity and contradiction are impossible BY
 * CONSTRUCTION, in this order:
 *
 *  1. randomise the panel (seven wires, two buttons, the light, the serial),
 *  2. CHOOSE the four-action plan first — four distinct actions, in order,
 *     drawn from the nine the panel offers (seven cuts, two presses),
 *  3. generate four rules that are TRUE of that panel and that plan, each one
 *     an instance of a fixed template that is a testable predicate,
 *  4. enumerate all 9 × 8 × 7 × 6 = 3,024 ordered four-action sequences and
 *     keep the panel only when EXACTLY ONE of them satisfies all four rules —
 *     and it is the chosen one,
 *  5. check necessity: dropping any single rule must leave more than one
 *     satisfying sequence, otherwise the panel is re-rolled.
 *
 * Zero solutions (a contradiction) and several solutions (an ambiguity) are
 * therefore both rejected before the panel ever reaches a player. The server
 * stores the unique sequence, and a player's answer is right exactly when it
 * equals it.
 */

import {
  cutAction,
  cutIndex,
  encodeBombActions,
  encodeBombConstraints,
  isCut,
  pressAction,
  WIRE_COLOURS,
  BOMB_SWITCH_POSITIONS,
  type BombAction,
  type BombButton,
  type BombConstraint,
  type BombSwitch,
  type WireColour,
} from "./bomb";
import { pick, randomBelow, shuffled } from "./random";
import { BOMB_MAX_SEQUENCE, BOMB_RULE_COUNT, BOMB_WIRES } from "./types";
import type { BombPuzzleData } from "./types";

interface Panel {
  wires: WireColour[];
  buttons: BombButton[];
  light: boolean;
  serial: string;
  switchPosition: BombSwitch;
}

/** A rule on the card: its template instance id, its wording, its predicate. */
interface RuleInstance {
  id: string;
  text: string;
  /**
   * The predicate's own identity, independent of the panel and the wording —
   * "Cut wire 3" and "If the light is on, cut wire 3" share one. Sequence masks
   * are cached against it, so the proof never re-evaluates the same predicate.
   */
  key: string;
  test: (sequence: BombAction[]) => boolean;
}

/** The plan is always this long. */
const PLAN_LENGTH = BOMB_MAX_SEQUENCE;

/** The nine actions any panel offers. */
export const BOMB_ACTIONS: BombAction[] = [
  ...Array.from({ length: BOMB_WIRES }, (_, index) => cutAction(index)),
  pressAction("A"),
  pressAction("B"),
];

/** Every ordered choice of four distinct actions — 3,024 of them. */
const ALL_SEQUENCES: BombAction[][] = (() => {
  const out: BombAction[][] = [];
  const walk = (prefix: BombAction[]) => {
    if (prefix.length === PLAN_LENGTH) {
      out.push(prefix);
      return;
    }
    for (const action of BOMB_ACTIONS) {
      if (prefix.includes(action)) continue;
      walk([...prefix, action]);
    }
  };
  walk([]);
  return out;
})();

/* -------------------------------------------------------------------------- */
/*  Wording                                                                   */
/* -------------------------------------------------------------------------- */

const colourWord = (colour: WireColour) => colour.charAt(0) + colour.slice(1).toLowerCase();
const NUMBER_WORDS = ["zero", "one", "two", "three", "four"] as const;

/** "Cut wire 3" / "Press button A" — the only way an action is ever named. */
function phrase(action: BombAction): string {
  return isCut(action) ? `Cut wire ${cutIndex(action) + 1}` : `Press button ${action.slice(1)}`;
}

/** The same action as the object of a "before" clause. */
function gerund(action: BombAction): string {
  return isCut(action)
    ? `cutting wire ${cutIndex(action) + 1}`
    : `pressing button ${action.slice(1)}`;
}

const count = (panel: Panel, colour: WireColour) =>
  panel.wires.filter((wire) => wire === colour).length;
const serialOdd = (panel: Panel) => Number.parseInt(panel.serial, 10) % 2 === 1;

/** Panel conditions an "If …, …" rule may test. */
interface PanelCondition {
  id: string;
  text: string;
  holds: (panel: Panel) => boolean;
}

const CONDITIONS: PanelCondition[] = [
  { id: "lightOn", text: "the light is on", holds: (p) => p.light },
  { id: "lightOff", text: "the light is off", holds: (p) => !p.light },
  { id: "serialOdd", text: "the serial number is odd", holds: serialOdd },
  { id: "serialEven", text: "the serial number is even", holds: (p) => !serialOdd(p) },
  ...WIRE_COLOURS.map((colour) => ({
    id: `many:${colour}`,
    text: `there is more than one ${colourWord(colour)} wire`,
    holds: (p: Panel) => count(p, colour) > 1,
  })),
  ...WIRE_COLOURS.map((colour) => ({
    id: `none:${colour}`,
    text: `there is no ${colourWord(colour)} wire`,
    holds: (p: Panel) => count(p, colour) === 0,
  })),
];

/* -------------------------------------------------------------------------- */
/*  Templates                                                                 */
/* -------------------------------------------------------------------------- */

const at = (sequence: BombAction[], action: BombAction) => sequence.indexOf(action);
const has = (sequence: BombAction[], action: BombAction) => sequence.includes(action);

/**
 * Every rule the panel could carry, as a template instance with its predicate.
 * Rebuilding this list from a panel is how the uniqueness proof and the
 * inspection re-derive a stored card's rules.
 */
function candidateRules(panel: Panel): RuleInstance[] {
  const out: RuleInstance[] = [];
  const add = (
    id: string,
    text: string,
    key: string,
    test: (sequence: BombAction[]) => boolean,
  ) => out.push({ id, text, key, test });

  // "Cut wire N" and "Do not cut wire N"
  for (let wire = 0; wire < BOMB_WIRES; wire++) {
    const action = cutAction(wire);
    add(`cut:${wire}`, `Cut wire ${wire + 1}.`, `has:${action}`, (sequence) => has(sequence, action));
    add(`nocut:${wire}`, `Do not cut wire ${wire + 1}.`, `nohas:${action}`, (sequence) => !has(sequence, action));
  }

  // "Cut the first/last <colour> wire"
  for (const colour of WIRE_COLOURS) {
    if (count(panel, colour) === 0) continue;
    const first = panel.wires.indexOf(colour);
    const last = panel.wires.lastIndexOf(colour);
    add(
      `colour:first:${colour}`,
      `Cut the first ${colourWord(colour)} wire.`,
      `has:${cutAction(first)}`,
      (sequence) => has(sequence, cutAction(first)),
    );
    add(
      `colour:last:${colour}`,
      `Cut the last ${colourWord(colour)} wire.`,
      `has:${cutAction(last)}`,
      (sequence) => has(sequence, cutAction(last)),
    );
  }

  // "Press button A/B"
  for (const label of ["A", "B"] as const) {
    const action = pressAction(label);
    add(`press:${label}`, `Press button ${label}.`, `has:${action}`, (sequence) =>
      has(sequence, action),
    );
    add(
      `pressfirstcut:${label}`,
      `Press button ${label} before cutting any wire.`,
      `pressfirstcut:${label}`,
      (sequence) => {
        const index = at(sequence, action);
        if (index < 0) return false;
        return sequence.every((step, position) => !isCut(step) || position > index);
      },
    );
  }

  // Ordering: "<action> before <action>", "<action> first", "<action> last"
  for (const action of BOMB_ACTIONS) {
    add(
      `first:${action}`,
      `${phrase(action)} first.`,
      `first:${action}`,
      (sequence) => sequence[0] === action,
    );
    add(
      `last:${action}`,
      `${phrase(action)} last.`,
      `last:${action}`,
      (sequence) => sequence[sequence.length - 1] === action,
    );
    for (const other of BOMB_ACTIONS) {
      if (other === action) continue;
      add(
        `before:${action}>${other}`,
        `${phrase(action)} before ${gerund(other)}.`,
        `before:${action}>${other}`,
        (sequence) => {
          const a = at(sequence, action);
          const b = at(sequence, other);
          return a >= 0 && b >= 0 && a < b;
        },
      );
    }
  }

  // "Cut exactly N wires"
  for (const wires of [1, 2, 3]) {
    add(
      `exactcuts:${wires}`,
      `Cut exactly ${NUMBER_WORDS[wires]} wire${wires === 1 ? "" : "s"}.`,
      `exactcuts:${wires}`,
      (sequence) => sequence.filter(isCut).length === wires,
    );
  }

  // "If <panel condition>, <action>" — only for conditions this panel meets.
  for (const condition of CONDITIONS) {
    if (!condition.holds(panel)) continue;
    for (const action of BOMB_ACTIONS) {
      const body = phrase(action);
      add(
        `if:${condition.id}:${action}`,
        `If ${condition.text}, ${body.charAt(0).toLowerCase()}${body.slice(1)}.`,
        `has:${action}`,
        (sequence) => has(sequence, action),
      );
    }
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/*  Uniqueness                                                                */
/* -------------------------------------------------------------------------- */

/** Bit per sequence, so intersecting rule sets is a handful of word ANDs. */
const MASK_WORDS = Math.ceil(ALL_SEQUENCES.length / 32);

const MASK_CACHE = new Map<string, Uint32Array>();

/** Which of the 3,024 sequences a rule allows, cached by predicate. */
function maskOf(rule: RuleInstance): Uint32Array {
  const cached = MASK_CACHE.get(rule.key);
  if (cached) return cached;
  const mask = new Uint32Array(MASK_WORDS);
  for (let index = 0; index < ALL_SEQUENCES.length; index++) {
    if (rule.test(ALL_SEQUENCES[index]!)) mask[index >> 5]! |= 1 << (index & 31);
  }
  MASK_CACHE.set(rule.key, mask);
  return mask;
}

function everything(): Uint32Array {
  const bits = new Uint32Array(MASK_WORDS).fill(0xffff_ffff);
  for (let index = ALL_SEQUENCES.length; index < MASK_WORDS * 32; index++) {
    bits[index >> 5]! &= ~(1 << (index & 31));
  }
  return bits;
}

const ALL_BITS = everything();

function intersect(a: Uint32Array, b: Uint32Array): Uint32Array {
  const out = new Uint32Array(MASK_WORDS);
  for (let word = 0; word < MASK_WORDS; word++) out[word] = a[word]! & b[word]!;
  return out;
}

/** How many sequences survive, counted no further than `limit`. */
function countBits(bits: Uint32Array, limit = Number.MAX_SAFE_INTEGER): number {
  let total = 0;
  for (let word = 0; word < MASK_WORDS; word++) {
    let value = bits[word]!;
    while (value !== 0) {
      value &= value - 1;
      total += 1;
      if (total >= limit) return total;
    }
  }
  return total;
}

function firstBit(bits: Uint32Array): number {
  for (let word = 0; word < MASK_WORDS; word++) {
    const value = bits[word]!;
    if (value !== 0) return word * 32 + 31 - Math.clz32(value & -value);
  }
  return -1;
}

/** Every sequence all the rules allow, capped so the count stays cheap. */
function solutions(masks: Uint32Array[], limit = Number.MAX_SAFE_INTEGER): number[] {
  let bits = ALL_BITS;
  for (const mask of masks) bits = intersect(bits, mask);
  const out: number[] = [];
  for (let index = 0; index < ALL_SEQUENCES.length && out.length < limit; index++) {
    if ((bits[index >> 5]! >>> (index & 31)) & 1) out.push(index);
  }
  return out;
}

/** Dropping any single rule must leave more than one sequence standing. */
function isNecessary(masks: Uint32Array[]): boolean {
  for (let drop = 0; drop < masks.length; drop++) {
    let bits = ALL_BITS;
    for (let index = 0; index < masks.length; index++) {
      if (index !== drop) bits = intersect(bits, masks[index]!);
    }
    if (countBits(bits, 2) < 2) return false;
  }
  return true;
}

/**
 * Searches the pool for four rules that between them allow exactly the chosen
 * plan and nothing else, with every rule pulling its weight. Depth-first over
 * combinations: three rules must still leave room for more than one sequence,
 * the fourth must close it down to the plan alone.
 */
function chooseRules(masks: Uint32Array[], planIndex: number): number[] | null {
  const order = shuffled(masks.map((_, index) => index));
  const picked: number[] = [];

  const walk = (start: number, bits: Uint32Array): number[] | null => {
    for (let position = start; position < order.length; position++) {
      const index = order[position]!;
      const next = intersect(bits, masks[index]!);
      const depth = picked.length + 1;
      const count = countBits(next, depth === BOMB_RULE_COUNT ? 2 : 2);
      if (depth === BOMB_RULE_COUNT) {
        if (count !== 1 || firstBit(next) !== planIndex) continue;
        picked.push(index);
        const chosen = [...picked];
        picked.pop();
        if (isNecessary(chosen.map((rule) => masks[rule]!))) return chosen;
        continue;
      }
      if (count < 2) continue;
      picked.push(index);
      const found = walk(position + 1, next);
      picked.pop();
      if (found) return found;
    }
    return null;
  };

  return walk(0, ALL_BITS);
}

function randomPanel(): Panel {
  return {
    wires: Array.from({ length: BOMB_WIRES }, () => pick(WIRE_COLOURS)),
    buttons: [
      { label: "A", colour: pick(WIRE_COLOURS) },
      { label: "B", colour: pick(WIRE_COLOURS) },
    ],
    light: randomBelow(2) === 1,
    serial: Array.from({ length: 3 }, () => randomBelow(10)).join(""),
    switchPosition: pick(BOMB_SWITCH_POSITIONS),
  };
}

export const BOMB_RULE_TEMPLATE_COUNT = 10;

export interface BombGeneration {
  puzzle: BombPuzzleData;
  /** How many panels were rolled before one passed the proof. */
  attempts: number;
}

/** Rules considered per attempt — a random slice, to keep the search cheap. */
const POOL_SAMPLE = 40;

export function generateBombPanel(): BombGeneration {
  const planKey = (sequence: readonly string[]) => sequence.join(",");
  for (let attempt = 1; attempt <= 20_000; attempt++) {
    const panel = randomPanel();
    const plan = shuffled(BOMB_ACTIONS).slice(0, PLAN_LENGTH);
    const planIndex = ALL_SEQUENCES.findIndex(
      (sequence) => planKey(sequence) === planKey(plan),
    );
    const pool = shuffled(candidateRules(panel).filter((rule) => rule.test(plan))).slice(
      0,
      POOL_SAMPLE,
    );
    if (pool.length < BOMB_RULE_COUNT) continue;
    const masks = pool.map(maskOf);

    const picked = chooseRules(masks, planIndex);
    if (!picked) continue;

    // The plan must be the one surviving sequence, not merely one of them.
    const unique = solutions(picked.map((index) => masks[index]!));
    if (unique.length !== 1 || planKey(ALL_SEQUENCES[unique[0]!]!) !== planKey(plan)) continue;

    const rules = shuffled(picked.map((index) => pool[index]!)).map((rule) => ({
      id: rule.id,
      text: rule.text,
    }));
    // The stored ordering is the plan itself, chained, so only that exact
    // sequence defuses while a correct opening still earns partial credit.
    const constraints: BombConstraint[] = plan
      .slice(0, -1)
      .map((action, index) => ({ kind: "before", a: action, b: plan[index + 1]! }) as const);

    return {
      attempts: attempt,
      puzzle: {
        type: "bomb",
        wires: panel.wires,
        buttons: panel.buttons,
        light: panel.light,
        serial: panel.serial,
        switchPosition: panel.switchPosition,
        rules,
        stepCount: PLAN_LENGTH,
        required: encodeBombActions(plan),
        constraints: encodeBombConstraints(constraints),
        sequence: encodeBombActions(plan),
      },
    };
  }
  throw new Error("Bomb Defusal generator could not build an unambiguous panel");
}

export function generateBomb(): BombPuzzleData {
  const generated = generateBombPanel();
  console.log(
    `[bomb] panel accepted after ${generated.attempts} attempt(s): one unique four-action plan from ${BOMB_RULE_COUNT} rules`,
  );
  return generated.puzzle;
}

/** Re-derives a stored card's rules and re-runs the proof on them. */
export function inspectBombRules(puzzle: BombPuzzleData): {
  /** How many of the 3,024 sequences satisfy every rule. */
  solutions: number;
  /** Exactly one, and it is the stored plan. */
  unique: boolean;
  /** Dropping any single rule leaves more than one sequence. */
  necessary: boolean;
  /** Every rule's wording is exactly its template's. */
  wordingOk: boolean;
  /** Rules whose template instance could not be rebuilt. */
  unknownRules: number;
} {
  const panel: Panel = {
    wires: puzzle.wires,
    buttons: puzzle.buttons,
    light: puzzle.light,
    serial: puzzle.serial,
    switchPosition: puzzle.switchPosition,
  };
  const candidates = candidateRules(panel);
  const rebuilt = puzzle.rules.map(({ id }) => candidates.find((rule) => rule.id === id));
  const known = rebuilt.filter((rule): rule is RuleInstance => Boolean(rule));
  const masks = known.map(maskOf);
  const found = solutions(masks, 3);
  const plan = puzzle.sequence ?? puzzle.required ?? "";
  const necessary =
    known.length === puzzle.rules.length &&
    known.every((_, drop) => solutions(masks.filter((__, index) => index !== drop), 2).length >= 2);

  return {
    solutions: found.length,
    unique:
      found.length === 1 &&
      known.length === puzzle.rules.length &&
      ALL_SEQUENCES[found[0]!]!.join(",") === plan.split(",").join(","),
    necessary,
    wordingOk: puzzle.rules.every(
      (rule, index) => rebuilt[index]?.text === rule.text && rebuilt[index]?.id === rule.id,
    ),
    unknownRules: puzzle.rules.length - known.length,
  };
}
