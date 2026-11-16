import type { GenerateContext } from "../generate.server";
import type { PuzzleData, TileGridPuzzleData } from "../types";
import type { Level } from "@/lib/levels/levels";
import { TILEGRID_LEVEL_SETTINGS, type TileGridLevelSettings } from "@/lib/levels/word/tilegrid";
import { pick, randInt, shuffled } from "../random";
import { placedCount, stampTileGridRev, TG_TILES } from "../tileGrid";
import { layout, tileGridValid, wordPool } from "../tileGrid.server";

/** Where a down word crosses: its letter index `j` in a word of `len` letters. */
function crossOk(s: TileGridLevelSettings, j: number, len: number): boolean {
  return s.cross === "start" ? j === 0 : j > 0 && j < len - 1;
}

/**
 * Interlock dealt at a level beyond Normal (the Word overhaul, stage 3; settings in src/lib/levels/word/tilegrid.ts):
 * today's recipe (an across word and two down words through it, fifteen tiles, every run a real word) with the level's
 * crossing rules and clock, on the deal's seeded randomness as Normal is. Never called at Normal.
 */
export function dealInterlockLevel(level: Exclude<Level, "normal">, _context: GenerateContext): PuzzleData | null {
  return buildTileGridLevel(TILEGRID_LEVEL_SETTINGS[level]);
}

/** The H a level board was built as, read back from its solution (the check proves the level's rules from it). */
export interface TileGridH {
  across: string;
  downs: { word: string; col: number; j: number }[];
}

export function buildTileGridLevel(s: TileGridLevelSettings): TileGridPuzzleData {
  const words = wordPool();
  for (let attempt = 0; attempt < 6000; attempt++) {
    const across = pick(words);
    if (s.acrossLen && across.length !== s.acrossLen) continue;
    const lengths = shuffled([4, 5, 6, 7]).flatMap((b) => [4, 5, 6, 7].map((c) => [b, c] as const));
    const fit = lengths.find(([b, c]) => across.length + b + c === TG_TILES + 2);
    if (!fit) continue;
    const lo = s.innerAcross ? 1 : 0;
    const hi = across.length - 1 - lo;
    const i = randInt(lo, hi);
    const k = randInt(lo, hi);
    if (Math.abs(k - i) < 2) continue;
    const fitsAt = (len: number, letter: string) => words.filter((w) => w.length === len && [...w].some((l, n) => l === letter && crossOk(s, n, len)));
    const downB = pick(fitsAt(fit[0], across[i]!));
    const downC = pick(fitsAt(fit[1], across[k]!));
    if (!downB || !downC || new Set([across, downB, downC]).size < 3) continue;
    const j = shuffled([...downB].map((l, n) => (l === across[i] && crossOk(s, n, downB.length) ? n : -1)).filter((n) => n >= 0))[0]!;
    const m = shuffled([...downC].map((l, n) => (l === across[k] && crossOk(s, n, downC.length) ? n : -1)).filter((n) => n >= 0))[0]!;
    const cells = layout([
      { word: across, row: 0, col: 0, horizontal: true },
      { word: downB, row: -j, col: i, horizontal: false },
      { word: downC, row: -m, col: k, horizontal: false },
    ]);
    if (!cells || placedCount(cells) !== TG_TILES || !tileGridValid(cells)) continue;
    return stampTileGridRev({ type: "tilegrid", tray: shuffled(cells.filter(Boolean)), solution: cells, timeLimitMs: s.timeLimitMs });
  }
  throw new Error("Interlock: no level board found");
}
