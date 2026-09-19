/**
 * Server-only generation for Bomb Defusal.
 *
 * Four rules are drawn from the bank and evaluated in order against a random
 * panel. A board is kept only when the required sequence is 2–4 actions long,
 * no rule contradicts another ("cut" versus "do not cut"), and at least three
 * of the four rules actually change the outcome — checked by removing each rule
 * in turn and comparing the sequence.
 */

import {
  cutAction,
  encodeBombActions,
  isCut,
  pressAction,
  WIRE_COLOURS,
  type BombAction,
  type BombButton,
  type WireColour,
} from "./bomb";
import { pick, randomBelow, shuffled } from "./random";
import { BOMB_MAX_SEQUENCE, BOMB_MIN_SEQUENCE, BOMB_RULE_COUNT, BOMB_WIRES } from "./types";
import type { BombPuzzleData } from "./types";

interface Panel {
  wires: WireColour[];
  buttons: BombButton[];
  light: boolean;
  serial: string;
}

type RuleMode = "prepend" | "append" | "afterBlue" | "fallback";

interface RuleOutput {
  mode: RuleMode;
  actions: BombAction[];
}

interface Rule {
  id: string;
  text: string;
  /** The actions this rule demands, or null when its condition does not hold. */
  apply: (panel: Panel) => RuleOutput | null;
  /** Actions this rule forbids outright. */
  forbid?: (panel: Panel) => BombAction[];
}

const count = (panel: Panel, colour: WireColour) =>
  panel.wires.filter((wire) => wire === colour).length;
const firstOf = (panel: Panel, colour: WireColour) => panel.wires.indexOf(colour);
const lastOf = (panel: Panel, colour: WireColour) => panel.wires.lastIndexOf(colour);
const serialDigits = (panel: Panel) => panel.serial.split("").map((d) => Number.parseInt(d, 10));
const serialOdd = (panel: Panel) => Number.parseInt(panel.serial, 10) % 2 === 1;
const buttonColour = (panel: Panel, label: "A" | "B") =>
  panel.buttons.find((button) => button.label === label)?.colour;
const cut = (wire: number): RuleOutput => ({ mode: "append", actions: [cutAction(wire)] });

/** The rule bank — every board's card is four of these, in the order drawn. */
const BOMB_RULES: Rule[] = [
  {
    id: "lastRed",
    text: "If there is more than one red wire, cut the last red wire.",
    apply: (p) => (count(p, "RED") > 1 ? cut(lastOf(p, "RED")) : null),
  },
  {
    id: "lightSecond",
    text: "Otherwise, if the light is on, cut the second wire.",
    apply: (p) => (p.light ? cut(1) : null),
  },
  {
    id: "serialOddPressA",
    text: "If the serial number is odd, press button A before cutting any wire.",
    apply: (p) => (serialOdd(p) ? { mode: "prepend", actions: [pressAction("A")] } : null),
  },
  {
    id: "noCutWhiteLast",
    text: "If the last wire is white, do not cut it.",
    apply: () => null,
    forbid: (p) =>
      p.wires[p.wires.length - 1] === "WHITE" ? [cutAction(p.wires.length - 1)] : [],
  },
  {
    id: "pressBAfterBlue",
    text: "Press button B after cutting the blue wire, if there is one.",
    apply: (p) =>
      count(p, "BLUE") > 0 ? { mode: "afterBlue", actions: [pressAction("B")] } : null,
  },
  {
    id: "fallbackFirst",
    text: "If no rule applied, cut the first wire.",
    apply: () => ({ mode: "fallback", actions: [cutAction(0)] }),
  },
  {
    id: "noRedThird",
    text: "If there is no red wire, cut the third wire.",
    apply: (p) => (count(p, "RED") === 0 ? cut(2) : null),
  },
  {
    id: "threeBlue",
    text: "If there are three or more blue wires, cut the last blue wire.",
    apply: (p) => (count(p, "BLUE") >= 3 ? cut(lastOf(p, "BLUE")) : null),
  },
  {
    id: "lightOffSerialEven",
    text: "If the light is off and the serial number is even, cut the first wire.",
    apply: (p) => (!p.light && !serialOdd(p) ? cut(0) : null),
  },
  {
    id: "firstYellow",
    text: "If there is a yellow wire, cut the first yellow wire.",
    apply: (p) => (count(p, "YELLOW") > 0 ? cut(firstOf(p, "YELLOW")) : null),
  },
  {
    id: "buttonAWhite",
    text: "If button A is white, press it first.",
    apply: (p) =>
      buttonColour(p, "A") === "WHITE" ? { mode: "prepend", actions: [pressAction("A")] } : null,
  },
  {
    id: "buttonBRed",
    text: "If button B is red, press it last.",
    apply: (p) =>
      buttonColour(p, "B") === "RED" ? { mode: "append", actions: [pressAction("B")] } : null,
  },
  {
    id: "oneGreen",
    text: "If there is exactly one green wire, cut it.",
    apply: (p) => (count(p, "GREEN") === 1 ? cut(firstOf(p, "GREEN")) : null),
  },
  {
    id: "noYellowLast",
    text: "If there is no yellow wire, cut the last wire.",
    apply: (p) => (count(p, "YELLOW") === 0 ? cut(p.wires.length - 1) : null),
  },
  {
    id: "firstRedFourth",
    text: "If the first wire is red, cut the fourth wire.",
    apply: (p) => (p.wires[0] === "RED" ? cut(3) : null),
  },
  {
    id: "serialHighLast",
    text: "If the last digit of the serial number is more than 5, cut the fifth wire.",
    apply: (p) => ((serialDigits(p)[2] ?? 0) > 5 ? cut(4) : null),
  },
  {
    id: "whiteOverBlue",
    text: "If there are more white wires than blue wires, cut the first white wire.",
    apply: (p) =>
      count(p, "WHITE") > count(p, "BLUE") && count(p, "WHITE") > 0
        ? cut(firstOf(p, "WHITE"))
        : null,
  },
  {
    id: "lightSameButtons",
    text: "If the light is on and both buttons are the same colour, press A then B.",
    apply: (p) =>
      p.light && buttonColour(p, "A") === buttonColour(p, "B")
        ? { mode: "append", actions: [pressAction("A"), pressAction("B")] }
        : null,
  },
  {
    id: "allDifferentMiddle",
    text: "If no two wires share a colour, cut the middle wire.",
    apply: (p) => (new Set(p.wires).size === p.wires.length ? cut(2) : null),
  },
  {
    id: "twoGreenSecond",
    text: "If there are exactly two green wires, cut the second green wire.",
    apply: (p) => (count(p, "GREEN") === 2 ? cut(lastOf(p, "GREEN")) : null),
  },
  {
    id: "serialOddBlueLast",
    text: "If the serial number is odd and the last wire is blue, cut the last wire.",
    apply: (p) =>
      serialOdd(p) && p.wires[p.wires.length - 1] === "BLUE" ? cut(p.wires.length - 1) : null,
  },
  {
    id: "noWhitePressB",
    text: "If there are no white wires, press button B.",
    apply: (p) => (count(p, "WHITE") === 0 ? { mode: "append", actions: [pressAction("B")] } : null),
  },
  {
    id: "noCutFirstGreen",
    text: "If the first wire is green, do not cut it.",
    apply: () => null,
    forbid: (p) => (p.wires[0] === "GREEN" ? [cutAction(0)] : []),
  },
];

interface Evaluated {
  sequence: BombAction[];
  /** A rule demanded an action another rule forbids. */
  contradictory: boolean;
}

/** Runs the chosen rules over a panel, in card order, into one action list. */
function evaluate(rules: Rule[], panel: Panel): Evaluated {
  const prepend: BombAction[] = [];
  const body: BombAction[] = [];
  const afterBlue: BombAction[] = [];
  const forbidden = new Set<BombAction>();
  let fallback: BombAction[] | null = null;
  let applied = false;

  for (const rule of rules) {
    for (const action of rule.forbid?.(panel) ?? []) forbidden.add(action);
    const out = rule.apply(panel);
    if (!out) continue;
    if (out.mode === "fallback") {
      fallback = out.actions;
      continue;
    }
    applied = true;
    if (out.mode === "prepend") prepend.push(...out.actions);
    else if (out.mode === "afterBlue") afterBlue.push(...out.actions);
    else body.push(...out.actions);
  }

  if (!applied && fallback) body.push(...fallback);

  let sequence = [...prepend, ...body];
  for (const action of afterBlue) {
    const blue = panel.wires.indexOf("BLUE");
    const at = sequence.indexOf(cutAction(blue));
    if (at >= 0) sequence.splice(at + 1, 0, action);
  }

  // A wire can only be cut once, and a repeated press is the same press.
  const seen = new Set<BombAction>();
  sequence = sequence.filter((action, index) => {
    if (isCut(action)) {
      if (seen.has(action)) return false;
      seen.add(action);
      return true;
    }
    return sequence[index - 1] !== action;
  });

  const contradictory = sequence.some((action) => forbidden.has(action));
  return { sequence, contradictory };
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
  };
}

export function generateBomb(): BombPuzzleData {
  for (let attempt = 0; attempt < 3000; attempt++) {
    const panel = randomPanel();
    const rules = shuffled(BOMB_RULES).slice(0, BOMB_RULE_COUNT);
    const { sequence, contradictory } = evaluate(rules, panel);
    if (contradictory) continue;
    if (sequence.length < BOMB_MIN_SEQUENCE || sequence.length > BOMB_MAX_SEQUENCE) continue;

    // At least three of the four rules must change what the player has to do.
    const reference = sequence.join(",");
    const effective = rules.filter((_, index) => {
      const without = evaluate(
        rules.filter((__, other) => other !== index),
        panel,
      );
      return without.sequence.join(",") !== reference;
    }).length;
    if (effective < 3) continue;

    return {
      type: "bomb",
      wires: panel.wires,
      buttons: panel.buttons,
      light: panel.light,
      serial: panel.serial,
      rules: rules.map((rule) => ({ id: rule.id, text: rule.text })),
      sequence: encodeBombActions(sequence),
    };
  }
  throw new Error("Bomb Defusal generator could not build a board with effective rules");
}
