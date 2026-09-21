/**
 * Bomb Defusal: the panel shape, the action encoding, and the defuse plan.
 *
 * A panel's rules do not spell out one fixed sequence. They give a SET of
 * required actions plus ordering constraints ("X before Y", "X first",
 * "X last"). Any order that carries out exactly the required actions and
 * respects every constraint defuses the bomb — where the rules say nothing
 * about two actions, either order is right.
 *
 * The rule bank and the generator live server-side (`bomb.server.ts`) so the
 * plan cannot be worked out from the client bundle — only from the rule card on
 * screen, which is the puzzle.
 */

export type WireColour = "RED" | "BLUE" | "GREEN" | "YELLOW" | "WHITE";

export const WIRE_COLOURS: WireColour[] = ["RED", "BLUE", "GREEN", "YELLOW", "WHITE"];

export const WIRE_HEX: Record<WireColour, string> = {
  RED: "#FF4D4D",
  BLUE: "#4D8CFF",
  GREEN: "#3DDC84",
  YELLOW: "#FFE600",
  WHITE: "#F2F2F2",
};

export const BOMB_SWITCH_POSITIONS = ["LEFT", "MID", "RIGHT"] as const;
export type BombSwitch = (typeof BOMB_SWITCH_POSITIONS)[number];

export interface BombButton {
  label: "A" | "B";
  colour: WireColour;
}

/** `w2` cuts the third wire; `bA` presses button A. */
export type BombAction = string;

export function cutAction(wire: number): BombAction {
  return `w${wire}`;
}

export function pressAction(label: "A" | "B"): BombAction {
  return `b${label}`;
}

export function isCut(action: BombAction): boolean {
  return action.startsWith("w");
}

export function cutIndex(action: BombAction): number {
  return Number.parseInt(action.slice(1), 10);
}

export function actionLabel(action: BombAction, wires: WireColour[]): string {
  if (!isCut(action)) return `Press ${action.slice(1)}`;
  const index = cutIndex(action);
  const colour = wires[index];
  const name = colour ? colour.charAt(0) + colour.slice(1).toLowerCase() : "";
  return `Cut wire ${index + 1}${name ? ` (${name})` : ""}`;
}

export function encodeBombActions(actions: BombAction[]): string {
  return actions.join(",");
}

export function decodeBombActions(raw: string): BombAction[] {
  return (raw ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => /^w[0-9]$/.test(part) || /^b[AB]$/.test(part))
    .slice(0, 24);
}

/* -------------------------------------------------------------------------- */
/*  Ordering constraints                                                      */
/* -------------------------------------------------------------------------- */

export type BombConstraint =
  /** `a` must be carried out before `b`. */
  | { kind: "before"; a: BombAction; b: BombAction }
  /** `a` must be the very first action. */
  | { kind: "first"; a: BombAction }
  /** `a` must be the very last action. */
  | { kind: "last"; a: BombAction };

/** "bA<w2;first:bA;last:w6" */
export function encodeBombConstraints(constraints: BombConstraint[]): string {
  return constraints
    .map((constraint) =>
      constraint.kind === "before"
        ? `${constraint.a}<${constraint.b}`
        : `${constraint.kind}:${constraint.a}`,
    )
    .join(";");
}

const ACTION_RE = /^(?:w[0-9]|b[AB])$/;

export function decodeBombConstraints(raw: string): BombConstraint[] {
  const out: BombConstraint[] = [];
  for (const part of String(raw ?? "").split(";")) {
    const text = part.trim();
    if (!text) continue;
    if (text.includes("<")) {
      const [a, b] = text.split("<");
      if (a && b && ACTION_RE.test(a) && ACTION_RE.test(b)) out.push({ kind: "before", a, b });
      continue;
    }
    const [kind, a] = text.split(":");
    if (!a || !ACTION_RE.test(a)) continue;
    if (kind === "first") out.push({ kind: "first", a });
    else if (kind === "last") out.push({ kind: "last", a });
  }
  return out.slice(0, 24);
}

/**
 * The actions that must already be done before each action may be carried out.
 * "first" and "last" become edges against every other required action.
 */
export function bombPredecessors(
  required: BombAction[],
  constraints: BombConstraint[],
): Map<BombAction, Set<BombAction>> {
  const need = new Set(required);
  const before = new Map<BombAction, Set<BombAction>>();
  for (const action of required) before.set(action, new Set());
  const add = (action: BombAction, predecessor: BombAction) => {
    if (action === predecessor || !need.has(action) || !need.has(predecessor)) return;
    before.get(action)!.add(predecessor);
  };

  for (const constraint of constraints) {
    if (constraint.kind === "before") add(constraint.b, constraint.a);
    else if (constraint.kind === "first") {
      for (const other of required) add(other, constraint.a);
    } else {
      for (const other of required) add(constraint.a, other);
    }
  }
  return before;
}

/** True when the constraints can all be met at once (no cycle). */
export function bombPlanIsConsistent(
  required: BombAction[],
  constraints: BombConstraint[],
): boolean {
  return canonicalBombOrder(required, constraints) !== null;
}

/**
 * One valid order, chosen deterministically: at each step the available action
 * that sorts first. Returns null when the constraints contradict each other.
 */
export function canonicalBombOrder(
  required: BombAction[],
  constraints: BombConstraint[],
): BombAction[] | null {
  const before = bombPredecessors(required, constraints);
  const done: BombAction[] = [];
  const left = new Set(required);
  while (left.size > 0) {
    const ready = [...left]
      .filter((action) => [...before.get(action)!].every((pred) => done.includes(pred)))
      .sort();
    const next = ready[0];
    if (next === undefined) return null;
    done.push(next);
    left.delete(next);
  }
  return done;
}

export interface BombReplay {
  /** How many leading actions were legal at the moment they were carried out. */
  correctPrefix: number;
  exploded: boolean;
  defused: boolean;
  firstWrong: number | null;
}

/**
 * The single source of truth for the DEFUSE check. Every action must be one the
 * rules require, not already done, and not owed to an action still outstanding.
 * One wrong step and the bomb goes off.
 */
export function checkBombPlan(
  required: BombAction[],
  constraints: BombConstraint[],
  actions: BombAction[],
): BombReplay {
  const before = bombPredecessors(required, constraints);
  const need = new Set(required);
  const done: BombAction[] = [];
  let correctPrefix = 0;
  let firstWrong: number | null = null;

  for (let index = 0; index < actions.length; index++) {
    const action = actions[index]!;
    const legal =
      need.has(action) &&
      !done.includes(action) &&
      [...(before.get(action) ?? [])].every((pred) => done.includes(pred));
    if (!legal) {
      firstWrong = index;
      break;
    }
    done.push(action);
    correctPrefix += 1;
  }

  const defused = required.length > 0 && firstWrong === null && done.length === required.length;
  return {
    correctPrefix,
    defused,
    exploded: !defused,
    firstWrong: defused ? null : (firstWrong ?? correctPrefix),
  };
}
