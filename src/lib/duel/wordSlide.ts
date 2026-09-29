/**
 * Word Slide rules, shared by the phone and the server. The answer is a comma
 * list of tokens: "r2+" shifts row 2 right, "c1-" shifts column 1 up, "U" is
 * Undo and "X" is Reset. Undo and Reset never reduce the move count.
 */

export const WS_SIZE = 5;
export const WS_MARKED_ROWS = [0, 1, 2, 3, 4] as const;
export const WS_TIME_MS = 90_000;
export const WS_REVEAL_MS = 6_000;
export const WS_SHIFT_MS = 120;

export interface SlideShift {
  axis: "r" | "c";
  index: number;
  dir: 1 | -1;
}

export function shiftToken(shift: SlideShift): string {
  return `${shift.axis}${shift.index}${shift.dir > 0 ? "+" : "-"}`;
}

export function parseToken(token: string): SlideShift | "U" | "X" | null {
  if (token === "U" || token === "X") return token;
  const match = /^([rc])([0-4])([+-])$/.exec(token);
  if (!match) return null;
  return { axis: match[1] as "r" | "c", index: Number(match[2]), dir: match[3] === "+" ? 1 : -1 };
}

export function decodeSlideTokens(raw: string): string[] {
  if (typeof raw !== "string" || !raw) return [];
  return raw
    .split(",")
    .slice(0, 600)
    .filter((t) => parseToken(t) !== null);
}

/** Shift one row (right = +1) or column (down = +1) by one, with wrap-around. */
export function applyShift(grid: string[], shift: SlideShift): string[] {
  const next = [...grid];
  for (let k = 0; k < WS_SIZE; k++) {
    const from = (k - shift.dir + WS_SIZE) % WS_SIZE;
    if (shift.axis === "r") next[shift.index * WS_SIZE + k] = grid[shift.index * WS_SIZE + from]!;
    else next[k * WS_SIZE + shift.index] = grid[from * WS_SIZE + shift.index]!;
  }
  return next;
}

export function replayWordSlide(start: string[], tokens: string[]): { grid: string[]; moves: number } {
  const history: string[][] = [start];
  let moves = 0;
  for (const token of tokens) {
    const parsed = parseToken(token);
    if (!parsed) continue;
    if (parsed === "U") {
      if (history.length > 1) history.pop();
      continue;
    }
    if (parsed === "X") {
      history.length = 1;
      continue;
    }
    history.push(applyShift(history[history.length - 1]!, parsed));
    moves++;
  }
  return { grid: history[history.length - 1]!, moves };
}

export function markedRowWord(grid: string[], row: number): string {
  return grid.slice(row * WS_SIZE, row * WS_SIZE + WS_SIZE).join("");
}
