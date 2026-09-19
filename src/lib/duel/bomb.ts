/**
 * Bomb Defusal: the panel shape, the action encoding, and the strike replay.
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

export const BOMB_MAX_STRIKES = 2;

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
  /** How many required steps were done in the right order. */
  steps: number;
  strikes: number;
  exploded: boolean;
  defused: boolean;
  /** One entry per action the player took: true when it was the next step. */
  verdicts: boolean[];
}

/** The single source of truth for strikes — run on the server at grading time. */
export function replayBomb(sequence: BombAction[], actions: BombAction[]): BombReplay {
  let steps = 0;
  let strikes = 0;
  const verdicts: boolean[] = [];

  for (const action of actions) {
    if (steps >= sequence.length) break;
    const correct = sequence[steps] === action;
    verdicts.push(correct);
    if (correct) steps += 1;
    else {
      strikes += 1;
      if (strikes >= BOMB_MAX_STRIKES) {
        return { steps, strikes, exploded: true, defused: false, verdicts };
      }
    }
  }

  return {
    steps,
    strikes,
    exploded: false,
    defused: sequence.length > 0 && steps === sequence.length,
    verdicts,
  };
}
