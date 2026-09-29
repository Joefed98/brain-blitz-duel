import { commonWords, isWord } from "./dictionary.server";
import { pick, randInt, shuffled } from "./random";
import {
  fitsTray,
  placedCount,
  TG_CELLS,
  TG_SIZE,
  TG_TILES,
  tileGridConnected,
  tileGridRuns,
} from "./tileGrid";
import type { TileGridPuzzleData } from "./types";

let pool: string[] | null = null;
function wordPool(): string[] {
  if (pool) return pool;
  pool = [
    ...new Set(
      commonWords().filter((w) => w.length >= 4 && w.length <= 6 && /^[a-z]+$/.test(w) && isWord(w)),
    ),
  ];
  return pool;
}

/** Every run is a real 3+ letter word and all tiles connect. */
export function tileGridValid(cells: string[]): boolean {
  if (placedCount(cells) < 3 || !tileGridConnected(cells)) return false;
  const runs = tileGridRuns(cells);
  if (!runs.length) return false;
  return runs.every((run) => run.word.length >= 3 && isWord(run.word));
}

type Placement = { word: string; row: number; col: number; horizontal: boolean };

function layout(parts: Placement[]): string[] | null {
  const cells = Array.from({ length: TG_CELLS }, () => "");
  let minR = 99, minC = 99, maxR = -99, maxC = -99;
  for (const p of parts) {
    for (let i = 0; i < p.word.length; i++) {
      const r = p.row + (p.horizontal ? 0 : i);
      const c = p.col + (p.horizontal ? i : 0);
      minR = Math.min(minR, r); maxR = Math.max(maxR, r);
      minC = Math.min(minC, c); maxC = Math.max(maxC, c);
    }
  }
  if (maxR - minR >= TG_SIZE || maxC - minC >= TG_SIZE) return null;
  const offR = randInt(0, TG_SIZE - 1 - (maxR - minR)) - minR;
  const offC = randInt(0, TG_SIZE - 1 - (maxC - minC)) - minC;
  for (const p of parts) {
    for (let i = 0; i < p.word.length; i++) {
      const index = (p.row + offR + (p.horizontal ? 0 : i)) * TG_SIZE + p.col + offC + (p.horizontal ? i : 0);
      const letter = p.word[i]!.toUpperCase();
      if (cells[index] && cells[index] !== letter) return null;
      cells[index] = letter;
    }
  }
  return cells;
}

const FALLBACK: Placement[] = [
  { word: "stone", row: 2, col: 0, horizontal: true },
  { word: "best", row: 0, col: 0, horizontal: false },
  { word: "bands", row: 0, col: 3, horizontal: false },
];

/** Three words (4–6 letters) in an H: one across, two down through it, twelve letters in all. */
export function generateTileGrid(): TileGridPuzzleData {
  const words = wordPool();
  for (let attempt = 0; attempt < 3000; attempt++) {
    const across = pick(words);
    const lengths = shuffled([4, 5, 6]).flatMap((b) => [4, 5, 6].map((c) => [b, c] as const));
    const fit = lengths.find(([b, c]) => across.length + b + c === 14);
    if (!fit) continue;
    const i = randInt(0, across.length - 1);
    const k = randInt(0, across.length - 1);
    if (Math.abs(k - i) < 2) continue;
    const downB = pick(words.filter((w) => w.length === fit[0] && w.includes(across[i]!)));
    const downC = pick(words.filter((w) => w.length === fit[1] && w.includes(across[k]!)));
    if (!downB || !downC || new Set([across, downB, downC]).size < 3) continue;
    const j = shuffled([...downB].map((l, n) => (l === across[i] ? n : -1)).filter((n) => n >= 0))[0]!;
    const m = shuffled([...downC].map((l, n) => (l === across[k] ? n : -1)).filter((n) => n >= 0))[0]!;
    const cells = layout([
      { word: across, row: 0, col: 0, horizontal: true },
      { word: downB, row: -j, col: i, horizontal: false },
      { word: downC, row: -m, col: k, horizontal: false },
    ]);
    if (!cells || placedCount(cells) !== TG_TILES || !tileGridValid(cells)) continue;
    return { type: "tilegrid", tray: shuffled(cells.filter(Boolean)), solution: cells };
  }
  const cells = layout(FALLBACK)!;
  return { type: "tilegrid", tray: shuffled(cells.filter(Boolean)), solution: cells };
}

export function checkTileGridWord(raw: string): { valid: boolean; points: number; word: string } {
  const word = String(raw ?? "").trim().toUpperCase();
  return { valid: word.length >= 3 && word.length <= 7 && isWord(word), points: 0, word };
}

export function judgeTileGrid(cells: string[], tray: string[]): { placed: number; valid: boolean } {
  if (!fitsTray(cells, tray)) return { placed: 0, valid: false };
  return { placed: placedCount(cells), valid: tileGridValid(cells) };
}
