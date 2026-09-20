/**
 * Bomb Defusal: the panel shape, action encoding, and deferred defuse replay.
 * The rule bank and its evaluator live server-side (`bomb.server.ts`) so the
 * required sequence cannot be worked out from the client bundle — only from the
 * rule card on screen, which is the puzzle.
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

export interface BombReplay {
  /** Number of leading actions that exactly match the required sequence. */
  correctPrefix: number;
  exploded: boolean;
  defused: boolean;
  firstWrong: number | null;
}

/** The single source of truth for the final DEFUSE check. */
export function replayBomb(sequence: BombAction[], actions: BombAction[]): BombReplay {
  let correctPrefix = 0;
  while (
    correctPrefix < sequence.length &&
    correctPrefix < actions.length &&
    sequence[correctPrefix] === actions[correctPrefix]
  ) {
    correctPrefix += 1;
  }
  const defused =
    sequence.length > 0 && actions.length === sequence.length && correctPrefix === sequence.length;
  return { correctPrefix, defused, exploded: !defused, firstWrong: defused ? null : correctPrefix };
}
