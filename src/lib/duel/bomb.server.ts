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
import { BOMB_MAX_SEQUENCE, BOMB_NECESSARY_RULES, BOMB_RULE_COUNT, BOMB_WIRES } from "./types";
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
  /** Which of the four template families it comes from. */
  family: Family;
  /** Ordering rules on the same action pair in the same way share this. */
  pair?: string | undefined;
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
/*  The 40-template rule bank                                                 */
/* -------------------------------------------------------------------------- */

type Family = "conditional" | "ordering" | "counting" | "colour";

const colourWord = (colour: WireColour) => colour.charAt(0) + colour.slice(1).toLowerCase();
/** "cut wire 3" / "press A" — the {X}/{Y} wording. */
const act = (action: BombAction) =>
  isCut(action) ? `cut wire ${cutIndex(action) + 1}` : `press ${action.slice(1)}`;
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const count = (panel: Panel, colour: WireColour) =>
  panel.wires.filter((wire) => wire === colour).length;
const at = (sequence: BombAction[], action: BombAction) => sequence.indexOf(action);
const has = (sequence: BombAction[], action: BombAction) => sequence.includes(action);
const cutsOf = (sequence: BombAction[]) => sequence.filter(isCut).map(cutIndex);
const pressesOf = (sequence: BombAction[]) => sequence.filter((step) => !isCut(step));
const LABELS = ["A", "B"] as const;
const WIRES = Array.from({ length: BOMB_WIRES }, (_, index) => index);

/** The family of each template number, 1–40. */
function familyOf(template: number): Family {
  if (template <= 14) return "conditional";
  if (template <= 26) return "ordering";
  if (template <= 34) return "counting";
  return "colour";
}

export const BOMB_RULE_TEMPLATE_COUNT = 40;

/**
 * Every rule instance the panel could carry. Conditional templates are only
 * instanced when their condition holds on this panel, so each one really asks
 * for something. The id starts with the template number.
 */
function candidateRules(panel: Panel): RuleInstance[] {
  const out: RuleInstance[] = [];
  const add = (
    template: number,
    detail: string,
    text: string,
    key: string,
    test: (sequence: BombAction[]) => boolean,
    pair?: string,
  ) =>
    out.push({ id: `t${template}:${detail}`, text, key, test, family: familyOf(template), pair });

  const lastDigit = Number(panel.serial.at(-1));
  const digits = panel.serial.split("").map(Number);
  const digitSum = digits.reduce((a, b) => a + b, 0);
  const buttonColour = (label: "A" | "B") => panel.buttons.find((b) => b.label === label)!.colour;
  const present = WIRE_COLOURS.filter((colour) => count(panel, colour) > 0);

  const hasCut = (wire: number) => (sequence: BombAction[]) => has(sequence, cutAction(wire));
  const pressBeforeCuts = (label: "A" | "B") => (sequence: BombAction[]) => {
    const index = at(sequence, pressAction(label));
    return index >= 0 && sequence.every((step, position) => !isCut(step) || position > index);
  };

  // 1. If the light is ON, cut wire {N}.
  if (panel.light) {
    for (const wire of WIRES) add(1, `${wire}`, `If the light is ON, cut wire ${wire + 1}.`, `has:w${wire}`, hasCut(wire));
  }
  // 2. If the light is OFF, press button {A/B} at some point.
  if (!panel.light) {
    for (const label of LABELS) {
      add(2, label, `If the light is OFF, press button ${label} at some point.`, `has:b${label}`, (s) => has(s, pressAction(label)));
    }
  }
  // 3. Odd serial → press {A/B} before cutting any wire.
  if (lastDigit % 2 === 1) {
    for (const label of LABELS) {
      add(3, label, `If the serial ends in an odd digit, press button ${label} before cutting any wire.`, `pressfirst:${label}`, pressBeforeCuts(label));
    }
  }
  // 4. Even serial → cut wire {N} before pressing any button.
  if (lastDigit % 2 === 0) {
    for (const wire of WIRES) {
      add(4, `${wire}`, `If the serial ends in an even digit, cut wire ${wire + 1} before pressing any button.`, `cutfirst:${wire}`, (s) => {
        const index = at(s, cutAction(wire));
        return index >= 0 && s.every((step, position) => isCut(step) || position > index);
      });
    }
  }
  // 5. Serial contains {D} → cut the last {C} wire.
  for (const digit of new Set(digits)) {
    for (const colour of present) {
      const last = panel.wires.lastIndexOf(colour);
      add(5, `${digit}:${colour}`, `If the serial contains the digit ${digit}, cut the last ${colourWord(colour)} wire.`, `has:w${last}`, hasCut(last));
    }
  }
  // 6. More {C} than {C2} → cut the first {C} wire.
  for (const colour of present) {
    for (const other of WIRE_COLOURS) {
      if (other === colour || count(panel, colour) <= count(panel, other)) continue;
      const first = panel.wires.indexOf(colour);
      add(6, `${colour}:${other}`, `If there are more ${colourWord(colour)} wires than ${colourWord(other)} wires, cut the first ${colourWord(colour)} wire.`, `has:w${first}`, hasCut(first));
    }
  }
  // 7. If button A is {C}, press it first.
  add(7, buttonColour("A"), `If button A is ${colourWord(buttonColour("A"))}, press it first.`, "first:bA", (s) => s[0] === "bA");
  // 8. If button B is {C}, press it last.
  add(8, buttonColour("B"), `If button B is ${colourWord(buttonColour("B"))}, press it last.`, "last:bB", (s) => s[s.length - 1] === "bB");
  // 9. If wires {N} and {N2} are the same colour, cut neither.
  for (const a of WIRES) {
    for (const b of WIRES) {
      if (b <= a || panel.wires[a] !== panel.wires[b]) continue;
      add(9, `${a}:${b}`, `If wires ${a + 1} and ${b + 1} are the same colour, cut neither.`, `neither:${a}:${b}`, (s) => !has(s, cutAction(a)) && !has(s, cutAction(b)));
    }
  }
  // 10. If no wire is {C}, cut wire {N}.
  for (const colour of WIRE_COLOURS) {
    if (count(panel, colour) > 0) continue;
    for (const wire of WIRES) add(10, `${colour}:${wire}`, `If no wire is ${colourWord(colour)}, cut wire ${wire + 1}.`, `has:w${wire}`, hasCut(wire));
  }
  // 11. If exactly one wire is {C}, cut it.
  for (const colour of present) {
    if (count(panel, colour) !== 1) continue;
    const wire = panel.wires.indexOf(colour);
    add(11, colour, `If exactly one wire is ${colourWord(colour)}, cut it.`, `has:w${wire}`, hasCut(wire));
  }
  // 12. If the first and last wires match, press both buttons.
  if (panel.wires[0] === panel.wires[BOMB_WIRES - 1]) {
    add(12, "", "If the first and last wires match, press both buttons.", "both", (s) => has(s, "bA") && has(s, "bB"));
  }
  // 13. If the digit sum is more than {K}, cut the middle wire (wire 4).
  for (let k = Math.max(0, digitSum - 6); k < digitSum; k++) {
    add(13, `${k}`, `If the serial's digits add to more than ${k}, cut the middle wire (wire 4).`, "has:w3", hasCut(3));
  }
  // 14. If the light is ON and button A is {C}, do not press A.
  if (panel.light) {
    add(14, buttonColour("A"), `If the light is ON and button A is ${colourWord(buttonColour("A"))}, do not press A.`, "no:bA", (s) => !has(s, "bA"));
  }

  // 15–18. Ordering between named actions.
  for (const x of BOMB_ACTIONS) {
    add(17, x, `${cap(act(x))} is the first action.`, `first:${x}`, (s) => s[0] === x);
    add(18, x, `${cap(act(x))} is the last action.`, `last:${x}`, (s) => s[s.length - 1] === x);
    for (const y of BOMB_ACTIONS) {
      if (x === y) continue;
      const pair = [x, y].sort().join("|");
      add(15, `${x}>${y}`, `${cap(act(x))} before ${act(y)}.`, `before:${x}>${y}`, (s) => {
        const a = at(s, x);
        const b = at(s, y);
        return a >= 0 && b >= 0 && a < b;
      }, `before:${pair}`);
      add(16, `${x}>${y}`, `${cap(act(y))}, then ${act(x)} as the VERY NEXT action.`, `after:${x}>${y}`, (s) => {
        const a = at(s, x);
        const b = at(s, y);
        return a >= 0 && b >= 0 && a === b + 1;
      }, `after:${pair}`);
    }
  }
  // 19. Press button {A/B} before cutting any wire.
  for (const label of LABELS) {
    add(19, label, `Press button ${label} before cutting any wire.`, `pressfirst:${label}`, pressBeforeCuts(label));
  }
  // 20. Cut at least one wire before pressing any button.
  add(20, "", "Cut at least one wire before pressing any button.", "cutopens", (s) => isCut(s[0]!));
  // 21. The two button presses are not consecutive.
  add(21, "", "The two button presses are not consecutive.", "presses:apart", (s) => {
    const a = at(s, "bA");
    const b = at(s, "bB");
    return a >= 0 && b >= 0 && Math.abs(a - b) > 1;
  });
  // 22 / 23. Cut order.
  add(22, "", "Cut wires in left-to-right order (every cut wire has a higher number than the previous cut).", "cuts:asc", (s) => {
    const cuts = cutsOf(s);
    return cuts.every((wire, index) => index === 0 || wire > cuts[index - 1]!);
  });
  add(23, "", "Cut wires in right-to-left order.", "cuts:desc", (s) => {
    const cuts = cutsOf(s);
    return cuts.every((wire, index) => index === 0 || wire < cuts[index - 1]!);
  });
  // 24. The first wire you cut is {C}.
  for (const colour of present) {
    add(24, colour, `The first wire you cut is ${colourWord(colour)}.`, `firstcut:${colour}`, (s) => {
      const cuts = cutsOf(s);
      return cuts.length > 0 && panel.wires[cuts[0]!] === colour;
    });
  }
  // 25. The last wire you cut is to the right of the first wire you cut.
  add(25, "", "The last wire you cut is to the right of the first wire you cut.", "cuts:rightwards", (s) => {
    const cuts = cutsOf(s);
    return cuts.length >= 2 && cuts[cuts.length - 1]! > cuts[0]!;
  });
  // 26. Never cut two wires of the same colour in a row.
  add(26, "", "Never cut two wires of the same colour in a row.", "cuts:norepeat", (s) => {
    for (let index = 1; index < s.length; index++) {
      const a = s[index - 1]!;
      const b = s[index]!;
      if (isCut(a) && isCut(b) && panel.wires[cutIndex(a)] === panel.wires[cutIndex(b)]) return false;
    }
    return true;
  });

  // 27–34. Counting.
  for (const k of [2, 3, 4]) {
    add(27, `${k}`, `Cut exactly ${k} wires.`, `ncuts:${k}`, (s) => cutsOf(s).length === k);
  }
  for (const k of [0, 1, 2]) {
    add(28, `${k}`, `Press exactly ${k} button${k === 1 ? "" : "s"}.`, `npress:${k}`, (s) => pressesOf(s).length === k);
  }
  for (const colour of present) {
    for (let k = 0; k <= Math.min(4, count(panel, colour)); k++) {
      add(29, `${colour}:${k}`, `Cut exactly ${k} ${colourWord(colour)} wire${k === 1 ? "" : "s"}.`, `ncol:${colour}:${k}`, (s) => cutsOf(s).filter((w) => panel.wires[w] === colour).length === k);
    }
    for (const other of present) {
      if (other === colour) continue;
      add(30, `${colour}:${other}`, `Cut more ${colourWord(colour)} wires than ${colourWord(other)} wires.`, `more:${colour}:${other}`, (s) => {
        const cuts = cutsOf(s);
        return cuts.filter((w) => panel.wires[w] === colour).length > cuts.filter((w) => panel.wires[w] === other).length;
      });
    }
  }
  add(31, "", "Cut an odd number of wires.", "cuts:odd", (s) => cutsOf(s).length % 2 === 1);
  for (let k = 3; k <= 22; k++) {
    add(32, `${k}`, `The wire numbers you cut add up to ${k}.`, `sum:${k}`, (s) => cutsOf(s).reduce((a, w) => a + w + 1, 0) === k);
  }
  add(33, "", "Cut no two wires that are next to each other.", "cuts:spaced", (s) => {
    const cuts = cutsOf(s);
    return cuts.every((a) => cuts.every((b) => Math.abs(a - b) !== 1));
  });
  for (const k of [2, 3, 4]) {
    add(34, `${k}`, `Cut wires from at least ${k} different colours.`, `colours:${k}`, (s) => new Set(cutsOf(s).map((w) => panel.wires[w])).size >= k);
  }

  // 35–40. Colour logic.
  for (const colour of WIRE_COLOURS) {
    add(35, colour, `Do not cut any ${colourWord(colour)} wire.`, `nocol:${colour}`, (s) => cutsOf(s).every((w) => panel.wires[w] !== colour));
  }
  for (const colour of present) {
    const all = WIRES.filter((w) => panel.wires[w] === colour);
    add(36, colour, `Cut every ${colourWord(colour)} wire.`, `every:${colour}`, (s) => all.every((w) => has(s, cutAction(w))));
    const first = panel.wires.indexOf(colour);
    const last = panel.wires.lastIndexOf(colour);
    add(37, colour, `Cut the ${colourWord(colour)} wire that is furthest left.`, `has:w${first}`, hasCut(first));
    add(38, colour, `Cut the ${colourWord(colour)} wire that is furthest right.`, `has:w${last}`, hasCut(last));
  }
  for (const label of LABELS) {
    const colour = buttonColour(label);
    add(39, label, `Cut a wire of the same colour as button ${label}.`, `samecol:${colour}`, (s) => cutsOf(s).some((w) => panel.wires[w] === colour));
  }
  add(40, "", "Cut a wire whose colour is NOT the colour of either button.", "notbuttons", (s) =>
    cutsOf(s).some((w) => panel.wires[w] !== buttonColour("A") && panel.wires[w] !== buttonColour("B")),
  );

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

/** How many of a set's rules are individually necessary. */
function necessaryCount(masks: Uint32Array[]): number {
  let necessary = 0;
  for (let drop = 0; drop < masks.length; drop++) {
    let bits = ALL_BITS;
    for (let index = 0; index < masks.length; index++) {
      if (index !== drop) bits = intersect(bits, masks[index]!);
    }
    if (countBits(bits, 2) >= 2) necessary += 1;
  }
  return necessary;
}

/** Dropping any single rule must leave more than one sequence standing. */
function isNecessary(masks: Uint32Array[]): boolean {
  return necessaryCount(masks) === masks.length;
}

/** At most two rules from any one family. */
const FAMILY_CAP = 2;

/** No two rules may concern exactly the same action pair in the same way. */
function pairsDistinct(rules: (RuleInstance | undefined)[]): boolean {
  const seen = new Set<string>();
  for (const rule of rules) {
    if (!rule?.pair) continue;
    if (seen.has(rule.pair)) return false;
    seen.add(rule.pair);
  }
  return true;
}

function familiesOk(rules: RuleInstance[]): boolean {
  const counts = new Map<Family, number>();
  for (const rule of rules) {
    const next = (counts.get(rule.family) ?? 0) + 1;
    if (next > FAMILY_CAP) return false;
    counts.set(rule.family, next);
  }
  return true;
}

/**
 * Picks six rules (two per family at most, distinct pairs), always true of the
 * plan, so that exactly one sequence survives and at least four are necessary.
 * Depth-first: at each level the candidates that cut the survivors most are
 * tried first, a few at a time.
 */
function chooseRules(pool: RuleInstance[], masks: Uint32Array[], planIndex: number): number[] | null {
  const picked: number[] = [];
  let budget = 3000;
  const walk = (bits: Uint32Array): number[] | null => {
    if (budget-- <= 0) return null;
    if (picked.length === BOMB_RULE_COUNT) {
      if (countBits(bits, 2) !== 1 || firstBit(bits) !== planIndex) return null;
      if (necessaryCount(picked.map((index) => masks[index]!)) < BOMB_NECESSARY_RULES) return null;
      return [...picked];
    }
    const chosen = picked.map((index) => pool[index]!);
    const options: { index: number; next: Uint32Array; left: number }[] = [];
    for (const index of shuffled(pool.map((_, i) => i)).slice(0, 80)) {
      if (picked.includes(index)) continue;
      const rule = pool[index]!;
      if (!familiesOk([...chosen, rule]) || !pairsDistinct([...chosen, rule])) continue;
      const next = intersect(bits, masks[index]!);
      const left = countBits(next);
      // A rule that removes nothing can never be necessary at this point.
      if (left === countBits(bits)) continue;
      options.push({ index, next, left });
    }
    options.sort((a, b) => a.left - b.left);
    // Don't always take the sharpest cut — that leaves later rules redundant.
    const tries = shuffled(options.slice(0, 8)).slice(0, 3);
    for (const option of tries) {
      picked.push(option.index);
      const found = walk(option.next);
      picked.pop();
      if (found) return found;
    }
    return null;
  };
  return walk(ALL_BITS);
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


export interface BombGeneration {
  puzzle: BombPuzzleData;
  /** How many panels were rolled before one passed the proof. */
  attempts: number;
}

const planKey = (sequence: readonly string[]) => sequence.join(",");

/** Sequence text to its index, so a plan's slot is a lookup not a scan. */
const SEQUENCE_INDEX = new Map<string, number>(
  ALL_SEQUENCES.map((sequence, index) => [planKey(sequence), index]),
);

export function generateBombPanel(): BombGeneration {
  for (let attempt = 1; attempt <= 20_000; attempt++) {
    const panel = randomPanel();
    // Several predicates read the panel, so masks never carry across panels.
    MASK_CACHE.clear();
    const plan = shuffled(BOMB_ACTIONS).slice(0, PLAN_LENGTH);
    const planIndex = SEQUENCE_INDEX.get(planKey(plan))!;

    // Only rules true of this plan, one per distinct predicate — two rules that
    // say the same thing could never both be necessary.
    const seen = new Set<string>();
    const pool = shuffled(candidateRules(panel).filter((rule) => rule.test(plan))).filter(
      (rule) => !seen.has(rule.key) && seen.add(rule.key) !== undefined,
    );
    if (pool.length < BOMB_RULE_COUNT) continue;
    const masks = pool.map(maskOf);

    const picked = chooseRules(pool, masks, planIndex);
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
  /** At least four rules are individually necessary. */
  necessary: boolean;
  /** How many of the rules are individually necessary. */
  necessaryRules: number;
  /** No two rules concern the same action pair in the same way. */
  pairsDistinct: boolean;
  /** Every rule's wording is exactly its template's. */
  wordingOk: boolean;
  /** Rules whose template instance could not be rebuilt. */
  unknownRules: number;
  /** No family contributes more than two rules. */
  familiesOk: boolean;
} {
  const panel: Panel = {
    wires: puzzle.wires,
    buttons: puzzle.buttons,
    light: puzzle.light,
    serial: puzzle.serial,
    switchPosition: puzzle.switchPosition,
  };
  MASK_CACHE.clear();
  const candidates = candidateRules(panel);
  const rebuilt = puzzle.rules.map(({ id }) => candidates.find((rule) => rule.id === id));
  const known = rebuilt.filter((rule): rule is RuleInstance => Boolean(rule));
  const masks = known.map(maskOf);
  const found = solutions(masks, 3);
  const plan = puzzle.sequence ?? puzzle.required ?? "";
  const necessaryRules = known.filter(
    (_, drop) =>
      solutions(
        masks.filter((__, index) => index !== drop),
        2,
      ).length >= 2,
  ).length;
  const necessary = known.length === puzzle.rules.length && necessaryRules >= BOMB_NECESSARY_RULES;

  return {
    solutions: found.length,
    unique:
      found.length === 1 &&
      known.length === puzzle.rules.length &&
      ALL_SEQUENCES[found[0]!]!.join(",") === plan.split(",").join(","),
    necessary,
    necessaryRules,
    pairsDistinct: pairsDistinct(rebuilt),
    wordingOk: puzzle.rules.every(
      (rule, index) => rebuilt[index]?.text === rule.text && rebuilt[index]?.id === rule.id,
    ),
    unknownRules: puzzle.rules.length - known.length,
    familiesOk: familiesOk(known),
  };
}
