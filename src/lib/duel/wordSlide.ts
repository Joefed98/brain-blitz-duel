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

export type SlideToken = SlideShift | "U" | "X" | { lock: number };

export function parseToken(token: string): SlideToken | null {
  if (token === "U" || token === "X") return token;
  const lock = /^L([0-4])$/.exec(token);
  if (lock) return { lock: Number(lock[1]) };
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

/** Shift one row (right = +1) or column (down = +1) by one, with wrap-around.
 * Locked rows never move; a column cycles only its unlocked cells. */
export function applyShift(grid: string[], shift: SlideShift, locked: ReadonlySet<number> = new Set()): string[] {
  const next = [...grid];
  if (shift.axis === "r" && locked.has(shift.index)) return next;
  if (shift.axis === "c" && locked.size) {
    const rows = Array.from({ length: WS_SIZE }, (_, r) => r).filter((r) => !locked.has(r));
    const n = rows.length;
    rows.forEach((r, k) => {
      const from = rows[(k - shift.dir + n) % n]!;
      next[r * WS_SIZE + shift.index] = grid[from * WS_SIZE + shift.index]!;
    });
    return next;
  }
  for (let k = 0; k < WS_SIZE; k++) {
    const from = (k - shift.dir + WS_SIZE) % WS_SIZE;
    if (shift.axis === "r") next[shift.index * WS_SIZE + k] = grid[shift.index * WS_SIZE + from]!;
    else next[k * WS_SIZE + shift.index] = grid[from * WS_SIZE + shift.index]!;
  }
  return next;
}

/** "L2" toggles the lock on row 2 (free). Undo/Reset unlock any row whose letters change. */
export function replayWordSlide(
  start: string[],
  tokens: string[],
): { grid: string[]; moves: number; locked: number[] } {
  const history: string[][] = [start];
  const locked = new Set<number>();
  let moves = 0;
  const dropChanged = (before: string[], after: string[]) => {
    for (const r of [...locked]) if (markedRowWord(before, r) !== markedRowWord(after, r)) locked.delete(r);
  };
  for (const token of tokens) {
    const parsed = parseToken(token);
    if (!parsed) continue;
    const current = history[history.length - 1]!;
    if (parsed === "U") {
      if (history.length > 1) history.pop();
      dropChanged(current, history[history.length - 1]!);
      moves++;
      continue;
    }
    if (parsed === "X") {
      history.length = 1;
      dropChanged(current, history[0]!);
      moves++;
      continue;
    }
    if ("lock" in parsed) {
      if (locked.has(parsed.lock)) locked.delete(parsed.lock);
      else locked.add(parsed.lock);
      continue;
    }
    if (parsed.axis === "r" && locked.has(parsed.index)) continue;
    history.push(applyShift(current, parsed, locked));
    moves++;
  }
  return { grid: history[history.length - 1]!, moves, locked: [...locked].sort() };
}

export function markedRowWord(grid: string[], row: number): string {
  return grid.slice(row * WS_SIZE, row * WS_SIZE + WS_SIZE).join("");
}
