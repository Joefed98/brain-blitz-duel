/** Number Pyramid rules shared by the phone, grader, and offline bank builder. */

export const NP_SET_SIZE = 4;
export const NP_DECOYS = 2;
export const NP_STAGE_CONFIG = [
  { rows: 5, minEmpty: 6, maxEmpty: 7, bottomLo: 1, bottomHi: 9 },
  { rows: 5, minEmpty: 8, maxEmpty: 10, bottomLo: 2, bottomHi: 12 },
  { rows: 5, minEmpty: 10, maxEmpty: 12, bottomLo: 4, bottomHi: 16 },
  { rows: 5, minEmpty: 12, maxEmpty: 13, bottomLo: 6, bottomHi: 20 },
] as const;

export function npCells(rows: number): number {
  return (rows * (rows + 1)) / 2;
}

export function npIndex(row: number, col: number): number {
  return (row * (row + 1)) / 2 + col;
}

function npRules(rows: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let r = 0; r < rows - 1; r++)
    for (let c = 0; c <= r; c++) out.push([npIndex(r, c), npIndex(r + 1, c), npIndex(r + 1, c + 1)]);
  return out;
}

export function npBuild(bottom: readonly number[]): number[] {
  const rows = bottom.length;
  const v = new Array<number>(npCells(rows)).fill(0);
  for (let c = 0; c < rows; c++) v[npIndex(rows - 1, c)] = bottom[c] ?? 0;
  for (let r = rows - 2; r >= 0; r--)
    for (let c = 0; c <= r; c++) v[npIndex(r, c)] = v[npIndex(r + 1, c)]! + v[npIndex(r + 1, c + 1)]!;
  return v;
}

export function npRulesHold(values: readonly (number | null)[], rows: number): boolean {
  return npRules(rows).every(([a, b, c]) => values[a] != null && values[a] === values[b]! + values[c]!);
}

export function npCountSolutions(givens: readonly (number | null)[], tray: readonly number[], rows: number, cap = 2): number {
  const empties: number[] = [];
  for (let r = rows - 1; r >= 0; r--) for (let c = 0; c <= r; c++) if (givens[npIndex(r, c)] == null) empties.push(npIndex(r, c));
  const counts = new Map<number, number>();
  for (const t of tray) counts.set(t, (counts.get(t) ?? 0) + 1);
  const values = [...givens];
  const rules = npRules(rows);
  const rulesOf = new Map<number, (readonly [number, number, number])[]>();
  for (const rule of rules) for (const cell of rule) rulesOf.set(cell, [...(rulesOf.get(cell) ?? []), rule]);
  let found = 0;
  const ok = (cell: number) =>
    (rulesOf.get(cell) ?? []).every(([a, b, c]) => values[a] == null || values[b] == null || values[c] == null || values[a] === values[b]! + values[c]!);
  const walk = (i: number) => {
    if (found >= cap) return;
    if (i === empties.length) { found++; return; }
    const cell = empties[i]!;
    for (const [value, n] of counts) {
      if (n <= 0) continue;
      values[cell] = value;
      if (ok(cell)) {
        counts.set(value, n - 1);
        walk(i + 1);
        counts.set(value, n);
      }
      values[cell] = null;
      if (found >= cap) return;
    }
  };
  walk(0);
  return found;
}

export type NpPlacements = Record<number, number>;
export interface NpRoundAnswer { active: number; boards: NpPlacements[] }

export function npEncode(placements: NpPlacements): string {
  return Object.entries(placements).map(([cell, tray]) => `${cell}:${tray}`).join(",");
}

export function npDecode(raw: string, givens: readonly (number | null)[], trayLength: number): NpPlacements {
  const out: NpPlacements = {};
  const used = new Set<number>();
  for (const part of String(raw ?? "").split(",").slice(0, givens.length)) {
    const [a, b] = part.split(":").map((x) => Number.parseInt(x, 10));
    if (!Number.isInteger(a) || !Number.isInteger(b) || a === undefined || b === undefined) continue;
    if (a < 0 || a >= givens.length || givens[a] != null || b < 0 || b >= trayLength) continue;
    if (used.has(b) || out[a] !== undefined) continue;
    used.add(b);
    out[a] = b;
  }
  return out;
}

export function npEncodeRound(active: number, boards: readonly NpPlacements[]): string {
  return JSON.stringify({ active: Math.max(0, Math.min(NP_SET_SIZE, active)), boards: boards.map(npEncode) });
}

export function npDecodeRound(raw: string): { active: number; boards: string[] } {
  try {
    const parsed = JSON.parse(raw) as { active?: unknown; boards?: unknown };
    const active = typeof parsed.active === "number" ? Math.max(0, Math.min(NP_SET_SIZE, Math.floor(parsed.active))) : 0;
    const boards = Array.isArray(parsed.boards) ? parsed.boards.slice(0, NP_SET_SIZE).map((v) => String(v ?? "")) : [];
    return { active, boards: Array.from({ length: NP_SET_SIZE }, (_, i) => boards[i] ?? "") };
  } catch {
    return { active: 0, boards: [raw, "", "", ""] };
  }
}

export function npFilled(givens: readonly (number | null)[], tray: readonly number[], placements: NpPlacements): (number | null)[] {
  return givens.map((g, cell) => (g != null ? g : placements[cell] !== undefined ? tray[placements[cell]!] ?? null : null));
}

export function npComplete(givens: readonly (number | null)[], tray: readonly number[], placements: NpPlacements, rows: number): boolean {
  const filled = npFilled(givens, tray, placements);
  return filled.every((v) => v != null) && npRulesHold(filled, rows);
}

export function npCorrectCells(givens: readonly (number | null)[], tray: readonly number[], solution: readonly number[], placements: NpPlacements): number {
  let correct = 0;
  for (const [cell, trayIndex] of Object.entries(placements)) if (tray[trayIndex] === solution[Number(cell)]) correct++;
  return correct;
}

export function scoreNumberPyramid(completed: number, allComplete: boolean, msRemaining: number, activeCorrect: number, activeEmpty: number, timeLimitMs: number): number {
  const base = 30 * Math.max(0, Math.min(NP_SET_SIZE, completed));
  const bonus = allComplete ? (timeLimitMs > 0 ? Math.round((30 * Math.max(0, Math.min(msRemaining, timeLimitMs))) / timeLimitMs) : 0) : 0;
  const partial = allComplete || activeEmpty <= 0 ? 0 : Math.round((30 * Math.max(0, Math.min(activeCorrect, activeEmpty))) / activeEmpty);
  return Math.min(150, base + bonus + partial);
}
