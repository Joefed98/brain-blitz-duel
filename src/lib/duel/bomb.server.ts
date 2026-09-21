/**
 * Server-only generation for Bomb Defusal.
 *
 * Six rules are drawn from a bank and evaluated against a random panel. The
 * rules yield one unambiguous PLAN: the set of actions that must be carried out,
 * plus the ordering constraints the rules impose. A panel is only kept when
 *
 *  - the required actions are 3 to 6 in number,
 *  - no rule forbids an action another rule requires,
 *  - the ordering constraints contain no cycle and no opposite pair,
 *  - at least two constraints actually bite,
 *  - at least four of the six rules change the plan, and
 *  - every rule's wording is one of the permitted forms, so no rule can be read
 *    two ways.
 *
 * Where the rules leave two actions unordered, either order defuses the bomb —
 * see `checkBombPlan` in `bomb.ts`, which both the server and the reveal use.
 */

import {
  canonicalBombOrder,
  cutAction,
  encodeBombActions,
  encodeBombConstraints,
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
import {
  BOMB_MAX_SEQUENCE,
  BOMB_MIN_EFFECTIVE_RULES,
  BOMB_MIN_ORDER_RULES,
  BOMB_MIN_SEQUENCE,
  BOMB_RULE_COUNT,
  BOMB_WIRES,
} from "./types";
import type { BombPuzzleData } from "./types";

interface Panel {
  wires: WireColour[];
  buttons: BombButton[];
  light: boolean;
  serial: string;
  switchPosition: BombSwitch;
}

interface Rule {
  id: string;
  text: string;
  /** Only applies when no other rule required anything. */
  fallback?: boolean;
  /** Does the rule's condition hold on this panel? */
  when: (panel: Panel) => boolean;
  /** Actions the rule requires when its condition holds. */
  actions?: (panel: Panel) => BombAction[];
  /** Actions the rule forbids when its condition holds. */
  forbid?: (panel: Panel) => BombAction[];
  /** Ordering the rule imposes when its condition holds. */
  order?: (panel: Panel) => BombConstraint[];
}

const count = (panel: Panel, colour: WireColour) =>
  panel.wires.filter((wire) => wire === colour).length;
const firstOf = (panel: Panel, colour: WireColour) => panel.wires.indexOf(colour);
const lastOf = (panel: Panel, colour: WireColour) => panel.wires.lastIndexOf(colour);
const serialOdd = (panel: Panel) => Number.parseInt(panel.serial, 10) % 2 === 1;
const lastDigit = (panel: Panel) => Number.parseInt(panel.serial.slice(-1), 10);
const buttonColour = (panel: Panel, label: "A" | "B") =>
  panel.buttons.find((button) => button.label === label)?.colour;

const cut = (wire: number): BombAction[] => (wire >= 0 ? [cutAction(wire)] : []);
const press = (label: "A" | "B"): BombAction[] => [pressAction(label)];

/* -------------------------------------------------------------------------- */
/*  Permitted wordings                                                        */
/* -------------------------------------------------------------------------- */

const COLOUR_WORDS = "red|blue|green|yellow|white";

/** The only action phrasings a rule may use, so no rule can be read two ways. */
const ACTION_FORMS: RegExp[] = [
  new RegExp(`^cut wire [1-9]( first| last)?$`),
  new RegExp(`^cut the (first|last) (${COLOUR_WORDS}) wire$`),
  new RegExp(`^press button [ab]( first| last)?$`),
  new RegExp(`^press button [ab] before pressing button [ab]$`),
  new RegExp(`^press button [ab] before cutting wire [1-9]$`),
  new RegExp(`^press button [ab] after cutting wire [1-9]$`),
  new RegExp(`^do not cut wire [1-9]$`),
];

/** True when every clause of a rule uses one of the permitted forms. */
export function bombWordingIsAllowed(text: string): boolean {
  const trimmed = text.trim().replace(/\.$/, "");
  const body = /^if [^,]+, /i.test(trimmed) ? trimmed.slice(trimmed.indexOf(", ") + 2) : trimmed;
  const action = body.toLowerCase();
  return ACTION_FORMS.some((form) => form.test(action));
}

/* -------------------------------------------------------------------------- */
/*  Rule bank                                                                 */
/* -------------------------------------------------------------------------- */

const BOMB_RULES: Rule[] = [
  {
    id: "lastRed",
    text: "If there is more than one red wire, cut the last red wire.",
    when: (p) => count(p, "RED") > 1,
    actions: (p) => cut(lastOf(p, "RED")),
  },
  {
    id: "lightSecond",
    text: "If the light is on, cut wire 2.",
    when: (p) => p.light,
    actions: () => cut(1),
  },
  {
    id: "serialOddPressAFirst",
    text: "If the serial number is odd, press button A first.",
    when: serialOdd,
    actions: () => press("A"),
    order: () => [{ kind: "first", a: pressAction("A") }],
  },
  {
    id: "noCutLastWhite",
    text: "If wire 7 is white, do not cut wire 7.",
    when: (p) => p.wires[BOMB_WIRES - 1] === "WHITE",
    forbid: () => cut(BOMB_WIRES - 1),
  },
  {
    id: "blueSoPressBLast",
    text: "If there is a blue wire, press button B last.",
    when: (p) => count(p, "BLUE") > 0,
    actions: () => press("B"),
    order: () => [{ kind: "last", a: pressAction("B") }],
  },
  {
    id: "fallbackFirstWire",
    text: "If no rule applied, cut wire 1.",
    fallback: true,
    when: () => true,
    actions: () => cut(0),
  },
  {
    id: "noRedThird",
    text: "If there is no red wire, cut wire 3.",
    when: (p) => count(p, "RED") === 0,
    actions: () => cut(2),
  },
  {
    id: "threeBlue",
    text: "If there are three or more blue wires, cut the last blue wire.",
    when: (p) => count(p, "BLUE") >= 3,
    actions: (p) => cut(lastOf(p, "BLUE")),
  },
  {
    id: "lightOffSerialEven",
    text: "If the light is off and the serial number is even, cut wire 1.",
    when: (p) => !p.light && !serialOdd(p),
    actions: () => cut(0),
  },
  {
    id: "firstYellow",
    text: "If there is a yellow wire, cut the first yellow wire.",
    when: (p) => count(p, "YELLOW") > 0,
    actions: (p) => cut(firstOf(p, "YELLOW")),
  },
  {
    id: "buttonAWhite",
    text: "If button A is white, press button A.",
    when: (p) => buttonColour(p, "A") === "WHITE",
    actions: () => press("A"),
  },
  {
    id: "buttonBRedLast",
    text: "If button B is red, press button B last.",
    when: (p) => buttonColour(p, "B") === "RED",
    actions: () => press("B"),
    order: () => [{ kind: "last", a: pressAction("B") }],
  },
  {
    id: "oneGreen",
    text: "If there is exactly one green wire, cut the first green wire.",
    when: (p) => count(p, "GREEN") === 1,
    actions: (p) => cut(firstOf(p, "GREEN")),
  },
  {
    id: "twoGreen",
    text: "If there are exactly two green wires, cut the last green wire.",
    when: (p) => count(p, "GREEN") === 2,
    actions: (p) => cut(lastOf(p, "GREEN")),
  },
  {
    id: "noYellowLast",
    text: "If there is no yellow wire, cut wire 7.",
    when: (p) => count(p, "YELLOW") === 0,
    actions: () => cut(BOMB_WIRES - 1),
  },
  {
    id: "firstRedFourth",
    text: "If wire 1 is red, cut wire 4.",
    when: (p) => p.wires[0] === "RED",
    actions: () => cut(3),
  },
  {
    id: "serialHighFifth",
    text: "If the last digit of the serial number is more than 5, cut wire 5.",
    when: (p) => lastDigit(p) > 5,
    actions: () => cut(4),
  },
  {
    id: "whiteOverBlue",
    text: "If there are more white wires than blue wires, cut the first white wire.",
    when: (p) => count(p, "WHITE") > count(p, "BLUE") && count(p, "WHITE") > 0,
    actions: (p) => cut(firstOf(p, "WHITE")),
  },
  {
    id: "switchLeftPressAFirst",
    text: "If the switch is LEFT, press button A first.",
    when: (p) => p.switchPosition === "LEFT",
    actions: () => press("A"),
    order: () => [{ kind: "first", a: pressAction("A") }],
  },
  {
    id: "switchMidFourth",
    text: "If the switch is MID, cut wire 4.",
    when: (p) => p.switchPosition === "MID",
    actions: () => cut(3),
  },
  {
    id: "switchRightPressBLast",
    text: "If the switch is RIGHT, press button B last.",
    when: (p) => p.switchPosition === "RIGHT",
    actions: () => press("B"),
    order: () => [{ kind: "last", a: pressAction("B") }],
  },
  {
    id: "twoWhiteSixth",
    text: "If there are at least two white wires, cut wire 6.",
    when: (p) => count(p, "WHITE") >= 2,
    actions: () => cut(5),
  },
  {
    id: "moreGreenRedSeventh",
    text: "If there are more green wires than red wires, cut wire 7.",
    when: (p) => count(p, "GREEN") > count(p, "RED"),
    actions: () => cut(BOMB_WIRES - 1),
  },
  {
    id: "noCutFirstGreen",
    text: "If wire 1 is green, do not cut wire 1.",
    when: (p) => p.wires[0] === "GREEN",
    forbid: () => cut(0),
  },
  {
    id: "pressABeforeB",
    text: "Press button A before pressing button B.",
    when: () => true,
    order: () => [{ kind: "before", a: pressAction("A"), b: pressAction("B") }],
  },
  {
    id: "greenWireThirdLast",
    text: "If there is a green wire, cut wire 3 last.",
    when: (p) => count(p, "GREEN") > 0,
    actions: () => cut(2),
    order: () => [{ kind: "last", a: cutAction(2) }],
  },
  {
    id: "lightOffSecondFirst",
    text: "If the light is off, cut wire 2 first.",
    when: (p) => !p.light,
    actions: () => cut(1),
    order: () => [{ kind: "first", a: cutAction(1) }],
  },
  {
    id: "serialEvenPressB",
    text: "If the serial number is even, press button B.",
    when: (p) => !serialOdd(p),
    actions: () => press("B"),
  },
  {
    id: "fifthRed",
    text: "If wire 5 is red, cut wire 5.",
    when: (p) => p.wires[4] === "RED",
    actions: () => cut(4),
  },
  {
    id: "seventhBlue",
    text: "If wire 7 is blue, cut wire 7.",
    when: (p) => p.wires[BOMB_WIRES - 1] === "BLUE",
    actions: () => cut(BOMB_WIRES - 1),
  },
  {
    id: "threeWarmPressA",
    text: "If there are at least three red or yellow wires, press button A.",
    when: (p) => count(p, "RED") + count(p, "YELLOW") >= 3,
    actions: () => press("A"),
  },
  {
    id: "noWhitePressB",
    text: "If there are no white wires, press button B.",
    when: (p) => count(p, "WHITE") === 0,
    actions: () => press("B"),
  },
  {
    id: "pressBAfterSecond",
    text: "Press button B after cutting wire 2.",
    when: () => true,
    order: () => [{ kind: "before", a: cutAction(1), b: pressAction("B") }],
  },
  {
    id: "buttonsSamePressAFirst",
    text: "If both buttons are the same colour, press button A first.",
    when: (p) => buttonColour(p, "A") === buttonColour(p, "B"),
    actions: () => press("A"),
    order: () => [{ kind: "first", a: pressAction("A") }],
  },
];

export const BOMB_RULE_TEMPLATE_COUNT = BOMB_RULES.length;

/* -------------------------------------------------------------------------- */
/*  Evaluation                                                                */
/* -------------------------------------------------------------------------- */

interface Plan {
  required: BombAction[];
  constraints: BombConstraint[];
  /** Constraints both of whose endpoints are required, so they actually bite. */
  liveConstraints: BombConstraint[];
  forbidden: BombAction[];
  /** A rule demands an action another rule forbids. */
  contradictory: boolean;
  /** The constraints can all be met at once. */
  consistent: boolean;
  /** One valid order, or null when the constraints contradict each other. */
  order: BombAction[] | null;
}

function evaluate(rules: Rule[], panel: Panel): Plan {
  const required: BombAction[] = [];
  const constraints: BombConstraint[] = [];
  const forbidden: BombAction[] = [];

  const addActions = (rule: Rule) => {
    for (const action of rule.actions?.(panel) ?? []) {
      if (!required.includes(action)) required.push(action);
    }
  };

  for (const rule of rules) {
    if (rule.fallback || !rule.when(panel)) continue;
    addActions(rule);
    for (const action of rule.forbid?.(panel) ?? []) {
      if (!forbidden.includes(action)) forbidden.push(action);
    }
    for (const constraint of rule.order?.(panel) ?? []) constraints.push(constraint);
  }

  if (required.length === 0) {
    for (const rule of rules) if (rule.fallback && rule.when(panel)) addActions(rule);
  }

  const need = new Set(required);
  const liveConstraints = constraints.filter((constraint) =>
    constraint.kind === "before"
      ? need.has(constraint.a) && need.has(constraint.b)
      : need.has(constraint.a) && required.length > 1,
  );
  const order = canonicalBombOrder(required, constraints);

  return {
    required,
    constraints,
    liveConstraints,
    forbidden,
    contradictory: required.some((action) => forbidden.includes(action)),
    consistent: order !== null,
    order,
  };
}

/** Signature of a plan, used to tell whether dropping a rule changes anything. */
function planKey(plan: Plan): string {
  return `${[...plan.required].sort().join(",")}|${encodeBombConstraints(
    [...plan.liveConstraints].sort((a, b) =>
      encodeBombConstraints([a]).localeCompare(encodeBombConstraints([b])),
    ),
  )}|${[...plan.forbidden].sort().join(",")}`;
}

export function inspectBombRules(puzzle: BombPuzzleData): {
  effective: number;
  contradictory: boolean;
  consistent: boolean;
  orderRules: number;
  wordingOk: boolean;
  required: number;
} {
  const panel: Panel = {
    wires: puzzle.wires,
    buttons: puzzle.buttons,
    light: puzzle.light,
    serial: puzzle.serial,
    switchPosition: puzzle.switchPosition,
  };
  const rules = puzzle.rules
    .map(({ id }) => BOMB_RULES.find((rule) => rule.id === id))
    .filter((rule): rule is Rule => Boolean(rule));
  const reference = evaluate(rules, panel);
  const key = planKey(reference);
  const effective = rules.filter((_, index) => {
    const without = evaluate(
      rules.filter((__, other) => other !== index),
      panel,
    );
    return planKey(without) !== key;
  }).length;

  return {
    effective,
    contradictory: reference.contradictory,
    consistent: reference.consistent,
    orderRules: reference.liveConstraints.length,
    wordingOk: puzzle.rules.every((rule) => bombWordingIsAllowed(rule.text)),
    required: reference.required.length,
  };
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

export function generateBomb(): BombPuzzleData {
  for (let attempt = 1; attempt <= 20_000; attempt++) {
    const panel = randomPanel();
    const rules = shuffled(BOMB_RULES).slice(0, BOMB_RULE_COUNT);
    if (!rules.every((rule) => bombWordingIsAllowed(rule.text))) continue;

    const plan = evaluate(rules, panel);
    if (plan.contradictory || !plan.consistent || !plan.order) continue;
    if (plan.required.length < BOMB_MIN_SEQUENCE || plan.required.length > BOMB_MAX_SEQUENCE) {
      continue;
    }
    if (plan.liveConstraints.length < BOMB_MIN_ORDER_RULES) continue;

    // At least four of the six rules must change the plan.
    const key = planKey(plan);
    const effective = rules.filter((_, index) => {
      const without = evaluate(
        rules.filter((__, other) => other !== index),
        panel,
      );
      return planKey(without) !== key;
    }).length;
    if (effective < BOMB_MIN_EFFECTIVE_RULES) continue;

    console.log(
      `[bomb] panel accepted after ${attempt} attempt(s): ${plan.required.length} required actions, ${plan.liveConstraints.length} live ordering constraints, ${effective} effective rules`,
    );
    return {
      type: "bomb",
      wires: panel.wires,
      buttons: panel.buttons,
      light: panel.light,
      serial: panel.serial,
      switchPosition: panel.switchPosition,
      rules: rules.map((rule) => ({ id: rule.id, text: rule.text })),
      stepCount: plan.required.length,
      required: encodeBombActions(plan.required),
      constraints: encodeBombConstraints(plan.constraints),
      sequence: encodeBombActions(plan.order),
    };
  }
  throw new Error("Bomb Defusal generator could not build an unambiguous panel");
}
